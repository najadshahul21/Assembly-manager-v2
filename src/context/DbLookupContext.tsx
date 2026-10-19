import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Person, Party, Alliance, Assembly, Designation, Constituency, LegislativeOrder, LegislativeBill } from '../types';

interface DbLookupContextType {
  loaded: boolean;
  parties: Party[];
  alliances: Alliance[];
  assemblies: Assembly[];
  designations: Designation[];
  persons: Person[];
  constituencies: Constituency[];
  orders: LegislativeOrder[];
  bills: LegislativeBill[];
  partiesMap: Record<string, Party>;
  alliancesMap: Record<string, Alliance>;
  assembliesMap: Record<string, Assembly>;
  personsMap: Record<string, Person>;
  constituenciesMap: Record<string, Constituency>;
}

const DbLookupContext = createContext<DbLookupContextType | null>(null);

export const DbLookupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoaded(false);
      return;
    }

    // Initialize constitutional designations
    import('../firestoreService').then(m => m.firestoreService.ensureConstitutionalDesignations());

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

    const unsubscribes: (() => void)[] = [];
    const localData: any = {
      parties: [],
      alliances: [],
      assemblies: [],
      designations: [],
      persons: [],
      constituencies: [],
      orders: [],
      bills: []
    };

    let collectionsLoaded = 0;

    collections.forEach((colName) => {
      const q = query(collection(db, 'users', uid, colName));
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => doc.data() as any);
        
        // Sorting
        if (colName === 'parties' || colName === 'alliances' || colName === 'persons' || colName === 'designations') {
          docs.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        } else if (colName === 'orders' || colName === 'bills') {
          docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        }

        localData[colName] = docs;

        // Process maps
        const partiesMap: Record<string, Party> = {};
        localData.parties.forEach((p: Party) => { partiesMap[p.id] = p; });

        const alliancesMap: Record<string, Alliance> = {};
        localData.alliances.forEach((a: Alliance) => { alliancesMap[a.id] = a; });

        const assembliesMap: Record<string, Assembly> = {};
        localData.assemblies.forEach((a: Assembly) => { assembliesMap[a.id] = a; });

        const personsMap: Record<string, Person> = {};
        localData.persons.forEach((p: Person) => { personsMap[p.id] = p; });

        const constituenciesMap: Record<string, Constituency> = {};
        localData.constituencies.forEach((c: Constituency) => { constituenciesMap[c.id] = c; });

        setData({
          ...localData,
          partiesMap,
          alliancesMap,
          assembliesMap,
          personsMap,
          constituenciesMap
        });

        if (collectionsLoaded < collections.length) {
           collectionsLoaded++;
           if (collectionsLoaded === collections.length) {
             setLoaded(true);
           }
        }
      }, (err) => {
        console.error(`Error loading ${colName}:`, err);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  const value: DbLookupContextType = {
    loaded,
    parties: data?.parties || [],
    alliances: data?.alliances || [],
    assemblies: data?.assemblies || [],
    designations: data?.designations || [],
    persons: data?.persons || [],
    constituencies: data?.constituencies || [],
    orders: data?.orders || [],
    bills: data?.bills || [],
    partiesMap: data?.partiesMap || {},
    alliancesMap: data?.alliancesMap || {},
    assembliesMap: data?.assembliesMap || {},
    personsMap: data?.personsMap || {},
    constituenciesMap: data?.constituenciesMap || {},
  };

  return (
    <DbLookupContext.Provider value={value}>
      {children}
    </DbLookupContext.Provider>
  );
};

export const useDbLookup = () => {
  const context = useContext(DbLookupContext);
  if (!context) {
    throw new Error('useDbLookup must be used within a DbLookupProvider');
  }
  return context;
};


