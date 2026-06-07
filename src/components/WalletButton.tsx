import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet } from "lucide-react";
import { shortAddr } from "@/lib/solana"; // Mantienes tu función de formateo

const WalletButton = () => {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  // Obtenemos la dirección en formato string si la wallet está conectada
  const address = publicKey ? publicKey.toBase58() : null;

  const handleClick = () => {
    if (address) {
      disconnect();
    } else {
      setVisible(true); // Abre el modal oficial con todas las wallets disponibles
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 text-sm ${address
          ? "bg-muted text-primary border border-primary"
          : "bg-gradient-purple-cyan text-white"
        }`}
    >
      <Wallet className="h-4 w-4" />
      {connecting ? "Conectando..." : address ? shortAddr(address) : "Conectar Wallet"}
    </button>
  );
};

export default WalletButton;