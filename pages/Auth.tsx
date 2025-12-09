import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GlassCard, GlassInput, NeonButton } from '../components/UI';
import { AlertCircle, CheckCircle } from 'lucide-react';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'signup') setIsLogin(false);
  }, [location]);

  // Helper: Ensure profile exists in DB. Run this after we have a valid session.
  const ensureProfile = async (user: any, preferredUsername?: string) => {
    if (!user) return;
    
    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (fetchError && fetchError.code === 'PGRST205') {
        const msg = "Database tables not found. Please run the code from 'db_setup.sql' in your Supabase SQL Editor.";
        console.error(msg);
        setError(msg);
        return;
    }

    if (!existingProfile) {
        let nameToUse = preferredUsername || user.user_metadata?.username || `User_${user.id.slice(0, 5)}`;
        
        const getProfilePayload = (name: string) => ({
            id: user.id,
            username: name,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            bio: "New to GiggleChat!",
            updated_at: new Date().toISOString()
        });

        // Attempt 1: Try to insert/upsert
        let { error: insertError } = await supabase.from('profiles').upsert(getProfilePayload(nameToUse));

        // Attempt 2: If unique constraint violation (username taken), append random suffix
        if (insertError && insertError.code === '23505') {
            const randomSuffix = Math.floor(Math.random() * 10000);
            nameToUse = `${nameToUse}_${randomSuffix}`;
            console.log(`Username taken. Retrying as ${nameToUse}...`);
            const retry = await supabase.from('profiles').upsert(getProfilePayload(nameToUse));
            insertError = retry.error;
        }

        if (insertError) {
            console.error("Failed to create profile:", insertError);
            if (insertError.code === 'PGRST205') {
                 setError("Database Setup Required: Please run the content of db_setup.sql in Supabase SQL Editor.");
            } else {
                 // Non-critical error, just log it. The user can still chat, profile might just be empty.
                 console.warn(`Failed to initialize profile: ${insertError.message}.`);
            }
        }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            // Check for common errors
            if (error.message.includes("Invalid login credentials")) {
                throw new Error("Incorrect email or password. If you haven't signed up yet, please switch to 'Register Unit'.");
            }
            if (error.message.toLowerCase().includes("email not confirmed")) {
                throw new Error("Please verify your email address before logging in. Check your inbox.");
            }
            throw error;
        }

        if (data.user) {
            await ensureProfile(data.user);
        }
        navigate('/chat');

      } else {
        // --- SIGNUP FLOW ---
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } }
        });
        
        if (signUpError) throw signUpError;

        if (data.session) {
            // Auto-login successful (Email confirm disabled)
            await ensureProfile(data.user, username);
            navigate('/chat');
        } else if (data.user) {
            // User created, waiting for email confirm
            setSuccessMsg("Account created! 📧 Please check your email to confirm your account before logging in.");
            setIsLogin(true);
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      // Detailed error reporting
      let message = "An unexpected error occurred.";
      if (err.message) {
        message = err.message;
      } else if (typeof err === 'object') {
        message = JSON.stringify(err);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] opacity-10 bg-cover bg-center" />
      
      <GlassCard className="w-full max-w-md z-10 backdrop-blur-2xl" glow>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-bold text-white mb-2">{isLogin ? 'WELCOME BACK' : 'INITIATE ACCESS'}</h2>
          <p className="text-gray-400 text-sm">Enter the grid securely.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm animate-pulse break-words flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm flex items-start gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          {!isLogin && (
            <GlassInput 
              label="Username" 
              placeholder="NeonRider2077" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <GlassInput 
            label="Email Identity" 
            type="email" 
            placeholder="user@grid.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <GlassInput 
            label="Access Key" 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <NeonButton type="submit" className="w-full" isLoading={loading} glow>
            {isLogin ? 'Authenticate' : 'Register Unit'}
          </NeonButton>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccessMsg(null);
            }}
            className="text-gray-400 hover:text-neon-blue text-sm transition-colors"
          >
            {isLogin ? "No identity? Create one (Sign Up)." : "Already have an ID? Login."}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};