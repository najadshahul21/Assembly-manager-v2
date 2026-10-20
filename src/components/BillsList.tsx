import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, ChevronRight, Check, X, Minus, User, Calendar, Scale, Info } from 'lucide-react';
import { LegislativeBill, Assembly, Person } from '../types';
import { firestoreService } from '../firestoreService';
import { formatAppDate, getSystemTimestamp } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

interface BillsListProps {
  bills: LegislativeBill[];
  assembly: Assembly;
  members: any[];
  onUpdateBill?: (updatedBill: LegislativeBill) => void;
}

export const BillsList: React.FC<BillsListProps> = ({ bills, assembly, members, onUpdateBill }) => {
  const { isViewerMode } = useAuth();
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [isVotingMode, setIsVotingMode] = useState<boolean>(true);
  const [localBills, setLocalBills] = useState<LegislativeBill[]>(bills);

  useEffect(() => {
    setLocalBills(bills);
  }, [bills]);

  const sortedBills = useMemo(() => {
    return [...localBills].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [localBills]);

  const handleVote = async (bill: LegislativeBill, personId: string, vote: 'yes' | 'no' | 'neutral') => {
    if (isViewerMode) {
      alert('Viewer Mode is active. Turn off Viewer Mode to record votes.');
      return;
    }
    if (assembly.isActive === false) {
      alert('This assembly has dissolved. Voting and modifications are disabled.');
      return;
    }

    const currentVotes = { ...(bill.votes || {}) };
    const existingVote = currentVotes[personId];

    // Toggle off if clicking the already selected vote, otherwise assign new vote
    if (existingVote === vote) {
      delete currentVotes[personId];
    } else {
      currentVotes[personId] = vote;
    }
    
    // Calculate new status
    let yesCount = 0;
    let noCount = 0;
    let neutralCount = 0;
    Object.values(currentVotes).forEach(v => {
      if (v === 'yes') yesCount++;
      else if (v === 'no') noCount++;
      else if (v === 'neutral') neutralCount++;
    });

    let status: 'Passed' | 'Rejected' | 'Withheld' = 'Withheld';
    if (yesCount > noCount) status = 'Passed';
    else if (noCount > yesCount) status = 'Rejected';
    else status = 'Withheld';

    const updatedBill: LegislativeBill = {
      ...bill,
      votes: currentVotes,
      status,
      updatedAt: getSystemTimestamp(),
    };

    // Immediate optimistic local update so UI reflects the vote instantly
    setLocalBills(prev => prev.map(b => (b.id === bill.id ? updatedBill : b)));
    onUpdateBill?.(updatedBill);

    try {
      await firestoreService.saveBill(updatedBill);
    } catch (error) {
      console.error('Error saving vote:', error);
      // Revert optimistic update on failure
      setLocalBills(prev => prev.map(b => (b.id === bill.id ? bill : b)));
      alert('Failed to save vote to server.');
    }
  };

  const selectedBill = useMemo(() => {
    return localBills.find(b => b.id === selectedBillId);
  }, [localBills, selectedBillId]);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Passed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <FileText size={48} className="mb-4 opacity-20" />
        <p className="font-bold uppercase tracking-widest text-xs">No bills presented yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedBills.map((bill) => (
          <motion.div
            key={bill.id}
            layoutId={bill.id}
            onClick={() => setSelectedBillId(bill.id)}
            className="glass-card group cursor-pointer hover:border-[#FFD700]/30 transition-all"
          >
            <div className="p-5 flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-[#FFD700]/10 transition-colors">
                  <FileText className="text-gray-400 group-hover:text-[#FFD700]" size={24} />
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(bill.status)}`}>
                  {bill.status}
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-white font-black uppercase tracking-tight line-clamp-1 mb-1">
                  {bill.billName}
                </h4>
                <p className="text-[10px] text-[#FFD700] font-black uppercase tracking-widest opacity-60">
                  {bill.billNo}
                </p>
              </div>

              <div className="mt-auto space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white/5 rounded">
                    <User size={12} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-300 font-bold leading-none">
                      shri. {bill.presenterName} MLA
                    </p>
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">
                      {bill.presenterConstituency}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedBill && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBillId(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-4xl max-h-[90vh] glass-card relative overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FFD700]/10 rounded-lg text-[#FFD700]">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white leading-none mb-1">
                      {selectedBill.billName}
                    </h3>
                    <p className="text-xs text-gray-500 font-black tracking-widest uppercase">
                      {selectedBill.billNo}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBillId(null)}
                  className="p-2 hover:bg-white/10 rounded-full text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <section>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] mb-3">Bill Content</h5>
                      <div className="p-6 bg-white/5 rounded-2xl border border-white/5 text-gray-300 leading-relaxed whitespace-pre-wrap font-serif italic text-lg">
                        {selectedBill.content}
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FFD700]">Legislative Voting</h5>
                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                            ({members.length} {members.length === 1 ? 'Member' : 'Members'})
                          </span>
                        </div>
                        {assembly.isActive !== false && !isViewerMode && (
                          <button 
                            type="button"
                            onClick={() => setIsVotingMode(!isVotingMode)}
                            className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] bg-[#FFD700]/10 px-3 py-1 rounded-full hover:bg-[#FFD700]/20 transition-colors cursor-pointer"
                          >
                            {isVotingMode ? 'Summary View' : 'Record Votes'}
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {members.length === 0 ? (
                          <div className="py-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                            No members found for this assembly
                          </div>
                        ) : (
                          members.map((member, idx) => {
                            const billVotes = selectedBill.votes || {};
                            const vote = billVotes[member.id];
                            return (
                              <div 
                                key={member.uniqueKey || `${member.id}-${idx}`} 
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
                              >
                                <div className="flex items-center gap-3 min-w-0 pr-2">
                                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-black text-gray-500 overflow-hidden shrink-0">
                                    {member.imageUrl ? (
                                      <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <User size={14} />
                                    )}
                                  </div>
                                  <div className="min-w-0 truncate">
                                    <p className="text-[11px] font-bold text-white leading-none mb-0.5 truncate">{member.name}</p>
                                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest truncate">{member.constituencyName}</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isVotingMode && assembly.isActive !== false && !isViewerMode ? (
                                    <>
                                      <button
                                        type="button"
                                        title="In Favor / Yes (Tick)"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleVote(selectedBill, member.id, 'yes');
                                        }}
                                        className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                                          vote === 'yes' 
                                            ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30 scale-105 font-black' 
                                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 hover:scale-105'
                                        }`}
                                      >
                                        <Check size={14} strokeWidth={2.5} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Against / No (Cross)"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleVote(selectedBill, member.id, 'no');
                                        }}
                                        className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                                          vote === 'no' 
                                            ? 'bg-rose-500 text-black shadow-md shadow-rose-500/30 scale-105 font-black' 
                                            : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 hover:scale-105'
                                        }`}
                                      >
                                        <X size={14} strokeWidth={2.5} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Neutral / Abstain (Minus)"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleVote(selectedBill, member.id, 'neutral');
                                        }}
                                        className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                                          vote === 'neutral' 
                                            ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30 scale-105 font-black' 
                                            : 'bg-gray-500/15 text-gray-400 hover:bg-gray-500/30 hover:text-white hover:scale-105'
                                        }`}
                                      >
                                        <Minus size={14} strokeWidth={2.5} />
                                      </button>
                                      {vote && (
                                        <span className={`ml-1 text-[9px] font-black uppercase tracking-widest ${
                                          vote === 'yes' ? 'text-emerald-400' :
                                          vote === 'no' ? 'text-rose-400' :
                                          'text-amber-400'
                                        }`}>
                                          {vote}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <div className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                                      vote === 'yes' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                                      vote === 'no' ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' :
                                      vote === 'neutral' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' :
                                      'text-gray-500 bg-white/5'
                                    }`}>
                                      {vote ? vote.toUpperCase() : 'NO VOTE'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] mb-3">Bill Statistics</h5>
                      <div className="p-5 glass-card space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Status</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(selectedBill.status)}`}>
                            {selectedBill.status}
                          </span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                            <span className="text-emerald-400">Yes Votes</span>
                            <span className="text-white">
                              {Object.values(selectedBill.votes || {}).filter(v => v === 'yes').length}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                            <span className="text-rose-400">No Votes</span>
                            <span className="text-white">
                              {Object.values(selectedBill.votes || {}).filter(v => v === 'no').length}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                            <span className="text-amber-400">Neutral</span>
                            <span className="text-white">
                              {Object.values(selectedBill.votes || {}).filter(v => v === 'neutral').length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] mb-3">Meta Information</h5>
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <div className="p-2 bg-white/5 rounded-lg text-gray-500">
                            <Calendar size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Created At</p>
                            <p className="text-xs font-bold text-white">{formatAppDate(selectedBill.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="p-2 bg-white/5 rounded-lg text-gray-500">
                            <Scale size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Presenter</p>
                            <p className="text-xs font-bold text-white">shri. {selectedBill.presenterName}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {assembly.isActive === false && (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3">
                        <Info className="text-amber-500 flex-shrink-0" size={16} />
                        <p className="text-[10px] text-amber-500 font-bold leading-relaxed uppercase tracking-tight">
                          This assembly has dissolved. Voting and modifications are disabled.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
