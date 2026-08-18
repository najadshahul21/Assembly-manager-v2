import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { firestoreDb, handleFirestoreError, OperationType } from '../firebase';
import { db } from '../db';
import { Person, Party, Alliance, Assembly, Designation, Constituency } from '../types';

export interface CloudSyncStatus {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  connected: boolean;
}

// 1. User Profile Sync
export async function syncUserProfileToFirestore(user: {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'admin' | 'editor' | 'viewer';
}) {
  const path = `users/${user.id}`;
  try {
    const userDocRef = doc(firestoreDb, 'users', user.id);
    const payload = {
      id: user.id,
      email: user.email || '',
      displayName: user.displayName || user.email.split('@')[0] || 'User',
      photoURL: user.photoURL || '',
      role: user.role || (user.email === 'najadshahul21@gmail.com' ? 'admin' : 'editor'),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    await setDoc(userDocRef, payload, { merge: true });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// 2. Generic Single Document Sync
export async function syncDocumentToFirestore(collectionName: string, id: string, data: any) {
  const path = `${collectionName}/${id}`;
  try {
    const docRef = doc(firestoreDb, collectionName, id);
    // Sanitize undefined values
    const cleaned = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleaned, { merge: true });
  } catch (err) {
    console.error(`Failed to sync to Firestore at ${path}:`, err);
    // Non-blocking log, or throw if required
  }
}

export async function deleteDocumentFromFirestore(collectionName: string, id: string) {
  const path = `${collectionName}/${id}`;
  try {
    const docRef = doc(firestoreDb, collectionName, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Failed to delete from Firestore at ${path}:`, err);
  }
}

// 3. Full Cloud Sync: Local Dexie DB <-> Firestore
export async function uploadLocalDbToFirestore(): Promise<void> {
  try {
    const [persons, parties, alliances, assemblies, designations, constituencies] = await Promise.all([
      db.persons.toArray(),
      db.parties.toArray(),
      db.alliances.toArray(),
      db.assemblies.toArray(),
      db.designations.toArray(),
      db.constituencies.toArray(),
    ]);

    const batch = writeBatch(firestoreDb);
    let opCount = 0;

    const addBatch = async (col: string, items: any[]) => {
      for (const item of items) {
        if (!item.id) continue;
        const ref = doc(firestoreDb, col, item.id);
        batch.set(ref, JSON.parse(JSON.stringify(item)), { merge: true });
        opCount++;
        if (opCount >= 400) {
          await batch.commit();
          opCount = 0;
        }
      }
    };

    await addBatch('persons', persons);
    await addBatch('parties', parties);
    await addBatch('alliances', alliances);
    await addBatch('assemblies', assemblies);
    await addBatch('designations', designations);
    await addBatch('constituencies', constituencies);

    if (opCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_upload');
  }
}

export async function downloadFirestoreToLocalDb(): Promise<{
  persons: number;
  parties: number;
  alliances: number;
  assemblies: number;
  designations: number;
  constituencies: number;
}> {
  try {
    const [
      personsSnap,
      partiesSnap,
      alliancesSnap,
      assembliesSnap,
      designationsSnap,
      constituenciesSnap
    ] = await Promise.all([
      getDocs(collection(firestoreDb, 'persons')),
      getDocs(collection(firestoreDb, 'parties')),
      getDocs(collection(firestoreDb, 'alliances')),
      getDocs(collection(firestoreDb, 'assemblies')),
      getDocs(collection(firestoreDb, 'designations')),
      getDocs(collection(firestoreDb, 'constituencies')),
    ]);

    const persons = personsSnap.docs.map(d => d.data() as Person);
    const parties = partiesSnap.docs.map(d => d.data() as Party);
    const alliances = alliancesSnap.docs.map(d => d.data() as Alliance);
    const assemblies = assembliesSnap.docs.map(d => d.data() as Assembly);
    const designations = designationsSnap.docs.map(d => d.data() as Designation);
    const constituencies = constituenciesSnap.docs.map(d => d.data() as Constituency);

    // If cloud has data, update Dexie
    if (persons.length > 0) await db.persons.bulkPut(persons);
    if (parties.length > 0) await db.parties.bulkPut(parties);
    if (alliances.length > 0) await db.alliances.bulkPut(alliances);
    if (assemblies.length > 0) await db.assemblies.bulkPut(assemblies);
    if (designations.length > 0) await db.designations.bulkPut(designations);
    if (constituencies.length > 0) await db.constituencies.bulkPut(constituencies);

    return {
      persons: persons.length,
      parties: parties.length,
      alliances: alliances.length,
      assemblies: assemblies.length,
      designations: designations.length,
      constituencies: constituencies.length,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'collections_download');
  }
}

// 4. Real-time Subscription listener
export function subscribeToFirestoreCollections(onDataChange?: () => void) {
  const unsubscribes: (() => void)[] = [];

  const collections = ['persons', 'parties', 'alliances', 'assemblies', 'designations', 'constituencies'];

  collections.forEach((colName) => {
    try {
      const unsub = onSnapshot(collection(firestoreDb, colName), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const data = change.doc.data();
          const table = (db as any)[colName];
          if (!table) return;

          if (change.type === 'added' || change.type === 'modified') {
            await table.put(data);
          } else if (change.type === 'removed') {
            await table.delete(change.doc.id);
          }
        });
        if (onDataChange) onDataChange();
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, colName);
      });
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn(`Could not subscribe to ${colName}:`, e);
    }
  });

  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
}
