// =======================
// MapBoundaryService: Handles loading and clearing city boundary GeoJSON layers on the map
// =======================
// This service manages the display of city boundaries using Leaflet and GeoJSON data.
// Used by map components to show/hide city outlines and fit map view.

import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { BehaviorSubject } from 'rxjs';
import { GeojsonLoaderService } from './geojson-loader.service';

@Injectable({
  providedIn: 'root'
})
export class MapBoundaryService {
  // ===== Dependencies =====
  constructor(private geojsonLoader: GeojsonLoaderService) { }

  // ===== Private State =====
  private map: L.Map | null = null; // Leaflet map instance
  private boundaryLayer: L.GeoJSON | null = null; // Current boundary layer
  private currentCity: string | null = null; // Currently loaded city

  // ===== Public State =====
  public boundaryLoading$ = new BehaviorSubject<boolean>(false); // Boundary loading state
  public boundaryError$ = new BehaviorSubject<string | null>(null); // Boundary error state

  // ===== Public Methods =====
  /**
   * Initialize the service with a Leaflet map instance
   * @param map Leaflet map object
   */
  public init(map: L.Map): void {
    this.map = map;
  }

  /**
   * Load and display the boundary for a city
   * @param city City name
   * @param isCategoryFilterActive If true, skips loading boundary
   */
  public loadBoundary(city: string, isCategoryFilterActive: boolean = false): void {
    console.log('MapBoundaryService loadBoundary called for city:', city, 'isCategoryFilterActive:', isCategoryFilterActive);
    // Skip if map is not initialized or category filter is active
    if (!this.map || isCategoryFilterActive) {
      console.log('loadBoundary skipped due to isCategoryFilterActive or no map');
      return;
    }
    this.clearBoundary();
    if (!city || city.trim() === '') {
      console.warn('No city provided to load boundary');
      return;
    }
    const boundaryCity = city.toLowerCase() === 'new delhi' ? 'delhi' : city.toLowerCase();
    this.geojsonLoader.getCityBoundary(boundaryCity).subscribe({
      next: (data: any) => {
        if (!this.map) {
          console.error('Map instance not available');
          return;
        }
        this.clearBoundary();
        this.boundaryLayer = L.geoJSON(data, {
          style: {
            color: '#1a73e8',
            weight: 2,
            opacity: 0.8,
            fillColor: '#1a73e8',
            fillOpacity: 0.1,
            dashArray: '5, 5'
          },
          onEachFeature: (feature: any, layer: L.Layer) => feature.properties?.name && layer.bindPopup(`<b>${feature.properties.name}</b>`),
        }).addTo(this.map!);
        const bounds = this.boundaryLayer.getBounds();
        if (bounds && bounds.isValid()) {
          this.map!.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        }
      },
      error: (error: any) => console.error(`Error loading boundary for ${boundaryCity}:`, error),
      complete: () => console.log(`Boundary loading completed for ${boundaryCity}`)
    });
  }

  /**
   * Remove the current boundary layer from the map
   */
  public clearBoundary(): void {
    console.log('MapBoundaryService clearBoundary executed, current boundaryLayer:', this.boundaryLayer);
    if (this.boundaryLayer) {
      this.map?.removeLayer(this.boundaryLayer);
      this.boundaryLayer = null;
      console.log('Boundary layer removed, new boundaryLayer:', this.boundaryLayer);
    }
    if (this.map) {
      this.map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.GeoJSON) {
          this.map?.removeLayer(layer);
          console.log('Removed all lingering GeoJSON layers');
        }
      });
    } else {
      console.warn('Map is null, unable to remove layers');
    }
  }

  // ===== Private Methods =====
  /**
   * Normalize city name for file lookup (handles Delhi/NCR cases)
   * @param city City name
   * @returns Normalized city name string
   */
  private normalizeCityName(city: string): string {
    const lowerCity = city.toLowerCase();
    if (lowerCity.includes('delhi') || lowerCity.includes('ncr') || lowerCity === 'new delhi') {
      return 'delhi';
    }
    return lowerCity;
  }
}

// Note: This service is used by map components to load and clear city boundaries.
// Usage example (in another file):
//   constructor(private boundaryService: MapBoundaryService) {}
//   this.boundaryService.init(mapInstance);
//   this.boundaryService.loadBoundary('Bhopal');
//   this.boundaryService.clearBoundary();
