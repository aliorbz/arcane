import multer from "multer";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_METADATA_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_METADATA_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type ArcaneAttribute = {
  trait_type: string;
  value: string | number;
};

type MetadataUploadRequest = {
  file?: Express.Multer.File;
  body: Record<string, unknown>;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_METADATA_IMAGE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_METADATA_IMAGE_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported image type. Use JPG, PNG, WEBP, or GIF."));
      return;
    }
    cb(null, true);
  },
});

function sendJson(res: any, statusCode: number, body: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function runUploadMiddleware(req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single("image")(req, res, (error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function normalizeAttributes(input: unknown): ArcaneAttribute[] {
  if (!Array.isArray(input)) return [];

  return input.slice(0, 6).flatMap((attribute) => {
    if (!attribute || typeof attribute !== "object") return [];
    const traitType = String((attribute as any).trait_type || "").trim();
    const rawValue = (attribute as any).value;
    const value = typeof rawValue === "number" ? rawValue : String(rawValue ?? "").trim();
    if (!traitType || value === "") return [];
    return [{ trait_type: traitType, value }];
  });
}

function getIpfsGatewayUrl(uri: string): string {
  const gateway = process.env.IPFS_GATEWAY_URL || process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs";
  if (!uri.startsWith("ipfs://")) return uri;
  return `${gateway.replace(/\/$/, "")}/${uri.replace("ipfs://", "")}`;
}

async function pinFileToIpfs(file: Express.Multer.File): Promise<string> {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    throw new Error("IPFS storage is not configured. Set PINATA_JWT on the server.");
  }

  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  formData.append("file", blob, file.originalname);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Image upload failed: ${body || response.statusText}`);
  }

  const result = await response.json() as { IpfsHash?: string };
  if (!result.IpfsHash) {
    throw new Error("Image upload did not return an IPFS hash.");
  }

  return `ipfs://${result.IpfsHash}`;
}

async function pinJsonToIpfs(metadata: Record<string, unknown>): Promise<string> {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    throw new Error("IPFS storage is not configured. Set PINATA_JWT on the server.");
  }

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: {
        name: `${String(metadata.name || "ARCANE NFT")} metadata`,
      },
      pinataContent: metadata,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Metadata upload failed: ${body || response.statusText}`);
  }

  const result = await response.json() as { IpfsHash?: string };
  if (!result.IpfsHash) {
    throw new Error("Metadata upload did not return an IPFS hash.");
  }

  return `ipfs://${result.IpfsHash}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    await runUploadMiddleware(req, res);

    if (!process.env.PINATA_JWT) {
      sendJson(res, 500, { error: "IPFS storage is not configured. Set PINATA_JWT on the server." });
      return;
    }

    const uploadReq = req as MetadataUploadRequest;
    const image = uploadReq.file;
    const name = String(uploadReq.body.name || "").trim();
    const description = String(uploadReq.body.description || "").trim();
    const externalUrl = String(uploadReq.body.external_url || "").trim();
    const category = String(uploadReq.body.category || "").trim();
    const mediaType = String(uploadReq.body.media_type || "image").trim();

    if (!image) {
      sendJson(res, 400, { error: "Image file is required." });
      return;
    }

    if (!name) {
      sendJson(res, 400, { error: "NFT name is required." });
      return;
    }

    let parsedAttributes: unknown = [];
    if (uploadReq.body.attributes) {
      try {
        parsedAttributes = JSON.parse(String(uploadReq.body.attributes));
      } catch {
        sendJson(res, 400, { error: "Attributes must be valid JSON." });
        return;
      }
    }

    if (Array.isArray(parsedAttributes) && parsedAttributes.length > 6) {
      sendJson(res, 400, { error: "Maximum 6 attributes allowed." });
      return;
    }

    const attributes = normalizeAttributes(parsedAttributes);
    const imageUri = await pinFileToIpfs(image);
    const metadata: Record<string, unknown> = {
      name,
      description,
      image: imageUri,
      attributes,
      properties: {
        category,
        media_type: mediaType,
        source: "ARCANE",
      },
    };

    if (externalUrl) {
      metadata.external_url = externalUrl;
    }

    const metadataUri = await pinJsonToIpfs(metadata);

    sendJson(res, 200, {
      metadataURI: metadataUri,
      metadataGatewayURL: getIpfsGatewayUrl(metadataUri),
      imageURI: imageUri,
      imageGatewayURL: getIpfsGatewayUrl(imageUri),
    });
  } catch (error: any) {
    sendJson(res, 500, { error: error.message || "Metadata upload failed." });
  }
}
