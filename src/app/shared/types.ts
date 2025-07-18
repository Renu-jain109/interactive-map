// =======================
// Shared Type Definitions
// =======================
// This file contains all interfaces and types used across the interactive map project.
// Import from this file wherever shared types are needed.

/**
 * Interface for city marker data used on the map and sidebar
 */
export interface MarkerData {
  lat: number; 
  lng: number; 
  info: string; 
  city: string; 
  hindiName: string; 
  state: string; 
  category: string; 
  image: string; 
  marker?: any; 
}

/**
 * Interface for marker interaction data (if needed for events)
 */
export interface MarkerInteractionData {
  id: string;
  name: string;
  category: string;
}

/**
 * Interface for category filter (used in filter-category.component)
 */
export interface CategoryFilter {
  name: string;
  selected: boolean;
}

/**
 * Type for a GeoJSON Feature (Polygon or MultiPolygon)
 */
export type GeoJSONFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  properties: {
    name: string;
    [key: string]: any;
  };
};