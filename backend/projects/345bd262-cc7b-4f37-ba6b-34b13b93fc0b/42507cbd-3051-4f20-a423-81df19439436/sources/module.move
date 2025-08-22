module hello_world::greetings {
    use std::string::{Self, String};
    
    public fun greet(): String {
        string::utf8(b"Hello, IOTA World!")
    }

    public fun get_message(): vector<u8> {
        b"Welcome to IOTA Playground!"
    }
}