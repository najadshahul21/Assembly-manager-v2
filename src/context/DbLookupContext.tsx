import React, { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Person, Party, Alliance, Assembly, Designation, Constituency } from '../types';

interface DbLookupContextType {
  loaded: boolean;
  parties: Party[];
  alliances: Alliance[];
  assemblies: Assembly[];
  designations: Designation[];
  persons: Person[];
  constituencies: Constituency[];
  partiesMap: Record<string, Party>;
  alliancesMap: Record<string, Alliance>;
  assembliesMap: Record<string, Assembly>;
  personsMap: Record<string, Person>;
  constituenciesMap: Record<string, Constituency>;
}

const DbLookupContext = createContext<DbLookupContextType | null>(null);

export const DbLookupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const data = useLiveQuery(async () => {
    const [rawParties, rawAlliances, assemblies, rawDesignations, rawPersons, constituencies] = await Promise.all([
      db.parties.toArray(),
      db.alliances.toArray(),
      db.assemblies.toArray(),
      db.designations.toArray(),
      db.persons.toArray(),
      db.constituencies.toArray(),
    ]);

    const parties = rawParties.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    const alliances = rawAlliances.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    const persons = rawPersons.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    const designations = rawDesignations.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

    const partiesMap: Record<string, Party> = {};
    parties.forEach(p => {
      partiesMap[p.id] = p;
    });

    const alliancesMap: Record<string, Alliance> = {};
    alliances.forEach(a => {
      alliancesMap[a.id] = a;
    });

    const assembliesMap: Record<string, Assembly> = {};
    assemblies.forEach(a => {
      assembliesMap[a.id] = a;
    });

    const personsMap: Record<string, Person> = {};
    persons.forEach(p => {
      personsMap[p.id] = p;
    });

    const constituenciesMap: Record<string, Constituency> = {};
    constituencies.forEach(c => {
      constituenciesMap[c.id] = c;
    });

    return {
      parties,
      alliances,
      assemblies,
      designations,
      persons,
      constituencies,
      partiesMap,
      alliancesMap,
      assembliesMap,
      personsMap,
      constituenciesMap,
    };
  }, []);

  const value: DbLookupContextType = {
    loaded: !!data,
    parties: data?.parties || [],
    alliances: data?.alliances || [],
    assemblies: data?.assemblies || [],
    designations: data?.designations || [],
    persons: data?.persons || [],
    constituencies: data?.constituencies || [],
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
