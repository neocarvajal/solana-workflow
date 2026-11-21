import type { AppProps } from "next/app";
import Head from "next/head";
import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider as OriginalConnectionProvider,
  WalletProvider as OriginalWalletProvider
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import ThemeToggle from '@/components/ThemeToggle';
import { Toaster as Sonner } from "@/components/ui/sonner";
import dynamic from 'next/dynamic';
import { rpcUrlFor, useCluster } from "@/lib/network";

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
  // La dapp usa la red seleccionada en el indicador de conexión. La clave del
  // proveedor se re crea al cambiar de red para que todos los hooks vean el RPC nuevo.
  const cluster = useCluster();
  const endpoint = useMemo(() => rpcUrlFor(cluster), [cluster]);

  // Sin adaptadores el modal de wallets aparece vacío, sobre todo en móvil.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>Solana Workflow — Constructor de workflows con IA</title>
        <meta
          name="description"
          content="Describe tu flujo en lenguaje natural y conviértelo en un workflow visual editable en Solana."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <ConnectionProvider key={cluster} endpoint={endpoint}>
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
