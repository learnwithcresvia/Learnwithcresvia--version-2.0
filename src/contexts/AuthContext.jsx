// src/contexts/AuthContext.jsx
import { createContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      return data || null;
    } catch { return null; }
  }

  useEffect(() => {
    mounted.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted.current) return;
        console.log('Auth event:', event);

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);

          // Set a minimal profile IMMEDIATELY so app doesn't spin
          // This lets the page render right away
          setProfile({
            id:                session.user.id,
            email:             session.user.email,
            role:              'STUDENT',       // safe default
            profile_completed: true,            // safe default
            name:              session.user.email.split('@')[0],
          });
          setLoading(false);

          // Then fetch real profile in background and update
          fetchProfile(session.user.id).then(realProfile => {
            if (mounted.current && realProfile) {
              setProfile(realProfile);
            }
          });
        } else {
          setLoading(false);
        }
      }
    );

    // Safety bail
    const bail = setTimeout(() => {
      if (mounted.current) setLoading(false);
    }, 4000);

    return () => {
      mounted.current = false;
      clearTimeout(bail);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password) =>
    supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (mounted.current && p) setProfile(p);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
