import React from "react";
import WalletButton from "./WalletButton";
import NotificationCenter from "./NotificationCenter";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LayoutDashboard, Menu, Zap } from "lucide-react";
import Header from './Header';
import MobileWorkflowMenu from './MobileWorkflowMenu';

const Navbar: React.FC = () => {
  const { connected } = useWallet();
  const router = useRouter();
  const showMenu = router.pathname.startsWith('/dashboard');
  const showWorkflowBar = connected && router.pathname === '/dashboard';

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

        <Link
          href="/"
          className={`group min-h-10 min-w-0 items-center gap-2 md:gap-3 ${showWorkflowBar ? 'hidden md:flex' : 'flex'}`}
          aria-label="Solana Workflow"
        >
          <div className="w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-xl bg-gradient-purple-cyan flex items-center justify-center group-hover:opacity-90 transition-opacity">
            <Zap className="h-4 w-4 md:h-5 md:w-5 text-white" />
          </div>
          <span className="hidden text-base font-bold gradient-text truncate md:inline md:text-xl">Solana Workflow</span>
        </Link>
      </div>

      {showWorkflowBar && (
        <div className="flex min-w-0 flex-1 md:hidden">
          <MobileWorkflowMenu />
        </div>
      )}

      {connected && (
        <div className="hidden md:block md:w-auto overflow-x-auto no-scrollbar pb-0">
          <Header />
        </div>
      )}

      <nav className="flex items-center gap-2 sm:gap-3 md:gap-6 shrink-0">
        {!showMenu && (
          <Link
            href="/dashboard"
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted md:hidden"
            title="Ir al Dashboard sin crear un workflow nuevo"
            aria-label="Ir al Dashboard sin crear un workflow nuevo"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="hidden min-[380px]:inline">Dashboard</span>
          </Link>
        )}
        <NotificationCenter />
        <WalletButton />
      </nav>
    </header>
  );
};

export default Navbar;
