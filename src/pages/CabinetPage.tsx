import React from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Person, Assembly } from '../types';
import { Landmark, ArrowDown, UserMinus, ShieldCheck, Award, Users, Shield, Calendar, MapPin, ExternalLink, Crown, Settings2 } from 'lucide-react';
import { LeadershipCouncilModal } from '../components/LeadershipCouncilModal';
import { prefixRole, formatPersonName } from '../utils/governmentUtils';

export const CabinetPage: React.FC = () => {
  const navigate = useNavigate();
  const [demoteConfirm, setDemoteConfirm] = React.useState<{ person: Person; role: string } | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLeadershipModalOpen, setIsLeadershipModalOpen] = React.useState(false);
  const [isAdjustMode, setIsAdjustMode] = React.useState(false);

  const constituencies = useLiveQuery(() => db.constituencies.toArray()) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const alliances = useLiveQuery(() => db.alliances.toArray()) || [];
  const persons = useLiveQuery(() => db.persons.toArray()) || [];

  const activeAssembly = useLiveQuery(async () => {
    const all = await db.assemblies.toArray();
    return all.find(a => a.isActive !== false) || null;
  });

  const cabinetMembers = useLiveQuery(async () => {
    if (!activeAssembly) return [];
    
    const targetAssemblyId = activeAssembly.id;
    const currentAssembly = await db.assemblies.get(targetAssemblyId) || activeAssembly;
    const allPersons = await db.persons.toArray();
    const allParties = await db.parties.toArray();
    const allAlliances = await db.alliances.toArray();
    const designations = await db.designations.where('assemblyId').equals(targetAssemblyId).toArray();

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
             r.includes('chief secretary');
    };

    // Find holders of key constitutional designations and ministerial designations
    const specialDesignations = designations.filter(d => isCabinetRole(d.name));

    const cabinetData: Map<string, { person: Person; roles: { name: string; canDemote: boolean }[] }> = new Map();

    // 1. Add people with ministerial roles (from assemblyRoles)
    const ministers = allPersons.filter(p => !p.isSuspended && p.assemblyRoles && p.assemblyRoles[targetAssemblyId]);
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
        if (holder && !holder.isSuspended) {
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
    if (currentAssembly.leaders) {
      for (const [role, pId] of Object.entries(currentAssembly.leaders)) {
        if (
          role === 'leaderOfOpposition' || 
          role === 'deputyLeaderOfOpposition'
        ) {
          continue;
        }
        if (pId && pId !== 'vacant') {
          const holder = allPersons.find(p => p.id === pId);
          if (holder && !holder.isSuspended) {
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
        const supportedAllianceId = currentAssembly.independentSupports?.[person.id];
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

        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsAdjustMode(!isAdjustMode)}
            className={`px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer border ${
              isAdjustMode 
                ? 'bg-[#FFD700] text-black border-[#FFD700] shadow-lg shadow-[#FFD700]/20' 
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            }`}
          >
            <Settings2 size={14} />
            {isAdjustMode ? 'Finish Adjusting' : 'Adjust Portfolios'}
          </button>
          <button 
            onClick={() => navigate(`/assembly/${activeAssembly.id}`)}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer border border-white/10"
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
            className="bg-[#121212] border border-white/[0.03] rounded-[2rem] overflow-hidden group hover:border-[#FFD700]/20 transition-all duration-500 shadow-xl hover:shadow-[#FFD700]/[0.02]"
          >
            <div className="p-7">
              <div className="flex items-start gap-5 mb-8">
                <div 
                  onClick={() => navigate(`/person/${m.person.id}`)}
                  className="w-14 h-14 rounded-2xl bg-black overflow-hidden border border-white/[0.05] shrink-0 group-hover:border-[#FFD700]/30 transition-all duration-500 cursor-pointer flex-none shadow-inner"
                >
                  {m.person.imageUrl ? (
                    <img 
                      src={m.person.imageUrl} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      referrerPolicy="no-referrer" 
                      alt={m.person.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#FFD700]/40 bg-white/[0.02]">
                      <Shield size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div onClick={() => navigate(`/person/${m.person.id}`)} className="cursor-pointer">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight group-hover:text-[#FFD700] transition-colors duration-300">
                      {formatPersonName(m.person.name, m.person.gender, !!activeAssembly?.isActive)}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] opacity-40" />
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.15em]">{m.allianceAbbreviation}</p>
                    </div>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/[0.03] flex items-center justify-center text-gray-600 group-hover:text-[#FFD700] transition-all duration-500 shrink-0 border border-white/[0.02]">
                  <Award size={16} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-8 min-h-[44px]">
                {m.roles.map((roleObj, ri) => {
                  const role = prefixRole(roleObj.name);
                  const isSpecial = ['Chief Minister', 'Speaker', 'Secretary'].some(s => role.includes(s));
                  return (
                    <div key={ri} className="flex items-center gap-1.5 group/role">
                      <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                        isSpecial 
                          ? 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/10' 
                          : 'bg-white/[0.03] text-gray-400 border border-white/[0.02] hover:bg-white/[0.06] hover:text-gray-300'
                      }`}>
                        {role}
                      </div>
                      {roleObj.canDemote && isAdjustMode && (
                        <button 
                          onClick={() => handleDemote(m.person, roleObj.name)}
                          className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 transition-all duration-300 hover:text-white hover:scale-110 shadow-sm border border-red-500/20 animate-in fade-in zoom-in duration-300"
                          title="Demote"
                        >
                          <ArrowDown size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-white/[0.03]">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Status</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-500/80 font-black uppercase tracking-wider">Active Portfolio</span>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/[0.02] border border-white/[0.02]">
                  <Users size={12} className="text-gray-700" />
                </div>
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
                <ArrowDown size={20} />
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
      {/* Leadership Council Modal */}
      {isLeadershipModalOpen && activeAssembly && (
        <LeadershipCouncilModal
          assembly={activeAssembly}
          constituencies={constituencies}
          parties={parties}
          alliances={alliances}
          persons={persons}
          onClose={() => setIsLeadershipModalOpen(false)}
        />
      )}
    </div>
  );
};
