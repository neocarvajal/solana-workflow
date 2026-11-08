use solana_sha256_hasher::hash;

/// Solana limits each PDA seed to 32 bytes. Workflow ids can be longer (UUIDs
/// are 36 bytes), so the PDA seed is a SHA-256 digest of the full off-chain id.
pub fn workflow_hash(workflow_id: &str) -> [u8; 32] {
    hash(workflow_id.as_bytes()).to_bytes()
}
