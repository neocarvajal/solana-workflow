use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::{
    constants::*,
    error::VaultError,
    state::{SolDeposited, VaultPolicy},
};

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        has_one = owner,
        seeds = [POLICY_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
    /// CHECK: Derived PDA. Created during initialize_policy.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::AmountZero);

    system_program::transfer(
        CpiContext::new(
            system_program::ID,
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    emit!(SolDeposited {
        owner: ctx.accounts.owner.key(),
        workflow_id: ctx.accounts.policy.workflow_id.clone(),
        amount,
    });

    Ok(())
}
