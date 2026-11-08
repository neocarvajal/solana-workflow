use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{
    constants::*,
    error::VaultError,
    state::{PolicyInitialized, VaultPolicy},
};

#[derive(Accounts)]
#[instruction(workflow_id: String, workflow_hash: [u8; 32])]
pub struct InitializePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + VaultPolicy::INIT_SPACE,
        seeds = [POLICY_SEED, owner.key().as_ref(), workflow_hash.as_ref()],
        bump
    )]
    pub policy: Account<'info, VaultPolicy>,
    /// CHECK: Derived PDA. Created below as a zero-data system account.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref(), workflow_hash.as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_initialize_policy(
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
    require!(
        !workflow_id.is_empty() && workflow_id.len() <= MAX_WORKFLOW_ID_LEN,
        VaultError::InvalidWorkflowId
    );
    require!(
        workflow_hash == crate::workflow_hash(&workflow_id),
        VaultError::InvalidWorkflowHash
    );
    require!(
        destination != Pubkey::default(),
        VaultError::InvalidDestination
    );
    require!(
        asset_mint == Pubkey::default(),
        VaultError::UnsupportedAssetMint
    );
    require!(max_per_run > 0, VaultError::InvalidMaxPerRun);
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

    let vault_key = ctx.accounts.vault.key();
    require_keys_neq!(
        destination,
        vault_key,
        VaultError::InvalidVaultDestination
    );

    let vault_info = ctx.accounts.vault.to_account_info();
    require!(vault_info.data_is_empty(), VaultError::VaultAlreadyInitialized);
    require!(
        vault_info.owner == &system_program::ID || vault_info.lamports() == 0,
        VaultError::VaultAlreadyInitialized
    );

    let rent = Rent::get()?;
    let vault_bump = ctx.bumps.vault;
    let owner_key = ctx.accounts.owner.key();
    let vault_signer_seeds: &[&[u8]] = &[
        VAULT_SEED,
        owner_key.as_ref(),
        workflow_hash.as_ref(),
        &[vault_bump],
    ];

    // Accept a pre-funded PDA (someone may have sent it rent) instead of
    // failing initialization. Only the system program may own a valid empty
    // vault; any other owner is rejected above.
    if vault_info.lamports() == 0 {
        system_program::create_account(
            CpiContext::new_with_signer(
                system_program::ID,
                system_program::CreateAccount {
                    from: ctx.accounts.owner.to_account_info(),
                    to: vault_info,
                },
                &[vault_signer_seeds],
            ),
            rent.minimum_balance(0),
            0,
            &system_program::ID,
        )?;
    }

    let policy = &mut ctx.accounts.policy;
    policy.owner = ctx.accounts.owner.key();
    policy.workflow_id = workflow_id.clone();
    policy.workflow_hash = workflow_hash;
    policy.destination = destination;
    policy.asset_mint = asset_mint;
    policy.max_per_run = max_per_run;
    policy.max_total = max_total;
    policy.min_interval_seconds = min_interval_seconds;
    policy.total_spent = 0;
    policy.last_execution_at = 0;
    policy.expires_at = expires_at;
    policy.paused = false;
    policy.keeper = keeper;
    policy.vault_bump = vault_bump;
    policy.bump = ctx.bumps.policy;

    emit!(PolicyInitialized {
        owner: policy.owner,
        workflow_id: policy.workflow_id.clone(),
        vault: vault_key,
        destination,
        max_per_run,
        max_total,
        min_interval_seconds,
        expires_at,
    });

    Ok(())
}
