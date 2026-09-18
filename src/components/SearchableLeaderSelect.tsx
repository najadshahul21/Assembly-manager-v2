import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Person, Party, Alliance } from '../types';
import { 
  Search, X, Check, ChevronDown, User, Shield, 
  Crown, Scale, ShieldAlert, Sparkles, Building2, UserX 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface SearchableLeaderSelectProps {
  roleKey: string;
  roleTitle: string;
  categoryTitle?: string;
  isGovMlaOnly: boolean;
  isAssemblyMemberOnly: boolean;
  badgeText: string;
  badgeType: 'gold' | 'amber' | 'silver' | 'blue';
  value?: string;
  onChange: (personId: string) => void;
  eligiblePersons: Person[];
  allPersons: Person[];
  parties: Party[];
  alliances: Alliance[];
  personConstituencyMap: Map<string, string>;
  governmentMlaIds: Set<string>;
  allMlaIds: Set<string>;
  currentLeadersMap?: Record<string, string | undefined>;
  disabled?: boolean;
}

export const SearchableLeaderSelect: React.FC<SearchableLeaderSelectProps> = ({
  roleKey,
  roleTitle,
  categoryTitle,
  isGovMlaOnly,
  isAssemblyMemberOnly,
  badgeText,
  badgeType,
  value,
  onChange,
  eligiblePersons,
  allPersons,
  parties,
  alliances,
  personConstituencyMap,
  governmentMlaIds,
  allMlaIds,
  currentLeadersMap = {},
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedPerson = useMemo(() => {
    if (!value || value === 'vacant') return null;
    return allPersons.find((p) => p.id === value) || null;
  }, [value, allPersons]);

  const selectedPersonParty = useMemo(() => {
    if (!selectedPerson) return null;
    return parties.find((p) => p.id === selectedPerson.partyId) || null;
  }, [selectedPerson, parties]);

  const selectedPersonConstituency = useMemo(() => {
    if (!selectedPerson) return null;
    return personConstituencyMap.get(selectedPerson.id) || null;
  }, [selectedPerson, personConstituencyMap]);

  // Unique parties among eligible persons for quick filtering
  const availableParties = useMemo(() => {
    const partyIds = new Set<string>();
    eligiblePersons.forEach((p) => {
      if (p.partyId) partyIds.add(p.partyId);
    });
    return parties.filter((pt) => partyIds.has(pt.id));
  }, [eligiblePersons, parties]);

  // Filtered persons based on search query and party filter
  const filteredPersons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return eligiblePersons.filter((p) => {
      // Party filter
      if (selectedPartyFilter !== 'all' && p.partyId !== selectedPartyFilter) {
        return false;
      }

      if (!q) return true;

      const pParty = parties.find((pt) => pt.id === p.partyId);
      const partyAbbr = (pParty?.abbreviation || p.partyId || '').toLowerCase();
      const partyName = (pParty?.name || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const conName = (personConstituencyMap.get(p.id) || '').toLowerCase();

      return (
        name.includes(q) ||
        conName.includes(q) ||
        partyAbbr.includes(q) ||
        partyName.includes(q)
      );
    });
  }, [eligiblePersons, parties, personConstituencyMap, searchQuery, selectedPartyFilter]);

  // Look up what other role this person might already have in the council
  const getOtherRole = (personId: string): string | null => {
    for (const [key, pId] of Object.entries(currentLeadersMap)) {
      if (key !== roleKey && pId === personId) {
        return key.replace(/([A-Z])/g, ' $1').trim();
      }
    }
    return null;
  };

  const handleSelect = (personId: string) => {
    onChange(personId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleVacate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Badge styles
  const badgeConfig = {
    gold: {
      border: 'border-[#FFD700]/30',
      bg: 'bg-[#FFD700]/10',
      text: 'text-[#FFD700]',
      icon: Crown,
      cardBorder: 'hover:border-[#FFD700]/40',
      cardGlow: 'from-[#FFD700]/10',
    },
    amber: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      icon: Scale,
      cardBorder: 'hover:border-amber-500/40',
      cardGlow: 'from-amber-500/10',
    },
    silver: {
      border: 'border-slate-400/30',
      bg: 'bg-slate-400/10',
      text: 'text-slate-300',
      icon: Shield,
      cardBorder: 'hover:border-slate-400/40',
      cardGlow: 'from-slate-400/10',
    },
    blue: {
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      icon: Building2,
      cardBorder: 'hover:border-cyan-500/40',
      cardGlow: 'from-cyan-500/10',
    },
  }[badgeType];

  const BadgeIcon = badgeConfig.icon;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Role Card / Slot Container */}
      <div
        className={`rounded-2xl border bg-zinc-950/80 transition-all overflow-hidden ${
          selectedPerson
            ? `${badgeConfig.border} shadow-lg shadow-black/40`
            : 'border-white/10 hover:border-white/20'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Slot Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] border-b border-white/5">
          <div className="flex items-center gap-2">
            <BadgeIcon size={14} className={badgeConfig.text} />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              {roleTitle}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${badgeConfig.bg} ${badgeConfig.border} ${badgeConfig.text}`}
          >
            <span>{badgeText}</span>
          </div>
        </div>

        {/* Slot Body: Active Person or Vacant Action */}
        <div className="p-3">
          {selectedPerson ? (
            <div className="flex items-center justify-between gap-3">
              <div
                onClick={() => !disabled && setIsOpen(true)}
                className="flex items-center gap-3 min-w-0 cursor-pointer group/card flex-1"
              >
                <div className="relative w-11 h-11 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 group-hover/card:border-[#FFD700]/50 transition-colors">
                  {selectedPerson.imageUrl ? (
                    <img
                      src={selectedPerson.imageUrl}
                      alt={selectedPerson.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <User size={18} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate group-hover/card:text-[#FFD700] transition-colors">
                      {selectedPerson.name}
                    </p>
                    {selectedPersonParty && (
                      <span
                        className="text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider text-white shrink-0 shadow-sm"
                        style={{
                          backgroundColor:
                            selectedPersonParty.colors?.[0] || '#3B82F6',
                        }}
                      >
                        {selectedPersonParty.abbreviation || selectedPerson.partyId}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 truncate">
                    {selectedPersonConstituency ? (
                      <span className="text-zinc-300 font-medium truncate">
                        MLA • {selectedPersonConstituency}
                      </span>
                    ) : isAssemblyMemberOnly ? (
                      <span className="text-zinc-500 italic">Elected MLA</span>
                    ) : (
                      <span className="text-cyan-400 font-medium">
                        Administrative Head
                      </span>
                    )}

                    {isGovMlaOnly && governmentMlaIds.has(selectedPerson.id) && (
                      <span className="text-[9px] text-[#FFD700] font-black uppercase tracking-tighter shrink-0">
                        • Govt Bloc
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Change or Vacate */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen((prev) => !prev)}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 hover:text-[#FFD700] border border-white/10 rounded-lg text-xs font-bold text-zinc-300 transition-all flex items-center gap-1 cursor-pointer"
                  title="Change Member"
                >
                  <Search size={12} />
                  <span>Change</span>
                </button>
                <button
                  type="button"
                  onClick={handleVacate}
                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg transition-all cursor-pointer"
                  title="Vacate Position"
                >
                  <UserX size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="w-full py-3 px-3.5 border border-dashed border-white/15 hover:border-[#FFD700]/50 bg-white/[0.01] hover:bg-[#FFD700]/5 rounded-xl flex items-center justify-between text-left transition-all group/btn cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover/btn:text-[#FFD700] group-hover/btn:border-[#FFD700]/30 transition-colors">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-300 group-hover/btn:text-white transition-colors">
                    Click to Appoint {roleTitle}
                  </p>
                  <p className="text-[10px] text-zinc-500 group-hover/btn:text-zinc-400">
                    {eligiblePersons.length} eligible candidates available
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#FFD700] font-bold">
                <Search size={14} />
                <span className="hidden sm:inline">Search</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* App's Organized Search & Select Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 bg-[#121216] border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black z-[120] overflow-hidden flex flex-col max-h-[420px]"
          >
            {/* Search Header */}
            <div className="p-3 bg-zinc-900/90 border-b border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeIcon size={14} className={badgeConfig.text} />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Appoint {roleTitle}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFD700]"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, constituency, or party..."
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-[#FFD700] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFD700]/30 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Quick Party Filters if more than 1 party */}
              {availableParties.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedPartyFilter('all')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all shrink-0 ${
                      selectedPartyFilter === 'all'
                        ? 'bg-[#FFD700] text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    All ({eligiblePersons.length})
                  </button>
                  {availableParties.map((pt) => {
                    const count = eligiblePersons.filter((p) => p.partyId === pt.id).length;
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setSelectedPartyFilter(pt.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all shrink-0 ${
                          selectedPartyFilter === pt.id
                            ? 'text-white border'
                            : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                        }`}
                        style={{
                          backgroundColor:
                            selectedPartyFilter === pt.id
                              ? pt.colors?.[0] || '#3B82F6'
                              : undefined,
                          borderColor:
                            selectedPartyFilter === pt.id
                              ? 'rgba(255,255,255,0.4)'
                              : 'transparent',
                        }}
                      >
                        {pt.abbreviation || pt.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Candidate List Container */}
            <div className="overflow-y-auto p-2 space-y-1 flex-1">
              {/* Option to Vacate / Clear */}
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-all ${
                  !value || value === 'vacant'
                    ? 'bg-zinc-800/80 border border-zinc-600 text-white'
                    : 'hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <UserX size={14} />
                  </div>
                  <span className="text-xs font-bold">Leave Position Vacant</span>
                </div>
                {(!value || value === 'vacant') && (
                  <Check size={14} className="text-[#FFD700]" />
                )}
              </button>

              {/* List of Eligible Candidates */}
              {filteredPersons.length > 0 ? (
                filteredPersons.map((person) => {
                  const isCurrent = person.id === value;
                  const party = parties.find((p) => p.id === person.partyId);
                  const conName = personConstituencyMap.get(person.id);
                  const otherRole = getOtherRole(person.id);

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelect(person.id)}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-all group ${
                        isCurrent
                          ? 'bg-[#FFD700]/15 border border-[#FFD700]/40 text-white'
                          : 'hover:bg-zinc-800/70 text-zinc-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="relative w-9 h-9 rounded-lg bg-zinc-900 border border-white/10 overflow-hidden shrink-0">
                          {person.imageUrl ? (
                            <img
                              src={person.imageUrl}
                              alt={person.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                              <User size={15} />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate group-hover:text-[#FFD700] transition-colors">
                              {person.name}
                            </span>
                            {party && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-black uppercase text-white shrink-0"
                                style={{
                                  backgroundColor: party.colors?.[0] || '#3B82F6',
                                }}
                              >
                                {party.abbreviation || party.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                            {conName ? (
                              <span className="truncate">MLA • {conName}</span>
                            ) : (
                              <span>Civil Administration</span>
                            )}

                            {otherRole && (
                              <span className="text-amber-400 text-[9px] font-bold shrink-0">
                                (Currently {otherRole})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      <div className="shrink-0 flex items-center">
                        {isCurrent ? (
                          <div className="w-5 h-5 rounded-full bg-[#FFD700] text-black flex items-center justify-center">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-zinc-700 group-hover:border-zinc-500 transition-colors" />
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-6 px-4">
                  <ShieldAlert size={24} className="mx-auto text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-400 font-bold">
                    {searchQuery
                      ? `No candidates match "${searchQuery}"`
                      : isGovMlaOnly
                      ? 'No Government MLAs available in this assembly'
                      : 'No eligible members found'}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1 max-w-xs mx-auto">
                    {isGovMlaOnly
                      ? 'Rule 1 requires this role to be appointed strictly from elected MLAs belonging to the ruling government composition.'
                      : 'Rule 2 requires current members of this legislative assembly.'}
                  </p>
                </div>
              )}
            </div>

            {/* Popover Footer Stats */}
            <div className="px-3 py-2 bg-zinc-950/80 border-t border-zinc-800 text-[10px] text-zinc-500 flex items-center justify-between">
              <span>Showing {filteredPersons.length} eligible candidates</span>
              <span className="font-mono text-zinc-400">{badgeText}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
