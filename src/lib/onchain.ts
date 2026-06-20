import { createPublicClient, formatEther, http, parseAbiItem } from 'viem';
import { RITUAL_NETWORK, CONTRACTS } from './config';
import { ArcaneAttribute, CardOffer, RitualCard } from '../types';

export const publicClient = createPublicClient({
  chain: {
    id: RITUAL_NETWORK.id,
    name: RITUAL_NETWORK.name,
    nativeCurrency: RITUAL_NETWORK.nativeCurrency,
    rpcUrls: {
      default: { http: RITUAL_NETWORK.rpcUrls.default.http },
    },
  } as any,
  transport: http(),
});

const artifactForgedEvent = parseAbiItem(
  "event ArtifactForged(uint256 indexed tokenId, address indexed owner, address indexed creator, string categoryId, string subclass, string name, string uri)"
);

type ArtifactForgedLog = {
  args: {
    tokenId?: bigint;
    owner?: string;
    creator?: string;
    categoryId?: string;
    subclass?: string;
    name?: string;
    uri?: string;
  };
  blockNumber?: bigint;
};

type TokenMetadata = {
  name?: string;
  description?: string;
  image?: string;
  image_url?: string;
  animation_url?: string;
  attributes?: ArcaneAttribute[];
};

const LOG_CHUNK_SIZE = 10_000n;
const LOG_CHUNK_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function getNftDiscoveryStartBlock(): Promise<bigint | null> {
  if (CONTRACTS.NFT.deploymentBlock !== undefined) {
    return BigInt(CONTRACTS.NFT.deploymentBlock);
  }

  try {
    const receipt = await (publicClient as any).getTransactionReceipt({
      hash: CONTRACTS.NFT.deploymentTx,
    });
    if (receipt?.blockNumber !== undefined) {
      return BigInt(receipt.blockNumber);
    }
  } catch (error: any) {
    console.warn("[onchain] Could not resolve NFT deployment block from deployment tx:", error.message || error);
  }

  return null;
}

async function fetchArtifactForgedLogs(): Promise<ArtifactForgedLog[]> {
  const logs: ArtifactForgedLog[] = [];
  const latestBlock = await (publicClient as any).getBlockNumber() as bigint;
  const startBlock = await getNftDiscoveryStartBlock();
  if (startBlock === null) {
    console.warn("[onchain] NFT discovery skipped because deployment block could not be resolved.");
    return [];
  }

  let scannedFrom = startBlock;
  let failedChunks = 0;

  while (scannedFrom <= latestBlock) {
    const scannedTo = scannedFrom + LOG_CHUNK_SIZE - 1n > latestBlock
      ? latestBlock
      : scannedFrom + LOG_CHUNK_SIZE - 1n;

    try {
      const chunk = await (publicClient as any).getLogs({
        address: CONTRACTS.NFT.address as `0x${string}`,
        event: artifactForgedEvent,
        fromBlock: scannedFrom,
        toBlock: scannedTo,
      }) as ArtifactForgedLog[];
      logs.push(...chunk);
    } catch (error: any) {
      failedChunks += 1;
      console.warn(`[onchain] ArtifactForged log chunk failed for blocks ${scannedFrom}-${scannedTo}:`, error.message || error);
    }

    scannedFrom = scannedTo + 1n;
    if (scannedFrom <= latestBlock) {
      await sleep(LOG_CHUNK_DELAY_MS);
    }
  }

  const tokenIds = new Set(logs.flatMap(log => log.args?.tokenId === undefined ? [] : [log.args.tokenId.toString()]));
  console.info(`[onchain] NFT discovery scanned blocks ${startBlock.toString()}-${latestBlock.toString()} in ${LOG_CHUNK_SIZE.toString()} block chunks. Logs: ${logs.length}. Token IDs: ${Array.from(tokenIds).join(", ") || "none"}. Failed chunks: ${failedChunks}.`);

  return logs;
}

async function readTokenURI(tokenId: bigint): Promise<string> {
  try {
    return await (publicClient as any).readContract({
      address: CONTRACTS.NFT.address as `0x${string}`,
      abi: CONTRACTS.NFT.abi,
      functionName: 'tokenURI',
      args: [tokenId],
    }) as string;
  } catch {
    return "";
  }
}

async function loadTokenMetadata(uri: string): Promise<TokenMetadata | null> {
  if (!uri) return null;

  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const encoded = uri.replace("data:application/json;base64,", "");
      return JSON.parse(atob(encoded)) as TokenMetadata;
    }

    if (uri.startsWith("data:application/json,")) {
      const encoded = uri.replace("data:application/json,", "");
      return JSON.parse(decodeURIComponent(encoded)) as TokenMetadata;
    }

    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      const response = await fetch(uri);
      if (!response.ok) return null;
      return await response.json() as TokenMetadata;
    }
  } catch (error) {
    console.warn(`[onchain] Could not load token metadata from tokenURI:`, error);
  }

  return null;
}

export async function fetchOnchainCards(): Promise<RitualCard[]> {
  try {
    // Gracefully verify if the contract is active on the connected network
    try {
      const bytecode = await (publicClient as any).getBytecode({
        address: CONTRACTS.NFT.address as `0x${string}`,
      });
      if (!bytecode || bytecode === '0x') {
        console.warn(`[onchain] NFT Contract is not deployed or inactive at address ${CONTRACTS.NFT.address}`);
        return [];
      }
    } catch (err: any) {
      console.warn("[onchain] Could not fetch contract bytecode. RPC or contract is unreachable:", err.message || err);
      return [];
    }

    const forgedLogs = await fetchArtifactForgedLogs();
    const tokenEvents = new Map<string, ArtifactForgedLog>();
    for (const log of forgedLogs) {
      const tokenId = log.args?.tokenId;
      if (tokenId === undefined) continue;
      tokenEvents.set(tokenId.toString(), log);
    }

    const cards: RitualCard[] = [];
    const discoveredTokenIds = Array.from(tokenEvents.keys())
      .map(tokenId => BigInt(tokenId))
      .sort((a, b) => Number(a - b));

    if (discoveredTokenIds.length === 0) return [];

    const promises = discoveredTokenIds.map(async (tokenId) => {
      const tokenIdStr = tokenId.toString();
      const forgedLog = tokenEvents.get(tokenIdStr);
      try {
        const owner = await (publicClient as any).readContract({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'ownerOf',
          args: [tokenId],
        }) as string;

        const cardMeta = await (publicClient as any).readContract({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'cardData',
          args: [tokenId],
        }) as [string, string, string];

        const [discordId, discordRole, discordUsername] = cardMeta;
        const tokenURI = await readTokenURI(tokenId);
        const tokenMetadata = await loadTokenMetadata(tokenURI);

        // Fetch active Listing Id on marketplace
        const listingIdHex = await (publicClient as any).readContract({
          address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
          abi: CONTRACTS.MARKETPLACE.abi,
          functionName: 'activeListings',
          args: [CONTRACTS.NFT.address as `0x${string}`, tokenId],
        });
        
        const listingId = BigInt(listingIdHex as string | number | bigint);

        let isListed = false;
        let price = 0;
        let activeListingIdStr = "";

        if (listingId > 0n) {
          const listing = await (publicClient as any).readContract({
            address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
            abi: CONTRACTS.MARKETPLACE.abi,
            functionName: 'listings',
            args: [listingId],
          }) as [bigint, string, bigint, string, bigint, boolean];
          
          const [_lId, _nft, _tok, _seller, _price, _active] = listing;
          if (_active) {
            isListed = true;
            price = Number(_price) / 1e18; // converted from wei
            activeListingIdStr = listingId.toString();
          }
        }

        let category = (discordRole || "art").toLowerCase();
        if (["mod", "raiden", "radiant", "ritualist", "ritty", "bitty", "seeker"].includes(category)) {
          category = "art";
        }
        
        // Premium default imagery for existing onchain tokens
        const sampleAvatars: Record<string, string> = {
          art: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
          video: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop",
          audio: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
          utility: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop",
        };

        const imageUrl = sampleAvatars[category] || sampleAvatars.art;
        const metadataImage = tokenMetadata?.image || tokenMetadata?.image_url || tokenMetadata?.animation_url || "";
        const finalImageUrl = metadataImage || imageUrl;
        const metadataAttributes = Array.isArray(tokenMetadata?.attributes) ? tokenMetadata.attributes.slice(0, 6) : [];
        const eventName = forgedLog?.args?.name || "";
        const eventCategoryId = forgedLog?.args?.categoryId || "";
        const eventSubclass = forgedLog?.args?.subclass || "";
        const eventCreator = forgedLog?.args?.creator || "";

        const card: RitualCard = {
          tokenId: tokenIdStr,
          owner: owner,
          isListed: isListed,
          price: price,
          name: tokenMetadata?.name || discordUsername || eventName || `Arcane Artifact #${tokenIdStr}`,
          description: tokenMetadata?.description || `Exclusive customized ARCANE NFT Artifact minted on-chain. Verified statefully on the Arc testnet network.`,
          imageUrl: finalImageUrl,
          mediaType: category === "video" ? "video" : category === "audio" ? "audio" : "image",
          listingId: activeListingIdStr || undefined,
          royaltyPercent: 5,
          attributes: metadataAttributes,
          creator: eventCreator || owner,
          createdAt: new Date(1716500000000 + Number(tokenId) * 86400000).toISOString(),
          // Kept for backwards compatibility with old components
          discordId: discordId || eventCategoryId,
          discordUsername: discordUsername || eventName || `Arcane Artifact #${tokenIdStr}`,
          discordRole: category || eventSubclass,
          avatar: finalImageUrl,
          traits: {
            messages: 100,
            level: 5,
            activity: "High",
            daysInServer: 30
          }
        };

        cards.push(card);
      } catch (err) {
        console.warn(`Error compiling details for tokenId ${tokenId}`, err);
      }
    });

    await Promise.all(promises);
    return cards.sort((a,b) => parseInt(b.tokenId) - parseInt(a.tokenId));
  } catch (error: any) {
    console.warn("[onchain] fetchOnchainCards bypassed:", error.message || error);
    return [];
  }
}

export async function fetchOnchainOffers(
  nftAddress: `0x${string}`,
  tokenId: string
): Promise<CardOffer[]> {
  if (!/^\d+$/.test(tokenId)) return [];

  try {
    const tokenIdBigInt = BigInt(tokenId);
    const offerers = await (publicClient as any).readContract({
      address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
      abi: CONTRACTS.MARKETPLACE.abi,
      functionName: 'getOfferers',
      args: [nftAddress, tokenIdBigInt],
    }) as `0x${string}`[];

    const uniqueOfferers = Array.from(new Set(offerers.map(offerer => offerer.toLowerCase()))) as `0x${string}`[];

    const offers = await Promise.all(
      uniqueOfferers.map(async offererAddress => {
        const offer = await (publicClient as any).readContract({
          address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
          abi: CONTRACTS.MARKETPLACE.abi,
          functionName: 'offers',
          args: [nftAddress, tokenIdBigInt, offererAddress],
        }) as [`0x${string}`, bigint, boolean];

        const [offerer, amount, active] = offer;
        if (!active || amount <= 0n) return null;

        const cardOffer: CardOffer = {
          offerId: `${tokenId}_${offerer.toLowerCase()}`,
          tokenId,
          offerer,
          offererName: `${offerer.substring(0, 6)}...${offerer.substring(offerer.length - 4)}`,
          amount: Number(formatEther(amount)),
          active,
          createdAt: "",
        };

        return cardOffer;
      })
    );

    return offers
      .filter((offer): offer is CardOffer => offer !== null)
      .sort((a, b) => b.amount - a.amount);
  } catch (error: any) {
    console.warn(`[onchain] fetchOnchainOffers bypassed for tokenId ${tokenId}:`, error.message || error);
    return [];
  }
}

export async function flagInvalidLocalCards(
  localCards: RitualCard[],
  onchainCards: RitualCard[]
): Promise<RitualCard[]> {
  const onchainIds = new Set(onchainCards.map(card => card.tokenId));
  const checks = await Promise.all(
    localCards.map(async card => {
      if (onchainIds.has(card.tokenId) || card.invalidOnchain || !/^\d+$/.test(card.tokenId)) {
        return { tokenId: card.tokenId, invalid: false };
      }

      try {
        await (publicClient as any).readContract({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'ownerOf',
          args: [BigInt(card.tokenId)],
        });
        return { tokenId: card.tokenId, invalid: false };
      } catch {
        return { tokenId: card.tokenId, invalid: true };
      }
    })
  );

  const invalidTokenIds = new Set(checks.filter(check => check.invalid).map(check => check.tokenId));
  if (invalidTokenIds.size === 0) return localCards;

  return localCards.map(card => {
    if (!invalidTokenIds.has(card.tokenId)) return card;
    return {
      ...card,
      invalidOnchain: true,
      localOnly: true,
      isListed: false,
      price: undefined,
      listingId: undefined
    };
  });
}
