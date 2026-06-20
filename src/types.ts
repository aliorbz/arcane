export interface ArcaneAttribute {
  trait_type: string;
  value: string | number;
}

export interface ArcaneNFT {
  tokenId: string;
  owner: string;
  isListed: boolean;
  price?: number;
  name: string;
  description: string;
  imageUrl: string;
  mediaType: "image" | "video" | "audio";
  listingId?: string;
  royaltyPercent?: number; // EIP-2981 royalty
  attributes: ArcaneAttribute[];
  creator?: string;
  createdAt: string;
  invalidOnchain?: boolean;
  localOnly?: boolean;

  // Backwards compatibility properties for standard components
  discordId?: string;
  discordUsername?: string;
  discordRole?: string;
  avatar?: string;
  traits?: {
    messages: number;
    level: number;
    activity: string;
    daysInServer: number;
  };
}

export type RitualCard = ArcaneNFT;

export interface CardOffer {
  offerId: string;
  tokenId: string;
  offerer: string;
  offererName: string;
  amount: number;
  active: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  tokenId: string;
  type: 'mint' | 'list' | 'buy' | 'cancel_list' | 'edit_list' | 'offer' | 'cancel_offer' | 'accept_offer' | 'transfer' | 'burn';
  fromAddress: string;
  toAddress: string;
  amount?: number;
  txHash?: string;
  timestamp: string;
}

