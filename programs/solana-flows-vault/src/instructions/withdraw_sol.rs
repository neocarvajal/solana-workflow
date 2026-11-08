use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{
    constants::*,
    error::VaultError,
    state::{SolWithdrawn, VaultPolicy},
};

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        has_one = owner,
        seeds = [POLICY_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
    /// CHECK: Derived PDA. Funds can only leave through the vault signer.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::AmountZero);

    let rent = Rent::get()?;
    let vault_lamports = ctx.accounts.vault.lamports();
    let remaining = vault_lamports
        .checked_sub(amount)
        .ok_or(VaultError::InsufficientVaultBalance)?;
    require!(
        remaining >= rent.minimum_balance(0),
        VaultError::RentExemptionViolation
    );

    let workflow_id = ctx.accounts.policy.workflow_id.clone();
    let workflow_hash = ctx.accounts.policy.workflow_hash;
    let vault_bump = ctx.accounts.policy.vault_bump;
    let owner_key = ctx.accounts.owner.key();
    let vault_signer_seeds: &[&[u8]] = &[
        VAULT_SEED,
        owner_key.as_ref(),
        workflow_hash.as_ref(),
        &[vault_bump],
    ];

    system_program::transfer(
        CpiContext::new_with_signer(
            system_program::ID,
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner.to_account_info(),
            },
            &[vault_signer_seeds],
        ),
        amount,
    )?;

    emit!(SolWithdrawn {
        owner: ctx.accounts.owner.key(),
        workflow_id,
        amount,
    });

    Ok(())
}
