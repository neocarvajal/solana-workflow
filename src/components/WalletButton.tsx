import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "lucide-react";
import { shortAddr } from "@/lib/solana";

const WalletButton = () => {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const address = publicKey ? publicKey.toBase58() : null;

  const handleClick = () => {
    if (address) {
      disconnect();
    } else {
      setVisible(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className={`flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition-all duration-300 disabled:opacity-60 md:px-4 md:text-sm ${address
          ? "bg-muted text-primary border border-primary"
          : "bg-gradient-purple-cyan text-white"
        }`}
      aria-label={address ? "Desconectar wallet" : "Conectar wallet"}
    >
      <Wallet className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
      {connecting ? (
        "..."
      ) : address ? (
        shortAddr(address)
      ) : (
        <>
          <span className="sm:hidden">Conectar</span>
          <span className="hidden sm:inline">Conectar Wallet</span>
        </>
      )}
    </button>
  );
};

export default WalletButton;