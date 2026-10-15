import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FFD700]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-[#D32F2F]/10 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md glass-card rounded-3xl p-8 border border-[#FFD700]/20 shadow-2xl relative z-10 bg-[#0a0a0c]/90 backdrop-blur-xl"
      >
        {/* Emblem & Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="relative inline-block">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-[#D32F2F] to-[#FFD700] p-[2px] shadow-xl shadow-[#FFD700]/10">
              <div className="w-full h-full rounded-2xl bg-black flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.svg"
                  alt="Assembly Manager Logo"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#FFD700] text-black p-1.5 rounded-full shadow-md">
              <ShieldCheck size={14} />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-widest uppercase gold-text">
              ASSEMBLY MANAGER
            </h1>
            <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-[0.3em] mt-1">
              Legislative Portal Access
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <p className="text-center text-zinc-500 text-sm">
            Sign in with your Google account to access your legislative records securely in the cloud.
          </p>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl font-black bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="uppercase tracking-wider text-sm">Sign in with Google</span>
              </>
            )}
          </motion.button>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-2">
            < ShieldCheck size={12} />
            Secure Cloud Persistence Enabled
          </p>
        </div>
      </motion.div>
    </div>
  );
};

