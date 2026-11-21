use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    error::VaultError,
    state::{SplAutomatedTransfer, VaultPolicy},
};

#[derive(Accounts)]
pub struct ExecuteTransferSpl<'info> {
    #[account(
        mut,
        seeds = [POLICY_SEED, policy.owner.as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
    /// CHECK: Derived PDA. The only authority that can sign for automated transfers.
    #[account(
        seeds = [VAULT_SEED, policy.owner.as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    #[account(
        address = policy.asset_mint,
        constraint = policy.asset_mint != Pubkey::default() @ VaultError::UnsupportedAssetMint
    )]
    pub asset_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = vault
    )]
    pub vault_ata: Account<'info, TokenAccount>,
    /// CHECK: Must match policy.destination; checked in the handler.
    pub destination: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = destination
    )]
    pub destination_ata: Account<'info, TokenAccount>,
    pub crank: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_execute_transfer_spl(
    ctx: Context<ExecuteTransferSpl>,
    amount: u64,
) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    require!(amount > 0, VaultError::AmountZero);
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

    let workflow_id = policy.workflow_id.clone();
    let workflow_hash = policy.workflow_hash;
    let owner = policy.owner;
    let vault_bump = policy.vault_bump;
    let mint = ctx.accounts.asset_mint.key();
    let vault_signer_seeds: &[&[u8]] = &[
        VAULT_SEED,
        owner.as_ref(),
        workflow_hash.as_ref(),
        &[vault_bump],
    ];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault_ata.to_account_info(),
                mint: ctx.accounts.asset_mint.to_account_info(),
                to: ctx.accounts.destination_ata.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_signer_seeds],
        ),
        amount,
        ctx.accounts.asset_mint.decimals,
    )?;

    policy.total_spent = new_total;
    policy.last_execution_at = now;

    emit!(SplAutomatedTransfer {
        owner,
        workflow_id,
        destination: policy.destination,
        mint,
        amount,
        total_spent: policy.total_spent,
        executed_at: now,
    });

    Ok(())
}
