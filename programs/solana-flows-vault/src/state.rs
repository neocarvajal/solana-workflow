use anchor_lang::prelude::*;

use crate::constants::MAX_WORKFLOW_ID_LEN;

#[account]
#[derive(InitSpace)]
pub struct VaultPolicy {
    /// Wallet that owns this policy and can withdraw or change the limits.
    pub owner: Pubkey,
    /// Stable off-chain workflow identity. Max 64 bytes.
    #[max_len(MAX_WORKFLOW_ID_LEN)]
    pub workflow_id: String,
    /// SHA-256 of workflow_id. This is the 32-byte PDA seed.
    pub workflow_hash: [u8; 32],
    /// The only address an automated transfer may pay.
    pub destination: Pubkey,
    /// Pubkey::default() for SOL. Non-default mints are reserved for the SPL rollout.
    pub asset_mint: Pubkey,
    /// Hard cap for a single automated execution, in lamports.
    pub max_per_run: u64,
    /// Lifetime automated spend cap, in lamports.
    pub max_total: u64,
    /// Minimum time between automated executions, in seconds.
    pub min_interval_seconds: i64,
    /// Monotonic counter updated only after a successful transfer.
    pub total_spent: u64,
    /// Unix timestamp of the last successful automated transfer.
    pub last_execution_at: i64,
    /// Unix timestamp after which automated execution is disabled. 0 = never.
    pub expires_at: i64,
    /// User kill switch. Pausing blocks automated execution immediately.
    pub paused: bool,
    /// Optional allowlisted crank. None means any signer may crank.
    pub keeper: Option<Pubkey>,
    /// Bump for the SOL vault PDA.
    pub vault_bump: u8,
    /// Bump for this policy PDA.
    pub bump: u8,
}

#[event]
pub struct PolicyInitialized {
    pub owner: Pubkey,
    pub workflow_id: String,
    pub vault: Pubkey,
    pub destination: Pubkey,
    pub max_per_run: u64,
    pub max_total: u64,
    pub min_interval_seconds: i64,
    pub expires_at: i64,
}

#[event]
pub struct PolicyUpdated {
    pub owner: Pubkey,
    pub workflow_id: String,
    pub destination: Pubkey,
    pub max_per_run: u64,
    pub max_total: u64,
    pub min_interval_seconds: i64,
    pub expires_at: i64,
    pub keeper: Option<Pubkey>,
}

#[event]
pub struct PausedChanged {
    pub owner: Pubkey,
    pub workflow_id: String,
    pub paused: bool,
}

#[event]
pub struct SolDeposited {
    pub owner: Pubkey,
    pub workflow_id: String,
    pub amount: u64,
}

#[event]
pub struct SolWithdrawn {
    pub owner: Pubkey,
    pub workflow_id: String,
    pub amount: u64,
}

#[event]
pub struct SolAutomatedTransfer {
    pub owner: Pubkey,
    pub workflow_id: String,
    pub destination: Pubkey,
    pub amount: u64,
    pub total_spent: u64,
    pub executed_at: i64,
}
