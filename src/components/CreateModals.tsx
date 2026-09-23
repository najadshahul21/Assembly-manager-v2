import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, Users, Flag, Shield, Landmark, Award, Upload, 
  Plus, Trash2, History, MapPin, Copy, Sparkles, Check, 
  AlertCircle, Layers, CheckCircle2 
} from 'lucide-react';
import { db, freezeAssembly } from '../db';
import { EntityType, Assembly, Person } from '../types';
import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  computeAssemblyGovernmentComposition, 
  isSpeakerOrDeputySpeakerRole, 
  isMinisterialRole,
  getConstituencyCreationAssembly
} from '../utils/governmentUtils';
import { getOrdinal } from '../data/legislativeHistoryData';
import { SearchableLeaderSelect } from './SearchableLeaderSelect';

interface CreateModalsProps {
  type: EntityType | null;
  isOpen: boolean;
  onClose: () => void;
  editData?: any;
}

interface BulkPersonItem {
  id: string;
  name: string;
  gender: string;
  partyId: string;
  imageUrl: string;
}

const createDefaultBulkPerson = (partyId = 'independent'): BulkPersonItem => ({
  id: nanoid(),
  name: '',
  gender: 'Male',
  partyId,
  imageUrl: ''
});

export const CreateModals: React.FC<CreateModalsProps> = ({ type, isOpen, onClose, editData }) => {
  const { register, handleSubmit, reset, setValue, control, watch } = useForm();
  
  // Bulk Person State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkPersons, setBulkPersons] = useState<BulkPersonItem[]>([
    createDefaultBulkPerson(),
    createDefaultBulkPerson()
  ]);
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  const [bulkPartyToApply, setBulkPartyToApply] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  const { fields: historyFields, append: appendHistory, remove: removeHistory } = useFieldArray({
    control,
    name: "history"
  });

  const { fields: colorFields, append: appendColor, remove: removeColor } = useFieldArray({
    control,
    name: "colors"
  });
  
  const handleImageUpload = (fieldName: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // Compress to JPEG with medium-low quality (0.6) to keep database size extremely small
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              setValue(fieldName, dataUrl);
            } else {
              setValue(fieldName, event.target.result);
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // Data for relations
  const persons = useLiveQuery(async () => {
    const list = await db.persons.toArray();
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }) || [];
  const parties = useLiveQuery(async () => {
    const list = await db.parties.toArray();
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }) || [];
  const alliances = useLiveQuery(async () => {
    const list = await db.alliances.toArray();
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }) || [];
  const assemblies = useLiveQuery(() => db.assemblies.toArray()) || [];
  const activeAssembly = assemblies.find(a => a.isActive);
  const constituenciesCount = useLiveQuery(() => db.constituencies.count()) || 0;
  const constituencies = useLiveQuery(() => db.constituencies.toArray()) || [];
  const designations = useLiveQuery(() => db.designations.toArray()) || [];

  const assemblyGovComposition = React.useMemo(() => {
    if (type !== EntityType.ASSEMBLY) {
      return { government: null, governmentMlaIds: new Set<string>(), allMlaIds: new Set<string>() };
    }
    const targetAsm = editData || { id: 'temp' };
    return computeAssemblyGovernmentComposition(
      targetAsm as Assembly,
      constituencies,
      parties,
      alliances,
      persons
    );
  }, [type, editData, constituencies, parties, alliances, persons]);

  // Pre-fill form when editing or with initial values
  React.useEffect(() => {
    if (editData && isOpen) {
      setIsBulkMode(false);
      Object.entries(editData).forEach(([key, value]) => {
        if (key === 'history' && Array.isArray(value) && type === EntityType.DESIGNATION) {
          const formattedHistory = value.map(h => ({
            ...h,
            date: h.date ? new Date(h.date).toISOString().split('T')[0] : ''
          }));
          setValue('history', formattedHistory);
        } else if (key === 'leaders' && typeof value === 'object') {
          Object.entries(value as object).forEach(([lKey, lValue]) => {
            setValue(lKey, lValue);
          });
        } else if (key === 'colors' && Array.isArray(value)) {
          setValue('colors', value.map(c => typeof c === 'string' ? { value: c } : c));
          setValue('color', value[0]);
        } else if (key === 'localBodies' && Array.isArray(value)) {
          setValue('localBodies', value.join(', '));
        } else {
          setValue(key, value);
        }
      });
    } else if (isOpen && !editData && type === EntityType.PARTY && colorFields.length === 0) {
      // Default color for new party
      appendColor({ value: '#D32F2F' });
    } else if (isOpen && !editData && type === EntityType.PERSON) {
      // Reset bulk list to 2 default rows if empty
      if (bulkPersons.length === 0) {
        setBulkPersons([createDefaultBulkPerson(), createDefaultBulkPerson()]);
      }
    } else if (!isOpen) {
      reset();
      setIsBulkMode(false);
      setBulkErrors({});
      setBulkPersons([createDefaultBulkPerson(), createDefaultBulkPerson()]);
      setBulkPartyToApply('');
    }
  }, [editData, isOpen, setValue, reset, type]);

  // Automatically sync Party Control with Government Alliance
  React.useEffect(() => {
    if (type === EntityType.ASSEMBLY && assemblyGovComposition.government?.id && !editData?.partyControlId) {
      setValue('partyControlId', assemblyGovComposition.government.id);
    }
  }, [type, assemblyGovComposition.government?.id, setValue, editData]);

  // Auto-fill Assembly name with next Sl. No. ordinal
  React.useEffect(() => {
    if (isOpen && !editData && type === EntityType.ASSEMBLY) {
      const nextNum = assemblies.length + 1;
      const ordinal = getOrdinal(nextNum);
      const currentName = watch('name');
      if (!currentName) {
        setValue('name', `${ordinal} Legislative Assembly`);
      }
    }
  }, [isOpen, editData, type, assemblies.length, setValue, watch]);
  
  const memberParties = React.useMemo(() => {
    if (!editData || type !== EntityType.ALLIANCE) return [];
    return parties.filter(p => p.allianceId === editData.id);
  }, [parties, editData, type]);

  const personOptions = React.useMemo(() => {
    // Filter out suspended persons and persons in suspended parties, unless currently appointed on the edited record
    const filteredPersons = persons.filter(p => {
      const pParty = parties.find(pt => pt.id === p.partyId);
      const isPartySuspended = pParty?.isSuspended;
      if (!p.isSuspended && !isPartySuspended) return true;
      if (!editData) return false;
      const isCurrentIncumbent = editData.incumbentId === p.id;
      const isCurrentConIncumbent = editData.currentIncumbentId === p.id;
      const isCurrentLeader = editData.leaders && Object.values(editData.leaders).includes(p.id);
      const isSpeaker = editData.speakerId === p.id;
      const isChiefMinister = editData.chiefMinisterId === p.id;
      return isCurrentIncumbent || isCurrentConIncumbent || isCurrentLeader || isSpeaker || isChiefMinister;
    });

    return (
      <>
        <option value="">Select...</option>
        {[...filteredPersons].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.isSuspended ? " (Suspended)" : ""}</option>
        ))}
      </>
    );
  }, [persons, parties, editData]);

  const assemblySpecificPersonOptions = React.useMemo(() => {
    if (type !== EntityType.ASSEMBLY) return personOptions;
    
    const assemblyId = editData?.id;
    if (!assemblyId) return personOptions;

    // Filter persons who are currently active MLAs of this specific assembly
    const relevantCs = constituencies.filter(c => c.currentAssemblyId === assemblyId);

    const mlaIds = new Set<string>();

    relevantCs.forEach(con => {
      if (con.currentIncumbentId && con.currentIncumbentId !== 'vacant') {
        mlaIds.add(con.currentIncumbentId);
      }
    });

    const filtered = persons.filter(p => {
      if (!mlaIds.has(p.id)) return false;
      const pParty = parties.find(pt => pt.id === p.partyId);
      const isPartySuspended = pParty?.isSuspended;
      const isCurrentLeader = editData?.leaders && Object.values(editData.leaders).includes(p.id);
      return (!p.isSuspended && !isPartySuspended) || isCurrentLeader;
    });

    return (
      <>
        <option value="">Select (Assembly MLA)...</option>
        {filtered.length === 0 ? (
          <option value="" disabled>No elected MLAs in this assembly yet</option>
        ) : (
          [...filtered].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.isSuspended ? " (Suspended)" : ""}</option>
          ))
        )}
      </>
    );
  }, [type, editData, persons, parties, constituencies, personOptions]);

  const governmentMlaPersonOptions = React.useMemo(() => {
    if (type !== EntityType.ASSEMBLY) return personOptions;
    
    const assemblyId = editData?.id;
    if (!assemblyId) return personOptions;

    const govRes = computeAssemblyGovernmentComposition(
      editData as Assembly,
      constituencies,
      parties,
      alliances,
      persons
    );

    const govMlaIds = govRes.governmentMlaIds;
    const filtered = persons.filter(p => {
      if (!govMlaIds.has(p.id)) return false;
      const pParty = parties.find(pt => pt.id === p.partyId);
      const isPartySuspended = pParty?.isSuspended;
      const isCurrentLeader = editData?.leaders && Object.values(editData.leaders).includes(p.id);
      return (!p.isSuspended && !isPartySuspended) || isCurrentLeader;
    });

    return (
      <>
        <option value="">Select (Government MLA)...</option>
        {filtered.length === 0 ? (
          <option value="" disabled>No government MLAs found in this assembly</option>
        ) : (
          [...filtered].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.isSuspended ? " (Suspended)" : ""}</option>
          ))
        )}
      </>
    );
  }, [type, editData, persons, constituencies, parties, alliances, personOptions]);

  const assemblyPersonConstituencyMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const asmId = editData?.id;
    if (!asmId) return map;
    const relevantCs = constituencies.filter(c => c.currentAssemblyId === asmId);
    relevantCs.forEach(c => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        map.set(c.currentIncumbentId, c.name);
      }
    });
    return map;
  }, [editData?.id, constituencies]);

  const designationPersonOptions = React.useMemo(() => {
    if (type !== EntityType.DESIGNATION) return personOptions;
    const watchedName = watch('name') || editData?.name || '';
    const watchedAssemblyId = watch('assemblyId') || editData?.assemblyId;

    const isSpeaker = isSpeakerOrDeputySpeakerRole(watchedName);
    const isMinister = isMinisterialRole(watchedName);

    if (watchedAssemblyId && (isSpeaker || isMinister)) {
      const targetAsm = assemblies.find(a => a.id === watchedAssemblyId);
      const govRes = computeAssemblyGovernmentComposition(
        targetAsm,
        constituencies,
        parties,
        alliances,
        persons
      );

      if (govRes.governmentMlaIds.size > 0) {
        const filtered = persons.filter(
          p => govRes.governmentMlaIds.has(p.id) && (!p.isSuspended || editData?.incumbentId === p.id)
        );
        return (
          <>
            <option value="vacant">Vacant</option>
            {[...filtered].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({parties.find(pt => pt.id === p.partyId)?.abbreviation || 'IND'} - Govt MLA)
              </option>
            ))}
          </>
        );
      } else {
        return (
          <>
            <option value="vacant">Vacant (No Government MLAs available)</option>
          </>
        );
      }
    }

    return personOptions;
  }, [type, watch('name'), watch('assemblyId'), editData, assemblies, constituencies, parties, alliances, persons, personOptions]);

  const allianceMemberPersonOptions = React.useMemo(() => {
    if (type !== EntityType.ALLIANCE) return personOptions;
    
    const allianceId = editData?.id;
    if (!allianceId) {
      return (
        <option value="">No members in alliance yet (Add constituent parties to alliance first)</option>
      );
    }

    const alliancePartyIds = new Set(parties.filter(p => !p.isSuspended && p.allianceId === allianceId).map(p => p.id));
    
    // Only persons whose party belongs to this respective alliance
    const filteredPersons = persons.filter(p => {
      const isMember = alliancePartyIds.has(p.partyId);
      if (!isMember) {
        // Keep current incumbent option if editing so existing assignment doesn't silently drop
        if (editData) {
          const isCurrentLeader = editData.leaderId === p.id;
          const isCurrentChairman = editData.chairmanId === p.id;
          const isCurrentFounder = editData.founderId === p.id;
          if (isCurrentLeader || isCurrentChairman || isCurrentFounder) {
            return !p.isSuspended;
          }
        }
        return false;
      }
      return !p.isSuspended;
    });

    if (filteredPersons.length === 0) {
      return (
        <option value="">No members found in constituent parties</option>
      );
    }

    return (
      <>
        <option value="">Select Alliance Member...</option>
        {[...filteredPersons].sort((a, b) => a.name.localeCompare(b.name)).map(p => {
          const party = parties.find(pt => pt.id === p.partyId);
          return (
            <option key={p.id} value={p.id}>
              {p.name} {party ? `(${party.abbreviation})` : ''}{p.isSuspended ? " (Suspended)" : ""}
            </option>
          );
        })}
      </>
    );
  }, [type, editData, persons, parties, personOptions]);

  // Bulk Person Helper Functions
  const handleAddBulkRow = () => {
    if (bulkPersons.length >= 10) return;
    setBulkPersons(prev => [
      ...prev,
      createDefaultBulkPerson(bulkPartyToApply || 'independent')
    ]);
  };

  const handleQuickAddRows = (count: number) => {
    setBulkPersons(prev => {
      const needed = Math.min(10 - prev.length, count);
      if (needed <= 0) return prev;
      const newItems: BulkPersonItem[] = Array.from({ length: needed }, () =>
        createDefaultBulkPerson(bulkPartyToApply || 'independent')
      );
      return [...prev, ...newItems];
    });
  };

  const handleRemoveBulkRow = (id: string) => {
    if (bulkPersons.length <= 1) return;
    setBulkPersons(prev => prev.filter(p => p.id !== id));
    setBulkErrors(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDuplicateBulkRow = (index: number) => {
    if (bulkPersons.length >= 10) return;
    const target = bulkPersons[index];
    if (!target) return;
    const duplicateItem: BulkPersonItem = {
      id: nanoid(),
      name: target.name ? `${target.name} (Copy)` : '',
      gender: target.gender,
      partyId: target.partyId,
      imageUrl: target.imageUrl
    };
    setBulkPersons(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicateItem);
      return next;
    });
  };

  const handleUpdateBulkField = (id: string, field: keyof BulkPersonItem, value: string) => {
    setBulkPersons(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
    if (field === 'name' && value.trim()) {
      setBulkErrors(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleBulkImageUpload = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
              handleUpdateBulkField(id, 'imageUrl', dataUrl);
            } else {
              handleUpdateBulkField(id, 'imageUrl', event.target.result);
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleApplyPartyToAll = (partyId: string) => {
    setBulkPartyToApply(partyId);
    if (!partyId) return;
    setBulkPersons(prev =>
      prev.map(item => ({ ...item, partyId }))
    );
  };

  const handleBulkSubmit = async () => {
    const errors: Record<string, string> = {};
    bulkPersons.forEach((person, index) => {
      if (!person.name.trim()) {
        errors[person.id] = `Person #${index + 1}: Name is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setBulkErrors(errors);
      return;
    }

    if (bulkPersons.length === 0) {
      alert("Please add at least one person.");
      return;
    }

    setIsSubmittingBulk(true);
    const now = Date.now();
    try {
      const payloads = bulkPersons.map(p => ({
        id: nanoid(),
        name: p.name.trim(),
        gender: p.gender || 'Male',
        imageUrl: p.imageUrl.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name.trim())}`,
        partyId: p.partyId || 'independent',
        designations: [],
        assemblyRoles: {},
        isSuspended: false,
        updatedAt: now
      }));

      await db.persons.bulkAdd(payloads);
      
      setBulkPersons([createDefaultBulkPerson(), createDefaultBulkPerson()]);
      setBulkErrors({});
      setIsBulkMode(false);
      onClose();
    } catch (error: any) {
      console.error('Error saving bulk persons:', error);
      const isQuotaError = error?.name === 'QuotaExceededError' || error?.message?.includes('QuotaExceeded') || String(error).includes('QuotaExceeded');
      if (isQuotaError) {
        alert(
          "Error saving persons: Storage Quota Exceeded.\n\n" +
          "Your browser's local database storage is full. This usually happens if you uploaded large images directly.\n\n" +
          "Auto-compression is enabled for future uploads! For existing data, you can clear some old entities or your browser's site data to free up space."
        );
      } else {
        alert(`Error saving persons:\n${error?.message || error || 'Unknown database error'}`);
      }
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const onSubmit = async (data: any) => {
    const isEdit = !!(editData && editData.id);
    const id = isEdit ? editData.id : nanoid();
    const now = Date.now();

    try {
      if (isEdit && type === EntityType.ASSEMBLY && editData && !editData.isActive) {
        alert("Dissolved assemblies are immutable and cannot be modified.");
        onClose();
        return;
      }

      if (isEdit && (type === EntityType.DESIGNATION || type === EntityType.CONSTITUENCY) && editData) {
        const asmId = type === EntityType.DESIGNATION ? editData.assemblyId : editData.currentAssemblyId;
        if (asmId) {
          const asm = await db.assemblies.get(asmId);
          if (asm && !asm.isActive) {
            alert("This record belongs to a dissolved assembly and cannot be modified.");
            onClose();
            return;
          }
        }
      }
      if (type === EntityType.PERSON) {
        const payload: any = {
          id,
          name: data.name,
          gender: data.gender || '',
          imageUrl: data.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
          partyId: data.partyId || 'independent',
          designations: Array.isArray(editData?.designations) ? editData.designations : [],
          assemblyRoles: (editData?.assemblyRoles && typeof editData.assemblyRoles === 'object') ? editData.assemblyRoles : {},
          isSuspended: editData?.isSuspended || false,
          updatedAt: now
        };
        isEdit ? await db.persons.update(id, payload) : await db.persons.add(payload);
      } else if (type === EntityType.PARTY) {
        const payload = {
          id,
          name: data.name,
          logoUrl: data.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${data.name}`,
          abbreviation: data.abbreviation,
          chairman: data.chairman,
          allianceId: data.allianceId || 'independent',
          colors: Array.isArray(data.colors) ? data.colors.map((c: any) => c.value) : [],
          isSuspended: editData?.isSuspended || false,
          updatedAt: now
        };
        isEdit ? await db.parties.update(id, payload) : await db.parties.add(payload);
      } else if (type === EntityType.ALLIANCE) {
        // Validate leader, chairman, founder are not suspended and do not belong to a suspended party
        const councilRoles: { id?: string; name: string }[] = [
          { id: data.leaderId, name: 'Leader' },
          { id: data.chairmanId, name: 'Chairman' },
          { id: data.founderId, name: 'Founder' }
        ];
        for (const role of councilRoles) {
          if (role.id) {
            const p = persons.find(item => item.id === role.id);
            if (p?.isSuspended) {
              alert(`Cannot appoint suspended person "${p.name}" as Alliance ${role.name}.`);
              return;
            }
            const pParty = parties.find(pt => pt.id === p?.partyId);
            if (pParty?.isSuspended) {
              alert(`Cannot appoint member of suspended party "${pParty.name}" as Alliance ${role.name}.`);
              return;
            }
          }
        }

        const payload = {
          id,
          name: data.name,
          logoUrl: data.logoUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${data.name}`,
          abbreviation: data.abbreviation,
          leaderId: data.leaderId,
          chairmanId: data.chairmanId,
          founderId: data.founderId,
          leadingPartyId: data.leadingPartyId,
          colors: [data.color || '#D32F2F'],
          highCommandIds: editData?.highCommandIds || [],
          updatedAt: now
        };
        isEdit ? await db.alliances.update(id, payload) : await db.alliances.add(payload);
      } else if (type === EntityType.ASSEMBLY) {
        const isActive = data.isActive === undefined ? (isEdit ? editData.isActive : true) : data.isActive;
        
        // If making this assembly active, deactivate all others
        if (isActive) {
          const otherActiveAssemblies = assemblies.filter(a => a.isActive && a.id !== id);
          for (const other of otherActiveAssemblies) {
             // Dissolve other active assemblies
             await db.assemblies.update(other.id, { 
               isActive: false, 
               updatedAt: now,
               // Optionally add to history or notes here
             });
             
             await freezeAssembly(other.id);
             
             // Vacate all designations of those assemblies
             const relatedDesignations = await db.designations.where('assemblyId').equals(other.id).toArray();
             for (const d of relatedDesignations) {
               if (d.incumbentId !== 'vacant') {
                 await db.designations.update(d.id, {
                   incumbentId: 'vacant',
                   history: [...(d.history || []), { personId: d.incumbentId, reason: 'expiry', date: now }],
                   updatedAt: now
                 });
               }
             }
          }
        }

        const isDissolving = isEdit && editData.isActive === true && isActive === false;

        // Enforce Rule 1 & Rule 2: Leadership Council appointments validation
        if (
          data.speaker ||
          data.deputySpeaker ||
          data.chiefMinister ||
          data.deputyChiefMinister ||
          data.leaderOfOpposition ||
          data.deputyLeaderOfOpposition
        ) {
          const targetAsm = editData ? (editData as Assembly) : ({ id, ...data } as Assembly);
          const govRes = computeAssemblyGovernmentComposition(
            targetAsm,
            constituencies,
            parties,
            alliances,
            persons
          );

          // Rule 1: Only MLAs from government composition can be CM, Deputy CM, Speaker, Deputy Speaker
          const rule1Fields: { key: string; name: string }[] = [
            { key: 'chiefMinister', name: 'Chief Minister' },
            { key: 'deputyChiefMinister', name: 'Deputy Chief Minister' },
            { key: 'speaker', name: 'Speaker' },
            { key: 'deputySpeaker', name: 'Deputy Speaker' }
          ];

          for (const f of rule1Fields) {
            const val = data[f.key];
            if (val && val !== 'vacant' && !govRes.governmentMlaIds.has(val)) {
              alert(`Invalid Appointment: Only MLAs from the government composition can be appointed as ${f.name}.`);
              return;
            }
          }

          // Rule 2: Only current members of respective assembly can be appointed into leadership council except Chief Secretary
          const rule2Fields: { key: string; name: string }[] = [
            { key: 'chiefMinister', name: 'Chief Minister' },
            { key: 'deputyChiefMinister', name: 'Deputy Chief Minister' },
            { key: 'speaker', name: 'Speaker' },
            { key: 'deputySpeaker', name: 'Deputy Speaker' },
            { key: 'leaderOfOpposition', name: 'Leader of Opposition' },
            { key: 'deputyLeaderOfOpposition', name: 'Deputy Leader of Opposition' },
          ];

          for (const f of rule2Fields) {
            const val = data[f.key];
            if (val && val !== 'vacant' && !govRes.allMlaIds.has(val)) {
              alert(`Invalid Appointment: Only current members (MLAs) of this respective assembly can be appointed as ${f.name}.`);
              return;
            }
          }

          // Rule 3: No suspended persons or members of suspended parties in leadership council
          const allLeaderFields: { key: string; name: string }[] = [
            { key: 'chiefMinister', name: 'Chief Minister' },
            { key: 'deputyChiefMinister', name: 'Deputy Chief Minister' },
            { key: 'speaker', name: 'Speaker' },
            { key: 'deputySpeaker', name: 'Deputy Speaker' },
            { key: 'leaderOfOpposition', name: 'Leader of Opposition' },
            { key: 'deputyLeaderOfOpposition', name: 'Deputy Leader of Opposition' },
            { key: 'chiefSecretary', name: 'Chief Secretary' }
          ];

          for (const f of allLeaderFields) {
            const val = data[f.key];
            if (val && val !== 'vacant') {
              const p = persons.find(item => item.id === val);
              if (p?.isSuspended) {
                alert(`Invalid Appointment: Politician "${p.name}" is suspended and cannot be appointed as ${f.name}.`);
                return;
              }
              const pParty = parties.find(pt => pt.id === p?.partyId);
              if (pParty?.isSuspended) {
                alert(`Invalid Appointment: Cannot appoint member of suspended party "${pParty.name}" as ${f.name}.`);
                return;
              }
            }
          }
        }

        const assembliesCount = assemblies.length;
        const nextSlNo = isEdit ? (editData.slNo || assembliesCount) : (assembliesCount + 1);

        const payload = {
          id,
          slNo: nextSlNo,
          name: data.name,
          subName: data.subName,
          logoUrl: data.logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${data.name}`,
          termLimits: data.termLimits,
          description: data.description,
          partyControlId: data.partyControlId,
          leaders: {
            speaker: data.speaker,
            deputySpeaker: data.deputySpeaker,
            chiefMinister: data.chiefMinister,
            deputyChiefMinister: data.deputyChiefMinister,
            leaderOfOpposition: data.leaderOfOpposition,
            deputyLeaderOfOpposition: data.deputyLeaderOfOpposition,
            chiefSecretary: data.chiefSecretary
          },
          updatedAt: now,
          isActive: isActive,
          precededById: data.precededById
        };
        isEdit ? await db.assemblies.update(id, payload) : await db.assemblies.add(payload);

        // If new assembly, all master constituencies transition to this new assembly (vacant by default)
        if (!isEdit) {
          const masterConstituencies = await db.constituencies.toArray();
          for (const con of masterConstituencies) {
            await db.constituencies.update(con.id, {
              currentIncumbentId: 'vacant',
              currentAssemblyId: id,
              updatedAt: now
            });
          }
        }

        // Auto-vacate designations and ministers if current one is dissolving
        if (isDissolving) {
          await freezeAssembly(id);

          // Reset assembly leaders to vacant
          await db.assemblies.update(id, {
            leaders: {
              chiefMinister: 'vacant',
              deputyChiefMinister: 'vacant',
              speaker: 'vacant',
              deputySpeaker: 'vacant',
              leaderOfOpposition: 'vacant',
              deputyLeaderOfOpposition: 'vacant',
              chiefSecretary: 'vacant',
            },
            updatedAt: now
          });

          // Vacate designations tied to this assembly or ministerial designations
          const allDesignations = await db.designations.toArray();
          const relatedDesignations = allDesignations.filter(d => d.assemblyId === id || isMinisterialRole(d.name));
          for (const d of relatedDesignations) {
            if (d.incumbentId && d.incumbentId !== 'vacant') {
              await db.designations.update(d.id, {
                incumbentId: 'vacant',
                history: [...(d.history || []), { personId: d.incumbentId, reason: 'expiry', date: now }],
                updatedAt: now
              });
            }
          }
          
          // Also vacate all constituencies belonging to this assembly
          const relatedConstituencies = await db.constituencies.where('currentAssemblyId').equals(id).toArray();
          for (const con of relatedConstituencies) {
            if (con.currentIncumbentId && con.currentIncumbentId !== 'vacant') {
              await db.constituencies.update(con.id, {
                currentIncumbentId: 'vacant',
                history: [...(con.history || []), { 
                  personId: con.currentIncumbentId, 
                  assemblyId: id, 
                  date: now, 
                  reason: 'expiry' 
                }],
                updatedAt: now
              });
            }
          }

          // Also expire roles for all persons in this assembly
          const allPersons = await db.persons.toArray();
          for (const p of allPersons) {
            if (p.assemblyRoles && p.assemblyRoles[id]) {
              const expiringRoles = p.assemblyRoles[id].split(', ');
              const newAssemblyRoles = { ...p.assemblyRoles };
              delete newAssemblyRoles[id];
              const newHistory = [...(p.roleHistory || [])];
              for (const role of expiringRoles) {
                newHistory.push({
                  role,
                  assemblyId: id,
                  date: now,
                  action: 'expiry' as const,
                });
              }
              const isMlaInThisAssembly = relatedConstituencies.some(c => c.currentIncumbentId === p.id);
              await db.persons.update(p.id, {
                assemblyRoles: newAssemblyRoles,
                roleHistory: newHistory,
                updatedAt: now,
                ...(isMlaInThisAssembly ? {
                  constituencyId: undefined,
                  constituencyName: undefined,
                  mlaStatusText: undefined,
                } : {})
              });
            }
          }
        }
      } else if (type === EntityType.DESIGNATION) {
          if (data.incumbentId && data.incumbentId !== 'vacant') {
            const p = persons.find(item => item.id === data.incumbentId);
            if (p?.isSuspended) {
              alert(`Cannot appoint suspended politician "${p.name}" to this designation.`);
              return;
            }
            const pParty = parties.find(pt => pt.id === p?.partyId);
            if (pParty?.isSuspended) {
              alert(`Cannot appoint candidate from suspended party "${pParty.name}" to this designation.`);
              return;
            }
          }

          // Enforce rule: Only MLAs of the government composition can be appointed as Speaker/Deputy Speaker or promoted to ministerial cabinet
          if (data.assemblyId && data.incumbentId && data.incumbentId !== 'vacant') {
            const isSpeaker = isSpeakerOrDeputySpeakerRole(data.name);
            const isMinister = isMinisterialRole(data.name);

            if (isSpeaker || isMinister) {
              const targetAsm = assemblies.find(a => a.id === data.assemblyId);
              const govRes = computeAssemblyGovernmentComposition(
                targetAsm,
                constituencies,
                parties,
                alliances,
                persons
              );

              if (!govRes.governmentMlaIds.has(data.incumbentId)) {
                if (isSpeaker) {
                  alert("Only MLAs of the government composition can be appointed as Speaker or Deputy Speaker.");
                } else {
                  alert("Only MLAs of the government composition can be promoted to the ministerial cabinet.");
                }
                return;
              }
            }
          }

          // No changes needed for designation creation logic as it uses provided assemblyId
          const history = Array.isArray(data.history) ? data.history.map((h: any) => ({
            ...h,
            date: h.date ? new Date(h.date).getTime() : now
          })) : [];

          const payload = {
            id,
            name: data.name,
            incumbentId: data.incumbentId || 'vacant',
            assemblyId: data.assemblyId,
            dateOfSigning: data.dateOfSigning,
            constituency: data.constituency,
            history: history.length > 0 ? history : (data.incumbentId && data.incumbentId !== 'vacant' ? [{ personId: data.incumbentId, reason: 'appointment', date: now }] : []),
            updatedAt: now
          };
          isEdit ? await db.designations.update(id, payload) : await db.designations.add(payload);
          
          if (data.incumbentId && data.incumbentId !== 'vacant') {
            if (!isEdit || data.incumbentId !== editData?.incumbentId) {
              const person = await db.persons.get(data.incumbentId);
              if (person) {
                const currentDesignations = Array.isArray(person.designations) ? person.designations : [];
                if (!currentDesignations.includes(id)) {
                  await db.persons.update(data.incumbentId, {
                    designations: [...currentDesignations, id]
                  });
                }
              }
            }
          }
          if (isEdit && editData?.incumbentId && editData.incumbentId !== data.incumbentId && editData.incumbentId !== 'vacant') {
            const oldPerson = await db.persons.get(editData.incumbentId);
            if (oldPerson && Array.isArray(oldPerson.designations)) {
              await db.persons.update(editData.incumbentId, {
                designations: oldPerson.designations.filter((dId: string) => dId !== id)
              });
            }
          }
      } else if (type === EntityType.CONSTITUENCY) {
        // Enforce: only one assembly can be active, and constituency needs one active assembly
        if (!activeAssembly && !isEdit) {
           throw new Error("A constituency can only be created if an assembly is active.");
        }

        const localBodiesParsed = data.localBodies
          ? (typeof data.localBodies === 'string'
              ? data.localBodies.split(',').map((s: string) => s.trim()).filter(Boolean)
              : data.localBodies)
          : (isEdit ? editData?.localBodies : undefined);

        const payload: any = {
          id,
          slNo: isEdit ? (data.slNo || editData?.slNo) : (constituenciesCount + 1).toString().padStart(3, '0'),
          name: data.name,
          currentIncumbentId: isEdit ? (editData?.currentIncumbentId || 'vacant') : 'vacant',
          currentAssemblyId: isEdit ? (editData?.currentAssemblyId || activeAssembly?.id) : activeAssembly?.id,
          createdInAssemblyId: isEdit
            ? (editData?.createdInAssemblyId || getConstituencyCreationAssembly(editData, assemblies)?.id || editData?.currentAssemblyId || activeAssembly?.id)
            : (activeAssembly?.id || undefined),
          imageUrl: data.imageUrl !== undefined ? data.imageUrl : editData?.imageUrl,
          imageCaption: data.imageCaption !== undefined ? data.imageCaption : editData?.imageCaption,
          country: data.country || editData?.country || 'India',
          state: data.state || editData?.state || 'Kerala',
          history: isEdit ? (editData?.history || []) : [],
          lastElectionResult: isEdit ? editData?.lastElectionResult : undefined,
          updatedAt: now
        };
        isEdit ? await db.constituencies.update(id, payload) : await db.constituencies.add(payload);
      }

      reset();
      onClose();
    } catch (error: any) {
      console.error('Error saving entity:', error);
      const isQuotaError = error?.name === 'QuotaExceededError' || error?.message?.includes('QuotaExceeded') || String(error).includes('QuotaExceeded');
      if (isQuotaError) {
        alert(
          "Error saving entity: Storage Quota Exceeded.\n\n" +
          "Your browser's local database storage is full. This usually happens if you uploaded large images directly.\n\n" +
          "We have now enabled auto-compression for future uploads! For existing data, you can clear some old entities or your browser's site data to free up space."
        );
      } else {
        alert(`Error saving entity:\n${error?.message || error || 'Unknown database error'}`);
      }
    }
  };

  const renderForm = () => {
    switch (type) {
      case EntityType.PERSON:
        if (isBulkMode && !editData) {
          return (
            <div className="space-y-4">
              {/* Bulk Control Bar */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                      Batch Capacity:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 font-mono">
                      {bulkPersons.length} / 10 Persons
                    </span>
                    {bulkPersons.length === 10 && (
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle size={12} /> Limit Reached
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick Fill Add */}
                    {bulkPersons.length < 10 && (
                      <button
                        type="button"
                        onClick={() => handleQuickAddRows(Math.min(3, 10 - bulkPersons.length))}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 border border-white/10 hover:border-white/20 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> +{Math.min(3, 10 - bulkPersons.length)} Rows
                      </button>
                    )}

                    {/* Add Person Button */}
                    <button
                      type="button"
                      onClick={handleAddBulkRow}
                      disabled={bulkPersons.length >= 10}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 rounded-lg text-xs font-bold text-[#FFD700] border border-[#FFD700]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus size={14} /> Add Row
                    </button>
                  </div>
                </div>

                {/* Quick Party Batch Assigner */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <label className="text-[11px] text-gray-400 uppercase font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5">
                      <Layers size={13} className="text-[#FFD700]" /> Batch Party:
                    </label>
                    <select
                      value={bulkPartyToApply}
                      onChange={(e) => handleApplyPartyToAll(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#FFD700]/50 appearance-none text-gray-200"
                    >
                      <option value="">Apply to all rows...</option>
                      <option value="independent">Independent</option>
                      {parties.filter(p => !p.isSuspended).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBulkPersons([createDefaultBulkPerson(bulkPartyToApply || 'independent')]);
                      setBulkErrors({});
                    }}
                    className="text-[11px] text-gray-500 hover:text-red-400 transition-colors uppercase font-bold tracking-wider cursor-pointer"
                  >
                    Reset List
                  </button>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      bulkPersons.length === 10 ? 'bg-[#FFD700]' : 'bg-[#D32F2F]'
                    }`}
                    style={{ width: `${(bulkPersons.length / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Dynamic Person Input List */}
              <div className="space-y-3">
                {bulkPersons.map((person, index) => {
                  const hasError = !!bulkErrors[person.id];
                  const isNameFilled = person.name.trim().length > 0;
                  const avatarUrl = person.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name || `Person${index + 1}`)}`;

                  return (
                    <div
                      key={person.id}
                      className={`p-4 rounded-2xl border transition-all relative group ${
                        hasError
                          ? 'bg-red-500/10 border-red-500/40'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Row Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={avatarUrl}
                              alt="Avatar"
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-xl bg-black/30 border border-white/10 object-cover"
                            />
                            {isNameFilled ? (
                              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-black">
                                <Check size={8} className="text-black stroke-[3]" />
                              </div>
                            ) : (
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-500/80 rounded-full border-2 border-black" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#FFD700] uppercase tracking-wider font-mono">
                                #{index + 1}
                              </span>
                              <span className="text-xs font-bold text-white uppercase tracking-tight">
                                {person.name.trim() || `Person ${index + 1}`}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-500 block uppercase tracking-wider">
                              {parties.find(p => p.id === person.partyId)?.name || (person.partyId === 'independent' ? 'Independent' : 'Unassigned')} • {person.gender || 'Male'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {bulkPersons.length < 10 && (
                            <button
                              type="button"
                              onClick={() => handleDuplicateBulkRow(index)}
                              title="Duplicate row"
                              className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#FFD700] rounded-lg transition-all border border-white/5 cursor-pointer"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveBulkRow(person.id)}
                            disabled={bulkPersons.length <= 1}
                            title="Remove person"
                            className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-all border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Fields Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Full Name */}
                        <div className="sm:col-span-4">
                          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">
                            Full Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={person.name}
                            onChange={(e) => handleUpdateBulkField(person.id, 'name', e.target.value)}
                            placeholder="e.g. John Doe"
                            className={`w-full bg-white/5 border rounded-xl p-2.5 text-xs text-white focus:outline-none ${
                              hasError ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-[#FFD700]/50'
                            }`}
                          />
                          {hasError && (
                            <span className="text-[10px] text-red-400 mt-1 block font-medium">
                              {bulkErrors[person.id]}
                            </span>
                          )}
                        </div>

                        {/* Gender */}
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">
                            Gender
                          </label>
                          <select
                            value={person.gender}
                            onChange={(e) => handleUpdateBulkField(person.id, 'gender', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FFD700]/50 appearance-none"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Non-binary">Non-binary</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
                        </div>

                        {/* Party Affiliation */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">
                            Party Affiliation
                          </label>
                          <select
                            value={person.partyId}
                            onChange={(e) => handleUpdateBulkField(person.id, 'partyId', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FFD700]/50 appearance-none"
                          >
                            <option value="independent">Independent</option>
                            {parties.filter(p => !p.isSuspended).map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Image URL / Upload */}
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">
                            Photo (Optional)
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={person.imageUrl}
                              onChange={(e) => handleUpdateBulkField(person.id, 'imageUrl', e.target.value)}
                              placeholder="Image URL..."
                              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FFD700]/50"
                            />
                            <button
                              type="button"
                              onClick={() => handleBulkImageUpload(person.id)}
                              title="Upload Image"
                              className="p-2.5 bg-white/5 border border-white/10 hover:border-[#FFD700]/40 rounded-xl text-gray-400 hover:text-[#FFD700] transition-all flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Upload size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Add Button */}
              {bulkPersons.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddBulkRow}
                  className="w-full py-3 border-2 border-dashed border-white/10 hover:border-[#FFD700]/40 rounded-2xl text-xs font-bold text-gray-400 hover:text-[#FFD700] flex items-center justify-center gap-2 transition-all group cursor-pointer"
                >
                  <Plus size={16} className="group-hover:scale-110 transition-transform" />
                  <span>Add Person #{bulkPersons.length + 1} (Up to 10)</span>
                </button>
              )}
            </div>
          );
        }

        return (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Full Name</label>
                <input {...register('name')} placeholder="Enter person name..." className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required={!isBulkMode} />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Gender</label>
                <select {...register('gender')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none" required={!isBulkMode}>
                  <option value="">Select Gender...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Party Affiliation</label>
                <select {...register('partyId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                  <option value="independent">Independent</option>
                  {parties.filter(p => !p.isSuspended || (editData && editData.partyId === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}{p.isSuspended ? " (Suspended)" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Image URL (Optional)</label>
                <div className="flex gap-2">
                   <input {...register('imageUrl')} placeholder="External image link..." className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
                   <button 
                     type="button" 
                     onClick={() => handleImageUpload('imageUrl')}
                     className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-[#FFD700] hover:border-[#FFD700]/30 transition-all"
                   >
                     <Upload size={20}/>
                   </button>
                </div>
              </div>
            </div>
          </>
        );
      case EntityType.PARTY:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Party Name</label>
              <input {...register('name')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Abbreviation</label>
              <input {...register('abbreviation')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Chairman</label>
              <input {...register('chairman')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Party Logo URL (Optional)</label>
              <div className="flex gap-2">
                <input {...register('logoUrl')} placeholder="External image link..." className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
                <button 
                  type="button" 
                  onClick={() => handleImageUpload('logoUrl')}
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-[#FFD700] hover:border-[#FFD700]/30 transition-all"
                >
                  <Upload size={20}/>
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Alliance</label>
               <select {...register('allianceId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                  <option value="independent">None (Independent)</option>
                  {alliances.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>
            <div className="sm:col-span-2 pt-4 border-t border-white/10">
               <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-gray-400 uppercase font-bold tracking-widest block">Party Colors</label>
                  <button 
                    type="button" 
                    onClick={() => appendColor({ value: '#666666' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-[#FFD700] border border-white/10 transition-all"
                  >
                    <Plus size={14} /> Add Color
                  </button>
               </div>
               <div className="flex flex-wrap gap-3">
                  {colorFields.map((field, index) => (
                    <div key={field.id} className="relative group p-2 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-2">
                      <input 
                        type="color" 
                        {...register(`colors.${index}.value`)}
                        className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer p-0 overflow-hidden" 
                      />
                      <button 
                        type="button" 
                        onClick={() => removeColor(index)}
                        className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-md transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {colorFields.length === 0 && (
                     <div className="w-full py-4 text-center border border-dashed border-white/5 rounded-xl">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">No colors selected</p>
                     </div>
                  )}
               </div>
            </div>
          </div>
        );
      case EntityType.ALLIANCE:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Alliance Name</label>
              <input {...register('name')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Abbreviation</label>
              <input {...register('abbreviation')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required />
            </div>
            <div className="sm:col-span-2 grid grid-cols-3 gap-2">
               <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Leader</label>
                  <select {...register('leaderId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                    {allianceMemberPersonOptions}
                  </select>
               </div>
               <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Chairman</label>
                  <select {...register('chairmanId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                    {allianceMemberPersonOptions}
                  </select>
               </div>
               <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Founder</label>
                  <select {...register('founderId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                    {allianceMemberPersonOptions}
                  </select>
               </div>
            </div>
            <div className="sm:col-span-2">
               <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Leading Party</label>
               <select {...register('leadingPartyId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                  <option value="">Select Member Party...</option>
                  {memberParties.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.abbreviation})</option>
                  ))}
                </select>
                {memberParties.length === 0 && editData && (
                  <p className="text-[10px] text-gray-500 mt-1 italic uppercase tracking-wider">No parties have joined this alliance yet.</p>
                )}
            </div>
            <div>
               <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Alliance Color</label>
               <input {...register('color')} type="color" className="w-full h-12 bg-white/5 border border-white/10 rounded-xl p-1 focus:outline-none focus:border-[#FFD700]/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Alliance Logo URL (Optional)</label>
              <div className="flex gap-2">
                 <input {...register('logoUrl')} placeholder="External image link..." className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
                 <button 
                   type="button" 
                   onClick={() => handleImageUpload('logoUrl')}
                   className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-[#FFD700] hover:border-[#FFD700]/30 transition-all"
                 >
                   <Upload size={20}/>
                 </button>
              </div>
            </div>
          </div>
        );
      case EntityType.ASSEMBLY:
        return (
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Assembly Name</label>
                  <input {...register('name')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required />
                </div>
                <div>
                   <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Sub Name</label>
                   <input {...register('subName')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
                </div>
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Term Limits</label>
                <input {...register('termLimits')} placeholder="e.g. 5 years" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
             </div>

             <div>
                <label className="flex items-center gap-3 cursor-pointer group p-3 bg-white/5 border border-white/10 rounded-xl hover:border-[#FFD700]/30 transition-all">
                  <input {...register('isActive')} type="checkbox" className="w-5 h-5 accent-[#FFD700]" defaultChecked={true} />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">Currently Active</span>
                    <span className="text-[10px] text-gray-500">Uncheck to mark as dissolved (ends all terms)</span>
                  </div>
                </label>
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Preceded By (Previous Assembly)</label>
                <select {...register('precededById')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                   <option value="">None / Initial Assembly</option>
                   {assemblies
                     .filter(a => !editData || a.id !== editData.id)
                     .map(a => (
                       <option key={a.id} value={a.id}>{a.name}</option>
                     ))
                   }
                </select>
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">General Description</label>
                <textarea {...register('description')} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
             </div>



             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Party Control</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white flex items-center justify-between">
                  <span className="font-bold">
                   {alliances.find(a => a.id === watch('partyControlId'))?.name || 
                    parties.find(p => p.id === watch('partyControlId'))?.name || 
                    assemblyGovComposition.government?.name || 
                    "None / Minority"}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black bg-white/5 px-2 py-1 rounded border border-white/5">
                   Auto-selected from Composition
                  </span>
                </div>
                <input type="hidden" {...register('partyControlId')} />
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Assembly Logo URL (Optional)</label>
                <div className="flex gap-2">
                  <input {...register('logoUrl')} placeholder="External image link..." className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
                  <button 
                    type="button" 
                    onClick={() => handleImageUpload('logoUrl')}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-[#FFD700] hover:border-[#FFD700]/30 transition-all"
                  >
                    <Upload size={20}/>
                  </button>
                </div>
             </div>

              <div className="pt-4 border-t border-white/10 space-y-4">
                <div>
                  <h4 className="text-sm font-bold gold-text uppercase tracking-widest">Leadership Council Appointments</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Organized appointment slots with candidate search and eligibility verification.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      key: 'chiefMinister',
                      title: 'Chief Minister',
                      isGovMlaOnly: true,
                      isAssemblyMemberOnly: true,
                      badgeText: '',
                      badgeType: 'gold' as const,
                    },
                    {
                      key: 'deputyChiefMinister',
                      title: 'Deputy Chief Minister',
                      isGovMlaOnly: true,
                      isAssemblyMemberOnly: true,
                      badgeText: '',
                      badgeType: 'gold' as const,
                    },
                    {
                      key: 'speaker',
                      title: 'Speaker of the House',
                      isGovMlaOnly: true,
                      isAssemblyMemberOnly: true,
                      badgeText: '',
                      badgeType: 'amber' as const,
                    },
                    {
                      key: 'deputySpeaker',
                      title: 'Deputy Speaker',
                      isGovMlaOnly: true,
                      isAssemblyMemberOnly: true,
                      badgeText: '',
                      badgeType: 'amber' as const,
                    },
                    {
                      key: 'leaderOfOpposition',
                      title: 'Leader of Opposition',
                      isGovMlaOnly: false,
                      isAssemblyMemberOnly: true,
                      badgeText: '',
                      badgeType: 'silver' as const,
                    },
                    {
                      key: 'deputyLeaderOfOpposition',
                      title: 'Deputy Leader of Opposition',
                      isGovMlaOnly: false,
                      isAssemblyMemberOnly: true,
                      badgeText: '',
                      badgeType: 'silver' as const,
                    },
                    {
                      key: 'chiefSecretary',
                      title: 'Chief Secretary',
                      isGovMlaOnly: false,
                      isAssemblyMemberOnly: false,
                      badgeText: '',
                      badgeType: 'blue' as const,
                    },
                  ].map((role) => {
                    let eligiblePool: Person[] = [];
                    if (role.isGovMlaOnly) {
                      eligiblePool = persons.filter(
                        p => assemblyGovComposition.governmentMlaIds.has(p.id) && !p.isSuspended
                      );
                    } else if (role.isAssemblyMemberOnly) {
                      eligiblePool = persons.filter(
                        p => assemblyGovComposition.allMlaIds.has(p.id) && !p.isSuspended
                      );
                    } else {
                      eligiblePool = persons.filter(p => !p.isSuspended);
                    }

                    // Keep current selection visible in dropdown
                    const currentVal = watch(role.key);
                    if (currentVal && currentVal !== 'vacant') {
                      const cur = persons.find(p => p.id === currentVal);
                      if (cur && !eligiblePool.some(p => p.id === cur.id)) {
                        eligiblePool = [cur, ...eligiblePool];
                      }
                    }

                    return (
                      <SearchableLeaderSelect
                        key={role.key}
                        roleKey={role.key}
                        roleTitle={role.title}
                        isGovMlaOnly={role.isGovMlaOnly}
                        isAssemblyMemberOnly={role.isAssemblyMemberOnly}
                        badgeText={role.badgeText}
                        badgeType={role.badgeType}
                        value={watch(role.key) || ''}
                        onChange={(newVal) => setValue(role.key, newVal, { shouldDirty: true })}
                        eligiblePersons={eligiblePool}
                        allPersons={persons}
                        parties={parties}
                        alliances={alliances}
                        personConstituencyMap={assemblyPersonConstituencyMap}
                        governmentMlaIds={assemblyGovComposition.governmentMlaIds}
                        allMlaIds={assemblyGovComposition.allMlaIds}
                        currentLeadersMap={{
                          speaker: watch('speaker'),
                          deputySpeaker: watch('deputySpeaker'),
                          chiefMinister: watch('chiefMinister'),
                          deputyChiefMinister: watch('deputyChiefMinister'),
                          leaderOfOpposition: watch('leaderOfOpposition'),
                          deputyLeaderOfOpposition: watch('deputyLeaderOfOpposition'),
                          chiefSecretary: watch('chiefSecretary'),
                        }}
                      />
                    );
                  })}
                </div>
              </div>
          </div>
        );
      case EntityType.DESIGNATION:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Designation Name</label>
                <input {...register('name')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required disabled={editData?.id === 'governor'} />
             </div>
             <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Current Incumbent</label>
                </div>
                <select {...register('incumbentId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                  {designationPersonOptions}
                </select>
             </div>
             {editData?.id !== 'governor' && (
               <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Constituency</label>
                  <input {...register('constituency')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
               </div>
             )}
             <div className={editData?.id === 'governor' ? "sm:col-span-2" : "sm:col-span-2"}>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Legislative Assembly</label>
                <select {...register('assemblyId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none" disabled={editData?.id === 'governor'}>
                  <option value="">None / Specific Board</option>
                  {assemblies.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.isActive === false ? '(DISSOLVED)' : ''}
                    </option>
                  ))}
                </select>
             </div>
             <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Date of Signing</label>
                <input {...register('dateOfSigning')} type="date" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
             </div>

             <div className="sm:col-span-2 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                   <h4 className="text-sm font-bold gold-text uppercase tracking-widest flex items-center gap-2">
                      <History size={16} /> Service History (Incumbents)
                   </h4>
                   <button 
                     type="button" 
                     onClick={() => appendHistory({ personId: '', reason: 'appointment', date: new Date().toISOString().split('T')[0] })}
                     className="p-2 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 rounded-lg text-[#FFD700] transition-all"
                   >
                     <Plus size={16} />
                   </button>
                </div>
                
                <div className="space-y-4">
                  {historyFields.map((field, index) => (
                    <div key={field.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl relative group">
                       <button 
                         type="button" 
                         onClick={() => removeHistory(index)}
                         className="absolute -top-2 -right-2 p-1.5 bg-red-500/20 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-red-500/10"
                       >
                         <Trash2 size={12} />
                       </button>
                       <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="col-span-2">
                             <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Incumbent</label>
                             <select {...register(`history.${index}.personId`)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                                <option value="">Select Legislator...</option>
                                {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Reason</label>
                             <select {...register(`history.${index}.reason`)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                                <option value="appointment">Appointment</option>
                                <option value="resignation">Resignation</option>
                                <option value="expiry">Term Expiry</option>
                             </select>
                          </div>
                          <div>
                             <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Effective Date</label>
                             <input 
                               type="date" 
                               {...register(`history.${index}.date`)} 
                               className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#FFD700]/50" 
                             />
                          </div>
                       </div>
                    </div>
                  ))}
                  {historyFields.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl">
                       <p className="text-xs text-gray-600 italic">No historical records manually added</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        );
       case EntityType.CONSTITUENCY:
        return (
          <div className="space-y-4">
             {!activeAssembly && (
               <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-4">
                  <p className="text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <History size={14} /> Restriction Active
                  </p>
                  <p className="text-[10px] text-red-500/70 mt-1 uppercase tracking-tight">
                    A constituency can only be created if an assembly is active at the time of its creation.
                  </p>
               </div>
             )}
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Serial Number (Auto)</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-gray-400 font-mono">
                  {editData ? editData.slNo : (constituenciesCount + 1).toString().padStart(3, '0')}
                </div>
                <input type="hidden" {...register('slNo')} />
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Constituency Name</label>
                <input {...register('name')} placeholder="Enter constituency name..." className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required disabled={!activeAssembly && !editData} />
             </div>

             <p className="text-[10px] text-gray-500 mt-2 px-1 italic uppercase tracking-widest font-black">
                {activeAssembly ? `Linked to ${activeAssembly.name}` : "Constituencies persist across all future assemblies."}
             </p>
          </div>
        );
      default:
        return null;
    }
  };

  const entityIcons = {
    [EntityType.PERSON]: User,
    [EntityType.PARTY]: Flag,
    [EntityType.ALLIANCE]: Shield,
    [EntityType.ASSEMBLY]: Landmark,
    [EntityType.DESIGNATION]: Award,
    [EntityType.CONSTITUENCY]: MapPin,
  };

  const Icon = type ? entityIcons[type] : User;

  const handleFormSubmit = (e: React.FormEvent) => {
    if (type === EntityType.PERSON && isBulkMode && !editData) {
      e.preventDefault();
      handleBulkSubmit();
    } else {
      handleSubmit(onSubmit)(e);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="create-modal-wrapper" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            key="create-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            key="create-modal-content"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`w-full ${type === EntityType.PERSON && isBulkMode && !editData ? 'max-w-4xl' : 'max-w-xl'} glass-card relative overflow-hidden transition-all duration-300`}
          >
            {/* Header */}
            <div className={`h-2 shadow-lg ${type === EntityType.ALLIANCE ? 'bg-[#FFD700]' : 'bg-[#D32F2F]'}`} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg text-[#FFD700]">
                    {type === EntityType.PERSON && isBulkMode && !editData ? <Users size={24} /> : <Icon size={24} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-tight">
                      {editData ? 'Update' : (type === EntityType.PERSON && isBulkMode ? 'Bulk Create' : 'Create')} {type}
                    </h2>
                    {type === EntityType.PERSON && isBulkMode && !editData && (
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        Add up to 10 persons simultaneously
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-500 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              {/* Single / Bulk Mode Switcher for Person */}
              {type === EntityType.PERSON && !editData && (
                <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl mb-5">
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      !isBulkMode
                        ? 'bg-[#D32F2F] text-white shadow-lg shadow-[#D32F2F]/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <User size={15} />
                    <span>Single Entry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isBulkMode
                        ? 'bg-[#FFD700] text-black font-black shadow-lg shadow-[#FFD700]/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Users size={15} />
                    <span>Bulk Entry Mode</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight font-mono ${
                      isBulkMode ? 'bg-black/20 text-black' : 'bg-[#FFD700]/20 text-[#FFD700]'
                    }`}>
                      Max 10
                    </span>
                  </button>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                  {renderForm()}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div>
                    {type === EntityType.PERSON && isBulkMode && !editData && (
                      <span className="text-xs text-gray-400 font-medium">
                        <strong className="text-white">{bulkPersons.length}</strong> of 10 persons ready
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-2 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer">
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={(type === EntityType.CONSTITUENCY && !activeAssembly && !editData) || (type === EntityType.PERSON && isBulkMode && isSubmittingBulk)}
                      className={`px-8 py-2.5 rounded-xl font-bold shadow-lg transition-transform flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed ${
                        type === EntityType.PERSON && isBulkMode && !editData
                          ? 'bg-[#FFD700] text-black shadow-[#FFD700]/20 hover:scale-[1.02]'
                          : 'bg-[#D32F2F] text-white shadow-[#D32F2F]/20 hover:scale-[1.02]'
                      }`}
                    >
                      {type === EntityType.PERSON && isBulkMode && !editData ? (
                        <>
                          <Users size={18} />
                          <span>{isSubmittingBulk ? 'Saving...' : `Add ${bulkPersons.length} Persons`}</span>
                        </>
                      ) : (
                        <span>{editData ? 'Save Changes' : 'Create Entry'}</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
