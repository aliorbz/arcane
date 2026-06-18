import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, SlidersHorizontal, Grid, AlertTriangle, Tag, Trash2, Hand, X, ShoppingCart, Heart } from 'lucide-react';
import { getSavedState, saveState, ROLE_CONFIGS } from '../lib/mockData';
import { RitualCard, CardOffer, ActivityLog } from '../types';
import { useAccount } from 'wagmi';

interface MarketplaceViewProps {
  setCurrentView: (view: string) => void;
  setSelectedCardId: (id: string | null) => void;
}

export function MarketplaceView({ setCurrentView, setSelectedCardId }: MarketplaceViewProps) {
  const { isConnected } = useAccount();
  const [state, setState] = useState(getSavedState());

  // Periodically refresh items from shared local/on-chain persistent store
  useEffect(() => {
    const interval = setInterval(() => {
       setState(getSavedState());
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [sortOption, setSortOption] = useState("id");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isDenseGrid, setIsDenseGrid] = useState(false);

  // Floating banner carousel state
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);

  const bannerItems = [
    {
      id: 1,
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop",
      title: "ARCANE NEURAL FRAGMENTS",
      description: "Curated gene codes integrated into the cognitive digital void with advanced metadata signatures."
    },
    {
      id: 2,
      imageUrl: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=1200&auto=format&fit=crop",
      title: "AETHERIC PORTAL CHANNELS",
      description: "Metallic shape algorithms deployed dynamically on decentralized testnet networks."
    },
    {
      id: 3,
      imageUrl: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1200&auto=format&fit=crop",
      title: "COSMIC VOID METAVERSE",
      description: "Explore exquisite digital collectibles from revolutionary international creators."
    }
  ];

  useEffect(() => {
    if (isBannerHovered) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % bannerItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isBannerHovered]);

  // Sidebar filter states & collapsibles
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("All");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // All, Listed, Bid-only
  const [collectionFilter, setCollectionFilter] = useState("All");

  const [collapsedFilters, setCollapsedFilters] = useState({
    categories: false,
    price: false,
    status: false,
    collections: false
  });

  // State controls for modals
  const [selectedCardForBuy, setSelectedCardForBuy] = useState<RitualCard | null>(null);
  const [selectedCardForOffer, setSelectedCardForOffer] = useState<RitualCard | null>(null);
  const [selectedCardForList, setSelectedCardForList] = useState<RitualCard | null>(null);

  // New Listing & Bid Inputs
  const [listingPriceInput, setListingPriceInput] = useState("");
  const [bidAmountInput, setBidAmountInput] = useState("");

  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Sync state helper
  const updateLocalState = (newState: Partial<typeof state>) => {
    const updated = { ...state, ...newState };
    setState(updated);
    saveState(updated);
  };

  const handleConnectWalletFirst = () => {
    showNotification("⚠️ Please connect your Web3 wallet first in the top bar!");
  };

  // Favorite cards state
  const [likedCards, setLikedCards] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('arcane_favorites');
      return stored ? JSON.parse(stored) : { "72": true };
    } catch {
      return { "72": true };
    }
  });

  const toggleLike = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...likedCards, [cardId]: !likedCards[cardId] };
    setLikedCards(updated);
    localStorage.setItem('arcane_favorites', JSON.stringify(updated));
    showNotification(updated[cardId] ? "❤️ Added to Farvorited" : "💔 Removed from Favorited");
  };

  // Buy item action
  const executeBuy = (card: RitualCard) => {
    if (!state.walletConnected || !state.walletAddress) {
      handleConnectWalletFirst();
      return;
    }
    if (!isConnected) {
      showNotification("❌ Buy flow not connected yet");
      return;
    }
    const cost = card.price || 0;
    if (state.balance < cost) {
      showNotification("❌ Insufficient balance to purchase this NFT!");
      return;
    }

    const seller = card.owner;
    const buyer = state.walletAddress;

    const updatedCards = state.cards.map(c => {
      if (c.tokenId === card.tokenId) {
        return {
          ...c,
          owner: buyer,
          isListed: false,
          price: undefined
        };
      }
      return c;
    });

    const newLog: ActivityLog = {
      id: "log_" + Date.now(),
      tokenId: card.tokenId,
      type: 'buy',
      fromAddress: seller,
      toAddress: buyer,
      amount: cost,
      timestamp: new Date().toISOString()
    };

    let balanceChange = -cost;
    const isUserCreator = (card.creator || "0xBE0848a9315da2ffbc28a9ea56b0d4b42413c8be").toLowerCase() === state.walletAddress?.toLowerCase();
    if (isUserCreator) {
      balanceChange += cost * 0.025;
    }

    const updatedState = {
      ...state,
      cards: updatedCards,
      balance: parseFloat((state.balance + balanceChange).toFixed(4)),
      logs: [newLog, ...state.logs]
    };

    setSelectedCardForBuy(null);
    updateLocalState(updatedState);
    showNotification(`🎉 Congratulations! You purchased "${card.name}" for ${cost} USDC!`);
  };

  // List item action
  const executeList = (card: RitualCard, priceInUSDC: number) => {
    if (isNaN(priceInUSDC) || priceInUSDC <= 0) {
      showNotification("❌ Please enter a valid listing price greater than 0 USDC.");
      return;
    }

    const listingFee = 0.01;
    if (state.balance < listingFee) {
      showNotification("❌ Insufficient balance to pay listing fee (0.01 USDC).");
      return;
    }

    const updatedCards = state.cards.map(c => {
      if (c.tokenId === card.tokenId) {
        return {
          ...c,
          isListed: true,
          price: priceInUSDC
        };
      }
      return c;
    });

    const newLog: ActivityLog = {
      id: "log_" + Date.now(),
      tokenId: card.tokenId,
      type: 'list',
      fromAddress: state.walletAddress,
      toAddress: "0x0000000000000000000000000000000000000000",
      amount: priceInUSDC,
      timestamp: new Date().toISOString()
    };

    const updatedState = {
      ...state,
      cards: updatedCards,
      balance: parseFloat((state.balance - listingFee).toFixed(4)),
      logs: [newLog, ...state.logs]
    };

    setSelectedCardForList(null);
    setListingPriceInput("");
    updateLocalState(updatedState);
    showNotification(`✅ Successfully listed "${card.name}" for sale at ${priceInUSDC} USDC (local/dev state).`);
  };

  // Cancel listing action
  const executeCancelList = (card: RitualCard) => {
    const updatedCards = state.cards.map(c => {
      if (c.tokenId === card.tokenId) {
        return {
          ...c,
          isListed: false,
          price: undefined
        };
      }
      return c;
    });

    const newLog: ActivityLog = {
      id: "log_" + Date.now(),
      tokenId: card.tokenId,
      type: 'cancel_list',
      fromAddress: state.walletAddress,
      toAddress: "0x0000000000000000000000000000000000000000",
      timestamp: new Date().toISOString()
    };

    updateLocalState({
      ...state,
      cards: updatedCards,
      logs: [newLog, ...state.logs]
    });
    showNotification(`🗑️ Canceled listing for "${card.name}".`);
  };

  // Make Offer action
  const executeMakeOffer = (card: RitualCard, bidAmount: number) => {
    if (isNaN(bidAmount) || bidAmount <= 0) {
      showNotification("❌ Enter a valid offer price greater than 0 USDC.");
      return;
    }
    if (state.balance < bidAmount) {
      showNotification("❌ Insufficient balance for this offer!");
      return;
    }

    const newOffer: CardOffer = {
      offerId: "offer_" + Date.now(),
      tokenId: card.tokenId,
      offerer: state.walletAddress,
      offererName: state.discordUser ? (state.discordUser as any).name : "Anonymous Collector",
      amount: bidAmount,
      active: true,
      createdAt: new Date().toISOString()
    };

    const newLog: ActivityLog = {
      id: "log_" + Date.now(),
      tokenId: card.tokenId,
      type: 'offer',
      fromAddress: state.walletAddress,
      toAddress: card.owner,
      amount: bidAmount,
      timestamp: new Date().toISOString()
    };

    const updatedState = {
      ...state,
      offers: [newOffer, ...state.offers],
      balance: parseFloat((state.balance - bidAmount).toFixed(4)),
      logs: [newLog, ...state.logs]
    };

    setSelectedCardForOffer(null);
    setBidAmountInput("");
    updateLocalState(updatedState);
    showNotification(`🤝 Your bid of ${bidAmount} USDC was placed successfully.`);
  };

  // Filter & Sort dynamic logic
  const filteredAndSortedCards = useMemo(() => {
    return state.cards
      .filter((card) => {
        const title = (card.name || "").toLowerCase();
        const role = (card.discordRole || "art").toLowerCase();
        const creatorAddr = (card.creator || "").toLowerCase();
        const username = (card.discordUsername || "").toLowerCase();

        // search query
        const matchesSearch =
          title.includes(search.toLowerCase()) ||
          role.includes(search.toLowerCase()) ||
          creatorAddr.includes(search.toLowerCase()) ||
          username.includes(search.toLowerCase()) ||
          card.tokenId === search;

        // top categories pills filter (All, Art, Gaming, Music, Photography)
        const activeCategory = filterRole.toLowerCase();
        const matchesCategoryPill =
          activeCategory === "all" ||
          activeCategory === "all nfts" ||
          role === activeCategory ||
          (activeCategory === "gaming" && role === "utility") || // map utility to gaming for mock realism
          (activeCategory === "photography" && role === "video");

        // sidebar categories filter
        const matchesSidebarCategory =
          activeCategoryFilter === "All" ||
          role === activeCategoryFilter.toLowerCase();

        // sidebar price filters
        const priceVal = card.price || 0;
        const matchesMinPrice = !priceMin || priceVal >= parseFloat(priceMin);
        const matchesMaxPrice = !priceMax || priceVal <= parseFloat(priceMax);

        // status filters
        const getCardStatus = (c: RitualCard) => {
          if (c.isListed) return "LISTED";
          return "NOT LISTED";
        };
        const assetStatus = getCardStatus(card);
        const matchesStatus =
          statusFilter === "All" ||
          (statusFilter === "Listed" && assetStatus === "LISTED") ||
          (statusFilter === "Not Listed" && assetStatus === "NOT LISTED");

        return matchesSearch && matchesCategoryPill && matchesSidebarCategory && matchesMinPrice && matchesMaxPrice && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOption === "id") {
          return parseInt(b.tokenId) - parseInt(a.tokenId); // Newest first
        }
        if (sortOption === "price_asc") {
          const pA = a.isListed && a.price !== undefined ? a.price : 999999;
          const pB = b.isListed && b.price !== undefined ? b.price : 999999;
          return pA - pB;
        }
        if (sortOption === "price_desc") {
          const pA = a.isListed && a.price !== undefined ? a.price : 0;
          const pB = b.isListed && b.price !== undefined ? b.price : 0;
          return pB - pA;
        }
        return 1;
      });
  }, [state.cards, search, filterRole, activeCategoryFilter, priceMin, priceMax, statusFilter, sortOption]);

  const rolesPills = ["All NFTs", "Art", "Gaming", "Music", "Photography"];

  const triggerSearchRefinement = () => {
    showNotification("⚡ Search Filters Refined!");
  };

  return (
    <div 
      className="relative min-h-screen pt-28 pb-20 bg-transparent text-white select-none overflow-x-hidden font-sans selection:bg-cyan-500/25 selection:text-white"
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
      {/* Toast Alert */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl bg-zinc-950/90 border border-cyan-500/35 text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-400 shadow-[0_15px_40px_rgba(6,182,212,0.15)] flex items-center gap-3 backdrop-blur-md"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

    {/* Collapsible Left Floating Filters Drawer Overlay */}
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {isFiltersOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFiltersOpen(false)}
              className="fixed inset-0 bg-black/75 z-[9999] backdrop-blur-sm"
            />
            {/* Drawer Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 left-0 bottom-0 h-full w-full max-w-[320px] bg-[#09090c] border-r border-white/10 p-6 z-[9999] overflow-y-auto flex flex-col shadow-[10px_0_50px_rgba(0,0,0,0.9)] text-left"
            >
              <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                <img 
                  src="/media/logo.png" 
                  alt="ARCANE Logo" 
                  className="w-12 h-12 object-contain"
                  style={{
                    filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 0 3px rgba(255,255,255,0.4))'
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <button
                  onClick={() => setIsFiltersOpen(false)}
                  className="p-2 -mr-2 text-white/40 hover:text-cyan-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                  title="Collapse Filters"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Collapsible Refinements inside drawer */}
              <div className="flex flex-col gap-5 flex-grow">
                
                {/* Categories Box */}
                <div className="border-b border-white/5 pb-5">
                  <button
                    onClick={() => setCollapsedFilters(p => ({ ...p, categories: !p.categories }))}
                    className="w-full flex items-center justify-between text-xs font-normal uppercase tracking-[0.1em] text-[#94a3b8] hover:text-white"
                    style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                  >
                    <span>Categories</span>
                    <span>{collapsedFilters.categories ? "+" : "−"}</span>
                  </button>
                  
                  {!collapsedFilters.categories && (
                    <div className="mt-3.5 flex flex-col gap-2">
                      {["All", "PFP", "Art", "Photography", "Pixel"].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setActiveCategoryFilter(cat);
                          }}
                          className={`w-full py-2.5 px-4 rounded-xl text-left text-xs uppercase tracking-wider transition-all flex items-center justify-between ${
                            activeCategoryFilter === cat
                              ? 'bg-cyan-500/10 border border-cyan-400/30 text-cyan-400'
                              : 'text-white/40 hover:text-white/70 bg-[#0e0e11] border border-transparent'
                          }`}
                          style={{ fontFamily: 'Forum, "Forum", serif' }}
                        >
                          <span>{cat}</span>
                          {activeCategoryFilter === cat && <span className="text-[10px]">●</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price Range Box */}
                <div className="border-b border-white/5 pb-5">
                  <button
                    onClick={() => setCollapsedFilters(p => ({ ...p, price: !p.price }))}
                    className="w-full flex items-center justify-between text-xs font-normal uppercase tracking-[0.1em] text-[#94a3b8] hover:text-white"
                    style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                  >
                    <span>Price Range</span>
                    <span>{collapsedFilters.price ? "+" : "−"}</span>
                  </button>

                  {!collapsedFilters.price && (
                    <div className="mt-3.5 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          value={priceMin}
                          onChange={(e) => setPriceMin(e.target.value)}
                          className="w-full px-4.5 py-3 bg-[#0d0d10] border border-white/5 rounded-xl text-xs focus:outline-none focus:border-cyan-500/30 text-white placeholder-white/20"
                          style={{ fontFamily: 'Forum, "Forum", serif' }}
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={priceMax}
                          onChange={(e) => setPriceMax(e.target.value)}
                          className="w-full px-4.5 py-3 bg-[#0d0d10] border border-white/5 rounded-xl text-xs focus:outline-none focus:border-cyan-500/30 text-white placeholder-white/20"
                          style={{ fontFamily: 'Forum, "Forum", serif' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Box */}
                <div className="border-b border-white/5 pb-5">
                  <button
                    onClick={() => setCollapsedFilters(p => ({ ...p, status: !p.status }))}
                    className="w-full flex items-center justify-between text-xs font-normal uppercase tracking-[0.1em] text-[#94a3b8] hover:text-[#fff]"
                    style={{ fontFamily: 'Perandory, "Perandory", serif' }}
                  >
                    <span>Status</span>
                    <span>{collapsedFilters.status ? "+" : "−"}</span>
                  </button>

                  {!collapsedFilters.status && (
                    <div className="mt-3.5 flex flex-col gap-2">
                      {["All", "Listed", "Not Listed"].map((stat) => (
                        <button
                          key={stat}
                          onClick={() => setStatusFilter(stat)}
                          className={`w-full py-2.5 px-4 rounded-xl text-left text-xs uppercase tracking-wider transition-all flex items-center justify-between ${
                            statusFilter === stat
                              ? 'bg-cyan-500/10 border border-cyan-400/30 text-cyan-400'
                              : 'text-white/40 hover:text-white/70 bg-[#0e0e11] border border-transparent'
                          }`}
                          style={{ fontFamily: 'Forum, "Forum", serif' }}
                        >
                          <span>{stat}</span>
                          {statusFilter === stat && <span className="text-[10px]">●</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <button
                onClick={() => {
                  triggerSearchRefinement();
                  setIsFiltersOpen(false);
                }}
                className="w-full mt-6 py-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-semibold uppercase text-xs sm:text-xs tracking-widest shadow-lg shadow-cyan-400/10 transition-colors cursor-pointer"
                style={{ fontFamily: 'Forum, "Forum", serif' }}
              >
                Apply Filters
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}

    <div className="max-w-7xl mx-auto px-6 relative z-10">

      {/* Marketplace Section Layout */}
      <div className="w-full flex flex-col gap-4">

          {/* Full-width rotating sliding banner type image card */}
          <div 
            className="relative overflow-hidden w-full h-48 sm:h-64 rounded-3xl border border-white/5 bg-[#09090c] mb-6 select-none"
            onMouseEnter={() => setIsBannerHovered(true)}
            onMouseLeave={() => setIsBannerHovered(false)}
            onTouchStart={() => setIsBannerHovered(true)}
            onTouchEnd={() => setIsBannerHovered(false)}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={currentBanner}
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-100%', opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="absolute inset-0 w-full h-full"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent z-10" />
                <img 
                  src={bannerItems[currentBanner].imageUrl} 
                  alt={bannerItems[currentBanner].title} 
                  className="w-full h-full object-cover opacity-60 pointer-events-none"
                />
                <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 sm:px-12 text-left">
                  <span className="text-[8px] sm:text-[9px] font-mono font-black text-cyan-400 uppercase tracking-widest mb-2 bg-cyan-950/40 border border-cyan-400/25 px-2.5 py-1 rounded-md self-start">
                    Featured Asset
                  </span>
                  <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-white font-display mb-2">
                    {bannerItems[currentBanner].title}
                  </h2>
                  <p className="text-[11px] sm:text-sm text-white/50 font-sans max-w-sm sm:max-w-xl font-medium leading-relaxed">
                    {bannerItems[currentBanner].description}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Pagination Indicators */}
            <div className="absolute bottom-4 right-6 z-30 flex items-center gap-1.5">
              {bannerItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBanner(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentBanner ? 'bg-cyan-400 w-4' : 'bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* MAIN Controlled Interface Grid Area */}
          <div className="flex flex-col gap-6">

            {/* Unified Filter, Sort & Search UI Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full mb-3">
              <div className="flex items-center gap-3 flex-grow">
                {/* Collapsible Trigger button beside Searchbar */}
                <button
                  onClick={() => setIsFiltersOpen(true)}
                  className="bg-[#09090c] hover:bg-white/[0.03] border border-white/5 hover:border-white/10 text-cyan-400 p-4.5 rounded-2xl flex items-center gap-2.5 transition-all cursor-pointer shrink-0 font-mono text-xs font-black uppercase tracking-wider"
                  title="Open Filters"
                >
                  <SlidersHorizontal size={16} />
                  <span className="hidden xs:inline">Filters</span>
                </button>

                <div className="relative flex-grow bg-[#09090c] rounded-2xl border border-white/5 focus-within:border-white/10 p-1 flex items-center">
                  <Search size={18} className="text-white/30 ml-4 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search items, creators..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent px-4 py-3.5 text-sm sm:text-base text-white placeholder-white/20 focus:outline-none focus:ring-0 font-sans font-medium"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="mr-4 text-white/30 hover:text-white">
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Repositioned Sort option Selector + Grid Toggle */}
              <div className="flex items-center gap-3.5 shrink-0">
                <div className="bg-[#09090c] border border-white/5 rounded-2xl px-4 py-3.5 flex items-center justify-center">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="bg-[#050507] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white/80 font-mono focus:outline-none focus:border-cyan-500/20 cursor-pointer"
                  >
                    <option value="id">Newest Listings</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>

                {/* Grid view layout trigger toggle buttons */}
                <div className="flex items-center bg-[#09090c] border border-white/5 rounded-2xl p-2 gap-1 shrink-0">
                  <button
                    onClick={() => setIsDenseGrid(false)}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      !isDenseGrid
                        ? 'bg-white/10 text-cyan-400'
                        : 'text-white/45 hover:text-white/75 hover:bg-white/5'
                    }`}
                    title="Default Layout"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsDenseGrid(true)}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      isDenseGrid
                        ? 'bg-white/10 text-cyan-400'
                        : 'text-white/45 hover:text-white/75 hover:bg-white/5'
                    }`}
                    title="Dense Layout"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="4" height="4" />
                      <rect x="10" y="3" width="4" height="4" />
                      <rect x="17" y="3" width="4" height="4" />
                      <rect x="3" y="10" width="4" height="4" />
                      <rect x="10" y="10" width="4" height="4" />
                      <rect x="17" y="10" width="4" height="4" />
                      <rect x="3" y="17" width="4" height="4" />
                      <rect x="10" y="17" width="4" height="4" />
                      <rect x="17" y="17" width="4" height="4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Cards Grid Component matching Screen 2 structure */}
            {filteredAndSortedCards.length === 0 ? (
              <div className="py-24 text-center rounded-[32px] bg-black/20 border border-white/5 border-dashed flex flex-col justify-center items-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-white/30 mb-4 animate-bounce">
                  ⚠
                </div>
                <h3 className="font-extrabold uppercase tracking-tight text-white mb-1 leading-snug">
                  No matching assets
                </h3>
                <p className="text-xs sm:text-xs text-white/40 max-w-sm font-semibold tracking-wide">
                  Try adjusting your search word, price parameters, or sidebar filters.
                </p>
              </div>
            ) : (
              <div 
                className={
                  isDenseGrid
                    ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 transition-all duration-300"
                    : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 transition-all duration-300"
                }
              >
                {filteredAndSortedCards.map((card) => {
                  const creatorAddr = card.creator || "0xBE0848a9315da2ffbc28a9ea56b0d4b42413c8be";
                  const creatorName = creatorAddr.startsWith("0x") && creatorAddr.length > 10
                    ? `${creatorAddr.substring(0, 6).toUpperCase()}...${creatorAddr.substring(creatorAddr.length - 4).toUpperCase()}`
                    : creatorAddr;
                  const isOwner = card.owner.toLowerCase() === state.walletAddress.toLowerCase();
                  const isLiked = !!likedCards[card.tokenId];

                  // Resolve display rarity tag for top left card label matching Screen 2
                  const mappedRarity = card.attributes && card.attributes.find(attr => attr.trait_type.toLowerCase() === "rarity")?.value || "COMMON";
                  const isLiveAuction = card.tokenId === "72" || card.tokenId === "88";

                  return (
                    <div
                      key={card.tokenId}
                      onClick={() => {
                        setSelectedCardId(card.tokenId);
                        setCurrentView('card-details');
                      }}
                      className={`bg-[#09090c] glass-card border border-white/5 hover:border-white/10 overflow-hidden group hover:scale-[1.01] transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                        isDenseGrid ? 'p-2 sm:p-2.5 rounded-2xl' : 'p-3.5 rounded-3xl'
                      }`}
                    >
                      {/* Image block and tags */}
                      <div className={`relative aspect-square overflow-hidden bg-black flex items-center justify-center ${
                        isDenseGrid ? 'rounded-xl' : 'rounded-2xl'
                      }`}>
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-100"
                        />
                        
                        {/* Status blinking indicator live label */}
                        {isLiveAuction && (
                          <div className={`absolute bg-cyan-950/80 border border-cyan-400/50 backdrop-blur-md rounded-full font-mono tracking-wider font-extrabold text-cyan-400 flex items-center gap-1 ${
                            isDenseGrid ? 'bottom-1.5 left-1.5 px-1.5 py-0.5 text-[6px] sm:text-[8px]' : 'bottom-3.5 left-3.5 px-2.5 py-1 text-[8px]'
                          }`}>
                            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            Live
                          </div>
                        )}
                      </div>

                      {/* Info and action button */}
                      <div className={`text-left ${isDenseGrid ? 'pt-2 pb-1 px-0.5' : 'pt-4 pb-2 px-1'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`font-extrabold text-white truncate tracking-tight font-display ${
                            isDenseGrid ? 'text-xs sm:text-xs' : 'text-base'
                          }`}>
                            {card.name}
                          </h3>
                        </div>
                        
                        {/* Author layout with circle status dot */}
                        <p className={`font-mono text-white/40 flex items-center ${
                          isDenseGrid ? 'text-[9px] mt-0.5 gap-1' : 'text-xs mt-1 gap-1.5'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          by {creatorName}
                        </p>

                        {/* Pricing details grid row */}
                        <div className={`grid grid-cols-2 gap-2 border-t border-white/[0.04] text-xs ${
                          isDenseGrid ? 'mt-2 pt-2' : 'mt-4 pt-4'
                        }`}>
                          <div>
                            <span className="block text-[8px] font-mono tracking-widest uppercase text-white/30 font-bold">
                              BUY NOW
                            </span>
                            <span className={`font-extrabold text-[#fff] tracking-tight font-mono mt-0.5 block leading-tight ${
                              isDenseGrid ? 'text-[10px]' : 'text-xs'
                            }`}>
                              {card.isListed && card.price !== undefined ? `${card.price.toFixed(2)} USDC` : "—"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[8px] font-mono tracking-widest uppercase text-white/30 font-bold">
                              LAST SALE
                            </span>
                            <span className={`font-semibold text-white/40 tracking-tight font-mono mt-0.5 block leading-tight ${
                              isDenseGrid ? 'text-[10px]' : 'text-xs'
                            }`}>
                              {card.tokenId === "72" ? "3.85 USDC" : card.tokenId === "85" ? "0.95 USDC" : card.tokenId === "99" ? "10.2 USDC" : "—"}
                            </span>
                          </div>
                        </div>

                        {/* CTA button inside card */}
                        <div className={isDenseGrid ? 'mt-2' : 'mt-4'}>
                          {isOwner ? (
                            card.isListed ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  executeCancelList(card);
                                }}
                                className={`w-full border border-red-500/20 bg-red-950/20 hover:bg-red-900/30 font-mono uppercase tracking-widest text-red-400 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                  isDenseGrid ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'
                                }`}
                              >
                                <Trash2 size={11} /> Delist Card
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!state.walletConnected) return handleConnectWalletFirst();
                                  setSelectedCardForList(card);
                                }}
                                className={`w-full border border-white/5 bg-[#0a0a0c] text-white font-black font-mono uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-white/10 transition-all cursor-pointer ${
                                  isDenseGrid ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'
                                }`}
                              >
                                <Tag size={11} /> List Card
                              </button>
                            )
                          ) : (
                            // Action choices for non-owners
                            card.isListed ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!state.walletConnected) return handleConnectWalletFirst();
                                  setSelectedCardForBuy(card);
                                }}
                                className={`w-full bg-cyan-400 text-black hover:bg-cyan-300 font-mono uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isDenseGrid ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'
                                }`}
                              >
                                Buy Now
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCardId(card.tokenId);
                                  setCurrentView('card-details');
                                }}
                                className={`w-full bg-transparent border border-white/10 hover:border-white/20 text-white hover:bg-white/[0.02] font-mono uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isDenseGrid ? 'py-1.5 rounded-lg text-[9px]' : 'py-3 rounded-xl text-[10px]'
                                }`}
                              >
                                Make Offer
                              </button>
                            )
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* CONFIRM PURCHASE MODAL */}
      <AnimatePresence>
        {selectedCardForBuy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-sans text-left">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f11] border border-white/10 rounded-[32px] p-8 max-w-sm w-full relative shadow-2xl"
            >
              <button
                onClick={() => setSelectedCardForBuy(null)}
                className="absolute top-6 right-6 text-white/40 hover:text-white"
              >
                <X size={20} />
              </button>
              <ShoppingCart className="text-cyan-400 mb-4" size={32} />
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Confirm Purchase</h3>
              <p className="text-white/50 text-sm mb-6 leading-relaxed font-sans font-medium">
                You are purchasing the NFT <strong className="text-white">"{selectedCardForBuy.name}"</strong>. It will be safely transferred to your connected wallet address instantaneously using Simulated Blockchain ledger consensus.
              </p>

              <div className="bg-[#050505] rounded-2xl p-4 mb-6 flex justify-between items-center border border-white/5 font-mono">
                <span className="text-white/40 text-xs font-sans font-bold">You pay</span>
                <span className="text-cyan-400 font-extrabold text-lg">{selectedCardForBuy.price} USDC</span>
              </div>

              <div className="text-[10px] text-white/30 font-bold mb-6 flex items-center gap-2 font-mono">
                <AlertTriangle size={12} className="text-amber-500" />
                Seller receives 95% • Creator Royalty 2.5% • Marketplace Fee 2.5%
              </div>

              <button
                onClick={() => executeBuy(selectedCardForBuy)}
                className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-400 hover:bg-cyan-300 text-black transition-all shadow-lg shadow-cyan-500/10 cursor-pointer"
              >
                Buy for {selectedCardForBuy.price} USDC
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIST CARD MODAL */}
      <AnimatePresence>
        {selectedCardForList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-sans text-left">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f11] border border-white/10 rounded-[32px] p-8 max-w-sm w-full relative shadow-2xl"
            >
              <button
                onClick={() => setSelectedCardForList(null)}
                className="absolute top-6 right-6 text-white/40 hover:text-white"
              >
                <X size={20} />
              </button>
              <Tag className="text-cyan-400 mb-4" size={32} />
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Sell Card</h3>
              <p className="text-white/50 text-sm mb-6 leading-relaxed font-sans font-medium">
                Enter your sell price for NFT <strong className="text-white">"{selectedCardForList.name}"</strong>. Listing requires paying a tiny testnet gas fee of 0.01 USDC.
              </p>

              <div className="relative mb-6">
                <input
                  type="number"
                  min="0.001"
                  step="0.01"
                  placeholder="0.00"
                  value={listingPriceInput}
                  onChange={(e) => setListingPriceInput(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 focus:border-cyan-400/30 focus:outline-none rounded-2xl px-5 py-4 text-white font-black text-lg font-mono focus:ring-1 focus:ring-cyan-500/15"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 font-bold text-xs uppercase font-mono px-2 py-1 rounded bg-[#111]">
                  USDC
                </span>
              </div>

              <div className="text-[10px] text-white/30 font-bold mb-6 flex items-center gap-2 font-mono">
                <AlertTriangle size={12} className="text-amber-500" />
                A 2.5% creator royalty and 2.5% marketplace fee will be deducted when sold
              </div>

              <button
                disabled={!listingPriceInput || parseFloat(listingPriceInput) <= 0}
                onClick={() => executeList(selectedCardForList, parseFloat(listingPriceInput))}
                className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-400 hover:bg-cyan-300 text-black transition-all disabled:opacity-50 cursor-pointer"
              >
                Confirm Listing (0.01 USDC)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAKE OFFER MODAL */}
      <AnimatePresence>
        {selectedCardForOffer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-sans text-left">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f11] border border-white/10 rounded-[32px] p-8 max-w-sm w-full relative shadow-2xl"
            >
              <button
                onClick={() => setSelectedCardForOffer(null)}
                className="absolute top-6 right-6 text-white/40 hover:text-white"
              >
                <X size={20} />
              </button>
              <Hand className="text-cyan-400 mb-4" size={32} />
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Submit Buying Offer</h3>
              <p className="text-white/50 text-sm mb-6 leading-relaxed font-sans font-medium">
                Place an buying offer for NFT <strong className="text-white">"{selectedCardForOffer.name}"</strong>. Your USDC tokens will be safely locked in simulated contract escrow until accepted, changed, or canceled by you.
              </p>

              <div className="relative mb-6">
                <input
                  type="number"
                  min="0.001"
                  step="0.01"
                  placeholder="0.00"
                  value={bidAmountInput}
                  onChange={(e) => setBidAmountInput(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 focus:border-cyan-400/30 focus:outline-none rounded-2xl px-5 py-4 text-white font-black text-lg font-mono focus:ring-1 focus:ring-cyan-500/15"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 font-bold text-xs uppercase font-mono px-2 py-1 rounded bg-[#111]">
                  USDC
                </span>
              </div>

              <div className="bg-[#050505] rounded-2xl p-4 text-xs text-white/50 flex flex-col gap-1 border border-white/5 mb-6 font-mono">
                <div className="flex justify-between">
                  <span>Current Balance:</span>
                  <span className="text-white font-bold">{state.balance.toFixed(4)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee:</span>
                  <span className="text-cyan-400 font-bold">Free</span>
                </div>
              </div>

              <button
                disabled={!bidAmountInput || parseFloat(bidAmountInput) <= 0}
                onClick={() => executeMakeOffer(selectedCardForOffer, parseFloat(bidAmountInput))}
                className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest bg-cyan-400 hover:bg-cyan-300 text-black transition-all disabled:opacity-50 cursor-pointer"
              >
                Submit Escrow Offer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
