import { Constituency, Person, Party, ElectionResult, CandidateResult } from '../types';

export function generateDefaultElectionResult(
  con: Constituency,
  incumbent?: Person | null,
  incumbentParty?: Party | null,
  partiesList: Party[] = [],
  personsList: Person[] = []
): ElectionResult {
  // If constituency is Nemom (or slNo 135 / con-nemom), generate the exact sample matching user image
  if (con.name.toLowerCase().includes('nemom') || con.slNo === '135' || con.id === 'con-nemom') {
    return {
      candidates: [
        {
          personId: 'rajeev-chandrasekhar',
          candidateName: 'Rajeev Chandrasekhar',
          partyId: 'bjp',
          partyAbbreviation: 'BJP',
          partyColor: '#EA580C',
          votes: 57192
        },
        {
          personId: incumbent?.id || 'v-sivankutty',
          candidateName: incumbent?.name || 'V. Sivankutty',
          partyId: incumbentParty?.id || 'cpim',
          partyAbbreviation: incumbentParty?.abbreviation || 'CPI(M)',
          partyColor: incumbentParty?.colors?.[0] || '#E11D48',
          votes: 52214
        },
        {
          personId: 'k-s-sabarinadhan',
          candidateName: 'K. S. Sabarinadhan',
          partyId: 'inc',
          partyAbbreviation: 'INC',
          partyColor: '#2563EB',
          votes: 29730
        },
        {
          personId: 'nota',
          candidateName: 'None of the above',
          partyId: 'nota',
          partyAbbreviation: 'NOTA',
          partyColor: '#6B7280',
          votes: 604
        }
      ],
      winnerId: 'rajeev-chandrasekhar',
      winnerName: 'Rajeev Chandrasekhar',
      winnerPartyAbbreviation: 'BJP',
      winnerPartyColor: '#EA580C',
      marginOfVictory: 4978,
      turnout: 140355,
      previousPartyAbbreviation: incumbentParty?.abbreviation || 'CPI(M)',
      outcomeText: `BJP gain from ${incumbentParty?.abbreviation || 'CPI(M)'}`,
      swingText: 'Swing',
      electionDate: Date.now()
    };
  }

  // Generic fallback election result for any constituency
  const winnerName = incumbent?.name || `${con.name} Representative`;
  const winnerPartyAbbr = incumbentParty?.abbreviation || 'CPI(M)';
  const winnerPartyColor = incumbentParty?.colors?.[0] || '#E11D48';

  // Find 2 other rival party candidates from personsList or default
  const rivalParty1 = partiesList.find(p => p.id !== incumbentParty?.id && p.id === 'inc') || partiesList[0] || { id: 'inc', abbreviation: 'INC', colors: ['#2563EB'] };
  const rivalParty2 = partiesList.find(p => p.id !== incumbentParty?.id && p.id !== rivalParty1.id) || { id: 'bjp', abbreviation: 'BJP', colors: ['#EA580C'] };

  const randSeed = (con.name.length * 137) % 5000;
  const winnerVotes = 62000 + randSeed;
  const runnerUpVotes = winnerVotes - (3500 + (randSeed % 4000));
  const thirdVotes = Math.floor(runnerUpVotes * 0.45);
  const notaVotes = 500 + (randSeed % 400);

  const candidates: CandidateResult[] = [
    {
      personId: incumbent?.id,
      candidateName: winnerName,
      partyId: incumbentParty?.id || 'cpim',
      partyAbbreviation: winnerPartyAbbr,
      partyColor: winnerPartyColor,
      votes: winnerVotes
    },
    {
      candidateName: `Rival Candidate (${rivalParty1.abbreviation})`,
      partyId: rivalParty1.id,
      partyAbbreviation: rivalParty1.abbreviation,
      partyColor: rivalParty1.colors?.[0] || '#2563EB',
      votes: runnerUpVotes
    },
    {
      candidateName: `Opposition Candidate (${rivalParty2.abbreviation})`,
      partyId: rivalParty2.id,
      partyAbbreviation: rivalParty2.abbreviation,
      partyColor: rivalParty2.colors?.[0] || '#EA580C',
      votes: thirdVotes
    },
    {
      personId: 'nota',
      candidateName: 'None of the above',
      partyId: 'nota',
      partyAbbreviation: 'NOTA',
      partyColor: '#6B7280',
      votes: notaVotes
    }
  ];

  const turnout = winnerVotes + runnerUpVotes + thirdVotes + notaVotes;
  const marginOfVictory = winnerVotes - runnerUpVotes;

  return {
    candidates,
    winnerId: incumbent?.id,
    winnerName,
    winnerPartyAbbreviation: winnerPartyAbbr,
    winnerPartyColor,
    marginOfVictory,
    turnout,
    previousPartyAbbreviation: winnerPartyAbbr,
    outcomeText: `${winnerPartyAbbr} hold`,
    swingText: 'Swing',
    electionDate: Date.now()
  };
}
