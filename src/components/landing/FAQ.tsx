import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, Play, Rocket, Code2, Coins, Blocks } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: "What is IOTA?",
    answer: "IOTA is a distributed ledger technology designed for the Internet of Things (IoT) and Web3. It features feeless transactions, high scalability, and now supports Move smart contracts for building decentralized applications with enhanced security and performance.",
    icon: Blocks,
  },
  {
    question: "What is IOTA Playground?",
    answer: "IOTA Playground is a browser-based development environment specifically designed for IOTA Move development. It provides a seamless experience for writing, testing, and deploying Move smart contracts with features like real-time compilation, PTB builder, and one-click deployment to IOTA Testnet - all without complex setup.",
    icon: Play,
  },
  {
    question: "Do I need a wallet or test tokens?",
    answer: "For testnet development, IOTA Playground provides integrated faucet access to get test IOTA tokens. For mainnet, you can connect your wallet securely. The platform handles all the complexity of transaction building and gas estimation for you.",
    icon: Rocket,
  },
  {
    question: "What is the Move programming language?",
    answer: "Move is a secure, resource-oriented programming language originally developed by Facebook (now Meta) for blockchain development. It features built-in safety guarantees, resource management, and formal verification capabilities, making it ideal for writing secure smart contracts on IOTA.",
    icon: Code2,
  },
  {
    question: "How much does it cost to use IOTA Playground?",
    answer: "IOTA Playground is completely free to use! For testnet development, all compilation and deployment costs are minimal due to IOTA's efficient architecture. The platform provides free access to testnet tokens through the integrated faucet, allowing you to develop and test without any costs.",
    icon: Coins,
  },
];

export function FAQ() {
  return (
    <section id="faq" className="container mx-auto py-24 lg:py-32">
      <motion.div 
        className="text-center max-w-2xl mx-auto mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>
        <p className="text-lg text-muted-foreground">
          Everything you need to know about Move development on IOTA
        </p>
      </motion.div>

      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <AccordionItem value={`item-${index}`}>
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-left text-base font-medium">{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-12 pr-4 pb-4">
                    <p className="text-base text-muted-foreground">
                      {item.answer}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}