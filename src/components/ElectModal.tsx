import React, { useState } from 'react';
import { Person, Party, ElectionResult, CandidateResult } from '../types';
import { Vote, Plus, Trash2, X, CheckCircle, Search, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

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

export const ElectModal: React.FC<ElectModalProps> = ({
  constituencyName,
  previousPartyAbbreviation = 'new constituency',
  personsList,
  partiesList,
  onClose,
  onConfirm
}) => {
  // Initialize candidate draft rows auto-populated from personsList / partiesList
  const [candidates, setCandidates] = useState<CandidateDraft[]>(() => {
    const getPartyInfo = (person?: Person) => {
      if (!person) return { partyId: 'independent', partyAbbreviation: 'IND', partyColor: '#A1A1AA' };
      const party = partiesList.find(
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

    const c1 = personsList[0];
    const c1Party = getPartyInfo(c1);

    const c2 = personsList[1];
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

  const handleRemoveCandidate = (tempId: string) => {
    if (candidates.length <= 1) {
      setErrorMessage('Election must have at least one candidate.');
      return;
    }
    setCandidates((prev) => prev.filter((c) => c.tempId !== tempId));
    setErrorMessage('');
  };

  const handlePersonSelect = (tempId: string, personId: string) => {
    if (!personId) {
      // Unset/Custom
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.tempId === tempId) {
            return {
              ...c,
              personId: undefined,
              candidateName: '',
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

    const personParty = partiesList.find(
      (prty) => prty.id === selectedPerson.partyId || prty.abbreviation?.toLowerCase() === selectedPerson.partyId?.toLowerCase()
    );

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
        className="w-full max-w-2xl bg-[#121214] border border-zinc-800 rounded-2xl p-6 sm:p-8 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
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
              <Plus size={14} /> Add Candidate
            </button>
          </div>

          <div className="space-y-3">
            {candidates.map((cand, idx) => {
              return (
                <div
                  key={cand.tempId}
                  className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center gap-3 transition-all hover:border-zinc-700"
                >
                  {/* Select Person from Database */}
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Candidate ({idx + 1})
                    </label>
                    <select
                      value={cand.personId || ''}
                      onChange={(e) => handlePersonSelect(cand.tempId, e.target.value)}
                      className="w-full bg-zinc-800/90 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700] cursor-pointer"
                    >
                      <option value="">-- Custom / Select Registered Person --</option>
                      <option value="nota">NOTA (None of the above)</option>
                      {personsList.map((p) => {
                        const prty = partiesList.find((pParty) => pParty.id === p.partyId);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} ({prty?.abbreviation || p.partyId})
                          </option>
                        );
                      })}
                    </select>
                  </div>

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
                  <div className="w-full md:w-32">
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
                  <div className="w-full md:w-36">
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
                <span className="text-blue-400 font-semibold">({winner.partyAbbreviation})</span>
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
