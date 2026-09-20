import React from 'react';
import { Flag, Shield, ExternalLink, Users, Award, Landmark, X, Check } from 'lucide-react';
import { Party, Alliance, Person, Assembly, Constituency } from '../types';

interface PartyInfoboxTableProps {
  party: Party;
  alliance?: Alliance | null;
  relatedPersons: Person[];
  activeAssembly?: Assembly | null;
  constituenciesList: Constituency[];
  assembliesList: Assembly[];
  alliancesList: Alliance[];
  personsList: Person[];
  onNavigatePerson: (personId: string) => void;
  onNavigateAlliance: (allianceId: string) => void;
  onNavigateAssembly?: (assemblyId: string) => void;
  onUpdateLegislativeLeader?: (leaderId: string | null) => void;
  isDissolved?: boolean;
}

function parseHexToRgb(hexStr: string): { r: number; g: number; b: number } | null {
  const clean = hexStr.replace(/^#/, '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
  } else if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
  }
  return null;
}

const PALETTE: Array<{ name: string; r: number; g: number; b: number }> = [
  { name: 'Red', r: 220, g: 38, b: 38 },
  { name: 'Dark Red / Crimson', r: 153, g: 27, b: 27 },
  { name: 'Blue', r: 37, g: 99, b: 235 },
  { name: 'Navy Blue', r: 30, g: 58, b: 138 },
  { name: 'Sky Blue', r: 14, g: 165, b: 233 },
  { name: 'Yellow / Gold', r: 234, g: 179, b: 8 },
  { name: 'Green', r: 22, g: 163, b: 74 },
  { name: 'Dark Green', r: 20, g: 83, b: 45 },
  { name: 'Saffron / Orange', r: 249, g: 115, b: 22 },
  { name: 'Deep Orange', r: 194, g: 65, b: 12 },
  { name: 'Purple', r: 147, g: 51, b: 234 },
  { name: 'Violet', r: 109, g: 40, b: 217 },
  { name: 'Cyan / Teal', r: 13, g: 148, b: 136 },
  { name: 'Pink', r: 236, g: 72, b: 153 },
  { name: 'White', r: 255, g: 255, b: 255 },
  { name: 'Black', r: 0, g: 0, b: 0 },
  { name: 'Grey / Gray', r: 107, g: 114, b: 128 },
  { name: 'Maroon', r: 128, g: 0, b: 0 },
  { name: 'Brown', r: 139, g: 69, b: 19 },
];

function getColorLabel(rawColor: string): string {
  if (!rawColor) return 'Not specified';
  const clean = rawColor.trim().toLowerCase();

  const directNames: Record<string, string> = {
    red: 'Red',
    blue: 'Blue',
    green: 'Green',
    yellow: 'Yellow / Gold',
    gold: 'Gold',
    orange: 'Orange',
    saffron: 'Saffron / Orange',
    purple: 'Purple',
    violet: 'Violet',
    white: 'White',
    black: 'Black',
    cyan: 'Cyan',
    teal: 'Teal',
    pink: 'Pink',
    grey: 'Grey',
    gray: 'Gray',
    maroon: 'Maroon',
    brown: 'Brown',
    navy: 'Navy Blue',
  };
  if (directNames[clean]) return directNames[clean];

  const rgb = parseHexToRgb(clean);
  if (rgb) {
    let closestName = 'Red';
    let minDistance = Infinity;
    for (const p of PALETTE) {
      const dist = Math.pow(rgb.r - p.r, 2) + Math.pow(rgb.g - p.g, 2) + Math.pow(rgb.b - p.b, 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestName = p.name;
      }
    }
    return closestName;
  }

  return rawColor.charAt(0).toUpperCase() + rawColor.slice(1);
}

function formatFoundedDate(foundedDate?: string): string {
  if (!foundedDate) return 'Date not specified';
  const match = foundedDate.match(/\b(19\d\d|20\d\d)\b/);
  if (match) {
    const year = parseInt(match[1], 10);
    const currentYear = new Date().getFullYear();
    const yearsAgo = currentYear - year;
    if (yearsAgo >= 0) {
      return `${foundedDate} (${yearsAgo} years ago)`;
    }
  }
  return foundedDate;
}

export const PartyInfoboxTable: React.FC<PartyInfoboxTableProps> = ({
  party,
  alliance,
  relatedPersons,
  activeAssembly,
  constituenciesList,
  assembliesList,
  alliancesList,
  personsList,
  onNavigatePerson,
  onNavigateAlliance,
  onNavigateAssembly,
  onUpdateLegislativeLeader,
  isDissolved = false,
}) => {
  const [showAdjustLeader, setShowAdjustLeader] = React.useState(false);
  // Primary party color
  const colorsList = React.useMemo(() => {
    if (Array.isArray(party.colors) && party.colors.length > 0) {
      return party.colors;
    }
    return ['#D32F2F'];
  }, [party.colors]);

  const primaryPartyColor = colorsList[0] || '#D32F2F';

  // Compute assembly representation for this party
  const assemblyStats = React.useMemo(() => {
    if (!activeAssembly) return null;

    const targetConstituencies = constituenciesList.filter(
      (c) => c && c.currentAssemblyId === activeAssembly.id
    );
    const totalSeats = targetConstituencies.length || 0;

    let seatsWon = 0;
    const mlasFromParty: { constituencyName: string; person: Person }[] = [];

    targetConstituencies.forEach((c) => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        const person = personsList.find((p) => p.id === c.currentIncumbentId);
        if (person && person.partyId === party.id) {
          seatsWon++;
          mlasFromParty.push({ constituencyName: c.name, person });
        }
      }
    });

    const percentage = totalSeats > 0 ? ((seatsWon / totalSeats) * 100).toFixed(1) : '0.0';

    // Check government or opposition status via alliance or direct
    const isGov =
      (alliance && activeAssembly.composition?.government?.id === alliance.id) ||
      activeAssembly.composition?.government?.id === party.id ||
      (activeAssembly.leaders?.chiefMinister &&
        personsList.find((p) => p.id === activeAssembly.leaders?.chiefMinister)?.partyId === party.id);

    const isOpp =
      !isGov &&
      ((alliance && activeAssembly.composition?.opposition?.id === alliance.id) ||
        activeAssembly.composition?.opposition?.id === party.id ||
        (activeAssembly.leaders?.leaderOfOpposition &&
          personsList.find((p) => p.id === activeAssembly.leaders?.leaderOfOpposition)?.partyId === party.id));

    const statusLabel = isGov
      ? (alliance ? `Ruling Front (${alliance.abbreviation || alliance.name})` : 'Ruling Government')
      : isOpp
      ? (alliance ? `Opposition Front (${alliance.abbreviation || alliance.name})` : 'Official Opposition')
      : 'Legislative Assembly Member';

    return {
      assemblyName: activeAssembly.name,
      totalSeats,
      seatsWon,
      percentage: parseFloat(percentage),
      mlasFromParty,
      isGov,
      isOpp,
      statusLabel,
    };
  }, [activeAssembly, constituenciesList, personsList, party.id, alliance]);

  // Find chairman person record if exists
  const chairmanPerson = React.useMemo(() => {
    if (!party.chairman) return null;
    const chairName = party.chairman.trim().toLowerCase();
    return (
      personsList.find(
        (p) =>
          p.id === party.chairman ||
          p.name.trim().toLowerCase() === chairName
      ) || null
    );
  }, [party.chairman, personsList]);

  // Find legislative leaders from this party in the active assembly - ONLY manual selection
  const legislativeLeaders = React.useMemo(() => {
    if (!activeAssembly || !party.legislativeLeaderId) return [];

    const person = personsList.find(p => p.id === party.legislativeLeaderId);
    if (person) {
      return [{ person, title: 'Legislative Leader' }];
    }

    return [];
  }, [activeAssembly, personsList, party.legislativeLeaderId]);

  return (
    <div className="w-full bg-[#0d1117] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-sans">
      {/* Top Banner with Party Name and Colored Accent Lines (Exact Match to Screenshot) */}
      <div className="px-6 py-4 bg-[#12161f] text-center border-b border-zinc-800 relative">
        {/* Top Accent Line */}
        <div
          className="h-[2px] w-full mb-3.5 opacity-90 transition-all"
          style={{ backgroundColor: primaryPartyColor }}
        />

        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          {party.name}
        </h2>

        {/* Bottom Accent Line */}
        <div
          className="h-[2px] w-full mt-3.5 opacity-90 transition-all"
          style={{ backgroundColor: primaryPartyColor }}
        />
      </div>

      {/* Prominent Party Symbol / Logo in Center Header (Just like Screenshot) */}
      <div className="py-6 px-4 flex flex-col items-center justify-center bg-[#0d1117] border-b border-zinc-800/80">
        {party.logoUrl ? (
          <div className="relative group max-w-xs sm:max-w-sm flex items-center justify-center">
            <img
              src={party.logoUrl}
              alt={party.name}
              className="max-h-48 sm:max-h-56 w-auto object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)] transition-transform duration-300 hover:scale-105"
            />
          </div>
        ) : (
          <div
            className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl flex flex-col items-center justify-center border-2 border-white/10 shadow-2xl transition-all"
            style={{ backgroundColor: `${primaryPartyColor}15` }}
          >
            <Flag size={56} style={{ color: primaryPartyColor }} />
            <span
              className="text-xs font-black tracking-widest mt-2 uppercase"
              style={{ color: primaryPartyColor }}
            >
              {party.abbreviation || 'PARTY'}
            </span>
          </div>
        )}
      </div>

      {/* Main Tabular Specifications (Wikipedia Two-Column Format) */}
      <div className="divide-y divide-zinc-800/80 text-sm sm:text-base">
        {/* 1. Abbreviation */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Abbreviation
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 font-semibold tracking-wide flex-1">
            {party.abbreviation || '—'}
          </div>
        </div>

        {/* 2. Chairman */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Chairman
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {chairmanPerson ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <button
                  type="button"
                  onClick={() => onNavigatePerson(chairmanPerson.id)}
                  className="text-white hover:text-white hover:underline font-semibold text-left transition-colors"
                >
                  {chairmanPerson.name}
                </button>
                {chairmanPerson.constituencyName && (
                  <span className="text-zinc-400 text-xs sm:text-sm">
                    (MLA for {chairmanPerson.constituencyName})
                  </span>
                )}
              </div>
            ) : party.chairman ? (
              <span className="font-semibold text-zinc-100">{party.chairman}</span>
            ) : (
              <span className="text-zinc-500 italic">Not designated</span>
            )}
          </div>
        </div>

        {/* 6. Alliance / Political Front */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Alliance
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {alliance && party.allianceId !== 'independent' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateAlliance(alliance.id)}
                  className="text-white hover:text-white hover:underline font-semibold text-left transition-colors flex items-center gap-1.5"
                >
                  <Shield size={15} className="text-white" />
                  <span>
                    {alliance.name} ({alliance.abbreviation})
                  </span>
                </button>
                {alliance.leadingPartyId === party.id && (
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[11px] font-bold uppercase">
                    Leading Party
                  </span>
                )}
              </div>
            ) : (
              <span className="text-zinc-400 italic">Independent / Unaligned</span>
            )}
          </div>
        </div>

        {/* 7. Legislative Leader (New Position: Below Alliance) */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors relative">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none flex items-center justify-between">
            <span>Legislative Leader</span>
            {onUpdateLegislativeLeader && !isDissolved && (
              <button
                type="button"
                onClick={() => setShowAdjustLeader(!showAdjustLeader)}
                className="text-[10px] uppercase font-black px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors border border-zinc-700/50"
              >
                Adjust
              </button>
            )}
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {showAdjustLeader && assemblyStats && (
              <div className="mb-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Select Legislative Leader</span>
                  <button 
                    onClick={() => setShowAdjustLeader(false)}
                    className="text-zinc-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {party.legislativeLeaderId && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateLegislativeLeader(null);
                        setShowAdjustLeader(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-400/10 rounded transition-colors flex items-center justify-between group"
                    >
                      <span>Remove Current Leader</span>
                      <X size={12} className="opacity-0 group-hover:opacity-100" />
                    </button>
                  )}
                  {assemblyStats.mlasFromParty.map((mla) => {
                    const isSelected = mla.person.id === party.legislativeLeaderId;
                    return (
                      <button
                        key={mla.person.id}
                        type="button"
                        onClick={() => {
                          onUpdateLegislativeLeader(mla.person.id);
                          setShowAdjustLeader(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center justify-between group ${
                          isSelected 
                            ? 'bg-blue-500/20 text-blue-400 font-bold' 
                            : 'text-zinc-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="truncate">{mla.person.name}</span>
                          <span className="text-[9px] text-zinc-500 font-normal">MLA for {mla.constituencyName}</span>
                        </div>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                  {assemblyStats.mlasFromParty.length === 0 && (
                    <div className="py-4 text-center text-xs text-zinc-500 italic">
                      No MLAs found in current assembly
                    </div>
                  )}
                </div>
              </div>
            )}

            {legislativeLeaders.length > 0 ? (
              <ul className="space-y-2">
                {legislativeLeaders.map((lead, idx) => {
                  const isGoldRole = lead.title.toLowerCase().includes('chief minister');
                  const nameColorClass = isGoldRole 
                    ? "text-[#FFD700] hover:text-[#FFD700]" 
                    : "text-white hover:text-white";
                  return (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-zinc-400 select-none text-base leading-tight mt-0.5">•</span>
                      <div>
                        <button
                          type="button"
                          onClick={() => onNavigatePerson(lead.person.id)}
                          className={`${nameColorClass} hover:underline font-semibold text-left transition-colors`}
                        >
                          {lead.person.name}
                        </button>
                        <span className="text-zinc-400 text-xs sm:text-sm ml-1.5 font-medium">
                          ({lead.title})
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="text-zinc-500 italic">None designated in active house</span>
            )}
          </div>
        </div>

        {/* 7. Colours */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Colours
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              {colorsList.map((color, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    className="inline-block w-4 h-4 rounded-xs border border-white/30 shadow-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-zinc-100 font-medium">
                    {getColorLabel(color)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 8. Legislative Assembly Representation (with progress bar) */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Legislative Assembly
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {assemblyStats ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-base sm:text-lg font-extrabold text-white font-mono">
                    {assemblyStats.seatsWon} / {assemblyStats.totalSeats}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-400 font-mono">
                    ({assemblyStats.percentage}%)
                  </span>
                </div>

                {/* Progress Bar (Matches Wikipedia Infobox Bar in Screenshot) */}
                <div className="w-48 sm:w-64 h-3 bg-zinc-800 rounded-none overflow-hidden border border-zinc-700/60 relative">
                  <div
                    className="h-full transition-all duration-500 rounded-none"
                    style={{
                      width: `${Math.min(100, Math.max(0, assemblyStats.percentage))}%`,
                      backgroundColor: primaryPartyColor,
                    }}
                  />
                </div>

                <div className="text-xs text-zinc-400 flex items-center gap-2 mt-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      assemblyStats.isGov
                        ? 'bg-amber-400'
                        : assemblyStats.isOpp
                        ? 'bg-[#FFD700]'
                        : 'bg-zinc-400'
                    }`}
                  />
                  <span>{assemblyStats.statusLabel}</span>
                  <span className="text-zinc-600">•</span>
                  <span>{assemblyStats.assemblyName}</span>
                </div>
              </div>
            ) : (
              <span className="text-zinc-500 italic">No active legislative assembly</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
