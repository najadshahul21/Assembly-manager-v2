import { Constituency, Person, Party, ElectionResult, CandidateResult } from '../types';

export function generateDefaultElectionResult(
  con: Constituency,
  incumbent?: Person | null,
  incumbentParty?: Party | null,
  partiesList: Party[] = [],
  personsList: Person[] = []
): ElectionResult {
  const activeParties = partiesList.filter((p) => !p.isSuspended);
  const activeIncumbent = incumbent && !incumbent.isSuspended ? incumbent : null;
  const activeIncumbentParty = incumbentParty && !incumbentParty.isSuspended ? incumbentParty : null;

  // If constituency is Nemom (or slNo 135 / con-nemom), generate the sample matching user image
  if (con.name.toLowerCase().includes('nemom') || con.slNo === '135' || con.id === 'con-nemom') {
    const rcPerson = personsList.find(p => p.id === 'rajeev-chandrasekhar');
    const vsPerson = personsList.find(p => p.id === (activeIncumbent?.id || 'v-sivankutty'));
    const isRcActive = !rcPerson || !rcPerson.isSuspended;
    const isVsActive = !vsPerson || !vsPerson.isSuspended;

    if (isRcActive) {
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
          ...(isVsActive ? [{
            personId: activeIncumbent?.id || 'v-sivankutty',
            candidateName: activeIncumbent?.name || 'V. Sivankutty',
            partyId: activeIncumbentParty?.id || 'cpim',
            partyAbbreviation: activeIncumbentParty?.abbreviation || 'CPI(M)',
            partyColor: activeIncumbentParty?.colors?.[0] || '#E11D48',
            votes: 52214
          }] : []),
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
        previousPartyAbbreviation: activeIncumbentParty?.abbreviation || 'CPI(M)',
        outcomeText: `BJP gain from ${activeIncumbentParty?.abbreviation || 'CPI(M)'}`,
        swingText: 'Swing',
        electionDate: Date.now()
      };
    }
  }

  // Generic fallback election result for any constituency
  const winnerName = activeIncumbent?.name || `${con.name} Representative`;
  const winnerPartyAbbr = activeIncumbentParty?.abbreviation || activeParties[0]?.abbreviation || 'IND';
  const winnerPartyColor = activeIncumbentParty?.colors?.[0] || activeParties[0]?.colors?.[0] || '#2563EB';

  // Find rival party candidates from non-suspended parties
  const rivalParty1 = activeParties.find(p => p.id !== activeIncumbentParty?.id) || { id: 'inc', abbreviation: 'INC', colors: ['#2563EB'] };
  const rivalParty2 = activeParties.find(p => p.id !== activeIncumbentParty?.id && p.id !== rivalParty1.id) || { id: 'bjp', abbreviation: 'BJP', colors: ['#EA580C'] };

  const randSeed = (con.name.length * 137) % 5000;
  const winnerVotes = 62000 + randSeed;
  const runnerUpVotes = winnerVotes - (3500 + (randSeed % 4000));
  const thirdVotes = Math.floor(runnerUpVotes * 0.45);
  const notaVotes = 500 + (randSeed % 400);

  const candidates: CandidateResult[] = [
    {
      personId: activeIncumbent?.id,
      candidateName: winnerName,
      partyId: activeIncumbentParty?.id || 'independent',
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
    winnerId: activeIncumbent?.id,
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
