import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { LegislativeOrder, Person, Party, Designation, formatOfficeOfHonble } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Stamp, Plus, Calendar, User, Search, Filter, 
  Trash2, Copy, Check, Scale, Shield, Landmark, AtSign, 
  ArrowUpRight, Building2, CheckCircle2, ChevronDown, 
  ExternalLink, Printer, Sparkles, AlertCircle, X, Hash,
  Clock, ArrowDownWideNarrow, ArrowUpNarrowWide
} from 'lucide-react';
import { ReleaseOrderModal } from '../components/ReleaseOrderModal';
import { compareOrdersReverseChronological } from '../utils/governmentUtils';
import { formatAppDate } from '../utils/dateUtils';

interface OrdersPageProps {
  searchQuery?: string;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ searchQuery = '' }) => {
  const navigate = useNavigate();

  // State
  const [localSearch, setLocalSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDesignationFilter, setSelectedDesignationFilter] = useState<string>('all');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<LegislativeOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<LegislativeOrder | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queries
  const orders = useLiveQuery(async () => {
    const list = await db.orders.toArray();
    return list.sort(compareOrdersReverseChronological);
  }) || [];

  const persons = useLiveQuery(() => db.persons.toArray()) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const designations = useLiveQuery(() => db.designations.toArray()) || [];

  const personsMap = useMemo(() => {
    const map = new Map<string, Person>();
    persons.forEach(p => map.set(p.id, p));
    return map;
  }, [persons]);

  const partiesMap = useMemo(() => {
    const map = new Map<string, Party>();
    parties.forEach(p => map.set(p.id, p));
    return map;
  }, [parties]);

  // Combined Search
  const effectiveSearch = (searchQuery || localSearch).trim().toLowerCase();

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'cabinet' && order.byCategory !== 'cabinet') return false;
        if (selectedCategory === 'mla' && order.byCategory !== 'mla') return false;
        if (selectedCategory === 'judiciary' && order.byCategory !== 'judiciary') return false;
        if (selectedCategory === 'governor' && order.byCategory !== 'governor') return false;
        if (selectedCategory === 'speaker' && order.byCategory !== 'speaker') return false;
      }

      // Designation filter
      if (selectedDesignationFilter !== 'all') {
        if (order.byDesignationId !== selectedDesignationFilter && order.byDesignationName !== selectedDesignationFilter) {
          return false;
        }
      }

      // Tagged Person filter
      if (selectedPersonFilter !== 'all') {
        const isTagged = order.taggedPersonIds?.includes(selectedPersonFilter);
        const isSigner = order.signerPersonId === selectedPersonFilter;
        if (!isTagged && !isSigner) return false;
      }

      // Text search
      if (effectiveSearch) {
        const inName = order.orderName?.toLowerCase().includes(effectiveSearch);
        const inContent = order.content?.toLowerCase().includes(effectiveSearch);
        const inBy = order.byDesignationName?.toLowerCase().includes(effectiveSearch);
        const inOffice = order.byOfficeTitle?.toLowerCase().includes(effectiveSearch);
        const inSigner = order.signerPersonName?.toLowerCase().includes(effectiveSearch);
        const inNumber = order.orderNumber?.toLowerCase().includes(effectiveSearch);
        const inSlNo = order.slNo?.toLowerCase().includes(effectiveSearch);
        
        // Search tagged persons
        const inTagged = order.taggedPersonIds?.some(pId => {
          const p = personsMap.get(pId);
          return p?.name.toLowerCase().includes(effectiveSearch);
        });

        if (!inName && !inContent && !inBy && !inOffice && !inSigner && !inNumber && !inSlNo && !inTagged) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      return sortOrder === 'desc'
        ? compareOrdersReverseChronological(a, b)
        : compareOrdersReverseChronological(b, a);
    });
  }, [orders, selectedCategory, selectedDesignationFilter, selectedPersonFilter, effectiveSearch, personsMap, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = orders.length;
    const executive = orders.filter(o => o.byCategory === 'cabinet').length;
    const legislative = orders.filter(o => o.byCategory === 'mla' || o.byCategory === 'speaker').length;
    const judicial = orders.filter(o => o.byCategory === 'judiciary').length;
    const gubernatorial = orders.filter(o => o.byCategory === 'governor').length;
    return { total, executive, legislative, judicial, gubernatorial };
  }, [orders]);

  // Copy order content
  const handleCopyOrder = (order: LegislativeOrder) => {
    const officeHeader = order.byOfficeTitle || formatOfficeOfHonble(order.byDesignationName);
    const incumbentHeader = order.signerPersonName ? `\n(${order.signerPersonName})` : '';
    const textToCopy = `OFFICIAL ORDER: ${order.orderName}\nSl. No: ${order.slNo || order.orderNumber || 'N/A'}\nDate: ${formatAppDate(order.date)}\n${officeHeader}${incumbentHeader}\n\n${order.content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Delete order
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await db.orders.delete(orderToDelete.id);
      if (viewingOrder?.id === orderToDelete.id) {
        setViewingOrder(null);
      }
      setOrderToDelete(null);
    } catch (err) {
      console.error('Failed to delete order:', err);
    }
  };

  // Render text with interactive clickable @[Name](person:id) tags
  const renderFormattedOrderContent = (content: string = '', isPreview = false) => {
    if (!content) return null;
    const regex = /@\[([^\]]+)\]\(person:([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Text before the mention
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      
      const personName = match[1];
      const personId = match[2];
      const personObj = personsMap.get(personId);

      parts.push(
        <button
          key={`mention-${match.index}-${personId}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/person/${personId}`);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-[#FFD700]/15 text-[#FFD700] hover:bg-[#FFD700]/25 font-semibold text-xs border border-[#FFD700]/30 transition-colors cursor-pointer group align-baseline"
          title={`View profile of ${personName}`}
        >
          <img
            src={personObj?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(personName)}`}
            alt={personName}
            className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
          />
          <span className="group-hover:underline underline-offset-2">@{personName}</span>
          <ArrowUpRight size={10} className="opacity-60 group-hover:opacity-100" />
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    if (isPreview && content.length > 240) {
      return (
        <span className="line-clamp-3">
          {parts}
        </span>
      );
    }

    return parts;
  };

  // Helper for category badge styling
  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'judiciary':
        return { label: 'Judicial Ruling', icon: Scale, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'governor':
        return { label: 'Gubernatorial', icon: Shield, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'cabinet':
        return { label: 'Executive & Cabinet', icon: Landmark, color: 'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/20' };
      case 'speaker':
        return { label: 'Assembly Secretariat', icon: Building2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'mla':
        return { label: 'Legislative (MLA)', icon: User, color: 'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/20' };
      default:
        return { label: 'Official Directive', icon: FileText, color: 'text-gray-400 bg-white/5 border-white/10' };
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#FFD700]/15 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#FFD700]/10 border border-[#FFD700]/25 rounded-2xl text-[#FFD700] shadow-lg shadow-[#FFD700]/5">
              <Stamp size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black gold-text uppercase tracking-wider">
                Official Orders Registry
              </h1>
              <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">
                Gazette Notifications, Ministerial Directives, Legislative Mandates & Judicial Rulings
              </p>
            </div>
          </div>
        </div>

        {/* Release Order Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReleaseModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#FFD700] via-[#FFC000] to-[#E6B800] text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#FFD700]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5 cursor-pointer"
          >
            <Plus size={18} className="stroke-[3]" />
            <span>Release Order</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Total Released</span>
          <span className="text-2xl font-black gold-text mt-1">{stats.total}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col">
          <span className="text-[10px] text-white uppercase font-bold tracking-widest">Executive / Cabinet</span>
          <span className="text-2xl font-black text-[#FFD700] mt-1">{stats.executive}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col">
          <span className="text-[10px] text-white uppercase font-bold tracking-widest">MLAs & Speaker</span>
          <span className="text-2xl font-black text-yellow-300 mt-1">{stats.legislative}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col">
          <span className="text-[10px] text-purple-400 uppercase font-bold tracking-widest">Judicial Rulings</span>
          <span className="text-2xl font-black text-purple-300 mt-1">{stats.judicial}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col col-span-2 sm:col-span-1">
          <span className="text-[10px] text-amber-400 uppercase font-bold tracking-widest">Gubernatorial</span>
          <span className="text-2xl font-black text-amber-300 mt-1">{stats.gubernatorial}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0a0a0a]/80 border border-[#FFD700]/15 space-y-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'cabinet', label: 'Executive & Cabinet' },
            { id: 'mla', label: 'MLAs Directives' },
            { id: 'speaker', label: 'Speaker & Assembly' },
            { id: 'judiciary', label: 'Judicial Orders' },
            { id: 'governor', label: 'Governor' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-[#D32F2F] text-white shadow-md shadow-[#D32F2F]/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/5">
          {/* Text Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search title, text, signer..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFD700]/50 placeholder:text-gray-600"
            />
          </div>

          {/* Designation Filter */}
          <div className="relative">
            <select
              value={selectedDesignationFilter}
              onChange={(e) => setSelectedDesignationFilter(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFD700]/50 appearance-none cursor-pointer"
            >
              <option value="all">All Issuing Designations</option>
              {Array.from(new Set(orders.map(o => o.byDesignationName))).filter(Boolean).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>

          {/* Mentioned Person Filter */}
          <div className="relative">
            <select
              value={selectedPersonFilter}
              onChange={(e) => setSelectedPersonFilter(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFD700]/50 appearance-none cursor-pointer"
            >
              <option value="all">All Mentioned / Signers</option>
              {persons.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
          </div>

          {/* Chronological Sort Control */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              className="w-full bg-[#121212] border border-[#FFD700]/30 rounded-xl pl-8 pr-7 py-2 text-xs text-[#FFD700] font-bold focus:outline-none focus:border-[#FFD700] appearance-none cursor-pointer"
              title="Display Order"
            >
              <option value="desc">Newest First (Reverse Chronological)</option>
              <option value="asc">Oldest First (Chronological)</option>
            </select>
            <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#FFD700]" />
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#FFD700]" />
          </div>
        </div>
      </div>

      {/* Orders Sub-header / Sort Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="font-black text-white">{filteredOrders.length}</span>
          <span className="uppercase tracking-wider font-semibold">
            {filteredOrders.length === 1 ? 'Order Found' : 'Orders Found'}
          </span>
          {(selectedCategory !== 'all' || selectedDesignationFilter !== 'all' || selectedPersonFilter !== 'all' || effectiveSearch) && (
            <span className="text-amber-400/80 font-mono text-[11px]">(Filtered)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[#FFD700] font-mono text-[11px] bg-[#FFD700]/10 border border-[#FFD700]/20 px-2.5 py-1 rounded-lg">
          {sortOrder === 'desc' ? (
            <ArrowDownWideNarrow size={13} className="shrink-0" />
          ) : (
            <ArrowUpNarrowWide size={13} className="shrink-0" />
          )}
          <span className="font-semibold uppercase tracking-wider">
            {sortOrder === 'desc' ? 'Reverse Chronological Order (Newest First)' : 'Chronological Order (Oldest First)'}
          </span>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/[0.01] border border-dashed border-white/10 rounded-3xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
              <Stamp size={32} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-300">No Orders Found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {effectiveSearch || selectedCategory !== 'all' || selectedDesignationFilter !== 'all' || selectedPersonFilter !== 'all'
                  ? "No official orders match the active search and filter criteria."
                  : "No official orders have been issued yet. Legislators in charge of designations can release official orders."}
              </p>
            </div>
            <button
              onClick={() => setIsReleaseModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/25 text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} /> Release First Order
            </button>
          </div>
        ) : (
          filteredOrders.map(order => {
            const catBadge = getCategoryBadge(order.byCategory);
            const CatIcon = catBadge.icon;
            const signerPerson = order.signerPersonId ? personsMap.get(order.signerPersonId) : null;
            const signerParty = signerPerson ? partiesMap.get(signerPerson.partyId) : null;

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 sm:p-6 rounded-2xl bg-[#0e0e0e] border border-white/10 hover:border-[#FFD700]/30 transition-all group shadow-xl relative overflow-hidden"
              >
                {/* Decorative Top Line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFD700]/40 to-transparent" />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Metadata & Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header Chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      {order.slNo ? (
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] flex items-center gap-1">
                          <Hash size={11} /> Sl. No. {order.slNo}
                        </span>
                      ) : order.orderNumber ? (
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300">
                          {order.orderNumber}
                        </span>
                      ) : null}

                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${catBadge.color}`}>
                        <CatIcon size={12} />
                        {catBadge.label}
                      </span>

                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar size={12} className="text-[#FFD700]" />
                        {formatAppDate(order.date)}
                      </span>
                    </div>

                    {/* Order Title */}
                    <h3 
                      onClick={() => setViewingOrder(order)}
                      className="text-lg font-bold text-white group-hover:text-[#FFD700] transition-colors cursor-pointer"
                    >
                      {order.orderName}
                    </h3>

                    {/* By Office of Hon'ble (Respective Office) / (Respective Incumbent Name) */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-[#FFD700]/20 w-fit max-w-full">
                      <div className="w-10 h-10 rounded-lg bg-black/40 border border-[#FFD700]/30 flex items-center justify-center shrink-0 text-[#FFD700] overflow-hidden">
                        {(order.signerImageUrl || signerPerson?.imageUrl) ? (
                          <img 
                            src={order.signerImageUrl || signerPerson?.imageUrl} 
                            alt={order.signerPersonName || 'Incumbent'} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <CatIcon size={18} />
                        )}
                      </div>
                      <div className="text-xs min-w-0 flex-1">
                        <div className="font-bold text-gray-200 tracking-wide break-words">
                          {order.byOfficeTitle || formatOfficeOfHonble(order.byDesignationName)}
                        </div>
                        <div className="text-xs text-gray-300 font-semibold mt-0.5 flex items-center flex-wrap gap-1">
                          {order.signerPersonName ? (
                            <>
                              <span>({order.signerPersonName})</span>
                              {(order.signerPartyAbbr || signerParty?.abbreviation) && (
                                <span className="text-gray-500 font-normal">
                                  • {order.signerPartyAbbr || signerParty?.abbreviation}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <Scale size={12} className="shrink-0" />
                              <span>(Judicial Bench)</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Order Content */}
                    <div className="text-xs sm:text-sm text-gray-300 leading-relaxed font-sans pt-1">
                      {renderFormattedOrderContent(order.content, true)}
                    </div>

                    {/* Tagged Persons Badges */}
                    {order.taggedPersonIds && order.taggedPersonIds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest flex items-center gap-1">
                          <AtSign size={10} className="text-[#FFD700]" /> Mentioned:
                        </span>
                        {order.taggedPersonIds.map(pId => {
                          const person = personsMap.get(pId);
                          if (!person) return null;
                          return (
                            <button
                              key={pId}
                              type="button"
                              onClick={() => navigate(`/person/${person.id}`)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-[#FFD700]/15 text-gray-300 hover:text-[#FFD700] text-xs transition-colors border border-white/5 hover:border-[#FFD700]/30"
                            >
                              <img
                                src={person.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                                alt={person.name}
                                className="w-3.5 h-3.5 rounded-full object-cover"
                              />
                              <span>{person.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                    <button
                      onClick={() => setViewingOrder(order)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink size={13} /> View Order
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyOrder(order)}
                        title="Copy order text"
                        className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {copiedId === order.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setOrderToDelete(order)}
                        title="Revoke / Delete Order"
                        className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {viewingOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingOrder(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#0d0d0d] border border-[#FFD700]/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-black/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FFD700]/15 rounded-xl text-[#FFD700]">
                    <Stamp size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-mono tracking-widest block">
                      {viewingOrder.orderNumber || 'GAZETTE NOTIFICATION'}
                    </span>
                    <h3 className="text-base font-bold gold-text uppercase tracking-wider">
                      Official Gazette Order
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyOrder(viewingOrder)}
                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                    title="Copy Order"
                  >
                    {copiedId === viewingOrder.id ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingOrder(null)}
                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Order Body */}
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
                {/* Official Crest & Header */}
                <div className="text-center pb-6 border-b border-white/10 space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center text-[#FFD700]">
                    <Stamp size={24} />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    {viewingOrder.orderName}
                  </h2>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-400 font-medium pt-1">
                    <span>Date of Issuance: <strong className="text-gray-200">{formatAppDate(viewingOrder.date)}</strong></span>
                    <span>•</span>
                    {viewingOrder.slNo && (
                      <>
                        <span className="text-[#FFD700] font-mono font-bold">Sl. No. {viewingOrder.slNo}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>Ref: <strong className="text-gray-200">{viewingOrder.orderNumber || 'ORD-REF'}</strong></span>
                  </div>
                </div>

                {/* Issued By Callout - Frozen Historical Office & Incumbent */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#FFD700]/25 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-black/40 border border-[#FFD700]/30 flex items-center justify-center text-[#FFD700] overflow-hidden shrink-0">
                    {(viewingOrder.signerImageUrl || (viewingOrder.signerPersonId && personsMap.get(viewingOrder.signerPersonId)?.imageUrl)) ? (
                      <img 
                        src={viewingOrder.signerImageUrl || personsMap.get(viewingOrder.signerPersonId!)?.imageUrl} 
                        alt={viewingOrder.signerPersonName || 'Incumbent'} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <Landmark size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase text-[#FFD700] font-bold tracking-wider">
                      Issuing Authority
                    </div>
                    <div className="text-base font-bold text-white tracking-wide break-words">
                      {viewingOrder.byOfficeTitle || formatOfficeOfHonble(viewingOrder.byDesignationName)}
                    </div>
                    <div className="text-xs text-gray-300 font-semibold mt-0.5 flex items-center flex-wrap gap-1">
                      {viewingOrder.signerPersonName ? (
                        <>
                          <span>({viewingOrder.signerPersonName})</span>
                          {(viewingOrder.signerPartyAbbr || partiesMap.get(personsMap.get(viewingOrder.signerPersonId || '')?.partyId || '')?.abbreviation) && (
                            <span className="text-gray-400 font-normal">
                              • {viewingOrder.signerPartyAbbr || partiesMap.get(personsMap.get(viewingOrder.signerPersonId || '')?.partyId || '')?.abbreviation}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-amber-400 font-medium flex items-center gap-1">
                          <Scale size={13} className="shrink-0" />
                          <span>(Judicial Bench / Direct Institutional Order)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Text */}
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest text-white font-bold">Order Text & Directives</h4>
                  <div className="p-5 rounded-2xl bg-black/40 border border-white/5 text-sm text-gray-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {renderFormattedOrderContent(viewingOrder.content, false)}
                  </div>
                </div>

                {/* Linked Persons */}
                {viewingOrder.taggedPersonIds && viewingOrder.taggedPersonIds.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs uppercase tracking-widest text-white font-bold flex items-center gap-1.5">
                      <AtSign size={14} className="text-[#FFD700]" /> Mentioned Officials & Stakeholders
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {viewingOrder.taggedPersonIds.map(pId => {
                        const person = personsMap.get(pId);
                        if (!person) return null;
                        const party = partiesMap.get(person.partyId);
                        return (
                          <div
                            key={pId}
                            onClick={() => navigate(`/person/${person.id}`)}
                            className="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-[#FFD700]/30 hover:bg-white/[0.05] transition-all flex items-center justify-between cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={person.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                                alt={person.name}
                                className="w-8 h-8 rounded-full object-cover bg-black/40 border border-white/10"
                              />
                              <div>
                                <div className="text-xs font-bold text-white group-hover:text-[#FFD700] transition-colors">
                                  {person.name}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {party?.name || 'Independent'}
                                  {person.constituencyName && ` • ${person.constituencyName}`}
                                </div>
                              </div>
                            </div>
                            <ArrowUpRight size={14} className="text-gray-500 group-hover:text-[#FFD700]" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToDelete(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#141414] border border-red-500/30 rounded-2xl shadow-2xl p-6 z-10 space-y-4 text-center"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Revoke / Delete Order</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to delete <strong className="text-white">"{orderToDelete.orderName}"</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOrder}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/30"
                >
                  Delete Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Release Order Modal */}
      <ReleaseOrderModal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        onSuccess={() => {
          setIsReleaseModalOpen(false);
        }}
      />
    </div>
  );
};
