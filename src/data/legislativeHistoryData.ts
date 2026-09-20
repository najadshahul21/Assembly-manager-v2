import { LegislativeSessionRow, LegislativeSessionMember } from '../components/LegislativeSessionsTable';
import { Assembly, Constituency, Designation, Person, Party, Alliance, EntityType } from '../types';
import { formatPersonName } from '../utils/governmentUtils';

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
    
    // Group all historical and current data by Assembly
    const assemblyGroups: Record<string, LegislativeSessionMember[]> = {};
    const assemblyInfo: Record<string, { ordinal: string; name: string; id: string }> = {};

    // 1. Process known historical dataset
    const cleanKey = (con.name || con.id || '')
      .toLowerCase()
      .replace(/^con-/, '')
      .replace(/[^a-z0-9]/g, '');

    const matchedHistoryKey = Object.keys(KNOWN_CONSTITUENCY_SESSIONS).find((k) =>
      cleanKey.includes(k) || k.includes(cleanKey)
    );

    if (matchedHistoryKey) {
      const historicalList = KNOWN_CONSTITUENCY_SESSIONS[matchedHistoryKey];
      historicalList.forEach((item) => {
        let memberId = item.memberId;
        if (!memberId) {
          const found = persons.find(
            (p) => p.name.trim().toLowerCase() === item.memberName.trim().toLowerCase()
          );
          if (found) memberId = found.id;
        }

        const numMatch = item.assemblyOrdinal.match(/\d+/);
        let assemblyId = `asm-${numMatch ? numMatch[0] : 'unknown'}`;
        if (numMatch) {
          const asm = assemblies.find((a) =>
            a.name.toLowerCase().includes(`${numMatch[0]}th`) || a.id.includes(numMatch[0])
          );
          if (asm) assemblyId = asm.id;
        }

        if (!assemblyGroups[assemblyId]) assemblyGroups[assemblyId] = [];
        assemblyGroups[assemblyId].push({
          memberName: item.memberName,
          memberId,
          partyName: item.partyName,
          partyColor: item.partyColor,
          partyId: item.partyId
        });
        assemblyInfo[assemblyId] = {
          ordinal: item.assemblyOrdinal,
          name: `${item.assemblyOrdinal} Legislative Assembly`,
          id: assemblyId
        };
      });
    }

    // 2. Process con.history
    if (Array.isArray(con.history)) {
      const conHistory = [...con.history].sort((a, b) => a.date - b.date);
      conHistory.forEach((h) => {
        if (h.reason === "election" || h.reason === "appointment") {
          const asm = h.assemblyId ? assembliesMap[h.assemblyId] : null;
          const asmId = asm?.id || h.assemblyId || "unknown";
          const ordinal = asm ? extractOrdinal(asm.name) : extractOrdinal(h.assemblyId || "");
          
          const person = h.personId ? personsMap[h.personId] : null;
          const partyDetails = resolvePartyDetails(person?.partyId, partiesMap, alliancesMap);
          
          const previousInAsm = conHistory.find(prev => 
            prev.assemblyId === h.assemblyId && 
            prev.date < h.date && 
            (prev.reason === "election" || prev.reason === "appointment")
          );

          const removal = conHistory.find(rem => 
            rem.assemblyId === h.assemblyId && 
            rem.personId === h.personId && 
            rem.date >= h.date &&
            rem.reason !== "election" && rem.reason !== "appointment"
          );

          if (!assemblyGroups[asmId]) assemblyGroups[asmId] = [];
          
          // Avoid duplicate person entries in the same assembly unless it's a distinct term (rare)
          const alreadyListed = assemblyGroups[asmId].some(m => m.memberId === h.personId);
          if (!alreadyListed) {
            assemblyGroups[asmId].push({
              memberName: person ? formatPersonName(person.name, person.gender, !!asm?.isActive) : (h.personId && h.personId !== "vacant" ? h.personId : "Vacant"),
              memberId: person?.id || h.personId,
              partyName: partyDetails.partyName,
              partyColor: partyDetails.partyColor,
              partyId: person?.partyId,
              reason: removal?.reason,
              electionDate: h.date,
              removalDate: removal?.date,
              isByelected: !!previousInAsm
            });
          }

          if (!assemblyInfo[asmId]) {
            assemblyInfo[asmId] = {
              ordinal: ordinal || "Unknown",
              name: asm?.name || `${ordinal} Legislative Assembly`,
              id: asmId
            };
          }
        }
      });
    }

    // 3. Process Current Assembly Session (even if vacant)
    if (con.currentAssemblyId) {
      const asmId = con.currentAssemblyId;
      const asm = assembliesMap[asmId];
      const ordinal = asm ? extractOrdinal(asm.name) : "15th";
      const currentPerson = con.currentIncumbentId && con.currentIncumbentId !== "vacant" ? personsMap[con.currentIncumbentId] : null;
      const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);

      if (!assemblyGroups[asmId]) assemblyGroups[asmId] = [];
      const alreadyListed = assemblyGroups[asmId].some(m => m.memberId === con.currentIncumbentId);
      
      if (!alreadyListed) {
        const previousInAsm = con.history?.some(h => 
          h.assemblyId === asmId && 
          (h.reason === "election" || h.reason === "appointment") &&
          h.personId !== con.currentIncumbentId
        );

        assemblyGroups[asmId].push({
          memberName: currentPerson?.name || (con.currentIncumbentId === 'vacant' ? 'Vacant' : con.currentIncumbentId),
          memberId: currentPerson?.id || con.currentIncumbentId,
          partyName: partyDetails.partyName,
          partyColor: partyDetails.partyColor,
          partyId: currentPerson?.partyId,
          electionDate: con.updatedAt,
          isByelected: !!previousInAsm
        });
      }

      if (!assemblyInfo[asmId]) {
        assemblyInfo[asmId] = {
          ordinal,
          name: asm?.name || `${ordinal} Legislative Assembly`,
          id: asmId
        };
      }
    }

    // Convert Groups to Rows and Sort
    const sortedAssemblyIds = Object.keys(assemblyGroups).sort((a, b) => {
      const ordA = assemblyInfo[a]?.ordinal || "";
      const ordB = assemblyInfo[b]?.ordinal || "";
      const numA = parseInt(ordA.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(ordB.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    sortedAssemblyIds.forEach((asmId) => {
      const info = assemblyInfo[asmId];
      const assemblyNumber = parseInt(info.ordinal.replace(/\D/g, ''), 10);
      
      rows.push({
        id: `con-row-${asmId}`,
        assemblyOrdinal: info.ordinal,
        assemblyName: info.name,
        assemblyId: info.id,
        slNo: isNaN(assemblyNumber) ? undefined : assemblyNumber,
        members: assemblyGroups[asmId].sort((a, b) => (a.electionDate || 0) - (b.electionDate || 0))
      });
    });

    // Fallback if empty
    if (rows.length === 0 && con.currentAssemblyId) {
      const asm = assembliesMap[con.currentAssemblyId];
      const ordinal = asm ? extractOrdinal(asm.name) : extractOrdinal(con.currentAssemblyId);
      const currentPerson = con.currentIncumbentId && con.currentIncumbentId !== 'vacant' ? personsMap[con.currentIncumbentId] : null;
      const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);
      
      rows.push({
        id: `fallback-${con.id}`,
        assemblyOrdinal: ordinal,
        assemblyName: asm?.name || `${ordinal} Kerala Legislative Assembly`,
        assemblyId: con.currentAssemblyId,
        slNo: parseInt(ordinal.replace(/\D/g, ''), 10) || 1,
        members: [{
          memberName: currentPerson ? formatPersonName(currentPerson.name, currentPerson.gender, !!asm?.isActive) : 'Vacant',
          memberId: currentPerson?.id,
          partyName: partyDetails.partyName,
          partyColor: partyDetails.partyColor,
          partyId: currentPerson?.partyId
        }]
      });
    }
  } else if (entityType === EntityType.DESIGNATION) {
    const desig = entity as Designation;
    const isGovernor = desig.name?.toLowerCase().includes('governor') || desig.id?.toLowerCase().includes('governor');

    if (isGovernor) {
      // Special logic for Governor: No assembly grouping, sequential slNo based on incumbents
      let governorSeq = 0;
      
      // 1. Process known historical dataset
      const cleanName = (desig.name || desig.id || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');

      const matchedHistoryKey = Object.keys(KNOWN_DESIGNATION_SESSIONS).find((k) =>
        cleanName.includes(k) || k.includes(cleanName)
      );

      if (matchedHistoryKey) {
        const historicalList = KNOWN_DESIGNATION_SESSIONS[matchedHistoryKey];
        historicalList.forEach((item) => {
          governorSeq++;
          let memberId = item.memberId;
          if (!memberId) {
            const found = persons.find(
              (p) => p.name.trim().toLowerCase() === item.memberName.trim().toLowerCase()
            );
            if (found) memberId = found.id;
          }

          rows.push({
            id: `gov-seed-${governorSeq}`,
            assemblyOrdinal: "", // No assembly for governor
            assemblyName: "",
            slNo: governorSeq,
            members: [{
              memberName: item.memberName,
              memberId,
              partyName: item.partyName,
              partyColor: item.partyColor,
              partyId: item.partyId
            }]
          });
        });
      }

      // 2. Process desig.history
      if (Array.isArray(desig.history)) {
        const sortedHistory = [...desig.history].sort((a, b) => a.date - b.date);
        sortedHistory.forEach((h, idx) => {
          governorSeq++;
          const person = h.personId ? personsMap[h.personId] : null;
          const partyDetails = resolvePartyDetails(person?.partyId, partiesMap, alliancesMap);
          
          rows.push({
            id: `gov-hist-${idx}`,
            assemblyOrdinal: "",
            assemblyName: "",
            slNo: governorSeq,
            members: [{
              memberName: person?.name || (h.personId && h.personId !== 'vacant' ? h.personId : 'Vacant'),
              memberId: person?.id || h.personId,
              partyName: partyDetails.partyName,
              partyColor: partyDetails.partyColor,
              partyId: person?.partyId
            }]
          });
        });
      }

      // 3. Current incumbent
      if (desig.incumbentId && desig.incumbentId !== 'vacant') {
        const alreadyListed = rows.some(r => r.members.some(m => m.memberId === desig.incumbentId));
        if (!alreadyListed) {
          governorSeq++;
          const currentPerson = personsMap[desig.incumbentId];
          const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);
          
          rows.push({
            id: `gov-current-${desig.id}`,
            assemblyOrdinal: "",
            assemblyName: "",
            slNo: governorSeq,
            members: [{
              memberName: currentPerson?.name || desig.incumbentId,
              memberId: currentPerson?.id || desig.incumbentId,
              partyName: partyDetails.partyName,
              partyColor: partyDetails.partyColor,
              partyId: currentPerson?.partyId
            }]
          });
        }
      }
      
      return rows; // Return early for governor
    }

    // Existing assembly grouping logic for other designations
    const assemblyGroups: Record<string, LegislativeSessionMember[]> = {};
    const assemblyInfo: Record<string, { ordinal: string; name: string; id: string }> = {};

    // 1. Known historical dataset
    const cleanName = (desig.name || desig.id || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');

    const matchedHistoryKey = Object.keys(KNOWN_DESIGNATION_SESSIONS).find((k) =>
      cleanName.includes(k) || k.includes(cleanName)
    );

    if (matchedHistoryKey) {
      const historicalList = KNOWN_DESIGNATION_SESSIONS[matchedHistoryKey];
      historicalList.forEach((item) => {
        let memberId = item.memberId;
        if (!memberId) {
          const found = persons.find(
            (p) => p.name.trim().toLowerCase() === item.memberName.trim().toLowerCase()
          );
          if (found) memberId = found.id;
        }

        const numMatch = item.assemblyOrdinal.match(/\d+/);
        let assemblyId = `asm-${numMatch ? numMatch[0] : 'unknown'}`;
        if (numMatch) {
          const asm = assemblies.find((a) =>
            a.name.toLowerCase().includes(`${numMatch[0]}th`) || a.id.includes(numMatch[0])
          );
          if (asm) assemblyId = asm.id;
        }

        if (!assemblyGroups[assemblyId]) assemblyGroups[assemblyId] = [];
        assemblyGroups[assemblyId].push({
          memberName: item.memberName,
          memberId,
          partyName: item.partyName,
          partyColor: item.partyColor,
          partyId: item.partyId
        });
        assemblyInfo[assemblyId] = {
          ordinal: item.assemblyOrdinal,
          name: `${item.assemblyOrdinal} Legislative Session`,
          id: assemblyId
        };
      });
    }

    // 2. desig.history
    if (Array.isArray(desig.history)) {
      desig.history.forEach((h, idx) => {
        const person = h.personId ? personsMap[h.personId] : null;
        const partyDetails = resolvePartyDetails(person?.partyId, partiesMap, alliancesMap);
        const asmId = (h as any).assemblyId || "unknown";
        const asm = assembliesMap[asmId];
        const ordinal = asm ? extractOrdinal(asm.name) : extractOrdinal(asmId, idx);

        if (!assemblyGroups[asmId]) assemblyGroups[asmId] = [];
        const alreadyListed = assemblyGroups[asmId].some(m => m.memberId === h.personId);
        if (!alreadyListed) {
          assemblyGroups[asmId].push({
            memberName: person ? formatPersonName(person.name, person.gender, !!asm?.isActive) : (h.personId && h.personId !== 'vacant' ? h.personId : 'Vacant'),
            memberId: person?.id || h.personId,
            partyName: partyDetails.partyName,
            partyColor: partyDetails.partyColor,
            partyId: person?.partyId
          });
        }

        if (!assemblyInfo[asmId]) {
          assemblyInfo[asmId] = {
            ordinal,
            name: asm?.name || `${ordinal} Legislative Session`,
            id: asmId
          };
        }
      });
    }

    // 3. Current incumbent
    if (desig.assemblyId || desig.incumbentId) {
      const asmId = desig.assemblyId || "current";
      const asm = assembliesMap[asmId];
      const ordinal = asm ? extractOrdinal(asm.name) : extractOrdinal(asmId);
      const currentPerson = desig.incumbentId ? personsMap[desig.incumbentId] : null;
      const partyDetails = resolvePartyDetails(currentPerson?.partyId, partiesMap, alliancesMap);

      if (!assemblyGroups[asmId]) assemblyGroups[asmId] = [];
      const alreadyListed = assemblyGroups[asmId].some(m => m.memberId === desig.incumbentId);
      if (!alreadyListed) {
        assemblyGroups[asmId].push({
          memberName: currentPerson ? formatPersonName(currentPerson.name, currentPerson.gender, !!asm?.isActive) : (desig.incumbentId && desig.incumbentId !== 'vacant' ? desig.incumbentId : 'Vacant'),
          memberId: currentPerson?.id || desig.incumbentId,
          partyName: partyDetails.partyName,
          partyColor: partyDetails.partyColor,
          partyId: currentPerson?.partyId
        });
      }

      if (!assemblyInfo[asmId]) {
        assemblyInfo[asmId] = {
          ordinal,
          name: asm?.name || `${ordinal} Legislative Session`,
          id: asmId
        };
      }
    }

    const sortedAssemblyIds = Object.keys(assemblyGroups).sort((a, b) => {
      const ordA = assemblyInfo[a]?.ordinal || "";
      const ordB = assemblyInfo[b]?.ordinal || "";
      const numA = parseInt(ordA.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(ordB.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    sortedAssemblyIds.forEach((asmId) => {
      const info = assemblyInfo[asmId];
      const assemblyNumber = parseInt(info.ordinal.replace(/\D/g, ''), 10);

      rows.push({
        id: `desig-row-${asmId}`,
        assemblyOrdinal: info.ordinal,
        assemblyName: info.name,
        assemblyId: info.id,
        slNo: isNaN(assemblyNumber) ? undefined : assemblyNumber,
        members: assemblyGroups[asmId]
      });
    });
  }

  return rows;
};