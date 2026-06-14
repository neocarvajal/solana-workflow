import type { AppProps } from "next/app";
import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider as OriginalConnectionProvider,
  WalletProvider as OriginalWalletProvider
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import ThemeToggle from '@/components/ThemeToggle';
import { Toaster as Sonner } from "@/components/ui/sonner";
import dynamic from 'next/dynamic';

import "../App.css";
import "../index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

const Navbar = dynamic(() => import('@/components/Navbar'), { 
  ssr: false 
});
const ConnectionProvider = OriginalConnectionProvider as React.ComponentType<any>;
const WalletProvider = OriginalWalletProvider as React.ComponentType<any>;

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [], []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ThemeToggle />
              <div className="min-h-screen bg-background text-foreground antialiased">
                <Navbar />
                <Component {...pageProps} />
              </div>
            </TooltipProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}