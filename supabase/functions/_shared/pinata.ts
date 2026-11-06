// Pinata limita el largo del nombre del grupo (50 caracteres). Una wallet
// base58 ocupa 43-44, así que usamos un prefijo corto + hash estable.
export async function walletGroupName(ownerWallet: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ownerWallet),
  );
  const hash = Array.from(new Uint8Array(digest))
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `solflows:${ownerWallet.slice(0, 12)}:${hash}`;
}
