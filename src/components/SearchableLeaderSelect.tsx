import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Person, Party, Alliance } from '../types';
import { 
  Search, X, Check, User, Shield, 
  Crown, Scale, ShieldAlert, Building2, UserX 
} from 'lucide-react';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pre-index parties for O(1) instant lookup
  const partyMap = useMemo(() => {
    const map = new Map<string, Party>();
    parties.forEach((p) => map.set(p.id, p));
    return map;
  }, [parties]);

  // Pre-index all persons for O(1) instant lookup
  const personMap = useMemo(() => {
    const map = new Map<string, Person>();
    allPersons.forEach((p) => map.set(p.id, p));
    return map;
  }, [allPersons]);

  // Pre-index existing leadership roles
  const otherRolesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [key, pId] of Object.entries(currentLeadersMap)) {
      if (key !== roleKey && typeof pId === 'string' && pId && pId !== 'vacant') {
        const readable = key.replace(/([A-Z])/g, ' $1').trim();
        map.set(pId, readable.charAt(0).toUpperCase() + readable.slice(1));
      }
    }
    return map;
  }, [currentLeadersMap, roleKey]);

  // Currently selected person
  const selectedPerson = useMemo(() => {
    if (!value || value === 'vacant') return null;
    return personMap.get(value) || null;
  }, [value, personMap]);

  const selectedPersonParty = useMemo(() => {
    if (!selectedPerson || !selectedPerson.partyId) return null;
    return partyMap.get(selectedPerson.partyId) || null;
  }, [selectedPerson, partyMap]);

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

  // Filtered candidate list based on search and party
  const filteredPersons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return eligiblePersons.filter((p) => {
      // Party filter
      if (selectedPartyFilter !== 'all' && p.partyId !== selectedPartyFilter) {
        return false;
      }

      if (!q) return true;

      const pParty = partyMap.get(p.partyId);
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
  }, [eligiblePersons, partyMap, personConstituencyMap, searchQuery, selectedPartyFilter]);

  // Close modal on Escape key & handle focus
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  const handleSelect = (personId: string) => {
    onChange(personId);
    setIsOpen(false);
    setSearchQuery('');
    setSelectedPartyFilter('all');
  };

  const handleVacate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setSearchQuery('');
  };

  // Badge styles
  const badgeConfig = {
    gold: {
      border: 'border-[#FFD700]/30',
      bg: 'bg-[#FFD700]/10',
      text: 'text-[#FFD700]',
      icon: Crown,
      cardBorder: 'hover:border-[#FFD700]/40',
      activeBorder: 'border-[#FFD700]/40',
    },
    amber: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      icon: Scale,
      cardBorder: 'hover:border-amber-500/40',
      activeBorder: 'border-amber-500/40',
    },
    silver: {
      border: 'border-slate-400/30',
      bg: 'bg-slate-400/10',
      text: 'text-slate-300',
      icon: Shield,
      cardBorder: 'hover:border-slate-400/40',
      activeBorder: 'border-slate-400/40',
    },
    blue: {
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      icon: Building2,
      cardBorder: 'hover:border-cyan-500/40',
      activeBorder: 'border-cyan-500/40',
    },
  }[badgeType];

  const BadgeIcon = badgeConfig.icon;

  return (
    <div className="w-full">
      {/* Role Card Slot */}
      <div
        className={`rounded-2xl border bg-zinc-950/80 transition-all overflow-hidden ${
          selectedPerson
            ? `${badgeConfig.activeBorder} shadow-lg shadow-black/40`
            : 'border-white/10 hover:border-white/20'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Slot Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] border-b border-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <BadgeIcon size={14} className={`${badgeConfig.text} shrink-0`} />
            <span className="text-xs font-black uppercase tracking-wider text-white truncate">
              {roleTitle}
            </span>
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
                  <div className="flex items-center gap-2 flex-wrap">
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
                    ) : roleKey === 'chiefSecretary' ? (
                      <span className="text-cyan-400 font-medium">
                        Civil Administration
                      </span>
                    ) : isAssemblyMemberOnly ? (
                      <span className="text-zinc-500 italic">Elected MLA</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Change or Vacate */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
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

      {/* High-Performance Centered Candidate Selection Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-[#121217] border border-white/15 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl shadow-black overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-zinc-900/90 border-b border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${badgeConfig.bg} border ${badgeConfig.border} ${badgeConfig.text}`}>
                    <BadgeIcon size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-white">
                      Appoint {roleTitle}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FFD700]"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by candidate name, constituency, or party..."
                  className="w-full bg-zinc-950 border border-zinc-700/80 focus:border-[#FFD700] rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FFD700]/30 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Quick Party Filters */}
              {availableParties.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedPartyFilter('all')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all shrink-0 cursor-pointer ${
                      selectedPartyFilter === 'all'
                        ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/20'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                    }`}
                  >
                    All ({eligiblePersons.length})
                  </button>
                  {availableParties.map((pt) => {
                    const count = eligiblePersons.filter((p) => p.partyId === pt.id).length;
                    const isSelected = selectedPartyFilter === pt.id;
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setSelectedPartyFilter(pt.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all shrink-0 cursor-pointer border ${
                          isSelected
                            ? 'text-white border-white/60 shadow-sm'
                            : 'bg-zinc-800/80 text-zinc-400 border-transparent hover:text-white hover:bg-zinc-700'
                        }`}
                        style={{
                          backgroundColor: isSelected ? pt.colors?.[0] || '#3B82F6' : undefined,
                        }}
                      >
                        {pt.abbreviation || pt.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Candidate List Container (Strictly isolated scrolling with overscroll-contain) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1.5">
              {/* Option to Vacate / Clear */}
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                  !value || value === 'vacant'
                    ? 'bg-zinc-800/90 border border-zinc-600 text-white shadow-sm'
                    : 'hover:bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-zinc-500">
                    <UserX size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-white">Leave Position Vacant</span>
                    <span className="text-[10px] text-zinc-500">Remove current appointee from this role</span>
                  </div>
                </div>
                {(!value || value === 'vacant') && (
                  <Check size={16} className="text-[#FFD700]" />
                )}
              </button>

              {/* List of Eligible Candidates */}
              {filteredPersons.length > 0 ? (
                filteredPersons.map((person) => {
                  const isCurrent = person.id === value;
                  const party = partyMap.get(person.partyId);
                  const conName = personConstituencyMap.get(person.id);
                  const otherRole = otherRolesMap.get(person.id);

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelect(person.id)}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-all group cursor-pointer border ${
                        isCurrent
                          ? 'bg-[#FFD700]/15 border-[#FFD700]/40 text-white shadow-md shadow-[#FFD700]/5'
                          : 'hover:bg-zinc-800/80 text-zinc-300 hover:text-white border-transparent hover:border-zinc-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="relative w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0">
                          {person.imageUrl ? (
                            <img
                              src={person.imageUrl}
                              alt={person.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold text-xs">
                              {person.name.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
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

                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5 flex-wrap">
                            {conName ? (
                              <span className="truncate text-zinc-300">MLA • {conName}</span>
                            ) : roleKey === 'chiefSecretary' ? (
                              <span>Civil Administration</span>
                            ) : null}

                            {otherRole && (
                              <span className="text-amber-400 text-[9px] font-bold shrink-0 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                                Currently {otherRole}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      <div className="shrink-0 flex items-center pl-2">
                        {isCurrent ? (
                          <div className="w-5 h-5 rounded-full bg-[#FFD700] text-black flex items-center justify-center shadow">
                            <Check size={12} className="stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-zinc-700 group-hover:border-[#FFD700]/50 transition-colors" />
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-10 px-4">
                  <ShieldAlert size={28} className="mx-auto text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-300 font-bold">
                    {searchQuery
                      ? `No candidates match "${searchQuery}"`
                      : 'No eligible members found'}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Search and appoint a qualified candidate for this role.
                  </p>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="px-4 py-3 bg-zinc-950 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
              <span>Showing {filteredPersons.length} candidates</span>
              <span className="text-zinc-400 font-medium">Press Escape to cancel</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
