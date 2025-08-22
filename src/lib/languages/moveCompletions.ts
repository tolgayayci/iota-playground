import * as monaco from 'monaco-editor';

// IOTA Move Standard Library Modules
const IOTA_MODULES = [
  // Core IOTA modules
  { label: 'iota::object', detail: 'Object system for IOTA', doc: 'Create and manage objects with unique IDs' },
  { label: 'iota::transfer', detail: 'Transfer and share objects', doc: 'Transfer ownership and share objects' },
  { label: 'iota::tx_context', detail: 'Transaction context', doc: 'Access transaction information' },
  { label: 'iota::event', detail: 'Event emission', doc: 'Emit events from smart contracts' },
  { label: 'iota::coin', detail: 'Coin framework', doc: 'Create and manage fungible tokens' },
  { label: 'iota::balance', detail: 'Balance management', doc: 'Manage coin balances' },
  { label: 'iota::url', detail: 'URL type', doc: 'Handle URL strings' },
  { label: 'iota::clock', detail: 'Clock for timestamps', doc: 'Access blockchain timestamps' },
  { label: 'iota::package', detail: 'Package management', doc: 'Package utilities' },
  { label: 'iota::dynamic_field', detail: 'Dynamic fields', doc: 'Add dynamic fields to objects' },
  { label: 'iota::dynamic_object_field', detail: 'Dynamic object fields', doc: 'Add dynamic object fields' },
  { label: 'iota::table', detail: 'Table data structure', doc: 'Key-value table storage' },
  { label: 'iota::bag', detail: 'Heterogeneous collection', doc: 'Store different types together' },
  { label: 'iota::vec_map', detail: 'Vector-based map', doc: 'Ordered key-value storage' },
  { label: 'iota::vec_set', detail: 'Vector-based set', doc: 'Ordered unique elements' },
  { label: 'iota::linked_table', detail: 'Linked table', doc: 'Linked list table structure' },
  { label: 'iota::priority_queue', detail: 'Priority queue', doc: 'Priority-based queue' },
  { label: 'iota::pay', detail: 'Payment utilities', doc: 'Payment and coin utilities' },
  { label: 'iota::iota', detail: 'IOTA coin', doc: 'Native IOTA token' },
  
  // Standard library modules
  { label: 'std::string', detail: 'String utilities', doc: 'UTF-8 string operations' },
  { label: 'std::vector', detail: 'Vector operations', doc: 'Dynamic array operations' },
  { label: 'std::option', detail: 'Optional values', doc: 'Handle optional values' },
  { label: 'std::fixed_point32', detail: 'Fixed point math', doc: '32-bit fixed point arithmetic' },
  { label: 'std::ascii', detail: 'ASCII strings', doc: 'ASCII string operations' },
  { label: 'std::bcs', detail: 'BCS serialization', doc: 'Binary canonical serialization' },
  { label: 'std::hash', detail: 'Hash functions', doc: 'Cryptographic hash functions' },
  { label: 'std::type_name', detail: 'Type reflection', doc: 'Get type information at runtime' },
];

// Common types and their snippets
const TYPE_COMPLETIONS = [
  {
    label: 'UID',
    kind: monaco.languages.CompletionItemKind.Struct,
    detail: 'iota::object::UID',
    documentation: 'Unique identifier for objects',
    insertText: 'UID',
  },
  {
    label: 'TxContext',
    kind: monaco.languages.CompletionItemKind.Struct,
    detail: 'iota::tx_context::TxContext',
    documentation: 'Transaction context containing sender and epoch info',
    insertText: 'TxContext',
  },
  {
    label: 'String',
    kind: monaco.languages.CompletionItemKind.Struct,
    detail: 'std::string::String',
    documentation: 'UTF-8 encoded string',
    insertText: 'String',
  },
  {
    label: 'Option',
    kind: monaco.languages.CompletionItemKind.Struct,
    detail: 'std::option::Option',
    documentation: 'Optional value container',
    insertText: 'Option<${1:T}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'Coin',
    kind: monaco.languages.CompletionItemKind.Struct,
    detail: 'iota::coin::Coin',
    documentation: 'Fungible token type',
    insertText: 'Coin<${1:T}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'Balance',
    kind: monaco.languages.CompletionItemKind.Struct,
    detail: 'iota::balance::Balance',
    documentation: 'Balance of fungible tokens',
    insertText: 'Balance<${1:T}>',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
];

// Code snippets for common patterns
const CODE_SNIPPETS = [
  {
    label: 'module',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Create a new module',
    documentation: 'Basic module structure',
    insertText: [
      'module ${1:package}::${2:module_name} {',
      '    use iota::object::{Self, UID};',
      '    use iota::tx_context::{Self, TxContext};',
      '    use iota::transfer;',
      '',
      '    ${3:// Your code here}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'for_loop',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'For loop (Move 2024)',
    documentation: 'Iterate over a range or collection',
    insertText: [
      'for (${1:item} in ${2:collection}) {',
      '    ${3:// loop body}',
      '};',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'match_expr',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Match expression (Move 2024)',
    documentation: 'Pattern matching on enums',
    insertText: [
      'match (${1:value}) {',
      '    ${2:Pattern1} => ${3:expr1},',
      '    ${4:Pattern2} => ${5:expr2},',
      '    _ => ${6:default_expr},',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'enum_def',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Enum definition (Move 2024)',
    documentation: 'Define an enum type',
    insertText: [
      'public enum ${1:EnumName} {',
      '    ${2:Variant1},',
      '    ${3:Variant2}(${4:Type}),',
      '    ${5:Variant3} { ${6:field}: ${7:Type} },',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'one_time_witness',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'One-Time Witness pattern',
    documentation: 'IOTA pattern for unique initialization',
    insertText: [
      '/// One-time witness for ${1:MODULE_NAME}',
      'public struct ${2:WITNESS} has drop {}',
      '',
      'fun init(witness: ${2:WITNESS}, ctx: &mut TxContext) {',
      '    assert!(types::is_one_time_witness(&witness), ENotOneTimeWitness);',
      '    ${3:// initialization code}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'publisher_pattern',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Publisher object pattern',
    documentation: 'Create a publisher for package authority',
    insertText: [
      'use iota::package;',
      '',
      'public struct ${1:WITNESS} has drop {}',
      '',
      'fun init(witness: ${1:WITNESS}, ctx: &mut TxContext) {',
      '    let publisher = package::claim(witness, ctx);',
      '    transfer::public_transfer(publisher, tx_context::sender(ctx));',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'display_object',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Display object pattern',
    documentation: 'Configure display for your objects',
    insertText: [
      'use iota::display;',
      '',
      'fun init(witness: ${1:WITNESS}, ctx: &mut TxContext) {',
      '    let publisher = package::claim(witness, ctx);',
      '    let display = display::new<${2:YourType}>(&publisher, ctx);',
      '    ',
      '    display::add_multiple(&mut display, vector[',
      '        string::utf8(b"name"),',
      '        string::utf8(b"description"),',
      '        string::utf8(b"image_url"),',
      '    ], vector[',
      '        string::utf8(b"${3:Object Name}"),',
      '        string::utf8(b"${4:Description}"),',
      '        string::utf8(b"${5:https://example.com/image.png}"),',
      '    ]);',
      '    ',
      '    display::update_version(&mut display);',
      '    transfer::public_transfer(display, tx_context::sender(ctx));',
      '    transfer::public_transfer(publisher, tx_context::sender(ctx));',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'struct_with_key',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Struct with key ability',
    documentation: 'Create an object struct',
    insertText: [
      'public struct ${1:StructName} has key {',
      '    id: UID,',
      '    ${2:// fields}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'struct_with_abilities',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Struct with multiple abilities',
    documentation: 'Create a struct with abilities',
    insertText: [
      'public struct ${1:StructName} has ${2:key, store} {',
      '    ${3:// fields}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'public_fun',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Public function',
    documentation: 'Create a public function',
    insertText: [
      'public fun ${1:function_name}(${2:params}): ${3:ReturnType} {',
      '    ${4:// implementation}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'entry_fun',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Entry function',
    documentation: 'Create an entry point function',
    insertText: [
      'public entry fun ${1:function_name}(${2:params}, ctx: &mut TxContext) {',
      '    ${3:// implementation}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'init_fun',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Init function',
    documentation: 'Module initialization function',
    insertText: [
      'fun init(ctx: &mut TxContext) {',
      '    ${1:// initialization code}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'create_object',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Create and transfer object',
    documentation: 'Create a new object and transfer it',
    insertText: [
      'let ${1:obj} = ${2:StructName} {',
      '    id: object::new(ctx),',
      '    ${3:// fields}',
      '};',
      'transfer::transfer(${1:obj}, tx_context::sender(ctx));',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'share_object',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Create and share object',
    documentation: 'Create a shared object',
    insertText: [
      'let ${1:obj} = ${2:StructName} {',
      '    id: object::new(ctx),',
      '    ${3:// fields}',
      '};',
      'transfer::share_object(${1:obj});',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'emit_event',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Emit an event',
    documentation: 'Emit a custom event',
    insertText: [
      'event::emit(${1:EventStruct} {',
      '    ${2:// event fields}',
      '});',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'test_fun',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Test function',
    documentation: 'Create a test function',
    insertText: [
      '#[test]',
      'fun ${1:test_name}() {',
      '    ${2:// test code}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
  {
    label: 'test_fun_ctx',
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: 'Test with context',
    documentation: 'Test function with TxContext',
    insertText: [
      '#[test]',
      'fun ${1:test_name}(ctx: &mut TxContext) {',
      '    ${2:// test code}',
      '}',
    ].join('\n'),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  },
];

// Function completions
const FUNCTION_COMPLETIONS = [
  // Object functions
  { label: 'object::new', detail: 'Create new UID', insertText: 'object::new(ctx)' },
  { label: 'object::delete', detail: 'Delete UID', insertText: 'object::delete(${1:uid})' },
  { label: 'object::id', detail: 'Get object ID', insertText: 'object::id(&${1:obj})' },
  { label: 'object::id_address', detail: 'Get ID as address', insertText: 'object::id_address(&${1:obj})' },
  
  // Transfer functions
  { label: 'transfer::transfer', detail: 'Transfer ownership', insertText: 'transfer::transfer(${1:obj}, ${2:recipient})' },
  { label: 'transfer::public_transfer', detail: 'Public transfer', insertText: 'transfer::public_transfer(${1:obj}, ${2:recipient})' },
  { label: 'transfer::share_object', detail: 'Make object shared', insertText: 'transfer::share_object(${1:obj})' },
  { label: 'transfer::freeze_object', detail: 'Make object immutable', insertText: 'transfer::freeze_object(${1:obj})' },
  { label: 'transfer::public_freeze_object', detail: 'Public freeze', insertText: 'transfer::public_freeze_object(${1:obj})' },
  
  // TxContext functions
  { label: 'tx_context::sender', detail: 'Get transaction sender', insertText: 'tx_context::sender(ctx)' },
  { label: 'tx_context::epoch', detail: 'Get current epoch', insertText: 'tx_context::epoch(ctx)' },
  { label: 'tx_context::fresh_object_address', detail: 'Get fresh address', insertText: 'tx_context::fresh_object_address(ctx)' },
  
  // String functions
  { label: 'string::utf8', detail: 'Create UTF-8 string', insertText: 'string::utf8(b"${1:text}")' },
  { label: 'string::append', detail: 'Append to string', insertText: 'string::append(&mut ${1:str1}, ${2:str2})' },
  { label: 'string::length', detail: 'Get string length', insertText: 'string::length(&${1:str})' },
  
  // Vector functions
  { label: 'vector::empty', detail: 'Create empty vector', insertText: 'vector::empty<${1:T}>()' },
  { label: 'vector::push_back', detail: 'Add to vector', insertText: 'vector::push_back(&mut ${1:vec}, ${2:elem})' },
  { label: 'vector::pop_back', detail: 'Remove from vector', insertText: 'vector::pop_back(&mut ${1:vec})' },
  { label: 'vector::length', detail: 'Get vector length', insertText: 'vector::length(&${1:vec})' },
  { label: 'vector::borrow', detail: 'Borrow element', insertText: 'vector::borrow(&${1:vec}, ${2:index})' },
  { label: 'vector::borrow_mut', detail: 'Borrow mutable', insertText: 'vector::borrow_mut(&mut ${1:vec}, ${2:index})' },
];

// Register completion provider
export function registerMoveCompletionProvider(monaco: typeof import('monaco-editor')) {
  monaco.languages.registerCompletionItemProvider('move', {
    triggerCharacters: [':', '.', '<'],
    
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const linePrefix = lineContent.substring(0, position.column - 1);

      const suggestions: monaco.languages.CompletionItem[] = [];

      // Check if we're in a 'use' statement
      if (linePrefix.includes('use ')) {
        // Add module suggestions
        IOTA_MODULES.forEach(mod => {
          suggestions.push({
            label: mod.label,
            kind: monaco.languages.CompletionItemKind.Module,
            detail: mod.detail,
            documentation: mod.doc,
            insertText: mod.label,
            range,
          });
        });
      }
      // Check if we're after :: for function calls
      else if (linePrefix.endsWith('::')) {
        // Add function completions
        FUNCTION_COMPLETIONS.forEach(func => {
          if (func.label.startsWith(linePrefix.slice(-20))) {
            suggestions.push({
              label: func.label.split('::')[1] || func.label,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: func.detail,
              insertText: func.insertText.split('::')[1] || func.insertText,
              insertTextRules: func.insertText.includes('${') 
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                : undefined,
              range,
            });
          }
        });
      }
      // Default suggestions
      else {
        // Add snippets
        CODE_SNIPPETS.forEach(snippet => {
          suggestions.push({
            ...snippet,
            range,
          });
        });

        // Add types
        TYPE_COMPLETIONS.forEach(type => {
          suggestions.push({
            ...type,
            range,
          });
        });

        // Add function completions
        FUNCTION_COMPLETIONS.forEach(func => {
          suggestions.push({
            label: func.label,
            kind: monaco.languages.CompletionItemKind.Function,
            detail: func.detail,
            insertText: func.insertText,
            insertTextRules: func.insertText.includes('${') 
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
              : undefined,
            range,
          });
        });
      }

      return { suggestions };
    },
  });
}

// Register hover provider for documentation
export function registerMoveHoverProvider(monaco: typeof import('monaco-editor')) {
  monaco.languages.registerHoverProvider('move', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      // Check for types
      const type = TYPE_COMPLETIONS.find(t => t.label === word.word);
      if (type) {
        return {
          contents: [
            { value: `**${type.label}**` },
            { value: `\`${type.detail}\`` },
            { value: type.documentation as string },
          ],
        };
      }

      // Check for keywords
      const keywords = ['module', 'public', 'fun', 'struct', 'has', 'key', 'store', 'copy', 'drop'];
      if (keywords.includes(word.word)) {
        return {
          contents: [
            { value: `**${word.word}**` },
            { value: `Move keyword` },
          ],
        };
      }

      return null;
    },
  });
}