import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, X, AlertCircle, FileCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateMoveToml, formatValidationErrors } from '@/lib/moveTomlValidation';
import { apiRequest } from '@/lib/api';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';

interface MoveTomlEditorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
}

export function MoveTomlEditor({ isOpen, onClose, projectId, projectName }: MoveTomlEditorProps) {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const editorRef = useRef<any>(null);
  const { toast } = useToast();
  const { theme } = useTheme();
  const { user } = useAuth();

  // Load Move.toml content when dialog opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadMoveToml();
    }
  }, [isOpen, projectId]);

  // Validate content on change
  useEffect(() => {
    if (content) {
      const validation = validateMoveToml(content);
      setValidationErrors(validation.errors || []);
    }
  }, [content]);

  const loadMoveToml = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest(`/move-toml/${user.id}/${projectId}`, {
        method: 'GET',
      });
      
      if (response.success && response.data) {
        setContent(response.data.content);
        setOriginalContent(response.data.content);
      }
    } catch (error: any) {
      console.error('Failed to load Move.toml:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load Move.toml',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    // Validate before saving
    const validation = validateMoveToml(content);
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the validation errors before saving',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest(`/move-toml/${user.id}/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
      
      if (response.success) {
        setOriginalContent(content);
        toast({
          title: 'Success',
          description: 'Move.toml updated successfully',
        });
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to save Move.toml:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save Move.toml',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (content !== originalContent) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirm) return;
    }
    onClose();
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const hasChanges = content !== originalContent;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl h-[60vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileCode className="h-4 w-4" />
            Edit Move.toml
            {projectName && (
              <span className="text-sm text-muted-foreground">
                • {projectName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <Alert variant="destructive" className="mx-4 mt-2 mb-0">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    <span className="font-medium">Validation Errors: </span>
                    {validationErrors.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Editor */}
              <div className="flex-1 p-3">
                <div className="h-full border rounded-md overflow-hidden">
                  <Editor
                    height="100%"
                    defaultLanguage="toml"
                    language="toml"
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    value={content}
                    onChange={(value) => setContent(value || '')}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      renderWhitespace: 'selection',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      wrappingIndent: 'indent',
                      automaticLayout: true,
                      formatOnType: true,
                      formatOnPaste: true,
                      tabSize: 2,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-4 py-3 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              {hasChanges && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  • Unsaved changes
                </span>
              )}
              {!hasChanges && content && (
                <span className="text-green-600 dark:text-green-400">
                  ✓ No changes
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasChanges || validationErrors.length > 0}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}