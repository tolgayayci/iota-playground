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

// Counter Contract Template - State management example
const COUNTER_CODE = `module counter::counter {
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::event;

    /// Error codes
    const ECounterOverflow: u64 = 0;
    const ECounterUnderflow: u64 = 1;
    const ENotOwner: u64 = 2;

    /// Counter object that maintains a count value
    public struct Counter has key, store {
        id: UID,
        value: u64,
        owner: address,
    }

    /// Event emitted when counter value changes
    public struct CounterUpdated has copy, drop {
        old_value: u64,
        new_value: u64,
        action: vector<u8>, // "increment", "decrement", "reset", etc.
    }

    /// Create a new counter with an initial value
    public entry fun create_counter(
        initial_value: u64, 
        ctx: &mut TxContext
    ) {
        let counter = Counter {
            id: object::new(ctx),
            value: initial_value,
            owner: tx_context::sender(ctx),
        };
        
        // Transfer ownership to the creator
        transfer::public_transfer(counter, tx_context::sender(ctx));
    }

    /// Create a shared counter that anyone can interact with
    public entry fun create_shared_counter(
        initial_value: u64,
        ctx: &mut TxContext
    ) {
        let counter = Counter {
            id: object::new(ctx),
            value: initial_value,
            owner: @0x0, // No specific owner for shared counter
        };
        
        // Make it a shared object
        transfer::public_share_object(counter);
    }

    /// Increment the counter by 1
    public entry fun increment(counter: &mut Counter) {
        let old_value = counter.value;
        
        // Check for overflow
        assert!(counter.value < 18446744073709551615, ECounterOverflow);
        counter.value = counter.value + 1;
        
        // Emit event
        event::emit(CounterUpdated {
            old_value,
            new_value: counter.value,
            action: b"increment",
        });
    }
    
    /// Increment the counter by a specific amount
    public entry fun increment_by(counter: &mut Counter, amount: u64) {
        let old_value = counter.value;
        
        // Check for overflow
        assert!(counter.value <= 18446744073709551615 - amount, ECounterOverflow);
        counter.value = counter.value + amount;
        
        event::emit(CounterUpdated {
            old_value,
            new_value: counter.value,
            action: b"increment_by",
        });
    }
    
    /// Decrement the counter by 1
    public entry fun decrement(counter: &mut Counter) {
        let old_value = counter.value;
        
        // Check for underflow
        assert!(counter.value > 0, ECounterUnderflow);
        counter.value = counter.value - 1;
        
        event::emit(CounterUpdated {
            old_value,
            new_value: counter.value,
            action: b"decrement",
        });
    }
    
    /// Reset the counter to zero
    public entry fun reset(counter: &mut Counter, ctx: &mut TxContext) {
        // Only owner can reset (if not shared)
        if (counter.owner != @0x0) {
            assert!(counter.owner == tx_context::sender(ctx), ENotOwner);
        };
        
        let old_value = counter.value;
        counter.value = 0;
        
        event::emit(CounterUpdated {
            old_value,
            new_value: 0,
            action: b"reset",
        });
    }
    
    /// Get the current counter value (view function)
    public fun get_value(counter: &Counter): u64 {
        counter.value
    }
    
    /// Check if an address is the owner
    public fun is_owner(counter: &Counter, addr: address): bool {
        counter.owner == addr
    }
}`;

// Coffee Shop Template - From IOTA documentation example
const COFFEE_CODE = `module coffee_shop::coffee {
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use iota::coin::{Self, Coin, TreasuryCap};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    use iota::balance::{Self, Balance};
    use iota::object::{Self, UID};
    use iota::event;
    use iota::url::{Self, Url};

    /// Error codes
    const EInsufficientPayment: u64 = 0;
    const EInvalidLoyaltyPoints: u64 = 1;
    const EShopClosed: u64 = 2;

    /// One-Time Witness for the COFFEE token
    /// This struct is created once when the module is published
    public struct COFFEE has drop {}

    /// The Coffee Shop object that manages sales and loyalty
    public struct CoffeeShop has key {
        id: UID,
        owner: address,
        balance: Balance<COFFEE>,
        price_per_coffee: u64,
        loyalty_per_coffee: u64,
        is_open: bool,
    }

    /// Customer loyalty card to track purchases
    public struct LoyaltyCard has key, store {
        id: UID,
        customer: address,
        points: u64,
        total_coffees: u64,
    }

    /// Event emitted when coffee is purchased
    public struct CoffeePurchased has copy, drop {
        customer: address,
        amount: u64,
        loyalty_points_earned: u64,
    }

    /// Initialize the module and create the coffee token
    /// This function is called once when the module is published
    fun init(witness: COFFEE, ctx: &mut TxContext) {
        // Create the COFFEE token with metadata
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            6, // 6 decimals
            b"COFFEE", // Symbol
            b"Coffee Token", // Name
            b"Token for purchasing coffee at our shop", // Description
            option::some(url::new_unsafe_from_bytes(
                b"https://example.com/coffee-icon.png"
            )), // Icon URL
            ctx
        );

        // Create the coffee shop
        let shop = CoffeeShop {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            balance: balance::zero(),
            price_per_coffee: 1_000_000, // 1 COFFEE token (with 6 decimals)
            loyalty_per_coffee: 10, // 10 loyalty points per coffee
            is_open: true,
        };

        // Freeze the metadata to make it immutable
        transfer::public_freeze_object(metadata);
        
        // Transfer treasury cap to the shop owner
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
        
        // Share the coffee shop so customers can interact with it
        transfer::share_object(shop);
    }

    /// Mint new COFFEE tokens (only treasury cap holder can mint)
    public entry fun mint_coffee_tokens(
        treasury_cap: &mut TreasuryCap<COFFEE>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coffee_coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coffee_coin, recipient);
    }

    /// Buy coffee from the shop using COFFEE tokens
    public entry fun buy_coffee(
        shop: &mut CoffeeShop,
        payment: Coin<COFFEE>,
        loyalty_card: &mut LoyaltyCard,
        ctx: &mut TxContext
    ) {
        // Check if shop is open
        assert!(shop.is_open, EShopClosed);
        
        // Check payment amount
        let payment_value = coin::value(&payment);
        assert!(payment_value >= shop.price_per_coffee, EInsufficientPayment);
        
        // Calculate how many coffees are being purchased
        let num_coffees = payment_value / shop.price_per_coffee;
        
        // Add payment to shop balance
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut shop.balance, payment_balance);
        
        // Update loyalty card
        loyalty_card.points = loyalty_card.points + (num_coffees * shop.loyalty_per_coffee);
        loyalty_card.total_coffees = loyalty_card.total_coffees + num_coffees;
        
        // Emit purchase event
        event::emit(CoffeePurchased {
            customer: tx_context::sender(ctx),
            amount: num_coffees,
            loyalty_points_earned: num_coffees * shop.loyalty_per_coffee,
        });
    }

    /// Create a new loyalty card for a customer
    public entry fun create_loyalty_card(ctx: &mut TxContext) {
        let card = LoyaltyCard {
            id: object::new(ctx),
            customer: tx_context::sender(ctx),
            points: 0,
            total_coffees: 0,
        };
        
        transfer::public_transfer(card, tx_context::sender(ctx));
    }

    /// Redeem loyalty points for free coffee
    /// Every 100 points = 1 free coffee
    public entry fun redeem_loyalty_points(
        shop: &mut CoffeeShop,
        loyalty_card: &mut LoyaltyCard,
        points_to_redeem: u64,
        ctx: &mut TxContext
    ) {
        // Check if shop is open
        assert!(shop.is_open, EShopClosed);
        
        // Check if customer has enough points (100 points = 1 coffee)
        assert!(loyalty_card.points >= points_to_redeem, EInvalidLoyaltyPoints);
        assert!(points_to_redeem % 100 == 0, EInvalidLoyaltyPoints);
        
        // Calculate free coffees
        let free_coffees = points_to_redeem / 100;
        
        // Deduct points
        loyalty_card.points = loyalty_card.points - points_to_redeem;
        loyalty_card.total_coffees = loyalty_card.total_coffees + free_coffees;
        
        // Emit event
        event::emit(CoffeePurchased {
            customer: loyalty_card.customer,
            amount: free_coffees,
            loyalty_points_earned: 0,
        });
    }

    /// Shop owner withdraws accumulated COFFEE tokens
    public entry fun withdraw_earnings(
        shop: &mut CoffeeShop,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // Only owner can withdraw
        assert!(shop.owner == tx_context::sender(ctx), EShopClosed);
        
        let withdrawn = coin::take(&mut shop.balance, amount, ctx);
        transfer::public_transfer(withdrawn, shop.owner);
    }

    /// Open or close the shop
    public entry fun set_shop_status(
        shop: &mut CoffeeShop,
        is_open: bool,
        ctx: &mut TxContext
    ) {
        // Only owner can change status
        assert!(shop.owner == tx_context::sender(ctx), EShopClosed);
        shop.is_open = is_open;
    }

    /// Update coffee price
    public entry fun update_price(
        shop: &mut CoffeeShop,
        new_price: u64,
        ctx: &mut TxContext
    ) {
        // Only owner can update price
        assert!(shop.owner == tx_context::sender(ctx), EShopClosed);
        shop.price_per_coffee = new_price;
    }

    /// View functions
    public fun get_shop_balance(shop: &CoffeeShop): u64 {
        balance::value(&shop.balance)
    }

    public fun get_loyalty_points(card: &LoyaltyCard): u64 {
        card.points
    }

    public fun get_total_coffees(card: &LoyaltyCard): u64 {
        card.total_coffees
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
    description: 'Automated market maker for token swaps',
    icon: Zap,
    code: DEX_CODE,
    difficulty: 'advanced',
    tags: ['defi', 'dex', 'amm', 'swap'],
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