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
  Zap,
} from "lucide-react";
import {
  prefixRole,
  formatPersonName,
} from "../utils/governmentUtils";

export interface AssemblySeatItem {
  constituency: Constituency;
  incumbents: {
    person: Person;
    party?: Party;
    alliance?: Alliance;
    reason?: string;
    isByelected?: boolean;
    removalDate?: number;
    electionDate?: number;
  }[];
}

interface AssemblyMembersTableProps {
  assembly: Assembly;
  seats: AssemblySeatItem[];
  designationsList?: Designation[];
  alliancesList?: Alliance[];
  isDissolved?: boolean;
  government?: any;
  onPromote?: (personId: string, personName: string) => void;
  onSupportAlliance?: (personId: string, personName: string) => void;
}

type SortColumn = "no" | "constituency" | "name" | "party" | "alliance" | "remarks" | "actions";
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
  incumbents: {
    id: string;
    name: string;
    gender: string;
    partyId?: string;
    isIndependent: boolean;
    reason?: string;
    isByelected?: boolean;
    removalDate?: number;
    electionDate?: number;
    remarks: string[];
    hasMinisterRole: boolean;
    isSupportingAlliance: boolean;
  }[];
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
  isSupportingAlliance: boolean;
  politicianId?: string;
}

export const AssemblyMembersTable: React.FC<AssemblyMembersTableProps> = ({
  assembly,
  seats,
  designationsList = [],
  alliancesList = [],
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
    chiefMinister: "Chief Minister",
    deputyChiefMinister: "Deputy Chief Minister",
    leaderOfOpposition: "Leader of the Opposition",
    deputyLeaderOfOpposition: "Deputy Leader of the Opposition",
    oppositionLeader: "Leader of the Opposition",
    deputyOppositionLeader: "Deputy Leader of the Opposition",
    chiefWhip: "Chief Whip",
    governmentChiefWhip: "Chief Whip",
    chiefSecretary: "Chief Secretary",
  };

  // Check if a designation or role assembly ID matches the current assembly
  const isMatchingAssembly = (aId?: string) => {
    if (!aId) return assembly.isActive !== false;
    if (aId === assembly.id) return true;
    if (aId.toLowerCase() === assembly.id.toLowerCase()) return true;
    const cleanA = assembly.id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const cleanTarget = aId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return cleanA === cleanTarget || cleanA.includes(cleanTarget) || cleanTarget.includes(cleanA);
  };

  // Pre-compute designations map for faster lookups in the loop
  const designationsByIncumbentMap = useMemo(() => {
    const map = new Map<string, Designation[]>();
    (designationsList || []).forEach((d) => {
      if (isMatchingAssembly(d.assemblyId)) {
        if (d.incumbentId && d.incumbentId !== "vacant") {
          const existing = map.get(d.incumbentId) || [];
          existing.push(d);
          map.set(d.incumbentId, existing);
        }
        // Also map prior holders if recorded in designation history for this assembly
        if (Array.isArray(d.history)) {
          d.history.forEach((h) => {
            if (h.personId && h.personId !== "vacant") {
              const existing = map.get(h.personId) || [];
              if (!existing.some((item) => item.id === d.id)) {
                existing.push(d);
                map.set(h.personId, existing);
              }
            }
          });
        }
      }
    });
    return map;
  }, [designationsList, assembly.id, assembly.isActive]);

  // Helper to extract roles/remarks for a politician in this assembly
  const getRemarksForPolitician = (p?: Person): { remarks: string[]; hasMinisterRole: boolean } => {
    if (!p) return { remarks: [], hasMinisterRole: false };

    const remarksSet = new Set<string>();
    let hasMinister = false;

    // 1. Leader roles on Assembly
    const leadersSource = assembly.leaders || (assembly as any).preDissolutionLeaders;
    if (leadersSource) {
      Object.entries(leadersSource).forEach(([key, leaderVal]) => {
        const lId = typeof leaderVal === "object" && leaderVal ? (leaderVal as any).id : String(leaderVal || "");
        if (lId === p.id) {
          const title = leaderRoleTitles[key] || key.replace(/([A-Z])/g, " $1").trim();
          if (title.toLowerCase() !== "leader of the house") {
            const formatted = title.charAt(0).toUpperCase() + title.slice(1);
            remarksSet.add(formatted);
          }
        }
      });
    }

    // 2. Custom assembly roles (check direct key or any matching assembly key)
    if (p.assemblyRoles) {
      let customRoles: string[] = [];
      if (p.assemblyRoles[assembly.id]) {
        customRoles = p.assemblyRoles[assembly.id].split(/[,;\n|]+/);
      } else {
        for (const [key, val] of Object.entries(p.assemblyRoles)) {
          if (val && isMatchingAssembly(key)) {
            customRoles.push(...val.split(/[,;\n|]+/));
          }
        }
      }

      customRoles.forEach((r) => {
        const trimmed = r.trim();
        if (!trimmed) return;
        if (trimmed.toLowerCase() === "leader of the house") return;
        if (trimmed.toLowerCase().includes("minister") && !trimmed.toLowerCase().includes("former")) {
          hasMinister = true;
        }
        remarksSet.add(trimmed);
      });
    }

    // 3. Designations in the assembly (using map and direct person designations reference)
    const personDesignations = [...(designationsByIncumbentMap.get(p.id) || [])];
    if (Array.isArray(p.designations) && p.designations.length > 0) {
      (designationsList || []).forEach((d) => {
        if (p.designations.includes(d.id) && isMatchingAssembly(d.assemblyId)) {
          if (!personDesignations.some((item) => item.id === d.id)) {
            personDesignations.push(d);
          }
        }
      });
    }

    personDesignations.forEach((d) => {
      const trimmed = d.name.trim();
      if (!trimmed.toLowerCase().startsWith("mla for") && !trimmed.toLowerCase().endsWith(" mla")) {
        if (trimmed.toLowerCase().includes("minister") && !trimmed.toLowerCase().includes("former")) {
          hasMinister = true;
        }
        remarksSet.add(trimmed);
      }
    });

    // 4. Role history for this assembly (e.g. ministerial appointments/promotions)
    if (Array.isArray(p.roleHistory)) {
      p.roleHistory.forEach((rh) => {
        if (isMatchingAssembly(rh.assemblyId) && rh.role) {
          const trimmed = rh.role.trim();
          if (
            trimmed &&
            !trimmed.toLowerCase().startsWith("mla for") &&
            !trimmed.toLowerCase().endsWith(" mla") &&
            trimmed.toLowerCase() !== "leader of the house"
          ) {
            if (trimmed.toLowerCase().includes("minister") && !trimmed.toLowerCase().includes("former")) {
              hasMinister = true;
            }
            remarksSet.add(trimmed);
          }
        }
      });
    }

    // Deduplicate near-identical role titles
    const currentList = Array.from(remarksSet);
    if (currentList.includes("Leader of the Opposition") && currentList.includes("Leader of Opposition")) {
      remarksSet.delete("Leader of Opposition");
    }
    if (
      currentList.includes("Deputy Leader of the Opposition") &&
      (currentList.includes("Opposition Deputy Leader") || currentList.includes("Deputy Leader of Opposition"))
    ) {
      remarksSet.delete("Opposition Deputy Leader");
      remarksSet.delete("Deputy Leader of Opposition");
    }
    if (currentList.includes("Chief Whip") && currentList.includes("Government Chief Whip")) {
      remarksSet.delete("Government Chief Whip");
    }

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

      const rawIncumbents =
        seat.incumbents && seat.incumbents.length > 0
          ? seat.incumbents
          : (seat as any).politician
          ? [
              {
                person: (seat as any).politician,
                party: (seat as any).party,
                alliance: (seat as any).alliance,
              },
            ]
          : [];

      const incumbents = rawIncumbents.map((inc) => {
        const p = inc.person;
        const isIndependent = p.partyId === "independent";
        const { remarks, hasMinisterRole } = getRemarksForPolitician(p);
        const isSupportingAlliance = !!(assembly.independentSupports?.[p.id]);

        return {
          id: p.id,
          name: p.name,
          gender: p.gender,
          partyId: p.partyId,
          isIndependent,
          reason: inc.reason,
          isByelected: inc.isByelected,
          removalDate: inc.removalDate,
          electionDate: inc.electionDate,
          remarks,
          hasMinisterRole,
          isSupportingAlliance,
        };
      });

      // Primary incumbent (current or most recent)
      const primaryInc = incumbents[incumbents.length - 1];
      const p = seat.incumbents?.[seat.incumbents.length - 1]?.person;
      const isIndependent = p?.partyId === "independent";

      // Party information
      let partyObj: ProcessedRow["party"] = undefined;
      if (primaryInc) {
        if (primaryInc.isIndependent) {
          partyObj = {
            id: "independent",
            name: "Independent",
            abbreviation: "IND",
            color: "#6b7280",
          };
        } else {
          const primarySeatInc = seat.incumbents[seat.incumbents.length - 1];
          if (primarySeatInc.party) {
            partyObj = {
              id: primarySeatInc.party.id,
              name: primarySeatInc.party.name,
              abbreviation: primarySeatInc.party.abbreviation || primarySeatInc.party.name,
              color: primarySeatInc.party.colors?.[0] || "#ef4444",
            };
          }
        }
      }

      // Alliance information
      let allianceObj: ProcessedRow["alliance"] = undefined;
      if (primaryInc) {
        const primarySeatInc = seat.incumbents[seat.incumbents.length - 1];
        const supId = assembly.independentSupports?.[primaryInc.id];
        
        if (primarySeatInc.alliance && primarySeatInc.alliance.id !== "independent") {
          allianceObj = {
            id: primarySeatInc.alliance.id,
            name: primarySeatInc.alliance.name,
            abbreviation: primarySeatInc.alliance.abbreviation || primarySeatInc.alliance.name,
            color: primarySeatInc.alliance.colors?.[0] || "#3b82f6",
          };
        } else if (supId) {
          const supAlliance = alliancesList.find(a => a.id === supId);
          if (supAlliance) {
            allianceObj = {
              id: supAlliance.id,
              name: supAlliance.name,
              abbreviation: supAlliance.abbreviation || supAlliance.name,
              color: supAlliance.colors?.[0] || "#3b82f6",
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
          const mainInc = s.incumbents?.[s.incumbents.length - 1];
          if (mainInc) {
            let aId = mainInc.alliance ? mainInc.alliance.id : (mainInc.party?.allianceId || mainInc.party?.id || 'independent');
            if (mainInc.person.partyId === 'independent' && assembly.independentSupports?.[mainInc.person.id]) {
              aId = assembly.independentSupports[mainInc.person.id];
            }
            groupCounts[aId] = (groupCounts[aId] || 0) + 1;
          }
        });
        const topGroup = Object.entries(groupCounts).sort((a, b) => b[1] - a[1])[0];
        if (topGroup) govAllianceId = topGroup[0];
      }

      let isGovernmentMember = false;
      if (primaryInc && govAllianceId) {
        const primarySeatInc = seat.incumbents[seat.incumbents.length - 1];
        if (primaryInc.isIndependent) {
          const sup = assembly.independentSupports?.[primaryInc.id];
          isGovernmentMember = sup === govAllianceId;
        } else {
          isGovernmentMember =
            (primarySeatInc.alliance && primarySeatInc.alliance.id === govAllianceId) ||
            (primarySeatInc.party && (primarySeatInc.party.allianceId === govAllianceId || govParties.has(primarySeatInc.party.id) || primarySeatInc.party.id === govAllianceId));
        }
      }

      const isSupportingAlliance = !!(primaryInc && primaryInc.isIndependent && assembly.independentSupports?.[primaryInc.id]);

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
        incumbents,
        party: partyObj,
        alliance: allianceObj,
        remarks: incumbents.flatMap(inc => inc.remarks),
        hasMinisterRole: incumbents.some(inc => inc.hasMinisterRole),
        isGovernmentMember,
        isSupportingAlliance,
        politicianId: primaryInc?.id,
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
      list = list.filter((r) => r.incumbents.length > 0);
    } else if (activeFilter === "vacant") {
      list = list.filter((r) => r.incumbents.length === 0);
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
          r.incumbents.some(inc => inc.name.toLowerCase().includes(q)) ||
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
          const nameA = a.incumbents.map(i => i.name).join(" ");
          const nameB = b.incumbents.map(i => i.name).join(" ");
          if (nameA === "" && nameB === "") cmp = a.slNo - b.slNo;
          else if (nameA === "") cmp = 1;
          else if (nameB === "") cmp = -1;
          else cmp = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
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
      if (row.incumbents.length === 0 || !row.party) {
        pSpans[i] = 1;
        i++;
        continue;
      }
      const partyKey = `${row.party.id}-${row.party.abbreviation}`;
      let count = 1;
      while (
        i + count < filteredAndSortedRows.length &&
        filteredAndSortedRows[i + count].incumbents.length > 0 &&
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
      if (row.incumbents.length === 0 || !row.alliance) {
        aSpans[i] = 1;
        i++;
        continue;
      }
      const allianceKey = `${row.alliance.id}-${row.alliance.abbreviation}`;
      let count = 1;
      while (
        i + count < filteredAndSortedRows.length &&
        filteredAndSortedRows[i + count].incumbents.length > 0 &&
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
  const occupiedCount = processedRows.filter((r) => r.incumbents.length > 0).length;
  const vacantCount = processedRows.filter((r) => r.incumbents.length === 0).length;
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
                ? "bg-[#60a5fa] text-black shadow-md shadow-[#60a5fa]/20"
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
                  ? "bg-[#60a5fa] text-white shadow-md shadow-[#60a5fa]/20"
                  : "bg-white/5 text-[#60a5fa] hover:text-[#60a5fa] hover:bg-[#60a5fa]/10"
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
            className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#60a5fa]/50 transition-colors"
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
      <div className="bg-[#0d1117] border border-[#272b35] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left select-text">
            {/* Table Header */}
            <thead>
              <tr className="bg-[#1a1d23] text-gray-300 text-xs font-bold tracking-wide border-b border-[#2d323c]">
                {/* No. Column */}
                <th
                  onClick={() => handleSort("no")}
                  className="w-14 min-w-[56px] px-3 py-3 text-center border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>No.</span>
                    {sortColumn === "no" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#60a5fa]" /> : <ArrowDown size={12} className="text-[#60a5fa]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Constituency Column */}
                <th
                  onClick={() => handleSort("constituency")}
                  className="min-w-[150px] sm:min-w-[170px] px-4 py-3 border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Constituency</span>
                    {sortColumn === "constituency" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#60a5fa]" /> : <ArrowDown size={12} className="text-[#60a5fa]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Name Column - Dynamic space for full names without clipping */}
                <th
                  onClick={() => handleSort("name")}
                  className="min-w-[220px] sm:min-w-[270px] lg:min-w-[300px] px-4 py-3 border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    {sortColumn === "name" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-[#60a5fa]" /> : <ArrowDown size={12} className="text-[#60a5fa]" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-500 opacity-60" />
                    )}
                  </div>
                </th>

                {/* Party Column */}
                <th
                  onClick={() => handleSort("party")}
                  className="w-24 sm:w-28 min-w-[90px] px-3 py-3 text-center border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
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
                  className="w-24 sm:w-28 min-w-[90px] px-3 py-3 text-center border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
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
                  className="min-w-[200px] sm:min-w-[240px] px-4 py-3 border-r border-[#2d323c] cursor-pointer hover:bg-white/5 transition-colors select-none text-left"
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

                {/* Actions Column */}
                <th className="w-20 min-w-[80px] px-3 py-3 text-center transition-colors select-none">
                  Actions
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
                    key={`${row.constituency.id}-${row.politicianId || "vacant"}-${idx}`}
                    className="border-b border-[#242832] hover:bg-white/[0.025] transition-colors group"
                  >
                    {/* 1. No. Cell */}
                    <td className="px-3 py-2.5 text-center font-bold text-gray-300 text-xs sm:text-sm border-r border-[#242832] bg-[#0d1117]">
                      {row.slNoDisplay}
                    </td>

                    {/* 2. Constituency Cell */}
                    <td className="px-4 py-2.5 text-xs sm:text-sm font-medium border-r border-[#242832] text-left break-words whitespace-normal">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/constituency/${row.constituency.id}`)}
                          className="text-[#60a5fa] hover:text-[#93c5fd] transition-colors text-left font-semibold break-words whitespace-normal leading-snug"
                        >
                          {row.constituency.baseName}
                        </button>
                        {row.constituency.categoryTag && (
                          <span className="text-gray-400 font-normal whitespace-nowrap">
                            {row.constituency.categoryTag}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Name Cell - Flexible layout with full name visibility without clipping */}
                    <td className="px-4 py-2.5 text-xs sm:text-sm font-medium border-r border-[#242832] text-left">
                      {row.incumbents.length > 0 ? (
                        <div className="flex flex-col gap-2.5">
                          {row.incumbents.map((inc, iIdx) => {
                            const isPrimary = iIdx === row.incumbents.length - 1;
                            const rawReason = inc.reason || '';
                            const isElection = rawReason === 'election' || rawReason === 'appointment';
                            const isResigned = rawReason.toLowerCase().includes('resign');
                            const isExpired = !isElection && !isResigned && rawReason.length > 0;
                            
                            const reasonLabel = isResigned ? "Resigned" : (isExpired ? "Expired" : "");
                            const dateStr = inc.removalDate ? ` on ${new Date(inc.removalDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}` : '';
                            const assuDateStr = inc.electionDate ? ` on ${new Date(inc.electionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}` : '';
                            
                            return (
                              <div key={inc.id} className="flex flex-col gap-1">
                                <div className="flex flex-wrap sm:flex-nowrap items-baseline sm:items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/person/${inc.id}`)}
                                    className="text-[#0ea5e9] hover:text-[#38bdf8] transition-colors text-left font-semibold break-words whitespace-normal leading-snug flex-1 min-w-0"
                                  >
                                    {formatPersonName(inc.name, inc.gender, !isDissolved)}
                                  </button>
                                  
                                  {isPrimary && row.isSupportingAlliance && row.alliance && (
                                    <div className="text-[9px] text-[#FFD700] font-black uppercase tracking-widest bg-[#FFD700]/10 border border-[#FFD700]/20 px-2 py-0.5 rounded-md shadow-[0_0_10px_rgba(255,215,0,0.1)] shrink-0 self-start sm:self-auto whitespace-nowrap">
                                      Supporting {row.alliance.name}
                                    </div>
                                  )}
                                </div>
                                
                                {reasonLabel && (
                                  <span className="text-[10px] text-red-500 font-bold leading-tight break-words whitespace-normal">
                                    ({reasonLabel}{dateStr})
                                  </span>
                                )}
                                
                                {inc.isByelected && (
                                  <span className="text-[10px] text-emerald-500 font-bold leading-tight italic break-words whitespace-normal">
                                    (Assumed office{inc.electionDate ? ` on ${(() => {
                                      const d = new Date(inc.electionDate);
                                      const day = d.getDate();
                                      const month = d.toLocaleString('en-GB', { month: 'long' });
                                      const year = d.getFullYear();
                                      const getOrdinal = (n: number) => {
                                        const s = ['th', 'st', 'nd', 'rd'];
                                        const v = n % 100;
                                        return n + (s[(v - 20) % 10] || s[v] || s[0]);
                                      };
                                      return `${getOrdinal(day)} ${month} ${year}`;
                                    })()}` : ' as Bye Elected'})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[#ef4444] italic text-xs font-semibold uppercase tracking-wider">
                          Vacant
                        </span>
                      )}
                    </td>

                    {/* 4. Party Cell (with vertical color strip & RowSpan, centered) */}
                    {partySpan > 0 && (
                      <td
                        rowSpan={partySpan}
                        style={{
                          borderLeft: row.party ? `6px solid ${row.party.color}` : "6px solid transparent",
                        }}
                        className="px-2.5 py-2.5 text-xs sm:text-sm font-bold text-gray-300 border-r border-[#242832] bg-[#0d1117] align-middle text-center"
                      >
                        {row.party ? (
                          row.party.id === "independent" ? (
                            <span className="text-gray-400 font-mono">IND</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/party/${row.party!.id}`)}
                              className="text-gray-200 hover:text-white hover:underline transition-colors text-center inline-block"
                            >
                              {row.party.abbreviation}
                            </button>
                          )
                        ) : (
                          <span className="text-gray-500 font-normal">—</span>
                        )}
                      </td>
                    )}

                    {/* 5. Alliance Cell (with vertical color strip & RowSpan, centered) */}
                    {allianceSpan > 0 && (
                      <td
                        rowSpan={allianceSpan}
                        style={{
                          borderLeft: row.alliance ? `6px solid ${row.alliance.color}` : "6px solid transparent",
                        }}
                        className="px-2.5 py-2.5 text-xs sm:text-sm font-bold text-gray-300 border-r border-[#242832] bg-[#0d1117] align-middle text-center"
                      >
                        {row.alliance ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/alliance/${row.alliance!.id}`)}
                            className="text-gray-200 hover:text-white hover:underline transition-colors text-center inline-block"
                          >
                            {row.alliance.abbreviation}
                          </button>
                        ) : (
                          <span className="text-gray-500 font-normal">—</span>
                        )}
                      </td>
                    )}

                    {/* 6. Remarks Cell */}
                    <td className="px-4 py-2.5 text-xs sm:text-sm text-gray-300 font-normal border-r border-[#242832] text-left break-words whitespace-normal">
                      {row.incumbents.length > 0 ? (
                        <div className="flex flex-col gap-2 min-h-[32px] w-full">
                          {row.incumbents.map((inc, iIdx) => {
                            if (!inc.remarks || inc.remarks.length === 0) {
                              return (
                                <div key={inc.id || iIdx} className="flex items-center min-h-[28px]">
                                  <span className="text-gray-500 font-normal select-none">—</span>
                                </div>
                              );
                            }

                            return (
                              <div key={inc.id || iIdx} className="flex flex-col gap-0.5 min-h-[28px] justify-center">
                                {inc.remarks.map((remark, rIdx) => {
                                  const isOppLeader = remark.toLowerCase().includes("opposition");
                                  const isHouseLeader =
                                    remark.toLowerCase().includes("leader of the house") ||
                                    remark.toLowerCase().includes("chief minister");
                                  const isSpeaker = remark.toLowerCase().includes("speaker");
                                  const isMinister = remark.toLowerCase().includes("minister");

                                  return (
                                    <div
                                      key={rIdx}
                                      className={`font-medium transition-colors break-words whitespace-normal leading-snug ${
                                        isMinister
                                          ? "text-cyan-400"
                                          : isOppLeader || isHouseLeader || isSpeaker
                                          ? "text-[#60a5fa]"
                                          : "text-gray-200"
                                      }`}
                                    >
                                      {remark}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-500 font-normal select-none">—</span>
                      )}
                    </td>

                    {/* 7. Actions Cell */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Support Alliance Action (Only for Independent MLAs) */}
                        {!isDissolved && row.incumbents.length > 0 && row.incumbents[row.incumbents.length - 1].isIndependent && onSupportAlliance && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const primary = row.incumbents[row.incumbents.length - 1];
                              onSupportAlliance(primary.id, primary.name);
                            }}
                            className={`p-1.5 rounded-lg transition-all border shrink-0 ${
                              row.isSupportingAlliance 
                                ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/30" 
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                            }`}
                            title={row.alliance ? `Supporting ${row.alliance.name}` : "Set alliance support"}
                          >
                            <Zap size={12} fill={row.isSupportingAlliance ? "currentColor" : "none"} />
                          </button>
                        )}

                        {/* Promote to Cabinet / Add Portfolio action button (Only for Government MLAs) */}
                        {!isDissolved && row.incumbents.length > 0 && 
                         !row.incumbents[row.incumbents.length - 1].hasMinisterRole && 
                         row.isGovernmentMember && onPromote && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const primary = row.incumbents[row.incumbents.length - 1];
                              onPromote(primary.id, primary.name);
                            }}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/30 transition-all shrink-0 shadow-lg cursor-pointer"
                            title="Promote to Cabinet / Assign Portfolio"
                          >
                            <ArrowUp size={14} strokeWidth={3} />
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
                  <td colSpan={7} className="py-16 text-center text-gray-500 italic">
                    <p className="text-sm">No members matching the current criteria.</p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="mt-2 text-xs text-[#60a5fa] hover:underline"
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
                <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                {ministersCount} with Remarks
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
