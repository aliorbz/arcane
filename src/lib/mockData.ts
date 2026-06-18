import { RitualCard, CardOffer, ActivityLog } from '../types';

export interface RoleConfig {
  name: string;
  type: string;
  primary: string;
  secondary: string;
  glow: string;
  text: string;
  bg: string;
  border: string;
  gradient: string;
  sampleAvatars: string[];
  description: string;
}

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  pfp: {
    name: "Profile Picture",
    type: "pfp",
    primary: "#38bdf8",
    secondary: "#818cf8",
    glow: "rgba(56, 189, 248, 0.4)",
    text: "text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    gradient: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
    sampleAvatars: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop"
    ],
    description: "Decentralized digital identities and premium avatar figures."
  },
  art: {
    name: "Generative Art",
    type: "art",
    primary: "#c084fc",
    secondary: "#f472b6",
    glow: "rgba(192, 132, 252, 0.4)",
    text: "text-purple-300",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    gradient: "linear-gradient(135deg, #c084fc 0%, #f472b6 35%, #60a5fa 100%)",
    sampleAvatars: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=600&auto=format&fit=crop"
    ],
    description: "Unique mathematical and algorithmic creations minted on the Arc network."
  },
  photography: {
    name: "Photography",
    type: "photography",
    primary: "#22d3ee",
    secondary: "#06b6d4",
    glow: "rgba(34, 211, 238, 0.4)",
    text: "text-cyan-300",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    gradient: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
    sampleAvatars: [
      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop"
    ],
    description: "Exquisite captured reality, real-world scenes, and cinematic visual elements."
  },
  pixel: {
    name: "Pixel Art",
    type: "pixel",
    primary: "#fbbf24",
    secondary: "#ea580c",
    glow: "rgba(251, 191, 36, 0.4)",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    gradient: "linear-gradient(135deg, #fbbf24 0%, #ea580c 100%)",
    sampleAvatars: [
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=600&auto=format&fit=crop"
    ],
    description: "Retro grid illustrations and nostalgia-infused digital blocks."
  }
};

// Add aliases for backwards compatibility
ROLE_CONFIGS.video = ROLE_CONFIGS.photography;
ROLE_CONFIGS.audio = ROLE_CONFIGS.pixel;
ROLE_CONFIGS.utility = ROLE_CONFIGS.pfp;

// Aliases for backwards compatibility during transition
export const CATEGORY_CONFIGS = ROLE_CONFIGS;

export const INITIAL_PRESET_CARDS: RitualCard[] = [];

export const INITIAL_PRESET_OFFERS: CardOffer[] = [];

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];

// Load current local states
export function getSavedState() {
  if (typeof window === 'undefined') {
    return {
      cards: INITIAL_PRESET_CARDS,
      offers: INITIAL_PRESET_OFFERS,
      logs: INITIAL_ACTIVITY_LOGS,
      walletConnected: false,
      walletAddress: "",
      balance: 100.0, // Pre-fund simulation wallet with more USDC !
      discordConnected: false,
      discordUser: null as any
    };
  }

  const storedCards = localStorage.getItem('ritual_tcg_cards');
  const storedOffers = localStorage.getItem('ritual_tcg_offers');
  const storedLogs = localStorage.getItem('ritual_tcg_logs');

  let parsedCards: RitualCard[] = storedCards ? JSON.parse(storedCards) : INITIAL_PRESET_CARDS;
  let parsedOffers: CardOffer[] = storedOffers ? JSON.parse(storedOffers) : INITIAL_PRESET_OFFERS;
  let parsedLogs: ActivityLog[] = storedLogs ? JSON.parse(storedLogs) : INITIAL_ACTIVITY_LOGS;

  // Filter out any leftover fake cards if they exists (any preset tokenIds)
  const presetIds = ["72", "88", "442", "550", "102", "85", "99", "1042", "301", "401", "501", "601"];
  parsedCards = parsedCards.filter(c => !presetIds.includes(c.tokenId));

  return {
    cards: parsedCards,
    offers: parsedOffers.filter(o => !["o1", "o2"].includes(o.offerId)),
    logs: parsedLogs.filter(l => !["a1", "a2", "a3", "a4"].includes(l.id)),
    walletConnected: localStorage.getItem('ritual_tcg_wallet_connected') === 'true',
    walletAddress: localStorage.getItem('ritual_tcg_wallet_address') || "",
    balance: parseFloat(localStorage.getItem('ritual_tcg_wallet_balance') || "100.0"),
    discordConnected: false,
    discordUser: null
  };
}

export function saveState(state: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ritual_tcg_cards', JSON.stringify(state.cards));
  localStorage.setItem('ritual_tcg_offers', JSON.stringify(state.offers));
  localStorage.setItem('ritual_tcg_logs', JSON.stringify(state.logs));
  localStorage.setItem('ritual_tcg_wallet_connected', String(state.walletConnected));
  localStorage.setItem('ritual_tcg_wallet_address', state.walletAddress);
  localStorage.setItem('ritual_tcg_wallet_balance', String(state.balance));
  localStorage.setItem('ritual_tcg_discord_connected', "false");
  localStorage.setItem('ritual_tcg_discord_user', "null");
}

