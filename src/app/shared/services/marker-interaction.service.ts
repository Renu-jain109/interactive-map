// =======================
// MarkerInteractionService: Handles marker creation, interaction, and selection on the map
// =======================
// This service manages adding custom markers, handling marker events, and updating sidebar/map state.
// Used by map and sidebar components for marker display and interaction.

import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { BehaviorSubject } from 'rxjs';
import { MarkerData } from '../types';
import { SidebarComponent } from '../../sidebar/sidebar.component';

@Injectable({ providedIn: 'root' })
export class MarkerInteractionService {
  // ===== Public State =====
  public map: L.Map | null = null; // Leaflet map instance
  public selectedMarker = new BehaviorSubject<MarkerData | null>(null); // Currently selected marker

  // ===== Public Methods =====

  /**
   * Update the selected marker (notifies subscribers)
   * @param marker MarkerData object
   */
  public onMarkerSelect(marker: MarkerData) {
    this.selectedMarker.next(marker);
  }

  /**
   * Add or update markers on the map (merged logic for addMarkers and updateMapMarkers)
   * @param markers Array of marker data to display
   * @param sidebar Sidebar component reference
   * @param markerRefs Object to store marker references
   * @param clearExisting If true, removes all existing markers before adding new ones
   */
  public addOrUpdateMarkers(markers: MarkerData[], sidebar: SidebarComponent, markerRefs: Record<string, any>, clearExisting: boolean = true): void {
    if (!this.map) return;

    // Remove all existing markers if requested
    if (clearExisting) {
      Object.values(markerRefs).forEach((ref: any) => {
        if (ref instanceof L.Marker) {
          this.map!.removeLayer(ref);
        }
      });
      for (const key in markerRefs) delete markerRefs[key];
    }
    markers.forEach((marker, index) => {
      const markerId = `marker-${index}`;
      // Create a custom marker element with styles
      const markerElement = document.createElement('div');
      markerElement.className = 'marker-icon-wrapper';
      markerElement.innerHTML = `
        <div class="marker-icon" style="width: 30px; height: 30px; border-radius: 50%; background-color: red; 
            border: 3px solid white; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            transition: all 0.2s ease-in-out;">
          <img src="https://img.icons8.com/?size=100&id=IZbdh4a-hOx0&format=png&color=000000" 
              alt="icon" style="width: 20px; height: 20px;" />
        </div>
      `;
      // Create Leaflet divIcon
      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: markerElement.innerHTML,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });
      // Tooltip HTML: Only show image and city name in tooltip, not in popup
      const tooltipHtml = `
        <div style="width:180px;max-width:200px;">
          <img src="${marker.image}" alt="${marker.city}" style="width:100%;height:auto;max-height:80px;object-fit:cover;border-radius:6px 6px 0 0;box-shadow:0 2px 6px rgba(0,0,0,0.15);margin-bottom:2px;">
          <div style="margin-bottom: 8px;">
            <div style="font-weight: 600; font-size: 16px; color: #1a73e8; margin-bottom: 4px;">
              ${marker.city}
            </div>
            <div style="display: flex; align-items: center;">
              <span style="display: inline-block; background: #f1f3f4; color: #5f6368; 
                padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                ${marker.category}
              </span>
            </div>
          </div>
        </div>
      `;
      const markerInstance = L.marker([marker.lat, marker.lng], {
        icon: customIcon,
        riseOnHover: true,
        title: marker.hindiName || marker.city,
        alt: marker.hindiName || marker.city,
        keyboard: true
      })
        .bindTooltip(tooltipHtml, {
          direction: 'top',
          offset: [0, -20],
          className: 'custom-tooltip',
          sticky: true,
          opacity: 1,
          interactive: true
        }) // Tooltip with image on hover
        .addTo(this.map!);
      markerRefs[markerId] = markerInstance;
      const cityKey = marker.city.toLowerCase();
      markerRefs[cityKey] = markerInstance;
      if (cityKey === 'new delhi') {
        markerRefs['delhi'] = markerInstance;
      }
      markerInstance.on('mouseover', function (this: L.Marker) {
        const element = this.getElement();
        if (element) {
          const icon = element.querySelector('.marker-icon') as HTMLElement;
          if (icon) icon.style.transform = 'scale(1.2)';
        }
      });
      markerInstance.on('mouseout', function (this: L.Marker) {
        const element = this.getElement();
        if (element) {
          const icon = element.querySelector('.marker-icon') as HTMLElement;
          if (icon) icon.style.transform = '';
        }
      });
      markerInstance.on('click', () => {
        this.onMarkerSelect(marker);
        if (sidebar) {
          sidebar.selectedMarker = marker;
          sidebar.onMarkerSelect(marker);
          setTimeout(() => {
            const element = document.querySelector('.selected-marker');
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 100);
        }
      });
    });
  }

  /**
   * Filter markers by search query (city, state, category, hindiName)
   */
  public filterMarkersByQuery(markers: MarkerData[], query: string): MarkerData[] {
    const searchTerm = query.toLowerCase();
    return markers.filter(m =>
      (m.city && m.city.toLowerCase().includes(searchTerm)) ||
      (m.state && m.state.toLowerCase().includes(searchTerm)) ||
      (m.category && m.category.toLowerCase().includes(searchTerm)) ||
      (m.hindiName && m.hindiName.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Filter markers by selected categories
   */
  public filterMarkersByCategories(markers: MarkerData[], categories: string[]): MarkerData[] {
    if (!categories || categories.length === 0) return [...markers];
    return markers.filter(marker => marker.category && categories.includes(marker.category.trim()));
  }

  /**
   * Extract unique categories from markers
   */
  public extractCategories(markers: MarkerData[]): string[] {
    return [...new Set(markers.map(marker => marker.category).filter(Boolean))];
  }

  /**
   * Fit map to show all markers
   */
  public fitMapToMarkers(map: L.Map, markers: MarkerData[]): void {
    if (map && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(marker => [marker.lat, marker.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  /**
   * Highlight a marker with animation
   */
  public highlightMarker(markerRefs: Record<string, any>, marker: MarkerData): void {
    const markerInstance = Object.values(markerRefs).find((m: any) =>
      m instanceof L.Marker && m.getLatLng &&
      m.getLatLng().lat === marker.lat &&
      m.getLatLng().lng === marker.lng
    ) as L.Marker | undefined;
    if (markerInstance) {
      const element = markerInstance.getElement();
      if (element) {
        const icon = element.querySelector('.marker-icon') as HTMLElement;
        if (icon) {
          icon.classList.add('highlighted-marker');
          setTimeout(() => {
            icon.classList.remove('highlighted-marker');
          }, 2000);
        }
      }
    }
  }
}

// Note: This service is used by map and sidebar components to add and interact with markers.
// Usage example (in another file):
//   constructor(private markerService: MarkerInteractionService) {}
//   this.markerService.map = mapInstance;
//   this.markerService.addOrUpdateMarkers(markers, sidebar, markerRefs, clearExisting);


