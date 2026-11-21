use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::VaultError,
    state::{PolicyUpdated, VaultPolicy},
};

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner,
        seeds = [POLICY_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
}

pub fn handle_update_policy(
    ctx: Context<UpdatePolicy>,
    destination: Pubkey,
    max_per_run: u64,
    max_total: u64,
    min_interval_seconds: i64,
    expires_at: i64,
    keeper: Option<Pubkey>,
    asset_mint: Pubkey,
) -> Result<()> {
    require!(
        destination != Pubkey::default(),
        VaultError::InvalidDestination
    );
    require!(max_per_run > 0, VaultError::InvalidMaxPerRun);
    require!(keeper.is_some(), VaultError::KeeperRequired);
    require!(
        max_total >= ctx.accounts.policy.total_spent,
        VaultError::InvalidMaxTotal
    );
    require!(max_total >= max_per_run, VaultError::InvalidMaxTotal);
    require!(
        min_interval_seconds >= 0,
        VaultError::InvalidInterval
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        expires_at == 0 || expires_at > now,
        VaultError::InvalidExpiry
    );

    let (vault_key, _) = Pubkey::find_program_address(
        &[
            VAULT_SEED,
            ctx.accounts.owner.key().as_ref(),
            ctx.accounts.policy.workflow_hash.as_ref(),
        ],
        ctx.program_id,
    );
    require_keys_neq!(
        destination,
        vault_key,
        VaultError::InvalidVaultDestination
    );

    let policy = &mut ctx.accounts.policy;
    // Switching assets changes the unit of every limit, so the spending
    // counters start over. Keeping them would silently mix lamports and token
    // base units under the same caps.
    if policy.asset_mint != asset_mint {
        policy.asset_mint = asset_mint;
        policy.total_spent = 0;
        policy.last_execution_at = 0;
    }
    policy.destination = destination;
    policy.max_per_run = max_per_run;
    policy.max_total = max_total;
    policy.min_interval_seconds = min_interval_seconds;
    policy.expires_at = expires_at;
    policy.keeper = keeper;

    emit!(PolicyUpdated {
        owner: policy.owner,
        workflow_id: policy.workflow_id.clone(),
        destination,
        max_per_run,
        max_total,
        min_interval_seconds,
        expires_at,
        keeper,
    });
    // The event keeps the historical layout; asset changes are visible in the
    // policy account itself and in the new SPL transfer events.

    Ok(())
}
