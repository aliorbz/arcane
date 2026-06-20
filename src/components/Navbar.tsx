import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Sparkles, Gamepad2, User, LogOut, ChevronDown, PlusCircle, Bot } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  walletConnected: boolean;
  walletAddress: string;
  balance: number;
  onConnectWallet: (realAddress?: string) => void;
  onDisconnectWallet: () => void;
  onTriggerFaucet: () => void;
  discordUser?: { name: string; avatar?: string } | null;
  profileTab?: "cards" | "forge";
  setProfileTab?: (tab: "cards" | "forge") => void;
}

export function Navbar({
  currentView,
  setCurrentView,
  walletConnected,
  walletAddress,
  balance,
  onConnectWallet,
  onDisconnectWallet,
  onTriggerFaucet,
  discordUser,
  profileTab = "cards",
  setProfileTab
}: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNetworkMenuOpen, setIsNetworkMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const networkMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (networkMenuRef.current && !networkMenuRef.current.contains(event.target as Node)) {
        setIsNetworkMenuOpen(false);
      }
    }
    if (isDropdownOpen || isNetworkMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isNetworkMenuOpen]);

  // Shorten address helper
  const shortAddress = walletAddress
    ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
    : "";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3 sm:px-8 transition-all duration-300">
      {/* Dynamic Fading Gradient Backdrop Glass-Blur Layer with compact normal height */}
      <div 
        className="absolute top-0 left-0 right-0 h-20 sm:h-24 pointer-events-none z-[-1]" 
        style={{
          backdropFilter: 'blur(6px) saturate(140%)',
          WebkitBackdropFilter: 'blur(6px) saturate(140%)',
          maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.85) 45%, rgba(0, 0, 0, 0) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.85) 45%, rgba(0, 0, 0, 0) 100%)',
          background: 'linear-gradient(to bottom, rgba(3,3,4,0.25) 0%, rgba(3,3,4,0.08) 50%, rgba(3,3,4,0) 100%)',
        }}
      />
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <button
          onClick={() => setCurrentView('home')}
          className="flex items-center group focus:outline-none ml-0 sm:ml-3"
        >
          <img 
            src="/media/logo.png" 
            alt="ARCANE Logo" 
            className="w-12 h-12 sm:w-16 sm:h-16 object-contain hover:scale-[1.05] transition-transform duration-300"
            style={{
              filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.9)) drop-shadow(0 0 3px rgba(255,255,255,0.4))'
            }}
            onError={(e) => {
              // Hide on load error just in case
              e.currentTarget.style.display = 'none';
            }}
          />
        </button>

        {/* View Selection Menu inside one single capsule structure */}
        <div className="flex items-center p-1 gap-1 relative rounded-full border shadow-sm transition-all duration-300 bg-[#09090c]/40 border-white/5 backdrop-blur-md">
          {[
            { id: 'home', label: 'Home' },
            { id: 'marketplace', label: 'Market' },
            { id: 'chat', label: 'ARCANIA' }
          ].map((tab) => {
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={`relative px-4 py-2 rounded-full text-[12px] font-normal uppercase tracking-[0.16em] transition-all duration-300 cursor-pointer focus:outline-none select-none ${
                  isActive ? "text-cyan-400" : "text-white/40 hover:text-white"
                }`}
                style={{ fontFamily: 'Forum, "Forum", serif' }}
              >
                {isActive && (
                  <motion.span
                    layoutId="active-nav-capsule"
                    className="absolute inset-0 rounded-full z-[-1] border shadow-sm bg-white/10 border-white/10 shadow-[0_2px_8px_rgba(255,255,255,0.05)]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Wallet Controller HUD */}
        <div className="flex items-center gap-2 relative">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openChainModal,
              openAccountModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              // Synchronize the parent app connection state so the main state hook stays aligned
              if (ready) {
                if (connected && !walletConnected) {
                  setTimeout(() => onConnectWallet(account.address), 10);
                } else if (!connected && walletConnected) {
                  setTimeout(() => onDisconnectWallet(), 10);
                }
              }

              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="px-4.5 py-2.5 sm:px-6 rounded-2xl bg-white hover:bg-white/95 text-black font-normal text-xs sm:text-xs uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5 cursor-pointer"
                    style={{ fontFamily: 'Forum, "Forum", serif' }}
                  >
                    <Wallet size={14} />
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <div ref={networkMenuRef} className="relative">
                    <button
                      onClick={() => setIsNetworkMenuOpen(!isNetworkMenuOpen)}
                      type="button"
                      className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all cursor-pointer"
                    >
                      Wrong Network
                    </button>

                    <AnimatePresence>
                      {isNetworkMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2.5 w-72 glass-card rounded-2xl shadow-2xl overflow-hidden z-50 p-2 text-left duration-300"
                          style={{ fontFamily: 'Forum, "Forum", serif' }}
                        >
                          <p className="px-3 py-2 text-[11px] leading-relaxed text-white/55">
                            This wallet does not support Arc Testnet. Disconnect or use another wallet.
                          </p>

                          <button
                            onClick={() => {
                              setIsNetworkMenuOpen(false);
                              openChainModal();
                            }}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-all mt-0.5"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            <Wallet size={15} /> Switch Network
                          </button>

                          <button
                            onClick={() => {
                              onDisconnectWallet();
                              setIsNetworkMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl transition-all mt-1 border-t border-white/5 pt-3"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            <LogOut size={15} /> Disconnect Wallet
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

               return (
                <div ref={dropdownRef} className="relative">
                  {/* Connected User Hub Trigger and Balance Status */}
                  <div className="flex items-center glass-card rounded-2xl border border-white/10 pl-3.5 pr-1.5 py-1 sm:py-1.5 shadow-inner">
                    <div className="text-right mr-3 flex flex-col justify-center">
                      <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-black leading-none mb-1">
                        Balance
                      </p>
                      <p className="text-xs font-mono font-black text-cyan-400 leading-none">
                        {balance !== undefined && balance !== null ? `${balance.toFixed(3)} USDC` : "0.000 USDC"}
                      </p>
                    </div>

                    {/* Connected Avatar & Dropdown trigger */}
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      title="Open Profile Options"
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all duration-300 text-xs flex items-center gap-2 border border-white/5 focus:outline-none cursor-pointer"
                      style={{ fontFamily: 'Forum, "Forum", serif' }}
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 overflow-hidden flex items-center justify-center relative">
                        {discordUser?.avatar ? (
                          <img referrerPolicy="no-referrer" src={discordUser.avatar} alt="PFP" className="w-full h-full object-cover" />
                        ) : (
                          <User size={12} className="text-white" />
                        )}
                        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-black animate-pulse" />
                      </div>
                      <span>{account.displayName}</span>
                      <ChevronDown size={14} className={`text-white/40 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Absolute Dropdown Modal as sibling to avoid nested backdrop filter issues */}
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2.5 w-60 glass-card rounded-2xl shadow-2xl overflow-hidden z-50 p-2 text-left duration-300"
                          style={{ fontFamily: 'Forum, "Forum", serif' }}
                        >
                          <div className="px-4 py-3 border-b border-white/5 mb-1.5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 overflow-hidden flex items-center justify-center">
                              {discordUser?.avatar ? (
                                <img referrerPolicy="no-referrer" src={discordUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <User size={14} className="text-white" />
                              )}
                            </div>
                             <div className="overflow-hidden flex flex-col justify-center">
                              <p className="text-sm truncate text-white uppercase tracking-wider font-semibold leading-none">
                                {discordUser?.name ? discordUser.name.toUpperCase() : "ARCANIAN #000"}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setCurrentView('profile');
                              if (setProfileTab) setProfileTab('cards');
                              setIsDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-xs uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            <span className="flex items-center gap-2.5"><User size={15} /> Profile</span>
                          </button>

                          <button
                            onClick={() => {
                              setCurrentView('create');
                              setIsDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-xs uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-all mt-0.5"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            <span className="flex items-center gap-2.5"><PlusCircle size={15} /> Create Asset</span>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">Mint</span>
                          </button>

                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-all mt-0.5"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            <Wallet size={15} /> Wallet Options
                          </button>

                          <button
                            onClick={() => {
                              onDisconnectWallet();
                              setIsDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl transition-all mt-1 border-t border-white/5 pt-3"
                            style={{ fontFamily: 'Forum, "Forum", serif' }}
                          >
                            <LogOut size={15} /> Disconnect Wallet
                          </button>
                        </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </nav>
  );
}
