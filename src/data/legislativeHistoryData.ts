import { LegislativeSessionRow } from '../components/LegislativeSessionsTable';
import { Assembly, Constituency, Designation, Person, Party, Alliance, EntityType } from '../types';

export const getOrdinal = (n: number | string): string => {
  const num = typeof n === 'string' ? parseInt(n.replace(/\D/g, ''), 10) : n;
  if (isNaN(num)) return String(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const extractOrdinal = (assemblyName: string, fallbackIdx?: number): string => {
  if (!assemblyName) return fallbackIdx !== undefined ? getOrdinal(fallbackIdx + 1) : '';
  const match = assemblyName.match(/(\d+(?:st|nd|rd|th))/i);
  if (match) return match[1].toLowerCase();
  const numMatch = assemblyName.match(/\b(\d+)\b/);
  if (numMatch) return getOrdinal(parseInt(numMatch[1], 10));
  return assemblyName;
};

// Map known parties to their clean colors and full names
export const PARTY_COLOR_MAP: Record<string, { name: string; color: string }> = {
  inc: { name: 'Indian National Congress', color: '#00A3E0' },
  congress: { name: 'Indian National Congress', color: '#00A3E0' },
  iuml: { name: 'Indian Union Muslim League', color: '#16a34a' },
  'muslim-league': { name: 'Indian Union Muslim League', color: '#16a34a' },
  cpim: { name: 'Communist Party of India (Marxist)', color: '#dc2626' },
  'cpi(m)': { name: 'Communist Party of India (Marxist)', color: '#dc2626' },
  cpi: { name: 'Communist Party of India', color: '#dc2626' },
  ldf: { name: 'Left Democratic Front', color: '#dc2626' },
  udf: { name: 'United Democratic Front', color: '#00A3E0' },
  bjp: { name: 'Bharatiya Janata Party', color: '#f97316' },
  nda: { name: 'National Democratic Alliance', color: '#f97316' },
  kcm: { name: 'Kerala Congress (M)', color: '#ca8a04' },
  kc: { name: 'Kerala Congress', color: '#16a34a' },
  ncp: { name: 'Nationalist Congress Party', color: '#0891b2' },
  jds: { name: 'Janata Dal (Secular)', color: '#15803d' },
  rmpi: { name: 'Revolutionary Marxist Party of India', color: '#b91c1c' },
  psp: { name: 'Praja Socialist Party', color: '#ea580c' },
  independent: { name: 'Independent', color: '#64748b' },
  ind: { name: 'Independent', color: '#64748b' }
};

// Known authentic Kerala assembly constituency historical sessions
export const KNOWN_CONSTITUENCY_SESSIONS: Record<
  string,
  Array<{
    assemblyOrdinal: string;
    memberName: string;
    partyName: string;
    partyColor: string;
    memberId?: string;
    partyId?: string;
  }>
> = {};

// Known designations historical sessions
export const KNOWN_DESIGNATION_SESSIONS: Record<
  string,
  Array<{
    assemblyOrdinal: string;
    memberName: string;
    partyName: string;
    partyColor: string;
    memberId?: string;
    partyId?: string;
  }>
> = {};

// Helper to resolve clean party information
export const resolvePartyDetails = (
  partyId?: string,
  partiesMap: Record<string, Party> = {},
  alliancesMap: Record<string, Alliance> = {}
) => {
  if (!partyId || partyId === 'independent' || partyId === 'ind') {
    return {
      partyName: 'Independent',
      partyColor: '#64748b'
    };
  }

  const pObj = partiesMap[partyId];
  if (pObj) {
    const alliance = pObj.allianceId ? alliancesMap[pObj.allianceId] : null;
    const mapped = PARTY_COLOR_MAP[partyId.toLowerCase()] || PARTY_COLOR_MAP[pObj.abbreviation?.toLowerCase() || ''];
    return {
      partyName: mapped?.name || pObj.name || pObj.abbreviation,
      partyColor: mapped?.color || pObj.colors?.[0] || alliance?.colors?.[0] || '#00A3E0'
    };
  }

  const mapped = PARTY_COLOR_MAP[partyId.toLowerCase()];
  if (mapped) {
    return {
      partyName: mapped.name,
      partyColor: mapped.color
    };
  }

  return {
    partyName: partyId,
    partyColor: '#00A3E0'
  };
};

// Main Resolver for Constituency or Designation Sessions
export const buildLegislativeSessionsList = ({
  entityType,
  entity,
  assemblies = [],
  persons = [],
  parties = [],
  alliances = [],
  designations = []
}: {
  entityType: EntityType;
  entity: any;
  assemblies?: Assembly[];
  persons?: Person[];
  parties?: Party[];
  alliances?: Alliance[];
  designations?: Designation[];
}): LegislativeSessionRow[] => {
  if (!entity) return [];

  const partiesMap = Object.fromEntries(parties.map((p) => [p.id, p]));
  const alliancesMap = Object.fromEntries(alliances.map((a) => [a.id, a]));
  const personsMap = Object.fromEntries(persons.map((p) => [p.id, p]));
  const assembliesMap = Object.fromEntries(assemblies.map((a) => [a.id, a]));

  const rows: LegislativeSessionRow[] = [];

  if (entityType === EntityType.CONSTITUENCY) {
    const con = entity as Constituency;
    const cleanKey = (con.name || con.id || '')
      .toLowerCase()
      .replace(/^con-/, '')
      .replace(/[^a-z0-9]/g, '');

    // 1. Check known historical dataset for this constituency
    const matchedHistoryKey = Object.keys(KNOWN_CONSTITUENCY_SESSIONS).find((k) =>
      cleanKey.includes(k) || k.includes(cleanKey)
    );

    if (matchedHistoryKey) {
      const historicalList = KNOWN_CONSTITUENCY_SESSIONS[matchedHistoryKey];
      historicalList.forEach((item, idx) => {
        // Resolve person ID if in our database
        let memberId = item.memberId;
        if (!memberId) {
          const found = persons.find(
            (p) => p.name.trim().toLowerCase() === item.memberName.trim().toLowerCase()
          );
          if (found) memberId = found.id;
        }

        // Resolve assembly ID if in our database
        const numMatch = item.assemblyOrdinal.match(/\d+/);
        let assemblyId: string | undefined;
        if (numMatch) {
          const asm = assemblies.find((a) =>
            a.name.toLowerCase().includes(`${numMatch[0]}th`) || a.id.includes(numMatch[0])
          );
          if (asm) assemblyId = asm.id;
        }

        rows.push({
          id: `seed-${idx}-${item.assemblyOrdinal}`,
          assemblyOrdinal: item.assemblyOrdinal,
          assemblyName: `${item.assemblyOrdinal} Kerala Legislative Assembly`,
          assemblyId,
          memberName: item.memberName,
          memberId,
          partyName: item.partyName,
          partyColor: item.partyColor,
          partyId: item.partyId
        });
      });
    }

    // 2. Incorporate records from `con.history`
    if (Array.isArray(con.history)) {
      const conHistory = con.history.sort((a, b) => a.date - b.date);
      const processedAsmPersons = new Set<string>();

      conHistory.forEach((h, idx) => {
        const asm = h.assemblyId ? assembliesMap[h.assemblyId] : null;
        const ordinal = asm ? extractOrdinal(asm.name, idx) : extractOrdinal(h.assemblyId || "", idx);
        
        // We only care about people who were elected/appointed
        if (h.reason === "election" || h.reason === "appointment") {
          const person = h.personId ? personsMap[h.personId] : null;
          const partyDetails = resolvePartyDetails(person?.partyId, partiesMap, alliancesMap);
          
          const asmId = asm?.id || h.assemblyId;
          const asmKey = `${asmId}-${h.personId}`;
          
          if (!processedAsmPersons.has(asmKey)) {
            processedAsmPersons.add(asmKey);
            
            // Check if this is a by-election (not the first election in this assembly)
            const previousInAsm = conHistory.find(prev => 
              prev.assemblyId === h.assemblyId && 
              prev.date < h.date && 
              (prev.reason === "election" || prev.reason === "appointment")
            );

            // Find removal reason for THIS person in THIS assembly
            const removal = conHistory.find(rem => 
              rem.assemblyId === h.assemblyId && 
              rem.personId === h.personId && 
              rem.date >= h.date &&
              rem.reason !== "election" && rem.reason !== "appointment"
            );

            rows.push({
              id: `hist-${idx}-${ordinal}`,
              assemblyOrdinal: ordinal || `${idx + 1}th`,
              assemblyName: asm?.name || `${ordinal} Legislative Assembly`,
              assemblyId: asmId,
              memberName: person?.name || (h.personId && h.personId !== "vacant" ? h.personId : "Vacant"),
              memberId: person?.id || h.personId,
              partyName: partyDetails.partyName,
              partyColor: partyDetails.partyColor,
              partyId: person?.partyId,
              reason: removal?.reason, // Show removal reason if they left
              electionDate: h.date,
              isByelected: !!previousInAsm
            });
          }
        }
      });
    }

    // 3. Current active incumbent if not already in history
    if (con.currentAssemblyId) {
      const currentAsm = assembliesMap[con.currentAssemblyId];
      const ordinal = currentAsm ? extractOrdinal(currentAsm.name, 14) : "15th";
      const currentPerson = con.currentIncumbentId ? personsMap[con.currentIncumbentId] : null;
      
      const exists = rows.some(r => r.assemblyId === con.currentAssemblyId && r.memberId === con.currentIncumbentId);
      
      if (!exists && con.currentIncumbentId !== "vacant") {
        const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);
        
        // Check if there was any previous incumbent in this assembly
        const previousInAsm = con.history?.some(h => 
          h.assemblyId === con.currentAssemblyId && 
          (h.reason === "election" || h.reason === "appointment") &&
          h.personId !== con.currentIncumbentId
        );

        rows.push({
          id: `current-${con.id}`,
          assemblyOrdinal: ordinal,
          assemblyName: currentAsm?.name || `${ordinal} Legislative Assembly`,
          assemblyId: currentAsm?.id || con.currentAssemblyId,
          memberName: currentPerson?.name || con.currentIncumbentId,
          memberId: currentPerson?.id || con.currentIncumbentId,
          partyName: partyDetails.partyName,
          partyColor: partyDetails.partyColor,
          partyId: currentPerson?.partyId,
          electionDate: con.updatedAt,
          isByelected: !!previousInAsm
        });
      }
    }

    // Fallback if no history exists at all
    if (rows.length === 0) {
      const currentPerson = con.currentIncumbentId ? personsMap[con.currentIncumbentId] : null;
      const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);
      rows.push({
        id: `current-${con.id}`,
        assemblyOrdinal: '15th',
        assemblyName: '15th Kerala Legislative Assembly',
        assemblyId: con.currentAssemblyId || '15th-assembly',
        memberName: currentPerson?.name || 'Vacant',
        memberId: currentPerson?.id,
        partyName: partyDetails.partyName,
        partyColor: partyDetails.partyColor,
        partyId: currentPerson?.partyId
      });
    }
  } else if (entityType === EntityType.DESIGNATION) {
    const desig = entity as Designation;
    const cleanName = (desig.name || desig.id || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');

    // 1. Check known historical dataset for this designation
    const matchedHistoryKey = Object.keys(KNOWN_DESIGNATION_SESSIONS).find((k) =>
      cleanName.includes(k) || k.includes(cleanName)
    );

    if (matchedHistoryKey) {
      const historicalList = KNOWN_DESIGNATION_SESSIONS[matchedHistoryKey];
      historicalList.forEach((item, idx) => {
        let memberId = item.memberId;
        if (!memberId) {
          const found = persons.find(
            (p) => p.name.trim().toLowerCase() === item.memberName.trim().toLowerCase()
          );
          if (found) memberId = found.id;
        }

        const numMatch = item.assemblyOrdinal.match(/\d+/);
        let assemblyId: string | undefined;
        if (numMatch) {
          const asm = assemblies.find((a) =>
            a.name.toLowerCase().includes(`${numMatch[0]}th`) || a.id.includes(numMatch[0])
          );
          if (asm) assemblyId = asm.id;
        }

        rows.push({
          id: `desig-seed-${idx}-${item.assemblyOrdinal}`,
          assemblyOrdinal: item.assemblyOrdinal,
          assemblyName: `${item.assemblyOrdinal} Legislative Session`,
          assemblyId,
          memberName: item.memberName,
          memberId,
          partyName: item.partyName,
          partyColor: item.partyColor,
          partyId: item.partyId
        });
      });
    }

    // 2. Add records from `desig.history`
    if (Array.isArray(desig.history)) {
      desig.history.forEach((h, idx) => {
        const person = h.personId ? personsMap[h.personId] : null;
        const partyDetails = resolvePartyDetails(person?.partyId, partiesMap, alliancesMap);
        const ordinal = (h as any).assemblyId
          ? extractOrdinal((h as any).assemblyId, idx)
          : getOrdinal(idx + 1);

        const existingIdx = rows.findIndex(
          (r) => r.assemblyOrdinal.toLowerCase() === ordinal.toLowerCase()
        );

        const newRow: LegislativeSessionRow = {
          id: `desig-hist-${idx}-${ordinal}`,
          assemblyOrdinal: ordinal,
          assemblyName: `${ordinal} Legislative Session`,
          assemblyId: (h as any).assemblyId,
          memberName: person?.name || (h.personId && h.personId !== 'vacant' ? h.personId : 'Vacant'),
          memberId: person?.id || h.personId,
          partyName: partyDetails.partyName,
          partyColor: partyDetails.partyColor,
          partyId: person?.partyId
        };

        if (existingIdx >= 0) {
          rows[existingIdx] = newRow;
        } else {
          rows.push(newRow);
        }
      });
    }

    // 3. Current incumbent for this designation
    if (desig.assemblyId || desig.incumbentId) {
      const currentAsm = desig.assemblyId ? assembliesMap[desig.assemblyId] : null;
      const ordinal = currentAsm ? extractOrdinal(currentAsm.name, 14) : '15th';
      const currentPerson = desig.incumbentId ? personsMap[desig.incumbentId] : null;
      const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);

      const existingIdx = rows.findIndex(
        (r) => r.assemblyOrdinal.toLowerCase() === ordinal.toLowerCase()
      );

      const currentRow: LegislativeSessionRow = {
        id: `current-desig-${desig.id}`,
        assemblyOrdinal: ordinal,
        assemblyName: currentAsm?.name || `${ordinal} Legislative Session`,
        assemblyId: currentAsm?.id || desig.assemblyId,
        memberName: currentPerson?.name || (desig.incumbentId && desig.incumbentId !== 'vacant' ? desig.incumbentId : 'Vacant'),
        memberId: currentPerson?.id || desig.incumbentId,
        partyName: partyDetails.partyName,
        partyColor: partyDetails.partyColor,
        partyId: currentPerson?.partyId
      };

      if (existingIdx >= 0) {
        rows[existingIdx] = currentRow;
      } else {
        rows.push(currentRow);
      }
    }

    // Fallback if empty
    if (rows.length === 0) {
      const currentPerson = desig.incumbentId ? personsMap[desig.incumbentId] : null;
      const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);
      rows.push({
        id: `current-desig-${desig.id}`,
        assemblyOrdinal: '15th',
        assemblyName: '15th Legislative Session',
        assemblyId: desig.assemblyId || '15th-assembly',
        memberName: currentPerson?.name || 'Vacant',
        memberId: currentPerson?.id,
        partyName: partyDetails.partyName,
        partyColor: partyDetails.partyColor,
        partyId: currentPerson?.partyId
      });
    }
  }

  // Sort rows chronologically by ordinal number (e.g. 1st, 2nd, 5th, 6th, ... 15th)
  return rows.sort((a, b) => {
    const numA = parseInt(a.assemblyOrdinal.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.assemblyOrdinal.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
};
