module hello_world::greetings {
    public fun greet(): u64 {
        42
    }

    public fun say_hello(): vector<u8> {
        b"Hello, IOTA!"
    }
}