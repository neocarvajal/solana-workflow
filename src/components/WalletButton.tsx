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
      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm whitespace-nowrap shrink-0 ${address
          ? "bg-muted text-primary border border-primary"
          : "bg-gradient-purple-cyan text-white"
        }`}
    >
      <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
      {connecting ? "..." : address ? shortAddr(address) : "Conectar Wallet"}
    </button>
  );
};

export default WalletButton;