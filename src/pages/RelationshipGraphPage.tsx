import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { buildRelationshipGraph } from '../utils/relationshipGraphBuilder';
import { Network, Users, Shield, Flag, Landmark, Award, Sparkles, Filter } from 'lucide-react';
import { EntityType } from '../types';

export const RelationshipGraphPage: React.FC = () => {
  // Query all entities from Dexie
  const persons = useLiveQuery(() => db.persons.toArray(), []) || [];
  const parties = useLiveQuery(() => db.parties.toArray(), []) || [];
  const alliances = useLiveQuery(() => db.alliances.toArray(), []) || [];
  const assemblies = useLiveQuery(() => db.assemblies.toArray(), []) || [];
  const designations = useLiveQuery(() => db.designations.toArray(), []) || [];
  const constituencies = useLiveQuery(() => db.constituencies.toArray(), []) || [];
  const orders = useLiveQuery(() => db.orders?.toArray() || Promise.resolve([]), []) || [];

  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>('all');
  const [quickFocusNodeId, setQuickFocusNodeId] = useState<string | null>(null);

  // Active assembly lookup
  const activeAssembly = useMemo(() => {
    return assemblies.find((a) => a.isActive !== false) || assemblies[0];
  }, [assemblies]);

  // Filter bundle by selected assembly if requested
  const filteredBundle = useMemo(() => {
    if (selectedAssemblyId === 'all') {
      return { persons, parties, alliances, assemblies, designations, constituencies, orders };
    }

    const targetAssembly = assemblies.find((a) => a.id === selectedAssemblyId);
    const targetAsmId = targetAssembly?.id;

    // Filter constituencies for this assembly
    const filteredConstituencies = constituencies.filter(
      (c) => c.currentAssemblyId === targetAsmId || c.createdInAssemblyId === targetAsmId
    );

    // Active leader IDs in this assembly
    const leaderIds = new Set<string>();
    if (targetAssembly?.leaders) {
      Object.values(targetAssembly.leaders).forEach((id) => {
        if (id && id !== 'vacant') leaderIds.add(id);
      });
    }

    // Persons who are MLAs in this assembly's constituencies or leaders
    const mlaPersonIds = new Set<string>(leaderIds);
    filteredConstituencies.forEach((c) => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        mlaPersonIds.add(c.currentIncumbentId);
      }
    });

    const filteredPersons = persons.filter(
      (p) => mlaPersonIds.has(p.id) || (p.assemblyRoles && p.assemblyRoles[targetAsmId || ''])
    );

    const filteredParties = parties;
    const filteredAlliances = alliances;
    const filteredDesignations = designations.filter(
      (d) => !d.assemblyId || d.assemblyId === targetAsmId
    );
    const filteredOrders = orders.filter(
      (o) => !o.assemblyId || o.assemblyId === targetAsmId
    );

    return {
      persons: filteredPersons,
      parties: filteredParties,
      alliances: filteredAlliances,
      assemblies: targetAssembly ? [targetAssembly] : assemblies,
      designations: filteredDesignations,
      constituencies: filteredConstituencies,
      orders: filteredOrders
    };
  }, [
    selectedAssemblyId,
    persons,
    parties,
    alliances,
    assemblies,
    designations,
    constituencies,
    orders
  ]);

  // Build the complete graph
  const graphData = useMemo(() => {
    return buildRelationshipGraph(filteredBundle);
  }, [filteredBundle]);

  // Key figures for quick focus presets
  const quickPresets = useMemo(() => {
    const list: { label: string; nodeId: string; color: string }[] = [];

    if (activeAssembly?.leaders?.chiefMinister) {
      const cm = persons.find((p) => p.id === activeAssembly.leaders.chiefMinister);
      if (cm) list.push({ label: `Chief Minister (${cm.name})`, nodeId: `${EntityType.PERSON}:${cm.id}`, color: '#EAB308' });
    }

    if (activeAssembly?.leaders?.speaker) {
      const spk = persons.find((p) => p.id === activeAssembly.leaders.speaker);
      if (spk) list.push({ label: `Speaker (${spk.name})`, nodeId: `${EntityType.PERSON}:${spk.id}`, color: '#06B6D4' });
    }

    if (activeAssembly?.leaders?.leaderOfOpposition) {
      const lop = persons.find((p) => p.id === activeAssembly.leaders.leaderOfOpposition);
      if (lop) list.push({ label: `Opposition Leader (${lop.name})`, nodeId: `${EntityType.PERSON}:${lop.id}`, color: '#EF4444' });
    }

    if (activeAssembly?.partyControlId) {
      const ally = alliances.find((a) => a.id === activeAssembly.partyControlId);
      if (ally) {
        list.push({ label: `Ruling Alliance (${ally.abbreviation})`, nodeId: `${EntityType.ALLIANCE}:${ally.id}`, color: '#A855F7' });
      }
    }

    return list;
  }, [activeAssembly, persons, alliances]);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 sm:p-6 space-y-4 overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-2xl text-[#FFD700] shadow-lg shadow-[#FFD700]/5">
              <Network size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Relationship Graph</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30">
                  Interactive Physics
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Dynamic topological graph connecting legislators, parties, coalitions, portfolios, and seats.
              </p>
            </div>
          </div>
        </div>

        {/* Assembly Scope Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300">
            <Filter size={14} className="text-[#FFD700]" />
            <span className="font-semibold text-gray-400">Assembly Scope:</span>
            <select
              value={selectedAssemblyId}
              onChange={(e) => {
                setSelectedAssemblyId(e.target.value);
                setQuickFocusNodeId(null);
              }}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0A0E17] text-white">All Assemblies</option>
              {assemblies.map((asm) => (
                <option key={asm.id} value={asm.id} className="bg-[#0A0E17] text-white">
                  {asm.name} {asm.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Presets Bar */}
      {quickPresets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 text-xs">
          <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0 flex items-center gap-1">
            <Sparkles size={12} className="text-[#FFD700]" />
            Quick Hubs:
          </span>
          {quickPresets.map((preset) => (
            <button
              key={preset.nodeId}
              onClick={() => setQuickFocusNodeId(preset.nodeId)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white shrink-0 transition-all font-medium flex items-center gap-1.5"
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.color }} />
              <span>{preset.label}</span>
            </button>
          ))}
          {quickFocusNodeId && (
            <button
              onClick={() => setQuickFocusNodeId(null)}
              className="px-2 py-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 text-xs shrink-0"
            >
              Reset Focus
            </button>
          )}
        </div>
      )}

      {/* Main Graph Canvas Container */}
      <div className="flex-1 w-full min-h-0 relative">
        <RelationshipGraph
          graphData={graphData}
          initialFocusNodeId={quickFocusNodeId}
          height="100%"
        />
      </div>
    </div>
  );
};
