import React, { useState } from 'react';
import { Search, Plus, Home, Users, Flag, Landmark, Shield, Menu, X, Award, MapPin, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router';
import { useDbLookup } from '../context/DbLookupContext';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  onSearch: (query: string) => void;
  onPlusClick: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onSearch, onPlusClick }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { loaded } = useDbLookup();
  const { user, logout } = useAuth();

  const navItems = [
    { title: 'Dashboard', icon: Home, path: '/' },
    { title: 'Persons', icon: Users, path: '/persons' },
    { title: 'Parties', icon: Flag, path: '/parties' },
    { title: 'Alliances', icon: Shield, path: '/alliances' },
    { title: 'Cabinet', icon: Landmark, path: '/cabinet' },
    { title: 'Assemblies', icon: Landmark, path: '/assemblies' },
    { title: 'Constituencies', icon: MapPin, path: '/constituencies' },
  ];

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#050505] text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          <img
            src="/logo.svg"
            alt="Assembly Manager Logo"
            className="w-24 h-24 mx-auto animate-pulse filter drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-[0.15em] uppercase gold-text">ASSEMBLY MANAGER</h1>
            <p className="text-xs text-gray-500 uppercase tracking-[0.2em]">Legislative Management Registry</p>
          </div>
          <div className="flex justify-center pt-4">
            <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden relative">
              <motion.div
                className="absolute top-0 bottom-0 left-0 bg-[#FFD700] w-1/3"
                animate={{
                  left: ["-100%", "100%"],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut"
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-transparent text-white overflow-hidden">
      {/* Sidebar - Mobile Menu */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed left-0 top-0 h-full w-64 bg-[#0a0a0a] border-r border-[#FFD700]/20 z-50 p-6 lg:hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <img src="/logo.svg" alt="Assembly Logo" className="w-9 h-9 rounded-xl shadow-md" />
                  <h1 className="text-lg font-black gold-text tracking-wider uppercase">ASSEMBLY MANAGER</h1>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-4">
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${
                      location.pathname === item.path ? 'bg-[#D32F2F] text-white shadow-lg shadow-[#D32F2F]/20' : 'hover:bg-white/5 text-gray-400'
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.title}</span>
                  </button>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Static Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0a0a0a]/50 backdrop-blur-xl border-r border-[#FFD700]/10 p-6">
        <div className="mb-10 text-center">
           <img src="/logo.svg" alt="Assembly Manager Logo" className="w-16 h-16 mx-auto mb-3 hover:scale-105 transition-transform drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
           <h1 className="text-xl font-black gold-text tracking-wider uppercase">Assembly Manager</h1>
           <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Legislative System</p>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all group ${
                location.pathname === item.path ? 'bg-[#D32F2F] text-white' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <item.icon size={20} className={location.pathname === item.path ? '' : 'group-hover:text-[#FFD700] transition-colors'} />
              <span className="font-medium">{item.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 border-b border-[#FFD700]/10 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="p-2 lg:hidden hover:bg-white/10 rounded-full">
              <Menu size={24} />
            </button>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search entities..."
                onChange={(e) => onSearch(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#FFD700]/10 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-[#FFD700]/40 transition-colors"
                id="global-search"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 ml-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white truncate max-w-[140px]">{user?.name || user?.username || 'Admin'}</p>
              <p className="text-[10px] text-[#FFD700] uppercase tracking-wider font-semibold truncate max-w-[140px]">@{user?.username || 'admin'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#D32F2F] to-[#FFD700] p-[2px] shrink-0 overflow-hidden">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                 <img
                   src={user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username || 'Admin')}`}
                   alt={user?.name || 'User Avatar'}
                   className="w-full h-full object-cover"
                 />
              </div>
            </div>
            <button
              onClick={logout}
              title="Log Out"
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer ml-1"
            >
              <LogOut size={18} />
              <span className="text-xs font-bold uppercase tracking-wider hidden lg:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {children}
        </div>

        {/* Floating Action Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onPlusClick}
          className="fixed right-6 bottom-6 sm:right-10 sm:bottom-10 w-16 h-16 rounded-full bg-[#D32F2F] shadow-2xl shadow-[#D32F2F]/40 flex items-center justify-center text-white z-30"
          id="main-fab"
        >
          <Plus size={32} />
        </motion.button>
      </main>
    </div>
  );
};
