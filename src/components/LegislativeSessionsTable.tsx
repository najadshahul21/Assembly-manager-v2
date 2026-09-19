import React from 'react';
import { Assembly, Constituency, Designation, Person, Party, Alliance } from '../types';

export interface LegislativeSessionRow {
  id: string;
  assemblyOrdinal: string; // e.g. "1st", "2nd", "5th"
  assemblyName: string;
  assemblyId?: string;
  termLimits?: string;
  memberId?: string;
  memberName: string;
  partyId?: string;
  partyName: string;
  partyColor: string;
  allianceId?: string;
  allianceName?: string;
  reason?: string;
  isByelected?: boolean;
  electionDate?: number;
  removalDate?: number;
}

interface LegislativeSessionsTableProps {
  title?: string;
  subtitle?: string;
  rows: LegislativeSessionRow[];
  onNavigatePerson?: (personId: string) => void;
  onNavigateParty?: (partyId: string) => void;
  onNavigateAlliance?: (allianceId: string) => void;
  onNavigateAssembly?: (assemblyId: string) => void;
}

interface SpanInfo {
  render: boolean;
  rowSpan: number;
}

// Compute independent row spans for columns
function computeSpans<T>(items: T[], getKey: (item: T) => string): SpanInfo[] {
  const result: SpanInfo[] = [];
  let i = 0;
  while (i < items.length) {
    const key = getKey(items[i]);
    let span = 1;
    // Vacant or empty items shouldn't group together
    const canGroup = key && key !== 'vacant' && key !== 'None' && key !== '';
    if (canGroup) {
      while (i + span < items.length && getKey(items[i + span]) === key) {
        span++;
      }
    }
    result.push({ render: true, rowSpan: span });
    for (let j = 1; j < span; j++) {
      result.push({ render: false, rowSpan: 1 });
    }
    i += span;
  }
  return result;
}

export const LegislativeSessionsTable: React.FC<LegislativeSessionsTableProps> = ({
  title,
  subtitle,
  rows,
  onNavigatePerson,
  onNavigateParty,
  onNavigateAssembly,
}) => {
  // Pre-calculate spans for Member (col 2) and Party (col 3)
  const memberSpans = React.useMemo(() => {
    return computeSpans<LegislativeSessionRow>(rows, (r: LegislativeSessionRow) => (r.memberId || r.memberName || '').trim().toLowerCase());
  }, [rows]);

  const partySpans = React.useMemo(() => {
    return computeSpans<LegislativeSessionRow>(rows, (r: LegislativeSessionRow) => (r.partyName || r.partyId || '').trim().toLowerCase());
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 bg-[#0d1117] border border-zinc-800 rounded-xl text-center">
        <p className="text-zinc-400 font-medium">No legislative sessions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              {title}
            </h3>
          )}
          {subtitle && <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>}
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-lg border border-zinc-800 bg-[#0d1117] shadow-2xl">
        <table className="w-full border-collapse text-left font-sans">
          <tbody>
            {rows.map((row, idx) => {
              const memberSpan = memberSpans[idx];
              const partySpan = partySpans[idx];

              return (
                <tr
                  key={row.id || `${row.assemblyOrdinal}-${idx}`}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  {/* COLUMN 1: Assembly Session (1st, 2nd, 5th, etc.) */}
                  <td className="w-24 sm:w-32 px-4 sm:px-6 py-4 border border-zinc-800/90 text-zinc-100 font-medium text-base sm:text-lg align-middle select-none">
                    {row.assemblyId && onNavigateAssembly ? (
                      <button
                        type="button"
                        onClick={() => onNavigateAssembly(row.assemblyId!)}
                        className="hover:text-[#FFD700] hover:underline transition-colors cursor-pointer"
                        title={row.assemblyName || row.assemblyOrdinal}
                      >
                        {row.assemblyOrdinal}
                      </button>
                    ) : (
                      <span>{row.assemblyOrdinal}</span>
                    )}
                  </td>

                  {/* COLUMN 2: Member / Incumbent */}
                  {memberSpan.render && (
                    <td
                      rowSpan={memberSpan.rowSpan}
                      className="px-4 sm:px-6 py-4 border border-zinc-800/90 text-[#FFD700] font-normal text-base sm:text-lg align-middle leading-snug"
                    >
                      <div className="flex flex-col gap-0.5">
                        {row.memberId && row.memberId !== 'vacant' && onNavigatePerson ? (
                          <button
                            type="button"
                            onClick={() => onNavigatePerson(row.memberId!)}
                            className="text-left text-[#FFD700] hover:text-[#FFD700] hover:underline transition-colors cursor-pointer block"
                          >
                            {row.memberName}
                          </button>
                        ) : (
                          <span
                            className={
                              row.memberName === 'Vacant' || !row.memberName
                                ? 'text-zinc-500 italic block'
                                : 'text-[#FFD700] block'
                            }
                          >
                            {row.memberName || 'Vacant'}
                          </span>
                        )}
                        
                        {row.reason && row.reason !== 'appointment' && (
                          <span className="text-[11px] text-red-500 font-bold leading-tight mt-1">
                            ({row.reason}{row.removalDate ? ` on ${new Date(row.removalDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}` : ''})
                          </span>
                        )}
                        
                        {row.isByelected && (
                          <span className="text-[11px] text-emerald-500 font-bold leading-tight mt-1 italic">
                            (Assumed office{row.electionDate ? ` on ${(() => {
                              const d = new Date(row.electionDate);
                              const day = d.getDate();
                              const month = d.toLocaleString('en-GB', { month: 'long' });
                              const year = d.getFullYear();
                              const getOrdinal = (n: number) => {
                                const s = ['th', 'st', 'nd', 'rd'];
                                const v = n % 100;
                                return n + (s[(v - 20) % 10] || s[v] || s[0]);
                              };
                              return `${getOrdinal(day)} ${month} ${year}`;
                            })()}` : ' as Bye Elected'})
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  {/* COLUMN 3: Party / Coalition with Vertical Left Color Strip */}
                  {partySpan.render && (
                    <td
                      rowSpan={partySpan.rowSpan}
                      style={{
                        borderLeft: `5px solid ${row.partyColor || '#0284c7'}`,
                      }}
                      className="px-4 sm:px-6 py-4 border-t border-r border-b border-zinc-800/90 text-[#FFD700] font-normal text-base sm:text-lg align-middle leading-snug"
                    >
                      {row.partyId && row.partyId !== 'independent' && onNavigateParty ? (
                        <button
                          type="button"
                          onClick={() => onNavigateParty(row.partyId!)}
                          className="text-left text-[#FFD700] hover:text-[#FFD700] hover:underline transition-colors cursor-pointer"
                        >
                          {row.partyName}
                        </button>
                      ) : (
                        <span className="text-[#FFD700]">{row.partyName}</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
