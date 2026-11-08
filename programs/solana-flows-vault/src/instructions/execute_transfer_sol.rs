use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{
    constants::*,
    error::VaultError,
    state::{SolAutomatedTransfer, VaultPolicy},
};

#[derive(Accounts)]
pub struct ExecuteTransferSol<'info> {
    #[account(
        mut,
        seeds = [POLICY_SEED, policy.owner.as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
    /// CHECK: Derived PDA. The only account that can sign for automated transfers.
    #[account(
        mut,
        seeds = [VAULT_SEED, policy.owner.as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: Must match policy.destination; checked in the handler.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,
    pub crank: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_execute_transfer_sol(
    ctx: Context<ExecuteTransferSol>,
    amount: u64,
) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    require!(amount > 0, VaultError::AmountZero);
    require!(
        policy.asset_mint == Pubkey::default(),
        VaultError::UnsupportedAssetMint
    );
    require!(!policy.paused, VaultError::PolicyPaused);
    require_keys_eq!(
        ctx.accounts.destination.key(),
        policy.destination,
        VaultError::InvalidDestination
    );

    if let Some(keeper) = policy.keeper {
        require_keys_eq!(
            ctx.accounts.crank.key(),
            keeper,
            VaultError::KeeperOnly
        );
    }

    let now = Clock::get()?.unix_timestamp;
    require!(
        policy.expires_at == 0 || now < policy.expires_at,
        VaultError::PolicyExpired
    );
    if policy.last_execution_at != 0 {
        let next_allowed = policy
            .last_execution_at
            .checked_add(policy.min_interval_seconds)
            .ok_or(VaultError::MathOverflow)?;
        require!(now >= next_allowed, VaultError::IntervalNotElapsed);
    }

    require!(
        amount <= policy.max_per_run,
        VaultError::AmountExceedsPerRun
    );
    let new_total = policy
        .total_spent
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;
    require!(new_total <= policy.max_total, VaultError::AmountExceedsTotal);

    let rent = Rent::get()?;
    let remaining = ctx
        .accounts
        .vault
        .lamports()
        .checked_sub(amount)
        .ok_or(VaultError::InsufficientVaultBalance)?;
    require!(
        remaining >= rent.minimum_balance(0),
        VaultError::RentExemptionViolation
    );

    let workflow_id = policy.workflow_id.clone();
    let workflow_hash = policy.workflow_hash;
    let owner = policy.owner;
    let vault_bump = policy.vault_bump;
    let vault_signer_seeds: &[&[u8]] = &[
        VAULT_SEED,
        owner.as_ref(),
        workflow_hash.as_ref(),
        &[vault_bump],
    ];

    system_program::transfer(
        CpiContext::new_with_signer(
            system_program::ID,
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
            },
            &[vault_signer_seeds],
        ),
        amount,
    )?;

    policy.total_spent = new_total;
    policy.last_execution_at = now;

    emit!(SolAutomatedTransfer {
        owner,
        workflow_id,
        destination: policy.destination,
        amount,
        total_spent: policy.total_spent,
        executed_at: now,
    });

    Ok(())
}
