module counter::counter {
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
}