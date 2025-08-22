module counter::counter {
    struct Counter has drop {
        value: u64
    }

    public fun new(): Counter {
        Counter { value: 0 }
    }

    public fun increment(c: &mut Counter) {
        c.value = c.value + 1;
    }

    public fun get_value(c: &Counter): u64 {
        c.value
    }
}