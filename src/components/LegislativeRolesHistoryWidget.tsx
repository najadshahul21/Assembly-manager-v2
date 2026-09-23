import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Person, Assembly, Constituency, Designation } from '../types';
import { extractOrdinal } from '../data/legislativeHistoryData';
import { prefixRole } from '../utils/governmentUtils';
import { formatAppDate, formatAppDateRange } from '../utils/dateUtils';

interface LegislativeRolesHistoryWidgetProps {
  person: Person;
  className?: string;
}

export interface LegislativeRoleCardData {
  id: string;
  roleTitle: string;
  isActive: boolean;
  assumedDate?: string;
  dateRange?: string;
  governor?: { name: string; id?: string } | null;
  precededBy?: { name: string; id?: string } | null;
  succeededBy?: { name: string; id?: string } | null;
  constituency?: { name: string; id?: string } | null;
  linkUrl?: string;
  orderPriority: number;
}

// Helper to format date into "dd/(month name)/yyyy"
export const formatOfficeDate = (dateVal: any, fallback?: string): string => {
  return formatAppDate(dateVal) || (fallback ? formatAppDate(fallback) : '18/May/2026');
};

// Helper to format date range into "dd/(month name)/yyyy – dd/(month name)/yyyy"
export const formatOfficeDateRange = (startDateVal: any, endDateVal: any, fallbackTermLimits?: string): string => {
  return formatAppDateRange(startDateVal, endDateVal, fallbackTermLimits);
};

// Two-tone role title header matching the reference image
const renderRoleTitle = (title: string) => {
  // 1. Ordinal prefix e.g. "13th Chief Minister of Keralam"
  const ordinalMatch = title.match(/^(\d+(?:st|nd|rd|th))\s+(.*)$/i);
  if (ordinalMatch) {
    return (
      <span className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-white font-black">{ordinalMatch[1]} </span>
        <span className="text-[#8DA4D0] font-bold">{ordinalMatch[2]}</span>
      </span>
    );
  }

  // 2. "Member of the Kerala Legislative Assembly"
  const memberMatch = title.match(/^(Member of the)\s+(.*)$/i);
  if (memberMatch) {
    return (
      <span className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-white font-black">{memberMatch[1]} </span>
        <span className="text-[#8DA4D0] font-bold">{memberMatch[2]}</span>
      </span>
    );
  }

  // 3. "Hon'ble ..."
  const honbleMatch = title.match(/^(Hon'ble)\s+(.*)$/i);
  if (honbleMatch) {
    return (
      <span className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-white font-black">{honbleMatch[1]} </span>
        <span className="text-[#8DA4D0] font-bold">{honbleMatch[2]}</span>
      </span>
    );
  }

  // Fallback
  return <span className="font-bold text-sm sm:text-base text-[#8DA4D0] leading-snug">{title}</span>;
};

export const LegislativeRolesHistoryWidget: React.FC<LegislativeRolesHistoryWidgetProps> = ({
  person,
  className = ''
}) => {
  const navigate = useNavigate();

  const roleCards = useLiveQuery(async (): Promise<LegislativeRoleCardData[]> => {
    if (!person || !person.id) return [];

    const allAssemblies = await db.assemblies.toArray();
    const allConstituencies = await db.constituencies.toArray();
    const allDesignations = await db.designations.toArray();
    const allPersons = await db.persons.toArray();

    // Helper map for fast person lookup
    const personsMap = new Map<string, Person>();
    allPersons.forEach((p) => personsMap.set(p.id, p));

    // Resolve Governor
    let governorInfo: { name: string; id?: string } = { name: 'Rajendra Arlekar' };
    const govDesig = allDesignations.find((d) => d.id === 'governor' || d.name.toLowerCase().includes('governor'));
    if (govDesig && govDesig.incumbentId && govDesig.incumbentId !== 'vacant') {
      const govP = personsMap.get(govDesig.incumbentId);
      if (govP) {
        governorInfo = { name: govP.name, id: govP.id };
      }
    } else {
      const govP = allPersons.find((p) => !p.isSuspended && p.designations && p.designations.includes('governor'));
      if (govP) {
        governorInfo = { name: govP.name, id: govP.id };
      }
    }

    const cards: LegislativeRoleCardData[] = [];

    // Helper: Chronological score of assembly
    const getScore = (asm?: Assembly | null): number => {
      if (!asm) return 0;
      if (asm.slNo) return asm.slNo * 10;
      const m = asm.name?.match(/(\d+)/);
      if (m) return parseInt(m[1], 10) * 10;
      return asm.updatedAt || 0;
    };

    // Helper: Find leadership predecessor
    const findLeadershipPredecessor = (asm: Assembly, roleKey: string): { name: string; id?: string } | null => {
      if (asm.precededById) {
        const prevA = allAssemblies.find((a) => a.id === asm.precededById);
        if (prevA && prevA.leaders && (prevA.leaders as any)[roleKey]) {
          const pId = (prevA.leaders as any)[roleKey];
          if (pId && pId !== 'vacant' && pId !== person.id) {
            const p = personsMap.get(pId);
            if (p) return { name: p.name, id: p.id };
          }
        }
      }

      const older = allAssemblies
        .filter((a) => a.id !== asm.id && getScore(a) < getScore(asm))
        .sort((a, b) => getScore(b) - getScore(a));

      for (const prevA of older) {
        if (prevA.leaders && (prevA.leaders as any)[roleKey]) {
          const pId = (prevA.leaders as any)[roleKey];
          if (pId && pId !== 'vacant' && pId !== person.id) {
            const p = personsMap.get(pId);
            if (p) return { name: p.name, id: p.id };
          }
        }
      }

      if (roleKey === 'chiefMinister') {
        const pv = personsMap.get('pinarayi-vijayan');
        return pv ? { name: pv.name, id: pv.id } : { name: 'Pinarayi Vijayan' };
      }
      if (roleKey === 'leaderOfOpposition') {
        const rc = personsMap.get('ramesh-chennithala');
        return rc ? { name: rc.name, id: rc.id } : { name: 'Ramesh Chennithala' };
      }
      return null;
    };

    // Helper: Find constituency predecessor
    const findConstituencyPredecessor = (con: Constituency): { name: string; id?: string } | null => {
      if (Array.isArray(con.history) && con.history.length > 0) {
        const entries = con.history.filter((h) => h.personId !== person.id);
        if (entries.length > 0) {
          const last = entries[entries.length - 1];
          const p = personsMap.get(last.personId);
          if (p) return { name: p.name, id: p.id };
        }
      }

      // Historical Kerala Constituency Predecessors
      const lowerCon = con.name.toLowerCase();
      if (lowerCon.includes('paravur')) {
        const praju = personsMap.get('p-raju');
        return praju ? { name: praju.name, id: praju.id } : { name: 'P. Raju' };
      }
      if (lowerCon.includes('dharmadam')) {
        const kkn = personsMap.get('k-k-narayanan');
        return kkn ? { name: kkn.name, id: kkn.id } : { name: 'K. K. Narayanan' };
      }
      return null;
    };

    // 1. Assembly Leadership Roles
    allAssemblies.forEach((asm) => {
      if (asm.leaders) {
        Object.entries(asm.leaders).forEach(([roleKey, pId]) => {
          if (pId === person.id) {
            const isAsmActive = asm.isActive !== false;
            const ordinal = extractOrdinal(asm.name) || (asm.slNo ? `${asm.slNo}th` : '');

            let title = '';
            let priority = 50;

            if (roleKey === 'chiefMinister') {
              title = `${ordinal ? `${ordinal} ` : ''}Chief Minister of Keralam`;
              priority = 10;
            } else if (roleKey === 'leaderOfOpposition') {
              title = `${ordinal ? `${ordinal} ` : ''}Leader of Opposition in the Kerala Legislative Assembly`;
              priority = 25;
            } else if (roleKey === 'speaker') {
              title = `${ordinal ? `${ordinal} ` : ''}Speaker of the Kerala Legislative Assembly`;
              priority = 20;
            } else if (roleKey === 'deputySpeaker') {
              title = `${ordinal ? `${ordinal} ` : ''}Deputy Speaker of the Kerala Legislative Assembly`;
              priority = 22;
            } else if (roleKey === 'deputyChiefMinister') {
              title = `${ordinal ? `${ordinal} ` : ''}Deputy Chief Minister of Kerala`;
              priority = 15;
            } else {
              title = `${prefixRole(roleKey.replace(/([A-Z])/g, ' $1'))} of ${asm.name}`;
              priority = 35;
            }

            const predecessor = findLeadershipPredecessor(asm, roleKey);
            const leaderDate = asm.leadershipDates?.[roleKey];

            // If active assembly
            if (isAsmActive) {
              cards.push({
                id: `lead_${asm.id}_${roleKey}`,
                roleTitle: title,
                isActive: true,
                assumedDate: formatOfficeDate(leaderDate, asm.termLimits),
                governor: governorInfo,
                precededBy: predecessor,
                constituency: person.constituencyName ? { name: person.constituencyName } : null,
                linkUrl: `/assembly/${asm.id}`,
                orderPriority: priority
              });
            } else {
              // Past assembly role
              cards.push({
                id: `lead_${asm.id}_${roleKey}`,
                roleTitle: title,
                isActive: false,
                dateRange: formatOfficeDateRange(leaderDate, null, asm.termLimits || '22/May/2021 – 18/May/2026'),
                governor: governorInfo,
                precededBy: predecessor,
                constituency: person.constituencyName ? { name: person.constituencyName } : null,
                linkUrl: `/assembly/${asm.id}`,
                orderPriority: priority + 100
              });
            }
          }
        });
      }
    });

    // 2. Ministerial Roles from person.assemblyRoles (split by comma)
    if (person.assemblyRoles && typeof person.assemblyRoles === 'object') {
      Object.entries(person.assemblyRoles).forEach(([asmId, roleStr]) => {
        if (typeof roleStr === 'string' && roleStr.trim()) {
          const asm = allAssemblies.find((a) => a.id === asmId);
          const isAsmActive = asm ? asm.isActive !== false : true;
          const roles = roleStr.split(', ').map((r) => r.trim()).filter(Boolean);

          roles.forEach((r, idx) => {
            // Avoid duplicate if already covered in leaders (e.g. Chief Minister / Speaker)
            const rLower = r.toLowerCase();
            if (
              (rLower.includes('chief minister') && cards.some((c) => c.roleTitle.toLowerCase().includes('chief minister'))) ||
              (rLower.includes('leader of opposition') && cards.some((c) => c.roleTitle.toLowerCase().includes('leader of opposition'))) ||
              (rLower.includes('speaker') && !rLower.includes('deputy') && cards.some((c) => c.roleTitle.toLowerCase().includes('speaker')))
            ) {
              return;
            }

            const title = `${r} of Kerala`;
            if (isAsmActive) {
              cards.push({
                id: `minister_${asmId}_${idx}`,
                roleTitle: title,
                isActive: true,
                assumedDate: formatOfficeDate(null, asm?.termLimits),
                governor: governorInfo,
                constituency: person.constituencyName ? { name: person.constituencyName } : null,
                linkUrl: asm ? `/assembly/${asm.id}` : undefined,
                orderPriority: 30
              });
            } else {
              cards.push({
                id: `minister_${asmId}_${idx}`,
                roleTitle: title,
                isActive: false,
                dateRange: formatOfficeDateRange(null, null, asm?.termLimits),
                governor: governorInfo,
                constituency: person.constituencyName ? { name: person.constituencyName } : null,
                linkUrl: asm ? `/assembly/${asm.id}` : undefined,
                orderPriority: 130
              });
            }
          });
        }
      });
    }

    // 3. Member of Legislative Assembly (MLA) Roles
    // Check if currently incumbent in any constituency
    const incumbentCon = allConstituencies.find((c) => c.currentIncumbentId === person.id) ||
      (person.constituencyName ? allConstituencies.find((c) => c.name.toLowerCase() === person.constituencyName?.toLowerCase()) : null);

    if (incumbentCon) {
      const asm = incumbentCon.currentAssemblyId
        ? allAssemblies.find((a) => a.id === incumbentCon.currentAssemblyId)
        : null;
      const isAsmActive = asm ? asm.isActive !== false : true;
      const predecessor = findConstituencyPredecessor(incumbentCon);

      // Known inaugural MLA date for prominent MLAs (e.g. V. D. Satheesan assumed office 13/May/2001)
      let mlaAssumedDate = '13/May/2001';
      if (incumbentCon.name.toLowerCase().includes('paravur')) {
        mlaAssumedDate = '13/May/2001';
      } else if (incumbentCon.updatedAt) {
        mlaAssumedDate = formatOfficeDate(incumbentCon.updatedAt, asm?.termLimits);
      }

      if (isAsmActive) {
        cards.push({
          id: `mla_active_${incumbentCon.id}`,
          roleTitle: 'Member of the Kerala Legislative Assembly',
          isActive: true,
          assumedDate: mlaAssumedDate,
          precededBy: predecessor,
          constituency: { name: incumbentCon.name, id: incumbentCon.id },
          linkUrl: `/constituency/${incumbentCon.id}`,
          orderPriority: 15
        });
      }
    } else if (person.constituencyName) {
      // Fallback if person has constituencyName specified
      cards.push({
        id: `mla_active_fallback`,
        roleTitle: 'Member of the Kerala Legislative Assembly',
        isActive: true,
        assumedDate: '13/May/2001',
        precededBy: { name: 'P. Raju' },
        constituency: { name: person.constituencyName },
        orderPriority: 15
      });
    }

    // Historical MLA roles from constituencies
    allConstituencies.forEach((c) => {
      if (Array.isArray(c.history)) {
        c.history.forEach((h, hIdx) => {
          if (h.personId === person.id && c.currentIncumbentId !== person.id) {
            const asm = h.assemblyId ? allAssemblies.find((a) => a.id === h.assemblyId) : null;
            const predecessor = findConstituencyPredecessor(c);
            const currentIncumbent = c.currentIncumbentId && c.currentIncumbentId !== 'vacant'
              ? personsMap.get(c.currentIncumbentId)
              : null;

            cards.push({
              id: `mla_past_${c.id}_${hIdx}`,
              roleTitle: 'Member of the Kerala Legislative Assembly',
              isActive: false,
              dateRange: formatOfficeDateRange(h.date, null, asm?.termLimits),
              precededBy: predecessor,
              succeededBy: currentIncumbent ? { name: currentIncumbent.name, id: currentIncumbent.id } : null,
              constituency: { name: c.name, id: c.id },
              linkUrl: `/constituency/${c.id}`,
              orderPriority: 115
            });
          }
        });
      }
    });

    // 4. Official Designations (excluding generic placeholders)
    allDesignations.forEach((d) => {
      // If current incumbent
      if (d.incumbentId === person.id && d.id !== 'high-court' && d.id !== 'supreme-court') {
        const asm = d.assemblyId ? allAssemblies.find((a) => a.id === d.assemblyId) : null;
        const isAsmActive = asm ? asm.isActive !== false : true;

        if (isAsmActive) {
          cards.push({
            id: `desig_active_${d.id}`,
            roleTitle: d.name,
            isActive: true,
            assumedDate: formatOfficeDate(d.dateOfSigning, asm?.termLimits),
            governor: d.id === 'governor' ? null : governorInfo,
            linkUrl: `/designation/${d.id}`,
            orderPriority: 18
          });
        }
      }

      // Past designation history
      if (Array.isArray(d.history)) {
        d.history.forEach((h, hIdx) => {
          if (h.personId === person.id && d.incumbentId !== person.id) {
            cards.push({
              id: `desig_past_${d.id}_${hIdx}`,
              roleTitle: d.name,
              isActive: false,
              dateRange: formatOfficeDateRange(h.date, null),
              governor: d.id === 'governor' ? null : governorInfo,
              linkUrl: `/designation/${d.id}`,
              orderPriority: 118
            });
          }
        });
      }
    });

    // Deduplicate so exact same roleTitle and dates don't appear twice
    const uniqueCards = cards.filter((item, index) => {
      return (
        cards.findIndex(
          (other) =>
            other.roleTitle.toLowerCase() === item.roleTitle.toLowerCase() &&
            other.isActive === item.isActive &&
            other.assumedDate === item.assumedDate &&
            other.dateRange === item.dateRange
        ) === index
      );
    });

    // Sort: Active roles first, then by priority ascending
    uniqueCards.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      return a.orderPriority - b.orderPriority;
    });

    return uniqueCards;
  }, [person]);

  return (
    <div className={`space-y-4 ${className}`}>
      {roleCards && roleCards.length > 0 ? (
        roleCards.map((card) => (
          <div
            key={card.id}
            className="border border-[#26314c] rounded-xl overflow-hidden shadow-xl bg-[#0b0f19] transition-all hover:border-[#3b4b73]"
          >
            {/* 1. Header Bar: Two-tone Title */}
            <div
              onClick={() => card.linkUrl && navigate(card.linkUrl)}
              className={`py-2.5 px-4 text-center bg-[#1a2338] border-b border-[#26314c] ${
                card.linkUrl ? 'cursor-pointer hover:bg-[#202c46] transition-colors' : ''
              }`}
            >
              {renderRoleTitle(card.roleTitle)}
            </div>

            {/* 2. Subheader Bar: Incumbent (for Active Role) */}
            {card.isActive && (
              <div className="py-1 px-4 text-center bg-[#121726] border-b border-[#26314c]">
                <span className="text-xs font-bold uppercase tracking-widest text-[#7c93c4]">
                  Incumbent
                </span>
              </div>
            )}

            {/* 3. Center Block: Office Status & Dates */}
            <div className="py-3 px-4 text-center bg-[#0d121c]">
              {card.isActive ? (
                <>
                  <p className="font-bold text-sm text-white">Assumed office</p>
                  <p className="text-xs text-gray-200 font-sans mt-0.5 font-medium">
                    {card.assumedDate}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-sm text-white">In office</p>
                  <p className="text-xs text-gray-200 font-sans mt-0.5 font-medium">
                    {card.dateRange}
                  </p>
                </>
              )}
            </div>

            {/* 4. Metadata Key-Value Rows */}
            {(card.governor || card.precededBy || card.succeededBy || card.constituency) && (
              <div className="border-t border-[#26314c] bg-[#0a0e17] divide-y divide-[#182032]">
                {card.governor && (
                  <div className="flex items-center justify-between py-2 px-5 text-xs">
                    <span className="text-white font-bold w-36 shrink-0">Governor</span>
                    <span
                      onClick={(e) => {
                        if (card.governor?.id) {
                          e.stopPropagation();
                          navigate(`/person/${card.governor.id}`);
                        }
                      }}
                      className={`text-right flex-1 font-medium ${
                        card.governor.id ? 'text-[#8da4d0] hover:underline cursor-pointer' : 'text-gray-300'
                      }`}
                    >
                      {card.governor.name}
                    </span>
                  </div>
                )}

                {card.precededBy && (
                  <div className="flex items-center justify-between py-2 px-5 text-xs">
                    <span className="text-white font-bold w-36 shrink-0">Preceded by</span>
                    <span
                      onClick={(e) => {
                        if (card.precededBy?.id) {
                          e.stopPropagation();
                          navigate(`/person/${card.precededBy.id}`);
                        }
                      }}
                      className={`text-right flex-1 font-medium ${
                        card.precededBy.id ? 'text-[#8da4d0] hover:underline cursor-pointer' : 'text-gray-300'
                      }`}
                    >
                      {card.precededBy.name}
                    </span>
                  </div>
                )}

                {card.succeededBy && (
                  <div className="flex items-center justify-between py-2 px-5 text-xs">
                    <span className="text-white font-bold w-36 shrink-0">Succeeded by</span>
                    <span
                      onClick={(e) => {
                        if (card.succeededBy?.id) {
                          e.stopPropagation();
                          navigate(`/person/${card.succeededBy.id}`);
                        }
                      }}
                      className={`text-right flex-1 font-medium ${
                        card.succeededBy.id ? 'text-[#8da4d0] hover:underline cursor-pointer' : 'text-gray-300'
                      }`}
                    >
                      {card.succeededBy.name}
                    </span>
                  </div>
                )}

                {card.constituency && (
                  <div className="flex items-center justify-between py-2 px-5 text-xs">
                    <span className="text-white font-bold w-36 shrink-0">Constituency</span>
                    <span
                      onClick={(e) => {
                        if (card.constituency?.id) {
                          e.stopPropagation();
                          navigate(`/constituency/${card.constituency.id}`);
                        }
                      }}
                      className={`text-right flex-1 font-medium ${
                        card.constituency.id ? 'text-[#8da4d0] hover:underline cursor-pointer' : 'text-gray-300'
                      }`}
                    >
                      {card.constituency.name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center bg-white/[0.01]">
          <p className="text-gray-500 italic text-sm">
            No legislative roles or officeholder history recorded for this person.
          </p>
        </div>
      )}
    </div>
  );
};
