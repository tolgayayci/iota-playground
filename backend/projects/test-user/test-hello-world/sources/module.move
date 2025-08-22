module hello_world::greetings {
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
}