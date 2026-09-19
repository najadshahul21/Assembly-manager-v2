import React from 'react';
import { Landmark, Shield, History as HistoryIcon, Award, User, ExternalLink, Calendar } from 'lucide-react';
import { Assembly, Person, Party, Alliance } from '../types';
import { formatPersonName } from '../utils/governmentUtils';

interface AssemblyInfoboxTableProps {
  assembly: Assembly;
  personsList: Person[];
  partiesList: Party[];
  alliancesList: Alliance[];
  assembliesList: Assembly[];
  onNavigatePerson: (personId: string) => void;
  onNavigateParty: (partyId: string) => void;
  onNavigateAlliance: (allianceId: string) => void;
  onNavigateAssembly: (assemblyId: string) => void;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

export const AssemblyInfoboxTable: React.FC<AssemblyInfoboxTableProps> = ({
  assembly,
  personsList,
  partiesList,
  alliancesList,
  assembliesList,
  onNavigatePerson,
  onNavigateParty,
  onNavigateAlliance,
  onNavigateAssembly
}) => {
  const getLeaderDetails = (personId?: string, roleKey?: string) => {
    if (!personId || personId === 'vacant') return null;
    const person = personsList.find(p => p.id === personId);
    if (!person) return null;
    const party = partiesList.find(p => p.id === person.partyId);
    const date = assembly.leadershipDates?.[roleKey || ''];
    return { person, party, date };
  };

  const precededByAssembly = assembly.precededById 
    ? assembliesList.find(a => a.id === assembly.precededById)
    : null;

  const renderLeaderRow = (title: string, personId?: string, roleKey?: string) => {
    const details = getLeaderDetails(personId, roleKey);
    if (!details) {
      return (
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors border-b border-zinc-800/80">
          <div className="w-full sm:w-48 shrink-0 px-5 py-3 sm:py-4 font-bold text-white select-none">
            {title}
          </div>
          <div className="px-5 pb-3 sm:py-4 text-zinc-500 italic flex-1">
            Vacant
          </div>
        </div>
      );
    }

    const { person, party, date } = details;
    const isGoldRole = title.toLowerCase().includes('chief minister');
    const nameColorClass = isGoldRole 
      ? "text-[#60a5fa] hover:text-[#93c5fd]" 
      : "text-white hover:text-white";

    return (
      <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors border-b border-zinc-800/80">
        <div className="w-full sm:w-48 shrink-0 px-5 py-3 sm:py-4 font-bold text-white select-none">
          {title}
        </div>
        <div className="px-5 pb-3 sm:py-4 text-zinc-100 flex-1">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <button
                onClick={() => onNavigatePerson(person.id)}
                className={`${nameColorClass} hover:underline font-bold text-left transition-colors flex items-baseline gap-1`}
              >
                {formatPersonName(person.name, person.gender)}
              </button>
              {party && (
                <button
                  onClick={() => onNavigateParty(party.id)}
                  className="text-zinc-400 text-xs sm:text-sm hover:text-white transition-colors"
                >
                  , {party.abbreviation}
                </button>
              )}
            </div>
            {date && (
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider font-medium">
                since {formatDate(date)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-[#0d1117] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-sans">
      {/* Top Banner */}
      <div className="px-6 py-4 bg-[#12161f] text-center border-b border-zinc-800 relative">
        <div className="h-[2px] w-full mb-3.5 bg-[#60a5fa] opacity-90" />
        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          {assembly.name}
        </h2>
        <div className="h-[2px] w-full mt-3.5 bg-[#60a5fa] opacity-90" />
      </div>

      {/* Logo */}
      <div className="py-8 px-4 flex flex-col items-center justify-center bg-[#0d1117] border-b border-zinc-800/80">
        {assembly.logoUrl ? (
          <img
            src={assembly.logoUrl}
            alt={assembly.name}
            className="max-h-48 sm:max-h-64 w-auto object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
          />
        ) : (
          <div className="w-32 h-32 rounded-3xl bg-[#60a5fa]/5 flex items-center justify-center border-2 border-[#60a5fa]/20 shadow-2xl">
            <Landmark size={64} className="text-[#60a5fa]" />
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="divide-y divide-zinc-800/80">
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors border-b border-zinc-800/80">
          <div className="w-full sm:w-48 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-zinc-100 select-none">
            Term limits
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-300 flex-1">
            {assembly.termLimits || '5 years'}
          </div>
        </div>

        {precededByAssembly && (
          <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors border-b border-zinc-800/80">
            <div className="w-full sm:w-48 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-zinc-100 select-none">
              Preceded by
            </div>
            <div className="px-5 pb-3 sm:py-3.5 text-white flex-1">
              <button
                onClick={() => onNavigateAssembly(precededByAssembly.id)}
                className="font-bold hover:underline text-left transition-colors"
              >
                {precededByAssembly.name}
              </button>
            </div>
          </div>
        )}

        {/* Leadership Section Header */}
        <div className="bg-[#12161f]/50 px-5 py-2 border-b border-zinc-800/80">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Leadership</span>
        </div>

        {renderLeaderRow('Speaker', assembly.leaders?.speaker, 'speaker')}
        {renderLeaderRow('Deputy Speaker', assembly.leaders?.deputySpeaker, 'deputySpeaker')}
        {renderLeaderRow('Chief Minister', assembly.leaders?.chiefMinister, 'chiefMinister')}
        {renderLeaderRow('Deputy Chief Minister', assembly.leaders?.deputyChiefMinister, 'deputyChiefMinister')}
        {renderLeaderRow('Leader of the Opposition', assembly.leaders?.leaderOfOpposition, 'leaderOfOpposition')}
        {renderLeaderRow('Deputy Leader of the Opposition', assembly.leaders?.deputyLeaderOfOpposition, 'deputyLeaderOfOpposition')}
        {renderLeaderRow('Chief Secretary', assembly.leaders?.chiefSecretary, 'chiefSecretary')}
      </div>
    </div>
  );
};
