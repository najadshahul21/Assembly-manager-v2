import React from 'react';
import { ElectionResult } from '../types';

interface ElectionResultsTableProps {
  result: ElectionResult;
  onPersonClick?: (personId: string) => void;
}

export const ElectionResultsTable: React.FC<ElectionResultsTableProps> = ({
  result,
  onPersonClick,
}) => {
  if (!result || !result.candidates || result.candidates.length === 0) {
    return null;
  }

  // Ensure candidates are sorted by votes descending
  const sortedCandidates = [...result.candidates].sort((a, b) => b.votes - a.votes);
  const winner = sortedCandidates[0];
  const runnerUp = sortedCandidates[1];

  const turnout = result.turnout || sortedCandidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  const margin = result.marginOfVictory ?? (winner && runnerUp ? winner.votes - runnerUp.votes : (winner?.votes || 0));

  const outcomeText = result.outcomeText || (
    winner
      ? `${result.winnerPartyAbbreviation || winner.partyAbbreviation} ${
          result.previousPartyAbbreviation && result.previousPartyAbbreviation !== (result.winnerPartyAbbreviation || winner.partyAbbreviation)
            ? 'gain from ' + result.previousPartyAbbreviation
            : 'hold'
        }`
      : ''
  );

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  return (
    <div className="w-full my-4 rounded-lg overflow-hidden border border-zinc-800 bg-[#141416] text-zinc-200 font-sans shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#1f1f22] border-b border-zinc-800 text-zinc-100 font-bold text-base">
              <th className="py-3 px-4 w-[25%] font-bold text-white border-r border-zinc-800">
                Party
              </th>
              <th className="py-3 px-4 w-[45%] font-bold text-white border-r border-zinc-800">
                Candidate
              </th>
              <th className="py-3 px-4 w-[30%] font-bold text-white text-right">
                Votes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {sortedCandidates.map((cand, index) => {
              const isWinner = index === 0;
              const barColor = cand.partyColor || (
                cand.partyAbbreviation === 'BJP' ? '#EA580C' :
                cand.partyAbbreviation === 'CPI(M)' || cand.partyAbbreviation === 'CPM' ? '#E11D48' :
                cand.partyAbbreviation === 'CPI' ? '#EF4444' :
                cand.partyAbbreviation === 'INC' ? '#2563EB' :
                cand.partyAbbreviation === 'IUML' ? '#10B981' :
                cand.partyAbbreviation === 'KC(M)' ? '#EC4899' :
                cand.partyAbbreviation === 'NOTA' ? '#6B7280' : '#888888'
              );

              return (
                <tr key={cand.personId || `cand-${index}`} className="hover:bg-zinc-800/40 transition-colors">
                  {/* Party Column with Accent Color Bar */}
                  <td className="py-3 px-3 relative border-r border-zinc-800">
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5"
                      style={{ backgroundColor: barColor }}
                    />
                    <span className="pl-2 font-bold text-[#60a5fa] text-base sm:text-lg">
                      {cand.partyAbbreviation}
                    </span>
                  </td>

                  {/* Candidate Column */}
                  <td className="py-3 px-4 border-r border-zinc-800">
                    <span
                      onClick={() => cand.personId && cand.personId !== 'nota' && onPersonClick?.(cand.personId)}
                      className={`text-base sm:text-lg font-semibold text-[#0ea5e9] hover:text-[#38bdf8] ${
                        cand.personId && cand.personId !== 'nota' ? 'cursor-pointer hover:underline' : ''
                      }`}
                    >
                      {cand.candidateName}
                    </span>
                  </td>

                  {/* Votes Column */}
                  <td className="py-3 px-4 text-right">
                    <span className={`text-base sm:text-lg ${isWinner ? 'font-extrabold text-white' : 'font-medium text-zinc-200'}`}>
                      {formatNumber(cand.votes)}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Margin of Victory Row */}
            <tr className="bg-[#18181b]/60">
              <td className="py-3 px-4 border-r border-zinc-800"></td>
              <td className="py-3 px-4 border-r border-zinc-800 text-center text-zinc-200 font-normal text-base sm:text-lg">
                Margin of victory
              </td>
              <td className="py-3 px-4 text-right font-medium text-zinc-200 text-base sm:text-lg">
                {formatNumber(margin)}
              </td>
            </tr>

            {/* Turnout Row */}
            <tr className="bg-[#18181b]/60">
              <td className="py-3 px-4 border-r border-zinc-800"></td>
              <td className="py-3 px-4 border-r border-zinc-800 text-right pr-6 font-semibold text-[#60a5fa] text-base sm:text-lg">
                Turnout
              </td>
              <td className="py-3 px-4 text-right font-medium text-zinc-200 text-base sm:text-lg">
                {formatNumber(turnout)}
              </td>
            </tr>

            {/* Winner / Outcome Row */}
            <tr className="bg-[#1a1a1d] border-t border-zinc-700/80">
              <td colSpan={2} className="py-3.5 px-3 relative">
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: winner?.partyColor || result.winnerPartyColor || '#EA580C' }}
                />
                <div className="pl-3 text-base sm:text-lg">
                  {renderOutcomeText(outcomeText, result, winner)}
                </div>
              </td>
              <td className="py-3.5 px-4 text-right font-semibold text-[#60a5fa] text-base sm:text-lg">
                {result.swingText || 'Swing'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

function renderOutcomeText(
  outcomeText: string,
  result: ElectionResult,
  winner?: any
) {
  if (outcomeText.includes(' gain from ') || outcomeText.includes(' hold')) {
    const isGain = outcomeText.includes('gain');
    const winnerParty = result.winnerPartyAbbreviation || winner?.partyAbbreviation || outcomeText.split(' ')[0];
    
    let prevParty = result.previousPartyAbbreviation;
    if (!prevParty && isGain && outcomeText.includes(' gain from ')) {
      prevParty = outcomeText.substring(outcomeText.indexOf(' gain from ') + 11).trim();
    }

    if (isGain) {
      return (
        <span>
          <span className="text-[#60a5fa] font-semibold">{winnerParty}</span>{' '}
          <strong className="text-white font-black">gain</strong> from{' '}
          <span className="text-[#60a5fa] font-semibold">{prevParty || 'new constituency'}</span>
        </span>
      );
    } else {
      return (
        <span>
          <span className="text-[#60a5fa] font-semibold">{winnerParty}</span>{' '}
          <strong className="text-white font-black">hold</strong>
        </span>
      );
    }
  }

  return <span className="text-zinc-200">{outcomeText}</span>;
}
