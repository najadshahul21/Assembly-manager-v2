import React, { useMemo, useState, useEffect } from 'react';
import { 
  Assembly, Constituency, Person, Party, Alliance, 
  FrozenElectionResults, FrozenElectionColumn 
} from '../types';
import { firestoreService } from '../firestoreService';
import { getSystemTimestamp, formatAppDate } from '../utils/dateUtils';
import { 
  Vote, Award, CheckCircle2, Lock, RefreshCw, 
  ExternalLink, TrendingUp, TrendingDown, Users, ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AssemblyElectionResultsProps {
  assembly: Assembly;
  constituenciesList: Constituency[];
  partiesList: Party[];
  alliancesList: Alliance[];
  personsList: Person[];
  assembliesList: Assembly[];
  isViewerMode?: boolean;
}

export const AssemblyElectionResults: React.FC<AssemblyElectionResultsProps> = ({
  assembly,
  constituenciesList,
  partiesList,
  alliancesList,
  personsList,
  assembliesList,
  isViewerMode = false,
}) => {
  const navigate = useNavigate();
  const [isFreezing, setIsFreezing] = useState(false);
  const [freezeNotice, setFreezeNotice] = useState<string | null>(null);

  // Helper formatting numbers in Indian/international grouping
  const formatVotes = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  // Find previous assembly for swing and change calculations
  const previousAssembly = useMemo(() => {
    if (assembly.precededById) {
      return assembliesList.find(a => a.id === assembly.precededById);
    }
    if (assembly.slNo && assembly.slNo > 1) {
      return assembliesList.find(a => a.slNo === (assembly.slNo! - 1));
    }
    // Alternatively look for chronological predecessor
    const otherAssemblies = assembliesList
      .filter(a => a.id !== assembly.id && (a.isActive === false || (a.updatedAt && assembly.updatedAt && a.updatedAt < assembly.updatedAt)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return otherAssemblies[0] || null;
  }, [assembly, assembliesList]);

  // Check if all constituencies in this assembly are occupied
  const totalConstituencies = useMemo(() => {
    return constituenciesList.filter(
      c => c.currentAssemblyId === assembly.id || (Array.isArray(c.history) && c.history.some(h => h.assemblyId === assembly.id))
    );
  }, [constituenciesList, assembly.id]);

  const occupiedConstituenciesCount = useMemo(() => {
    return totalConstituencies.filter(
      c => c.currentIncumbentId && c.currentIncumbentId !== 'vacant'
    ).length;
  }, [totalConstituencies]);

  // Live calculation of General Election data (strictly excluding by-elections)
  const computedElectionData = useMemo<FrozenElectionResults>(() => {
    const getAssemblyStats = (targetAssembly: Assembly) => {
      const assemblyConstituencies = constituenciesList.filter(
        c => c.currentAssemblyId === targetAssembly.id || (Array.isArray(c.history) && c.history.some(h => h.assemblyId === targetAssembly.id))
      );

      let totalVotes = 0;
      let totalElectors = 0;
      let totalDeclaredSeats = 0;
      const allianceStats = new Map<string, { votes: number; seats: number }>();
      const partyStats = new Map<string, { votes: number; seats: number }>();

      assemblyConstituencies.forEach(con => {
        const electors = con.totalElectors ? parseInt(con.totalElectors.replace(/\D/g, ''), 10) : 0;
        totalElectors += electors;

        const election = con.lastElectionResult;
        if (!election || !election.candidates || election.candidates.length === 0 || election.isByElection) return;

        // Verify if this is the "General Election" for this assembly
        const assemblyHistory = (con.history || []).filter(h => (h.assemblyId || con.currentAssemblyId) === targetAssembly.id);
        const isSubsequent = assemblyHistory.length > 1 && assemblyHistory.some(h => h.reason?.toLowerCase().includes('resigned') || h.reason?.toLowerCase().includes('expired'));
        if (isSubsequent && election.swingText?.toLowerCase().includes('bye')) return;

        const conVotes = election.candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
        totalVotes += conVotes;
        totalDeclaredSeats += 1;

        // Winner detection (highest votes)
        const winner = election.candidates.reduce((prev, current) => (prev.votes > current.votes) ? prev : current);

        election.candidates.forEach(cand => {
          const isWinner = cand === winner && cand.votes > 0;
          const votes = cand.votes || 0;
          const isNota = cand.candidateName?.toUpperCase() === 'NOTA' || cand.partyAbbreviation?.toUpperCase() === 'NOTA';

          // Party
          const party = partiesList.find(p => p.id === cand.partyId || p.abbreviation.toLowerCase() === cand.partyAbbreviation?.toLowerCase());
          const partyKey = party?.id || cand.partyAbbreviation?.trim().toUpperCase() || 'IND';
          
          if (!isNota) {
            const pStat = partyStats.get(partyKey) || { votes: 0, seats: 0 };
            pStat.votes += votes;
            if (isWinner) pStat.seats += 1;
            partyStats.set(partyKey, pStat);
          }

          // Alliance
          let allianceId = party?.allianceId;
          if ((!allianceId || allianceId === 'independent') && cand.allianceAbbreviation) {
            const matchA = alliancesList.find(a => a.abbreviation.toLowerCase() === cand.allianceAbbreviation?.toLowerCase());
            if (matchA) allianceId = matchA.id;
          }
          if (!allianceId) allianceId = 'independent';

          if (!isNota) {
            const aStat = allianceStats.get(allianceId) || { votes: 0, seats: 0 };
            aStat.votes += votes;
            if (isWinner) aStat.seats += 1;
            allianceStats.set(allianceId, aStat);
          }
        });
      });

      return { totalVotes, totalElectors, totalDeclaredSeats, allianceStats, partyStats };
    };

    const currentStats = getAssemblyStats(assembly);
    const prevStats = previousAssembly ? getAssemblyStats(previousAssembly) : null;
    if (prevStats && previousAssembly?.frozenElectionResults) {
      prevStats.totalVotes = previousAssembly.frozenElectionResults.totalVotesCast;
      prevStats.totalElectors = previousAssembly.frozenElectionResults.totalRegisteredElectors;
    }

    const totalSeatsCount = (constituenciesList.filter(c => c.currentAssemblyId === assembly.id || (Array.isArray(c.history) && c.history.some(h => h.assemblyId === assembly.id)))).length || 140;
    const majorityNeeded = Math.floor(totalSeatsCount / 2) + 1;

    let turnoutPercentage = 0;
    if (currentStats.totalElectors > 0) {
      turnoutPercentage = Number(((currentStats.totalVotes / currentStats.totalElectors) * 100).toFixed(2));
    } else if (currentStats.totalVotes > 0) {
      turnoutPercentage = 75.0;
    }

    let turnoutSwingPp = 0;
    if (prevStats && prevStats.totalElectors > 0 && currentStats.totalElectors > 0) {
      const prevTurnout = (prevStats.totalVotes / prevStats.totalElectors) * 100;
      turnoutSwingPp = Number((turnoutPercentage - prevTurnout).toFixed(2));
    }

    const candidates: { id: string; type: 'alliance' | 'party'; seats: number; votes: number }[] = [];
    
    currentStats.allianceStats.forEach((data, id) => {
      if (id !== 'independent') {
        candidates.push({ id, type: 'alliance', ...data });
      }
    });

    currentStats.partyStats.forEach((data, id) => {
      const party = partiesList.find(p => p.id === id || p.abbreviation.toUpperCase() === id);
      if (!party || !party.allianceId || party.allianceId === 'independent') {
        // Only add if not already covered by alliance or if generic IND
        if (!candidates.some(c => c.id === id)) {
          candidates.push({ id, type: 'party', ...data });
        }
      }
    });

    candidates.sort((a, b) => b.seats - a.seats || b.votes - a.votes);

    const columns: FrozenElectionColumn[] = candidates.slice(0, 3).map(cand => {
      let alliance: Alliance | undefined;
      let leadParty: Party | undefined;
      let leader: Person | undefined;

      if (cand.type === 'alliance') {
        alliance = alliancesList.find(a => a.id === cand.id);
        if (alliance?.leadingPartyId) {
          leadParty = partiesList.find(p => p.id === alliance.leadingPartyId);
        }
        if (!leadParty) {
          const allianceParties = partiesList.filter(p => p.allianceId === cand.id);
          const partyPerf = allianceParties.map(p => ({ party: p, stats: currentStats.partyStats.get(p.id) || { seats: 0, votes: 0 } }));
          partyPerf.sort((a, b) => b.stats.seats - a.stats.seats || b.stats.votes - a.stats.votes);
          leadParty = partyPerf[0]?.party;
        }
        if (alliance?.leaderId && alliance.leaderId !== 'vacant') leader = personsList.find(p => p.id === alliance.leaderId);
      } else {
        leadParty = partiesList.find(p => p.id === cand.id || p.abbreviation.toUpperCase() === cand.id);
      }

      if (!leader && leadParty) {
        if (leadParty.legislativeLeaderId && leadParty.legislativeLeaderId !== 'vacant') leader = personsList.find(p => p.id === leadParty.legislativeLeaderId);
        if (!leader && leadParty.chairman && leadParty.chairman !== 'vacant') leader = personsList.find(p => p.id === leadParty.chairman);
      }

      let leaderSeatName = 'Non-contesting';
      let leaderSeatId: string | undefined;
      let leaderSeatStatus: 'won' | 'lost' | 'multiple_served' | 'not_contested' = 'not_contested';

      if (leader) {
        const leaderContests: { con: Constituency; won: boolean; isServed: boolean }[] = [];
        constituenciesList.forEach(con => {
          const election = con.lastElectionResult;
          if (!election || election.isByElection) return;
          const cand = election.candidates.find(c => c.personId === leader?.id);
          if (cand) {
            const innerWinner = election.candidates.reduce((p, c) => (p.votes > c.votes) ? p : c);
            const won = cand === innerWinner;
            const isServed = con.currentIncumbentId === leader?.id || (con.history || []).some(h => h.personId === leader?.id && h.assemblyId === assembly.id);
            leaderContests.push({ con, won, isServed });
          }
        });

        if (leaderContests.length > 0) {
          const won = leaderContests.filter(c => c.won);
          if (won.length === 0) {
            leaderSeatName = `${leaderContests[0].con.name} (Lost)`;
            leaderSeatId = leaderContests[0].con.id;
            leaderSeatStatus = 'lost';
          } else if (won.length > 1) {
            const served = won.find(c => c.isServed) || won[0];
            leaderSeatName = served.con.name;
            leaderSeatId = served.con.id;
            leaderSeatStatus = 'multiple_served';
          } else {
            leaderSeatName = won[0].con.name;
            leaderSeatId = won[0].con.id;
            leaderSeatStatus = 'won';
          }
        } else if (leader.constituencyName && leader.constituencyName !== 'Special Role') {
          leaderSeatName = leader.constituencyName;
          leaderSeatStatus = 'won';
        }
      }

      const voteShare = currentStats.totalVotes > 0 ? (cand.votes / currentStats.totalVotes) * 100 : 0;
      const prevPerf = prevStats ? (cand.type === 'alliance' ? prevStats.allianceStats.get(cand.id) : prevStats.partyStats.get(cand.id)) : null;
      const lastSeats = prevPerf?.seats || 0;
      const lastVotes = prevPerf?.votes || 0;
      const lastVoteShare = (prevStats && prevStats.totalVotes > 0) ? (lastVotes / prevStats.totalVotes) * 100 : 0;

      return {
        allianceId: cand.type === 'alliance' ? cand.id : 'independent',
        allianceName: alliance?.name,
        allianceAbbreviation: alliance?.abbreviation || (cand.type === 'party' ? leadParty?.abbreviation || 'IND' : 'IND'),
        partyId: leadParty?.id,
        partyName: leadParty?.name,
        partyAbbreviation: leadParty?.abbreviation || 'IND',
        partyColor: leadParty?.colors?.[0] || alliance?.colors?.[0] || '#9CA3AF',
        leaderId: leader?.id,
        leaderName: leader?.name,
        leaderImageUrl: leader?.imageUrl,
        leaderSinceYear: alliance?.foundedDate?.match(/\d{4}/)?.[0] || leadParty?.founded?.match(/\d{4}/)?.[0] || 2021,
        leaderSeatId,
        leaderSeatName,
        leaderSeatStatus,
        lastElectionSeats: lastSeats,
        lastElectionVoteShare: Number(lastVoteShare.toFixed(2)),
        seatsWon: cand.seats,
        seatChange: cand.seats - lastSeats,
        popularVote: cand.votes,
        votePercentage: Number(voteShare.toFixed(2)),
        swingPp: Number((voteShare - lastVoteShare).toFixed(2)),
        allianceSeats: cand.seats,
        allianceSeatChange: cand.seats - lastSeats,
        alliancePopularVote: cand.votes,
        allianceVoteShare: Number(voteShare.toFixed(2)),
      };
    });

    return {
      assemblyId: assembly.id,
      assemblyName: assembly.name,
      frozenAt: getSystemTimestamp(),
      totalSeats: totalSeatsCount,
      majorityNeeded,
      totalRegisteredElectors: currentStats.totalElectors,
      totalVotesCast: currentStats.totalVotes,
      turnoutPercentage,
      turnoutSwingPp,
      registeredElectorsSwingPct: 0,
      totalOccupiedSeats: currentStats.totalDeclaredSeats,
      columns,
    };
  }, [assembly, constituenciesList, partiesList, alliancesList, personsList, previousAssembly]);

  // Use frozen election results if stored; otherwise use live computed data
  const isHistoricallyFrozen = Boolean(assembly.frozenElectionResults);
  const activeElectionData = assembly.frozenElectionResults || computedElectionData;

  const isFullyOccupied = totalConstituencies.length > 0 && occupiedConstituenciesCount === totalConstituencies.length;

  // Auto-freeze when all constituencies are occupied
  useEffect(() => {
    if (isViewerMode) return;
    if (isHistoricallyFrozen) return; // Already frozen
    if (!isFullyOccupied) return; // Not yet fully occupied

    const triggerAutoFreeze = async () => {
      try {
        setIsFreezing(true);
        console.log("All constituencies occupied! Freezing assembly election results as permanent historical data...");
        const frozenData: FrozenElectionResults = {
          ...computedElectionData,
          frozenAt: getSystemTimestamp()
        };
        await firestoreService.updateAssembly(assembly.id, {
          frozenElectionResults: frozenData,
        });
        setFreezeNotice("All assembly seats occupied: General election results permanently frozen as historical data.");
      } catch (err) {
        console.error("Auto-freeze failed:", err);
      } finally {
        setIsFreezing(false);
      }
    };

    triggerAutoFreeze();
  }, [isFullyOccupied, isHistoricallyFrozen, computedElectionData, assembly.id, isViewerMode]);

  // Manual freeze handler
  const handleManualFreeze = async () => {
    if (isViewerMode) return;
    try {
      setIsFreezing(true);
      const frozenData: FrozenElectionResults = {
        ...computedElectionData,
        frozenAt: getSystemTimestamp()
      };
      await firestoreService.updateAssembly(assembly.id, {
        frozenElectionResults: frozenData,
      });
      setFreezeNotice("General election results have been frozen and saved as permanent historical data.");
    } catch (err: any) {
      console.error("Manual freeze error:", err);
      alert(err.message || "Failed to freeze election results.");
    } finally {
      setIsFreezing(false);
    }
  };

  // Recalculate / Unfreeze handler (for authorized updates)
  const handleRecalculateLive = async () => {
    if (isViewerMode) return;
    try {
      setIsFreezing(true);
      await firestoreService.updateAssembly(assembly.id, {
        frozenElectionResults: undefined,
      });
      setFreezeNotice("Archived snapshot unlocked: Displaying live calculated election metrics.");
    } catch (err: any) {
      console.error("Recalculate error:", err);
    } finally {
      setIsFreezing(false);
    }
  };

  const columns = activeElectionData.columns || [];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Freeze / Historical Status Notification Banner */}
      {isHistoricallyFrozen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-300 text-xs font-sans">
          <div className="flex items-center gap-2.5">
            <Lock size={15} className="text-amber-400 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider">Historical General Election Record (Frozen)</span>
              <span className="text-amber-300/70 ml-2">
                Preserved snapshot from {formatAppDate(activeElectionData.frozenAt)}. Subsequent by-elections do not alter this tally.
              </span>
            </div>
          </div>
          {!isViewerMode && (
            <button
              onClick={handleRecalculateLive}
              disabled={isFreezing}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={11} className={isFreezing ? "animate-spin" : ""} />
              <span>Recalculate Live</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300 text-xs font-sans">
          <div className="flex items-center gap-2.5">
            <Vote size={15} className="text-blue-400 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider">Live Election Tally</span>
              <span className="text-blue-300/70 ml-2">
                {occupiedConstituenciesCount} of {totalConstituencies.length} seats occupied. Automatically freezes once all seats are occupied.
              </span>
            </div>
          </div>
          {!isViewerMode && (
            <button
              onClick={handleManualFreeze}
              disabled={isFreezing}
              className="px-3 py-1 bg-[#FFD700] hover:bg-[#ffe234] text-black font-black text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-md shadow-[#FFD700]/10 flex items-center gap-1.5 cursor-pointer"
            >
              <Lock size={11} />
              <span>Freeze & Archive</span>
            </button>
          )}
        </div>
      )}

      {freezeNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium flex items-center justify-between">
          <span>{freezeNotice}</span>
          <button onClick={() => setFreezeNotice(null)} className="text-emerald-400 hover:text-white font-bold text-xs ml-4">✕</button>
        </div>
      )}

      {/* Wikipedia-Style Election Results Infobox (Matching Reference Screenshot) */}
      <div className="w-full bg-[#111215] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-sans text-zinc-100">
        
        {/* Top Header Summary - Exact 3 Lines with Perfect Alignment */}
        <div className="p-4 sm:p-5 text-center border-b border-zinc-800 bg-[#16171b] flex flex-col items-center justify-center space-y-1">
          {/* Line 1: Assembly Name & Year */}
          <h2 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight leading-snug">
            {activeElectionData.assemblyName}
          </h2>
          
          {/* Line 2: Result Summary (e.g. LDF 99 | UDF 41) */}
          <div className="flex items-center justify-center gap-3 text-sm sm:text-base font-black text-[#60a5fa]">
            {columns.map((col, idx) => (
              <React.Fragment key={idx}>
                <div className="flex items-center gap-1.5">
                  <span>{col.allianceAbbreviation || col.partyAbbreviation}</span>
                  <span className="text-white">{col.seatsWon}</span>
                </div>
                {idx < columns.length - 1 && <span className="text-zinc-700 font-normal">|</span>}
              </React.Fragment>
            ))}
            {/* Show 'Others' if there are remaining declared seats not in top 3 */}
            {(() => {
              const top3Seats = columns.reduce((sum, c) => sum + c.seatsWon, 0);
              const totalDeclared = activeElectionData.totalOccupiedSeats || occupiedConstituenciesCount;
              const othersCount = totalDeclared - top3Seats;
              if (othersCount > 0) {
                return (
                  <>
                    <span className="text-zinc-700 font-normal">|</span>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <span className="text-[10px] uppercase font-bold">Others</span>
                      <span className="text-zinc-300 font-black">{othersCount}</span>
                    </div>
                  </>
                );
              }
              return null;
            })()}
          </div>

          {/* Line 3: Majority Threshold / Status */}
          <p className="text-[11px] sm:text-xs text-zinc-400 font-medium uppercase tracking-widest leading-normal">
            {activeElectionData.majorityNeeded} seats needed for a majority
          </p>
        </div>

        {/* Electorate & Turnout Strip */}
        <div className="divide-y divide-zinc-800/80 border-b border-zinc-800 text-xs sm:text-sm bg-[#131417]">
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="font-bold text-zinc-200 uppercase tracking-wide">Registered</span>
            <div className="flex items-center gap-2 font-mono tabular-nums text-zinc-200">
              <span className="font-bold">{formatVotes(activeElectionData.totalRegisteredElectors)}</span>
              {activeElectionData.registeredElectorsSwingPct !== undefined && (
                <span className="text-rose-400 text-xs font-semibold flex items-center gap-0.5">
                  <TrendingDown size={12} /> {Math.abs(activeElectionData.registeredElectorsSwingPct)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-2.5">
            <span className="font-bold text-zinc-200 uppercase tracking-wide">Turnout</span>
            <div className="flex items-center gap-2 font-mono tabular-nums text-zinc-200">
              <span className="font-bold">{activeElectionData.turnoutPercentage.toFixed(2)}%</span>
              {activeElectionData.turnoutSwingPp !== undefined && (
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${activeElectionData.turnoutSwingPp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeElectionData.turnoutSwingPp >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(activeElectionData.turnoutSwingPp)} pp
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Multi-Column Vote Sharing Comparison Table */}
        {columns.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <ShieldAlert size={36} className="mx-auto text-zinc-600" />
            <p className="font-bold text-zinc-400 uppercase tracking-wider text-sm">No Candidate Results Declared</p>
            <p className="text-xs text-zinc-600">Conduct elections in constituencies to populate vote sharing and leader comparison data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[580px]">
              {/* Leader Photo Header Row */}
              <thead>
                <tr className="border-b border-zinc-800 bg-[#16171a]">
                  <th className="w-1/4 p-3 border-r border-zinc-800 bg-[#131417]">
                    <span className="sr-only">Metric</span>
                  </th>
                  {columns.map((col, idx) => (
                    <th 
                      key={col.partyId || col.allianceId || idx} 
                      className="w-1/4 p-2 text-center border-r border-zinc-800 last:border-r-0 align-bottom"
                    >
                      <div className="w-full aspect-[3/4] max-h-56 mx-auto rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700/60 relative group">
                        {col.leaderImageUrl ? (
                          <img 
                            src={col.leaderImageUrl} 
                            alt={col.leaderName || 'Leader'} 
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                            <Users size={40} className="mb-2 text-zinc-700" />
                            <span className="text-[10px] uppercase font-bold text-zinc-600">Portrait</span>
                          </div>
                        )}
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-1.5"
                          style={{ backgroundColor: col.partyColor || '#3B82F6' }}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/80 text-xs sm:text-sm">
                {/* 1. Leader Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Leader</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-bold">
                      {col.leaderId ? (
                        <span 
                          onClick={() => navigate(`/person/${col.leaderId}`)}
                          className="text-[#60a5fa] hover:text-[#93c5fd] hover:underline cursor-pointer block leading-snug"
                        >
                          {col.leaderName}
                        </span>
                      ) : (
                        <span className="text-zinc-400">{col.leaderName || '—'}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* 2. Party Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Lead Party</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-bold">
                      {col.partyId ? (
                        <span 
                          onClick={() => navigate(`/party/${col.partyId}`)}
                          className="text-[#60a5fa] hover:text-[#93c5fd] hover:underline cursor-pointer"
                        >
                          {col.partyAbbreviation}
                        </span>
                      ) : (
                        <span className="text-zinc-300">{col.partyAbbreviation || '—'}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* 3. Alliance Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Alliance</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-bold">
                      {col.allianceId && col.allianceId !== 'independent' ? (
                        <span 
                          onClick={() => navigate(`/alliance/${col.allianceId}`)}
                          className="text-[#60a5fa] hover:text-[#93c5fd] hover:underline cursor-pointer"
                        >
                          {col.allianceAbbreviation || col.allianceId}
                        </span>
                      ) : (
                        <span className="text-zinc-500 font-medium">IND</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* 4. Leader Since Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Leader since</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-mono tabular-nums text-zinc-300">
                      {col.leaderSinceYear || '—'}
                    </td>
                  ))}
                </tr>

                {/* 5. Leader's Seat Row (with Won / Lost / Served logic) */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Leader's seat</td>
                  {columns.map((col, idx) => {
                    const isLost = col.leaderSeatStatus === 'lost' || col.leaderSeatName?.includes('(Lost)');
                    return (
                      <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-medium">
                        {col.leaderSeatId ? (
                          <div className="flex flex-col items-center justify-center">
                            <span 
                              onClick={() => navigate(`/constituency/${col.leaderSeatId}`)}
                              className="text-[#60a5fa] hover:text-[#93c5fd] hover:underline cursor-pointer font-semibold"
                            >
                              {col.leaderSeatName?.replace(/\s*\(Lost\)/i, '')}
                            </span>
                            {isLost && (
                              <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider mt-0.5">
                                (Lost)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={`${isLost ? 'text-rose-400 font-semibold' : 'text-zinc-400'}`}>
                            {col.leaderSeatName || '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* 6. Last Election Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Last election</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-mono tabular-nums text-zinc-400 text-xs">
                      {col.lastElectionVoteShare !== undefined ? `${col.lastElectionVoteShare}%, ` : ''}
                      {col.lastElectionSeats ?? 0} seats
                    </td>
                  ))}
                </tr>

                {/* 7. Seats Won Row (Prominent Highlight) */}
                <tr className="bg-[#18191e] hover:bg-[#1e2026] transition-colors border-y-2 border-zinc-700/80">
                  <td className="p-3 font-black text-white border-r border-zinc-800 bg-[#15161a]">Seats</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-mono tabular-nums text-xl sm:text-2xl font-black text-white">
                      {col.seatsWon}
                    </td>
                  ))}
                </tr>

                {/* 8. Seat Change Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Seat change</td>
                  {columns.map((col, idx) => {
                    const isPositive = col.seatChange >= 0;
                    return (
                      <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-mono tabular-nums font-bold">
                        <span className={`inline-flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {Math.abs(col.seatChange)}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* 9. Popular Vote Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Popular vote</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-mono tabular-nums font-bold text-zinc-200">
                      {formatVotes(col.popularVote)}
                    </td>
                  ))}
                </tr>

                {/* 10. Percentage Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Percentage</td>
                  {columns.map((col, idx) => (
                    <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-mono tabular-nums font-bold text-zinc-200">
                      {col.votePercentage.toFixed(2)}%
                    </td>
                  ))}
                </tr>

                {/* 11. Swing Row */}
                <tr className="hover:bg-zinc-800/20 transition-colors">
                  <td className="p-3 font-bold text-zinc-300 border-r border-zinc-800 bg-[#131417]">Swing</td>
                  {columns.map((col, idx) => {
                    const isPositive = col.swingPp >= 0;
                    return (
                      <td key={idx} className="p-3 text-center border-r border-zinc-800 last:border-r-0 font-mono tabular-nums font-bold">
                        <span className={`inline-flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {Math.abs(col.swingPp).toFixed(2)} pp
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Notes on Methodology & Purity */}
      <div className="text-[11px] text-zinc-500 font-sans leading-relaxed px-2 space-y-1">
        <p>• General election tally strictly isolates general election mandates and excludes midterm by-elections.</p>
        <p>• Alliance-wide metrics include the aggregated results of all constituent parties and supporting independents.</p>
        <p>• Once all constituencies in an assembly are occupied by elected incumbents, the general election record is locked and preserved as permanent historical data.</p>
      </div>
    </div>
  );
};
