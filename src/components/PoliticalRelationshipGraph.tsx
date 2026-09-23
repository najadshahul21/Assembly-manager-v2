import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Filter,
  Users,
  Flag,
  Shield,
  X,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { Person, Party, Alliance, EntityType } from '../types';
import { formatPersonName } from '../utils/governmentUtils';

// --- Graph Types ---
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  entityId: string;
  entityType: 'alliance' | 'party' | 'member';
  name: string;
  label: string;
  color: string;
  secondaryColor?: string;
  imageUrl?: string;
  logoUrl?: string;
  radius: number;
  partyId?: string;
  allianceId?: string;
  roleText?: string;
  isSuspended?: boolean;
  degree?: number;
  data: Alliance | Party | Person;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'alliance-party' | 'party-member' | 'alliance-leadership';
  label: string;
  color: string;
  dashed?: boolean;
  strength?: number;
}

interface PoliticalRelationshipGraphProps {
  alliances: Alliance[];
  parties: Party[];
  persons: Person[];
  className?: string;
}

export const PoliticalRelationshipGraph: React.FC<PoliticalRelationshipGraphProps> = ({
  alliances,
  parties,
  persons,
  className = ''
}) => {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // States
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAllianceFilter, setSelectedAllianceFilter] = useState<string>('all');
  const [showMembers, setShowMembers] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    node: GraphNode;
    x: number;
    y: number;
  } | null>(null);

  // D3 zoom reference to trigger programmatic zoom
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  // Active (non-suspended) entities
  const activeAlliances = useMemo(() => alliances, [alliances]);
  const activeParties = useMemo(() => parties.filter((p) => !p.isSuspended), [parties]);
  const activePersons = useMemo(() => persons.filter((p) => !p.isSuspended), [persons]);

  // Construct Nodes and Links
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // 1. Alliance Nodes
    activeAlliances.forEach((alliance) => {
      // If filtering by alliance, skip non-matching
      if (selectedAllianceFilter !== 'all' && alliance.id !== selectedAllianceFilter) {
        return;
      }

      const primaryColor = alliance.colors?.[0] || '#9333EA';
      const node: GraphNode = {
        id: `alliance_${alliance.id}`,
        entityId: alliance.id,
        entityType: 'alliance',
        name: alliance.name,
        label: alliance.abbreviation || alliance.name,
        color: primaryColor,
        secondaryColor: alliance.colors?.[1] || primaryColor,
        logoUrl: alliance.logoUrl,
        radius: 32,
        roleText: 'Political Alliance / Front',
        data: alliance,
        degree: 0
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // 2. Party Nodes
    activeParties.forEach((party) => {
      // Check alliance filtering
      if (selectedAllianceFilter !== 'all') {
        if (selectedAllianceFilter === 'unaligned') {
          if (party.allianceId && party.allianceId !== 'independent') return;
        } else if (party.allianceId !== selectedAllianceFilter) {
          return;
        }
      }

      const primaryColor = party.colors?.[0] || '#3B82F6';
      const node: GraphNode = {
        id: `party_${party.id}`,
        entityId: party.id,
        entityType: 'party',
        name: party.name,
        label: party.abbreviation || party.name,
        color: primaryColor,
        secondaryColor: party.colors?.[1] || primaryColor,
        logoUrl: party.logoUrl,
        radius: 20,
        allianceId: party.allianceId,
        roleText: 'Constituent Party',
        data: party,
        degree: 0
      };
      nodes.push(node);
      nodeMap.set(node.id, node);

      // Connect party to alliance
      if (party.allianceId && party.allianceId !== 'independent') {
        const allianceNodeId = `alliance_${party.allianceId}`;
        if (nodeMap.has(allianceNodeId)) {
          links.push({
            id: `link_${node.id}_${allianceNodeId}`,
            source: node.id,
            target: allianceNodeId,
            type: 'alliance-party',
            label: 'Member of Front',
            color: primaryColor,
            strength: 0.9
          });
        }
      }
    });

    // 3. Member Nodes (if showMembers enabled)
    if (showMembers) {
      activePersons.forEach((person) => {
        // Find party
        const personParty = activeParties.find((p) => p.id === person.partyId);
        
        // Filter check
        if (selectedAllianceFilter !== 'all') {
          if (selectedAllianceFilter === 'unaligned') {
            if (personParty?.allianceId && personParty.allianceId !== 'independent') return;
          } else if (personParty?.allianceId !== selectedAllianceFilter) {
            return;
          }
        }

        const partyNodeId = `party_${person.partyId}`;
        const hasPartyInGraph = nodeMap.has(partyNodeId);

        // If person has party in graph or is independent
        const primaryColor = personParty?.colors?.[0] || '#A1A1AA';
        const role: string = person.constituencyName
          ? `MLA for ${person.constituencyName}`
          : person.assemblyRoles && Object.keys(person.assemblyRoles).length > 0
          ? String(Object.values(person.assemblyRoles)[0])
          : 'Politician';

        const node: GraphNode = {
          id: `member_${person.id}`,
          entityId: person.id,
          entityType: 'member',
          name: person.name,
          label: person.name.split(' ').slice(-1)[0] || person.name,
          color: primaryColor,
          imageUrl: person.imageUrl,
          radius: 12,
          partyId: person.partyId,
          allianceId: personParty?.allianceId,
          roleText: role,
          data: person,
          degree: 0
        };
        nodes.push(node);
        nodeMap.set(node.id, node);

        // Connect to party
        if (hasPartyInGraph) {
          links.push({
            id: `link_${node.id}_${partyNodeId}`,
            source: node.id,
            target: partyNodeId,
            type: 'party-member',
            label: 'Affiliated Member',
            color: primaryColor,
            strength: 0.7
          });
        }

        // Connect leadership to Alliance if person is high command or leader
        if (personParty?.allianceId && personParty.allianceId !== 'independent') {
          const allianceNodeId = `alliance_${personParty.allianceId}`;
          const alliance = activeAlliances.find((a) => a.id === personParty.allianceId);
          if (alliance && nodeMap.has(allianceNodeId)) {
            const isLeader =
              alliance.leaderId === person.id ||
              alliance.chairmanId === person.id ||
              alliance.founderId === person.id ||
              (alliance.highCommandIds && alliance.highCommandIds.includes(person.id));

            if (isLeader) {
              links.push({
                id: `link_lead_${node.id}_${allianceNodeId}`,
                source: node.id,
                target: allianceNodeId,
                type: 'alliance-leadership',
                label: 'Alliance High Command',
                color: '#FFD700',
                dashed: true,
                strength: 0.4
              });
            }
          }
        }
      });
    }

    // Compute degrees
    links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      const s = nodeMap.get(srcId);
      const t = nodeMap.get(tgtId);
      if (s) s.degree = (s.degree || 0) + 1;
      if (t) t.degree = (t.degree || 0) + 1;
    });

    return { nodes, links };
  }, [activeAlliances, activeParties, activePersons, selectedAllianceFilter, showMembers]);

  // Set of connected node IDs for highlighting
  const connectedNodeIds = useMemo(() => {
    const target = hoveredNode || selectedNode;
    if (!target) return null;

    const set = new Set<string>();
    set.add(target.id);

    graphData.links.forEach((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      if (srcId === target.id) set.add(tgtId);
      if (tgtId === target.id) set.add(srcId);
    });

    return set;
  }, [hoveredNode, selectedNode, graphData.links]);

  // Search matching node IDs
  const searchMatchedNodeIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    graphData.nodes.forEach((n) => {
      if (
        n.name.toLowerCase().includes(q) ||
        n.label.toLowerCase().includes(q) ||
        (n.entityType === 'party' && (n.data as Party).abbreviation?.toLowerCase().includes(q)) ||
        (n.entityType === 'alliance' && (n.data as Alliance).abbreviation?.toLowerCase().includes(q))
      ) {
        set.add(n.id);
      }
    });
    return set;
  }, [searchQuery, graphData.nodes]);

  // D3 Rendering & Simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svgElement = svgRef.current;
    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = isFullscreen ? window.innerHeight - 120 : 620;

    const svg = d3.select(svgElement);
    svg.selectAll('*').remove(); // Clear previous render

    svg.attr('width', width).attr('height', height);

    // Defs for filters and patterns
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'node-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Subtle dark shadow for text readability
    const textFilter = defs.append('filter').attr('id', 'text-bg').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    textFilter.append('feFlood').attr('flood-color', '#09090b').attr('flood-opacity', '0.85');
    textFilter.append('feComposite').attr('in2', 'SourceGraphic').attr('operator', 'under');

    // Root group for zooming
    const g = svg.append('g').attr('class', 'zoom-layer');

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Clone data for simulation so D3 doesn't mutate React state directly
    const nodes: GraphNode[] = graphData.nodes.map((d) => ({ ...d }));
    const links: GraphLink[] = graphData.links.map((d) => ({
      ...d,
      source: typeof d.source === 'string' ? d.source : (d.source as GraphNode).id,
      target: typeof d.target === 'string' ? d.target : (d.target as GraphNode).id
    }));

    // Links container
    const linkGroup = g.append('g').attr('class', 'links-layer');

    // Nodes container
    const nodeGroup = g.append('g').attr('class', 'nodes-layer');

    // Force Simulation setup
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            if (d.type === 'alliance-party') return 120;
            if (d.type === 'alliance-leadership') return 140;
            return 55;
          })
          .strength((d) => d.strength || 0.7)
      )
      .force(
        'charge',
        d3.forceManyBody<GraphNode>().strength((d) => {
          if (d.entityType === 'alliance') return -500;
          if (d.entityType === 'party') return -180;
          return -45;
        })
      )
      .force(
        'collision',
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 10)
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04));

    simulationRef.current = simulation;

    // Render Links
    const linkElements = linkGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => d.color || '#4B5563')
      .attr('stroke-width', (d) => {
        if (d.type === 'alliance-party') return 2.5;
        if (d.type === 'alliance-leadership') return 1.8;
        return 1.2;
      })
      .attr('stroke-opacity', (d) => (d.type === 'alliance-leadership' ? 0.8 : 0.45))
      .attr('stroke-dasharray', (d) => (d.dashed ? '4,4' : 'none'))
      .attr('class', 'transition-opacity duration-200');

    // Render Nodes
    const nodeElements = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'cursor-pointer select-none')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            // keep fixed slightly to allow custom layout exploration, unfix on double click
          })
      );

    // Node double click releases fixed position
    nodeElements.on('dblclick', (event, d) => {
      event.stopPropagation();
      d.fx = null;
      d.fy = null;
      simulation.alpha(0.15).restart();
    });

    // 1. Background Halo/Aura for Alliance nodes
    nodeElements
      .filter((d) => d.entityType === 'alliance')
      .append('circle')
      .attr('r', (d) => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,3')
      .attr('opacity', 0.6)
      .attr('filter', 'url(#node-glow)');

    // 2. Main Circle
    nodeElements
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => {
        if (d.entityType === 'alliance') return '#18181B';
        if (d.entityType === 'party') return '#111827';
        return '#1F2937';
      })
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => (d.entityType === 'alliance' ? 3.5 : d.entityType === 'party' ? 2.5 : 1.5));

    // 3. Node Content (Images, Logos, or Initials)
    // Clip paths for circular member portraits
    nodes.forEach((d) => {
      if (d.imageUrl && d.entityType === 'member') {
        const clipId = `clip_${d.id}`;
        defs
          .append('clipPath')
          .attr('id', clipId)
          .append('circle')
          .attr('r', d.radius - 1.5);
      }
    });

    // Images for members with imageUrl
    nodeElements
      .filter((d) => d.entityType === 'member' && !!d.imageUrl)
      .append('image')
      .attr('xlink:href', (d) => d.imageUrl!)
      .attr('x', (d) => -d.radius)
      .attr('y', (d) => -d.radius)
      .attr('width', (d) => d.radius * 2)
      .attr('height', (d) => d.radius * 2)
      .attr('clip-path', (d) => `url(#clip_${d.id})`)
      .attr('preserveAspectRatio', 'xMidYMid slice');

    // Central text for Alliance and Party
    nodeElements
      .filter((d) => d.entityType === 'alliance' || d.entityType === 'party')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', (d) => (d.entityType === 'alliance' ? '#FFD700' : '#FFFFFF'))
      .attr('font-size', (d) => (d.entityType === 'alliance' ? '11px' : '9px'))
      .attr('font-weight', '900')
      .attr('letter-spacing', '0.05em')
      .text((d) => d.label.slice(0, 7));

    // Fallback initials for members without photos
    nodeElements
      .filter((d) => d.entityType === 'member' && !d.imageUrl)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#D1D5DB')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .text((d) => d.name.slice(0, 2).toUpperCase());

    // Below-node Labels (for Alliances and Parties always, Members when focused or hovered)
    nodeElements
      .append('text')
      .attr('class', 'node-label pointer-events-none')
      .attr('text-anchor', 'middle')
      .attr('y', (d) => d.radius + 12)
      .attr('fill', '#E5E7EB')
      .attr('font-size', (d) => (d.entityType === 'alliance' ? '11px' : d.entityType === 'party' ? '10px' : '8px'))
      .attr('font-weight', (d) => (d.entityType === 'member' ? '500' : '700'))
      .attr('opacity', (d) => (d.entityType === 'member' ? 0 : 0.9))
      .text((d) => d.name);

    // Interactive Hover & Click
    nodeElements
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
        const rect = container.getBoundingClientRect();
        setTooltipData({
          node: d,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
      })
      .on('mousemove', (event) => {
        const rect = container.getBoundingClientRect();
        setTooltipData((prev) => (prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null));
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
        setTooltipData(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // Background click deselects
    svg.on('click', () => {
      setSelectedNode(null);
    });

    // Ticking updates
    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0);

      nodeElements.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Fit view initially with slight delay for layout relaxation
    const timer = setTimeout(() => {
      if (nodes.length > 0 && svgElement) {
        // Initial gentle zoom fit
        svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.95));
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      simulation.stop();
    };
  }, [graphData, isFullscreen]);

  // Dynamic Opacity / Highlighting updates based on selection, hover, and search
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const activeHighlightedIds = searchMatchedNodeIds || connectedNodeIds;
    const hasActiveHighlight = activeHighlightedIds !== null;

    // Update Nodes
    svg.selectAll<SVGGElement, GraphNode>('.nodes-layer g').each(function (d) {
      const el = d3.select(this);
      const isSelected = selectedNode?.id === d.id;
      const isHighlighted = activeHighlightedIds ? activeHighlightedIds.has(d.id) : true;
      const isSearchMatch = searchMatchedNodeIds ? searchMatchedNodeIds.has(d.id) : false;

      if (hasActiveHighlight) {
        el.attr('opacity', isHighlighted ? 1 : 0.15);
      } else {
        el.attr('opacity', 1);
      }

      // Border emphasis on selected/matched
      const circle = el.select('circle:nth-of-type(1)');
      if (isSelected || isSearchMatch) {
        circle.attr('stroke', '#FFD700').attr('stroke-width', d.entityType === 'alliance' ? 5 : 3.5);
      } else {
        circle.attr('stroke', d.color).attr('stroke-width', d.entityType === 'alliance' ? 3.5 : d.entityType === 'party' ? 2.5 : 1.5);
      }

      // Member labels visible when highlighted or selected
      if (d.entityType === 'member') {
        const textLabel = el.select<SVGTextElement>('.node-label');
        textLabel.attr('opacity', isHighlighted || isSelected ? 1 : 0);
      }
    });

    // Update Links
    svg.selectAll<SVGLineElement, GraphLink>('.links-layer line').each(function (d) {
      const el = d3.select(this);
      const srcId = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
      const tgtId = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;

      if (hasActiveHighlight) {
        const isConnected = activeHighlightedIds.has(srcId) && activeHighlightedIds.has(tgtId);
        el.attr('stroke-opacity', isConnected ? 0.9 : 0.05).attr('stroke-width', isConnected ? 2.8 : 1);
      } else {
        el.attr('stroke-opacity', d.type === 'alliance-leadership' ? 0.8 : 0.45).attr('stroke-width', d.type === 'alliance-party' ? 2.5 : d.type === 'alliance-leadership' ? 1.8 : 1.2);
      }
    });
  }, [connectedNodeIds, searchMatchedNodeIds, selectedNode]);

  // Programmatic Zoom Helpers
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.7);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    if (simulationRef.current) {
      simulationRef.current.alpha(0.2).restart();
    }
  };

  const handleFocusNode = useCallback((node: GraphNode) => {
    if (!svgRef.current || !zoomBehaviorRef.current || !node.x || !node.y) return;
    const container = containerRef.current;
    const width = container?.clientWidth || 900;
    const height = isFullscreen ? window.innerHeight - 120 : 620;

    const scale = node.entityType === 'member' ? 1.8 : 1.3;
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-node.x, -node.y);

    d3.select(svgRef.current).transition().duration(600).call(zoomBehaviorRef.current.transform, transform);
    setSelectedNode(node);
  }, [isFullscreen]);

  // Entity Details for Inspector Drawer
  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) return null;

    if (selectedNode.entityType === 'alliance') {
      const alliance = selectedNode.data as Alliance;
      const constituentParties = activeParties.filter((p) => p.allianceId === alliance.id);
      const constituentPartyIds = new Set(constituentParties.map((p) => p.id));
      const affiliatedMembers = activePersons.filter((p) => constituentPartyIds.has(p.partyId));

      return {
        title: alliance.name,
        subtitle: alliance.abbreviation || 'Political Alliance',
        typeLabel: 'Front / Coalition',
        color: selectedNode.color,
        logoUrl: alliance.logoUrl,
        founded: alliance.foundedDate || 'Established Front',
        stats: [
          { label: 'Parties', value: constituentParties.length },
          { label: 'Politicians', value: affiliatedMembers.length },
          { label: 'High Command', value: alliance.highCommandIds?.length || 0 }
        ],
        parties: constituentParties,
        members: affiliatedMembers.slice(0, 10),
        navigateTo: `/alliance/${alliance.id}`
      };
    }

    if (selectedNode.entityType === 'party') {
      const party = selectedNode.data as Party;
      const alliance = activeAlliances.find((a) => a.id === party.allianceId);
      const members = activePersons.filter((p) => p.partyId === party.id);

      return {
        title: party.name,
        subtitle: party.abbreviation ? `${party.abbreviation} · ${party.chairman || 'Party Leadership'}` : party.chairman,
        typeLabel: 'Political Party',
        color: selectedNode.color,
        logoUrl: party.logoUrl,
        founded: party.founded || 'Active Organization',
        stats: [
          { label: 'Front', value: alliance ? alliance.abbreviation || alliance.name : 'Independent' },
          { label: 'Registered Members', value: members.length },
          { label: 'ECI Status', value: party.eciStatus || 'Recognized' }
        ],
        alliance,
        members: members.slice(0, 12),
        navigateTo: `/party/${party.id}`
      };
    }

    if (selectedNode.entityType === 'member') {
      const person = selectedNode.data as Person;
      const party = activeParties.find((p) => p.id === person.partyId);
      const alliance = party ? activeAlliances.find((a) => a.id === party.allianceId) : null;

      return {
        title: formatPersonName(person.name, person.gender),
        subtitle: person.constituencyName ? `MLA for ${person.constituencyName}` : 'Legislative Member',
        typeLabel: 'Politician / Legislator',
        color: selectedNode.color,
        imageUrl: person.imageUrl,
        stats: [
          { label: 'Party', value: party?.abbreviation || 'Independent' },
          { label: 'Front', value: alliance?.abbreviation || 'Unaligned' },
          { label: 'Gender', value: person.gender || 'Not specified' }
        ],
        party,
        alliance,
        navigateTo: `/person/${person.id}`
      };
    }

    return null;
  }, [selectedNode, activeParties, activeAlliances, activePersons]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-3xl bg-[#09090b] border border-white/10 overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-[999] bg-[#09090b]/95 backdrop-blur-xl border-[#FFD700]/30' : className
      }`}
    >
      {/* Top Controls Header */}
      <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-black/60 to-black/30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center text-[#FFD700]">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                Political <span className="gold-text">Relationship Graph</span>
              </h3>
              <p className="text-xs text-gray-400 font-sans">
                Interactive D3 force topology mapping coalitions, political parties, and legislators
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search network..."
              className="w-full bg-white/5 border border-white/10 focus:border-[#FFD700]/50 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Alliance Filter Segmented Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedAllianceFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                selectedAllianceFilter === 'all'
                  ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Fronts
            </button>
            {activeAlliances.map((alliance) => (
              <button
                key={alliance.id}
                onClick={() => setSelectedAllianceFilter(alliance.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  selectedAllianceFilter === alliance.id
                    ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {alliance.abbreviation || alliance.name}
              </button>
            ))}
            <button
              onClick={() => setSelectedAllianceFilter('unaligned')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                selectedAllianceFilter === 'unaligned'
                  ? 'bg-[#FFD700] text-black shadow-md shadow-[#FFD700]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Independents
            </button>
          </div>

          {/* Members Toggle */}
          <button
            onClick={() => setShowMembers((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              showMembers
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-transparent border-white/10 text-gray-500 hover:text-white'
            }`}
            title="Toggle individual member nodes"
          >
            <Users size={14} className={showMembers ? 'text-[#FFD700]' : 'text-gray-500'} />
            <span className="hidden sm:inline">Members</span>
          </button>

          {/* Zoom & Fullscreen Controls */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Reset View"
            >
              <RotateCcw size={14} />
            </button>
            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
            <button
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Graph'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Graph Viewport */}
      <div className="relative w-full h-[620px] bg-[#09090b] overflow-hidden">
        <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

        {/* Empty State */}
        {graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/60 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-4">
              <Shield size={32} />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">No Graph Entities Matching Filter</h4>
            <p className="text-xs text-gray-400 max-w-sm mb-4">
              Adjust your alliance filter or register parties and members to visualize connection topology.
            </p>
            <button
              onClick={() => {
                setSelectedAllianceFilter('all');
                setShowMembers(true);
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black text-xs font-bold rounded-xl transition-all"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Interactive Legend (Bottom Left) */}
        <div className="absolute bottom-4 left-4 p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 text-xs flex flex-col gap-2 pointer-events-auto max-w-[280px]">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-gray-400 pb-1 border-b border-white/5">
            <span>Visual Legend</span>
            <span className="font-mono tabular-nums text-gray-500">
              {graphData.nodes.length} Nodes · {graphData.links.length} Links
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-gray-300">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#FFD700] bg-zinc-900 shadow-sm shadow-[#FFD700]/30" />
              <span>Alliance Front</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-blue-500 bg-zinc-900" />
              <span>Political Party</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border border-gray-400 bg-zinc-700" />
              <span>Legislator / MLA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-[2px] bg-gold-400 border-t border-dashed border-[#FFD700]" />
              <span>High Command</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 pt-1 border-t border-white/5">
            Drag to reposition · Double click to unpin · Click node to inspect
          </div>
        </div>

        {/* Floating Tooltip */}
        {tooltipData && !selectedNode && (
          <div
            className="absolute pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full -mt-3 p-3 rounded-xl bg-zinc-900/95 border border-white/10 shadow-2xl text-left max-w-xs transition-opacity duration-150 backdrop-blur-sm"
            style={{
              left: `${tooltipData.x}px`,
              top: `${tooltipData.y}px`
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: tooltipData.node.color }}
              />
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                {tooltipData.node.roleText}
              </span>
            </div>
            <h5 className="font-bold text-white text-xs leading-snug">{tooltipData.node.name}</h5>
            <div className="mt-1 text-[11px] text-gray-400 flex items-center gap-1.5 font-sans">
              <span>{tooltipData.node.label}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{tooltipData.node.degree || 0} links</span>
            </div>
          </div>
        )}

        {/* Selected Entity Inspector Card (Slide-in Drawer) */}
        {selectedNodeDetails && (
          <div className="absolute top-4 right-4 bottom-4 w-80 sm:w-96 rounded-2xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 p-6 flex flex-col justify-between shadow-2xl z-40 animate-in fade-in slide-in-from-right-4 duration-200 overflow-y-auto">
            <div className="space-y-5">
              {/* Header with Close */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedNodeDetails.imageUrl ? (
                    <img
                      src={selectedNodeDetails.imageUrl}
                      alt={selectedNodeDetails.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-cover border border-white/10 shrink-0"
                    />
                  ) : selectedNodeDetails.logoUrl ? (
                    <img
                      src={selectedNodeDetails.logoUrl}
                      alt={selectedNodeDetails.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-2xl object-contain bg-white/5 p-1 border border-white/10 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-lg"
                      style={{
                        backgroundColor: `${selectedNodeDetails.color}25`,
                        borderColor: selectedNodeDetails.color,
                        color: selectedNodeDetails.color,
                        borderWidth: 1
                      }}
                    >
                      {selectedNodeDetails.subtitle?.slice(0, 3) || selectedNodeDetails.title.slice(0, 2)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFD700] font-bold">
                      {selectedNodeDetails.typeLabel}
                    </span>
                    <h4 className="text-base font-black text-white leading-tight truncate">
                      {selectedNodeDetails.title}
                    </h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{selectedNodeDetails.subtitle}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Stat Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-white/5 rounded-2xl border border-white/5">
                {selectedNodeDetails.stats.map((st, i) => (
                  <div key={i} className="text-left">
                    <span className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-0.5">
                      {st.label}
                    </span>
                    <span className="text-sm font-bold text-white truncate block font-mono tabular-nums">
                      {st.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Connected Parties (if Alliance) */}
              {selectedNodeDetails.parties && selectedNodeDetails.parties.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Constituent Parties ({selectedNodeDetails.parties.length})
                  </h5>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedNodeDetails.parties.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          const target = graphData.nodes.find((n) => n.id === `party_${p.id}`);
                          if (target) handleFocusNode(target);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-200 transition-colors flex items-center gap-1.5"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.colors?.[0] || '#3B82F6' }}
                        />
                        <span>{p.abbreviation || p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Affiliated Members */}
              {selectedNodeDetails.members && selectedNodeDetails.members.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Key Members & Legislators ({selectedNodeDetails.members.length})
                  </h5>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedNodeDetails.members.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          const target = graphData.nodes.find((n) => n.id === `member_${m.id}`);
                          if (target) handleFocusNode(target);
                        }}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {m.imageUrl ? (
                            <img
                              src={m.imageUrl}
                              alt={m.name}
                              referrerPolicy="no-referrer"
                              className="w-6 h-6 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px] text-gray-400">
                              {m.name.slice(0, 1)}
                            </div>
                          )}
                          <span className="text-xs font-medium text-gray-200 truncate">{m.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 truncate ml-2">
                          {m.constituencyName || 'MLA'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-white/10 flex items-center gap-2 mt-4">
              <button
                onClick={() => {
                  if (selectedNode) handleFocusNode(selectedNode);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-colors text-center"
              >
                Center in View
              </button>
              <button
                onClick={() => navigate(selectedNodeDetails.navigateTo)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-[#FFD700]/20"
              >
                <span>Full Profile</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
