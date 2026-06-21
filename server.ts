import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const MAX_METADATA_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_METADATA_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const METADATA_UPLOAD_RATE_LIMIT_MS = 60_000;
const METADATA_UPLOAD_RATE_LIMIT_MAX = 10;
const metadataUploadAttempts = new Map<string, number[]>();

type ArcaneAttribute = {
  trait_type: string;
  value: string | number;
};

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

function checkMetadataUploadRateLimit(ip: string): boolean {
  const now = Date.now();
  const recentAttempts = (metadataUploadAttempts.get(ip) || []).filter(
    timestamp => now - timestamp < METADATA_UPLOAD_RATE_LIMIT_MS
  );

  if (recentAttempts.length >= METADATA_UPLOAD_RATE_LIMIT_MAX) {
    metadataUploadAttempts.set(ip, recentAttempts);
    return false;
  }

  metadataUploadAttempts.set(ip, [...recentAttempts, now]);
  return true;
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

async function startServer() {
  const app = express();
  const PORT = 3000;
  const metadataUpload = multer({
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

  app.use(express.json());

  // Setup Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY_IF_UNDEFINED",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API chat route FIRST
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid request. messages array is required." });
      }

      // Safeguard in case GEMINI_API_KEY is not defined yet
      if (!process.env.GEMINI_API_KEY) {
        return res.json({ 
          text: "Greetings, collector! I am ARCANE.ai, fully active and ready to guide you. However, the `GEMINI_API_KEY` secret is not configured. Please open **Settings > Secrets** in the top navigation menu, add `GEMINI_API_KEY` with your Gemini API key, and restart the developer server. I will then have full cognitive intelligence!" 
        });
      }

      // Convert format to SDK compatible format: { role: string, parts: [{ text: string }] }
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content || m.text || "" }]
      }));

      // Set a robust system instruction
      const systemInstruction = 
        "You are ARCANE.ai, an elegant, omniscient cyber-wizard intelligence specialized in the Arcane Card Game and NFT ecosystem. " +
        "You are wise, futuristic, incredibly helpful, and a bit magical. Speak with clarity, occasional digital wizardry terminologies, " +
        "and maintain high visual formatting (use bullet points, elegant paragraphs, short code snippets). " +
        "Answer questions about cards, blockchain, tactics, lore, or general chat beautifully.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: err.message || "Something went wrong in the AI mainframe." });
    }
  });

  app.post("/api/metadata/upload", (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkMetadataUploadRateLimit(clientIp)) {
      return res.status(429).json({ error: "Too many metadata uploads. Please wait and try again." });
    }

    metadataUpload.single("image")(req, res, async (uploadError: any) => {
      try {
        if (uploadError) {
          return res.status(400).json({ error: uploadError.message || "Image upload failed." });
        }

        if (!process.env.PINATA_JWT) {
          return res.status(500).json({
            error: "IPFS storage is not configured. Set PINATA_JWT on the server.",
          });
        }

        const image = req.file;
        const name = String(req.body.name || "").trim();
        const description = String(req.body.description || "").trim();
        const externalUrl = String(req.body.external_url || "").trim();
        const category = String(req.body.category || "").trim();
        const mediaType = String(req.body.media_type || "image").trim();

        if (!image) {
          return res.status(400).json({ error: "Image file is required." });
        }

        if (!name) {
          return res.status(400).json({ error: "NFT name is required." });
        }

        let parsedAttributes: unknown = [];
        if (req.body.attributes) {
          try {
            parsedAttributes = JSON.parse(String(req.body.attributes));
          } catch {
            return res.status(400).json({ error: "Attributes must be valid JSON." });
          }
        }

        const attributes = normalizeAttributes(parsedAttributes);
        if (Array.isArray(parsedAttributes) && parsedAttributes.length > 6) {
          return res.status(400).json({ error: "Maximum 6 attributes allowed." });
        }

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

        return res.json({
          metadataURI: metadataUri,
          metadataGatewayURL: getIpfsGatewayUrl(metadataUri),
          imageURI: imageUri,
          imageGatewayURL: getIpfsGatewayUrl(imageUri),
        });
      } catch (error: any) {
        console.error("Metadata upload error:", error);
        return res.status(500).json({ error: error.message || "Metadata upload failed." });
      }
    });
  });

  // Serve raw media files from /media path
  app.use('/media', express.static(path.join(process.cwd(), 'media')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
