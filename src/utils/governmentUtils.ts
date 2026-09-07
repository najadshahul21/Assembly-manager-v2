import { Assembly, Constituency, Party, Alliance, Person } from '../types';
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

    const targetCs = constituencies.filter(c => c.currentAssemblyId === assembly.id);
    targetCs.forEach(c => {
      if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
        allMlaIds.add(c.currentIncumbentId);
        const person = persons.find(p => p.id === c.currentIncumbentId);
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

    return { government: gov, governmentMlaIds, allMlaIds };
  }

  // Active or dynamic calculation based on current seating
  const targetCs = constituencies.filter(c => c.currentAssemblyId === assembly.id);
  const allMlaIds = new Set<string>();
  const incumbentPersons: Person[] = [];

  targetCs.forEach(c => {
    if (c.currentIncumbentId && c.currentIncumbentId !== 'vacant') {
      allMlaIds.add(c.currentIncumbentId);
      const p = persons.find(person => person.id === c.currentIncumbentId);
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
    const party = parties.find(p => p.id === person.partyId);
    let allianceId = party ? party.allianceId : 'independent';

    if (person.partyId === 'independent' && independentSupportMap[person.id]) {
      const supAllianceId = independentSupportMap[person.id];
      if (alliances.some(a => a.id === supAllianceId)) {
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

    const alliance = alliances.find(a => a.id === allianceId);

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
      const party = parties.find(p => p.id === person.partyId);
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

