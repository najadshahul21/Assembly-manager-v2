import React, { useState, useMemo } from "react";
import { 
  ChevronUp, 
  ChevronDown, 
  ArrowUpDown, 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink, 
  Shield, 
  Landmark,
  Layers,
  Vote
} from "lucide-react";
import { Alliance, Party, Assembly, Constituency, Person } from "../types";

interface AllianceConstituentPartiesTableProps {
  alliance: Alliance;
  relatedParties: Party[];
  activeAssembly?: Assembly;
  assembliesList?: Assembly[];
  constituenciesList: Constituency[];
  personsList: Person[];
  onNavigateParty: (partyId: string) => void;
  onAddConstituent?: () => void;
  onRemoveParty?: (partyId: string) => void;
  isDissolved?: boolean;
}

type SortField = "sno" | "name" | "abbr" | "seats";
type SortDirection = "asc" | "desc";

// Helper to calculate contrasting text color for the serial number cell
function getContrastTextColor(hexColor?: string): string {
  if (!hexColor || typeof hexColor !== "string") return "#FFFFFF";
  let hex = hexColor.replace("#", "").trim();
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length !== 6) return "#FFFFFF";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#FFFFFF";
  // Perceived brightness formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance > 165 ? "#000000" : "#FFFFFF";
}

// Built-in authentic flag renderer for political parties
function PartyFlagRenderer({ party }: { party: Party }) {
  const [imgError, setImgError] = useState(false);
  const abbr = (party.abbreviation || "").toUpperCase().trim();
  const partyId = (party.id || "").toLowerCase().trim();

  // 1. If party has explicit flagUrl and not failed
  if (party.flagUrl && !imgError) {
    return (
      <img
        src={party.flagUrl}
        alt={`${party.name} flag`}
        onError={() => setImgError(true)}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  // 2. Specialized SVG flags for known parties to achieve authentic Wikipedia appearance
  if (abbr === "INC" || partyId === "inc") {
    // Indian National Congress Tricolor (Saffron, White, Green) with Hand emblem
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full">
        <rect width="60" height="13.33" fill="#FF9933" />
        <rect y="13.33" width="60" height="13.33" fill="#FFFFFF" />
        <rect y="26.66" width="60" height="13.34" fill="#128807" />
        {/* Palm hand symbol */}
        <g transform="translate(30, 20) scale(0.65)">
          <circle r="9" fill="none" stroke="#000080" strokeWidth="0.5" opacity="0.3" />
          <path
            d="M-3,5 L-3,0 C-3,-4 -2,-5 -1,-5 C0,-5 1,-4 1,-1 L1,3 M-1,0 L-1,-6 C-1,-7 0,-8 1,-8 C2,-8 3,-7 3,-3 L3,3 M1,-2 L1,-7 C1,-8 2,-9 3,-9 C4,-9 5,-8 5,-4 L5,4 M3,-1 L3,-5 C3,-6 4,-7 5,-7 C6,-7 7,-6 7,-2 L7,4 C7,8 3,9 0,9 C-4,9 -7,6 -7,2 C-7,-1 -6,-3 -5,-3 C-4,-3 -3,-1 -3,2"
            fill="#000080"
            transform="scale(0.8) translate(-1, -1)"
          />
        </g>
      </svg>
    );
  }

  if (abbr === "IUML" || partyId === "iuml") {
    // Indian Union Muslim League Green Flag with Crescent & Star
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full bg-[#008000]">
        <rect width="60" height="40" fill="#008000" />
        <g transform="translate(30, 20)">
          {/* Crescent */}
          <path
            d="M -2 -8 A 10 10 0 1 0 10 4 A 8 8 0 1 1 -2 -8 Z"
            fill="#FFFFFF"
          />
          {/* Star */}
          <polygon
            points="6,-4 7.5,-0.5 11,-0.5 8,1.5 9,5 6,3 3,5 4,1.5 1,-0.5 4.5,-0.5"
            fill="#FFFFFF"
          />
        </g>
      </svg>
    );
  }

  if (abbr === "KEC" || abbr === "KC" || abbr === "KC(M)" || abbr === "KCM" || abbr === "KEC(J)" || partyId.includes("kerala-congress") || partyId === "kc" || partyId === "kcm") {
    // Kerala Congress Red & White vertical bicolour
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full">
        <rect width="30" height="40" fill="#FFFFFF" />
        <rect x="30" width="30" height="40" fill="#DC2626" />
      </svg>
    );
  }

  if (abbr === "RSP" || partyId === "rsp") {
    // Revolutionary Socialist Party Red Flag with Hammer & Sickle
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full bg-[#DC2626]">
        <rect width="60" height="40" fill="#DC2626" />
        <g transform="translate(18, 18) scale(0.65)">
          <path
            d="M-2,6 L-2,14 M-5,8 L1,8 M3,-3 C7,0 7,6 4,9 L6,11 C10,7 10,-1 4,-5 C0,-8 -7,-7 -11,-3 L-9,-1 C-6,-4 0,-5 3,-3 Z"
            fill="#FFFFFF"
            stroke="#FFFFFF"
            strokeWidth="0.5"
          />
          <path
            d="M-1,-2 L9,8 M1,0 L8,7"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }

  if (abbr === "RMPI" || partyId === "rmpi") {
    // RMPI Red Flag with letters and Hammer & Sickle
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full bg-[#DC2626]">
        <rect width="60" height="40" fill="#DC2626" />
        {/* Left vertical box for RMPI initials */}
        <rect x="2" y="2" width="16" height="36" fill="#B91C1C" opacity="0.6" />
        <text x="10" y="11" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">R</text>
        <text x="10" y="19" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">M</text>
        <text x="10" y="27" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">P</text>
        <text x="10" y="35" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">I</text>
        {/* Hammer & Sickle on right */}
        <g transform="translate(38, 20) scale(0.7)">
          <path
            d="M-2,4 L-2,12 M-5,6 L1,6 M2,-2 C6,1 6,7 3,10 L5,12 C9,8 9,0 3,-4 C-1,-7 -8,-6 -11,-2 L-9,0 C-7,-3 -1,-4 2,-2 Z"
            fill="#FFFFFF"
          />
          <path
            d="M-1,-1 L8,8"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }

  if (abbr === "CMP" || partyId === "cmp") {
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full bg-[#DC2626]">
        <rect width="60" height="40" fill="#DC2626" />
        <rect x="2" y="2" width="16" height="36" fill="#991B1B" opacity="0.7" />
        <text x="10" y="14" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">C</text>
        <text x="10" y="23" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">M</text>
        <text x="10" y="32" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle">P</text>
        <g transform="translate(38, 20) scale(0.7)">
          <path d="M-2,4 L-2,12 M-5,6 L1,6 M2,-2 C6,1 6,7 3,10 L5,12 C9,8 9,0 3,-4 C-1,-7 -8,-6 -11,-2 L-9,0 C-7,-3 -1,-4 2,-2 Z" fill="#FFFFFF" />
          <path d="M-1,-1 L8,8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (abbr === "CPIM" || abbr === "CPI(M)" || partyId === "cpim") {
    // CPI(M) Red Flag with Hammer & Sickle and Star
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full bg-[#E11D48]">
        <rect width="60" height="40" fill="#E11D48" />
        <g transform="translate(30, 20) scale(0.8)">
          <polygon points="0,-12 3.5,-3 12,-3 5,2 7.5,10 0,5 -7.5,10 -5,2 -12,-3 -3.5,-3" fill="#FFFFFF" />
          <path d="M-2,2 L-2,10 M-5,4 L1,4 M2,-3 C6,0 6,6 3,9 L5,11 C9,7 9,-1 3,-5 C-1,-8 -8,-7 -11,-3 L-9,-1 C-7,-4 -1,-5 2,-3 Z" fill="#FFFFFF" opacity="0.9" />
          <path d="M-1,0 L8,8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (abbr === "CPI" || partyId === "cpi") {
    // CPI Red Flag with Corn and Sickle
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full bg-[#DC2626]">
        <rect width="60" height="40" fill="#DC2626" />
        <g transform="translate(30, 20) scale(0.8)">
          <path d="M-6,8 C-2,11 6,10 10,4 C14,-2 13,-9 9,-13 C5,-17 -2,-17 -7,-12 L-5,-10 C-1,-14 5,-14 8,-11 C11,-8 11,-2 8,3 C5,8 -1,9 -4,6 Z" fill="#FFFFFF" />
          <path d="M-10,12 L-4,6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (abbr === "BJP" || partyId === "bjp") {
    // BJP Saffron & Green with Lotus
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full">
        <rect width="40" height="40" fill="#F97316" />
        <rect x="40" width="20" height="40" fill="#15803D" />
        <g transform="translate(20, 20) scale(0.65)">
          <path d="M0,8 C-8,4 -10,-4 0,-10 C10,-4 8,4 0,8 Z" fill="#FFFFFF" opacity="0.9" />
          <path d="M0,8 C-14,2 -14,-6 -6,-10 C-3,-6 -3,2 0,8 Z" fill="#FFFFFF" opacity="0.75" />
          <path d="M0,8 C14,2 14,-6 6,-10 C3,-6 3,2 0,8 Z" fill="#FFFFFF" opacity="0.75" />
        </g>
      </svg>
    );
  }

  // 3. If logoUrl exists and not failed
  if (party.logoUrl && !imgError) {
    return (
      <img
        src={party.logoUrl}
        alt={`${party.name} symbol`}
        onError={() => setImgError(true)}
        className="w-full h-full object-contain p-0.5 bg-black/40"
        referrerPolicy="no-referrer"
      />
    );
  }

  // 4. Fallback generated from party.colors
  const colors = party.colors && party.colors.length > 0 ? party.colors : ["#2563EB"];
  if (colors.length >= 3) {
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full">
        <rect width="60" height="13.33" fill={colors[0]} />
        <rect y="13.33" width="60" height="13.33" fill={colors[1]} />
        <rect y="26.66" width="60" height="13.34" fill={colors[2]} />
      </svg>
    );
  }
  if (colors.length === 2) {
    return (
      <svg viewBox="0 0 60 40" className="w-full h-full">
        <rect width="30" height="40" fill={colors[0]} />
        <rect x="30" width="30" height="40" fill={colors[1]} />
      </svg>
    );
  }

  // Single color fallback with abbreviation
  return (
    <div
      className="w-full h-full flex items-center justify-center font-bold text-[10px] uppercase font-mono tracking-wider shadow-inner"
      style={{
        backgroundColor: colors[0],
        color: getContrastTextColor(colors[0]),
      }}
    >
      {abbr.slice(0, 4) || "PTY"}
    </div>
  );
}

export const AllianceConstituentPartiesTable: React.FC<AllianceConstituentPartiesTableProps> = ({
  alliance,
  relatedParties,
  activeAssembly,
  assembliesList = [],
  constituenciesList,
  personsList,
  onNavigateParty,
  onAddConstituent,
  onRemoveParty,
  isDissolved = false,
}) => {
  const [sortField, setSortField] = useState<SortField>("seats");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>(activeAssembly?.id || "");

  // Active target assembly
  const currentAssembly = useMemo(() => {
    if (selectedAssemblyId) {
      const match = assembliesList.find((a) => a.id === selectedAssemblyId);
      if (match) return match;
    }
    return activeAssembly || assembliesList.find((a) => a.isActive !== false) || assembliesList[0];
  }, [selectedAssemblyId, assembliesList, activeAssembly]);

  // Compute seats won by each constituent party in the target assembly
  const partyStatsMap = useMemo(() => {
    const stats: Record<string, { seats: number }> = {};
    const targetConstituencies = constituenciesList.filter(
      (c) => !currentAssembly || !c.creationAssemblyId || c.creationAssemblyId <= currentAssembly.id
    );

    relatedParties.forEach((p) => {
      stats[p.id] = { seats: 0 };
    });

    targetConstituencies.forEach((c) => {
      if (c.currentIncumbentId && c.currentIncumbentId !== "vacant") {
        const person = personsList.find((per) => per.id === c.currentIncumbentId);
        if (person && stats[person.partyId]) {
          stats[person.partyId].seats += 1;
        }
      }
    });

    // Supplementary check: if all are 0, check if persons have constituency names recorded in raw data
    const totalCount = Object.values(stats).reduce((acc, s) => acc + s.seats, 0);
    if (totalCount === 0) {
      relatedParties.forEach((p) => {
        const partyPersonsWithSeats = personsList.filter(
          (per) => per.partyId === p.id && (per.constituencyName || per.mlaStatusText)
        );
        if (partyPersonsWithSeats.length > 0) {
          stats[p.id].seats = partyPersonsWithSeats.length;
        }
      });
    }

    return stats;
  }, [relatedParties, constituenciesList, personsList, currentAssembly]);

  // Process rows with initial index and filter
  const processedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = relatedParties.map((party, index) => {
      const partyColor =
        party.colors && party.colors.length > 0
          ? party.colors[0]
          : "#2563EB";
      const seats = partyStatsMap[party.id]?.seats || 0;

      return {
        initialIndex: index + 1,
        party,
        seats,
        partyColor,
      };
    });

    // Search filter
    const filtered = query
      ? rows.filter(
          (r) =>
            r.party.name.toLowerCase().includes(query) ||
            (r.party.abbreviation && r.party.abbreviation.toLowerCase().includes(query))
        )
      : rows;

    // Sorting
    return [...filtered].sort((a, b) => {
      let comp = 0;
      if (sortField === "sno") {
        comp = a.initialIndex - b.initialIndex;
      } else if (sortField === "name") {
        comp = (a.party.name || "").localeCompare(b.party.name || "", undefined, { sensitivity: "base" });
      } else if (sortField === "abbr") {
        comp = (a.party.abbreviation || "").localeCompare(b.party.abbreviation || "", undefined, { sensitivity: "base" });
      } else if (sortField === "seats") {
        comp = a.seats - b.seats;
        if (comp === 0) {
          comp = (a.party.name || "").localeCompare(b.party.name || "", undefined, { sensitivity: "base" });
        }
      }
      return sortDir === "asc" ? comp : -comp;
    });
  }, [relatedParties, partyStatsMap, searchQuery, sortField, sortDir]);

  // Total MLAs in alliance
  const totalAllianceSeats = useMemo(() => {
    return relatedParties.reduce((acc, p) => acc + (partyStatsMap[p.id]?.seats || 0), 0);
  }, [relatedParties, partyStatsMap]);

  // Toggle sorting on column header
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "seats" ? "desc" : "asc");
    }
  };

  // Header Sort Arrow visualizer
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return (
        <span className="text-zinc-500 opacity-60 text-[10px] ml-1 inline-flex items-center">
          <ArrowUpDown size={11} />
        </span>
      );
    }
    return sortDir === "asc" ? (
      <span className="text-[#FFD700] text-[11px] ml-1 inline-flex items-center">
        <ChevronUp size={13} />
      </span>
    ) : (
      <span className="text-[#FFD700] text-[11px] ml-1 inline-flex items-center">
        <ChevronDown size={13} />
      </span>
    );
  };

  // Assembly seat column title matching user's instruction
  // ("don't copy heads and information from it just the way of data represented and implement it in app")
  const seatColumnHeader = currentAssembly
    ? `MLAs in ${currentAssembly.name.replace("Assembly", "").trim() || "Assembly"}`
    : "MLAs in Legislative Assembly";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Top Controls Bar: Search, Assembly Selection & Add Party */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#18181b] border border-white/10 rounded-2xl p-3 sm:p-4 shadow-lg">
        <div className="flex flex-1 items-center gap-3">
          {/* Quick Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter constituent parties..."
              className="w-full pl-9 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD700]/50"
            />
          </div>

          {/* Assembly selector if multiple assemblies exist */}
          {assembliesList.length > 1 && (
            <div className="hidden md:flex items-center gap-2 text-xs">
              <Landmark size={14} className="text-[#FFD700]" />
              <select
                value={currentAssembly?.id || ""}
                onChange={(e) => setSelectedAssemblyId(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#FFD700]/50 cursor-pointer"
              >
                {assembliesList.map((a) => (
                  <option key={a.id} value={a.id} className="bg-zinc-900 text-white">
                    {a.name} {a.isActive !== false ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
        </div>
      </div>

      {/* Wikipedia-Style Constituent Parties Table (matching user reference screenshot) */}
      <div className="w-full overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#16161a] shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left select-text">
            {/* Table Header Row */}
            <thead>
              <tr className="bg-[#1f2227] border-b border-zinc-700/90 text-zinc-200 text-xs sm:text-sm select-none">
                {/* 1. S.No. Header */}
                <th
                  onClick={() => handleSort("sno")}
                  className="w-12 sm:w-14 px-2 py-3.5 text-center font-bold border-r border-zinc-700/60 cursor-pointer hover:bg-white/5 transition-colors"
                  title="Sort by index"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>#</span>
                    {renderSortIndicator("sno")}
                  </div>
                </th>

                {/* 2. Party Header */}
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3.5 font-bold border-r border-zinc-700/60 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Party</span>
                    {renderSortIndicator("name")}
                  </div>
                </th>

                {/* 3. Abbr. Header */}
                <th
                  onClick={() => handleSort("abbr")}
                  className="w-20 sm:w-24 px-3 py-3.5 text-center font-bold border-r border-zinc-700/60 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Abbr.</span>
                    {renderSortIndicator("abbr")}
                  </div>
                </th>

                {/* 4. Flag Header */}
                <th className="w-24 sm:w-28 px-3 py-3.5 text-center font-bold border-r border-zinc-700/60">
                  <span>Flag</span>
                </th>

                {/* 5. MLAs / Seats Header */}
                <th
                  onClick={() => handleSort("seats")}
                  className="w-28 sm:w-36 px-3 py-3.5 text-center font-bold cursor-pointer hover:bg-white/5 transition-colors"
                  title="Sort by seats"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="leading-tight">{seatColumnHeader}</span>
                    {renderSortIndicator("seats")}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Body Rows */}
            <tbody className="divide-y divide-zinc-700/60 text-xs sm:text-sm">
              {processedRows.length > 0 ? (
                processedRows.map((row, idx) => {
                  const { party, seats, partyColor, initialIndex } = row;
                  const displayIndex = sortField === "sno" ? initialIndex : idx + 1;
                  const contrastTextColor = getContrastTextColor(partyColor);
                  const isLeadParty = alliance.leadingPartyId === party.id;

                  // Padded 2-digit number representation like in user screenshot: 14, 03, 01, 00
                  const formattedSeats = String(seats).padStart(2, "0");

                  return (
                    <tr
                      key={party.id}
                      className="hover:bg-white/[0.025] transition-colors group"
                    >
                      {/* 1. S.No. Cell (Solid party color background matching reference screenshot!) */}
                      <td
                        className="w-12 sm:w-14 p-0 text-center font-black font-mono text-sm sm:text-base border-r border-zinc-700/60 select-none"
                        style={{
                          backgroundColor: partyColor,
                          color: contrastTextColor,
                        }}
                      >
                        <div className="w-full h-full min-h-[48px] sm:min-h-[52px] flex items-center justify-center shadow-inner">
                          <span>{displayIndex}</span>
                        </div>
                      </td>

                      {/* 2. Party Name Cell */}
                      <td className="px-4 py-3 border-r border-zinc-700/60">
                        <div className="flex items-center flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigateParty(party.id)}
                            className="text-[#FFD700] hover:text-[#FFD700] hover:underline font-semibold text-left transition-colors cursor-pointer text-sm sm:text-base leading-snug"
                          >
                            {party.name}
                          </button>
                          {isLeadParty && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 select-none">
                              Lead Party
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Abbr. Cell */}
                      <td className="w-20 sm:w-24 px-3 py-3 text-center font-bold text-zinc-100 border-r border-zinc-700/60 font-mono sm:font-sans">
                        {party.abbreviation || "—"}
                      </td>

                      {/* 4. Flag Cell */}
                      <td className="w-24 sm:w-28 px-3 py-2.5 text-center border-r border-zinc-700/60">
                        <div className="flex items-center justify-center">
                          <div className="w-12 h-7 sm:w-14 sm:h-8 rounded-xs border border-white/20 shadow-sm overflow-hidden flex items-center justify-center bg-black/50 shrink-0">
                            <PartyFlagRenderer party={party} />
                          </div>
                        </div>
                      </td>

                      {/* 5. MLAs / Seats Cell (zero-padded, centered as in screenshot) */}
                      <td className="w-28 sm:w-36 px-3 py-3 text-center font-bold font-mono text-sm sm:text-base text-zinc-100">
                        <span className={seats > 0 ? "text-white" : "text-zinc-500"}>
                          {formattedSeats}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={!isDissolved && onRemoveParty ? 6 : 5}
                    className="py-12 px-6 text-center text-zinc-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Shield size={32} className="text-zinc-600 mb-1" />
                      <p className="font-bold text-zinc-300">
                        {searchQuery ? "No constituent parties match your filter" : "No constituent parties assigned to this alliance"}
                      </p>
                      <p className="text-xs text-zinc-500 max-w-sm">
                        {searchQuery
                          ? "Try clearing the search query to view all member parties."
                          : "This alliance currently has no constituent members."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Table Footer: Total Row (matching Wikipedia standard) */}
            {processedRows.length > 0 && (
              <tfoot>
                <tr className="bg-[#1f2227] border-t-2 border-zinc-600/90 text-xs sm:text-sm font-bold text-zinc-100">
                  {/* Blank or dark S.No. cell */}
                  <td className="w-12 sm:w-14 p-0 text-center bg-[#181a1f] border-r border-zinc-700/60 select-none">
                    <div className="min-h-[42px] flex items-center justify-center">
                      <span className="text-zinc-600 text-xs font-mono">•</span>
                    </div>
                  </td>

                  {/* Total Label */}
                  <td className="px-4 py-3 border-r border-zinc-700/60 font-black uppercase tracking-wider text-white">
                    Total
                  </td>

                  {/* Blank Abbr. */}
                  <td className="w-20 sm:w-24 px-3 py-3 text-center border-r border-zinc-700/60 text-zinc-500 font-mono">
                    —
                  </td>

                  {/* Blank Flag */}
                  <td className="w-24 sm:w-28 px-3 py-3 text-center border-r border-zinc-700/60 text-zinc-500">
                    —
                  </td>

                  {/* Total Seats (Formatted 2-digit zero-padded) */}
                  <td className="w-28 sm:w-36 px-3 py-3 text-center font-black font-mono text-sm sm:text-base text-[#FFD700]">
                    {String(totalAllianceSeats).padStart(2, "0")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
