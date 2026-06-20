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
  const [onchainRefreshWarning, setOnchainRefreshWarning] = useState<string | null>(null);

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
    if (!realAddress) return;
    const updated = {
      ...session,
      walletConnected: true,
      walletAddress: realAddress,
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
      const onchainResult = await fetchOnchainCards();
      const onchainCards = onchainResult.cards;
      const currentState = getSavedState();
      const checkedLocalCards = await flagInvalidLocalCards(currentState.cards, onchainCards);
      const localCardsChanged = checkedLocalCards.some((card, index) =>
        card.invalidOnchain !== currentState.cards[index]?.invalidOnchain ||
        card.localOnly !== currentState.cards[index]?.localOnly ||
        card.isListed !== currentState.cards[index]?.isListed ||
        card.price !== currentState.cards[index]?.price ||
        card.listingId !== currentState.cards[index]?.listingId
      );

      const currentOnchainCards = currentState.cards.filter(card =>
        /^\d+$/.test(card.tokenId) && !card.localOnly && !card.invalidOnchain
      );
      const partialRefreshShrankCards = !onchainResult.complete && onchainCards.length < currentOnchainCards.length;
      const refreshWarning = "Some onchain data could not refresh. Showing last known state.";

      if (partialRefreshShrankCards) {
        setOnchainRefreshWarning(refreshWarning);
        if (onchainCards.length > 0) {
          setSession(prev => {
            const incomingByTokenId = new Map(onchainCards.map(card => [card.tokenId, card]));
            const updatedCards = prev.cards.map(card => {
              const onchainCard = incomingByTokenId.get(card.tokenId);
              if (!onchainCard) return card;

              return {
                ...card,
                ...onchainCard,
                name: card.name || onchainCard.name,
                description: card.description || onchainCard.description,
                imageUrl: card.imageUrl || onchainCard.imageUrl,
                mediaType: card.mediaType || onchainCard.mediaType,
                royaltyPercent: card.royaltyPercent ?? onchainCard.royaltyPercent,
                attributes: (card.attributes || onchainCard.attributes || []).slice(0, 6),
                creator: card.creator || onchainCard.creator,
                createdAt: card.createdAt || onchainCard.createdAt,
                discordId: card.discordId || onchainCard.discordId,
                discordUsername: card.discordUsername || onchainCard.discordUsername,
                discordRole: card.discordRole || onchainCard.discordRole,
                avatar: card.avatar || onchainCard.avatar,
                traits: card.traits || onchainCard.traits,
              };
            });
            const updated = {
              ...prev,
              cards: updatedCards
            };
            saveState(updated);
            return updated;
          });
        }
        return;
      }

      setOnchainRefreshWarning(onchainResult.complete ? null : refreshWarning);

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
          // Local storage may enrich metadata only. Ownership/listing presence comes from onchain cards.
          const merged = enrichedOnchainCards;
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
        {onchainRefreshWarning && (
          <div className="fixed top-24 right-4 z-50 max-w-sm rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-black/20 backdrop-blur">
            {onchainRefreshWarning}
          </div>
        )}
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
