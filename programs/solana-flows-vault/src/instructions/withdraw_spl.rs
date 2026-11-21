use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    error::VaultError,
    state::{SplWithdrawn, VaultPolicy},
};

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    pub owner: Signer<'info>,
    #[account(
        has_one = owner,
        seeds = [POLICY_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
    /// CHECK: Derived PDA. Tokens can only leave through the vault signer.
    #[account(
        seeds = [VAULT_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
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
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = owner
    )]
    pub owner_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::AmountZero);

    let workflow_id = ctx.accounts.policy.workflow_id.clone();
    let workflow_hash = ctx.accounts.policy.workflow_hash;
    let owner_key = ctx.accounts.owner.key();
    let vault_bump = ctx.accounts.policy.vault_bump;
    let vault_signer_seeds: &[&[u8]] = &[
        VAULT_SEED,
        owner_key.as_ref(),
        workflow_hash.as_ref(),
        &[vault_bump],
    ];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault_ata.to_account_info(),
                mint: ctx.accounts.asset_mint.to_account_info(),
                to: ctx.accounts.owner_ata.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_signer_seeds],
        ),
        amount,
        ctx.accounts.asset_mint.decimals,
    )?;

    emit!(SplWithdrawn {
        owner: owner_key,
        workflow_id,
        mint: ctx.accounts.asset_mint.key(),
        amount,
    });

    Ok(())
}
