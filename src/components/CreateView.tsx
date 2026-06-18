import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Image, Film, Music, Box, Plus, X, ShieldAlert, Sparkles, Camera, User } from 'lucide-react';
import { useWriteContract, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { getSavedState, saveState } from '../lib/mockData';
import { ArcaneNFT, ArcaneAttribute, ActivityLog } from '../types';
import { CONTRACTS } from '../lib/config';

interface CreateViewProps {
  setCurrentView: (view: string) => void;
  setSelectedCardId?: (id: string | null) => void;
}

export function CreateView({ setCurrentView, setSelectedCardId }: CreateViewProps) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [state, setState] = useState(getSavedState());

  // Form State
  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio" | "3d">("image");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaDataUrl, setMediaDataUrl] = useState<string>("");
  const [royaltyPercentage, setRoyaltyPercentage] = useState("5");
  const [customCategory, setCustomCategory] = useState<"pfp" | "art" | "photography" | "pixel">("art");

  // Custom attributes array from UI fields
  const [attributes, setAttributes] = useState<ArcaneAttribute[]>([]);
  const [newTraitType, setNewTraitType] = useState("");
  const [newTraitValue, setNewTraitValue] = useState("");

  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState("");
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  // Drag & drop state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileProcess = (file: File) => {
    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setMediaDataUrl(reader.result.toString());
      }
    };
    reader.readAsDataURL(file);

    // Auto classify type based on uploaded mime type
    const fileType = file.type;
    if (fileType.startsWith("video/")) {
      setMediaType("video");
    } else if (fileType.startsWith("audio/")) {
      setMediaType("audio");
    } else if (fileType.includes("model/") || file.name.endsWith(".gltf") || file.name.endsWith(".glb")) {
      setMediaType("3d");
    } else {
      setMediaType("image");
    }
    showNotification(`📂 File accepted: ${file.name}`);
  };

  // Trait action
  const handleAddAttribute = () => {
    if (!newTraitType || !newTraitValue) {
      showNotification("⚠️ Enter both type and name for the attribute.");
      return;
    }
    setAttributes([...attributes, { trait_type: newTraitType, value: newTraitValue }]);
    setNewTraitType("");
    setNewTraitValue("");
  };

  const handleRemoveAttribute = (idx: number) => {
    setAttributes(attributes.filter((_, i) => i !== idx));
  };

  const handleMintNFT = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeState = getSavedState();

    if (!activeState.walletConnected || !activeState.walletAddress) {
      showNotification("⚠️ Please connect your Web3 wallet first!");
      return;
    }

    if (!nftName.trim()) {
      showNotification("⚠️ Please enter a name for your digital asset!");
      return;
    }

    const mintFee = 0.01;
    if (activeState.balance < mintFee) {
      showNotification("❌ Insufficient gas balance to cover minting fee. Please use the Faucet!");
      return;
    }

    setIsMinting(true);
    setMintStatus("🔬 Storing metadata and publishing asset configurations...");

    const finalImageToUse = mediaDataUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop";

    // Create item token structure
    const nextId = (activeState.cards.length > 0 ? Math.max(...activeState.cards.map(c => parseInt(c.tokenId) || 0)) + 1 : 121).toString();
    const mappedMediaType = mediaType === "3d" ? "image" : mediaType; // Type fallback for mediaType
    const newNftItem: ArcaneNFT = {
      tokenId: nextId,
      owner: activeState.walletAddress,
      isListed: false,
      name: nftName,
      description: nftDescription || "A beautiful digital asset minted on ARCANE Studio.",
      imageUrl: finalImageToUse,
      mediaType: mappedMediaType as any,
      royaltyPercent: parseFloat(royaltyPercentage) || 0,
      attributes: [...attributes],
      creator: activeState.walletAddress,
      createdAt: new Date().toISOString(),
      discordId: "usr_" + Date.now().toString().substring(5),
      discordUsername: activeState.discordUser?.name || "Arcane_Member",
      discordRole: customCategory, // dynamically selected category
      avatar: finalImageToUse
    };

    if (isConnected) {
      setMintStatus("📜 Awaiting core transaction approval in Web3 wallet...");
      try {
        const txHash = await writeContractAsync({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'mintCard',
          args: [
            activeState.walletAddress as `0x${string}`,
            "usr_" + Date.now().toString().substring(5),
            customCategory,
            nftName,
          ],
          value: parseEther('0.01'),
        } as any);

        setMintStatus("⚡ Minting complete! Waiting for ledger confirmation...");

        const newLog: ActivityLog = {
          id: "log_" + Date.now(),
          tokenId: nextId,
          type: "mint",
          fromAddress: "0x0000000000000000000000000000000000000000",
          toAddress: activeState.walletAddress,
          amount: mintFee,
          timestamp: new Date().toISOString()
        };

        const updatedState = {
          ...activeState,
          cards: [newNftItem, ...activeState.cards],
          balance: parseFloat((activeState.balance - mintFee).toFixed(4)),
          logs: [newLog, ...activeState.logs]
        };

        setState(updatedState);
        saveState(updatedState);

        showNotification(`🎉 On-Chain Minting succeeded! Tx Hash: ${txHash.substring(0, 10)}...`);
        // redirect to profile
        setTimeout(() => {
          setCurrentView('profile');
        }, 1500);

      } catch (err: any) {
        console.error("Contract call mint error:", err);
        showNotification(`❌ Smart contract mint failed: ${err.message || err}`);
      } finally {
        setIsMinting(false);
        setMintStatus("");
      }
      return;
    }

    // fallback simulation
    setTimeout(() => {
      setMintStatus("✍🏼 Adding cryptographic cryptographic certificate signature...");
      setTimeout(() => {
        const newLog: ActivityLog = {
          id: "log_" + Date.now(),
          tokenId: nextId,
          type: "mint",
          fromAddress: "0x0000000000000000000000000000000000000000",
          toAddress: activeState.walletAddress,
          amount: mintFee,
          timestamp: new Date().toISOString()
        };

        const updatedState = {
          ...activeState,
          cards: [newNftItem, ...activeState.cards],
          balance: parseFloat((activeState.balance - mintFee).toFixed(4)),
          logs: [newLog, ...activeState.logs]
        };

        setState(updatedState);
        saveState(updatedState);
        setIsMinting(false);
        setMintStatus("");
        showNotification(`🎉 Web3 simulation: NFT minted successfully as Token #${nextId}!`);
        setTimeout(() => {
          setCurrentView('profile');
        }, 1500);
      }, 1000);
    }, 1200);
  };

  return (
    <div 
      className="relative min-h-screen pt-28 pb-24 bg-transparent text-white select-none overflow-x-hidden font-sans selection:bg-cyan-500/25 selection:text-white"
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
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-[#111111] border border-cyan-500/30 text-white font-sans text-xs sm:text-sm font-bold uppercase tracking-widest rounded-2xl shadow-[0_10px_35px_rgba(6,182,212,0.15)] flex items-center gap-3 backdrop-blur-md"
          >
            <Sparkles size={16} className="text-cyan-400 animate-pulse" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 font-sans relative z-10">
        {/* Header Block according to Screen 5 */}
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-white mb-2 font-display">
            Create New Item
          </h1>
          <p className="max-w-3xl text-sm sm:text-base text-white/50 leading-relaxed font-sans font-medium">
            Empower your digital legacy. ARCANE's studio provides high-fidelity tools for minting high-value digital assets on the blockchain.
          </p>
        </div>

        {/* Loading Overlay */}
        {isMinting && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col justify-center items-center z-50 p-6">
            <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-6" />
            <p className="text-sm font-mono uppercase tracking-widest text-cyan-400 animate-pulse font-bold text-center">
              {mintStatus}
            </p>
          </div>
        )}

        <form onSubmit={handleMintNFT} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Left Column - Media Upload Area */}
          <div className="flex flex-col gap-6">
            <h3 className="text-xs sm:text-sm font-mono uppercase tracking-widest text-white font-bold">
              Upload File
            </h3>

            {/* Drag Drop dashed area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.length) {
                  handleFileProcess(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-[1/1] w-full max-w-full rounded-3xl border-2 border-dashed flex flex-col justify-center items-center p-8 text-center cursor-pointer overflow-hidden transition-all duration-300 ${
                isDragOver 
                  ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_25px_rgba(34,211,238,0.1)]' 
                  : 'border-white/10 bg-white/[0.03] backdrop-blur-md hover:border-white/20 hover:bg-white/[0.05]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*,.gltf,.glb"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              {mediaDataUrl ? (
                <div className="absolute inset-0 w-full h-full bg-[#030303] flex items-center justify-center">
                  {mediaType === "video" ? (
                    <video
                      src={mediaDataUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : mediaType === "audio" ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <Music className="w-16 h-16 text-emerald-400 animate-bounce" />
                      <p className="text-xs font-mono uppercase text-white/50 tracking-wider">Audio Soundwave Loaded</p>
                    </div>
                  ) : (
                    <img
                      src={mediaDataUrl}
                      alt="Upload Preview"
                      className="w-full h-full object-contain"
                    />
                  )}
                  <div className="absolute top-4 right-4 bg-black/85 px-3 py-1.5 rounded-full text-[10px] font-mono border border-cyan-400/20 text-cyan-400">
                    CLICK TO REPLACE
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center text-white/40">
                    <UploadCloud size={28} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-xs font-mono text-white/95 uppercase tracking-widest font-black leading-relaxed">
                      IMAGE, VIDEO, AUDIO, OR 3D MODEL
                    </p>
                    <p className="text-[11px] text-zinc-300 mt-1 font-medium">
                      Drag and drop or click to browse
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-white/30 uppercase mt-4">
                    Max size: 100 MB
                  </div>
                </div>
              )}
            </div>

            {/* Selector Grid of Categories */}
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { category: "pfp", label: "PFP", icon: <User size={15} className="text-sky-400" /> },
                { category: "art", label: "ART", icon: <Sparkles size={15} className="text-violet-400" /> },
                { category: "photography", label: "PHOTOGRAPHY", icon: <Camera size={15} className="text-cyan-400" /> },
                { category: "pixel", label: "PIXEL", icon: <Box size={15} className="text-amber-400" /> }
              ].map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => {
                    setCustomCategory(item.category as any);
                    showNotification(`📂 Changed design category to: ${item.label}`);
                  }}
                  className={`py-3.5 rounded-xl border text-[9px] xs:text-[10px] font-mono uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-2 transition-all ${
                    customCategory === item.category
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'border-white/10 bg-white/[0.03] backdrop-blur-md text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column - Inputs Form */}
          <div className="flex flex-col gap-6">
            
            {/* Input Name */}
            <div className="flex flex-col gap-2">
              <label className="text-xs sm:text-sm font-mono uppercase tracking-widest text-white font-bold">
                Name
              </label>
              <input
                type="text"
                placeholder="Item Name"
                value={nftName}
                onChange={(e) => setNftName(e.target.value)}
                className="w-full px-5 py-4 bg-white/[0.04] backdrop-blur-lg border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none transition-all text-sm sm:text-base text-white font-bold placeholder-white/30 font-sans shadow-inner selection:bg-cyan-500/30 selection:text-white"
              />
            </div>

            {/* External Link */}
            <div className="flex flex-col gap-2">
              <label className="text-xs sm:text-sm font-mono uppercase tracking-widest text-white font-bold">
                External Link
              </label>
              <input
                type="text"
                placeholder="https://yoursite.io/item/123"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                className="w-full px-5 py-4 bg-white/[0.04] backdrop-blur-lg border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none transition-all text-sm sm:text-base text-white font-bold placeholder-white/30 font-sans shadow-inner selection:bg-cyan-500/30 selection:text-white"
              />
              <p className="text-[10px] sm:text-xs text-zinc-300 font-sans -mt-0.5 font-medium leading-normal">
                ARCANE will include a link to this URL on this item's detail page.
              </p>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-xs sm:text-sm font-mono uppercase tracking-widest text-white font-bold">
                Description
              </label>
              <textarea
                rows={4}
                placeholder="Provide a detailed description of your asset..."
                value={nftDescription}
                onChange={(e) => setNftDescription(e.target.value)}
                className="w-full px-5 py-4 bg-white/[0.04] backdrop-blur-lg border border-white/10 rounded-xl focus:border-cyan-500/50 focus:outline-none transition-all text-sm sm:text-base text-white font-bold placeholder-white/30 font-sans resize-none shadow-inner"
              />
              <p className="text-[10px] sm:text-xs text-zinc-300 font-sans -mt-0.5 font-medium leading-normal">
                The description will be included on the item's detail page underneath its image. Markdown is supported.
              </p>
            </div>



            {/* Properties section */}
            <div className="flex flex-col gap-3 mt-2 border-t border-white/5 pt-5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-mono uppercase tracking-widest text-white font-bold">
                  Properties
                </label>
                <button
                  type="button"
                  onClick={handleAddAttribute}
                  className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-black flex items-center gap-1 bg-white/[0.04] backdrop-blur-md border border-cyan-400/25 px-3 py-1.5 rounded-full hover:bg-cyan-500/10 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus size={11} /> Add Property
                </button>
              </div>

              {/* Trait fields */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <input
                  type="text"
                  placeholder="Type (e.g. Background)"
                  value={newTraitType}
                  onChange={(e) => setNewTraitType(e.target.value)}
                  className="px-4 py-3 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl text-xs focus:border-cyan-500/50 focus:outline-none text-white font-semibold font-mono placeholder-white/30"
                />
                <input
                  type="text"
                  placeholder="Name (e.g. Midnight)"
                  value={newTraitValue}
                  onChange={(e) => setNewTraitValue(e.target.value)}
                  className="px-4 py-3 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl text-xs focus:border-cyan-500/50 focus:outline-none text-white font-semibold font-mono placeholder-white/30"
                />
              </div>

              {/* Trait display cards list */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {attributes.map((attr, idx) => (
                  <div
                    key={idx}
                    className="relative px-3.5 py-2.5 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl text-center group flex flex-col justify-center min-h-[64px]"
                  >
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#38bdf8] font-bold">
                      {attr.trait_type}
                    </p>
                    <p className="text-xs text-white font-bold tracking-tight truncate mt-0.5">
                      {attr.value}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors cursor-pointer shadow-md"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Mint Form Submit Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              className="mt-6 w-full py-4.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase text-xs sm:text-sm tracking-widest shadow-lg shadow-cyan-400/10 cursor-pointer flex items-center justify-center gap-2"
            >
              Mint NFT
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}
