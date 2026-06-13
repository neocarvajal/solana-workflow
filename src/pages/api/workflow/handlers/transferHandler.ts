import { PublicKey, Transaction } from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  createTransferCheckedInstruction, 
  createAssociatedTokenAccountInstruction 
} from "@solana/spl-token";
import { connection } from "@/lib/solana";

const DEVNET_MINTS: Record<string, { mint: PublicKey; decimals: number }> = {
  USDC: { mint: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), decimals: 6 },
  JUP:  { mint: new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),  decimals: 6 },
  BONK: { mint: new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"), decimals: 5 },
};

export async function handleTransferAction(owner: string, params: Record<string, any>): Promise<string> {
  console.log("TRANSFER HANDLER PARAMS", JSON.stringify(params,null,2));
  const asset = params.asset?.toUpperCase();
  if (!asset || !params.to || !params.amount) {
    throw new Error("Faltan parámetros requeridos en el nodo de transferencia.");
  }

  if (asset === "SOL") {
    throw new Error("La simulación de SOL nativo requiere Wrapped SOL o ejecución vía Vault/PDA.");
  }

  const tokenConfig = DEVNET_MINTS[asset];
  if (!tokenConfig) throw new Error(`El token ${asset} no está soportado en Devnet.`);

  const ownerPk = new PublicKey(owner);
  const toPk = new PublicKey(params.to);
  const transaction = new Transaction();

  const sourceATA = await getAssociatedTokenAddress(tokenConfig.mint, ownerPk);
  const destinationATA = await getAssociatedTokenAddress(tokenConfig.mint, toPk);

  const destinationAccountInfo = await connection.getAccountInfo(destinationATA);
  if (!destinationAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(ownerPk, destinationATA, toPk, tokenConfig.mint)
    );
  }

  const rawAmount = parseFloat(params.amount) * Math.pow(10, tokenConfig.decimals);
  transaction.add(
    createTransferCheckedInstruction(sourceATA, tokenConfig.mint, destinationATA, ownerPk, rawAmount, tokenConfig.decimals)
  );

  transaction.feePayer = ownerPk;
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;

  return transaction.serialize({ requireAllSignatures: false }).toString("base64");
}