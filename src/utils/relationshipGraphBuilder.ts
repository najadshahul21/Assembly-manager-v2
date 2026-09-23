import { EntityType, Person, Party, Alliance, Assembly, Designation, Constituency } from '../types';
import { GraphData, GraphNode, GraphLink } from '../types/graph';

export interface RawEntitiesBundle {
  persons: Person[];
  parties: Party[];
  alliances: Alliance[];
  assemblies: Assembly[];
  designations: Designation[];
  constituencies: Constituency[];
  orders?: any[];
}

export const ENTITY_COLORS: Record<EntityType, string> = {
  [EntityType.ALLIANCE]: '#A855F7',      // Purple
  [EntityType.PARTY]: '#EF4444',         // Red
  [EntityType.PERSON]: '#EAB308',        // Gold
  [EntityType.ASSEMBLY]: '#06B6D4',      // Cyan
  [EntityType.CONSTITUENCY]: '#10B981',  // Emerald
  [EntityType.DESIGNATION]: '#6366F1',   // Indigo
  [EntityType.ORDER]: '#F97316'          // Orange
};

export const ENTITY_RADIUS: Record<EntityType, number> = {
  [EntityType.ALLIANCE]: 30,
  [EntityType.ASSEMBLY]: 30,
  [EntityType.PARTY]: 24,
  [EntityType.DESIGNATION]: 22,
  [EntityType.PERSON]: 20,
  [EntityType.CONSTITUENCY]: 18,
  [EntityType.ORDER]: 16
};

/**
 * Builds a complete GraphData structure from the database entities
 */
export function buildRelationshipGraph(bundle: RawEntitiesBundle): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const linksMap = new Map<string, GraphLink>();

  const {
    persons = [],
    parties = [],
    alliances = [],
    assemblies = [],
    designations = [],
    constituencies = [],
    orders = []
  } = bundle;

  // Party ID to Party lookup
  const partiesMap = new Map<string, Party>();
  parties.forEach((p) => partiesMap.set(p.id, p));

  // Alliance ID to Alliance lookup
  const alliancesMap = new Map<string, Alliance>();
  alliances.forEach((a) => alliancesMap.set(a.id, a));

  // Assembly ID lookup
  const assembliesMap = new Map<string, Assembly>();
  assemblies.forEach((a) => assembliesMap.set(a.id, a));

  // Helper to safely add a node
  const addNode = (
    type: EntityType,
    rawId: string,
    name: string,
    subText?: string,
    imageUrl?: string,
    customColor?: string,
    data?: any
  ): string => {
    const id = `${type}:${rawId}`;
    if (!nodesMap.has(id)) {
      const color = customColor || ENTITY_COLORS[type];
      nodesMap.set(id, {
        id,
        rawId,
        name: name || rawId,
        type,
        subText,
        imageUrl,
        color,
        radius: ENTITY_RADIUS[type],
        data: data || {},
        degree: 0
      });
    }
    return id;
  };

  // Helper to safely add a link
  const addLink = (
    sourceId: string,
    targetId: string,
    relationType: string,
    label: string,
    color?: string,
    style: 'solid' | 'dashed' | 'dotted' = 'solid'
  ) => {
    if (!nodesMap.has(sourceId) || !nodesMap.has(targetId)) return;
    if (sourceId === targetId) return;

    const linkId = `${sourceId}==[${relationType}]==>${targetId}`;
    if (!linksMap.has(linkId)) {
      linksMap.set(linkId, {
        id: linkId,
        source: sourceId,
        target: targetId,
        relationType,
        label,
        color: color || '#94A3B8',
        style,
        weight: 1
      });

      // Increment degree count for connectivity calculation
      const srcNode = nodesMap.get(sourceId);
      const tgtNode = nodesMap.get(targetId);
      if (srcNode) srcNode.degree += 1;
      if (tgtNode) tgtNode.degree += 1;
    }
  };

  // 1. ALLIANCES
  alliances.forEach((alliance) => {
    const allianceColor = (alliance.colors && alliance.colors[0]) || ENTITY_COLORS[EntityType.ALLIANCE];
    addNode(
      EntityType.ALLIANCE,
      alliance.id,
      alliance.name,
      alliance.abbreviation,
      alliance.logoUrl,
      allianceColor,
      alliance
    );
  });

  // 2. PARTIES
  parties.forEach((party) => {
    const partyColor = (party.colors && party.colors[0]) || ENTITY_COLORS[EntityType.PARTY];
    const partyNodeId = addNode(
      EntityType.PARTY,
      party.id,
      party.name,
      party.abbreviation,
      party.logoUrl,
      partyColor,
      party
    );

    // Party -> Alliance
    if (party.allianceId && party.allianceId !== 'independent' && alliancesMap.has(party.allianceId)) {
      const allianceNodeId = `${EntityType.ALLIANCE}:${party.allianceId}`;
      addLink(partyNodeId, allianceNodeId, 'alliance_member', 'Coalition Partner', partyColor);
    }
  });

  // 3. ALLIANCE LEADERS (Alliance -> Party & Person)
  alliances.forEach((alliance) => {
    const allianceNodeId = `${EntityType.ALLIANCE}:${alliance.id}`;

    if (alliance.leadingPartyId && partiesMap.has(alliance.leadingPartyId)) {
      const leadPartyNodeId = `${EntityType.PARTY}:${alliance.leadingPartyId}`;
      addLink(allianceNodeId, leadPartyNodeId, 'lead_party', 'Lead Party', '#A855F7');
    }
  });

  // 4. ASSEMBLIES
  assemblies.forEach((assembly) => {
    const asmColor = assembly.isActive ? '#06B6D4' : '#64748B';
    const asmNodeId = addNode(
      EntityType.ASSEMBLY,
      assembly.id,
      assembly.name,
      assembly.termLimits || (assembly.isActive ? 'Active Term' : 'Concluded'),
      assembly.logoUrl,
      asmColor,
      assembly
    );

    // Assembly -> Ruling Party or Coalition
    if (assembly.partyControlId) {
      if (alliancesMap.has(assembly.partyControlId)) {
        const allyId = `${EntityType.ALLIANCE}:${assembly.partyControlId}`;
        addLink(asmNodeId, allyId, 'governing_coalition', 'Ruling Coalition', '#A855F7', 'dashed');
      } else if (partiesMap.has(assembly.partyControlId)) {
        const partyId = `${EntityType.PARTY}:${assembly.partyControlId}`;
        addLink(asmNodeId, partyId, 'ruling_party', 'Ruling Party', '#EF4444', 'dashed');
      }
    }
  });

  // 5. PERSONS
  persons.forEach((person) => {
    let personColor = ENTITY_COLORS[EntityType.PERSON];
    let partyAbbr = '';
    if (person.partyId && partiesMap.has(person.partyId)) {
      const p = partiesMap.get(person.partyId);
      partyAbbr = p?.abbreviation || '';
      if (p?.colors && p.colors[0]) {
        personColor = p.colors[0];
      }
    }

    const sub = [partyAbbr, person.constituencyName].filter(Boolean).join(' • ');
    const personNodeId = addNode(
      EntityType.PERSON,
      person.id,
      person.name,
      sub,
      person.imageUrl,
      personColor,
      person
    );

    // Person -> Party
    if (person.partyId && person.partyId !== 'independent' && partiesMap.has(person.partyId)) {
      const partyNodeId = `${EntityType.PARTY}:${person.partyId}`;
      addLink(personNodeId, partyNodeId, 'member_of', 'Member Of', personColor);
    }

    // Check Party leadership
    parties.forEach((party) => {
      if (party.chairman === person.id) {
        const pNodeId = `${EntityType.PARTY}:${party.id}`;
        addLink(personNodeId, pNodeId, 'party_chairman', 'President / Chairman', '#EF4444');
      }
      if (party.legislativeLeaderId === person.id) {
        const pNodeId = `${EntityType.PARTY}:${party.id}`;
        addLink(personNodeId, pNodeId, 'legislative_leader', 'Legislative Party Leader', '#EF4444');
      }
    });

    // Check Alliance leadership
    alliances.forEach((alliance) => {
      const aNodeId = `${EntityType.ALLIANCE}:${alliance.id}`;
      if (alliance.leaderId === person.id) {
        addLink(personNodeId, aNodeId, 'alliance_leader', 'Alliance Leader', '#A855F7');
      }
      if (alliance.chairmanId === person.id) {
        addLink(personNodeId, aNodeId, 'alliance_chairman', 'Alliance Chairman', '#A855F7');
      }
      if (alliance.founderId === person.id) {
        addLink(personNodeId, aNodeId, 'alliance_founder', 'Alliance Founder', '#A855F7');
      }
      if (Array.isArray(alliance.highCommandIds) && alliance.highCommandIds.includes(person.id)) {
        addLink(personNodeId, aNodeId, 'high_command', 'High Command', '#A855F7');
      }
    });

    // Check Assembly roles (active & historical)
    if (person.assemblyRoles) {
      Object.entries(person.assemblyRoles).forEach(([asmId, role]) => {
        if (assembliesMap.has(asmId)) {
          const asmNodeId = `${EntityType.ASSEMBLY}:${asmId}`;
          addLink(personNodeId, asmNodeId, 'assembly_role', role, '#06B6D4');
        }
      });
    }
  });

  // 6. ASSEMBLY LEADERS (Assembly -> Person)
  assemblies.forEach((assembly) => {
    const asmNodeId = `${EntityType.ASSEMBLY}:${assembly.id}`;
    const leaders = assembly.leaders || {};

    const roleDefinitions: [string | undefined, string, string][] = [
      [leaders.chiefMinister, 'chief_minister', 'Chief Minister'],
      [leaders.deputyChiefMinister, 'deputy_chief_minister', 'Deputy Chief Minister'],
      [leaders.speaker, 'speaker', 'Speaker'],
      [leaders.deputySpeaker, 'deputy_speaker', 'Deputy Speaker'],
      [leaders.leaderOfOpposition, 'leader_of_opposition', 'Leader of Opposition'],
      [leaders.deputyLeaderOfOpposition, 'deputy_leader_of_opposition', 'Deputy Leader of Opposition'],
      [leaders.chiefSecretary, 'chief_secretary', 'Chief Secretary']
    ];

    roleDefinitions.forEach(([personId, relType, relLabel]) => {
      if (personId && personId !== 'vacant') {
        const personNodeId = `${EntityType.PERSON}:${personId}`;
        addLink(asmNodeId, personNodeId, relType, relLabel, '#06B6D4');
      }
    });

    // Independent supports
    if (assembly.independentSupports) {
      Object.entries(assembly.independentSupports).forEach(([personId, note]) => {
        const pNodeId = `${EntityType.PERSON}:${personId}`;
        addLink(pNodeId, asmNodeId, 'independent_support', `Support (${note})`, '#EAB308', 'dashed');
      });
    }
  });

  // 7. CONSTITUENCIES
  constituencies.forEach((con) => {
    const conNodeId = addNode(
      EntityType.CONSTITUENCY,
      con.id,
      con.name,
      con.district ? `District: ${con.district}` : 'Legislative Seat',
      con.imageUrl,
      ENTITY_COLORS[EntityType.CONSTITUENCY],
      con
    );

    // Constituency -> Assembly
    const asmId = con.currentAssemblyId || con.createdInAssemblyId;
    if (asmId && assembliesMap.has(asmId)) {
      const asmNodeId = `${EntityType.ASSEMBLY}:${asmId}`;
      addLink(conNodeId, asmNodeId, 'seat_in_assembly', 'Legislative Seat', '#10B981', 'dotted');
    }

    // Constituency -> Current Incumbent MLA
    if (con.currentIncumbentId && con.currentIncumbentId !== 'vacant') {
      const pNodeId = `${EntityType.PERSON}:${con.currentIncumbentId}`;
      addLink(pNodeId, conNodeId, 'represents_mla', 'Elected MLA', '#10B981');
    }

    // Historical MLAs (recent 2 if different)
    if (Array.isArray(con.history)) {
      con.history
        .filter((h) => h.personId && h.personId !== 'vacant' && h.personId !== con.currentIncumbentId)
        .slice(-2)
        .forEach((h) => {
          const pNodeId = `${EntityType.PERSON}:${h.personId}`;
          addLink(pNodeId, conNodeId, 'former_mla', 'Former MLA', '#94A3B8', 'dashed');
        });
    }
  });

  // 8. DESIGNATIONS / CABINET PORTFOLIOS
  designations.forEach((desig) => {
    const desigNodeId = addNode(
      EntityType.DESIGNATION,
      desig.id,
      desig.name,
      'Constitutional / Executive Post',
      undefined,
      ENTITY_COLORS[EntityType.DESIGNATION],
      desig
    );

    // Incumbent Minister
    if (desig.incumbentId && desig.incumbentId !== 'vacant') {
      const pNodeId = `${EntityType.PERSON}:${desig.incumbentId}`;
      addLink(pNodeId, desigNodeId, 'holds_portfolio', 'Incumbent Minister', '#6366F1');
    }

    // Assembly link
    if (desig.assemblyId && assembliesMap.has(desig.assemblyId)) {
      const asmNodeId = `${EntityType.ASSEMBLY}:${desig.assemblyId}`;
      addLink(desigNodeId, asmNodeId, 'portfolio_assembly', 'Ministry of Assembly', '#6366F1', 'dotted');
    }
  });

  // 9. ORDERS
  if (Array.isArray(orders)) {
    orders.slice(0, 30).forEach((order) => {
      const orderNodeId = addNode(
        EntityType.ORDER,
        order.id,
        order.orderNumber || order.title,
        order.category || 'Executive Order',
        undefined,
        ENTITY_COLORS[EntityType.ORDER],
        order
      );

      if (order.signatoryId) {
        const pNodeId = `${EntityType.PERSON}:${order.signatoryId}`;
        addLink(pNodeId, orderNodeId, 'signed_order', 'Signed By', '#F97316');
      }

      if (order.officialRecipientId) {
        const pNodeId = `${EntityType.PERSON}:${order.officialRecipientId}`;
        addLink(orderNodeId, pNodeId, 'recipient_of_order', 'Issued To', '#F97316');
      }

      if (order.assemblyId && assembliesMap.has(order.assemblyId)) {
        const asmNodeId = `${EntityType.ASSEMBLY}:${order.assemblyId}`;
        addLink(orderNodeId, asmNodeId, 'order_assembly', 'Gazette Order', '#F97316', 'dotted');
      }
    });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links: Array.from(linksMap.values())
  };
}

/**
 * Filter graph data based on selected entity types, search query, and focal node depth
 */
export function filterGraphData(
  fullGraph: GraphData,
  options: {
    selectedTypes: Set<EntityType>;
    searchQuery?: string;
    focusNodeId?: string | null;
    depth?: 1 | 2 | 3 | 'all';
  }
): GraphData {
  const { selectedTypes, searchQuery, focusNodeId, depth = 'all' } = options;

  let candidateNodes = fullGraph.nodes.filter((n) => selectedTypes.has(n.type));
  let nodeIdsSet = new Set(candidateNodes.map((n) => n.id));

  // If a focus node is specified, extract the subgraph within `depth` hops
  if (focusNodeId && nodeIdsSet.has(focusNodeId)) {
    const includedNodeIds = new Set<string>([focusNodeId]);
    const maxHops = depth === 'all' ? 3 : depth;

    // Adjacency map for fast traversal
    const adjMap = new Map<string, Set<string>>();
    fullGraph.links.forEach((link) => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;

      if (!adjMap.has(sId)) adjMap.set(sId, new Set());
      if (!adjMap.has(tId)) adjMap.set(tId, new Set());

      adjMap.get(sId)!.add(tId);
      adjMap.get(tId)!.add(sId);
    });

    let currentFrontier = new Set<string>([focusNodeId]);
    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier = new Set<string>();
      currentFrontier.forEach((nodeId) => {
        const neighbors = adjMap.get(nodeId);
        if (neighbors) {
          neighbors.forEach((nbr) => {
            // Check if neighbor entity type is permitted in filter
            const nbrNode = fullGraph.nodes.find((n) => n.id === nbr);
            if (nbrNode && selectedTypes.has(nbrNode.type)) {
              if (!includedNodeIds.has(nbr)) {
                includedNodeIds.add(nbr);
                nextFrontier.add(nbr);
              }
            }
          });
        }
      });
      currentFrontier = nextFrontier;
    }

    candidateNodes = candidateNodes.filter((n) => includedNodeIds.has(n.id));
    nodeIdsSet = includedNodeIds;
  }

  // Filter links where both source and target are in the candidate nodes
  const filteredLinks = fullGraph.links.filter((l) => {
    const sId = typeof l.source === 'object' ? l.source.id : l.source;
    const tId = typeof l.target === 'object' ? l.target.id : l.target;
    return nodeIdsSet.has(sId) && nodeIdsSet.has(tId);
  });

  return {
    nodes: candidateNodes,
    links: filteredLinks
  };
}
