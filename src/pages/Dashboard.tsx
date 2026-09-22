import React from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { EntityCard } from '../components/EntityCards';
import { EntityType } from '../types';
import { motion } from 'motion/react';
import { Users, Flag, Shield, Landmark, Award, TrendingUp, AlertCircle, MapPin, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatPersonName } from '../utils/governmentUtils';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const personCount = useLiveQuery(() => db.persons.count()) || 0;
  const partyCount = useLiveQuery(() => db.parties.count()) || 0;
  const persons = useLiveQuery(async () => {
    const list = await db.persons.orderBy('updatedAt').reverse().toArray();
    return list.filter(p => !p.isSuspended).slice(0, 4);
  }) || [];
  const parties = useLiveQuery(async () => {
    const list = await db.parties.orderBy('updatedAt').reverse().toArray();
    return list.filter(p => !p.isSuspended).slice(0, 4);
  }) || [];

  const stateLeadership = useLiveQuery(async () => {
    // 1. Fetch Governor designation safely (non-mutating) with a fallback structure if not loaded yet
    const governorDesig = (await db.designations.get('governor')) || {
      id: 'governor',
      name: "Hon'ble Governor",
      incumbentId: 'vacant',
      dateOfSigning: new Date().toISOString().split('T')[0],
      constituency: '',
      history: [],
      updatedAt: Date.now()
    };

    let governorPerson = null;
    let governorParty = null;
    if (governorDesig && governorDesig.incumbentId && governorDesig.incumbentId !== 'vacant') {
      governorPerson = await db.persons.get(governorDesig.incumbentId);
      if (governorPerson && governorPerson.isSuspended) {
        governorPerson = null;
      }
      if (governorPerson && governorPerson.partyId && governorPerson.partyId !== 'independent') {
        governorParty = await db.parties.get(governorPerson.partyId);
      }
    }

    // 2. Fetch current active assembly (only an active assembly isActive !== false can hold office)
    const allAssemblies = await db.assemblies.toArray();
    const activeAssembly = allAssemblies.find(a => a.isActive !== false) || null;

    let speakerPerson = null;
    let speakerParty = null;
    let cmPerson = null;
    let cmParty = null;
    let isAssemblyVacant = false;

    if (activeAssembly) {
      // Fetch all constituencies belonging to this active assembly
      const assemblyConstituencies = await db.constituencies
        .where('currentAssemblyId')
        .equals(activeAssembly.id)
        .toArray();

      // Collect all active MLA IDs (who hold a non-vacant seat in this assembly)
      const activeMlaMap = new Map<string, string>(); // personId -> constituencyName
      assemblyConstituencies.forEach(c => {
        if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
          activeMlaMap.set(c.currentIncumbentId, c.name);
        }
      });

      // If there are no active MLAs elected to this assembly, the assembly is considered vacant
      if (activeMlaMap.size === 0) {
        isAssemblyVacant = true;
      } else if (activeAssembly.leaders) {
        const speakerId = activeAssembly.leaders.speaker;
        const cmId = activeAssembly.leaders.chiefMinister;

        // Speaker MUST be an active elected MLA in this active assembly and not suspended
        if (speakerId && speakerId !== 'vacant' && activeMlaMap.has(speakerId)) {
          const person = await db.persons.get(speakerId);
          if (person && !person.isSuspended) {
            speakerPerson = {
              ...person,
              constituencyName: activeMlaMap.get(speakerId) || person.constituencyName
            };
            if (speakerPerson.partyId && speakerPerson.partyId !== 'independent') {
              speakerParty = await db.parties.get(speakerPerson.partyId);
            }
          }
        }

        // Chief Minister MUST be an active elected MLA in this active assembly and not suspended
        if (cmId && cmId !== 'vacant' && activeMlaMap.has(cmId)) {
          const person = await db.persons.get(cmId);
          if (person && !person.isSuspended) {
            cmPerson = {
              ...person,
              constituencyName: activeMlaMap.get(cmId) || person.constituencyName
            };
            if (cmPerson.partyId && cmPerson.partyId !== 'independent') {
              cmParty = await db.parties.get(cmPerson.partyId);
            }
          }
        }
      }
    }

    return {
      governor: {
        designation: governorDesig,
        person: governorPerson,
        party: governorParty
      },
      speaker: {
        assembly: activeAssembly,
        person: speakerPerson,
        party: speakerParty,
        isAssemblyVacant
      },
      chiefMinister: {
        assembly: activeAssembly,
        person: cmPerson,
        party: cmParty,
        isAssemblyVacant
      }
    };
  }, []);
  
  const dashboardStats = useLiveQuery(async () => {
    const [allDesignations, allParties, allAlliances, allPersons, allAssemblies, allConstituencies] = await Promise.all([
      db.designations.toArray(),
      db.parties.toArray(),
      db.alliances.toArray(),
      db.persons.toArray(),
      db.assemblies.toArray(),
      db.constituencies.toArray()
    ]);

    // Gather active assemblies and constituencies corresponding to active assemblies
    const activeAssemblies = allAssemblies.filter(a => a.isActive !== false);
    const activeAssemblyIds = new Set(activeAssemblies.map(a => a.id));
    const activeConstituencies = allConstituencies.filter(c => c.currentAssemblyId && activeAssemblyIds.has(c.currentAssemblyId));

    const vacantDesignations = allDesignations.filter(d => 
      d.incumbentId === 'vacant' && 
      (!d.assemblyId || activeAssemblyIds.has(d.assemblyId))
    ).length;
    
    const vacantConstituencies = activeConstituencies.filter(c => 
      c.currentIncumbentId === 'vacant'
    ).length;
    
    const totalVacancies = vacantDesignations + vacantConstituencies;

    const partyLegCounts: Record<string, number> = {};
    activeConstituencies.forEach(c => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        const person = allPersons.find(p => p.id === c.currentIncumbentId);
        if (person) {
          partyLegCounts[person.partyId] = (partyLegCounts[person.partyId] || 0) + 1;
        }
      }
    });
    const leadingPartyId = Object.entries(partyLegCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const leadingParty = allParties.find(p => p.id === leadingPartyId);

    const alliancePartyCounts: Record<string, number> = {};
    allParties.forEach(p => {
      if (p.allianceId && p.allianceId !== 'independent') {
        alliancePartyCounts[p.allianceId] = (alliancePartyCounts[p.allianceId] || 0) + 1;
      }
    });
    const lgAllianceId = Object.entries(alliancePartyCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const lgAlliance = allAlliances.find(a => a.id === lgAllianceId);

    const allianceLegCounts: Record<string, number> = {};
    activeConstituencies.forEach(c => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        const person = allPersons.find(p => p.id === c.currentIncumbentId);
        if (person) {
          const party = allParties.find(pa => pa.id === person.partyId);
          if (party?.allianceId && party.allianceId !== 'independent') {
            allianceLegCounts[party.allianceId] = (allianceLegCounts[party.allianceId] || 0) + 1;
          }
        }
      }
    });
    const strAllianceId = Object.entries(allianceLegCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const strAlliance = allAlliances.find(a => a.id === strAllianceId);

    return {
      leadingParty: leadingParty ? { name: leadingParty.abbreviation || leadingParty.name, count: partyLegCounts[leadingPartyId!] } : null,
      largestAlliance: lgAlliance ? { name: lgAlliance.abbreviation || lgAlliance.name, count: alliancePartyCounts[lgAllianceId!] } : null,
      strongestAlliance: strAlliance ? { name: strAlliance.abbreviation || strAlliance.name, count: allianceLegCounts[strAllianceId!] } : null,
      totalVacancies
    };
  }, []);

  const stats = [
    { label: 'Registered Politicians', value: personCount, icon: Users, color: 'text-[#FFD700]' },
    { label: 'Active Parties', value: partyCount, icon: Flag, color: 'text-[#D32F2F]' },
    { label: 'Vacancies', value: dashboardStats?.totalVacancies || 0, icon: AlertCircle, color: 'text-[#FFD700]' },
  ];

  const insightStats = [
    { 
      label: 'Top Party (MLAs)', 
      value: dashboardStats?.leadingParty?.count || 0, 
      subValue: dashboardStats?.leadingParty?.name || 'N/A',
      icon: Award, 
      color: 'text-orange-400' 
    },
    { 
      label: 'Lg. Alliance (Parties)', 
      value: dashboardStats?.largestAlliance?.count || 0, 
      subValue: dashboardStats?.largestAlliance?.name || 'N/A',
      icon: Shield, 
      color: 'text-emerald-400' 
    },
    { 
      label: 'Top Alliance (MLAs)', 
      value: dashboardStats?.strongestAlliance?.count || 0, 
      subValue: dashboardStats?.strongestAlliance?.name || 'N/A',
      icon: TrendingUp, 
      color: 'text-purple-400' 
    },
  ];

  const quickOps = [
    { name: 'Appoint', icon: Award, color: 'bg-[#FFD700]', text: 'text-black', path: '/designations' },
    { name: 'Constituencies', icon: MapPin, color: 'bg-white/10', text: 'text-white', path: '/constituencies' },
    { name: 'Sessions', icon: Landmark, color: 'bg-white/10', text: 'text-white', path: '/assemblies' },
    { name: 'Analytics', icon: TrendingUp, color: 'bg-white/10', text: 'text-white', path: '/' },
    { name: 'Archive', icon: Shield, color: 'bg-white/10', text: 'text-white', path: '/' },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Welcome */}
      <section>
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="relative p-8 rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#1a0505] to-[#050505] border border-[#FFD700]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-black mb-2 gold-text">
              WELCOME, {(user?.username || user?.name || 'ADMINISTRATOR').toUpperCase()}
            </h2>
            <p className="text-gray-400 max-w-2xl">Manage the legislative ecosystem of Kerala Niyamasabha. Monitor sessions, appointments, and party dynamics from your premium visual dashboard.</p>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-[#D32F2F]/10 blur-[100px] -z-10" />
        </motion.div>
      </section>

      {/* State Leadership Portfolio (3 cards) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-xl font-black uppercase tracking-wider text-white">
              State <span className="text-[#FFD700]">High Portfolio</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
              Constitutional Sovereignty & Executive Authority Executive Leadership
            </p>
          </div>
          <span className="text-[10px] font-mono uppercase bg-white/5 border border-white/10 px-3 py-1 rounded-full text-zinc-400 self-start sm:self-center">
            Autonomous & Legislative Officers
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Governor */}
          <motion.div
            whileHover={{ scale: 1.01, y: -4 }}
            onClick={() => navigate('/designation/governor')}
            className="p-6 rounded-[2rem] bg-gradient-to-b from-[#151518] to-[#0d0d0e] border border-white/5 flex flex-col justify-between group hover:border-[#FFD700]/30 transition-all relative overflow-hidden shadow-xl min-h-[240px] cursor-pointer"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none">
              <Award size={120} className="text-[#FFD700]" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9px] font-mono text-[#FFD700] uppercase tracking-widest font-black bg-[#FFD700]/5 border border-[#FFD700]/10 px-2 py-0.5 rounded">
                    Constitutional Office
                  </span>
                  <h4 className="text-lg font-black text-white mt-2 group-hover:text-[#FFD700] transition-colors leading-tight uppercase">
                    Hon'ble Governor
                  </h4>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl text-[#FFD700] shrink-0">
                  <Award size={20} />
                </div>
              </div>

              <div className="mt-4 flex-1 flex items-center">
                {stateLeadership?.governor?.person ? (
                  <div className="flex items-center gap-4 w-full">
                    {stateLeadership.governor.person.imageUrl ? (
                      <img
                        src={stateLeadership.governor.person.imageUrl}
                        alt={stateLeadership.governor.person.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-2xl object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#FFD700]/60 shrink-0">
                        <User size={28} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white text-base truncate">
                        {formatPersonName(stateLeadership.governor.person.name, stateLeadership.governor.person.gender)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {stateLeadership.governor.party 
                          ? `${stateLeadership.governor.party.name} (${stateLeadership.governor.party.abbreviation})`
                          : "Constitutional Presider / Non-Partisan"
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-left w-full">
                    <p className="text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Vacant Office
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      No sovereign governor currently appointed to the state.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                <span>Autonomous Post</span>
                <span className="text-[#FFD700] group-hover:underline">View Designation →</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Speaker */}
          <motion.div
            whileHover={{ scale: 1.01, y: -4 }}
            onClick={() => {
              const speakerId = stateLeadership?.speaker?.person?.id;
              if (speakerId) {
                navigate(`/person/${speakerId}`);
              } else if (stateLeadership?.speaker?.assembly?.id) {
                navigate(`/assembly/${stateLeadership?.speaker?.assembly?.id}`);
              } else {
                navigate('/assemblies');
              }
            }}
            className="p-6 rounded-[2rem] bg-gradient-to-b from-[#151518] to-[#0d0d0e] border border-white/5 flex flex-col justify-between group hover:border-[#FFD700]/30 transition-all relative overflow-hidden shadow-xl min-h-[240px] cursor-pointer"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none">
              <Landmark size={120} className="text-[#FFD700]" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[9px] font-mono text-[#FFD700] uppercase tracking-widest font-black bg-[#FFD700]/5 border border-[#FFD700]/10 px-2 py-0.5 rounded">
                    Presiding Officer
                  </span>
                  <h4 className="text-lg font-black text-white mt-2 group-hover:text-[#FFD700] transition-colors leading-tight uppercase">
                    Hon'ble Speaker
                  </h4>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl text-[#FFD700] shrink-0">
                  <Landmark size={20} />
                </div>
              </div>

              <div className="mt-4 flex-1 flex items-center">
                {stateLeadership?.speaker?.person ? (
                  <div className="flex items-center gap-4 w-full">
                    {stateLeadership.speaker.person.imageUrl ? (
                      <img
                        src={stateLeadership.speaker.person.imageUrl}
                        alt={stateLeadership.speaker.person.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-2xl object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#FFD700]/60 shrink-0">
                        <User size={28} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white text-base truncate">
                        {formatPersonName(stateLeadership.speaker.person.name, stateLeadership.speaker.person.gender)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {stateLeadership.speaker.person.constituencyName 
                          ? `MLA for ${stateLeadership.speaker.person.constituencyName}`
                          : "Legislative Member"
                        }
                        {stateLeadership.speaker.party && ` • ${stateLeadership.speaker.party.abbreviation}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-left w-full">
                    <p className="text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Vacant Office
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {stateLeadership?.speaker?.assembly 
                        ? (stateLeadership?.speaker?.isAssemblyVacant
                            ? `Assembly seats are vacant for ${stateLeadership?.speaker?.assembly?.name || 'Assembly'}.`
                            : `No Speaker assigned for ${stateLeadership?.speaker?.assembly?.name || 'Assembly'}.`)
                        : "No active legislative assembly recorded."
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                <span className="truncate max-w-[150px]">
                  {stateLeadership?.speaker?.assembly?.name || "No Active Term"}
                </span>
                <span className="text-[#FFD700] group-hover:underline shrink-0">
                  {stateLeadership?.speaker?.person ? "View Profile →" : "Configure Assembly →"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Chief Minister */}
          <motion.div
            whileHover={{ scale: 1.01, y: -4 }}
            onClick={() => {
              const cmId = stateLeadership?.chiefMinister?.person?.id;
              if (cmId) {
                navigate(`/person/${cmId}`);
              } else if (stateLeadership?.chiefMinister?.assembly?.id) {
                navigate(`/assembly/${stateLeadership?.chiefMinister?.assembly?.id}`);
              } else {
                navigate('/assemblies');
              }
            }}
            className="p-6 rounded-[2rem] bg-gradient-to-b from-[#151518] to-[#0d0d0e] border border-white/5 flex flex-col justify-between group hover:border-[#D32F2F]/30 transition-all relative overflow-hidden shadow-xl min-h-[240px] cursor-pointer"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity pointer-events-none">
              <Shield size={120} className="text-[#D32F2F]" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-black text-white mt-2 group-hover:text-[#D32F2F] transition-colors leading-tight uppercase">
                    Hon'ble Chief Minister
                  </h4>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl text-[#D32F2F] shrink-0">
                  <Shield size={20} />
                </div>
              </div>

              <div className="mt-4 flex-1 flex items-center">
                {stateLeadership?.chiefMinister?.person ? (
                  <div className="flex items-center gap-4 w-full">
                    {stateLeadership.chiefMinister.person.imageUrl ? (
                      <img
                        src={stateLeadership.chiefMinister.person.imageUrl}
                        alt={stateLeadership.chiefMinister.person.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-2xl object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#D32F2F]/60 shrink-0">
                        <User size={28} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white text-base truncate">
                        {formatPersonName(stateLeadership.chiefMinister.person.name, stateLeadership.chiefMinister.person.gender)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {stateLeadership.chiefMinister.person.constituencyName 
                          ? `MLA for ${stateLeadership.chiefMinister.person.constituencyName}`
                          : "Legislative Member"
                        }
                        {stateLeadership.chiefMinister.party && ` • ${stateLeadership.chiefMinister.party.abbreviation}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-left w-full">
                    <p className="text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Vacant Office
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {stateLeadership?.chiefMinister?.assembly 
                        ? (stateLeadership?.chiefMinister?.isAssemblyVacant
                            ? `Assembly seats are vacant for ${stateLeadership?.chiefMinister?.assembly?.name || 'Assembly'}.`
                            : `No Chief Minister assigned for ${stateLeadership?.chiefMinister?.assembly?.name || 'Assembly'}.`)
                        : "No active legislative assembly recorded."
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                <span className="truncate max-w-[150px]">
                  {stateLeadership?.chiefMinister?.assembly?.name || "No Active Term"}
                </span>
                <span className="text-[#D32F2F] group-hover:underline shrink-0">
                  {stateLeadership?.chiefMinister?.person ? "View Profile →" : "Configure Assembly →"}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={`stat-${stat.label}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex items-center justify-between group hover:border-[#FFD700]/30 transition-all"
          >
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black">{stat.value}</h3>
            </div>
            <div className={`p-4 bg-white/5 rounded-2xl ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon size={32} />
            </div>
          </motion.div>
        ))}
      </section>

      {/* Insight Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insightStats.map((stat, i) => (
          <motion.div
            key={`insight-${stat.label}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + (i * 0.1) }}
            className="relative p-6 rounded-3xl bg-black/40 border border-white/5 flex flex-col gap-4 group hover:bg-[#FFD700]/5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 bg-white/5 rounded-xl ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-[#FFD700] opacity-50">Deep Insight</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{stat.value}</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{stat.subValue}</span>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
               <TrendingUp size={16} className="text-[#FFD700]" />
            </div>
          </motion.div>
        ))}
      </section>

      {/* Quick Access Circles */}
      <section>
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Quick Operations</h3>
         </div>
         <div className="flex flex-wrap gap-6">
            {quickOps.map((item, i) => (
              <motion.div 
                key={`op-${item.name}`} 
                whileHover={{ y: -5 }} 
                className="flex flex-col items-center gap-3"
                onClick={() => navigate(item.path)}
              >
                 <div className={`w-16 h-16 rounded-full ${item.color} ${item.text} flex items-center justify-center shadow-xl cursor-pointer`}>
                    <item.icon size={24} />
                 </div>
                 <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">{item.name}</span>
              </motion.div>
            ))}
         </div>
      </section>

      {/* Recent Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Recent Persons</h3>
            <button className="text-xs gold-text hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {persons.map(p => <EntityCard key={p.id} entity={p} type={EntityType.PERSON} />)}
            {persons.length === 0 && <div className="col-span-full py-10 text-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">No persons registered yet</div>}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Legislative Parties</h3>
            <button className="text-xs gold-text hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {parties.map(p => <EntityCard key={p.id} entity={p} type={EntityType.PARTY} />)}
            {parties.length === 0 && <div className="col-span-full py-10 text-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">No parties registered yet</div>}
          </div>
        </section>
      </div>
    </div>
  );
};
