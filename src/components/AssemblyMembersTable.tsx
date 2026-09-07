import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Assembly, Constituency, Person, Party, Alliance, Designation } from "../types";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Users,
  Award,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export interface AssemblySeatItem {
  constituency: Constituency;
  politician?: Person;
  party?: Party;
  alliance?: Alliance;
}

interface AssemblyMembersTableProps {
  assembly: Assembly;
  seats: AssemblySeatItem[];
  designationsList?: Designation[];
  isDissolved?: boolean;
  government?: any;
  onPromote?: (personId: string, personName: string) => void;
  onSupportAlliance?: (personId: string, personName: string) => void;
}

type SortColumn = "no" | "constituency" | "name" | "party" | "alliance" | "remarks";
type SortDirection = "asc" | "desc";

interface ProcessedRow {
  index: number;
  slNo: number;
  slNoDisplay: string;
  constituency: {
    id: string;
    fullName: string;
    baseName: string;
    categoryTag?: string;
  };
  politician?: {
    id: string;
    name: string;
    partyId?: string;
    isIndependent: boolean;
  };
  party?: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  };
  alliance?: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  };
  remarks: string[];
  hasMinisterRole: boolean;
  isGovernmentMember: boolean;
}

export const AssemblyMembersTable: React.FC<AssemblyMembersTableProps> = ({
  assembly,
  seats,
  designationsList = [],
  isDissolved = false,
  government,
  onPromote,
  onSupportAlliance,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "occupied" | "vacant" | "remarks">("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("no");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Format leader titles mapping
  const leaderRoleTitles: Record<string, string> = {
    speaker: "Speaker",
    deputySpeaker: "Deputy Speaker",
    leaderOfHouse: "Leader of the House",
    chiefMinister: "Chief Minister",
    deputyLeaderOfHouse: "Deputy Leader of the House",
    deputyChiefMinister: "Deputy Chief Minister",
    leaderOfOpposition: "Leader of the Opposition",
    deputyLeaderOfOpposition: "Deputy Leader of the Opposition",
    chiefWhip: "Chief Whip",
    chiefSecretary: "Chief Secretary",
  };

  // Helper to extract roles/remarks for a politician in this assembly
  const getRemarksForPolitician = (p?: Person): { remarks: string[]; hasMinisterRole: boolean } => {
    if (!p) return { remarks: [], hasMinisterRole: false };

    const remarksSet = new Set<string>();
    let hasMinister = false;

    // 1. Leader roles on Assembly
    if (assembly.leaders) {
      Object.entries(assembly.leaders).forEach(([key, leaderId]) => {
        if (leaderId === p.id) {
          const title = leaderRoleTitles[key] || key.replace(/([A-Z])/g, " $1").trim();
          remarksSet.add(title);
        }
      });
    }

    // 2. Custom assembly roles
    if (p.assemblyRoles && p.assemblyRoles[assembly.id]) {
      const customRoles = p.assemblyRoles[assembly.id].split(", ");
      customRoles.forEach((r) => {
        const trimmed = r.trim();
        if (!trimmed) return;
        // Do not display "MLA for <Constituency>" in remarks since the table already has Constituency
        if (trimmed.toLowerCase().startsWith("mla for") || trimmed.toLowerCase().startsWith("hon'ble mla for")) {
          return;
        }
        if (trimmed.toLowerCase().includes("minister")) {
          hasMinister = true;
        }
        remarksSet.add(trimmed);
      });
    }

    // 3. Designations in the assembly
    designationsList.forEach((d) => {
      if (d.assemblyId === assembly.id && d.incumbentId === p.id) {
        const trimmed = d.name.trim();
        if (!trimmed.toLowerCase().startsWith("mla for")) {
          if (trimmed.toLowerCase().includes("minister")) {
            hasMinister = true;
          }
          remarksSet.add(trimmed);
        }
      }
    });

    const remarks = Array.from(remarksSet);
    return { remarks, hasMinisterRole: hasMinister };
  };

  // Process raw seats data into normalized rows
  const processedRows: ProcessedRow[] = useMemo(() => {
    return (seats || []).map((seat, idx) => {
      const con = seat.constituency;
      const rawSlNo = con.slNo ? parseInt(con.slNo, 10) : idx + 1;
      const slNo = isNaN(rawSlNo) ? idx + 1 : rawSlNo;
      const slNoDisplay = slNo.toString();

      // Parse Category tag like "(SC)" or "(ST)" from name or category property
      let baseName = con.name || `Seat #${slNo}`;
      let categoryTag: string | undefined = undefined;

      const tagMatch = baseName.match(/\s*(\((SC|ST|GEN|General|Nominated)\))\s*$/i);
      if (tagMatch) {
        categoryTag = tagMatch[1];
        baseName = baseName.replace(tagMatch[0], "").trim();
      }

      const p = seat.politician;
      const isIndependent = p?.partyId === "independent";
      const { remarks, hasMinisterRole } = getRemarksForPolitician(p);

      // Party information
      let partyObj: ProcessedRow["party"] = undefined;
      if (p) {
        if (isIndependent) {
          partyObj = {
            id: "independent",
            name: "Independent",
            abbreviation: "IND",
            color: "#6b7280",
          };
        } else if (seat.party) {
          partyObj = {
            id: seat.party.id,
            name: seat.party.name,
            abbreviation: seat.party.abbreviation || seat.party.name,
            color: seat.party.colors?.[0] || "#ef4444",
          };
        }
      }

      // Alliance information
      let allianceObj: ProcessedRow["alliance"] = undefined;
      if (p) {
        if (seat.alliance && seat.alliance.id !== "independent") {
          allianceObj = {
            id: seat.alliance.id,
            name: seat.alliance.name,
            abbreviation: seat.alliance.abbreviation || seat.alliance.name,
            color: seat.alliance.colors?.[0] || "#3b82f6",
          };
        } else if (assembly.independentSupports?.[p.id]) {
          const supId = assembly.independentSupports[p.id];
          if (seat.alliance && seat.alliance.id === supId) {
            allianceObj = {
              id: seat.alliance.id,
              name: seat.alliance.name,
              abbreviation: seat.alliance.abbreviation || seat.alliance.name,
              color: seat.alliance.colors?.[0] || "#3b82f6",
            };
          }
        }
      }

      // Determine government composition membership
      const gov = government || assembly.composition?.government;
      let govAllianceId = gov?.id;
      const govParties = new Set<string>((gov?.parties || []).map((pt: any) => pt.id));

      if (!govAllianceId && seats && seats.length > 0) {
        const groupCounts: Record<string, number> = {};
        seats.forEach(s => {
          if (s.politician) {
            let aId = s.alliance ? s.alliance.id : (s.party?.allianceId || s.party?.id || 'independent');
            if (s.politician.partyId === 'independent' && assembly.independentSupports?.[s.politician.id]) {
              aId = assembly.independentSupports[s.politician.id];
            }
            groupCounts[aId] = (groupCounts[aId] || 0) + 1;
          }
        });
        const topGroup = Object.entries(groupCounts).sort((a, b) => b[1] - a[1])[0];
        if (topGroup) govAllianceId = topGroup[0];
      }

      let isGovernmentMember = false;
      if (p && govAllianceId) {
        if (isIndependent) {
          const sup = assembly.independentSupports?.[p.id];
          isGovernmentMember = sup === govAllianceId;
        } else {
          isGovernmentMember =
            (seat.alliance && seat.alliance.id === govAllianceId) ||
            (seat.party && (seat.party.allianceId === govAllianceId || govParties.has(seat.party.id) || seat.party.id === govAllianceId));
        }
      }

      return {
        index: idx,
        slNo,
        slNoDisplay,
        constituency: {
          id: con.id,
          fullName: con.name,
          baseName,
          categoryTag,
        },
        politician: p
          ? {
              id: p.id,
              name: p.name,
              partyId: p.partyId,
              isIndependent,
            }
          : undefined,
        party: partyObj,
        alliance: allianceObj,
        remarks,
        hasMinisterRole,
        isGovernmentMember,
      };
    });
  }, [seats, assembly, designationsList, government]);

  // Handle column sort toggle
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filter and sort rows
  const filteredAndSortedRows = useMemo(() => {
    let list = [...processedRows];

    // Filter by tab
    if (activeFilter === "occupied") {
      list = list.filter((r) => !!r.politician);
    } else if (activeFilter === "vacant") {
      list = list.filter((r) => !r.politician);
    } else if (activeFilter === "remarks") {
      list = list.filter((r) => r.remarks.length > 0);
    }

    // Filter by search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((r) => {
        return (
          r.slNoDisplay.includes(q) ||
          r.constituency.fullName.toLowerCase().includes(q) ||
          (r.politician && r.politician.name.toLowerCase().includes(q)) ||
          (r.party && (r.party.abbreviation.toLowerCase().includes(q) || r.party.name.toLowerCase().includes(q))) ||
          (r.alliance && (r.alliance.abbreviation.toLowerCase().includes(q) || r.alliance.name.toLowerCase().includes(q))) ||
          r.remarks.some((rem) => rem.toLowerCase().includes(q))
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "no":
          cmp = a.slNo - b.slNo;
          break;
        case "constituency":
          cmp = a.constituency.baseName.localeCompare(b.constituency.baseName, undefined, { sensitivity: "base" });
          break;
        case "name":
          if (!a.politician && !b.politician) cmp = a.slNo - b.slNo;
          else if (!a.politician) cmp = 1;
          else if (!b.politician) cmp = -1;
          else cmp = a.politician.name.localeCompare(b.politician.name, undefined, { sensitivity: "base" });
          break;
        case "party":
          const partyA = a.party?.abbreviation || "ZZZ";
          const partyB = b.party?.abbreviation || "ZZZ";
          cmp = partyA.localeCompare(partyB, undefined, { sensitivity: "base" });
          if (cmp === 0) cmp = a.slNo - b.slNo;
          break;
        case "alliance":
          const allA = a.alliance?.abbreviation || "ZZZ";
          const allB = b.alliance?.abbreviation || "ZZZ";
          cmp = allA.localeCompare(allB, undefined, { sensitivity: "base" });
          if (cmp === 0) cmp = a.slNo - b.slNo;
          break;
        case "remarks":
          const remA = a.remarks.join(" ") || "ZZZ";
          const remB = b.remarks.join(" ") || "ZZZ";
          cmp = remA.localeCompare(remB, undefined, { sensitivity: "base" });
          if (cmp === 0) cmp = a.slNo - b.slNo;
          break;
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return list;
  }, [processedRows, activeFilter, searchTerm, sortColumn, sortDirection]);

  // Compute row spans for Party and Alliance columns
  const { partySpans, allianceSpans } = useMemo(() => {
    const pSpans: number[] = new Array(filteredAndSortedRows.length).fill(1);
    const aSpans: number[] = new Array(filteredAndSortedRows.length).fill(1);

    // Party spans (merge consecutive rows with the exact same party)
    let i = 0;
    while (i < filteredAndSortedRows.length) {
      const row = filteredAndSortedRows[i];
      if (!row.politician || !row.party) {
        pSpans[i] = 1;
        i++;
        continue;
      }
      const partyKey = `${row.party.id}-${row.party.abbreviation}`;
      let count = 1;
      while (
        i + count < filteredAndSortedRows.length &&
        filteredAndSortedRows[i + count].politician &&
        filteredAndSortedRows[i + count].party &&
        `${filteredAndSortedRows[i + count].party?.id}-${filteredAndSortedRows[i + count].party?.abbreviation}` === partyKey
      ) {
        count++;
      }
      pSpans[i] = count;
      for (let j = 1; j < count; j++) {
        pSpans[i + j] = 0;
      }
      i += count;
    }

    // Alliance spans (merge consecutive rows with the exact same alliance)
    i = 0;
    while (i < filteredAndSortedRows.length) {
      const row = filteredAndSortedRows[i];
      if (!row.politician || !row.alliance) {
        aSpans[i] = 1;
        i++;
        continue;
      }
      const allianceKey = `${row.alliance.id}-${row.alliance.abbreviation}`;
      let count = 1;
      while (
        i + count < filteredAndSortedRows.length &&
        filteredAndSortedRows[i + count].politician &&
        filteredAndSortedRows[i + count].alliance &&
        `${filteredAndSortedRows[i + count].alliance?.id}-${filteredAndSortedRows[i + count].alliance?.abbreviation}` === allianceKey
      ) {
        count++;
      }
      aSpans[i] = count;
      for (let j = 1; j < count; j++) {
        aSpans[i + j] = 0;
      }
      i += count;
    }

    return { partySpans: pSpans, allianceSpans: aSpans };
  }, [filteredAndSortedRows]);

  // Counts for summary tags
  const occupiedCount = processedRows.filter((r) => !!r.politician).length;
  const vacantCount = processedRows.filter((r) => !r.politician).length;
  const ministersCount = processedRows.filter((r) => r.remarks.length > 0).length;

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#16181f] p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeFilter === "all"
                ? "bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/20"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            All Seats ({processedRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("occupied")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeFilter === "occupied"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            Occupied ({occupiedCount})
          </button>
          {vacantCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter("vacant")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeFilter === "vacant"
                  ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                  : "bg-white/5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              }`}
            >
              Vacant ({vacantCount})
            </button>
          )}
          {ministersCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter("remarks")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeFilter === "remarks"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "bg-white/5 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
              }`}
            >
              Leaders & Ministers ({ministersCount})
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search member, constituency, party..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Legislative Table Container */}
      <div className="bg-[#121418] border border-[#272b35] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left select-text">
            {/* Table Header */}
            <thead>
              <tr className="bg-[#1b1e25] text-gray-200 text-xs font-bold tracking-wide border-b border-[#2d323c]">
                {/* No. Column */}
                <th
                  onClick={() => handleSort("no")}
                  className="w-14 min-w-[56px] px-3 py-3 text-center border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>No.</span>
                    {sortColumn === "no" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#FFD700]" /> : <ArrowDown size={12} className="text-[#FFD700]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Constituency Column */}
                <th
                  onClick={() => handleSort("constituency")}
                  className="min-w-[160px] px-4 py-3 border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Constituency</span>
                    {sortColumn === "constituency" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#FFD700]" /> : <ArrowDown size={12} className="text-[#FFD700]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Name Column */}
                <th
                  onClick={() => handleSort("name")}
                  className="min-w-[200px] px-4 py-3 border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    {sortColumn === "name" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#FFD700]" /> : <ArrowDown size={12} className="text-[#FFD700]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Party Column */}
                <th
                  onClick={() => handleSort("party")}
                  className="w-28 min-w-[100px] px-3 py-3 border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Party</span>
                    {sortColumn === "party" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#FFD700]" /> : <ArrowDown size={12} className="text-[#FFD700]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Alliance Column */}
                <th
                  onClick={() => handleSort("alliance")}
                  className="w-28 min-w-[100px] px-3 py-3 border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Alliance</span>
                    {sortColumn === "alliance" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#FFD700]" /> : <ArrowDown size={12} className="text-[#FFD700]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Remarks Column */}
                <th
                  onClick={() => handleSort("remarks")}
                  className="min-w-[240px] px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Remarks</span>
                    {sortColumn === "remarks" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#FFD700]" /> : <ArrowDown size={12} className="text-[#FFD700]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {filteredAndSortedRows.map((row, idx) => {
                const partySpan = partySpans[idx];
                const allianceSpan = allianceSpans[idx];

                return (
                  <tr
                    key={`${row.constituency.id}-${row.politician?.id || "vacant"}-${idx}`}
                    className="border-b border-[#242832] hover:bg-white/[0.025] transition-colors group"
                  >
                    {/* 1. No. Cell */}
                    <td className="px-3 py-2.5 text-center font-bold text-white text-xs sm:text-sm border-r border-[#242832] bg-[#14161b]">
                      {row.slNoDisplay}
                    </td>

                    {/* 2. Constituency Cell */}
                    <td className="px-4 py-2.5 text-xs sm:text-sm font-medium border-r border-[#242832]">
                      <div className="flex items-center flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/constituency/${row.constituency.id}`)}
                          className="text-sky-400 hover:text-sky-300 hover:underline transition-colors text-left"
                        >
                          {row.constituency.baseName}
                        </button>
                        {row.constituency.categoryTag && (
                          <span className="text-gray-300 font-normal">
                            {row.constituency.categoryTag}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Name Cell */}
                    <td className="px-4 py-2.5 text-xs sm:text-sm font-medium border-r border-[#242832]">
                      {row.politician ? (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/person/${row.politician!.id}`)}
                            className="text-sky-400 hover:text-sky-300 hover:underline transition-colors text-left"
                          >
                            {row.politician.name}
                          </button>
                          {/* Quick support alliance button for independents */}
                          {!isDissolved && row.politician.isIndependent && onSupportAlliance && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSupportAlliance(row.politician!.id, row.politician!.name);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-[10px] bg-white/5 hover:bg-[#FFD700]/20 text-[#FFD700] px-1.5 py-0.5 rounded border border-[#FFD700]/30 transition-all"
                              title="Set alliance support"
                            >
                              Support Alliance
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-red-400/90 italic text-xs font-normal">
                          Vacant
                        </span>
                      )}
                    </td>

                    {/* 4. Party Cell (with vertical color strip & RowSpan) */}
                    {partySpan > 0 && (
                      <td
                        rowSpan={partySpan}
                        style={{
                          borderLeft: row.party ? `8px solid ${row.party.color}` : "8px solid transparent",
                        }}
                        className="px-3 py-2.5 text-xs sm:text-sm font-bold text-gray-200 border-r border-[#242832] bg-[#14161b] align-middle"
                      >
                        {row.party ? (
                          row.party.id === "independent" ? (
                            <span className="text-gray-400">IND</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/party/${row.party!.id}`)}
                              className="text-gray-200 hover:text-white hover:underline transition-colors text-left"
                            >
                              {row.party.abbreviation}
                            </button>
                          )
                        ) : (
                          <span className="text-gray-500 font-normal">—</span>
                        )}
                      </td>
                    )}

                    {/* 5. Alliance Cell (with vertical color strip & RowSpan) */}
                    {allianceSpan > 0 && (
                      <td
                        rowSpan={allianceSpan}
                        style={{
                          borderLeft: row.alliance ? `8px solid ${row.alliance.color}` : "8px solid transparent",
                        }}
                        className="px-3 py-2.5 text-xs sm:text-sm font-bold text-gray-200 border-r border-[#242832] bg-[#14161b] align-middle"
                      >
                        {row.alliance ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/alliance/${row.alliance!.id}`)}
                            className="text-gray-200 hover:text-white hover:underline transition-colors text-left"
                          >
                            {row.alliance.abbreviation}
                          </button>
                        ) : (
                          <span className="text-gray-500 font-normal">—</span>
                        )}
                      </td>
                    )}

                    {/* 6. Remarks Cell */}
                    <td className="px-4 py-2.5 text-xs sm:text-sm text-gray-300 font-normal">
                      <div className="flex items-center justify-between gap-2 min-h-[22px]">
                        {row.remarks.length > 0 ? (
                          <div className="space-y-0.5">
                            {row.remarks.map((remark, rIdx) => {
                              const isOppLeader = remark.toLowerCase().includes("opposition");
                              const isHouseLeader = remark.toLowerCase().includes("leader of the house") || remark.toLowerCase().includes("chief minister");
                              const isSpeaker = remark.toLowerCase().includes("speaker");

                              if (isOppLeader || isHouseLeader || isSpeaker) {
                                return (
                                  <div
                                    key={rIdx}
                                    className="text-sky-400 font-medium hover:text-sky-300 transition-colors"
                                  >
                                    {remark}
                                  </div>
                                );
                              }

                              return (
                                <div key={rIdx} className="text-gray-200">
                                  {remark}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-transparent select-none">—</span>
                        )}

                        {/* Promote to Cabinet / Add Portfolio action button (Only for Government MLAs) */}
                        {!isDissolved && row.politician && !row.hasMinisterRole && row.isGovernmentMember && onPromote && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPromote(row.politician!.id, row.politician!.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-[#FFD700]/20 text-[#FFD700] px-2 py-1 rounded-lg border border-[#FFD700]/30 transition-all shrink-0 ml-auto"
                            title="Promote to Cabinet / Assign Portfolio"
                          >
                            + Assign Portfolio
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Empty state if search or filters return 0 rows */}
              {filteredAndSortedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500 italic">
                    <p className="text-sm">No members matching the current criteria.</p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="mt-2 text-xs text-[#FFD700] hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-3 bg-[#16181f] border-t border-[#272b35] flex items-center justify-between text-xs text-gray-400">
          <div>
            Showing <span className="text-white font-bold">{filteredAndSortedRows.length}</span> of{" "}
            <span className="text-white font-bold">{processedRows.length}</span> seats
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {occupiedCount} Occupied
            </span>
            {vacantCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                {vacantCount} Vacant
              </span>
            )}
            {ministersCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                {ministersCount} with Remarks
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
