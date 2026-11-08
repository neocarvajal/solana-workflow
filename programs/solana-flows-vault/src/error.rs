use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("The workflow id must be 1-64 bytes")]
    InvalidWorkflowId,
    #[msg("The supplied workflow hash does not match the workflow id")]
    InvalidWorkflowHash,
    #[msg("The destination cannot be the default pubkey")]
    InvalidDestination,
    #[msg("max_per_run must be greater than zero")]
    InvalidMaxPerRun,
    #[msg("max_total must cover max_per_run and the amount already spent")]
    InvalidMaxTotal,
    #[msg("min_interval_seconds cannot be negative")]
    InvalidInterval,
    #[msg("expires_at must be zero or in the future")]
    InvalidExpiry,
    #[msg("Only the policy owner can perform this action")]
    Unauthorized,
    #[msg("Only the configured keeper can execute this policy")]
    KeeperOnly,
    #[msg("The policy is paused")]
    PolicyPaused,
    #[msg("The policy has expired")]
    PolicyExpired,
    #[msg("The minimum execution interval has not elapsed")]
    IntervalNotElapsed,
    #[msg("The amount must be greater than zero")]
    AmountZero,
    #[msg("The amount exceeds max_per_run")]
    AmountExceedsPerRun,
    #[msg("The amount exceeds the remaining lifetime cap")]
    AmountExceedsTotal,
    #[msg("The vault does not have enough lamports for this transfer")]
    InsufficientVaultBalance,
    #[msg("The transfer would leave the vault below rent exemption")]
    RentExemptionViolation,
    #[msg("This deployment only supports SOL policies (asset_mint must be default)")]
    UnsupportedAssetMint,
    #[msg("The vault PDA is already initialized")]
    VaultAlreadyInitialized,
    #[msg("The destination cannot be the vault itself")]
    InvalidVaultDestination,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
