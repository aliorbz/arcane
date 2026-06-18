import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CATEGORY_CONFIGS } from '../lib/mockData';
import { ShieldCheck, Play, Pause, Volume2, Film, Image } from 'lucide-react';
import { ArcaneNFT } from '../types';

interface CardPreviewProps {
  tokenId: string;
  nft?: ArcaneNFT;
  // Overrides / backward compatibility inputs
  roleType?: string;
  username?: string;
  avatar?: string;
  price?: number;
  isListed?: boolean;
  insideCardPage?: boolean;
  isCompact?: boolean;
  children?: React.ReactNode;
}

export function CardPreview({
  tokenId,
  nft,
  roleType,
  username,
  avatar,
  price,
  isListed,
  insideCardPage = false,
  isCompact = false,
  children
}: CardPreviewProps) {
  // Resolve core details
  const finalName = nft?.name || username || `Artifact #${tokenId}`;
  const finalImage = nft?.imageUrl || avatar || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop";
  const finalMediaType = nft?.mediaType || "image";
  const finalPrice = nft?.price !== undefined ? nft.price : price;
  const finalIsListed = nft?.isListed !== undefined ? nft.isListed : isListed;
  const finalCategory = (nft?.discordRole || roleType || "art").toLowerCase();

  const colors = CATEGORY_CONFIGS[finalCategory] || CATEGORY_CONFIGS.art;

  // Audio preview play/pause simulation state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const auraGlowStyle = {
    background: colors.gradient
  };

  const cardStyle = {
    boxShadow: `0 15px 35px -12px ${colors.glow}`,
    borderColor: insideCardPage 
      ? colors.primary 
      : 'rgba(255, 255, 255, 0.15)',
  };

  return (
    <div className={`relative group select-none flex justify-center ${isCompact ? "w-full" : "w-full max-w-[340px]"}`}>
      {/* Glow Aura Back shadow */}
      <div
        className="absolute -inset-1 blur-[25px] rounded-[24px] opacity-15 group-hover:opacity-60 transition-all duration-700 pointer-events-none"
        style={auraGlowStyle}
      />

      {/* Main Card Element */}
      <div
        style={cardStyle}
        className={`relative rounded-[24px] overflow-hidden bg-[#0a0a0a] border-2 flex flex-col justify-between transition-transform duration-500 hover:scale-[1.03] p-4 ${
          insideCardPage
            ? "w-[300px] h-[450px] sm:w-[340px] sm:h-[490px]"
            : isCompact
              ? "w-full aspect-[1/1.42]"
              : "w-full aspect-[1/1.45]"
        }`}
      >
        {/* Background character or media image */}
        <div className="absolute inset-0 z-0 bg-[#0d0d0d]">
          {finalMediaType === "video" ? (
            <div className="relative w-full h-full">
              <video
                src={finalImage.endsWith('.mp4') ? finalImage : "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-32115-large.mp4"}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-65 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
              />
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-[10px] uppercase font-mono tracking-widest text-white flex items-center gap-1 z-20">
                <Film size={12} className="text-sky-400" />
                <span>Motion</span>
              </div>
            </div>
          ) : finalMediaType === "audio" ? (
            <div className="relative w-full h-full flex flex-col justify-center items-center p-6 bg-gradient-to-b from-zinc-950 to-zinc-900">
              <img
                src={finalImage || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop"}
                alt={finalName}
                referrerPolicy="no-referrer"
                className="w-32 h-32 rounded-xl object-cover shadow-2xl border border-white/10 opacity-70 group-hover:opacity-85 group-hover:scale-105 transition-all duration-700"
              />
              {/* Fake playback waveform animation */}
              <div className="mt-4 flex items-end gap-1 h-8 z-15">
                {[1,2,3,4,5,6,7,8,7,6,5,4,3,2,1].map((val, idx) => (
                  <div
                    key={idx}
                    className={`w-0.5 bg-emerald-400 rounded-full ${isPlayingAudio ? 'animate-[pulse_1.2s_infinite]' : 'h-1.5'}`}
                    style={{
                      height: isPlayingAudio ? `${Math.sin(val) * 100}%` : '6px',
                      animationDelay: `${idx * 0.08}s`
                    }}
                  />
                ))}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlayingAudio(!isPlayingAudio);
                }}
                className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-[10px] uppercase font-mono tracking-widest text-white flex items-center gap-1 z-20 hover:bg-black transition-colors pointer-events-auto"
              >
                {isPlayingAudio ? (
                  <>
                    <Pause size={12} className="text-emerald-400" />
                    <span>Mute</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={12} className="text-emerald-400 animate-pulse" />
                    <span>Audition</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              <img
                src={finalImage}
                referrerPolicy="no-referrer"
                alt={finalName}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-75 group-hover:scale-105 transition-all duration-700"
              />
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-[10px] uppercase font-mono tracking-widest text-white flex items-center gap-1 z-20">
                <Image size={12} className="text-purple-400" />
                <span>Graphic</span>
              </div>
            </>
          )}
          {/* Shaded overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30 pointer-events-none" />
        </div>

        {/* Dynamic Card Shimmer effect */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-1000 bg-[linear-gradient(105deg,transparent_30%,rgba(255,255,255,0.2)_45%,rgba(255,255,255,0.4)_50%,rgba(255,255,255,0.2)_55%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer_3s_infinite_linear]" />

        {/* CARD TOP INFO */}
        <div className="relative z-10 w-full flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.primary }} />
            <span className="text-[10px] sm:text-xs font-mono font-black text-white uppercase tracking-wider">{colors.name}</span>
          </div>
          <div className="px-2.5 py-1 rounded-full border border-white/25 bg-black/80 text-[10px] sm:text-xs font-mono font-bold text-white shadow-lg">
            #{tokenId}
          </div>
        </div>

        {/* CUSTOM TRAITS BADGES (Displayed on card face if not compact) */}
        {!isCompact && nft?.attributes && nft.attributes.length > 0 && (
          <div className="relative z-10 w-full mt-auto mb-3 text-left pointer-events-none bg-black/60 backdrop-blur-sm p-3 rounded-xl border border-white/5 space-y-1.5">
            <div className="text-[9px] font-mono uppercase text-white/40 tracking-wider">Properties & Attributes</div>
            <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-hidden">
              {nft.attributes.map((attr, idx) => (
                <div key={idx} className="bg-white/5 text-[9px] border border-white/10 rounded px-1.5 py-0.5 text-white/80 font-mono truncate max-w-[120px]">
                  <span className="text-white/30 mr-1">{attr.trait_type}:</span>
                  <span className="font-bold underline decoration-purple-500/30">{attr.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEFAULT TRAITS FOR PRESETS */}
        {!isCompact && (!nft || !nft.attributes || nft.attributes.length === 0) && (
          <div className="relative z-10 w-full mt-auto mb-3 text-left pointer-events-none bg-black/60 backdrop-blur-sm p-3 rounded-xl border border-white/5 space-y-1">
            <div className="text-[9px] font-mono uppercase text-white/40 tracking-wider">Properties</div>
            <div className="flex flex-wrap gap-1.5">
              <div className="bg-white/5 text-[9px] border border-white/10 rounded px-2 py-0.5 text-white/80 font-mono">
                <span className="text-white/30 mr-1">Rarity:</span>
                <span className="font-bold text-purple-400">ARCANE</span>
              </div>
              <div className="bg-white/5 text-[9px] border border-white/10 rounded px-2 py-0.5 text-white/80 font-mono">
                <span className="text-white/30 mr-1">Network:</span>
                <span className="font-bold text-sky-400">Arcscan</span>
              </div>
            </div>
          </div>
        )}

        {/* CARD BOTTOM INFO */}
        <div className="relative z-20 w-full text-left mt-auto">
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-black/90 via-black/85 to-black/70 backdrop-blur-md p-2.5 sm:p-3.5 rounded-2xl border border-white/10 shadow-lg select-text">
            <div className="min-w-0 flex-1">
              <h3 className="font-black font-sans uppercase text-sm sm:text-base text-white tracking-tight truncate flex items-center gap-1">
                {finalName}
                <ShieldCheck size={14} className="flex-shrink-0 animate-pulse" style={{ color: colors.primary }} />
              </h3>
              <p className="text-[10px] sm:text-xs text-white/50 font-mono truncate">
                {finalIsListed && finalPrice !== undefined ? `${finalPrice} USDC` : 'NOT LISTED'}
              </p>
            </div>
          </div>

          {/* Render overlay children buttons if any */}
          {children && <div className="mt-2 w-full">{children}</div>}
        </div>
      </div>
    </div>
  );
}

