pub mod constants;
pub mod error;
pub mod hash;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use hash::*;
pub use instructions::*;
pub use state::*;

declare_id!("dB4W6X19PphXLpSPZfe6ZjQkpBHpfHFDDeUddEGdqQA");

#[program]
pub mod solana_flows_vault {
    use super::*;

    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        workflow_id: String,
        workflow_hash: [u8; 32],
        destination: Pubkey,
        asset_mint: Pubkey,
        max_per_run: u64,
        max_total: u64,
        min_interval_seconds: i64,
        expires_at: i64,
        keeper: Option<Pubkey>,
    ) -> Result<()> {
        crate::instructions::initialize_policy::handle_initialize_policy(
            ctx,
            workflow_id,
            workflow_hash,
            destination,
            asset_mint,
            max_per_run,
            max_total,
            min_interval_seconds,
            expires_at,
            keeper,
        )
    }

    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        destination: Pubkey,
        max_per_run: u64,
        max_total: u64,
        min_interval_seconds: i64,
        expires_at: i64,
        keeper: Option<Pubkey>,
    ) -> Result<()> {
        crate::instructions::update_policy::handle_update_policy(
            ctx,
            destination,
            max_per_run,
            max_total,
            min_interval_seconds,
            expires_at,
            keeper,
        )
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        crate::instructions::set_paused::handle_set_paused(ctx, paused)
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        crate::instructions::deposit_sol::handle_deposit_sol(ctx, amount)
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        crate::instructions::withdraw_sol::handle_withdraw_sol(ctx, amount)
    }

    pub fn execute_transfer_sol(
        ctx: Context<ExecuteTransferSol>,
        amount: u64,
    ) -> Result<()> {
        crate::instructions::execute_transfer_sol::handle_execute_transfer_sol(ctx, amount)
    }
}
