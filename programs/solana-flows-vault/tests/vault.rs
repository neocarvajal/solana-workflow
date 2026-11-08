use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::{types::TransactionResult, LiteSVM},
    solana_clock::Clock,
    solana_flows_vault::{
        accounts, constants::POLICY_SEED, constants::VAULT_SEED, instruction,
        state::VaultPolicy, workflow_hash,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_rent::Rent,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const WORKFLOW_ID: &str = "wf-test";
const START_TS: i64 = 1_700_000_000;
const DEPOSIT: u64 = 5_000_000;

fn new_svm() -> (LiteSVM, Keypair) {
    let program_id = solana_flows_vault::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/solana_flows_vault.so"
    ));
    svm.add_program(program_id, bytes).unwrap();

    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 20_000_000_000).unwrap();

    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = START_TS;
    svm.set_sysvar(&clock);

    (svm, owner)
}

fn send(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    fee_payer: &Keypair,
    signers: &[&Keypair],
) -> TransactionResult {
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let message = Message::new_with_blockhash(ixs, Some(&fee_payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(message), signers).unwrap();
    svm.send_transaction(tx)
}

#[test]
fn initialize_accepts_prefunded_vault_pda() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();
    let workflow_id = "wf-prefunded";
    let vault_key = vault_pda(&owner.pubkey(), workflow_id);
    let rent = svm.get_sysvar::<Rent>().minimum_balance(0);

    let ix = system_instruction::transfer(&owner.pubkey(), &vault_key, rent);
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "prefunding the vault failed: {res:?}");
    assert_eq!(lamports(&svm, &vault_key), rent);

    let ix = initialize_ix(
        &owner,
        workflow_id,
        destination,
        Pubkey::default(),
        1_000_000,
        10_000_000,
        0,
        0,
        None,
    );
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "initialize failed: {res:?}");
    assert!(svm
        .get_account(&policy_pda(&owner.pubkey(), workflow_id))
        .is_some());
    assert_eq!(lamports(&svm, &vault_key), rent);
}

#[test]
fn initialize_rejects_hash_mismatch() {
    let (mut svm, owner) = new_svm();
    let workflow_id = "wf-hash";
    let mut bad_hash = workflow_hash(workflow_id);
    bad_hash[0] ^= 1;
    let ix = initialize_ix_with_hash(
        &owner,
        workflow_id,
        bad_hash,
        Pubkey::new_unique(),
        Pubkey::default(),
        1_000_000,
        10_000_000,
        0,
        0,
        None,
    );
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_err(), "mismatched hash should be rejected");
    assert!(svm
        .get_account(&policy_pda(&owner.pubkey(), workflow_id))
        .is_none());
}

#[test]
fn enforces_expiry() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();
    setup_policy(
        &mut svm,
        &owner,
        destination,
        1_000_000,
        10_000_000,
        0,
        START_TS + 60,
        None,
    );

    let execute = |svm: &mut LiteSVM| {
        send(
            svm,
            &[execute_ix(
                &owner,
                &owner.pubkey(),
                WORKFLOW_ID,
                destination,
                100_000,
            )],
            &owner,
            &[&owner],
        )
    };

    let res = execute(&mut svm);
    assert!(res.is_ok(), "transfer before expiry failed: {res:?}");

    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = START_TS + 61;
    svm.set_sysvar(&clock);

    let res = execute(&mut svm);
    assert!(res.is_err(), "expired policy should reject the transfer");
    assert_eq!(read_policy(&svm, policy_pda(&owner.pubkey(), WORKFLOW_ID)).total_spent, 100_000);
}

fn policy_pda(owner: &Pubkey, workflow_id: &str) -> Pubkey {
    let hash = workflow_hash(workflow_id);
    Pubkey::find_program_address(
        &[POLICY_SEED, owner.as_ref(), hash.as_ref()],
        &solana_flows_vault::id(),
    )
    .0
}

fn vault_pda(owner: &Pubkey, workflow_id: &str) -> Pubkey {
    let hash = workflow_hash(workflow_id);
    Pubkey::find_program_address(
        &[VAULT_SEED, owner.as_ref(), hash.as_ref()],
        &solana_flows_vault::id(),
    )
    .0
}

fn initialize_ix(
    owner: &Keypair,
    workflow_id: &str,
    destination: Pubkey,
    asset_mint: Pubkey,
    max_per_run: u64,
    max_total: u64,
    min_interval_seconds: i64,
    expires_at: i64,
    keeper: Option<Pubkey>,
) -> Instruction {
    initialize_ix_with_hash(
        owner,
        workflow_id,
        workflow_hash(workflow_id),
        destination,
        asset_mint,
        max_per_run,
        max_total,
        min_interval_seconds,
        expires_at,
        keeper,
    )
}

#[allow(clippy::too_many_arguments)]
fn initialize_ix_with_hash(
    owner: &Keypair,
    workflow_id: &str,
    hash: [u8; 32],
    destination: Pubkey,
    asset_mint: Pubkey,
    max_per_run: u64,
    max_total: u64,
    min_interval_seconds: i64,
    expires_at: i64,
    keeper: Option<Pubkey>,
) -> Instruction {
    let policy = Pubkey::find_program_address(
        &[POLICY_SEED, owner.pubkey().as_ref(), hash.as_ref()],
        &solana_flows_vault::id(),
    )
    .0;
    let vault = Pubkey::find_program_address(
        &[VAULT_SEED, owner.pubkey().as_ref(), hash.as_ref()],
        &solana_flows_vault::id(),
    )
    .0;
    Instruction::new_with_bytes(
        solana_flows_vault::id(),
        &instruction::InitializePolicy {
            workflow_id: workflow_id.to_string(),
            workflow_hash: hash,
            destination,
            asset_mint,
            max_per_run,
            max_total,
            min_interval_seconds,
            expires_at,
            keeper,
        }
        .data(),
        accounts::InitializePolicy {
            owner: owner.pubkey(),
            policy,
            vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn update_ix(
    owner: &Keypair,
    workflow_id: &str,
    destination: Pubkey,
    max_per_run: u64,
    max_total: u64,
    min_interval_seconds: i64,
    expires_at: i64,
    keeper: Option<Pubkey>,
) -> Instruction {
    Instruction::new_with_bytes(
        solana_flows_vault::id(),
        &instruction::UpdatePolicy {
            destination,
            max_per_run,
            max_total,
            min_interval_seconds,
            expires_at,
            keeper,
        }
        .data(),
        accounts::UpdatePolicy {
            owner: owner.pubkey(),
            policy: policy_pda(&owner.pubkey(), workflow_id),
        }
        .to_account_metas(None),
    )
}

fn set_paused_ix(owner: &Keypair, workflow_id: &str, paused: bool) -> Instruction {
    Instruction::new_with_bytes(
        solana_flows_vault::id(),
        &instruction::SetPaused { paused }.data(),
        accounts::SetPaused {
            owner: owner.pubkey(),
            policy: policy_pda(&owner.pubkey(), workflow_id),
        }
        .to_account_metas(None),
    )
}

fn deposit_ix(owner: &Keypair, workflow_id: &str, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        solana_flows_vault::id(),
        &instruction::DepositSol { amount }.data(),
        accounts::DepositSol {
            owner: owner.pubkey(),
            policy: policy_pda(&owner.pubkey(), workflow_id),
            vault: vault_pda(&owner.pubkey(), workflow_id),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn withdraw_ix(owner: &Keypair, workflow_id: &str, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        solana_flows_vault::id(),
        &instruction::WithdrawSol { amount }.data(),
        accounts::WithdrawSol {
            owner: owner.pubkey(),
            policy: policy_pda(&owner.pubkey(), workflow_id),
            vault: vault_pda(&owner.pubkey(), workflow_id),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn execute_ix(
    crank: &Keypair,
    owner: &Pubkey,
    workflow_id: &str,
    destination: Pubkey,
    amount: u64,
) -> Instruction {
    Instruction::new_with_bytes(
        solana_flows_vault::id(),
        &instruction::ExecuteTransferSol { amount }.data(),
        accounts::ExecuteTransferSol {
            policy: policy_pda(owner, workflow_id),
            vault: vault_pda(owner, workflow_id),
            destination,
            crank: crank.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn read_policy(svm: &LiteSVM, policy: Pubkey) -> VaultPolicy {
    let account = svm.get_account(&policy).unwrap();
    let mut data: &[u8] = &account.data;
    VaultPolicy::try_deserialize(&mut data).unwrap()
}

fn lamports(svm: &LiteSVM, key: &Pubkey) -> u64 {
    svm.get_account(key).map(|account| account.lamports).unwrap_or(0)
}

fn setup_policy(
    svm: &mut LiteSVM,
    owner: &Keypair,
    destination: Pubkey,
    max_per_run: u64,
    max_total: u64,
    min_interval_seconds: i64,
    expires_at: i64,
    keeper: Option<Pubkey>,
) {
    let ix = initialize_ix(
        owner,
        WORKFLOW_ID,
        destination,
        Pubkey::default(),
        max_per_run,
        max_total,
        min_interval_seconds,
        expires_at,
        keeper,
    );
    let res = send(svm, &[ix], owner, &[owner]);
    assert!(res.is_ok(), "initialize failed: {res:?}");
    let ix = deposit_ix(owner, WORKFLOW_ID, DEPOSIT);
    let res = send(svm, &[ix], owner, &[owner]);
    assert!(res.is_ok(), "deposit failed: {res:?}");
}

fn assert_still_zero(svm: &LiteSVM, owner: &Keypair) {
    let policy = read_policy(svm, policy_pda(&owner.pubkey(), WORKFLOW_ID));
    assert_eq!(policy.total_spent, 0);
}

#[test]
fn initializes_and_deposits() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();
    let policy_key = policy_pda(&owner.pubkey(), WORKFLOW_ID);
    let vault_key = vault_pda(&owner.pubkey(), WORKFLOW_ID);
    let rent = svm.get_sysvar::<Rent>().minimum_balance(0);

    let ix = initialize_ix(
        &owner,
        WORKFLOW_ID,
        destination,
        Pubkey::default(),
        1_000_000,
        10_000_000,
        0,
        0,
        None,
    );
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "initialize failed: {res:?}");

    let policy = read_policy(&svm, policy_key);
    assert_eq!(policy.owner, owner.pubkey());
    assert_eq!(policy.workflow_id, WORKFLOW_ID);
    assert_eq!(policy.workflow_hash, workflow_hash(WORKFLOW_ID));
    assert_eq!(policy.destination, destination);
    assert_eq!(policy.asset_mint, Pubkey::default());
    assert_eq!(policy.max_per_run, 1_000_000);
    assert_eq!(policy.max_total, 10_000_000);
    assert_eq!(policy.min_interval_seconds, 0);
    assert_eq!(policy.total_spent, 0);
    assert_eq!(policy.last_execution_at, 0);
    assert!(!policy.paused);
    assert_eq!(policy.keeper, None);
    assert_eq!(lamports(&svm, &vault_key), rent);

    let owner_before = lamports(&svm, &owner.pubkey());
    let ix = deposit_ix(&owner, WORKFLOW_ID, 2_000_000);
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "deposit failed: {res:?}");

    assert_eq!(lamports(&svm, &vault_key), rent + 2_000_000);
    assert!(lamports(&svm, &owner.pubkey()) < owner_before);
}

#[test]
fn enforces_per_run_and_lifetime_caps() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();
    let policy_key = policy_pda(&owner.pubkey(), WORKFLOW_ID);
    let vault_key = vault_pda(&owner.pubkey(), WORKFLOW_ID);
    setup_policy(
        &mut svm,
        &owner,
        destination,
        1_000_000,
        1_500_000,
        0,
        0,
        None,
    );

    let res = send(
        &mut svm,
        &[execute_ix(
            &owner,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            1_500_000,
        )],
        &owner,
        &[&owner],
    );
    assert!(res.is_err(), "per-run cap should reject the transfer");
    assert_still_zero(&svm, &owner);

    let res = send(
        &mut svm,
        &[execute_ix(
            &owner,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            1_000_000,
        )],
        &owner,
        &[&owner],
    );
    assert!(res.is_ok(), "first transfer failed: {res:?}");

    let policy = read_policy(&svm, policy_key);
    assert_eq!(policy.total_spent, 1_000_000);
    assert_eq!(policy.last_execution_at, START_TS);
    assert_eq!(lamports(&svm, &destination), 1_000_000);
    let vault_after_first = lamports(&svm, &vault_key);

    let res = send(
        &mut svm,
        &[execute_ix(
            &owner,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            600_000,
        )],
        &owner,
        &[&owner],
    );
    assert!(res.is_err(), "lifetime cap should reject the transfer");
    assert_eq!(read_policy(&svm, policy_key).total_spent, 1_000_000);
    assert_eq!(lamports(&svm, &vault_key), vault_after_first);

    let res = send(
        &mut svm,
        &[execute_ix(
            &owner,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            500_000,
        )],
        &owner,
        &[&owner],
    );
    assert!(res.is_ok(), "final capped transfer failed: {res:?}");
    assert_eq!(read_policy(&svm, policy_key).total_spent, 1_500_000);

    let res = send(
        &mut svm,
        &[execute_ix(
            &owner,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            1,
        )],
        &owner,
        &[&owner],
    );
    assert!(res.is_err(), "lifetime cap should stay exhausted");
}

#[test]
fn enforces_interval_and_pause() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();
    let policy_key = policy_pda(&owner.pubkey(), WORKFLOW_ID);
    setup_policy(&mut svm, &owner, destination, 1_000_000, 10_000_000, 3_600, 0, None);

    let execute = |svm: &mut LiteSVM, amount: u64| {
        send(
            svm,
            &[execute_ix(
                &owner,
                &owner.pubkey(),
                WORKFLOW_ID,
                destination,
                amount,
            )],
            &owner,
            &[&owner],
        )
    };

    let res = execute(&mut svm, 100_000);
    assert!(res.is_ok(), "first transfer failed: {res:?}");

    let res = execute(&mut svm, 100_000);
    assert!(res.is_err(), "interval should reject the second transfer");
    assert_eq!(read_policy(&svm, policy_key).total_spent, 100_000);

    let ix = set_paused_ix(&owner, WORKFLOW_ID, true);
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "pause failed: {res:?}");
    assert!(read_policy(&svm, policy_key).paused);

    let res = execute(&mut svm, 100_000);
    assert!(res.is_err(), "paused policy must reject the transfer");
    assert_eq!(read_policy(&svm, policy_key).total_spent, 100_000);

    let ix = set_paused_ix(&owner, WORKFLOW_ID, false);
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "unpause failed: {res:?}");

    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp += 3_600;
    svm.set_sysvar(&clock);

    let res = execute(&mut svm, 100_000);
    assert!(res.is_ok(), "transfer after interval failed: {res:?}");
    assert_eq!(read_policy(&svm, policy_key).total_spent, 200_000);
}

#[test]
fn enforces_keeper_and_destination() {
    let (mut svm, owner) = new_svm();
    let keeper = Keypair::new();
    svm.airdrop(&keeper.pubkey(), 1_000_000_000).unwrap();
    let destination = Pubkey::new_unique();
    let policy_key = policy_pda(&owner.pubkey(), WORKFLOW_ID);
    setup_policy(
        &mut svm,
        &owner,
        destination,
        1_000_000,
        10_000_000,
        0,
        0,
        Some(keeper.pubkey()),
    );

    let res = send(
        &mut svm,
        &[execute_ix(
            &owner,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            100_000,
        )],
        &owner,
        &[&owner],
    );
    assert!(res.is_err(), "wrong keeper should be rejected");
    assert_still_zero(&svm, &owner);

    let wrong_destination = Pubkey::new_unique();
    let res = send(
        &mut svm,
        &[execute_ix(
            &keeper,
            &owner.pubkey(),
            WORKFLOW_ID,
            wrong_destination,
            100_000,
        )],
        &keeper,
        &[&keeper],
    );
    assert!(res.is_err(), "wrong destination should be rejected");
    assert_still_zero(&svm, &owner);

    let res = send(
        &mut svm,
        &[execute_ix(
            &keeper,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            100_000,
        )],
        &keeper,
        &[&keeper],
    );
    assert!(res.is_ok(), "keeper transfer failed: {res:?}");
    assert_eq!(read_policy(&svm, policy_key).total_spent, 100_000);
    assert_eq!(lamports(&svm, &destination), 100_000);
}

#[test]
fn withdraw_preserves_rent_and_requires_owner() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();
    let vault_key = vault_pda(&owner.pubkey(), WORKFLOW_ID);
    setup_policy(&mut svm, &owner, destination, 1_000_000, 10_000_000, 0, 0, None);
    let rent = svm.get_sysvar::<Rent>().minimum_balance(0);
    let vault_before = lamports(&svm, &vault_key);
    assert_eq!(vault_before, rent + DEPOSIT);

    let stranger = Keypair::new();
    svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    let ix = withdraw_ix(&stranger, WORKFLOW_ID, 1_000);
    let res = send(&mut svm, &[ix], &stranger, &[&stranger]);
    assert!(res.is_err(), "non-owner withdrawal should fail");

    let ix = withdraw_ix(&owner, WORKFLOW_ID, DEPOSIT + 1);
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_err(), "withdrawal below rent exemption should fail");
    assert_eq!(lamports(&svm, &vault_key), vault_before);

    let ix = withdraw_ix(&owner, WORKFLOW_ID, DEPOSIT);
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "withdrawal failed: {res:?}");
    assert_eq!(lamports(&svm, &vault_key), rent);
}

#[test]
fn initialize_rejects_invalid_policies() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();

    let invalid_cases: [(&str, Pubkey, u64, u64, i64, i64); 5] = [
        ("wf-asset", destination, 1_000_000, 10_000_000, 0, 0),
        ("wf-total", destination, 2_000_000, 1_000_000, 0, 0),
        ("wf-expiry", destination, 1_000_000, 10_000_000, 0, START_TS - 1),
        ("wf-default", Pubkey::default(), 1_000_000, 10_000_000, 0, 0),
        ("wf-interval", destination, 1_000_000, 10_000_000, -1, 0),
    ];

    for (index, (workflow_id, destination, max_per_run, max_total, interval, expires)) in
        invalid_cases.iter().enumerate()
    {
        let asset_mint = if index == 0 {
            Pubkey::new_unique()
        } else {
            Pubkey::default()
        };
        let ix = initialize_ix(
            &owner,
            workflow_id,
            *destination,
            asset_mint,
            *max_per_run,
            *max_total,
            *interval,
            *expires,
            None,
        );
        let res = send(&mut svm, &[ix], &owner, &[&owner]);
        assert!(res.is_err(), "{workflow_id} should be rejected");
        assert!(svm
            .get_account(&policy_pda(&owner.pubkey(), workflow_id))
            .is_none());
    }

    let workflow_id = "wf-vault-destination";
    let ix = initialize_ix(
        &owner,
        workflow_id,
        vault_pda(&owner.pubkey(), workflow_id),
        Pubkey::default(),
        1_000_000,
        10_000_000,
        0,
        0,
        None,
    );
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_err(), "vault as destination should be rejected");

    let long_workflow_id = "x".repeat(65);
    for workflow_id in ["", long_workflow_id.as_str()] {
        let ix = initialize_ix(
            &owner,
            workflow_id,
            destination,
            Pubkey::default(),
            1_000_000,
            10_000_000,
            0,
            0,
            None,
        );
        let res = send(&mut svm, &[ix], &owner, &[&owner]);
        assert!(res.is_err(), "invalid workflow id should be rejected");
    }
}

#[test]
fn update_policy_is_owner_only_and_keeps_caps_consistent() {
    let (mut svm, owner) = new_svm();
    let destination = Pubkey::new_unique();
    let policy_key = policy_pda(&owner.pubkey(), WORKFLOW_ID);
    setup_policy(&mut svm, &owner, destination, 1_000_000, 3_000_000, 0, 0, None);

    let res = send(
        &mut svm,
        &[execute_ix(
            &owner,
            &owner.pubkey(),
            WORKFLOW_ID,
            destination,
            500_000,
        )],
        &owner,
        &[&owner],
    );
    assert!(res.is_ok(), "transfer before update failed: {res:?}");

    let new_destination = Pubkey::new_unique();
    let keeper = Pubkey::new_unique();
    let ix = update_ix(
        &owner,
        WORKFLOW_ID,
        new_destination,
        2_000_000,
        5_000_000,
        60,
        0,
        Some(keeper),
    );
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_ok(), "update failed: {res:?}");

    let policy = read_policy(&svm, policy_key);
    assert_eq!(policy.destination, new_destination);
    assert_eq!(policy.max_per_run, 2_000_000);
    assert_eq!(policy.max_total, 5_000_000);
    assert_eq!(policy.min_interval_seconds, 60);
    assert_eq!(policy.keeper, Some(keeper));
    assert_eq!(policy.total_spent, 500_000);

    let stranger = Keypair::new();
    svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    let ix = update_ix(
        &stranger,
        WORKFLOW_ID,
        new_destination,
        2_000_000,
        5_000_000,
        60,
        0,
        None,
    );
    let res = send(&mut svm, &[ix], &stranger, &[&stranger]);
    assert!(res.is_err(), "non-owner update should fail");

    let ix = update_ix(
        &owner,
        WORKFLOW_ID,
        new_destination,
        100_000,
        400_000,
        60,
        0,
        None,
    );
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_err(), "max_total below total_spent should fail");

    let ix = update_ix(
        &owner,
        WORKFLOW_ID,
        vault_pda(&owner.pubkey(), WORKFLOW_ID),
        2_000_000,
        5_000_000,
        60,
        0,
        None,
    );
    let res = send(&mut svm, &[ix], &owner, &[&owner]);
    assert!(res.is_err(), "vault as destination should fail");
}
