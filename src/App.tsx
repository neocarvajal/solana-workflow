import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useMemo } from "react";

import {
  ConnectionProvider as OriginalConnectionProvider,
  WalletProvider as OriginalWalletProvider
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Documentation from "./pages/Documentation";
import Navbar from "./components/Navbar";
import Header from "./components/Header";
import WorkflowDashboard from "./pages/WorkflowDashboard";

// 1. Solución para el error de tipos de TypeScript
const ConnectionProvider = OriginalConnectionProvider as React.ComponentType<any>;
const WalletProvider = OriginalWalletProvider as React.ComponentType<any>;

const queryClient = new QueryClient();

const App = () => {
  // 2. Ahora sí, la lógica vive feliz dentro de las llaves del componente
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
              <BrowserRouter>
                <Navbar />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route
                    path="/dashboard"
                    element={
                      <>
                        <Header />
                        <Index />
                      </>
                    }
                  />
                  <Route path="/dashboard/workflows" element={<WorkflowDashboard />} />
                  <Route
                    path="/documentation"
                    element={
                      <>
                        <Documentation />
                      </>
                    }
                  />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
};

export default App;