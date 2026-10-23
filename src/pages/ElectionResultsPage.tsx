import React, { useState, useMemo } from 'react';
import { useDbLookup } from '../context/DbLookupContext';
import { useAuth } from '../context/AuthContext';
import { AssemblyElectionResults } from '../components/AssemblyElectionResults';
import { Vote, Landmark, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ElectionResultsPage: React.FC = () => {
  const { 
    assemblies: assembliesList, 
    constituencies: constituenciesList, 
    parties: partiesList, 
    alliances: alliancesList, 
    persons: personsList 
  } = useDbLookup();
  const { isViewerMode } = useAuth();
  const navigate = useNavigate();

  // Find currently active assembly, or the highest chronological/latest assembly
  const activeAssembly = useMemo(() => {
    if (!assembliesList || assembliesList.length === 0) return null;
    const active = assembliesList.find(a => a.isActive !== false);
    if (active) return active;
    // Fallback: pick the latest by updatedAt or slNo
    const sorted = [...assembliesList].sort((a, b) => (b.slNo || 0) - (a.slNo || 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
    return sorted[0];
  }, [assembliesList]);

  // Selected assembly ID (defaults to active assembly)
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(null);

  const currentAssembly = useMemo(() => {
    if (selectedAssemblyId) {
      return assembliesList.find(a => a.id === selectedAssemblyId) || activeAssembly;
    }
    return activeAssembly;
  }, [selectedAssemblyId, assembliesList, activeAssembly]);

  if (!currentAssembly) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-zinc-500 space-y-4">
        <Vote size={48} className="mx-auto text-zinc-600" />
        <h2 className="text-xl font-bold uppercase tracking-wider text-zinc-300">No Legislative Assembly Found</h2>
        <p className="text-xs text-zinc-500">Please create an assembly first to view its general election results.</p>
        <button
          onClick={() => navigate('/assemblies')}
          className="px-4 py-2 bg-[#FFD700] text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#ffe234] transition-all"
        >
          View Assemblies
        </button>
      </div>
    );
  }

  const isSelectedActive = currentAssembly.id === activeAssembly?.id;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Page Header & Assembly Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/20">
              Electoral Registry
            </span>
            {isSelectedActive && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 size={11} /> Current Active Assembly
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
            <Vote className="text-[#FFD700]" size={28} />
            <span>General Election Results</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Official vote sharing, seat tally, and electoral mandates for {currentAssembly.name}.
          </p>
        </div>

        {/* Assembly Switcher Dropdown */}
        {assembliesList.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <label htmlFor="assembly-select" className="sr-only">Select Assembly</label>
              <select
                id="assembly-select"
                value={currentAssembly.id}
                onChange={(e) => setSelectedAssemblyId(e.target.value)}
                className="bg-[#141519] border border-white/10 hover:border-[#FFD700]/40 text-xs font-bold text-zinc-200 py-2.5 pl-4 pr-9 rounded-xl appearance-none focus:outline-none focus:border-[#FFD700] transition-colors cursor-pointer"
              >
                {assembliesList.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#141519] text-zinc-200">
                    {a.name} {a.isActive !== false ? '(Active)' : '(Historical)'}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Embedded Election Results Infobox Component */}
      <AssemblyElectionResults
        assembly={currentAssembly}
        constituenciesList={constituenciesList || []}
        partiesList={partiesList || []}
        alliancesList={alliancesList || []}
        personsList={personsList || []}
        assembliesList={assembliesList || []}
        isViewerMode={isViewerMode}
      />
    </div>
  );
};
