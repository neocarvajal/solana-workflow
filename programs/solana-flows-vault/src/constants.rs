use anchor_lang::prelude::*;

#[constant]
pub const POLICY_SEED: &[u8] = b"vault-policy";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Maximum byte length accepted for the off-chain workflow identity.
pub const MAX_WORKFLOW_ID_LEN: usize = 64;
