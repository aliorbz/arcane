import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Wallet, Grid, LayoutGrid, Award, Mail, Heart, Image as ImageIcon } from 'lucide-react';
import { getSavedState, saveState } from '../lib/mockData';
import { ArcaneNFT } from '../types';

interface HomeViewProps {
  setCurrentView: (view: string) => void;
  setSelectedCardId?: (id: string | null) => void;
}

export function HomeView({ setCurrentView, setSelectedCardId }: HomeViewProps) {
  const [state, setState] = useState(getSavedState());

  // Periodically synchronize local state
  useEffect(() => {
    const interval = setInterval(() => {
      setState(getSavedState());
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for Aetheric Prism #88
  const [countdown, setCountdown] = useState({ h: 2, m: 45, s: 12 });
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 };
        if (prev.m > 0) return { h: prev.h, m: prev.m - 1, s: 59 };
        if (prev.h > 0) return { h: prev.h - 1, m: 59, s: 59 };
        return { h: 12, m: 0, s: 0 }; // reset
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (c: typeof countdown) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(c.h)}:${pad(c.m)}:${pad(c.s)}`;
  };

  // Find 4 specific listings for the "Live Listings" grid matching Screen 1 details:
  // Cyber Core #442, Shadow Protocol, Ethereal Drift, Neon Citadel
  const liveListings = useMemo(() => {
    const titles = ["Cyber Core #442", "Shadow Protocol", "Ethereal Drift", "Neon Citadel"];
    return state.cards.filter(card => titles.some(t => card.name.toLowerCase().includes(t.toLowerCase()))).slice(0, 4);
  }, [state.cards]);

  // Fallback listings in case filters mismatch
  const finalLiveListings = useMemo(() => {
    if (liveListings.length >= 4) return liveListings;
    return state.cards.slice(0, 4);
  }, [liveListings, state.cards]);

  // Newsletter Form State
  const [newsEmail, setNewsEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      // Desktop includes any widescreen/landscape layout or screen width >= 1024
      setIsDesktop(window.innerWidth >= 1024 || (window.innerWidth >= 768 && window.innerWidth >= window.innerHeight));
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsEmail.trim() || !newsEmail.includes("@")) return;
    setSubscribed(true);
    setTimeout(() => {
      setSubscribed(false);
      setNewsEmail("");
    }, 3000);
  };

  return (
    <div className="relative h-screen bg-transparent text-white overflow-y-auto scroll-smooth font-sans">
      
      {/* Sticky Hero section (Stays pinned and stationary, bottom slides over) */}
      <div 
        className="sticky top-0 w-full h-screen flex flex-col justify-center items-center overflow-hidden z-0 pointer-events-none select-none shrink-0"
      >
        {/* Background Image inside sticky hero */}
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: -1 }}>
          <div 
            className="w-full h-full bg-top bg-no-repeat"
            style={{ 
              backgroundImage: "url('/media/background.jpg')",
              backgroundSize: isDesktop ? "100% auto" : "auto 100%",
            }} 
          />
          {/* No bottom shadow/gradient overlay */}
        </div>

        {/* Unified Hero Layout - Ensuring Title is always centered and Button is at the bottom, without overlaps */}
        <div className="absolute inset-0 flex flex-col justify-between items-center py-8 sm:py-12 md:py-16 px-6 pointer-events-none">
          {/* Top spacer to balance the button height & bottom padding to keep Title perfectly centered */}
          <div className="flex-1 min-h-[30px] sm:min-h-[50px] md:min-h-[70px] w-full" />

          {/* Title & Subtitle Group */}
          <div className="flex flex-col items-center text-center pointer-events-auto">
            <h1 className="text-6xl sm:text-8xl md:text-9xl font-black font-display uppercase tracking-[0.16em] leading-none text-white mb-0 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent animate-fade-in">
              ARCANE
            </h1>

            <p className="whitespace-nowrap text-white/70 text-[7px] sm:text-[9px] md:text-[10px] font-sans font-medium mt-1 sm:mt-2 px-2 leading-none mx-auto uppercase tracking-[0.25em]">
              An premier digital gallery for high-end crypto assets
            </p>
          </div>

          {/* Flex-1 spacer pushing the button towards the bottom, but keeping it visible */}
          <div className="flex-1 min-h-[40px] sm:min-h-[60px] md:min-h-[80px] w-full flex flex-col justify-end items-center pointer-events-auto">
            <button
              onClick={() => setCurrentView('marketplace')}
              className="px-14 py-4 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs sm:text-sm uppercase tracking-[0.3em] rounded-2xl transition-all duration-300 border border-white/15 hover:border-white/25 shadow-2xl shadow-black/45 cursor-pointer hover:scale-[1.04] active:scale-[0.98] backdrop-blur-[6px] shrink-0"
            >
              ENTER
            </button>
          </div>
        </div>
      </div>

      {/* Sliding Page Sheet Container (Smoothly slides UP and on top of the sticky hero section) */}
      <div className="relative z-10 bg-[#050507] shadow-[0_-24px_50px_rgba(3,3,4,0.95)]">
        
      {/* Live Listings Section */}
      <section className="border-t border-white/5 py-24 bg-[#050507]">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-12">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mb-2">
                Live Listings
              </h2>
              <p className="text-sm sm:text-base text-white/50 font-sans font-medium">
                Real-time drops and active listings from top digital creators.
              </p>
            </div>
            <button
              onClick={() => setCurrentView('marketplace')}
              className="text-xs font-mono font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 hover:text-cyan-300 transition-colors self-start cursor-pointer group"
            >
              View All <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Cards Grid - Single Row that dynamically displays only the number of cards that fit without side-scrolling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {finalLiveListings.map((card, idx) => {
              const creatorName = card.discordUsername ? `@${card.discordUsername}` : "@creator";
              
              // Determine responsive visibility to show only one row fitting the user's screen perfectly without side scrolling
              let visibilityClass = "flex"; // First item always visible
              if (idx === 1) visibilityClass = "hidden sm:flex";
              if (idx === 2) visibilityClass = "hidden md:flex";
              if (idx === 3) visibilityClass = "hidden lg:flex";
              
              return (
                <div
                  key={card.tokenId}
                  onClick={() => {
                    if (setSelectedCardId) {
                      setSelectedCardId(card.tokenId);
                      setCurrentView('card-details');
                    }
                  }}
                  className={`${visibilityClass} w-full rounded-3xl bg-[#09090c] glass-card border border-white/5 hover:border-white/10 overflow-hidden p-3.5 group hover:scale-[1.01] transition-all duration-300 cursor-pointer flex-col justify-between`}
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-black">
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-100"
                    />

                    {/* Blue tag "NEW" indicator if tokenId is 442 */}
                    {["442", "72"].includes(card.tokenId) && (
                      <div className="absolute top-3.5 left-3.5 bg-cyan-400 text-black text-[9px] font-mono font-black uppercase tracking-widest px-2 py-1 rounded">
                        NEW
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="pt-4 pb-2 px-1">
                    <h3 className="text-base font-extrabold text-white truncate tracking-tight">
                      {card.name}
                    </h3>
                    <p className="text-xs font-semibold text-white/40 mt-0.5 truncate uppercase tracking-tight">
                      by {creatorName}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-4.5">
                      <div>
                        <span className="block text-[8px] font-mono tracking-widest text-white/30 uppercase">
                          PRICE
                        </span>
                        <span className="text-sm font-black text-white font-mono block">
                          {card.price ? `${card.price.toFixed(2)} USDC` : "BID"}
                        </span>
                      </div>
                      <button className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-black text-[10px] font-mono uppercase tracking-widest rounded-lg transition-colors cursor-pointer">
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>



      {/* Corporate Solid NFT Footer matching layout */}
      <footer className="bg-[#050507] border-t border-white/5 pt-28 pb-16">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 grid grid-cols-1 md:grid-cols-12 gap-10 items-end">
          
          {/* Logo Column */}
          <div className="md:col-span-6 flex flex-col gap-4">
            <div className="flex items-center -mt-4 sm:-mt-5">
              <img 
                src="/media/logo.png" 
                alt="ARCANE Logo" 
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                style={{
                  filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 0 3px rgba(255,255,255,0.4))'
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <p className="text-xs sm:text-sm text-white/40 leading-relaxed font-sans font-medium">
              The world's leading NFT marketplace for high-end digital art and luxury crypto collectibles. Mint, trade, and discover the next generation of digital assets.
            </p>
          </div>

          {/* Links Column Market */}
          <div className="md:col-span-3 flex flex-col gap-4">
            <h4 className="text-xs uppercase tracking-widest text-white/80 font-bold">
              Marketplace
            </h4>
            <div className="flex flex-col gap-2.5">
              {["Art", "Gaming", "Photography"].map((link, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentView("marketplace")}
                  className="text-xs text-white/40 hover:text-white transition-colors text-left block w-fit cursor-pointer"
                >
                  {link}
                </button>
              ))}
            </div>
          </div>

          {/* Links Column Resources */}
          <div className="md:col-span-3 flex flex-col gap-4">
            <h4 className="text-xs uppercase tracking-widest text-white/80 font-bold">
              Resources
            </h4>
            <div className="flex flex-col gap-2.5">
              {["Community", "Newsletter", "Help Center"].map((link, idx) => (
                <button
                  key={idx}
                  className="text-xs text-white/40 hover:text-white transition-colors text-left block w-fit cursor-pointer"
                >
                  {link}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
  );
}
