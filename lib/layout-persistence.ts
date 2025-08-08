/**
 * Layout persistence utilities for saving and loading custom workflow node positions
 */

import type { Node } from '@xyflow/react';

// Storage key format for organization-specific layouts
const STORAGE_KEY_PREFIX = 'trackure-workflow-layout';

// Interface for saved layout data
export interface SavedLayout {
  organizationId: string;
  sku: string | null;
  positions: Record<string, { x: number; y: number }>;
  timestamp: number;
  version: number; // For future migration compatibility
  layoutType: 'custom' | 'auto'; // Track if user has customized
}

// Interface for layout metadata
export interface LayoutMetadata {
  isCustomLayout: boolean;
  lastSaved: number | null;
  nodeCount: number;
  hasUnsavedChanges: boolean;
}

/**
 * Generate storage key for a specific organization and SKU
 */
function getStorageKey(organizationId: string, sku: string | null): string {
  const skuPart = sku ? `-sku-${sku}` : '-default';
  return `${STORAGE_KEY_PREFIX}-${organizationId}${skuPart}`;
}

/**
 * Save workflow layout to localStorage
 */
export function saveWorkflowLayout(
  organizationId: string,
  sku: string | null,
  nodes: Node[]
): boolean {
  try {
    const positions: Record<string, { x: number; y: number }> = {};
    
    // Extract positions from nodes
    nodes.forEach((node) => {
      positions[node.id] = {
        x: node.position.x,
        y: node.position.y,
      };
    });

    const savedLayout: SavedLayout = {
      organizationId,
      sku,
      positions,
      timestamp: Date.now(),
      version: 1,
      layoutType: 'custom',
    };

    const storageKey = getStorageKey(organizationId, sku);
    localStorage.setItem(storageKey, JSON.stringify(savedLayout));
    
    console.log(`Workflow layout saved for ${organizationId}${sku ? ` (SKU: ${sku})` : ''}`);
    return true;
  } catch (error) {
    console.error('Failed to save workflow layout:', error);
    return false;
  }
}

/**
 * Load workflow layout from localStorage
 */
export function loadWorkflowLayout(
  organizationId: string,
  sku: string | null
): SavedLayout | null {
  try {
    const storageKey = getStorageKey(organizationId, sku);
    const savedData = localStorage.getItem(storageKey);
    
    if (!savedData) {
      return null;
    }

    const parsedLayout: SavedLayout = JSON.parse(savedData);
    
    // Validate the loaded data
    if (
      parsedLayout.organizationId !== organizationId ||
      parsedLayout.sku !== sku ||
      !parsedLayout.positions ||
      typeof parsedLayout.positions !== 'object'
    ) {
      console.warn('Invalid saved layout data, ignoring');
      return null;
    }

    console.log(`Workflow layout loaded for ${organizationId}${sku ? ` (SKU: ${sku})` : ''}`);
    return parsedLayout;
  } catch (error) {
    console.error('Failed to load workflow layout:', error);
    return null;
  }
}

/**
 * Delete saved workflow layout
 */
export function deleteWorkflowLayout(
  organizationId: string,
  sku: string | null
): boolean {
  try {
    const storageKey = getStorageKey(organizationId, sku);
    localStorage.removeItem(storageKey);
    console.log(`Workflow layout deleted for ${organizationId}${sku ? ` (SKU: ${sku})` : ''}`);
    return true;
  } catch (error) {
    console.error('Failed to delete workflow layout:', error);
    return false;
  }
}

/**
 * Get layout metadata without loading full layout
 */
export function getLayoutMetadata(
  organizationId: string,
  sku: string | null,
  currentNodes?: Node[]
): LayoutMetadata {
  const savedLayout = loadWorkflowLayout(organizationId, sku);
  
  return {
    isCustomLayout: savedLayout?.layoutType === 'custom' || false,
    lastSaved: savedLayout?.timestamp || null,
    nodeCount: savedLayout ? Object.keys(savedLayout.positions).length : 0,
    hasUnsavedChanges: currentNodes ? hasUnsavedChanges(savedLayout, currentNodes) : false,
  };
}

/**
 * Check if current node positions differ from saved positions
 */
function hasUnsavedChanges(savedLayout: SavedLayout | null, currentNodes: Node[]): boolean {
  if (!savedLayout) {
    return false; // No saved layout to compare against
  }

  // Check if any node position has changed
  for (const node of currentNodes) {
    const savedPosition = savedLayout.positions[node.id];
    if (savedPosition) {
      const currentPosition = node.position;
      
      // Allow small tolerance for floating point differences
      const tolerance = 1;
      if (
        Math.abs(currentPosition.x - savedPosition.x) > tolerance ||
        Math.abs(currentPosition.y - savedPosition.y) > tolerance
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get all saved layouts for debugging/management
 */
export function getAllSavedLayouts(): { key: string; layout: SavedLayout }[] {
  const layouts: { key: string; layout: SavedLayout }[] = [];
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const layout: SavedLayout = JSON.parse(data);
            layouts.push({ key, layout });
          } catch (error) {
            console.warn(`Invalid layout data for key ${key}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to retrieve saved layouts:', error);
  }

  return layouts;
}

/**
 * Clean up old layouts (older than specified days)
 */
export function cleanupOldLayouts(daysToKeep: number = 30): number {
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const allLayouts = getAllSavedLayouts();
  let cleanedCount = 0;

  allLayouts.forEach(({ key, layout }) => {
    if (layout.timestamp < cutoffTime) {
      localStorage.removeItem(key);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} old workflow layouts`);
  }

  return cleanedCount;
}

/**
 * Export layout data for backup/sharing
 */
export function exportLayoutData(
  organizationId: string,
  sku: string | null
): string | null {
  const layout = loadWorkflowLayout(organizationId, sku);
  if (!layout) {
    return null;
  }

  try {
    return JSON.stringify(layout, null, 2);
  } catch (error) {
    console.error('Failed to export layout data:', error);
    return null;
  }
}

/**
 * Import layout data from backup/sharing
 */
export function importLayoutData(
  organizationId: string,
  sku: string | null,
  layoutData: string
): boolean {
  try {
    const parsedLayout: SavedLayout = JSON.parse(layoutData);
    
    // Validate and update the layout data
    parsedLayout.organizationId = organizationId;
    parsedLayout.sku = sku;
    parsedLayout.timestamp = Date.now();
    
    const storageKey = getStorageKey(organizationId, sku);
    localStorage.setItem(storageKey, JSON.stringify(parsedLayout));
    
    console.log('Layout data imported successfully');
    return true;
  } catch (error) {
    console.error('Failed to import layout data:', error);
    return false;
  }
}