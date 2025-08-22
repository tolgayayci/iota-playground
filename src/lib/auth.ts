import { supabase } from './supabase';

// Magic Link Authentication
export async function signInWithMagicLink(email: string) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      console.error('Magic link error:', error);
      return { 
        error: new Error(error.message || 'Failed to send magic link. Please try again.') 
      };
    }

    return { error: null };
  } catch (error) {
    console.error('Magic link error:', error);
    return { 
      error: error instanceof Error ? error : new Error('An unexpected error occurred')
    };
  }
}

// GitHub OAuth Authentication
export async function signInWithGitHub() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      console.error('GitHub OAuth error:', error);
      return { 
        error: new Error(error.message || 'Failed to sign in with GitHub. Please try again.') 
      };
    }

    return { error: null };
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return { 
      error: error instanceof Error ? error : new Error('An unexpected error occurred')
    };
  }
}

// Sign out
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to sign out')
    };
  }
}

// Get current user
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    return { user, error: null };
  } catch (error) {
    console.error('Get user error:', error);
    return { 
      user: null, 
      error: error instanceof Error ? error : new Error('Failed to get user')
    };
  }
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

// Refresh session
export async function refreshSession() {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return { session, error: null };
  } catch (error) {
    console.error('Error refreshing session:', error);
    return { 
      session: null, 
      error: error instanceof Error ? error : new Error('Failed to refresh session')
    };
  }
}