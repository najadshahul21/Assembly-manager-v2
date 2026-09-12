import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, KeyRound, Upload, Image as ImageIcon, UserPlus, LogIn, Check } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, register, profiles } = useAuth();
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');

  // Sign in state
  const [signInUsername, setSignInUsername] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regImageBase64, setRegImageBase64] = useState<string>('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle Image Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Image size should be under 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegImageBase64(reader.result as string);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const result = login(signInUsername, signInPassword);
      if (!result.success) {
        setError(result.error || 'Invalid credentials');
        setIsLoading(false);
      }
    }, 400);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const result = register({
        name: regName,
        username: regUsername,
        password: regPassword,
        imageUrl: regImageBase64 || undefined
      });

      if (!result.success) {
        setError(result.error || 'Registration failed');
        setIsLoading(false);
      } else {
        setSuccessMsg('Profile created successfully! Signing in...');
      }
    }, 400);
  };

  const handleQuickFill = (username: string) => {
    setSignInUsername(username);
    setSignInPassword('password');
    setError('');
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
        className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 border border-[#FFD700]/20 shadow-2xl relative z-10 bg-[#0a0a0c]/90 backdrop-blur-xl"
      >
        {/* Emblem & Header */}
        <div className="text-center space-y-2.5 mb-6">
          <div
            className="relative inline-block cursor-pointer group"
            onClick={() => window.dispatchEvent(new CustomEvent('replay-logo-intro'))}
            title="Replay Intro Animation"
          >
            <div className="w-20 h-20 mx-auto rounded-2xl bg-black border border-white/20 p-1 shadow-2xl shadow-black/80 flex items-center justify-center overflow-hidden group-hover:border-white/40 group-hover:scale-105 transition-all">
              <img
                src="/logo.svg"
                alt="Assembly Manager Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white text-black p-1 rounded-full shadow-md border border-black/20">
              <ShieldCheck size={12} />
            </div>
          </div>

          <div>
            <h1 className="text-xl font-black tracking-widest uppercase gold-text">
              ASSEMBLY MANAGER
            </h1>
            <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-[0.2em] mt-0.5">
              Legislative Portal Access
            </p>
          </div>
        </div>

        {/* Tab Selector: Sign In vs Register */}
        <div className="grid grid-cols-2 p-1 bg-[#141418] rounded-2xl border border-zinc-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setError('');
              setSuccessMsg('');
            }}
            className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-gradient-to-r from-[#FFD700] to-[#E5C100] text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LogIn size={15} />
            Sign In
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError('');
              setSuccessMsg('');
            }}
            className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-[#FFD700] to-[#E5C100] text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus size={15} />
            Register
          </button>
        </div>

        {/* Global Error/Success Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold text-center"
            >
              {error}
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FORM TAB 1: SIGN IN */}
        {activeTab === 'signin' && (
          <motion.div
            key="signin-tab"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Quick Demo Accounts list if available */}
            {profiles.length > 0 && (
              <div className="mb-5 p-3 rounded-2xl bg-[#FFD700]/5 border border-[#FFD700]/15">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#FFD700] uppercase tracking-wider mb-2">
                  <KeyRound size={14} />
                  <span>Existing Profiles on Device:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profiles.map((p) => (
                    <button
                      key={p.username}
                      type="button"
                      onClick={() => handleQuickFill(p.username)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#FFD700]/20 border border-white/10 hover:border-[#FFD700]/40 text-[11px] text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <img
                        src={p.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`}
                        alt={p.username}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                      <span className="font-semibold">{p.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label htmlFor="login-username" className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Username
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    id="login-username"
                    type="text"
                    value={signInUsername}
                    onChange={(e) => setSignInUsername(e.target.value)}
                    placeholder="Enter Username"
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/60 transition-colors"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/60 transition-colors"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-black bg-gradient-to-r from-[#FFD700] to-[#E5C100] hover:brightness-110 text-black uppercase tracking-wider text-xs shadow-lg shadow-[#FFD700]/10 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    SIGNING IN...
                  </>
                ) : (
                  <>
                    SIGN IN TO PROFILE
                    <ArrowRight size={16} />
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* FORM TAB 2: REGISTER */}
        {activeTab === 'register' && (
          <motion.div
            key="register-tab"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Profile Image Picker */}
              <div className="flex flex-col items-center justify-center gap-2 pb-2">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#D32F2F] to-[#FFD700] p-[2px] shadow-md overflow-hidden">
                    <img
                      src={
                        regImageBase64 ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(regUsername || 'NewUser')}`
                      }
                      alt="Profile Preview"
                      className="w-full h-full rounded-full object-cover bg-zinc-900"
                    />
                  </div>
                  <label
                    htmlFor="profile-image-upload"
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#FFD700] text-black shadow-lg cursor-pointer hover:scale-110 transition-transform"
                    title="Upload Profile Picture"
                  >
                    <Upload size={14} />
                  </label>
                  <input
                    id="profile-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
                <div className="text-center">
                  <label htmlFor="profile-image-upload" className="text-[11px] font-bold text-[#FFD700] hover:underline cursor-pointer uppercase tracking-wider">
                    {regImageBase64 ? 'Change Photo' : 'Upload Profile Picture'}
                  </label>
                  <p className="text-[10px] text-zinc-500">PNG, JPG or WEBP (Max 2MB)</p>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label htmlFor="reg-name" className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Alexander Vance"
                  className="w-full bg-[#141418] border border-zinc-800 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/60 transition-colors"
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label htmlFor="reg-username" className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Username
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    id="reg-username"
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. alexander_v"
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl py-2.5 pl-9 pr-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/60 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="reg-password" className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Password
                  </label>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl py-2.5 px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/60 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-confirm-password" className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Confirm
                  </label>
                  <input
                    id="reg-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-type"
                    className="w-full bg-[#141418] border border-zinc-800 rounded-xl py-2.5 px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FFD700]/60 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Toggle Show Password */}
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showPassword ? 'Hide Passwords' : 'Show Passwords'}</span>
                </button>
              </div>

              {/* Submit Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-black bg-gradient-to-r from-[#FFD700] to-[#E5C100] hover:brightness-110 text-black uppercase tracking-wider text-xs shadow-lg shadow-[#FFD700]/10 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    CREATING PROFILE...
                  </>
                ) : (
                  <>
                    CREATE PROFILE & ENTER
                    <ArrowRight size={16} />
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        )}

        <p className="text-center text-[10px] text-zinc-500 uppercase tracking-widest mt-6">
          Authorized Legislative Management System
        </p>
      </motion.div>
    </div>
  );
};
