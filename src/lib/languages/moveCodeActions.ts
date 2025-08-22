import * as monaco from 'monaco-editor';

/**
 * Move Code Actions Provider for quick fixes and refactoring
 */

export class MoveCodeActionsProvider implements monaco.languages.CodeActionProvider {
  public provideCodeActions(
    model: monaco.editor.ITextModel,
    range: monaco.Range,
    context: monaco.languages.CodeActionContext,
    token: monaco.CancellationToken
  ): monaco.languages.ProviderResult<monaco.languages.CodeActionList> {
    const actions: monaco.languages.CodeAction[] = [];
    const text = model.getValueInRange(range);
    const lineContent = model.getLineContent(range.startLineNumber);
    
    // Quick fix for sui:: to iota::
    if (lineContent.includes('sui::')) {
      actions.push({
        title: 'Replace sui:: with iota::',
        kind: 'quickfix',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(
                range.startLineNumber,
                1,
                range.startLineNumber,
                lineContent.length + 1
              ),
              text: lineContent.replace(/sui::/g, 'iota::'),
            },
          }],
        },
        diagnostics: context.markers.filter(m => m.message.includes('iota::')),
      });
    }
    
    // Quick fix for missing semicolon
    const missingSemicolon = context.markers.find(m => m.message.includes('Missing semicolon'));
    if (missingSemicolon) {
      actions.push({
        title: 'Add semicolon',
        kind: 'quickfix',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(
                missingSemicolon.startLineNumber,
                model.getLineLength(missingSemicolon.startLineNumber) + 1,
                missingSemicolon.startLineNumber,
                model.getLineLength(missingSemicolon.startLineNumber) + 1
              ),
              text: ';',
            },
          }],
        },
        diagnostics: [missingSemicolon],
      });
    }
    
    // Quick fix for unused variables
    const unusedVar = context.markers.find(m => m.message.includes('is never used'));
    if (unusedVar) {
      const varMatch = unusedVar.message.match(/Variable '(\w+)' is never used/);
      if (varMatch) {
        const varName = varMatch[1];
        actions.push({
          title: `Prefix '${varName}' with underscore`,
          kind: 'quickfix',
          edit: {
            edits: [{
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: {
                range: new monaco.Range(
                  unusedVar.startLineNumber,
                  unusedVar.startColumn,
                  unusedVar.endLineNumber,
                  unusedVar.endColumn
                ),
                text: '_' + varName,
              },
            }],
          },
          diagnostics: [unusedVar],
        });
      }
    }
    
    // Quick fix for deprecated resource struct
    if (lineContent.includes('resource struct')) {
      const structName = lineContent.match(/resource\s+struct\s+(\w+)/)?.[1] || 'Name';
      actions.push({
        title: 'Convert to Move 2024 syntax',
        kind: 'quickfix',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(
                range.startLineNumber,
                1,
                range.startLineNumber,
                lineContent.length + 1
              ),
              text: lineContent.replace(/resource\s+struct/, 'struct') + ' has key',
            },
          }],
        },
      });
    }
    
    // Refactoring: Extract function
    if (text && text.trim().length > 0 && !text.includes('fun ')) {
      actions.push({
        title: 'Extract to function',
        kind: 'refactor.extract.function',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: range,
              text: 'extracted_function();\n    }\n\n    fun extracted_function() {\n        ' + text,
            },
          }],
        },
      });
    }
    
    // Refactoring: Add return type annotation
    const funMatch = lineContent.match(/fun\s+(\w+)\s*\([^)]*\)\s*{/);
    if (funMatch && !lineContent.includes(':')) {
      actions.push({
        title: 'Add return type annotation',
        kind: 'refactor',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(
                range.startLineNumber,
                lineContent.indexOf(')') + 1,
                range.startLineNumber,
                lineContent.indexOf(')') + 1
              ),
              text: ': ()',
            },
          }],
        },
      });
    }
    
    // Quick fix: Import common modules
    const modules = [
      { name: 'transfer', full: 'use iota::transfer;' },
      { name: 'object', full: 'use iota::object::{Self, UID};' },
      { name: 'tx_context', full: 'use iota::tx_context::{Self, TxContext};' },
      { name: 'coin', full: 'use iota::coin::{Self, Coin};' },
      { name: 'balance', full: 'use iota::balance::{Self, Balance};' },
      { name: 'event', full: 'use iota::event;' },
      { name: 'package', full: 'use iota::package;' },
      { name: 'display', full: 'use iota::display;' },
      { name: 'table', full: 'use iota::table::{Self, Table};' },
      { name: 'vector', full: 'use std::vector;' },
      { name: 'option', full: 'use std::option::{Self, Option};' },
      { name: 'string', full: 'use std::string::{Self, String};' },
    ];
    
    for (const mod of modules) {
      if (lineContent.includes(mod.name + '::') && !model.getValue().includes('use ' + mod.name.includes('::') ? mod.name.split('::')[0] : 'iota::' + mod.name)) {
        actions.push({
          title: `Import ${mod.name}`,
          kind: 'quickfix',
          edit: {
            edits: [{
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: {
                range: new monaco.Range(1, 1, 1, 1),
                text: mod.full + '\n',
              },
            }],
          },
        });
      }
    }
    
    // Quick fix: Add missing abilities
    const structMatch = lineContent.match(/struct\s+(\w+)\s*{/);
    if (structMatch && !lineContent.includes('has ')) {
      const commonAbilities = [
        { combo: 'key', desc: 'Can be used as an object' },
        { combo: 'store', desc: 'Can be stored in other structs' },
        { combo: 'copy, drop', desc: 'Can be copied and dropped' },
        { combo: 'key, store', desc: 'Can be an object and stored' },
        { combo: 'copy, drop, store', desc: 'Full value semantics' },
      ];
      
      for (const ability of commonAbilities) {
        actions.push({
          title: `Add abilities: ${ability.combo} (${ability.desc})`,
          kind: 'quickfix',
          edit: {
            edits: [{
              resource: model.uri,
              versionId: model.getVersionId(),
              textEdit: {
                range: new monaco.Range(
                  range.startLineNumber,
                  lineContent.indexOf('{'),
                  range.startLineNumber,
                  lineContent.indexOf('{')
                ),
                text: ' has ' + ability.combo + ' ',
              },
            }],
          },
        });
      }
    }
    
    // Quick fix: Convert to public function
    const privateFunMatch = lineContent.match(/^\s*fun\s+(\w+)/);
    if (privateFunMatch && !lineContent.includes('public') && !lineContent.includes('entry')) {
      actions.push({
        title: 'Make function public',
        kind: 'refactor',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(
                range.startLineNumber,
                lineContent.indexOf('fun'),
                range.startLineNumber,
                lineContent.indexOf('fun')
              ),
              text: 'public ',
            },
          }],
        },
      });
      
      actions.push({
        title: 'Make function entry',
        kind: 'refactor',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(
                range.startLineNumber,
                lineContent.indexOf('fun'),
                range.startLineNumber,
                lineContent.indexOf('fun')
              ),
              text: 'public entry ',
            },
          }],
        },
      });
    }
    
    // Quick fix: Add init function
    if (!model.getValue().includes('fun init')) {
      actions.push({
        title: 'Add init function',
        kind: 'source.addFunction',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(
                model.getLineCount(),
                model.getLineLength(model.getLineCount()) + 1,
                model.getLineCount(),
                model.getLineLength(model.getLineCount()) + 1
              ),
              text: '\n\n    fun init(ctx: &mut TxContext) {\n        // Initialize module\n    }',
            },
          }],
        },
      });
    }
    
    // Quick fix: Wrap in module
    if (!model.getValue().includes('module ')) {
      actions.push({
        title: 'Wrap in module declaration',
        kind: 'refactor',
        edit: {
          edits: [{
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(1, 1, model.getLineCount(), model.getLineLength(model.getLineCount()) + 1),
              text: 'module example::my_module {\n    ' + model.getValue().replace(/\n/g, '\n    ') + '\n}',
            },
          }],
        },
      });
    }
    
    return {
      actions: actions,
      dispose: () => {},
    };
  }
}

// Create singleton instance
export const moveCodeActionsProvider = new MoveCodeActionsProvider();