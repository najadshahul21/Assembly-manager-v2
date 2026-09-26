import React from 'react';
import { User, Flag, Shield, Landmark, Award, ChevronRight, MapPin, Calendar, Trash2, Edit } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { useDbLookup } from '../context/DbLookupContext';
import { Person, Party, Alliance, Assembly, Designation, Constituency, EntityType } from '../types';
import { db } from '../db';
import { formatPersonName } from '../utils/governmentUtils';
import { formatAppDate } from '../utils/dateUtils';

interface CardProps {
  entity: any;
  type: EntityType;
  onDelete?: (e: React.MouseEvent) => void;
  onPromote?: (e: React.MouseEvent) => void;
  onSupportAlliance?: (e: React.MouseEvent) => void;
  currentAssemblyId?: string;
}

export const EntityCard: React.FC<CardProps> = ({ entity, type, onDelete, onPromote, onSupportAlliance, currentAssemblyId }) => {
  const navigate = useNavigate();
  const { partiesMap, alliancesMap, assembliesMap, designations, persons, parties, assemblies } = useDbLookup();

  const cardData = React.useMemo(() => {
    if (!entity) return null;

    let party = null;
    let alliance = null;
    let currentAssembly = null;
    let currentSupportAlliance = null;
    let allianceStats = null;
    let activeRoles: { role: string; assemblyName: string }[] = [];

    if (type === EntityType.PERSON) {
      if (entity.partyId && entity.partyId !== 'independent') {
        party = partiesMap[entity.partyId] || null;
        if (party && party.allianceId && party.allianceId !== 'independent') {
          alliance = alliancesMap[party.allianceId] || null;
        }
      }

      if (currentAssemblyId) {
        currentAssembly = assembliesMap[currentAssemblyId] || null;
        if (currentAssembly && currentAssembly.independentSupports && entity.partyId === 'independent') {
          const supAllianceId = currentAssembly.independentSupports[entity.id];
          if (supAllianceId) {
            currentSupportAlliance = alliancesMap[supAllianceId] || null;
          }
        }
      }

      // Fetch roles
      const activeAssemblies = assemblies.filter(a => a.isActive !== false);
      const activeAssemblyIds = new Set(activeAssemblies.map(a => a.id));

      const roles: { role: string; assemblyName: string }[] = [];
      const person = entity as Person;

      activeAssemblies.forEach(a => {
        if (a.leaders) {
          for (const [roleKey, pId] of Object.entries(a.leaders)) {
            if (pId === person.id && pId !== 'vacant') {
              const displayName = roleKey
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              
              if (!roles.some(r => r.role.toLowerCase() === displayName.toLowerCase() && r.assemblyName === a.name)) {
                roles.push({
                  role: displayName,
                  assemblyName: a.name
                });
              }
            }
          }
        }
      });

      if (person.assemblyRoles) {
        for (const [aId, roleStr] of Object.entries(person.assemblyRoles)) {
          if (activeAssemblyIds.has(aId) && roleStr) {
            const assembly = assembliesMap[aId];
            if (assembly) {
              const individualRoles = (roleStr as string).split(', ').map(r => r.trim()).filter(Boolean);
              individualRoles.forEach(r => {
                const exists = roles.some(existing => 
                  existing.role.toLowerCase() === r.toLowerCase() && 
                  existing.assemblyName === assembly.name
                );
                if (!exists) {
                  roles.push({
                    role: r,
                    assemblyName: assembly.name
                  });
                }
              });
            }
          }
        }
      }

      // Designatory lookups using designations list
      const activeDesigs = designations.filter(d => d.incumbentId === person.id);
      activeDesigs.forEach(d => {
        if (d.assemblyId && activeAssemblyIds.has(d.assemblyId)) {
          const assembly = assembliesMap[d.assemblyId];
          const r = d.name;
          const exists = roles.some(existing => 
            existing.role.toLowerCase() === r.toLowerCase() && 
            existing.assemblyName === (assembly?.name || '')
          );
          if (!exists) {
            roles.push({
              role: r,
              assemblyName: assembly?.name || ''
            });
          }
        }
      });

      const seenNames = new Set<string>();
      const uniqueRoles: typeof roles = [];
      roles.forEach((r) => {
        const cleanName = r.role.trim().toLowerCase();
        if (!seenNames.has(cleanName)) {
          seenNames.add(cleanName);
          uniqueRoles.push(r);
        } else {
          const existingIdx = uniqueRoles.findIndex(
            (x) => x.role.trim().toLowerCase() === cleanName,
          );
          if (
            existingIdx !== -1 &&
            !uniqueRoles[existingIdx].assemblyName &&
            r.assemblyName
          ) {
            uniqueRoles[existingIdx].assemblyName = r.assemblyName;
          }
        }
      });

      activeRoles = uniqueRoles.filter((role) => {
        const nameLower = role.role.toLowerCase();
        const conNameLower = person.constituencyName?.toLowerCase() || "";
        if (nameLower.includes("mla")) return false;
        if (conNameLower && nameLower === conNameLower) return false;
        if (conNameLower && nameLower.includes(conNameLower) && !nameLower.includes("minister")) return false;
        if (nameLower === "special role") return false;
        return true;
      });
    }

    if (type === EntityType.ALLIANCE) {
      const allianceParties = parties.filter(p => p.allianceId === entity.id);
      const partyIds = allianceParties.map(p => p.id);
      const personCount = persons.filter(p => partyIds.includes(p.partyId)).length;
      const leadingParty = entity.leadingPartyId ? partiesMap[entity.leadingPartyId] || null : null;
      allianceStats = {
        partyCount: allianceParties.length,
        personCount,
        leadingParty
      };
    }

    return {
      party,
      alliance,
      currentAssembly,
      currentSupportAlliance,
      allianceStats,
      activeRoles
    };
  }, [entity, type, currentAssemblyId, partiesMap, alliancesMap, assembliesMap, designations, persons, parties]);

  const party = cardData?.party ?? null;
  const alliance = cardData?.alliance ?? null;
  const currentAssembly = cardData?.currentAssembly ?? null;
  const currentSupportAlliance = cardData?.currentSupportAlliance ?? null;
  const allianceStats = cardData?.allianceStats ?? null;
  const activeRoles = cardData?.activeRoles ?? [];

  if (!entity) return null;

  const getDetails = () => {
    switch (type) {
      case EntityType.PERSON:
        let subtitle = '';
        
        if (entity.constituencyName && entity.constituencyName !== 'Special Role') {
          let partyText = entity.partyId === 'independent' ? 'IND' : (party?.abbreviation || entity.partyId);
          if (entity.partyId === 'independent' && currentSupportAlliance) {
            partyText = `IND + ${currentSupportAlliance.abbreviation}`;
          } else if (alliance) {
            partyText = `${partyText} • ${alliance.abbreviation}`;
          }
          
          let mlaRole = `MLA for ${entity.constituencyName}`;
          if (partyText) {
            mlaRole = `${mlaRole} (${partyText})`;
          }
          if (entity.mlaStatusText) {
            mlaRole = `${entity.mlaStatusText} | ${mlaRole}`;
          }
          subtitle = mlaRole;
        } else {
          subtitle = entity.subtitleOverride || (entity.partyId === 'independent' 
            ? (currentSupportAlliance ? `Independent (Supporting ${currentSupportAlliance.abbreviation})` : 'Independent') 
            : (party?.name || 'Member'));
          if (!entity.subtitleOverride && alliance) {
            subtitle = `${subtitle} • ${alliance.name}`;
          }
          if (!entity.subtitleOverride && currentAssemblyId && entity.assemblyRoles && entity.assemblyRoles[currentAssemblyId]) {
            subtitle = entity.assemblyRoles[currentAssemblyId];
          } else if (!entity.subtitleOverride && entity.assemblyRoles) {
            // If not in a specific assembly context, show the FIRST active looking role?
            // Or just show the one from the most recent/active assembly.
            const roles = Object.values(entity.assemblyRoles);
            if (roles.length > 0) {
              subtitle = roles[roles.length - 1] as string;
            }
          }

          if (!entity.subtitleOverride && entity.constituencyName) {
            subtitle = `${subtitle} (${entity.constituencyName})`;
          }
        }

        const hasDesignation = activeRoles.length > 0 || (entity.constituencyName && entity.constituencyName !== 'Special Role');

        return {
          title: formatPersonName(entity.name, entity.gender, !!hasDesignation),
          subtitle,
          image: entity.imageUrl,
          icon: User,
          color: 'border-red-500/20'
        };
      case EntityType.PARTY:
        return {
          title: entity.name,
          subtitle: entity.abbreviation,
          image: entity.logoUrl,
          icon: Flag,
          color: 'border-yellow-500/20'
        };
      case EntityType.ALLIANCE:
        return {
          title: entity.name,
          subtitle: `${entity.abbreviation} Alliance`,
          image: entity.logoUrl,
          icon: Shield,
          color: 'border-[#FFD700]/20'
        };
      case EntityType.ASSEMBLY:
        return {
          title: entity.name,
          subtitle: entity.subName || 'Legislative Body',
          image: entity.logoUrl,
          icon: Landmark,
          color: 'border-gold-500/20'
        };
      case EntityType.DESIGNATION:
        return {
          title: entity.name,
          subtitle: entity.constituency || 'National Role',
          image: null,
          icon: Award,
          color: 'border-purple-500/20'
        };
      case EntityType.CONSTITUENCY:
        return {
          title: entity.name,
          subtitle: `Sl. No: ${entity.slNo}`,
          image: null,
          icon: MapPin,
          color: 'border-orange-500/20'
        };
      default:
        return {
          title: 'Unknown',
          subtitle: 'Unknown Entry',
          image: null,
          icon: ChevronRight,
          color: 'border-gray-500/20'
        };
    }
  };

  const { title, subtitle, image, icon: Icon, color } = getDetails();

  const status = (() => {
    switch (type) {
      case EntityType.ASSEMBLY:
        if (entity.isActive !== false) {
          return {
            label: 'Active',
            colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            dotClass: 'bg-emerald-400'
          };
        } else {
          return {
            label: 'Dissolved',
            colorClass: 'bg-gray-500/10 text-gray-400 border-white/5',
            dotClass: 'bg-gray-400'
          };
        }
      case EntityType.DESIGNATION:
        if (entity.incumbentId === 'vacant') {
          return {
            label: 'Vacant',
            colorClass: 'bg-red-500/10 text-red-400 border-red-500/20',
            dotClass: 'bg-red-500 animate-pulse'
          };
        } else {
          return {
            label: 'Active',
            colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            dotClass: 'bg-emerald-400'
          };
        }
      case EntityType.CONSTITUENCY:
        if (entity.currentIncumbentId === 'vacant') {
          return {
            label: 'Vacant',
            colorClass: 'bg-red-500/10 text-red-400 border-red-500/20',
            dotClass: 'bg-red-500 animate-pulse'
          };
        } else {
          return {
            label: 'Active',
            colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            dotClass: 'bg-emerald-400'
          };
        }
      default:
        if ((type === EntityType.PERSON || type === EntityType.PARTY) && (entity as any).isSuspended) {
          return {
            label: 'Suspended',
            colorClass: 'bg-red-500/10 text-red-500 border-red-500/20',
            dotClass: 'bg-red-500'
          };
        }
        return {
          label: 'Active',
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dotClass: 'bg-emerald-400'
        };
    }
  })();

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      onClick={() => navigate(`/${type}/${entity.id}`)}
      className={`glass-card p-4 cursor-pointer group flex flex-col h-full ${color} hover:border-[#FFD700]/40 transition-all relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-2 z-10">
         {onPromote && (
           <motion.button 
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 215, 0, 0.2)' }}
             whileTap={{ scale: 0.95 }}
             onClick={(e) => {
               e.stopPropagation();
               onPromote(e);
             }}
             className="px-3 py-1.5 bg-[#FFD700]/10 rounded-xl text-[#FFD700] backdrop-blur-md border border-[#FFD700]/30 hover:text-white flex items-center gap-2 transition-all shadow-xl font-black text-[9px] uppercase tracking-[0.1em]"
           >
              <Shield size={12} strokeWidth={3} />
              <span>Promote</span>
           </motion.button>
         )}
         {onSupportAlliance && (
           <motion.button 
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             whileHover={{ scale: 1.05, backgroundColor: 'rgba(234, 179, 8, 0.2)' }}
             whileTap={{ scale: 0.95 }}
             onClick={(e) => {
               e.stopPropagation();
               onSupportAlliance(e);
             }}
             className="px-3 py-1.5 bg-yellow-500/10 rounded-xl text-yellow-400 backdrop-blur-md border border-yellow-500/30 hover:text-white flex items-center gap-2 transition-all shadow-xl font-black text-[9px] uppercase tracking-[0.1em]"
           >
              <Award size={12} strokeWidth={3} />
              <span>{currentSupportAlliance ? `Supporting: ${currentSupportAlliance.abbreviation}` : 'Support Alliance'}</span>
           </motion.button>
         )}
         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
            <div className="p-2 bg-[#FFD700]/10 rounded-lg text-[#FFD700] backdrop-blur-md border border-[#FFD700]/20">
               <Edit size={14} />
            </div>
            {onDelete && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(e);
                }}
                className="p-2 bg-red-500/10 rounded-lg text-red-500 backdrop-blur-md border border-red-500/20 hover:bg-red-500 flex items-center justify-center transition-colors"
              >
                 <Trash2 size={14} />
              </div>
            )}
         </div>
      </div>
      <div className="flex items-start justify-between mb-4">
        {image ? (
          <img src={image} alt={title} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#FFD700]">
            <Icon size={32} />
          </div>
        )}
        <div className="p-2 bg-white/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight size={16} />
        </div>
      </div>
      
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-bold text-lg line-clamp-1">{title}</h3>
          {status && (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${status.colorClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
              <span>{status.label}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{subtitle}</p>
        {type === EntityType.PERSON && activeRoles && activeRoles.length > 0 && (
          <div className="mt-2.5 pl-3 border-l devotion border-[#FFD700]/30 flex flex-col gap-2">
            {activeRoles.map((r, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-[11px] font-bold text-[#FFD700] uppercase tracking-wider leading-tight">{r.role}</span>
                <span className="text-[9px] text-gray-400 font-mono tracking-tight mt-0.5 uppercase">{r.assemblyName}</span>
              </div>
            ))}
          </div>
        )}
        {type === EntityType.ALLIANCE && allianceStats && (
          <div className="flex gap-4 mt-3">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Parties</span>
              <span className="text-xs font-bold text-[#FFD700]">{allianceStats.partyCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Members</span>
              <span className="text-xs font-bold text-white">{allianceStats.personCount}</span>
            </div>
            {allianceStats.leadingParty && (
              <div className="flex flex-col border-l border-white/5 pl-4">
                <span className="text-[10px] text-[#FFD700] font-black uppercase tracking-widest">Lead</span>
                <span className="text-xs font-bold text-[#FFD700]">{allianceStats.leadingParty.abbreviation}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
           <Calendar size={12}/>
           <span>
             {(() => {
               const dateVal = entity.updatedAt;
               const isValidDate = dateVal && !isNaN(new Date(dateVal).getTime());
               if (type === EntityType.PERSON) {
                 if (entity.constituencyName && entity.constituencyName !== 'Special Role') {
                   return `MLA for ${entity.constituencyName}`;
                 }
                 // If person has a general constituency field or similar
                 if (entity.constituency) {
                   return `MLA for ${entity.constituency}`;
                 }
               }
               if (isValidDate) {
                 return formatAppDate(dateVal);
               }
               return type === EntityType.PERSON ? 'Elected Member' : 'Registry Entry';
             })()}
           </span>
        </div>
        {status && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${status.colorClass}`}>
             <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
             <span>{status.label}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
};
