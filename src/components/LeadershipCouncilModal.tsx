import React, { useState, useMemo } from 'react';
import { Assembly, Person, Party, Alliance, Constituency } from '../types';
import { db } from '../db';
import { 
  X, Crown, Scale, Shield, Building2, AlertCircle, 
  CheckCircle2, Sparkles, Landmark, Users, Search, RefreshCw 
} from 'lucide-react';
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
    key: 'leaderOfHouse',
    title: 'Leader of the House',
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
    key: 'deputyLeaderOfHouse',
    title: 'Deputy Leader of the House',
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

  // Pre-indexed candidate pools with stable memoization
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
    // Rule 1: Chief Minister, Deputy Chief Minister, Speaker, Deputy Speaker, Leader of House must be in governmentMlaIds
    const rule1Roles: (keyof Assembly['leaders'])[] = [
      'chiefMinister',
      'deputyChiefMinister',
      'speaker',
      'deputySpeaker',
      'leaderOfHouse',
      'deputyLeaderOfHouse',
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
          return `Rule 2 Violation: "${person?.name || 'Selected candidate'}" is not an elected MLA of this assembly and cannot be appointed as ${roleTitle}.`;
        }
      }
    }

    return null;
  };

  // Save changes to assembly in Dexie DB
  const handleSave = async () => {
    setValidationError(null);
    const errorMsg = validateAppointments();
    if (errorMsg) {
      setValidationError(errorMsg);
      return;
    }

    setIsSaving(true);
    try {
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
      }, 600);
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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="bg-[#0f0f13] border border-white/10 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[92vh] max-h-[860px] min-h-0 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 bg-zinc-950/80 space-y-4 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center text-[#FFD700] shadow-lg shadow-[#FFD700]/10">
                <Crown size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FFD700] bg-[#FFD700]/10 px-2 py-0.5 rounded-full border border-[#FFD700]/20">
                    Constitutional Council
                  </span>
                  <span className="text-xs text-zinc-500">•</span>
                  <span className="text-xs text-zinc-400 font-bold">{assembly.name}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white mt-0.5">
                  Appointment of Leadership Council
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Constitutional Rules Banner (Compact & High Contrast) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
              <Scale size={15} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block">Rule 1: Government MLAs Only</span>
                <span className="text-[11px] text-zinc-400 leading-tight">
                  Chief Minister, Deputy CM, Speaker, & Deputy Speaker must be MLAs of the ruling government composition.
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-2">
              <Users size={15} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-blue-300 block">Rule 2: Current Assembly Members Only</span>
                <span className="text-[11px] text-zinc-400 leading-tight">
                  Only current members of this assembly can hold leadership positions, except Chief Secretary (Civil Executive).
                </span>
              </div>
            </div>
          </div>

          {/* Government Strength & Stats Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-zinc-300">
              <Landmark size={14} className="text-[#FFD700]" />
              <span className="font-bold text-white">Government Bloc:</span>
              <span className="text-[#FFD700] font-black">
                {government ? government.name : 'Majority Coalition'}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">
                {governmentMlaIds.size} Govt MLAs / {allMlaIds.size} Total MLAs
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">
                {stats.filled} Appointed
              </span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-white/5 font-bold text-[11px]">
                {stats.vacant} Vacant
              </span>
            </div>
          </div>

          {/* Role Category Tabs & Quick Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
              {[
                { id: 'all', label: 'All Roles', count: COUNCIL_ROLES.length },
                { id: 'executive', label: 'Executive', count: 4 },
                { id: 'presiding', label: 'Presiding', count: 2 },
                { id: 'opposition', label: 'Opposition', count: 2 },
                { id: 'administration', label: 'Administration', count: 1 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategoryTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                    activeCategoryTab === tab.id
                      ? 'bg-white/15 text-white border border-white/20 shadow-md'
                      : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search designation or appointee..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD700] transition-colors"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Validation Messages */}
        {validationError && (
          <div className="mx-6 mt-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-xs text-red-300 shrink-0 animate-in fade-in duration-150">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{validationError}</div>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-xs text-emerald-300 shrink-0 animate-in fade-in duration-150">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Scrollable Slots Grid (Guaranteed Smooth Scrolling with flex-1 min-h-0 overscroll-contain) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoles.map((role) => {
              // Determine eligible pool
              let eligiblePool: Person[] = [];
              if (role.isGovMlaOnly) {
                eligiblePool = governmentMlaCandidates;
              } else if (role.isAssemblyMemberOnly) {
                eligiblePool = assemblyMlaCandidates;
              } else {
                eligiblePool = allPersonCandidates;
              }

              // Include current appointee if already set
              const currentId = draftLeaders[role.key];
              if (currentId && currentId !== 'vacant') {
                const currentObj = persons.find((p) => p.id === currentId);
                if (currentObj && !eligiblePool.some((p) => p.id === currentId)) {
                  eligiblePool = [currentObj, ...eligiblePool];
                }
              }

              return (
                <div key={role.key} className="space-y-1">
                  <SearchableLeaderSelect
                    roleKey={role.key}
                    roleTitle={role.title}
                    categoryTitle={role.categoryTitle}
                    isGovMlaOnly={role.isGovMlaOnly}
                    isAssemblyMemberOnly={role.isAssemblyMemberOnly}
                    badgeText={role.badgeText}
                    badgeType={role.badgeType}
                    value={draftLeaders[role.key] || ''}
                    onChange={(newVal) => handleRoleChange(role.key, newVal)}
                    eligiblePersons={eligiblePool}
                    allPersons={persons}
                    parties={parties}
                    alliances={alliances}
                    personConstituencyMap={personConstituencyMap}
                    governmentMlaIds={governmentMlaIds}
                    allMlaIds={allMlaIds}
                    currentLeadersMap={draftLeaders}
                  />
                  <p className="text-[10px] text-zinc-500 px-1 italic">
                    {role.ruleDescription}
                  </p>
                </div>
              );
            })}
          </div>

          {filteredRoles.length === 0 && (
            <div className="text-center py-16 px-4">
              <Search size={32} className="mx-auto text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-400 font-bold">No designations matched your search.</p>
              <p className="text-xs text-zinc-600 mt-1">
                Try searching for a different designation or clear the filter query.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
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
      </div>
    </div>
  );
};
