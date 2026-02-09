import { createContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔵 AuthContext: Initializing');
    
    // Force loading to false after 1 second maximum
    const timeout = setTimeout(() => {
      console.warn('⚠️ Loading timeout - forcing false');
      setLoading(false);
    }, 1000);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('🔵 Session:', session ? 'Active' : 'None');
        setUser(session?.user ?? null);
        setLoading(false);
        clearTimeout(timeout);
      })
      .catch((err) => {
        console.error('🔴 Session error:', err);
        setLoading(false);
        clearTimeout(timeout);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔵 Auth change:', _event);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    console.log('🔵 Fetching profile for:', user.id);
    
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('🔴 Profile error:', error);
          // If profile doesn't exist, create it
          if (error.code === 'PGRST116') {
            console.log('Creating profile...');
            createProfile(user.id, user.email);
          }
        } else {
          console.log('🟢 Profile loaded:', {
            name: data.name,
            role: data.role,
            department: data.department,
            completed: data.profile_completed
          });
          setProfile(data);
        }
      });
  }, [user?.id]);

  // Create profile if doesn't exist (fallback)
  const createProfile = async (userId, email) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          email: email,
          role: 'STUDENT',
          profile_completed: false
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Exception creating profile:', err);
    }
  };

  const signUp = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { data, error };
    } catch (err) {
      return { error: err };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    } catch (err) {
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      return { error };
    } catch (err) {
      return { error: err };
    }
  };

  const value = {
    user,
    profile,
    role: profile?.role,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
