import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { EntityPage } from './pages/EntityPage';
import { EntityListPage } from './pages/EntityListPage';
import { CabinetPage } from './pages/CabinetPage';
import { CreateModals } from './components/CreateModals';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EntityType } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { User, Flag, Shield, Landmark, X, MapPin } from 'lucide-react';
import { DbLookupProvider } from './context/DbLookupContext';

function AppContent() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateMenuOpen, setCreateMenuOpen] = useState(false);
  const [activeCreateType, setActiveCreateType] = useState<EntityType | null>(null);

  if (!user) {
    return <LoginScreen />;
  }

  const createOptions = [
    { type: EntityType.PERSON, label: 'Create Person', icon: User, color: 'hover:bg-blue-500/10' },
    { type: EntityType.PARTY, label: 'Create Party', icon: Flag, color: 'hover:bg-[#D32F2F]/10' },
    { type: EntityType.ALLIANCE, label: 'Create Alliance', icon: Shield, color: 'hover:bg-purple-500/10' },
    { type: EntityType.ASSEMBLY, label: 'Create Assembly', icon: Landmark, color: 'hover:bg-[#FFD700]/10' },
    { type: EntityType.CONSTITUENCY, label: 'Create Constituency', icon: MapPin, color: 'hover:bg-orange-500/10' },
  ];

  return (
    <BrowserRouter>
      <Layout onSearch={setSearchQuery} onPlusClick={() => setCreateMenuOpen(true)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/persons" element={<EntityListPage type={EntityType.PERSON} searchQuery={searchQuery} />} />
          <Route path="/parties" element={<EntityListPage type={EntityType.PARTY} searchQuery={searchQuery} />} />
          <Route path="/alliances" element={<EntityListPage type={EntityType.ALLIANCE} searchQuery={searchQuery} />} />
          <Route path="/assemblies" element={<EntityListPage type={EntityType.ASSEMBLY} searchQuery={searchQuery} />} />
          <Route path="/designations" element={<EntityListPage type={EntityType.DESIGNATION} searchQuery={searchQuery} />} />
          <Route path="/constituencies" element={<EntityListPage type={EntityType.CONSTITUENCY} searchQuery={searchQuery} />} />
          <Route path="/cabinet" element={<CabinetPage />} />
          <Route path="/:type/:id" element={<EntityPage />} />
        </Routes>
      </Layout>

      {/* Floating Plus Menu */}
      <AnimatePresence>
        {isCreateMenuOpen && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:justify-end p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreateMenuOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm glass-card relative overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black uppercase tracking-widest text-[#FFD700]">Database Entry</h3>
                  <button onClick={() => setCreateMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-2">
                  {createOptions.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => {
                        setActiveCreateType(opt.type);
                        setCreateMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${opt.color} group`}
                    >
                      <div className="p-2 bg-white/5 rounded-lg text-gray-400 group-hover:text-[#FFD700]">
                        <opt.icon size={20} />
                      </div>
                      <span className="font-bold text-gray-300 group-hover:text-white uppercase tracking-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CreateModals
        type={activeCreateType}
        isOpen={activeCreateType !== null}
        onClose={() => setActiveCreateType(null)}
      />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <DbLookupProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </DbLookupProvider>
  );
}
