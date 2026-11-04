import React from "react";
import WalletButton from "./WalletButton";
import NotificationCenter from "./NotificationCenter";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, Zap } from "lucide-react";
import Header from './Header';

const Navbar: React.FC = () => {
  const { connected } = useWallet();
  const router = useRouter();
  const showMenu = router.pathname.startsWith('/dashboard');

  return (
    <header className="relative z-10 flex flex-wrap md:flex-nowrap items-center justify-between px-3 sm:px-4 md:px-8 py-2.5 md:py-4 border-b border-border/10 shrink-0 bg-background/80 backdrop-blur-sm gap-y-3 pt-[calc(0.625rem+env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-1.5">
        {showMenu && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-mobile-nav'))}
            className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir navegación"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <Link href="/" className="group flex min-h-10 min-w-0 items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-xl bg-gradient-purple-cyan flex items-center justify-center group-hover:opacity-90 transition-opacity">
            <Zap className="h-4 w-4 md:h-5 md:w-5 text-white" />
          </div>
          <span className="text-base sm:text-lg md:text-xl font-bold gradient-text truncate">Solana Workflow</span>
        </Link>
      </div>

      {connected && (
        <div className="w-full md:w-auto order-last md:order-none overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <Header />
        </div>
      )}

      <nav className="flex items-center gap-2 sm:gap-3 md:gap-6 shrink-0">
        <Link href="/documentation" className="hidden min-h-10 items-center text-sm font-medium text-foreground hover:underline sm:flex">
          Documentación
        </Link>
        <NotificationCenter />
        <WalletButton />
      </nav>
    </header>
  );
};

export default Navbar;
