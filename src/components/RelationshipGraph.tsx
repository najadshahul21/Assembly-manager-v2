import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router';
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ExternalLink,
  X,
  Play,
  Pause,
  Download,
  Filter,
  Eye,
  Crosshair,
  User,
  Flag,
  Shield,
  Landmark,
  MapPin,
  Award,
  Stamp,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EntityType } from '../types';
import { GraphData, GraphNode, GraphLink } from '../types/graph';
import { ENTITY_COLORS, filterGraphData } from '../utils/relationshipGraphBuilder';

interface RelationshipGraphProps {
  graphData: GraphData;
  initialFocusNodeId?: string | null;
  height?: number | string;
  isCompact?: boolean;
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  graphData,
  initialFocusNodeId = null,
  height = '100%',
  isCompact = false
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const navigate = useNavigate();

  // State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(initialFocusNodeId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [depth, setDepth] = useState<1 | 2 | 'all'>(initialFocusNodeId ? 1 : 'all');

  // Filter types toggle
  const [selectedTypes, setSelectedTypes] = useState<Set<EntityType>>(
    new Set([
      EntityType.ALLIANCE,
      EntityType.PARTY,
      EntityType.PERSON,
      EntityType.ASSEMBLY,
      EntityType.CONSTITUENCY,
      EntityType.DESIGNATION,
      EntityType.ORDER
    ])
  );

  // Type metadata
  const typeIcons: Record<EntityType, React.ElementType> = {
    [EntityType.ALLIANCE]: Shield,
    [EntityType.PARTY]: Flag,
    [EntityType.PERSON]: User,
    [EntityType.ASSEMBLY]: Landmark,
    [EntityType.CONSTITUENCY]: MapPin,
    [EntityType.DESIGNATION]: Award,
    [EntityType.ORDER]: Stamp
  };

  const typeLabels: Record<EntityType, string> = {
    [EntityType.ALLIANCE]: 'Alliances',
    [EntityType.PARTY]: 'Parties',
    [EntityType.PERSON]: 'Persons',
    [EntityType.ASSEMBLY]: 'Assemblies',
    [EntityType.CONSTITUENCY]: 'Constituencies',
    [EntityType.DESIGNATION]: 'Designations',
    [EntityType.ORDER]: 'Orders'
  };

  // Toggle filter
  const toggleType = (type: EntityType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Compute filtered graph data
  const filteredData = useMemo(() => {
    return filterGraphData(graphData, {
      selectedTypes,
      focusNodeId: focusNodeId,
      depth: depth
    });
  }, [graphData, selectedTypes, focusNodeId, depth]);

  // Compute node lookup map for fast neighbor retrieval
  const neighborsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    filteredData.links.forEach((l) => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      if (!map.has(sId)) map.set(sId, new Set());
      if (!map.has(tId)) map.set(tId, new Set());
      map.get(sId)!.add(tId);
      map.get(tId)!.add(sId);
    });
    return map;
  }, [filteredData]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return graphData.nodes
      .filter((n) => n.name.toLowerCase().includes(q) || (n.subText && n.subText.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [graphData.nodes, searchQuery]);

  // Connected links for selected node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode) return [];
    const id = selectedNode.id;
    return filteredData.links
      .filter((l) => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId === id || tId === id;
      })
      .map((l) => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        const isSource = sId === id;
        const otherId = isSource ? tId : sId;
        const otherNode = filteredData.nodes.find((n) => n.id === otherId);
        return {
          link: l,
          otherNode,
          direction: isSource ? 'outgoing' : 'incoming',
          label: l.label
        };
      })
      .filter((c) => Boolean(c.otherNode));
  }, [selectedNode, filteredData]);

  // Zoom helpers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7);
    }
  };

  const handleResetZoom = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth || 900;
      const height = containerRef.current.clientHeight || 600;
      d3.select(svgRef.current)
        .transition()
        .duration(600)
        .call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85).translate(-width / 2, -height / 2)
        );
    }
  }, []);

  const centerOnNode = useCallback((node: GraphNode) => {
    if (svgRef.current && zoomBehaviorRef.current && containerRef.current && node.x !== undefined && node.y !== undefined) {
      const width = containerRef.current.clientWidth || 900;
      const height = containerRef.current.clientHeight || 600;
      const scale = 1.4;
      const x = width / 2 - node.x * scale;
      const y = height / 2 - node.y * scale;

      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .ease(d3.easeCubicOut)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    }
  }, []);

  // Export as SVG / PNG
  const handleExportPNG = () => {
    if (!svgRef.current || !containerRef.current) return;
    const svgElement = svgRef.current;
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const width = containerRef.current.clientWidth || 1200;
    const height = containerRef.current.clientHeight || 800;
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.fillStyle = '#090a0f';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(blobURL);
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `relationship-network-${Date.now()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };
    img.src = blobURL;
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Initialize or re-run D3 Force Simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Deep copy nodes and links for D3 simulation
    const nodes: GraphNode[] = filteredData.nodes.map((d) => ({ ...d }));
    const links: GraphLink[] = filteredData.links.map((d) => ({ ...d }));

    // Container for zooming
    const g = svg.append('g').attr('class', 'graph-root');

    // Define Defs: Glow filters and Arrow markers
    const defs = svg.append('defs');

    // Glow Filter
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrow markers for different entity types
    Object.entries(ENTITY_COLORS).forEach(([type, color]) => {
      defs
        .append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 28)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L10,0L0,4')
        .attr('fill', color)
        .attr('opacity', 0.85);
    });

    // Patterns for images
    nodes.forEach((node) => {
      if (node.imageUrl) {
        defs
          .append('pattern')
          .attr('id', `avatar-${node.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`)
          .attr('width', 1)
          .attr('height', 1)
          .attr('patternContentUnits', 'objectBoundingBox')
          .append('image')
          .attr('xlink:href', node.imageUrl)
          .attr('width', 1)
          .attr('height', 1)
          .attr('preserveAspectRatio', 'xMidYMid slice');
      }
    });

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initial transform
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85).translate(-width / 2, -height / 2)
    );

    // Links Layer
    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => d.color || '#475569')
      .attr('stroke-width', (d) => (d.style === 'solid' ? 1.8 : 1.2))
      .attr('stroke-dasharray', (d) => {
        if (d.style === 'dashed') return '4,4';
        if (d.style === 'dotted') return '2,3';
        return undefined;
      })
      .attr('stroke-opacity', 0.45)
      .attr('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        setHoveredLinkId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredLinkId(null);
      });

    // Link Labels Layer (optional badges for relations)
    const linkLabelGroup = g.append('g').attr('class', 'link-labels');
    const linkLabel = linkLabelGroup
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(links)
      .join('text')
      .attr('font-size', '9px')
      .attr('font-family', 'sans-serif')
      .attr('font-weight', '600')
      .attr('fill', '#94A3B8')
      .attr('text-anchor', 'middle')
      .attr('dy', -3)
      .attr('pointer-events', 'none')
      .attr('opacity', 0.6)
      .text((d) => d.label);

    // Nodes Layer
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-item')
      .attr('cursor', 'pointer');

    // Outer glow halo circle
    node
      .append('circle')
      .attr('r', (d) => d.radius + 4)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.4)
      .attr('class', 'halo-circle');

    // Main Circle (solid color or pattern)
    node
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => {
        if (d.imageUrl) {
          return `url(#avatar-${d.id.replace(/[^a-zA-Z0-9_-]/g, '_')})`;
        }
        return d.color;
      })
      .attr('stroke', '#0A0E17')
      .attr('stroke-width', 2.5);

    // Monogram fallback if no image
    node
      .filter((d) => !d.imageUrl)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#FFFFFF')
      .attr('font-size', (d) => Math.max(9, d.radius * 0.75))
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text((d) => {
        const parts = d.name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return d.name.slice(0, 2).toUpperCase();
      });

    // Degree badge (number of relationships)
    node
      .append('circle')
      .attr('cx', (d) => d.radius * 0.72)
      .attr('cy', (d) => -d.radius * 0.72)
      .attr('r', 7)
      .attr('fill', '#05070A')
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 1.2);

    node
      .append('text')
      .attr('x', (d) => d.radius * 0.72)
      .attr('y', (d) => -d.radius * 0.72)
      .attr('dy', '.32em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '8px')
      .attr('font-weight', '700')
      .attr('pointer-events', 'none')
      .text((d) => d.degree);

    // Node Name Label
    node
      .append('text')
      .attr('dy', (d) => d.radius + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#F8FAFC')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'sans-serif')
      .style('paint-order', 'stroke')
      .style('stroke', '#05070A')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round')
      .text((d) => (d.name.length > 20 ? `${d.name.slice(0, 19)}…` : d.name));

    // Node Subtext (Party / Role)
    node
      .append('text')
      .attr('dy', (d) => d.radius + 26)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => d.color)
      .attr('font-size', '9px')
      .attr('font-weight', '500')
      .style('paint-order', 'stroke')
      .style('stroke', '#05070A')
      .style('stroke-width', '2.5px')
      .style('stroke-linejoin', 'round')
      .text((d) => d.subText || d.type.toUpperCase());

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Interactions: Click & Hover
    node
      .on('click', (_event, d) => {
        setSelectedNode(d);
        centerOnNode(d);
      })
      .on('mouseenter', (_event, d) => {
        setHoveredNodeId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
      });

    // Setup Simulation
    const simulation = d3
      .forceSimulation<GraphNode, GraphLink>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => (d.relationType.includes('leader') || d.relationType.includes('speaker') ? 95 : 130))
          .strength(0.65)
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength((d) => -320 - d.radius * 7))
      .force('collide', d3.forceCollide<GraphNode>().radius((d) => d.radius + 18).iterations(2))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04))
      .alpha(0.8)
      .alphaDecay(0.035);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);

      linkLabel
        .attr('x', (d) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    simulationRef.current = simulation;

    // If initial focus is requested, select and center once simulation runs
    if (initialFocusNodeId) {
      const match = nodes.find((n) => n.id === initialFocusNodeId || n.rawId === initialFocusNodeId);
      if (match) {
        setSelectedNode(match);
        setTimeout(() => {
          centerOnNode(match);
        }, 300);
      }
    }

    return () => {
      simulation.stop();
    };
  }, [filteredData, initialFocusNodeId, centerOnNode]);

  // Update opacity highlights on hover or selected node
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const activeId = hoveredNodeId || (selectedNode ? selectedNode.id : null);

    if (!activeId) {
      // Normal state: all visible
      svg.selectAll('.node-item').transition().duration(180).attr('opacity', 1);
      svg.selectAll('line').transition().duration(180).attr('stroke-opacity', 0.45).attr('stroke-width', (d: any) => (d.style === 'solid' ? 1.8 : 1.2));
      svg.selectAll('.link-labels text').transition().duration(180).attr('opacity', 0.6);
      return;
    }

    const connectedNeighbors = neighborsMap.get(activeId) || new Set<string>();

    // Fade unrelated nodes
    svg
      .selectAll<SVGGElement, GraphNode>('.node-item')
      .transition()
      .duration(150)
      .attr('opacity', (d) => (d.id === activeId || connectedNeighbors.has(d.id) ? 1 : 0.15));

    // Highlight active links
    svg
      .selectAll<SVGLineElement, GraphLink>('line')
      .transition()
      .duration(150)
      .attr('stroke-opacity', (d) => {
        const sId = typeof d.source === 'object' ? d.source.id : d.source;
        const tId = typeof d.target === 'object' ? d.target.id : d.target;
        return sId === activeId || tId === activeId ? 0.95 : 0.05;
      })
      .attr('stroke-width', (d) => {
        const sId = typeof d.source === 'object' ? d.source.id : d.source;
        const tId = typeof d.target === 'object' ? d.target.id : d.target;
        return sId === activeId || tId === activeId ? 3 : 1;
      });

    // Highlight active link labels
    svg
      .selectAll<SVGTextElement, GraphLink>('.link-labels text')
      .transition()
      .duration(150)
      .attr('opacity', (d) => {
        const sId = typeof d.source === 'object' ? d.source.id : d.source;
        const tId = typeof d.target === 'object' ? d.target.id : d.target;
        return sId === activeId || tId === activeId ? 1 : 0.05;
      });
  }, [hoveredNodeId, selectedNode, neighborsMap]);

  // Pause / Resume simulation
  const togglePause = () => {
    if (!simulationRef.current) return;
    if (isPaused) {
      simulationRef.current.alphaTarget(0.15).restart();
    } else {
      simulationRef.current.stop();
    }
    setIsPaused(!isPaused);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-[#06080F] border border-white/10 rounded-2xl flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Search Bar & Focus Status */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <div className="flex items-center gap-2 bg-[#0E131F]/90 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 text-sm shadow-xl">
              <Search size={16} className="text-[#FFD700]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search network (person, party, seat)..."
                className="bg-transparent border-none text-xs sm:text-sm text-white focus:outline-none w-44 sm:w-60 placeholder:text-gray-500 font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-[#0C101A] border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 max-h-64 overflow-y-auto z-30">
                {searchResults.map((node) => {
                  const Icon = typeIcons[node.type];
                  return (
                    <button
                      key={node.id}
                      onClick={() => {
                        setSelectedNode(node);
                        centerOnNode(node);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 text-left transition-colors text-xs"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border"
                        style={{ borderColor: node.color, backgroundColor: `${node.color}22` }}
                      >
                        <Icon size={12} style={{ color: node.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white truncate">{node.name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{node.subText || node.type}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Focal Node badge if active */}
          {focusNodeId && (
            <div className="hidden sm:flex items-center gap-2 bg-[#0E131F]/90 backdrop-blur-md border border-[#FFD700]/30 rounded-xl px-3 py-2 text-xs shadow-xl text-[#FFD700]">
              <Crosshair size={14} />
              <span>Focused Subgraph</span>
              <button
                onClick={() => setFocusNodeId(null)}
                className="ml-1 hover:bg-white/10 rounded p-0.5 text-gray-400 hover:text-white"
                title="Reset Focus to Full Network"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto bg-[#0E131F]/90 backdrop-blur-md border border-white/15 rounded-xl p-1 shadow-xl">
          {/* Depth selector */}
          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 pl-2">Depth:</span>
            {(['1', '2', 'all'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d === 'all' ? 'all' : (Number(d) as 1 | 2))}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  depth === (d === 'all' ? 'all' : Number(d))
                    ? 'bg-[#FFD700] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {d === 'all' ? 'All' : `${d} Hop`}
              </button>
            ))}
          </div>

          {/* Zoom controls */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Reset Zoom / Fit"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={togglePause}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title={isPaused ? 'Resume Physics' : 'Freeze Physics'}
          >
            {isPaused ? <Play size={16} className="text-green-400" /> : <Pause size={16} />}
          </button>
          <button
            onClick={handleExportPNG}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Export as PNG"
          >
            <Download size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => {
          // If clicked directly on canvas background, deselect node
          if ((e.target as HTMLElement).tagName === 'svg') {
            setSelectedNode(null);
          }
        }}
      />

      {/* Bottom Entity Type Filter Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto bg-[#0E131F]/90 backdrop-blur-md border border-white/15 rounded-xl p-1.5 shadow-xl max-w-full overflow-x-auto">
          <div className="flex items-center gap-1 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <Filter size={12} />
            <span>Entities:</span>
          </div>
          {Object.entries(typeLabels).map(([typeKey, label]) => {
            const type = typeKey as EntityType;
            const isSelected = selectedTypes.has(type);
            const color = ENTITY_COLORS[type];
            const Icon = typeIcons[type];
            const count = graphData.nodes.filter((n) => n.type === type).length;

            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'bg-white/10 text-white border-white/20 shadow-sm'
                    : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300 opacity-60'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <Icon size={12} style={{ color: isSelected ? color : '#64748B' }} />
                <span>{label}</span>
                <span className="text-[10px] opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Graph Meta stats */}
        <div className="hidden md:flex items-center gap-3 pointer-events-auto bg-[#0E131F]/90 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 text-[11px] text-gray-400 shadow-xl font-mono">
          <span>Nodes: <strong className="text-white">{filteredData.nodes.length}</strong></span>
          <span>•</span>
          <span>Relationships: <strong className="text-white">{filteredData.links.length}</strong></span>
        </div>
      </div>

      {/* Selected Node Inspector Drawer (Slide-out panel) */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25 }}
            className="absolute top-16 right-4 bottom-16 w-80 sm:w-96 bg-[#0B0F19]/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 shadow-lg"
                  style={{ borderColor: selectedNode.color, backgroundColor: `${selectedNode.color}22` }}
                >
                  {selectedNode.imageUrl ? (
                    <img src={selectedNode.imageUrl} alt={selectedNode.name} className="w-full h-full object-cover" />
                  ) : (
                    React.createElement(typeIcons[selectedNode.type], {
                      size: 22,
                      style: { color: selectedNode.color }
                    })
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border"
                      style={{
                        borderColor: `${selectedNode.color}55`,
                        backgroundColor: `${selectedNode.color}22`,
                        color: selectedNode.color
                      }}
                    >
                      {selectedNode.type}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {selectedNodeConnections.length} links
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white truncate mt-0.5">{selectedNode.name}</h3>
                  {selectedNode.subText && (
                    <p className="text-xs text-gray-400 truncate">{selectedNode.subText}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  navigate(`/${selectedNode.type}/${selectedNode.rawId}`);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#FFD700] hover:bg-[#FFE55C] text-black font-bold text-xs rounded-xl transition-all shadow-md"
              >
                <ExternalLink size={13} />
                <span>View Full Page</span>
              </button>

              <button
                onClick={() => {
                  setFocusNodeId(selectedNode.id);
                  setDepth(1);
                  centerOnNode(selectedNode);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition-all border border-white/10"
                title="Isolate this node's direct network"
              >
                <Crosshair size={13} className="text-[#FFD700]" />
                <span>Focus Hub</span>
              </button>
            </div>

            {/* Relationship Connections List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Connected Relationships ({selectedNodeConnections.length})
              </h4>

              {selectedNodeConnections.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No active relationships found for current filters.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedNodeConnections.map(({ link, otherNode, label }, idx) => {
                    if (!otherNode) return null;
                    const Icon = typeIcons[otherNode.type];

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedNode(otherNode);
                          centerOnNode(otherNode);
                        }}
                        className="group flex items-center justify-between p-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/20 rounded-xl cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                            style={{ borderColor: otherNode.color, backgroundColor: `${otherNode.color}22` }}
                          >
                            <Icon size={14} style={{ color: otherNode.color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-[#FFD700] uppercase tracking-wider flex items-center gap-1">
                              <span>{label}</span>
                              <ArrowRight size={10} className="text-gray-500 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                            <div className="text-xs font-bold text-white truncate">{otherNode.name}</div>
                            {otherNode.subText && (
                              <div className="text-[10px] text-gray-400 truncate">{otherNode.subText}</div>
                            )}
                          </div>
                        </div>

                        <span
                          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ml-2 shrink-0"
                          style={{ borderColor: `${otherNode.color}44`, color: otherNode.color }}
                        >
                          {otherNode.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
