import React from "react";
import WalletButton from "./WalletButton";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from 'next/link';
import { Zap } from "lucide-react";
import Header from './Header';

const Navbar: React.FC = () => {
  const { connected } = useWallet();
  return (
    <header className="relative z-10 flex flex-wrap md:flex-nowrap items-center justify-between px-4 md:px-8 py-3 md:py-4 border-b border-border/10 shrink-0 bg-background/80 backdrop-blur-sm gap-y-3">
        <Link href="/" className="flex items-center gap-2 md:gap-3 group shrink-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-purple-cyan flex items-center justify-center group-hover:opacity-90 transition-opacity shrink-0">
            <Zap className="h-4 w-4 md:h-5 md:w-5 text-white" />
          </div>
          <span className="text-lg md:text-xl font-bold gradient-text whitespace-nowrap">Solana Workflow</span>
        </Link>
        
        {connected && (
          <div className="w-full md:w-auto order-last md:order-none overflow-x-auto pb-1 md:pb-0" style={{ scrollbarWidth: 'none' }}>
            <Header />
          </div>
        )}
        
        <nav className="flex items-center gap-3 md:gap-6 shrink-0">
          <Link href="/documentation" className="hidden sm:block text-sm font-medium text-foreground hover:underline">
            Documentación
          </Link>
          <WalletButton />
        </nav>
    </header>
  );
};

export default Navbar;
