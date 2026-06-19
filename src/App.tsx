import { useState, useEffect } from 'react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { MarketplaceView } from './components/MarketplaceView';
import { ProfileView } from './components/ProfileView';
import { CardDetailsView } from './components/CardDetailsView';
import { CreateView } from './components/CreateView';
import { ChatAIView } from './components/ChatAIView';
import { getSavedState, saveState, ROLE_CONFIGS } from './lib/mockData';
import { ActivityLog } from './types';
import { RITUAL_NETWORK } from './lib/config';
import { fetchOnchainCards, flagInvalidLocalCards } from './lib/onchain';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<"cards" | "forge">("cards");
  useEffect(() => {
    localStorage.removeItem('arcane_theme');
  }, []);

  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({
    address: address,
    chainId: RITUAL_NETWORK.id,
  });

  // Core wallet and mock storage states
  const [session, setSession] = useState(getSavedState());

  const showNotification = (msg: string) => {
    console.log("[Notification]", msg);
  };

  // Synchronise RainbowKit connection updates with local storage session nicely
  useEffect(() => {
    if (isConnected && address) {
      const realBalance = balanceData ? parseFloat((Number(balanceData.value) / 10 ** balanceData.decimals).toFixed(4)) : 1.5;
      setSession(prev => {
        const updated = {
          ...prev,
          walletConnected: true,
          walletAddress: address,
          balance: realBalance,
          discordUser: prev.discordUser || { name: "Arcane_Arbiter" }
        };
        saveState(updated);
        return updated;
      });
    } else {
      setSession(prev => {
        if (prev.walletConnected) {
          const updated = {
            ...prev,
            walletConnected: false,
            walletAddress: "",
            balance: 0
          };
          saveState(updated);
          return updated;
        }
        return prev;
      });
    }
  }, [isConnected, address, balanceData]);

  // Connect wallet manual fallback / handler triggers
  const handleConnectWallet = (realAddress?: string) => {
    const finalAddress = realAddress || "0x78FA" + Math.random().toString(16).substring(2, 10).toUpperCase() + "e995";
    const updated = {
      ...session,
      walletConnected: true,
      walletAddress: finalAddress,
      balance: balanceData ? parseFloat((Number(balanceData.value) / 10 ** balanceData.decimals).toFixed(4)) : 1.5,
      discordUser: session.discordUser || { name: "Arcane_Arbiter" }
    };
    setSession(updated);
    saveState(updated);
  };

  // Disconnect wallet
  const handleDisconnectWallet = () => {
    disconnect();
    const updated = {
      ...session,
      walletConnected: false,
      walletAddress: "",
      balance: 0
    };
    setSession(updated);
    saveState(updated);
  };

  // Trigger Faucet - since faucet is simulated for users who don't have core gas, we let them claim test tokens seamlessly if they want
  const handleTriggerFaucet = () => {
    const updated = {
      ...session,
      balance: parseFloat((session.balance + 1.0).toFixed(4))
    };
    setSession(updated);
    saveState(updated);
  };

  // Background poller for live block contract reads
  useEffect(() => {
    async function loadOnchain() {
      const onchainCards = await fetchOnchainCards();
      const currentState = getSavedState();
      const checkedLocalCards = await flagInvalidLocalCards(currentState.cards, onchainCards);
      const localCardsChanged = checkedLocalCards.some((card, index) =>
        card.invalidOnchain !== currentState.cards[index]?.invalidOnchain ||
        card.localOnly !== currentState.cards[index]?.localOnly ||
        card.isListed !== currentState.cards[index]?.isListed ||
        card.price !== currentState.cards[index]?.price ||
        card.listingId !== currentState.cards[index]?.listingId
      );

      if (onchainCards.length > 0 || localCardsChanged) {
        setSession(prev => {
          const localByTokenId = new Map(checkedLocalCards.map(card => [card.tokenId, card]));
          const enrichedOnchainCards = onchainCards.map(onchainCard => {
            const localCard = localByTokenId.get(onchainCard.tokenId);
            if (!localCard) return onchainCard;

            return {
              ...onchainCard,
              name: localCard.name || onchainCard.name,
              description: localCard.description || onchainCard.description,
              imageUrl: localCard.imageUrl || onchainCard.imageUrl,
              mediaType: localCard.mediaType || onchainCard.mediaType,
              royaltyPercent: localCard.royaltyPercent ?? onchainCard.royaltyPercent,
              attributes: (localCard.attributes || []).slice(0, 6),
              creator: localCard.creator || onchainCard.creator,
              createdAt: localCard.createdAt || onchainCard.createdAt,
              discordId: localCard.discordId || onchainCard.discordId,
              discordUsername: localCard.discordUsername || onchainCard.discordUsername,
              discordRole: localCard.discordRole || onchainCard.discordRole,
              avatar: localCard.avatar || onchainCard.avatar,
              traits: localCard.traits || onchainCard.traits,
            };
          });
          const nonOverlapMocks = checkedLocalCards.filter(mc => !onchainCards.some(oc => oc.tokenId === mc.tokenId));
          // Merge to keep simulated state and real state perfectly aligned
          const merged = [...enrichedOnchainCards, ...nonOverlapMocks];
          const updated = {
            ...prev,
            cards: merged
          };
          saveState(updated);
          return updated;
        });
      }
    }
    loadOnchain();
    const interval = setInterval(loadOnchain, 7000);
    return () => clearInterval(interval);
  }, []);

  // Periodic state refreshing watcher for nested states
  useEffect(() => {
    const interval = setInterval(() => {
      setSession(getSavedState());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen transition-colors duration-300 dark bg-[#050505] text-white selection:bg-purple-500/30 selection:text-white relative">
      {/* Background Ambience Accent */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#030304]">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[60%] bg-cyan-500/18 blur-[150px] rounded-full animate-pulse duration-[10s]" />
        <div className="absolute top-[25%] right-[-5%] w-[50%] h-[50%] bg-emerald-500/12 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/12 blur-[160px] rounded-full" />
        <div className="absolute bottom-[20%] left-[15%] w-[45%] h-[45%] bg-blue-600/8 blur-[130px] rounded-full" />
      </div>

      {/* Styled Navbar HUD */}
      <Navbar
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          setSelectedCardId(null);
        }}
        walletConnected={session.walletConnected}
        walletAddress={session.walletAddress}
        balance={session.balance}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onTriggerFaucet={handleTriggerFaucet}
        discordUser={session.discordUser}
        profileTab={profileTab}
        setProfileTab={setProfileTab}
      />

      {/* Primary Dynamic Route View container */}
      <div className="transition-all duration-300 relative z-10">
        {currentView === 'home' && (
          <HomeView
            setCurrentView={setCurrentView}
            setSelectedCardId={setSelectedCardId}
          />
        )}
        {currentView === 'marketplace' && (
          <MarketplaceView
            setCurrentView={setCurrentView}
            setSelectedCardId={setSelectedCardId}
          />
        )}
        {currentView === 'profile' && (
          <ProfileView
            setCurrentView={setCurrentView}
            setSelectedCardId={setSelectedCardId}
          />
        )}
        {currentView === 'create' && (
          <CreateView
            setCurrentView={setCurrentView}
            setSelectedCardId={setSelectedCardId}
          />
        )}
        {currentView === 'card-details' && selectedCardId && (
          <CardDetailsView
            cardId={selectedCardId}
            setCurrentView={setCurrentView}
            setSelectedCardId={setSelectedCardId}
          />
        )}
        {currentView === 'chat' && (
          <ChatAIView />
        )}
      </div>


    </div>
  );
}
