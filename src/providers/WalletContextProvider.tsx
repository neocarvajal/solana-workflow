import React, { FC, ReactNode, useMemo } from "react";
import {
    ConnectionProvider as OriginalConnectionProvider,
    WalletProvider as OriginalWalletProvider
} from "@solana/wallet-adapter-react";

const ConnectionProvider = OriginalConnectionProvider as React.ComponentType<any>;
const WalletProvider = OriginalWalletProvider as React.ComponentType<any>;
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";

// Importar los estilos por defecto del modal de Solana
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
    children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
    // Puedes cambiar a 'mainnet-beta' o 'testnet' según lo necesites
    const network = WalletAdapterNetwork.Devnet;

    // Puedes usar una URL de RPC personalizada de QuickNode, Helius, Alchemy, etc.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    // Al dejar este array vacío, la librería detectará automáticamente 
    // cualquier wallet instalada en el navegador que use el "Wallet Standard" (Phantom, Solflare, Backpack, etc.)
    const wallets = useMemo(() => [], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};