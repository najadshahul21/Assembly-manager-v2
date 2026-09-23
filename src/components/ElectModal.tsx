import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Person, Party, ElectionResult, CandidateResult } from '../types';
import { 
  Vote, Plus, Trash2, X, CheckCircle, Search, AlertCircle, 
  ChevronDown, User, Check, Sparkles, UserPlus 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ElectModalProps {
  constituencyName: string;
  previousPartyAbbreviation?: string;
  personsList: Person[];
  partiesList: Party[];
  onClose: () => void;
  onConfirm: (winnerPersonId: string | undefined, result: ElectionResult) => Promise<void>;
}

interface CandidateDraft {
  tempId: string;
  personId?: string;
  candidateName: string;
  partyId?: string;
  partyAbbreviation: string;
  partyColor: string;
  votes: number | '';
}

interface SearchablePersonSelectProps {
  tempId: string;
  personId?: string;
  candidateName: string;
  partyAbbreviation: string;
  partyColor: string;
  personsList: Person[];
  partiesList: Party[];
  onSelect: (tempId: string, personId: string, customName?: string) => void;
}

const SearchablePersonSelect: React.FC<SearchablePersonSelectProps> = ({
  tempId,
  personId,
  candidateName,
  partyAbbreviation,
  partyColor,
  personsList,
  partiesList,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedPerson = useMemo(() => {
    if (!personId || personId === 'nota') return null;
    const p = personsList.find((cand) => cand.id === personId);
    return (p && !p.isSuspended) ? p : null;
  }, [personId, personsList]);

  // Filter persons based on search query (excluding suspended persons and suspended parties)
  const filteredPersons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = personsList
      .filter((p) => !p.isSuspended)
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
      );

    const activePartiesMap = new Map<string, Party>(
      partiesList.filter((p) => !p.isSuspended).map((p) => [p.id, p])
    );

    return sorted.filter((p) => {
      // Exclude candidates affiliated with a suspended party
      if (p.partyId && p.partyId !== 'independent' && !activePartiesMap.has(p.partyId)) {
        return false;
      }
      if (!q) return true;
      const pParty = activePartiesMap.get(p.partyId);
      const partyAbbr = (pParty?.abbreviation || p.partyId || "").toLowerCase();
      const partyName = (pParty?.name || "").toLowerCase();
      const name = (p.name || "").toLowerCase();
      return name.includes(q) || partyAbbr.includes(q) || partyName.includes(q);
    });
  }, [personsList, partiesList, searchQuery]);

  const handleSelectOption = (id: string, name?: string) => {
    onSelect(tempId, id, name);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
        <span>Registered Politician / Candidate</span>
        {personId && (
          <span className="text-[10px] text-[#FFD700] lowercase font-normal">
            {personId === 'nota' ? 'NOTA selected' : 'linked'}
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full bg-zinc-800/90 hover:bg-zinc-800 border rounded-lg px-3 py-2 text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen ? 'border-[#FFD700] ring-1 ring-[#FFD700]/30' : 'border-zinc-700/80 hover:border-zinc-600'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          {personId === 'nota' ? (
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-zinc-700 text-zinc-300 text-[10px] font-black flex items-center justify-center">
                Ø
              </span>
              <span className="text-sm font-bold text-zinc-300 truncate">NOTA (None of the above)</span>
            </div>
          ) : selectedPerson ? (
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={selectedPerson.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(selectedPerson.name)}`}
                alt={selectedPerson.name}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover bg-zinc-700 border border-zinc-600 shrink-0"
              />
              <span className="text-sm font-bold text-white truncate">{selectedPerson.name}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-black uppercase text-white shrink-0"
                style={{ backgroundColor: partyColor || '#3B82F6' }}
              >
                {partyAbbreviation}
              </span>
            </div>
          ) : candidateName ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-[10px] font-bold shrink-0">
                <User size={12} />
              </div>
              <span className="text-sm text-zinc-300 truncate">{candidateName}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-tight shrink-0">(Custom)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Search size={14} className="text-[#FFD700]" />
              <span className="truncate">Search & select politician...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-zinc-400">
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#FFD700]' : ''}`} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[300px] sm:min-w-[380px] max-w-md bg-[#16161a] border border-zinc-700 rounded-xl shadow-2xl z-[150] overflow-hidden">
          {/* Search Header */}
          <div className="p-2.5 border-b border-zinc-800 bg-zinc-900/90 flex items-center gap-2">
            <Search size={15} className="text-[#FFD700] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by politician name or party..."
              className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-1.5 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => handleSelectOption('')}
              className="flex-1 py-1.5 px-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Custom / Unlinked Candidate</span>
              {!personId && <Check size={12} className="text-[#FFD700]" />}
            </button>
            <button
              type="button"
              onClick={() => handleSelectOption('nota')}
              className="flex-1 py-1.5 px-2 rounded-lg text-left text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>NOTA</span>
              {personId === 'nota' && <Check size={12} className="text-[#FFD700]" />}
            </button>
          </div>

          {/* Persons List */}
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
            <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 flex items-center justify-between">
              <span>Registered Politicians</span>
              <span className="font-mono text-[9px] text-[#FFD700]">
                {filteredPersons.length} found
              </span>
            </div>

            {filteredPersons.length > 0 ? (
              filteredPersons.map((person) => {
                const prty = partiesList.find(
                  (p) => p.id === person.partyId || p.abbreviation?.toLowerCase() === person.partyId?.toLowerCase()
                );
                const isCurrent = personId === person.id;
                const partyColorStyle = prty?.colors?.[0] || '#6B7280';
                const partyAbbr = prty?.abbreviation || person.partyId || 'IND';

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSelectOption(person.id)}
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#FFD700]/15 border border-[#FFD700]/40 text-white'
                        : 'hover:bg-zinc-800/80 text-zinc-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={person.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                        alt={person.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate text-white">
                          {person.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: partyColorStyle }}
                          />
                          <span>{prty?.name || partyAbbr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[10px] font-black uppercase px-2 py-0.5 rounded text-white tracking-wider"
                        style={{ backgroundColor: partyColorStyle }}
                      >
                        {partyAbbr}
                      </span>
                      {isCurrent && <Check size={14} className="text-[#FFD700]" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-zinc-400 mb-2">
                  No registered politicians matching <strong className="text-white">"{searchQuery}"</strong>
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectOption('', searchQuery)}
                  className="px-3 py-1.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Use "{searchQuery}" as Custom Name
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ElectModal: React.FC<ElectModalProps> = ({
  constituencyName,
  previousPartyAbbreviation = 'new constituency',
  personsList,
  partiesList,
  onClose,
  onConfirm
}) => {
  // Initialize candidate draft rows auto-populated from active (non-suspended) personsList / partiesList
  const [candidates, setCandidates] = useState<CandidateDraft[]>(() => {
    const activePersons = personsList.filter((p) => !p.isSuspended);
    const activeParties = partiesList.filter((p) => !p.isSuspended);

    const getPartyInfo = (person?: Person) => {
      if (!person) return { partyId: 'independent', partyAbbreviation: 'IND', partyColor: '#A1A1AA' };
      const party = activeParties.find(
        (prty) => prty.id === person.partyId || prty.abbreviation?.toLowerCase() === person.partyId?.toLowerCase()
      );
      if (party) {
        return {
          partyId: party.id,
          partyAbbreviation: party.abbreviation || 'IND',
          partyColor: party.colors?.[0] || '#2563EB'
        };
      }
      return { partyId: 'independent', partyAbbreviation: 'IND', partyColor: '#A1A1AA' };
    };

    const c1 = activePersons[0];
    const c1Party = getPartyInfo(c1);

    const c2 = activePersons[1];
    const c2Party = getPartyInfo(c2);

    return [
      {
        tempId: 'draft-1',
        personId: c1?.id,
        candidateName: c1?.name || 'Candidate 1',
        partyId: c1Party.partyId,
        partyAbbreviation: c1Party.partyAbbreviation,
        partyColor: c1Party.partyColor,
        votes: 0
      },
      {
        tempId: 'draft-2',
        personId: c2?.id,
        candidateName: c2?.name || 'Candidate 2',
        partyId: c2Party.partyId,
        partyAbbreviation: c2Party.partyAbbreviation,
        partyColor: c2Party.partyColor,
        votes: 0
      },
      {
        tempId: 'draft-3',
        personId: 'nota',
        candidateName: 'None of the above',
        partyId: 'nota',
        partyAbbreviation: 'NOTA',
        partyColor: '#6B7280',
        votes: 0
      }
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Quick Search & Add Candidate state
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [showQuickAddDropdown, setShowQuickAddDropdown] = useState(false);
  const quickSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickSearchRef.current && !quickSearchRef.current.contains(e.target as Node)) {
        setShowQuickAddDropdown(false);
      }
    };
    if (showQuickAddDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showQuickAddDropdown]);

  const quickFilteredPersons = useMemo(() => {
    const q = quickSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const sorted = personsList
      .filter((p) => !p.isSuspended)
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
      );

    const activePartiesMap = new Map<string, Party>(
      partiesList.filter((p) => !p.isSuspended).map((p) => [p.id, p])
    );

    return sorted
      .filter((p) => {
        // Exclude members of suspended parties
        if (p.partyId && p.partyId !== 'independent' && !activePartiesMap.has(p.partyId)) {
          return false;
        }
        const prty = activePartiesMap.get(p.partyId);
        const partyAbbr = (prty?.abbreviation || p.partyId || "").toLowerCase();
        const partyName = (prty?.name || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        return name.includes(q) || partyAbbr.includes(q) || partyName.includes(q);
      })
      .slice(0, 8);
  }, [personsList, partiesList, quickSearchQuery]);

  // Add new candidate row (defaults to Independent - IND)
  const handleAddCandidate = () => {
    setCandidates((prev) => [
      ...prev,
      {
        tempId: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        candidateName: '',
        partyId: 'independent',
        partyAbbreviation: 'IND',
        partyColor: '#A1A1AA',
        votes: 0
      }
    ]);
  };

  const handleQuickAddPersonAsCandidate = (person: Person) => {
    if (person.isSuspended) {
      setErrorMessage(`Cannot add suspended politician "${person.name}".`);
      return;
    }
    const personParty = partiesList.find(
      (prty) => prty.id === person.partyId || prty.abbreviation?.toLowerCase() === person.partyId?.toLowerCase()
    );
    if (personParty?.isSuspended) {
      setErrorMessage(`Cannot add candidate affiliated with suspended party "${personParty.name}".`);
      return;
    }
    const partyAbbreviation = personParty?.abbreviation ? personParty.abbreviation : 'IND';
    const partyColor = personParty?.colors?.[0] ? personParty.colors[0] : '#A1A1AA';
    const partyId = personParty?.id ? personParty.id : 'independent';

    setCandidates((prev) => [
      ...prev,
      {
        tempId: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        personId: person.id,
        candidateName: person.name,
        partyId,
        partyAbbreviation,
        partyColor,
        votes: 0
      }
    ]);

    setQuickSearchQuery('');
    setShowQuickAddDropdown(false);
  };

  const handleRemoveCandidate = (tempId: string) => {
    if (candidates.length <= 1) {
      setErrorMessage('Election must have at least one candidate.');
      return;
    }
    setCandidates((prev) => prev.filter((c) => c.tempId !== tempId));
    setErrorMessage('');
  };

  const handlePersonSelect = (tempId: string, personId: string, customName?: string) => {
    if (!personId) {
      // Unset/Custom
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.tempId === tempId) {
            return {
              ...c,
              personId: undefined,
              candidateName: customName !== undefined ? customName : c.candidateName,
              partyId: 'independent',
              partyAbbreviation: 'IND',
              partyColor: '#A1A1AA'
            };
          }
          return c;
        })
      );
      return;
    }

    if (personId === 'nota') {
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.tempId === tempId) {
            return {
              ...c,
              personId: 'nota',
              candidateName: 'None of the above',
              partyId: 'nota',
              partyAbbreviation: 'NOTA',
              partyColor: '#6B7280'
            };
          }
          return c;
        })
      );
      return;
    }

    const selectedPerson = personsList.find((p) => p.id === personId);
    if (!selectedPerson) return;

    if (selectedPerson.isSuspended) {
      setErrorMessage(`Politician "${selectedPerson.name}" is suspended and cannot participate in elections.`);
      return;
    }

    const personParty = partiesList.find(
      (prty) => prty.id === selectedPerson.partyId || prty.abbreviation?.toLowerCase() === selectedPerson.partyId?.toLowerCase()
    );

    if (personParty?.isSuspended) {
      setErrorMessage(`Cannot select candidate affiliated with suspended party "${personParty.name}".`);
      return;
    }

    const partyAbbreviation = personParty?.abbreviation ? personParty.abbreviation : 'IND';
    const partyColor = personParty?.colors?.[0] ? personParty.colors[0] : '#A1A1AA';
    const partyId = personParty?.id ? personParty.id : 'independent';

    setCandidates((prev) =>
      prev.map((c) => {
        if (c.tempId === tempId) {
          return {
            ...c,
            personId: selectedPerson.id,
            candidateName: selectedPerson.name,
            partyId,
            partyAbbreviation,
            partyColor
          };
        }
        return c;
      })
    );
  };

  const handleVoteChange = (tempId: string, value: string) => {
    const parsed = value === '' ? '' : parseInt(value, 10);
    const validVotes = parsed === '' ? '' : isNaN(parsed) ? 0 : Math.max(0, parsed);

    setCandidates((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, votes: validVotes } : c))
    );
  };

  // Compute live election outcome
  const validCandidates = candidates.filter((c) => c.candidateName.trim() !== '');
  const sortedCandidates = [...validCandidates].sort(
    (a, b) => (typeof b.votes === 'number' ? b.votes : 0) - (typeof a.votes === 'number' ? a.votes : 0)
  );
  const winner = sortedCandidates[0];
  const runnerUp = sortedCandidates[1];
  const totalTurnout = validCandidates.reduce(
    (sum, c) => sum + (typeof c.votes === 'number' ? c.votes : 0),
    0
  );
  const marginOfVictory =
    winner && runnerUp
      ? (typeof winner.votes === 'number' ? winner.votes : 0) -
        (typeof runnerUp.votes === 'number' ? runnerUp.votes : 0)
      : typeof winner?.votes === 'number'
      ? winner.votes
      : 0;

  const handleConfirmElection = async () => {
    setErrorMessage('');

    if (validCandidates.length === 0) {
      setErrorMessage('Please add at least one candidate with a name.');
      return;
    }

    if (!winner || typeof winner.votes !== 'number' || winner.votes < 0) {
      setErrorMessage('Please enter valid votes for the candidates.');
      return;
    }

    // Strict validation against suspended entities
    for (const c of validCandidates) {
      // 1. Check person ID
      if (c.personId && c.personId !== 'nota') {
        const p = personsList.find(item => item.id === c.personId);
        if (p?.isSuspended) {
          setErrorMessage(`Candidate "${p.name}" is suspended and cannot participate in elections.`);
          return;
        }
      }
      // 2. Check candidate entered name against suspended persons
      const matchingSuspendedPerson = personsList.find(
        item => item.isSuspended && item.name.trim().toLowerCase() === c.candidateName.trim().toLowerCase()
      );
      if (matchingSuspendedPerson) {
        setErrorMessage(`"${matchingSuspendedPerson.name}" is a suspended politician and cannot contest or participate in elections.`);
        return;
      }
      // 3. Check party ID
      if (c.partyId && c.partyId !== 'independent' && c.partyId !== 'nota') {
        const pt = partiesList.find(item => item.id === c.partyId);
        if (pt?.isSuspended) {
          setErrorMessage(`Party "${pt.name}" (${pt.abbreviation}) is suspended and cannot participate in elections.`);
          return;
        }
      }
      // 4. Check candidate entered party abbreviation against suspended parties
      const matchingSuspendedParty = partiesList.find(
        pt => pt.isSuspended && (
          pt.abbreviation.trim().toLowerCase() === c.partyAbbreviation.trim().toLowerCase() ||
          pt.name.trim().toLowerCase() === c.partyAbbreviation.trim().toLowerCase()
        )
      );
      if (matchingSuspendedParty) {
        setErrorMessage(`Party "${matchingSuspendedParty.name}" (${matchingSuspendedParty.abbreviation}) is suspended and cannot participate in elections.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formattedCandidates: CandidateResult[] = validCandidates.map((c) => ({
        personId: c.personId,
        candidateName: c.candidateName,
        partyId: c.partyId,
        partyAbbreviation: c.partyAbbreviation,
        partyColor: c.partyColor,
        votes: typeof c.votes === 'number' ? c.votes : 0
      }));

      const winnerPartyAbbr = winner.partyAbbreviation;
      const isGain = previousPartyAbbreviation && previousPartyAbbreviation !== winnerPartyAbbr;

      const result: ElectionResult = {
        candidates: formattedCandidates,
        winnerId: winner.personId !== 'nota' ? winner.personId : undefined,
        winnerName: winner.candidateName,
        winnerPartyAbbreviation: winnerPartyAbbr,
        winnerPartyColor: winner.partyColor,
        marginOfVictory,
        turnout: totalTurnout,
        previousPartyAbbreviation,
        outcomeText: isGain
          ? `${winnerPartyAbbr} gain from ${previousPartyAbbreviation}`
          : `${winnerPartyAbbr} hold`,
        swingText: 'Swing',
        electionDate: Date.now()
      };

      const winnerPersonId = winner.personId !== 'nota' ? winner.personId : undefined;
      await onConfirm(winnerPersonId, result);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to conduct election.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl bg-[#121214] border border-zinc-800 rounded-2xl p-6 sm:p-8 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 text-[#FFD700] flex items-center justify-center border border-[#FFD700]/20">
              <Vote size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-wider">
                Conduct Election
              </h2>
              <p className="text-xs text-zinc-400">
                Constituency: <strong className="text-white font-bold">{constituencyName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Search & Add Candidate Bar */}
        <div className="mb-6 p-3.5 bg-white/5 border border-white/10 rounded-xl relative" ref={quickSearchRef}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
              <Search size={14} className="text-[#FFD700]" />
              <span>Search Database to Add Candidate:</span>
            </div>
          </div>
          
          <div className="relative mt-2">
            <input
              type="text"
              value={quickSearchQuery}
              onChange={(e) => {
                setQuickSearchQuery(e.target.value);
                setShowQuickAddDropdown(true);
              }}
              onFocus={() => {
                if (quickSearchQuery.trim()) setShowQuickAddDropdown(true);
              }}
              placeholder="Type any politician or party name to instantly add..."
              className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD700]"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            {quickSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setQuickSearchQuery('');
                  setShowQuickAddDropdown(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}

            {/* Quick Search Dropdown Menu */}
            {showQuickAddDropdown && quickSearchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#18181c] border border-zinc-700 rounded-xl shadow-2xl z-[160] overflow-hidden max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {quickFilteredPersons.length > 0 ? (
                  quickFilteredPersons.map((p) => {
                    const prty = partiesList.find(
                      (party) => party.id === p.partyId || party.abbreviation?.toLowerCase() === p.partyId?.toLowerCase()
                    );
                    const partyColor = prty?.colors?.[0] || '#3B82F6';
                    const partyAbbr = prty?.abbreviation || p.partyId || 'IND';

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleQuickAddPersonAsCandidate(p)}
                        className="w-full text-left p-2 hover:bg-zinc-800 rounded-lg flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={p.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className="w-6 h-6 rounded-full object-cover bg-zinc-700 shrink-0"
                          />
                          <span className="font-bold text-white group-hover:text-[#FFD700] truncate">
                            {p.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-[10px] font-black uppercase px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: partyColor }}
                          >
                            {partyAbbr}
                          </span>
                          <span className="text-[11px] font-bold text-[#FFD700] bg-[#FFD700]/10 px-2 py-0.5 rounded border border-[#FFD700]/20 flex items-center gap-1">
                            <Plus size={11} /> Add
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-xs text-zinc-500">
                    No matching persons found. Use the manual candidate fields below or add a new person in the database.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Candidate Entry Form List */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Electoral Candidates ({candidates.length})
            </h3>
            <button
              onClick={handleAddCandidate}
              className="text-xs gold-text hover:underline font-bold uppercase flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Candidate Row
            </button>
          </div>

          <div className="space-y-3">
            {candidates.map((cand, idx) => {
              return (
                <div
                  key={cand.tempId}
                  className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center gap-3 transition-all hover:border-zinc-700"
                >
                  {/* Searchable Person Selector */}
                  <SearchablePersonSelect
                    tempId={cand.tempId}
                    personId={cand.personId}
                    candidateName={cand.candidateName}
                    partyAbbreviation={cand.partyAbbreviation}
                    partyColor={cand.partyColor}
                    personsList={personsList}
                    partiesList={partiesList}
                    onSelect={handlePersonSelect}
                  />

                  {/* Candidate Display Name */}
                  <div className="w-full md:w-44">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Candidate Name
                    </label>
                    <input
                      type="text"
                      value={cand.candidateName}
                      onChange={(e) =>
                        setCandidates((prev) =>
                          prev.map((c) =>
                            c.tempId === cand.tempId ? { ...c, candidateName: e.target.value } : c
                          )
                        )
                      }
                      placeholder="Candidate name"
                      className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* Party Abbreviation & Color */}
                  <div className="w-full md:w-28">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Party Abbr.
                    </label>
                    <input
                      type="text"
                      value={cand.partyAbbreviation}
                      onChange={(e) =>
                        setCandidates((prev) =>
                          prev.map((c) =>
                            c.tempId === cand.tempId
                              ? { ...c, partyAbbreviation: e.target.value.toUpperCase() }
                              : c
                          )
                        )
                      }
                      placeholder="IND"
                      className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* Votes Input */}
                  <div className="w-full md:w-32">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Votes Got
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cand.votes}
                      onChange={(e) => handleVoteChange(cand.tempId, e.target.value)}
                      placeholder="0"
                      className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="flex items-end justify-end pt-2 md:pt-0">
                    <button
                      onClick={() => handleRemoveCandidate(cand.tempId)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remove Candidate"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Election Outcome Preview Box */}
        {winner && winner.candidateName && (
          <div className="mb-6 p-4 rounded-xl bg-[#18181c] border border-zinc-800 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
              <CheckCircle size={14} /> Projected Winner Preview
            </h4>
            <div className="flex flex-wrap items-center justify-between text-sm gap-2">
              <div>
                <span className="text-white font-bold text-base">{winner.candidateName}</span>{' '}
                <span className="text-[#FFD700] font-semibold">({winner.partyAbbreviation})</span>
              </div>
              <div className="text-right text-xs text-zinc-400">
                Votes: <strong className="text-white font-mono">{typeof winner.votes === 'number' ? winner.votes.toLocaleString() : 0}</strong> | Margin: <strong className="text-[#FFD700] font-mono">{marginOfVictory.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white uppercase transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmElection}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-black bg-[#FFD700] text-black hover:bg-[#ffe234] uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#FFD700]/10 disabled:opacity-50"
          >
            {isSubmitting ? 'DECLARING...' : 'CONFIRM & DECLARE WINNER'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
