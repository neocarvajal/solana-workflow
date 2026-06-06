import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { getPhantom, shortAddr, SOLANA_CLUSTER } from "@/lib/solana";
import { toast } from "sonner";

const WalletButton = () => {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const p = getPhantom();
    if (!p) return;
    p.connect({ onlyIfTrusted: true }).then(
      (r) => setAddress(r.publicKey.toBase58()),
      () => {}
    );
    p.on("disconnect", () => setAddress(null));
    p.on("accountChanged", (pk: any) => setAddress(pk ? pk.toBase58() : null));
  }, []);

  const connect = async () => {
    const p = getPhantom();
    if (!p) {
      toast.error("Phantom wallet not found", {
        action: { label: "Install", onClick: () => window.open("https://phantom.app/", "_blank") },
      });
      return;
    }
    try {
      const r = await p.connect();
      setAddress(r.publicKey.toBase58());
      toast.success(`Connected on ${SOLANA_CLUSTER}`);
    } catch (e: any) {
      toast.error(e?.message || "Connection rejected");
    }
  };

  const disconnect = async () => {
    const p = getPhantom();
    await p?.disconnect();
    setAddress(null);
  };

  return (
    <button
      onClick={address ? disconnect : connect}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center gap-2 text-sm ${
        address
          ? "bg-muted text-primary border border-primary"
          : "bg-gradient-purple-cyan text-white"
      }`}
    >
      <Wallet className="h-4 w-4" />
      {address ? shortAddr(address) : "Connect Wallet"}
    </button>
  );
};

export default WalletButton;
