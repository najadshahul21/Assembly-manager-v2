import React from 'react';
import { Vote } from 'lucide-react';
import { formatPersonName } from '../utils/governmentUtils';
import { Constituency, Person, Party, Alliance, Assembly } from '../types';

interface ConstituencyInfoboxTableProps {
  constituency: Constituency;
  incumbentPerson?: Person | null;
  incumbentParty?: Party | null;
  incumbentAlliance?: Alliance | null;
  currentAssembly?: Assembly | null;
  creationAssembly?: Assembly | null;
  assembliesList?: Assembly[];
  onNavigatePerson: (personId: string) => void;
  onNavigateParty: (partyId: string) => void;
  onNavigateAlliance: (allianceId: string) => void;
  onNavigateAssembly: (assemblyId: string) => void;
  onElectMla?: () => void;
  isDissolved?: boolean;
}

export const ConstituencyInfoboxTable: React.FC<ConstituencyInfoboxTableProps> = ({
  constituency,
  incumbentPerson,
  incumbentParty,
  incumbentAlliance,
  currentAssembly,
  creationAssembly,
  assembliesList,
  onNavigatePerson,
  onNavigateParty,
  onNavigateAlliance,
  onNavigateAssembly,
  onElectMla,
  isDissolved = false,
}) => {
  // Determine respective assembly for "since (respective assembly)"
  const targetAssembly = React.useMemo(() => {
    if (creationAssembly) return creationAssembly;
    if (assembliesList && assembliesList.length > 0) {
      if (constituency.createdInAssemblyId) {
        const found = assembliesList.find((a) => a.id === constituency.createdInAssemblyId);
        if (found) return found;
      }
      if (constituency.currentAssemblyId) {
        const found = assembliesList.find((a) => a.id === constituency.currentAssemblyId);
        if (found) return found;
      }
    }
    return currentAssembly || null;
  }, [creationAssembly, assembliesList, constituency.createdInAssemblyId, constituency.currentAssemblyId, currentAssembly]);

  // Alliance color box
  const allianceColor = React.useMemo(() => {
    if (incumbentAlliance?.colors && incumbentAlliance.colors[0]) {
      return incumbentAlliance.colors[0];
    }
    if (incumbentParty?.colors && incumbentParty.colors[0]) {
      return incumbentParty.colors[0];
    }
    return '#0056b3'; // Blue fallback matching UDF/INC
  }, [incumbentAlliance, incumbentParty]);

  return (
    <div className="w-full max-w-xl mx-auto bg-[#0d1117] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-sans text-zinc-200">
      {/* Top Banner with Constituency Name */}
      <div className="px-6 py-4 bg-[#12161f] text-center border-b border-zinc-800">
        <div className="h-[2px] w-full mb-3 bg-[#60a5fa]/80" />
        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase">
          {constituency.name}
        </h2>
        <div className="h-[2px] w-full mt-3 bg-[#60a5fa]/80" />
      </div>

      {/* SECTION 1: CONSTITUENCY DETAILS */}
      <div className="bg-[#28314a] text-center py-2 px-4 border-b border-zinc-700/60 shadow-inner">
        <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
          Constituency details
        </h3>
      </div>

      <div className="divide-y divide-zinc-800 text-sm sm:text-base">
        {/* Since */}
        <div className="flex flex-row items-baseline hover:bg-white/[0.015] transition-colors">
          <div className="w-40 sm:w-52 shrink-0 px-5 py-3.5 font-bold text-white select-none">
            Since
          </div>
          <div className="px-5 py-3.5 text-zinc-100 flex-1 flex flex-wrap items-baseline gap-1.5">
            {targetAssembly ? (
              <button
                type="button"
                onClick={() => onNavigateAssembly(targetAssembly.id)}
                className="text-[#60a5fa] hover:text-[#93c5fd] hover:underline font-semibold cursor-pointer text-left transition-colors"
              >
                ({targetAssembly.name})
              </button>
            ) : (
              <span className="text-zinc-500 italic">(Respective assembly not specified)</span>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: MEMBER OF LEGISLATIVE ASSEMBLY */}
      <div className="bg-[#28314a] text-center py-2 px-4 border-t border-zinc-700/60 shadow-inner">
        <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
          Member of Legislative Assembly
        </h3>
      </div>

      {/* Sub-bar: Legislative Assembly Term Link */}
      <div className="bg-[#191f2e] text-center py-2 px-4 border-b border-zinc-800">
        {currentAssembly ? (
          <button
            type="button"
            onClick={() => onNavigateAssembly(currentAssembly.id)}
            className="text-[#60a5fa] hover:text-[#93c5fd] hover:underline font-semibold text-sm sm:text-base transition-colors"
          >
            {currentAssembly.name}
          </button>
        ) : (
          <span className="text-zinc-400 text-sm font-medium">
            Kerala Legislative Assembly
          </span>
        )}
      </div>

      {/* Incumbent Subsection */}
      <div className="py-5 px-4 bg-[#0d1117] flex flex-col items-center text-center border-b border-zinc-800">
        <div className="text-xs sm:text-sm font-bold text-zinc-400 uppercase select-none tracking-widest mb-2">
          Incumbent
        </div>
        <div className="w-full flex justify-center">
          {incumbentPerson && !incumbentPerson.isSuspended && constituency.currentIncumbentId !== 'vacant' ? (
            <button
              type="button"
              onClick={() => onNavigatePerson(incumbentPerson.id)}
              className="text-xl sm:text-2xl font-black text-[#0ea5e9] hover:text-[#38bdf8] hover:underline tracking-tighter transition-all cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span className="leading-tight">{formatPersonName(incumbentPerson.name, incumbentPerson.gender, !isDissolved)}</span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="text-lg font-bold text-rose-500/90 italic tracking-tight">
                Vacant (No active MLA)
              </span>
              {!isDissolved && onElectMla && (
                <button
                  type="button"
                  onClick={onElectMla}
                  className="px-4 py-1.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-xs font-black uppercase rounded-full border border-amber-400/30 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Vote size={14} className="opacity-80" /> 
                  <span>Conduct Election</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Incumbent Details Table (Party, Alliance) */}
      <div className="divide-y divide-zinc-800 text-sm sm:text-base">
        {/* Party */}
        <div className="flex flex-row items-center hover:bg-white/[0.015] transition-colors">
          <div className="w-40 sm:w-52 shrink-0 px-5 py-3 font-bold text-white select-none">
            Party
          </div>
          <div className="px-5 py-3 text-[#60a5fa] flex-1">
            {incumbentParty && !incumbentParty.isSuspended ? (
              <button
                type="button"
                onClick={() => onNavigateParty(incumbentParty.id)}
                className="flex items-center gap-2 text-[#60a5fa] hover:text-[#93c5fd] hover:underline font-semibold transition-colors cursor-pointer"
              >
                {incumbentParty.logoUrl ? (
                  <img
                    src={incumbentParty.logoUrl}
                    alt={incumbentParty.name}
                    className="w-5 h-5 rounded-full object-contain bg-white/10 p-0.5"
                  />
                ) : (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: incumbentParty.colors?.[0] || '#D32F2F' }}
                  >
                    {incumbentParty.abbreviation?.substring(0, 1) || 'P'}
                  </span>
                )}
                <span>{incumbentParty.abbreviation || incumbentParty.name}</span>
              </button>
            ) : (
              <span className="text-zinc-500 italic">None / Independent</span>
            )}
          </div>
        </div>

        {/* Alliance */}
        <div className="flex flex-row items-center hover:bg-white/[0.015] transition-colors">
          <div className="w-40 sm:w-52 shrink-0 px-5 py-3 font-bold text-white select-none">
            Alliance
          </div>
          <div className="px-5 py-3 text-[#60a5fa] flex-1">
            {incumbentAlliance && incumbentParty?.allianceId !== 'independent' ? (
              <button
                type="button"
                onClick={() => onNavigateAlliance(incumbentAlliance.id)}
                className="flex items-center gap-2 text-[#60a5fa] hover:text-[#93c5fd] hover:underline font-semibold transition-colors cursor-pointer"
              >
                <span
                  className="inline-block w-4 h-4 rounded-xs border border-white/20 shadow-xs shrink-0"
                  style={{ backgroundColor: allianceColor }}
                />
                <span>{incumbentAlliance.abbreviation || incumbentAlliance.name}</span>
              </button>
            ) : (
              <span className="text-zinc-400 italic">Independent / Unaligned</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
