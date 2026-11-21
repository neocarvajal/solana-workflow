use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    error::VaultError,
    state::{SplDeposited, VaultPolicy},
};

#[derive(Accounts)]
pub struct DepositSpl<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        has_one = owner,
        seeds = [POLICY_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
    /// CHECK: Derived PDA created during initialize_policy.
    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    /// The mint bound to the policy. Anchor rejects any other mint account.
    #[account(
        address = policy.asset_mint,
        constraint = policy.asset_mint != Pubkey::default() @ VaultError::UnsupportedAssetMint
    )]
    pub asset_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = owner
    )]
    pub owner_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = vault
    )]
    pub vault_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::AmountZero);

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_ata.to_account_info(),
                mint: ctx.accounts.asset_mint.to_account_info(),
                to: ctx.accounts.vault_ata.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.asset_mint.decimals,
    )?;

    emit!(SplDeposited {
        owner: ctx.accounts.owner.key(),
        workflow_id: ctx.accounts.policy.workflow_id.clone(),
        mint: ctx.accounts.asset_mint.key(),
        amount,
    });

    Ok(())
}
