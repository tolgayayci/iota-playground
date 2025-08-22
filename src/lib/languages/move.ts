import * as monaco from 'monaco-editor';

// Move Language Configuration
export const moveLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
    ['<', '>'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  indentationRules: {
    increaseIndentPattern: /^.*\{[^}"']*$|^\s*(public\s+)?(fun|struct|module|spec|if|else|while|loop)\b.*$/,
    decreaseIndentPattern: /^\s*[})].*$/,
  },
  folding: {
    markers: {
      start: new RegExp('^\\s*//\\s*#region\\b'),
      end: new RegExp('^\\s*//\\s*#endregion\\b')
    }
  },
  wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
  onEnterRules: [
    {
      // Continue line comments
      beforeText: /^\s*\/\/.*$/,
      action: { indentAction: monaco.languages.IndentAction.None, appendText: '// ' }
    },
    {
      // Indent after opening brace
      beforeText: /^.*\{[^}"']*$/,
      action: { indentAction: monaco.languages.IndentAction.Indent }
    },
  ],
};

// Move Monarch Language Definition (Syntax Highlighting)
export const moveMonarchLanguage: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.move',

  keywords: [
    // Control flow
    'if', 'else', 'while', 'loop', 'for', 'return', 'abort', 'break', 'continue', 'match',
    // Declarations
    'module', 'script', 'fun', 'struct', 'enum', 'const', 'let', 'mut', 'type',
    // Visibility
    'public', 'friend', 'entry', 'native',
    // Abilities
    'has', 'copy', 'drop', 'store', 'key',
    // Import/Use
    'use', 'as',
    // Move-specific
    'move', 'acquires', 'phantom', 'witness',
    // Spec language
    'spec', 'schema', 'invariant', 'assert', 'assume', 'modifies', 'ensures', 'requires',
    'aborts_if', 'succeeds_if', 'emits', 'pragma', 'apply', 'except', 'global', 'local',
    'post', 'pack', 'unpack', 'update', 'include',
    // Constants
    'true', 'false',
    // References
    'Self',
  ],

  typeKeywords: [
    'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
    'bool', 'address', 'signer', 'vector',
    'String', 'Option', 'UID', 'ID', 'TxContext',
  ],

  // Built-in functions and macros
  builtins: [
    'borrow', 'borrow_mut', 'move_from', 'move_to', 'exists', 'freeze',
    'assert!', 'vector', 'option', 'transfer', 'object', 'event',
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
    '%=', '<<=', '>>=', '=>', '::', '..', '..=', '&mut', '&', '->',
    'as?', '==>',
  ],

  // We include these common regular expressions
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  
  // Escapes
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  
  // Hexadecimal
  hexdigits: /[0-9a-fA-F]+(_[0-9a-fA-F]+)*/,
  
  // Binary
  binarydigits: /[0-1]+(_[0-1]+)*/,

  // The main tokenizer
  tokenizer: {
    root: [
      // Attributes and test directives
      [/#\[.*?\]/, 'annotation'],
      [/#\[test.*?\]/, 'annotation.test'],
      [/#\[expected_failure.*?\]/, 'annotation.failure'],
      [/#\[test_only\]/, 'annotation.test'],
      
      // Module addresses (e.g., @0x1, @std, @iota)
      [/@[a-zA-Z_]\w*/, 'namespace'],
      [/@\{[^}]+\}/, 'namespace.interpolated'],
      
      // Hex addresses (e.g., 0x1, 0x42) - includes @ prefix
      [/[@]?0x[0-9a-fA-F]+/, 'number.hex'],
      
      // Method calls (e.g., obj.method())
      [/\b[a-zA-Z_]\w*(?=\s*\.\s*[a-zA-Z_]\w*\s*\()/, 'variable.object'],
      [/(?<=\.\s*)[a-zA-Z_]\w*(?=\s*\()/, 'function.method'],
      
      // Identifiers and keywords
      [/[a-zA-Z_$][\w$]*/, {
        cases: {
          '@typeKeywords': 'type',
          '@keywords': 'keyword',
          '@builtins': 'predefined',
          '@default': 'identifier'
        }
      }],
      
      // Type parameters with constraints (e.g., <T: copy + drop>)
      [/<[a-zA-Z_]\w*(?:\s*:\s*[a-zA-Z_]\w*(?:\s*\+\s*[a-zA-Z_]\w*)*)?(?:\s*,\s*[a-zA-Z_]\w*(?:\s*:\s*[a-zA-Z_]\w*(?:\s*\+\s*[a-zA-Z_]\w*)*)?)*>/, 'type.parameter'],
      
      // Whitespace
      { include: '@whitespace' },
      
      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],
      
      // Numbers
      [/0[bB]@binarydigits/, 'number.binary'],
      [/0[xX]@hexdigits/, 'number.hex'],
      [/\d+(_\d+)*/, 'number'],
      
      // Delimiter: after number because of .\d floats
      [/[;,.]/, 'delimiter'],
      
      // Strings
      [/b?"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated string
      [/b?"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      
      // Byte strings
      [/b'[^\\']'/, 'string'],
      [/(b')(@escapes)(')/, ['string', 'string.escape', 'string']],
      [/b'/, 'string.invalid'],
      
      // Characters
      [/'[^\\']'/, 'string'],
      [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
      [/'/, 'string.invalid'],
    ],
    
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],    // nested comment
      ["\\*/", 'comment', '@pop'],
      [/[\/*]/, 'comment']
    ],
    
    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
    ],
    
    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
    ],
  },
};

// Register Move language with Monaco
export function registerMoveLanguage(monaco: typeof import('monaco-editor')) {
  // Register the language
  monaco.languages.register({ 
    id: 'move',
    extensions: ['.move'],
    aliases: ['Move', 'move'],
    mimetypes: ['text/x-move', 'text/move'],
  });

  // Set language configuration
  monaco.languages.setLanguageConfiguration('move', moveLanguageConfig);

  // Set the tokenizer
  monaco.languages.setMonarchTokensProvider('move', moveMonarchLanguage);
}