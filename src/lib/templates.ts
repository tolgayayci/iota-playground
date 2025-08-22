import { 
  Code2, 
  Coins, 
  ImageIcon, 
  Layers, 
  ShieldCheck, 
  KeyRound,
  Sparkles,
  Package,
  Users,
  Gamepad2,
  Zap,
  Shield 
} from 'lucide-react';

// Counter Contract Template
const COUNTER_CODE = `module counter::counter {
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;

    // Counter object that stores a number
    public struct Counter has key, store {
        id: UID,
        value: u64,
        owner: address,
    }

    // Initialize a new counter
    public fun create_counter(initial_value: u64, ctx: &mut TxContext) {
        let counter = Counter {
            id: object::new(ctx),
            value: initial_value,
            owner: tx_context::sender(ctx),
        };
        transfer::transfer(counter, tx_context::sender(ctx));
    }

    // Get the current value
    public fun get_value(counter: &Counter): u64 {
        counter.value
    }

    // Increment the counter
    public entry fun increment(counter: &mut Counter) {
        counter.value = counter.value + 1;
    }
    
    // Decrement the counter
    public entry fun decrement(counter: &mut Counter) {
        assert!(counter.value > 0, 0);
        counter.value = counter.value - 1;
    }
    
    // Set a specific value
    public entry fun set_value(counter: &mut Counter, new_value: u64) {
        counter.value = new_value;
    }
    
    // Multiply the counter value
    public entry fun multiply(counter: &mut Counter, multiplier: u64) {
        counter.value = counter.value * multiplier;
    }
}`;

// Fungible Token Template
const TOKEN_CODE = `module fungible_token::mycoin {
    use std::option;
    use iota::coin::{Self, Coin, TreasuryCap};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};

    // One-time witness for the coin
    public struct MYCOIN has drop {}

    // Initialize the coin with metadata
    fun init(witness: MYCOIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9, // Decimals
            b"MYC", // Symbol
            b"My Coin", // Name
            b"A custom fungible token on IOTA", // Description
            option::none(), // Icon URL
            ctx
        );
        
        // Make metadata immutable and share treasury
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, tx_context::sender(ctx));
    }

    // Mint new tokens (only treasury cap holder can mint)
    public fun mint(
        treasury_cap: &mut TreasuryCap<MYCOIN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    // Burn tokens
    public fun burn(treasury_cap: &mut TreasuryCap<MYCOIN>, coin: Coin<MYCOIN>) {
        coin::burn(treasury_cap, coin);
    }
    
    // Transfer tokens
    public fun transfer(coin: Coin<MYCOIN>, recipient: address) {
        transfer::public_transfer(coin, recipient);
    }
    
    // Split coins
    public fun split(
        coin: &mut Coin<MYCOIN>,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<MYCOIN> {
        coin::split(coin, amount, ctx)
    }
}`;

// NFT Collection Template
const NFT_CODE = `module nft_collection::digital_art {
    use std::string::{Self, String};
    use iota::object::{Self, ID, UID};
    use iota::event;
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use iota::url::{Self, Url};

    // NFT struct representing a digital artwork
    public struct DigitalArt has key, store {
        id: UID,
        name: String,
        description: String,
        url: Url,
        creator: address,
        edition: u64,
    }

    // Event emitted when NFT is minted
    public struct NFTMinted has copy, drop {
        object_id: ID,
        creator: address,
        name: String,
    }

    // Create a new NFT
    public fun mint_nft(
        name: vector<u8>,
        description: vector<u8>,
        url: vector<u8>,
        edition: u64,
        ctx: &mut TxContext
    ): DigitalArt {
        let sender = tx_context::sender(ctx);
        let nft = DigitalArt {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            url: url::new_unsafe_from_bytes(url),
            creator: sender,
            edition,
        };

        event::emit(NFTMinted {
            object_id: object::id(&nft),
            creator: sender,
            name: nft.name,
        });

        nft
    }

    // Transfer NFT to recipient
    public fun transfer(nft: DigitalArt, recipient: address) {
        transfer::public_transfer(nft, recipient);
    }

    // Get NFT details
    public fun get_name(nft: &DigitalArt): &String {
        &nft.name
    }

    public fun get_description(nft: &DigitalArt): &String {
        &nft.description
    }

    public fun get_creator(nft: &DigitalArt): address {
        nft.creator
    }
}`;

// Multi-signature Wallet Template
const MULTISIG_CODE = `module multisig::wallet {
    use std::vector;
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::coin::{Self, Coin};
    use iota::iota::IOTA;
    use iota::event;

    // Multi-signature wallet struct
    public struct MultiSigWallet has key {
        id: UID,
        owners: vector<address>,
        required_signatures: u64,
        balance: Coin<IOTA>,
        pending_txs: vector<Transaction>,
    }

    // Transaction proposal struct
    public struct Transaction has store, drop {
        to: address,
        amount: u64,
        signatures: vector<address>,
        executed: bool,
    }

    // Initialize wallet with owners and required signatures
    public fun create_wallet(
        owners: vector<address>,
        required: u64,
        initial_deposit: Coin<IOTA>,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&owners) >= required, 0);
        
        let wallet = MultiSigWallet {
            id: object::new(ctx),
            owners,
            required_signatures: required,
            balance: initial_deposit,
            pending_txs: vector::empty(),
        };
        
        transfer::share_object(wallet);
    }

    // Propose a new transaction
    public fun propose_transaction(
        wallet: &mut MultiSigWallet,
        to: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_owner(wallet, sender), 1);
        
        let tx = Transaction {
            to,
            amount,
            signatures: vector::singleton(sender),
            executed: false,
        };
        
        vector::push_back(&mut wallet.pending_txs, tx);
    }

    // Sign a pending transaction
    public fun sign_transaction(
        wallet: &mut MultiSigWallet,
        tx_index: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_owner(wallet, sender), 1);
        
        let tx = vector::borrow_mut(&mut wallet.pending_txs, tx_index);
        assert!(!tx.executed, 2);
        
        if (!vector::contains(&tx.signatures, &sender)) {
            vector::push_back(&mut tx.signatures, sender);
        }
    }

    // Check if address is owner
    fun is_owner(wallet: &MultiSigWallet, addr: address): bool {
        vector::contains(&wallet.owners, &addr)
    }
}`;

// Staking Contract Template
const STAKING_CODE = `module staking::pool {
    use iota::object::{Self, UID};
    use iota::coin::{Self, Coin};
    use iota::balance::{Self, Balance};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::clock::{Self, Clock};

    // Staking pool struct
    public struct StakingPool<phantom T> has key {
        id: UID,
        total_staked: Balance<T>,
        reward_per_sec: u64,
        last_reward_time: u64,
        acc_reward_per_share: u128,
    }

    // User stake info
    public struct StakeInfo<phantom T> has key, store {
        id: UID,
        amount: u64,
        reward_debt: u128,
        stake_time: u64,
    }

    // Create new staking pool
    public fun create_pool<T>(
        reward_per_sec: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let pool = StakingPool<T> {
            id: object::new(ctx),
            total_staked: balance::zero(),
            reward_per_sec,
            last_reward_time: clock::timestamp_ms(clock) / 1000,
            acc_reward_per_share: 0,
        };
        transfer::share_object(pool);
    }

    // Stake tokens
    public fun stake<T>(
        pool: &mut StakingPool<T>,
        coin: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): StakeInfo<T> {
        update_pool(pool, clock);
        
        let amount = coin::value(&coin);
        balance::join(&mut pool.total_staked, coin::into_balance(coin));
        
        StakeInfo<T> {
            id: object::new(ctx),
            amount,
            reward_debt: (amount as u128) * pool.acc_reward_per_share / 1_000_000_000,
            stake_time: clock::timestamp_ms(clock) / 1000,
        }
    }

    // Update pool rewards
    fun update_pool<T>(pool: &mut StakingPool<T>, clock: &Clock) {
        let current_time = clock::timestamp_ms(clock) / 1000;
        if (current_time <= pool.last_reward_time) return;
        
        let total_staked = balance::value(&pool.total_staked);
        if (total_staked == 0) {
            pool.last_reward_time = current_time;
            return
        };
        
        let time_elapsed = current_time - pool.last_reward_time;
        let reward = (time_elapsed * pool.reward_per_sec as u64);
        pool.acc_reward_per_share = pool.acc_reward_per_share + 
            (reward as u128) * 1_000_000_000 / (total_staked as u128);
        pool.last_reward_time = current_time;
    }
}`;

// Decentralized Exchange (DEX) Template
const DEX_CODE = `module dex::liquidity_pool {
    use iota::object::{Self, UID};
    use iota::coin::{Self, Coin};
    use iota::balance::{Self, Balance};
    use iota::math;
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::event;

    // Liquidity pool for token pair
    public struct LiquidityPool<phantom X, phantom Y> has key {
        id: UID,
        reserve_x: Balance<X>,
        reserve_y: Balance<Y>,
        lp_supply: u64,
        fee_percent: u64, // Basis points (e.g., 30 = 0.3%)
    }

    // LP token representing liquidity share
    public struct LPToken<phantom X, phantom Y> has key, store {
        id: UID,
        pool_id: ID,
        amount: u64,
    }

    // Swap event
    public struct SwapEvent has copy, drop {
        sender: address,
        amount_in: u64,
        amount_out: u64,
        is_x_to_y: bool,
    }

    // Create new liquidity pool
    public fun create_pool<X, Y>(
        coin_x: Coin<X>,
        coin_y: Coin<Y>,
        fee_percent: u64,
        ctx: &mut TxContext
    ) {
        assert!(fee_percent <= 1000, 0); // Max 10% fee
        
        let pool = LiquidityPool<X, Y> {
            id: object::new(ctx),
            reserve_x: coin::into_balance(coin_x),
            reserve_y: coin::into_balance(coin_y),
            lp_supply: 0,
            fee_percent,
        };
        
        transfer::share_object(pool);
    }

    // Swap X for Y
    public fun swap_x_to_y<X, Y>(
        pool: &mut LiquidityPool<X, Y>,
        coin_in: Coin<X>,
        min_out: u64,
        ctx: &mut TxContext
    ): Coin<Y> {
        let amount_in = coin::value(&coin_in);
        
        // Calculate output amount using constant product formula
        let reserve_x = balance::value(&pool.reserve_x);
        let reserve_y = balance::value(&pool.reserve_y);
        
        let amount_in_with_fee = amount_in * (10000 - pool.fee_percent) / 10000;
        let amount_out = (amount_in_with_fee * reserve_y) / 
                        (reserve_x + amount_in_with_fee);
        
        assert!(amount_out >= min_out, 1); // Slippage protection
        
        // Update reserves
        balance::join(&mut pool.reserve_x, coin::into_balance(coin_in));
        let coin_out = coin::take(&mut pool.reserve_y, amount_out, ctx);
        
        // Emit swap event
        event::emit(SwapEvent {
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out,
            is_x_to_y: true,
        });
        
        coin_out
    }
}`;

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  code: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'counter',
    name: 'Counter',
    description: 'A simple counter smart contract to learn Move basics',
    icon: Code2,
    code: COUNTER_CODE,
    difficulty: 'beginner',
    tags: ['beginner', 'state', 'basic']
  },
  {
    id: 'fungible-token',
    name: 'Fungible Token',
    description: 'Create your own cryptocurrency with the IOTA Move framework',
    icon: Coins,
    code: TOKEN_CODE,
    difficulty: 'beginner',
    tags: ['token', 'fungible', 'coin']
  },
  {
    id: 'nft-collection',
    name: 'NFT Collection',
    description: 'Build a digital art NFT collection with metadata',
    icon: ImageIcon,
    code: NFT_CODE,
    difficulty: 'intermediate',
    tags: ['nft', 'collectibles', 'art']
  },
  {
    id: 'multisig-wallet',
    name: 'Multi-Signature Wallet',
    description: 'Secure wallet requiring multiple signatures for transactions',
    icon: ShieldCheck,
    code: MULTISIG_CODE,
    difficulty: 'advanced',
    tags: ['wallet', 'security', 'multisig']
  },
  {
    id: 'staking-pool',
    name: 'Staking Pool',
    description: 'DeFi staking contract with reward distribution',
    icon: Layers,
    code: STAKING_CODE,
    difficulty: 'advanced',
    tags: ['defi', 'staking', 'rewards']
  },
  {
    id: 'dex-pool',
    name: 'DEX Liquidity Pool',
    description: 'Automated market maker for token swaps',
    icon: Zap,
    code: DEX_CODE,
    difficulty: 'advanced',
    tags: ['defi', 'dex', 'amm', 'swap']
  }
];

// Get template by ID
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find(template => template.id === id);
}

// Get templates by difficulty
export function getTemplatesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(template => template.difficulty === difficulty);
}

// Get templates by tag
export function getTemplatesByTag(tag: string): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(template => 
    template.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
  );
}