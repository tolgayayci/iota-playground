import * as monaco from 'monaco-editor';

/**
 * Move Signature Help Provider for parameter hints
 */

interface FunctionSignature {
  label: string;
  documentation?: string;
  parameters: {
    label: string;
    documentation?: string;
  }[];
}

// Common IOTA Move standard library function signatures
const MOVE_SIGNATURES: Record<string, FunctionSignature> = {
  'transfer::public_transfer': {
    label: 'public_transfer<T: key + store>(obj: T, recipient: address)',
    documentation: 'Transfer an object to a recipient address',
    parameters: [
      { label: 'obj: T', documentation: 'The object to transfer (must have key + store abilities)' },
      { label: 'recipient: address', documentation: 'The recipient address' },
    ],
  },
  'transfer::public_share_object': {
    label: 'public_share_object<T: key>(obj: T)',
    documentation: 'Share an object publicly',
    parameters: [
      { label: 'obj: T', documentation: 'The object to share (must have key ability)' },
    ],
  },
  'transfer::public_freeze_object': {
    label: 'public_freeze_object<T: key>(obj: T)',
    documentation: 'Freeze an object to make it immutable',
    parameters: [
      { label: 'obj: T', documentation: 'The object to freeze (must have key ability)' },
    ],
  },
  'object::new': {
    label: 'new(ctx: &mut TxContext): UID',
    documentation: 'Create a new unique identifier',
    parameters: [
      { label: 'ctx: &mut TxContext', documentation: 'Mutable reference to transaction context' },
    ],
  },
  'object::delete': {
    label: 'delete(id: UID)',
    documentation: 'Delete a unique identifier',
    parameters: [
      { label: 'id: UID', documentation: 'The unique identifier to delete' },
    ],
  },
  'tx_context::sender': {
    label: 'sender(ctx: &TxContext): address',
    documentation: 'Get the sender address from transaction context',
    parameters: [
      { label: 'ctx: &TxContext', documentation: 'Reference to transaction context' },
    ],
  },
  'tx_context::epoch': {
    label: 'epoch(ctx: &TxContext): u64',
    documentation: 'Get the current epoch from transaction context',
    parameters: [
      { label: 'ctx: &TxContext', documentation: 'Reference to transaction context' },
    ],
  },
  'coin::mint': {
    label: 'mint<T>(cap: &mut TreasuryCap<T>, value: u64, ctx: &mut TxContext): Coin<T>',
    documentation: 'Mint new coins',
    parameters: [
      { label: 'cap: &mut TreasuryCap<T>', documentation: 'Mutable reference to treasury capability' },
      { label: 'value: u64', documentation: 'Amount of coins to mint' },
      { label: 'ctx: &mut TxContext', documentation: 'Mutable reference to transaction context' },
    ],
  },
  'coin::burn': {
    label: 'burn<T>(cap: &mut TreasuryCap<T>, coin: Coin<T>)',
    documentation: 'Burn coins',
    parameters: [
      { label: 'cap: &mut TreasuryCap<T>', documentation: 'Mutable reference to treasury capability' },
      { label: 'coin: Coin<T>', documentation: 'The coin to burn' },
    ],
  },
  'coin::value': {
    label: 'value<T>(coin: &Coin<T>): u64',
    documentation: 'Get the value of a coin',
    parameters: [
      { label: 'coin: &Coin<T>', documentation: 'Reference to the coin' },
    ],
  },
  'coin::split': {
    label: 'split<T>(coin: &mut Coin<T>, amount: u64, ctx: &mut TxContext): Coin<T>',
    documentation: 'Split a coin into two',
    parameters: [
      { label: 'coin: &mut Coin<T>', documentation: 'Mutable reference to the coin to split' },
      { label: 'amount: u64', documentation: 'Amount to split off' },
      { label: 'ctx: &mut TxContext', documentation: 'Mutable reference to transaction context' },
    ],
  },
  'coin::join': {
    label: 'join<T>(coin: &mut Coin<T>, other: Coin<T>)',
    documentation: 'Join two coins together',
    parameters: [
      { label: 'coin: &mut Coin<T>', documentation: 'Mutable reference to the coin to join into' },
      { label: 'other: Coin<T>', documentation: 'The coin to join' },
    ],
  },
  'vector::empty': {
    label: 'empty<T>(): vector<T>',
    documentation: 'Create an empty vector',
    parameters: [],
  },
  'vector::push_back': {
    label: 'push_back<T>(v: &mut vector<T>, x: T)',
    documentation: 'Add an element to the end of a vector',
    parameters: [
      { label: 'v: &mut vector<T>', documentation: 'Mutable reference to the vector' },
      { label: 'x: T', documentation: 'Element to add' },
    ],
  },
  'vector::pop_back': {
    label: 'pop_back<T>(v: &mut vector<T>): T',
    documentation: 'Remove and return the last element from a vector',
    parameters: [
      { label: 'v: &mut vector<T>', documentation: 'Mutable reference to the vector' },
    ],
  },
  'vector::length': {
    label: 'length<T>(v: &vector<T>): u64',
    documentation: 'Get the length of a vector',
    parameters: [
      { label: 'v: &vector<T>', documentation: 'Reference to the vector' },
    ],
  },
  'vector::borrow': {
    label: 'borrow<T>(v: &vector<T>, i: u64): &T',
    documentation: 'Borrow an element from a vector',
    parameters: [
      { label: 'v: &vector<T>', documentation: 'Reference to the vector' },
      { label: 'i: u64', documentation: 'Index of the element' },
    ],
  },
  'vector::borrow_mut': {
    label: 'borrow_mut<T>(v: &mut vector<T>, i: u64): &mut T',
    documentation: 'Borrow a mutable reference to an element in a vector',
    parameters: [
      { label: 'v: &mut vector<T>', documentation: 'Mutable reference to the vector' },
      { label: 'i: u64', documentation: 'Index of the element' },
    ],
  },
  'option::none': {
    label: 'none<T>(): Option<T>',
    documentation: 'Create an empty option',
    parameters: [],
  },
  'option::some': {
    label: 'some<T>(x: T): Option<T>',
    documentation: 'Create an option with a value',
    parameters: [
      { label: 'x: T', documentation: 'The value to wrap in an option' },
    ],
  },
  'option::is_none': {
    label: 'is_none<T>(opt: &Option<T>): bool',
    documentation: 'Check if an option is empty',
    parameters: [
      { label: 'opt: &Option<T>', documentation: 'Reference to the option' },
    ],
  },
  'option::is_some': {
    label: 'is_some<T>(opt: &Option<T>): bool',
    documentation: 'Check if an option has a value',
    parameters: [
      { label: 'opt: &Option<T>', documentation: 'Reference to the option' },
    ],
  },
  'option::extract': {
    label: 'extract<T>(opt: &mut Option<T>): T',
    documentation: 'Extract the value from an option',
    parameters: [
      { label: 'opt: &mut Option<T>', documentation: 'Mutable reference to the option' },
    ],
  },
  'table::new': {
    label: 'new<K: copy + drop + store, V: store>(ctx: &mut TxContext): Table<K, V>',
    documentation: 'Create a new table',
    parameters: [
      { label: 'ctx: &mut TxContext', documentation: 'Mutable reference to transaction context' },
    ],
  },
  'table::add': {
    label: 'add<K: copy + drop + store, V: store>(table: &mut Table<K, V>, key: K, value: V)',
    documentation: 'Add a key-value pair to a table',
    parameters: [
      { label: 'table: &mut Table<K, V>', documentation: 'Mutable reference to the table' },
      { label: 'key: K', documentation: 'The key' },
      { label: 'value: V', documentation: 'The value' },
    ],
  },
  'table::borrow': {
    label: 'borrow<K: copy + drop + store, V: store>(table: &Table<K, V>, key: K): &V',
    documentation: 'Borrow a value from a table',
    parameters: [
      { label: 'table: &Table<K, V>', documentation: 'Reference to the table' },
      { label: 'key: K', documentation: 'The key to look up' },
    ],
  },
  'table::borrow_mut': {
    label: 'borrow_mut<K: copy + drop + store, V: store>(table: &mut Table<K, V>, key: K): &mut V',
    documentation: 'Borrow a mutable reference to a value in a table',
    parameters: [
      { label: 'table: &mut Table<K, V>', documentation: 'Mutable reference to the table' },
      { label: 'key: K', documentation: 'The key to look up' },
    ],
  },
  'table::remove': {
    label: 'remove<K: copy + drop + store, V: store>(table: &mut Table<K, V>, key: K): V',
    documentation: 'Remove and return a value from a table',
    parameters: [
      { label: 'table: &mut Table<K, V>', documentation: 'Mutable reference to the table' },
      { label: 'key: K', documentation: 'The key to remove' },
    ],
  },
  'table::contains': {
    label: 'contains<K: copy + drop + store, V: store>(table: &Table<K, V>, key: K): bool',
    documentation: 'Check if a table contains a key',
    parameters: [
      { label: 'table: &Table<K, V>', documentation: 'Reference to the table' },
      { label: 'key: K', documentation: 'The key to check' },
    ],
  },
  'assert!': {
    label: 'assert!(condition: bool, error_code: u64)',
    documentation: 'Assert a condition is true or abort with error code',
    parameters: [
      { label: 'condition: bool', documentation: 'The condition to check' },
      { label: 'error_code: u64', documentation: 'Error code to abort with if condition is false' },
    ],
  },
};

export class MoveSignatureHelpProvider implements monaco.languages.SignatureHelpProvider {
  public signatureHelpTriggerCharacters = ['(', ','];
  public signatureHelpRetriggerCharacters = [','];

  public provideSignatureHelp(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    token: monaco.CancellationToken,
    context: monaco.languages.SignatureHelpContext
  ): monaco.languages.ProviderResult<monaco.languages.SignatureHelpResult> {
    const lineContent = model.getLineContent(position.lineNumber);
    const offset = position.column - 1;
    
    // Find the function call
    let functionName = '';
    let parameterIndex = 0;
    let openParenIndex = -1;
    
    // Search backwards for the opening parenthesis
    for (let i = offset - 1; i >= 0; i--) {
      const char = lineContent[i];
      if (char === '(') {
        openParenIndex = i;
        break;
      } else if (char === ')') {
        // We're outside a function call
        return { dispose: () => {}, value: { signatures: [], activeSignature: 0, activeParameter: 0 } };
      }
    }
    
    if (openParenIndex === -1) {
      return { dispose: () => {}, value: { signatures: [], activeSignature: 0, activeParameter: 0 } };
    }
    
    // Extract function name before the opening parenthesis
    const beforeParen = lineContent.substring(0, openParenIndex).trim();
    const functionMatch = beforeParen.match(/([\w:]+)\s*$/);
    
    if (!functionMatch) {
      return { dispose: () => {}, value: { signatures: [], activeSignature: 0, activeParameter: 0 } };
    }
    
    functionName = functionMatch[1];
    
    // Count commas to determine parameter index
    const paramsText = lineContent.substring(openParenIndex + 1, offset);
    parameterIndex = (paramsText.match(/,/g) || []).length;
    
    // Check if we have a signature for this function
    const signature = MOVE_SIGNATURES[functionName];
    
    if (!signature) {
      // Try to match partial function names (e.g., "push_back" matches "vector::push_back")
      const partialMatch = Object.keys(MOVE_SIGNATURES).find(key => key.endsWith('::' + functionName));
      if (partialMatch) {
        const sig = MOVE_SIGNATURES[partialMatch];
        return {
          dispose: () => {},
          value: {
            signatures: [{
              label: sig.label,
              documentation: sig.documentation,
              parameters: sig.parameters.map(p => ({
                label: p.label,
                documentation: p.documentation,
              })),
              activeParameter: Math.min(parameterIndex, sig.parameters.length - 1),
            }],
            activeSignature: 0,
            activeParameter: Math.min(parameterIndex, sig.parameters.length - 1),
          },
        };
      }
      
      return { dispose: () => {}, value: { signatures: [], activeSignature: 0, activeParameter: 0 } };
    }
    
    return {
      dispose: () => {},
      value: {
        signatures: [{
          label: signature.label,
          documentation: signature.documentation,
          parameters: signature.parameters.map(p => ({
            label: p.label,
            documentation: p.documentation,
          })),
          activeParameter: Math.min(parameterIndex, signature.parameters.length - 1),
        }],
        activeSignature: 0,
        activeParameter: Math.min(parameterIndex, signature.parameters.length - 1),
      },
    };
  }
}

// Create singleton instance
export const moveSignatureHelpProvider = new MoveSignatureHelpProvider();