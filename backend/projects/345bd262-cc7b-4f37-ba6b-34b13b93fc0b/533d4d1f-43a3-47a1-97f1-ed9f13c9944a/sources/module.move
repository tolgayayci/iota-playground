module hello_world::greetings {
    use std::string::{Self, String};
    use iota::event;
    use iota::tx_context::{Self, TxContext};

    public struct GreetingEvent has copy, drop {
        message: String,
        greeter: address,
    }

    public fun greet(ctx: &mut TxContext): String {
        let greeting = string::utf8(b"Hello, IOTA World!");
        
        event::emit(GreetingEvent {
            message: greeting,
            greeter: tx_context::sender(ctx)
        });
        
        greeting
    }
}