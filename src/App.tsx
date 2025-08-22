import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { WalletProvider } from '@/contexts/WalletContext';
import { LandingPage } from '@/pages/LandingPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { EditorPage } from '@/pages/EditorPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { GAPageView } from '@/components/analytics/GAPageView';
import { initGA } from '@/lib/analytics';
import { ErrorBoundary, AuthErrorFallback } from '@/components/ErrorBoundary';

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Loading IOTA Playground...</span>
      </div>
    </div>
  );
}

// Protected Route wrapper with improved auth handling
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading screen while auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Don't redirect if we're already on the auth callback page
  if (location.pathname === '/auth/callback') {
    return <>{children}</>;
  }

  // Only redirect to home if definitely not authenticated and not loading
  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Main app routes
function AppRoutes() {
  const location = useLocation();
  
  useEffect(() => {
    // Initialize GA only on landing page
    if (location.pathname === '/') {
      initGA();
    }
  }, [location.pathname]);

  return (
    <>
      {location.pathname === '/' && <GAPageView />}
      
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Protected routes */}
        <Route path="/projects" element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id" element={
          <ProtectedRoute>
            <EditorPage />
          </ProtectedRoute>
        } />

        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

// Main App component
export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ErrorBoundary fallback={AuthErrorFallback}>
          <AuthProvider>
            <WalletProvider>
              <AppRoutes />
            </WalletProvider>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;