import * as monaco from 'monaco-editor';

/**
 * Move Diagnostic Provider for real-time error detection
 */

interface MoveError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export class MoveDiagnosticProvider {
  private diagnosticCollection: monaco.editor.IMarkerData[] = [];
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;

  constructor() {
    this.diagnosticCollection = [];
  }

  /**
   * Set the editor instance
   */
  public setEditor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
  }

  /**
   * Validate Move code and return diagnostics
   */
  public validateMoveCode(code: string): monaco.editor.IMarkerData[] {
    const markers: monaco.editor.IMarkerData[] = [];
    const lines = code.split('\n');

    // Check for common Move syntax errors
    lines.forEach((line, lineIndex) => {
      // Check for missing semicolons (except for block endings and comments)
      if (this.needsSemicolon(line, lines, lineIndex)) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: lineIndex + 1,
          startColumn: line.length + 1,
          endLineNumber: lineIndex + 1,
          endColumn: line.length + 2,
          message: 'Missing semicolon',
        });
      }

      // Check for invalid use statements
      const useMatch = line.match(/^\s*use\s+([^;]+)/);
      if (useMatch) {
        const useStatement = useMatch[1];
        if (!useStatement.includes('::')) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: lineIndex + 1,
            startColumn: line.indexOf('use') + 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            message: 'Invalid use statement: missing module path separator "::"',
          });
        }
        // Check for sui:: instead of iota::
        if (useStatement.includes('sui::')) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            startLineNumber: lineIndex + 1,
            startColumn: line.indexOf('sui::') + 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.indexOf('sui::') + 5,
            message: 'Use "iota::" instead of "sui::" for IOTA Move',
          });
        }
      }

      // Check for mismatched brackets
      const openBrackets = (line.match(/\{/g) || []).length;
      const closeBrackets = (line.match(/\}/g) || []).length;
      if (lineIndex === lines.length - 1 && openBrackets !== closeBrackets) {
        const totalOpen = lines.join('').split('{').length - 1;
        const totalClose = lines.join('').split('}').length - 1;
        if (totalOpen > totalClose) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            message: `Unmatched opening bracket: expected ${totalOpen - totalClose} more closing bracket(s)`,
          });
        }
      }

      // Check for invalid visibility modifiers
      const visibilityMatch = line.match(/^\s*(public|friend|entry|native)/);
      if (visibilityMatch) {
        const nextWord = line.substring(line.indexOf(visibilityMatch[1]) + visibilityMatch[1].length).trim();
        if (!nextWord.startsWith('fun') && !nextWord.startsWith('struct') && !nextWord.startsWith('entry')) {
          if (visibilityMatch[1] !== 'entry' || !nextWord.startsWith('fun')) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: lineIndex + 1,
              startColumn: line.indexOf(visibilityMatch[1]) + 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.indexOf(visibilityMatch[1]) + visibilityMatch[1].length + 1,
              message: `Invalid use of '${visibilityMatch[1]}' modifier`,
            });
          }
        }
      }

      // Check for deprecated Move 2024 syntax
      if (line.includes('resource struct')) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: lineIndex + 1,
          startColumn: line.indexOf('resource') + 1,
          endLineNumber: lineIndex + 1,
          endColumn: line.indexOf('resource') + 9,
          message: 'Deprecated: use "struct Name has key" instead of "resource struct" in Move 2024',
        });
      }

      // Check for missing type parameters
      const genericMatch = line.match(/struct\s+(\w+)\s*<([^>]*)>/);
      if (genericMatch && genericMatch[2].trim() === '') {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: lineIndex + 1,
          startColumn: line.indexOf('<') + 1,
          endLineNumber: lineIndex + 1,
          endColumn: line.indexOf('>') + 2,
          message: 'Empty type parameter list',
        });
      }

      // Check for invalid address literals
      const addressMatch = line.match(/@(0x[0-9a-fA-F]*)/g);
      if (addressMatch) {
        addressMatch.forEach(addr => {
          const hex = addr.substring(3); // Remove @0x
          if (hex.length !== 0 && hex.length !== 64) {
            const col = line.indexOf(addr);
            markers.push({
              severity: monaco.MarkerSeverity.Warning,
              startLineNumber: lineIndex + 1,
              startColumn: col + 1,
              endLineNumber: lineIndex + 1,
              endColumn: col + addr.length + 1,
              message: 'Address should be 32 bytes (64 hex characters) or use 0x0 for placeholder',
            });
          }
        });
      }

      // Check for unused variables (simple heuristic)
      const letMatch = line.match(/let\s+(\w+)\s*=/);
      if (letMatch) {
        const varName = letMatch[1];
        if (varName.startsWith('_')) {
          // Intentionally unused, skip
        } else {
          const restOfCode = lines.slice(lineIndex + 1).join('\n');
          if (!restOfCode.includes(varName)) {
            markers.push({
              severity: monaco.MarkerSeverity.Warning,
              startLineNumber: lineIndex + 1,
              startColumn: line.indexOf(varName) + 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.indexOf(varName) + varName.length + 1,
              message: `Variable '${varName}' is never used. Prefix with '_' to indicate intentional unused variable`,
            });
          }
        }
      }

      // Check for missing return type
      const funMatch = line.match(/fun\s+\w+\s*\([^)]*\)\s*{/);
      if (funMatch && !line.includes(':') && !line.includes('()')) {
        const hasReturn = lines.slice(lineIndex).some(l => l.includes('return'));
        if (hasReturn) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            startLineNumber: lineIndex + 1,
            startColumn: 1,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            message: 'Function has return statement but no return type specified',
          });
        }
      }

      // Check for invalid abilities
      const abilityMatch = line.match(/has\s+([^{;]+)/);
      if (abilityMatch) {
        const abilities = abilityMatch[1].split(',').map(a => a.trim());
        const validAbilities = ['copy', 'drop', 'store', 'key'];
        abilities.forEach(ability => {
          if (!validAbilities.includes(ability)) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: lineIndex + 1,
              startColumn: line.indexOf(ability) + 1,
              endLineNumber: lineIndex + 1,
              endColumn: line.indexOf(ability) + ability.length + 1,
              message: `Invalid ability '${ability}'. Valid abilities are: ${validAbilities.join(', ')}`,
            });
          }
        });
      }

      // Check for missing module declaration
      if (lineIndex === 0 && !line.includes('module') && !line.includes('script') && line.trim() !== '' && !line.trim().startsWith('//')) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: 'File should start with a module or script declaration',
        });
      }
    });

    // Check for balanced parentheses in the entire code
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: lines.length,
        startColumn: 1,
        endLineNumber: lines.length,
        endColumn: lines[lines.length - 1].length + 1,
        message: `Unmatched parentheses: ${openParens} opening, ${closeParens} closing`,
      });
    }

    return markers;
  }

  /**
   * Check if a line needs a semicolon
   */
  private needsSemicolon(line: string, lines: string[], lineIndex: number): boolean {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) return false;
    
    // Skip lines that already have semicolons
    if (trimmed.endsWith(';')) return false;
    
    // Skip lines ending with brackets or module/struct declarations
    if (trimmed.endsWith('{') || trimmed.endsWith('}')) return false;
    
    // Skip module, struct, fun declarations (they have opening brackets)
    if (trimmed.startsWith('module') || trimmed.startsWith('struct') || trimmed.startsWith('fun')) {
      if (trimmed.includes('{') || (lineIndex + 1 < lines.length && lines[lineIndex + 1].trim().startsWith('{'))) {
        return false;
      }
    }
    
    // Skip ability declarations
    if (trimmed.includes('has ')) return false;
    
    // Check if this looks like a statement that needs a semicolon
    const needsSemi = trimmed.match(/^(let|const|use|return|abort|assert|move_to|move_from|borrow|freeze)/);
    
    return needsSemi !== null;
  }

  /**
   * Update diagnostics in the editor
   */
  public updateDiagnostics(model: monaco.editor.ITextModel) {
    const code = model.getValue();
    const markers = this.validateMoveCode(code);
    monaco.editor.setModelMarkers(model, 'move', markers);
  }

  /**
   * Parse compiler output and convert to diagnostics
   */
  public parseCompilerOutput(output: string): MoveError[] {
    const errors: MoveError[] = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      // Parse IOTA Move compiler error format
      // Example: "error[E01001]: type mismatch at sources/hello_world.move:10:5"
      const errorMatch = line.match(/^(error|warning)\[([A-Z0-9]+)\]:\s*(.+)\s+at\s+.+:(\d+):(\d+)/);
      if (errorMatch) {
        errors.push({
          line: parseInt(errorMatch[4]),
          column: parseInt(errorMatch[5]),
          message: errorMatch[3],
          severity: errorMatch[1] as 'error' | 'warning',
        });
      }
      
      // Alternative format: "┌─ sources/hello_world.move:10:5"
      const locationMatch = line.match(/┌─\s+.+:(\d+):(\d+)/);
      if (locationMatch && errors.length > 0) {
        const lastError = errors[errors.length - 1];
        lastError.line = parseInt(locationMatch[1]);
        lastError.column = parseInt(locationMatch[2]);
      }
    });
    
    return errors;
  }

  /**
   * Apply compiler diagnostics to the editor
   */
  public applyCompilerDiagnostics(model: monaco.editor.ITextModel, compilerOutput: string) {
    const errors = this.parseCompilerOutput(compilerOutput);
    const markers: monaco.editor.IMarkerData[] = errors.map(error => ({
      severity: error.severity === 'error' 
        ? monaco.MarkerSeverity.Error 
        : error.severity === 'warning' 
        ? monaco.MarkerSeverity.Warning 
        : monaco.MarkerSeverity.Info,
      startLineNumber: error.line,
      startColumn: error.column,
      endLineNumber: error.line,
      endColumn: error.column + 10, // Approximate end column
      message: error.message,
    }));
    
    monaco.editor.setModelMarkers(model, 'move-compiler', markers);
  }
}

// Create singleton instance
export const moveDiagnosticProvider = new MoveDiagnosticProvider();