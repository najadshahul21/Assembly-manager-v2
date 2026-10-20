import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc as firebaseSetDoc, 
  updateDoc as firebaseUpdateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  DocumentData,
  collectionGroup,
  runTransaction,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  Person, 
  Party, 
  Alliance, 
  Assembly, 
  Designation, 
  Constituency, 
  LegislativeOrder,
  LegislativeBill
} from './types';

import { getSystemTimestamp, getSystemDateString } from './utils/dateUtils';

const getUserCollection = (collectionName: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return collection(db, 'users', user.uid, collectionName);
};

const getUserDoc = (collectionName: string, id: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return doc(db, 'users', user.uid, collectionName, id);
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (data instanceof Date) return data.getTime();
  if (Array.isArray(data)) {
    return data
      .map(item => sanitizeData(item))
      .filter(item => item !== undefined);
  }
  
  const result: any = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value !== undefined) {
      const sanitized = sanitizeData(value);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
  });
  return result;
}

const setDoc = (docRef: any, data: any) => firebaseSetDoc(docRef, sanitizeData(data));
const updateDoc = (docRef: any, data: any) => firebaseUpdateDoc(docRef, sanitizeData(data));

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const firestoreService = {
  // Persons
  getPersons: async () => {
    const path = `users/${auth.currentUser?.uid}/persons`;
    try {
      const q = getUserCollection('persons');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Person);
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  getPerson: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/persons/${id}`;
    try {
      const docRef = getUserDoc('persons', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as Person : null;
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  savePerson: async (person: Person) => {
    const path = `users/${auth.currentUser?.uid}/persons/${person.id}`;
    try {
      const docRef = getUserDoc('persons', person.id);
      await setDoc(docRef, { ...person, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updatePerson: async (id: string, data: Partial<Person>) => {
    const path = `users/${auth.currentUser?.uid}/persons/${id}`;
    try {
      const docRef = getUserDoc('persons', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deletePerson: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/persons/${id}`;
    try {
      const docRef = getUserDoc('persons', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // Parties
  getParties: async () => {
    const path = `users/${auth.currentUser?.uid}/parties`;
    try {
      const q = getUserCollection('parties');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Party);
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  getParty: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/parties/${id}`;
    try {
      const docRef = getUserDoc('parties', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as Party : null;
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  saveParty: async (party: Party) => {
    const path = `users/${auth.currentUser?.uid}/parties/${party.id}`;
    try {
      const docRef = getUserDoc('parties', party.id);
      await setDoc(docRef, { ...party, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updateParty: async (id: string, data: Partial<Party>) => {
    const path = `users/${auth.currentUser?.uid}/parties/${id}`;
    try {
      const docRef = getUserDoc('parties', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deleteParty: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/parties/${id}`;
    try {
      const docRef = getUserDoc('parties', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // Alliances
  getAlliances: async () => {
    const path = `users/${auth.currentUser?.uid}/alliances`;
    try {
      const q = getUserCollection('alliances');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Alliance);
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  getAlliance: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/alliances/${id}`;
    try {
      const docRef = getUserDoc('alliances', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as Alliance : null;
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  saveAlliance: async (alliance: Alliance) => {
    const path = `users/${auth.currentUser?.uid}/alliances/${alliance.id}`;
    try {
      const docRef = getUserDoc('alliances', alliance.id);
      await setDoc(docRef, { ...alliance, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updateAlliance: async (id: string, data: Partial<Alliance>) => {
    const path = `users/${auth.currentUser?.uid}/alliances/${id}`;
    try {
      const docRef = getUserDoc('alliances', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deleteAlliance: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/alliances/${id}`;
    try {
      const docRef = getUserDoc('alliances', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // Assemblies
  getAssemblies: async () => {
    const path = `users/${auth.currentUser?.uid}/assemblies`;
    try {
      const q = getUserCollection('assemblies');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Assembly);
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  getAssembly: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/assemblies/${id}`;
    try {
      const docRef = getUserDoc('assemblies', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as Assembly : null;
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  saveAssembly: async (assembly: Assembly) => {
    const path = `users/${auth.currentUser?.uid}/assemblies/${assembly.id}`;
    try {
      const docRef = getUserDoc('assemblies', assembly.id);
      await setDoc(docRef, { ...assembly, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updateAssembly: async (id: string, data: Partial<Assembly>) => {
    const path = `users/${auth.currentUser?.uid}/assemblies/${id}`;
    try {
      const docRef = getUserDoc('assemblies', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deleteAssembly: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/assemblies/${id}`;
    try {
      const docRef = getUserDoc('assemblies', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // Designations
  getDesignations: async () => {
    const path = `users/${auth.currentUser?.uid}/designations`;
    try {
      const q = getUserCollection('designations');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Designation);
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  getDesignation: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/designations/${id}`;
    try {
      const docRef = getUserDoc('designations', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as Designation : null;
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  saveDesignation: async (designation: Designation) => {
    const path = `users/${auth.currentUser?.uid}/designations/${designation.id}`;
    try {
      const docRef = getUserDoc('designations', designation.id);
      await setDoc(docRef, { ...designation, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updateDesignation: async (id: string, data: Partial<Designation>) => {
    const path = `users/${auth.currentUser?.uid}/designations/${id}`;
    try {
      const docRef = getUserDoc('designations', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deleteDesignation: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/designations/${id}`;
    try {
      const docRef = getUserDoc('designations', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // Constituencies
  getConstituencies: async () => {
    const path = `users/${auth.currentUser?.uid}/constituencies`;
    try {
      const q = getUserCollection('constituencies');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Constituency);
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  getConstituency: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/constituencies/${id}`;
    try {
      const docRef = getUserDoc('constituencies', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as Constituency : null;
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  saveConstituency: async (constituency: Constituency) => {
    const path = `users/${auth.currentUser?.uid}/constituencies/${constituency.id}`;
    try {
      const docRef = getUserDoc('constituencies', constituency.id);
      await setDoc(docRef, { ...constituency, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updateConstituency: async (id: string, data: Partial<Constituency>) => {
    const path = `users/${auth.currentUser?.uid}/constituencies/${id}`;
    try {
      const docRef = getUserDoc('constituencies', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deleteConstituency: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/constituencies/${id}`;
    try {
      const docRef = getUserDoc('constituencies', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  // Orders
  getOrders: async () => {
    const path = `users/${auth.currentUser?.uid}/orders`;
    try {
      const q = getUserCollection('orders');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as LegislativeOrder);
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  getOrder: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/orders/${id}`;
    try {
      const docRef = getUserDoc('orders', id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as LegislativeOrder : null;
    } catch (err) {
      return handleFirestoreError(err, OperationType.GET, path);
    }
  },
  saveOrder: async (order: LegislativeOrder) => {
    const path = `users/${auth.currentUser?.uid}/orders/${order.id}`;
    try {
      const docRef = getUserDoc('orders', order.id);
      await setDoc(docRef, { ...order, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updateOrder: async (id: string, data: Partial<LegislativeOrder>) => {
    const path = `users/${auth.currentUser?.uid}/orders/${id}`;
    try {
      const docRef = getUserDoc('orders', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deleteOrder: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/orders/${id}`;
    try {
      const docRef = getUserDoc('orders', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  saveBill: async (bill: LegislativeBill) => {
    const path = `users/${auth.currentUser?.uid}/bills/${bill.id}`;
    try {
      const docRef = getUserDoc('bills', bill.id);
      await setDoc(docRef, { ...bill, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  updateBill: async (id: string, data: Partial<LegislativeBill>) => {
    const path = `users/${auth.currentUser?.uid}/bills/${id}`;
    try {
      const docRef = getUserDoc('bills', id);
      await updateDoc(docRef, { ...data, updatedAt: getSystemTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  deleteBill: async (id: string) => {
    const path = `users/${auth.currentUser?.uid}/bills/${id}`;
    try {
      const docRef = getUserDoc('bills', id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },
  getBills: async (): Promise<LegislativeBill[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
      const q = query(collection(db, 'users', uid, 'bills'), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LegislativeBill));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/bills`);
    }
  },
  getBillsByAssembly: async (assemblyId: string): Promise<LegislativeBill[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
      const q = query(
        collection(db, 'users', uid, 'bills'), 
        where('assemblyId', '==', assemblyId),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data() } as LegislativeBill));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/bills?assemblyId=${assemblyId}`);
    }
  },

  // Freeze Assembly Logic
  freezeAssembly: async (assemblyId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    const path = `users/${uid}/assemblies/${assemblyId}`;

    try {
      const assemblyDoc = await getDoc(doc(db, 'users', uid, 'assemblies', assemblyId));
      const assemblyObj = assemblyDoc.data() as Assembly;
      if (!assemblyObj) return;

      const getCol = async (name: string) => {
        const q = collection(db, 'users', uid, name);
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
      };

      const constituencies = await getCol('constituencies') as Constituency[];
      const parties = await getCol('parties') as Party[];
      const persons = await getCol('persons') as Person[];
      const alliances = await getCol('alliances') as Alliance[];
      const designations = (await getCol('designations') as Designation[]).filter(d => d.assemblyId === assemblyId);

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
        [allianceId: string]: any;
      } = {};

      incumbentPersons.forEach((person) => {
        const party = relevantParties.find((p) => p.id === person.partyId);
        let allianceId = party ? party.allianceId : "independent";

        if (
          person.partyId === "independent" &&
          independentSupportMap[person.id]
        ) {
          const supAllianceId = independentSupportMap[person.id] as string;
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
            color: alliance && (alliance as any).colors ? (alliance as any).colors[0] : "#666666",
            parties: [],
          };
        }

        groups[allianceId].totalSeats += 1;

        if (party) {
          let partyRef = groups[allianceId].parties.find(
            (p: any) => p.id === party.id,
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
              (p: any) => p.id === "independent-supporting",
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

      Object.values(groups).forEach((group: any) => {
        group.parties.sort((a: any, b: any) => b.seats - a.seats);
      });

      const sortedGroups = Object.entries(groups)
        .map(([id, data]) => ({ ...data as any }))
        .sort((a, b) => b.totalSeats - a.totalSeats);

      const relevantCs = constituencies.filter(
        (c) =>
          c.currentAssemblyId === assemblyId ||
          (c.history && c.history.some((h) => h.assemblyId === assemblyId)),
      );

      const membersOutputList: any[] = [];
      const addedPersons = new Set<string>();

      const toTime = (d: any) =>
        typeof d === "number" ? d : d ? new Date(d).getTime() : 0;

      for (const con of relevantCs) {
        const conHistory = (con.history || []).filter(
          (h) => (h.assemblyId || con.currentAssemblyId || assemblyId) === assemblyId,
        );

        const personIdsSet = new Set<string>();
        if (
          con.currentAssemblyId === assemblyId &&
          con.currentIncumbentId !== "vacant"
        ) {
          personIdsSet.add(con.currentIncumbentId as string);
        }
        conHistory.forEach((h) => {
          if (h.personId && h.personId !== "vacant") {
            personIdsSet.add(h.personId);
          }
        });

        const personAppointments = Array.from(personIdsSet).map((pId) => {
          const entries = conHistory.filter((h) => h.personId === pId);
          const electionOrAppt = entries.filter(
            (h) => h.reason === "election" || h.reason === "appointment"
          );
          const removal = entries.find(
            (h) =>
              h.reason &&
              h.reason !== "election" &&
              h.reason !== "appointment"
          );
          const isActive =
            con.currentAssemblyId === assemblyId && con.currentIncumbentId === pId;

          let earliestDate = 0;
          if (electionOrAppt.length > 0) {
            earliestDate = Math.min(...electionOrAppt.map((e) => toTime(e.date)));
          } else if (removal) {
            earliestDate = toTime(removal.date) - 1;
          } else if (isActive) {
            earliestDate = toTime(con.updatedAt);
          } else if (entries.length > 0) {
            earliestDate = Math.min(...entries.map((e) => toTime(e.date)));
          } else {
            earliestDate = getSystemTimestamp();
          }

          return { pId, earliestDate, isActive, removal };
        });

        personAppointments.sort((a, b) => {
          if (a.earliestDate !== b.earliestDate) return a.earliestDate - b.earliestDate;
          if (a.removal && !b.removal) return -1;
          if (!a.removal && b.removal) return 1;
          return 0;
        });

        for (let index = 0; index < personAppointments.length; index++) {
          const { pId, isActive, removal } = personAppointments[index];
          const p = persons.find(item => item.id === pId);
          if (p) {
            let mlaStatusText = "";
            if (!isActive && removal) {
              mlaStatusText =
                removal.reason.charAt(0).toUpperCase() +
                removal.reason.slice(1);
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
              imageUrl: p.imageUrl?.startsWith("data:") ? undefined : p.imageUrl,
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
              imageUrl: p.imageUrl?.startsWith("data:") ? undefined : p.imageUrl,
            });
            addedPersons.add(p.id);
          }
        }
      }

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

      const mappedSeats = targetCs.map((c) => {
        let politician: Person | undefined = undefined;

        if (c.currentAssemblyId === assemblyId) {
          if (c.currentIncumbentId !== "vacant") {
            politician = persons.find((p) => p.id === c.currentIncumbentId);
          }
        } else {
          const hist = (c.history || [])
            .sort((lh, rh) => toTime(rh.date) - toTime(lh.date))
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

        // Lightweight representations without full historical arrays or data-url images
        const cleanConstituency = {
          id: c.id,
          name: c.name,
          slNo: c.slNo || "",
          district: c.district || "",
          currentAssemblyId: c.currentAssemblyId,
          currentIncumbentId: c.currentIncumbentId,
        };

        const cleanPolitician = politician
          ? {
              id: politician.id,
              name: politician.name,
              partyId: politician.partyId,
              gender: politician.gender || "Male",
              imageUrl: politician.imageUrl?.startsWith("data:")
                ? undefined
                : politician.imageUrl,
            }
          : undefined;

        const cleanParty = party
          ? {
              id: party.id,
              name: party.name,
              abbreviation: party.abbreviation,
              colors: party.colors || [],
            }
          : undefined;

        const cleanAlliance = alliance
          ? {
              id: alliance.id,
              name: alliance.name,
              abbreviation: alliance.abbreviation,
              colors: (alliance as any).colors || [],
            }
          : undefined;

        return {
          constituency: cleanConstituency,
          politician: cleanPolitician,
          party: cleanParty,
          alliance: cleanAlliance,
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

      await updateDoc(doc(db, 'users', uid, 'assemblies', assemblyId), {
        composition: finalComposition,
        updatedAt: getSystemTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  reindexConstituencies: async () => {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    const path = `users/${uid}/constituencies`;

    try {
      const q = collection(db, 'users', uid, 'constituencies');
      const snap = await getDocs(q);
      const all = snap.docs.map(d => d.data() as Constituency);

      const sorted = all.sort((a, b) => {
        const slA = parseInt(a.slNo) || 9999;
        const slB = parseInt(b.slNo) || 9999;
        if (slA !== slB) return slA - slB;
        return (a.updatedAt || 0) - (b.updatedAt || 0);
      });

      for (let i = 0; i < sorted.length; i++) {
        const newSlNo = (i + 1).toString().padStart(3, '0');
        if (sorted[i].slNo !== newSlNo) {
          await updateDoc(doc(db, 'users', uid, 'constituencies', sorted[i].id), {
            slNo: newSlNo,
            updatedAt: getSystemTimestamp()
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  confirmElection: async (constituencyId: string, winnerPersonId: string | undefined, result: any, currentActiveAssemblyId?: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    const path = `users/${uid}/constituencies/${constituencyId}`;

    try {
      const conRef = doc(db, 'users', uid, 'constituencies', constituencyId);
      const conDoc = await getDoc(conRef);
      const con = conDoc.data() as Constituency;
      if (!con) return;

      const now = getSystemTimestamp();
      const oldIncumbentId = con.currentIncumbentId;
      const newIncumbentId = winnerPersonId || "vacant";

      // 1. Vacate old incumbent
      if (oldIncumbentId && oldIncumbentId !== 'vacant' && oldIncumbentId !== winnerPersonId) {
        const oldPersonRef = doc(db, 'users', uid, 'persons', oldIncumbentId);
        const oldPersonDoc = await getDoc(oldPersonRef);
        const oldPerson = oldPersonDoc.data() as Person;
        
        if (oldPerson && con.currentAssemblyId) {
          const assemblyRoles = { ...(oldPerson.assemblyRoles || {}) };
          const mlaRole = `MLA for ${con.name}`;
          
          const roles = (assemblyRoles[con.currentAssemblyId] || "").split(", ").map(r => r.trim()).filter(Boolean);
          const updatedRoles = roles.filter(r => r !== mlaRole && r !== `${con.name} MLA`);
          
          if (updatedRoles.length === 0) {
            delete assemblyRoles[con.currentAssemblyId];
          } else {
            assemblyRoles[con.currentAssemblyId] = updatedRoles.join(", ");
          }

          const pRoleHistory = [...(oldPerson.roleHistory || [])];
          pRoleHistory.push({
            role: mlaRole,
            assemblyId: con.currentAssemblyId,
            date: now,
            action: "expiry"
          });

          await updateDoc(oldPersonRef, {
            assemblyRoles,
            roleHistory: pRoleHistory,
            constituencyName: "",
            updatedAt: now,
          });

          const assemblyRef = doc(db, 'users', uid, 'assemblies', con.currentAssemblyId);
          const assemblyDoc = await getDoc(assemblyRef);
          const assembly = assemblyDoc.data() as Assembly;
          if (assembly && assembly.independentSupports && assembly.independentSupports[oldIncumbentId]) {
            const supports = { ...assembly.independentSupports };
            delete supports[oldIncumbentId];
            await updateDoc(assemblyRef, {
              independentSupports: supports,
              updatedAt: now
            });
          }
        }
      }

      if (winnerPersonId && winnerPersonId !== "vacant") {
        const personRef = doc(db, 'users', uid, 'persons', winnerPersonId);
        const personDoc = await getDoc(personRef);
        const person = personDoc.data() as Person;
        
        if (!person || person.isSuspended) {
          throw new Error(`Candidate "${person?.name || winnerPersonId}" is suspended and cannot be elected.`);
        }

        // Vacate from other constituencies
        const q = query(collection(db, 'users', uid, 'constituencies'), where('currentIncumbentId', '==', winnerPersonId));
        const snap = await getDocs(q);
        for (const otherConDoc of snap.docs) {
          const otherCon = otherConDoc.data() as Constituency;
          if (otherCon.id !== con.id) {
            const otherConHistory = [...(otherCon.history || [])];
            otherConHistory.push({
              personId: winnerPersonId,
              assemblyId: otherCon.currentAssemblyId || "unknown",
              date: now,
              reason: "Resigned (Elected to other seat)"
            });
            
            await updateDoc(doc(db, 'users', uid, 'constituencies', otherCon.id), {
              currentIncumbentId: "vacant",
              history: otherConHistory,
              updatedAt: now
            });
          }
        }

        if (con.currentAssemblyId) {
          const assemblyRoles = { ...(person.assemblyRoles || {}) };
          const mlaRole = `MLA for ${con.name}`;
          
          const roles = (assemblyRoles[con.currentAssemblyId] || "").split(", ").map(r => r.trim()).filter(Boolean);
          if (!roles.includes(mlaRole)) {
            roles.push(mlaRole);
            assemblyRoles[con.currentAssemblyId] = roles.join(", ");
          }
          
          const pRoleHistory = [...(person.roleHistory || [])];
          pRoleHistory.push({
            role: mlaRole,
            assemblyId: con.currentAssemblyId,
            date: now,
            action: "appointment"
          });

          await updateDoc(personRef, {
            assemblyRoles,
            roleHistory: pRoleHistory,
            constituencyName: con.name,
            updatedAt: now,
          });
        }
      }

      const historyEntry = {
        personId: newIncumbentId,
        assemblyId: con.currentAssemblyId || currentActiveAssemblyId || "assembly",
        date: now,
        reason: "election",
      };

      await updateDoc(conRef, {
        currentIncumbentId: newIncumbentId,
        lastElectionResult: result,
        history: [...(con.history || []), historyEntry],
        updatedAt: now,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  ensureConstitutionalDesignations: async (retryCount = 0) => {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;

    try {
      const getAsms = async () => {
        const path = `users/${uid}/assemblies`;
        try {
          const q = collection(db, 'users', uid, 'assemblies');
          const snap = await getDocs(q);
          return snap.docs.map(d => d.data() as Assembly);
        } catch (err) {
          return handleFirestoreError(err, OperationType.GET, path);
        }
      };
      
      const allAsms = await getAsms();
      const activeAsm = allAsms.find(a => a.isActive === true) || allAsms[0];
      const stateName = (activeAsm as any)?.state || (activeAsm?.name?.match(/(?:(?:\d+(?:st|nd|rd|th)\s+)?)(.*?)\s+(?:Legislative\s+Assembly|Assembly|Vidhan\s+Sabha)/i)?.[1]?.trim()) || '';
      const stateTitle = stateName ? `${stateName} State` : 'State';

      const defaults = [
        {
          id: 'governor',
          name: "Hon'ble Governor",
          incumbentId: 'vacant',
          dateOfSigning: getSystemDateString(),
          constituency: stateTitle,
          history: [],
          updatedAt: getSystemTimestamp()
        },
        {
          id: 'high-court',
          name: 'High Court',
          incumbentId: 'vacant',
          dateOfSigning: getSystemDateString(),
          constituency: 'Judiciary',
          history: [],
          updatedAt: getSystemTimestamp()
        },
        {
          id: 'supreme-court',
          name: 'Supreme Court',
          incumbentId: 'vacant',
          dateOfSigning: getSystemDateString(),
          constituency: 'Judiciary',
          history: [],
          updatedAt: getSystemTimestamp()
        }
      ];

      for (const d of defaults) {
        const path = `users/${uid}/designations/${d.id}`;
        try {
          const docRef = doc(db, 'users', uid, 'designations', d.id);
          const existing = await getDoc(docRef);
          if (!existing.exists()) {
            await setDoc(docRef, d);
          } else {
            const data = existing.data() as Designation;
            if (d.id === 'high-court' && data.name !== 'High Court') {
              await updateDoc(docRef, { name: 'High Court', updatedAt: getSystemTimestamp() });
            } else if (d.id === 'supreme-court' && data.name !== 'Supreme Court') {
              await updateDoc(docRef, { name: 'Supreme Court', updatedAt: getSystemTimestamp() });
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, path);
        }
      }

      // Clean up names
      const path = `users/${uid}/designations`;
      try {
        const q = collection(db, 'users', uid, 'designations');
        const snap = await getDocs(q);
        for (const dDoc of snap.docs) {
          const desig = dDoc.data() as Designation;
          if (desig.name.toLowerCase().includes('high court') && desig.name !== 'High Court') {
            await updateDoc(doc(db, 'users', uid, 'designations', desig.id), { name: 'High Court', updatedAt: getSystemTimestamp() });
          } else if (desig.name.toLowerCase().includes('supreme court') && desig.name !== 'Supreme Court') {
            await updateDoc(doc(db, 'users', uid, 'designations', desig.id), { name: 'Supreme Court', updatedAt: getSystemTimestamp() });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    } catch (err: any) {
      // If client is offline, retry after a short delay (up to 5 times with exponential backoff)
      const isOffline = err?.code === 'unavailable' || 
                        err?.message?.includes('offline') || 
                        err?.message?.includes('failed-precondition') ||
                        err?.message?.includes('deadline-exceeded');

      if (isOffline) {
        if (retryCount < 5) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.warn(`Firestore potentially offline or initializing, retrying constitutional designations (${retryCount + 1}/5) in ${delay}ms...`);
          setTimeout(() => {
            firestoreService.ensureConstitutionalDesignations(retryCount + 1);
          }, delay);
          return;
        }
      }
      
      // If it's a "Permission Denied" or other critical error, handleFirestoreError will throw it in a way the system can diagnose
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, `users/${uid}/designations`);
      } else {
        console.error('Failed to ensure constitutional designations in firestore:', err);
      }
    }
  },
  clearAllData: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const uid = user.uid;
    const collections = [
      'parties',
      'alliances',
      'assemblies',
      'designations',
      'persons',
      'constituencies',
      'orders',
      'bills'
    ];

    const { writeBatch } = await import('firebase/firestore');

    for (const colName of collections) {
      const q = collection(db, 'users', uid, colName);
      const snapshot = await getDocs(q);
      
      // Delete in batches of 500 (Firestore limit)
      let batch = writeBatch(db);
      let count = 0;
      
      for (const d of snapshot.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }
    }
  }
};
