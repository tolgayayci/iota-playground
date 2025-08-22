import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    let mounted = true;

    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processing auth callback...');
        setStatus('Completing authentication...');
        
        // Wait for auth state to settle
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ Auth callback error:', error);
            if (mounted) {
              setStatus('Authentication failed. Redirecting...');
              setTimeout(() => navigate('/', { replace: true }), 2000);
            }
            return;
          }
          
          if (session?.user) {
            console.log('✅ Authentication successful:', session.user.email);
            if (mounted) {
              setStatus('Authentication successful! Redirecting...');
              
              // Navigate to projects page immediately
              navigate('/projects', { replace: true });
            }
            return;
          }
          
          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }
        
        // If we get here, authentication failed
        console.log('❌ Authentication timeout');
        if (mounted) {
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      } catch (error) {
        console.error('❌ Unexpected error:', error);
        if (mounted) {
          setStatus('An error occurred. Redirecting...');
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      }
    };

    handleAuthCallback();
    
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">{status}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Please wait while we complete your authentication...
        </div>
      </div>
    </div>
  );
}