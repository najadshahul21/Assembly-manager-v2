import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDbLookup } from '../context/DbLookupContext';
import { Person, Assembly, Constituency, Designation } from '../types';
import { formatAppDate, getSystemTimestamp } from '../utils/dateUtils';
import { useSystemDate } from '../context/SystemDateContext';
import { getAssemblyLeaders } from '../utils/governmentUtils';

interface LegislativeRolesHistoryWidgetProps {
  person: Person;
  className?: string;
}

export interface LegislativeRoleCardData {
  id: string;
  roleType:
    | 'mla'
    | 'designation'
    | 'leadership'
    | 'speaker'
    | 'deputy_speaker'
    | 'minister'
    | 'deputy_chief_minister'
    | 'chief_secretary';
  roleTitle: string;
  respectiveAssemblyName?: string;
  assemblyLink?: string;
  isActive: boolean;
  assumedDate?: string;
  vacatedDate?: string;
  officeDatesFormatted?: string;
  governor?: { name: string; id?: string } | null;
  chiefMinister?: { name: string; id?: string } | null;
  speaker?: { name: string; id?: string } | null;
  precededBy?: { name: string; id?: string } | null;
  succeededBy?: { name: string; id?: string } | null;
  constituency?: { name: string; id?: string } | null;
  appointedBy?: string | null;
  orderPriority: number;
}

/**
 * Format date cleanly as "DD Month YYYY" (e.g. "13 May 2001")
 */
const formatOfficeDisplayDate = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    // If already in "DD Month YYYY" format like "13 May 2001"
    if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const appDate = formatAppDate(dateVal);
  // Convert "DD/MM/YYYY" or "DD MMM YYYY" to clean format if needed
  // formatAppDate returns "DD MMM YYYY" (e.g. "17 Oct 2026")
  return appDate;
};

/**
 * Clean assembly name for display in header
 */
const getCleanAssemblyName = (rawName?: string): string => {
  if (!rawName) return 'Legislative Assembly';
  let clean = rawName.trim();
  if (!clean.toLowerCase().includes('assembly')) {
    clean = `${clean} Assembly`;
  }
  return clean;
};

/**
 * Two-tone title header matching the reference design
 */
const renderRoleTitleHeader = (card: LegislativeRoleCardData) => {
  const cleanAsm = getCleanAssemblyName(card.respectiveAssemblyName);

  if (card.roleType === 'mla') {
    const cleanAsmName = cleanAsm.replace(/^Member of (the )?/i, '').trim();

    return (
      <div className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-[#7B96D4] font-bold">Member </span>
        <span className="text-white font-bold">of the </span>
        <span className="text-[#7B96D4] font-bold">{cleanAsmName}</span>
      </div>
    );
  }

  if (card.roleType === 'speaker') {
    const cleanAsmName = cleanAsm.replace(/^Speaker of (the )?/i, '').trim();

    return (
      <div className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-[#7B96D4] font-bold">Speaker </span>
        <span className="text-white font-bold">of the </span>
        <span className="text-[#7B96D4] font-bold">{cleanAsmName}</span>
      </div>
    );
  }

  if (card.roleType === 'deputy_speaker') {
    const cleanAsmName = cleanAsm.replace(/^Deputy Speaker of (the )?/i, '').trim();

    return (
      <div className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-[#7B96D4] font-bold">Deputy Speaker </span>
        <span className="text-white font-bold">of the </span>
        <span className="text-[#7B96D4] font-bold">{cleanAsmName}</span>
      </div>
    );
  }

  if (card.roleType === 'deputy_chief_minister') {
    const cleanAsmName = cleanAsm.replace(/^Deputy Chief Minister of (the )?/i, '').trim();

    return (
      <div className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-[#7B96D4] font-bold">Deputy Chief Minister </span>
        <span className="text-white font-bold">of the </span>
        <span className="text-[#7B96D4] font-bold">{cleanAsmName}</span>
      </div>
    );
  }

  if (card.roleType === 'chief_secretary') {
    const ofMatch = card.roleTitle.match(/^(Chief Secretary)\s+of\s+(.*)$/i);
    const region = ofMatch ? ofMatch[2] : (card.respectiveAssemblyName ? card.respectiveAssemblyName.replace(/^(the\s+)?/i, '') : '');

    return (
      <div className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-[#7B96D4] font-bold">Chief Secretary </span>
        {region ? (
          <>
            <span className="text-white font-bold">of </span>
            <span className="text-[#7B96D4] font-bold">{region}</span>
          </>
        ) : null}
      </div>
    );
  }

  if (card.roleType === 'minister') {
    let portfolio = card.roleTitle
      .replace(/^(hon'?ble\s+)?minister\s+(for|of)\s+/i, '')
      .replace(/^(former\s+)?/i, '')
      .replace(/\s+minister$/i, '')
      .trim();
    if (!portfolio) portfolio = card.roleTitle;

    return (
      <div className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-[#7B96D4] font-bold">Minister </span>
        <span className="text-white font-bold">for </span>
        <span className="text-[#7B96D4] font-bold">{portfolio}</span>
      </div>
    );
  }

  const ofMatch = card.roleTitle.match(/^(.*?)\s+(of(?: the)?)\s+(.*)$/i);
  if (ofMatch) {
    return (
      <div className="font-bold text-sm sm:text-base leading-snug">
        <span className="text-[#7B96D4] font-bold">{ofMatch[1]} </span>
        <span className="text-white font-bold">{ofMatch[2]} </span>
        <span className="text-[#7B96D4] font-bold">{ofMatch[3]}</span>
      </div>
    );
  }

  return (
    <div className="font-bold text-sm sm:text-base leading-snug text-[#7B96D4]">
      {card.roleTitle}
    </div>
  );
};

export const LegislativeRolesHistoryWidget: React.FC<LegislativeRolesHistoryWidgetProps> = ({
  person,
  className = ''
}) => {
  const navigate = useNavigate();
  const { systemDate } = useSystemDate();

  const { assemblies: allAssemblies, constituencies: allConstituencies, persons: allPersons, designations: allDesignations } = useDbLookup();

  const roleCards = useMemo((): LegislativeRoleCardData[] => {
    if (!person || !person.id || !allAssemblies || !allConstituencies || !allPersons || !allDesignations) return [];

    const personsMap = new Map<string, Person>();
    allPersons.forEach((p) => personsMap.set(p.id, p));

    const assembliesMap = new Map<string, Assembly>();
    allAssemblies.forEach((a) => assembliesMap.set(a.id, a));

    const activeAssembly = allAssemblies.find((a) => a.isActive !== false) || allAssemblies[0];
    const activeAsmName = activeAssembly?.name || 'Legislative Assembly';

    const extractStateFromAssembly = (asm?: Assembly | null): string => {
      if (!asm) return '';
      if ((asm as any).state) return (asm as any).state;
      const match = asm.name?.match(/(?:(?:\d+(?:st|nd|rd|th)\s+)?)(.*?)\s+(?:Legislative\s+Assembly|Assembly|Vidhan\s+Sabha)/i);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
      return '';
    };

    const activeStateName = extractStateFromAssembly(activeAssembly);
    const activeStateSuffix = activeStateName ? ` of ${activeStateName}` : '';

    const personRoleRaw = person.role || '';
    const personRoleLower = personRoleRaw.toLowerCase();

    const resolveGovernor = (asm?: Assembly): { name: string; id?: string } | null => {
      const govDesig = allDesignations.find(
        (d) => d.id === 'governor' || d.name?.toLowerCase().includes('governor')
      );
      if (!govDesig) return null;

      // If assembly specified, try history for that assembly first
      if (asm) {
        if (Array.isArray(govDesig.history)) {
          const hEntry = govDesig.history.find(h => (h as any).assemblyId === asm.id);
          if (hEntry?.personId && hEntry.personId !== 'vacant') {
            const p = personsMap.get(hEntry.personId);
            if (p) return { name: p.name, id: p.id };
          }
        }
        if (asm.isActive && govDesig.incumbentId && govDesig.incumbentId !== 'vacant') {
          const p = personsMap.get(govDesig.incumbentId);
          if (p) return { name: p.name, id: p.id };
        }
      }

      // Fallback
      if (govDesig.incumbentId && govDesig.incumbentId !== 'vacant') {
        const govP = personsMap.get(govDesig.incumbentId);
        if (govP) return { name: govP.name, id: govP.id };
      }
      return null;
    };

    const resolveChiefMinister = (asm?: Assembly): { name: string; id?: string } | null => {
      const targetAsm = asm || activeAssembly;
      if (!targetAsm) return null;
      const leaders = getAssemblyLeaders(targetAsm, allDesignations, allPersons);
      if (leaders?.chiefMinister && leaders.chiefMinister !== 'vacant') {
        const cm = personsMap.get(leaders.chiefMinister);
        if (cm) return { name: cm.name, id: cm.id };
      }
      return null;
    };

    const resolveSpeakerForDeputy = (asm?: Assembly): { name: string; id?: string } | null => {
      const targetAsm = asm || activeAssembly;
      if (!targetAsm) return null;
      const leaders = getAssemblyLeaders(targetAsm, allDesignations, allPersons);
      if (leaders?.speaker && leaders.speaker !== 'vacant') {
        const spk = personsMap.get(leaders.speaker);
        if (spk) return { name: spk.name, id: spk.id };
      }
      return null;
    };

    const cards: LegislativeRoleCardData[] = [];

    // --- SPEAKER ---
    const isCurrentSpeaker = activeAssembly?.leaders?.speaker === person.id || personRoleLower === 'speaker';
    if (isCurrentSpeaker) {
      const gov = resolveGovernor(activeAssembly);
      const speakerHistory = (person.roleHistory || []).filter(h => h.role.toLowerCase().includes('speaker') && h.action === 'promotion');
      
      let assumedDate = 'Assumed';
      if (speakerHistory.length > 0) {
        assumedDate = formatOfficeDisplayDate(Math.max(...speakerHistory.map(h => h.date)));
      } else if (activeAssembly?.updatedAt) {
        assumedDate = formatOfficeDisplayDate(activeAssembly.updatedAt);
      }

      cards.push({
        id: `speaker_active_${person.id}`,
        roleType: 'speaker',
        roleTitle: `Speaker of the ${activeAsmName}`,
        respectiveAssemblyName: activeAsmName,
        assemblyLink: activeAssembly ? `/assembly/${activeAssembly.id}` : undefined,
        isActive: true,
        assumedDate,
        governor: gov,
        chiefMinister: resolveChiefMinister(activeAssembly),
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 1
      });
    }

    // --- DEPUTY SPEAKER ---
    const isCurrentDeputySpeaker = activeAssembly?.leaders?.deputySpeaker === person.id || personRoleLower === 'deputy speaker';
    if (isCurrentDeputySpeaker) {
      const gov = resolveGovernor(activeAssembly);
      const currentSpeaker = resolveSpeakerForDeputy(activeAssembly);
      const dspkHistory = (person.roleHistory || []).filter(h => h.role.toLowerCase().includes('deputy speaker') && h.action === 'promotion');
      
      let assumedDate = 'Assumed';
      if (dspkHistory.length > 0) {
        assumedDate = formatOfficeDisplayDate(Math.max(...dspkHistory.map(h => h.date)));
      } else if (activeAssembly?.updatedAt) {
        assumedDate = formatOfficeDisplayDate(activeAssembly.updatedAt);
      }

      cards.push({
        id: `deputy_speaker_active_${person.id}`,
        roleType: 'deputy_speaker',
        roleTitle: `Deputy Speaker of the ${activeAsmName}`,
        respectiveAssemblyName: activeAsmName,
        assemblyLink: activeAssembly ? `/assembly/${activeAssembly.id}` : undefined,
        isActive: true,
        assumedDate,
        governor: gov,
        chiefMinister: resolveChiefMinister(activeAssembly),
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 2
      });
    }

    // --- DEPUTY CHIEF MINISTER ---
    const isCurrentDeputyCM = activeAssembly?.leaders?.deputyChiefMinister === person.id || personRoleLower.includes('deputy chief minister');
    if (isCurrentDeputyCM) {
      const gov = resolveGovernor(activeAssembly);
      const cm = resolveChiefMinister(activeAssembly);
      const dcmHistory = (person.roleHistory || []).filter(h => h.role.toLowerCase().includes('deputy chief minister') && h.action === 'promotion');
      
      let assumedDate = 'Assumed';
      if (dcmHistory.length > 0) {
        assumedDate = formatOfficeDisplayDate(Math.max(...dcmHistory.map(h => h.date)));
      } else if (activeAssembly?.updatedAt) {
        assumedDate = formatOfficeDisplayDate(activeAssembly.updatedAt);
      }

      cards.push({
        id: `deputy_cm_active_${person.id}`,
        roleType: 'deputy_chief_minister',
        roleTitle: `Deputy Chief Minister of the ${activeAsmName}`,
        respectiveAssemblyName: activeAsmName,
        assemblyLink: activeAssembly ? `/assembly/${activeAssembly.id}` : undefined,
        isActive: true,
        assumedDate,
        governor: gov,
        chiefMinister: cm,
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 2.5
      });
    }

    // --- CHIEF SECRETARY ---
    const isCurrentChiefSecretary = activeAssembly?.leaders?.chiefSecretary === person.id || personRoleLower.includes('chief secretary');
    if (isCurrentChiefSecretary) {
      const gov = resolveGovernor(activeAssembly);
      const cm = resolveChiefMinister(activeAssembly);
      cards.push({
        id: `chief_secretary_active_${person.id}`,
        roleType: 'chief_secretary',
        roleTitle: `Chief Secretary${activeStateSuffix}`,
        respectiveAssemblyName: activeAsmName,
        isActive: true,
        assumedDate: person.updatedAt ? formatOfficeDisplayDate(person.updatedAt) : 'Assumed',
        governor: gov,
        chiefMinister: cm,
        orderPriority: 2.8
      });
    }

    // --- MINISTERS ---
    const isMinisterRole = personRoleLower.includes('minister') &&
      !personRoleLower.includes('chief minister') &&
      !personRoleLower.includes('prime minister') &&
      !personRoleLower.includes('deputy chief minister');

    if (isMinisterRole) {
      const isFormer = personRoleLower.startsWith('former');
      let portfolioTitle = personRoleRaw;
      if (portfolioTitle.toLowerCase().includes('& actor')) {
        portfolioTitle = portfolioTitle.replace(/& actor/i, '').trim();
      }

      const gov = resolveGovernor(activeAssembly);
      const cm = resolveChiefMinister(activeAssembly);

      if (!isFormer) {
        const ministerHistory = (person.roleHistory || []).filter(h => h.role.toLowerCase().includes('minister') && h.action === 'promotion');
        let assumedDate = 'Assumed';
        if (ministerHistory.length > 0) {
          assumedDate = formatOfficeDisplayDate(Math.max(...ministerHistory.map(h => h.date)));
        } else if (person.updatedAt) {
          assumedDate = formatOfficeDisplayDate(person.updatedAt);
        }

        cards.push({
          id: `minister_active_${person.id}`,
          roleType: 'minister',
          roleTitle: portfolioTitle,
          respectiveAssemblyName: activeAsmName,
          isActive: true,
          assumedDate,
          governor: gov,
          chiefMinister: cm,
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 3
        });
      } else {
        cards.push({
          id: `minister_past_${person.id}`,
          roleType: 'minister',
          roleTitle: portfolioTitle,
          respectiveAssemblyName: activeAsmName,
          isActive: false,
          assumedDate: 'Past Term',
          vacatedDate: 'Past Term',
          officeDatesFormatted: 'Past Term',
          governor: gov,
          chiefMinister: cm,
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 15
        });
      }
    }

    // --- LEADERSHIP ROLES ---
    if (activeAssembly && activeAssembly.leaders) {
      const leaders = activeAssembly.leaders;

      if (leaders.leaderOfOpposition === person.id) {
        const lopHistory = (person.roleHistory || []).filter(h => h.role.toLowerCase().includes('opposition') && h.action === 'promotion');
        let assumedDate = 'Assumed';
        if (lopHistory.length > 0) {
          assumedDate = formatOfficeDisplayDate(Math.max(...lopHistory.map(h => h.date)));
        }
        cards.push({
          id: `desig_lo_active`,
          roleType: 'designation',
          roleTitle: 'Leader of the Opposition',
          isActive: true,
          assumedDate,
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 4
        });
      }

      if (leaders.chiefMinister === person.id) {
        const cmHistory = (person.roleHistory || []).filter(h => h.role.toLowerCase().includes('chief minister') && h.action === 'promotion');
        let assumedDate = 'Assumed';
        if (cmHistory.length > 0) {
          assumedDate = formatOfficeDisplayDate(Math.max(...cmHistory.map(h => h.date)));
        }
        cards.push({
          id: `desig_cm_active`,
          roleType: 'designation',
          roleTitle: `Chief Minister${activeStateSuffix}`,
          isActive: true,
          assumedDate,
          governor: resolveGovernor(activeAssembly),
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 4
        });
      }
    }

    // --- OTHER DESIGNATIONS ---
    const personDbDesignations = allDesignations.filter(
      (d) =>
        d.incumbentId === person.id ||
        (Array.isArray(d.history) && d.history.some((h) => h.personId === person.id))
    );

    personDbDesignations.forEach((d) => {
      const lowerDName = d.name.toLowerCase();
      if (
        lowerDName.includes('speaker') ||
        lowerDName.includes('chief secretary') ||
        lowerDName.includes('deputy chief minister') ||
        (lowerDName.includes('opposition') && cards.some((c) => c.roleTitle.toLowerCase().includes('opposition'))) ||
        (lowerDName.includes('chief minister') && cards.some((c) => c.roleTitle.toLowerCase().includes('chief minister'))) ||
        (lowerDName.includes('minister') && cards.some((c) => c.roleType === 'minister'))
      ) {
        return;
      }

      const isCurrent = d.incumbentId === person.id;
      const isMinister = lowerDName.includes('minister');

      if (isCurrent) {
        let assumed = formatOfficeDisplayDate(d.dateOfSigning);
        if (!assumed && Array.isArray(d.history) && d.history.length > 0) {
          const myEntries = d.history.filter((h) => h.personId === person.id);
          if (myEntries.length > 0) {
            assumed = formatOfficeDisplayDate(Math.min(...myEntries.map((h) => h.date || 0)));
          }
        }
        if (!assumed) assumed = formatOfficeDisplayDate(d.updatedAt);

        cards.push({
          id: `desig_active_${d.id}`,
          roleType: isMinister ? 'minister' : 'designation',
          roleTitle: d.name,
          isActive: true,
          assumedDate: assumed,
          governor: isMinister ? resolveGovernor() : undefined,
          chiefMinister: isMinister ? resolveChiefMinister() : undefined,
          constituency: d.constituency ? { name: d.constituency } : null,
          orderPriority: isMinister ? 3 : 5
        });
      } else {
        let assumed = 'Past Term';
        let vacated = 'Past Term';
        if (Array.isArray(d.history) && d.history.length > 0) {
          const myEntries = d.history.filter((h) => h.personId === person.id);
          if (myEntries.length > 0) {
            const myFirstDate = Math.min(...myEntries.map((h) => h.date || 0));
            assumed = formatOfficeDisplayDate(myFirstDate);
            const myLastDate = Math.max(...myEntries.map((h) => h.date || 0));
            const nextEntry = d.history.find((h) => (h.date || 0) > myLastDate);
            if (nextEntry) {
              vacated = formatOfficeDisplayDate(nextEntry.date);
            }
          }
        }

        const desigAsm = d.assemblyId ? assembliesMap.get(d.assemblyId) : null;
        const asmName = desigAsm?.name || activeAsmName;

        cards.push({
          id: `desig_past_${d.id}`,
          roleType: isMinister ? 'minister' : 'designation',
          roleTitle: d.name,
          respectiveAssemblyName: asmName,
          isActive: false,
          assumedDate: assumed,
          vacatedDate: vacated,
          officeDatesFormatted: `(${assumed}) - (${vacated})`,
          governor: isMinister ? resolveGovernor(desigAsm || undefined) : undefined,
          chiefMinister: isMinister ? resolveChiefMinister(desigAsm || undefined) : undefined,
          constituency: d.constituency ? { name: d.constituency } : null,
          orderPriority: isMinister ? 15 : 20
        });
      }
    });

    // --- MLA ROLES ---
    const getInitialContinuousAssumedDate = (
      con: Constituency,
      personId: string
    ): string => {
      if (Array.isArray(con.history) && con.history.length > 0) {
        const sortedHistory = [...con.history].sort((a, b) => (b.date || 0) - (a.date || 0));
        let streakStartDate: number | null = null;
        for (const entry of sortedHistory) {
          if (entry.personId === personId) {
            streakStartDate = entry.date;
          } else if (entry.personId !== 'vacant') {
            break;
          }
        }
        if (streakStartDate) return formatOfficeDisplayDate(streakStartDate);
      }

      const mlaRoleName = `MLA for ${con.name}`;
      const personHistory = (person.roleHistory || []).filter(h => h.role === mlaRoleName && h.action === 'appointment');
      if (personHistory.length > 0) {
        return formatOfficeDisplayDate(Math.max(...personHistory.map(h => h.date)));
      }

      if (con.lastElectionResult?.electionDate) return formatOfficeDisplayDate(con.lastElectionResult.electionDate);
      if (con.updatedAt) return formatOfficeDisplayDate(con.updatedAt);
      
      return formatOfficeDisplayDate(getSystemTimestamp());
    };

    const incumbentCon = allConstituencies.find((c) => c.currentIncumbentId === person.id) ||
      (person.constituencyName ? allConstituencies.find((c) => c.name.toLowerCase() === person.constituencyName?.toLowerCase()) : null);

    if (incumbentCon) {
      const asm = incumbentCon.currentAssemblyId ? assembliesMap.get(incumbentCon.currentAssemblyId) || activeAssembly : activeAssembly;
      const asmName = asm?.name || 'Legislative Assembly';
      const assumedDateStr = getInitialContinuousAssumedDate(incumbentCon, person.id);

      cards.push({
        id: `mla_active_${incumbentCon.id}`,
        roleType: 'mla',
        roleTitle: `Member of the ${asmName}`,
        respectiveAssemblyName: asmName,
        isActive: true,
        assumedDate: assumedDateStr,
        constituency: { name: incumbentCon.name, id: incumbentCon.id },
        assemblyLink: asm ? `/assembly/${asm.id}` : undefined,
        orderPriority: 6
      });
    }

    allConstituencies.forEach((c) => {
      if (incumbentCon && c.id === incumbentCon.id) {
        // Even if they are current, they might have historical terms in history array
      }

      if (Array.isArray(c.history)) {
        const personEntries = c.history.filter((h) => h.personId === person.id);
        if (personEntries.length > 0) {
          // Group by assemblyId to show separate terms per assembly
          const asmIds = [...new Set(personEntries.map(h => h.assemblyId))].filter(Boolean) as string[];

          asmIds.forEach(asmId => {
            const entriesForAsm = personEntries.filter(h => h.assemblyId === asmId);
            const sortedAllHistory = [...c.history].sort((a, b) => (a.date || 0) - (b.date || 0));
            
            const assumedDate = formatOfficeDisplayDate(entriesForAsm[0].date);
            let vacatedDate = 'Past Term';

            // Find when they vacated this specific term in this assembly
            const reversedHistory = [...sortedAllHistory].reverse();
            const lastMatchIdx = reversedHistory.findIndex(h => h.personId === person.id && h.assemblyId === asmId);
            const lastEntryIdx = lastMatchIdx >= 0 ? (sortedAllHistory.length - 1 - lastMatchIdx) : -1;

            if (lastEntryIdx >= 0 && lastEntryIdx < sortedAllHistory.length - 1) {
              vacatedDate = formatOfficeDisplayDate(sortedAllHistory[lastEntryIdx + 1].date);
            } else {
              // Check if they are actually the current incumbent in that assembly
              if (c.currentIncumbentId === person.id && c.currentAssemblyId === asmId && activeAssembly?.id === asmId) {
                // This is the active role, skipping to avoid duplication with the active MLA card
                return;
              }
              // Otherwise, use assembly dissolution or constituency update as fallback
              const asm = assembliesMap.get(asmId);
              if (asm && !asm.isActive && asm.updatedAt) {
                vacatedDate = formatOfficeDisplayDate(asm.updatedAt);
              } else if (c.updatedAt) {
                vacatedDate = formatOfficeDisplayDate(c.updatedAt);
              }
            }

            const conAsm = assembliesMap.get(asmId) || activeAssembly;
            const asmName = conAsm?.name || 'Legislative Assembly';

            cards.push({
              id: `mla_past_${c.id}_${asmId}`,
              roleType: 'mla',
              roleTitle: `Member of the ${asmName}`,
              respectiveAssemblyName: asmName,
              isActive: false,
              assumedDate,
              vacatedDate,
              officeDatesFormatted: `(${assumedDate}) - (${vacatedDate})`,
              constituency: { name: c.name, id: c.id },
              governor: resolveGovernor(conAsm),
              chiefMinister: resolveChiefMinister(conAsm),
              orderPriority: 30
            });
          });
        }
      }
    });

    cards.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.orderPriority - b.orderPriority;
    });

    return cards;
  }, [person, allAssemblies, allConstituencies, allPersons, allDesignations, systemDate]);

  if (!roleCards || roleCards.length === 0) {
    return (
      <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center bg-white/[0.01]">
        <p className="text-gray-500 italic text-sm">
          No legislative assembly or designation records found for this person.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {roleCards.map((card) => (
        <div
          key={card.id}
          className="border border-[#22314E] rounded-xl overflow-hidden shadow-2xl bg-[#0A101D] transition-all hover:border-[#384C74] max-w-xl mx-auto"
        >
          <div
            onClick={() => card.assemblyLink && navigate(card.assemblyLink)}
            className={`py-3.5 px-4 text-center bg-[#171F33] border-b border-[#23314E] ${
              card.assemblyLink ? 'cursor-pointer hover:bg-[#1E2942] transition-colors' : ''
            }`}
          >
            {renderRoleTitleHeader(card)}
          </div>

          {card.isActive && (
            <div className="w-full bg-[#101828] py-1.5 text-center border-b border-[#23314E]">
              <span className="text-[#7B96D4] font-bold text-sm tracking-wide">
                Incumbent
              </span>
            </div>
          )}

          <div className="py-4 px-4 text-center bg-[#0D1525]">
            {card.isActive ? (
              <>
                <p className="font-bold text-sm text-white tracking-wide">Assumed office</p>
                <p className="text-sm text-gray-200 mt-1 font-medium tabular-nums">
                  ({card.assumedDate})
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm text-white tracking-wide">In office</p>
                <p className="text-sm text-gray-200 mt-1 font-medium tabular-nums">
                  {card.officeDatesFormatted}
                </p>
              </>
            )}
          </div>

          {!card.roleTitle.toLowerCase().includes('governor') && (
            <div className={`grid ${card.roleType === 'speaker' || card.roleType === 'deputy_speaker' ? 'grid-cols-2' : 'grid-cols-1'} bg-[#0A101D] border-t border-[#22314E]`}>
              {(card.roleType === 'speaker' || card.roleType === 'deputy_speaker' || card.roleTitle.toLowerCase().includes('governor')) && (
                <div className="p-4 border-r border-[#22314E] flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] uppercase tracking-widest text-[#7B96D4] font-bold mb-1">
                    {card.roleTitle.toLowerCase().includes('governor') ? 'Head of State' : 'Governor'}
                  </p>
                  <p className="text-xs font-bold text-white leading-tight">
                    {card.governor?.name || "Hon'ble Governor"}
                  </p>
                </div>
              )}
              <div className="p-4 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] uppercase tracking-widest text-[#7B96D4] font-bold mb-1">
                  Chief Minister
                </p>
                <p className="text-xs font-bold text-white leading-tight">
                  {card.chiefMinister?.name || "Hon'ble Chief Minister"}
                </p>
              </div>
            </div>
          )}

          {(card.precededBy || card.succeededBy || card.constituency) && (
            <div className="bg-[#0D1525] border-t border-[#22314E] p-4 flex flex-col gap-2">
              {card.constituency && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#7B96D4] font-bold">Constituency</span>
                  <span className="text-xs font-bold text-white">{card.constituency.name}</span>
                </div>
              )}
              {card.precededBy && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#7B96D4] font-bold">Preceded by</span>
                  <span className="text-xs font-bold text-white">{card.precededBy.name}</span>
                </div>
              )}
              {card.succeededBy && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#7B96D4] font-bold">Succeeded by</span>
                  <span className="text-xs font-bold text-white">{card.succeededBy.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
