import React from "react";
import WalletButton from "./WalletButton";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";


const Navbar: React.FC = () => {
  return (
    <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-border/10 shrink-0 bg-background/80 backdrop-blur-sm">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-purple-cyan flex items-center justify-center group-hover:opacity-90 transition-opacity">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold gradient-text">Solana Workflow</span>
      </Link>
      <nav className="flex items-center gap-6">
        <Link to="/documentation" className="text-sm font-medium text-foreground hover:underline">
          Documentación
        </Link>
        <WalletButton />
      </nav>
    </header>
  );
};

export default Navbar;
