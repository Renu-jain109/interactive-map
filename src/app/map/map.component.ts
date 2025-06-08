import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ChangeDetectorRef, ViewChild, inject } from '@angular/core';
import * as L from 'leaflet';

import { SidebarComponent } from '../sidebar/sidebar.component';
import { markers } from '../../assets/map-data/markers';
import { HttpClient } from '@angular/common/http';
import { GeoJSONFeature } from '../shared/types';
import { GeojsonLoaderService } from '../shared/geojson-loader.service';


import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-map',
  imports: [CommonModule, SidebarComponent, FormsModule],
  standalone: true,
  templateUrl: './map.component.html'
})

export class MapComponent implements AfterViewInit {

  /* ---------------- public ---------------- */
  public map!: L.Map;
  public selectedMarker: any;
  public isMapReady: boolean = false;
  public filteredMarkers: any[] = [];
  public cities: string[] = [
    'ahmedabad', 'bengaluru', 'bhopal', 'chandigarh', 'chennai', 'coimbatore', 'faridabad', 'hyderabad', 'indore', 'jaipur', 'kochi', 'kolkata', 'lucknow', 'mumbai', 'mysuru', 'new delhi', 'pimpri', 'pune', 'thane', 'vadodara', 'varanasi', 'visakhapatnam',
  ].sort();

  // Fit map to show all markers
  private fitMapToMarkers(markers: any[]) {
    if (!this.map || !markers || markers.length === 0) return;

    const bounds = L.latLngBounds(
      markers.map(marker => [marker.lat, marker.lng])
    );
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }



  public selectedCity: string | null = null;
  public markers: { lat: number; lng: number; info: string; city: string; hindiName: string; state: string; category: string; image: string }[] = markers;
  public categories: string[] = [];
  public selectedCategories: string[] = [];
  public showCategoryFilter: boolean = false;
  public isSearching: boolean = false;
  public isSidebarOpen: boolean = true; // Track sidebar state
  private isMobileView: boolean = false; // Track if in mobile view
  private resizeObserver: ResizeObserver | null = null;

  /* ---------------- private ---------------- */
  private pendingSearchQuery: string | null = null; // Store pending search queries
  private boundaryLayer: L.GeoJSON<any> | null = null;
  private markerRefs: Record<string, any> = {};
  private userLocationMarker: L.Marker | null = null;
  private geojsonLoder = inject(GeojsonLoaderService);
  private http = inject(HttpClient);
  private watchId: number | null = null;


  @ViewChild(SidebarComponent) sidebarComponent!: SidebarComponent;

  // public markers = markers;

  constructor(private cdr: ChangeDetectorRef) {
    this.searchLocation = this.searchLocation.bind(this); // Ensure correct context for searchLocation

    // Debug: Log all markers with their categories
    console.log('All markers with categories:');
    this.markers.forEach((marker, index) => {
      if (marker.city === 'Hyderabad' || marker.city === 'Visakhapatnam') {
        console.log(`Marker ${index}:`, {
          city: marker.city,
          category: marker.category,
          lat: marker.lat,
          lng: marker.lng
        });
      }
    });

    // Extract unique categories from markers
    const categorySet = new Set<string>();
    this.markers.forEach(marker => {
      if (marker.category) {
        categorySet.add(marker.category);
      }
    });
    this.categories = Array.from(categorySet).sort();
    console.log('All categories:', this.categories);
  }


  /* ========== life-cycle ========== */
  ngAfterViewInit(): void {
    // Initialize map after a small delay to ensure the container is rendered
    setTimeout(() => {
      this.initMap();
      this.addMarkers();

      // Extract unique categories from markers
      const categorySet = new Set<string>();
      this.markers.forEach(marker => {
        if (marker.category) {
          categorySet.add(marker.category);
        }
      });
      this.categories = Array.from(categorySet).sort();

      // Show all markers by default when no city is selected
      if (!this.selectedCity) {
        this.filteredMarkers = [...this.markers];
        this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);
      }

      this.isMapReady = true; // Ensure the flag is set after initialization

      // Process any pending search query
      if (this.pendingSearchQuery) {
        this.searchLocation(this.pendingSearchQuery);
        this.pendingSearchQuery = null;
      }

      this.cdr.detectChanges(); // Trigger change detection to ensure proper rendering
    }, 100);
  }


  /* ========== map init ========== */
  private initMap(): void {
    // Ensure the map container is available and empty
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error('Map container not found');
      return;
    }

    // Clear any existing map instance
    if (this.map) {
      this.map.remove();
    }

    // Initialize the map with default view of India
    this.map = L.map('map', {
      center: [20.5937, 78.9629], // Center of India
      zoom: 5,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
      preferCanvas: true
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 14,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Add zoom control
    L.control.zoom({
      position: 'topright'
    }).addTo(this.map);

    // Add attribution
    L.control.attribution({
      position: 'bottomright',
      prefix: false
    })
      .setPrefix('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors')
      .addTo(this.map);
  }




  /* ========== dynamic boundary loader ========== */

  // Handle city selection change
  public onCityChange(city: string | null): void {
    if (city) {
      this.selectedCity = city;
      this.filteredMarkers = this.markers.filter(marker =>
        marker.city.toLowerCase() === city.toLowerCase()
      );
      this.loadBoundary(city);
      this.fitMapToMarkers(this.filteredMarkers);
      this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);
    } else {
      // If no city is selected, show all markers
      this.selectedCity = null;
      this.filteredMarkers = [...this.markers];
      this.fitMapToMarkers(this.filteredMarkers);
      this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);
    }
  }

  // Load boundary for a specific city
  public loadBoundary(city: string): void {
    if (!this.map) {
      console.error('Map not initialized');
      return;
    }

    // Handle special case for 'new delhi' - use 'delhi' for the filename
    const boundaryCity = city.toLowerCase() === 'new delhi' ? 'delhi' : city;

    // Update selected city
    this.selectedCity = city;

    // Clear existing boundary layer if any
    if (this.boundaryLayer) {
      this.map.removeLayer(this.boundaryLayer);
      this.boundaryLayer = null;
    }

    console.log(`Loading boundary for city: ${boundaryCity}`);

    // Try to load the boundary for the selected city
    this.geojsonLoder.getCityBoundary(boundaryCity).subscribe({
      next: (data: any) => {
        if (!data) {
          console.error(`Failed to load boundary data for ${city}`);
          return;
        }

        // Clear any existing boundary layer
        if (this.boundaryLayer) {
          this.map.removeLayer(this.boundaryLayer);
        }

        try {
          // Create a new boundary layer with the city's GeoJSON data
          this.boundaryLayer = L.geoJSON(data, {
            style: {
              color: '#1a73e8',
              weight: 2,
              opacity: 0.8,
              fillColor: '#1a73e8',
              fillOpacity: 0.1,
              dashArray: '5, 5'
            },
            onEachFeature: (feature, layer) => {
              // Add popup with city name if available
              if (feature.properties && feature.properties.NAME_2) {
                layer.bindPopup(`<b>${feature.properties.NAME_2}</b>`);
              }
            }
          }).addTo(this.map);

          // Fit the map to the boundary with padding
          const bounds = this.boundaryLayer.getBounds();
          if (bounds.isValid()) {
            this.map.fitBounds(bounds, {
              padding: [50, 50],
              maxZoom: 12
            });
          } else {
            console.warn('Invalid bounds for boundary');
          }

          console.log(`Successfully loaded boundary for ${city}`);
        } catch (error) {
          console.error('Error creating boundary layer:', error);
        }
      },
      error: (error) => {
        console.error(`Error loading boundary for ${city}:`, error);
      }
    });
  }



  /* ========== markers ========== */

  /**
   * Generates HTML content for a marker popup
   * @param marker The marker data
   * @returns HTML string for the popup
   */
  private generatePopupContent(marker: any): string {
    return `
      <div class="popup-content" style="min-width:250px;">
        <div style="max-height: 200px; overflow: hidden; border-radius: 4px 4px 0 0; margin: -10px -10px 5px -10px;">
          <img src="${marker.image}" alt="${marker.city}" 
            style="width: 100%; height: auto; max-height: 200px; object-fit: cover; display: block;">
        </div>
        <div style="padding: 8px 0;">
          <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: 600; color: #1a73e8;">
            ${marker.hindiName || marker.city}
          </h3>
          <p style="margin: 0 0 5px 0; color: #5f6368; font-size: 13px;">
            <i class="fas fa-map-marker-alt" style="margin-right: 5px; color: #5f6368;"></i>
            ${marker.city}, ${marker.state}
          </p>
          <div style="display: flex; align-items: center; margin-top: 8px;">
            <span style="display: inline-block; background: #f1f3f4; color: #3c4043; 
              padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
              ${marker.category}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private addMarkers(): void {
    // Clear existing markers
    Object.values(this.markerRefs).forEach(marker => {
      if (marker && this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.markerRefs = {};

    this.markers.forEach((marker, index) => {
      const markerId = `marker-${index}`;
      const popupContent = this.generatePopupContent(marker);

      // Create marker element with better styling
      const markerElement = document.createElement('div');
      markerElement.className = 'marker-icon-wrapper';
      markerElement.innerHTML = `
        <div class="marker-icon" style="width: 30px; height: 30px; border-radius: 50%; background-color: red; 
          border: 3px solid white; display: flex; align-items: center; justify-content: center; cursor: pointer;  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          transition: all 0.2s ease-in-out;">

          <img src="https://img.icons8.com/?size=100&id=IZbdh4a-hOx0&format=png&color=000000" 
            alt="icon" style="width: 20px; height: 20px;" />

      `;

      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: markerElement.innerHTML,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
        tooltipAnchor: [16, -10]
      });

      // Create marker with improved options
      const markerInstance = L.marker([marker.lat, marker.lng], {
        icon: customIcon,
        riseOnHover: true,
        title: marker.hindiName || marker.city,
        alt: marker.hindiName || marker.city,
        keyboard: true
      }).addTo(this.map);

      // Store reference to the marker
      this.markerRefs[markerId] = markerInstance;

      // Add click handler
      markerInstance.on('click', () => {
        this.onMarkerSelect(marker);
      });

      // Add hover effects with proper 'this' typing
      markerInstance.on('mouseover', function (this: L.Marker) {
        const element = this.getElement();
        if (element) {
          const icon = element.querySelector('.marker-icon') as HTMLElement;
          if (icon) {
            icon.style.transform = 'scale(1.2)';
            icon.style.boxShadow = '0 0 15px rgba(26,115,230,0.5)';
            icon.style.zIndex = '1000';
          }

          // Show tooltip on hover
          const tooltip = document.createElement('div');
          tooltip.className = 'marker-tooltip';
          tooltip.innerHTML = `
            <div style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.2); width: 220px;">
              <div style="height: 120px; overflow: hidden; border-radius: 6px; margin-bottom: 10px;">
                <img src="${marker.image}" alt="${marker.city}" 
                  style="width: 100%; height: 100%; object-fit: cover;">
              </div>
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
          tooltip.style.position = 'absolute';
          tooltip.style.bottom = '40px';
          tooltip.style.left = '50%';
          tooltip.style.transform = 'translateX(-50%)';
          tooltip.style.zIndex = '1000';
          tooltip.style.whiteSpace = 'nowrap';

          element.appendChild(tooltip);
          element.style.position = 'relative';
        }
      });

      markerInstance.on('mouseout', function (this: L.Marker) {
        const element = this.getElement();
        if (element) {
          // Remove tooltip if exists
          const existingTooltip = element.querySelector('.marker-tooltip');
          if (existingTooltip) {
            element.removeChild(existingTooltip);
          }

          const icon = element.querySelector('.marker-icon') as HTMLElement;
          if (icon) {
            icon.style.transform = 'scale(1)';
            icon.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            icon.style.zIndex = '';
          }
        }
      });

      // Add popup with better options
      markerInstance.bindPopup(popupContent, {
        className: 'custom-popup',
        closeButton: true,
        closeOnClick: false,
        autoClose: false,
        closeOnEscapeKey: true,
        maxWidth: 300,
        minWidth: 250,
        offset: [0, 0],
        autoPan: true,
        autoPanPadding: [50, 50],
        keepInView: true
      });

      markerInstance.on('mouseout', () => {
        const icon = markerInstance.getElement()?.querySelector('.marker-icon') as HTMLElement;
        if (icon) {
          icon.style.transform = 'scale(1)';
          icon.style.boxShadow = 'none';
        }
        markerInstance.closePopup();
      });

      markerInstance.on('click', () => {
        // Add bounce effect
        const icon = markerInstance.getElement()?.querySelector('.marker-icon') as HTMLElement;
        if (icon) {
          icon.classList.add('marker-bounce');
          setTimeout(() => {
            icon.classList.remove('marker-bounce');
          }, 500);
        }

        // Update selected marker with animation
        if (this.selectedMarker) {
          const prevMarker = this.markerRefs[this.selectedMarker.city.toLowerCase()];
          if (prevMarker) {
            const prevIcon = prevMarker.getElement()?.querySelector('.marker-icon') as HTMLElement;
            if (prevIcon) {
              prevIcon.style.borderColor = 'white';
              prevIcon.style.boxShadow = 'none';
            }
          }
        }

        // Set new selected marker
        this.selectedMarker = marker;
        const currentIcon = markerInstance.getElement()?.querySelector('.marker-icon') as HTMLElement;
        if (currentIcon) {
          currentIcon.style.borderColor = '#ffeb3b';
          currentIcon.style.boxShadow = '0 0 15px #ffeb3b';
        }

        // Show in sidebar with animation
        this.sidebarComponent?.displayMarkerDetails(marker);

        // Close any open popup and open a new one
        markerInstance.closePopup();
        markerInstance.bindPopup(popupContent, {
          className: 'custom-popup',
          closeButton: true,
          offset: L.point(0, -30)
        }).openPopup();
      });
      // Special handling for New Delhi to match both 'New Delhi' and 'Delhi' searches
      const cityKey = marker.city.toLowerCase();
      this.markerRefs[cityKey] = marker;

      // Add an additional reference for 'delhi' if the city is 'New Delhi'
      if (cityKey === 'new delhi') {
        this.markerRefs['delhi'] = marker;
      }
    });
  }



  /* ========== locate user ========== */
  public locateUser(): void {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by your browser');
      return;
    }

    // Clear any existing location marker
    if (this.userLocationMarker) {
      this.map.removeLayer(this.userLocationMarker);
      this.userLocationMarker = null;
    }

    // Show loading state
    const locationButton = document.querySelector('button[title="Find my location"]') as HTMLButtonElement;
    if (locationButton) {
      locationButton.disabled = true;
      locationButton.innerHTML = `
        <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
    }

    // Watch for position changes
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        this.handleLocationFound(latitude, longitude, accuracy);

        // Center map on user location
        this.map.setView([latitude, longitude], 15);

        // Stop watching after first successful location
        if (this.watchId !== null) {
          navigator.geolocation.clearWatch(this.watchId);
          this.watchId = null;
        }

        // Reset button state
        if (locationButton) {
          locationButton.disabled = false;
          locationButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          `;
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        // Reset button state on error
        if (locationButton) {
          locationButton.disabled = false;
          locationButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          `;
          // Reset to default icon after 3 seconds
          setTimeout(() => {
            if (locationButton) {
              locationButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              `;
            }
          }, 3000);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  private handleLocationFound(lat: number, lng: number, accuracy: number): void {
    // Remove existing location marker if any
    if (this.userLocationMarker) {
      this.map.removeLayer(this.userLocationMarker);
    }

    // Create a custom icon for the user location
    const userIcon = L.divIcon({
      className: 'user-location-icon',
      html: `
        <div class="relative">
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
          <div class="relative w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
            <div class="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });

    // Add marker for user's location
    this.userLocationMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 1000
    }).addTo(this.map);

    // Add accuracy circle
    const accuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: '#3182ce',
      fillColor: '#3182ce',
      fillOpacity: 0.2,
      weight: 1,
      dashArray: '5, 5'
    }).addTo(this.map);

    // Bind popup with accuracy information
    this.userLocationMarker.bindPopup(
      `<div class="text-sm">
        <div class="font-medium">Your Location</div>
        <div class="text-gray-600">Accuracy: ${Math.round(accuracy)} meters</div>
      </div>`
    ).openPopup();

    // Add the accuracy circle to the marker for easy removal
    (this.userLocationMarker as any).accuracyCircle = accuracyCircle;
  }

  // Clean up geolocation watcher when component is destroyed
  ngOnDestroy(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }



  /* ========== Category Filter ========== */
  public toggleCategoryFilter(): void {
    this.showCategoryFilter = !this.showCategoryFilter;
  }

  public onCategoryFilterMouseLeave(): void {
    this.showCategoryFilter = false;
  }

  public toggleCategory(category: string): void {
    if (!category) return;

    // Make a copy of selected categories to avoid direct mutation
    const updatedCategories = [...this.selectedCategories];
    const index = updatedCategories.indexOf(category);

    // Toggle the category
    if (index === -1) {
      updatedCategories.push(category);
    } else {
      updatedCategories.splice(index, 1);
    }

    // Update the selected categories
    this.selectedCategories = updatedCategories;

    // Clear any existing tooltips
    document.querySelectorAll('.marker-tooltip').forEach(el => el.remove());

    // If no categories selected, just apply filters and return
    if (this.selectedCategories.length === 0) {
      this.applyFilters();
      return;
    }

    // For each selected category, find and highlight markers
    this.selectedCategories.forEach(selectedCategory => {
      // Find all markers that match this category
      const markersInCategory = this.markers.filter(marker => marker.category === selectedCategory);

      markersInCategory.forEach(marker => {
        try {
          // Find the marker instance in markerRefs
          const markerInstance = Object.values(this.markerRefs).find((m: any) => {
            // Check if m is a valid marker and has getLatLng method
            if (!m || typeof m.getLatLng !== 'function') return false;
            try {
              const latLng = m.getLatLng();
              return latLng && latLng.lat === marker.lat && latLng.lng === marker.lng;
            } catch (e) {
              console.warn('Error getting marker latlng:', e);
              return false;
            }
          }) as L.Marker | undefined;

          if (markerInstance) {
            // Remove any existing event listeners to prevent duplicates
            markerInstance.off('mouseover').off('mouseout');

            // Add hover effects with proper 'this' typing
            markerInstance.on('mouseover', (e) => {
              const element = e.target.getElement();
              if (element) {
                const icon = element.querySelector('.marker-icon') as HTMLElement;
                if (icon) {
                  icon.style.transform = 'scale(1.2)';
                  icon.style.boxShadow = '0 0 15px rgba(26,115,230,0.5)';
                  icon.style.zIndex = '1000';
                }

                // Show tooltip on hover
                const tooltip = document.createElement('div');
                tooltip.className = 'marker-tooltip';
                tooltip.innerHTML = `
                <div style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.2); width: 220px;">
                  <div style="height: 120px; overflow: hidden; border-radius: 6px; margin-bottom: 10px;">
                    <img src="${marker.image}" alt="${marker.city}" 
                      style="width: 100%; height: 100%; object-fit: cover;">
                  </div>
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
                tooltip.style.position = 'absolute';
                tooltip.style.bottom = '40px';
                tooltip.style.left = '50%';
                tooltip.style.transform = 'translateX(-50%)';
                tooltip.style.zIndex = '1000';
                tooltip.style.whiteSpace = 'nowrap';

                element.appendChild(tooltip);
                element.style.position = 'relative';
              }
            });

            // Add mouseout event to remove tooltip when not hovering
            markerInstance.on('mouseout', (e) => {
              const element = e.target.getElement();
              if (element) {
                const tooltip = element.querySelector('.marker-tooltip');
                if (tooltip) {
                  element.removeChild(tooltip);
                }
                const icon = element.querySelector('.marker-icon') as HTMLElement;
                if (icon) {
                  icon.style.transform = '';
                  icon.style.boxShadow = '';
                  icon.style.zIndex = '';
                }
              }
            });
            //         <div style="height: 120px; overflow: hidden; border-radius: 6px; margin-bottom: 10px;">
            //           <img src="${marker.image}" alt="${marker.city}" 
            //             style="width: 100%; height: 100%; object-fit: cover;">
            //         </div>
            //         <div style="margin-bottom: 8px;">
            //           <div style="font-weight: 600; font-size: 16px; color: #1a73e8; margin-bottom: 4px;">
            //             ${marker.city}
            //           </div>
            //           <div style="display: flex; align-items: center;">
            //             <span style="display: inline-block; background: #f1f3f4; color: #5f6368; 
            //               padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">
            // Old tooltip implementation has been removed
            // If you need to restore it, uncomment the relevant code
            // and ensure all variables are properly defined
          }
        } catch (error) {
          console.error('Error processing marker:', error);
        }
      })
    });

    // Apply the filters to show/hide markers
    this.applyFilters();
  }


  public isCategorySelected(category: string): boolean {
    return this.selectedCategories.includes(category);
  }

  public clearFilters(): void {
    // Reset selected categories
    this.selectedCategories = [];

    // Reset filtered markers to show all
    this.filteredMarkers = [...this.markers];

    // Show all markers on the map
    Object.values(this.markerRefs).forEach(marker => {
      if (marker && this.map) {
        this.map.addLayer(marker);
      }
    });

    // Update the view
    this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);

    // Fit map to show all markers
    if (this.filteredMarkers.length > 0) {
      this.fitMapToMarkers(this.filteredMarkers);
    }

    console.log('Filters cleared, showing all markers');
    this.cdr.detectChanges();
  }

  private applyFilters(): void {
    if (!this.selectedCategories || this.selectedCategories.length === 0) {
      // If no categories selected, show all markers
      this.filteredMarkers = [...this.markers];

      // Show all markers on the map
      Object.values(this.markerRefs).forEach((marker, index) => {
        if (marker && this.map) {
          this.map.addLayer(marker);
        }
      });
    } else {
      // Only show markers that match the selected categories
      this.filteredMarkers = this.markers.filter(marker => {
        return marker.category && this.selectedCategories.includes(marker.category);
      });

      // Hide/show markers based on the filter
      this.markers.forEach((marker, index) => {
        const markerId = `marker-${index}`;
        const markerInstance = this.markerRefs[markerId];

        if (markerInstance && this.map) {
          if (this.selectedCategories.includes(marker.category)) {
            this.map.addLayer(markerInstance);
          } else {
            this.map.removeLayer(markerInstance);
          }
        }
      });

      console.log('Showing markers for categories:', this.selectedCategories);
    }

    // Update sidebar with filtered markers
    this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);

    // Fit map to show all filtered markers
    if (this.filteredMarkers.length > 0) {
      this.fitMapToMarkers(this.filteredMarkers);
    }

    // Force UI update
    this.cdr.detectChanges();
  }

  public async searchLocation(query: string): Promise<void> {
    if (!query || query.trim() === '') {
      // Reset view when search is cleared
      this.filteredMarkers = [...this.markers];
      this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);
      this.fitMapToMarkers(this.filteredMarkers);
      // Clear any existing boundary
      if (this.boundaryLayer) {
        this.map?.removeLayer(this.boundaryLayer);
        this.boundaryLayer = null;
      }
      return;
    }

    const searchTerm = query.toLowerCase().trim();

    try {
      // Show loading state
      this.isSearching = true;

      // Clear any existing boundary first
      if (this.boundaryLayer) {
        this.map?.removeLayer(this.boundaryLayer);
        this.boundaryLayer = null;
      }

      // First try to match city names exactly
      const matchedCity = this.cities.find(city => {
        if (searchTerm === 'new delhi' || searchTerm === 'delhi') {
          return city.toLowerCase() === 'new delhi';
        }
        return city.toLowerCase() === searchTerm;
      });

      if (matchedCity) {
        // Load the boundary for the matched city
        this.loadBoundary(matchedCity);

        // Filter markers for this city
        this.filteredMarkers = this.markers.filter(m =>
          m.city.toLowerCase() === searchTerm ||
          (searchTerm === 'delhi' && m.city.toLowerCase() === 'new delhi')
        );

        this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);

        // If only one result, open its popup after a short delay
        if (this.filteredMarkers.length === 1) {
          setTimeout(() => {
            this.onMarkerSelect(this.filteredMarkers[0]);
            // The popup will be opened by onMarkerSelect
          }, 300); // Slightly longer delay to ensure the map has finished animating
        } else if (this.filteredMarkers.length > 0) {
          this.fitMapToMarkers(this.filteredMarkers);
        }
        return;
      }

      // If no exact city match, search in all fields
      this.filteredMarkers = this.markers.filter(marker => {
        const markerCity = marker.city.toLowerCase();
        if ((searchTerm === 'delhi' || searchTerm === 'new delhi') &&
          (markerCity === 'new delhi' || markerCity === 'delhi')) {
          return true;
        }
        return (
          markerCity.includes(searchTerm) ||
          (marker.hindiName && marker.hindiName.toLowerCase().includes(searchTerm)) ||
          (marker.category && marker.category.toLowerCase().includes(searchTerm)) ||
          (marker.state && marker.state.toLowerCase().includes(searchTerm))
        );
      });

      this.sidebarComponent?.updateFilteredMarkers(this.filteredMarkers);

      // Handle search results
      if (this.filteredMarkers.length === 1) {
        // Single result - zoom in and show popup
        setTimeout(() => {
          this.onMarkerSelect(this.filteredMarkers[0]);
          this.highlightMarker(this.filteredMarkers[0]);
          this.map?.setZoom(14);
        }, 100);
      } else if (this.filteredMarkers.length > 0) {
        // Multiple results - fit them in view
        this.fitMapToMarkers(this.filteredMarkers);
      } else {
        // No results found
        this.showNoResultsMessage(searchTerm);
      }
    } catch (error) {
      console.error('Search error:', error);
      this.showNoResultsMessage(searchTerm);
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * Highlight a marker with animation
   */
  private highlightMarker(marker: any): void {
    // Find the marker instance
    const markerInstance = Object.values(this.markerRefs).find((m: any) =>
      m.getLatLng().lat === marker.lat && m.getLatLng().lng === marker.lng
    ) as L.Marker | undefined;

    if (markerInstance) {
      // Add highlight class
      const element = markerInstance.getElement();
      if (element) {
        const icon = element.querySelector('.marker-icon');
        if (icon) {
          icon.classList.add('highlighted-marker');

          // Remove highlight after animation
          setTimeout(() => {
            icon.classList.remove('highlighted-marker');
          }, 2000);
        }
      }
    }
  }

  /**
   * Show a message when no search results are found
   */
  private showNoResultsMessage(query: string): void {
    if (!this.map) return;

    // Create a popup at the center of the current view
    const center = this.map.getCenter();

    L.popup()
      .setLatLng(center)
      .setContent(`<div style="text-align: center;">
        <i class="fas fa-search" style="font-size: 24px; color: #666; margin-bottom: 8px;"></i>
        <p style="margin: 0; font-size: 14px;">No results found for <strong>${query}</strong></p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Try a different search term</p>
      </div>`)
      .openOn(this.map);

    // Close the popup after 3 seconds
    setTimeout(() => {
      this.map?.closePopup();
    }, 3000);
  }

  // Handle marker selection from sidebar
  onMarkerSelect(marker: any) {
    this.selectedMarker = marker;

    if (!marker) {
      // If marker is null, clear the selection but don't change the map view
      return;
    }

    // Find the marker instance
    const markerInstance = Object.values(this.markerRefs).find((m: any) =>
      m.getLatLng().lat === marker.lat && m.getLatLng().lng === marker.lng
    ) as L.Marker | undefined;

    // Update the map view to center on the selected marker
    if (this.map) {
      this.map.setView([marker.lat, marker.lng], 14);
    }

    // If there's a boundary layer, remove it to show the marker clearly
    if (this.boundaryLayer) {
      this.boundaryLayer.removeFrom(this.map);
      this.boundaryLayer = null;
    }

    // Open the popup for the selected marker
    if (markerInstance) {
      // Close any existing popup first
      this.map?.closePopup();

      // Generate popup content using the helper method
      const popupContent = this.generatePopupContent(marker);

      // Bind and open popup
      markerInstance.bindPopup(popupContent, {
        maxWidth: 500,
        minWidth: 500,
        className: 'custom-popup',
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        autoPan: true
      }).openPopup();

      // Highlight the marker
      this.highlightMarker(marker);
    }
  }
}
