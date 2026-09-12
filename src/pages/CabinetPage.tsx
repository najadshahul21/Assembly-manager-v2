import React from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Person, Assembly } from '../types';
import { Landmark, UserMinus, ShieldCheck, Award, Users, Shield, Calendar, MapPin, ExternalLink } from 'lucide-react';

const prefixRole = (role: string): string => {
  const trimmed = role.trim();
  const lower = trimmed.toLowerCase();
  
  if (lower.startsWith("hon'ble") || lower.startsWith("honourable") || lower.startsWith("honorable")) {
    return trimmed;
  }

  const isMinister = lower.includes("minister");
  const isSpeaker = lower.includes("speaker");

  if (isMinister || isSpeaker) {
    let displayName = trimmed;
    if (lower === "chiefminister" || lower === "chief minister") {
      displayName = "Chief Minister";
    } else if (lower === "deputychiefminister" || lower === "deputy chief minister") {
      displayName = "Deputy Chief Minister";
    } else if (lower === "speaker" || lower === "speaker of the house" || lower === "speaker of the assembly") {
      displayName = "Speaker";
    } else if (lower === "deputyspeaker" || lower === "deputy speaker" || lower === "deputy speaker of the assembly" || lower === "deputy speaker of the house") {
      displayName = "Deputy Speaker";
    } else {
      displayName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    
    return `Hon'ble ${displayName}`;
  }
  return trimmed;
};

export const CabinetPage: React.FC = () => {
  const navigate = useNavigate();
  const [demoteConfirm, setDemoteConfirm] = React.useState<{ person: Person; role: string } | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const activeAssembly = useLiveQuery(async () => {
    const all = await db.assemblies.toArray();
    return all.find(a => a.isActive) || all.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  });

  const cabinetMembers = useLiveQuery(async () => {
    if (!activeAssembly) return [];
    
    const targetAssemblyId = activeAssembly.id;
    const allPersons = await db.persons.toArray();
    const allParties = await db.parties.toArray();
    const allAlliances = await db.alliances.toArray();
    const designations = await db.designations.where('assemblyId').equals(targetAssemblyId).toArray();
    
    // Find holders of key constitutional designations and ministerial designations
    const specialDesignations = designations.filter(d => isCabinetRole(d.name));

    const cabinetData: Map<string, { person: Person; roles: { name: string; canDemote: boolean }[] }> = new Map();

    const isCabinetRole = (role: string) => {
      const r = role.toLowerCase();
      if (r.includes('opposition')) return false;
      return r.includes('minister') || 
             r.includes('speaker') || 
             r.includes('secretary') || 
             r.includes('leader') ||
             r.includes('chief');
    };

    const isSpecialRole = (role: string) => {
      const r = role.toLowerCase();
      return (r.includes('chief minister') && !r.includes('deputy')) ||
             r.includes('deputy chief minister') ||
             r.includes('speaker') ||
             r.includes('deputy speaker') ||
             r.includes('chief secretary');
    };

    // 1. Add people with ministerial roles (from assemblyRoles)
    const ministers = allPersons.filter(p => p.assemblyRoles && p.assemblyRoles[targetAssemblyId]);
    for (const p of ministers) {
      const roles = p.assemblyRoles[targetAssemblyId].split(', ').filter(isCabinetRole);
      if (roles.length > 0) {
        const rolesList = roles.map(r => ({
          name: r,
          canDemote: true
        }));
        cabinetData.set(p.id, { 
          person: p, 
          roles: rolesList
        });
      }
    }

    // 2. Add people holding special designations
    for (const d of specialDesignations) {
      if (d.incumbentId && d.incumbentId !== 'vacant') {
        const holder = allPersons.find(p => p.id === d.incumbentId);
        if (holder) {
          const entry = cabinetData.get(holder.id) || { person: holder, roles: [] };
          if (isCabinetRole(d.name)) {
            // Avoid duplicates
            if (!entry.roles.some(r => r.name === d.name)) {
              entry.roles.push({
                name: d.name,
                canDemote: !isSpecialRole(d.name)
              });
            }
            cabinetData.set(holder.id, entry);
          }
        }
      }
    }

    // 3. Add leadership council members (except leader of opposition & deputy leader of opposition, and house leaders)
    if (activeAssembly.leaders) {
      for (const [role, pId] of Object.entries(activeAssembly.leaders)) {
        if (
          role === 'leaderOfOpposition' || 
          role === 'deputyLeaderOfOpposition' || 
          role === 'leaderOfHouse' || 
          role === 'deputyLeaderOfHouse'
        ) {
          continue;
        }
        if (pId && pId !== 'vacant') {
          const holder = allPersons.find(p => p.id === pId);
          if (holder) {
            const entry = cabinetData.get(holder.id) || { person: holder, roles: [] };
            const displayName = role.replace(/([A-Z])/g, ' $1'); // camelCase to Space Case
            const capitalizedDisplayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
            
            // Avoid duplicates
            if (!entry.roles.some(r => r.name.toLowerCase() === capitalizedDisplayName.toLowerCase())) {
              entry.roles.push({
                name: capitalizedDisplayName,
                canDemote: false // Managed via assembly settings / appointments
              });
            }
            cabinetData.set(holder.id, entry);
          }
        }
      }
    }

    const results = Array.from(cabinetData.values()).map(item => {
      const person = item.person;
      let allianceAbbreviation = person.partyId;

      if (person.partyId === 'independent') {
        const supportedAllianceId = activeAssembly.independentSupports?.[person.id];
        if (supportedAllianceId && supportedAllianceId !== 'independent') {
          const alliance = allAlliances.find(a => a.id === supportedAllianceId);
          if (alliance) {
            allianceAbbreviation = alliance.abbreviation;
          } else {
            allianceAbbreviation = 'IND';
          }
        } else {
          allianceAbbreviation = 'IND';
        }
      } else {
        const party = allParties.find(p => p.id === person.partyId);
        if (party) {
          if (party.allianceId && party.allianceId !== 'independent') {
            const alliance = allAlliances.find(a => a.id === party.allianceId);
            if (alliance) {
              allianceAbbreviation = alliance.abbreviation;
            } else {
              allianceAbbreviation = party.abbreviation;
            }
          } else {
            allianceAbbreviation = party.abbreviation;
          }
        }
      }

      return {
        person: item.person,
        roles: item.roles,
        allianceAbbreviation
      };
    });

    return results.sort((a, b) => {
      const aRolesStr = a.roles.map(r => r.name).join(' ').toLowerCase();
      const bRolesStr = b.roles.map(r => r.name).join(' ').toLowerCase();
      
      const getRank = (rolesStr: string) => {
        if (rolesStr.includes('chief minister') && !rolesStr.includes('deputy')) return 1;
        if (rolesStr.includes('deputy chief minister')) return 2;
        if (rolesStr.includes('speaker') && !rolesStr.includes('deputy')) return 3;
        if (rolesStr.includes('deputy speaker')) return 4;
        if (rolesStr.includes('chief secretary')) return 5;
        return 10;
      };

      const rankA = getRank(aRolesStr);
      const rankB = getRank(bRolesStr);
      
      if (rankA !== rankB) return rankA - rankB;
      return (a.person.name || '').localeCompare(b.person.name || '', undefined, { sensitivity: 'base' });
    });
  }, [activeAssembly]);

  const handleDemote = (person: Person, roleToRemove: string) => {
    if (!activeAssembly || !activeAssembly.isActive) {
      setErrorMessage("This assembly has been dissolved. Cabinet changes are prohibited.");
      return;
    }
    setDemoteConfirm({ person, role: roleToRemove });
  };

  const executeDemote = async () => {
    if (!demoteConfirm || !activeAssembly || !activeAssembly.isActive) {
      setDemoteConfirm(null);
      return;
    }

    const { person, role: roleToRemove } = demoteConfirm;
    const now = Date.now();
    const assemblyId = activeAssembly.id;

    try {
      // 1. Remove from assemblyRoles
      const updatedRoles = { ...(person.assemblyRoles || {}) };
      if (updatedRoles[assemblyId]) {
        const rolesList = updatedRoles[assemblyId].split(', ').filter(r => r !== roleToRemove);
        if (rolesList.length > 0) {
          updatedRoles[assemblyId] = rolesList.join(', ');
        } else {
          delete updatedRoles[assemblyId];
        }
      }

      await db.persons.update(person.id, {
        assemblyRoles: updatedRoles,
        updatedAt: now
      });

      // 2. Remove from Designations
      const designations = await db.designations
        .where('assemblyId').equals(assemblyId)
        .and(d => d.name === roleToRemove && d.incumbentId === person.id)
        .toArray();
      
      for (const d of designations) {
        await db.designations.update(d.id, {
          incumbentId: 'vacant',
          updatedAt: now
        });
      }
    } catch (err: any) {
      console.error("Failed to remove role:", err);
      setErrorMessage(err?.message || "Failed to remove portfolio role.");
    } finally {
      setDemoteConfirm(null);
    }
  };

  if (!activeAssembly) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">Scanning for Active Assembly...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-[#FFD700]/10 flex items-center justify-center text-[#FFD700] shadow-lg shadow-[#FFD700]/5 border border-[#FFD700]/20">
            <ShieldCheck size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-[#FFD700] uppercase tracking-[0.2em] bg-[#FFD700]/10 px-2 py-0.5 rounded">Executive</span>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Active Records</span>
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
              State Cabinet
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Managing the Ministerial Leadership of the <span className="text-[#FFD700] font-bold">{activeAssembly.name}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => navigate(`/assembly/${activeAssembly.id}`)}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <Landmark size={14} />
            Assembly View
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cabinetMembers.map((m, i) => (
          <div 
            key={m.person.id}
            className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden group hover:border-[#FFD700]/30 transition-all shadow-2xl hover:shadow-[#FFD700]/5"
          >
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div 
                  onClick={() => navigate(`/person/${m.person.id}`)}
                  className="w-16 h-16 rounded-2xl bg-black overflow-hidden border border-white/10 shrink-0 group-hover:border-[#FFD700]/30 transition-colors cursor-pointer flex-none"
                >
                  {m.person.imageUrl ? (
                    <img 
                      src={m.person.imageUrl} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      alt={m.person.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#D32F2F] bg-white/5">
                      <Shield size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-1">
                  <div onClick={() => navigate(`/person/${m.person.id}`)} className="cursor-pointer">
                    <p className="text-xl font-black text-white uppercase tracking-tighter leading-tight group-hover:text-[#FFD700] transition-colors truncate">{m.person.name}</p>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">{m.allianceAbbreviation}</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-[#FFD700] transition-colors shrink-0">
                  <Award size={18} />
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {m.roles.map((roleObj, ri) => {
                  const role = prefixRole(roleObj.name);
                  const isSpecial = ['Chief Minister', 'Speaker', 'Secretary'].some(s => role.includes(s));
                  return (
                    <div key={ri} className="flex items-center justify-between group/role">
                      <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex-1 mr-2 ${isSpecial ? 'bg-[#FFD700] text-black shrink-0' : 'bg-white/5 text-gray-400'}`}>
                        {role}
                      </div>
                      {roleObj.canDemote && (
                        <button 
                          onClick={() => handleDemote(m.person, roleObj.name)}
                          className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 group/role:opacity-100 hover:bg-red-500 transition-all hover:text-white"
                          title="Demote"
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <div className="flex-1">
                   <div className="flex items-center gap-1 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Clearance</span>
                   </div>
                   <p className="text-[10px] text-emerald-500 font-black uppercase">Verified Member</p>
                </div>
                <Users size={16} className="text-white/10" />
              </div>
            </div>
          </div>
        ))}

        {cabinetMembers.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white/[0.02] rounded-3xl border border-dashed border-white/5">
            <Landmark size={48} className="mx-auto text-gray-700 mb-6" />
            <h3 className="text-xl font-bold uppercase tracking-widest text-gray-500">No Active Cabinet Records</h3>
            <p className="text-gray-600 text-sm mt-2">The current assembly hasn't formed a ministerial cabinet yet.</p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {demoteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center">
                <UserMinus size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Remove Portfolio Role</h3>
            </div>
            <p className="text-gray-300 text-sm">
              Are you sure you want to remove the role <span className="text-[#FFD700] font-semibold">"{demoteConfirm.role}"</span> from <span className="text-white font-semibold">{demoteConfirm.person.name}</span>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDemoteConfirm(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDemote}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message Modal */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181a20] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center">
                <Shield size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Notice</h3>
            </div>
            <p className="text-gray-300 text-sm">{errorMessage}</p>
            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
