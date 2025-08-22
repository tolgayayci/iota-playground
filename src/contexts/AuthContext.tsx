import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Use refs to track initialization state without causing re-renders
  const isInitialized = useRef(false);
  const authListenerRef = useRef<any>(null);

  // Helper function to ensure user exists in database
  const ensureUserInDatabase = useCallback(async (authUser: any): Promise<User | null> => {
    if (!authUser?.id) return null;

    try {
      // Try to get existing user
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching user:', fetchError);
        return null;
      }

      if (existingUser) {
        return existingUser;
      }

      // Create new user
      console.log('Creating new user:', authUser.email);
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
        })
        .select()
        .single();

      if (insertError) {
        // Handle duplicate user (race condition)
        if (insertError.code === '23505') {
          const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          return user;
        }
        console.error('Error creating user:', insertError);
        return null;
      }

      // Create starter projects for new user
      if (newUser) {
        const starterProjects = [
          {
            user_id: authUser.id,
            name: 'Hello World',
            description: 'A simple Hello World smart contract to get started with Move on IOTA',
            code: `module hello_world::greetings {
    use std::string::{Self, String};
    use iota::event;
    use iota::tx_context::{Self, TxContext};

    public struct GreetingEvent has copy, drop {
        message: String,
        greeter: address,
    }

    public fun greet(ctx: &mut TxContext): String {
        let greeting = string::utf8(b"Hello, IOTA World!");
        
        event::emit(GreetingEvent {
            message: greeting,
            greeter: tx_context::sender(ctx)
        });
        
        greeting
    }
}`,
            language: 'move',
            is_template: false,
          },
          {
            user_id: authUser.id,
            name: 'Counter',
            description: 'A basic counter smart contract demonstrating state management in Move',
            code: `module counter::counter {
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;

    public struct Counter has key, store {
        id: UID,
        value: u64,
        owner: address,
    }

    public fun create_counter(initial_value: u64, ctx: &mut TxContext) {
        let counter = Counter {
            id: object::new(ctx),
            value: initial_value,
            owner: tx_context::sender(ctx),
        };
        transfer::transfer(counter, tx_context::sender(ctx));
    }

    public fun get_value(counter: &Counter): u64 {
        counter.value
    }

    public entry fun increment(counter: &mut Counter, _: &mut TxContext) {
        counter.value = counter.value + 1;
    }
}`,
            language: 'move',
            is_template: false,
          }
        ];

        const { data: projects, error: projectError } = await supabase
          .from('projects')
          .insert(starterProjects)
          .select();

        if (!projectError && projects?.length > 0) {
          // Navigate to first project for new users
          setTimeout(() => navigate(`/projects/${projects[0].id}`), 100);
        }
      }

      return newUser;
    } catch (error) {
      console.error('Error in ensureUserInDatabase:', error);
      return null;
    }
  }, [navigate]);

  // Initialize authentication
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // Prevent multiple initializations
      if (isInitialized.current) {
        return;
      }
      isInitialized.current = true;

      try {
        console.log('🔐 Initializing authentication...');
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }

        if (!mounted) return;

        if (session?.user) {
          console.log('✅ Active session found:', session.user.email);
          
          // Set auth state immediately for better UX
          setIsAuthenticated(true);
          setUser({ id: session.user.id, email: session.user.email || '' } as User);
          
          // Set loading to false after auth state is set
          setIsLoading(false);
          
          // Ensure user exists in database (async, don't block UI)
          ensureUserInDatabase(session.user).then(userData => {
            if (mounted && userData) {
              setUser(userData);
            }
          });
        } else {
          console.log('ℹ️ No active session');
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setError('Failed to initialize authentication');
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    // Set up auth state listener
    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔄 Auth event:', event);
          
          if (!mounted) return;

          switch (event) {
            case 'SIGNED_IN':
              if (session?.user) {
                console.log('✅ User signed in:', session.user.email);
                setIsAuthenticated(true);
                setUser({ id: session.user.id, email: session.user.email || '' } as User);
                setIsLoading(false);
                
                // Ensure user in database (async)
                ensureUserInDatabase(session.user).then(userData => {
                  if (mounted && userData) {
                    setUser(userData);
                  }
                });
              }
              break;

            case 'SIGNED_OUT':
              console.log('👋 User signed out');
              setUser(null);
              setIsAuthenticated(false);
              setIsLoading(false);
              navigate('/');
              break;

            case 'TOKEN_REFRESHED':
              console.log('🔄 Token refreshed');
              if (session?.user) {
                setIsAuthenticated(true);
                // Update user data after token refresh
                ensureUserInDatabase(session.user).then(userData => {
                  if (mounted && userData) {
                    setUser(userData);
                  }
                });
              }
              break;

            case 'USER_UPDATED':
              console.log('👤 User updated');
              if (session?.user) {
                setIsAuthenticated(true);
                ensureUserInDatabase(session.user).then(userData => {
                  if (mounted && userData) {
                    setUser(userData);
                  }
                });
              }
              break;
          }
        }
      );

      authListenerRef.current = subscription;
    };

    // Initialize auth and set up listener
    initializeAuth();
    setupAuthListener();

    // Cleanup
    return () => {
      mounted = false;
      authListenerRef.current?.unsubscribe();
    };
  }, [ensureUserInDatabase, navigate]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // State will be updated by auth listener
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const userData = await ensureUserInDatabase(authUser);
        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  }, [isAuthenticated, ensureUserInDatabase]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    error,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}