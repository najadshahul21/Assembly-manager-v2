export enum EntityType {
  PERSON = 'person',
  PARTY = 'party',
  ALLIANCE = 'alliance',
  ASSEMBLY = 'assembly',
  DESIGNATION = 'designation',
  CONSTITUENCY = 'constituency'
}

export interface Person {
  id: string;
  name: string;
  gender: string;
  imageUrl: string;
  partyId: string; // 'independent' if none
  designations: string[]; // List of designation IDs
  assemblyRoles: {[assemblyId: string]: string}; // assemblyId -> role name
  roleHistory?: {
    role: string;
    assemblyId: string;
    date: number;
    action: 'promotion' | 'resignation' | 'expiry';
  }[];
  constituencyName?: string;
  mlaStatusText?: string;
  subtitleOverride?: string;
  isSuspended?: boolean;
  updatedAt: number;
}

export interface Party {
  id: string;
  name: string;
  logoUrl: string;
  abbreviation: string;
  founded: string;
  chairman: string;
  headquarters: string;
  colors?: string[]; // list of hex colors
  allianceId: string; // 'independent' if none
  isSuspended?: boolean;
  updatedAt: number;
}

export interface Alliance {
  id: string;
  name: string;
  logoUrl: string;
  abbreviation: string;
  leaderId: string;
  chairmanId: string;
  founderId: string;
  foundedDate: string;
  colors: string[]; // list of hex colors
  highCommandIds?: string[]; // IDs of persons in high command
  leadingPartyId?: string;
  updatedAt: number;
}

export interface AssemblyHistoryEntry {
  term: string;
  speakerId?: string;
  chiefMinisterId?: string;
  notes?: string;
}

export interface Assembly {
  id: string;
  name: string;
  subName: string;
  logoUrl: string;
  termLimits: string;
  history: AssemblyHistoryEntry[];
  description?: string;
  partyControlId: string;
  leaders: {
    speaker?: string;
    deputySpeaker?: string;
    leaderOfHouse?: string;
    chiefMinister?: string;
    deputyLeaderOfHouse?: string;
    deputyChiefMinister?: string;
    leaderOfOpposition?: string;
    deputyLeaderOfOpposition?: string;
    chiefSecretary?: string;
  };
  updatedAt: number;
  isActive?: boolean;
  precededById?: string;
  independentSupports?: {[personId: string]: string};
  composition?: {
    totalSeats: number;
    incumbentCount: number;
    distribution: any[];
    government: any;
    opposition: any;
    others: any[];
    members?: any[];
    seatingLayout?: any[];
  };
}

export interface Designation {
  id: string;
  name: string;
  incumbentId: string; // 'vacant' if none
  assemblyId?: string;
  dateOfSigning: string;
  constituency: string;
  constituencyId?: string; // Link to master constituency
  history: {
    personId: string;
    reason: 'expiry' | 'resignation' | 'appointment';
    date: number;
  }[];
  updatedAt: number;
}

export interface CandidateResult {
  personId?: string;
  candidateName: string;
  partyId?: string;
  partyAbbreviation: string;
  partyColor?: string;
  votes: number;
}

export interface ElectionResult {
  candidates: CandidateResult[];
  winnerId?: string;
  winnerName: string;
  winnerPartyAbbreviation: string;
  winnerPartyColor?: string;
  marginOfVictory: number;
  turnout: number;
  previousPartyAbbreviation?: string;
  outcomeText?: string; // e.g. "BJP gain from CPI(M)" or "CPI(M) hold"
  swingText?: string;   // e.g. "Swing" or "5.2%"
  electionDate?: number;
}

export interface Constituency {
  id: string;
  slNo: string;
  name: string;
  currentIncumbentId: string; // Reference to the person who is currently MLA
  currentAssemblyId?: string; // Current assembly this seat belongs to
  lastElectionResult?: ElectionResult;
  history: {
    personId: string;
    assemblyId: string;
    date: number;
    reason: string;
  }[];
  updatedAt: number;
}
