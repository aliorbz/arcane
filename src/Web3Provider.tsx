import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { RITUAL_NETWORK } from './lib/config';

// Define the custom Ritual Network chain for rainbowkit & wagmi compatibility
const ritualChain = {
  id: RITUAL_NETWORK.id,
  name: RITUAL_NETWORK.name,
  nativeCurrency: RITUAL_NETWORK.nativeCurrency,
  rpcUrls: {
    default: { http: RITUAL_NETWORK.rpcUrls.default.http },
  },
  blockExplorers: {
    default: RITUAL_NETWORK.blockExplorers.default,
  },
};

const config = getDefaultConfig({
  appName: 'ARCANE',
  projectId: 'a26569ec983cb0f749961e6cbf7471a9', // public standard project ID
  chains: [ritualChain as any],
  transports: {
    [RITUAL_NETWORK.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#8b5cf6', // Indigo/Purple theme for ARCANE matching logo
          accentColorForeground: '#ffffff',
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
