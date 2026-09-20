import Dexie, { type Table } from 'dexie';
import { Person, Party, Alliance, Assembly, Designation, Constituency, LegislativeOrder } from './types';

export class LegislativeDB extends Dexie {
  persons!: Table<Person>;
  parties!: Table<Party>;
  alliances!: Table<Alliance>;
  assemblies!: Table<Assembly>;
  designations!: Table<Designation>;
  constituencies!: Table<Constituency>;
  orders!: Table<LegislativeOrder>;

  constructor() {
    super('KhansaarDB');
    this.version(4).stores({
      persons: 'id, name, partyId, updatedAt',
      parties: 'id, name, abbreviation, allianceId, updatedAt',
      alliances: 'id, name, abbreviation, updatedAt',
      assemblies: 'id, name, partyControlId, precededById, updatedAt',
      designations: 'id, name, incumbentId, constituency, assemblyId, constituencyId, updatedAt',
      constituencies: 'id, slNo, name, currentIncumbentId, currentAssemblyId, updatedAt'
    });
    this.version(5).stores({
      orders: 'id, orderName, date, timestamp, byDesignationId, signerPersonId, *taggedPersonIds, updatedAt'
    });
    this.version(6).stores({}); // Placeholder for missing version
    this.version(7).stores({
      orders: 'id, slNo, orderName, date, timestamp, byDesignationId, byDesignationName, signerPersonId, *taggedPersonIds, updatedAt'
    });
    this.version(8).stores({
      assemblies: 'id, slNo, name, partyControlId, precededById, updatedAt'
    });

    this.open().catch(err => {
      console.error("Failed to open database:", err);
    });
  }
}

export const db = new LegislativeDB();

export const clearAllData = async () => {
  await db.persons.clear();
  await db.parties.clear();
  await db.alliances.clear();
  await db.assemblies.clear();
  await db.designations.clear();
  await db.constituencies.clear();
  await db.orders.clear();
};

export const ensureConstitutionalDesignations = async () => {
  try {
    const defaults = [
      {
        id: 'governor',
        name: "Hon'ble Governor",
        incumbentId: 'vacant',
        dateOfSigning: new Date().toISOString().split('T')[0],
        constituency: 'Kerala State',
        history: [],
        updatedAt: Date.now()
      },
      {
        id: 'high-court',
        name: 'High Court',
        incumbentId: 'vacant',
        dateOfSigning: new Date().toISOString().split('T')[0],
        constituency: 'Judiciary',
        history: [],
        updatedAt: Date.now()
      },
      {
        id: 'supreme-court',
        name: 'Supreme Court',
        incumbentId: 'vacant',
        dateOfSigning: new Date().toISOString().split('T')[0],
        constituency: 'Judiciary',
        history: [],
        updatedAt: Date.now()
      }
    ];

    for (const d of defaults) {
      const existing = await db.designations.get(d.id);
      if (!existing) {
        await db.designations.put(d);
      } else if (d.id === 'high-court' && existing.name !== 'High Court') {
        await db.designations.update('high-court', { name: 'High Court' });
      } else if (d.id === 'supreme-court' && existing.name !== 'Supreme Court') {
        await db.designations.update('supreme-court', { name: 'Supreme Court' });
      }
    }

    // Clean up any place names from all High Court and Supreme Court designations
    const allDesigs = await db.designations.toArray();
    for (const desig of allDesigs) {
      if (desig.name.toLowerCase().includes('high court') && desig.name !== 'High Court') {
        await db.designations.update(desig.id, { name: 'High Court' });
      } else if (desig.name.toLowerCase().includes('supreme court') && desig.name !== 'Supreme Court') {
        await db.designations.update(desig.id, { name: 'Supreme Court' });
      }
    }
  } catch (err) {
    console.error('Failed to ensure constitutional designations in db:', err);
  }
};

export const reindexConstituencies = async () => {
  const all = await db.constituencies.toArray();
  // Sort by existing slNo if available, otherwise by creation/id
  const sorted = all.sort((a, b) => {
    const slA = parseInt(a.slNo) || 9999;
    const slB = parseInt(b.slNo) || 9999;
    if (slA !== slB) return slA - slB;
    return (a.updatedAt || 0) - (b.updatedAt || 0);
  });

  for (let i = 0; i < sorted.length; i++) {
    const newSlNo = (i + 1).toString().padStart(3, '0');
    if (sorted[i].slNo !== newSlNo) {
      await db.constituencies.update(sorted[i].id, { slNo: newSlNo });
    }
  }
};

export const freezeAssembly = async (assemblyId: string) => {
  const assemblyObj = await db.assemblies.get(assemblyId);
  if (!assemblyObj) return;

  const constituencies = await db.constituencies.toArray();
  const parties = await db.parties.toArray();
  const persons = await db.persons.toArray();
  const alliances = await db.alliances.toArray();
  const designations = await db.designations.where('assemblyId').equals(assemblyId).toArray();

  const pIds = [
    ...constituencies.filter(c => c.currentAssemblyId === assemblyId).map((c) => c.currentIncumbentId),
    ...designations.map((d) => d.incumbentId),
  ].filter((pid) => pid !== "vacant");

  const uniquePIds = [...new Set(pIds)];
  const incumbentPersons = persons.filter(p => uniquePIds.includes(p.id));

  const independentSupportMap = assemblyObj.independentSupports || {};
  const supportedAllianceIds = Object.values(independentSupportMap);
  const partyIds = incumbentPersons.map((p) => p.partyId);
  const relevantParties = parties.filter(p => partyIds.includes(p.id));
  const allianceIds = [
    ...new Set([
      ...relevantParties.map((p) => p.allianceId),
      ...supportedAllianceIds,
    ]),
  ].filter(Boolean);
  const relevantAlliances = alliances.filter(a => allianceIds.includes(a.id));

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

  incumbentPersons.forEach((person) => {
    const party = relevantParties.find((p) => p.id === person.partyId);
    let allianceId = party ? party.allianceId : "independent";

    if (
      person.partyId === "independent" &&
      independentSupportMap[person.id]
    ) {
      const supAllianceId = independentSupportMap[person.id];
      if (relevantAlliances.some((a) => a.id === supAllianceId)) {
        allianceId = supAllianceId;
      }
    }

    const alliance = relevantAlliances.find((a) => a.id === allianceId);

    if (!groups[allianceId]) {
      groups[allianceId] = {
        id: allianceId,
        name: alliance
          ? alliance.name
          : allianceId === "independent"
            ? "Independents"
            : allianceId,
        abbreviation: alliance
          ? alliance.abbreviation
          : allianceId === "independent"
            ? "IND"
            : allianceId,
        totalSeats: 0,
        color: alliance && alliance.colors ? alliance.colors[0] : "#666666",
        parties: [],
      };
    }

    groups[allianceId].totalSeats += 1;

    if (party) {
      let partyRef = groups[allianceId].parties.find(
        (p) => p.id === party.id,
      );
      if (!partyRef) {
        partyRef = {
          id: party.id,
          name: party.name,
          abbreviation: party.abbreviation,
          seats: 0,
          color: party.colors ? party.colors[0] : "#999999",
        };
        groups[allianceId].parties.push(partyRef);
      }
      partyRef.seats += 1;
    } else {
      if (allianceId !== "independent") {
        let partyRef = groups[allianceId].parties.find(
          (p) => p.id === "independent-supporting",
        );
        if (!partyRef) {
          partyRef = {
            id: "independent-supporting",
            name: "Independents (Supporting)",
            abbreviation: "IND (S)",
            seats: 0,
            color: "#666666",
          };
          groups[allianceId].parties.push(partyRef);
        }
        partyRef.seats += 1;
      }
    }
  });

  Object.values(groups).forEach((group) => {
    group.parties.sort((a, b) => b.seats - a.seats);
  });

  const sortedGroups = Object.entries(groups)
    .map(([id, data]) => ({ ...data }))
    .sort((a, b) => b.totalSeats - a.totalSeats);

  const relevantCs = constituencies.filter(
    (c) =>
      c.currentAssemblyId === assemblyId ||
      (c.history && c.history.some((h) => h.assemblyId === assemblyId)),
  );

  const membersOutputList: any[] = [];
  const addedPersons = new Set<string>();

  for (const con of relevantCs) {
    const conHistory = (con.history || []).filter(
      (h) => h.assemblyId === assemblyId,
    );

    const personIdsSet = new Set<string>();
    if (
      con.currentAssemblyId === assemblyId &&
      con.currentIncumbentId !== "vacant"
    ) {
      personIdsSet.add(con.currentIncumbentId);
    }
    conHistory.forEach((h) => {
      if (h.personId && h.personId !== "vacant") {
        personIdsSet.add(h.personId);
      }
    });

    const personAppointments = Array.from(personIdsSet).map((pId) => {
      const entries = conHistory.filter((h) => h.personId === pId);
      const earliestDate =
        entries.length > 0
          ? Math.min(...entries.map((e) => e.date))
          : Date.now();
      return { pId, earliestDate };
    });
    personAppointments.sort((a, b) => a.earliestDate - b.earliestDate);

    for (let index = 0; index < personAppointments.length; index++) {
      const { pId } = personAppointments[index];
      const p = persons.find(item => item.id === pId);
      if (p) {
        const removalEntry = conHistory.find(
          (h) => h.personId === pId && h.reason !== "appointment",
        );
        let mlaStatusText = "";
        if (removalEntry) {
          mlaStatusText =
            removalEntry.reason.charAt(0).toUpperCase() +
            removalEntry.reason.slice(1);
        } else if (index > 0) {
          mlaStatusText = "Byelected";
        }

        const party = parties.find(item => item.id === p.partyId);
        const alliance =
          party && party.allianceId !== "independent"
            ? alliances.find(item => item.id === party.allianceId)
            : null;
        let baseSubtitle =
          p.partyId === "independent"
            ? "Independent"
            : party?.name || "Member";
        if (alliance) {
          baseSubtitle = `${baseSubtitle} • ${alliance.name}`;
        }

        let finalSubtitle = `${baseSubtitle} (${con.name})`;
        if (mlaStatusText) {
          finalSubtitle = `${mlaStatusText} | ${finalSubtitle}`;
        }

        membersOutputList.push({
          id: p.id,
          uniqueKey: `${p.id}-${con.id}-${index}`,
          name: p.name,
          constituencyName: con.name,
          partyId: p.partyId,
          imageUrl: p.imageUrl,
          subtitleOverride: finalSubtitle,
          mlaStatusText: mlaStatusText || undefined,
        });
        addedPersons.add(p.id);
      }
    }
  }

  for (const d of designations) {
    if (d.incumbentId !== "vacant" && !addedPersons.has(d.incumbentId)) {
      const p = persons.find(item => item.id === d.incumbentId);
      if (p) {
        membersOutputList.push({
          id: p.id,
          uniqueKey: `${p.id}-${d.id}`,
          name: p.name,
          constituencyName: d.constituency || "Special Role",
          partyId: p.partyId,
          imageUrl: p.imageUrl,
        });
        addedPersons.add(p.id);
      }
    }
  }

  // Linked constituencies for this assembly
  const targetCs = constituencies.filter(
    (c) =>
      c.currentAssemblyId === assemblyId ||
      (Array.isArray(c.history) && c.history.some((h) => h.assemblyId === assemblyId)),
  );

  const assemblyPerformance = {
    totalSeats: targetCs.length,
    incumbentCount: incumbentPersons.length,
    distribution: sortedGroups,
    government: sortedGroups[0] || null,
    opposition: sortedGroups[1] || null,
    others: sortedGroups.slice(2),
    members: membersOutputList,
  };

  // Build seatingLayout

  const mappedSeats = targetCs.map((c) => {
    let politician: Person | undefined = undefined;

    if (c.currentAssemblyId === assemblyId) {
      if (c.currentIncumbentId !== "vacant") {
        politician = persons.find((p) => p.id === c.currentIncumbentId);
      }
    } else {
      const hist = (c.history || [])
        .sort((lh, rh) => rh.date - lh.date)
        .find((h) => h.assemblyId === assemblyId);
      if (hist && hist.personId !== "vacant") {
        politician = persons.find((p) => p.id === hist.personId);
      }
    }

    let party: Party | undefined = undefined;
    if (politician) {
      party = parties.find((p) => p.id === politician!.partyId);
    }

    let alliance: Alliance | undefined = undefined;
    if (party) {
      let partyAllianceId = party.allianceId;
      if ((!partyAllianceId || partyAllianceId === "independent") && politician) {
        const supportedAllianceId = assemblyObj.independentSupports?.[politician.id];
        if (supportedAllianceId) {
          partyAllianceId = supportedAllianceId;
        }
      }
      if (partyAllianceId && partyAllianceId !== "independent") {
        alliance = alliances.find((a) => a.id === partyAllianceId);
      }
    }

    // Deep copy structures to prevent reference updates
    return {
      constituency: JSON.parse(JSON.stringify(c)),
      politician: politician ? JSON.parse(JSON.stringify(politician)) : undefined,
      party: party ? JSON.parse(JSON.stringify(party)) : undefined,
      alliance: alliance ? JSON.parse(JSON.stringify(alliance)) : undefined,
    };
  });

  const sortedSeats = mappedSeats.sort((a, b) => {
    const isVacantA = !a.politician;
    const isVacantB = !b.politician;
    if (isVacantA && !isVacantB) return 1;
    if (!isVacantA && isVacantB) return -1;
    if (isVacantA && isVacantB) return 0;

    const allianceA = a.alliance ? a.alliance.id : "independent";
    const allianceB = b.alliance ? b.alliance.id : "independent";

    const govId = assemblyPerformance.government?.id;
    const oppId = assemblyPerformance.opposition?.id;

    const getRank = (allianceId: string) => {
      if (govId && allianceId === govId) return 1;
      if (oppId && allianceId === oppId) return 10;
      if (allianceId === "independent") return 6;
      return 5;
    };

    const rankA = getRank(allianceA);
    const rankB = getRank(allianceB);

    if (rankA !== rankB) return rankA - rankB;

    const pIdA = a.politician!.partyId;
    const pIdB = b.politician!.partyId;
    if (pIdA !== pIdB) return pIdA.localeCompare(pIdB);

    const slA = parseInt(a.constituency.slNo) || 999;
    const slB = parseInt(b.constituency.slNo) || 999;
    return slA - slB;
  });

  const finalComposition = {
    ...assemblyPerformance,
    seatingLayout: sortedSeats,
  };

  await db.assemblies.update(assemblyId, {
    composition: finalComposition,
  });
};
