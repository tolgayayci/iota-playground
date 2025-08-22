module counter::counter {
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;

    public struct Counter has key, store {
        id: UID,
        value: u64,
    }

    public fun create_counter(ctx: &mut TxContext) {
        let counter = Counter {
            id: object::new(ctx),
            value: 0,
        };
        transfer::public_transfer(counter, tx_context::sender(ctx));
    }

    public fun increment(counter: &mut Counter) {
        counter.value = counter.value + 1;
    }

    public fun get_value(counter: &Counter): u64 {
        counter.value
    }
}