import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar, FileText, Stamp, User, Shield, Landmark, 
  Scale, CheckCircle2, AlertCircle, AtSign, Search, Check, Sparkles, Building2, Hash
} from 'lucide-react';
import { db } from '../db';
import { LegislativeOrder, Person, Party, Assembly, Designation, Constituency, formatOfficeOfHonble } from '../types';
import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';

interface ReleaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newOrder: LegislativeOrder) => void;
  initialDesignationId?: string;
  initialPersonId?: string;
}

export interface DesignationOption {
  id: string;
  name: string;
  category: string;
  incumbentId?: string;
  incumbentName?: string;
  partyAbbr?: string;
  roleDescription?: string;
}

export const ReleaseOrderModal: React.FC<ReleaseOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDesignationId,
  initialPersonId
}) => {
  // Form State
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [slNo, setSlNo] = useState<string>('');
  const [orderName, setOrderName] = useState('');
  const [selectedDesignationKey, setSelectedDesignationKey] = useState<string>('');
  const [orderContent, setOrderContent] = useState('');
  const [taggedPersonIds, setTaggedPersonIds] = useState<string[]>([]);
  
  // UI & Mention State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorIndex, setMentionCursorIndex] = useState<number | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [bySearchQuery, setBySearchQuery] = useState('');
  const [byCategoryFilter, setByCategoryFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionBoxRef = useRef<HTMLDivElement>(null);

  // Live database queries
  const persons = useLiveQuery(async () => {
    const list = await db.persons.toArray();
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }) || [];

  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const assemblies = useLiveQuery(() => db.assemblies.toArray()) || [];
  const designations = useLiveQuery(() => db.designations.toArray()) || [];
  const constituencies = useLiveQuery(() => db.constituencies.toArray()) || [];

  const partiesMap = useMemo(() => {
    const map = new Map<string, Party>();
    parties.forEach(p => map.set(p.id, p));
    return map;
  }, [parties]);

  const personsMap = useMemo(() => {
    const map = new Map<string, Person>();
    persons.forEach(p => map.set(p.id, p));
    return map;
  }, [persons]);

  const activeAssembly = useMemo(() => {
    return assemblies.find(a => a.isActive) || assemblies.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  }, [assemblies]);

  const ordersList = useLiveQuery(() => db.orders.toArray()) || [];

  // Build Comprehensive List of Designations
  // REQUIREMENT 2: An order can only be produced by an office that currently has an incumbent; a vacant office cannot produce an order!
  const designationOptions = useMemo<DesignationOption[]>(() => {
    const options: DesignationOption[] = [];
    const addedKeys = new Set<string>();

    const addOption = (opt: DesignationOption) => {
      // Strictly prevent vacant offices from producing orders
      if (
        !opt.incumbentId || 
        opt.incumbentId === 'vacant' || 
        !opt.incumbentName || 
        opt.incumbentName.trim().toLowerCase() === 'vacant' || 
        opt.incumbentName.trim().toLowerCase() === 'vacant seat' ||
        opt.incumbentName.trim().toLowerCase() === 'executive authority'
      ) {
        return;
      }
      const key = `${opt.id}::${opt.name}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        options.push(opt);
      }
    };

    // 1. Supreme Court
    const supremeDesig = designations.find(d => d.id === 'supreme-court' || d.name.toLowerCase().includes('supreme court'));
    if (supremeDesig?.incumbentId && supremeDesig.incumbentId !== 'vacant' && personsMap.has(supremeDesig.incumbentId)) {
      const scPerson = personsMap.get(supremeDesig.incumbentId)!;
      addOption({
        id: supremeDesig.id,
        name: 'Supreme Court',
        category: 'Judicial Authorities',
        incumbentId: scPerson.id,
        incumbentName: scPerson.name,
        partyAbbr: partiesMap.get(scPerson.partyId)?.abbreviation,
        roleDescription: 'Judiciary'
      });
    }

    // 2. High Court
    const highCourtDesig = designations.find(d => d.id === 'high-court' || d.name.toLowerCase().includes('high court'));
    if (highCourtDesig?.incumbentId && highCourtDesig.incumbentId !== 'vacant' && personsMap.has(highCourtDesig.incumbentId)) {
      const hcPerson = personsMap.get(highCourtDesig.incumbentId)!;
      addOption({
        id: highCourtDesig.id,
        name: 'High Court',
        category: 'Judicial Authorities',
        incumbentId: hcPerson.id,
        incumbentName: hcPerson.name,
        partyAbbr: partiesMap.get(hcPerson.partyId)?.abbreviation,
        roleDescription: 'Judiciary'
      });
    }

    // 3. Governor
    const govDesig = designations.find(d => d.id === 'governor' || d.name.toLowerCase().includes('governor'));
    const govPerson = govDesig?.incumbentId && govDesig.incumbentId !== 'vacant' ? personsMap.get(govDesig.incumbentId) : undefined;
    if (govPerson) {
      addOption({
        id: govDesig?.id || 'governor',
        name: govDesig?.name || "Hon'ble Governor",
        category: 'Constitutional & Gubernatorial',
        incumbentId: govPerson.id,
        incumbentName: govPerson.name,
        partyAbbr: partiesMap.get(govPerson.partyId)?.abbreviation,
        roleDescription: 'Head of State'
      });
    }

    // 4. State & Legislative Leadership
    if (activeAssembly?.leaders) {
      const leaders = activeAssembly.leaders;
      
      // Chief Minister
      if (leaders.chiefMinister && leaders.chiefMinister !== 'vacant') {
        const cmPerson = personsMap.get(leaders.chiefMinister);
        if (cmPerson) {
          addOption({
            id: 'leader-chiefMinister',
            name: "Hon'ble Chief Minister",
            category: 'Executive & Cabinet',
            incumbentId: cmPerson.id,
            incumbentName: cmPerson.name,
            partyAbbr: partiesMap.get(cmPerson.partyId)?.abbreviation,
            roleDescription: 'Leader of Government'
          });
        }
      }

      // Deputy Chief Minister
      if (leaders.deputyChiefMinister && leaders.deputyChiefMinister !== 'vacant') {
        const dcmPerson = personsMap.get(leaders.deputyChiefMinister);
        if (dcmPerson) {
          addOption({
            id: 'leader-deputyChiefMinister',
            name: "Hon'ble Deputy Chief Minister",
            category: 'Executive & Cabinet',
            incumbentId: dcmPerson.id,
            incumbentName: dcmPerson.name,
            partyAbbr: partiesMap.get(dcmPerson.partyId)?.abbreviation,
            roleDescription: 'Government'
          });
        }
      }

      // Speaker
      if (leaders.speaker && leaders.speaker !== 'vacant') {
        const spkPerson = personsMap.get(leaders.speaker);
        if (spkPerson) {
          addOption({
            id: 'leader-speaker',
            name: "Hon'ble Speaker of the Legislative Assembly",
            category: 'Legislative Leadership',
            incumbentId: spkPerson.id,
            incumbentName: spkPerson.name,
            partyAbbr: partiesMap.get(spkPerson.partyId)?.abbreviation,
            roleDescription: 'Speaker'
          });
        }
      }

      // Deputy Speaker
      if (leaders.deputySpeaker && leaders.deputySpeaker !== 'vacant') {
        const dspkPerson = personsMap.get(leaders.deputySpeaker);
        if (dspkPerson) {
          addOption({
            id: 'leader-deputySpeaker',
            name: "Hon'ble Deputy Speaker",
            category: 'Legislative Leadership',
            incumbentId: dspkPerson.id,
            incumbentName: dspkPerson.name,
            partyAbbr: partiesMap.get(dspkPerson.partyId)?.abbreviation,
            roleDescription: 'Deputy Speaker'
          });
        }
      }

      // Chief Secretary
      if (leaders.chiefSecretary && leaders.chiefSecretary !== 'vacant') {
        const csPerson = personsMap.get(leaders.chiefSecretary);
        if (csPerson) {
          addOption({
            id: 'leader-chiefSecretary',
            name: "Chief Secretary to Government",
            category: 'Executive & Cabinet',
            incumbentId: csPerson.id,
            incumbentName: csPerson.name,
            partyAbbr: partiesMap.get(csPerson.partyId)?.abbreviation,
            roleDescription: 'Administrative Head'
          });
        }
      }

      // Leader of Opposition
      if (leaders.leaderOfOpposition && leaders.leaderOfOpposition !== 'vacant') {
        const lopPerson = personsMap.get(leaders.leaderOfOpposition);
        if (lopPerson) {
          addOption({
            id: 'leader-leaderOfOpposition',
            name: "Leader of Opposition",
            category: 'Legislative Leadership',
            incumbentId: lopPerson.id,
            incumbentName: lopPerson.name,
            partyAbbr: partiesMap.get(lopPerson.partyId)?.abbreviation,
            roleDescription: 'Opposition Leader'
          });
        }
      }
    }

    // 5. Ministers (from assemblyRoles and designations)
    if (activeAssembly) {
      const targetAssemblyId = activeAssembly.id;
      persons.forEach(p => {
        if (p.assemblyRoles && p.assemblyRoles[targetAssemblyId]) {
          const roles = p.assemblyRoles[targetAssemblyId].split(', ');
          roles.forEach(role => {
            const lower = role.toLowerCase();
            if (lower.includes('minister') && !lower.includes('former')) {
              const formattedName = role.startsWith("Hon'ble") ? role : `Hon'ble ${role}`;
              addOption({
                id: `minister-${p.id}-${role.replace(/[^a-z0-9]/gi, '_')}`,
                name: formattedName,
                category: 'Ministers & Portfolios',
                incumbentId: p.id,
                incumbentName: p.name,
                partyAbbr: partiesMap.get(p.partyId)?.abbreviation,
                roleDescription: 'Ministerial Portfolio'
              });
            }
          });
        }
      });
    }

    // Designations that are ministerial
    designations.forEach(d => {
      const lower = d.name.toLowerCase();
      if (lower.includes('minister') && !addedKeys.has(`${d.id}::${d.name}`)) {
        const incPerson = d.incumbentId && d.incumbentId !== 'vacant' ? personsMap.get(d.incumbentId) : undefined;
        if (incPerson) {
          addOption({
            id: d.id,
            name: d.name,
            category: 'Ministers & Portfolios',
            incumbentId: incPerson.id,
            incumbentName: incPerson.name,
            partyAbbr: partiesMap.get(incPerson.partyId)?.abbreviation,
            roleDescription: 'Ministerial Designation'
          });
        }
      }
    });

    // 6. MLAs (Members of the Legislative Assembly)
    const sortedConstituencies = [...constituencies].sort((a, b) => {
      const slA = parseInt(a.slNo) || 9999;
      const slB = parseInt(b.slNo) || 9999;
      return slA - slB;
    });

    sortedConstituencies.forEach(c => {
      const mlaPerson = c.currentIncumbentId && c.currentIncumbentId !== 'vacant' 
        ? personsMap.get(c.currentIncumbentId) 
        : undefined;
      
      if (mlaPerson) {
        const party = partiesMap.get(mlaPerson.partyId);
        addOption({
          id: `mla-${c.id}`,
          name: `MLA - ${c.name}`,
          category: 'Members of the Legislative Assembly (MLAs)',
          incumbentId: mlaPerson.id,
          incumbentName: mlaPerson.name,
          partyAbbr: party?.abbreviation,
          roleDescription: `Sl No: ${c.slNo || '--'}`
        });
      }
    });

    // 7. All Other Existing Designations in DB
    designations.forEach(d => {
      const lower = d.name.toLowerCase();
      if (
        d.id !== 'governor' && 
        d.id !== 'high-court' && 
        d.id !== 'supreme-court' && 
        !lower.includes('governor') && 
        !lower.includes('high court') && 
        !lower.includes('supreme court') && 
        !lower.includes('court') &&
        !lower.includes('judic') &&
        !lower.includes('minister') &&
        !d.constituencyId
      ) {
        const incPerson = d.incumbentId && d.incumbentId !== 'vacant' ? personsMap.get(d.incumbentId) : undefined;
        if (incPerson) {
          addOption({
            id: d.id,
            name: d.name,
            category: 'Other Statutory & Official Designations',
            incumbentId: incPerson.id,
            incumbentName: incPerson.name,
            partyAbbr: partiesMap.get(incPerson.partyId)?.abbreviation,
            roleDescription: d.constituency || 'Statutory Designation'
          });
        }
      }
    });

    return options;
  }, [designations, persons, personsMap, partiesMap, activeAssembly, constituencies]);

  // Set default selected designation & auto-suggest slNo
  useEffect(() => {
    if (isOpen) {
      if (!slNo) {
        setSlNo(String((ordersList?.length || 0) + 1));
      }
      if (initialDesignationId) {
        const match = designationOptions.find(d => d.id === initialDesignationId);
        if (match) {
          setSelectedDesignationKey(`${match.id}::${match.name}`);
          return;
        } else {
          // The designated office is vacant, keep selection empty so user is guided by the warning banner
          setSelectedDesignationKey('');
          return;
        }
      }
      if (initialPersonId) {
        const match = designationOptions.find(d => d.incumbentId === initialPersonId);
        if (match) {
          setSelectedDesignationKey(`${match.id}::${match.name}`);
          return;
        }
      }
      if (designationOptions.length > 0 && !selectedDesignationKey) {
        setSelectedDesignationKey(`${designationOptions[0].id}::${designationOptions[0].name}`);
      }
    }
  }, [isOpen, initialDesignationId, initialPersonId, designationOptions, selectedDesignationKey, ordersList.length, slNo]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setSlNo('');
      setOrderName('');
      setSelectedDesignationKey('');
      setOrderContent('');
      setTaggedPersonIds([]);
      setMentionQuery(null);
      setMentionCursorIndex(null);
      setFormError(null);
      setIsPickerOpen(false);
      setBySearchQuery('');
      setByCategoryFilter('ALL');
    }
  }, [isOpen]);

  // Handle Textarea Change and @ Mention Detection
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart;
    setOrderContent(text);

    // Look for "@" symbol preceding current cursor position
    const textBeforeCursor = text.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      // Check if @ is at start or preceded by space or newline
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        const queryCandidate = textBeforeCursor.slice(lastAtIndex + 1);
        // Only trigger mention if there are no linebreaks and length is reasonable
        if (!queryCandidate.includes('\n') && queryCandidate.length <= 30) {
          setMentionQuery(queryCandidate);
          setMentionCursorIndex(lastAtIndex);
          setMentionSelectedIndex(0);
          return;
        }
      }
    }

    setMentionQuery(null);
    setMentionCursorIndex(null);
  };

  // Filter persons for mention autocomplete
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();
    if (!q) return persons.slice(0, 8);
    return persons
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, persons]);

  // Insert a mentioned person into textarea
  const insertMention = (person: Person) => {
    if (mentionCursorIndex === null && !textareaRef.current) return;
    
    const cursor = textareaRef.current ? textareaRef.current.selectionStart : orderContent.length;
    const startIndex = mentionCursorIndex !== null ? mentionCursorIndex : cursor;
    
    // We insert a clean mention tag: @[Person Name](person:id)
    const mentionTag = `@[${person.name}](person:${person.id}) `;
    
    const before = orderContent.slice(0, startIndex);
    const after = orderContent.slice(cursor);
    const newContent = `${before}${mentionTag}${after}`;
    
    setOrderContent(newContent);
    
    if (!taggedPersonIds.includes(person.id)) {
      setTaggedPersonIds(prev => [...prev, person.id]);
    }

    setMentionQuery(null);
    setMentionCursorIndex(null);

    // Focus back on textarea and position cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = startIndex + mentionTag.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // Manual picker add
  const handlePickerSelect = (person: Person) => {
    const mentionTag = `@[${person.name}](person:${person.id}) `;
    setOrderContent(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + mentionTag);
    if (!taggedPersonIds.includes(person.id)) {
      setTaggedPersonIds(prev => [...prev, person.id]);
    }
    setIsPickerOpen(false);
    setPickerSearch('');
  };

  const removeTaggedPerson = (personId: string) => {
    setTaggedPersonIds(prev => prev.filter(id => id !== personId));
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex(prev => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = mentionSuggestions[mentionSelectedIndex];
        if (selected) {
          insertMention(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        setMentionCursorIndex(null);
        return;
      }
    }
  };

  // Submit & Release Order
  const handleReleaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError('Please select an issuance date');
      return;
    }
    if (!slNo.trim()) {
      setFormError('Please provide a Serial Number (Sl No) for the order');
      return;
    }
    if (!orderName.trim()) {
      setFormError('Please provide an order title / name');
      return;
    }
    if (!selectedDesignationKey) {
      setFormError('Please select the issuing office');
      return;
    }
    if (!orderContent.trim()) {
      setFormError('Please write the order details / content');
      return;
    }

    const selectedOption = designationOptions.find(d => `${d.id}::${d.name}` === selectedDesignationKey);
    // REQUIREMENT 2: An order can only be produced by an office that currently has an incumbent; a vacant office cannot produce order.
    if (
      !selectedOption || 
      !selectedOption.incumbentId || 
      selectedOption.incumbentId === 'vacant' || 
      !selectedOption.incumbentName || 
      selectedOption.incumbentName.trim().toLowerCase() === 'vacant' ||
      selectedOption.incumbentName.trim().toLowerCase() === 'vacant seat'
    ) {
      setFormError('An order can only be produced by an office that currently has an incumbent. A vacant office cannot produce an order.');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderId = nanoid();
      const cleanSlNo = slNo.trim();
      const orderNumber = cleanSlNo.startsWith('ORD') || cleanSlNo.startsWith('No.') ? cleanSlNo : `No. ${cleanSlNo}`;
      
      // REQUIREMENT 3: Freeze the office title, incumbent name, party, and image so that future changes to the office do not alter this order!
      const frozenOfficeTitle = formatOfficeOfHonble(selectedOption.name);
      const frozenIncumbentName = selectedOption.incumbentName.trim();
      const frozenPartyAbbr = selectedOption.partyAbbr;
      const signerPersonObj = personsMap.get(selectedOption.incumbentId);
      const frozenImageUrl = signerPersonObj?.imageUrl;

      // Extract all tagged person IDs from content as well (to ensure perfect sync)
      const mentionRegex = /@\[([^\]]+)\]\(person:([^)]+)\)/g;
      const extractedIds: string[] = [];
      let match;
      while ((match = mentionRegex.exec(orderContent)) !== null) {
        if (match[2] && !extractedIds.includes(match[2])) {
          extractedIds.push(match[2]);
        }
      }
      const finalTaggedIds = Array.from(new Set([...taggedPersonIds, ...extractedIds]));

      const newOrder: LegislativeOrder = {
        id: orderId,
        slNo: cleanSlNo,
        orderNumber,
        orderName: orderName.trim(),
        date,
        timestamp: new Date(date).getTime() || Date.now(),
        byDesignationId: selectedOption.id,
        byDesignationName: selectedOption.name,
        byOfficeTitle: frozenOfficeTitle,
        byCategory: selectedOption.category.toLowerCase().includes('cabinet') 
          ? 'cabinet' 
          : selectedOption.category.toLowerCase().includes('mla') 
            ? 'mla' 
            : selectedOption.category.toLowerCase().includes('judicial') 
              ? 'judiciary' 
              : selectedOption.category.toLowerCase().includes('gubernatorial') 
                ? 'governor' 
                : selectedOption.category.toLowerCase().includes('speaker') 
                  ? 'speaker' 
                  : 'designation',
        signerPersonId: selectedOption.incumbentId,
        signerPersonName: frozenIncumbentName,
        signerPartyAbbr: frozenPartyAbbr,
        signerImageUrl: frozenImageUrl,
        content: orderContent.trim(),
        taggedPersonIds: finalTaggedIds,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.orders.put(newOrder);

      if (onSuccess) {
        onSuccess(newOrder);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to release order:', err);
      setFormError(err?.message || 'Failed to release order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOption = designationOptions.find(d => `${d.id}::${d.name}` === selectedDesignationKey);

  const initialDesignationObj = designations.find(d => d.id === initialDesignationId);
  const isInitialDesignationVacant = Boolean(
    initialDesignationId && 
    initialDesignationObj && 
    (!initialDesignationObj.incumbentId || initialDesignationObj.incumbentId === 'vacant')
  );

  // Filtered Designation Options for Apps-Organized Picker
  const filteredDesignationOptions = useMemo(() => {
    let list = designationOptions;
    if (byCategoryFilter !== 'ALL') {
      list = list.filter(opt => opt.category === byCategoryFilter);
    }
    if (bySearchQuery.trim()) {
      const q = bySearchQuery.toLowerCase().trim();
      list = list.filter(opt => 
        opt.name.toLowerCase().includes(q) || 
        (opt.incumbentName || '').toLowerCase().includes(q) ||
        (opt.partyAbbr || '').toLowerCase().includes(q) ||
        (opt.roleDescription || '').toLowerCase().includes(q) ||
        opt.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [designationOptions, byCategoryFilter, bySearchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: { [cat: string]: number } = { ALL: designationOptions.length };
    designationOptions.forEach(opt => {
      counts[opt.category] = (counts[opt.category] || 0) + 1;
    });
    return counts;
  }, [designationOptions]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    designationOptions.forEach(opt => cats.add(opt.category));
    return Array.from(cats);
  }, [designationOptions]);

  // Grouped Designation Options for Dropdown fallback
  const groupedDesignations = useMemo(() => {
    const groups: { [cat: string]: DesignationOption[] } = {};
    designationOptions.forEach(opt => {
      if (!groups[opt.category]) groups[opt.category] = [];
      groups[opt.category].push(opt);
    });
    return groups;
  }, [designationOptions]);

  // Filtered persons for manual picker modal
  const filteredPickerPersons = useMemo(() => {
    if (!pickerSearch.trim()) return persons;
    const q = pickerSearch.toLowerCase().trim();
    return persons.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (partiesMap.get(p.partyId)?.name || '').toLowerCase().includes(q) ||
      (partiesMap.get(p.partyId)?.abbreviation || '').toLowerCase().includes(q)
    );
  }, [persons, pickerSearch, partiesMap]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative w-full max-w-2xl bg-[#0e0e0e] border border-[#FFD700]/25 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-black/80 via-white/[0.02] to-black/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#FFD700]/15 border border-[#FFD700]/30 rounded-xl text-[#FFD700]">
                <Stamp size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black gold-text uppercase tracking-wider flex items-center gap-2">
                  Release Official Order
                </h3>
                <p className="text-[11px] text-gray-400">
                  Gazette order issuance by designated legislative, executive, and judicial authorities
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleReleaseOrder} className="flex-1 overflow-y-auto p-6 space-y-5">
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2"
              >
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>{formError}</span>
              </motion.div>
            )}

            {/* Vacant Office Warning */}
            {isInitialDesignationVacant && (
              <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0 text-amber-400" />
                <div>
                  <span className="font-bold text-amber-200">Office Currently Vacant:</span> The office of{' '}
                  <span className="font-semibold text-white underline">{initialDesignationObj?.name}</span> does not have an active incumbent. 
                  An official order can only be produced by an office with an incumbent. Please select another active office below.
                </div>
              </div>
            )}

            {designationOptions.length === 0 && (
              <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0 text-red-400" />
                <div>
                  No offices with active incumbents found. An official order cannot be produced by a vacant office.
                </div>
              </div>
            )}

            {/* 1. Date */}
            <div>
              <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1.5 flex items-center gap-2">
                <Calendar size={14} className="text-[#FFD700]" />
                1. Date of Issuance
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#FFD700]/60 focus:bg-white/[0.08] transition-all"
                  required
                />
              </div>
            </div>

            {/* 2. Sl. No. (Asked before Name) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider flex items-center gap-2">
                  <Hash size={14} className="text-[#FFD700]" />
                  2. Sl. No.
                </label>
                <span className="text-[10px] text-gray-500 font-normal">Order Serial / Ref No.</span>
              </div>
              <input
                type="text"
                value={slNo}
                onChange={(e) => setSlNo(e.target.value)}
                placeholder="e.g. 1, 42/2026, or GO(P) No. 04"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#FFD700]/60 focus:bg-white/[0.08] transition-all font-mono"
                required
              />
            </div>

            {/* 3. Order Name / Title */}
            <div>
              <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1.5 flex items-center gap-2">
                <FileText size={14} className="text-[#FFD700]" />
                3. Order Name / Title
              </label>
              <input
                type="text"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                placeholder="e.g. Directive on Infrastructure Fund Allocation / Interim Injunction Order"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#FFD700]/60 focus:bg-white/[0.08] transition-all placeholder:text-gray-600 font-medium"
                required
              />
            </div>

            {/* 4. By : Apps Organized UI with Live Search */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider flex items-center gap-2">
                  <Landmark size={14} className="text-[#FFD700]" />
                  4. By : Select Issuing Authority
                </label>
                <span className="text-[10px] text-amber-400/90 uppercase tracking-widest font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-amber-400" />
                  Active Incumbents Only
                </span>
              </div>

              {/* Live Search Box */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={bySearchQuery}
                  onChange={(e) => setBySearchQuery(e.target.value)}
                  placeholder="Search office (e.g. Supreme Court, High Court, Chief Minister) or incumbent..."
                  className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FFD700]/60 focus:bg-[#181818] transition-all font-medium"
                />
                {bySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBySearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Apps Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                <button
                  type="button"
                  onClick={() => setByCategoryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    byCategoryFilter === 'ALL'
                      ? 'bg-[#FFD700] text-black shadow-sm shadow-[#FFD700]/20'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  <span>All</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${byCategoryFilter === 'ALL' ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'}`}>
                    {categoryCounts['ALL'] || 0}
                  </span>
                </button>
                {uniqueCategories.map(cat => {
                  const isSelected = byCategoryFilter === cat;
                  const shortLabel = cat === 'Judicial Authorities' 
                    ? 'Judicial' 
                    : cat === 'Constitutional & Gubernatorial'
                    ? 'Constitutional'
                    : cat === 'Executive & Cabinet'
                    ? 'Executive'
                    : cat === 'Legislative Leadership'
                    ? 'Legislative'
                    : cat === 'Cabinet Ministers'
                    ? 'Ministers'
                    : cat === 'Legislative Assembly (MLAs)'
                    ? 'MLAs'
                    : cat === 'Other Statutory & Official Designations'
                    ? 'Statutory'
                    : cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setByCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-[#FFD700] text-black shadow-sm shadow-[#FFD700]/20'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                    >
                      <span>{shortLabel}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-gray-400'}`}>
                        {categoryCounts[cat] || 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Apps Organized Authority Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-black/30 border border-white/5 rounded-xl">
                {filteredDesignationOptions.map(opt => {
                  const isSelected = selectedDesignationKey === `${opt.id}::${opt.name}`;
                  const personObj = opt.incumbentId ? personsMap.get(opt.incumbentId) : undefined;
                  return (
                    <button
                      key={`${opt.id}::${opt.name}`}
                      type="button"
                      onClick={() => {
                        setSelectedDesignationKey(`${opt.id}::${opt.name}`);
                        setFormError(null);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer group ${
                        isSelected
                          ? 'bg-[#FFD700]/15 border-[#FFD700] shadow-md shadow-[#FFD700]/15 ring-1 ring-[#FFD700]/50'
                          : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border overflow-hidden ${
                          isSelected 
                            ? 'border-[#FFD700]/50 bg-black/60 text-[#FFD700]' 
                            : 'border-white/10 bg-black/40 text-gray-400 group-hover:text-white group-hover:border-white/20'
                        }`}>
                          {personObj?.imageUrl ? (
                            <img src={personObj.imageUrl} alt={opt.incumbentName} className="w-full h-full object-cover" />
                          ) : opt.category.includes('Judicial') ? (
                            <Scale size={18} className="text-[#FFD700]" />
                          ) : opt.category.includes('Gubernatorial') ? (
                            <Shield size={18} className="text-emerald-400" />
                          ) : opt.category.includes('Cabinet') || opt.category.includes('Executive') ? (
                            <Building2 size={18} className="text-amber-400" />
                          ) : (
                            <User size={18} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isSelected ? 'text-[#FFD700]' : 'text-gray-200 group-hover:text-white'}`}>
                            {opt.name}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                            <span className="text-gray-300 font-medium truncate">{opt.incumbentName}</span>
                            {opt.partyAbbr && <span className="text-gray-500 shrink-0">({opt.partyAbbr})</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-[#FFD700] text-black flex items-center justify-center shadow-sm">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-white/20 group-hover:border-white/40 flex items-center justify-center text-transparent" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredDesignationOptions.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 p-5 text-center">
                    <p className="text-xs text-gray-400 font-medium">
                      No active authority found matching <span className="text-white font-semibold">"{bySearchQuery}"</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setBySearchQuery('');
                        setByCategoryFilter('ALL');
                      }}
                      className="mt-2 text-xs font-bold text-[#FFD700] hover:underline cursor-pointer"
                    >
                      Reset filter & search
                    </button>
                  </div>
                )}
              </div>

              {/* Confirmed Snapshot Preview Banner */}
              {selectedOption ? (
                <div className="p-3.5 bg-gradient-to-r from-[#FFD700]/10 via-black/40 to-black/60 border border-[#FFD700]/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-black/60 border border-[#FFD700]/40 flex items-center justify-center text-[#FFD700] overflow-hidden shrink-0 shadow-md">
                      {selectedOption.incumbentId && personsMap.get(selectedOption.incumbentId)?.imageUrl ? (
                        <img 
                          src={personsMap.get(selectedOption.incumbentId)!.imageUrl} 
                          alt={selectedOption.incumbentName} 
                          className="w-full h-full object-cover" 
                        />
                      ) : selectedOption.category.includes('Judicial') ? (
                        <Scale size={20} className="text-[#FFD700]" />
                      ) : selectedOption.category.includes('Gubernatorial') ? (
                        <Shield size={20} className="text-emerald-400" />
                      ) : (
                        <Landmark size={20} className="text-[#FFD700]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-extrabold text-[#FFD700] tracking-wider">
                          Issuing Authority
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-black/40 text-gray-400 border border-white/10">
                          {selectedOption.category}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white tracking-wide truncate">
                        {formatOfficeOfHonble(selectedOption.name)}
                      </div>
                      <div className="text-xs text-gray-300 font-semibold mt-0.5 flex items-center gap-1.5 truncate">
                        <span>({selectedOption.incumbentName})</span>
                        {selectedOption.partyAbbr && (
                          <span className="text-[#FFD700] font-normal">
                            • {selectedOption.partyAbbr}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 pl-2">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>Please choose an active issuing authority from the apps grid above.</span>
                </div>
              )}
            </div>

            {/* 5. Order Directives / Content : (Typing field with @ mention autocomplete) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider flex items-center gap-2">
                  <AtSign size={14} className="text-[#FFD700]" />
                  5. Order Directives / Content : (Type & use "@" to link an existing person)
                </label>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="text-[11px] text-[#FFD700] hover:text-[#FFE55C] font-semibold flex items-center gap-1 hover:underline transition-colors"
                >
                  <AtSign size={12} /> Mention Official
                </button>
              </div>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={orderContent}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  rows={6}
                  placeholder={`Write the official order here...\nTip: Type "@" followed by a name (e.g. @Pinarayi or @Shamseer) to link any existing legislator or official.`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-[#FFD700]/60 focus:bg-white/[0.08] transition-all font-sans leading-relaxed resize-y placeholder:text-gray-600"
                  required
                />

                {/* Floating @ Mention Autocomplete Popover */}
                {mentionQuery !== null && mentionSuggestions.length > 0 && (
                  <motion.div
                    ref={mentionBoxRef}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute z-50 left-2 right-2 bottom-full mb-2 bg-[#121212] border border-[#FFD700]/40 rounded-xl shadow-2xl shadow-black overflow-hidden backdrop-blur-xl max-h-56 overflow-y-auto"
                  >
                    <div className="p-2 border-b border-white/10 text-[10px] text-gray-400 uppercase font-bold tracking-widest flex items-center justify-between bg-black/40">
                      <span>Linking Person: "{mentionQuery}"</span>
                      <span className="text-gray-500">↑↓ to navigate • ↵ to select</span>
                    </div>
                    <div className="py-1">
                      {mentionSuggestions.map((person, idx) => {
                        const party = partiesMap.get(person.partyId);
                        const isSelected = idx === mentionSelectedIndex;
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => insertMention(person)}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                              isSelected ? 'bg-[#FFD700]/15 text-white' : 'hover:bg-white/5 text-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={person.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                                alt={person.name}
                                className="w-7 h-7 rounded-full object-cover bg-black/30 border border-white/10"
                              />
                              <div>
                                <div className="text-xs font-bold text-white">{person.name}</div>
                                <div className="text-[10px] text-gray-400">
                                  {party ? party.name : 'Independent'}
                                  {person.constituencyName && ` • ${person.constituencyName}`}
                                </div>
                              </div>
                            </div>
                            {party?.abbreviation && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                                {party.abbreviation}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Tagged Persons Badges List */}
              {taggedPersonIds.length > 0 && (
                <div className="mt-2.5 p-2.5 bg-white/[0.02] border border-white/10 rounded-xl">
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-[#FFD700]" />
                    Linked Officials in this Order ({taggedPersonIds.length}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {taggedPersonIds.map(pId => {
                      const person = personsMap.get(pId);
                      if (!person) return null;
                      return (
                        <span
                          key={pId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] text-xs font-medium"
                        >
                          <img
                            src={person.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                            alt={person.name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                          <span>{person.name}</span>
                          <button
                            type="button"
                            onClick={() => removeTaggedPerson(pId)}
                            className="hover:text-red-400 p-0.5 rounded transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Release Order Button */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD700] via-[#FFC000] to-[#E6B800] text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#FFD700]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Stamp size={16} />
                {isSubmitting ? 'Releasing Order...' : 'Release Order'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Person Mention Picker Dialog */}
        {isPickerOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPickerOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#121212] border border-[#FFD700]/30 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h4 className="text-sm font-bold gold-text uppercase tracking-wider flex items-center gap-2">
                  <AtSign size={16} /> Mention / Link Official
                </h4>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search by name, party, or seat..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFD700]/50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-white/5">
                {filteredPickerPersons.map((p) => {
                  const party = partiesMap.get(p.partyId);
                  const isAlreadyTagged = taggedPersonIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePickerSelect(p)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={p.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`}
                          alt={p.name}
                          className="w-8 h-8 rounded-full object-cover bg-black/40 border border-white/10"
                        />
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-[#FFD700] transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {party?.name || 'Independent'}
                            {p.constituencyName && ` • ${p.constituencyName}`}
                          </div>
                        </div>
                      </div>
                      {isAlreadyTagged ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] font-medium">
                          Tagged
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 group-hover:bg-[#FFD700]/15 group-hover:text-[#FFD700]">
                          + Link
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
