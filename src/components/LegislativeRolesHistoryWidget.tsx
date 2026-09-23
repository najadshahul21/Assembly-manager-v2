import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Person, Assembly, Constituency, Designation } from '../types';
import { formatAppDate } from '../utils/dateUtils';

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
 * Matching the exact typography in the provided reference screenshot.
 */
const formatOfficeDisplayDate = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    // If already in "DD Month YYYY" format like "13 May 2001"
    if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // If in "DD/Month/YYYY" or "DD-Month-YYYY" format
    const slashMatch = trimmed.match(/^(\d{1,2})[/-]([A-Za-z]+)[/-](\d{4})$/);
    if (slashMatch) {
      return `${parseInt(slashMatch[1], 10)} ${slashMatch[2]} ${slashMatch[3]}`;
    }
  }
  const appDate = formatAppDate(dateVal);
  const slashMatch = appDate.match(/^(\d{1,2})\/([A-Za-z]+)\/(\d{4})$/);
  if (slashMatch) {
    return `${parseInt(slashMatch[1], 10)} ${slashMatch[2]} ${slashMatch[3]}`;
  }
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
 * Two-tone title header matching the reference screenshot:
 * Blue (#7B96D4) and white typography with proper two-tone contrast
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

  // Generic Designation title (e.g., "Leader of the Opposition", "Chief Minister of Kerala")
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

  const roleCards = useLiveQuery(async (): Promise<LegislativeRoleCardData[]> => {
    if (!person || !person.id) return [];

    const allAssemblies = await db.assemblies.toArray();
    const allConstituencies = await db.constituencies.toArray();
    const allPersons = await db.persons.toArray();
    const allDesignations = await db.designations.toArray();

    // Map for fast person lookup
    const personsMap = new Map<string, Person>();
    allPersons.forEach((p) => personsMap.set(p.id, p));

    // Map for fast assembly lookup
    const assembliesMap = new Map<string, Assembly>();
    allAssemblies.forEach((a) => assembliesMap.set(a.id, a));

    // Active assembly
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

    const lowerPersonName = person.name?.toLowerCase() || '';
    const personRoleRaw = person.role || '';
    const personRoleLower = personRoleRaw.toLowerCase();

    // Prominent figure flags
    const isSatheesan = lowerPersonName.includes('satheesan');
    const isPinarayi = lowerPersonName.includes('pinarayi');
    const isChennithala = lowerPersonName.includes('chennithala');
    const isShamseer = lowerPersonName.includes('shamseer');
    const isRajesh = lowerPersonName.includes('rajesh') && lowerPersonName.includes('m');
    const isGopakumar = lowerPersonName.includes('gopakumar') || lowerPersonName.includes('chittayam');
    const isSasi = lowerPersonName.includes('sasi') && !lowerPersonName.includes('satheesan');
    const isSreeramakrishnan = lowerPersonName.includes('sreeramakrishnan');
    const isOommenChandy = lowerPersonName.includes('oommen') && lowerPersonName.includes('chandy');

    // Helper: Dynamic Governor lookup for an assembly/period
    const resolveGovernor = (asm?: Assembly): { name: string; id?: string } | null => {
      const govDesig = allDesignations.find(
        (d) => d.id === 'governor' || d.name?.toLowerCase().includes('governor')
      );
      if (govDesig?.incumbentId && govDesig.incumbentId !== 'vacant') {
        const govP = personsMap.get(govDesig.incumbentId);
        if (govP) return { name: govP.name, id: govP.id };
      }
      if (govDesig && Array.isArray(govDesig.history) && govDesig.history.length > 0) {
        const hEntry = govDesig.history.find(h => (h as any).assemblyId === asm?.id) || govDesig.history[govDesig.history.length - 1];
        if (hEntry?.personId && hEntry.personId !== 'vacant') {
          const p = personsMap.get(hEntry.personId);
          if (p) return { name: p.name, id: p.id };
        }
      }
      const arif = allPersons.find(
        (p) => p.id === 'arif-mohammad-khan' || p.name.toLowerCase().includes('arif')
      );
      if (arif) return { name: arif.name, id: arif.id };
      return null;
    };

    // Helper: Dynamic Chief Minister lookup for an assembly/period
    const resolveChiefMinister = (asm?: Assembly): { name: string; id?: string } | null => {
      const targetAsm = asm || activeAssembly;
      if (targetAsm?.leaders?.chiefMinister && targetAsm.leaders.chiefMinister !== 'vacant') {
        const cm = personsMap.get(targetAsm.leaders.chiefMinister);
        if (cm) return { name: cm.name, id: cm.id };
      }
      const cmDesig = allDesignations.find(
        (d) => d.name?.toLowerCase().includes('chief minister') || d.id?.toLowerCase().includes('chief-minister')
      );
      if (cmDesig?.incumbentId && cmDesig.incumbentId !== 'vacant') {
        const cmP = personsMap.get(cmDesig.incumbentId);
        if (cmP) return { name: cmP.name, id: cmP.id };
      }
      const pinarayi = allPersons.find(
        (p) => p.id === 'pinarayi-vijayan' || p.name.toLowerCase().includes('pinarayi')
      );
      if (pinarayi) return { name: pinarayi.name, id: pinarayi.id };
      return null;
    };

    // Helper: Dynamic Speaker lookup for Deputy Speaker
    const resolveSpeakerForDeputy = (asm?: Assembly, isCurrent?: boolean): { name: string; id?: string } | null => {
      const targetAsm = asm || activeAssembly;
      if (targetAsm?.leaders?.speaker && targetAsm.leaders.speaker !== 'vacant') {
        const spk = personsMap.get(targetAsm.leaders.speaker);
        if (spk) return { name: spk.name, id: spk.id };
      }
      const spkDesig = allDesignations.find(
        (d) => d.name?.toLowerCase().includes('speaker') && !d.name?.toLowerCase().includes('deputy')
      );
      if (spkDesig?.incumbentId && spkDesig.incumbentId !== 'vacant') {
        const spk = personsMap.get(spkDesig.incumbentId);
        if (spk) return { name: spk.name, id: spk.id };
      }
      const shamseer = allPersons.find(
        (p) => p.id === 'a-n-shamseer' || p.name.toLowerCase().includes('shamseer')
      );
      if (shamseer) return { name: shamseer.name, id: shamseer.id };
      return null;
    };

    const cards: LegislativeRoleCardData[] = [];

    // =========================================================================
    // 1. SPEAKER ROLE
    // =========================================================================
    const isCurrentSpeaker =
      activeAssembly?.leaders?.speaker === person.id ||
      (isShamseer && (!activeAssembly?.leaders?.speaker || activeAssembly.leaders.speaker === person.id)) ||
      personRoleLower === 'speaker';

    if (isCurrentSpeaker) {
      const gov = resolveGovernor(activeAssembly);
      const assumedDate = isShamseer ? '12 September 2022' : '25 May 2021';
      const mbrajesh = allPersons.find(
        (p) => p.id === 'm-b-rajesh' || (p.name.toLowerCase().includes('rajesh') && p.name.toLowerCase().includes('m'))
      );

      cards.push({
        id: `speaker_active_${person.id}`,
        roleType: 'speaker',
        roleTitle: `Speaker of the ${activeAsmName}`,
        respectiveAssemblyName: activeAsmName,
        assemblyLink: activeAssembly ? `/assembly/${activeAssembly.id}` : undefined,
        isActive: true,
        assumedDate,
        governor: gov,
        precededBy: mbrajesh ? { name: mbrajesh.name, id: mbrajesh.id } : { name: 'M. B. Rajesh', id: 'm-b-rajesh' },
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 1
      });
    }

    // Historical Past Speaker terms
    if (isRajesh && !isCurrentSpeaker) {
      const gov = resolveGovernor(activeAssembly);
      const shamseer = allPersons.find((p) => p.id === 'a-n-shamseer' || p.name.toLowerCase().includes('shamseer'));
      cards.push({
        id: `speaker_past_rajesh`,
        roleType: 'speaker',
        roleTitle: `Speaker of the ${activeAsmName}`,
        respectiveAssemblyName: activeAsmName,
        assemblyLink: activeAssembly ? `/assembly/${activeAssembly.id}` : undefined,
        isActive: false,
        assumedDate: '25 May 2021',
        vacatedDate: '2 September 2022',
        officeDatesFormatted: '(25 May 2021 – 2 September 2022)',
        governor: gov,
        precededBy: { name: 'P. Sreeramakrishnan' },
        succeededBy: shamseer ? { name: shamseer.name, id: shamseer.id } : { name: 'A. N. Shamseer', id: 'a-n-shamseer' },
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 10
      });
    }

    if (isSreeramakrishnan) {
      const asm14 = allAssemblies.find((a) => a.name.toLowerCase().includes('14')) || activeAssembly;
      const asm14Name = asm14?.name || (activeStateName ? `14th ${activeStateName} Legislative Assembly` : '14th Legislative Assembly');
      const gov = resolveGovernor(asm14);
      cards.push({
        id: `speaker_past_sreeramakrishnan`,
        roleType: 'speaker',
        roleTitle: `Speaker of the ${asm14Name}`,
        respectiveAssemblyName: asm14Name,
        assemblyLink: asm14 ? `/assembly/${asm14.id}` : undefined,
        isActive: false,
        assumedDate: '3 June 2016',
        vacatedDate: '24 May 2021',
        officeDatesFormatted: '(3 June 2016 – 24 May 2021)',
        governor: gov,
        precededBy: { name: 'N. Sakthan' },
        succeededBy: { name: 'M. B. Rajesh', id: 'm-b-rajesh' },
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 10
      });
    }

    // =========================================================================
    // 2. DEPUTY SPEAKER ROLE
    // =========================================================================
    const isCurrentDeputySpeaker =
      activeAssembly?.leaders?.deputySpeaker === person.id ||
      (isGopakumar && (!activeAssembly?.leaders?.deputySpeaker || activeAssembly.leaders.deputySpeaker === person.id)) ||
      personRoleLower === 'deputy speaker';

    if (isCurrentDeputySpeaker) {
      const gov = resolveGovernor(activeAssembly);
      const currentSpeaker = resolveSpeakerForDeputy(activeAssembly, true);

      cards.push({
        id: `deputy_speaker_active_${person.id}`,
        roleType: 'deputy_speaker',
        roleTitle: `Deputy Speaker of the ${activeAsmName}`,
        respectiveAssemblyName: activeAsmName,
        assemblyLink: activeAssembly ? `/assembly/${activeAssembly.id}` : undefined,
        isActive: true,
        assumedDate: '1 June 2021',
        governor: gov,
        speaker: currentSpeaker,
        precededBy: { name: 'V. Sasi' },
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 2
      });
    }

    if (isSasi && !isCurrentDeputySpeaker) {
      const asm14 = allAssemblies.find((a) => a.name.toLowerCase().includes('14')) || activeAssembly;
      const asm14Name = asm14?.name || (activeStateName ? `14th ${activeStateName} Legislative Assembly` : '14th Legislative Assembly');
      const gov = resolveGovernor(asm14);
      const speaker14 = resolveSpeakerForDeputy(asm14, false);
      const gopakumar = allPersons.find((p) => p.name.toLowerCase().includes('gopakumar'));

      cards.push({
        id: `deputy_speaker_past_sasi`,
        roleType: 'deputy_speaker',
        roleTitle: `Deputy Speaker of the ${asm14Name}`,
        respectiveAssemblyName: asm14Name,
        assemblyLink: asm14 ? `/assembly/${asm14.id}` : undefined,
        isActive: false,
        assumedDate: '29 June 2016',
        vacatedDate: '3 May 2021',
        officeDatesFormatted: '(29 June 2016 – 3 May 2021)',
        governor: gov,
        speaker: speaker14,
        precededBy: { name: 'Palode Ravi' },
        succeededBy: gopakumar ? { name: gopakumar.name, id: gopakumar.id } : { name: 'Chittayam Gopakumar' },
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 11
      });
    }

    // =========================================================================
    // 3. DEPUTY CHIEF MINISTER ROLE
    // =========================================================================
    const isCurrentDeputyCM =
      activeAssembly?.leaders?.deputyChiefMinister === person.id ||
      personRoleLower.includes('deputy chief minister');

    if (isCurrentDeputyCM) {
      const gov = resolveGovernor(activeAssembly);
      const cm = resolveChiefMinister(activeAssembly);

      cards.push({
        id: `deputy_cm_active_${person.id}`,
        roleType: 'deputy_chief_minister',
        roleTitle: `Deputy Chief Minister of the ${activeAsmName}`,
        respectiveAssemblyName: activeAsmName,
        assemblyLink: activeAssembly ? `/assembly/${activeAssembly.id}` : undefined,
        isActive: true,
        assumedDate: '20 May 2021',
        governor: gov,
        chiefMinister: cm,
        constituency: person.constituencyName ? { name: person.constituencyName } : null,
        orderPriority: 2.5
      });
    }

    // Historical Past Deputy Chief Minister roles
    allAssemblies.forEach((asm) => {
      if (asm.leaders?.deputyChiefMinister === person.id && (!activeAssembly || asm.id !== activeAssembly.id)) {
        const gov = resolveGovernor(asm);
        const cm = resolveChiefMinister(asm);
        const assumed = asm.termLimits ? asm.termLimits.split(/[-–]/)[0]?.trim() : 'Assumed';
        const vacated = asm.termLimits ? asm.termLimits.split(/[-–]/)[1]?.trim() : 'Vacated';

        cards.push({
          id: `deputy_cm_past_${asm.id}_${person.id}`,
          roleType: 'deputy_chief_minister',
          roleTitle: `Deputy Chief Minister of the ${asm.name}`,
          respectiveAssemblyName: asm.name,
          assemblyLink: `/assembly/${asm.id}`,
          isActive: false,
          assumedDate: assumed,
          vacatedDate: vacated,
          officeDatesFormatted: `(${assumed} – ${vacated})`,
          governor: gov,
          chiefMinister: cm,
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 12
        });
      }
    });

    // =========================================================================
    // 4. CHIEF SECRETARY ROLE
    // =========================================================================
    const isCurrentChiefSecretary =
      activeAssembly?.leaders?.chiefSecretary === person.id ||
      personRoleLower.includes('chief secretary');

    if (isCurrentChiefSecretary) {
      const gov = resolveGovernor(activeAssembly);
      const cm = resolveChiefMinister(activeAssembly);

      cards.push({
        id: `chief_secretary_active_${person.id}`,
        roleType: 'chief_secretary',
        roleTitle: `Chief Secretary${activeStateSuffix}`,
        respectiveAssemblyName: activeAsmName,
        isActive: true,
        assumedDate: '1 July 2023',
        governor: gov,
        chiefMinister: cm,
        orderPriority: 2.8
      });
    }

    // Historical Past Chief Secretary roles
    allAssemblies.forEach((asm) => {
      if (asm.leaders?.chiefSecretary === person.id && (!activeAssembly || asm.id !== activeAssembly.id)) {
        const gov = resolveGovernor(asm);
        const cm = resolveChiefMinister(asm);
        const assumed = asm.termLimits ? asm.termLimits.split(/[-–]/)[0]?.trim() : 'Assumed';
        const vacated = asm.termLimits ? asm.termLimits.split(/[-–]/)[1]?.trim() : 'Vacated';
        const asmState = extractStateFromAssembly(asm);
        const stateSuffix = asmState ? ` of ${asmState}` : activeStateSuffix;

        cards.push({
          id: `chief_secretary_past_${asm.id}_${person.id}`,
          roleType: 'chief_secretary',
          roleTitle: `Chief Secretary${stateSuffix}`,
          respectiveAssemblyName: asm.name,
          isActive: false,
          assumedDate: assumed,
          vacatedDate: vacated,
          officeDatesFormatted: `(${assumed} – ${vacated})`,
          governor: gov,
          chiefMinister: cm,
          orderPriority: 13
        });
      }
    });

    // =========================================================================
    // 5. MINISTERS (PORTFOLIO HEADS)
    // =========================================================================
    const isMinisterRole =
      personRoleLower.includes('minister') &&
      !personRoleLower.includes('chief minister') &&
      !personRoleLower.includes('prime minister') &&
      !personRoleLower.includes('deputy chief minister');

    if (isMinisterRole) {
      const isFormer = personRoleLower.startsWith('former');
      let portfolioTitle = personRoleRaw;
      if (portfolioTitle.toLowerCase().includes('& actor')) {
        portfolioTitle = portfolioTitle.replace(/& actor/i, '').trim();
      }

      const gov = resolveGovernor(isFormer ? allAssemblies.find((a) => a.name.includes('14')) : activeAssembly);
      const cm = resolveChiefMinister(isFormer ? allAssemblies.find((a) => a.name.includes('14')) : activeAssembly);

      if (!isFormer) {
        // Active Minister
        let assumedDate = '20 May 2021';
        if (lowerPersonName.includes('ganesh kumar') || lowerPersonName.includes('kadannappalli')) {
          assumedDate = '29 December 2023';
        } else if (lowerPersonName.includes('kelu')) {
          assumedDate = '23 June 2024';
        } else if (isRajesh) {
          assumedDate = '6 September 2022';
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
        // Former Minister
        let assumed = '25 May 2016';
        let vacated = '20 May 2021';

        if (lowerPersonName.includes('antony raju')) {
          assumed = '20 May 2021';
          vacated = '24 December 2023';
        } else if (
          lowerPersonName.includes('babu') ||
          lowerPersonName.includes('thiruvanchoor') ||
          lowerPersonName.includes('muneer')
        ) {
          assumed = '18 May 2011';
          vacated = '20 May 2016';
        } else if (lowerPersonName.includes('jaleel')) {
          assumed = '25 May 2016';
          vacated = '13 April 2021';
        }

        cards.push({
          id: `minister_past_${person.id}`,
          roleType: 'minister',
          roleTitle: portfolioTitle,
          respectiveAssemblyName: activeAsmName,
          isActive: false,
          assumedDate: assumed,
          vacatedDate: vacated,
          officeDatesFormatted: `(${assumed} – ${vacated})`,
          governor: gov,
          chiefMinister: cm,
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 15
        });
      }
    }

    // =========================================================================
    // 6. OTHER DESIGNATIONS & LEADERSHIP ROLES (Continuous Incumbency)
    // =========================================================================

    // A. Active Leadership Council: Leader of Opposition & Chief Minister
    if (activeAssembly && activeAssembly.leaders) {
      const leaders = activeAssembly.leaders;

      // Leader of Opposition
      if (leaders.leaderOfOpposition === person.id || (isSatheesan && !leaders.leaderOfOpposition)) {
        cards.push({
          id: `desig_lo_active`,
          roleType: 'designation',
          roleTitle: 'Leader of the Opposition',
          isActive: true,
          assumedDate: '22 May 2021',
          precededBy: { name: 'Ramesh Chennithala', id: 'ramesh-chennithala' },
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 4
        });
      }

      // Chief Minister
      if (leaders.chiefMinister === person.id || (isPinarayi && !leaders.chiefMinister)) {
        cards.push({
          id: `desig_cm_active`,
          roleType: 'designation',
          roleTitle: `Chief Minister${activeStateSuffix}`,
          isActive: true,
          assumedDate: '25 May 2016',
          governor: resolveGovernor(activeAssembly),
          precededBy: { name: 'Oommen Chandy', id: 'oommen-chandy' },
          constituency: person.constituencyName ? { name: person.constituencyName } : null,
          orderPriority: 4
        });
      }
    }

    // B. Check Database Designations (e.g. Cabinet Ministers, Executive Posts)
    const personDbDesignations = allDesignations.filter(
      (d) =>
        d.incumbentId === person.id ||
        (Array.isArray(d.history) && d.history.some((h) => h.personId === person.id))
    );

    personDbDesignations.forEach((d) => {
      const lowerDName = d.name.toLowerCase();
      // Skip if already handled by specialized cards
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

      const hasSomeoneElseOccupied = (() => {
        if (d.incumbentId && d.incumbentId !== person.id && d.incumbentId !== 'vacant') {
          return true;
        }
        if (Array.isArray(d.history) && d.history.length > 0) {
          const myEntries = d.history.filter((h) => h.personId === person.id);
          if (myEntries.length > 0) {
            const myLastDate = Math.max(...myEntries.map((h) => h.date || 0));
            const laterOtherEntries = d.history.filter(
              (h) => (h.date || 0) > myLastDate && h.personId !== person.id && h.personId !== 'vacant'
            );
            if (laterOtherEntries.length > 0) {
              return true;
            }
          }
        }
        return false;
      })();

      const isCurrent = !hasSomeoneElseOccupied;
      const isMinister = lowerDName.includes('minister');

      // Find predecessor & successor in history
      let predecessor: { name: string; id?: string } | null = null;
      let successor: { name: string; id?: string } | null = null;

      if (Array.isArray(d.history) && d.history.length > 0) {
        const sortedHistory = [...d.history].sort((a, b) => (a.date || 0) - (b.date || 0));
        const myFirstIdx = sortedHistory.findIndex((h) => h.personId === person.id);
        if (myFirstIdx > 0) {
          const prevEntry = sortedHistory[myFirstIdx - 1];
          const prevP = personsMap.get(prevEntry.personId);
          predecessor = prevP ? { name: prevP.name, id: prevP.id } : { name: prevEntry.personId };
        }
        const myLastIdx = sortedHistory.map((h) => h.personId).lastIndexOf(person.id);
        if (myLastIdx >= 0 && myLastIdx < sortedHistory.length - 1) {
          const nextEntry = sortedHistory[myLastIdx + 1];
          const nextP = personsMap.get(nextEntry.personId);
          successor = nextP ? { name: nextP.name, id: nextP.id } : { name: nextEntry.personId };
        }
      }

      if (isCurrent) {
        let assumed = formatOfficeDisplayDate(d.dateOfSigning);
        if (!assumed && Array.isArray(d.history) && d.history.length > 0) {
          const myEntries = d.history.filter((h) => h.personId === person.id);
          if (myEntries.length > 0) {
            assumed = formatOfficeDisplayDate(Math.min(...myEntries.map((h) => h.date || 0)));
          }
        }
        if (!assumed) {
          assumed = '20 May 2021';
        }

        cards.push({
          id: `desig_active_${d.id}`,
          roleType: isMinister ? 'minister' : 'designation',
          roleTitle: d.name,
          isActive: true,
          assumedDate: assumed,
          governor: isMinister ? resolveGovernor() : undefined,
          chiefMinister: isMinister ? resolveChiefMinister() : undefined,
          precededBy: predecessor,
          constituency: d.constituency ? { name: d.constituency } : null,
          orderPriority: isMinister ? 3 : 5
        });
      } else {
        let assumed = '';
        let vacated = '';
        if (Array.isArray(d.history) && d.history.length > 0) {
          const myEntries = d.history.filter((h) => h.personId === person.id);
          if (myEntries.length > 0) {
            assumed = formatOfficeDisplayDate(Math.min(...myEntries.map((h) => h.date || 0)));
            const myLastDate = Math.max(...myEntries.map((h) => h.date || 0));
            const nextEntry = d.history.find((h) => (h.date || 0) > myLastDate);
            if (nextEntry) {
              vacated = formatOfficeDisplayDate(nextEntry.date);
            }
          }
        }
        if (!assumed) assumed = formatOfficeDisplayDate(d.dateOfSigning || d.updatedAt);
        if (!vacated) vacated = formatOfficeDisplayDate(d.updatedAt);

        cards.push({
          id: `desig_past_${d.id}`,
          roleType: isMinister ? 'minister' : 'designation',
          roleTitle: d.name,
          isActive: false,
          assumedDate: assumed,
          vacatedDate: vacated,
          officeDatesFormatted: `(${assumed} – ${vacated})`,
          governor: isMinister ? resolveGovernor() : undefined,
          chiefMinister: isMinister ? resolveChiefMinister() : undefined,
          precededBy: predecessor,
          succeededBy: successor,
          constituency: d.constituency ? { name: d.constituency } : null,
          orderPriority: isMinister ? 15 : 20
        });
      }
    });

    // C. Prominent Past Leader of Opposition
    if (isChennithala && !cards.some((c) => c.roleTitle.toLowerCase().includes('opposition'))) {
      cards.push({
        id: `desig_lo_past_chennithala`,
        roleType: 'designation',
        roleTitle: 'Leader of the Opposition',
        isActive: false,
        assumedDate: '25 May 2016',
        vacatedDate: '21 May 2021',
        officeDatesFormatted: '(25 May 2016 – 21 May 2021)',
        precededBy: { name: 'V. S. Achuthanandan' },
        succeededBy: { name: 'V. D. Satheesan', id: 'v-d-satheesan' },
        orderPriority: 21
      });
    }

    // =========================================================================
    // 7. CONSTITUENCY MLA ROLES (Continuous Incumbency Across Assemblies)
    // =========================================================================

    const getInitialContinuousAssumedDate = (
      con: Constituency,
      personId: string,
      currentAssembly?: Assembly | null
    ): string => {
      const lowerCon = con.name?.toLowerCase() || '';

      if (lowerCon.includes('paravur') || isSatheesan) return '13 May 2001';
      if (lowerCon.includes('dharmadam') || isPinarayi) return '25 May 2016';
      if (lowerCon.includes('puthuppally') && isOommenChandy) return '17 September 1970';

      if (Array.isArray(con.history) && con.history.length > 0) {
        const sortedHistory = [...con.history].sort((a, b) => (a.date || 0) - (b.date || 0));
        let lastOtherIdx = -1;
        for (let i = 0; i < sortedHistory.length; i++) {
          if (sortedHistory[i].personId !== personId && sortedHistory[i].personId !== 'vacant') {
            lastOtherIdx = i;
          }
        }
        const streakEntries = sortedHistory.slice(lastOtherIdx + 1).filter((h) => h.personId === personId);
        if (streakEntries.length > 0 && streakEntries[0].date) {
          return formatOfficeDisplayDate(streakEntries[0].date);
        }
      }

      if (con.lastElectionResult?.electionDate) {
        return formatOfficeDisplayDate(con.lastElectionResult.electionDate);
      }
      if (con.electedYear) {
        return formatOfficeDisplayDate(con.electedYear);
      }
      if (currentAssembly?.termLimits) {
        const startTerm = currentAssembly.termLimits.split(/[-–]/)[0]?.trim();
        return formatOfficeDisplayDate(startTerm) || '20 May 2021';
      }
      return '20 May 2021';
    };

    const findConstituencyPredecessor = (
      con: Constituency,
      personId: string
    ): { name: string; id?: string } | null => {
      const lowerCon = con.name?.toLowerCase() || '';
      if (lowerCon.includes('paravur') || isSatheesan) {
        const praju = personsMap.get('p-raju');
        return praju ? { name: praju.name, id: praju.id } : { name: 'P. Raju' };
      }
      if (lowerCon.includes('dharmadam') || isPinarayi) {
        const kkn = personsMap.get('k-k-narayanan');
        return kkn ? { name: kkn.name, id: kkn.id } : { name: 'K. K. Narayanan' };
      }
      if (lowerCon.includes('puthuppally') && isOommenChandy) {
        return { name: 'E. M. George' };
      }

      if (Array.isArray(con.history) && con.history.length > 0) {
        const sortedHistory = [...con.history].sort((a, b) => (a.date || 0) - (b.date || 0));
        let streakStartIdx = sortedHistory.findIndex((h) => h.personId === personId);
        if (streakStartIdx > 0) {
          for (let i = streakStartIdx - 1; i >= 0; i--) {
            if (sortedHistory[i].personId !== personId && sortedHistory[i].personId !== 'vacant') {
              const prevPerson = personsMap.get(sortedHistory[i].personId);
              if (prevPerson) return { name: prevPerson.name, id: prevPerson.id };
              return { name: sortedHistory[i].personId };
            }
          }
        }
      }
      return null;
    };

    // 1. ACTIVE CONTINUOUS MLA ROLE
    const incumbentCon =
      allConstituencies.find((c) => c.currentIncumbentId === person.id) ||
      (person.constituencyName
        ? allConstituencies.find((c) => c.name.toLowerCase() === person.constituencyName?.toLowerCase())
        : null);

    if (incumbentCon) {
      const asm = incumbentCon.currentAssemblyId
        ? assembliesMap.get(incumbentCon.currentAssemblyId) || activeAssembly
        : activeAssembly;

      const asmName = asm?.name || 'Legislative Assembly';
      const predecessor = findConstituencyPredecessor(incumbentCon, person.id);
      const assumedDateStr = getInitialContinuousAssumedDate(incumbentCon, person.id, asm);

      cards.push({
        id: `mla_active_${incumbentCon.id}`,
        roleType: 'mla',
        roleTitle: `Member of the ${asmName}`,
        respectiveAssemblyName: asmName,
        isActive: true,
        assumedDate: assumedDateStr,
        precededBy: predecessor,
        constituency: { name: incumbentCon.name, id: incumbentCon.id },
        assemblyLink: asm ? `/assembly/${asm.id}` : undefined,
        orderPriority: 6
      });
    }

    // 2. PAST CONSTITUENCY MLA ROLES
    allConstituencies.forEach((c) => {
      if (incumbentCon && c.id === incumbentCon.id) {
        return;
      }

      if (Array.isArray(c.history)) {
        const personEntries = c.history.filter((h) => h.personId === person.id);
        if (personEntries.length > 0) {
          const sortedHistory = [...c.history].sort((a, b) => (a.date || 0) - (b.date || 0));
          const predecessor = findConstituencyPredecessor(c, person.id);

          const currentIncumbent =
            c.currentIncumbentId && c.currentIncumbentId !== 'vacant' && c.currentIncumbentId !== person.id
              ? personsMap.get(c.currentIncumbentId)
              : null;

          let assumedDate = formatOfficeDisplayDate(personEntries[0].date);
          let vacatedDate = '';

          const lastPersonIdx = sortedHistory.map((h) => h.personId).lastIndexOf(person.id);
          if (lastPersonIdx >= 0 && lastPersonIdx < sortedHistory.length - 1) {
            vacatedDate = formatOfficeDisplayDate(sortedHistory[lastPersonIdx + 1].date);
          } else {
            vacatedDate = formatOfficeDisplayDate(c.updatedAt);
          }

          if (!assumedDate) assumedDate = 'Past Term';
          if (!vacatedDate) vacatedDate = 'Past Term';

          const officeDatesFormatted = `(${assumedDate} – ${vacatedDate})`;
          const conAsm = c.currentAssemblyId ? assembliesMap.get(c.currentAssemblyId) || activeAssembly : activeAssembly;
          const asmName = conAsm?.name || 'Legislative Assembly';

          cards.push({
            id: `mla_past_${c.id}`,
            roleType: 'mla',
            roleTitle: `Member of the ${asmName}`,
            respectiveAssemblyName: asmName,
            isActive: false,
            assumedDate,
            vacatedDate,
            officeDatesFormatted,
            precededBy: predecessor,
            succeededBy: currentIncumbent ? { name: currentIncumbent.name, id: currentIncumbent.id } : null,
            constituency: { name: c.name, id: c.id },
            orderPriority: 30
          });
        }
      }
    });

    // Sort: Active roles first, then ordered by priority
    cards.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      return a.orderPriority - b.orderPriority;
    });

    return cards;
  }, [person]);

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
          {/* 1. Header Bar: Two-tone Title matching the reference screenshot */}
          <div
            onClick={() => card.assemblyLink && navigate(card.assemblyLink)}
            className={`py-3.5 px-4 text-center bg-[#171F33] border-b border-[#23314E] ${
              card.assemblyLink ? 'cursor-pointer hover:bg-[#1E2942] transition-colors' : ''
            }`}
          >
            {renderRoleTitleHeader(card)}
          </div>

          {/* 2. Subheader Bar: "Incumbent" for Active Role (No badging for past roles) */}
          {card.isActive && (
            <div className="w-full bg-[#101828] py-1.5 text-center border-b border-[#23314E]">
              <span className="text-[#7B96D4] font-bold text-sm tracking-wide">
                Incumbent
              </span>
            </div>
          )}

          {/* 3. Center Block: Office Status & Dates */}
          <div className="py-4 px-4 text-center bg-[#0D1525]">
            {card.isActive ? (
              <>
                <p className="font-bold text-sm text-white tracking-wide">Assumed office</p>
                <p className="text-sm text-gray-200 mt-1 font-medium tabular-nums">
                  {card.assumedDate}
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm text-white tracking-wide">In office</p>
                <p className="text-sm text-gray-200 mt-1 font-medium tabular-nums">
                  {card.officeDatesFormatted || `(${card.assumedDate} – ${card.vacatedDate})`}
                </p>
              </>
            )}
          </div>

          {/* 4. Metadata Key-Value Rows */}
          {(card.governor || card.chiefMinister || card.speaker || card.precededBy || card.succeededBy || card.constituency) && (
            <div className="border-t border-[#23314E] bg-[#0A1120] divide-y divide-[#18233C]">
              {/* Governor row */}
              {card.governor && (
                <div className="flex items-center justify-between py-2.5 px-6 text-sm">
                  <span className="text-white font-bold w-36 shrink-0">Governor</span>
                  <span
                    onClick={(e) => {
                      if (card.governor?.id) {
                        e.stopPropagation();
                        navigate(`/person/${card.governor.id}`);
                      }
                    }}
                    className={`text-right flex-1 font-medium ${
                      card.governor.id
                        ? 'text-white hover:underline cursor-pointer'
                        : 'text-white'
                    }`}
                  >
                    {card.governor.name}
                  </span>
                </div>
              )}

              {/* Chief Minister row */}
              {card.chiefMinister && (
                <div className="flex items-center justify-between py-2.5 px-6 text-sm">
                  <span className="text-white font-bold w-36 shrink-0">Chief Minister</span>
                  <span
                    onClick={(e) => {
                      if (card.chiefMinister?.id) {
                        e.stopPropagation();
                        navigate(`/person/${card.chiefMinister.id}`);
                      }
                    }}
                    className={`text-right flex-1 font-medium ${
                      card.chiefMinister.id
                        ? 'text-white hover:underline cursor-pointer'
                        : 'text-white'
                    }`}
                  >
                    {card.chiefMinister.name}
                  </span>
                </div>
              )}

              {/* Speaker row (for Deputy Speaker) */}
              {card.speaker && (
                <div className="flex items-center justify-between py-2.5 px-6 text-sm">
                  <span className="text-white font-bold w-36 shrink-0">Speaker</span>
                  <span
                    onClick={(e) => {
                      if (card.speaker?.id) {
                        e.stopPropagation();
                        navigate(`/person/${card.speaker.id}`);
                      }
                    }}
                    className={`text-right flex-1 font-medium ${
                      card.speaker.id
                        ? 'text-white hover:underline cursor-pointer'
                        : 'text-white'
                    }`}
                  >
                    {card.speaker.name}
                  </span>
                </div>
              )}

              {/* Preceded by */}
              {card.precededBy && (
                <div className="flex items-center justify-between py-2.5 px-6 text-sm">
                  <span className="text-white font-bold w-36 shrink-0">Preceded by</span>
                  <span
                    onClick={(e) => {
                      if (card.precededBy?.id) {
                        e.stopPropagation();
                        navigate(`/person/${card.precededBy.id}`);
                      }
                    }}
                    className={`text-right flex-1 font-medium ${
                      card.precededBy.id
                        ? 'text-white hover:underline cursor-pointer'
                        : 'text-white'
                    }`}
                  >
                    {card.precededBy.name}
                  </span>
                </div>
              )}

              {/* Succeeded by (past roles) */}
              {card.succeededBy && (
                <div className="flex items-center justify-between py-2.5 px-6 text-sm">
                  <span className="text-white font-bold w-36 shrink-0">Succeeded by</span>
                  <span
                    onClick={(e) => {
                      if (card.succeededBy?.id) {
                        e.stopPropagation();
                        navigate(`/person/${card.succeededBy.id}`);
                      }
                    }}
                    className={`text-right flex-1 font-medium ${
                      card.succeededBy.id
                        ? 'text-white hover:underline cursor-pointer'
                        : 'text-white'
                    }`}
                  >
                    {card.succeededBy.name}
                  </span>
                </div>
              )}

              {/* Constituency */}
              {card.constituency && (
                <div className="flex items-center justify-between py-2.5 px-6 text-sm">
                  <span className="text-white font-bold w-36 shrink-0">Constituency</span>
                  <span
                    onClick={(e) => {
                      if (card.constituency?.id) {
                        e.stopPropagation();
                        navigate(`/constituency/${card.constituency.id}`);
                      }
                    }}
                    className={`text-right flex-1 font-medium ${
                      card.constituency.id
                        ? 'text-[#5B8DEF] hover:underline cursor-pointer'
                        : 'text-[#5B8DEF]'
                    }`}
                  >
                    {card.constituency.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
