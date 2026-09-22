import { Assembly, Constituency, Party, Alliance, Person, LegislativeOrder } from '../types';
import { db } from '../db';

export interface GovernmentCompositionResult {
  government: any | null;
  governmentMlaIds: Set<string>;
  allMlaIds: Set<string>;
}

/**
 * Checks if a given designation or role name represents the Speaker or Deputy Speaker.
 */
export function isSpeakerOrDeputySpeakerRole(roleName: string): boolean {
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  return lower.includes('speaker');
}

/**
 * Checks if a given designation or role name represents a Ministerial Cabinet role.
 */
export function isMinisterialRole(roleName: string): boolean {
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  return lower.includes('minister');
}

/**
 * Computes the government group and the set of MLA IDs who belong to the government composition.
 */
export function computeAssemblyGovernmentComposition(
  assembly: Assembly | null | undefined,
  constituencies: Constituency[],
  parties: Party[],
  alliances: Alliance[],
  persons: Person[]
): GovernmentCompositionResult {
  if (!assembly) {
    return { government: null, governmentMlaIds: new Set(), allMlaIds: new Set() };
  }

  // If dissolved assembly with saved composition snapshot
  if (!assembly.isActive && assembly.composition?.government) {
    const gov = assembly.composition.government;
    const govParties = new Set<string>((gov.parties || []).map((p: any) => p.id));
    const govAllianceId = gov.id;

    const allMlaIds = new Set<string>();
    const governmentMlaIds = new Set<string>();

    // Linked constituencies
    const targetCs = constituencies.filter(
      c => c.currentAssemblyId === assembly.id ||
      (Array.isArray(c.history) && c.history.some(h => h.assemblyId === assembly.id))
    );

    targetCs.forEach(c => {
      let pId = 'vacant';
      if (c.currentAssemblyId === assembly.id) {
        pId = c.currentIncumbentId;
      } else {
        const hist = (c.history || [])
          .sort((a, b) => b.date - a.date)
          .find(h => h.assemblyId === assembly.id);
        if (hist && hist.personId) pId = hist.personId;
      }

      if (pId && pId !== 'vacant') {
        allMlaIds.add(pId);
        const person = persons.find(p => p.id === pId);
        if (person) {
          const party = parties.find(p => p.id === person.partyId);
          const supAllianceId = assembly.independentSupports?.[person.id];
          const isGov =
            (person.partyId === 'independent' && supAllianceId === govAllianceId) ||
            (party && (party.allianceId === govAllianceId || govParties.has(party.id) || party.id === govAllianceId));
          if (isGov) {
            governmentMlaIds.add(person.id);
          }
        }
      }
    });

    if (Array.isArray(assembly.composition.members)) {
      assembly.composition.members.forEach((m: any) => {
        if (m.id && m.id !== 'vacant') {
          allMlaIds.add(m.id);
          const person = persons.find(p => p.id === m.id);
          if (person) {
            const party = parties.find(p => p.id === person.partyId);
            const supAllianceId = assembly.independentSupports?.[person.id];
            const isGov =
              (person.partyId === 'independent' && supAllianceId === govAllianceId) ||
              (party && (party.allianceId === govAllianceId || govParties.has(party.id) || party.id === govAllianceId));
            if (isGov) {
              governmentMlaIds.add(person.id);
            }
          }
        }
      });
    }

    return { government: gov, governmentMlaIds, allMlaIds };
  }

  // Active or dynamic calculation based on current seating
  const targetCs = constituencies.filter(c => c.currentAssemblyId === assembly.id);
  const allMlaIds = new Set<string>();
  const incumbentPersons: Person[] = [];

  // Create maps for faster lookups
  const personsMap = new Map(persons.map(p => [p.id, p]));
  const partiesMap = new Map(parties.map(p => [p.id, p]));
  const alliancesMap = new Map(alliances.map(a => [a.id, a]));

  targetCs.forEach(c => {
    if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
      allMlaIds.add(c.currentIncumbentId);
      const p = personsMap.get(c.currentIncumbentId);
      if (p) incumbentPersons.push(p);
    }
  });

  const independentSupportMap = assembly.independentSupports || {};

  const groups: {
    [allianceId: string]: {
      id: string;
      name: string;
      abbreviation: string;
      totalSeats: number;
      color: string;
      parties: {
        id: string;
        name: string;
        abbreviation: string;
        seats: number;
        color: string;
      }[];
    };
  } = {};

  incumbentPersons.forEach(person => {
    const party = partiesMap.get(person.partyId);
    let allianceId = party ? party.allianceId : 'independent';

    if (person.partyId === 'independent' && independentSupportMap[person.id]) {
      const supAllianceId = independentSupportMap[person.id];
      if (alliancesMap.has(supAllianceId)) {
        allianceId = supAllianceId;
      }
    }

    if (!allianceId || allianceId === 'independent') {
      if (party) {
        allianceId = party.allianceId || party.id;
      } else {
        allianceId = 'independent';
      }
    }

    const alliance = alliancesMap.get(allianceId);

    if (!groups[allianceId]) {
      groups[allianceId] = {
        id: allianceId,
        name: alliance
          ? alliance.name
          : allianceId === 'independent'
          ? 'Independents'
          : party
          ? party.name
          : allianceId,
        abbreviation: alliance
          ? alliance.abbreviation
          : allianceId === 'independent'
          ? 'IND'
          : party
          ? party.abbreviation
          : allianceId,
        totalSeats: 0,
        color: alliance && alliance.colors ? alliance.colors[0] : party && party.colors ? party.colors[0] : '#666666',
        parties: []
      };
    }

    groups[allianceId].totalSeats += 1;

    if (party) {
      let partyRef = groups[allianceId].parties.find(p => p.id === party.id);
      if (!partyRef) {
        partyRef = {
          id: party.id,
          name: party.name,
          abbreviation: party.abbreviation,
          seats: 0,
          color: party.colors ? party.colors[0] : '#999999'
        };
        groups[allianceId].parties.push(partyRef);
      }
      partyRef.seats += 1;
    } else if (allianceId !== 'independent') {
      let partyRef = groups[allianceId].parties.find(p => p.id === 'independent-supporting');
      if (!partyRef) {
        partyRef = {
          id: 'independent-supporting',
          name: 'Independents (Supporting)',
          abbreviation: 'IND (S)',
          seats: 0,
          color: '#666666'
        };
        groups[allianceId].parties.push(partyRef);
      }
      partyRef.seats += 1;
    }
  });

  const sortedGroups = Object.values(groups).sort((a, b) => b.totalSeats - a.totalSeats);
  const government = sortedGroups[0] || null;

  const governmentMlaIds = new Set<string>();

  if (government) {
    const govAllianceId = government.id;
    const govParties = new Set<string>(government.parties.map(p => p.id));

    incumbentPersons.forEach(person => {
      const party = partiesMap.get(person.partyId);
      const supAllianceId = independentSupportMap[person.id];

      const isGov =
        (person.partyId === 'independent' && supAllianceId === govAllianceId) ||
        (party && (party.allianceId === govAllianceId || govParties.has(party.id) || party.id === govAllianceId));

      if (isGov) {
        governmentMlaIds.add(person.id);
      }
    });
  }

  return {
    government,
    governmentMlaIds,
    allMlaIds
  };
}

/**
 * Asynchronously calculates the government composition and eligible MLA IDs for a given assembly from the database.
 */
export async function getAssemblyGovernmentCompositionAsync(
  assemblyId: string
): Promise<GovernmentCompositionResult> {
  const assembly = await db.assemblies.get(assemblyId);
  if (!assembly) {
    return { government: null, governmentMlaIds: new Set(), allMlaIds: new Set() };
  }

  const constituencies = await db.constituencies.toArray();
  const parties = await db.parties.toArray();
  const alliances = await db.alliances.toArray();
  const persons = await db.persons.toArray();

  return computeAssemblyGovernmentComposition(assembly, constituencies, parties, alliances, persons);
}

/**
 * Determines which assembly a constituency was created in.
 * Checks createdInAssemblyId, history entries, linked assemblies, and chronological scores.
 */
export function getConstituencyCreationAssembly(
  con?: Constituency | null,
  assemblies?: Assembly[] | null
): Assembly | null {
  if (!con || !assemblies || assemblies.length === 0) return null;

  // 1. Explicit createdInAssemblyId
  if (con.createdInAssemblyId) {
    const found = assemblies.find((a) => a.id === con.createdInAssemblyId);
    if (found) return found;
  }

  // 2. Check history entries
  const historyAssemblyIds: { assemblyId: string; date: number }[] = [];
  if (Array.isArray(con.history) && con.history.length > 0) {
    for (const h of con.history) {
      if (h.assemblyId) {
        historyAssemblyIds.push({ assemblyId: h.assemblyId, date: h.date || 0 });
      }
    }
  }

  // Collect candidate assemblies
  const candidateIds = new Set<string>();
  if (con.currentAssemblyId) candidateIds.add(con.currentAssemblyId);
  historyAssemblyIds.forEach((h) => candidateIds.add(h.assemblyId));

  const candidateAssemblies = assemblies.filter((a) => candidateIds.has(a.id));

  if (candidateAssemblies.length === 0) {
    return assemblies.find((a) => a.isActive) || assemblies[0] || null;
  }

  if (candidateAssemblies.length === 1) {
    return candidateAssemblies[0];
  }

  // Sort candidates to find the earliest assembly
  const parseChronologicalScore = (a: Assembly): number => {
    if (a.termLimits) {
      const yearMatch = a.termLimits.match(/\d{4}/);
      if (yearMatch) return parseInt(yearMatch[0], 10);
    }
    if (a.name) {
      const ordinalMatch = a.name.match(/^(\d+)/);
      if (ordinalMatch) return parseInt(ordinalMatch[1], 10);
    }
    return 0;
  };

  const sorted = [...candidateAssemblies].sort((a, b) => {
    const aHist = historyAssemblyIds.filter((h) => h.assemblyId === a.id);
    const bHist = historyAssemblyIds.filter((h) => h.assemblyId === b.id);
    const aMinDate =
      aHist.length > 0 ? Math.min(...aHist.map((h) => h.date)) : Infinity;
    const bMinDate =
      bHist.length > 0 ? Math.min(...bHist.map((h) => h.date)) : Infinity;

    if (aMinDate !== bMinDate && aMinDate !== Infinity && bMinDate !== Infinity) {
      return aMinDate - bMinDate;
    }

    if (b.precededById === a.id) return -1;
    if (a.precededById === b.id) return 1;

    const scoreA = parseChronologicalScore(a);
    const scoreB = parseChronologicalScore(b);
    if (scoreA !== scoreB && scoreA > 0 && scoreB > 0) {
      return scoreA - scoreB;
    }

    return (a.updatedAt || 0) - (b.updatedAt || 0);
  });

  return sorted[0] || null;
}

/**
 * Resolves the currently active assembly from a list of assemblies.
 * Correctly prioritizes:
 * 1. An assembly with explicit `isActive === true`
 * 2. An assembly that is not marked inactive (`isActive !== false`), sorted by highest ordinal/slNo (e.g. 15th > 1st)
 * 3. The highest numbered/latest assembly in the list
 */
export const getActiveAssembly = (assemblies?: Assembly[] | null): Assembly | undefined => {
  if (!assemblies || assemblies.length === 0) return undefined;

  // 1. Explicitly active
  const explicitlyActive = assemblies.find((a) => a && a.isActive === true);
  if (explicitlyActive) return explicitlyActive;

  // Helper to extract ordinal/numeric number from assembly
  const getAssemblyNum = (a: Assembly): number => {
    if (a.slNo) {
      const parsed = parseInt(String(a.slNo), 10);
      if (!isNaN(parsed)) return parsed;
    }
    const match = a.name?.match(/\b(\d+)(?:st|nd|rd|th)?\b/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
    const idMatch = a.id?.match(/\b(\d+)\b/);
    if (idMatch) {
      const parsed = parseInt(idMatch[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  };

  // 2. Candidates where isActive !== false
  const candidates = assemblies.filter((a) => a && a.isActive !== false);
  if (candidates.length > 0) {
    return [...candidates].sort((a, b) => getAssemblyNum(b) - getAssemblyNum(a))[0];
  }

  // 3. Fallback: highest numeric ordinal in the entire list
  return [...assemblies].sort((a, b) => getAssemblyNum(b) - getAssemblyNum(a))[0];
};

/**
 * Extracts a normalized Unix millisecond timestamp from an order for chronological sorting.
 * Handles ISO dates (YYYY-MM-DD), slash/dot dates (DD/MM/YYYY or YYYY/MM/DD), fallback timestamps and creation time.
 */
export function getOrderChronologicalTime(order: LegislativeOrder): number {
  if (order.date) {
    const trimmed = order.date.trim();
    // ISO format: YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const dt = new Date(year, month, day).getTime();
      if (!isNaN(dt)) return dt;
    }
    // DD-MM-YYYY or DD/MM/YYYY format
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const dt = new Date(year, month, day).getTime();
      if (!isNaN(dt)) return dt;
    }
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof order.timestamp === 'number' && !isNaN(order.timestamp) && order.timestamp > 0) {
    return order.timestamp;
  }
  if (typeof order.createdAt === 'number' && !isNaN(order.createdAt) && order.createdAt > 0) {
    return order.createdAt;
  }
  return 0;
}

/**
 * Compares two orders in reverse chronological order:
 * 1. Issuance Date descending (newest issuance date first)
 * 2. Sl. No. descending (higher serial numbers within same date first)
 * 3. Creation / release timestamp descending (most recently saved first)
 * 4. Stable tie-break by ID
 */
export function compareOrdersReverseChronological(a: LegislativeOrder, b: LegislativeOrder): number {
  const timeA = getOrderChronologicalTime(a);
  const timeB = getOrderChronologicalTime(b);

  // 1. Issuance date descending (newest date first)
  if (timeB !== timeA) {
    return timeB - timeA;
  }

  // 2. If same date, check Sl. No. numeric value descending (e.g. Sl. 2 before Sl. 1)
  const parseSl = (sl?: string): number => {
    if (!sl) return 0;
    const match = sl.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };
  const slA = parseSl(a.slNo || a.orderNumber);
  const slB = parseSl(b.slNo || b.orderNumber);
  if (slB !== slA) {
    return slB - slA;
  }

  // 3. If same slNo, latest creation time descending
  const createdA = a.createdAt || a.timestamp || 0;
  const createdB = b.createdAt || b.timestamp || 0;
  if (createdB !== createdA) {
    return createdB - createdA;
  }

  return (b.id || '').localeCompare(a.id || '');
}

/**
 * Prefixes a role with "Hon'ble" if it's a ministerial or leadership role.
 */
export const prefixRole = (role: string): string => {
  const trimmed = role.trim();
  const lower = trimmed.toLowerCase();
  
  if (lower.startsWith("hon'ble") || lower.startsWith("honourable") || lower.startsWith("honorable")) {
    return trimmed;
  }

  const isMinister = lower.includes("minister");
  const isSpeaker = lower.includes("speaker");

  if (isMinister || isSpeaker) {
    let displayName = trimmed;
    if (lower === "chiefminister" || lower === "chief minister") {
      displayName = "Chief Minister";
    } else if (lower === "deputychiefminister" || lower === "deputy chief minister") {
      displayName = "Deputy Chief Minister";
    } else if (lower === "speaker" || lower === "speaker of the house" || lower === "speaker of the assembly") {
      displayName = "Speaker";
    } else if (lower === "deputyspeaker" || lower === "deputy speaker" || lower === "deputy speaker of the assembly" || lower === "deputy speaker of the house") {
      displayName = "Deputy Speaker";
    } else {
      displayName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    
    return `Hon'ble ${displayName}`;
  }
  return trimmed;
};

/**
 * Formats a comma-separated list of roles with Hon'ble prefixes.
 */
export const formatCommaSeparatedRoles = (rolesStr: string): string => {
  if (!rolesStr) return "";
  return rolesStr.split(", ").map(r => prefixRole(r)).join(", ");
};

/**
 * Formats a person's name with Shri/Smt prefix based on gender.
 * Only adds the prefix if hasDesignation is true.
 */
export const formatPersonName = (name: string, gender?: string, hasDesignation: boolean = true): string => {
  if (!name) return "";
  const trimmedName = name.trim();
  
  if (!hasDesignation) {
    // If we shouldn't have a prefix, try to remove it if it exists
    return trimmedName.replace(/^(Shri\s+|Smt\.\s+|Shri\.\s+|Smt\s+)/i, '');
  }

  const prefix = gender?.toLowerCase() === 'female' ? 'Smt.' : 'Shri';
  
  // Check if already has prefix
  const hasPrefix = trimmedName.startsWith('Shri ') || 
                    trimmedName.startsWith('Smt. ') || 
                    trimmedName.startsWith('Shri.') ||
                    trimmedName.startsWith('Smt ');
                    
  if (hasPrefix) return trimmedName;
  return `${prefix} ${trimmedName}`;
};


