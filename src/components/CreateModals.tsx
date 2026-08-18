import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Flag, Shield, Landmark, Award, Upload, Plus, Trash2, History, MapPin } from 'lucide-react';
import { db, freezeAssembly } from '../db';
import { EntityType } from '../types';
import { nanoid } from 'nanoid';
import { useLiveQuery } from 'dexie-react-hooks';

interface CreateModalsProps {
  type: EntityType | null;
  isOpen: boolean;
  onClose: () => void;
  editData?: any;
}

export const CreateModals: React.FC<CreateModalsProps> = ({ type, isOpen, onClose, editData }) => {
  const { register, handleSubmit, reset, setValue, control } = useForm();
  
  const { fields: historyFields, append: appendHistory, remove: removeHistory } = useFieldArray({
    control,
    name: "history"
  });

  const { fields: colorFields, append: appendColor, remove: removeColor } = useFieldArray({
    control,
    name: "colors"
  });
  
  // Pre-fill form when editing or with initial values
  React.useEffect(() => {
    if (editData && isOpen) {
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
        } else {
          setValue(key, value);
        }
      });
    } else if (isOpen && !editData && type === EntityType.PARTY && colorFields.length === 0) {
      // Default color for new party
      appendColor({ value: '#D32F2F' });
    } else if (!isOpen) {
      reset();
    }
  }, [editData, isOpen, setValue, reset, type]);

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
  const persons = useLiveQuery(() => db.persons.toArray()) || [];
  const parties = useLiveQuery(() => db.parties.toArray()) || [];
  const alliances = useLiveQuery(() => db.alliances.toArray()) || [];
  const assemblies = useLiveQuery(() => db.assemblies.toArray()) || [];
  const activeAssembly = assemblies.find(a => a.isActive);
  const constituenciesCount = useLiveQuery(() => db.constituencies.count()) || 0;
  const constituencies = useLiveQuery(() => db.constituencies.toArray()) || [];
  const designations = useLiveQuery(() => db.designations.toArray()) || [];
  
  const memberParties = React.useMemo(() => {
    if (!editData || type !== EntityType.ALLIANCE) return [];
    return parties.filter(p => p.allianceId === editData.id);
  }, [parties, editData, type]);

  const personOptions = React.useMemo(() => {
    // Filter out suspended persons, unless they are currently selected/appointed on the edited record
    const filteredPersons = persons.filter(p => {
      if (!p.isSuspended) return true;
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
  }, [persons, editData]);

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

    const filtered = persons.filter(p => mlaIds.has(p.id) && (!p.isSuspended || (editData && editData.leaders && Object.values(editData.leaders).includes(p.id))));
    const displayList = filtered.length > 0 ? filtered : persons.filter(p => !p.isSuspended);

    return (
      <>
        <option value="">Select...</option>
        {[...displayList].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.isSuspended ? " (Suspended)" : ""}</option>
        ))}
      </>
    );
  }, [type, editData, persons, constituencies, personOptions]);

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
          founded: data.founded,
          chairman: data.chairman,
          headquarters: data.headquarters,
          allianceId: data.allianceId || 'independent',
          colors: Array.isArray(data.colors) ? data.colors.map((c: any) => c.value) : [],
          isSuspended: editData?.isSuspended || false,
          updatedAt: now
        };
        isEdit ? await db.parties.update(id, payload) : await db.parties.add(payload);
      } else if (type === EntityType.ALLIANCE) {
        const payload = {
          id,
          name: data.name,
          logoUrl: data.logoUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${data.name}`,
          abbreviation: data.abbreviation,
          leaderId: data.leaderId,
          chairmanId: data.chairmanId,
          founderId: data.founderId,
          leadingPartyId: data.leadingPartyId,
          foundedDate: data.foundedDate,
          colors: [data.color || '#D32F2F'],
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

        const payload = {
          id,
          name: data.name,
          subName: data.subName,
          logoUrl: data.logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${data.name}`,
          termLimits: data.termLimits,
          description: data.description,
          history: Array.isArray(data.history) ? data.history : [],
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

        // Auto-vacate designations if current one is dissolving
        if (isDissolving) {
          await freezeAssembly(id);
          const relatedDesignations = await db.designations.where('assemblyId').equals(id).toArray();
          for (const d of relatedDesignations) {
            if (d.incumbentId !== 'vacant') {
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
            if (con.currentIncumbentId !== 'vacant') {
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
        }
      } else if (type === EntityType.DESIGNATION) {
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

        const payload = {
          id,
          slNo: isEdit ? (data.slNo || editData?.slNo) : (constituenciesCount + 1).toString().padStart(3, '0'),
          name: data.name,
          currentIncumbentId: isEdit ? (editData?.currentIncumbentId || 'vacant') : 'vacant',
          currentAssemblyId: isEdit ? (editData?.currentAssemblyId || activeAssembly?.id) : activeAssembly?.id,
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
        return (
          <>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Full Name</label>
                <input {...register('name')} placeholder="Enter person name..." className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Gender</label>
                <select {...register('gender')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none" required>
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
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Founded Date</label>
              <input {...register('founded')} type="date" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Chairman</label>
              <input {...register('chairman')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Headquarters</label>
              <input {...register('headquarters')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
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
            <div>
               <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Founded Date</label>
               <input {...register('foundedDate')} type="date" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
            </div>
            <div className="sm:col-span-2 grid grid-cols-3 gap-2">
               <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Leader</label>
                  <select {...register('leaderId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                    {personOptions}
                  </select>
               </div>
               <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Chairman</label>
                  <select {...register('chairmanId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                    {personOptions}
                  </select>
               </div>
               <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Founder</label>
                  <select {...register('founderId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                    {personOptions}
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
                <input {...register('termLimits')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
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

             <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                   <h4 className="text-sm font-bold gold-text uppercase tracking-widest flex items-center gap-2">
                      <History size={16} /> Past Terms (History)
                   </h4>
                   <button 
                     type="button" 
                     onClick={() => appendHistory({ term: '', speakerId: '', chiefMinisterId: '', notes: '' })}
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
                          <div className="col-span-2 sm:col-span-1">
                             <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Term / Year</label>
                             <input {...register(`history.${index}.term`)} placeholder="e.g. 2014-2019" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#FFD700]/50" />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                             <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Notes / Outcome</label>
                             <input {...register(`history.${index}.notes`)} placeholder="Reason for dissolution..." className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#FFD700]/50" />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                             <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Speaker</label>
                             <select {...register(`history.${index}.speakerId`)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                                <option value="">Select...</option>
                                {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                             <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Chief Minister</label>
                             <select {...register(`history.${index}.chiefMinisterId`)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                                <option value="">Select...</option>
                                {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                          </div>
                       </div>
                    </div>
                  ))}
                  {historyFields.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl">
                       <p className="text-xs text-gray-600 italic">No past terms added to the archives</p>
                    </div>
                  )}
                </div>
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Ruling Party</label>
                <select {...register('partyControlId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                  <option value="">Select...</option>
                  {parties.filter(p => !p.isSuspended || (editData && editData.partyControlId === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}{p.isSuspended ? " (Suspended)" : ""}</option>)}
                </select>
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

             <div className="pt-4 border-t border-white/10">
                <h4 className="text-sm font-bold gold-text uppercase mb-4 tracking-widest">Leadership Council (Appoint Later or Now)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    'speaker', 'deputySpeaker', 'chiefMinister', 
                    'deputyChiefMinister', 'leaderOfOpposition', 
                    'deputyLeaderOfOpposition', 'chiefSecretary'
                  ].map(role => (
                    <div key={role}>
                      <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">
                        {role.replace(/([A-Z])/g, ' $1')}
                      </label>
                      <select {...register(role)} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                        {assemblySpecificPersonOptions}
                      </select>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        );
      case EntityType.DESIGNATION:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Designation Name</label>
                <input {...register('name')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" required />
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Current Incumbent</label>
                <select {...register('incumbentId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
                  {personOptions}
                </select>
             </div>
             <div>
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Constituency</label>
                <input {...register('constituency')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50" />
             </div>
             <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Legislative Assembly</label>
                <select {...register('assemblyId')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#FFD700]/50 appearance-none">
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
            className="w-full max-w-xl glass-card relative overflow-hidden"
          >
            {/* Header */}
            <div className={`h-2 shadow-lg ${type === EntityType.ALLIANCE ? 'bg-[#FFD700]' : 'bg-[#D32F2F]'}`} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg text-[#FFD700]">
                    <Icon size={24} />
                  </div>
                  <h2 className="text-xl font-bold uppercase tracking-tight">{editData ? 'Update' : 'Create'} {type}</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                  {renderForm()}
                </div>
                <div className="flex items-center justify-end gap-3 mt-4">
                  <button type="button" onClick={onClose} className="px-6 py-2 rounded-xl text-gray-400 hover:text-white transition-colors">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={type === EntityType.CONSTITUENCY && !activeAssembly && !editData}
                    className="px-8 py-2 rounded-xl bg-[#D32F2F] text-white font-bold shadow-lg shadow-[#D32F2F]/20 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  >
                    {editData ? 'Save Changes' : 'Create Entry'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
