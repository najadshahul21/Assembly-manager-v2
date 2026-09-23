import { EntityType } from '../types';

export interface GraphNode {
  id: string; // e.g., 'person:123'
  rawId: string; // e.g., '123'
  name: string;
  type: EntityType;
  subText?: string;
  imageUrl?: string;
  color: string;
  radius: number;
  data: any;
  degree: number;
  // D3 force simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relationType: string;
  label: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphFilterOptions {
  entityTypes: Set<EntityType>;
  searchQuery: string;
  depth: 1 | 2 | 3 | 'all';
  focusNodeId?: string | null;
  assemblyFilter?: string; // assembly ID or 'all'
  allianceFilter?: string; // alliance ID or 'all'
}
