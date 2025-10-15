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

// Hello World Template - Basic greeting contract
const HELLO_WORLD_CODE = `module hello_world::greetings {
    use std::string::{Self, String};
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::event;

    /// A Greeting object that can be created and shared
    public struct Greeting has key, store {
        id: UID,
        message: String,
        creator: address,
    }

    /// Event emitted when a greeting is created
    public struct GreetingCreated has copy, drop {
        message: String,
        creator: address,
    }

    /// Create a new greeting with a custom message
    /// This is an entry function that can be called directly in a transaction
    public entry fun create_greeting(
        message: vector<u8>, 
        ctx: &mut TxContext
    ) {
        let greeting = Greeting {
            id: object::new(ctx),
            message: string::utf8(message),
            creator: tx_context::sender(ctx),
        };

        // Emit an event to notify that a greeting was created
        event::emit(GreetingCreated {
            message: greeting.message,
            creator: greeting.creator,
        });

        // Transfer the greeting object to the sender
        transfer::public_transfer(greeting, tx_context::sender(ctx));
    }

    /// Create and share a greeting that anyone can access
    public entry fun create_shared_greeting(
        message: vector<u8>,
        ctx: &mut TxContext
    ) {
        let greeting = Greeting {
            id: object::new(ctx),
            message: string::utf8(message),
            creator: tx_context::sender(ctx),
        };

        // Share the object so anyone can read it
        transfer::public_share_object(greeting);
    }

    /// Update the message of an owned greeting
    public entry fun update_message(
        greeting: &mut Greeting,
        new_message: vector<u8>,
        _ctx: &mut TxContext
    ) {
        greeting.message = string::utf8(new_message);
    }

    /// Get the message from a greeting (view function)
    public fun get_message(greeting: &Greeting): String {
        greeting.message
    }

    /// Get the creator address of a greeting
    public fun get_creator(greeting: &Greeting): address {
        greeting.creator
    }
}`;

// Counter Contract Template - State management example (Official IOTA Example)
const COUNTER_CODE = `module counter::counter {
    /// A shared counter that demonstrates basic shared object functionality.
    /// Rules:
    /// - Anyone can create and share a counter
    /// - Everyone can increment a counter by 1
    /// - The owner of the counter can reset it to any value

    /// A shared counter object
    public struct Counter has key {
        id: UID,
        owner: address,
        value: u64
    }

    /// Get the counter owner
    public fun owner(counter: &Counter): address {
        counter.owner
    }

    /// Get the counter value
    public fun value(counter: &Counter): u64 {
        counter.value
    }

    /// Create and share a Counter object with initial value 0
    public entry fun create(ctx: &mut TxContext) {
        transfer::share_object(Counter {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            value: 0
        })
    }

    /// Increment the counter by 1 (anyone can call this)
    public entry fun increment(counter: &mut Counter) {
        counter.value = counter.value + 1;
    }

    /// Set value to a specific number (only owner can call this)
    public entry fun set_value(counter: &mut Counter, value: u64, ctx: &TxContext) {
        assert!(counter.owner == tx_context::sender(ctx), 0);
        counter.value = value;
    }

    /// Assert a specific value for the counter (for testing)
    public fun assert_value(counter: &Counter, value: u64) {
        assert!(counter.value == value, 0)
    }

    /// Delete the counter (only owner can call this)
    public entry fun delete(counter: Counter, ctx: &TxContext) {
        assert!(counter.owner == tx_context::sender(ctx), 0);
        let Counter { id, owner: _, value: _ } = counter;
        object::delete(id);
    }
}`;

// Coffee Shop Template - Official IOTA Documentation Example
const COFFEE_CODE = `module coffee_shop::coffee {
    use std::option;
    use iota::tx_context::{Self, sender};
    use iota::coin::{Self, TreasuryCap, Coin};
    use iota::balance::{Self, Balance};
    use iota::token::{Self, Token};
    use iota::iota::IOTA;

    /// Error codes
    const EIncorrectAmount: u64 = 0;
    const ENotEnoughPoints: u64 = 1;

    /// Price per coffee: 10 IOTA
    const COFFEE_PRICE: u64 = 10_000_000_000;

    /// One-Time Witness for the COFFEE token
    public struct COFFEE has drop {}

    /// The Coffee Shop that holds coffee points treasury and IOTA balance
    public struct CoffeeShop has key {
        id: UID,
        coffee_points: TreasuryCap<COFFEE>,
        balance: Balance<IOTA>,
    }

    /// Initialize the coffee shop with token creation
    fun init(otw: COFFEE, ctx: &mut TxContext) {
        // Create COFFEE point token
        let (coffee_points, metadata) = coin::create_currency(
            otw,
            0, // 0 decimals for coffee points
            b"COFFEE",
            b"Coffee Point",
            b"Buy 4 coffees and get 1 free",
            option::none(),
            ctx
        );

        // Freeze the metadata
        transfer::public_freeze_object(metadata);

        // Create and share the coffee shop
        transfer::share_object(CoffeeShop {
            id: object::new(ctx),
            coffee_points,
            balance: balance::zero(),
        });
    }

    /// Buy a coffee with IOTA and receive a coffee point token
    public fun buy_coffee(
        app: &mut CoffeeShop,
        payment: Coin<IOTA>,
        ctx: &mut TxContext
    ) {
        // Check payment amount
        assert!(coin::value(&payment) >= COFFEE_PRICE, EIncorrectAmount);

        // Mint a coffee point token
        let coffee_token = token::mint(&mut app.coffee_points, 1, ctx);

        // Transfer the token to the buyer
        let request = token::transfer(coffee_token, sender(ctx), ctx);
        token::confirm_with_treasury_cap(&mut app.coffee_points, request, ctx);

        // Add payment to shop balance
        coin::put(&mut app.balance, payment);
    }

    /// Claim a free coffee by spending 4 coffee points
    public fun claim_coffee(
        app: &mut CoffeeShop,
        points: Token<COFFEE>,
        ctx: &mut TxContext
    ) {
        // Burn 4 coffee points
        assert!(token::value(&points) >= 4, ENotEnoughPoints);
        token::burn(&mut app.coffee_points, points);

        // Mint 1 new coffee point as reward
        let coffee_token = token::mint(&mut app.coffee_points, 1, ctx);
        let request = token::transfer(coffee_token, sender(ctx), ctx);
        token::confirm_with_treasury_cap(&mut app.coffee_points, request, ctx);
    }

    /// Get the shop's IOTA balance
    public fun get_balance(app: &CoffeeShop): u64 {
        balance::value(&app.balance)
    }
}`;

// Simple NFT Template - Non-fungible token with collection support
const NFT_CODE = `module simple_nft::artwork {
    use std::string::{Self, String};
    use std::vector;
    use iota::object::{Self, ID, UID};
    use iota::event;
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use iota::url::{Self, Url};
    use iota::display;
    use iota::package;

    /// Error codes
    const ENotCreator: u64 = 0;
    const EInvalidRoyalty: u64 = 1;
    const ECollectionFull: u64 = 2;

    /// One-time witness for display
    public struct ARTWORK has drop {}

    /// NFT Collection that tracks all minted NFTs
    public struct Collection has key {
        id: UID,
        name: String,
        description: String,
        creator: address,
        max_supply: u64,
        current_supply: u64,
        royalty_percentage: u64, // Basis points (100 = 1%)
        minted_nfts: vector<ID>,
    }

    /// Individual NFT artwork
    public struct Artwork has key, store {
        id: UID,
        collection_id: ID,
        name: String,
        description: String,
        url: Url,
        creator: address,
        edition_number: u64,
        attributes: vector<Attribute>,
    }

    /// NFT attributes for metadata
    public struct Attribute has store, drop, copy {
        key: String,
        value: String,
    }

    /// Event emitted when NFT is minted
    public struct NFTMinted has copy, drop {
        nft_id: ID,
        collection_id: ID,
        creator: address,
        owner: address,
        name: String,
        edition: u64,
    }

    /// Event emitted when NFT is transferred
    public struct NFTTransferred has copy, drop {
        nft_id: ID,
        from: address,
        to: address,
    }

    /// Initialize display for NFTs
    fun init(witness: ARTWORK, ctx: &mut TxContext) {
        // Create display template for NFTs
        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"creator"),
            string::utf8(b"edition"),
        ];

        let values = vector[
            string::utf8(b"{name}"),
            string::utf8(b"{description}"),
            string::utf8(b"{url}"),
            string::utf8(b"{creator}"),
            string::utf8(b"{edition_number}"),
        ];

        let publisher = package::claim(witness, ctx);
        let display = display::new_with_fields<Artwork>(
            &publisher,
            keys,
            values,
            ctx
        );

        // Commit display and transfer publisher
        display::update_version(&mut display);
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }

    /// Create a new NFT collection
    public entry fun create_collection(
        name: vector<u8>,
        description: vector<u8>,
        max_supply: u64,
        royalty_percentage: u64,
        ctx: &mut TxContext
    ) {
        // Validate royalty (max 10%)
        assert!(royalty_percentage <= 1000, EInvalidRoyalty);

        let collection = Collection {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            creator: tx_context::sender(ctx),
            max_supply,
            current_supply: 0,
            royalty_percentage,
            minted_nfts: vector::empty(),
        };

        // Share the collection so it can be accessed by anyone
        transfer::share_object(collection);
    }

    /// Mint a new NFT in the collection
    public entry fun mint_nft(
        collection: &mut Collection,
        name: vector<u8>,
        description: vector<u8>,
        url: vector<u8>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        // Only creator can mint
        assert!(collection.creator == tx_context::sender(ctx), ENotCreator);
        
        // Check max supply
        assert!(collection.current_supply < collection.max_supply, ECollectionFull);

        // Increment supply and get edition number
        collection.current_supply = collection.current_supply + 1;
        let edition = collection.current_supply;

        // Create the NFT
        let nft = Artwork {
            id: object::new(ctx),
            collection_id: object::id(collection),
            name: string::utf8(name),
            description: string::utf8(description),
            url: url::new_unsafe_from_bytes(url),
            creator: collection.creator,
            edition_number: edition,
            attributes: vector::empty(),
        };

        // Track NFT in collection
        let nft_id = object::id(&nft);
        vector::push_back(&mut collection.minted_nfts, nft_id);

        // Emit minting event
        event::emit(NFTMinted {
            nft_id,
            collection_id: object::id(collection),
            creator: collection.creator,
            owner: recipient,
            name: nft.name,
            edition,
        });

        // Transfer to recipient
        transfer::public_transfer(nft, recipient);
    }

    /// Add attributes to an NFT (only by creator)
    public entry fun add_attributes(
        nft: &mut Artwork,
        keys: vector<vector<u8>>,
        values: vector<vector<u8>>,
        ctx: &mut TxContext
    ) {
        // Only creator can add attributes
        assert!(nft.creator == tx_context::sender(ctx), ENotCreator);

        let i = 0;
        let len = vector::length(&keys);
        while (i < len) {
            let attribute = Attribute {
                key: string::utf8(*vector::borrow(&keys, i)),
                value: string::utf8(*vector::borrow(&values, i)),
            };
            vector::push_back(&mut nft.attributes, attribute);
            i = i + 1;
        }
    }

    /// Transfer NFT with event emission
    public entry fun transfer_nft(
        nft: Artwork,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let nft_id = object::id(&nft);
        
        // Emit transfer event
        event::emit(NFTTransferred {
            nft_id,
            from: tx_context::sender(ctx),
            to: recipient,
        });

        // Transfer the NFT
        transfer::public_transfer(nft, recipient);
    }

    /// Burn an NFT (only by owner)
    public entry fun burn_nft(
        nft: Artwork,
        _ctx: &mut TxContext
    ) {
        let Artwork {
            id,
            collection_id: _,
            name: _,
            description: _,
            url: _,
            creator: _,
            edition_number: _,
            attributes: _,
        } = nft;
        
        object::delete(id);
    }

    /// View functions
    public fun get_nft_info(nft: &Artwork): (String, String, u64) {
        (nft.name, nft.description, nft.edition_number)
    }

    public fun get_collection_info(collection: &Collection): (String, u64, u64) {
        (collection.name, collection.current_supply, collection.max_supply)
    }

    public fun get_attributes(nft: &Artwork): &vector<Attribute> {
        &nft.attributes
    }
}`;

// Basic DEX Template - Automated Market Maker for token swaps
const DEX_CODE = `module basic_dex::swap {
    use std::option;
    use iota::object::{Self, ID, UID};
    use iota::coin::{Self, Coin};
    use iota::balance::{Self, Balance};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::event;
    use iota::math;

    /// Error codes
    const EZeroAmount: u64 = 0;
    const EInsufficientLiquidity: u64 = 1;
    const ESlippageTooHigh: u64 = 2;
    const EInvalidFee: u64 = 3;
    const EPoolEmpty: u64 = 4;

    /// Liquidity pool for swapping between two tokens
    public struct Pool<phantom X, phantom Y> has key {
        id: UID,
        reserve_x: Balance<X>,
        reserve_y: Balance<Y>,
        lp_supply: u64,
        fee_numerator: u64,   // Fee in basis points (30 = 0.3%)
        fee_denominator: u64, // Always 10000 for basis points
        k_last: u128,         // Last invariant for fee calculation
    }

    /// LP (Liquidity Provider) token representing share of the pool
    public struct LPCoin<phantom X, phantom Y> has store {
        pool_id: ID,
        value: u64,
    }

    /// Event emitted when liquidity is added
    public struct LiquidityAdded has copy, drop {
        provider: address,
        amount_x: u64,
        amount_y: u64,
        lp_tokens: u64,
    }

    /// Event emitted when liquidity is removed
    public struct LiquidityRemoved has copy, drop {
        provider: address,
        amount_x: u64,
        amount_y: u64,
        lp_tokens: u64,
    }

    /// Event emitted when a swap occurs
    public struct SwapExecuted has copy, drop {
        sender: address,
        amount_x_in: u64,
        amount_y_in: u64,
        amount_x_out: u64,
        amount_y_out: u64,
    }

    /// Create a new liquidity pool
    public entry fun create_pool<X, Y>(
        coin_x: Coin<X>,
        coin_y: Coin<Y>,
        fee_numerator: u64,
        ctx: &mut TxContext
    ) {
        // Validate fee (max 10%)
        assert!(fee_numerator <= 1000, EInvalidFee);
        assert!(coin::value(&coin_x) > 0 && coin::value(&coin_y) > 0, EZeroAmount);

        let pool = Pool<X, Y> {
            id: object::new(ctx),
            reserve_x: coin::into_balance(coin_x),
            reserve_y: coin::into_balance(coin_y),
            lp_supply: 0,
            fee_numerator,
            fee_denominator: 10000,
            k_last: 0,
        };

        // Share the pool for public access
        transfer::share_object(pool);
    }

    /// Add liquidity to the pool
    public entry fun add_liquidity<X, Y>(
        pool: &mut Pool<X, Y>,
        coin_x: Coin<X>,
        coin_y: Coin<Y>,
        ctx: &mut TxContext
    ): Coin<LPCoin<X, Y>> {
        let amount_x = coin::value(&coin_x);
        let amount_y = coin::value(&coin_y);
        
        assert!(amount_x > 0 && amount_y > 0, EZeroAmount);

        let reserve_x = balance::value(&pool.reserve_x);
        let reserve_y = balance::value(&pool.reserve_y);
        
        let lp_tokens = if (pool.lp_supply == 0) {
            // First liquidity provider
            // LP tokens = sqrt(amount_x * amount_y)
            math::sqrt(amount_x * amount_y)
        } else {
            // Subsequent providers
            // Maintain the ratio of reserves
            let lp_x = (amount_x * pool.lp_supply) / reserve_x;
            let lp_y = (amount_y * pool.lp_supply) / reserve_y;
            // Return minimum to maintain ratio
            math::min(lp_x, lp_y)
        };

        // Update reserves
        balance::join(&mut pool.reserve_x, coin::into_balance(coin_x));
        balance::join(&mut pool.reserve_y, coin::into_balance(coin_y));
        
        // Update LP supply
        pool.lp_supply = pool.lp_supply + lp_tokens;

        // Emit event
        event::emit(LiquidityAdded {
            provider: tx_context::sender(ctx),
            amount_x,
            amount_y,
            lp_tokens,
        });

        // Create and return LP tokens
        coin::from_balance(
            balance::create_for_testing(LPCoin<X, Y> {
                pool_id: object::id(pool),
                value: lp_tokens,
            }),
            ctx
        )
    }

    /// Remove liquidity from the pool
    public entry fun remove_liquidity<X, Y>(
        pool: &mut Pool<X, Y>,
        lp_coin: Coin<LPCoin<X, Y>>,
        ctx: &mut TxContext
    ): (Coin<X>, Coin<Y>) {
        let lp_value = coin::value(&lp_coin);
        assert!(lp_value > 0, EZeroAmount);
        assert!(pool.lp_supply > 0, EPoolEmpty);

        let reserve_x = balance::value(&pool.reserve_x);
        let reserve_y = balance::value(&pool.reserve_y);

        // Calculate proportional amounts
        let amount_x = (lp_value * reserve_x) / pool.lp_supply;
        let amount_y = (lp_value * reserve_y) / pool.lp_supply;

        // Update LP supply
        pool.lp_supply = pool.lp_supply - lp_value;

        // Burn LP tokens
        coin::burn_for_testing(lp_coin);

        // Remove tokens from reserves
        let coin_x = coin::take(&mut pool.reserve_x, amount_x, ctx);
        let coin_y = coin::take(&mut pool.reserve_y, amount_y, ctx);

        // Emit event
        event::emit(LiquidityRemoved {
            provider: tx_context::sender(ctx),
            amount_x,
            amount_y,
            lp_tokens: lp_value,
        });

        (coin_x, coin_y)
    }

    /// Swap X tokens for Y tokens
    public entry fun swap_x_to_y<X, Y>(
        pool: &mut Pool<X, Y>,
        coin_in: Coin<X>,
        min_amount_out: u64,
        ctx: &mut TxContext
    ): Coin<Y> {
        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        let reserve_x = balance::value(&pool.reserve_x);
        let reserve_y = balance::value(&pool.reserve_y);
        
        // Calculate output amount with fee
        // Using constant product formula: x * y = k
        let amount_in_with_fee = amount_in * (pool.fee_denominator - pool.fee_numerator);
        let numerator = amount_in_with_fee * reserve_y;
        let denominator = (reserve_x * pool.fee_denominator) + amount_in_with_fee;
        let amount_out = numerator / denominator;

        // Check slippage
        assert!(amount_out >= min_amount_out, ESlippageTooHigh);
        assert!(amount_out < reserve_y, EInsufficientLiquidity);

        // Update reserves
        balance::join(&mut pool.reserve_x, coin::into_balance(coin_in));
        let coin_out = coin::take(&mut pool.reserve_y, amount_out, ctx);

        // Update k_last for fee calculation
        pool.k_last = (balance::value(&pool.reserve_x) as u128) * 
                     (balance::value(&pool.reserve_y) as u128);

        // Emit event
        event::emit(SwapExecuted {
            sender: tx_context::sender(ctx),
            amount_x_in: amount_in,
            amount_y_in: 0,
            amount_x_out: 0,
            amount_y_out: amount_out,
        });

        coin_out
    }

    /// Swap Y tokens for X tokens
    public entry fun swap_y_to_x<X, Y>(
        pool: &mut Pool<X, Y>,
        coin_in: Coin<Y>,
        min_amount_out: u64,
        ctx: &mut TxContext
    ): Coin<X> {
        let amount_in = coin::value(&coin_in);
        assert!(amount_in > 0, EZeroAmount);

        let reserve_x = balance::value(&pool.reserve_x);
        let reserve_y = balance::value(&pool.reserve_y);
        
        // Calculate output amount with fee
        let amount_in_with_fee = amount_in * (pool.fee_denominator - pool.fee_numerator);
        let numerator = amount_in_with_fee * reserve_x;
        let denominator = (reserve_y * pool.fee_denominator) + amount_in_with_fee;
        let amount_out = numerator / denominator;

        // Check slippage
        assert!(amount_out >= min_amount_out, ESlippageTooHigh);
        assert!(amount_out < reserve_x, EInsufficientLiquidity);

        // Update reserves
        balance::join(&mut pool.reserve_y, coin::into_balance(coin_in));
        let coin_out = coin::take(&mut pool.reserve_x, amount_out, ctx);

        // Update k_last
        pool.k_last = (balance::value(&pool.reserve_x) as u128) * 
                     (balance::value(&pool.reserve_y) as u128);

        // Emit event
        event::emit(SwapExecuted {
            sender: tx_context::sender(ctx),
            amount_x_in: 0,
            amount_y_in: amount_in,
            amount_x_out: amount_out,
            amount_y_out: 0,
        });

        coin_out
    }

    /// Get pool reserves (view function)
    public fun get_reserves<X, Y>(pool: &Pool<X, Y>): (u64, u64) {
        (balance::value(&pool.reserve_x), balance::value(&pool.reserve_y))
    }

    /// Calculate output amount for a given input (view function)
    public fun get_amount_out<X, Y>(
        pool: &Pool<X, Y>,
        amount_in: u64,
        is_x_to_y: bool
    ): u64 {
        let (reserve_x, reserve_y) = get_reserves(pool);
        
        if (is_x_to_y) {
            let amount_in_with_fee = amount_in * (pool.fee_denominator - pool.fee_numerator);
            let numerator = amount_in_with_fee * reserve_y;
            let denominator = (reserve_x * pool.fee_denominator) + amount_in_with_fee;
            numerator / denominator
        } else {
            let amount_in_with_fee = amount_in * (pool.fee_denominator - pool.fee_numerator);
            let numerator = amount_in_with_fee * reserve_x;
            let denominator = (reserve_y * pool.fee_denominator) + amount_in_with_fee;
            numerator / denominator
        }
    }
}`;

// Simple Marketplace Template - Buy and sell items with IOTA
const MARKETPLACE_CODE = `module marketplace::simple_market {
    use std::string::{Self, String};
    use std::vector;
    use iota::object::{Self, ID, UID};
    use iota::coin::{Self, Coin};
    use iota::iota::IOTA;
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use iota::event;
    use iota::dynamic_object_field as dof;
    use iota::dynamic_field as df;

    /// Error codes
    const EInvalidPrice: u64 = 0;
    const EInsufficientPayment: u64 = 1;
    const ENotSeller: u64 = 2;
    const EListingNotFound: u64 = 3;
    const EMarketplacePaused: u64 = 4;

    /// The marketplace that manages all listings
    public struct Marketplace has key {
        id: UID,
        owner: address,
        fee_percentage: u64, // Basis points (250 = 2.5%)
        total_sales: u64,
        total_volume: u64,
        is_paused: bool,
        collected_fees: u64,
    }

    /// A listing in the marketplace
    public struct Listing<T: key + store> has key, store {
        id: UID,
        seller: address,
        price: u64,
        item: T,
        description: String,
        listed_at: u64,
    }

    /// Receipt for a purchase
    public struct PurchaseReceipt has key, store {
        id: UID,
        listing_id: ID,
        buyer: address,
        seller: address,
        price: u64,
        fee: u64,
        item_type: String,
        purchased_at: u64,
    }

    /// Events
    public struct ItemListed has copy, drop {
        listing_id: ID,
        seller: address,
        price: u64,
        item_type: String,
    }

    public struct ItemSold has copy, drop {
        listing_id: ID,
        seller: address,
        buyer: address,
        price: u64,
        fee: u64,
    }

    public struct ItemDelisted has copy, drop {
        listing_id: ID,
        seller: address,
    }

    /// Create a new marketplace
    public entry fun create_marketplace(
        fee_percentage: u64,
        ctx: &mut TxContext
    ) {
        // Max fee is 10%
        assert!(fee_percentage <= 1000, EInvalidPrice);

        let marketplace = Marketplace {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            fee_percentage,
            total_sales: 0,
            total_volume: 0,
            is_paused: false,
            collected_fees: 0,
        };

        transfer::share_object(marketplace);
    }

    /// List an item for sale
    public entry fun list_item<T: key + store>(
        marketplace: &mut Marketplace,
        item: T,
        price: u64,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Check marketplace is not paused
        assert!(!marketplace.is_paused, EMarketplacePaused);
        
        // Validate price
        assert!(price > 0, EInvalidPrice);

        let seller = tx_context::sender(ctx);
        let listing_id = object::new(ctx);
        let listing_id_copy = object::uid_to_inner(&listing_id);

        // Create listing
        let listing = Listing {
            id: listing_id,
            seller,
            price,
            item,
            description: string::utf8(description),
            listed_at: tx_context::epoch(ctx),
        };

        // Store listing in marketplace
        dof::add(&mut marketplace.id, listing_id_copy, listing);

        // Emit event
        event::emit(ItemListed {
            listing_id: listing_id_copy,
            seller,
            price,
            item_type: string::utf8(b"Generic"), // In production, use type name
        });
    }

    /// Buy an item from the marketplace
    public entry fun buy_item<T: key + store>(
        marketplace: &mut Marketplace,
        listing_id: ID,
        payment: Coin<IOTA>,
        ctx: &mut TxContext
    ) {
        // Check marketplace is not paused
        assert!(!marketplace.is_paused, EMarketplacePaused);

        // Get the listing
        let listing = dof::remove<ID, Listing<T>>(
            &mut marketplace.id,
            listing_id
        );

        let Listing {
            id,
            seller,
            price,
            item,
            description: _,
            listed_at: _,
        } = listing;

        // Check payment amount
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= price, EInsufficientPayment);

        // Calculate marketplace fee
        let fee = (price * marketplace.fee_percentage) / 10000;
        let seller_amount = price - fee;

        // Update marketplace stats
        marketplace.total_sales = marketplace.total_sales + 1;
        marketplace.total_volume = marketplace.total_volume + price;
        marketplace.collected_fees = marketplace.collected_fees + fee;

        // Split payment
        if (fee > 0) {
            let fee_coin = coin::split(&mut payment, fee, ctx);
            // Transfer fee to marketplace owner
            transfer::public_transfer(fee_coin, marketplace.owner);
        };

        // Transfer payment to seller
        if (seller_amount > 0) {
            let seller_coin = coin::split(&mut payment, seller_amount, ctx);
            transfer::public_transfer(seller_coin, seller);
        };

        // Return change if any
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, tx_context::sender(ctx));
        } else {
            coin::destroy_zero(payment);
        };

        // Transfer item to buyer
        let buyer = tx_context::sender(ctx);
        transfer::public_transfer(item, buyer);

        // Create purchase receipt
        let receipt = PurchaseReceipt {
            id: object::new(ctx),
            listing_id,
            buyer,
            seller,
            price,
            fee,
            item_type: string::utf8(b"Generic"),
            purchased_at: tx_context::epoch(ctx),
        };
        transfer::public_transfer(receipt, buyer);

        // Clean up listing object
        object::delete(id);

        // Emit event
        event::emit(ItemSold {
            listing_id,
            seller,
            buyer,
            price,
            fee,
        });
    }

    /// Cancel a listing and get the item back
    public entry fun cancel_listing<T: key + store>(
        marketplace: &mut Marketplace,
        listing_id: ID,
        ctx: &mut TxContext
    ) {
        // Get the listing
        let listing = dof::remove<ID, Listing<T>>(
            &mut marketplace.id,
            listing_id
        );

        let Listing {
            id,
            seller,
            price: _,
            item,
            description: _,
            listed_at: _,
        } = listing;

        // Only seller can cancel
        assert!(seller == tx_context::sender(ctx), ENotSeller);

        // Return item to seller
        transfer::public_transfer(item, seller);

        // Clean up listing object
        object::delete(id);

        // Emit event
        event::emit(ItemDelisted {
            listing_id,
            seller,
        });
    }

    /// Update listing price (only by seller)
    public entry fun update_price<T: key + store>(
        marketplace: &mut Marketplace,
        listing_id: ID,
        new_price: u64,
        ctx: &mut TxContext
    ) {
        // Validate new price
        assert!(new_price > 0, EInvalidPrice);

        // Get mutable reference to listing
        let listing = dof::borrow_mut<ID, Listing<T>>(
            &mut marketplace.id,
            listing_id
        );

        // Only seller can update price
        assert!(listing.seller == tx_context::sender(ctx), ENotSeller);

        // Update price
        listing.price = new_price;
    }

    /// Pause/unpause marketplace (only owner)
    public entry fun set_marketplace_status(
        marketplace: &mut Marketplace,
        is_paused: bool,
        ctx: &mut TxContext
    ) {
        assert!(marketplace.owner == tx_context::sender(ctx), ENotSeller);
        marketplace.is_paused = is_paused;
    }

    /// Update marketplace fee (only owner)
    public entry fun update_fee(
        marketplace: &mut Marketplace,
        new_fee_percentage: u64,
        ctx: &mut TxContext
    ) {
        assert!(marketplace.owner == tx_context::sender(ctx), ENotSeller);
        assert!(new_fee_percentage <= 1000, EInvalidPrice); // Max 10%
        marketplace.fee_percentage = new_fee_percentage;
    }

    /// View functions
    public fun get_listing_price<T: key + store>(
        marketplace: &Marketplace,
        listing_id: ID
    ): u64 {
        let listing = dof::borrow<ID, Listing<T>>(&marketplace.id, listing_id);
        listing.price
    }

    public fun get_marketplace_stats(marketplace: &Marketplace): (u64, u64, u64) {
        (marketplace.total_sales, marketplace.total_volume, marketplace.collected_fees)
    }

    public fun is_marketplace_paused(marketplace: &Marketplace): bool {
        marketplace.is_paused
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
  category?: 'defi' | 'nft' | 'token' | 'utility' | 'game';
  linesOfCode?: number;
  estimatedTime?: string;
  popularity?: number;
  author?: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Simple greeting contract to learn Move basics',
    icon: Sparkles,
    code: HELLO_WORLD_CODE,
    difficulty: 'beginner',
    tags: ['beginner', 'basic', 'greeting'],
    category: 'utility',
    linesOfCode: 42,
    estimatedTime: '5 min',
    popularity: 1250,
    author: 'IOTA Team'
  },
  {
    id: 'counter',
    name: 'Counter',
    description: 'State management example with increment/decrement functions',
    icon: Code2,
    code: COUNTER_CODE,
    difficulty: 'beginner',
    tags: ['beginner', 'state', 'events'],
    category: 'utility',
    linesOfCode: 95,
    estimatedTime: '10 min',
    popularity: 980,
    author: 'IOTA Team'
  },
  {
    id: 'coffee-shop',
    name: 'Coffee Shop',
    description: 'Token economy with loyalty points from IOTA docs',
    icon: Coins,
    code: COFFEE_CODE,
    difficulty: 'intermediate',
    tags: ['token', 'business', 'loyalty'],
    category: 'token',
    linesOfCode: 215,
    estimatedTime: '20 min',
    popularity: 750,
    author: 'IOTA Docs'
  },
  {
    id: 'simple-nft',
    name: 'Simple NFT',
    description: 'Non-fungible token with collection and attributes',
    icon: ImageIcon,
    code: NFT_CODE,
    difficulty: 'intermediate',
    tags: ['nft', 'collectibles', 'metadata'],
    category: 'nft',
    linesOfCode: 230,
    estimatedTime: '25 min',
    popularity: 1100,
    author: 'IOTA Team'
  },
  {
    id: 'basic-dex',
    name: 'Basic DEX',
    description: 'Automated market maker for token swaps (Note: Uses testing functions - for learning purposes only)',
    icon: Zap,
    code: DEX_CODE,
    difficulty: 'advanced',
    tags: ['defi', 'dex', 'amm', 'swap', 'experimental'],
    category: 'defi',
    linesOfCode: 285,
    estimatedTime: '30 min',
    popularity: 620,
    author: 'DeFi Expert'
  },
  {
    id: 'marketplace',
    name: 'Simple Marketplace',
    description: 'Buy and sell items with IOTA tokens',
    icon: ShieldCheck,
    code: MARKETPLACE_CODE,
    difficulty: 'advanced',
    tags: ['marketplace', 'trading', 'commerce'],
    category: 'defi',
    linesOfCode: 320,
    estimatedTime: '35 min',
    popularity: 540,
    author: 'Community'
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