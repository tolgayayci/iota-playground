import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Loader2,
  Play,
  AlertCircle,
  CheckCircle,
  Github,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { signInWithMagicLink, signInWithGitHub } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { WelcomeDialog } from './WelcomeDialog';
import { motion, AnimatePresence } from 'framer-motion';

type AuthState = 'idle' | 'loading' | 'success' | 'error';

export function SignInDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);
    setIsMagicLinkLoading(true);

    try {
      const { error } = await signInWithMagicLink(email);
      
      if (error) {
        throw error;
      }

      setEmailSent(true);
      
      // Show success toast
      toast({
        title: "Magic link sent!",
        description: "Check your email for the sign-in link.",
      });

    } catch (error) {
      console.error('Magic link error:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to send magic link. Please try again.');
      }
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setError(null);
    setIsGitHubLoading(true);

    try {
      const { error } = await signInWithGitHub();
      
      if (error) {
        throw error;
      }

      // GitHub OAuth will redirect automatically
      // Keep loading state true since we're redirecting
      
    } catch (error) {
      console.error('GitHub sign-in error:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to sign in with GitHub. Please try again.');
      }
      // Only set loading to false on error
      setIsGitHubLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setError(null);
    setAuthState('idle');
    setEmailSent(false);
    setIsGitHubLoading(false);
    setIsMagicLinkLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form immediately when dialog closes
      resetForm();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button data-signin-trigger size="lg" className="hidden">
            Get Started
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Sign in to IOTA Playground</DialogTitle>
          </DialogHeader>

          {/* Header with branding */}
          <div className="flex items-center justify-center py-6 border-b">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <Play className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">
                IOTA Playground
              </h2>
            </motion.div>
          </div>

          <div className="p-6 space-y-6">
            <AnimatePresence mode="wait">
              {!emailSent ? (
                <motion.div
                  key="auth-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Welcome text */}
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Welcome back</h3>
                    <p className="text-sm text-muted-foreground">
                      Sign in to your account to continue
                    </p>
                  </div>

                  {/* GitHub Sign In */}
                  <Button
                    onClick={handleGitHubSignIn}
                    className="w-full h-11 relative group"
                    variant="outline"
                    disabled={isGitHubLoading || isMagicLinkLoading}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center justify-center gap-2 text-foreground group-hover:text-white transition-colors">
                      {isGitHubLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Github className="h-4 w-4" />
                      )}
                      <span>Continue with GitHub</span>
                    </div>
                  </Button>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        or continue with email
                      </span>
                    </div>
                  </div>

                  {/* Email Magic Link Form */}
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setError(null);
                          }}
                          className="pl-10 h-11"
                          disabled={isGitHubLoading || isMagicLinkLoading}
                        />
                      </div>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2"
                      >
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    <Button 
                      type="submit"
                      className="w-full h-11 relative group"
                      disabled={isGitHubLoading || isMagicLinkLoading}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-center justify-center gap-2">
                        {isMagicLinkLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Sending magic link...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            <span>Send magic link</span>
                          </>
                        )}
                      </div>
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="success-message"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 text-center py-8"
                >
                  <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Check your email!</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a magic link to
                    </p>
                    <p className="text-sm font-medium">{email}</p>
                  </div>
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      className="gap-2"
                    >
                      <ArrowRight className="h-4 w-4 rotate-180" />
                      Try different email
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          {!emailSent && (
            <div className="px-6 py-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                By continuing, you agree to our{' '}
                <a href="#" className="underline underline-offset-4 hover:text-primary transition-colors">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="underline underline-offset-4 hover:text-primary transition-colors">
                  Privacy Policy
                </a>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WelcomeDialog 
        open={showWelcome} 
        onOpenChange={setShowWelcome}
      />
    </>
  );
}