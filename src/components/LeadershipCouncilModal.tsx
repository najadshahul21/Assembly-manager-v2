import React, { useState, useMemo } from 'react';
import { Assembly, Person, Party, Alliance, Constituency } from '../types';
import { db } from '../db';
import { 
  X, Crown, Scale, Shield, Building2, AlertCircle, 
  CheckCircle2, Sparkles, Landmark, Users, Search, RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { computeAssemblyGovernmentComposition } from '../utils/governmentUtils';
import { SearchableLeaderSelect } from './SearchableLeaderSelect';

export interface LeadershipCouncilModalProps {
  assembly: Assembly;
  constituencies: Constituency[];
  parties: Party[];
  alliances: Alliance[];
  persons: Person[];
  onClose: () => void;
  onSaved?: (updatedLeaders: Assembly['leaders']) => void;
}

interface RoleConfig {
  key: keyof Assembly['leaders'];
  title: string;
  category: 'executive' | 'presiding' | 'opposition' | 'administration';
  categoryTitle: string;
  categoryIcon: React.ElementType;
  ruleDescription: string;
  isGovMlaOnly: boolean;
  isAssemblyMemberOnly: boolean;
  badgeText: string;
  badgeType: 'gold' | 'amber' | 'silver' | 'blue';
}

const COUNCIL_ROLES: RoleConfig[] = [
  {
    key: 'chiefMinister',
    title: 'Chief Minister',
    category: 'executive',
    categoryTitle: 'Executive Leadership (Government)',
    categoryIcon: Crown,
    ruleDescription: 'Rule 1: Appointed strictly from MLAs belonging to the ruling government composition.',
    isGovMlaOnly: true,
    isAssemblyMemberOnly: true,
    badgeText: 'Govt MLA Only • Rule 1',
    badgeType: 'gold',
  },
  {
    key: 'deputyChiefMinister',
    title: 'Deputy Chief Minister',
    category: 'executive',
    categoryTitle: 'Executive Leadership (Government)',
    categoryIcon: Crown,
    ruleDescription: 'Rule 1: Appointed strictly from MLAs belonging to the ruling government composition.',
    isGovMlaOnly: true,
    isAssemblyMemberOnly: true,
    badgeText: 'Govt MLA Only • Rule 1',
    badgeType: 'gold',
  },
  {
    key: 'speaker',
    title: 'Speaker of the House',
    category: 'presiding',
    categoryTitle: 'Presiding Officers of the Chamber',
    categoryIcon: Scale,
    ruleDescription: 'Rule 1: Appointed strictly from MLAs belonging to the ruling government composition.',
    isGovMlaOnly: true,
    isAssemblyMemberOnly: true,
    badgeText: 'Govt MLA Only • Rule 1',
    badgeType: 'amber',
  },
  {
    key: 'deputySpeaker',
    title: 'Deputy Speaker',
    category: 'presiding',
    categoryTitle: 'Presiding Officers of the Chamber',
    categoryIcon: Scale,
    ruleDescription: 'Rule 1: Appointed strictly from MLAs belonging to the ruling government composition.',
    isGovMlaOnly: true,
    isAssemblyMemberOnly: true,
    badgeText: 'Govt MLA Only • Rule 1',
    badgeType: 'amber',
  },
  {
    key: 'leaderOfOpposition',
    title: 'Leader of Opposition',
    category: 'opposition',
    categoryTitle: 'Parliamentary Opposition',
    categoryIcon: Shield,
    ruleDescription: 'Rule 2: Appointed strictly from current members (MLAs) of this respective assembly.',
    isGovMlaOnly: false,
    isAssemblyMemberOnly: true,
    badgeText: 'Assembly MLA • Rule 2',
    badgeType: 'silver',
  },
  {
    key: 'deputyLeaderOfOpposition',
    title: 'Deputy Leader of Opposition',
    category: 'opposition',
    categoryTitle: 'Parliamentary Opposition',
    categoryIcon: Shield,
    ruleDescription: 'Rule 2: Appointed strictly from current members (MLAs) of this respective assembly.',
    isGovMlaOnly: false,
    isAssemblyMemberOnly: true,
    badgeText: 'Assembly MLA • Rule 2',
    badgeType: 'silver',
  },
  {
    key: 'chiefSecretary',
    title: 'Chief Secretary',
    category: 'administration',
    categoryTitle: 'Executive Administration & Civil Authority',
    categoryIcon: Building2,
    ruleDescription: 'Rule 2 Exception: Civil Secretariat official. Assembly MLA membership is not required.',
    isGovMlaOnly: false,
    isAssemblyMemberOnly: false,
    badgeText: 'Executive Head • Rule 2 Exception',
    badgeType: 'blue',
  },
];

export const LeadershipCouncilModal: React.FC<LeadershipCouncilModalProps> = ({
  assembly,
  constituencies,
  parties,
  alliances,
  persons,
  onClose,
  onSaved,
}) => {
  // Local state for draft leaders
  const [draftLeaders, setDraftLeaders] = useState<Assembly['leaders']>(() => ({
    speaker: assembly.leaders?.speaker || '',
    deputySpeaker: assembly.leaders?.deputySpeaker || '',
    chiefMinister: assembly.leaders?.chiefMinister || '',
    deputyChiefMinister: assembly.leaders?.deputyChiefMinister || '',
    leaderOfOpposition: assembly.leaders?.leaderOfOpposition || '',
    deputyLeaderOfOpposition: assembly.leaders?.deputyLeaderOfOpposition || '',
    chiefSecretary: assembly.leaders?.chiefSecretary || '',
    leaderOfHouse: assembly.leaders?.leaderOfHouse || '',
    deputyLeaderOfHouse: assembly.leaders?.deputyLeaderOfHouse || '',
  }));

  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compute government composition and MLA sets
  const govComposition = useMemo(() => {
    return computeAssemblyGovernmentComposition(
      assembly,
      constituencies,
      parties,
      alliances,
      persons
    );
  }, [assembly, constituencies, parties, alliances, persons]);

  const { governmentMlaIds, allMlaIds, government } = govComposition;

  // Map of personId -> Constituency Name
  const personConstituencyMap = useMemo(() => {
    const map = new Map<string, string>();
    const relevantCs = constituencies.filter((c) => c.currentAssemblyId === assembly.id);
    relevantCs.forEach((c) => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        map.set(c.currentIncumbentId, c.name);
      }
    });
    return map;
  }, [constituencies, assembly.id]);

  // Candidate lists based on rules
  const governmentMlaCandidates = useMemo(() => {
    return persons
      .filter((p) => governmentMlaIds.has(p.id) && !p.isSuspended)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, governmentMlaIds]);

  const assemblyMlaCandidates = useMemo(() => {
    return persons
      .filter((p) => allMlaIds.has(p.id) && !p.isSuspended)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, allMlaIds]);

  const allPersonCandidates = useMemo(() => {
    return persons
      .filter((p) => !p.isSuspended)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons]);

  // Handle slot update
  const handleRoleChange = (roleKey: keyof Assembly['leaders'], personId: string) => {
    setValidationError(null);
    setSuccessMessage(null);
    setDraftLeaders((prev) => ({
      ...prev,
      [roleKey]: personId || '',
    }));
  };

  // Rule Validation before saving
  const validateAppointments = (): string | null => {
    // Rule 1: Chief Minister, Deputy Chief Minister, Speaker, Deputy Speaker must be in governmentMlaIds
    const rule1Roles: (keyof Assembly['leaders'])[] = [
      'chiefMinister',
      'deputyChiefMinister',
      'speaker',
      'deputySpeaker',
    ];

    for (const rKey of rule1Roles) {
      const pId = draftLeaders[rKey];
      if (pId && pId !== 'vacant') {
        if (!governmentMlaIds.has(pId)) {
          const roleTitle = COUNCIL_ROLES.find((r) => r.key === rKey)?.title || rKey;
          const person = persons.find((p) => p.id === pId);
          return `Rule 1 Violation: "${person?.name || 'Selected candidate'}" is not an MLA from the government composition and cannot be appointed as ${roleTitle}.`;
        }
      }
    }

    // Rule 2: All appointments into leadership council must be current assembly members except chiefSecretary
    const rule2Roles: (keyof Assembly['leaders'])[] = [
      'chiefMinister',
      'deputyChiefMinister',
      'speaker',
      'deputySpeaker',
      'leaderOfOpposition',
      'deputyLeaderOfOpposition',
      'leaderOfHouse',
      'deputyLeaderOfHouse',
    ];

    for (const rKey of rule2Roles) {
      const pId = draftLeaders[rKey];
      if (pId && pId !== 'vacant') {
        if (!allMlaIds.has(pId)) {
          const roleTitle = COUNCIL_ROLES.find((r) => r.key === rKey)?.title || rKey;
          const person = persons.find((p) => p.id === pId);
          return `Rule 2 Violation: "${person?.name || 'Selected candidate'}" is not a current elected member (MLA) of ${assembly.name} and cannot hold ${roleTitle}.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const error = validateAppointments();
    if (error) {
      setValidationError(error);
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      // Clean up draft leaders object
      const cleanLeaders: Assembly['leaders'] = {
        speaker: draftLeaders.speaker || undefined,
        deputySpeaker: draftLeaders.deputySpeaker || undefined,
        chiefMinister: draftLeaders.chiefMinister || undefined,
        deputyChiefMinister: draftLeaders.deputyChiefMinister || undefined,
        leaderOfOpposition: draftLeaders.leaderOfOpposition || undefined,
        deputyLeaderOfOpposition: draftLeaders.deputyLeaderOfOpposition || undefined,
        chiefSecretary: draftLeaders.chiefSecretary || undefined,
        leaderOfHouse: draftLeaders.leaderOfHouse || undefined,
        deputyLeaderOfHouse: draftLeaders.deputyLeaderOfHouse || undefined,
      };

      await db.assemblies.update(assembly.id, {
        leaders: cleanLeaders,
        updatedAt: Date.now(),
      });

      setSuccessMessage('Leadership Council appointments saved successfully.');
      if (onSaved) {
        onSaved(cleanLeaders);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to update leadership council:', err);
      setValidationError(err?.message || 'Failed to save appointments. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter roles by category tab and global search query
  const filteredRoles = useMemo(() => {
    return COUNCIL_ROLES.filter((role) => {
      if (activeCategoryTab !== 'all' && role.category !== activeCategoryTab) {
        return false;
      }
      if (!globalFilter) return true;
      const q = globalFilter.toLowerCase();
      const currentPersonId = draftLeaders[role.key];
      const person = currentPersonId ? persons.find((p) => p.id === currentPersonId) : null;
      const personName = person?.name.toLowerCase() || '';
      return (
        role.title.toLowerCase().includes(q) ||
        role.categoryTitle.toLowerCase().includes(q) ||
        personName.includes(q)
      );
    });
  }, [activeCategoryTab, globalFilter, draftLeaders, persons]);

  // Count occupied vs vacant roles
  const stats = useMemo(() => {
    let filled = 0;
    COUNCIL_ROLES.forEach((r) => {
      if (draftLeaders[r.key] && draftLeaders[r.key] !== 'vacant') {
        filled++;
      }
    });
    return {
      total: COUNCIL_ROLES.length,
      filled,
      vacant: COUNCIL_ROLES.length - filled,
    };
  }, [draftLeaders]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-[#0f0f13] border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-zinc-950 via-[#13131a] to-zinc-950">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center text-[#FFD700] shadow-lg shadow-[#FFD700]/5 shrink-0">
                <Crown size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-black text-[#FFD700] uppercase tracking-[0.2em] bg-[#FFD700]/10 px-2 py-0.5 rounded border border-[#FFD700]/20">
                    Constitutional Council
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded">
                    {assembly.name}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                  Appointment of Leadership Council
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Organized appointments for chamber officers, cabinet heads, and legislative leaders.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-all cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Rules Information Banner */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-[#FFD700]/5 border border-[#FFD700]/20 flex items-start gap-2.5">
              <Crown size={16} className="text-[#FFD700] shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-[#FFD700] uppercase tracking-wider">
                  Rule 1: Government MLAs Only
                </p>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                  Only MLAs from the government composition can be appointed as{' '}
                  <span className="text-white font-semibold">Chief Minister</span>,{' '}
                  <span className="text-white font-semibold">Deputy Chief Minister</span>,{' '}
                  <span className="text-white font-semibold">Speaker</span>, or{' '}
                  <span className="text-white font-semibold">Deputy Speaker</span>.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex items-start gap-2.5">
              <Landmark size={16} className="text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                  Rule 2: Assembly Membership
                </p>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                  Only current members of this assembly can hold leadership council positions,{' '}
                  <span className="text-cyan-300 font-semibold underline">except Chief Secretary</span>{' '}
                  who is an administrative official.
                </p>
              </div>
            </div>
          </div>

          {/* Government Strength Indicator */}
          <div className="mt-3 flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-medium">Government Bloc:</span>
              <span className="font-bold text-[#FFD700]">
                {government?.name || 'Ruling Coalition'}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-300 font-semibold">
                {governmentMlaIds.size} Government MLAs
              </span>
              <span className="text-zinc-500">of {allMlaIds.size} Total MLAs</span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-green-400 font-bold">{stats.filled} Appointed</span>
              <span className="text-zinc-600">/</span>
              <span className="text-amber-400 font-bold">{stats.vacant} Vacant</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-5 sm:px-6 py-3 border-b border-white/5 bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {[
              { id: 'all', label: 'All Roles', count: COUNCIL_ROLES.length },
              { id: 'executive', label: 'Government', count: 2 },
              { id: 'presiding', label: 'Presiding Officers', count: 2 },
              { id: 'opposition', label: 'Opposition', count: 2 },
              { id: 'administration', label: 'Administration', count: 1 },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategoryTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                  activeCategoryTab === tab.id
                    ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/20'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Quick Search Roles */}
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search roles or appointees..."
              className="w-full bg-white/5 border border-white/10 focus:border-[#FFD700]/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Body: Organized Role Slots Grid */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Validation Alert */}
          {validationError && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 animate-shake">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                  Appointment Validation Error
                </p>
                <p className="text-xs mt-0.5 leading-relaxed">{validationError}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center gap-3 text-green-300">
              <CheckCircle2 size={18} className="text-green-400 shrink-0" />
              <p className="text-xs font-bold">{successMessage}</p>
            </div>
          )}

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoles.map((role) => {
              // Select correct pool of eligible candidates based on Rule 1 & Rule 2
              let eligiblePool: Person[] = [];
              if (role.isGovMlaOnly) {
                // Rule 1: Government MLAs only
                eligiblePool = governmentMlaCandidates;
              } else if (role.isAssemblyMemberOnly) {
                // Rule 2: Assembly MLAs
                eligiblePool = assemblyMlaCandidates;
              } else {
                // Rule 2 exception: Chief Secretary can be any person
                eligiblePool = allPersonCandidates;
              }

              // Also ensure currently appointed person is visible even if pool filtering would hide them
              const currentId = draftLeaders[role.key];
              if (currentId && currentId !== 'vacant') {
                const currentObj = persons.find((p) => p.id === currentId);
                if (currentObj && !eligiblePool.some((p) => p.id === currentId)) {
                  eligiblePool = [currentObj, ...eligiblePool];
                }
              }

              return (
                <div key={role.key} className="flex flex-col">
                  <SearchableLeaderSelect
                    roleKey={role.key}
                    roleTitle={role.title}
                    categoryTitle={role.categoryTitle}
                    isGovMlaOnly={role.isGovMlaOnly}
                    isAssemblyMemberOnly={role.isAssemblyMemberOnly}
                    badgeText={role.badgeText}
                    badgeType={role.badgeType}
                    value={draftLeaders[role.key]}
                    onChange={(personId) => handleRoleChange(role.key, personId)}
                    eligiblePersons={eligiblePool}
                    allPersons={persons}
                    parties={parties}
                    alliances={alliances}
                    personConstituencyMap={personConstituencyMap}
                    governmentMlaIds={governmentMlaIds}
                    allMlaIds={allMlaIds}
                    currentLeadersMap={draftLeaders}
                    disabled={isSaving}
                  />
                  <p className="text-[10px] text-zinc-500 mt-1 px-1">
                    {role.ruleDescription}
                  </p>
                </div>
              );
            })}
          </div>

          {filteredRoles.length === 0 && (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
              <Search size={32} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-bold text-zinc-400">No roles match your search filter</p>
              <p className="text-xs text-zinc-600 mt-1">
                Try searching for a different designation or clear the filter query.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles size={14} className="text-[#FFD700]" />
            <span>Changes will reflect immediately across assembly records, cabinet, and profiles.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/10 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-[#FFD700]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Saving Appointments...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Save Appointments</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
