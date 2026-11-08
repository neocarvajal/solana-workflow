use anchor_lang::prelude::*;

use crate::{
    constants::*,
    state::{PausedChanged, VaultPolicy},
};

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner,
        seeds = [POLICY_SEED, owner.key().as_ref(), policy.workflow_hash.as_ref()],
        bump = policy.bump
    )]
    pub policy: Account<'info, VaultPolicy>,
}

pub fn handle_set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    policy.paused = paused;

    emit!(PausedChanged {
        owner: policy.owner,
        workflow_id: policy.workflow_id.clone(),
        paused,
    });

    Ok(())
}
