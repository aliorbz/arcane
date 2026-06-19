import { createPublicClient, http } from 'viem';
import { RITUAL_NETWORK, CONTRACTS } from './config';
import { RitualCard } from '../types';

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

    let totalSupplyHex;
    try {
      totalSupplyHex = await (publicClient as any).readContract({
        address: CONTRACTS.NFT.address as `0x${string}`,
        abi: CONTRACTS.NFT.abi,
        functionName: 'totalSupply',
      });
    } catch (contractErr: any) {
      console.warn("[onchain] Failed to call totalSupply on NFT contract (possibly inactive or not deployed yet):", contractErr.message || contractErr);
      return [];
    }
    
    const totalSupply = BigInt(totalSupplyHex as string | number | bigint);
    const cards: RitualCard[] = [];
    const count = Number(totalSupply);

    if (count === 0) return [];

    // Query details for each tokenId in parallel (limit to 100 max for latency protection)
    const promises = Array.from({ length: Math.min(count, 100) }, async (_, i) => {
      const tokenId = BigInt(i + 1);
      const tokenIdStr = tokenId.toString();
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

        const card: RitualCard = {
          tokenId: tokenIdStr,
          owner: owner,
          isListed: isListed,
          price: price,
          name: discordUsername || `Arcane Artifact #${tokenIdStr}`,
          description: `Exclusive customized ARCANE NFT Artifact minted on-chain. Verified statefully on the Arc testnet network.`,
          imageUrl: imageUrl,
          mediaType: category === "video" ? "video" : category === "audio" ? "audio" : "image",
          listingId: activeListingIdStr || undefined,
          royaltyPercent: 5,
          attributes: [],
          creator: owner,
          createdAt: new Date(1716500000000 + Number(tokenId) * 86400000).toISOString(),
          // Kept for backwards compatibility with old components
          discordId: discordId,
          discordUsername: discordUsername || `Arcane Artifact #${tokenIdStr}`,
          discordRole: category,
          avatar: imageUrl,
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
