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
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
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

  // Alchemy es el RPC por defecto; el RPC público queda como fallback.
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_ALCHEMY_HTTP_URL || clusterApiUrl(network),
    [network]
  );

  // Sin adaptadores el modal de wallets aparece vacío, sobre todo en móvil.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ThemeToggle />
              <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground antialiased supports-[height:100dvh]:h-[100dvh]">
                <Navbar />
                <div className="flex min-h-0 flex-1 flex-col">
                  <Component {...pageProps} />
                </div>
              </div>
            </TooltipProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
