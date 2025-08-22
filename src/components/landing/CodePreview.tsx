import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const CODE_SNIPPETS = [
  {
    title: 'Digital Piggy Bank',
    description: 'A simple smart contract that works like a digital piggy bank. You can put money in and check how much you have saved!',
    explanation: [
      'Think of this like a magical jar that can hold digital money',
      'You can add money to it anytime you want',
      'Check your savings with one click',
      'Perfect for learning how smart contracts work',
    ],
    code: `module piggy_bank::bank {
    use iota::coin::{Self, Coin};
    use iota::balance::{Self, Balance};
    use iota::iota::IOTA;
    use iota::object::{Self, UID};
    use iota::tx_context::TxContext;
    
    // Your digital piggy bank
    public struct PiggyBank has key {
        id: UID,
        savings: Balance<IOTA>,  // This stores your money
    }
    
    // Check how much money you have saved
    public fun get_savings(bank: &PiggyBank): u64 {
        balance::value(&bank.savings)
    }
    
    // Add more money to your piggy bank
    public fun add_savings(bank: &mut PiggyBank, payment: Coin<IOTA>) {
        let amount = coin::into_balance(payment);
        balance::join(&mut bank.savings, amount);
    }
}`
  },
  {
    title: 'Digital Ticket System',
    description: 'Create and manage digital tickets for your events. Like concert tickets, but on the blockchain!',
    explanation: [
      'Works just like real-world event tickets',
      'Each ticket has a unique number',
      'Keep track of who owns which ticket',
      'Great for events and gatherings',
    ],
    code: `module ticket_system::tickets {
    use std::string::String;
    use iota::object::{Self, UID};
    use iota::transfer;
    use iota::tx_context::{Self, TxContext};
    
    // Digital ticket structure
    public struct Ticket has key, store {
        id: UID,
        event_name: String,
        seat_number: u64,
    }
    
    // Create a new ticket for someone
    public fun mint_ticket(
        event: String,
        seat: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let ticket = Ticket {
            id: object::new(ctx),
            event_name: event,
            seat_number: seat,
        };
        transfer::transfer(ticket, recipient);
    }
}`
  }
];

interface CodePreviewProps {
  className?: string;
}

export function CodePreview({ className }: CodePreviewProps) {
  return (
    <div className={cn("grid gap-8 lg:grid-cols-2", className)}>
      {CODE_SNIPPETS.map((snippet, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.2 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">{snippet.title}</h3>
            <p className="text-muted-foreground">{snippet.description}</p>
            <div className="space-y-3">
              {snippet.explanation.map((point, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary flex-none" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border bg-muted">
            <div className="flex items-center justify-between border-b p-4">
              <h4 className="font-mono text-sm">Example Code</h4>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
            </div>
            <pre className="p-4 text-sm font-mono overflow-x-auto">
              <code>{snippet.code}</code>
            </pre>
          </div>

          <Button variant="outline" className="w-full">Try This Example</Button>
        </motion.div>
      ))}
    </div>
  );
}