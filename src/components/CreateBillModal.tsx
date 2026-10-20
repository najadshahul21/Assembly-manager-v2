import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Send, User } from 'lucide-react';
import { Assembly, Person, LegislativeBill } from '../types';
import { firestoreService } from '../firestoreService';
import { getSystemTimestamp } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

interface CreateBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  assembly: Assembly;
  members: any[]; // These are assembly members
  onBillCreated?: (bill: LegislativeBill) => void;
}

export const CreateBillModal: React.FC<CreateBillModalProps> = ({
  isOpen,
  onClose,
  assembly,
  members,
  onBillCreated
}) => {
  const { user } = useAuth();
  const [billNo, setBillNo] = useState('');
  const [billName, setBillName] = useState('');
  const [presenterId, setPresenterId] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billNo || !billName || !presenterId || !content) {
      alert('Please fill in all fields.');
      return;
    }

    const presenter = members.find(m => m.id === presenterId);
    if (!presenter) return;

    setLoading(true);
    try {
      const newBill: LegislativeBill = {
        id: crypto.randomUUID(),
        billNo,
        billName,
        content,
        presenterId,
        presenterName: presenter.name,
        presenterConstituency: presenter.constituencyName,
        assemblyId: assembly.id,
        votes: {},
        status: 'Withheld',
        createdAt: getSystemTimestamp(),
        updatedAt: getSystemTimestamp(),
      };

      await firestoreService.saveBill(newBill);
      onBillCreated?.(newBill);
      onClose();
      // Reset form
      setBillNo('');
      setBillName('');
      setPresenterId('');
      setContent('');
    } catch (error) {
      console.error('Error creating bill:', error);
      alert('Failed to create bill.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-2xl glass-card relative overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FFD700]/10 rounded-lg">
                  <FileText className="text-[#FFD700]" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-white">
                    Create New Bill
                  </h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    {assembly.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] ml-1">
                    Bill Number
                  </label>
                  <input
                    type="text"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    placeholder="e.g. Bill No. 12/2024"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] ml-1">
                    Bill Name
                  </label>
                  <input
                    type="text"
                    value={billName}
                    onChange={(e) => setBillName(e.target.value)}
                    placeholder="e.g. Land Reform Bill"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] ml-1">
                  Presented By (MLA)
                </label>
                <div className="relative">
                  <select
                    value={presenterId}
                    onChange={(e) => setPresenterId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFD700]/50 appearance-none transition-colors"
                  >
                    <option value="" className="bg-[#121212]">Select MLA</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id} className="bg-[#121212]">
                        {member.name} ({member.constituencyName})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <User size={16} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] ml-1">
                  Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the detailed content of the bill..."
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFD700]/50 transition-colors resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-[#FFD700] hover:bg-[#FFD700]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-black uppercase tracking-widest text-xs text-black transition-all flex items-center gap-2"
                >
                  {loading ? 'Creating...' : (
                    <>
                      Create Bill
                      <Send size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
