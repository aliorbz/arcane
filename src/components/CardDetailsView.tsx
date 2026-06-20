import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ShieldCheck, Activity, Award, User, RefreshCw, Send, Check, Trash2, Tag, AlertTriangle, Play, Sparkles, Heart, Clock } from 'lucide-react';
import { useWriteContract, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { getSavedState, saveState } from '../lib/mockData';
import { ArcaneNFT, CardOffer, ActivityLog } from '../types';
import { CONTRACTS } from '../lib/config';
import { fetchOnchainCards, fetchOnchainOffers, publicClient } from '../lib/onchain';

interface CardDetailsViewProps {
  cardId: string;
  setCurrentView: (view: string) => void;
  setSelectedCardId: (id: string | null) => void;
}

export function CardDetailsView({ cardId, setCurrentView, setSelectedCardId }: CardDetailsViewProps) {
  const { isConnected, chainId, chain, address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [state, setState] = useState(getSavedState());

  // Periodically refresh active assets and states from persistent storage
  useEffect(() => {
    const interval = setInterval(() => {
       setState(getSavedState());
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const [transferAddress, setTransferAddress] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [showListInput, setShowListInput] = useState(false);
  const [bidPrice, setBidPrice] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState("");
  const [isListing, setIsListing] = useState(false);
  const [listingProgress, setListingProgress] = useState("");
  const [onchainOffers, setOnchainOffers] = useState<CardOffer[]>([]);
  const [isOfferActionPending, setIsOfferActionPending] = useState(false);
  const [offerProgress, setOfferProgress] = useState("");
  const [liveOwner, setLiveOwner] = useState<string | null>(null);
  const [isOwnerLoading, setIsOwnerLoading] = useState(true);
  const [ownerRefreshError, setOwnerRefreshError] = useState(false);
  const ownerRefreshRunRef = useRef(0);

  const [preflightLogs, setPreflightLogs] = useState<{
    nftMintAddress: string;
    nftListingAddress: string;
    marketplaceAddress: string;
    connectedChainId: number | undefined;
    nftBytecodeExists: boolean | null;
    marketplaceBytecodeExists: boolean | null;
    isLoading: boolean;
  }>({
    nftMintAddress: CONTRACTS.NFT.address,
    nftListingAddress: CONTRACTS.NFT.address,
    marketplaceAddress: CONTRACTS.MARKETPLACE.address,
    connectedChainId: undefined,
    nftBytecodeExists: null,
    marketplaceBytecodeExists: null,
    isLoading: true,
  });

  useEffect(() => {
    async function checkContracts() {
      const activeChainId = chainId || chain?.id;
      let nftExists = false;
      let marketExists = false;
      try {
        const nftBytecode = await (publicClient as any).getBytecode({
          address: CONTRACTS.NFT.address as `0x${string}`,
        });
        nftExists = !!(nftBytecode && nftBytecode !== "0x");
      } catch (e) {
        console.warn("Preflight test check failed for NFT:", e);
      }

      try {
        const marketBytecode = await (publicClient as any).getBytecode({
          address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
        });
        marketExists = !!(marketBytecode && marketBytecode !== "0x");
      } catch (e) {
        console.warn("Preflight test check failed for Marketplace:", e);
      }

      setPreflightLogs({
        nftMintAddress: CONTRACTS.NFT.address,
        nftListingAddress: CONTRACTS.NFT.address,
        marketplaceAddress: CONTRACTS.MARKETPLACE.address,
        connectedChainId: activeChainId,
        nftBytecodeExists: nftExists,
        marketplaceBytecodeExists: marketExists,
        isLoading: false,
      });

    }
    
    checkContracts();
  }, [chainId, chain]);

  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const updateLocalState = (newState: Partial<typeof state>) => {
    const updated = { ...state, ...newState };
    setState(updated);
    saveState(updated);
  };

  const patchCardInLatestState = (
    tokenId: string,
    patch: Partial<ArcaneNFT>,
    extraState: Partial<typeof state> = {}
  ) => {
    const latestState = getSavedState();
    const updatedCards = latestState.cards.map(c =>
      c.tokenId === tokenId ? { ...c, ...patch } : c
    );
    const updated = {
      ...latestState,
      ...extraState,
      cards: updatedCards,
    };
    setState(updated);
    saveState(updated);
    return updated;
  };

  const markCardInvalidOnchain = (tokenId: string) => {
    updateLocalState({
      cards: state.cards.map(c => {
        if (c.tokenId !== tokenId) return c;
        return {
          ...c,
          invalidOnchain: true,
          localOnly: true,
          isListed: false,
          price: undefined,
          listingId: undefined
        };
      })
    });
  };

  const card = useMemo(() => {
    return state.cards.find(c => c.tokenId === cardId);
  }, [state.cards, cardId]);

  const withOwnerTimeout = <T,>(promise: Promise<T>, label: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        window.setTimeout(() => reject(new Error(`${label} timed out`)), 10000);
      }),
    ]);
  };

  const refreshLiveOwnership = async () => {
    const runId = ownerRefreshRunRef.current + 1;
    ownerRefreshRunRef.current = runId;

    if (!card || !/^\d+$/.test(card.tokenId)) {
      setLiveOwner(null);
      setOwnerRefreshError(false);
      setIsOwnerLoading(false);
      return null;
    }

    setIsOwnerLoading(true);
    setOwnerRefreshError(false);
    try {
      const owner = await withOwnerTimeout((publicClient as any).readContract({
        address: CONTRACTS.NFT.address as `0x${string}`,
        abi: CONTRACTS.NFT.abi,
        functionName: 'ownerOf',
        args: [BigInt(card.tokenId)],
      }) as Promise<string>, "ownerOf");

      if (ownerRefreshRunRef.current !== runId) return owner;

      setLiveOwner(owner);
      const mismatch = !!card.owner && owner.toLowerCase() !== card.owner.toLowerCase();
      try {
        await withOwnerTimeout((publicClient as any).readContract({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'isApprovedForAll',
          args: [owner as `0x${string}`, CONTRACTS.MARKETPLACE.address as `0x${string}`],
        }) as Promise<boolean>, "isApprovedForAll");
      } catch (approvalErr) {
        console.warn("Failed to refresh marketplace approval:", approvalErr);
      }

      if (mismatch) {
        patchCardInLatestState(card.tokenId, { owner });
      }
      return owner;
    } catch (err) {
      console.warn("Failed to refresh live NFT ownership:", err);
      if (ownerRefreshRunRef.current !== runId) return null;
      setLiveOwner(null);
      setOwnerRefreshError(true);
      return null;
    } finally {
      if (ownerRefreshRunRef.current === runId) {
        setIsOwnerLoading(false);
      }
    }
  };

  const isOwner = useMemo(() => {
    if (!state.walletConnected || !state.walletAddress || !liveOwner || isOwnerLoading) return false;
    return liveOwner.toLowerCase() === state.walletAddress.toLowerCase();
  }, [state.walletConnected, state.walletAddress, liveOwner, isOwnerLoading]);

  const ownerActionsDisabled = isOwnerLoading || ownerRefreshError || !liveOwner;
  const displayedOwner = liveOwner || "";
  const canShowYouOwnerLabel = !isOwnerLoading && !!liveOwner && isOwner;
  const ownerLabel = useMemo(() => {
    if (ownerRefreshError) return "UNKNOWN";
    if (isOwnerLoading || !displayedOwner) return "VERIFYING";
    if (canShowYouOwnerLabel) return "YOU";
    return `${displayedOwner.substring(0, 6)}...${displayedOwner.substring(displayedOwner.length - 4)}`;
  }, [ownerRefreshError, isOwnerLoading, displayedOwner, canShowYouOwnerLabel]);

  const refreshOnchainOffers = async () => {
    if (!card || !/^\d+$/.test(card.tokenId)) {
      setOnchainOffers([]);
      return;
    }

    const liveOffers = await fetchOnchainOffers(CONTRACTS.NFT.address as `0x${string}`, card.tokenId);
    setOnchainOffers(liveOffers);
  };

  const refreshCardFromOnchain = async () => {
    if (!card) return undefined;

    const refreshedOnchainCards = await fetchOnchainCards();
    const refreshedCard = refreshedOnchainCards.find(c => c.tokenId === card.tokenId);
    if (!refreshedCard) return undefined;

    patchCardInLatestState(card.tokenId, {
      owner: refreshedCard.owner,
      isListed: refreshedCard.isListed,
      price: refreshedCard.isListed ? refreshedCard.price : undefined,
      listingId: refreshedCard.isListed ? refreshedCard.listingId : undefined,
    });

    return refreshedCard;
  };

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      if (!card || !/^\d+$/.test(card.tokenId)) {
        if (!cancelled) setOnchainOffers([]);
        return;
      }

      const liveOffers = await fetchOnchainOffers(CONTRACTS.NFT.address as `0x${string}`, card.tokenId);
      if (!cancelled) setOnchainOffers(liveOffers);
    }

    loadOffers();
    const interval = setInterval(loadOffers, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [card?.tokenId]);

  useEffect(() => {
    refreshLiveOwnership();
  }, [card?.tokenId, state.walletAddress, state.walletConnected]);

  const creatorAddressFormatted = useMemo(() => {
    if (!card) return "0x0000...0000";
    const addr = card.creator || "0xBE0848a9315da2ffbc28a9ea56b0d4b42413c8be";
    if (addr.startsWith("0x") && addr.length > 10) {
      return `${addr.substring(0, 6).toUpperCase()}...${addr.substring(addr.length - 4).toUpperCase()}`;
    }
    return addr;
  }, [card?.creator]);

  // Active offers on this specific token card
  const cardOffers = useMemo(() => {
    return onchainOffers.filter(o => o.tokenId === cardId && o.active);
  }, [onchainOffers, cardId]);

  const activeUserOffer = useMemo(() => {
    if (!state.walletConnected || !state.walletAddress) return null;
    return cardOffers.find(o => o.offerer.toLowerCase() === state.walletAddress.toLowerCase()) || null;
  }, [cardOffers, state.walletConnected, state.walletAddress]);

  const hasActiveUserOffer = !!activeUserOffer;

  const overListPriceOfferWarning = useMemo(() => {
    if (!card?.isListed || card.price === undefined || !bidPrice.trim()) return null;
    const offerAmount = parseFloat(bidPrice);
    if (isNaN(offerAmount) || offerAmount < card.price) return null;
    const listedPrice = `${card.price.toFixed(4)} USDC`;
    return `This NFT is listed for ${listedPrice}. Your offer can not be equal or higher than ${listedPrice}.`;
  }, [card?.isListed, card?.price, bidPrice]);

  const highestOffer = useMemo(() => {
    if (cardOffers.length === 0) return null;
    return Math.max(...cardOffers.map(o => o.amount));
  }, [cardOffers]);

  const offerCount = useMemo(() => {
    return cardOffers.length;
  }, [cardOffers]);

  // Activity logs audit trail on this token
  const cardLogs = useMemo(() => {
    return state.logs.filter(l => l.tokenId === cardId);
  }, [state.logs, cardId]);

  // Execute Transfer Card
  const handleTransfer = () => {
    if (ownerActionsDisabled || !isOwner) {
      showNotification("This NFT ownership changed onchain. Refreshing...");
      refreshLiveOwnership();
      return;
    }

    if (!transferAddress.startsWith("0x") || transferAddress.length < 10) {
      showNotification("❌ Please enter a valid Hex wallet address starting with 0x...");
      return;
    }

    if (transferAddress.toLowerCase() === state.walletAddress.toLowerCase()) {
      showNotification("❌ Cannot transfer card to your own active connected wallet!");
      return;
    }

    if (!card) return;

    const updatedCards = state.cards.map(c => {
      if (c.tokenId === card.tokenId) {
        return {
          ...c,
          owner: transferAddress,
          isListed: false,
          price: undefined
        };
      }
      return c;
    });

    const newLog: ActivityLog = {
      id: "log_" + Date.now(),
      tokenId: card.tokenId,
      type: "transfer",
      fromAddress: state.walletAddress,
      toAddress: transferAddress,
      timestamp: new Date().toISOString()
    };

    updateLocalState({
      ...state,
      cards: updatedCards,
      logs: [newLog, ...state.logs]
    });

    showNotification(`✈️ Successfully transferred NFT #${card.tokenId} to recipient address.`);
    refreshLiveOwnership();
    setTransferAddress("");
    setSelectedCardId(null);
    setCurrentView('profile');
  };

  // Cancel active onchain offer
  const handleCancelOffer = async (offer: CardOffer) => {
    if (!state.walletConnected || !state.walletAddress || !card) {
      showNotification("Please connect your Web3 wallet first.");
      return;
    }

    if (!/^\d+$/.test(card.tokenId)) {
      showNotification("Missing or invalid token ID. Offer action blocked.");
      return;
    }

    if (offer.offerer.toLowerCase() !== state.walletAddress.toLowerCase()) {
      showNotification("Only the offer maker can cancel this onchain offer.");
      return;
    }

    setIsOfferActionPending(true);
    setOfferProgress("Waiting for cancel offer signature");

    try {
      const txHash = await writeContractAsync({
        address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
        abi: CONTRACTS.MARKETPLACE.abi,
        functionName: 'cancelOffer',
        args: [CONTRACTS.NFT.address as `0x${string}`, BigInt(card.tokenId)],
      } as any);

      setOfferProgress("Cancel offer transaction pending");
      const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("Cancel offer transaction failed onchain.");
      }

      await refreshOnchainOffers();
      const newLog: ActivityLog = {
        id: "log_" + Date.now(),
        tokenId: card.tokenId,
        type: "cancel_offer",
        fromAddress: offer.offerer,
        toAddress: displayedOwner || card.owner,
        amount: offer.amount,
        txHash,
        timestamp: new Date().toISOString()
      };

      updateLocalState({
        ...state,
        logs: [newLog, ...state.logs]
      });
      showNotification("Offer canceled onchain.");
    } catch (err: any) {
      console.error("Cancel offer failed:", err);
      showNotification(`Transaction declined or failed: ${err.message || err}`);
    } finally {
      setIsOfferActionPending(false);
      setOfferProgress("");
    }
  };

  // Accept onchain offer (Owner Action)
  const handleAcceptOffer = async (offer: CardOffer) => {
    if (!state.walletConnected || !state.walletAddress || !card) {
      showNotification("Please connect your Web3 wallet first.");
      return;
    }

    if (!/^\d+$/.test(card.tokenId)) {
      showNotification("Missing or invalid token ID. Offer action blocked.");
      return;
    }

    const currentOwner = await refreshLiveOwnership();
    if (!currentOwner || currentOwner.toLowerCase() !== state.walletAddress.toLowerCase()) {
      showNotification("Only the NFT owner can accept this onchain offer.");
      return;
    }

    setIsOfferActionPending(true);
    setOfferProgress("Checking marketplace approval");

    try {
      const isApproved = await (publicClient as any).readContract({
        address: CONTRACTS.NFT.address as `0x${string}`,
        abi: CONTRACTS.NFT.abi,
        functionName: 'isApprovedForAll',
        args: [state.walletAddress as `0x${string}`, CONTRACTS.MARKETPLACE.address as `0x${string}`],
      }) as boolean;

      if (!isApproved) {
        setOfferProgress("Waiting for marketplace approval signature");
        const approveTx = await writeContractAsync({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'setApprovalForAll',
          args: [CONTRACTS.MARKETPLACE.address as `0x${string}`, true],
        } as any);

        setOfferProgress("Approval transaction pending");
        const approvalReceipt = await (publicClient as any).waitForTransactionReceipt({ hash: approveTx });
        if (approvalReceipt.status !== "success") {
          throw new Error("Marketplace approval failed onchain.");
        }
      }

      setOfferProgress("Waiting for accept offer signature");
      const txHash = await writeContractAsync({
        address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
        abi: CONTRACTS.MARKETPLACE.abi,
        functionName: 'acceptOffer',
        args: [CONTRACTS.NFT.address as `0x${string}`, BigInt(card.tokenId), offer.offerer as `0x${string}`],
      } as any);

      setOfferProgress("Accept offer transaction pending");
      const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("Accept offer transaction failed onchain.");
      }

      const refreshedCard = await refreshCardFromOnchain();
      if (!refreshedCard || !refreshedCard.isListed) {
        patchCardInLatestState(card.tokenId, {
          owner: offer.offerer,
          isListed: false,
          price: undefined,
          listingId: undefined,
        });
      }
      await refreshLiveOwnership();
      await refreshOnchainOffers();

      const savedState = getSavedState();
      const newLog: ActivityLog = {
        id: "log_" + Date.now(),
        tokenId: card.tokenId,
        type: "buy",
        fromAddress: currentOwner,
        toAddress: offer.offerer,
        amount: offer.amount,
        txHash,
        timestamp: new Date().toISOString()
      };

      updateLocalState({
        ...savedState,
        logs: [newLog, ...savedState.logs]
      });
      showNotification("Offer accepted onchain. Ownership refreshed from contract.");
    } catch (err: any) {
      console.error("Accept offer failed:", err);
      showNotification(`Transaction declined or failed: ${err.message || err}`);
    } finally {
      setIsOfferActionPending(false);
      setOfferProgress("");
    }
  };

  // Buy listed card
  const handleBuyListedItem = async () => {
    if (!state.walletConnected || !state.walletAddress || !card) {
      showNotification("⚠️ Please connect your Web3 wallet first in the top bar!");
      return;
    }

    if (!isConnected) {
      showNotification("❌ Buy flow not connected yet");
      return;
    }

    if (!card.listingId) {
      showNotification("No active listing found.");
      return;
    }

    const price = card.price || 0;
    if (state.balance < price) {
      showNotification("❌ Insufficient balance to purchase this NFT!");
      return;
    }

    setIsPurchasing(true);
    setPurchaseStatus("📜 Awaiting core transaction signature approval in your wallet...");

    const seller = displayedOwner || card.owner;
    const buyer = state.walletAddress;
    let txHash: `0x${string}` | undefined;
    let refreshedCard: ArcaneNFT | undefined;

    try {
      if (isConnected) {
        // Real onchain purchase contract call
        txHash = await writeContractAsync({
          address: CONTRACTS.MARKETPLACE.address,
          abi: CONTRACTS.MARKETPLACE.abi,
          functionName: "buyItem",
          args: [BigInt(card.listingId)],
          value: parseEther(price.toString()),
        } as any);
        setPurchaseStatus("⏳ Transaction sent. Waiting for blockchain execution confirmation...");
        const buyReceipt = await (publicClient as any).waitForTransactionReceipt({ hash: txHash });
        if (buyReceipt.status !== "success") {
          throw new Error("Buy transaction failed onchain.");
        }
        const refreshedOnchainCards = await fetchOnchainCards();
        refreshedCard = refreshedOnchainCards.find(c => c.tokenId === card.tokenId);
      }

      const latestState = getSavedState();
      const updatedCards = latestState.cards.map(c => {
        if (c.tokenId === card.tokenId) {
          const isStillListed = refreshedCard?.isListed === true;
          return {
            ...c,
            owner: refreshedCard?.owner || buyer,
            isListed: isStillListed,
            price: isStillListed ? refreshedCard?.price : undefined,
            listingId: isStillListed ? refreshedCard?.listingId : undefined
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
        amount: price,
        txHash,
        timestamp: new Date().toISOString()
      };

      const updatedState = {
        ...latestState,
        cards: updatedCards,
        logs: [newLog, ...latestState.logs]
      };

      updateLocalState(updatedState);
      await refreshLiveOwnership();
      setState(getSavedState());
      showNotification(`🎉 Asset purchased! "${card.name}" has been transferred to your vault.`);
      setSelectedCardId(null);
      setCurrentView('profile');
    } catch (err: any) {
      console.error("Purchase failed:", err);
      showNotification(`❌ Transaction declined or execution failed: ${err.message || err}`);
    } finally {
      setIsPurchasing(false);
      setPurchaseStatus("");
    }
  };

  // Submit or edit onchain offer
  const handleSubmitBidOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.walletConnected || !state.walletAddress || !card) {
      showNotification("Please connect your Web3 wallet first.");
      return;
    }

    if (isOwnerLoading || !liveOwner) {
      showNotification("This NFT ownership changed onchain. Refreshing...");
      await refreshLiveOwnership();
      return;
    }

    if (liveOwner && liveOwner.toLowerCase() === state.walletAddress.toLowerCase()) {
      showNotification("You cannot make an escrow offer on an NFT you own.");
      return;
    }

    if (!/^\d+$/.test(card.tokenId)) {
      showNotification("Missing or invalid token ID. Offer action blocked.");
      return;
    }

    const offerVal = parseFloat(bidPrice);
    if (isNaN(offerVal) || offerVal <= 0) {
      showNotification("Enter a valid offer amount greater than 0 USDC.");
      return;
    }

    const userHadActiveOffer = !!activeUserOffer;
    setIsOfferActionPending(true);
    setOfferProgress("Waiting for offer signature");

    try {
      const txHash = await writeContractAsync({
        address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
        abi: CONTRACTS.MARKETPLACE.abi,
        functionName: 'makeOffer',
        args: [CONTRACTS.NFT.address as `0x${string}`, BigInt(card.tokenId)],
        value: parseEther(offerVal.toString()),
      } as any);

      setOfferProgress("Offer transaction pending");
      const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("Offer transaction failed onchain.");
      }

      await refreshOnchainOffers();
      const newLog: ActivityLog = {
        id: "log_" + Date.now(),
        tokenId: card.tokenId,
        type: 'offer',
        fromAddress: state.walletAddress,
        toAddress: displayedOwner || card.owner,
        amount: offerVal,
        txHash,
        timestamp: new Date().toISOString()
      };

      updateLocalState({
        ...state,
        logs: [newLog, ...state.logs]
      });
      setBidPrice("");
      showNotification(userHadActiveOffer ? "Offer updated onchain." : "Offer submitted onchain.");
    } catch (err: any) {
      console.error("Offer failed:", err);
      showNotification(`Transaction declined or failed: ${err.message || err}`);
    } finally {
      setIsOfferActionPending(false);
      setOfferProgress("");
    }
  };

  // Create Listing
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;

    const parsedPrice = parseFloat(listPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      showNotification("❌ Enter a valid listing price.");
      return;
    }

    if (!isConnected || !state.walletAddress) {
      showNotification("❌ Connect your wallet to create a real on-chain listing on Arc Testnet.");
      return;
    }

    if (ownerActionsDisabled || !isOwner) {
      showNotification("This NFT ownership changed onchain. Refreshing...");
      await refreshLiveOwnership();
      return;
    }

    setIsListing(true);
    setListingProgress("Running preflight checks");

    // Preflight check 1: Chain Verification
    const activeChainId = chainId || chain?.id;
    const expectedChainId = 5042002;

    try {
      if (activeChainId !== expectedChainId) {
        const errorMsg = `❌ Wrong Network! You are connected to Chain ID ${activeChainId || 'unknown'}, but Arc Testnet (${expectedChainId}) is required. Please switch networks in your wallet.`;
        showNotification(errorMsg);
        setIsListing(false);
        setListingProgress("");
        return;
      }

      // Preflight check 2: Bytecode Verification
      let nftBytecode = "";
      try {
        nftBytecode = await (publicClient as any).getBytecode({
          address: CONTRACTS.NFT.address as `0x${string}`,
        });
      } catch (err) {
        console.warn("Could not query NFT bytecode:", err);
      }
      let marketplaceBytecode = "";
      try {
        marketplaceBytecode = await (publicClient as any).getBytecode({
          address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
        });
      } catch (err) {
        console.warn("Could not query Marketplace bytecode:", err);
      }
      if (!nftBytecode || nftBytecode === "0x") {
        throw new Error("preflight_nft_bytecode_missing");
      }
      if (!marketplaceBytecode || marketplaceBytecode === "0x") {
        throw new Error("preflight_marketplace_bytecode_missing");
      }

      // Preflight check 3: Approval Function Availability check
      setListingProgress("Verifying approval standard");
      let isApproved = false;
      let approvalFuncSupported = false;

      try {
        isApproved = await (publicClient as any).readContract({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'isApprovedForAll',
          args: [state.walletAddress as `0x${string}`, CONTRACTS.MARKETPLACE.address as `0x${string}`],
        }) as boolean;
        approvalFuncSupported = true;
      } catch (checkErr: any) {
        console.error("NFT isApprovedForAll call failed/unsupported:", checkErr.message || checkErr);
      }

      if (!approvalFuncSupported) {
        throw new Error("preflight_approval_unsupported");
      }

      const connectedWallet = (address || state.walletAddress) as `0x${string}`;
      let onchainOwner = "";
      try {
        onchainOwner = await (publicClient as any).readContract({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'ownerOf',
          args: [BigInt(card.tokenId)],
        }) as string;
      } catch {
        markCardInvalidOnchain(card.tokenId);
        throw new Error("invalid_onchain_token_id");
      }

      if (onchainOwner.toLowerCase() !== connectedWallet.toLowerCase()) {
        throw new Error("connected_wallet_not_token_owner");
      }

      // 1. Check / Request approval if not already approved
      if (!isApproved) {
        setListingProgress("Waiting for approval tx");
        showNotification("📜 NFT Approval required. Please authorize the marketplace contract in your wallet...");
        
        const approveTx = await writeContractAsync({
          address: CONTRACTS.NFT.address as `0x${string}`,
          abi: CONTRACTS.NFT.abi,
          functionName: 'setApprovalForAll',
          args: [CONTRACTS.MARKETPLACE.address as `0x${string}`, true],
        } as any);

        setListingProgress("Approval transaction pending");
        const approvalReceipt = await (publicClient as any).waitForTransactionReceipt({ hash: approveTx });
        if (approvalReceipt.status !== "success") {
          throw new Error("Approval transaction failed onchain.");
        }
        setListingProgress("Approval confirmed");
        showNotification("⚡ Marketplace operator approved! Preparing for Listing transaction...");
      } else {
        setListingProgress("Approval confirmed");
      }

      // 2. Call marketplace listing transaction
      setListingProgress("Listing transaction pending");
      const priceInWei = parseEther(listPrice);

      const listTx = await writeContractAsync({
        address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
        abi: CONTRACTS.MARKETPLACE.abi,
        functionName: 'listItem',
        args: [
          CONTRACTS.NFT.address as `0x${string}`,
          BigInt(card.tokenId),
          priceInWei
        ],
      } as any);

      setListingProgress("Listing transaction pending");
      const listingReceipt = await (publicClient as any).waitForTransactionReceipt({ hash: listTx });
      if (listingReceipt.status !== "success") {
        throw new Error("Listing transaction failed onchain.");
      }

      setListingProgress("Listed successfully");

      // Verify active listing details directly on-chain if available
      let verifiedListingId = "";
      try {
        const listingIdHex = await (publicClient as any).readContract({
          address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
          abi: CONTRACTS.MARKETPLACE.abi,
          functionName: 'activeListings',
          args: [CONTRACTS.NFT.address as `0x${string}`, BigInt(card.tokenId)],
        });
        if (BigInt(listingIdHex as any) > 0n) {
          verifiedListingId = BigInt(listingIdHex as any).toString();
        }
      } catch (fErr) {
        console.warn("Could not fetch newly created listing ID:", fErr);
      }

      if (!verifiedListingId) {
        throw new Error("Listing was not found onchain after confirmation.");
      }

      // Only update local state once confirmed on-chain
      const updatedCards = state.cards.map(c => {
        if (c.tokenId === card.tokenId) {
          return {
            ...c,
            isListed: true,
            price: parsedPrice,
            listingId: verifiedListingId || undefined
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
        amount: parsedPrice,
        timestamp: new Date().toISOString()
      };

      updateLocalState({
        ...state,
        cards: updatedCards,
        logs: [newLog, ...state.logs]
      });

      setShowListInput(false);
      setListPrice("");
      showNotification(`🎉 Token #${card.tokenId} listed successfully on-chain!`);

    } catch (err: any) {
      console.error("NFT Onchain listing failed:", err);
      
      let errorDesc = err.message || err;
      if (errorDesc === "preflight_nft_bytecode_missing") {
        errorDesc = `NFT contract at ${CONTRACTS.NFT.address} is not active/deployed on chain ID ${activeChainId || "unknown"}.`;
      } else if (errorDesc === "preflight_marketplace_bytecode_missing") {
        errorDesc = `Marketplace contract at ${CONTRACTS.MARKETPLACE.address} is not active/deployed on chain ID ${activeChainId || "unknown"}.`;
      } else if (errorDesc === "invalid_onchain_token_id") {
        errorDesc = "This NFT does not exist onchain or has an invalid token ID.";
      } else if (errorDesc === "connected_wallet_not_token_owner") {
        errorDesc = "Connected wallet is not the onchain owner of this NFT.";
      } else if (errorDesc === "preflight_approval_unsupported" || errorDesc.includes("isApprovedForAll") || errorDesc.includes("0x")) {
        errorDesc = "NFT contract approval check failed. Contract address or ABI may be incorrect.";
      }

      showNotification(`❌ Listing failed: ${errorDesc}`);
    } finally {
      setIsListing(false);
      setListingProgress("");
    }
  };

  // Cancel Listing
  const handleDelistListing = async () => {
    if (!card) return;

    if (ownerActionsDisabled || !isOwner) {
      showNotification("This NFT ownership changed onchain. Refreshing...");
      await refreshLiveOwnership();
      return;
    }

    if (isConnected && state.walletAddress && card.listingId) {
      setIsListing(true);
      setListingProgress("Awaiting wallet cancellation...");
      try {
        const txHash = await writeContractAsync({
          address: CONTRACTS.MARKETPLACE.address as `0x${string}`,
          abi: CONTRACTS.MARKETPLACE.abi,
          functionName: 'cancelListing',
          args: [BigInt(card.listingId)],
        } as any);

        setListingProgress("Removing listing from blockchain...");
        await (publicClient as any).waitForTransactionReceipt({ hash: txHash });
        showNotification("🎉 Listing canceled on-chain successfully!");
      } catch (err: any) {
        console.error("Cancel listing tx failed:", err);
        showNotification(`❌ Delisting failed: ${err.message || err}`);
        setIsListing(false);
        setListingProgress("");
        return;
      }
    }

    const updatedCards = state.cards.map(c => {
      if (c.tokenId === card.tokenId) {
        return {
          ...c,
          isListed: false,
          price: undefined,
          listingId: undefined
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

    setIsListing(false);
    setListingProgress("");
    showNotification("🗑️ Canceled listing! Asset is now private.");
  };

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent text-white">
        <div className="text-center font-sans">
          <p className="text-white/40 mb-4 text-sm font-semibold uppercase tracking-widest font-mono">NFT Token Not Found</p>
          <button
            onClick={() => setCurrentView('marketplace')}
            className="px-6 py-3 rounded-xl bg-cyan-400 text-black font-black text-xs uppercase font-mono"
          >
            ➔ Browse Marketplace
          </button>
        </div>
      </div>
    );
  }

  const mappedRarity = card.attributes && card.attributes.find(attr => attr.trait_type.toLowerCase() === "rarity")?.value || "COMMON";

  return (
    <div className="relative min-h-screen pt-28 pb-24 bg-transparent text-white font-sans">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl bg-[#09090c] border border-cyan-500/35 text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-400 shadow-[0_15px_40px_rgba(6,182,212,0.15)] flex items-center gap-3 backdrop-blur-md"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction status loading overlay */}
      {isPurchasing && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex flex-col justify-center items-center z-50 p-6">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-6" />
          <p className="text-sm font-mono uppercase tracking-widest text-cyan-400 animate-pulse font-bold text-center">
            {purchaseStatus}
          </p>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 relative z-10 text-left">
        
        {/* Back Link Nav - Screen 4 styled */}
        <button
          onClick={() => {
            setSelectedCardId(null);
            setCurrentView('marketplace');
          }}
          className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#94a3b8] hover:text-white mb-10 transition-colors self-start cursor-pointer group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> All NFTs
        </button>

        {/* 2-Column layout Board */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* LEFT side: Widescreen Asset visual */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="relative aspect-square w-full rounded-[32px] overflow-hidden bg-black border border-white/10 p-2 select-none shadow-2xl">
              <div className="w-full h-full rounded-[24px] overflow-hidden bg-[#0c0c0d] relative">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Smart Pricing & Fee Breakdown Index Card */}
            <div className="bg-[#09090c] border border-white/5 rounded-3xl p-6 text-xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                <span className="text-white/40 font-semibold uppercase tracking-wider font-mono text-[9px]">Marketplace Status</span>
                <span className="font-bold text-cyan-400 font-mono text-[10px] uppercase">
                  {card.isListed ? "LISTED" : "NOT LISTED"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                <span className="text-white/40 font-semibold uppercase tracking-wider font-mono text-[9px]">Highest Offer</span>
                <span className="font-bold text-emerald-400 font-mono text-[10px] uppercase">
                  {highestOffer ? `${highestOffer.toFixed(2)} USDC` : "No offers"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                <span className="text-white/40 font-semibold uppercase tracking-wider font-mono text-[9px]">Offer Count</span>
                <span className="font-bold text-white font-mono text-[10px] uppercase">
                  {offerCount}
                </span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                <span className="text-white/40 font-semibold uppercase tracking-wider font-mono text-[9px]">Token ID</span>
                <span className="font-bold text-white font-mono">#{card.tokenId}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                <span className="text-white/40 font-semibold uppercase tracking-wider font-mono text-[9px]">Protocol Contract</span>
                <span className="font-semibold text-cyan-400 font-mono text-[10px] select-all truncate max-w-48">
                  {CONTRACTS.NFT.address}
                </span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                <span className="text-white/40 font-semibold uppercase tracking-wider font-mono text-[9px]">Creator Royalty</span>
                <span className="font-extrabold text-white font-mono">2.5%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40 font-semibold uppercase tracking-wider font-mono text-[9px]">Marketplace Fee</span>
                <span className="font-extrabold text-white font-[#fff] font-mono">2.5%</span>
              </div>

              {card.isListed && card.price !== undefined && (
                <div className="pt-2 border-t border-white/[0.04] mt-2">
                  <div className="text-[8px] font-mono uppercase tracking-widest text-cyan-400 font-bold mb-2">Purchase Split Estimate</div>
                  <div className="space-y-1.5 text-[10px] font-mono text-white/50">
                    <div className="flex justify-between">
                      <span>Seller Receives (95%):</span>
                      <span className="text-white">{(card.price * 0.95).toFixed(4)} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Creator Royalty (2.5%):</span>
                      <span className="text-white">{(card.price * 0.025).toFixed(4)} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Fee (2.5%):</span>
                      <span className="text-white">{(card.price * 0.025).toFixed(4)} USDC</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT side: description & interactive tools */}
          <div className="lg:col-span-7 flex flex-col gap-7">
            
            {/* Header metadata strings */}
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white font-display mb-3 leading-none">
                {card.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2 text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest mb-1 select-all">
                <div className="flex items-center gap-1">
                  <span className="text-white/40">Creator:</span>
                  <span className="text-cyan-400">{creatorAddressFormatted}</span>
                </div>
                <span className="text-white/20 select-none">•</span>
                <div className="flex items-center gap-1">
                  <span className="text-white/40">Owner:</span>
                  <span className="text-cyan-400">{ownerLabel}</span>
                </div>
                <span className="text-white/20 select-none">•</span>
                <div className="flex items-center gap-1 select-none">
                  <span className="text-white/40">Created:</span>
                  <span className="text-zinc-300">
                    {new Date(card.createdAt).toLocaleDateString(undefined, { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Glowing ledger certification badges */}
            <div className="bg-[#09090c] border border-[#22d3ee]/10 rounded-2xl px-5 py-4.5 text-xs flex items-center gap-3.5 shadow-[0_5px_15px_rgba(34,211,238,0.02)] select-none">
              <ShieldCheck className="text-cyan-400 animate-pulse shrink-0" size={24} />
              <div className="leading-relaxed">
                <p className="font-black text-white/90 uppercase tracking-wide text-[10px] font-mono">ARCANE SECURED LEDGER INDEX</p>
                <p className="text-[11px] text-white/40 mt-0.5 font-medium">This asset is fully audited and certified with genuine, immutable blockchain ownership.</p>
              </div>
            </div>

            {isOwnerLoading && (
              <div className="bg-cyan-950/20 border border-cyan-400/20 rounded-2xl px-5 py-3 text-xs text-cyan-300 font-mono font-bold uppercase tracking-wider">
                This NFT ownership changed onchain. Refreshing...
              </div>
            )}

            {ownerRefreshError && (
              <div className="bg-red-950/20 border border-red-500/20 rounded-2xl px-5 py-3 text-xs text-red-300 font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-3">
                <span>Owner could not be verified onchain.</span>
                <button
                  onClick={() => refreshLiveOwnership()}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase tracking-wider border border-white/10"
                >
                  Retry refresh
                </button>
              </div>
            )}

            {/* Description Paragraph */}
            <div className="border-t border-white/5 pt-5">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-black mb-2">Description</h3>
              <p className="text-sm text-white/50 leading-relaxed font-sans font-medium">
                {card.description}
              </p>
            </div>

            {/* Dynamic Attributes / Properties list */}
            {card.attributes && card.attributes.length > 0 && (
              <div className="border-t border-white/5 pt-5">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-black mb-3">Attributes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {card.attributes.map((attr, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-3 bg-[#09090c] border border-white/5 rounded-xl text-center flex flex-col justify-center"
                    >
                      <span className="text-[9px] font-mono uppercase tracking-widest font-black text-cyan-400">
                        {attr.trait_type}
                      </span>
                      <span className="text-xs text-white font-extrabold tracking-tight truncate mt-1">
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interaction State Widgets - MATCHING CORE FUNCTIONALITY */}
            <div className="border-t border-white/5 pt-6 mt-2">
              
              {isOwner ? (
                // 1. OWNER CONSOLE
                <div className="flex flex-col gap-6 bg-[#09090c] border border-white/5 rounded-3xl p-6 text-xs">
                  
                  {/* List / Delist trigger console */}
                  <div>
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] font-bold mb-4">Market Listing Console</h3>
                    
                    {card.isListed ? (
                      <div className="flex items-center justify-between bg-black/40 border border-white/5 p-4 rounded-xl">
                        <div>
                          <span className="block text-[8px] text-white/30 uppercase tracking-widest font-bold font-mono">Listed Price</span>
                          <span className="text-lg font-black font-sans text-cyan-400 tracking-wider mt-0.5 block leading-none">{card.price} USDC</span>
                        </div>
                        <button
                          onClick={handleDelistListing}
                          disabled={isListing || ownerActionsDisabled}
                          className={`px-5 py-3 rounded-xl bg-red-950/20 border border-red-500/20 hover:bg-red-900/30 text-red-400 text-xs font-mono font-bold uppercase transition-all cursor-pointer ${(isListing || ownerActionsDisabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Delist NFT
                        </button>
                      </div>
                    ) : (
                      <div>
                        {showListInput ? (
                          <form onSubmit={handleCreateListing} className="flex gap-2">
                            <div className="relative flex-grow">
                              <input
                                type="number"
                                min="0.0001"
                                step="any"
                                placeholder="0.00"
                                value={listPrice}
                                onChange={(e) => setListPrice(e.target.value)}
                                disabled={isListing || ownerActionsDisabled}
                                className="w-full bg-[#040404] border border-white/5 rounded-xl px-4 py-3.5 text-white font-bold font-mono text-xs focus:outline-none focus:border-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 font-bold text-[9px] font-mono">USDC</span>
                            </div>
                            <button
                              type="submit"
                              disabled={isListing || ownerActionsDisabled}
                              className={`px-5 py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs uppercase cursor-pointer shrink-0 ${(isListing || ownerActionsDisabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              List NFT
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => setShowListInput(true)}
                            disabled={isListing || ownerActionsDisabled}
                            className={`w-full py-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/15 text-white text-xs font-mono font-bold uppercase tracking-widest cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${(isListing || ownerActionsDisabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Tag size={13} /> List NFT
                          </button>
                        )}
                      </div>
                    )}
                    {isListing && (
                      <div className="mt-3 p-3 bg-cyan-950/20 border border-cyan-400/20 rounded-xl text-center flex items-center justify-center gap-2">
                        <RefreshCw size={12} className="animate-spin text-cyan-400 shrink-0" />
                        <span className="text-[10px] text-cyan-400 font-mono font-black uppercase tracking-wider">{listingProgress}</span>
                      </div>
                    )}

                    {/* Contract Configuration Report */}
                    <div className="mt-4 p-4 bg-black/60 border border-white/5 rounded-2xl space-y-2.5 font-mono text-[10px]">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5 select-none">
                        <span className="text-white/40 uppercase font-black tracking-widest text-[8px]">Arcane Contract Hub</span>
                        <span className="text-cyan-400 font-extrabold uppercase">Audit Report</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div>
                          <span className="text-white/30 block mb-0.5 text-[8px] uppercase">NFT Mint Address:</span> 
                          <span className="text-zinc-300 block break-all font-semibold select-all text-[9px]">{preflightLogs.nftMintAddress}</span>
                        </div>
                        <div>
                          <span className="text-white/30 block mb-0.5 text-[8px] uppercase">NFT Listing Address:</span> 
                          <span className="text-zinc-300 block break-all font-semibold select-all text-[9px]">{preflightLogs.nftListingAddress}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/[0.02] px-2 py-1.5 rounded-lg border border-white/5">
                          <span className="text-white/40 text-[9px]">NFT Bytecode:</span> 
                          <span className={preflightLogs.nftBytecodeExists ? "text-cyan-400 font-extrabold" : "text-amber-500 font-extrabold"}>
                            {preflightLogs.nftBytecodeExists === null ? "CHECKING..." : (preflightLogs.nftBytecodeExists ? "ACTIVE" : "INACTIVE/NOT DEPLOYED")}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-white/[0.03]">
                          <span className="text-white/30 block mb-0.5 text-[8px] uppercase">Marketplace Address:</span> 
                          <span className="text-zinc-300 block break-all font-semibold select-all text-[9px]">{preflightLogs.marketplaceAddress}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/[0.02] px-2 py-1.5 rounded-lg border border-white/5">
                          <span className="text-white/40 text-[9px]">Marketplace Bytecode:</span> 
                          <span className={preflightLogs.marketplaceBytecodeExists ? "text-cyan-400 font-extrabold" : "text-amber-500 font-extrabold"}>
                            {preflightLogs.marketplaceBytecodeExists === null ? "CHECKING..." : (preflightLogs.marketplaceBytecodeExists ? "ACTIVE" : "INACTIVE/NOT DEPLOYED")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-white/[0.02] px-2 py-1.5 rounded-lg border border-white/5">
                          <span className="text-white/40 text-[9px]">Connected Chain ID:</span> 
                          <span className="text-cyan-400 font-extrabold">{preflightLogs.connectedChainId || "DISCONNECTED"}</span>
                        </div>
                      </div>
                      
                      {!preflightLogs.isLoading && (
                        <div className="mt-2.5 p-2 bg-red-950/20 border border-red-500/20 rounded-xl text-red-400 text-[9px] font-semibold flex items-center gap-1.5 leading-relaxed">
                          ⚠️ {!preflightLogs.marketplaceBytecodeExists ? "Marketplace contract not deployed." : "Marketplace offline or inactive."} On-chain listing is currently disabled.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transfer Console */}
                  <div className="border-t border-white/[0.04] pt-5.5">
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] font-bold mb-3.5">Transfer Digital Ownership</h3>
                    <div className="flex gap-2.5">
                      <input
                        type="text"
                        placeholder="Recipient Hex Address (0x...)"
                        value={transferAddress}
                        onChange={(e) => setTransferAddress(e.target.value)}
                        disabled={ownerActionsDisabled}
                        className="w-full bg-[#040404] border border-white/5 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        onClick={handleTransfer}
                        disabled={ownerActionsDisabled}
                        className="px-5 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs font-mono uppercase shrink-0 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={12} /> Transfer
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                // 2. NON-OWNER INTERACTION
                <div className="bg-[#09090c] border border-white/5 rounded-3xl p-6 text-xs space-y-6">
                  
                  {card.isListed ? (
                    /* Purchase layout block */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="block text-[8px] font-mono tracking-widest uppercase text-white/30 font-black mb-1">CURRENT VALUATION</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-cyan-400 font-sans tracking-tight">
                            {card.price ? `${card.price.toFixed(2)} USDC` : "— USDC"}
                          </span>
                          {card.price && (
                            <span className="text-white/40 font-sans font-semibold">
                              ≈ ${(card.price * 1.0).toLocaleString()} USD
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleBuyListedItem}
                        className="px-8 py-4.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs sm:text-xs uppercase tracking-widest shadow-lg shadow-cyan-400/10 cursor-pointer text-center"
                      >
                        Buy Now
                      </button>
                    </div>
                  ) : (
                    /* Unlisted indicator card block */
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4.5 flex items-center justify-between select-none">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse animate-duration-1000" />
                        <div>
                          <span className="block text-[8px] font-mono font-bold uppercase tracking-widest text-[#94a3b8]/60">Marketplace Status</span>
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Not listed for sale</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono bg-[#ffffff]/[0.02] text-zinc-400 px-2.5 py-1 rounded-md border border-white/5 uppercase">No buy price set</span>
                    </div>
                  )}

                  {/* Escrow Offering form */}
                  <div className="border-t border-white/[0.04] pt-5.5">
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8] font-bold mb-3.5">
                      {hasActiveUserOffer
                        ? "Modify your active escrow offer"
                        : "Submit an escrow offer"}
                    </h3>
                    {activeUserOffer && (
                      <div className="mb-3 text-[10px] font-mono text-white/45 uppercase tracking-wider">
                        <span className="text-cyan-400 font-black">{activeUserOffer.amount.toFixed(4)} USDC</span>
                        <span className="block mt-1 normal-case tracking-normal text-white/35">Updating will replace your previous offer.</span>
                      </div>
                    )}
                    <form onSubmit={handleSubmitBidOffer} className="flex gap-2.5">
                      <div className="relative flex-grow">
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          placeholder="Place your offer price (USDC)..."
                          value={bidPrice}
                          onChange={(e) => setBidPrice(e.target.value)}
                          disabled={isOfferActionPending}
                          className="w-full bg-[#040404] border border-white/5 rounded-xl px-4 py-3.5 text-white font-bold font-mono text-xs focus:outline-none focus:border-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 font-black text-[9px] font-mono uppercase">USDC</span>
                      </div>
                      <button
                        type="submit"
                        disabled={isOfferActionPending}
                        className="px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-black text-xs font-mono uppercase shrink-0 cursor-pointer flex items-center gap-1.5 shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {hasActiveUserOffer
                          ? "Update Offer"
                          : "Make Offer"}
                      </button>
                    </form>
                    {overListPriceOfferWarning && (
                      <div className="mt-3 text-[10px] font-mono text-amber-300/80 uppercase tracking-wider">
                        {overListPriceOfferWarning}
                      </div>
                    )}
                    {isOfferActionPending && offerProgress && (
                      <div className="mt-3 p-3 bg-cyan-950/20 border border-cyan-400/20 rounded-xl text-center flex items-center justify-center gap-2">
                        <RefreshCw size={12} className="animate-spin text-cyan-400 shrink-0" />
                        <span className="text-[10px] text-cyan-400 font-mono font-black uppercase tracking-wider">{offerProgress}</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

            {/* Complete Offer History */}
            <div className="border-t border-white/5 pt-5">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-black mb-3">Offer History</h3>
              {cardOffers.length === 0 ? (
                <div className="py-8 bg-black/10 border border-white/5 border-dashed rounded-2xl text-center text-xs text-white/30 uppercase tracking-wider font-mono">
                  No offers placed yet
                </div>
              ) : (
                <div className="bg-[#09090c] border border-white/5 rounded-2xl p-4 divide-y divide-white/[0.04] text-xs font-mono text-left max-h-56 overflow-y-auto">
                  {cardOffers
                    .map((offer) => {
                      const isMyOffer = state.walletConnected && state.walletAddress.toLowerCase() === offer.offerer.toLowerCase();
                      const offererNameFormatted = offer.offerer.startsWith("0x") && offer.offerer.length > 10 
                        ? `${offer.offerer.substring(0, 6)}...${offer.offerer.substring(offer.offerer.length - 4)}`
                        : offer.offererName || "Collector";
                      return (
                        <div key={offer.offerId} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                          <div>
                            <div className="font-bold text-white uppercase text-[11px] leading-tight flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${offer.active ? 'bg-cyan-400' : 'bg-white/10'}`} />
                              by {offererNameFormatted} {isMyOffer && <span className="text-[10px] text-cyan-400 italic font-mono lowercase">(your offer)</span>}
                              {!offer.active && <span className="text-[9px] text-white/30 italic uppercase font-normal">(withdrawn)</span>}
                            </div>
                            <span className="text-[10px] text-white/30 font-medium block mt-0.5">Address: {offer.offerer.substring(0, 14)}...</span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`font-black text-sm block ${offer.active ? 'text-cyan-400' : 'text-white/20 line-through'}`}>{offer.amount.toFixed(2)} USDC</span>
                            {offer.active && (
                              isOwner ? (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleAcceptOffer(offer)}
                                    disabled={isOfferActionPending || ownerActionsDisabled}
                                    className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-[9px] font-black uppercase transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    disabled
                                    title="Reject is unavailable onchain. This contract only supports accepting an offer or waiting for the maker to cancel it."
                                    className="px-3 py-1.5 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400/40 text-[9px] font-black uppercase transition-all cursor-not-allowed"
                                  >
                                    Reject N/A
                                  </button>
                                </div>
                              ) : (
                                isMyOffer && (
                                  <button
                                    onClick={() => handleCancelOffer(offer)}
                                    disabled={isOfferActionPending}
                                    className="text-red-400 hover:text-red-350 p-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Withdraw Escrow Offer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Ledger Activity logs audit list */}
            <div className="border-t border-white/5 pt-5">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[#94a3b8] font-[#fafafa] font-black mb-3 flex items-center gap-2"><Activity size={14} /> LEDGER HISTORY</h3>
              {cardLogs.length === 0 ? (
                <div className="py-12 bg-black/10 border border-white/5 border-dashed rounded-2xl text-center text-xs text-white/30 uppercase tracking-wider font-mono">
                  No previous audit events loaded
                </div>
              ) : (
                <div className="bg-[#09090c] border border-white/5 rounded-2xl p-4 divide-y divide-white/[0.04] text-[11px] font-mono text-left max-h-56 overflow-y-auto">
                  {cardLogs.map((log) => {
                    const actionLabel = log.type === 'buy' ? 'PURCHASED' : log.type === 'list' ? 'LISTED' : log.type === 'offer' ? 'ESCROW OFFER' : log.type === 'mint' ? 'MINTED' : 'TRANSFER';
                    const actionColor = log.type === 'buy' ? 'text-cyan-400' : log.type === 'list' ? 'text-amber-400' : 'text-purple-400';
                    return (
                      <div key={log.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`font-black tracking-wider text-[10px] ${actionColor}`}>{actionLabel}</span>
                          </div>
                          <span className="text-[10px] text-white/30 font-medium font-sans">
                            {log.fromAddress.toLowerCase() === "0x0000000000000000000000000000000000000000" ? "Platform Mint Cert" : `${log.fromAddress.substring(0, 10)}...`}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-[#cbcbcb] text-xs block">{log.amount ? `${log.amount.toFixed(2)} USDC` : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
