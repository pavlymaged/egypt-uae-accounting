import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSessionPermissions = async (session: Session | null) => {
      if (!session?.user) {
        setSession(null);
        setUser(null);
        return;
      }

      const { data: userRoles, error: roleError } = await supabase
        .from('user_roles')
        .select('role, login_enabled')
        .eq('user_id', session.user.id);

      if (roleError) {
        console.error('Session permission check error:', roleError);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return;
      }

      if (!userRoles || userRoles.length === 0) {
        setSession(session);
        setUser(session.user);
        return;
      }

      const hasLoginAccess = userRoles.some(
        (role) => role.login_enabled === true
      );

      if (!hasLoginAccess) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return;
      }

      setSession(session);
      setUser(session.user);
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await checkSessionPermissions(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        void (async () => {
          await checkSessionPermissions(session);
          setLoading(false);
        })();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (data.user) {
        const { data: userRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('role, login_enabled')
          .eq('user_id', data.user.id);

        if (roleError) {
          console.error('Role query error:', roleError);
          await supabase.auth.signOut();
          return { error: new Error(`Failed to verify permissions: ${roleError.message}`) };
        }

        if (userRoles && userRoles.length > 0) {
          const hasLoginAccess = userRoles.some(
            (role) => role.login_enabled === true
          );

          if (!hasLoginAccess) {
            await supabase.auth.signOut();
            return {
              error: new Error('Access denied. Only administrators can log in. Contact your system administrator for access.')
            };
          }
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
