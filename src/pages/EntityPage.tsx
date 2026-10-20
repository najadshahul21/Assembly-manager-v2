import React, { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { useDbLookup } from "../context/DbLookupContext";
import { firestoreService } from "../firestoreService";
import {
  EntityType,
  Person,
  Party,
  Alliance,
  Assembly,
  Designation,
  Constituency,
  ElectionResult,
  formatOfficeOfHonble,
  LegislativeOrder,
  LegislativeBill,
} from "../types";
import { BillsList } from "../components/BillsList";
import { CreateBillModal } from "../components/CreateBillModal";
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
  Stamp,
  Scale,
  Crown,
  CheckCircle2,
  Network,
  FileText,
  FilePlus,
} from "lucide-react";
import { EntityCard } from "../components/EntityCards";
import { ElectionResultsTable } from "../components/ElectionResultsTable";
import { ElectModal } from "../components/ElectModal";
import { AssemblyMembersTable } from "../components/AssemblyMembersTable";
import {
  computeAssemblyGovernmentComposition,
  isSpeakerOrDeputySpeakerRole,
  isMinisterialRole,
  getConstituencyCreationAssembly,
  compareOrdersReverseChronological,
  prefixRole,
  formatCommaSeparatedRoles,
  formatPersonName,
  getActiveAssembly,
} from "../utils/governmentUtils";

import { CreateModals } from "../components/CreateModals";
import { LeadershipCouncilModal } from "../components/LeadershipCouncilModal";
import { AllianceInfoboxTable } from "../components/AllianceInfoboxTable";
import { AssemblyInfoboxTable } from "../components/AssemblyInfoboxTable";
import { PartyInfoboxTable } from "../components/PartyInfoboxTable";
import { ConstituencyInfoboxTable } from "../components/ConstituencyInfoboxTable";
import { AllianceConstituentPartiesTable } from "../components/AllianceConstituentPartiesTable";
import { LegislativeSessionsTable } from "../components/LegislativeSessionsTable";
import { buildLegislativeSessionsList, extractOrdinal } from "../data/legislativeHistoryData";
import { LegislativeRolesHistoryWidget } from "../components/LegislativeRolesHistoryWidget";
import { formatAppDate, formatAppDateTime, getSystemTimestamp } from "../utils/dateUtils";
import { useSystemDate } from "../context/SystemDateContext";

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

import { useAuth } from "../context/AuthContext";

export const EntityPage: React.FC = () => {
  const { isViewerMode } = useAuth();
  const { systemDate } = useSystemDate();
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get("tab") as any;

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [showAppointPopup, setShowAppointPopup] = useState(false);
  const [showElectModal, setShowElectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [appointingCouncilRole, setAppointingCouncilRole] = useState<
    "leader" | "chairman" | "founder" | null
  >(null);
  const [councilSearchQuery, setCouncilSearchQuery] = useState("");

  const handleConfirmElection = async (
    winnerPersonId: string | undefined,
    result: ElectionResult
  ) => {
    if (!id || !entity || entityType !== EntityType.CONSTITUENCY) return;

    try {
      await firestoreService.confirmElection(id, winnerPersonId, result, currentActiveAssembly?.id);
      setShowElectModal(false);
    } catch (error: any) {
      console.error("Failed to confirm election:", error);
      alert(error.message || "Failed to confirm election.");
    }
  };
  const [showDeactivatePopup, setShowDeactivatePopup] = useState(false);
  const [showVacateMlaReasonModal, setShowVacateMlaReasonModal] =
    useState(false);
  const [vacateReasonType, setVacateReasonType] = useState<"resignation" | "expiry" | null>(null);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    show: boolean;
    loading: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    isDestructive?: boolean;
    error?: string | null;
  }>({
    show: false,
    loading: false,
    title: "",
    message: "",
    onConfirm: () => {},
    error: null
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
  const [isLeadershipModalOpen, setIsLeadershipModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "details" | "related" | "history" | "cabinet" | "orders" | "bills"
  >(
    initialTab === "sessions"
      ? (type === EntityType.CONSTITUENCY ? "related" : "history")
      : initialTab &&
        ["details", "related", "history", "cabinet", "orders"].includes(initialTab)
      ? (initialTab as any)
      : "details",
  );
  const [isCreateBillModalOpen, setIsCreateBillModalOpen] = useState(false);
  const [bills, setBills] = useState<LegislativeBill[]>([]);
  const [alliancePartiesViewMode, setAlliancePartiesViewMode] = useState<"table" | "grid">("table");

  const entityType = type as EntityType;

  const { 
    persons: personsList, 
    parties: partiesList, 
    assemblies: assembliesList, 
    alliances: alliancesList, 
    constituencies: constituenciesList, 
    designations: designationsList,
    orders: ordersList,
    bills: billsFromLookup,
    loaded: dbLoaded
  } = useDbLookup();

  React.useEffect(() => {
    if (entityType === EntityType.ASSEMBLY && id && dbLoaded) {
      const fetchBills = async () => {
        try {
          const fetchedBills = await firestoreService.getBillsByAssembly(id);
          setBills(fetchedBills);
        } catch (error) {
          console.error("Error fetching bills:", error);
        }
      };
      fetchBills();
    }
  }, [id, entityType, dbLoaded]);

  const entity = useMemo(() => {
    if (!id || !dbLoaded) return null;
    switch (entityType) {
      case EntityType.PERSON:
        return personsList?.find(p => p.id === id);
      case EntityType.PARTY:
        return partiesList?.find(p => p.id === id);
      case EntityType.ALLIANCE:
        return alliancesList?.find(a => a.id === id);
      case EntityType.ASSEMBLY:
        return assembliesList?.find(a => a.id === id);
      case EntityType.DESIGNATION:
        return designationsList?.find(d => d.id === id);
      case EntityType.CONSTITUENCY:
        return constituenciesList?.find(c => c.id === id);
      default:
        return null;
    }
  }, [id, entityType, personsList, partiesList, alliancesList, assembliesList, designationsList, dbLoaded]);

  const entityOrders = useMemo(() => {
    if (!id || !ordersList) return [];
    let matching: LegislativeOrder[] = [];
    if (entityType === EntityType.PERSON) {
      matching = ordersList.filter(o => o.signerPersonId === id || o.taggedPersonIds?.includes(id));
    } else if (entityType === EntityType.DESIGNATION) {
      matching = ordersList.filter(o => o.byDesignationId === id || (entity && (entity as Designation).name === o.byDesignationName));
    }
    return matching.sort(compareOrdersReverseChronological);
  }, [id, entityType, entity, ordersList]);

  const relatedPersons = useMemo(() => {
    if (!id || !personsList) return [];
    let list: Person[] = [];
    if (entityType === EntityType.PARTY) {
      list = personsList.filter(p => p.partyId === id);
    } else if (entityType === EntityType.ALLIANCE) {
      const pIds = partiesList?.filter(p => p.allianceId === id).map(p => p.id) || [];
      list = personsList.filter(p => pIds.includes(p.partyId));
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [id, entityType, personsList, partiesList]);

  const relatedParties = useMemo(() => {
    if (!id || !partiesList) return [];
    if (entityType === EntityType.ALLIANCE) {
      return partiesList.filter(p => p.allianceId === id).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }
    return [];
  }, [id, entityType, partiesList]);

  const currentActiveAssembly = useMemo(() => {
    return getActiveAssembly(assembliesList || []);
  }, [assembliesList]);

  const leadingParty = useMemo(() => {
    if (entityType === EntityType.ALLIANCE && entity) {
      const lpId = (entity as Alliance).leadingPartyId;
      return partiesList?.find(p => p.id === lpId) || null;
    }
    return null;
  }, [entity, entityType, partiesList]);

  const associatedConstituency = useMemo(() => {
    if (entityType === EntityType.DESIGNATION && entity) {
      const conId = (entity as Designation).constituencyId;
      return constituenciesList?.find(c => c.id === conId) || null;
    }
    return null;
  }, [entity, entityType, constituenciesList]);

  const associatedAssembly = useMemo(() => {
    if (entityType === EntityType.DESIGNATION && entity) {
      const asmId = (entity as Designation).assemblyId;
      return assembliesList?.find(a => a.id === asmId) || null;
    }
    return null;
  }, [entity, entityType, assembliesList]);

  const partyAlliance = useMemo(() => {
    if (entityType === EntityType.PARTY && entity) {
      const allianceId = (entity as Party).allianceId;
      if (allianceId && allianceId !== "independent") {
        return alliancesList?.find(a => a.id === allianceId) || null;
      }
    }
    return null;
  }, [entity, entityType, alliancesList]);

  const personParty = useMemo(() => {
    if (entityType === EntityType.PERSON && entity) {
      const partyId = (entity as Person).partyId;
      if (partyId && partyId !== "independent") {
        return partiesList?.find(p => p.id === partyId) || null;
      }
    }
    return null;
  }, [entity, entityType, partiesList]);

  const constituencyPreviousPartyAbbr = useMemo(() => {
    if (entityType === EntityType.CONSTITUENCY && entity) {
      const con = entity as Constituency;
      if (con.currentIncumbentId && con.currentIncumbentId !== 'vacant') {
        const person = personsList?.find(p => p.id === con.currentIncumbentId);
        if (person?.partyId && person.partyId !== 'independent') {
          const party = partiesList?.find(pt => pt.id === person.partyId);
          if (party?.abbreviation) return party.abbreviation;
        }
      }
      if (con.lastElectionResult?.winnerPartyAbbreviation) {
        return con.lastElectionResult.winnerPartyAbbreviation;
      }
    }
    return 'new constituency';
  }, [entityType, entity, personsList, partiesList]);

  const constituencyCreationAssembly = useMemo(() => {
    if (entityType !== EntityType.CONSTITUENCY || !entity) return null;
    const con = entity as Constituency;
    return getConstituencyCreationAssembly(con, assembliesList || []);
  }, [entityType, entity, assembliesList]);

  const constituencyCurrentAssembly = useMemo(() => {
    if (entityType !== EntityType.CONSTITUENCY || !entity) return null;
    const con = entity as Constituency;
    if (con.currentAssemblyId) {
      return assembliesList?.find(a => a.id === con.currentAssemblyId) || null;
    }
    return assembliesList?.find(a => a.isActive !== false) || null;
  }, [entityType, entity, assembliesList]);

  const constituencyIncumbentPerson = useMemo(() => {
    if (entityType !== EntityType.CONSTITUENCY || !entity) return null;
    const con = entity as Constituency;
    if (con.currentIncumbentId && con.currentIncumbentId !== "vacant") {
      return personsList?.find(p => p.id === con.currentIncumbentId) || null;
    }
    return null;
  }, [entityType, entity, personsList]);

  const constituencyIncumbentParty = useMemo(() => {
    if (!constituencyIncumbentPerson?.partyId || constituencyIncumbentPerson.partyId === "independent") {
      return null;
    }
    return partiesList?.find(p => p.id === constituencyIncumbentPerson.partyId) || null;
  }, [constituencyIncumbentPerson, partiesList]);

  const constituencyIncumbentAlliance = useMemo(() => {
    if (!constituencyIncumbentParty?.allianceId || constituencyIncumbentParty.allianceId === "independent") {
      return null;
    }
    return alliancesList?.find(a => a.id === constituencyIncumbentParty.allianceId) || null;
  }, [constituencyIncumbentParty, alliancesList]);

  const handleSaveConstituencyMetadata = async (updatedFields: Partial<Constituency>) => {
    if (!id || entityType !== EntityType.CONSTITUENCY) return;
    await firestoreService.updateConstituency(id, updatedFields);
  };

  const designationsFromConstituency = useMemo(() => {
    if (entityType === EntityType.CONSTITUENCY && entity) {
      const con = entity as Constituency;
      const results: any[] = [];
      
      if (con.currentAssemblyId) {
        const assembly = assembliesList?.find(a => a.id === con.currentAssemblyId);
        const incumbent = con.currentIncumbentId && con.currentIncumbentId !== "vacant"
          ? personsList?.find(p => p.id === con.currentIncumbentId)
          : null;
        results.push({
          id: `current-${con.id}`,
          assembly,
          incumbent,
          incumbentId: con.currentIncumbentId,
          date: con.updatedAt,
        });
      }

      if (Array.isArray(con.history)) {
        for (const h of con.history) {
          const assembly = h.assemblyId ? assembliesList?.find(a => a.id === h.assemblyId) : null;
          const incumbent = h.personId && h.personId !== "vacant" ? personsList?.find(p => p.id === h.personId) : null;
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

      const legacyDesigs = designationsList?.filter(d => d.constituencyId === id) || [];
      for (const d of legacyDesigs) {
        if (!results.some((r) => r.assembly?.id === d.assemblyId)) {
          const assembly = d.assemblyId ? assembliesList?.find(a => a.id === d.assemblyId) : null;
          const incumbent = d.incumbentId && d.incumbentId !== "vacant" ? personsList?.find(p => p.id === d.incumbentId) : null;
          results.push({ ...d, assembly, incumbent, date: d.updatedAt });
        }
      }

      const sorted = results.sort((a, b) => (b.date || 0) - (a.date || 0));
      return sorted.filter((item, idx) => {
        const asmId = item.assembly?.id || "none";
        return sorted.findIndex((other) => (other.assembly?.id || "none") === asmId) === idx;
      });
    }
    return [];
  }, [entity, entityType, id, assembliesList, personsList, designationsList]);

  const sessionRows = useMemo(() => {
    if (!entity || !dbLoaded) return [];
    if (entityType === EntityType.CONSTITUENCY || entityType === EntityType.DESIGNATION) {
      return buildLegislativeSessionsList({
        entityType,
        entity,
        assemblies: assembliesList || [],
        persons: personsList || [],
        parties: partiesList || [],
        alliances: alliancesList || [],
        designations: designationsList || [],
      });
    }
    return [];
  }, [entity, entityType, assembliesList, personsList, partiesList, alliancesList, designationsList, dbLoaded]);

  const currentIncumbentPerson = useMemo(() => {
    let personId = "vacant";
    if (entityType === EntityType.CONSTITUENCY && entity) {
      personId = (entity as Constituency).currentIncumbentId;
    } else if (entityType === EntityType.DESIGNATION && entity) {
      personId = (entity as Designation).incumbentId;
    }
    if (personId && personId !== "vacant") {
      return personsList?.find(p => p.id === personId) || null;
    }
    return null;
  }, [entity, entityType, personsList]);

  const precededByAssembly = useMemo(() => {
    if (entityType === EntityType.ASSEMBLY && entity && (entity as Assembly).precededById) {
      return assembliesList?.find(a => a.id === (entity as Assembly).precededById) || null;
    }
    return null;
  }, [entity, entityType, assembliesList]);

  const followedByAssembly = useMemo(() => {
    if (entityType === EntityType.ASSEMBLY && entity) {
      return assembliesList?.find(a => a.precededById === (entity as Assembly).id) || null;
    }
    return null;
  }, [entity, entityType, assembliesList]);

  const allianceLeadership = useMemo(() => {
    if (entityType !== EntityType.ALLIANCE || !entity) return null;
    const alliance = entity as Alliance;
    const leader = alliance.leaderId ? personsList?.find(p => p.id === alliance.leaderId) : null;
    const chairman = alliance.chairmanId ? personsList?.find(p => p.id === alliance.chairmanId) : null;
    const founder = alliance.founderId ? personsList?.find(p => p.id === alliance.founderId) : null;
    return { leader, chairman, founder };
  }, [entity, entityType, personsList]);

  const personHasActiveDesignation = useMemo(() => {
    if (entityType !== EntityType.PERSON || !entity || !assembliesList) return false;
    const person = entity as Person;
    if (person.constituencyName && person.constituencyName !== 'Special Role') return true;
    const activeAssemblyIds = new Set(assembliesList.filter(a => a.isActive !== false).map(a => a.id));
    if (person.assemblyRoles) {
      for (const aId of Object.keys(person.assemblyRoles)) {
        if (activeAssemblyIds.has(aId)) return true;
      }
    }
    if (person.designations && person.designations.length > 0) return true;
    for (const a of assembliesList) {
      if (a.isActive !== false && a.leaders) {
        if (Object.values(a.leaders).includes(person.id)) return true;
      }
    }
    return false;
  }, [entity, entityType, assembliesList]);

  const highCommandMembers = useMemo(() => {
    if (entityType !== EntityType.ALLIANCE || !entity || !id || !personsList || !partiesList) return [];
    const alliance = entity as Alliance;
    const currentHighCommandIds = alliance.highCommandIds || [];
    if (currentHighCommandIds.length === 0) return [];
    const alliancePartyIds = partiesList.filter(p => p.allianceId === id).map(p => p.id);
    const members = personsList.filter(m => currentHighCommandIds.includes(m.id));
    const validMembers = members.filter(m => alliancePartyIds.includes(m.partyId) && !m.isSuspended);
    
    // Automatic removal check
    const validMemberIds = validMembers.map(m => m.id);
    if (JSON.stringify(validMemberIds.sort()) !== JSON.stringify([...currentHighCommandIds].sort())) {
      firestoreService.updateAlliance(id, {
        highCommandIds: validMemberIds
      });
    }
    return validMembers.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [entity, id, entityType, personsList, partiesList]);

  const allianceMemberPartyIds = useMemo(() => {
    if (entityType !== EntityType.ALLIANCE || !id || !partiesList) return new Set<string>();
    return new Set(partiesList.filter((p) => !p.isSuspended && p.allianceId === id).map((p) => p.id));
  }, [entityType, id, partiesList]);

  const personsEligibleForHighCommand = useMemo(() => {
    if (entityType !== EntityType.ALLIANCE || !id || !personsList) return [];
    if (allianceMemberPartyIds.size === 0) return [];
    return personsList
      .filter((p) => allianceMemberPartyIds.has(p.partyId) && !p.isSuspended)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [id, entityType, allianceMemberPartyIds, personsList]);

  const handleAppointCouncilMember = async (personId: string) => {
    if (entityType !== EntityType.ALLIANCE || !id || !appointingCouncilRole || !personsList) return;
    const person = personsList.find(p => p.id === personId);
    if (!person || person.isSuspended) {
      alert("This person is suspended and cannot be appointed to any alliance designation.");
      return;
    }
    const party = partiesList?.find(pt => pt.id === person.partyId);
    if (party?.isSuspended) {
      alert(`Cannot appoint member of suspended party "${party.name}".`);
      return;
    }
    const updates: Partial<Alliance> = {};
    if (appointingCouncilRole === "leader") updates.leaderId = personId;
    else if (appointingCouncilRole === "chairman") updates.chairmanId = personId;
    else if (appointingCouncilRole === "founder") updates.founderId = personId;
    await firestoreService.updateAlliance(id, updates);
    setAppointingCouncilRole(null);
    setCouncilSearchQuery("");
  };

  const handleRemoveCouncilMember = async (role: "leader" | "chairman" | "founder") => {
    if (entityType !== EntityType.ALLIANCE || !id) return;
    const updates: Partial<Alliance> = {};
    if (role === "leader") updates.leaderId = "";
    else if (role === "chairman") updates.chairmanId = "";
    else if (role === "founder") updates.founderId = "";
    await firestoreService.updateAlliance(id, updates);
  };

  const handleToggleHighCommand = async (personId: string) => {
    if (entityType !== EntityType.ALLIANCE || !id || !personsList) return;
    const person = personsList.find(p => p.id === personId);
    if (!person || person.isSuspended) {
      alert("This person is suspended and cannot be appointed to the High Command.");
      return;
    }
    const party = partiesList?.find(pt => pt.id === person.partyId);
    if (party?.isSuspended) {
      alert(`Cannot appoint member of suspended party "${party.name}".`);
      return;
    }
    const alliance = entity as Alliance;
    const currentIds = alliance.highCommandIds || [];
    let newIds: string[] = currentIds.includes(personId) 
      ? currentIds.filter(pid => pid !== personId) 
      : [...currentIds, personId];
    await firestoreService.updateAlliance(id, { highCommandIds: newIds });
  };

  const getEntityLabel = () => {
    switch (entityType) {
      case EntityType.PERSON: return "Politician";
      case EntityType.PARTY: return "Political Party";
      case EntityType.ALLIANCE: return "Political Alliance";
      case EntityType.ASSEMBLY: return "Legislative Assembly";
      case EntityType.DESIGNATION: return "Official Designation";
      case EntityType.CONSTITUENCY: return "Assembly Constituency";
      default: return "";
    }
  };

  const personDesignations = useMemo(() => {
    if (entityType !== EntityType.PERSON || !id || !designationsList || !constituenciesList) return [];
    const filtered = designationsList.filter(d => d.incumbentId === id || (Array.isArray(d.history) && d.history.some(h => h.personId === id)));
    const enriched = filtered.map(d => ({ ...d, assembly: assembliesList?.find(a => a.id === d.assemblyId) }));
    const conFiltered = constituenciesList.filter(c => c.currentIncumbentId === id || (Array.isArray(c.history) && c.history.some(h => h.personId === id)));
    const conEnriched = conFiltered.flatMap(c => {
      const historyEntries = Array.isArray(c.history) ? c.history.filter(h => h.personId === id) : [];
      const currentEntry = c.currentIncumbentId === id ? { assemblyId: c.currentAssemblyId, isCurrent: true } : null;
      const results: any[] = [];
      if (currentEntry) {
        results.push({ id: `con-${c.id}-current`, name: `${c.name} MLA`, incumbentId: id, assembly: assembliesList?.find(a => a.id === currentEntry.assemblyId), constituency: c.name, date: c.updatedAt });
      }
      for (const h of historyEntries) {
        if (currentEntry && h.assemblyId === currentEntry.assemblyId && h.personId === id) continue;
        results.push({ id: `con-${c.id}-${h.date}`, name: `${c.name} MLA`, incumbentId: "other", assembly: assembliesList?.find(a => a.id === h.assemblyId), constituency: c.name, date: h.date, historyEntry: h });
      }
      return results;
    });
    const finalListOfRoles = [...enriched, ...conEnriched];
    const sorted = finalListOfRoles.sort((a, b) => {
      const scoreA = getAssemblyChronologicalScore(a.assembly);
      const scoreB = getAssemblyChronologicalScore(b.assembly);
      if (scoreA !== scoreB) return scoreB - scoreA;
      const aDate = a.date || (Array.isArray(a.history) && a.history.find((h: any) => h.personId === id)?.date) || 0;
      const bDate = b.date || (Array.isArray(b.history) && b.history.find((h: any) => h.personId === id)?.date) || 0;
      return bDate - aDate;
    });
    return sorted.filter((item, idx) => {
      const key = `${item.name}-${item.assembly?.id || "none"}`;
      return sorted.findIndex(other => `${other.name}-${other.assembly?.id || "none"}` === key) === idx;
    });
  }, [type, id, designationsList, constituenciesList, assembliesList]);

  const personAssemblyRoles = useMemo(() => {
    if (entityType !== EntityType.PERSON || !entity || !assembliesList) return [];
    const person = entity as Person;
    const roles: { assembly: Assembly; role: string }[] = [];
    assembliesList.forEach((a) => {
      if (a.leaders) {
        Object.entries(a.leaders).forEach(([role, pId]) => {
          if (pId === id) roles.push({ assembly: a, role });
        });
      }
    });
    if (person.assemblyRoles) {
      for (const [aId, roleStr] of Object.entries(person.assemblyRoles)) {
        const assembly = assembliesList.find((a) => a.id === aId);
        if (assembly) {
          (roleStr as string).split(", ").forEach(r => {
            if (!roles.some(rl => rl.assembly.id === aId && rl.role === r)) roles.push({ assembly, role: r });
          });
        }
      }
    }
    return roles.sort((a, b) => {
      const scoreA = getAssemblyChronologicalScore(a.assembly);
      const scoreB = getAssemblyChronologicalScore(b.assembly);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.role.localeCompare(b.role);
    });
  }, [entity, type, id, assembliesList]);

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
              // Special case: if it's an MLA role like "Constituency MLA", 
              // we might already have it as "MLA for Constituency" from step 1.
              // Normalize for comparison.
              const normalizedR = r.toLowerCase().replace(/\s+mla$/i, '').replace(/^mla for\s+/i, '').trim();

              const exists = roles.some((existing) => {
                const normalizedExisting = existing.name.toLowerCase().replace(/\s+mla$/i, '').replace(/^mla for\s+/i, '').trim();
                return (
                  (existing.name.toLowerCase() === r.toLowerCase() || normalizedExisting === normalizedR) &&
                  existing.assemblyName === assembly.name
                );
              });

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

  const assemblyMembers = useMemo(() => {
    if (entityType !== EntityType.ASSEMBLY || !id || !constituenciesList || !personsList || !designationsList) return [];

    const assemblyRecord = assembliesList?.find(a => a.id === id);
    if (assemblyRecord && !assemblyRecord.isActive && assemblyRecord.composition?.members) {
      return assemblyRecord.composition.members;
    }

    const relevantCs = constituenciesList.filter(c => c.currentAssemblyId === id || (c.history && c.history.some(h => h.assemblyId === id)));
    const ds = designationsList.filter(d => d.assemblyId === id);

    const membersListOutput: any[] = [];
    const addedPersons = new Set<string>();
    const toTime = (d: any) => typeof d === "number" ? d : d ? new Date(d).getTime() : 0;

    for (const con of relevantCs) {
      const conHistory = (con.history || []).filter(h => (h.assemblyId || con.currentAssemblyId || id) === id);
      const personIdsSet = new Set<string>();
      if (con.currentAssemblyId === id && con.currentIncumbentId !== "vacant") personIdsSet.add(con.currentIncumbentId as string);
      conHistory.forEach(h => { if (h.personId && h.personId !== "vacant") personIdsSet.add(h.personId); });

      const personAppointments = Array.from(personIdsSet).map(pId => {
        const entries = conHistory.filter(h => h.personId === pId);
        const electionOrAppt = entries.filter(h => h.reason === "election" || h.reason === "appointment");
        const removal = entries.find(h => h.reason && h.reason !== "election" && h.reason !== "appointment");
        const isActive = con.currentAssemblyId === id && con.currentIncumbentId === pId;
        let earliestDate = electionOrAppt.length > 0 ? Math.min(...electionOrAppt.map(e => toTime(e.date))) : (removal ? toTime(removal.date) - 1 : (isActive ? toTime(con.updatedAt) : (entries.length > 0 ? Math.min(...entries.map(e => toTime(e.date))) : getSystemTimestamp())));
        return { pId, earliestDate, isActive, removal };
      });

      personAppointments.sort((a, b) => {
        if (a.earliestDate !== b.earliestDate) return a.earliestDate - b.earliestDate;
        if (a.removal && !b.removal) return -1;
        if (!a.removal && b.removal) return 1;
        return 0;
      });

      personAppointments.forEach(({ pId, isActive, removal }, index) => {
        const p = personsList.find(item => item.id === pId);
        if (p) {
          let mlaStatusText = "";
          if (!isActive && removal) mlaStatusText = removal.reason.charAt(0).toUpperCase() + removal.reason.slice(1);
          else if (index > 0) mlaStatusText = "Byelected";
          const party = partiesList?.find(item => item.id === p.partyId);
          const alliance = party && party.allianceId !== "independent" ? alliancesList?.find(item => item.id === party.allianceId) : null;
          let baseSubtitle = p.partyId === "independent" ? "Independent" : (party?.name || "Member");
          if (alliance) baseSubtitle = `${baseSubtitle} • ${alliance.name}`;
          membersListOutput.push({ id: p.id, uniqueKey: `${p.id}-${con.id}-${index}`, name: p.name, constituencyName: con.name, partyId: p.partyId, imageUrl: p.imageUrl, subtitleOverride: mlaStatusText ? `${mlaStatusText} | ${baseSubtitle} (${con.name})` : `${baseSubtitle} (${con.name})`, mlaStatusText: mlaStatusText || undefined });
          addedPersons.add(p.id);
        }
      });
    }

    ds.forEach(d => {
      if (d.incumbentId !== "vacant" && !addedPersons.has(d.incumbentId)) {
        const p = personsList.find(item => item.id === d.incumbentId);
        if (p) {
          membersListOutput.push({ id: p.id, uniqueKey: `${p.id}-${d.id}`, name: p.name, constituencyName: d.constituency || "Special Role", partyId: p.partyId, imageUrl: p.imageUrl });
          addedPersons.add(p.id);
        }
      }
    });
    return membersListOutput;
  }, [entityType, id, constituenciesList, personsList, designationsList, assembliesList, partiesList, alliancesList]);

  const assemblyPerformance = useMemo(() => {
    if (entityType !== EntityType.ASSEMBLY || !id || !constituenciesList) return null;

    const linkedConstituencies = constituenciesList.filter(c => c.currentAssemblyId === id || (Array.isArray(c.history) && c.history.some(h => h.assemblyId === id)));
    const assemblyRecord = assembliesList?.find(a => a.id === id);

    if (assemblyRecord && !assemblyRecord.isActive && assemblyRecord.composition) {
      const cached = assemblyRecord.composition;
      return {
        totalSeats: linkedConstituencies.length > 0 ? linkedConstituencies.length : (cached.seatingLayout?.length || cached.totalSeats || 0),
        incumbentCount: cached.incumbentCount || 0,
        distribution: cached.distribution || [],
        government: cached.government || null,
        opposition: cached.opposition || null,
        others: cached.others || [],
        members: cached.members || [],
        seatingLayout: cached.seatingLayout || [],
      };
    }

    const ds = designationsList?.filter(d => d.assemblyId === id) || [];
    const pIds = [
      ...linkedConstituencies.map(c => {
        if (c.currentAssemblyId === id) return c.currentIncumbentId;
        const hist = (c.history || []).sort((a, b) => b.date - a.date).find(h => h.assemblyId === id);
        return hist && hist.personId ? hist.personId : "vacant";
      }),
      ...ds.map(d => d.incumbentId),
    ].filter(pid => pid !== "vacant");

    const uniquePIds = [...new Set(pIds)];
    const incumbentPersons = personsList?.filter(p => uniquePIds.includes(p.id)) || [];
    const partyIds = incumbentPersons.map(p => p.partyId);
    const parties = partiesList?.filter(p => partyIds.includes(p.id)) || [];
    const independentSupportMap = assemblyRecord?.independentSupports || {};
    const supportedAllianceIds = Object.values(independentSupportMap);
    const allianceIds = [...new Set([...parties.map(p => p.allianceId), ...supportedAllianceIds])].filter(Boolean);
    const alliances = alliancesList?.filter(a => allianceIds.includes(a.id)) || [];

    const groups: Record<string, any> = {};
    incumbentPersons.forEach(person => {
      const party = parties.find(p => p.id === person.partyId);
      let allianceId = party ? party.allianceId : "independent";
      if (person.partyId === "independent" && independentSupportMap[person.id]) {
        const supAllianceId = independentSupportMap[person.id] as string;
        if (alliances.some(a => a.id === supAllianceId)) allianceId = supAllianceId;
      }
      const alliance = alliances.find(a => a.id === allianceId);
      if (!groups[allianceId]) {
        groups[allianceId] = {
          id: allianceId,
          name: alliance ? alliance.name : (allianceId === "independent" ? "Independents" : allianceId),
          abbreviation: alliance ? alliance.abbreviation : (allianceId === "independent" ? "IND" : allianceId),
          totalSeats: 0,
          color: alliance && (alliance as any).colors ? (alliance as any).colors[0] : "#666666",
          parties: [],
        };
      }
      groups[allianceId].totalSeats += 1;
      if (party) {
        let partyRef = groups[allianceId].parties.find((p: any) => p.id === party.id);
        if (!partyRef) {
          partyRef = { id: party.id, name: party.name, abbreviation: party.abbreviation, seats: 0, color: party.colors ? party.colors[0] : "#999999" };
          groups[allianceId].parties.push(partyRef);
        }
        partyRef.seats += 1;
      } else if (allianceId !== "independent") {
        let partyRef = groups[allianceId].parties.find((p: any) => p.id === "independent-supporting");
        if (!partyRef) {
          partyRef = { id: "independent-supporting", name: "Independents (Supporting)", abbreviation: "IND (S)", seats: 0, color: "#666666" };
          groups[allianceId].parties.push(partyRef);
        }
        partyRef.seats += 1;
      }
    });

    Object.values(groups).forEach(group => group.parties.sort((a: any, b: any) => b.seats - a.seats));
    const sortedGroups = Object.entries(groups).map(([_, data]) => ({ ...data })).sort((a, b) => b.totalSeats - a.totalSeats);

    return {
      totalSeats: linkedConstituencies.length,
      incumbentCount: incumbentPersons.length,
      distribution: sortedGroups,
      government: sortedGroups[0] || null,
      opposition: sortedGroups[1] || null,
      others: sortedGroups.slice(2),
      members: assemblyMembers,
    };
  }, [entityType, id, constituenciesList, assembliesList, designationsList, personsList, partiesList, alliancesList, assemblyMembers]);

  const [inspectorSeat, setInspectorSeat] = useState<any>(null);

  const assemblySeats = useMemo(() => {
    if (entityType !== EntityType.ASSEMBLY || !id || !constituenciesList || !personsList || !partiesList || !alliancesList) return [];

    const assemblyObj = assembliesList?.find(a => a.id === id);
    if (assemblyObj && !assemblyObj.isActive && assemblyObj.composition?.seatingLayout) {
      const personsMap = new Map(personsList.map(p => [p.id, p]));
      return assemblyObj.composition.seatingLayout.map((s: any) => {
        let incumbents = s.incumbents || (s.politician ? [{ person: s.politician, party: s.party, alliance: s.alliance }] : []);
        return {
          ...s,
          incumbents: incumbents.map((inc: any) => {
            const dbP = inc.person?.id ? personsMap.get(inc.person.id) : null;
            return Object.assign({}, inc, { person: dbP ? Object.assign({}, inc.person || {}, dbP) : inc.person });
          })
        };
      });
    }

    const targetCs = constituenciesList.filter(c => c.currentAssemblyId === id || (Array.isArray(c.history) && c.history.some(h => h.assemblyId === id)));
    const toTime = (d: any) => typeof d === "number" ? d : d ? new Date(d).getTime() : 0;

    const mappedSeats = targetCs.map(c => {
      const hist = (c.history || []).filter(h => (h.assemblyId || c.currentAssemblyId || id) === id);
      const personIdsSet = new Set<string>();
      if (c.currentAssemblyId === id && c.currentIncumbentId !== "vacant") personIdsSet.add(c.currentIncumbentId as string);
      hist.forEach(h => { if (h.personId && h.personId !== "vacant") personIdsSet.add(h.personId); });

      const personAppointments = Array.from(personIdsSet).map(pId => {
        const entries = hist.filter(h => h.personId === pId);
        const electionOrAppt = entries.filter(h => h.reason === "election" || h.reason === "appointment");
        const removal = entries.find(h => h.reason && h.reason !== "election" && h.reason !== "appointment");
        const isActive = c.currentAssemblyId === id && c.currentIncumbentId === pId;
        let earliestDate = electionOrAppt.length > 0 ? Math.min(...electionOrAppt.map(e => toTime(e.date))) : (removal ? toTime(removal.date) - 1 : (isActive ? toTime(c.updatedAt) : (entries.length > 0 ? Math.min(...entries.map(e => toTime(e.date))) : getSystemTimestamp())));
        return { pId, earliestDate, isActive, removal };
      }).sort((a, b) => a.earliestDate - b.earliestDate);

      const incumbents = personAppointments.map(({ pId, isActive, removal }, index) => {
        const p = personsList.find(item => item.id === pId);
        const party = p ? partiesList.find(pt => pt.id === p.partyId) : null;
        let allianceId = party?.allianceId;
        if (p?.partyId === "independent" && assemblyObj?.independentSupports?.[p.id]) {
          allianceId = assemblyObj.independentSupports[p.id];
        }
        const alliance = allianceId ? alliancesList.find(a => a.id === allianceId || a.abbreviation?.toLowerCase() === allianceId?.toLowerCase()) : null;

        return {
          person: p!,
          party: party || undefined,
          alliance: alliance || undefined,
          isActive,
          removalReason: removal?.reason,
          removalDate: removal ? toTime(removal.date) : undefined,
          electionDate: isActive ? toTime(c.updatedAt) : undefined,
          isByelected: index > 0,
        };
      });

      const active = incumbents.find(i => i.isActive);

      return {
        constituency: c,
        incumbents,
        politician: active?.person,
        party: active?.party,
        alliance: active?.alliance,
      };
    });

    const govId = assemblyPerformance?.government?.id;
    const oppId = assemblyPerformance?.opposition?.id;

    const getRank = (allianceId: string) => {
      if (govId && allianceId === govId) return 1;
      if (oppId && allianceId === oppId) return 10;
      if (allianceId === "independent") return 6;
      return 5;
    };

    const sorted = mappedSeats.sort((a, b) => {
      const activeA = a.incumbents.find(i => i.isActive);
      const activeB = b.incumbents.find(i => i.isActive);
      if (!activeA && activeB) return 1;
      if (activeA && !activeB) return -1;
      if (!activeA && !activeB) return 0;
      
      const rankA = getRank(activeA.alliance?.id || "independent");
      const rankB = getRank(activeB.alliance?.id || "independent");

      if (rankA !== rankB) return rankA - rankB;

      const pIdA = activeA.person.partyId;
      const pIdB = activeB.person.partyId;
      if (pIdA !== pIdB) return pIdA.localeCompare(pIdB);

      const slA = parseInt(a.constituency.slNo || "999") || 999;
      const slB = parseInt(b.constituency.slNo || "999") || 999;
      return slA - slB;
    });

    return sorted;
  }, [id, entityType, constituenciesList, personsList, partiesList, alliancesList, assembliesList, assemblyPerformance, systemDate]);

  const alliancesInAssembly = React.useMemo(() => {
    if (entityType !== EntityType.ASSEMBLY || !assemblySeats) return [];
    const allianceIds = new Set<string>();
    assemblySeats.forEach((seat: any) => {
      seat.incumbents.forEach((inc: any) => {
        if (inc.alliance && inc.alliance.id !== 'independent') {
          allianceIds.add(inc.alliance.id);
        }
        // Also check party's alliance directly in case it's not in inc.alliance for some reason
        if (inc.party && inc.party.allianceId && inc.party.allianceId !== 'independent') {
          allianceIds.add(inc.party.allianceId);
        }
      });
    });
    return alliancesList.filter(a => allianceIds.has(a.id));
  }, [entityType, assemblySeats, alliancesList]);

  const isDissolvedRecord = useMemo(() => {
    if (!entity) return false;
    if (entityType === EntityType.ASSEMBLY) return (entity as Assembly).isActive === false;
    if (entityType === EntityType.CONSTITUENCY) {
      const con = entity as Constituency;
      const asm = assembliesList?.find((a) => a.id === con.currentAssemblyId);
      return asm?.isActive === false;
    }
    return false;
  }, [entity, entityType, assembliesList]);

  const confirmAction = (
    title: string,
    message: string,
    action: () => Promise<void>,
    isDestructive?: boolean,
    confirmText?: string
  ) => {
    setConfirmationDialog({
      show: true,
      loading: false,
      title,
      message,
      onConfirm: action,
      isDestructive,
      confirmText,
      error: null
    });
  };

  const closeAppointPopup = () => {
    setShowAppointPopup(false);
    setAppointingCouncilRole(null);
  };

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
          await firestoreService.freezeAssembly(id);
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
  }, [assemblySeats, inspectorSeat]);

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
      personsEligibleForHighCommand.filter((p) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const party = partiesList.find((pt) => pt.id === p.partyId);
        return (
          p.name.toLowerCase().includes(query) ||
          party?.name.toLowerCase().includes(query) ||
          party?.abbreviation.toLowerCase().includes(query)
        );
      }),
    [personsEligibleForHighCommand, searchQuery, partiesList],
  );

  const filteredCouncilEligible = React.useMemo(
    () =>
      personsEligibleForHighCommand.filter((p) => {
        const query = councilSearchQuery.trim().toLowerCase();
        if (!query) return true;
        const party = partiesList.find((pt) => pt.id === p.partyId);
        return (
          p.name.toLowerCase().includes(query) ||
          party?.name.toLowerCase().includes(query) ||
          party?.abbreviation.toLowerCase().includes(query)
        );
      }),
    [personsEligibleForHighCommand, councilSearchQuery, partiesList],
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

      // Exclude persons belonging to a suspended party
      const pParty = partiesList.find((pt) => pt.id === p.partyId);
      if (pParty?.isSuspended) return false;

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
          const associatedAsm = assembliesList.find((a) => a.id === design.assemblyId);
          const assemblyMembers = constituenciesList
            .filter(
              (c) =>
                c.currentAssemblyId === design.assemblyId &&
                c.currentIncumbentId &&
                c.currentIncumbentId !== "vacant",
            )
            .map((c) => c.currentIncumbentId);
          
          if (!assemblyMembers.includes(p.id)) return false;

          const isSpeaker = isSpeakerOrDeputySpeakerRole(design.name);
          const isMinister = isMinisterialRole(design.name);
          if (isSpeaker || isMinister) {
            const govRes = computeAssemblyGovernmentComposition(
              associatedAsm,
              constituenciesList,
              partiesList,
              alliancesList,
              personsList,
            );
            return govRes.governmentMlaIds.has(p.id);
          }

          return true;
        }
      }

      return true;
    });
  }, [
    personsList,
    appointmentSearchQuery,
    constituenciesList,
    assembliesList,
    partiesList,
    alliancesList,
    entityType,
    entity,
  ]);

  const handleAddPartyToAlliance = async (partyId: string) => {
    if (isDissolvedRecord) {
      alert("This alliance context belongs to a dissolved assembly and cannot be modified.");
      return;
    }
    const p = partiesList?.find((party) => party.id === partyId);
    confirmAction(
      "Join Alliance",
      `Are you sure you want to add ${p?.name || "this party"} to the alliance?`,
      async () => {
        await firestoreService.updateParty(partyId, {
          allianceId: id,
          updatedAt: getSystemTimestamp(),
        });
        setShowAddPartyModal(false);
        setSearchQuery("");
      },
    );
  };

  const handleRemovePartyFromAlliance = async (partyId: string) => {
    if (isDissolvedRecord) {
      alert("This alliance context belongs to a dissolved assembly and cannot be modified.");
      return;
    }
    const p = partiesList?.find((party) => party.id === partyId);
    confirmAction(
      "Leave Alliance",
      `Are you sure you want to remove ${p?.name || "this party"} from the alliance?`,
      async () => {
        await firestoreService.updateParty(partyId, {
          allianceId: "independent",
          updatedAt: getSystemTimestamp(),
        });
      },
      true,
      "Remove Party",
    );
  };

  const handleAddPersonToParty = async (personId: string) => {
    if (isDissolvedRecord) {
      alert("This party context belongs to a dissolved assembly and cannot be modified.");
      return;
    }
    const p = personsList?.find((person) => person.id === personId);
    confirmAction(
      "Add to Party",
      `Are you sure you want to add ${p?.name || "this person"} to the party?`,
      async () => {
        await firestoreService.updatePerson(personId, {
          partyId: id,
          updatedAt: getSystemTimestamp(),
        });
        setShowAddPersonModal(false);
        setSearchQuery("");
      },
    );
  };

  const handleRemovePersonFromParty = async (personId: string) => {
    if (isDissolvedRecord) {
      alert("This party context belongs to a dissolved assembly and cannot be modified.");
      return;
    }
    const p = personsList?.find((person) => person.id === personId);
    confirmAction(
      "Remove Member",
      `Are you sure you want to remove ${p?.name || "this person"} from the party?`,
      async () => {
        await firestoreService.updatePerson(personId, {
          partyId: "independent",
          updatedAt: getSystemTimestamp(),
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
            await firestoreService.deletePerson(id!);
            break;
          case EntityType.PARTY:
            await firestoreService.deleteParty(id!);
            break;
          case EntityType.ALLIANCE:
            await firestoreService.deleteAlliance(id!);
            break;
          case EntityType.ASSEMBLY:
            await firestoreService.deleteAssembly(id!);
            break;
          case EntityType.DESIGNATION:
            await firestoreService.deleteDesignation(id!);
            break;
          case EntityType.CONSTITUENCY:
            await firestoreService.deleteConstituency(id!);
            await firestoreService.reindexConstituencies();
            break;
        }
        navigate("/");
      },
      true,
      "Delete Permanently",
    );
  };

  const handlePromote = async () => {
    if (!showPromotePopup || !id || entityType !== EntityType.ASSEMBLY || !personsList) return;

    const personToPromote = personsList.find(p => p.id === showPromotePopup.personId);
    if (!personToPromote || personToPromote.isSuspended) {
      alert("This politician is suspended and cannot be appointed or promoted to the cabinet.");
      return;
    }
    const partyOfPerson = partiesList?.find(pt => pt.id === personToPromote.partyId);
    if (partyOfPerson?.isSuspended) {
      alert(`Cannot promote member of suspended party "${partyOfPerson.name}".`);
      return;
    }

    if ((entity as Assembly).isActive === false) {
      alert("This assembly has been dissolved. Records cannot be modified.");
      return;
    }

    const isMLA = assemblyMembers.some((m) => m.id === showPromotePopup.personId);
    if (!isMLA) {
      alert("Only elected members (MLAs) of this assembly can be promoted to the cabinet.");
      return;
    }

    const govResult = computeAssemblyGovernmentComposition(
      entity as Assembly,
      constituenciesList || [],
      partiesList || [],
      alliancesList || [],
      personsList || [],
    );
    if (!govResult.governmentMlaIds.has(showPromotePopup.personId)) {
      alert("Only MLAs of the government composition can be promoted to the ministerial cabinet.");
      return;
    }

    confirmAction(
      "Ministerial Promotion",
      `Are you sure you want to promote ${showPromotePopup.personName} as Minister for ${departmentInput}?`,
      async () => {
        const { personId } = showPromotePopup;
        const roleName = `Minister for ${departmentInput}`;
        const now = getSystemTimestamp();
        const designationId = `minister-${departmentInput.toLowerCase().replace(/\s+/g, '-')}-${id}-${personId}-${now}`;
        
        await firestoreService.saveDesignation({
          id: designationId,
          name: roleName,
          assemblyId: id,
          incumbentId: personId,
          constituency: "Legislative Cabinet",
          dateOfSigning: new Date(now).toISOString().split('T')[0],
          history: [{ personId, reason: 'appointment', date: now }],
          updatedAt: now
        });

        const assemblyRoles = { ...(personToPromote.assemblyRoles || {}) };
        const existingRoles = assemblyRoles[id] ? assemblyRoles[id].split(", ") : [];
        if (!existingRoles.includes(roleName)) existingRoles.push(roleName);
        assemblyRoles[id] = existingRoles.join(", ");

        const updateData: any = { assemblyRoles, updatedAt: now };
        const alreadyHasHistory = (personToPromote.roleHistory || []).some(h => h.assemblyId === id && h.role === roleName && h.action === "promotion");
        if (!alreadyHasHistory) {
          updateData.roleHistory = [...(personToPromote.roleHistory || []), { role: roleName, assemblyId: id, date: now, action: "promotion" as const }];
        }
        await firestoreService.updatePerson(personId, updateData);
        setShowPromotePopup(null);
        setDepartmentInput("");
      },
    );
  };

  const handleDeactivate = async () => {
    if (entityType === EntityType.ASSEMBLY) {
      confirmAction(
        "Dissolve Assembly",
        "Are you absolutely sure you want to dissolve this assembly? This will freeze all current roles and composition states as historical data.",
        async () => {
          const now = getSystemTimestamp();
          await firestoreService.freezeAssembly(id!);
          await firestoreService.updateAssembly(id!, {
            isActive: false,
            leaders: {
              chiefMinister: 'vacant',
              deputyChiefMinister: 'vacant',
              speaker: 'vacant',
              deputySpeaker: 'vacant',
              leaderOfOpposition: 'vacant',
              deputyLeaderOfOpposition: 'vacant',
              chiefSecretary: 'vacant',
            },
            updatedAt: now,
          });

          const personUpdates = new Map<string, { roles: string[]; history: any[] }>();
          const relatedDesignations = designationsList?.filter(d => d.assemblyId === id! || isMinisterialRole(d.name)) || [];
          
          for (const d of relatedDesignations) {
            if (d.incumbentId && d.incumbentId !== "vacant") {
              if (!personUpdates.has(d.incumbentId)) {
                const person = personsList?.find(p => p.id === d.incumbentId);
                if (person) {
                  personUpdates.set(d.incumbentId, {
                    roles: person.assemblyRoles && person.assemblyRoles[id!] ? person.assemblyRoles[id!].split(", ") : [],
                    history: person.roleHistory || [],
                  });
                }
              }
              await firestoreService.updateDesignation(d.id, {
                incumbentId: "vacant",
                history: [...(d.history || []), { personId: d.incumbentId, reason: "expiry", date: now }],
                updatedAt: now,
              });
            }
          }

          personsList?.forEach(p => {
            if (p.assemblyRoles && p.assemblyRoles[id!] && !personUpdates.has(p.id)) {
              personUpdates.set(p.id, { roles: p.assemblyRoles[id!].split(", "), history: p.roleHistory || [] });
            }
          });

          const relatedConstituencies = constituenciesList?.filter(c => c.currentAssemblyId === id!) || [];
          for (const con of relatedConstituencies) {
            if (con.currentIncumbentId !== "vacant") {
              if (!personUpdates.has(con.currentIncumbentId)) {
                const person = personsList?.find(p => p.id === con.currentIncumbentId);
                if (person) {
                  personUpdates.set(con.currentIncumbentId, {
                    roles: person.assemblyRoles && person.assemblyRoles[id!] ? person.assemblyRoles[id!].split(", ") : [],
                    history: person.roleHistory || [],
                  });
                }
              }
              await firestoreService.updateConstituency(con.id, {
                currentIncumbentId: "vacant",
                history: [...(con.history || []), { personId: con.currentIncumbentId, assemblyId: id!, date: now, reason: "expiry" }],
                updatedAt: now,
              });
            }
          }

          for (const [personId, data] of personUpdates.entries()) {
            const person = personsList?.find(p => p.id === personId);
            if (!person) continue;
            const newAssemblyRoles = { ...person.assemblyRoles };
            const expiringRoles = data.roles;
            delete newAssemblyRoles[id!];
            const newHistory = [...data.history];
            for (const role of expiringRoles) {
              if (!newHistory.some(h => h.role === role && h.date === now && h.action === "expiry")) {
                newHistory.push({ role, assemblyId: id!, date: now, action: "expiry" as const });
              }
            }
            const isMlaInThisAssembly = relatedConstituencies.some(c => c.currentIncumbentId === personId);
            await firestoreService.updatePerson(personId, {
              assemblyRoles: newAssemblyRoles,
              roleHistory: newHistory,
              updatedAt: now,
              ...(isMlaInThisAssembly ? { constituencyId: undefined, constituencyName: undefined, mlaStatusText: undefined } : {})
            });
          }
          setShowDeactivatePopup(false);
        },
        true,
        "Dissolve Assembly",
      );
    }
  };

  const handleSuspendPerson = () => {
    if (entityType !== EntityType.PERSON || !entity || !personsList) {
      console.warn("Suspend Person aborted: Missing requirements", { entityType, entity, personsList: !!personsList });
      return;
    }
    const person = entity as Person;
    console.log("Triggering Suspend Person for:", person.name);
    
    confirmAction(
      "Suspend Politician",
      `Are you sure you want to suspend ${person.name}? This will mark them as suspended/expired, vacate all their active seats, designations, and governance roles, and keep them strictly as historical records.`,
      async () => {
        const now = getSystemTimestamp();
        const pId = person.id;
        const pRecord = personsList.find(p => p.id === pId);
        if (!pRecord) throw new Error(`Person with ID ${pId} not found in database.`);

        let assemblyRoles = { ...(pRecord.assemblyRoles || {}) };
        let roleHistory = [ ...(pRecord.roleHistory || []) ];

        const designationsListLocal = designationsList?.filter(d => d.incumbentId === pId) || [];
        for (const d of designationsListLocal) {
          await firestoreService.updateDesignation(d.id, {
            incumbentId: "vacant",
            history: [...(d.history || []), { personId: pId, reason: "expiry", date: now }],
            updatedAt: now
          });
          if (d.assemblyId) {
            const roles = (assemblyRoles[d.assemblyId] || "").split(", ").map(r => r.trim()).filter(Boolean);
            const newList = roles.filter(r => r !== d.name);
            if (newList.length === 0) delete assemblyRoles[d.assemblyId];
            else assemblyRoles[d.assemblyId] = newList.join(", ");
            roleHistory.push({ role: d.name, assemblyId: d.assemblyId, date: now, action: "expiry" as const });
          }
        }

        const constituenciesListLocal = constituenciesList?.filter(c => c.currentIncumbentId === pId) || [];
        for (const con of constituenciesListLocal) {
          await firestoreService.updateConstituency(con.id, {
            currentIncumbentId: "vacant",
            history: [...(con.history || []), { personId: pId, assemblyId: con.currentAssemblyId || "unknown", date: now, reason: "Expired" }],
            updatedAt: now
          });
          if (con.currentAssemblyId) {
            const assembly = assembliesList?.find(a => a.id === con.currentAssemblyId);
            if (assembly && assembly.independentSupports && assembly.independentSupports[pId]) {
              const supports = { ...assembly.independentSupports };
              delete supports[pId];
              await firestoreService.updateAssembly(con.currentAssemblyId, { independentSupports: supports, updatedAt: now });
            }
            const mlaRoleName = `MLA for ${con.name}`;
            const roles = (assemblyRoles[con.currentAssemblyId] || "").split(", ").map(r => r.trim()).filter(Boolean);
            const newList = roles.filter(r => r !== mlaRoleName);
            if (newList.length === 0) delete assemblyRoles[con.currentAssemblyId];
            else assemblyRoles[con.currentAssemblyId] = newList.join(", ");
            roleHistory.push({ role: mlaRoleName, assemblyId: con.currentAssemblyId, date: now, action: "expiry" as const });
          }
        }

        for (const asm of (assembliesList || [])) {
          if (asm.leaders) {
            const updatedLeaders = { ...asm.leaders };
            let updated = false;
            for (const [key, value] of Object.entries(asm.leaders)) {
              if (value === pId) {
                (updatedLeaders as any)[key] = "vacant";
                updated = true;
                const displayName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const roles = (assemblyRoles[asm.id] || "").split(", ").map(r => r.trim()).filter(Boolean);
                const newList = roles.filter(r => r !== displayName);
                if (newList.length === 0) delete assemblyRoles[asm.id];
                else assemblyRoles[asm.id] = newList.join(", ");
                roleHistory.push({ role: displayName, assemblyId: asm.id, date: now, action: "expiry" as const });
              }
            }
            if (updated) await firestoreService.updateAssembly(asm.id, { leaders: updatedLeaders, updatedAt: now });
          }
        }

        for (const al of (alliancesList || [])) {
          let updated = false;
          const updateObj: any = { updatedAt: now };
          if (al.leaderId === pId) { updateObj.leaderId = "vacant"; updated = true; }
          if (al.chairmanId === pId) { updateObj.chairmanId = "vacant"; updated = true; }
          if (al.founderId === pId) { updateObj.founderId = "vacant"; updated = true; }
          if (al.highCommandIds?.includes(pId)) { updateObj.highCommandIds = al.highCommandIds.filter(id => id !== pId); updated = true; }
          if (updated) await firestoreService.updateAlliance(al.id, updateObj);
        }

        for (const p of (partiesList || [])) {
          if (p.chairman === pId) {
            await firestoreService.updateParty(p.id, { chairman: "vacant", updatedAt: now });
          }
        }

        console.log("Finalizing person record suspension for:", pId);
        await firestoreService.updatePerson(pId, {
          isSuspended: true, 
          designations: [], 
          assemblyRoles, 
          roleHistory,
          constituencyName: null as any, 
          mlaStatusText: "Suspended / Expired", 
          updatedAt: now
        });
        console.log("Person suspension complete.");
      },
      true,
      "Suspend"
    );
  };

  const handleSuspendParty = () => {
    if (entityType !== EntityType.PARTY || !entity || !partiesList) {
      console.warn("Suspend Party aborted: Missing requirements", { entityType, entity, partiesList: !!partiesList });
      return;
    }
    const party = entity as Party;
    console.log("Triggering Suspend Party for:", party.name);
    confirmAction(
      "Suspend Political Party",
      `Are you sure you want to suspend ${party.name}? This will mark the party as suspended, clear its alliance affiliation, remove its legislative leader, and freeze its active statuses, keeping it strictly as a historical record.`,
      async () => {
        const now = getSystemTimestamp();
        const pId = party.id;
        const pRecord = partiesList.find(p => p.id === pId);
        if (!pRecord) throw new Error(`Party with ID ${pId} not found in database.`);
        console.log("Updating party record for suspension:", pId);
        await firestoreService.updateParty(pId, { 
          isSuspended: true, 
          legislativeLeaderId: null as any, 
          allianceId: "independent", 
          chairman: "vacant", 
          updatedAt: now 
        });
        for (const al of (alliancesList || [])) {
          if (al.leadingPartyId === pId) await firestoreService.updateAlliance(al.id, { leadingPartyId: undefined, updatedAt: now });
        }
      },
      true,
      "Suspend"
    );
  };

  const removeIncumbent = async (reason: "expiry" | "resignation") => {
    if (entityType === EntityType.DESIGNATION && entity) {
      confirmAction(
        "Vacate Seat",
        `Are you sure you want to remove the incumbent due to ${reason}?`,
        async () => {
          const design = entity as Designation;
          const now = getSystemTimestamp();
          const historyEntry = { personId: design.incumbentId, reason, date: now };
          if (design.incumbentId !== "vacant") {
            const person = personsList?.find(p => p.id === design.incumbentId);
            const targetKey = design.assemblyId || id!;
            if (person && person.assemblyRoles && person.assemblyRoles[targetKey]) {
              const roleName = design.name;
              const assemblyRoles = { ...(person.assemblyRoles || {}) };
              const existingRoles = assemblyRoles[targetKey].split(", ");
              const newRolesList = existingRoles.filter((r) => r !== roleName);
              if (newRolesList.length === 0) delete assemblyRoles[targetKey];
              else assemblyRoles[targetKey] = newRolesList.join(", ");
              const updateData: any = { assemblyRoles, updatedAt: now };
              if (!(person.roleHistory || []).some(h => h.role === roleName && h.assemblyId === targetKey && h.action === reason && Math.abs(h.date - now) < 2000)) {
                updateData.roleHistory = [...(person.roleHistory || []), { role: roleName, assemblyId: targetKey, date: now, action: reason }];
              }
              await firestoreService.updatePerson(person.id, updateData);
            }
          }
          await firestoreService.updateDesignation(id!, { incumbentId: "vacant", history: [...(Array.isArray(design.history) ? design.history : []), historyEntry] });
          setShowDeletePopup(false);
        },
        true,
        "Vacate Seat",
      );
    }
  };

  const handleDemoteMinister = async (personId: string, roleToRemove: string) => {
    if (!id || !entity) return;
    if (entityType === EntityType.ASSEMBLY && (entity as Assembly).isActive === false) {
      alert("This assembly has been dissolved. Cabinet changes are prohibited.");
      return;
    }
    confirmAction(
      "Confirm Demotion",
      `Are you sure you want to remove the role "${roleToRemove}" from this person?`,
      async () => {
        const person = personsList?.find(p => p.id === personId);
        if (!person) return;
        const assemblyRoles = { ...(person.assemblyRoles || {}) };
        const existingRolesList = (assemblyRoles[id!] || "").split(", ");
        const newRolesList = existingRolesList.filter((r) => r !== roleToRemove);
        const now = getSystemTimestamp();
        const updateData: any = { roleHistory: [...(person.roleHistory || []), { role: roleToRemove, assemblyId: id!, date: now, action: "resignation" as const }], updatedAt: now };
        if (newRolesList.length === 0) delete assemblyRoles[id!];
        else assemblyRoles[id!] = newRolesList.join(", ");
        updateData.assemblyRoles = assemblyRoles;
        await firestoreService.updatePerson(personId, updateData);
        const relatedDesigs = designationsList?.filter(d => d.assemblyId === id! && d.name === roleToRemove && d.incumbentId === personId) || [];
        for (const d of relatedDesigs) await firestoreService.updateDesignation(d.id, { incumbentId: "vacant", updatedAt: now });
      },
      true,
      "Demote",
    );
  };

  const handleSelectAppointedPerson = async (personId: string) => {
    if (!id || !entity || !personsList) return;
    const personToAppoint = personsList.find(p => p.id === personId);
    if (!personToAppoint || personToAppoint.isSuspended) {
      alert("This politician is suspended and cannot be appointed to any designation or constituency seat.");
      return;
    }
    const partyOfPerson = partiesList?.find(pt => pt.id === personToAppoint.partyId);
    if (partyOfPerson?.isSuspended) {
      alert(`Cannot appoint member of suspended party "${partyOfPerson.name}".`);
      return;
    }

    if (entityType === EntityType.DESIGNATION) {
      const design = entity as Designation;
      if (design.assemblyId) {
        const associatedAsm = assembliesList?.find((a) => a.id === design.assemblyId);
        if (associatedAsm?.isActive === false) {
          alert("This designation belongs to a dissolved assembly and cannot be modified.");
          return;
        }
        const asmMembers = personsList.filter(p => constituenciesList?.some(c => c.currentAssemblyId === design.assemblyId && c.currentIncumbentId === p.id));
        if (!asmMembers.some((m) => m.id === personId)) {
          alert("Only elected members (MLAs) of this assembly can be appointed to these roles.");
          return;
        }
        const isSpeaker = isSpeakerOrDeputySpeakerRole(design.name);
        const isMinister = isMinisterialRole(design.name);
        if ((isSpeaker || isMinister) && associatedAsm) {
          const govRes = computeAssemblyGovernmentComposition(associatedAsm, constituenciesList || [], partiesList || [], alliancesList || [], personsList || []);
          if (!govRes.governmentMlaIds.has(personId)) {
            alert(isSpeaker ? "Only MLAs of the government composition can be appointed as Speaker or Deputy Speaker." : "Only MLAs of the government composition can be promoted to the ministerial cabinet.");
            return;
          }
        }
      }
    } else if (entityType === EntityType.CONSTITUENCY) {
      const associatedAsm = assembliesList?.find((a) => a.id === (entity as Constituency).currentAssemblyId);
      if (associatedAsm?.isActive === false) {
        alert("This constituency record belongs to a dissolved assembly and cannot be modified.");
        return;
      }
    }

    const personName = personToAppoint.name;
    if (entityType === EntityType.DESIGNATION) {
      confirmAction("Confirm Appointment", `Are you sure you want to appoint ${personName} to this designation?`, async () => {
        const design = entity as Designation;
        const now = getSystemTimestamp();
        const roleName = design.name;
        const assemblyRoles = { ...(personToAppoint.assemblyRoles || {}) };
        const existingRoles = assemblyRoles[id!] ? assemblyRoles[id!].split(", ") : [];
        if (!existingRoles.includes(roleName)) existingRoles.push(roleName);
        assemblyRoles[id!] = existingRoles.join(", ");
        const updateData: any = { assemblyRoles, updatedAt: now };
        if (!(personToAppoint.roleHistory || []).some(h => h.role === roleName && h.assemblyId === id && h.action === "promotion")) {
          updateData.roleHistory = [...(personToAppoint.roleHistory || []), { role: roleName, assemblyId: id, date: now, action: "promotion" as const }];
        }
        await firestoreService.updatePerson(personId, updateData);
        await firestoreService.updateDesignation(id!, { incumbentId: personId, history: [...(Array.isArray(design.history) ? design.history : []), { personId, reason: "appointment", date: now }], updatedAt: now });
        closeAppointPopup();
      });
    } else if (entityType === EntityType.CONSTITUENCY) {
      const alreadyHasSeat = constituenciesList?.find(c => c.id !== id && c.currentIncumbentId === personId && c.currentIncumbentId !== "vacant" && assembliesList?.find(a => a.id === c.currentAssemblyId)?.isActive);
      if (alreadyHasSeat) {
        alert(`${personName} already holds a seat in ${alreadyHasSeat.name}. They must resign from that seat first.`);
        return;
      }
      confirmAction("Confirm Appointment", `Are you sure you want to appoint ${personName} to this constituency?`, async () => {
        const con = entity as Constituency;
        const currentAsm = con.currentAssemblyId;
        const now = getSystemTimestamp();
        const roleName = `MLA for ${con.name}`;
        const assemblyRoles = { ...(personToAppoint.assemblyRoles || {}) };
        if (currentAsm) {
          const existingRoles = assemblyRoles[currentAsm] ? assemblyRoles[currentAsm].split(", ") : [];
          if (!existingRoles.includes(roleName)) existingRoles.push(roleName);
          assemblyRoles[currentAsm] = existingRoles.join(", ");
          const updateData: any = { assemblyRoles, updatedAt: now };
          if (!(personToAppoint.roleHistory || []).some(h => h.role === roleName && h.assemblyId === currentAsm && h.action === "promotion")) {
            updateData.roleHistory = [...(personToAppoint.roleHistory || []), { role: roleName, assemblyId: currentAsm, date: now, action: "promotion" as const }];
          }
          await firestoreService.updatePerson(personId, updateData);
        }
        await firestoreService.updateConstituency(id!, { currentIncumbentId: personId, history: [...(Array.isArray(con.history) ? con.history : []), { personId, assemblyId: currentAsm || "unknown", date: now, reason: "appointment" }], updatedAt: now });
        closeAppointPopup();
      });
    }
  };

  const removeConstituencyIncumbent = async (reason: string) => {
    if (entityType === EntityType.CONSTITUENCY && entity) {
      const con = entity as Constituency;
      const associatedAsm = assembliesList?.find((a) => a.id === con.currentAssemblyId);
      if (associatedAsm?.isActive === false) {
        alert("This record belongs to a dissolved assembly and cannot be modified.");
        return;
      }
      const now = getSystemTimestamp();
      if (con.currentIncumbentId !== "vacant" && con.currentAssemblyId) {
        const incumbentIdBeforeVacating = con.currentIncumbentId;
        const assembly = assembliesList?.find(a => a.id === con.currentAssemblyId);
        if (assembly) {
          const asmUpdates: any = {};
          let shouldUpdateAsm = false;
          if (assembly.independentSupports?.[incumbentIdBeforeVacating]) {
            const supports = { ...assembly.independentSupports };
            delete supports[incumbentIdBeforeVacating];
            asmUpdates.independentSupports = supports;
            shouldUpdateAsm = true;
          }
          if (assembly.leaders) {
            const leaders = { ...assembly.leaders };
            let hadLeaderRole = false;
            for (const [rKey, pId] of Object.entries(leaders)) {
              if (pId === incumbentIdBeforeVacating && rKey !== "chiefSecretary") {
                delete (leaders as any)[rKey];
                hadLeaderRole = true;
              }
            }
            if (hadLeaderRole) {
              asmUpdates.leaders = leaders;
              shouldUpdateAsm = true;
            }
          }
          if (shouldUpdateAsm) await firestoreService.updateAssembly(con.currentAssemblyId, asmUpdates);
        }

        const ministerialDesignations = designationsList?.filter(d => d.incumbentId === incumbentIdBeforeVacating && d.assemblyId === con.currentAssemblyId && d.name.toLowerCase().includes("minister")) || [];
        const person = personsList?.find(p => p.id === incumbentIdBeforeVacating);
        let pAssemblyRoles = { ...(person?.assemblyRoles || {}) };
        let pRoleHistory = [...(person?.roleHistory || [])];

        if (person && con.currentAssemblyId) {
          const rolesStr = pAssemblyRoles[con.currentAssemblyId] || "";
          const individualRoles = rolesStr.split(", ").filter(r => {
            const rLower = r.toLowerCase();
            if (rLower.includes("mla") && rLower.includes(con.name.toLowerCase())) return false;
            if (rLower.includes("minister")) return false;
            return true;
          });
          if (individualRoles.length === 0) delete pAssemblyRoles[con.currentAssemblyId];
          else pAssemblyRoles[con.currentAssemblyId] = individualRoles.join(", ");
          pRoleHistory.push({ role: `${con.name} MLA`, assemblyId: con.currentAssemblyId, date: now, action: reason.toLowerCase().includes('resigned') ? 'resignation' : 'expiry' });
        }

        for (const d of ministerialDesignations) {
          await firestoreService.updateDesignation(d.id, { incumbentId: "vacant", history: [...(d.history || []), { personId: incumbentIdBeforeVacating, reason: reason.toLowerCase().includes('resigned') ? 'resignation' : 'expiry', date: now }], updatedAt: now });
          if (person && pAssemblyRoles[con.currentAssemblyId]) {
            const roles = pAssemblyRoles[con.currentAssemblyId].split(", ").filter(r => r !== d.name);
            if (roles.length === 0) delete pAssemblyRoles[con.currentAssemblyId];
            else pAssemblyRoles[con.currentAssemblyId] = roles.join(", ");
          }
          pRoleHistory.push({ role: d.name, assemblyId: con.currentAssemblyId!, date: now, action: reason.toLowerCase().includes('resigned') ? 'resignation' : 'expiry' });
        }

        if (person) {
          await firestoreService.updatePerson(incumbentIdBeforeVacating, { assemblyRoles: pAssemblyRoles, roleHistory: pRoleHistory, constituencyName: undefined, mlaStatusText: reason, updatedAt: now });
        }
        await firestoreService.updateConstituency(id!, { currentIncumbentId: "vacant", history: [...(con.history || []), { personId: incumbentIdBeforeVacating, assemblyId: con.currentAssemblyId, date: now, reason }], updatedAt: now });
      }
      setShowVacateMlaReasonModal(false);
      setVacateReasonType(null);
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
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3.5 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          {entityType === EntityType.PERSON && !(entity as Person).isSuspended && !isViewerMode && (
            <button
              onClick={handleSuspendPerson}
              title="Suspend Politician"
              aria-label="Suspend Politician"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/10 hover:bg-red-600/25 text-red-500 border border-red-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
              id="suspend-person-btn"
            >
              <UserMinus size={18} />
            </button>
          )}
          {entityType === EntityType.PARTY && !(entity as Party).isSuspended && !isViewerMode && (
            <button
              onClick={handleSuspendParty}
              title="Suspend Party"
              aria-label="Suspend Party"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/10 hover:bg-red-600/25 text-red-500 border border-red-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
              id="suspend-party-btn"
            >
              <UserMinus size={18} />
            </button>
          )}
          {!isDissolvedRecord && id !== 'governor' && !(entity as any).isSuspended && !isViewerMode && (
            <button
              onClick={() => setShowEditModal(true)}
              title="Modify Entry"
              aria-label="Modify Entry"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/25 active:scale-95 transition-all cursor-pointer shrink-0"
              id="modify-entry-btn"
            >
              <Edit size={18} />
            </button>
          )}
          {entityType === EntityType.ASSEMBLY &&
            (entity as Assembly).isActive !== false && !isViewerMode && (
              <button
                onClick={() => setShowDeactivatePopup(true)}
                title="End Term / Deactivate"
                aria-label="End Term / Deactivate"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
                id="end-term-btn"
              >
                <HistoryIcon size={18} />
              </button>
            )}
          {id !== 'governor' && !(entity as any).isSuspended && !isViewerMode && (
            <button
              onClick={() => setShowDeletePopup(true)}
              title="Delete Record"
              aria-label="Delete Record"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
              id="delete-record-btn"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Hero Profile Block */}
      {entityType === EntityType.CONSTITUENCY ? (
        <section className="glass-card overflow-hidden border border-white/10 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex flex-col items-center justify-center text-[#FFD700] shrink-0 shadow-lg">
                <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400">NO.</span>
                <span className="text-2xl font-black font-mono leading-none">{(entity as Constituency).slNo}</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[10px] bg-[#FFD700]/10 text-[#FFD700] px-2.5 py-0.5 rounded-md font-black uppercase tracking-wider border border-[#FFD700]/20">
                    Assembly Constituency
                  </span>
                  {constituencyCreationAssembly && (
                    <span className="text-xs text-zinc-500">
                      • Inception: {constituencyCreationAssembly.name}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-tight">
                  {(entity as Constituency).name}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5">
              {!isDissolvedRecord && !isViewerMode && (
                (entity as Constituency).currentIncumbentId !== "vacant" ? (
                  <button
                    onClick={() => setShowVacateMlaReasonModal(true)}
                    className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-red-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <UserMinus size={16} /> Remove MLA
                  </button>
                ) : (
                  <button
                    onClick={() => setShowElectModal(true)}
                    className="px-4 py-2.5 bg-[#FFD700] hover:bg-[#ffe234] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#FFD700]/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Vote size={16} /> Elect MLA
                  </button>
                )
              )}
            </div>
          </div>
        </section>
      ) : (
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
                {entityType === EntityType.PERSON 
                  ? formatPersonName((entity as Person).name, (entity as Person).gender, personHasActiveDesignation)
                  : (entity as any).name
                }
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

                  </>
                )}
                {entityType === EntityType.DESIGNATION && id !== 'governor' && (
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
                      return `Updated ${formatAppDate(dateVal)}`;
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
              </div>

              {entityType === EntityType.PERSON && (() => {
                const person = entity as Person;
                const displayRoles = activeRoles.filter((role) => {
                  const nameLower = role.name.toLowerCase();
                  const conNameLower = person.constituencyName?.toLowerCase() || "";
                  if (conNameLower && nameLower === conNameLower) return false;
                  // Only filter out roles that are ONLY the constituency name or variations of it without "MLA" or "Minister"
                  if (conNameLower && nameLower.includes(conNameLower)) {
                    if (!nameLower.includes("minister") && !nameLower.includes("mla")) {
                      return false;
                    }
                  }
                  if (nameLower === "special role") return false;
                  return true;
                });

                if (displayRoles.length === 0) return null;

                return (
                  <div className="mx-auto mt-4 flex max-w-md flex-col gap-3 rounded-2xl border border-[#FFD700]/10 bg-white/5 p-4 justify-center md:mx-0 md:justify-start items-center md:items-start w-full">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
                      <Award size={14} className="text-[#FFD700]" />
                      <span>currently assumed offices</span>
                    </div>
                    <div className="w-full space-y-3">
                      {displayRoles.map((role, idx) => {
                        const isSilver = role.name.toLowerCase().includes("opposition");
                        const isGoldRole = role.name.toLowerCase().includes('chief minister');
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col border-l-2 py-1 pl-4 items-center md:items-start w-full ${isSilver ? "border-slate-400/40" : "border-[#FFD700]/40"}`}
                          >
                            <span className={`text-lg font-black leading-tight uppercase tracking-wider ${isSilver ? "silver-text" : (isGoldRole ? "text-[#FFD700]" : "text-white")}`}>
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

            {entityType === EntityType.DESIGNATION && (
              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                    Current Incumbent
                  </h3>
                  {(entity as Designation).incumbentId !== "vacant"
                    ? !isDissolvedRecord && !isViewerMode && (
                        <button
                          onClick={() => setShowDeletePopup(true)}
                          className="flex items-center gap-2 text-xs text-red-500 hover:underline uppercase font-bold"
                        >
                          <UserMinus size={14} /> Remove Incumbent
                        </button>
                      )
                    : !isDissolvedRecord && !isViewerMode && (
                        <button
                          onClick={() => setShowAppointPopup(true)}
                          className="flex items-center gap-2 text-xs gold-text hover:underline uppercase font-bold"
                        >
                          <UserPlus size={14} /> Appoint Member
                        </button>
                      )}
                </div>
                {(entity as Designation).incumbentId !== "vacant" ? (
                  <div
                    onClick={() =>
                      navigate(
                        `/person/${(entity as Designation).incumbentId}`,
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
      )}

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
          entityType === EntityType.PERSON) && (
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "history" ? "bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20" : "text-gray-400 hover:text-white"}`}
          >
            {entityType === EntityType.DESIGNATION ? "SESSIONS" : "HISTORY"}
          </button>
        )}
        {(entityType === EntityType.PERSON || entityType === EntityType.DESIGNATION) && (
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === "orders" ? "bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20" : "text-gray-400 hover:text-white"}`}
          >
            <Stamp size={13} />
            <span>ORDERS</span>
            {entityOrders && entityOrders.length > 0 && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${activeTab === "orders" ? "bg-black text-[#FFD700]" : "bg-white/10 text-gray-300"}`}>
                {entityOrders.length}
              </span>
            )}
          </button>
        )}
        {entityType === EntityType.ASSEMBLY && (
          <button
            onClick={() => setActiveTab("bills")}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === "bills" ? "bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20" : "text-gray-400 hover:text-white"}`}
          >
            <FileText size={13} />
            <span>BILLS</span>
            {bills && bills.length > 0 && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${activeTab === "bills" ? "bg-black text-[#FFD700]" : "bg-white/10 text-gray-300"}`}>
                {bills.length}
              </span>
            )}
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
          {activeTab === "details" && entityType === EntityType.ALLIANCE && (
            <div className="max-w-4xl mx-auto space-y-6">
              <AllianceInfoboxTable
                alliance={entity as Alliance}
                leadingParty={leadingParty}
                relatedParties={relatedParties || []}
                allianceLeadership={allianceLeadership}
                highCommandMembers={highCommandMembers || []}
                activeAssembly={currentActiveAssembly}
                constituenciesList={constituenciesList || []}
                partiesList={partiesList || []}
                personsList={personsList || []}
                onNavigatePerson={(personId) => navigate(`/person/${personId}`)}
                onNavigateParty={(partyId) => navigate(`/party/${partyId}`)}
                isDissolved={isDissolvedRecord}
              />

              <section className="glass-card p-8">
                <h3 className="text-lg font-bold uppercase tracking-widest mb-6 text-white">
                  About {(entity as any).name}
                </h3>
                <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed">
                  {(entity as any).bio ? (
                    <div className="whitespace-pre-wrap">{(entity as any).bio}</div>
                  ) : (
                    `Strategic political alliance: ${(entity as Alliance).name} (${(entity as Alliance).abbreviation}).`
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "details" && entityType === EntityType.PARTY && (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Wikipedia-Style Infobox Table matching reference layout */}
              <PartyInfoboxTable
                party={entity as Party}
                alliance={partyAlliance}
                relatedPersons={relatedPersons || []}
                activeAssembly={currentActiveAssembly}
                constituenciesList={constituenciesList || []}
                assembliesList={assembliesList || []}
                alliancesList={alliancesList || []}
                personsList={personsList || []}
                onNavigatePerson={(personId) => navigate(`/person/${personId}`)}
                onNavigateAlliance={(allianceId) => navigate(`/alliance/${allianceId}`)}
                onNavigateAssembly={(assemblyId) => navigate(`/assembly/${assemblyId}`)}
                onUpdateLegislativeLeader={async (leaderId) => {
                  if (entityType === EntityType.PARTY && id) {
                    await firestoreService.updateParty(id, {
                      legislativeLeaderId: leaderId === null ? undefined : leaderId,
                    });
                  }
                }}
                isDissolved={isDissolvedRecord}
              />

              <section className="glass-card p-8">
                <h3 className="text-lg font-bold uppercase tracking-widest mb-6 text-white">
                  About {(entity as any).name}
                </h3>
                <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed">
                  {(entity as any).bio ? (
                    <div className="whitespace-pre-wrap">{(entity as any).bio}</div>
                  ) : (
                    `Official profile of ${(entity as Party).name} (${(entity as Party).abbreviation}).`
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "details" && entityType === EntityType.CONSTITUENCY && (
            <div className="space-y-8">
              {/* Wikipedia-Style Infobox Table matching user's reference screenshot */}
              <ConstituencyInfoboxTable
                constituency={entity as Constituency}
                incumbentPerson={constituencyIncumbentPerson}
                incumbentParty={constituencyIncumbentParty}
                incumbentAlliance={constituencyIncumbentAlliance}
                currentAssembly={constituencyCurrentAssembly}
                creationAssembly={constituencyCreationAssembly}
                assembliesList={assembliesList || []}
                onNavigatePerson={(personId) => navigate(`/person/${personId}`)}
                onNavigateParty={(partyId) => navigate(`/party/${partyId}`)}
                onNavigateAlliance={(allianceId) => navigate(`/alliance/${allianceId}`)}
                onNavigateAssembly={(assemblyId) => navigate(`/assembly/${assemblyId}`)}
                onElectMla={() => setShowElectModal(true)}
                isDissolved={isDissolvedRecord}
              />

              {/* Recent Election Results section */}
              <div className="max-w-xl mx-auto">
                <section className="glass-card p-6 border border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-wider flex items-center gap-2">
                        <Vote size={20} className="text-[#FFD700]" /> Recent Election Results
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Electoral breakdown and vote tally for {(entity as Constituency).name} constituency
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const con = entity as Constituency;
                    if (!con.lastElectionResult) {
                      return (
                        <div className="p-6 text-center rounded-xl bg-[#141416] border border-zinc-800 my-2 space-y-2">
                          <p className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
                            No Election Data Recorded
                          </p>
                          <p className="text-xs text-zinc-500">
                            No election result has been declared for this constituency.
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
              </div>

              <section className="glass-card p-8 max-w-4xl mx-auto">
                <h3 className="text-lg font-bold uppercase tracking-widest mb-6 text-white">
                  About {(entity as any).name}
                </h3>
                <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed">
                  {(entity as any).bio ? (
                    <div className="whitespace-pre-wrap">{(entity as any).bio}</div>
                  ) : (
                    `Official legislative record for the ${(entity as Constituency).name} assembly constituency.`
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "details" &&
            entityType !== EntityType.ALLIANCE &&
            entityType !== EntityType.PARTY &&
            entityType !== EntityType.CONSTITUENCY && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {entityType === EntityType.ASSEMBLY && (
                    <section className="glass-card p-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-6">
                        Assembly Succession
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div
                          onClick={() =>
                            precededByAssembly && navigate(`/assembly/${precededByAssembly.id}`)
                          }
                          className={`p-4 bg-white/5 border border-white/5 ${precededByAssembly ? "hover:border-[#FFD700]/30 cursor-pointer" : "opacity-80"} rounded-2xl group transition-all`}
                        >
                          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">
                            Preceded By
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-gray-500 group-hover:text-[#FFD700]">
                              <HistoryIcon size={20} />
                            </div>
                            <div>
                              {precededByAssembly ? (
                                <>
                                  <p className="font-bold text-sm group-hover:text-white transition-colors">
                                    {precededByAssembly.name}
                                  </p>
                                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                                    {precededByAssembly.termLimits}
                                  </p>
                                </>
                              ) : (
                                <p className="font-bold text-sm text-gray-500 italic transition-colors">
                                  office established
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
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

                {entityType === EntityType.PERSON && entity && (
                  <div className="space-y-6">
                    <section className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                          Legislative Roles & History
                        </h3>
                        <span className="text-[10px] font-mono text-[#8DA4D0] uppercase tracking-widest font-bold">
                          Official Records
                        </span>
                      </div>
                      <LegislativeRolesHistoryWidget person={entity as Person} />
                    </section>
                  </div>
                )}

                {entityType === EntityType.DESIGNATION && (
                  <div className="space-y-6">
                    <section className="glass-card p-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4">
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
                        <h3 className="text-lg font-bold uppercase tracking-widest text-white">
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
                            {!isDissolvedRecord && !isViewerMode && (
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
                            {!isDissolvedRecord && !isViewerMode && (
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
                  <h3 className="text-lg font-bold uppercase tracking-widest mb-6 text-white">
                    About {(entity as any).name}
                  </h3>
                  <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed">
                    {(entity as any).bio ? (
                      <div className="whitespace-pre-wrap">{(entity as any).bio}</div>
                    ) : (
                      <>
                        {entityType === EntityType.ASSEMBLY &&
                          (entity as Assembly).description}
                        {entityType === EntityType.PERSON &&
                          `Details for legislator ${(entity as Person).name} ${(entity as Person).partyId === "independent" ? "serving as an independent." : `affiliated with ${personParty?.name || (entity as Person).partyId}.`}`}
                        {entityType === EntityType.DESIGNATION &&
                          `Official designation of ${(entity as Designation).name} for the ${associatedConstituency?.name || (entity as Designation).constituency || "selected"} constituency.`}
                      </>
                    )}
                  </div>

                  {/* Legislative Control section removed per user request */}
                </section>
              </div>

              <div className="space-y-6">
                    {entityType === EntityType.ASSEMBLY && (
                      <AssemblyInfoboxTable
                        assembly={entity as Assembly}
                        personsList={personsList}
                        partiesList={partiesList}
                        alliancesList={alliancesList}
                        assembliesList={assembliesList}
                        onNavigatePerson={(id) => navigate(`/person/${id}`)}
                        onNavigateParty={(id) => navigate(`/party/${id}`)}
                        onNavigateAlliance={(id) => navigate(`/alliance/${id}`)}
                        onNavigateAssembly={(id) => navigate(`/assembly/${id}`)}
                      />
                    )}
                    {entityType !== EntityType.ASSEMBLY && (
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
                                  return formatAppDateTime(dateVal);
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
                    )}
              </div>
            </div>
          )}

          {activeTab === "related" && (
            <div className="space-y-12">
              {entityType === EntityType.CONSTITUENCY && (
                <section>
                  <LegislativeSessionsTable
                    title="Members of Legislative Assembly"
                    subtitle="Chronological record of assembly sessions, members, and political party affiliations"
                    rows={sessionRows}
                    onNavigatePerson={(personId) => navigate(`/person/${personId}`)}
                    onNavigateParty={(partyId) => navigate(`/party/${partyId}`)}
                    onNavigateAlliance={(allianceId) => navigate(`/alliance/${allianceId}`)}
                    onNavigateAssembly={(assemblyId) => navigate(`/assembly/${assemblyId}`)}
                  />
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
                      {!isDissolvedRecord && !isViewerMode && (
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
                    <p className="text-[#FFD700] uppercase tracking-[0.4em] text-[10px] font-black mt-2">
                      Grand Strategic Alliance
                    </p>
                  </div>

                  <div className="w-full space-y-24">
                    {/* 1. Constituent Parties Portion (Wikipedia-Style Tabular Layout) */}
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center border border-[#FFD700]/20">
                            <Flag size={20} className="text-[#FFD700]" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black uppercase tracking-tight text-white">
                              Constituent Parties
                            </h4>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                              Political Coalition Base
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {/* View Mode Toggle: Table (default) / Cards */}
                          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
                            <button
                              type="button"
                              onClick={() => setAlliancePartiesViewMode("table")}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                alliancePartiesViewMode === "table"
                                  ? "bg-[#FFD700] text-black shadow-sm"
                                  : "text-zinc-400 hover:text-white"
                              }`}
                            >
                              Table
                            </button>
                            <button
                              type="button"
                              onClick={() => setAlliancePartiesViewMode("grid")}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                alliancePartiesViewMode === "grid"
                                  ? "bg-[#FFD700] text-black shadow-sm"
                                  : "text-zinc-400 hover:text-white"
                              }`}
                            >
                              Cards
                            </button>
                          </div>
                        </div>
                      </div>

                      {alliancePartiesViewMode === "table" ? (
                        <AllianceConstituentPartiesTable
                          alliance={entity as Alliance}
                          relatedParties={relatedParties || []}
                          activeAssembly={currentActiveAssembly}
                          assembliesList={assembliesList || []}
                          constituenciesList={constituenciesList || []}
                          personsList={personsList || []}
                          onNavigateParty={(partyId) => navigate(`/party/${partyId}`)}
                          onAddConstituent={() => setShowAddPartyModal(true)}
                          onRemoveParty={(partyId) => handleRemovePartyFromAlliance(partyId)}
                          isDissolved={isDissolvedRecord}
                        />
                      ) : (
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
                      )}
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
                            {allianceLeadership?.leader ? (
                              <div className="flex items-center justify-center gap-3 mt-2">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/person/${allianceLeadership.leader!.id}`,
                                    )
                                  }
                                  className="text-[10px] text-gray-500 hover:text-[#FFD700] transition-colors uppercase font-black tracking-widest"
                                >
                                  View Profile
                                </button>
                                {!isViewerMode && (
                                  <>
                                    <span className="text-white/20">•</span>
                                    <button
                                      onClick={() => {
                                        setCouncilSearchQuery("");
                                        setAppointingCouncilRole("leader");
                                      }}
                                      className="text-[10px] text-[#FFD700]/70 hover:text-[#FFD700] transition-colors uppercase font-black tracking-widest"
                                    >
                                      Change
                                    </button>
                                    <span className="text-white/20">•</span>
                                    <button
                                      onClick={() => handleRemoveCouncilMember("leader")}
                                      className="text-[10px] text-red-500/70 hover:text-red-400 transition-colors uppercase font-black tracking-widest"
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              !isViewerMode && (
                                <button
                                  onClick={() => {
                                    setCouncilSearchQuery("");
                                    setAppointingCouncilRole("leader");
                                  }}
                                  className="mt-3 px-4 py-1.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#FFD700]/20 transition-all flex items-center gap-1.5 mx-auto"
                                >
                                  <UserPlus size={12} /> Appoint Leader
                                </button>
                              )
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
                            <div className="absolute -bottom-2 -right-2 bg-[#FFD700] text-white p-2 rounded-xl shadow-xl">
                              <Landmark size={16} />
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#FFD700] font-black uppercase tracking-[0.3em] mb-1">
                              Chairman
                            </p>
                            <p className="text-xl font-black text-white uppercase tracking-tight">
                              {allianceLeadership?.chairman?.name || "Vacant"}
                            </p>
                            {allianceLeadership?.chairman ? (
                              <div className="flex items-center justify-center gap-3 mt-2">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/person/${allianceLeadership.chairman!.id}`,
                                    )
                                  }
                                  className="text-[10px] text-gray-500 hover:text-[#FFD700] transition-colors uppercase font-black tracking-widest"
                                >
                                  View Profile
                                </button>
                                {!isViewerMode && (
                                  <>
                                    <span className="text-white/20">•</span>
                                    <button
                                      onClick={() => {
                                        setCouncilSearchQuery("");
                                        setAppointingCouncilRole("chairman");
                                      }}
                                      className="text-[10px] text-[#FFD700]/70 hover:text-[#FFD700] transition-colors uppercase font-black tracking-widest"
                                    >
                                      Change
                                    </button>
                                    <span className="text-white/20">•</span>
                                    <button
                                      onClick={() => handleRemoveCouncilMember("chairman")}
                                      className="text-[10px] text-red-500/70 hover:text-red-400 transition-colors uppercase font-black tracking-widest"
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              !isViewerMode && (
                                <button
                                  onClick={() => {
                                    setCouncilSearchQuery("");
                                    setAppointingCouncilRole("chairman");
                                  }}
                                  className="mt-3 px-4 py-1.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#FFD700]/20 transition-all flex items-center gap-1.5 mx-auto"
                                >
                                  <UserPlus size={12} /> Appoint Chairman
                                </button>
                              )
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
                            {allianceLeadership?.founder ? (
                              <div className="flex items-center justify-center gap-3 mt-2">
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
                                {!isViewerMode && (
                                  <>
                                    <span className="text-white/20">•</span>
                                    <button
                                      onClick={() => {
                                        setCouncilSearchQuery("");
                                        setAppointingCouncilRole("founder");
                                      }}
                                      className="text-[10px] text-[#D32F2F]/70 hover:text-[#D32F2F] transition-colors uppercase font-black tracking-widest"
                                    >
                                      Change
                                    </button>
                                    <span className="text-white/20">•</span>
                                    <button
                                      onClick={() => handleRemoveCouncilMember("founder")}
                                      className="text-[10px] text-red-500/70 hover:text-red-400 transition-colors uppercase font-black tracking-widest"
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              !isViewerMode && (
                                <button
                                  onClick={() => {
                                    setCouncilSearchQuery("");
                                    setAppointingCouncilRole("founder");
                                  }}
                                  className="mt-3 px-4 py-1.5 bg-[#D32F2F]/10 hover:bg-[#D32F2F]/20 text-[#D32F2F] rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#D32F2F]/20 transition-all flex items-center gap-1.5 mx-auto"
                                >
                                  <UserPlus size={12} /> Appoint Founder
                                </button>
                              )
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
                        {!isViewerMode && (
                          <button
                            onClick={() => {
                              setSearchQuery("");
                              setShowManageHighCommandModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#D32F2F]/10 hover:bg-[#D32F2F]/20 rounded-xl text-[#D32F2F] text-[10px] font-black uppercase tracking-widest border border-[#D32F2F]/20 transition-all"
                          >
                            <Plus size={14} /> Assign Commanders
                          </button>
                        )}
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
                                  setInspectorSeat(null);
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
                                const seatColor = isVacant
                                  ? "#4B5563"
                                  : (seat.alliance?.colors?.[0] || (seat.alliance as any)?.color) ||
                                    (seat.party?.colors?.[0] || (seat.party as any)?.color) ||
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
                                    fill={seatColor}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspectorSeat(seat);
                                    }}
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
                                        backgroundColor: (inspectorSeat.party?.colors?.[0] || (inspectorSeat.party as any)?.color) ||
                                                         (inspectorSeat.alliance?.colors?.[0] || (inspectorSeat.alliance as any)?.color) ||
                                                         "#4B5563",
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

                  {/* Leadership Council Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/25 flex items-center justify-center text-[#FFD700]">
                        <Crown size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-[#FFD700] uppercase tracking-widest bg-[#FFD700]/10 px-2 py-0.5 rounded border border-[#FFD700]/20">
                            Constitutional Council
                          </span>
                        </div>
                        <h4 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                          Leadership Council
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Leadership Council Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      {
                        key: "chiefMinister",
                        title: "Chief Minister",
                        theme: "gold",
                      },
                      {
                        key: "deputyChiefMinister",
                        title: "Deputy Chief Minister",
                        theme: "gold",
                      },
                      {
                        key: "speaker",
                        title: "Speaker of the House",
                        theme: "amber",
                      },
                      {
                        key: "deputySpeaker",
                        title: "Deputy Speaker",
                        theme: "amber",
                      },
                      {
                        key: "leaderOfOpposition",
                        title: "Leader of Opposition",
                        theme: "silver",
                      },
                      {
                        key: "deputyLeaderOfOpposition",
                        title: "Deputy Leader of Opposition",
                        theme: "silver",
                      },
                      {
                        key: "chiefSecretary",
                        title: "Chief Secretary",
                        theme: "blue",
                      },
                    ].map((role) => {
                      const pId = (entity as Assembly).leaders?.[role.key as keyof Assembly["leaders"]];
                      const person = pId && pId !== "vacant" ? personsList.find((p) => p.id === pId) : null;
                      const isSilver = role.theme === "silver";
                      const isBlue = role.theme === "blue";
                      const isAmber = role.theme === "amber";

                      const borderClasses = isSilver
                        ? "border-slate-400/20 hover:border-slate-400/50"
                        : isBlue
                        ? "border-cyan-500/20 hover:border-cyan-500/50"
                        : isAmber
                        ? "border-amber-500/20 hover:border-amber-500/50"
                        : "border-[#FFD700]/20 hover:border-[#FFD700]/50";

                      const bgBlurClasses = isSilver
                        ? "bg-slate-400/5 group-hover:bg-slate-400/10"
                        : isBlue
                        ? "bg-cyan-500/5 group-hover:bg-cyan-500/10"
                        : isAmber
                        ? "bg-amber-500/5 group-hover:bg-amber-500/10"
                        : "bg-[#FFD700]/5 group-hover:bg-[#FFD700]/10";

                      const imageBorderClasses = isSilver
                        ? "border-slate-400/20 shadow-slate-400/10"
                        : isBlue
                        ? "border-cyan-500/20 shadow-cyan-500/10"
                        : isAmber
                        ? "border-amber-500/20 shadow-amber-500/10"
                        : "border-[#FFD700]/20 shadow-[#FFD700]/10";

                      const badgeClasses = isSilver
                        ? "bg-slate-400/10 text-slate-300 border-slate-400/20"
                        : isBlue
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                        : isAmber
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/20";

                      if (person) {
                        const party = partiesList.find((pt) => pt.id === person.partyId);
                        const seat = assemblySeats?.find(
                          (s) =>
                            s.politician?.id === person.id ||
                            (Array.isArray(s.incumbents) &&
                              s.incumbents.some((inc: any) => (inc.person?.id || inc.id) === person.id))
                        );

                        return (
                          <motion.div
                            key={role.key}
                            whileHover={{ y: -4, scale: 1.01 }}
                            className={`glass-card p-6 flex flex-col justify-between gap-4 ${borderClasses} transition-all border group relative overflow-hidden`}
                          >
                            <div className={`absolute top-0 right-0 p-8 ${bgBlurClasses} blur-3xl -z-10 transition-colors`} />
                            
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div
                                  onClick={() => navigate(`/person/${person.id}`)}
                                  className={`w-14 h-14 rounded-2xl bg-zinc-900 overflow-hidden border ${imageBorderClasses} shadow-lg cursor-pointer shrink-0 group-hover:border-[#FFD700]/50 transition-colors`}
                                >
                                  {person.imageUrl ? (
                                    <img
                                      src={person.imageUrl}
                                      alt={person.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                      <User size={22} />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest leading-none mb-1">
                                {role.title}
                              </p>
                              
                              <p
                                onClick={() => navigate(`/person/${person.id}`)}
                                className={`font-bold text-lg cursor-pointer hover:underline ${
                                  isSilver ? "silver-text" : "gold-text"
                                }`}
                              >
                                {person.name}
                              </p>

                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {party && (
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase text-white shadow-sm"
                                    style={{ backgroundColor: party.colors?.[0] || "#3B82F6" }}
                                  >
                                    {party.abbreviation || party.name}
                                  </span>
                                )}
                                {seat ? (
                                  <span className="text-xs text-gray-400 font-medium">
                                    MLA • {seat.constituency.name}
                                  </span>
                                ) : role.key === "chiefSecretary" ? (
                                  <span className="text-xs text-cyan-400/80 font-medium">
                                    Civil Administration
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                              <button
                                onClick={() => navigate(`/person/${person.id}`)}
                                className="text-gray-400 hover:text-white flex items-center gap-1 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                <span>Inspect Profile</span>
                                <ExternalLink size={12} />
                              </button>

                              {!isDissolvedRecord && !isViewerMode && (
                                <button
                                  onClick={() => setIsLeadershipModalOpen(true)}
                                  className="text-[#FFD700] hover:underline font-bold text-[11px] transition-all cursor-pointer"
                                >
                                  Change
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      }

                      // Vacant Role Card
                      return (
                        <div
                          key={role.key}
                          className="glass-card p-6 flex flex-col justify-between gap-4 border border-dashed border-white/10 hover:border-white/20 transition-all relative overflow-hidden"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-600">
                                <User size={20} />
                              </div>
                            </div>

                            <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest leading-none mb-1">
                              {role.title}
                            </p>
                            <p className="font-bold text-base text-zinc-500 italic">
                              Position Vacant
                            </p>
                          </div>

                          {!isDissolvedRecord && !isViewerMode ? (
                            <button
                              onClick={() => setIsLeadershipModalOpen(true)}
                              className="w-full py-2.5 bg-white/5 hover:bg-[#FFD700]/10 hover:text-[#FFD700] border border-white/10 hover:border-[#FFD700]/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Plus size={14} />
                              <span>Appoint</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono italic">
                              {isViewerMode ? "Login as admin to appoint" : "Vacant during dissolution"}
                            </span>
                          )}
                        </div>
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
                    <div className="mb-16">
                      <AssemblyMembersTable
                        assembly={entity as Assembly}
                        seats={assemblySeats || []}
                        designationsList={designationsList}
                        alliancesList={alliancesList}
                        isDissolved={isDissolvedRecord}
                        government={assemblyPerformance?.government}
                        onPromote={
                          !isDissolvedRecord && !isViewerMode
                            ? (personId, personName) =>
                                setShowPromotePopup({
                                  personId,
                                  personName,
                                })
                            : undefined
                        }
                        onSupportAlliance={
                          !isDissolvedRecord && !isViewerMode
                            ? (personId, personName) =>
                                setShowSupportAlliancePopup({
                                  personId,
                                  personName,
                                })
                            : undefined
                        }
                      />
                    </div>

                    {/* Seats List - Vacant Seats */}
                    <div className="space-y-8">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#FFD700]">
                          <MapPin size={24} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black uppercase tracking-tight">
                            Vacant Seats
                          </h3>
                          <p className="text-gray-500 text-xs">
                            Overview of unrepresented and vacant constituencies requiring by-election or appointment.
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const seats = [...(assemblySeats || [])].sort((a, b) => {
                          const slA = parseInt(a.constituency.slNo) || 9999;
                          const slB = parseInt(b.constituency.slNo) || 9999;
                          return slA - slB;
                        });
                        const vacant = seats.filter((s) => {
                          if (s.incumbents.length === 0) return true;
                          const lastInc = s.incumbents[s.incumbents.length - 1];
                          return !!lastInc.removalDate;
                        });

                        if (vacant.length === 0) {
                          return (
                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-3.5">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckCircle2 size={18} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white uppercase tracking-wider">
                                  All Seats Occupied
                                </p>
                                <p className="text-[11px] text-gray-500">
                                  There are currently no vacant seats in this assembly. All {seats.length} constituencies have an active representative in the table above.
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return (
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
                              <p className="text-[10px] text-[#FFD700] font-bold uppercase tracking-widest">
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
                                <h4 className="text-lg font-black text-[#FFD700] uppercase tracking-tighter">
                                  Government (
                                  {assemblyPerformance.government.totalSeats})
                                </h4>
                              </div>
                              <div className="pl-4 border-l-2 border-[#FFD700]/20 space-y-6">
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
                              className={`absolute -left-[27px] top-0 w-3 h-3 rounded-full bg-[#050505] border-2 ${isActive ? "border-emerald-500 scale-125" : "border-[#FFD700]"} group-hover:scale-150 transition-transform`}
                            />
                            <div
                              className={`glass-card p-6 ml-4 hover:border-[#FFD700]/40 transition-all ${isActive ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-[#FFD700]/10"}`}
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
                                  {formatAppDateTime(h.date)}
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

                {entityType === EntityType.DESIGNATION && (
                  <div className="space-y-8">
                    <LegislativeSessionsTable
                      title="Legislative Sessions"
                      subtitle="Historical succession of incumbents and political affiliations across assembly terms"
                      rows={sessionRows}
                      onNavigatePerson={(personId) => navigate(`/person/${personId}`)}
                      onNavigateParty={(partyId) => navigate(`/party/${partyId}`)}
                      onNavigateAlliance={(allianceId) => navigate(`/alliance/${allianceId}`)}
                      onNavigateAssembly={(assemblyId) => navigate(`/assembly/${assemblyId}`)}
                      hideAssemblyColumn={
                        (entity as Designation)?.name?.toLowerCase().includes('governor') || 
                        (entity as Designation)?.id?.toLowerCase().includes('governor')
                      }
                    />
                  </div>
                )}
                {((entityType === EntityType.DESIGNATION &&
                  (!(entity as Designation).history ||
                    (entity as Designation).history?.length === 0))) && (
                  <p className="text-gray-600 font-bold uppercase tracking-widest py-10 pl-6">
                    No historical records found for this seat
                  </p>
                )}
              </div>
            </section>
          )}

          {activeTab === "orders" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-6">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
                    <Stamp className="text-[#FFD700]" size={22} />
                    <span>Official Orders & Gazettes</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Orders issued by or referencing {entity?.name || "this official"}.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/orders")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white border border-white/10 transition-all font-bold text-xs uppercase tracking-wider cursor-pointer shrink-0"
                >
                  <span>Orders Registry</span>
                </button>
              </div>

              {(!entityOrders || entityOrders.length === 0) ? (
                <div className="glass-card p-12 border border-dashed border-white/10 rounded-3xl text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-gray-500">
                    <Stamp size={26} />
                  </div>
                  <p className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                    No Orders Recorded
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    There are currently no gazettes or decrees issued by or mentioning this profile.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {entityOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => navigate("/orders")}
                      className="glass-card p-5 border border-white/10 hover:border-[#FFD700]/30 transition-all rounded-2xl cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/20 px-2.5 py-1 rounded-lg">
                            {order.slNo ? `Sl. No. ${order.slNo}` : order.orderNumber}
                          </span>
                          <span className="text-[11px] font-mono text-gray-400">
                            {order.date}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-white group-hover:text-[#FFD700] transition-colors line-clamp-2">
                          {order.orderName}
                        </h4>
                        <div className="text-xs text-gray-300 mt-2 font-medium">
                          <div className="font-bold text-gray-200">
                            {order.byOfficeTitle || formatOfficeOfHonble(order.byDesignationName)}
                          </div>
                          {order.signerPersonName ? (
                            <div className="text-xs text-gray-400 font-semibold mt-0.5">
                              ({order.signerPersonName})
                            </div>
                          ) : (
                            <div className="text-[11px] text-amber-400 font-medium mt-0.5 flex items-center gap-1">
                              <Scale size={12} className="shrink-0" /> Judicial Bench
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-gray-500 font-medium">
                          {order.taggedPersonIds?.length || 0} person(s) referenced
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "bills" && entityType === EntityType.ASSEMBLY && entity && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-6">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
                    <FileText className="text-[#FFD700]" size={22} />
                    <span>Legislative Bills & Enactments</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Manage and track the progress of bills presented in {(entity as Assembly).name}.
                  </p>
                </div>
                {(entity as Assembly).isActive !== false && !isViewerMode && (
                  <button
                    onClick={() => setIsCreateBillModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FFD700] hover:bg-[#FFD700]/90 rounded-xl text-black transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-[#FFD700]/20 cursor-pointer shrink-0"
                  >
                    <FilePlus size={16} />
                    <span>Create New Bill</span>
                  </button>
                )}
              </div>

              <BillsList 
                bills={bills} 
                assembly={entity as Assembly} 
                members={assemblyMembers} 
              />
              
              <CreateBillModal
                isOpen={isCreateBillModalOpen}
                onClose={() => setIsCreateBillModalOpen(false)}
                assembly={entity as Assembly}
                members={assemblyMembers}
              />
            </div>
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
              className="w-full max-w-sm glass-card border-[#FFD700]/20 p-8 relative"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#FFD700]/10 text-[#FFD700] flex items-center justify-center mx-auto mb-4">
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFD700]/50 transition-colors"
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
                    className="flex-1 py-3 bg-[#FFD700] hover:bg-[#FFD700]/80 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-[#FFD700]/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      const assembly = assembliesList?.find(a => a.id === id);
                      if (assembly) {
                        const supports = {
                          ...(assembly.independentSupports || {}),
                        };
                        delete supports[showSupportAlliancePopup.personId];
                        await firestoreService.updateAssembly(id!, {
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
                  {alliancesInAssembly.map((alliance) => {
                    const isSelected =
                      (entity as Assembly)?.independentSupports?.[
                        showSupportAlliancePopup.personId
                      ] === alliance.id;
                    return (
                      <button
                        key={alliance.id}
                        onClick={async () => {
                          const assembly = assembliesList?.find(a => a.id === id);
                          if (assembly) {
                            const supports = {
                              ...(assembly.independentSupports || {}),
                            };
                            supports[showSupportAlliancePopup.personId] =
                              alliance.id;
                            await firestoreService.updateAssembly(id!, {
                              independentSupports: supports,
                            });
                          }
                          setShowSupportAlliancePopup(null);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                          isSelected
                            ? "bg-[#FFD700]/10 border-[#FFD700]/30"
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
                  Are you sure you want to remove this entry from the
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
              onClick={() => {
                setShowVacateMlaReasonModal(false);
                setVacateReasonType(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm glass-card border-red-500/20 p-8 relative"
            >
              <button
                onClick={() => {
                  setShowVacateMlaReasonModal(false);
                  setVacateReasonType(null);
                }}
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
                  {vacateReasonType === "expiry" ? "Specify Expiry Reason" : "Select Removal Reason"}
                </h3>
                <p className="text-gray-500 text-sm mb-6 font-sans">
                  {vacateReasonType === "expiry" 
                    ? "Please specify the nature of expiry."
                    : `Select the reason for vacating the seat of constituency ${(entity as Constituency)?.name}.`
                  }
                </p>

                <div className="space-y-2 mb-6 text-left">
                  {!vacateReasonType ? (
                    <>
                      <button
                        onClick={() => removeConstituencyIncumbent("Resigned")}
                        className="w-full text-left p-3.5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl transition-all border border-white/5 text-xs font-bold text-gray-300 hover:text-white flex items-center justify-between"
                      >
                        <span className="font-sans uppercase tracking-widest">Mark as Resignation</span>
                        <ChevronRight size={14} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => setVacateReasonType("expiry")}
                        className="w-full text-left p-3.5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl transition-all border border-white/5 text-xs font-bold text-gray-300 hover:text-white flex items-center justify-between"
                      >
                        <span className="font-sans uppercase tracking-widest">Mark as Expired</span>
                        <ChevronRight size={14} className="text-gray-500" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => removeConstituencyIncumbent("Removed by Hon'ble Supreme Court")}
                        className="w-full text-left p-3.5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl transition-all border border-white/5 text-[10px] font-bold text-gray-300 hover:text-white flex items-center justify-between"
                      >
                        <span className="font-sans uppercase tracking-widest">Removed by Hon'ble Supreme Court</span>
                        <ChevronRight size={14} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => removeConstituencyIncumbent("Removed by Hon'ble High Court")}
                        className="w-full text-left p-3.5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl transition-all border border-white/5 text-[10px] font-bold text-gray-300 hover:text-white flex items-center justify-between"
                      >
                        <span className="font-sans uppercase tracking-widest">Removed by Hon'ble High Court</span>
                        <ChevronRight size={14} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => removeConstituencyIncumbent("Expired")}
                        className="w-full text-left p-3.5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 rounded-xl transition-all border border-white/5 text-[10px] font-bold text-gray-300 hover:text-white flex items-center justify-between"
                      >
                        <span className="font-sans uppercase tracking-widest">Expired Only</span>
                        <ChevronRight size={14} className="text-gray-500" />
                      </button>
                      <button
                        onClick={() => setVacateReasonType(null)}
                        className="w-full text-center text-[#FFD700]/60 hover:text-[#FFD700] text-[10px] font-black uppercase tracking-widest py-2 font-sans mt-4"
                      >
                        ← Back
                      </button>
                    </>
                  )}
                </div>
                {!vacateReasonType && (
                  <button
                    id="cancel-vacate-reason-btn"
                    onClick={() => setShowVacateMlaReasonModal(false)}
                    className="w-full text-center text-gray-400 hover:text-white text-xs font-bold py-2 font-sans"
                  >
                    Cancel
                  </button>
                )}
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
            alliancesList={alliancesList || []}
            designationsList={designationsList || []}
            assembliesList={assembliesList || []}
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
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                  {confirmationDialog.message}
                </p>
                {confirmationDialog.error && (
                  <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left overflow-auto max-h-32">
                    <p className="font-bold mb-1">Action Failed:</p>
                    <p className="whitespace-pre-wrap">{confirmationDialog.error}</p>
                  </div>
                )}
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
                    disabled={confirmationDialog.loading}
                    onClick={async () => {
                      setConfirmationDialog(prev => ({ ...prev, loading: true }));
                      try {
                        console.log("Executing confirmed action:", confirmationDialog.title);
                        await confirmationDialog.onConfirm();
                        console.log("Action completed successfully");
                        setConfirmationDialog((prev) => ({
                          ...prev,
                          show: false,
                          loading: false,
                          error: null
                        }));
                      } catch (err) {
                        console.error("Confirmation action failed:", err);
                        setConfirmationDialog((prev) => ({
                          ...prev,
                          loading: false,
                          error: err instanceof Error ? err.message : String(err)
                        }));
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl text-black font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                      confirmationDialog.loading 
                        ? "bg-gray-500 cursor-not-allowed opacity-50" 
                        : confirmationDialog.isDestructive 
                          ? "bg-red-500 shadow-red-500/20 hover:bg-red-600" 
                          : "bg-[#FFD700] shadow-[#FFD700]/20 hover:scale-105"
                    }`}
                  >
                    {confirmationDialog.loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      confirmationDialog.confirmText || "Confirm"
                    )}
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

        {appointingCouncilRole && (
          <div
            key="appoint-council-popup-wrapper"
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              key="appoint-council-popup-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setAppointingCouncilRole(null);
                setCouncilSearchQuery("");
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="appoint-council-popup-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg glass-card p-8 relative flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-[#FFD700]">
                  <Shield size={24} /> Appoint Alliance{" "}
                  {appointingCouncilRole === "leader"
                    ? "Leader"
                    : appointingCouncilRole === "chairman"
                      ? "Chairman"
                      : "Founder"}
                </h3>
                <button
                  onClick={() => {
                    setAppointingCouncilRole(null);
                    setCouncilSearchQuery("");
                  }}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-4">
                Only members belonging to alliance constituent parties are eligible.
              </p>

              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search alliance members..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#FFD700]/50"
                  value={councilSearchQuery}
                  onChange={(e) => setCouncilSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {filteredCouncilEligible.map((p) => {
                  const party = partiesList.find((pt) => pt.id === p.partyId);
                  const isCurrent =
                    appointingCouncilRole === "leader"
                      ? (entity as Alliance).leaderId === p.id
                      : appointingCouncilRole === "chairman"
                        ? (entity as Alliance).chairmanId === p.id
                        : (entity as Alliance).founderId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAppointCouncilMember(p.id)}
                      className={`p-4 border rounded-2xl flex items-center gap-4 cursor-pointer transition-all group ${isCurrent ? "bg-[#FFD700]/10 border-[#FFD700]/50" : "bg-white/5 border-white/5 hover:border-[#FFD700]/30"}`}
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
                          className={`font-bold transition-colors ${isCurrent ? "text-white" : "group-hover:text-white"}`}
                        >
                          {p.name}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                          {party
                            ? `${party.name} (${party.abbreviation})`
                            : "Alliance Member"}
                        </p>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isCurrent ? "bg-[#FFD700] text-black border-[#FFD700]" : "border-white/10 group-hover:border-[#FFD700]/50 text-gray-400 group-hover:text-white"}`}
                      >
                        {isCurrent ? "Appointed" : "Appoint"}
                      </div>
                    </div>
                  );
                })}
                {filteredCouncilEligible.length === 0 && (
                  <div className="text-center py-10 px-6">
                    <p className="text-gray-600 italic mb-2">
                      No eligible alliance members found
                    </p>
                    <p className="text-[10px] text-gray-700 uppercase tracking-widest leading-relaxed">
                      Only members of constituent parties can be appointed to the High
                      Council. Ensure constituent parties have joined this alliance
                      first.
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
              onClick={() => {
                setShowManageHighCommandModal(false);
                setSearchQuery("");
              }}
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
                  onClick={() => {
                    setShowManageHighCommandModal(false);
                    setSearchQuery("");
                  }}
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

      {isLeadershipModalOpen && entityType === EntityType.ASSEMBLY && entity && (
        <LeadershipCouncilModal
          assembly={entity as Assembly}
          constituencies={constituenciesList || []}
          parties={partiesList || []}
          alliances={alliancesList || []}
          persons={personsList || []}
          onClose={() => setIsLeadershipModalOpen(false)}
        />
      )}

      <CreateModals
        type={entityType}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editData={entity}
      />
    </div>
  );
};
