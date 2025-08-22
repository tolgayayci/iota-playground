module 0x0::hello {
    public fun greet(): vector<u8> {
        b"Hello, IOTA!"
    }
    
    public entry fun say_hello() {
        // Entry function for demonstration
    }
}