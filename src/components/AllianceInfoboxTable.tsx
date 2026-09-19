import React from 'react';
import { Shield, ExternalLink } from 'lucide-react';
import { Alliance, Party, Person, Assembly, Constituency } from '../types';

interface AllianceInfoboxTableProps {
  alliance: Alliance;
  leadingParty?: Party | null;
  relatedParties: Party[];
  allianceLeadership: {
    leader: Person | null;
    chairman: Person | null;
    founder: Person | null;
  } | null;
  highCommandMembers?: Person[];
  activeAssembly?: Assembly | null;
  constituenciesList: Constituency[];
  partiesList: Party[];
  personsList: Person[];
  onNavigatePerson: (personId: string) => void;
  onNavigateParty: (partyId: string) => void;
  onAppointRole?: (role: 'leader' | 'chairman' | 'founder') => void;
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
      return `${foundedDate}; ${yearsAgo} years ago`;
    }
  }
  return foundedDate;
}

export const AllianceInfoboxTable: React.FC<AllianceInfoboxTableProps> = ({
  alliance,
  leadingParty,
  relatedParties,
  allianceLeadership,
  highCommandMembers,
  activeAssembly,
  constituenciesList,
  partiesList,
  personsList,
  onNavigatePerson,
  onNavigateParty,
  onAppointRole,
  isDissolved = false,
}) => {
  const partiesMap = React.useMemo(() => {
    const map = new Map<string, Party>();
    partiesList.forEach((p) => map.set(p.id, p));
    return map;
  }, [partiesList]);

  // Compute assembly strength
  const assemblyStats = React.useMemo(() => {
    if (!activeAssembly) return null;

    const targetConstituencies = constituenciesList.filter(
      (c) => c && c.currentAssemblyId === activeAssembly.id
    );
    const totalSeats = targetConstituencies.length || 0;

    const memberPartyIds = new Set(relatedParties.map((p) => p.id));
    let seatsWon = 0;
    const partySeatsMap: Record<string, number> = {};

    targetConstituencies.forEach((c) => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        const person = personsList.find((p) => p.id === c.currentIncumbentId);
        if (person) {
          let belongsToAlliance = false;
          if (person.partyId === 'independent') {
            if (activeAssembly.independentSupports?.[person.id] === alliance.id) {
              belongsToAlliance = true;
            }
          } else if (memberPartyIds.has(person.partyId)) {
            belongsToAlliance = true;
            partySeatsMap[person.partyId] = (partySeatsMap[person.partyId] || 0) + 1;
          }

          if (belongsToAlliance) {
            seatsWon++;
          }
        }
      }
    });

    const percentage = totalSeats > 0 ? ((seatsWon / totalSeats) * 100).toFixed(1) : '0.0';

    // Government / Opposition status
    const cmId = activeAssembly.leaders?.chiefMinister;
    const cm = cmId ? personsList.find((p) => p.id === cmId) : null;
    
    const isGovernment =
      activeAssembly.composition?.government?.id === alliance.id ||
      (cm && (memberPartyIds.has(cm.partyId) ||
          activeAssembly.independentSupports?.[cmId!] === alliance.id));

    const lopId = activeAssembly.leaders?.leaderOfOpposition;
    const lop = lopId ? personsList.find((p) => p.id === lopId) : null;

    const isOpposition =
      !isGovernment &&
      (activeAssembly.composition?.opposition?.id === alliance.id ||
        (lop && (memberPartyIds.has(lop.partyId) ||
            activeAssembly.independentSupports?.[lopId!] === alliance.id)));

    const statusLabel = isGovernment
      ? 'Ruling Government Coalition'
      : isOpposition
      ? 'Official Opposition Coalition'
      : 'Coalition Front';

    return {
      assemblyName: activeAssembly.name,
      totalSeats,
      seatsWon,
      percentage: parseFloat(percentage),
      partySeatsMap,
      isGovernment,
      isOpposition,
      statusLabel,
    };
  }, [activeAssembly, constituenciesList, relatedParties, personsList, alliance.id]);

  // Determine Leader designation and role
  const leaderRoleInfo = React.useMemo(() => {
    if (!allianceLeadership?.leader) return null;
    const leader = allianceLeadership.leader;
    const roles: string[] = [];

    // Check State / Region mention from assembly name (e.g. "Kerala Legislative Assembly" -> "of Kerala")
    let regionSuffix = '';
    if (activeAssembly?.name && activeAssembly.name.toLowerCase().includes('kerala')) {
      regionSuffix = ' of Kerala';
    }

    if (activeAssembly?.leaders) {
      if (activeAssembly.leaders.chiefMinister === leader.id) {
        roles.push(`Chief Minister${regionSuffix}`);
      } else if (activeAssembly.leaders.deputyChiefMinister === leader.id) {
        roles.push(`Deputy Chief Minister${regionSuffix}`);
      } else if (activeAssembly.leaders.leaderOfOpposition === leader.id) {
        roles.push(`Leader of Opposition${regionSuffix}`);
      } else if (activeAssembly.leaders.deputyLeaderOfOpposition === leader.id) {
        roles.push(`Deputy Leader of Opposition`);
      } else if (activeAssembly.leaders.speaker === leader.id) {
        roles.push(`Speaker of the House`);
      } else if (activeAssembly.leaders.deputySpeaker === leader.id) {
        roles.push(`Deputy Speaker`);
      }
    }

    // Check ministerial portfolio
    if (activeAssembly && leader.assemblyRoles?.[activeAssembly.id]) {
      const portfolio = leader.assemblyRoles[activeAssembly.id];
      if (typeof portfolio === 'string' && portfolio && !roles.includes(portfolio)) {
        roles.push(portfolio);
      }
    }

    // Check constituency
    if (activeAssembly) {
      const mlaCon = constituenciesList.find(
        (c) => c.currentAssemblyId === activeAssembly.id && c.currentIncumbentId === leader.id
      );
      if (mlaCon) {
        roles.push(`MLA for ${mlaCon.name}`);
      }
    }

    const leaderParty = partiesMap.get(leader.partyId);
    return {
      roles,
      partyAbbr: leaderParty?.abbreviation || leaderParty?.name || 'Independent',
      primaryRoleText: roles.length > 0 ? roles[0] : (leaderParty?.abbreviation ? `Leader, ${leaderParty.abbreviation}` : 'Legislator'),
    };
  }, [allianceLeadership?.leader, activeAssembly, constituenciesList, partiesMap]);

  // Determine secondary leader / convenor from high command or leadership
  const convenorPerson = React.useMemo(() => {
    if (highCommandMembers && highCommandMembers.length > 0) {
      // Find someone who is not the leader
      const candidate = highCommandMembers.find((m) => m.id !== allianceLeadership?.leader?.id);
      return candidate || null;
    }
    return null;
  }, [highCommandMembers, allianceLeadership?.leader]);

  // Colors list
  const colorsList = React.useMemo(() => {
    if (Array.isArray(alliance.colors) && alliance.colors.length > 0) {
      return alliance.colors;
    }
    return ['#0056B3'];
  }, [alliance.colors]);

  const primaryAllianceColor = colorsList[0] || '#38bdf8';

  return (
    <div className="w-full bg-[#0d1117] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-sans">
      {/* Top Banner with Alliance Identity */}
      <div className="px-5 py-4 bg-[#161b22] border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 shadow-md shrink-0"
            style={{ backgroundColor: `${primaryAllianceColor}20` }}
          >
            <Shield size={22} style={{ color: primaryAllianceColor }} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              {alliance.name}
            </h2>
            <p className="text-[11px] text-zinc-400 font-medium tracking-wide">
              Strategic Political Front
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/20 rounded-md text-xs font-black tracking-wider uppercase">
            {alliance.abbreviation || 'ALLIANCE'}
          </span>
        </div>
      </div>

      {/* Main Tabular Specifications (Wikipedia Infobox Format) */}
      <div className="divide-y divide-zinc-800/80 text-sm sm:text-base">
        {/* 1. Abbreviation */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Abbreviation
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 font-semibold tracking-wide">
            {alliance.abbreviation || '—'}
          </div>
        </div>

        {/* 2. Leader */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Leader
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {allianceLeadership?.leader ? (
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="text-zinc-400 select-none text-base leading-tight mt-0.5">•</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => onNavigatePerson(allianceLeadership.leader!.id)}
                      className={`${leaderRoleInfo?.roles.some(r => r.toLowerCase().includes('chief minister')) ? 'text-[#FFD700] hover:text-[#FFD700]' : 'text-white hover:text-white'} hover:underline font-semibold text-left transition-colors`}
                    >
                      {allianceLeadership.leader.name}
                    </button>
                    {leaderRoleInfo && leaderRoleInfo.primaryRoleText && (
                      <div className="text-zinc-400 text-xs sm:text-sm mt-0.5">
                        ({leaderRoleInfo.primaryRoleText})
                      </div>
                    )}
                  </div>
                </li>

                {convenorPerson && (
                  <li className="flex items-start gap-2.5">
                    <span className="text-zinc-400 select-none text-base leading-tight mt-0.5">•</span>
                    <div>
                      <button
                        type="button"
                        onClick={() => onNavigatePerson(convenorPerson.id)}
                        className="text-white hover:text-white hover:underline font-semibold text-left transition-colors"
                      >
                        {convenorPerson.name}
                      </button>
                      <div className="text-zinc-400 text-xs sm:text-sm mt-0.5">
                        (convenor)
                      </div>
                    </div>
                  </li>
                )}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500 italic">
                <span>Vacant</span>
                {!isDissolved && onAppointRole && (
                  <button
                    type="button"
                    onClick={() => onAppointRole('leader')}
                    className="text-xs not-italic text-[#FFD700] hover:underline font-bold"
                  >
                    + Appoint
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Chairperson */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Chairperson
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {allianceLeadership?.chairman ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <button
                  type="button"
                  onClick={() => onNavigatePerson(allianceLeadership.chairman!.id)}
                  className="text-white hover:text-white hover:underline font-semibold text-left transition-colors"
                >
                  {allianceLeadership.chairman.name}
                </button>
                {partiesMap.get(allianceLeadership.chairman.partyId) && (
                  <span className="text-zinc-400 text-xs sm:text-sm">
                    ({partiesMap.get(allianceLeadership.chairman.partyId)?.abbreviation || partiesMap.get(allianceLeadership.chairman.partyId)?.name})
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500 italic">
                <span>Vacant</span>
                {!isDissolved && onAppointRole && (
                  <button
                    type="button"
                    onClick={() => onAppointRole('chairman')}
                    className="text-xs not-italic text-[#FFD700] hover:underline font-bold"
                  >
                    + Appoint
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Founders */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Founders
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {allianceLeadership?.founder ? (
              <button
                type="button"
                onClick={() => onNavigatePerson(allianceLeadership.founder!.id)}
                className="text-white hover:text-white hover:underline font-semibold text-left transition-colors"
              >
                {allianceLeadership.founder.name}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500 italic">
                <span>None recorded</span>
                {!isDissolved && onAppointRole && (
                  <button
                    type="button"
                    onClick={() => onAppointRole('founder')}
                    className="text-xs not-italic text-[#FFD700] hover:underline font-bold"
                  >
                    + Appoint
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 5. Founded */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Founded
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100">
            {formatFoundedDate(alliance.foundedDate)}
          </div>
        </div>

        {/* 6. Leading Party */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            Leading Party
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            {leadingParty ? (
              <button
                type="button"
                onClick={() => onNavigateParty(leadingParty.id)}
                className="text-white hover:text-white hover:underline font-semibold text-left transition-colors"
              >
                {leadingParty.name} ({leadingParty.abbreviation})
              </button>
            ) : (
              <span className="text-zinc-500 italic">Not designated</span>
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
                      backgroundColor: primaryAllianceColor,
                    }}
                  />
                </div>

                <div className="text-xs text-zinc-400 flex items-center gap-2 mt-1">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      assemblyStats.isGovernment
                        ? 'bg-amber-400'
                        : assemblyStats.isOpposition
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
              <span className="text-zinc-500 italic">No active assembly session</span>
            )}
          </div>
        </div>

        {/* 9. ECI Status */}
        <div className="flex flex-col sm:flex-row hover:bg-white/[0.015] transition-colors">
          <div className="w-full sm:w-56 shrink-0 px-5 py-3 sm:py-3.5 font-bold text-white select-none">
            ECI Status
          </div>
          <div className="px-5 pb-3 sm:py-3.5 text-zinc-100 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isDissolved ? 'bg-zinc-500' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span className="font-semibold text-zinc-200 text-sm uppercase tracking-wider">
                {alliance.eciStatus || (isDissolved ? 'Dissolved Alliance' : 'Active Strategic Front')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
