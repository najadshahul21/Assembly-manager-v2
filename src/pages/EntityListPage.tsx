import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, reindexConstituencies } from '../db';
import { EntityType } from '../types';
import { EntityCard } from '../components/EntityCards';
import { motion, AnimatePresence } from 'motion/react';
import { User, Flag, Shield, Landmark, Award, Trash2, MapPin } from 'lucide-react';

interface ListPageProps {
  type: EntityType;
  searchQuery?: string;
}

const getAssemblyChronologicalScore = (assembly: any) => {
  if (!assembly) return 0;
  if (assembly.termLimits) {
    const yearMatch = assembly.termLimits.match(/\d{4}/);
    if (yearMatch) {
      return parseInt(yearMatch[0], 10);
    }
  }
  if (assembly.name) {
    const ordinalMatch = assembly.name.match(/^(\d+)/);
    if (ordinalMatch) {
      return parseInt(ordinalMatch[1], 10);
    }
  }
  return 0;
};

export const EntityListPage: React.FC<ListPageProps> = ({ type, searchQuery = '' }) => {
  const [entityToDelete, setEntityToDelete] = useState<any | null>(null);

  const entities = useLiveQuery(async () => {
    let results: any[] = [];
    switch (type) {
      case EntityType.PERSON: {
        const list = await db.persons.toArray();
        results = list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        break;
      }
      case EntityType.PARTY: {
        const list = await db.parties.toArray();
        results = list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        break;
      }
      case EntityType.ALLIANCE: {
        const list = await db.alliances.toArray();
        results = list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        break;
      }
      case EntityType.ASSEMBLY: {
        const assemblies = await db.assemblies.toArray();
        results = assemblies.sort((a, b) => {
          const scoreA = getAssemblyChronologicalScore(a);
          const scoreB = getAssemblyChronologicalScore(b);
          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }
          // Fallback to active state first, then updatedAt
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          return b.updatedAt - a.updatedAt;
        });
        break;
      }
      case EntityType.DESIGNATION: {
        const list = await db.designations.toArray();
        results = list
          .filter(e => !e.constituencyId && e.id !== 'governor')
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        break;
      }
      case EntityType.CONSTITUENCY: {
        const constituencies = await db.constituencies.toArray();
        results = constituencies.sort((a, b) => {
          const slA = parseInt(a.slNo) || 9999;
          const slB = parseInt(b.slNo) || 9999;
          if (slA !== slB) return slA - slB;
          return (a.updatedAt || 0) - (b.updatedAt || 0);
        });
        break;
      }
      default: results = [];
    }
    
    if (!searchQuery) return results;
    
    const query = searchQuery.toLowerCase();
    return results.filter(e => 
      e.name?.toLowerCase().includes(query) || 
      e.abbreviation?.toLowerCase().includes(query) ||
      e.subName?.toLowerCase().includes(query) ||
      e.constituency?.toLowerCase().includes(query)
    );
  }, [type, searchQuery]);

  const handleDelete = async () => {
    if (!entityToDelete) return;
    
    switch (type) {
      case EntityType.PERSON: await db.persons.delete(entityToDelete.id); break;
      case EntityType.PARTY: await db.parties.delete(entityToDelete.id); break;
      case EntityType.ALLIANCE: await db.alliances.delete(entityToDelete.id); break;
      case EntityType.ASSEMBLY: await db.assemblies.delete(entityToDelete.id); break;
      case EntityType.DESIGNATION: await db.designations.delete(entityToDelete.id); break;
      case EntityType.CONSTITUENCY: 
        await db.constituencies.delete(entityToDelete.id); 
        await reindexConstituencies();
        break;
    }
    setEntityToDelete(null);
  };

  const config = {
    [EntityType.PERSON]: { title: 'Legislators', icon: User, color: 'text-[#FFD700]' },
    [EntityType.PARTY]: { title: 'Political Parties', icon: Flag, color: 'text-[#D32F2F]' },
    [EntityType.ALLIANCE]: { title: 'Strategic Alliances', icon: Shield, color: 'text-purple-400' },
    [EntityType.ASSEMBLY]: { title: 'Legislative Bodies', icon: Landmark, color: 'text-[#FFD700]' },
    [EntityType.DESIGNATION]: { title: 'Custom Designations', icon: Award, color: 'text-emerald-400' },
    [EntityType.CONSTITUENCY]: { title: 'Assembly Constituencies', icon: MapPin, color: 'text-orange-400' },
  };

  const { title, icon: Icon, color } = config[type];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <div className={`p-4 bg-white/5 rounded-2xl ${color}`}>
           <Icon size={32} />
        </div>
        <div>
           <h2 className="text-3xl font-black uppercase tracking-tight">{title}</h2>
           <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">
              Total Recorded: <span className="text-white">{entities?.length || 0}</span>
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="sync">
          {entities?.map(e => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ 
                opacity: { duration: 0.2 },
                layout: { type: 'spring', stiffness: 300, damping: 25 },
                scale: { duration: 0.2 }
              }}
            >
              <EntityCard 
                entity={e} 
                type={type} 
                onDelete={() => setEntityToDelete(e)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {entities?.length === 0 && (
          <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
             <p className="text-gray-600 font-bold uppercase tracking-widest">No entries found in this department</p>
             <p className="text-xs text-gray-700 mt-2">Use the + button to add the first entry</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {entityToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEntityToDelete(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm glass-card border-red-500/20 p-8 relative">
                <div className="text-center">
                   <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                   </div>
                   <h3 className="text-xl font-bold mb-2 uppercase">Irreversible Action</h3>
                   <p className="text-gray-500 text-sm mb-6">Are you sure you want to permanently delete <span className="text-white font-bold">{entityToDelete.name}</span>? This will purge all associated legislative records.</p>
                   <div className="flex flex-col gap-3">
                      <button onClick={handleDelete} className="w-full py-3 bg-red-600 text-white font-black rounded-xl border border-red-500/20 shadow-lg shadow-red-600/20 hover:scale-[1.02] transition-transform uppercase tracking-widest">Confirm Deletion</button>
                      <button onClick={() => setEntityToDelete(null)} className="w-full py-3 text-gray-400 hover:text-white transition-colors">Cancel</button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
