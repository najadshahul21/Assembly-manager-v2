import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db, reindexConstituencies, freezeAssembly } from "../db";
import {
  EntityType,
  Person,
  Party,
  Alliance,
  Assembly,
  Designation,
  Constituency,
  ElectionResult,
} from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Calendar,
  ExternalLink,
  UserPlus,
  UserMinus,
  Shield,
  Landmark,
  User,
  Flag,
  Award,
  History as HistoryIcon,
  Search,
  ChevronRight,
  Users,
  AlertCircle,
  Plus,
  X,
  Vote,
} from "lucide-react";
import { EntityCard } from "../components/EntityCards";
import { ElectionResultsTable } from "../components/ElectionResultsTable";
import { ElectModal } from "../components/ElectModal";

import { CreateModals } from "../components/CreateModals";

const getAssemblyChronologicalScore = (assembly?: Assembly | null) => {
  if (!assembly) return 0;
  if (assembly.termLimits) {
    const yearMatch = assembly.termLimits.match(/\d{4}/);
    if (yearMatch) {
      return parseInt(yearMatch[0], 10);
    }
  }
  if (assembly.name) {
    const ordinalMatch = assembly.name.match(/^(\d+)/);
    if (ordinalMatch) {
      return parseInt(ordinalMatch[1], 10);
    }
  }
  return 0;
};

const prefixRole = (role: string): string => {
  const trimmed = role.trim();
  const lower = trimmed.toLowerCase();
  
  if (lower.startsWith("hon'ble") || lower.startsWith("honourable") || lower.startsWith("honorable")) {
    return trimmed;
  }

  const isMinister = lower.includes("minister");
  const isSpeaker = lower.includes("speaker");

  if (isMinister || isSpeaker) {
    let displayName = trimmed;
    if (lower === "chiefminister" || lower === "chief minister") {
      displayName = "Chief Minister";
    } else if (lower === "deputychiefminister" || lower === "deputy chief minister") {
      displayName = "Deputy Chief Minister";
    } else if (lower === "speaker" || lower === "speaker of the house" || lower === "speaker of the assembly") {
      displayName = "Speaker";
    } else if (lower === "deputyspeaker" || lower === "deputy speaker" || lower === "deputy speaker of the assembly" || lower === "deputy speaker of the house") {
      displayName = "Deputy Speaker";
    } else {
      displayName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    
    return `Hon'ble ${displayName}`;
  }
  return trimmed;
};

const formatCommaSeparatedRoles = (rolesStr: string): string => {
  if (!rolesStr) return "";
  return rolesStr.split(", ").map(r => prefixRole(r)).join(", ");
};

const generateSeatLayout = (totalSeats: number) => {
  if (!totalSeats || totalSeats <= 0) return [];

  // 4 concentric semi-circular rows
  const radii = [105, 145, 185, 225];
  const numRows = radii.length;

  // Proportional distribution based on circle radius size
  const sumRadii = radii.reduce((a, b) => a + b, 0);
  let seatsPerRow = radii.map((r) => Math.round((r / sumRadii) * totalSeats));

  let currentSum = seatsPerRow.reduce((a, b) => a + b, 0);

  // Adjust so total seats matches exactly
  while (currentSum !== totalSeats) {
    if (currentSum < totalSeats) {
      seatsPerRow[seatsPerRow.length - 1] += 1;
      currentSum += 1;
    } else {
      seatsPerRow[seatsPerRow.length - 1] -= 1;
      currentSum -= 1;
    }
  }

  const positions: { rowIndex: number; x: number; y: number; angle: number }[] = [];
  const centerX = 300;
  const centerY = 265;

  seatsPerRow.forEach((rowCount, rowIndex) => {
    const radius = radii[rowIndex];
    const startAngle = 172;
    const endAngle = 8;
    const angleRange = startAngle - endAngle;

    for (let i = 0; i < rowCount; i++) {
      let angleDegrees;
      if (rowCount === 1) {
        angleDegrees = startAngle - angleRange / 2;
      } else {
        angleDegrees = startAngle - (i / (rowCount - 1)) * angleRange;
      }

      const angleRad = (angleDegrees * Math.PI) / 180;
      const x = centerX + radius * Math.cos(angleRad);
      const y = centerY - radius * Math.sin(angleRad);

      positions.push({
        rowIndex,
        x,
        y,
        angle: angleDegrees,
      });
    }
  });

  return positions;
};

export const EntityPage: React.FC = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get("tab") as any;

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [showAppointPopup, setShowAppointPopup] = useState(false);
  const [showElectModal, setShowElectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleConfirmElection = async (
    winnerPersonId: string | undefined,
    result: ElectionResult
  ) => {
    if (!id || !entity || entityType !== EntityType.CONSTITUENCY) return;

    const con = entity as Constituency;
    const now = Date.now();
    const newIncumbentId = winnerPersonId || "vacant";

    if (winnerPersonId && winnerPersonId !== "vacant") {
      const person = await db.persons.get(winnerPersonId);
      if (person && con.currentAssemblyId) {
        const assemblyRoles = { ...(person.assemblyRoles || {}) };
        assemblyRoles[con.currentAssemblyId] = `${con.name} MLA`;
        await db.persons.update(winnerPersonId, {
          assemblyRoles,
          updatedAt: now,
        });
      }
    }

    const historyEntry = {
      personId: newIncumbentId,
      assemblyId: con.currentAssemblyId || "15th-assembly",
      date: now,
      reason: "election",
    };

    await db.constituencies.update(id, {
      currentIncumbentId: newIncumbentId,
      lastElectionResult: result,
      history: [...(con.history || []), historyEntry],
      updatedAt: now,
    });

    setShowElectModal(false);
  };
  const [showDeactivatePopup, setShowDeactivatePopup] = useState(false);
  const [showVacateMlaReasonModal, setShowVacateMlaReasonModal] =
    useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    isDestructive?: boolean;
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [showPromotePopup, setShowPromotePopup] = useState<{
    personId: string;
    personName: string;
  } | null>(null);
  const [showSupportAlliancePopup, setShowSupportAlliancePopup] = useState<{
    personId: string;
    personName: string;
  } | null>(null);
  const [departmentInput, setDepartmentInput] = useState("");
  const [activeTab, setActiveTab] = useState<
    "details" | "related" | "history" | "cabinet"
  >(
    initialTab &&
      ["details", "related", "history", "cabinet"].includes(initialTab)
      ? initialTab
      : "details",
  );

  const entityType = type as EntityType;

  // Generic data fetching
  const entity = useLiveQuery(async () => {
    if (!id) return null;
    switch (entityType) {
      case EntityType.PERSON:
        return db.persons.get(id);
      case EntityType.PARTY:
        return db.parties.get(id);
      case EntityType.ALLIANCE:
        return db.alliances.get(id);
      case EntityType.ASSEMBLY:
        return db.assemblies.get(id);
      case EntityType.DESIGNATION:
        return db.designations.get(id);
      case EntityType.CONSTITUENCY:
        return db.constituencies.get(id);
      default:
        return null;
    }
  }, [type, id]);

  // Related data fetching
  const relatedPersons = useLiveQuery(async () => {
    if (!id) return [];
    let list: Person[] = [];
    if (entityType === EntityType.PARTY) {
      list = await db.persons.where("partyId").equals(id).toArray();
    } else if (entityType === EntityType.ALLIANCE) {
      const parties = await db.parties.where("allianceId").equals(id).toArray();
      const pIds = parties.map((p) => p.id).filter(Boolean);
      if (pIds.length > 0) {
        list = await db.persons.where("partyId").anyOf(pIds).toArray();
      }
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [type, id]);

  const relatedParties = useLiveQuery(async () => {
    if (!id) return [];
    if (entityType === EntityType.ALLIANCE) {
      const list = await db.parties.where("allianceId").equals(id).toArray();
      return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }
    return [];
  }, [type, id]);

  const partiesList = useLiveQuery(async () => {
    const list = await db.parties.toArray();
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }) || [];
  const personsList = useLiveQuery(async () => {
    const list = await db.persons.toArray();
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }) || [];
  const assembliesList = useLiveQuery(() => db.assemblies.toArray()) || [];
  const alliancesList = useLiveQuery(async () => {
    const list = await db.alliances.toArray();
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }) || [];
  const constituenciesList =
    useLiveQuery(() => db.constituencies.toArray()) || [];
  const designationsList = useLiveQuery(() => db.designations.toArray()) || [];

  const leadingParty = useLiveQuery(async () => {
    if (entityType === EntityType.ALLIANCE && entity) {
      const lpId = (entity as Alliance).leadingPartyId;
      if (typeof lpId === "string" && lpId) {
        return db.parties.get(lpId);
      }
    }
    return null;
  }, [entity, entityType]);

  const associatedConstituency = useLiveQuery(async () => {
    if (entityType === EntityType.DESIGNATION && entity) {
      const conId = (entity as Designation).constituencyId;
      if (typeof conId === "string" && conId) {
        return db.constituencies.get(conId);
      }
    }
    return null;
  }, [entity]);

  const associatedAssembly = useLiveQuery(async () => {
    if (entityType === EntityType.DESIGNATION && entity) {
      const asmId = (entity as Designation).assemblyId;
      if (typeof asmId === "string" && asmId) {
        return db.assemblies.get(asmId);
      }
    }
    return null;
  }, [entity]);

  const partyAlliance = useLiveQuery(async () => {
    if (entityType === EntityType.PARTY && entity) {
      const allianceId = (entity as Party).allianceId;
      if (
        typeof allianceId === "string" &&
        allianceId &&
        allianceId !== "independent"
      ) {
        return db.alliances.get(allianceId);
      }
    }
    return null;
  }, [entity]);

  const personParty = useLiveQuery(async () => {
    if (entityType === EntityType.PERSON && entity) {
      const partyId = (entity as Person).partyId;
      if (typeof partyId === "string" && partyId && partyId !== "independent") {
        return db.parties.get(partyId);
      }
    }
    return null;
  }, [entity]);

  const constituencyPreviousPartyAbbr = useLiveQuery(async () => {
    if (entityType === EntityType.CONSTITUENCY && entity) {
      const con = entity as Constituency;
      if (con.currentIncumbentId && con.currentIncumbentId !== 'vacant') {
        const person = await db.persons.get(con.currentIncumbentId);
        if (person?.partyId && person.partyId !== 'independent') {
          const party = await db.parties.get(person.partyId);
          if (party?.abbreviation) return party.abbreviation;
        }
      }
      if (con.lastElectionResult?.winnerPartyAbbreviation) {
        return con.lastElectionResult.winnerPartyAbbreviation;
      }
    }
    return 'new constituency';
  }, [entityType, entity?.id]);

  const designationsFromConstituency = useLiveQuery(async () => {
    if (entityType === EntityType.CONSTITUENCY && entity) {
      const con = entity as Constituency;

      const results: any[] = [];
      // Current state
      if (con.currentAssemblyId) {
        const assembly = await db.assemblies.get(con.currentAssemblyId);
        const incumbent =
          con.currentIncumbentId && con.currentIncumbentId !== "vacant"
            ? await db.persons.get(con.currentIncumbentId)
            : null;
        results.push({
          id: `current-${con.id}`,
          assembly,
          incumbent,
          incumbentId: con.currentIncumbentId,
          date: con.updatedAt,
        });
      }

      // History from Constituency record
      if (Array.isArray(con.history)) {
        for (const h of con.history) {
          const assembly = h.assemblyId
            ? await db.assemblies.get(h.assemblyId)
            : null;
          const incumbent =
            h.personId && h.personId !== "vacant"
              ? await db.persons.get(h.personId)
              : null;
          results.push({
            id: `hist-${con.id}-${h.date}`,
            assembly,
            incumbent,
            incumbentId: h.personId,
            date: h.date,
            isHistory: true,
          });
        }
      }

      // Legacy Designations
      const legacyDesigs = await db.designations
        .where("constituencyId")
        .equals(id!)
        .toArray();
      for (const d of legacyDesigs) {
        if (!results.some((r) => r.assembly?.id === d.assemblyId)) {
          const assembly = d.assemblyId
            ? await db.assemblies.get(d.assemblyId)
            : null;
          const incumbent =
            d.incumbentId && d.incumbentId !== "vacant"
              ? await db.persons.get(d.incumbentId)
              : null;
          results.push({ ...d, assembly, incumbent, date: d.updatedAt });
        }
      }

      const sorted = results.sort((a, b) => (b.date || 0) - (a.date || 0));

      // Deduplicate so there is only one representative entry per legislative assembly session
      const uniqueSessions = sorted.filter((item, idx) => {
        const asmId = item.assembly?.id || "none";
        return (
          sorted.findIndex(
            (other) => (other.assembly?.id || "none") === asmId,
          ) === idx
        );
      });

      return uniqueSessions;
    }
    return [];
  }, [entity, entityType, id]);

  const currentIncumbentPerson = useLiveQuery(async () => {
    let personId = "vacant";
    if (entityType === EntityType.CONSTITUENCY && entity) {
      personId = (entity as Constituency).currentIncumbentId;
    } else if (entityType === EntityType.DESIGNATION && entity) {
      personId = (entity as Designation).incumbentId;
    }

    if (personId && personId !== "vacant") {
      return db.persons.get(personId);
    }
    return null;
  }, [entity, entityType]);

  const precededByAssembly = useLiveQuery(async () => {
    if (
      entityType === EntityType.ASSEMBLY &&
      entity &&
      (entity as Assembly).precededById
    ) {
      return db.assemblies.get((entity as Assembly).precededById!);
    }
    return null;
  }, [entity]);

  const followedByAssembly = useLiveQuery(async () => {
    if (entityType === EntityType.ASSEMBLY && entity) {
      return db.assemblies
        .where("precededById")
        .equals((entity as Assembly).id)
        .first();
    }
    return null;
  }, [entity]);

  const allianceLeadership = useLiveQuery(async () => {
    if (entityType !== EntityType.ALLIANCE || !entity) return null;
    const alliance = entity as Alliance;
    const [leader, chairman, founder] = await Promise.all([
      alliance.leaderId
        ? db.persons.get(alliance.leaderId)
        : Promise.resolve(null),
      alliance.chairmanId
        ? db.persons.get(alliance.chairmanId)
        : Promise.resolve(null),
      alliance.founderId
        ? db.persons.get(alliance.founderId)
        : Promise.resolve(null),
    ]);
    return { leader, chairman, founder };
  }, [entity, entityType]);

  const highCommandMembers = useLiveQuery(async () => {
    if (entityType !== EntityType.ALLIANCE || !entity || !id) return [];
    const alliance = entity as Alliance;
    const currentHighCommandIds = alliance.highCommandIds || [];

    if (currentHighCommandIds.length === 0) return [];

    // Get all parties in this alliance
    const allianceParties = await db.parties
      .where("allianceId")
      .equals(id)
      .toArray();
    const alliancePartyIds = allianceParties.map((p) => p.id);

    // Get the persons in high command
    const members = await db.persons
      .where("id")
      .anyOf(currentHighCommandIds)
      .toArray();

    // Filter to keep only those whose party is in the alliance and are not suspended
    const validMembers = members.filter((m) =>
      alliancePartyIds.includes(m.partyId) && !m.isSuspended,
    );
    const validMemberIds = validMembers.map((m) => m.id);

    // Automatic removal check: if lists differ, update the DB
    // We compare strings to avoid complex array comparison
    if (
      JSON.stringify(validMemberIds.sort()) !==
      JSON.stringify([...currentHighCommandIds].sort())
    ) {
      await db.alliances.update(id, {
        highCommandIds: validMemberIds,
        updatedAt: Date.now(),
      });
    }

    return validMembers.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [entity, id, entityType]);

  const personsEligibleForHighCommand = useLiveQuery(async () => {
    if (entityType !== EntityType.ALLIANCE || !id) return [];
    const allianceParties = await db.parties
      .where("allianceId")
      .equals(id)
      .toArray();
    const alliancePartyIds = allianceParties.map((p) => p.id);
    const persons = alliancePartyIds.length > 0
      ? await db.persons.where("partyId").anyOf(alliancePartyIds).toArray()
      : [];
    return persons
      .filter((p) => !p.isSuspended)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [id, entityType]);

  const handleToggleHighCommand = async (personId: string) => {
    if (entityType !== EntityType.ALLIANCE || !id) return;
    const alliance = entity as Alliance;
    const currentIds = alliance.highCommandIds || [];
    let newIds: string[];

    if (currentIds.includes(personId)) {
      newIds = currentIds.filter((pid) => pid !== personId);
    } else {
      newIds = [...currentIds, personId];
    }

    await db.alliances.update(id, {
      highCommandIds: newIds,
      updatedAt: Date.now(),
    });
  };

  const getEntityLabel = () => {
    switch (entityType) {
      case EntityType.PERSON:
        return "Politician";
      case EntityType.PARTY:
        return "Political Party";
      case EntityType.ALLIANCE:
        return "Political Alliance";
      case EntityType.ASSEMBLY:
        return "Legislative Assembly";
      case EntityType.DESIGNATION:
        return "Official Designation";
      case EntityType.CONSTITUENCY:
        return "Assembly Constituency";
      default:
        return "";
    }
  };

  const personDesignations = useLiveQuery(async () => {
    if (entityType !== EntityType.PERSON) return [];

    // Get all designations where this person is the incumbent or was in history
    const allDesignations = await db.designations.toArray();
    const filtered = allDesignations.filter(
      (d) =>
        d.incumbentId === id ||
        (Array.isArray(d.history) && d.history.some((h) => h.personId === id)),
    );

    const enriched = await Promise.all(
      filtered.map(async (d) => {
        const assembly = d.assemblyId
          ? await db.assemblies.get(d.assemblyId)
          : null;
        return { ...d, assembly };
      }),
    );

    // Also get all constituencies where this person is/was MLA
    const allConstituencies = await db.constituencies.toArray();
    const conFiltered = allConstituencies.filter(
      (c) =>
        c.currentIncumbentId === id ||
        (Array.isArray(c.history) && c.history.some((h) => h.personId === id)),
    );

    const conEnriched = await Promise.all(
      conFiltered.map(async (c) => {
        // For constituencies, we might have multiple historical associations
        const historyEntries = Array.isArray(c.history)
          ? c.history.filter((h) => h.personId === id)
          : [];
        const currentEntry =
          c.currentIncumbentId === id
            ? { assemblyId: c.currentAssemblyId, isCurrent: true }
            : null;

        const results: any[] = [];
        if (currentEntry) {
          const assembly = currentEntry.assemblyId
            ? await db.assemblies.get(currentEntry.assemblyId)
            : null;
          results.push({
            id: `con-${c.id}-current`,
            name: `${c.name} MLA`,
            incumbentId: id,
            assembly,
            constituency: c.name,
            date: c.updatedAt,
          });
        }

        for (const h of historyEntries) {
          // Skip if this history entry is just the record of the current appointment in the same assembly
          if (
            currentEntry &&
            h.assemblyId === currentEntry.assemblyId &&
            h.personId === id
          ) {
            // If we already added a current entry for this assembly, don't add the appointment history entry as a "Past Role"
            continue;
          }

          const assembly = h.assemblyId
            ? await db.assemblies.get(h.assemblyId)
            : null;
          results.push({
            id: `con-${c.id}-${h.date}`,
            name: `${c.name} MLA`,
            incumbentId: "other", // marks it as past if ID doesn't match current precisely in sorting logic
            assembly,
            constituency: c.name,
            date: h.date,
            historyEntry: h,
          });
        }
        return results;
      }),
    );

    const finalListOfRoles = [...enriched, ...conEnriched.flat()];

    // Sort by chronological score & date (Reverse chronologically: newest/most recent first)
    const sorted = finalListOfRoles.sort((a, b) => {
      const scoreA = getAssemblyChronologicalScore(a.assembly);
      const scoreB = getAssemblyChronologicalScore(b.assembly);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      const aDate =
        a.date ||
        (Array.isArray(a.history) &&
          a.history.find((h: any) => h.personId === id)?.date) ||
        0;
      const bDate =
        b.date ||
        (Array.isArray(b.history) &&
          b.history.find((h: any) => h.personId === id)?.date) ||
        0;
      return bDate - aDate;
    });

    // Deduplicate so that for the same role name in the same assembly session, we only show it once
    const unique = sorted.filter((item, idx) => {
      const key = `${item.name}-${item.assembly?.id || "none"}`;
      return (
        sorted.findIndex(
          (other) => `${other.name}-${other.assembly?.id || "none"}` === key,
        ) === idx
      );
    });

    return unique;
  }, [type, id]);

  const personAssemblyRoles = useLiveQuery(async () => {
    if (entityType !== EntityType.PERSON || !entity) return [];

    const person = entity as Person;
    const allAssemblies = await db.assemblies.toArray();
    const roles: { assembly: Assembly; role: string }[] = [];

    // Check leaders object in assemblies
    allAssemblies.forEach((a) => {
      if (a.leaders) {
        Object.entries(a.leaders).forEach(([role, pId]) => {
          if (pId === id) {
            roles.push({ assembly: a, role });
          }
        });
      }
    });

    // Check person's individual assembly roles (like Ministers)
    if (person.assemblyRoles) {
      for (const [aId, roleStr] of Object.entries(person.assemblyRoles)) {
        const assembly = allAssemblies.find((a) => a.id === aId);
        if (assembly) {
          const individualRoles = (roleStr as string).split(", ");
          individualRoles.forEach((r) => {
            // Avoid duplicates if already added from leaders or earlier in the split
            if (!roles.some((rl) => rl.assembly.id === aId && rl.role === r)) {
              roles.push({ assembly, role: r });
            }
          });
        }
      }
    }

    // Sort roles reverse chronologically (newest assembly first)
    roles.sort((a, b) => {
      const scoreA = getAssemblyChronologicalScore(a.assembly);
      const scoreB = getAssemblyChronologicalScore(b.assembly);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return a.role.localeCompare(b.role);
    });

    return roles;
  }, [entity, type, id]);

  const activeRoles = React.useMemo(() => {
    if (entityType !== EntityType.PERSON || !entity) return [];
    const person = entity as Person;

    const activeAssemblies = assembliesList.filter((a) => a && a.isActive !== false);
    const activeAssemblyIds = new Set(activeAssemblies.map((a) => a.id));

    const roles: {
      name: string;
      type: "mla" | "cabinet" | "leadership";
      assemblyName: string;
    }[] = [];

    // 1. MLA Seats
    const activeMlaSeats = constituenciesList.filter(
      (c) =>
        c &&
        c.currentAssemblyId &&
        activeAssemblyIds.has(c.currentAssemblyId) &&
        c.currentIncumbentId === person.id,
    );
    activeMlaSeats.forEach((c) => {
      if (!c) return;
      const assembly = activeAssemblies.find(
        (a) => a.id === c.currentAssemblyId,
      );
      roles.push({
        name: `MLA for ${c.name || "Unknown Constituency"}`,
        type: "mla",
        assemblyName: assembly?.name || "",
      });
    });

    // 2. Leadership Council Roles from Active Assemblies
    activeAssemblies.forEach((a) => {
      if (a && a.leaders && typeof a.leaders === "object") {
        for (const [roleKey, pId] of Object.entries(a.leaders)) {
          if (pId === person.id && pId !== "vacant" && roleKey) {
            const displayName = roleKey.replace(/([A-Z])/g, " $1");
            const capitalized =
              displayName.charAt(0).toUpperCase() + displayName.slice(1);

            // Avoid duplication
            if (
              !roles.some(
                (r) =>
                  r.name &&
                  r.name.toLowerCase() === capitalized.toLowerCase() &&
                  r.assemblyName === a.name,
              )
            ) {
              roles.push({
                name: capitalized,
                type: "leadership",
                assemblyName: a.name || "",
              });
            }
          }
        }
      }
    });

    // 3. Cabinet / Ministerial Roles from assemblyRoles (individual roles split by ', ')
    if (person.assemblyRoles && typeof person.assemblyRoles === "object" && !Array.isArray(person.assemblyRoles)) {
      for (const [aId, roleStr] of Object.entries(person.assemblyRoles)) {
        if (activeAssemblyIds.has(aId) && roleStr && typeof roleStr === "string") {
          const assembly = activeAssemblies.find((a) => a.id === aId);
          if (assembly) {
            const individualRoles = roleStr
              .split(", ")
              .map((r) => r.trim())
              .filter(Boolean);
            individualRoles.forEach((r) => {
              // Check if it's already in the roles list under some type
              const exists = roles.some(
                (existing) =>
                  existing.name &&
                  existing.name.toLowerCase() === r.toLowerCase() &&
                  existing.assemblyName === assembly.name,
              );
              if (!exists) {
                roles.push({
                  name: r,
                  type: "cabinet",
                  assemblyName: assembly.name || "",
                });
              }
            });
          }
        }
      }
    }

    // 4. Cabinet / Ministerial Roles from active designations
    const activeDesigs = designationsList.filter(
      (d) =>
        d &&
        d.assemblyId &&
        activeAssemblyIds.has(d.assemblyId) &&
        d.incumbentId === person.id,
    );
    activeDesigs.forEach((d) => {
      if (!d) return;
      const assembly = activeAssemblies.find((a) => a.id === d.assemblyId);
      const r = d.name || "";
      const rLower = r.toLowerCase();
      const isCabinet =
        rLower.includes("minister") ||
        rLower.includes("speaker") ||
        rLower.includes("secretary") ||
        rLower.includes("leader") ||
        rLower.includes("chief");

      const exists = roles.some(
        (existing) =>
          existing.name &&
          existing.name.toLowerCase() === rLower &&
          existing.assemblyName === (assembly?.name || ""),
      );

      if (!exists) {
        roles.push({
          name: r,
          type: isCabinet ? "cabinet" : "mla",
          assemblyName: assembly?.name || "",
        });
      }
    });

    // Deduplicate active roles by name (case-insensitive, trimmed)
    const seenNames = new Set<string>();
    const uniqueRoles: typeof roles = [];
    roles.forEach((r) => {
      if (!r || !r.name) return;
      if (r.name.toLowerCase().includes("mla")) {
        r.type = "mla";
      }
      const cleanName = r.name.trim().toLowerCase();
      if (!seenNames.has(cleanName)) {
        seenNames.add(cleanName);
        uniqueRoles.push(r);
      } else {
        const existingIdx = uniqueRoles.findIndex(
          (x) => x.name && x.name.trim().toLowerCase() === cleanName,
        );
        if (
          existingIdx !== -1 &&
          !uniqueRoles[existingIdx].assemblyName &&
          r.assemblyName
        ) {
          uniqueRoles[existingIdx].assemblyName = r.assemblyName;
          uniqueRoles[existingIdx].type = r.type;
        }
      }
    });

    return uniqueRoles;
  }, [
    entity,
    entityType,
    assembliesList,
    constituenciesList,
    designationsList,
    id,
  ]);

  const assemblyMembers =
    useLiveQuery(async () => {
      if (entityType !== EntityType.ASSEMBLY) return [];

      // Check for cached membership
      const assemblyRecord = await db.assemblies.get(id!);
      if (
        assemblyRecord &&
        !assemblyRecord.isActive &&
        assemblyRecord.composition &&
        assemblyRecord.composition.members
      ) {
        return assemblyRecord.composition.members;
      }

      // Find all constituencies and designations
      const cs = await db.constituencies.toArray();
      const relevantCs = cs.filter(
        (c) =>
          c.currentAssemblyId === id ||
          (c.history && c.history.some((h) => h.assemblyId === id)),
      );
      const ds = await db.designations
        .where("assemblyId")
        .equals(id!)
        .toArray();

      const membersListOutput: any[] = [];
      const addedPersons = new Set<string>();

      // Process Constituencies (including historical and by-elected)
      for (const con of relevantCs) {
        const conHistory = (con.history || []).filter(
          (h) => h.assemblyId === id,
        );

        const personIdsSet = new Set<string>();
        if (
          con.currentAssemblyId === id &&
          con.currentIncumbentId !== "vacant"
        ) {
          personIdsSet.add(con.currentIncumbentId);
        }
        conHistory.forEach((h) => {
          if (h.personId && h.personId !== "vacant") {
            personIdsSet.add(h.personId);
          }
        });

        const personAppointments = Array.from(personIdsSet).map((pId) => {
          const entries = conHistory.filter((h) => h.personId === pId);
          const earliestDate =
            entries.length > 0
              ? Math.min(...entries.map((e) => e.date))
              : Date.now();
          return { pId, earliestDate };
        });
        personAppointments.sort((a, b) => a.earliestDate - b.earliestDate);

        for (let index = 0; index < personAppointments.length; index++) {
          const { pId } = personAppointments[index];
          const p = await db.persons.get(pId);
          if (p) {
            const removalEntry = conHistory.find(
              (h) => h.personId === pId && h.reason !== "appointment",
            );
            let mlaStatusText = "";
            if (removalEntry) {
              mlaStatusText =
                removalEntry.reason.charAt(0).toUpperCase() +
                removalEntry.reason.slice(1);
            } else if (index > 0) {
              mlaStatusText = "Byelected";
            }

            const party = await db.parties.get(p.partyId);
            const alliance =
              party && party.allianceId !== "independent"
                ? await db.alliances.get(party.allianceId)
                : null;
            let baseSubtitle =
              p.partyId === "independent"
                ? "Independent"
                : party?.name || "Member";
            if (alliance) {
              baseSubtitle = `${baseSubtitle} • ${alliance.name}`;
            }

            let finalSubtitle = `${baseSubtitle} (${con.name})`;
            if (mlaStatusText) {
              finalSubtitle = `${mlaStatusText} | ${finalSubtitle}`;
            }

            membersListOutput.push({
              id: p.id,
              uniqueKey: `${p.id}-${con.id}-${index}`,
              name: p.name,
              constituencyName: con.name,
              partyId: p.partyId,
              imageUrl: p.imageUrl,
              subtitleOverride: finalSubtitle,
              mlaStatusText: mlaStatusText || undefined,
            });
            addedPersons.add(p.id);
          }
        }
      }

      // Process Designations
      for (const d of ds) {
        if (d.incumbentId !== "vacant" && !addedPersons.has(d.incumbentId)) {
          const p = await db.persons.get(d.incumbentId);
          if (p) {
            membersListOutput.push({
              id: p.id,
              uniqueKey: `${p.id}-${d.id}`,
              name: p.name,
              constituencyName: d.constituency || "Special Role",
              partyId: p.partyId,
              imageUrl: p.imageUrl,
            });
            addedPersons.add(p.id);
          }
        }
      }

      return membersListOutput;
    }, [type, id]) || [];

  const assemblyPerformance = useLiveQuery(async () => {
    if (entityType !== EntityType.ASSEMBLY) return null;

    // Check for cached/frozen composition for dissolved assemblies
    const assemblyRecord = await db.assemblies.get(id!);
    if (
      assemblyRecord &&
      !assemblyRecord.isActive &&
      assemblyRecord.composition
    ) {
      const cached = assemblyRecord.composition;
      return {
        totalSeats: cached.totalSeats || 0,
        incumbentCount: cached.incumbentCount || 0,
        distribution: cached.distribution || [],
        government: cached.government || null,
        opposition: cached.opposition || null,
        others: cached.others || [],
        members: cached.members || [],
        seatingLayout: cached.seatingLayout || [],
      };
    }

    // ... continue as before but if it's dissolved and result is ready, save it
    const data = await (async () => {
      const constituencies = await db.constituencies
        .where("currentAssemblyId")
        .equals(id!)
        .toArray();
      const designations = await db.designations
        .where("assemblyId")
        .equals(id!)
        .toArray();

      const pIds = [
        ...constituencies.map((c) => c.currentIncumbentId),
        ...designations.map((d) => d.incumbentId),
      ].filter((pid) => pid !== "vacant");

      const uniquePIds = [...new Set(pIds)];
      const incumbentPersons = uniquePIds.length > 0
        ? await db.persons.where("id").anyOf(uniquePIds).toArray()
        : [];

      const personConstituencyMap: Record<string, string> = {};
      constituencies.forEach((c) => {
        if (c.currentIncumbentId && c.currentIncumbentId !== "vacant") {
          personConstituencyMap[c.currentIncumbentId] = c.name;
        }
      });
      designations.forEach((d) => {
        if (d.incumbentId && d.incumbentId !== "vacant") {
          personConstituencyMap[d.incumbentId] =
            d.constituency || "Special Role";
        }
      });

      const partyIds = incumbentPersons.map((p) => p.partyId);
      const parties = partyIds.length > 0
        ? await db.parties.where("id").anyOf(partyIds).toArray()
        : [];

      const independentSupportMap = assemblyRecord?.independentSupports || {};
      const supportedAllianceIds = Object.values(independentSupportMap);
      const allianceIds = [
        ...new Set([
          ...parties.map((p) => p.allianceId),
          ...supportedAllianceIds,
        ]),
      ].filter(Boolean);
      const alliances = allianceIds.length > 0
        ? await db.alliances.where("id").anyOf(allianceIds).toArray()
        : [];

      const groups: {
        [allianceId: string]: {
          id: string;
          name: string;
          abbreviation: string;
          totalSeats: number;
          color: string;
          parties: {
            id: string;
            name: string;
            abbreviation: string;
            seats: number;
            color: string;
          }[];
        };
      } = {};

      incumbentPersons.forEach((person) => {
        const party = parties.find((p) => p.id === person.partyId);
        let allianceId = party ? party.allianceId : "independent";

        // If independent and has supported alliance in this active assembly, associate with that alliance
        if (
          person.partyId === "independent" &&
          independentSupportMap[person.id]
        ) {
          const supAllianceId = independentSupportMap[person.id];
          if (alliances.some((a) => a.id === supAllianceId)) {
            allianceId = supAllianceId;
          }
        }

        const alliance = alliances.find((a) => a.id === allianceId);

        if (!groups[allianceId]) {
          groups[allianceId] = {
            id: allianceId,
            name: alliance
              ? alliance.name
              : allianceId === "independent"
                ? "Independents"
                : allianceId,
            abbreviation: alliance
              ? alliance.abbreviation
              : allianceId === "independent"
                ? "IND"
                : allianceId,
            totalSeats: 0,
            color: alliance && alliance.colors ? alliance.colors[0] : "#666666",
            parties: [],
          };
        }

        groups[allianceId].totalSeats += 1;

        if (party) {
          let partyRef = groups[allianceId].parties.find(
            (p) => p.id === party.id,
          );
          if (!partyRef) {
            partyRef = {
              id: party.id,
              name: party.name,
              abbreviation: party.abbreviation,
              seats: 0,
              color: party.colors ? party.colors[0] : "#999999",
            };
            groups[allianceId].parties.push(partyRef);
          }
          partyRef.seats += 1;
        } else {
          // Independent legislator (potentially with alliance support)
          if (allianceId !== "independent") {
            let partyRef = groups[allianceId].parties.find(
              (p) => p.id === "independent-supporting",
            );
            if (!partyRef) {
              partyRef = {
                id: "independent-supporting",
                name: "Independents (Supporting)",
                abbreviation: "IND (S)",
                seats: 0,
                color: "#666666",
              };
              groups[allianceId].parties.push(partyRef);
            }
            partyRef.seats += 1;
          }
        }
      });

      Object.values(groups).forEach((group) => {
        group.parties.sort((a, b) => b.seats - a.seats);
      });

      const sortedGroups = Object.entries(groups)
        .map(([id, data]) => ({ ...data }))
        .sort((a, b) => b.totalSeats - a.totalSeats);

      // Fetch all constituencies to support historical and by-elected MLAs
      const allCs = await db.constituencies.toArray();
      const relevantCs = allCs.filter(
        (c) =>
          c.currentAssemblyId === id ||
          (c.history && c.history.some((h) => h.assemblyId === id)),
      );

      const membersOutputList: any[] = [];
      const addedPersons = new Set<string>();

      for (const con of relevantCs) {
        const conHistory = (con.history || []).filter(
          (h) => h.assemblyId === id,
        );

        const personIdsSet = new Set<string>();
        if (
          con.currentAssemblyId === id &&
          con.currentIncumbentId !== "vacant"
        ) {
          personIdsSet.add(con.currentIncumbentId);
        }
        conHistory.forEach((h) => {
          if (h.personId && h.personId !== "vacant") {
            personIdsSet.add(h.personId);
          }
        });

        const personAppointments = Array.from(personIdsSet).map((pId) => {
          const entries = conHistory.filter((h) => h.personId === pId);
          const earliestDate =
            entries.length > 0
              ? Math.min(...entries.map((e) => e.date))
              : Date.now();
          return { pId, earliestDate };
        });
        personAppointments.sort((a, b) => a.earliestDate - b.earliestDate);

        for (let index = 0; index < personAppointments.length; index++) {
          const { pId } = personAppointments[index];
          const p = await db.persons.get(pId);
          if (p) {
            const removalEntry = conHistory.find(
              (h) => h.personId === pId && h.reason !== "appointment",
            );
            let mlaStatusText = "";
            if (removalEntry) {
              mlaStatusText =
                removalEntry.reason.charAt(0).toUpperCase() +
                removalEntry.reason.slice(1);
            } else if (index > 0) {
              mlaStatusText = "Byelected";
            }

            const party = await db.parties.get(p.partyId);
            const alliance =
              party && party.allianceId !== "independent"
                ? await db.alliances.get(party.allianceId)
                : null;
            let baseSubtitle =
              p.partyId === "independent"
                ? "Independent"
                : party?.name || "Member";
            if (alliance) {
              baseSubtitle = `${baseSubtitle} • ${alliance.name}`;
            }

            let finalSubtitle = `${baseSubtitle} (${con.name})`;
            if (mlaStatusText) {
              finalSubtitle = `${mlaStatusText} | ${finalSubtitle}`;
            }

            membersOutputList.push({
              id: p.id,
              uniqueKey: `${p.id}-${con.id}-${index}`,
              name: p.name,
              constituencyName: con.name,
              partyId: p.partyId,
              imageUrl: p.imageUrl,
              subtitleOverride: finalSubtitle,
              mlaStatusText: mlaStatusText || undefined,
            });
            addedPersons.add(p.id);
          }
        }
      }

      // Process Designations
      for (const d of designations) {
        if (d.incumbentId !== "vacant" && !addedPersons.has(d.incumbentId)) {
          const p = await db.persons.get(d.incumbentId);
          if (p) {
            membersOutputList.push({
              id: p.id,
              uniqueKey: `${p.id}-${d.id}`,
              name: p.name,
              constituencyName: d.constituency || "Special Role",
              partyId: p.partyId,
              imageUrl: p.imageUrl,
            });
            addedPersons.add(p.id);
          }
        }
      }

      return {
        totalSeats: Math.max(constituencies.length, 60),
        incumbentCount: incumbentPersons.length,
        distribution: sortedGroups,
        government: sortedGroups[0] || null,
        opposition: sortedGroups[1] || null,
        others: sortedGroups.slice(2),
        members: membersOutputList,
      };
    })();

    return data;
  }, [type, id]);

  const [inspectorSeat, setInspectorSeat] = useState<any>(null);

  const assemblySeats = useLiveQuery(async () => {
    if (entityType !== EntityType.ASSEMBLY || !id) return [];

    const assemblyObj = await db.assemblies.get(id);
    if (assemblyObj && !assemblyObj.isActive && assemblyObj.composition?.seatingLayout) {
      return assemblyObj.composition.seatingLayout;
    }

    const constituencies = await db.constituencies.toArray();
    const parties = await db.parties.toArray();
    const persons = await db.persons.toArray();
    const alliances = await db.alliances.toArray();

    const targetCs = constituencies.filter(
      (c) =>
        c.currentAssemblyId === id ||
        (Array.isArray(c.history) && c.history.some((h) => h.assemblyId === id)),
    );

    const mappedSeats = await Promise.all(
      targetCs.map(async (c) => {
        let politician: Person | undefined = undefined;

        if (c.currentAssemblyId === id) {
          if (c.currentIncumbentId !== "vacant") {
            politician = persons.find((p) => p.id === c.currentIncumbentId);
          }
        } else {
          const hist = (c.history || [])
            .sort((a, b) => b.date - a.date)
            .find((h) => h.assemblyId === id);
          if (hist && hist.personId !== "vacant") {
            politician = persons.find((p) => p.id === hist.personId);
          }
        }

        let party: Party | undefined = undefined;
        if (politician) {
          party = parties.find((p) => p.id === politician!.partyId);
        }

        let alliance: Alliance | undefined = undefined;
        if (party) {
          let partyAllianceId = party.allianceId;
          if ((!partyAllianceId || partyAllianceId === "independent") && politician && assemblyObj) {
            const supportedAllianceId = assemblyObj.independentSupports?.[politician.id];
            if (supportedAllianceId) {
              partyAllianceId = supportedAllianceId;
            }
          }
          if (partyAllianceId && partyAllianceId !== "independent") {
            alliance = alliances.find((a) => a.id === partyAllianceId);
          }
        }

        return {
          constituency: c,
          politician,
          party,
          alliance,
        };
      }),
    );

    // Sort seats cleanly so they cluster beautifully by Party / Alliance
    const sorted = mappedSeats.sort((a, b) => {
      const isVacantA = !a.politician;
      const isVacantB = !b.politician;
      if (isVacantA && !isVacantB) return 1;
      if (!isVacantA && isVacantB) return -1;
      if (isVacantA && isVacantB) return 0;

      const allianceA = a.alliance ? a.alliance.id : "independent";
      const allianceB = b.alliance ? b.alliance.id : "independent";

      const govId = assemblyPerformance?.government?.id;
      const oppId = assemblyPerformance?.opposition?.id;

      const getRank = (allianceId: string) => {
        if (govId && allianceId === govId) return 1;
        if (oppId && allianceId === oppId) return 10;
        if (allianceId === "independent") return 6;
        return 5;
      };

      const rankA = getRank(allianceA);
      const rankB = getRank(allianceB);

      if (rankA !== rankB) return rankA - rankB;

      const pIdA = a.politician!.partyId;
      const pIdB = b.politician!.partyId;
      if (pIdA !== pIdB) return pIdA.localeCompare(pIdB);

      const slA = parseInt(a.constituency.slNo) || 999;
      const slB = parseInt(b.constituency.slNo) || 999;
      return slA - slB;
    });

    return sorted;
  }, [
    id,
    entityType,
    assemblyPerformance,
  ]);

  // Lazy snapshot for dissolved assemblies
  React.useEffect(() => {
    const snapshot = async () => {
      if (
        entityType === EntityType.ASSEMBLY &&
        id &&
        entity &&
        !(entity as Assembly).isActive &&
        (!(entity as Assembly).composition || !(entity as Assembly).composition?.seatingLayout)
      ) {
        try {
          await freezeAssembly(id);
        } catch (err) {
          console.error("Failed to save assembly snapshot:", err);
        }
      }
    };
    snapshot();
  }, [id, entity, entityType]);

  const sortedSeatPositions = React.useMemo(() => {
    const numSeats = assemblySeats?.length || 0;
    if (numSeats === 0) return [];

    const rawPositions = generateSeatLayout(numSeats);
    // Sort positions descending by angle (left to right)
    return [...rawPositions].sort((a, b) => b.angle - a.angle);
  }, [assemblySeats?.length]);

  const speakerDetails = React.useMemo(() => {
    if (entityType !== EntityType.ASSEMBLY || !entity) return null;
    const speakerId = (entity as Assembly).leaders?.speaker;
    if (!speakerId) return null;

    const speakerPerson = personsList.find((p) => p.id === speakerId);
    if (!speakerPerson) return null;

    const speakerParty = speakerPerson
      ? partiesList.find((p) => p.id === speakerPerson.partyId)
      : undefined;

    const speakerAlliance =
      speakerParty &&
      speakerParty.allianceId &&
      speakerParty.allianceId !== "independent"
        ? alliancesList.find((a) => a.id === speakerParty.allianceId)
        : undefined;

    const speakerSeat = assemblySeats?.find(
      (s) => s.politician?.id === speakerPerson.id
    );

    return {
      person: speakerPerson,
      party: speakerParty,
      alliance: speakerAlliance,
      seat: speakerSeat,
    };
  }, [entity, entityType, personsList, partiesList, alliancesList, assemblySeats]);

  React.useEffect(() => {
    if (assemblySeats && assemblySeats.length > 0) {
      if (inspectorSeat) {
        const updated = assemblySeats.find(
          (s) => s.constituency.id === inspectorSeat.constituency.id
        );
        if (updated) {
          const serialize = (s: any) =>
            `${s.politician?.id || "vacant"}-${s.party?.id || "none"}-${s.alliance?.id || "none"}`;
          if (serialize(updated) !== serialize(inspectorSeat)) {
            setInspectorSeat(updated);
          }
        } else {
          setInspectorSeat(null);
        }
      }
    }
  }, [assemblySeats]);

  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showManageHighCommandModal, setShowManageHighCommandModal] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [appointmentSearchQuery, setAppointmentSearchQuery] = useState("");

  const filteredParties = React.useMemo(
    () =>
      partiesList.filter(
        (p) =>
          !p.isSuspended &&
          (p.allianceId === "independent" || !p.allianceId) &&
          (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.abbreviation.toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [partiesList, searchQuery],
  );

  const filteredPersons = React.useMemo(
    () =>
      personsList.filter(
        (p) =>
          !p.isSuspended &&
          (p.partyId === "independent" || !p.partyId) &&
          p.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [personsList, searchQuery],
  );

  const filteredHighCommandEligible = React.useMemo(
    () =>
      (Array.isArray(personsEligibleForHighCommand)
        ? personsEligibleForHighCommand
        : []
      ).filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [personsEligibleForHighCommand, searchQuery],
  );

  const filteredAppointmentPersons = React.useMemo(() => {
    // Get IDs of all persons who are currently incumbents in some constituency in an ACTIVE assembly
    const occupiedSeats = constituenciesList
      .filter((c) => {
        if (!c.currentIncumbentId || c.currentIncumbentId === "vacant")
          return false;
        const assembly = assembliesList.find(
          (a) => a.id === c.currentAssemblyId,
        );
        return assembly?.isActive;
      })
      .map((c) => c.currentIncumbentId);

    return personsList.filter((p) => {
      // Exclude suspended/expired persons from new appointments
      if (p.isSuspended) return false;

      const matchesSearch = p.name
        .toLowerCase()
        .includes(appointmentSearchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // If we are appointing to a constituency, they must not already have a seat in an active assembly
      if (entityType === EntityType.CONSTITUENCY) {
        return !occupiedSeats.includes(p.id);
      }

      // If we are appointing to a designation, only show the persons who are already MLAs in this assembly
      if (entityType === EntityType.DESIGNATION && entity) {
        const design = entity as Designation;
        if (design.assemblyId) {
          const assemblyMembers = constituenciesList
            .filter(
              (c) =>
                c.currentAssemblyId === design.assemblyId &&
                c.currentIncumbentId &&
                c.currentIncumbentId !== "vacant",
            )
            .map((c) => c.currentIncumbentId);
          return assemblyMembers.includes(p.id);
        }
      }

      return true;
    });
  }, [
    personsList,
    appointmentSearchQuery,
    constituenciesList,
    assembliesList,
    entityType,
    entity,
  ]);

  const handleAddPartyToAlliance = async (partyId: string) => {
    if (isDissolvedRecord) {
      alert(
        "This alliance context belongs to a dissolved assembly and cannot be modified.",
      );
      return;
    }
    const p = partiesList.find((party) => party.id === partyId);
    confirmAction(
      "Join Alliance",
      `Are you sure you want to add ${p?.name || "this party"} to the alliance?`,
      async () => {
        await db.parties.update(partyId, {
          allianceId: id,
          updatedAt: Date.now(),
        });
        setShowAddPartyModal(false);
        setSearchQuery("");
      },
    );
  };

  const handleRemovePartyFromAlliance = async (partyId: string) => {
    if (isDissolvedRecord) {
      alert(
        "This alliance context belongs to a dissolved assembly and cannot be modified.",
      );
      return;
    }
    const p = partiesList.find((party) => party.id === partyId);
    confirmAction(
      "Leave Alliance",
      `Are you sure you want to remove ${p?.name || "this party"} from the alliance?`,
      async () => {
        await db.parties.update(partyId, {
          allianceId: "independent",
          updatedAt: Date.now(),
        });
      },
      true,
      "Remove Party",
    );
  };

  const handleAddPersonToParty = async (personId: string) => {
    if (isDissolvedRecord) {
      alert(
        "This party context belongs to a dissolved assembly and cannot be modified.",
      );
      return;
    }
    const p = personsList.find((person) => person.id === personId);
    confirmAction(
      "Add to Party",
      `Are you sure you want to add ${p?.name || "this person"} to the party?`,
      async () => {
        await db.persons.update(personId, {
          partyId: id,
          updatedAt: Date.now(),
        });
        setShowAddPersonModal(false);
        setSearchQuery("");
      },
    );
  };

  const handleRemovePersonFromParty = async (personId: string) => {
    if (isDissolvedRecord) {
      alert(
        "This party context belongs to a dissolved assembly and cannot be modified.",
      );
      return;
    }
    const p = personsList.find((person) => person.id === personId);
    confirmAction(
      "Remove Member",
      `Are you sure you want to remove ${p?.name || "this person"} from the party?`,
      async () => {
        await db.persons.update(personId, {
          partyId: "independent",
          updatedAt: Date.now(),
        });
      },
      true,
      "Remove Member",
    );
  };

  if (!entity)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Search size={48} className="mb-4 opacity-20" />
        <p>Entity not found or loading...</p>
        <button onClick={() => navigate("/")} className="mt-4 gold-text">
          Return to Dashboard
        </button>
      </div>
    );

  const handleDelete = async () => {
    confirmAction(
      "Permanent Deletion",
      "Are you ABSOLUTELY sure you want to PERMANENTLY DELETE this record? This action cannot be undone.",
      async () => {
        switch (entityType) {
          case EntityType.PERSON:
            await db.persons.delete(id!);
            break;
          case EntityType.PARTY:
            await db.parties.delete(id!);
            break;
          case EntityType.ALLIANCE:
            await db.alliances.delete(id!);
            break;
          case EntityType.ASSEMBLY:
            await db.assemblies.delete(id!);
            break;
          case EntityType.DESIGNATION:
            await db.designations.delete(id!);
            break;
          case EntityType.CONSTITUENCY:
            await db.constituencies.delete(id!);
            await reindexConstituencies();
            break;
        }
        navigate("/");
      },
      true,
      "Delete Permanently",
    );
  };

  const handlePromote = async () => {
    if (!showPromotePopup || !id || entityType !== EntityType.ASSEMBLY) return;

    // Dissolved assemblies are immutable
    if ((entity as Assembly).isActive === false) {
      alert("This assembly has been dissolved. Records cannot be modified.");
      return;
    }

    // Only elected MLAs of this assembly can be ministers
    const isMLA = assemblyMembers.some(
      (m) => m.id === showPromotePopup.personId,
    );
    if (!isMLA) {
      alert(
        "Only elected members (MLAs) of this assembly can be promoted to the cabinet.",
      );
      return;
    }

    confirmAction(
      "Ministerial Promotion",
      `Are you sure you want to promote ${showPromotePopup.personName} as Minister for ${departmentInput}?`,
      async () => {
        const { personId } = showPromotePopup;
        const person = await db.persons.get(personId);
        if (!person) return;

        const roleName = `Minister for ${departmentInput}`;
        const assemblyRoles = { ...(person.assemblyRoles || {}) };

        // Prevent duplicate promotion record if they already have this EXACT role name in this assembly
        const alreadyHasHistory = (person.roleHistory || []).some(
          (h) =>
            h.assemblyId === id &&
            h.role === roleName &&
            h.action === "promotion",
        );

        // Update active roles - handle multiple roles if they already have one
        const existingRoles = assemblyRoles[id]
          ? assemblyRoles[id].split(", ")
          : [];
        if (!existingRoles.includes(roleName)) {
          existingRoles.push(roleName);
        }
        assemblyRoles[id] = existingRoles.join(", ");

        const updateData: any = {
          assemblyRoles,
          updatedAt: Date.now(),
        };

        if (!alreadyHasHistory) {
          updateData.roleHistory = [
            ...(person.roleHistory || []),
            {
              role: roleName,
              assemblyId: id,
              date: Date.now(),
              action: "promotion" as const,
            },
          ];
        }

        await db.persons.update(personId, updateData);

        setShowPromotePopup(null);
        setDepartmentInput("");
      },
    );
  };

  // Check if current view is immutable due to assembly dissolution
  const isDissolvedRecord = (() => {
    if (!entity) return false;
    if (entityType === EntityType.ASSEMBLY)
      return (entity as Assembly).isActive === false;
    if (entityType === EntityType.CONSTITUENCY) {
      const associatedAsm = assembliesList.find(
        (a) => a.id === (entity as Constituency).currentAssemblyId,
      );
      return associatedAsm?.isActive === false;
    }
    if (entityType === EntityType.DESIGNATION) {
      const associatedAsm = assembliesList.find(
        (a) => a.id === (entity as Designation).assemblyId,
      );
      return associatedAsm?.isActive === false;
    }
    return false;
  })();

  const handleDeactivate = async () => {
    if (entityType === EntityType.ASSEMBLY) {
      confirmAction(
        "Dissolve Assembly",
        "Are you absolutely sure you want to dissolve this assembly? This will freeze all current roles and composition states as historical data.",
        async () => {
          const now = Date.now();

          // Snapshot the current composition and seatingLayout perfectly
          await freezeAssembly(id!);

          await db.assemblies.update(id!, {
            isActive: false,
            updatedAt: now,
          });

          // Map to track person updates to avoid duplicates
          const personUpdates = new Map<
            string,
            { roles: string[]; history: any[] }
          >();

          // Process Designations
          const relatedDesignations = await db.designations
            .where("assemblyId")
            .equals(id!)
            .toArray();
          for (const d of relatedDesignations) {
            if (d.incumbentId !== "vacant") {
              if (!personUpdates.has(d.incumbentId)) {
                const person = await db.persons.get(d.incumbentId);
                if (person) {
                  personUpdates.set(d.incumbentId, {
                    roles:
                      person.assemblyRoles && person.assemblyRoles[id!]
                        ? person.assemblyRoles[id!].split(", ")
                        : [],
                    history: person.roleHistory || [],
                  });
                }
              }

              // Designation history
              await db.designations.update(d.id, {
                history: [
                  ...(d.history || []),
                  { personId: d.incumbentId, reason: "expiry", date: now },
                ],
                updatedAt: now,
              });
            }
          }

          // Process Constituencies
          const relatedConstituencies = await db.constituencies
            .where("currentAssemblyId")
            .equals(id!)
            .toArray();
          for (const con of relatedConstituencies) {
            if (con.currentIncumbentId !== "vacant") {
              if (!personUpdates.has(con.currentIncumbentId)) {
                const person = await db.persons.get(con.currentIncumbentId);
                if (person) {
                  personUpdates.set(con.currentIncumbentId, {
                    roles:
                      person.assemblyRoles && person.assemblyRoles[id!]
                        ? person.assemblyRoles[id!].split(", ")
                        : [],
                    history: person.roleHistory || [],
                  });
                }
              }

              // Constituency history
              await db.constituencies.update(con.id, {
                history: [
                  ...(con.history || []),
                  {
                    personId: con.currentIncumbentId,
                    assemblyId: id!,
                    date: now,
                    reason: "expiry",
                  },
                ],
                updatedAt: now,
              });
            }
          }

          // Apply grouped updates to persons
          for (const [personId, data] of personUpdates.entries()) {
            const person = await db.persons.get(personId);
            if (!person) continue;

            const newAssemblyRoles = { ...person.assemblyRoles };
            const expiringRoles = data.roles;
            delete newAssemblyRoles[id!];

            const newHistory = [...data.history];
            for (const role of expiringRoles) {
              // Only add if not already added for this date/role/action
              const alreadyAdded = newHistory.some(
                (h) =>
                  h.role === role && h.date === now && h.action === "expiry",
              );
              if (!alreadyAdded) {
                newHistory.push({
                  role,
                  assemblyId: id!,
                  date: now,
                  action: "expiry" as const,
                });
              }
            }

            await db.persons.update(personId, {
              assemblyRoles: newAssemblyRoles,
              roleHistory: newHistory,
              updatedAt: now,
            });
          }

          setShowDeactivatePopup(false);
        },
        true,
        "Dissolve Assembly",
      );
    }
  };

  const handleSuspendPerson = async () => {
    if (entityType !== EntityType.PERSON || !entity) return;
    const person = entity as Person;
    
    confirmAction(
      "Suspend Politician",
      `Are you sure you want to suspend ${person.name}? This will mark them as suspended/expired, vacate all their active seats, designations, and governance roles, and keep them strictly as historical records.`,
      async () => {
        const now = Date.now();
        const pId = person.id;
        console.log("SUSPENSION ID:", pId);

        // Fetch fresh person record to avoid any race conditions
        const pRecord = await db.persons.get(pId);
        if (!pRecord) {
          throw new Error(`Person with ID ${pId} not found in database.`);
        }

        let assemblyRoles = { ...(pRecord.assemblyRoles || {}) };
        let roleHistory = [ ...(pRecord.roleHistory || []) ];

        // 1. Find and vacate all active designations where they are currently the incumbent
        console.log("Vacating designations...");
        const designationsListLocal = await db.designations.where("incumbentId").equals(pId).toArray();
        for (const d of designationsListLocal) {
          const dHistory = d.history || [];
          await db.designations.update(d.id, {
            incumbentId: "vacant",
            history: [
              ...dHistory,
              { personId: pId, reason: "expiry", date: now }
            ],
            updatedAt: now
          });

          if (d.assemblyId) {
            const existingList = (assemblyRoles[d.assemblyId] || "").split(", ").map(r => r.trim()).filter(Boolean);
            const newList = existingList.filter(r => r !== d.name);
            if (newList.length === 0) {
              delete assemblyRoles[d.assemblyId];
            } else {
              assemblyRoles[d.assemblyId] = newList.join(", ");
            }

            roleHistory.push({
              role: d.name,
              assemblyId: d.assemblyId,
              date: now,
              action: "expiry" as const
            });
          }
        }

        // 2. Find and vacate all active constituency seats where they are the current incumbent
        console.log("Vacating constituency seats...");
        const constituenciesListLocal = await db.constituencies.where("currentIncumbentId").equals(pId).toArray();
        for (const con of constituenciesListLocal) {
          const conHistory = con.history || [];
          await db.constituencies.update(con.id, {
            currentIncumbentId: "vacant",
            history: [
              ...conHistory,
              {
                personId: pId,
                assemblyId: con.currentAssemblyId || "unknown",
                date: now,
                reason: "Expired"
              }
            ],
            updatedAt: now
          });

          if (con.currentAssemblyId) {
            const assembly = await db.assemblies.get(con.currentAssemblyId);
            if (assembly && assembly.independentSupports && assembly.independentSupports[pId]) {
              const supports = { ...assembly.independentSupports };
              delete supports[pId];
              await db.assemblies.update(con.currentAssemblyId, {
                independentSupports: supports,
                updatedAt: now
              });
            }

            const mlaRoleName = `MLA for ${con.name}`;
            const existingList = (assemblyRoles[con.currentAssemblyId] || "").split(", ").map(r => r.trim()).filter(Boolean);
            const newList = existingList.filter(r => r !== mlaRoleName);
            if (newList.length === 0) {
              delete assemblyRoles[con.currentAssemblyId];
            } else {
              assemblyRoles[con.currentAssemblyId] = newList.join(", ");
            }

            roleHistory.push({
              role: mlaRoleName,
              assemblyId: con.currentAssemblyId,
              date: now,
              action: "expiry" as const
            });
          }
        }

        // 3. Find and vacate any active assembly leaders positions where they hold the role
        console.log("Vacating assembly leader positions...");
        const activeAssemblies = await db.assemblies.toArray();
        for (const asm of activeAssemblies) {
          if (asm.leaders) {
            const updatedLeaders = { ...asm.leaders };
            let updated = false;
            for (const [key, value] of Object.entries(asm.leaders)) {
              if (value === pId) {
                (updatedLeaders as any)[key] = "vacant";
                updated = true;

                const displayName = key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase());
                
                const existingList = (assemblyRoles[asm.id] || "").split(", ").map(r => r.trim()).filter(Boolean);
                const newList = existingList.filter(r => r !== displayName);
                if (newList.length === 0) {
                  delete assemblyRoles[asm.id];
                } else {
                  assemblyRoles[asm.id] = newList.join(", ");
                }

                roleHistory.push({
                  role: displayName,
                  assemblyId: asm.id,
                  date: now,
                  action: "expiry" as const
                });
              }
            }
            if (updated) {
              await db.assemblies.update(asm.id, {
                leaders: updatedLeaders,
                updatedAt: now
              });
            }
          }
        }

        // 4. Finally, write the updated person record to database with isSuspended: true
        console.log("Writing final suspended status to person...");
        await db.persons.update(pId, {
          isSuspended: true,
          assemblyRoles,
          roleHistory,
          updatedAt: now
        });
        console.log("Suspension fully complete!");
      },
      true,
      "Suspend"
    );
  };

  const handleSuspendParty = async () => {
    if (entityType !== EntityType.PARTY || !entity) return;
    const party = entity as Party;
    
    confirmAction(
      "Suspend Political Party",
      `Are you sure you want to suspend ${party.name}? This will mark the party as suspended and freeze its active statuses, keeping it strictly as a historical record.`,
      async () => {
        const now = Date.now();
        const pId = party.id;
        console.log("PARTY SUSPENSION ID:", pId);

        const pRecord = await db.parties.get(pId);
        if (!pRecord) {
          throw new Error(`Party with ID ${pId} not found in database.`);
        }

        console.log("Writing final suspended status to party...");
        await db.parties.update(pId, {
          isSuspended: true,
          updatedAt: now
        });
        console.log("Party suspension fully complete!");
      },
      true,
      "Suspend"
    );
  };

  const removeIncumbent = async (reason: "expiry" | "resignation") => {
    if (entityType === EntityType.DESIGNATION) {
      confirmAction(
        "Vacate Seat",
        `Are you sure you want to remove the incumbent due to ${reason}?`,
        async () => {
          const design = entity as Designation;
          const now = Date.now();
          const historyEntry = {
            personId: design.incumbentId,
            reason,
            date: now,
          };

          // If this designation is tied to an assembly or has a custom id, remove the person's role too
          if (design.incumbentId !== "vacant") {
            const person = await db.persons.get(design.incumbentId);
            const targetKey = design.assemblyId || id!;
            if (
              person &&
              person.assemblyRoles &&
              person.assemblyRoles[targetKey]
            ) {
              const roleName = design.name;
              const assemblyRoles = { ...(person.assemblyRoles || {}) };

              // Only remove the specific role from the comma-separated list
              const existingRoles =
                assemblyRoles[targetKey].split(", ");
              const newRolesList = existingRoles.filter((r) => r !== roleName);

              if (newRolesList.length === 0) {
                delete assemblyRoles[targetKey];
              } else {
                assemblyRoles[targetKey] = newRolesList.join(", ");
              }

              // Prevent duplicate history entry
              const alreadyHasHistory = (person.roleHistory || []).some(
                (h) =>
                  h.role === roleName &&
                  h.assemblyId === targetKey &&
                  h.action === reason &&
                  Math.abs(h.date - now) < 2000,
              );

              const updateData: any = {
                assemblyRoles,
                updatedAt: now,
              };

              if (!alreadyHasHistory) {
                updateData.roleHistory = [
                  ...(person.roleHistory || []),
                  {
                    role: roleName,
                    assemblyId: targetKey,
                    date: now,
                    action: reason as "resignation" | "expiry",
                  },
                ];
              }

              await db.persons.update(person.id, updateData);
            }
          }

          await db.designations.update(id!, {
            incumbentId: "vacant",
            history: [
              ...(Array.isArray(design.history) ? design.history : []),
              historyEntry,
            ],
          });
          setShowDeletePopup(false);
        },
        true,
        "Vacate Seat",
      );
    }
  };

  const closeAppointPopup = () => {
    setShowAppointPopup(false);
    setAppointmentSearchQuery("");
  };

  const handleDemoteMinister = async (
    personId: string,
    roleToRemove: string,
  ) => {
    if (!id || !entity) return;

    // Dissolved assemblies are immutable
    if (
      entityType === EntityType.ASSEMBLY &&
      (entity as Assembly).isActive === false
    ) {
      alert(
        "This assembly has been dissolved. Cabinet changes are prohibited.",
      );
      return;
    }
    confirmAction(
      "Confirm Demotion",
      `Are you sure you want to remove the role "${roleToRemove}" from this person?`,
      async () => {
        const person = await db.persons.get(personId);
        if (!person) return;

        // 1. Handle assemblyRoles (Ministers)
        const assemblyRoles = { ...(person.assemblyRoles || {}) };
        const existingRolesList = (assemblyRoles[id!] || "").split(", ");
        const newRolesList = existingRolesList.filter(
          (r) => r !== roleToRemove,
        );

        const now = Date.now();
        const roleHistory = [
          ...(person.roleHistory || []),
          {
            role: roleToRemove,
            assemblyId: id!,
            date: now,
            action: "resignation" as const,
          },
        ];

        const updateData: any = {
          roleHistory,
          updatedAt: now,
        };

        if (newRolesList.length === 0) {
          delete assemblyRoles[id!];
        } else {
          assemblyRoles[id!] = newRolesList.join(", ");
        }
        updateData.assemblyRoles = assemblyRoles;

        await db.persons.update(personId, updateData);

        // 2. Handle Designations (Speaker, Chief Secretary, etc.)
        const designations = await db.designations
          .where("assemblyId")
          .equals(id!)
          .and((d) => d.name === roleToRemove && d.incumbentId === personId)
          .toArray();

        for (const d of designations) {
          await db.designations.update(d.id, {
            incumbentId: "vacant",
            updatedAt: now,
          });
        }
      },
      true,
      "Demote",
    );
  };

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDestructive = false,
    confirmText = "Confirm",
  ) => {
    setConfirmationDialog({
      show: true,
      title,
      message,
      onConfirm,
      isDestructive,
      confirmText,
    });
  };

  const handleSelectAppointedPerson = async (personId: string) => {
    if (!id || !entity) return;

    // Dissolved assemblies are immutable
    if (entityType === EntityType.DESIGNATION) {
      const design = entity as Designation;
      if (design.assemblyId) {
        const associatedAsm = assembliesList.find(
          (a) => a.id === design.assemblyId,
        );
        if (associatedAsm?.isActive === false) {
          alert(
            "This designation belongs to a dissolved assembly and cannot be modified.",
          );
          return;
        }

        // Only elected MLAs of this assembly can hold leadership designations
        // We need to fetch members of the assembly associated with this designation
        const asmMembers = await db.persons
          .filter((p) => {
            return constituenciesList.some(
              (c) =>
                c.currentAssemblyId === design.assemblyId &&
                c.currentIncumbentId === p.id,
            );
          })
          .toArray();

        if (!asmMembers.some((m) => m.id === personId)) {
          alert(
            "Only elected members (MLAs) of this assembly can be appointed to these roles.",
          );
          return;
        }
      }
    } else if (entityType === EntityType.CONSTITUENCY) {
      const con = entity as Constituency;
      const associatedAsm = assembliesList.find(
        (a) => a.id === con.currentAssemblyId,
      );
      if (associatedAsm?.isActive === false) {
        alert(
          "This constituency record belongs to a dissolved assembly and cannot be modified.",
        );
        return;
      }
    }

    const p = personsList.find((person) => person.id === personId);
    const personName = p?.name || "this person";

    if (entityType === EntityType.DESIGNATION) {
      confirmAction(
        "Confirm Appointment",
        `Are you sure you want to appoint ${personName} to this designation?`,
        async () => {
          const design = entity as Designation;
          const now = Date.now();

          // Update person's role and history
          const person = await db.persons.get(personId);
          if (person && id) {
            const roleName = design.name;
            const assemblyRoles = { ...(person.assemblyRoles || {}) };

            const existingRoles = assemblyRoles[id]
              ? assemblyRoles[id].split(", ")
              : [];
            if (!existingRoles.includes(roleName)) {
              existingRoles.push(roleName);
            }
            assemblyRoles[id] = existingRoles.join(", ");

            // Prevent duplicate history entry
            const alreadyHasHistory = (person.roleHistory || []).some(
              (h) =>
                h.role === roleName &&
                h.assemblyId === id &&
                h.action === "promotion",
            );

            const updateData: any = {
              assemblyRoles,
              updatedAt: now,
            };

            if (!alreadyHasHistory) {
              updateData.roleHistory = [
                ...(person.roleHistory || []),
                {
                  role: roleName,
                  assemblyId: id,
                  date: now,
                  action: "promotion" as const,
                },
              ];
            }

            await db.persons.update(personId, updateData);
          }

          await db.designations.update(id!, {
            incumbentId: personId,
            history: [
              ...(Array.isArray(design.history) ? design.history : []),
              {
                personId,
                reason: "appointment",
                date: now,
              },
            ],
            updatedAt: now,
          });
          closeAppointPopup();
        },
      );
    } else if (entityType === EntityType.CONSTITUENCY) {
      // Rule: Person can only hold one MLA seat at a time in active assemblies
      const alreadyHasSeat = constituenciesList.find((c) => {
        if (c.id === id) return false; // Ignore current constituency
        if (
          c.currentIncumbentId === personId &&
          c.currentIncumbentId !== "vacant"
        ) {
          const assembly = assembliesList.find(
            (a) => a.id === c.currentAssemblyId,
          );
          return assembly?.isActive;
        }
        return false;
      });

      if (alreadyHasSeat) {
        const otherAssembly = assembliesList.find(
          (a) => a.id === alreadyHasSeat.currentAssemblyId,
        );
        alert(
          `${personName} already holds a seat in ${alreadyHasSeat.name}${otherAssembly ? ` (${otherAssembly.name})` : ""}. They must resign from that seat first.`,
        );
        return;
      }

      confirmAction(
        "Confirm Appointment",
        `Are you sure you want to appoint ${personName} to this constituency?`,
        async () => {
          const con = entity as Constituency;
          const currentAsm = con.currentAssemblyId;
          const now = Date.now();

          // Update person's role and history
          const person = await db.persons.get(personId);
          if (person && currentAsm) {
            const roleName = `MLA for ${con.name}`;
            const assemblyRoles = { ...(person.assemblyRoles || {}) };

            const existingRoles = assemblyRoles[currentAsm]
              ? assemblyRoles[currentAsm].split(", ")
              : [];
            if (!existingRoles.includes(roleName)) {
              existingRoles.push(roleName);
            }
            assemblyRoles[currentAsm] = existingRoles.join(", ");

            // Prevent duplicate history entry
            const alreadyHasHistory = (person.roleHistory || []).some(
              (h) =>
                h.role === roleName &&
                h.assemblyId === currentAsm &&
                h.action === "promotion",
            );

            const updateData: any = {
              assemblyRoles,
              updatedAt: now,
            };

            if (!alreadyHasHistory) {
              updateData.roleHistory = [
                ...(person.roleHistory || []),
                {
                  role: roleName,
                  assemblyId: currentAsm,
                  date: now,
                  action: "promotion" as const,
                },
              ];
            }

            await db.persons.update(personId, updateData);
          }

          await db.constituencies.update(id!, {
            currentIncumbentId: personId,
            history: [
              ...(Array.isArray(con.history) ? con.history : []),
              {
                personId,
                assemblyId: currentAsm || "unknown",
                date: now,
                reason: "appointment",
              },
            ],
            updatedAt: now,
          });
          closeAppointPopup();
        },
      );
    }
  };

  const removeConstituencyIncumbent = async (reason: string) => {
    if (entityType === EntityType.CONSTITUENCY) {
      // Dissolved assemblies are immutable
      const con = entity as Constituency;
      const associatedAsm = assembliesList.find(
        (a) => a.id === con.currentAssemblyId,
      );
      if (associatedAsm?.isActive === false) {
        alert(
          "This record belongs to a dissolved assembly and cannot be modified.",
        );
        return;
      }

      const now = Date.now();
      if (con.currentIncumbentId !== "vacant" && con.currentAssemblyId) {
        // Discard independent support mapping when MLA is removed from seat
        const assembly = await db.assemblies.get(con.currentAssemblyId);
        if (
          assembly &&
          assembly.independentSupports &&
          assembly.independentSupports[con.currentIncumbentId]
        ) {
          const supports = { ...assembly.independentSupports };
          delete supports[con.currentIncumbentId];
          await db.assemblies.update(con.currentAssemblyId, {
            independentSupports: supports,
          });
        }

        const person = await db.persons.get(con.currentIncumbentId);
        if (
          person &&
          person.assemblyRoles &&
          person.assemblyRoles[con.currentAssemblyId]
        ) {
          const roleName = `MLA for ${con.name}`;
          const assemblyRoles = { ...(person.assemblyRoles || {}) };

          // Only remove the specific MLA role
          const existingRoles =
            assemblyRoles[con.currentAssemblyId].split(", ");
          const newRolesList = existingRoles.filter((r) => r !== roleName);

          if (newRolesList.length === 0) {
            delete assemblyRoles[con.currentAssemblyId];
          } else {
            assemblyRoles[con.currentAssemblyId] = newRolesList.join(", ");
          }

          // Prevent duplicate history entry
          const alreadyHasHistory = (person.roleHistory || []).some(
            (h) =>
              h.role === roleName &&
              h.assemblyId === con.currentAssemblyId &&
              h.action === (reason === "Expired" ? "expiry" : "resignation") &&
              Math.abs(h.date - now) < 2000,
          );

          const updateData: any = {
            assemblyRoles,
            updatedAt: now,
          };

          if (!alreadyHasHistory) {
            updateData.roleHistory = [
              ...(person.roleHistory || []),
              {
                role: roleName,
                assemblyId: con.currentAssemblyId,
                date: now,
                action: (reason === "Expired" ? "expiry" : "resignation") as
                  | "expiry"
                  | "resignation",
              },
            ];
          }

          await db.persons.update(person.id, updateData);
        }
      }
      await db.constituencies.update(id!, {
        currentIncumbentId: "vacant",
        history: [
          ...(Array.isArray(con.history) ? con.history : []),
          {
            personId: con.currentIncumbentId,
            assemblyId: con.currentAssemblyId || "unknown",
            date: now,
            reason: reason,
          },
        ],
        updatedAt: now,
      });
      setShowDeletePopup(false);
      setShowVacateMlaReasonModal(false);
    }
  };

  const handleBack = () => {
    try {
      let canGoBack = false;
      try {
        if (window.history && window.history.length > 1) {
          const hState = window.history.state;
          if (!hState || hState.idx > 0 || hState.key !== "default") {
            canGoBack = true;
          }
        }
      } catch (historyErr) {
        console.warn("History API access warning:", historyErr);
      }

      if (canGoBack) {
        navigate(-1);
      } else {
        if (entityType === EntityType.ASSEMBLY) {
          navigate("/assemblies");
        } else if (entityType === EntityType.PERSON) {
          navigate("/persons");
        } else if (entityType === EntityType.PARTY) {
          navigate("/parties");
        } else if (entityType === EntityType.ALLIANCE) {
          navigate("/alliances");
        } else if (entityType === EntityType.CONSTITUENCY) {
          navigate("/constituencies");
        } else if (entityType === EntityType.DESIGNATION) {
          navigate("/designations");
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      console.error("Back navigation failed, falling back to root:", err);
      try {
        navigate("/");
      } catch (e) {
        window.location.hash = "/";
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="uppercase tracking-widest font-bold text-xs">
            Back
          </span>
        </button>
        <div className="flex items-center gap-3">
          {entityType === EntityType.PERSON && !(entity as Person).isSuspended && (
            <button
              onClick={handleSuspendPerson}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/30 rounded-xl text-red-500 border border-red-500/20 transition-all font-bold text-xs uppercase tracking-widest"
              id="suspend-person-btn"
            >
              <UserMinus size={16} />
              <span>Suspend</span>
            </button>
          )}
          {entityType === EntityType.PARTY && !(entity as Party).isSuspended && (
            <button
              onClick={handleSuspendParty}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/30 rounded-xl text-red-500 border border-red-500/20 transition-all font-bold text-xs uppercase tracking-widest"
              id="suspend-party-btn"
            >
              <UserMinus size={16} />
              <span>Suspend</span>
            </button>
          )}
          {!isDissolvedRecord && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 rounded-xl text-[#FFD700] border border-[#FFD700]/20 transition-all font-bold text-xs uppercase tracking-widest"
            >
              <Edit size={16} />
              <span>Modify Entry</span>
            </button>
          )}
          {entityType === EntityType.ASSEMBLY &&
            (entity as Assembly).isActive !== false && (
              <button
                onClick={() => setShowDeactivatePopup(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 rounded-xl text-orange-500 border border-orange-500/20 transition-all font-bold text-xs uppercase tracking-widest"
              >
                <HistoryIcon size={16} />
                <span>End Term</span>
              </button>
            )}
          <button
            onClick={() => setShowDeletePopup(true)}
            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 border border-red-500/10 transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Hero Profile Block */}
      <section className="glass-card overflow-hidden">
        <div
          className={`h-1 ${entityType === EntityType.ASSEMBLY ? "bg-[#FFD700]" : "bg-[#D32F2F]"}`}
        />
        <div className="p-8 md:p-12 flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
          {/* Image/Avatar */}
          <div className="relative">
            <div className="w-48 h-48 rounded-[2rem] overflow-hidden border-4 border-[#FFD700]/20 shadow-2xl shadow-black">
              {"imageUrl" in entity || "logoUrl" in entity ? (
                <img
                  src={(entity as any).imageUrl || (entity as any).logoUrl}
                  className="w-full h-full object-cover"
                  alt="Profile"
                />
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center text-[#FFD700]">
                  {entityType === EntityType.DESIGNATION ? (
                    <Award size={80} />
                  ) : (
                    <Landmark size={80} />
                  )}
                </div>
              )}
            </div>
            <div className="absolute -bottom-4 -right-4 p-4 bg-[#D32F2F] rounded-2xl shadow-xl">
              {entityType === EntityType.PERSON ? (
                <User size={24} />
              ) : entityType === EntityType.PARTY ? (
                <Flag size={24} />
              ) : entityType === EntityType.ALLIANCE ? (
                <Shield size={24} />
              ) : entityType === EntityType.CONSTITUENCY ? (
                <MapPin size={24} />
              ) : (
                <Landmark size={24} />
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                <span className="text-[10px] bg-[#FFD700]/10 text-[#FFD700] px-3 py-1.5 rounded-lg border border-[#FFD700]/20 font-black uppercase tracking-[0.3em]">
                  {entityType === EntityType.PERSON
                    ? "Politician"
                    : entityType === EntityType.PARTY
                      ? "Political Party"
                      : entityType === EntityType.ALLIANCE
                        ? "Political Alliance"
                        : entityType === EntityType.ASSEMBLY
                          ? "Legislative Body"
                          : "Government Post"}
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight mb-2">
                {(entity as any).name}
                {entityType === EntityType.PERSON && (entity as Person).isSuspended && (
                  <span className="ml-4 text-sm bg-red-600/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 align-middle tracking-wider font-extrabold uppercase">
                    SUSPENDED
                  </span>
                )}
                {entityType === EntityType.PARTY && (entity as Party).isSuspended && (
                  <span className="ml-4 text-sm bg-red-600/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 align-middle tracking-wider font-extrabold uppercase">
                    SUSPENDED
                  </span>
                )}
                {(entity as any).isActive === false && (
                  <span className="ml-4 text-sm bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full border border-white/5 align-middle">
                    DISSOLVED
                  </span>
                )}
              </h1>

              {entityType === EntityType.ALLIANCE && leadingParty && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    Leading Party:
                  </span>
                  <span
                    onClick={() => navigate(`/party/${leadingParty.id}`)}
                    className="px-3 py-1 bg-[#D32F2F]/10 text-[#D32F2F] border border-[#D32F2F]/20 rounded-lg text-xs font-black uppercase cursor-pointer hover:bg-[#D32F2F]/20 transition-all"
                  >
                    {leadingParty.name} ({leadingParty.abbreviation})
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-gray-400 font-medium">
                {entityType === EntityType.PERSON && (
                  <>
                    <span className="flex items-center gap-2">
                      <User size={16} />{" "}
                      {(entity as Person).gender || "Not Specified"}
                    </span>
                    <span
                      onClick={() =>
                        (entity as Person).partyId !== "independent" &&
                        navigate(`/party/${(entity as Person).partyId}`)
                      }
                      className="flex items-center gap-2 hover:text-[#FFD700] cursor-pointer"
                    >
                      <Flag size={16} />{" "}
                      {(entity as Person).partyId === "independent"
                        ? "Independent"
                        : personParty?.name || "Political Party"}
                    </span>
                    {activeRoles && activeRoles.length > 0 && (
                      <span className="flex items-center gap-2 text-[#FFD700] bg-[#FFD700]/5 px-3 py-1 rounded-full border border-[#FFD700]/10 font-bold uppercase tracking-widest text-[10px]">
                        <Award size={14} />{" "}
                        {formatCommaSeparatedRoles(
                          activeRoles.map((r) => r.name).join(", "),
                        )}
                      </span>
                    )}
                  </>
                )}
                {entityType === EntityType.DESIGNATION && (
                  <span className="flex items-center gap-2">
                    <MapPin size={16} /> {(entity as Designation).constituency}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <Calendar size={16} />
                  {(() => {
                    const dateVal = entity.updatedAt;
                    const isValidDate =
                      dateVal && !isNaN(new Date(dateVal).getTime());
                    if (isValidDate) {
                      return `Updated ${new Date(dateVal).toLocaleDateString()}`;
                    }
                    if (entityType === EntityType.PERSON) {
                      const person = entity as Person;
                      const cName =
                        person.constituencyName ||
                        constituenciesList.find(
                          (c) => c.currentIncumbentId === person.id,
                        )?.name;
                      if (cName) {
                        return `MLA for ${cName}`;
                      }
                    }
                    return "Legislative Record";
                  })()}
                </span>
                {entityType === EntityType.PARTY && (
                  <span className="flex items-center gap-2 text-[#FFD700]">
                    <Users size={16} /> {relatedPersons?.length || 0} Affiliated
                    Members
                  </span>
                )}
              </div>

              {entityType === EntityType.PERSON && (() => {
                const person = entity as Person;
                const displayRoles = activeRoles.filter((role) => {
                  const nameLower = role.name.toLowerCase();
                  const conNameLower = person.constituencyName?.toLowerCase() || "";
                  if (nameLower.includes("mla")) return false;
                  if (conNameLower && nameLower === conNameLower) return false;
                  if (conNameLower && nameLower.includes(conNameLower) && !nameLower.includes("minister")) return false;
                  if (nameLower === "special role") return false;
                  return true;
                });

                if (displayRoles.length === 0) return null;

                return (
                  <div className="mx-auto mt-4 flex max-w-md flex-col gap-3 rounded-2xl border border-[#FFD700]/10 bg-white/5 p-4 justify-center md:mx-0 md:justify-start items-center md:items-start w-full">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <Award size={14} className="text-[#FFD700]" />
                      <span>Active Legislative Structure</span>
                    </div>
                    <div className="w-full space-y-3">
                      {displayRoles.map((role, idx) => {
                        const isSilver = role.name.toLowerCase().includes("opposition");
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col border-l-2 py-1 pl-4 items-center md:items-start w-full ${isSilver ? "border-slate-400/40" : "border-[#FFD700]/40"}`}
                          >
                            <span className={`text-lg font-black leading-tight uppercase tracking-wider ${isSilver ? "silver-text" : "text-[#FFD700]"}`}>
                              {prefixRole(role.name)}
                            </span>
                            {role.assemblyName && (
                              <span className={`mt-1.5 font-mono text-[10px] leading-tight uppercase tracking-widest ${isSilver ? "text-slate-300/60" : "text-[#FFD700]/60"}`}>
                                {role.assemblyName}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {(entityType === EntityType.DESIGNATION ||
              entityType === EntityType.CONSTITUENCY) && (
              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                    {entityType === EntityType.CONSTITUENCY ? "Elected MLA" : "Current Incumbent"}
                  </h3>
                  {entityType === EntityType.CONSTITUENCY ? (
                    !isDissolvedRecord && (
                      <button
                        onClick={() => setShowElectModal(true)}
                        className="flex items-center gap-2 text-xs gold-text hover:underline uppercase font-bold cursor-pointer"
                      >
                        <Vote size={14} /> Elect MLA
                      </button>
                    )
                  ) : (
                    (entity as Designation).incumbentId !== "vacant"
                      ? !isDissolvedRecord && (
                          <button
                            onClick={() => setShowDeletePopup(true)}
                            className="flex items-center gap-2 text-xs text-red-500 hover:underline uppercase font-bold"
                          >
                            <UserMinus size={14} /> Remove Incumbent
                          </button>
                        )
                      : !isDissolvedRecord && (
                          <button
                            onClick={() => setShowAppointPopup(true)}
                            className="flex items-center gap-2 text-xs gold-text hover:underline uppercase font-bold"
                          >
                            <UserPlus size={14} /> Appoint Member
                          </button>
                        )
                  )}
                </div>
                {(entityType === EntityType.DESIGNATION
                  ? (entity as Designation).incumbentId
                  : (entity as Constituency).currentIncumbentId) !==
                "vacant" ? (
                  <div
                    onClick={() =>
                      navigate(
                        `/person/${entityType === EntityType.DESIGNATION ? (entity as Designation).incumbentId : (entity as Constituency).currentIncumbentId}`,
                      )
                    }
                    className="bg-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 cursor-pointer transition-all border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center text-[#FFD700]">
                        <User size={24} />
                      </div>
                      <div>
                        <p className="font-bold">
                          {currentIncumbentPerson
                            ? currentIncumbentPerson.name
                            : "Managed by Member"}
                        </p>
                        <p className="text-xs text-gray-400 uppercase tracking-widest">
                          Linked ID:{" "}
                          {entityType === EntityType.DESIGNATION
                            ? (entity as Designation).incumbentId
                            : (entity as Constituency).currentIncumbentId}
                        </p>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-gray-600" />
                  </div>
                ) : (
                  <div className="bg-red-500/5 rounded-2xl p-8 text-center border border-dashed border-red-500/20">
                    <p className="text-red-500 font-black uppercase tracking-widest">
                      POSITION VACANT
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Official seat is currently awaiting appointment.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs Selector */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl w-fit border border-white/10">
        <button
          onClick={() => setActiveTab("details")}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "details" ? "bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20" : "text-gray-400 hover:text-white"}`}
        >
          DETAILS
        </button>
        {(entityType === EntityType.PARTY ||
          entityType === EntityType.ALLIANCE ||
          entityType === EntityType.ASSEMBLY ||
          entityType === EntityType.CONSTITUENCY) && (
          <button
            onClick={() => setActiveTab("related")}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "related" ? "bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20" : "text-gray-400 hover:text-white"}`}
          >
            {entityType === EntityType.ASSEMBLY
              ? "LEADERSHIP"
              : entityType === EntityType.CONSTITUENCY
                ? "SESSIONS"
                : "RELATIONS"}
          </button>
        )}
        {(entityType === EntityType.DESIGNATION ||
          entityType === EntityType.ASSEMBLY ||
          entityType === EntityType.PERSON) && (
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "history" ? "bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20" : "text-gray-400 hover:text-white"}`}
          >
            HISTORY
          </button>
        )}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "details" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {entityType === EntityType.CONSTITUENCY && (
                  <section className="glass-card p-6 sm:p-8 border border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-xl font-black uppercase text-white tracking-wider flex items-center gap-2">
                          <Vote size={22} className="text-[#FFD700]" /> Recent Election Results
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Electoral breakdown and vote tally for {(entity as Constituency).name} constituency
                        </p>
                      </div>
                      {!isDissolvedRecord && (
                        <button
                          onClick={() => setShowElectModal(true)}
                          className="px-5 py-2.5 bg-[#FFD700] text-black font-black text-xs uppercase tracking-wider rounded-xl hover:bg-[#ffe234] transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-[#FFD700]/10"
                        >
                          <Vote size={16} /> ELECT / CONDUCT ELECTION
                        </button>
                      )}
                    </div>

                    {(() => {
                      const con = entity as Constituency;
                      if (!con.lastElectionResult) {
                        return (
                          <div className="p-8 text-center rounded-xl bg-[#141416] border border-zinc-800 my-4 space-y-2">
                            <p className="text-base font-bold text-zinc-300 uppercase tracking-wider">
                              New Constituency - No Election Data Found
                            </p>
                            <p className="text-xs text-zinc-500">
                              No recent election results are recorded for this constituency yet. Click &quot;ELECT / CONDUCT ELECTION&quot; above to declare an election winner.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <ElectionResultsTable
                          result={con.lastElectionResult}
                          onPersonClick={(personId) => navigate(`/person/${personId}`)}
                        />
                      );
                    })()}
                  </section>
                )}

                {entityType === EntityType.ASSEMBLY &&
                  (precededByAssembly || followedByAssembly) && (
                    <section className="glass-card p-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[#FFD700] mb-6">
                        Assembly Succession
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {precededByAssembly && (
                          <div
                            onClick={() =>
                              navigate(`/assembly/${precededByAssembly.id}`)
                            }
                            className="p-4 bg-white/5 border border-white/5 hover:border-[#FFD700]/30 rounded-2xl cursor-pointer group transition-all"
                          >
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">
                              Preceded By
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-gray-500 group-hover:text-[#FFD700]">
                                <HistoryIcon size={20} />
                              </div>
                              <div>
                                <p className="font-bold text-sm group-hover:text-white transition-colors">
                                  {precededByAssembly.name}
                                </p>
                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                                  {precededByAssembly.termLimits}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        {followedByAssembly && (
                          <div
                            onClick={() =>
                              navigate(`/assembly/${followedByAssembly.id}`)
                            }
                            className="p-4 bg-white/5 border border-white/5 hover:border-[#FFD700]/30 rounded-2xl cursor-pointer group transition-all"
                          >
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 text-right">
                              Followed By
                            </p>
                            <div className="flex items-center justify-end gap-3">
                              <div className="text-right">
                                <p className="font-bold text-sm group-hover:text-white transition-colors">
                                  {followedByAssembly.name}
                                </p>
                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                                  {followedByAssembly.termLimits}
                                </p>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-gray-500 group-hover:text-[#FFD700]">
                                <ChevronRight size={20} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                {entityType === EntityType.PERSON && (
                  <section className="glass-card p-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#FFD700] mb-6">
                      Legislative Roles & History
                    </h3>
                    <div className="space-y-4">
                      {personAssemblyRoles &&
                        personAssemblyRoles.length > 0 && (
                          <div className="mb-6 space-y-4">
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                              Leadership Councils
                            </p>
                            {personAssemblyRoles.map((r, idx) => {
                              const isSilver = r.role.toLowerCase().includes("opposition");
                              const cardBorderBgClass = isSilver
                                ? "bg-slate-400/5 border-slate-400/20 hover:bg-slate-400/10"
                                : "bg-[#FFD700]/5 border-[#FFD700]/20 hover:bg-[#FFD700]/10";
                              const shieldColorClass = isSilver
                                ? "text-slate-300"
                                : "text-[#FFD700]";
                              const textColorClass = isSilver
                                ? "silver-text"
                                : "text-[#FFD700]";
                              const chevronColorClass = isSilver
                                ? "text-slate-400/40"
                                : "text-[#FFD700]/40";
                              return (
                                <div
                                  key={`${r.assembly.id}-${r.role}`}
                                  onClick={() =>
                                    navigate(`/assembly/${r.assembly.id}`)
                                  }
                                  className={`p-4 border rounded-2xl cursor-pointer transition-all ${cardBorderBgClass}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Shield
                                        size={16}
                                        className={shieldColorClass}
                                      />
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className={`text-xs font-black uppercase tracking-widest ${textColorClass}`}>
                                            {prefixRole(r.role.replace(/([A-Z])/g, " $1"))}
                                          </p>
                                          {r.assembly.isActive === false && (
                                            <span className="px-1.5 py-0.5 bg-white/10 text-gray-400 text-[8px] font-black rounded-md uppercase">
                                              Past
                                            </span>
                                          )}
                                        </div>
                                        <p className="font-bold text-white">
                                          {r.assembly.name}
                                        </p>
                                      </div>
                                    </div>
                                    <ChevronRight
                                      size={16}
                                      className={chevronColorClass}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                      {personDesignations && personDesignations.length > 0 ? (
                        Array.isArray(personDesignations) &&
                        personDesignations.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => navigate(`/designation/${d.id}`)}
                            className="p-5 bg-white/5 border border-white/5 hover:border-[#FFD700]/30 rounded-2xl cursor-pointer group transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-gray-500 group-hover:text-[#FFD700]">
                                  <Award size={20} />
                                </div>
                                <div>
                                  <p className="font-bold text-lg group-hover:text-white transition-colors">
                                    {d.name}{" "}
                                    {d.assembly ? `of ${d.assembly.name}` : ""}
                                  </p>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
                                    {d.assembly
                                      ? "Legislative Appointment"
                                      : "Independent Recognition"}
                                  </p>
                                </div>
                              </div>
                              {d.incumbentId === id &&
                              d.assembly?.isActive !== false ? (
                                <span className="text-[10px] bg-[#FFD700]/10 text-[#FFD700] px-3 py-1 rounded-full border border-[#FFD700]/20 font-black">
                                  CURRENT
                                </span>
                              ) : (
                                <span className="text-[10px] bg-white/5 text-gray-500 px-3 py-1 rounded-full border border-white/5 font-black">
                                  PAST ROLE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              <span className="flex items-center gap-1">
                                <MapPin size={12} /> {d.constituency}
                              </span>
                              {Array.isArray(d.history) &&
                                d.history.find((h) => h.personId === id) && (
                                  <span className="flex items-center gap-1">
                                    <Calendar size={12} />
                                    {new Date(
                                      d.history.find((h) => h.personId === id)!
                                        .date,
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 border border-dashed border-white/5 rounded-2xl text-center">
                          <p className="text-gray-600 italic text-sm">
                            No legislative designations recorded for this
                            person.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {entityType === EntityType.DESIGNATION && (
                  <div className="space-y-6">
                    <section className="glass-card p-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-[#FFD700] mb-4">
                        Official Jurisdiction
                      </h3>
                      {associatedAssembly ? (
                        <div
                          onClick={() =>
                            navigate(`/assembly/${associatedAssembly.id}`)
                          }
                          className="flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-[#FFD700]/30 rounded-2xl cursor-pointer group transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center text-[#FFD700]">
                              <Landmark size={24} />
                            </div>
                            <div>
                              <p className="font-bold text-white group-hover:text-[#FFD700] transition-colors">
                                {associatedAssembly.name}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">
                                {associatedAssembly.subName ||
                                  "Legislative Body"}
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            size={18}
                            className="text-gray-600 group-hover:text-[#FFD700] transition-colors"
                          />
                        </div>
                      ) : (
                        <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl text-center">
                          <p className="text-xs text-gray-500 italic">
                            No assembly assigned to this designation
                          </p>
                        </div>
                      )}
                    </section>
                    <section className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold uppercase tracking-widest text-[#FFD700]">
                          Legislative Seat Management
                        </h3>
                      </div>

                      <div className="space-y-6">
                        {"incumbentId" in entity &&
                        (entity as Designation).incumbentId !== "vacant" ? (
                          <div className="space-y-4">
                            <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">
                              Current Holder
                            </p>
                            <div
                              onClick={() =>
                                navigate(
                                  `/person/${(entity as Designation).incumbentId}`,
                                )
                              }
                              className="bg-white/5 rounded-2xl p-6 flex items-center justify-between hover:bg-[#FFD700]/5 hover:border-[#FFD700]/30 cursor-pointer transition-all border border-white/5"
                            >
                              <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-black border border-[#FFD700]/20 flex items-center justify-center text-[#FFD700]">
                                  <User size={32} />
                                </div>
                                <div>
                                  <p className="text-xl font-bold">
                                    Member of Assembly
                                  </p>
                                  <p className="text-xs text-[#FFD700] font-bold uppercase tracking-widest mt-1">
                                    ID: {(entity as Designation).incumbentId}
                                  </p>
                                </div>
                              </div>
                              <ExternalLink
                                size={24}
                                className="text-gray-600"
                              />
                            </div>
                            {!isDissolvedRecord && (
                              <button
                                onClick={() => setShowDeletePopup(true)}
                                className="flex items-center gap-2 text-xs text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors font-bold uppercase"
                              >
                                <UserMinus size={14} /> Official Removal Process
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="bg-red-500/5 rounded-2xl p-12 text-center border border-dashed border-red-500/20">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                              <Award size={32} />
                            </div>
                            <h4 className="text-xl font-black uppercase text-red-500 tracking-widest">
                              Post Is Vacant
                            </h4>
                            <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
                              This official seat is currently unoccupied and
                              requires immediate appointment from the
                              legislative pool.
                            </p>
                            {!isDissolvedRecord && (
                              <button
                                onClick={() => setShowAppointPopup(true)}
                                className="mt-6 px-10 py-3 bg-[#FFD700] text-black font-black rounded-xl hover:scale-105 transition-transform"
                              >
                                APPOINT NOW
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                <section className="glass-card p-8">
                  <h3 className="text-lg font-bold uppercase tracking-widest mb-6 text-gray-400">
                    About {(entity as any).name}
                  </h3>
                  <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed">
                    {entityType === EntityType.ASSEMBLY &&
                      (entity as Assembly).description}
                    {entityType === EntityType.PARTY &&
                      `The ${(entity as Party).name} (${(entity as Party).abbreviation}) is a major political force. Founded in ${(entity as Party).founded}, it maintains its headquarters in ${(entity as Party).headquarters}.`}
                    {entityType === EntityType.PERSON &&
                      `Details for legislator ${(entity as Person).name} ${(entity as Person).partyId === "independent" ? "serving as an independent." : `affiliated with ${personParty?.name || (entity as Person).partyId}.`}`}
                    {entityType === EntityType.ALLIANCE &&
                      `The ${(entity as Alliance).name} is a strategic coordination of multiple parties to ensure legislative stability.`}
                    {entityType === EntityType.DESIGNATION &&
                      `Official designation of ${(entity as Designation).name} for the ${associatedConstituency?.name || (entity as Designation).constituency || "selected"} constituency.`}
                    {entityType === EntityType.CONSTITUENCY &&
                      `Assembly constituency record for the ${(entity as Constituency).name} constituency. This seat persists across multiple assembly terms and serves as a primary electoral division.`}
                  </div>

                  {entityType === EntityType.ASSEMBLY && (
                    <div className="space-y-8">
                      {/* Seat Distribution */}
                      {assemblyPerformance && (
                        <section className="glass-card p-8 border-[#FFD700]/10">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h3 className="text-sm font-black uppercase text-[#FFD700] tracking-[0.2em] mb-1">
                                Legislative Control
                              </h3>
                              <p className="text-2xl font-black">
                                {assemblyPerformance.totalSeats} Total
                                Constituencies
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Government */}
                            {assemblyPerformance.government && (
                              <div className="p-6 bg-gradient-to-br from-[#FFD700]/10 to-transparent border border-[#FFD700]/30 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                  <Award size={16} className="text-[#FFD700]" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD700]">
                                    Government
                                  </span>
                                </div>
                                <p className="text-xl font-bold mb-1 truncate">
                                  {assemblyPerformance.government.name}
                                </p>
                                <p className="text-3xl font-black gold-text">
                                  {assemblyPerformance.government.totalSeats}{" "}
                                  Seats
                                </p>
                              </div>
                            )}

                            {/* Official Opposition */}
                            {assemblyPerformance.opposition && (
                              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                  <Shield size={16} className="text-blue-400" />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                                    Official Opposition
                                  </span>
                                </div>
                                <p className="text-xl font-bold mb-1 truncate">
                                  {assemblyPerformance.opposition.name}
                                </p>
                                <p className="text-3xl font-black text-blue-400">
                                  {assemblyPerformance.opposition.totalSeats}{" "}
                                  Seats
                                </p>
                              </div>
                            )}

                            {/* Others */}
                            <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                              <div className="flex items-center gap-2 mb-3">
                                <Users size={16} className="text-gray-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  Other Blocks
                                </span>
                              </div>
                              <div className="space-y-2 max-h-20 overflow-y-auto custom-scrollbar">
                                {assemblyPerformance.others.length > 0 ? (
                                  assemblyPerformance.others.map((o) => (
                                    <div
                                      key={o.id}
                                      className="flex items-center justify-between"
                                    >
                                      <span className="text-xs font-bold text-gray-400 truncate pr-2">
                                        {o.name}
                                      </span>
                                      <span className="text-xs font-black">
                                        {o.totalSeats}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-gray-600 italic">
                                    No minor blocks recorded
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-8 flex h-4 rounded-full overflow-hidden bg-white/5 p-1 gap-1">
                            {assemblyPerformance.distribution.map((a) => (
                              <div
                                key={a.id}
                                style={{
                                  width: `${(a.totalSeats / 60) * 100}%`,
                                  backgroundColor: a.color,
                                }}
                                className="h-full rounded-full opacity-80 hover:opacity-100 transition-opacity cursor-pointer relative group"
                              >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black rounded-lg text-[10px] font-black opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 transition-opacity border border-white/10 pointer-events-none">
                                  {a.name}: {a.totalSeats}
                                </div>
                              </div>
                            ))}
                            {assemblyPerformance.totalSeats < 60 && (
                              <div
                                style={{
                                  width: `${((60 - assemblyPerformance.totalSeats) / 60) * 100}%`,
                                }}
                                className="h-full bg-white/5 rounded-full"
                              />
                            )}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-6">
                <div className="glass-card p-6 border-[#FFD700]/10">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFD700] mb-6 flex items-center gap-2">
                    <Shield size={14} /> SYSTEM METADATA
                  </h4>
                  <div className="space-y-4">
                    {entityType === EntityType.PERSON && (
                      <>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-xs text-gray-400 uppercase">
                            Gender
                          </span>
                          <span className="text-xs font-bold">
                            {(entity as Person).gender || "Not Specified"}
                          </span>
                        </div>
                        {activeRoles.length > 0 && (
                          <div className="py-2 border-b border-white/5 space-y-2">
                            <span className="text-xs text-gray-400 uppercase block mb-1">
                              Active Roles
                            </span>
                            <div className="space-y-1.5">
                              {activeRoles.map((role, rIdx) => {
                                const isOpposition = role.name.toLowerCase().includes("opposition");
                                const isGold =
                                  (role.type === "cabinet" ||
                                    role.type === "leadership") &&
                                  !isOpposition;
                                const isSilver =
                                  (role.type === "cabinet" ||
                                    role.type === "leadership") &&
                                  isOpposition;
                                return (
                                  <div
                                    key={rIdx}
                                    className="flex flex-col bg-white/[0.02] border border-white/5 rounded-xl p-2.5"
                                  >
                                    <span
                                      className={`text-xs font-black uppercase tracking-wider ${isGold ? "text-[#FFD700]" : isSilver ? "silver-text" : "text-gray-300"}`}
                                    >
                                      {prefixRole(role.name)}
                                    </span>
                                    {role.assemblyName && (
                                      <span className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                                        {role.assemblyName}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {entityType === EntityType.PARTY && (
                      <>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-xs text-gray-400 uppercase">
                            Chairman
                          </span>
                          <span className="text-xs font-bold">
                            {(entity as Party).chairman}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-xs text-gray-400 uppercase">
                            Founded
                          </span>
                          <span className="text-xs font-bold">
                            {(entity as Party).founded}
                          </span>
                        </div>
                        <div className="py-2 border-b border-white/5 flex justify-between">
                          <span className="text-xs text-gray-400 uppercase block mb-1">
                            Headquarters
                          </span>
                          <span className="text-xs font-bold text-gray-300">
                            {(entity as Party).headquarters}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-xs text-gray-400 uppercase block mb-1">
                            Total Members
                          </span>
                          <span className="text-xs font-bold text-[#FFD700]">
                            {relatedPersons?.length || 0} Legislators
                          </span>
                        </div>
                      </>
                    )}
                    {entityType === EntityType.ASSEMBLY && (
                      <>
                        <div className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-xs text-gray-400 uppercase">
                            Term Limits
                          </span>
                          <span className="text-xs font-bold">
                            {(entity as Assembly).termLimits}
                          </span>
                        </div>
                        <div className="py-2">
                          <span className="text-xs text-gray-400 uppercase block mb-1">
                            Control ID
                          </span>
                          <span className="text-xs font-bold text-[#D32F2F]">
                            {(entity as Assembly).partyControlId}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between py-2">
                      <span className="text-xs text-gray-400 uppercase">
                        Last Registry Update
                      </span>
                      <span className="text-xs font-bold">
                        {(() => {
                          const dateVal = entity.updatedAt;
                          const isValidDate =
                            dateVal && !isNaN(new Date(dateVal).getTime());
                          if (isValidDate)
                            return new Date(dateVal).toLocaleString();
                          if (entityType === EntityType.PERSON) {
                            const person = entity as Person;
                            const cName =
                              person.constituencyName ||
                              constituenciesList.find(
                                (c) => c.currentIncumbentId === person.id,
                              )?.name;
                            if (cName) return `MLA for ${cName}`;
                          }
                          return "Active Term";
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "related" && (
            <div className="space-y-12">
              {entityType === EntityType.CONSTITUENCY && (
                <section>
                  <div className="mb-12">
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-8">
                      Legislative Sessions for this seat
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {designationsFromConstituency &&
                        designationsFromConstituency.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => navigate(`/designation/${d.id}`)}
                            className="p-6 bg-white/5 border border-white/5 rounded-2xl hover:border-[#FFD700]/30 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-xs font-black uppercase text-[#FFD700] tracking-widest">
                                {d.assembly?.name || "Unknown Assembly"}
                              </p>
                              {d.incumbentId === "vacant" ? (
                                <span className="text-[10px] text-red-500 font-bold">
                                  VACANT
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-500 font-bold">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center text-gray-500 group-hover:text-white transition-colors overflow-hidden">
                                {d.incumbent?.imageUrl ? (
                                  <img
                                    src={d.incumbent.imageUrl}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User size={24} />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-white mb-1">
                                  {d.incumbent?.name || "No Incumbent"}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                                    {partiesList.find(
                                      (p) => p.id === d.incumbent?.partyId,
                                    )?.abbreviation || "Independent"}
                                  </p>
                                  {d.incumbent?.partyId &&
                                    d.incumbent.partyId !== "independent" && (
                                      <>
                                        <span className="text-[8px] text-gray-700">
                                          •
                                        </span>
                                        <span className="text-[9px] text-[#FFD700] uppercase font-black tracking-widest bg-[#FFD700]/5 px-2 py-0.5 rounded border border-[#FFD700]/10">
                                          {
                                            alliancesList.find(
                                              (a) =>
                                                a.id ===
                                                partiesList.find(
                                                  (p) =>
                                                    p.id ===
                                                    d.incumbent?.partyId,
                                                )?.allianceId,
                                            )?.name
                                          }
                                        </span>
                                      </>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </section>
              )}
              {entityType === EntityType.PARTY && (
                <section className="flex flex-col items-center">
                  {/* Alliance Connection (Parent) */}
                  {(entity as Party).allianceId !== "independent" && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center mb-12"
                    >
                      <p className="text-[10px] text-[#FFD700] font-black uppercase tracking-[0.3em] mb-4">
                        Member of Alliance
                      </p>
                      <div
                        onClick={() =>
                          navigate(`/alliance/${(entity as Party).allianceId}`)
                        }
                        className="glass-card p-4 border-[#FFD700]/20 hover:border-[#FFD700] cursor-pointer transition-all flex items-center gap-4 px-8"
                      >
                        <Shield size={20} className="text-[#FFD700]" />
                        <span className="font-black gold-text uppercase">
                          {partyAlliance?.name || (entity as Party).allianceId}
                        </span>
                        <ChevronRight size={16} className="text-gray-600" />
                      </div>
                      <div className="w-px h-12 bg-gradient-to-b from-[#FFD700] to-transparent mt-2 opacity-50" />
                    </motion.div>
                  )}

                  {/* Central Party Node */}
                  <div className="relative z-10">
                    <div className="w-24 h-24 rounded-3xl bg-[#D32F2F] shadow-2xl shadow-[#D32F2F]/40 flex items-center justify-center border-4 border-black">
                      <Flag size={40} className="text-white" />
                    </div>
                    <div className="absolute top-1/2 left-full w-24 h-px bg-white/10 hidden lg:block" />
                    <div className="absolute top-1/2 right-full w-24 h-px bg-white/10 hidden lg:block" />
                  </div>

                  <div className="mt-8 text-center">
                    <h3 className="text-2xl font-black uppercase gold-text">
                      {(entity as Party).name}
                    </h3>
                    <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">
                      Primary Hub
                    </p>
                  </div>

                  {/* Members List (Children) */}
                  <div className="w-full mt-16 pt-12 border-t border-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <h4 className="text-sm font-bold gold-text uppercase tracking-widest flex items-center gap-2">
                        <Users size={16} /> Party Cadre (
                        {relatedPersons?.length || 0})
                      </h4>
                      {!isDissolvedRecord && (
                        <button
                          onClick={() => setShowAddPersonModal(true)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 rounded-lg text-[#FFD700] text-[10px] font-black uppercase tracking-widest border border-[#FFD700]/20 transition-all"
                        >
                          <Plus size={14} /> Add Person
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Array.isArray(relatedPersons) &&
                        relatedPersons.map((p) => (
                          <EntityCard
                            key={p.id}
                            entity={p}
                            type={EntityType.PERSON}
                            onDelete={() => handleRemovePersonFromParty(p.id)}
                          />
                        ))}
                    </div>
                  </div>
                </section>
              )}
              {entityType === EntityType.ALLIANCE && (
                <section className="flex flex-col items-center">
                  {/* Central Alliance Node */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-tr from-[#FFD700]/20 to-transparent border-2 border-[#FFD700] shadow-[0_0_50px_rgba(255,215,0,0.15)] flex items-center justify-center mb-8 relative"
                  >
                    <Shield size={64} className="gold-text" />
                    <div className="absolute -inset-4 border border-[#FFD700]/20 rounded-[3rem] animate-pulse" />
                  </motion.div>

                  <div className="text-center mb-24">
                    <h3 className="text-3xl font-black gold-text uppercase tracking-tighter">
                      {(entity as Alliance).name}
                    </h3>
                    <p className="text-blue-400 uppercase tracking-[0.4em] text-[10px] font-black mt-2">
                      Grand Strategic Alliance
                    </p>
                  </div>

                  <div className="w-full space-y-24">
                    {/* 1. Constituent Parties Portion */}
                    <div className="space-y-8">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center border border-[#FFD700]/20">
                            <Flag size={20} className="text-[#FFD700]" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black uppercase tracking-tight text-white">
                              Constituent Parties
                            </h4>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                              Political Base
                            </p>
                          </div>
                        </div>
                        {!isDissolvedRecord && (
                          <button
                            onClick={() => setShowAddPartyModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 rounded-xl text-[#FFD700] text-[10px] font-black uppercase tracking-widest border border-[#FFD700]/20 transition-all"
                          >
                            <Plus size={14} /> Add Constituent
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.isArray(relatedParties) &&
                          relatedParties.map((p) => (
                            <motion.div key={p.id} whileHover={{ y: -5 }}>
                              <EntityCard
                                entity={p}
                                type={EntityType.PARTY}
                                onDelete={() =>
                                  handleRemovePartyFromAlliance(p.id)
                                }
                              />
                            </motion.div>
                          ))}
                        {Array.isArray(relatedParties) &&
                          relatedParties.length === 0 && (
                            <div className="col-span-full py-12 border border-dashed border-white/5 rounded-3xl text-center">
                              <p className="text-gray-600 uppercase tracking-widest text-xs font-black">
                                No member parties assigned
                              </p>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* 2. Alliance Leadership Portion (Leader, Chairman, Founder) */}
                    <div className="py-16 border-y border-white/5 bg-white/[0.02] rounded-[3rem] p-8 md:p-12 relative overflow-hidden">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#FFD700]/5 blur-[100px] -z-10" />
                      <h4 className="text-center text-sm font-black text-[#FFD700] uppercase tracking-[0.5em] mb-16">
                        Alliance High Council
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
                        {/* Alliance Leader */}
                        <div className="flex flex-col items-center text-center space-y-6 group">
                          <div className="relative">
                            <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-2 border-[#FFD700] shadow-2xl shadow-black group-hover:scale-105 transition-all duration-500">
                              {allianceLeadership?.leader?.imageUrl ? (
                                <img
                                  src={allianceLeadership.leader.imageUrl}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-black flex items-center justify-center text-gray-800">
                                  <User size={64} />
                                </div>
                              )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-[#FFD700] text-black p-2 rounded-xl shadow-xl">
                              <Shield size={16} />
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#FFD700] font-black uppercase tracking-[0.3em] mb-1">
                              Leader
                            </p>
                            <p className="text-xl font-black text-white uppercase tracking-tight">
                              {allianceLeadership?.leader?.name || "Vacant"}
                            </p>
                            {allianceLeadership?.leader && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/person/${allianceLeadership.leader!.id}`,
                                  )
                                }
                                className="text-[10px] text-gray-500 hover:text-[#FFD700] transition-colors mt-2 uppercase font-black tracking-widest"
                              >
                                View Profile
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Alliance Chairman */}
                        <div className="flex flex-col items-center text-center space-y-6 group">
                          <div className="relative">
                            <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-2 border-[#FFD700]/30 group-hover:border-[#FFD700] shadow-2xl shadow-black group-hover:scale-105 transition-all duration-500">
                              {allianceLeadership?.chairman?.imageUrl ? (
                                <img
                                  src={allianceLeadership.chairman.imageUrl}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-black flex items-center justify-center text-gray-800">
                                  <Award size={64} />
                                </div>
                              )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-2 rounded-xl shadow-xl">
                              <Landmark size={16} />
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.3em] mb-1">
                              Chairman
                            </p>
                            <p className="text-xl font-black text-white uppercase tracking-tight">
                              {allianceLeadership?.chairman?.name || "Vacant"}
                            </p>
                            {allianceLeadership?.chairman && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/person/${allianceLeadership.chairman!.id}`,
                                  )
                                }
                                className="text-[10px] text-gray-500 hover:text-blue-400 transition-colors mt-2 uppercase font-black tracking-widest"
                              >
                                View Profile
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Alliance Founder */}
                        <div className="flex flex-col items-center text-center space-y-6 group">
                          <div className="relative">
                            <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-2 border-[#D32F2F]/30 group-hover:border-[#D32F2F] shadow-2xl shadow-black group-hover:scale-105 transition-all duration-500">
                              {allianceLeadership?.founder?.imageUrl ? (
                                <img
                                  src={allianceLeadership.founder.imageUrl}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-black flex items-center justify-center text-gray-800">
                                  <HistoryIcon size={64} />
                                </div>
                              )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-[#D32F2F] text-white p-2 rounded-xl shadow-xl">
                              <Calendar size={16} />
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#D32F2F] font-black uppercase tracking-[0.3em] mb-1">
                              Founder
                            </p>
                            <p className="text-xl font-black text-white uppercase tracking-tight">
                              {allianceLeadership?.founder?.name || "Vacant"}
                            </p>
                            {allianceLeadership?.founder && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/person/${allianceLeadership.founder!.id}`,
                                  )
                                }
                                className="text-[10px] text-gray-500 hover:text-[#D32F2F] transition-colors mt-2 uppercase font-black tracking-widest"
                              >
                                View Profile
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Alliance High Command Portion */}
                    <div className="space-y-8">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#D32F2F]/10 flex items-center justify-center border border-[#D32F2F]/20">
                            <Users size={20} className="text-[#D32F2F]" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black uppercase tracking-tight text-white">
                              Alliance High Command
                            </h4>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                              Executive Decisions
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowManageHighCommandModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F]/10 hover:bg-[#D32F2F]/20 rounded-xl text-[#D32F2F] text-[10px] font-black uppercase tracking-widest border border-[#D32F2F]/20 transition-all"
                        >
                          <Plus size={14} /> Assign Commanders
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.isArray(highCommandMembers) &&
                        highCommandMembers.length > 0 ? (
                          highCommandMembers.map((p) => (
                            <motion.div key={p.id} whileHover={{ scale: 1.05 }}>
                              <EntityCard
                                entity={p}
                                type={EntityType.PERSON}
                                onDelete={() => handleToggleHighCommand(p.id)}
                              />
                            </motion.div>
                          ))
                        ) : (
                          <div className="col-span-full py-16 border border-dashed border-white/5 rounded-[2rem] text-center">
                            <p className="text-gray-600 italic text-xs uppercase tracking-[0.3em] font-black">
                              No Active High Command Assigned
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {entityType === EntityType.ASSEMBLY && (
                <section>
                  <div className="mb-12 text-center">
                    <div className="inline-block p-4 rounded-3xl bg-white/5 border border-white/10 mb-6">
                      <Landmark size={48} className="gold-text" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-2">
                      {(entity as Assembly).isActive === false
                        ? "Final Legislative Record"
                        : "Legislative Structure"}
                    </h3>
                    <p className="text-gray-500 text-sm max-w-lg mx-auto">
                      {(entity as Assembly).isActive === false
                        ? "Historical record of the seat distributions and leadership at the time of dissolution."
                        : "Graphic representation of the sitting members and specialized councils within the assembly."}
                    </p>
                  </div>

                  {/* Seating Chart Bento Map */}
                  {assemblyPerformance && assemblySeats && assemblySeats.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                      {/* Seating map card */}
                      <div className="lg:col-span-2 glass-card p-6 border-[#FFD700]/10 flex flex-col justify-between relative overflow-hidden group">
                        {/* Ambient background glow */}
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#FFD700]/5 blur-3xl rounded-full" />

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-[#FFD700] font-black uppercase tracking-[0.2em]">
                              Assembly Chamber Layout
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase font-mono bg-white/5 px-2 py-0.5 rounded">
                              {assemblySeats.length} Seats Registered
                            </span>
                          </div>
                          <h3 className="text-xl font-black uppercase tracking-tight text-white mb-1">
                            Legislative Seating Plan
                          </h3>
                          <p className="text-xs text-gray-500 mb-6 max-w-lg">
                            Interactive hemispherical map of the chamber. Seats are grouped by political alliance/party wedges from government (left) to opposition (right).
                          </p>

                          <div className="relative flex items-center justify-center p-4 bg-black/40 rounded-3xl border border-white/5">
                            {/* AISLES / CORRIDORS IN CHAMBER FOR EXTRA REALISM */}
                            <svg
                              viewBox="0 0 600 320"
                              className="w-full h-auto max-w-[550px] drop-shadow-[0_0_20px_rgba(0,0,0,0.6)]"
                            >
                              {/* Faint radial sector lines to show divided layout */}
                              <line
                                x1={300}
                                y1={265}
                                x2={300}
                                y2={20}
                                className="stroke-white/5 stroke-2"
                                strokeDasharray="4,4"
                              />
                              <line
                                x1={300}
                                y1={265}
                                x2={100}
                                y2={65}
                                className="stroke-white/5 stroke"
                                strokeDasharray="4,4"
                              />
                              <line
                                x1={300}
                                y1={265}
                                x2={500}
                                y2={65}
                                className="stroke-white/5 stroke"
                                strokeDasharray="4,4"
                              />

                              {/* Curved baseline border for the rows */}
                              <path
                                d="M 195 265 A 105 105 0 0 1 405 265"
                                fill="none"
                                className="stroke-white/5 stroke-2"
                              />
                              <path
                                d="M 75 265 A 225 225 0 0 1 525 265"
                                fill="none"
                                className="stroke-white/5 stroke-2"
                              />

                              {/* Render Speaker's Podium */}
                              <g
                                transform="translate(300, 272)"
                                className="cursor-pointer group/speaker"
                                onMouseEnter={() => setInspectorSeat(null)}
                                onClick={() => {
                                  const speakerId = (entity as Assembly).leaders?.speaker;
                                  if (speakerId) navigate(`/person/${speakerId}`);
                                }}
                              >
                                <rect
                                  x={-30}
                                  y={-14}
                                  width={60}
                                  height={24}
                                  rx={4}
                                  className="fill-zinc-950 stroke-[#FFD700]/30 stroke-2 group-hover/speaker:stroke-[#FFD700]/60 transition-colors"
                                />
                                <circle
                                  cx={0}
                                  cy={-2}
                                  r={5}
                                  className="fill-[#FFD700] stroke-black/40 stroke"
                                />
                                <text
                                  y={22}
                                  textAnchor="middle"
                                  className="fill-gray-500 font-mono text-[7px] font-black tracking-widest uppercase select-none transition-colors group-hover/speaker:fill-gray-300"
                                >
                                  SPEAKER
                                </text>
                              </g>

                              {/* Render Seats */}
                              {sortedSeatPositions.map((pos, idx) => {
                                const seat = assemblySeats[idx];
                                if (!seat) return null;
                                const isVacant = !seat.politician;
                                const color = isVacant
                                  ? "#4B5563"
                                  : seat.alliance?.colors?.[0] ||
                                    seat.party?.colors?.[0] ||
                                    "#666666";
                                const isCurrentlyInspected =
                                  inspectorSeat?.constituency?.id ===
                                  seat.constituency.id;

                                return (
                                  <circle
                                    key={seat.constituency.id}
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={isCurrentlyInspected ? 9 : 6.5}
                                    fill={color}
                                    className={`transition-all duration-300 cursor-pointer ${
                                      isCurrentlyInspected
                                        ? "stroke-white stroke-[2.5px] scale-125"
                                        : isVacant
                                          ? "stroke-white/10 hover:stroke-white/40 hover:scale-120"
                                          : "stroke-black/30 hover:stroke-white/45 hover:scale-125"
                                    }`}
                                    style={{
                                      filter: isCurrentlyInspected
                                        ? "drop-shadow(0 0 8px rgba(255,255,255,0.6))"
                                        : undefined,
                                    }}
                                    onMouseEnter={() => setInspectorSeat(seat)}
                                  />
                                );
                              })}
                            </svg>
                          </div>
                        </div>

                        {/* Alliance Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6 pt-6 border-t border-white/5">
                          {assemblyPerformance.distribution.map((alliance) => {
                            return (
                              <div
                                key={alliance.id}
                                className="flex items-center gap-1.5 cursor-pointer group/legend"
                                onClick={() => alliance.id !== "independent" ? navigate(`/alliance/${alliance.id}`) : undefined}
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-full border border-white/10 group-hover/legend:scale-110 transition-all"
                                  style={{ backgroundColor: alliance.color }}
                                />
                                <span className="text-[10px] font-mono text-gray-400 font-bold uppercase tracking-wider leading-none group-hover/legend:text-white transition-colors">
                                  {alliance.abbreviation} ({alliance.totalSeats})
                                </span>
                              </div>
                            );
                          })}
                          {assemblySeats.some((s) => !s.politician) && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-[#4B5563] border border-white/10" />
                              <span className="text-[10px] font-mono text-gray-500 font-bold uppercase tracking-wider leading-none">
                                VACANT
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Seat Inspector Side Card */}
                      <div className="lg:col-span-1 glass-card p-6 border-[#FFD700]/10 flex flex-col justify-between relative overflow-hidden min-h-[380px]">
                        {/* Decorative border bar indicating state */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FFD700]/20 to-transparent" />

                        {inspectorSeat ? (
                          <div className="flex flex-col h-full justify-between gap-6">
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] text-[#FFD700] font-black uppercase tracking-[0.2em]">
                                  Seat Inspector
                                </span>
                                <span className="text-[10px] font-mono text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded">
                                  Seat #{inspectorSeat.constituency.slNo}
                                </span>
                              </div>

                              <div className="flex flex-col items-center text-center mt-2 mb-4">
                                <div className="w-20 h-20 rounded-full bg-black/60 overflow-hidden border-2 border-[#FFD700]/30 shadow-xl relative group mb-3">
                                  {inspectorSeat.politician ? (
                                    <img
                                      src={inspectorSeat.politician.imageUrl}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-white/5">
                                      <Shield size={32} />
                                    </div>
                                  )}
                                </div>

                                <h4 className="text-lg font-black text-white leading-tight uppercase tracking-tight">
                                  {inspectorSeat.politician
                                    ? inspectorSeat.politician.name
                                    : "Vacant Seat"}
                                </h4>

                                <div className="flex items-center gap-1 text-gray-400 mt-1.5 justify-center">
                                  <MapPin size={12} className="text-[#FFD700]/60" />
                                  <span className="text-xs font-bold uppercase tracking-wider">
                                    {inspectorSeat.constituency.name}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-3 mt-2">
                                {/* Party / Alliance details */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1.5">
                                    Affiliation / Alliance
                                  </p>
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-3.5 h-3.5 rounded"
                                      style={{
                                        backgroundColor: inspectorSeat.alliance
                                          ? inspectorSeat.alliance.colors?.[0]
                                          : inspectorSeat.party
                                            ? inspectorSeat.party.colors?.[0]
                                            : "#4B5563",
                                      }}
                                    />
                                    <div>
                                      <p className="text-xs font-bold text-gray-200">
                                        {inspectorSeat.politician
                                          ? inspectorSeat.politician.partyId ===
                                            "independent"
                                            ? inspectorSeat.alliance
                                              ? `Independent (Supporting ${inspectorSeat.alliance.name})`
                                              : "Independent Member"
                                            : inspectorSeat.alliance
                                              ? `${inspectorSeat.party?.name} (${inspectorSeat.alliance.name})`
                                              : inspectorSeat.party?.name ||
                                                "Constituent Party"
                                          : "No Representative"}
                                      </p>
                                      {inspectorSeat.party?.abbreviation && (
                                        <p className="text-[10px] text-gray-500 font-bold uppercase font-mono mt-0.5">
                                          {inspectorSeat.party.abbreviation} {inspectorSeat.alliance && `• ${inspectorSeat.alliance.abbreviation}`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Designation summary */}
                                {inspectorSeat.politician && (
                                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1.5">
                                      Active Roles
                                    </p>
                                    {(() => {
                                      const leaderRoles = Object.entries(
                                        (entity as Assembly).leaders || {},
                                      )
                                        .filter(
                                          ([_, pId]) =>
                                            pId === inspectorSeat.politician.id,
                                        )
                                        .map(([role]) =>
                                          role.replace(/([A-Z])/g, " $1").trim(),
                                        );

                                      const customRoles =
                                        inspectorSeat.politician.assemblyRoles?.[
                                          id!
                                        ]?.split(", ") || [];
                                      const roles = [
                                        ...leaderRoles,
                                        ...customRoles,
                                      ].filter(Boolean);

                                      if (roles.length > 0) {
                                        return (
                                          <div className="flex flex-wrap gap-1.5">
                                            {roles.map((r, i) => (
                                              <span
                                                key={i}
                                                className="text-[9px] font-black uppercase tracking-widest bg-[#FFD700]/5 text-[#FFD700] border border-[#FFD700]/10 px-2 py-0.5 rounded"
                                              >
                                                {r}
                                              </span>
                                            ))}
                                          </div>
                                        );
                                      }
                                      return (
                                        <span className="text-[10px] text-gray-600 font-bold italic">
                                          Sitting Assembly Member (MLA)
                                        </span>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {inspectorSeat.politician && (
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/person/${inspectorSeat.politician.id}`,
                                    )
                                  }
                                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 rounded-xl text-[#FFD700] text-[10px] font-black uppercase tracking-widest border border-[#FFD700]/10 transition-all cursor-pointer"
                                >
                                  Inspect Politician Profile{" "}
                                  <ChevronRight size={12} />
                                </button>
                              )}
                              <button
                                  onClick={() =>
                                    navigate(
                                      `/constituency/${inspectorSeat.constituency.id}`,
                                    )
                                  }
                                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all cursor-pointer"
                                >
                                  Inspect Constituency Profile{" "}
                                  <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        ) : speakerDetails ? (
                          <div className="flex flex-col h-full justify-between gap-6">
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] text-[#FFD700] font-black uppercase tracking-[0.2em] animate-pulse">
                                  {prefixRole("Speaker of the Assembly")}
                                </span>
                                <span className="text-[10px] font-mono text-[#FFD700] font-bold bg-[#FFD700]/5 border border-[#FFD700]/20 px-2 py-0.5 rounded uppercase tracking-[0.1em]">
                                  Presiding Officer
                                </span>
                              </div>

                              <div className="flex flex-col items-center text-center mt-2 mb-4">
                                <div className="w-20 h-20 rounded-full bg-black/60 overflow-hidden border-2 border-[#FFD700]/50 shadow-xl relative group mb-3">
                                  {speakerDetails.person.imageUrl ? (
                                    <img
                                      src={speakerDetails.person.imageUrl}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-white/5">
                                      <Shield size={32} />
                                    </div>
                                  )}
                                </div>

                                <h4 className="text-lg font-black text-white leading-tight uppercase tracking-tight">
                                  {speakerDetails.person.name}
                                </h4>

                                <div className="flex items-center gap-1 text-gray-400 mt-1.5 justify-center">
                                  <Shield size={12} className="text-[#FFD700]/60" />
                                  <span className="text-xs font-bold uppercase tracking-wider">
                                    {speakerDetails.seat ? `MLA for ${speakerDetails.seat.constituency.name}` : "Presiding Officer"}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-3 mt-2">
                                {/* Party / Alliance details */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1.5">
                                    Affiliation / Alliance
                                  </p>
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-3.5 h-3.5 rounded"
                                      style={{
                                        backgroundColor: speakerDetails.alliance
                                          ? speakerDetails.alliance.colors?.[0]
                                          : speakerDetails.party
                                            ? speakerDetails.party.colors?.[0]
                                            : "#4B5563",
                                      }}
                                    />
                                    <div>
                                      <p className="text-xs font-bold text-gray-200">
                                        {speakerDetails.person.partyId === "independent"
                                          ? speakerDetails.alliance
                                            ? `Independent (Supporting ${speakerDetails.alliance.name})`
                                            : "Independent Member"
                                          : speakerDetails.alliance
                                            ? `${speakerDetails.party?.name} (${speakerDetails.alliance.name})`
                                            : speakerDetails.party?.name || "Constituent Party"}
                                      </p>
                                      {speakerDetails.party?.abbreviation && (
                                        <p className="text-[10px] text-gray-500 font-bold uppercase font-mono mt-0.5">
                                          {speakerDetails.party.abbreviation} {speakerDetails.alliance && `• ${speakerDetails.alliance.abbreviation}`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Active Roles */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1.5">
                                    Active Roles
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(255,215,0,0.15)]">
                                      {prefixRole("Speaker of the House")}
                                    </span>
                                    {speakerDetails.person.assemblyRoles?.[id!]?.split(", ")?.filter(Boolean)?.map((r: string, i: number) => (
                                      <span
                                        key={i}
                                        className="text-[9px] font-black uppercase tracking-widest bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded"
                                      >
                                        {prefixRole(r)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => navigate(`/person/${speakerDetails.person.id}`)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 rounded-xl text-[#FFD700] text-[10px] font-black uppercase tracking-widest border border-[#FFD700]/10 transition-all cursor-pointer"
                              >
                                Inspect Speaker Profile <ChevronRight size={12} />
                              </button>
                              {speakerDetails.seat && (
                                <button
                                  onClick={() => navigate(`/constituency/${speakerDetails.seat.constituency.id}`)}
                                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all cursor-pointer"
                                >
                                  Inspect Constituency Profile <ChevronRight size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center py-10">
                            <Shield
                              size={36}
                              className="text-gray-700 animate-pulse mb-3"
                            />
                            <p className="text-gray-500 text-xs italic">
                              Hover over any legislative seat in the chamber diagram
                              to view representation details.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries((entity as Assembly).leaders || {})
                      .filter(
                        ([role]) =>
                          role !== "leaderOfHouse" &&
                          role !== "deputyLeaderOfHouse",
                      )
                      .map(([role, pId]) => {
                        if (!pId) return null;
                        const isSilver = role === "leaderOfOpposition" || role === "deputyLeaderOfOpposition";
                        const borderClasses = isSilver
                          ? "border-slate-400/20 hover:border-slate-400/50"
                          : "border-[#FFD700]/20 hover:border-[#FFD700]/50";
                        const bgBlurClasses = isSilver
                          ? "bg-slate-400/5 group-hover:bg-slate-400/10"
                          : "bg-[#FFD700]/5 group-hover:bg-[#FFD700]/10";
                        const imageBorderClasses = isSilver
                          ? "border-slate-400/20 shadow-slate-400/10"
                          : "border-[#FFD700]/20 shadow-[#FFD700]/10";

                        return (
                          <motion.div
                            key={role}
                            whileHover={{ y: -5, scale: 1.02 }}
                            onClick={() => navigate(`/person/${pId}`)}
                            className={`glass-card p-6 flex flex-col gap-4 ${borderClasses} cursor-pointer transition-all border group relative overflow-hidden`}
                          >
                            <div className={`absolute top-0 right-0 p-8 ${bgBlurClasses} blur-3xl -z-10 transition-colors`} />
                            <div className="flex items-center justify-between">
                              <div className={`w-12 h-12 rounded-xl bg-black overflow-hidden border ${imageBorderClasses} shadow-lg`}>
                                {personsList.find((p) => p.id === pId)
                                  ?.imageUrl ? (
                                  <img
                                    src={
                                      personsList.find((p) => p.id === pId)!
                                        .imageUrl
                                    }
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[#D32F2F]">
                                    <Shield size={24} />
                                  </div>
                                )}
                              </div>
                              <Calendar size={16} className="text-gray-700" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest leading-none mb-1">
                                {prefixRole(role.replace(/([A-Z])/g, " $1"))}
                              </p>
                              <p className={`font-bold text-lg ${isSilver ? "silver-text" : "gold-text"}`}>
                                {personsList.find((p) => p.id === pId)?.name ||
                                  "Elected Representative"}
                              </p>
                              {(() => {
                                const p = personsList.find(
                                  (pl) => pl.id === pId,
                                );
                                if (p) {
                                  const party = partiesList.find(
                                    (pt) => pt.id === p.partyId,
                                  );
                                  const partyText =
                                    p.partyId === "independent"
                                      ? "Independent"
                                      : party?.name || p.partyId;
                                  return (
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                                      {partyText}
                                    </p>
                                  );
                                }
                                return (
                                  <p className="text-[10px] text-gray-600 font-mono mt-1 opacity-50">
                                    Unknown Affiliation
                                  </p>
                                );
                              })()}
                            </div>
                            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-gray-500">
                              <span className="flex items-center gap-1 uppercase tracking-tighter">
                                <MapPin size={10} /> Verification Pass
                              </span>
                              <ExternalLink size={12} />
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>

                  <div className="mt-20">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#FFD700]">
                        <Users size={24} />
                      </div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">
                        {(entity as Assembly).isActive === false
                          ? "Final Membership (MLAs)"
                          : "Elected Members (MLAs)"}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
                      {assemblyMembers.map((m) => (
                        <EntityCard
                          key={m.uniqueKey || m.id}
                          entity={m}
                          type={EntityType.PERSON}
                          currentAssemblyId={id}
                          onPromote={
                            !isDissolvedRecord &&
                            !(
                              personsList.find((p) => p.id === m.id)
                                ?.assemblyRoles?.[id!]
                                ?.split(", ")
                                ?.some((r) => r.toLowerCase().includes("minister")) || false
                            )
                              ? () =>
                                  setShowPromotePopup({
                                    personId: m.id,
                                    personName: m.name,
                                  })
                              : undefined
                          }
                          onSupportAlliance={
                            !isDissolvedRecord && m.partyId === "independent"
                              ? () =>
                                  setShowSupportAlliancePopup({
                                    personId: m.id,
                                    personName: m.name,
                                  })
                              : undefined
                          }
                        />
                      ))}
                      {assemblyMembers.length === 0 && (
                        <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl">
                          <p className="text-gray-600 italic">
                            No sitting members recorded for this assembly term.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Seats List - Vacant / Occupied separation */}
                    <div className="space-y-12">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#FFD700]">
                          <MapPin size={24} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black uppercase tracking-tight">
                            Constituency Status
                          </h3>
                          <p className="text-gray-500 text-xs">
                            Analysis of active and vacant seats in this
                            assembly.
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const seats = [...(assemblySeats || [])].sort((a, b) => {
                          const slA = parseInt(a.constituency.slNo) || 9999;
                          const slB = parseInt(b.constituency.slNo) || 9999;
                          return slA - slB;
                        });
                        const occupied = seats.filter((s) => s.politician);
                        const vacant = seats.filter((s) => !s.politician);

                        return (
                          <div className="space-y-12">
                            {vacant.length > 0 && (
                              <div>
                                <div className="flex items-center gap-3 mb-6">
                                  <h4 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] bg-red-500/5 px-4 py-2 rounded-xl border border-red-500/10">
                                    Vacant Seats ({vacant.length})
                                  </h4>
                                  <div className="flex-1 h-px bg-gradient-to-r from-red-500/20 to-transparent" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {vacant.map((s) => (
                                    <div
                                      key={s.constituency.id}
                                      onClick={() =>
                                        navigate(`/constituency/${s.constituency.id}`)
                                      }
                                      className="p-4 bg-red-500/[0.02] border border-red-500/10 rounded-2xl hover:bg-red-500/[0.04] transition-all cursor-pointer group"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-red-500/50 font-black uppercase tracking-widest">
                                          #{s.constituency.slNo}
                                        </span>
                                        <AlertCircle
                                          size={14}
                                          className="text-red-500/30 group-hover:text-red-500 transition-colors"
                                        />
                                      </div>
                                      <p className="font-bold text-white uppercase tracking-tight">
                                        {s.constituency.name}
                                      </p>
                                      <div className="mt-4 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-red-500/40 uppercase">
                                          Unrepresented
                                        </span>
                                        <div className="w-6 h-px bg-red-500/20" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-3 mb-6">
                                <h4 className="text-sm font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5 px-4 py-2 rounded-xl border border-emerald-500/10">
                                  Occupied Seats ({occupied.length})
                                </h4>
                                <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 to-transparent" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {occupied.map((s) => {
                                  return (
                                    <div
                                      key={s.constituency.id}
                                      onClick={() =>
                                        navigate(`/constituency/${s.constituency.id}`)
                                      }
                                      className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-[#FFD700]/30 transition-all cursor-pointer group"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                          #{s.constituency.slNo}
                                        </span>
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{
                                            backgroundColor:
                                              s.party?.colors?.[0] || "#ccc",
                                          }}
                                        />
                                      </div>
                                      <p className="font-bold text-white uppercase tracking-tight mb-1">
                                        {s.constituency.name}
                                      </p>
                                      <p className="text-[10px] text-[#FFD700] font-black uppercase tracking-widest truncate">
                                        {s.politician?.name || "Loading..."}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Political Groups Diagram */}
                    {assemblyPerformance && (
                      <section className="mt-24 max-w-2xl mx-auto lg:mx-0">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-10">
                          <h3 className="text-sm font-black text-gray-500 uppercase tracking-[0.3em]">
                            {(entity as Assembly).isActive === false
                              ? "Final Political Alignment"
                              : "Political groups"}
                          </h3>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                                Government
                              </p>
                              <p className="text-xl font-black text-white">
                                {assemblyPerformance.government?.totalSeats ||
                                  0}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                Opposition
                              </p>
                              <p className="text-xl font-black text-white">
                                {(assemblyPerformance.opposition?.totalSeats ||
                                  0) +
                                  (assemblyPerformance.others as any[]).reduce(
                                    (a: number, c: any) => a + c.totalSeats,
                                    0,
                                  )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-12">
                          {/* Government Block */}
                          {assemblyPerformance.government && (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-black text-blue-400 uppercase tracking-tighter">
                                  Government (
                                  {assemblyPerformance.government.totalSeats})
                                </h4>
                              </div>
                              <div className="pl-4 border-l-2 border-blue-400/20 space-y-6">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-5 h-5 rounded-[4px]"
                                    style={{
                                      backgroundColor:
                                        assemblyPerformance.government.color,
                                    }}
                                  />
                                  <span className="text-sm font-black text-white tracking-widest uppercase">
                                    {assemblyPerformance.government.name} (
                                    {assemblyPerformance.government.totalSeats})
                                  </span>
                                </div>
                                <div className="pl-8 space-y-3">
                                  {assemblyPerformance.government.parties.map(
                                    (p) => (
                                      <div
                                        key={p.id}
                                        className="flex items-center gap-4 group"
                                      >
                                        <span className="text-gray-700 font-black">
                                          •
                                        </span>
                                        <div
                                          className="w-4 h-4 rounded-sm transition-transform group-hover:scale-110"
                                          style={{ backgroundColor: p.color }}
                                        />
                                        <span className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em]">
                                          {p.abbreviation} ({p.seats})
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Official Opposition Block */}
                          {assemblyPerformance.opposition && (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-black text-white uppercase tracking-tighter">
                                  Official Opposition (
                                  {assemblyPerformance.opposition.totalSeats})
                                </h4>
                              </div>
                              <div className="pl-4 border-l-2 border-red-500/20 space-y-6">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-5 h-5 rounded-[4px]"
                                    style={{
                                      backgroundColor:
                                        assemblyPerformance.opposition.color,
                                    }}
                                  />
                                  <span className="text-sm font-black text-white tracking-widest uppercase">
                                    {assemblyPerformance.opposition.name} (
                                    {assemblyPerformance.opposition.totalSeats})
                                  </span>
                                </div>
                                <div className="pl-8 space-y-3">
                                  {assemblyPerformance.opposition.parties.map(
                                    (p) => (
                                      <div
                                        key={p.id}
                                        className="flex items-center gap-4 group"
                                      >
                                        <span className="text-gray-700 font-black">
                                          •
                                        </span>
                                        <div
                                          className="w-4 h-4 rounded-sm transition-transform group-hover:scale-110"
                                          style={{ backgroundColor: p.color }}
                                        />
                                        <span className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em]">
                                          {p.abbreviation} ({p.seats})
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Other Opposition Block */}
                          {assemblyPerformance.others.length > 0 && (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="text-lg font-black text-white uppercase tracking-tighter">
                                  Other Opposition (
                                  {(assemblyPerformance.others as any[]).reduce(
                                    (a: number, c: any) => a + c.totalSeats,
                                    0,
                                  )}
                                  )
                                </h4>
                              </div>
                              <div className="pl-4 border-l-2 border-white/10 space-y-10">
                                {assemblyPerformance.others.map((group) => (
                                  <div key={group.id} className="space-y-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-5 h-5 rounded-[4px]"
                                        style={{ backgroundColor: group.color }}
                                      />
                                      <span className="text-sm font-black text-white tracking-widest uppercase">
                                        {group.name} ({group.totalSeats})
                                      </span>
                                    </div>
                                    <div className="pl-8 space-y-3">
                                      {group.parties.map((p) => (
                                        <div
                                          key={p.id}
                                          className="flex items-center gap-4 group"
                                        >
                                          <span className="text-gray-700 font-black">
                                            •
                                          </span>
                                          <div
                                            className="w-4 h-4 rounded-sm"
                                            style={{ backgroundColor: p.color }}
                                          />
                                          <span className="text-xs font-bold text-gray-300 uppercase tracking-[0.2em]">
                                            {p.abbreviation} ({p.seats})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <section className="max-w-3xl">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#FFD700]">
                  <HistoryIcon size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">
                    {entityType === EntityType.ASSEMBLY
                      ? "Legislative Archives"
                      : "Official Seat History"}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {entityType === EntityType.ASSEMBLY
                      ? "Chronological record of past assembly sessions, terms, and leadership."
                      : "A chronological log of all incumbents and transfers for this designation."}
                  </p>
                </div>
              </div>

              <div className="space-y-0 pl-4 border-l border-[#FFD700]/20 ml-6">
                {entityType === EntityType.ASSEMBLY &&
                  Array.isArray((entity as Assembly).history) &&
                  (entity as Assembly).history
                    .slice()
                    .reverse()
                    .map((h, i) => (
                      <motion.div
                        key={`${h.term}-${i}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="relative pb-10 group"
                      >
                        <div className="absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-[#050505] border-2 border-[#FFD700] group-hover:scale-150 transition-transform" />
                        <div className="glass-card p-6 ml-4 hover:border-[#FFD700]/40 transition-all">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-[#FFD700] font-black uppercase tracking-[0.2em]">
                              {h.term}
                            </p>
                            {h.notes && (
                              <p className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-1 rounded italic">
                                "{h.notes}"
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {h.chiefMinisterId && (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-gray-400 border border-white/5">
                                  <User size={16} />
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1">
                                    Chief Minister
                                  </p>
                                  <p className="text-sm font-bold text-gray-200">
                                    {personsList.find(
                                      (p) => p.id === h.chiefMinisterId,
                                    )?.name || "Former Legislator"}
                                  </p>
                                </div>
                              </div>
                            )}
                            {h.speakerId && (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-gray-400 border border-white/5">
                                  <Landmark size={16} />
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest leading-none mb-1">
                                    Speaker
                                  </p>
                                  <p className="text-sm font-bold text-gray-200">
                                    {personsList.find(
                                      (p) => p.id === h.speakerId,
                                    )?.name || "Former Legislator"}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}

                {entityType === EntityType.PERSON &&
                  (entity as Person).roleHistory &&
                  (() => {
                    const history = (entity as Person).roleHistory || [];
                    // Filter duplicates (same role, assembly, same action - keep first within 1 min window)
                    const filteredHistory = history.filter((h, idx) => {
                      const firstIdx = history.findIndex(
                        (h2) =>
                          h2.role === h.role &&
                          h2.assemblyId === h.assemblyId &&
                          h2.action === h.action &&
                          Math.abs(h2.date - h.date) < 60000,
                      );
                      return firstIdx === idx;
                    });

                    return filteredHistory
                      .slice()
                      .reverse()
                      .map((h, i) => {
                        const isActive =
                          h.action === "promotion" &&
                          (entity as Person).assemblyRoles?.[
                            h.assemblyId
                          ]?.includes(h.role);

                        return (
                          <motion.div
                            key={`${h.role}-${h.date}-${i}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="relative pb-10 group"
                          >
                            <div
                              className={`absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-[#050505] border-2 ${isActive ? "border-emerald-500 scale-125" : "border-blue-500"} group-hover:scale-150 transition-transform`}
                            />
                            <div
                              className={`glass-card p-6 ml-4 hover:border-blue-500/40 transition-all ${isActive ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-blue-500/10"}`}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <p
                                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                      h.action === "promotion"
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : h.action === "resignation"
                                          ? "bg-orange-500/10 text-orange-500"
                                          : "bg-red-500/10 text-red-500"
                                    }`}
                                  >
                                    {h.action}
                                  </p>
                                  {isActive && (
                                    <span className="text-[8px] bg-emerald-500 text-black px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                                      Currently Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono font-bold tracking-tight bg-white/5 px-2 py-1 rounded">
                                  {new Date(h.date).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tight mb-2">
                                  {h.role}
                                </h4>
                                <div
                                  className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                                  onClick={() =>
                                    navigate(`/assembly/${h.assemblyId}`)
                                  }
                                >
                                  <Landmark size={14} />
                                  <span className="text-[10px] uppercase font-black tracking-[0.2em]">
                                    {assembliesList.find(
                                      (a) => a.id === h.assemblyId,
                                    )?.name || "Legislative Council"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      });
                  })()}

                {entityType === EntityType.DESIGNATION &&
                  Array.isArray((entity as Designation).history) &&
                  (() => {
                    const history = (entity as Designation).history || [];
                    const filteredHistory = history.filter((h, idx) => {
                      const firstIdx = history.findIndex(
                        (h2) =>
                          h2.personId === h.personId &&
                          h2.reason === h.reason &&
                          Math.abs(h2.date - h.date) < 60000,
                      );
                      return firstIdx === idx;
                    });

                    return filteredHistory
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <motion.div
                          key={`${h.personId}-${h.date}-${i}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="relative pb-10 group"
                        >
                          <div className="absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-[#050505] border-2 border-[#FFD700] group-hover:scale-150 transition-transform" />
                          <div className="glass-card p-6 ml-4 hover:border-[#FFD700]/40 transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-[#FFD700] font-black uppercase tracking-widest">
                                {h.reason}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">
                                {new Date(h.date).toLocaleString()}
                              </p>
                            </div>
                            <div className="mt-4">
                              {personsList.find((p) => p.id === h.personId) ? (
                                <EntityCard
                                  entity={
                                    personsList.find(
                                      (p) => p.id === h.personId,
                                    )!
                                  }
                                  type={EntityType.PERSON}
                                  onEdit={() => {}}
                                />
                              ) : (
                                <div className="flex items-center gap-3 opacity-50">
                                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-600 border border-white/5">
                                    <User size={20} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-400">
                                      Former Legislator
                                    </p>
                                    <p className="text-[10px] text-gray-600 font-mono tracking-tighter uppercase">
                                      {h.personId}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ));
                  })()}
                {((entityType === EntityType.DESIGNATION &&
                  (!(entity as Designation).history ||
                    (entity as Designation).history?.length === 0)) ||
                  (entityType === EntityType.ASSEMBLY &&
                    (!(entity as Assembly).history ||
                      (entity as Assembly).history?.length === 0))) && (
                  <p className="text-gray-600 font-bold uppercase tracking-widest py-10 pl-6">
                    No historical records found for this seat
                  </p>
                )}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Popups */}
      <AnimatePresence>
        {showPromotePopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPromotePopup(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-card border-blue-500/20 p-8 relative"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-4">
                  <Shield size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">
                  Ministerial Promotion
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Promoting{" "}
                  <span className="text-white font-bold">
                    {showPromotePopup.personName}
                  </span>{" "}
                  to the state cabinet. Specify the department portfolio.
                </p>

                <div className="space-y-4 mb-6 text-left">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 shadow-sm block">
                      Portfolio Department
                    </label>
                    <input
                      type="text"
                      value={departmentInput}
                      onChange={(e) => setDepartmentInput(e.target.value)}
                      placeholder="e.g. Finance, Education, Home..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPromotePopup(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!departmentInput.trim()}
                    onClick={handlePromote}
                    className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Roll
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSupportAlliancePopup && (
          <div
            key="support-alliance-popup"
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSupportAlliancePopup(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-card border-yellow-500/20 p-8 relative"
            >
              <button
                onClick={() => setShowSupportAlliancePopup(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 text-yellow-400 flex items-center justify-center mx-auto mb-4">
                  <Award size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">
                  Declare Alliance Support
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Select an alliance for independent MLA{" "}
                  <span className="text-white font-bold">
                    {showSupportAlliancePopup.personName}
                  </span>{" "}
                  to support.
                </p>

                <div className="space-y-2 mb-6 text-left max-h-60 overflow-y-auto custom-scrollbar">
                  {/* Standalone/Neutral Option */}
                  <button
                    onClick={async () => {
                      const assembly = await db.assemblies.get(id!);
                      if (assembly) {
                        const supports = {
                          ...(assembly.independentSupports || {}),
                        };
                        delete supports[showSupportAlliancePopup.personId];
                        await db.assemblies.update(id!, {
                          independentSupports: supports,
                        });
                      }
                      setShowSupportAlliancePopup(null);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                      !(entity as Assembly)?.independentSupports?.[
                        showSupportAlliancePopup.personId
                      ]
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : "bg-white/5 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white">
                        Neutral / Pure Independent
                      </p>
                      <p className="text-[9px] text-gray-500">
                        Do not support any alliance
                      </p>
                    </div>
                    {!(entity as Assembly)?.independentSupports?.[
                      showSupportAlliancePopup.personId
                    ] && <div className="w-2 h-2 rounded-full bg-yellow-400" />}
                  </button>

                  {/* Alliances */}
                  {alliancesList.map((alliance) => {
                    const isSelected =
                      (entity as Assembly)?.independentSupports?.[
                        showSupportAlliancePopup.personId
                      ] === alliance.id;
                    return (
                      <button
                        key={alliance.id}
                        onClick={async () => {
                          const assembly = await db.assemblies.get(id!);
                          if (assembly) {
                            const supports = {
                              ...(assembly.independentSupports || {}),
                            };
                            supports[showSupportAlliancePopup.personId] =
                              alliance.id;
                            await db.assemblies.update(id!, {
                              independentSupports: supports,
                            });
                          }
                          setShowSupportAlliancePopup(null);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-white/5 border-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-white">
                            {alliance.name}
                          </p>
                          <p className="text-[9px] text-gray-400">
                            Abbreviation: {alliance.abbreviation}
                          </p>
                        </div>
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center shrink-0"
                          style={{
                            borderColor: isSelected
                              ? alliance.colors?.[0] || "#3b82f6"
                              : undefined,
                          }}
                        >
                          {isSelected && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  alliance.colors?.[0] || "#3b82f6",
                              }}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSupportAlliancePopup(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showDeletePopup && (
          <div
            key="delete-popup-wrapper"
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              key="delete-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeletePopup(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="delete-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-card border-red-500/20 p-8 relative"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Final Confirmation</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Are you sure you want to remove this entry from the Kerala
                  legislative records?
                </p>

                {entityType === EntityType.DESIGNATION &&
                (entity as Designation).incumbentId !== "vacant" ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">
                        Incumbent Management
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => removeIncumbent("expiry")}
                          className="w-full py-2 bg-white/5 hover:bg-[#FFD700]/20 hover:text-[#FFD700] rounded-lg text-xs font-bold transition-all border border-white/5"
                        >
                          Mark as Term Expired
                        </button>
                        <button
                          onClick={() => removeIncumbent("resignation")}
                          className="w-full py-2 bg-white/5 hover:bg-[#FFD700]/20 hover:text-[#FFD700] rounded-lg text-xs font-bold transition-all border border-white/5"
                        >
                          Mark as Resignation
                        </button>
                      </div>
                    </div>
                    <div className="pt-2">
                      <p className="text-[10px] text-red-500/50 uppercase font-black tracking-widest mb-2">
                        Abolish Seat
                      </p>
                      <button
                        onClick={handleDelete}
                        className="w-full py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl font-bold transition-all border border-red-500/20"
                      >
                        Abolish Designation Permanently
                      </button>
                    </div>
                    <button
                      onClick={() => setShowDeletePopup(false)}
                      className="w-full py-3 text-gray-500 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : entityType === EntityType.CONSTITUENCY &&
                  (entity as Constituency).currentIncumbentId !== "vacant" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 mb-4">
                      Would you like to vacate the primary seat or delete the
                      constituency master record?
                    </p>
                    <button
                      onClick={() => {
                        setShowDeletePopup(false);
                        setShowVacateMlaReasonModal(true);
                      }}
                      className="w-full py-3 bg-white/5 hover:bg-[#FFD700]/10 text-[#FFD700] rounded-xl font-bold border border-[#FFD700]/20 font-sans"
                      id="con-vacate-btn"
                    >
                      Vacate Primary Seat
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-bold font-sans"
                      id="con-delete-btn"
                    >
                      Delete Master Record
                    </button>
                    <button
                      onClick={() => setShowDeletePopup(false)}
                      className="w-full py-3 text-gray-500 font-sans"
                      id="con-cancel-btn"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleDelete}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 hover:scale-[1.02] transition-transform font-sans"
                      id="perm-delete-btn"
                    >
                      PERMANENTLY DELETE
                    </button>
                    <button
                      onClick={() => setShowDeletePopup(false)}
                      className="w-full py-3 text-gray-400 hover:text-white transition-colors font-sans"
                      id="go-back-btn"
                    >
                      Go Back
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showVacateMlaReasonModal && (
          <div
            key="vacate-mla-reason-modal"
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVacateMlaReasonModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-card border-red-500/20 p-8 relative"
            >
              <button
                onClick={() => setShowVacateMlaReasonModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                id="close-vacate-reason-btn"
              >
                <X size={16} />
              </button>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} />
                </div>
                <h3
                  className="text-xl font-bold mb-2 uppercase tracking-tight font-sans"
                  id="vacate-reason-title"
                >
                  Select Removal Reason
                </h3>
                <p className="text-gray-500 text-sm mb-6 font-sans">
                  Select the reason for vacating the seat of constituency{" "}
                  <span className="text-white font-bold">
                    {(entity as Constituency)?.name}
                  </span>
                  .
                </p>

                <div className="space-y-2 mb-6 text-left">
                  {[
                    "Resigned",
                    "Expired",
                    "Suspended by hon'ble highcourt",
                    "Suspended by hon'ble supreme court",
                  ].map((reason) => (
                    <button
                      key={reason}
                      id={`reason-btn-${reason.replace(/[\s']/g, "-").toLowerCase()}`}
                      onClick={async () => {
                        await removeConstituencyIncumbent(reason);
                      }}
                      className="w-full text-left p-3.5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl transition-all border border-white/5 text-xs font-bold text-gray-300 hover:text-white flex items-center justify-between"
                    >
                      <span className="font-sans">{reason}</span>
                      <ChevronRight size={14} className="text-gray-500" />
                    </button>
                  ))}
                </div>
                <button
                  id="cancel-vacate-reason-btn"
                  onClick={() => setShowVacateMlaReasonModal(false)}
                  className="w-full text-center text-gray-400 hover:text-white text-xs font-bold py-2 font-sans"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showElectModal && entityType === EntityType.CONSTITUENCY && (
          <ElectModal
            constituencyName={(entity as Constituency).name}
            previousPartyAbbreviation={constituencyPreviousPartyAbbr || 'new constituency'}
            personsList={personsList || []}
            partiesList={partiesList || []}
            onClose={() => setShowElectModal(false)}
            onConfirm={handleConfirmElection}
          />
        )}

        {showAppointPopup && (
          <div
            key="appoint-popup-wrapper"
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              key="appoint-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAppointPopup}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="appoint-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg glass-card p-8 relative"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus size={24} className="gold-text" /> Appoint
                  Legislator
                </h3>
                <button
                  onClick={closeAppointPopup}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="relative mb-6">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={appointmentSearchQuery}
                  onChange={(e) => setAppointmentSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-[#FFD700]/50 transition-colors"
                  autoFocus
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
                {filteredAppointmentPersons.map((p) => {
                  const party = partiesList.find(
                    (prty) => prty.id === p.partyId,
                  );
                  const alliance = alliancesList.find(
                    (a) => a.id === party?.allianceId,
                  );
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectAppointedPerson(p.id)}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-[#FFD700]/5 hover:border-[#FFD700]/30 cursor-pointer transition-all"
                    >
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-bold">{p.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                            {party?.abbreviation || p.partyId}
                          </p>
                          {alliance && (
                            <>
                              <span className="text-[8px] text-gray-700">
                                •
                              </span>
                              <p className="text-[10px] text-[#FFD700] uppercase font-black tracking-widest bg-[#FFD700]/5 px-2 py-0.5 rounded border border-[#FFD700]/10">
                                {alliance.name}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-600" />
                    </div>
                  );
                })}
                {filteredAppointmentPersons.length === 0 && (
                  <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                    <p className="text-gray-500 text-sm">
                      No politicians found matching your search.
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={closeAppointPopup}
                className="w-full py-4 mt-6 text-gray-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}

        {showDeactivatePopup && (
          <div
            key="deactivate-popup-wrapper"
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              key="deactivate-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeactivatePopup(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="deactivate-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-card border-orange-500/20 p-8 relative"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-4">
                  <HistoryIcon size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2 uppercase">
                  Dissolve Assembly
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  ENDING TERM will mark this assembly as DISSOLVED. This action
                  reflects a historical transition in the legislative records.
                  Proceed?
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDeactivate}
                    className="w-full py-3 bg-orange-500 text-black font-black rounded-xl border border-orange-500/20 shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-transform"
                  >
                    CONFIRM DISSOLUTION
                  </button>
                  <button
                    onClick={() => setShowDeactivatePopup(false)}
                    className="w-full py-3 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {confirmationDialog.show && (
          <div
            key="confirmation-popup-wrapper"
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              key="confirmation-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                setConfirmationDialog((prev) => ({ ...prev, show: false }))
              }
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="confirmation-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-card p-8 relative border border-white/10 shadow-2xl"
            >
              <div className="text-center">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmationDialog.isDestructive ? "bg-red-500/10 text-red-500" : "bg-[#FFD700]/10 text-[#FFD700]"}`}
                >
                  {confirmationDialog.isDestructive ? (
                    <Trash2 size={32} />
                  ) : (
                    <AlertCircle size={32} />
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">
                  {confirmationDialog.title}
                </h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                  {confirmationDialog.message}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setConfirmationDialog((prev) => ({
                        ...prev,
                        show: false,
                      }))
                    }
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await confirmationDialog.onConfirm();
                      } catch (err) {
                        console.error("Confirmation action failed:", err);
                        alert(
                          `Action failed: ${err instanceof Error ? err.message : String(err)}`,
                        );
                      }
                      setConfirmationDialog((prev) => ({
                        ...prev,
                        show: false,
                      }));
                    }}
                    className={`flex-1 py-3 rounded-xl text-black font-black text-xs uppercase tracking-widest transition-all shadow-lg ${confirmationDialog.isDestructive ? "bg-red-500 shadow-red-500/20 hover:bg-red-600" : "bg-[#FFD700] shadow-[#FFD700]/20 hover:scale-105"}`}
                  >
                    {confirmationDialog.confirmText || "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddPartyModal && (
          <div
            key="add-party-popup-wrapper"
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              key="add-party-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPartyModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="add-party-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg glass-card p-8 relative flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Flag size={24} className="gold-text" /> Add Party to Alliance
                </h3>
                <button
                  onClick={() => setShowAddPartyModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search parties..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#FFD700]/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {filteredParties.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddPartyToAlliance(p.id)}
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-[#FFD700]/5 hover:border-[#FFD700]/30 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center border border-white/5">
                      {p.logoUrl ? (
                        <img
                          src={p.logoUrl}
                          alt={p.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Flag className="text-[#FFD700]" size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold group-hover:text-white transition-colors">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                        {p.abbreviation}
                      </p>
                    </div>
                    <Plus
                      size={16}
                      className="text-gray-600 group-hover:text-[#FFD700]"
                    />
                  </div>
                ))}
                {filteredParties.length === 0 && (
                  <div className="text-center py-10 px-6">
                    <p className="text-gray-600 italic mb-2">
                      No available independent parties found
                    </p>
                    <p className="text-[10px] text-gray-700 uppercase tracking-widest leading-relaxed">
                      Parties must leave their current alliance before they can
                      be added to a new one.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showAddPersonModal && (
          <div
            key="add-person-popup-wrapper"
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              key="add-person-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPersonModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="add-person-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg glass-card p-8 relative flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus size={24} className="gold-text" /> Add Member to
                  Party
                </h3>
                <button
                  onClick={() => setShowAddPersonModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search legislators..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#FFD700]/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {filteredPersons.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddPersonToParty(p.id)}
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-[#FFD700]/5 hover:border-[#FFD700]/30 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center border border-white/5 overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="text-[#FFD700]" size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold group-hover:text-white transition-colors">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                        Independent / Unaffiliated
                      </p>
                    </div>
                    <Plus
                      size={16}
                      className="text-gray-600 group-hover:text-[#FFD700]"
                    />
                  </div>
                ))}
                {filteredPersons.length === 0 && (
                  <div className="text-center py-10 px-6">
                    <p className="text-gray-600 italic mb-2">
                      No available independent persons found
                    </p>
                    <p className="text-[10px] text-gray-700 uppercase tracking-widest leading-relaxed">
                      Legislators must leave their current party before they can
                      join a new one.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showManageHighCommandModal && (
          <div
            key="manage-high-command-popup-wrapper"
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              key="manage-high-command-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManageHighCommandModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="manage-high-command-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg glass-card p-8 relative flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-[#D32F2F]">
                  <Shield size={24} /> Manage High Command
                </h3>
                <button
                  onClick={() => setShowManageHighCommandModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-4">
                Eligible members must belong to alliance constituent parties.
              </p>

              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search alliance members..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#D32F2F]/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {filteredHighCommandEligible.map((p) => {
                  const isSelected = (
                    entity as Alliance
                  ).highCommandIds?.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleToggleHighCommand(p.id)}
                      className={`p-4 border rounded-2xl flex items-center gap-4 cursor-pointer transition-all group ${isSelected ? "bg-[#D32F2F]/10 border-[#D32F2F]/50" : "bg-white/5 border-white/5 hover:border-[#D32F2F]/30"}`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center border border-white/5 overflow-hidden">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="text-[#FFD700]" size={24} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`font-bold transition-colors ${isSelected ? "text-white" : "group-hover:text-white"}`}
                        >
                          {p.name}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                          {partiesList.find((party) => party.id === p.partyId)
                            ?.abbreviation || "Member"}
                        </p>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${isSelected ? "bg-[#D32F2F] border-[#D32F2F] text-white" : "border-white/10 group-hover:border-[#D32F2F]/50"}`}
                      >
                        {isSelected ? <X size={14} /> : <Plus size={14} />}
                      </div>
                    </div>
                  );
                })}
                {filteredHighCommandEligible.length === 0 && (
                  <div className="text-center py-10 px-6">
                    <p className="text-gray-600 italic mb-2">
                      No eligible members found
                    </p>
                    <p className="text-[10px] text-gray-700 uppercase tracking-widest leading-relaxed">
                      Ensure parties are added to this alliance first.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CreateModals
        type={entityType}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editData={entity}
      />
    </div>
  );
};
