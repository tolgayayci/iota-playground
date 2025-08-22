module counter::counter {
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;

    public struct Counter has key, store {
        id: UID,
        value: u64,
        owner: address,
    }

    public fun create_counter(initial_value: u64, ctx: &mut TxContext) {
        let counter = Counter {
            id: object::new(ctx),
            value: initial_value,
            owner: tx_context::sender(ctx),
        };
        transfer::transfer(counter, tx_context::sender(ctx));
    }

    public fun get_value(counter: &Counter): u64 {
        counter.value
    }

    public entry fun increment(counter: &mut Counter, _: &mut TxContext) {
        counter.value = counter.value + 1;
    }
}