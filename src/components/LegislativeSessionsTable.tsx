import React from 'react';
import { Assembly, Constituency, Designation, Person, Party, Alliance } from '../types';

export interface LegislativeSessionMember {
  memberId?: string;
  memberName: string;
  partyId?: string;
  partyName: string;
  partyColor: string;
  reason?: string;
  isByelected?: boolean;
  electionDate?: number;
  removalDate?: number;
}

export interface LegislativeSessionRow {
  id: string;
  assemblyOrdinal: string; // e.g. "1st", "2nd", "5th"
  assemblyName: string;
  assemblyId?: string;
  slNo?: number;
  members: LegislativeSessionMember[];
}

interface LegislativeSessionsTableProps {
  title?: string;
  subtitle?: string;
  rows: LegislativeSessionRow[];
  onNavigatePerson?: (personId: string) => void;
  onNavigateParty?: (partyId: string) => void;
  onNavigateAlliance?: (allianceId: string) => void;
  onNavigateAssembly?: (assemblyId: string) => void;
  hideAssemblyColumn?: boolean;
}

export const LegislativeSessionsTable: React.FC<LegislativeSessionsTableProps> = ({
  title,
  subtitle,
  rows,
  onNavigatePerson,
  onNavigateParty,
  onNavigateAssembly,
  hideAssemblyColumn = false,
}) => {
  if (!rows || rows.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 bg-[#0d1117] border border-zinc-800 rounded-xl text-center">
        <p className="text-zinc-400 font-medium">No legislative sessions recorded yet.</p>
      </div>
    );
  }

  const showAssembly = !hideAssemblyColumn && rows.some(r => r.assemblyOrdinal || r.assemblyName);

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
          <thead>
            <tr className="bg-zinc-900/50 border-b border-zinc-800">
              <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest border-r border-zinc-800/50">
                Sl. No.
              </th>
              {showAssembly && (
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest border-r border-zinc-800/50">
                  Assembly Session
                </th>
              )}
              <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest">
                Member / Party Affiliation
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              return (
                <tr
                  key={row.id}
                  className="hover:bg-white/[0.02] transition-colors border-b border-zinc-800/50 last:border-0"
                >
                  {/* COLUMN 0: Sl. No. */}
                  <td className="w-16 px-4 sm:px-6 py-4 border-r border-zinc-800/90 text-zinc-500 font-mono text-sm align-middle text-center bg-black/20">
                    {(row.slNo || 0).toString().padStart(2, '0')}
                  </td>

                  {/* COLUMN 1: Assembly Session */}
                  {showAssembly && (
                    <td className="w-40 sm:w-56 px-4 sm:px-6 py-4 border-r border-zinc-800/90 text-zinc-100 font-medium text-base sm:text-lg align-middle select-none">
                      {row.assemblyId && onNavigateAssembly ? (
                        <button
                          type="button"
                          onClick={() => onNavigateAssembly(row.assemblyId!)}
                          className="hover:text-[#FFD700] hover:underline transition-colors cursor-pointer"
                          title={row.assemblyName || row.assemblyOrdinal}
                        >
                          {row.assemblyName || row.assemblyOrdinal}
                        </button>
                      ) : (
                        <span>{row.assemblyName || row.assemblyOrdinal}</span>
                      )}
                    </td>
                  )}

                  {/* COLUMN 2: Members & Parties (Unified Column) */}
                  <td colSpan={2} className="px-4 sm:px-6 py-4 align-top border-l border-zinc-800/50">
                    <div className="flex flex-col gap-4">
                      {row.members.map((m, mIdx) => (
                        <div 
                          key={`${row.id}-m-${mIdx}`} 
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${mIdx > 0 ? 'pt-4 border-t border-zinc-800/30' : ''}`}
                        >
                          {/* Member Info */}
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            {m.memberId && m.memberId !== 'vacant' && onNavigatePerson ? (
                              <button
                                type="button"
                                onClick={() => onNavigatePerson(m.memberId!)}
                                className="text-left text-[#FFD700] font-bold text-base sm:text-lg hover:underline transition-colors cursor-pointer block truncate"
                              >
                                {m.memberName}
                              </button>
                            ) : (
                              <span
                                className={
                                  m.memberName === 'Vacant' || !m.memberName
                                    ? 'text-zinc-500 italic block font-medium'
                                    : 'text-[#FFD700] block font-bold text-base sm:text-lg'
                                }
                              >
                                {m.memberName || 'Vacant'}
                              </span>
                            )}
                            
                            {m.reason && m.reason !== 'appointment' && (
                              <span className="text-[10px] sm:text-[11px] text-red-500 font-black uppercase tracking-wider leading-tight mt-0.5">
                                ({m.reason}{m.removalDate ? ` • ${new Date(m.removalDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}` : ''})
                              </span>
                            )}
                            
                            {m.isByelected && (
                              <span className="text-[10px] sm:text-[11px] text-emerald-500 font-black uppercase tracking-wider leading-tight mt-0.5 italic">
                                (Bye Elected{m.electionDate ? ` • ${(() => {
                                  const d = new Date(m.electionDate);
                                  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
                                })()}` : ''})
                              </span>
                            )}
                          </div>

                          {/* Party Info */}
                          <div className="flex items-center gap-2 sm:justify-end shrink-0">
                            <div 
                              className="w-1.5 h-6 rounded-full shrink-0" 
                              style={{ backgroundColor: m.partyColor || '#666' }} 
                            />
                            {m.partyId && m.partyId !== 'independent' && onNavigateParty ? (
                              <button
                                type="button"
                                onClick={() => onNavigateParty(m.partyId!)}
                                className="text-xs sm:text-sm font-black text-zinc-400 hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
                              >
                                {m.partyName}
                              </button>
                            ) : (
                              <span className="text-xs sm:text-sm font-black text-zinc-500 uppercase tracking-widest">{m.partyName}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
