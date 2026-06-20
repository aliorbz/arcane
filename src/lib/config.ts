import { parseAbi } from "viem";

export const ARC_NETWORK = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    public: { http: ["https://rpc.testnet.arc.network"] },
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
};

export const RITUAL_NETWORK = ARC_NETWORK;

export const DISCORD_CONFIG = {
  serverId: "1210468736205852672",
  roles: {
    mod: "1218322564573822986",
    raiden: "1430908117331218442",
    ritualist: "1339006464139984906",
    ritty: "1430904963340566661",
    bitty: "1430904348757725325",
  },
};

export const MARKETPLACE_CONFIG = {
  listingFee: "0.01",
  platformFeePercent: 2.5,
  feeReceiver: "0x0000000000000000000000000000000000000000",
};

export const ROLE_COLORS = {
  mod: {
    primary: "#bae6fd",
    secondary: "#fbcfe8",
    glow: "rgba(186, 230, 253, 0.4)",
    text: "text-sky-200",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    isGradient: true,
    gradient: "linear-gradient(135deg, #bae6fd 0%, #fbcfe8 35%, #ffedd5 70%, #bae6fd 100%)"
  },
  radiant: {
    primary: "#FFD700",
    secondary: "#FDB931",
    glow: "rgba(255, 215, 0, 0.7)",
    text: "text-yellow-400",
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50"
  },
  ritualist: {
    primary: "#39FF14",
    secondary: "#32CD32",
    glow: "rgba(57, 255, 20, 0.5)",
    text: "text-green-400",
    bg: "bg-green-500/20",
    border: "border-green-500/30"
  },
  ritty: {
    primary: "#BF00FF",
    secondary: "#8B008B",
    glow: "rgba(191, 0, 255, 0.5)",
    text: "text-purple-400",
    bg: "bg-purple-500/20",
    border: "border-purple-500/30"
  },
  raiden: {
    primary: "#FFD700",
    secondary: "#FDB931",
    glow: "rgba(255, 215, 0, 0.7)",
    text: "text-yellow-400",
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50"
  },
  seeker: {
    primary: "#94A3B8",
    secondary: "#CBD5E1",
    glow: "rgba(148, 163, 184, 0.4)",
    text: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20"
  },
  bitty: {
    primary: "#00BFFF",
    secondary: "#0000FF",
    glow: "rgba(0, 191, 255, 0.5)",
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/30"
  },
};

export const NFT_ABI = parseAbi([
  "event ArtifactForged(uint256 indexed tokenId, address indexed owner, address indexed creator, string categoryId, string subclass, string name, string uri)",
  "function checkHasMinted(string discordId) public view returns (bool)",
  "function checkHasMintedRole(string discordId, string discordRole) public view returns (bool)",
  "function mintCard(address to, string discordId, string discordRole, string discordUsername) public payable returns (uint256)",
  "function updateCardData(uint256 tokenId, string discordRole, string discordUsername) public",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function approve(address to, uint256 tokenId) public",
  "function isApprovedForAll(address owner, address operator) public view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) public",
  "function cardData(uint256 tokenId) public view returns (string discordId, string discordRole, string discordUsername)",
  "function MINT_FEE() public view returns (uint256)",
]);

export const MARKETPLACE_ABI = parseAbi([
  "function listItem(address nftAddress, uint256 tokenId, uint256 price) external",
  "function cancelListing(uint256 listingId) external",
  "function buyItem(uint256 listingId) external payable",
  "function listings(uint256 listingId) public view returns (uint256 listingId, address nftAddress, uint256 tokenId, address seller, uint256 price, bool active)",
  "function activeListings(address nftAddress, uint256 tokenId) public view returns (uint256)",
  "function makeOffer(address nftAddress, uint256 tokenId) external payable",
  "function cancelOffer(address nftAddress, uint256 tokenId) external",
  "function acceptOffer(address nftAddress, uint256 tokenId, address offerer) external",
  "function offers(address nftAddress, uint256 tokenId, address offerer) public view returns (address offerer, uint256 amount, bool active)",
  "function getOfferers(address nftAddress, uint256 tokenId) external view returns (address[])",
]);

export const CONTRACTS = {
  NFT: {
    address: "0x92A6b7fafe0ea654f95938a9Ca744EB73598a285" as const,
    abi: NFT_ABI,
  },
  MARKETPLACE: {
    address: "0xee2F5618F01dF8D4b35ade4E6c16822b1E090F6f" as const,
    abi: MARKETPLACE_ABI,
  },
};
