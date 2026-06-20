import { useState, useMemo, useEffect, ReactNode, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Wallet, History, Sparkles, Filter, Search, ChevronRight } from 'lucide-react';
import { getSavedState, saveState } from '../lib/mockData';
import { ArcaneNFT, ActivityLog } from '../types';

// Custom reusable Glass Container representing Layered Glass Treatment
interface GlassContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function GlassContainer({ children, className = '', style }: GlassContainerProps) {
  return (
    <div
      className={`relative rounded-[36px] overflow-hidden bg-[#ffffff]/[0.08] border border-[#ffffff]/[0.12] shadow-[0_15px_45px_rgba(0,0,0,0.35)] transition-all duration-500 text-left ${className}`}
      style={{
        backdropFilter: 'blur(35px) saturate(180%)',
        WebkitBackdropFilter: 'blur(35px) saturate(180%)',
        ...style
      }}
    >
      {/* Layer 2: Inner Highlight Bevel */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-[#ffffff]/[0.18] pointer-events-none rounded-t-[36px] z-20" />
      <div className="absolute inset-0 rounded-[36px] border border-[#ffffff]/[0.06] pointer-events-none z-10" />

      {/* Layer 3: Subtle White Gradient Layer to emphasize luxury sheen */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/[0.01] via-white/[0.03] to-white/[0.07] z-0 rounded-[36px]" />

      {/* Layer 4: Exquisite Noise / Paper texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035] bg-repeat mix-blend-overlay z-0 rounded-[36px]" 
        style={{ 
          backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" 
        }} 
      />

      {/* Custom Extremely Slow, Calm Breathing Ambient Light Movement (12-20s duration) */}
      <motion.div
        animate={{
          x: [-60, 60, -60],
          y: [-40, 40, -40],
          opacity: [0.3, 0.45, 0.3],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] pointer-events-none bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.06)_0%,rgba(168,85,247,0.04)_35%,rgba(255,255,255,0.01)_60%,transparent_100%)] mix-blend-screen z-0"
      />

      {/* Content Layer */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}

// ProfileHeroCard Component
interface ProfileHeroCardProps {
  name: string;
  address: string;
  copied: boolean;
  onCopy: () => void;
  avatarUrl: string;
}

export function ProfileHeroCard({ name, address, copied, onCopy, avatarUrl }: ProfileHeroCardProps) {
  const shortAddress = useMemo(() => {
    if (!address) return "0xUnconnected";
    return `${address.substring(0, 10).toLowerCase()}...${address.substring(address.length - 8).toLowerCase()}`;
  }, [address]);

  return (
    <GlassContainer className="w-full h-auto min-h-[200px] flex items-center p-8 sm:p-10 relative">
      <div className="flex flex-col sm:flex-row items-center gap-8 w-full">
        {/* Avatar block with circular soft border & subtle glow */}
        <div className="relative w-[140px] h-[140px] rounded-full overflow-hidden shrink-0 border-2 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.08)] bg-black/40">
          <img
            src={avatarUrl}
            alt="Arcanian Profile Avatar"
            className="w-full h-full object-cover rounded-full"
          />
        </div>

        {/* Profile metadata text */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-3.5 mb-2.5">
            <h1 
              className="text-white text-3xl sm:text-[38px] font-normal leading-none tracking-[0.06em] select-none uppercase"
              style={{ fontFamily: 'Perandory, "Perandory", serif' }}
            >
              {name}
            </h1>
            <div className="w-5 h-5 rounded-full bg-white/10 text-white/95 flex items-center justify-center text-[9px] font-sans border border-white/20 shadow-sm shrink-0">
              ✓
            </div>
          </div>

          {/* Copy-ready Wallet Hex Address block */}
          <div className="flex items-center gap-2 bg-[#ffffff]/[0.03] border border-white/5 py-1.5 px-4 rounded-full w-fit mx-auto sm:mx-0 shadow-inner group">
            <span 
              className="font-normal text-xs text-white/50 tracking-widest select-all uppercase"
              style={{ fontFamily: 'Forum, "Forum", serif' }}
            >
              {shortAddress}
            </span>
            <button
              onClick={onCopy}
              className="text-white/35 hover:text-white/80 transition-all p-0.5"
              title="Copy hex address"
            >
              {copied ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <Copy size={12} className="group-hover:scale-105 transition-transform" />
              )}
            </button>
          </div>
        </div>
      </div>
    </GlassContainer>
  );
}

// WalletBalanceCard Component
interface WalletBalanceCardProps {
  balance: number;
  usdValueString: string;
}

export function WalletBalanceCard({ balance, usdValueString }: WalletBalanceCardProps) {
  return (
    <GlassContainer className="w-full h-auto min-h-[200px] flex flex-col justify-center p-8 sm:p-9 relative">
      <div className="flex flex-col h-full justify-between gap-6">
        
        {/* balance description label & wallet icon */}
        <div className="flex items-center gap-2 text-white/55">
          <Wallet size={14} className="opacity-75" />
          <span 
            className="text-[12px] uppercase tracking-[0.16em]"
            style={{ fontFamily: 'Forum, "Forum", serif' }}
          >
            wallet balance
          </span>
        </div>

        {/* balance value text in Perandory - dominate visually */}
        <div className="my-auto">
          <div 
            className="text-white text-3xl sm:text-[38px] font-normal tracking-[0.04em] leading-tight select-none"
            style={{ fontFamily: 'Perandory, "Perandory", serif' }}
          >
            {balance.toFixed(2)} USDC
          </div>
          
          <div 
            className="text-white/40 text-xs sm:text-[14px] mt-1 tracking-wider"
            style={{ fontFamily: 'Forum, "Forum", serif' }}
          >
            ≈ {usdValueString}
          </div>
        </div>

      </div>
    </GlassContainer>
  );
}

interface ProfileViewProps {
  setCurrentView: (view: string) => void;
  setSelectedCardId: (id: string | null) => void;
}

export function ProfileView({ setCurrentView, setSelectedCardId }: ProfileViewProps) {
  const [state, setState] = useState(getSavedState());

  // Periodically refresh items from shared persistent store
  useEffect(() => {
    const interval = setInterval(() => {
      setState(getSavedState());
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const [activeTab, setActiveTab] = useState<"collected" | "created" | "offers" | "activity">("collected");
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Search/Filters inside profile
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("All");

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleCopyAddress = () => {
    const addr = state.walletConnected && state.walletAddress ? state.walletAddress : "0x8920BE081C7BAAB78627B4EEF2E7F938BA0A9A1A";
    navigator.clipboard.writeText(addr);
    setCopied(true);
    showNotification("📋 Copied wallet address to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter collected cards
  const collectedCardsDisplay = useMemo(() => {
    let list = state.cards.filter(card => {
      if (!state.walletConnected) {
        // Return a high fidelity showcase matching Arcanian #001
        return card.owner.toLowerCase().includes("8920be") || card.owner.toLowerCase().includes("3709ce") || card.tokenId === "72" || card.tokenId === "88";
      }
      return card.owner.toLowerCase() === state.walletAddress.toLowerCase();
    });
    return list;
  }, [state.cards, state.walletConnected, state.walletAddress]);

  // Filter created cards
  const createdCardsDisplay = useMemo(() => {
    let list = state.cards.filter(card => {
      if (!state.walletConnected) {
        return card.creator?.toLowerCase().includes("8920be") || card.tokenId === "72" || card.tokenId === "102";
      }
      return card.creator && card.creator.toLowerCase() === state.walletAddress.toLowerCase();
    });
    return list;
  }, [state.cards, state.walletConnected, state.walletAddress]);

  // Offer actions are managed from NFT details where live onchain offers are read.
  const activeOffers = useMemo(() => {
    return [];
  }, []);

  // Accept Offer (Owner Action)
  const handleAcceptOffer = (offerId: string) => {
    const offer = state.offers.find(o => o.offerId === offerId);
    showNotification("Manage offers from NFT detail page.");
    if (offer) {
      setSelectedCardId(offer.tokenId);
      setCurrentView('card-details');
    }
  };

  // Cancel/Reject Offer
  const handleCancelOffer = (offerId: string) => {
    const offer = state.offers.find(o => o.offerId === offerId);
    showNotification("Manage offers from NFT detail page.");
    if (offer) {
      setSelectedCardId(offer.tokenId);
      setCurrentView('card-details');
    }
  };

  // Activity logs display
  const activityLogsDisplay = useMemo(() => {
    return state.logs || [];
  }, [state.logs]);

  // Live calculation of estimated USD value
  const displayBalance = useMemo(() => {
    return state.walletConnected ? state.balance : 20.00;
  }, [state.balance, state.walletConnected]);

  const usdValueString = useMemo(() => {
    return (displayBalance * 1.0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }, [displayBalance]);

  // Handle Search and Filter logic inside views
  const getFilteredItems = (rawList: ArcaneNFT[]) => {
    return rawList.filter(card => {
      const title = (card.name || "").toLowerCase();
      const matchesSearch = title.includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  };

  const activeDisplayList = useMemo(() => {
    if (activeTab === "collected") return getFilteredItems(collectedCardsDisplay);
    if (activeTab === "created") return getFilteredItems(createdCardsDisplay);
    return [];
  }, [activeTab, collectedCardsDisplay, createdCardsDisplay, searchQuery, selectedCollection]);

  const activeDisplayCount = useMemo(() => {
    if (activeTab === "collected") return collectedCardsDisplay.length;
    if (activeTab === "created") return createdCardsDisplay.length;
    if (activeTab === "offers") return activeOffers.length;
    return activityLogsDisplay.length;
  }, [activeTab, collectedCardsDisplay.length, createdCardsDisplay.length, activeOffers.length, activityLogsDisplay.length]);

  return (
    <div 
      className="relative min-h-screen pt-20 pb-24 bg-transparent text-white select-none overflow-x-hidden"
      style={{
        backgroundImage: "url('/media/arcaniabg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* High-fidelity fixed background overlay with matching opacity and depth */}
      <div className="absolute inset-0 bg-[#02050b]/20 pointer-events-none z-0" />

      {/* Subtle light ambient glow beneath the layout */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-sky-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Notification Toast Alert */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-[#080b12]/90 border border-white/15 text-xs text-white/90 shadow-[0_12px_30px_rgba(0,0,0,0.4)] flex items-center gap-3 backdrop-blur-md"
            style={{ fontFamily: 'Forum, "Forum", serif', letterSpacing: '0.06em' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto px-6 relative z-10 pt-[16px]">

        {/* TOP SECTION: 2-COLUMN LAYOUT CONFORMING TO REFERENCE */}
        <div className="flex flex-col lg:flex-row gap-[28px] items-stretch w-full mb-10">
          
          {/* LEFT COLUMN: Profile Hero Card (occupies flexible remaining space) */}
          <div className="w-full lg:flex-1 flex">
            <ProfileHeroCard
              name={state.walletConnected ? (state.discordUser?.name?.toUpperCase() || "ARCANIAN #000") : "ARCANIAN #000"}
              address={state.walletConnected && state.walletAddress ? state.walletAddress : "0x8at30dc74fa928eebffac1c5b4e9536e2fca9a1e995"}
              copied={copied}
              onCopy={handleCopyAddress}
              avatarUrl={state.discordUser?.iconUrl || "/media/userlogo.png"}
            />
          </div>

          {/* RIGHT COLUMN: Wallet Balance Card (fixed size to guarantee alignment) */}
          <div className="w-full lg:w-[320px] xl:w-[350px] flex shrink-0">
            <WalletBalanceCard
              balance={displayBalance}
              usdValueString={usdValueString}
            />
          </div>

        </div>

        {/* NAVIGATION TABS SECTION */}
        <div className="flex items-center justify-between border-b border-white/[0.08] mb-8 pb-3 relative">
          
          {/* Scrollable navigation tabs on mobile */}
          <div className="flex items-center gap-10 overflow-x-auto scrollbar-none pb-1.5 -mb-2.5 w-full md:w-auto">
            {["COLLECTED", "CREATED", "OFFERS", "ACTIVITY"].map((label) => {
              const tabId = label.toLowerCase() as any;
              const isActive = activeTab === tabId;
              
              // Map label to badge count
              let badgeCount = 0;
              if (tabId === "collected") badgeCount = collectedCardsDisplay.length;
              if (tabId === "created") badgeCount = createdCardsDisplay.length;
              if (tabId === "offers") badgeCount = activeOffers.length;
              if (tabId === "activity") badgeCount = activityLogsDisplay.length;

              return (
                <button
                  key={label}
                  onClick={() => {
                    setActiveTab(tabId);
                  }}
                  className="relative pb-3 flex items-center gap-2.5 group cursor-pointer transition-all duration-300 select-none whitespace-nowrap focus:outline-none"
                >
                  {/* Tab label */}
                  <span 
                    className={`text-[15px] uppercase tracking-[0.15em] transition-all duration-300 font-normal ${
                      isActive ? 'text-white font-medium' : 'text-white/45 hover:text-white/80'
                    }`}
                    style={{ fontFamily: 'Forum, "Forum", serif' }}
                  >
                    {label}
                  </span>

                  {/* Badge glass circle count */}
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.12] text-[10px] text-white/50 font-normal select-none">
                    {badgeCount}
                  </span>

                  {/* Active Underline with premium soft glow, and opacity toggle */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.7)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick display counters info tag */}
          <div 
            className="hidden md:flex items-center gap-1 text-white/35 text-xs tracking-widest uppercase select-none font-normal"
            style={{ fontFamily: 'Forum, "Forum", serif' }}
          >
            <span>inventory showcase</span>
            <ChevronRight size={12} className="opacity-50" />
            <span className="text-white/70">{activeDisplayCount} items</span>
          </div>

        </div>

        {/* COLLECTION CONTENT AREA CONTAINER */}
        <GlassContainer className="w-full min-h-[620px] p-8 sm:p-10 relative">
          
          {/* Header of container containing Vault Refinement styling if COLLECTED or CREATED is active */}
          {(activeTab === "collected" || activeTab === "created") && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 border-b border-white/[0.05] pb-5">
              <div 
                className="text-[14px] tracking-[0.16em] text-white/45 uppercase select-none"
                style={{ fontFamily: 'Forum, "Forum", serif' }}
              >
                VAULT GALLERY
              </div>
              
              {/* elegant metadata filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                
                {/* Search query field */}
                <div className="relative w-full sm:w-[220px]">
                  <Search size={11} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="SEARCH VAULT..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#ffffff]/[0.03] hover:bg-[#ffffff]/[0.06] border border-white/10 rounded-full pl-8.5 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-all font-normal tracking-widest"
                    style={{ fontFamily: 'Forum, "Forum", serif' }}
                  />
                </div>

              </div>
            </div>
          )}

          {/* Tab contents list output */}
          <div className="relative">
            {activeTab === "collected" || activeTab === "created" ? (
              
              // Beautiful responsive NFT Grid with luxury soft elevation only, no hard borders
              activeDisplayList.length === 0 ? (
                <div className="py-28 text-center flex flex-col items-center justify-center">
                  <Sparkles className="text-white/15 mb-4 animate-pulse" size={28} />
                  <p 
                    className="text-white/45 text-[15px] tracking-widest uppercase mb-1.5"
                    style={{ fontFamily: 'Forum, "Forum", serif' }}
                  >
                    No cataloged creations found
                  </p>
                  <p 
                    className="text-[11px] text-white/25 max-w-sm mx-auto leading-relaxed"
                    style={{ fontFamily: 'Forum, "Forum", serif', letterSpacing: '0.04em' }}
                  >
                    No collectible assets are matching inside this profile node. Visit the creation studio or browse the marketplace to obtain premium digital items.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[24px]">
                  {activeDisplayList.map((card) => {
                    const rarityAttr = card.attributes && card.attributes.find(attr => attr.trait_type.toLowerCase() === "rarity")?.value || "COMMON";
                    const isCardOwnedByUser = !state.walletConnected || card.owner.toLowerCase() === state.walletAddress.toLowerCase();
                    
                    return (
                      <div
                        key={card.tokenId}
                        onClick={() => {
                          setSelectedCardId(card.tokenId);
                          setCurrentView('card-details');
                        }}
                        className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] bg-[#ffffff]/[0.03] hover:bg-[#ffffff]/[0.06] transition-all duration-500 cursor-pointer p-3 text-left"
                        style={{
                          boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
                        }}
                      >
                        {/* Smooth inner gradient shine overlay to emphasize bevel layout */}
                        <div className="absolute inset-px rounded-[23px] border border-white/5 pointer-events-none group-hover:border-white/15 transition-all duration-500" />
                        
                        {/* NFT Image aspect container with soft corner layout */}
                        <div className="relative aspect-square rounded-[18px] overflow-hidden bg-black shadow-lg select-none">
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="w-full h-full object-cover group-hover:scale-[1.04] transition-all duration-[2s] ease-out opacity-100"
                          />
                        </div>

                        {/* Text descriptions containing elegant Perandory titles */}
                        <div className="pt-3 pb-1 px-1.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 
                              className="text-white text-[17px] font-normal tracking-[0.06em] leading-tight select-none truncate"
                              style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                            >
                              {card.name}
                            </h3>
                            <p 
                              className="text-[10px] text-white/30 tracking-widest mt-1 uppercase"
                              style={{ fontFamily: 'Forum, "Forum", serif' }}
                            >
                              token code: #{card.tokenId}
                            </p>
                          </div>

                          {/* Interactive manage action line */}
                          <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                            <div>
                              <span 
                                className="block text-[8px] text-white/35 tracking-widest uppercase mb-0.5"
                                style={{ fontFamily: 'Forum, "Forum", serif' }}
                              >
                                STATUS
                              </span>
                              <span className="font-semibold text-sky-300/80 tracking-wider">
                                {card.isListed ? "LISTED" : "NOT LISTED"}
                              </span>
                            </div>
                            {isCardOwnedByUser && (
                              <span 
                                className="px-3.5 py-1.5 rounded-full bg-white/[0.04] group-hover:bg-white/[0.08] text-white/80 group-hover:text-white font-normal text-[10px] uppercase tracking-widest transition-all border border-white/5 group-hover:border-white/10"
                                style={{ fontFamily: 'Forum, "Forum", serif' }}
                              >
                                MANAGE
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )

            ) : activeTab === "offers" ? (
              
              // Escrow Offers cataloged list
              activeOffers.length === 0 ? (
                <div className="py-28 text-center flex flex-col items-center justify-center">
                  <Sparkles className="text-white/15 mb-4 animate-pulse" size={28} />
                  <p 
                    className="text-white/45 text-[15px] tracking-widest uppercase mb-1.5"
                    style={{ fontFamily: 'Forum, "Forum", serif' }}
                  >
                    No active escrow offers
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                  {activeOffers.map((off) => {
                    const shortOfferer = off.isOfferer 
                      ? "YOU" 
                      : (off.offerer.startsWith("0x") && off.offerer.length > 10
                        ? `${off.offerer.substring(0, 6).toUpperCase()}...${off.offerer.substring(off.offerer.length - 4).toUpperCase()}`
                        : off.offererName);

                    return (
                      <div 
                        key={off.offerId}
                        className="rounded-[24px] bg-white/[0.03] hover:bg-white/[0.06] p-5 flex items-center gap-5 transition-all duration-300 relative border border-white/5"
                      >
                        {/* NFT Item preview Thumbnail with proper 1x1 size aspect-square */}
                        <div 
                          onClick={() => {
                            setSelectedCardId(off.tokenId);
                            setCurrentView('card-details');
                          }}
                          className="relative w-20 h-20 rounded-[14px] overflow-hidden bg-black/40 shrink-0 cursor-pointer group"
                        >
                          <img src={off.imageUrl} alt={off.cardName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-100" />
                        </div>

                        {/* Offer specifications */}
                        <div className="flex-1 min-w-0">
                          <span 
                            className={`text-[9px] uppercase tracking-widest block mb-1 font-semibold ${
                              off.isOwner ? "text-[#a855f7]" : "text-cyan-400"
                            }`}
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            {off.isOwner ? "BUYING OFFER RECEIVED" : "BUYING OFFER SUBMITTED"}
                          </span>
                          
                          <h3 
                            onClick={() => {
                              setSelectedCardId(off.tokenId);
                              setCurrentView('card-details');
                            }}
                            className="text-white hover:text-cyan-300 transition-colors text-[18px] font-normal tracking-[0.06em] leading-tight select-none mb-1 truncate cursor-pointer"
                            style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                          >
                            {off.cardName}
                          </h3>

                          <p 
                            className="text-[10px] text-white/40 tracking-widest uppercase mb-3"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            offerer: {shortOfferer}
                          </p>

                          <div className="flex items-center gap-4 flex-wrap">
                            <div>
                              <span 
                                className="block text-[8px] text-white/35 tracking-widest uppercase"
                                style={{ fontFamily: 'Forum, "Forum", serif' }}
                              >
                                PROPOSED VALUE
                              </span>
                              <span 
                                className="text-white text-base font-normal tracking-[0.04em]"
                                style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                              >
                                {off.amount.toFixed(2)} USDC
                              </span>
                            </div>
                            
                            <div className="ml-auto flex items-center gap-2">
                              {off.isOwner ? (
                                <>
                                  <button
                                    onClick={() => handleCancelOffer(off.offerId)}
                                    className="px-3.5 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[10px] uppercase tracking-widest transition-all border border-red-500/20"
                                    style={{ fontFamily: 'Forum, "Forum", serif' }}
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => handleAcceptOffer(off.offerId)}
                                    className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] uppercase tracking-widest transition-all border border-emerald-500/20"
                                    style={{ fontFamily: 'Forum, "Forum", serif' }}
                                  >
                                    Accept Offer
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleCancelOffer(off.offerId)}
                                  className="px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white text-[10px] uppercase tracking-widest transition-all border border-white/5 hover:border-white/10"
                                  style={{ fontFamily: 'Forum, "Forum", serif' }}
                                >
                                  Cancel Offer
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )

            ) : (
              
              // Activity ledger events list
              activityLogsDisplay.length === 0 ? (
                <div className="py-28 text-center flex flex-col items-center justify-center text-white/40 font-mono">
                  No logged transactions recorded yet
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {activityLogsDisplay.map((log) => {
                    const isBuy = log.type === 'buy';
                    const isMint = log.type === 'mint';
                    const isList = log.type === 'list';
                    
                    let eventLabel = "TRANSFER";
                    let glowColor = "text-sky-300";
                    if (isBuy) { eventLabel = "PURCHASED"; glowColor = "text-emerald-400"; }
                    if (isMint) { eventLabel = "MINTED"; glowColor = "text-purple-300"; }
                    if (isList) { eventLabel = "LISTED"; glowColor = "text-amber-300"; }

                    return (
                      <div 
                        key={log.id} 
                        className="rounded-[18px] bg-white/[0.02] hover:bg-white/[0.04] px-6 py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 border border-white/5"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                            <span 
                              className={`text-xs uppercase tracking-[0.15em] font-normal ${glowColor}`}
                              style={{ fontFamily: 'Forum, "Forum", serif' }}
                            >
                              {eventLabel}
                            </span>
                            <span className="text-white/20 text-xs select-none">•</span>
                            <span 
                              className="text-white text-[15px] font-normal tracking-[0.04em]"
                              style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                            >
                              {log.cardName || `Token #${log.tokenId}`}
                            </span>
                          </div>

                          <div 
                            className="text-[10px] text-white/30 tracking-widest uppercase"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            From: {log.fromAddress.substring(0, 16)}... → To: {log.toAddress.substring(0, 16)}...
                          </div>
                        </div>

                        {/* Transaction Price HUD */}
                        <div className="sm:text-right shrink-0">
                          <span 
                            className="block text-white text-base font-normal tracking-[0.04em]"
                            style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                          >
                            {log.amount && log.amount > 0 ? `${log.amount.toFixed(2)} USDC` : "—"}
                          </span>
                          <span 
                            className="block text-[9px] text-white/30 tracking-widest uppercase mt-0.5"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )

            )}
          </div>

        </GlassContainer>

      </div>
    </div>
  );
}
