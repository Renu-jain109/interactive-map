import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, inject, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

// Components
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MyLocationComponent } from '../my-location/my-location.component';
import { FilterCategoryComponent } from '../filter-category/filter-category.component';
import { SelectCityComponent } from '../select-city/select-city.component';

// Services
import { MarkerInteractionService } from '../shared/services/marker-interaction.service';
import { MapBoundaryService } from '../shared/services/map-boundary.service';

// Types and Data
import { MarkerData } from '../shared/types';
import { markers } from '../shared/data/markers';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, MyLocationComponent, SelectCityComponent, FilterCategoryComponent],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css', './animations.css']
})
export class MapComponent implements AfterViewInit {
  // ======================= Dependencies & Template References =======================
  private readonly markerService = inject(MarkerInteractionService); // Marker service for marker logic
  private readonly boundaryService = inject(MapBoundaryService); // Service for city boundaries
  private readonly cdr = inject(ChangeDetectorRef); // Change detector
  @ViewChild('mapContainer', { static: true }) private mapContainer!: ElementRef<HTMLElement>; // Map container reference
  @ViewChild('sidebar', { static: false }) public sidebar!: SidebarComponent; // Sidebar component reference

  // ======================= Outputs =======================
  @Output() onMarkerSelected = new EventEmitter<MarkerData | null>(); // Emits when a marker is selected
  @Output() onCitySelected = new EventEmitter<string>(); // Emits when a city is selected

  // ======================= Public Properties =======================
  public map!: L.Map; // Leaflet map instance
  public isMapReady = false; // Map ready state
  public isSidebarOpen = true; // Sidebar open/close state
  public markers: MarkerData[] = markers; // All marker data
  public selectedMarker: any; // Currently selected marker
  public currentCity: string | null = null; // Currently selected city
  public filteredMarkers: any[] = []; // Markers filtered by search/category/city
  public markerRefs: Record<string, any> = {}; // References to marker instances
  public searchQuery: string = ''; // Current search query
  public categories: string[] = []; // All available categories
  public selectedCategories: string[] = []; // Selected categories for filtering
  public isCategoryFilterActive: boolean = false; // Is category filter active

  // ======================= Private Properties =======================
  private boundaryLayer: L.GeoJSON | null = null; // Current city boundary layer
  private isHandlingMarkerSelect = false; // Prevents recursive marker selection

  constructor() {}

  // ======================= Lifecycle =======================
  ngAfterViewInit(): void {
    this.initMap();
    if (this.map) {
      // Initialize boundary service with map
      this.boundaryService.init(this.map);

      // Subscribe to boundary loading state if needed
      this.boundaryService.boundaryLoading$.subscribe(loading => {
        console.log('Boundary loading:', loading);
      });

      this.boundaryService.boundaryError$.subscribe(error => {
        if (error) {
          console.error('Boundary error:', error);
        }
      });

      // Initialize categories
      this.categories = [...new Set(this.markers.map(marker => marker.category).filter(Boolean))];
      this.filteredMarkers = [...this.markers];
      this.isMapReady = true;
      this.cdr.detectChanges();
    }
  }

  // ======================= Sidebar Toggle =======================
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    this.cdr.detectChanges();
  }

  // ======================= Map Initialization =======================
  private initMap(): void {
    // Ensure the map container is available and empty
    const mapContainer = this.mapContainer.nativeElement;
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
      position: 'bottomright'
    }).addTo(this.map);

    // Add attribution
    L.control.attribution({
      position: 'bottomright',
      prefix: false
    })
      .setPrefix('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors')
      .addTo(this.map);

    this.markerService.map = this.map;
    // Use addOrUpdateMarkers instead of removed addMarkers
    this.markerService.addOrUpdateMarkers(this.markers, this.sidebar, this.markerRefs, true);
    this.isMapReady = true;
    this.cdr.detectChanges();
  }

  // ======================= Location Events =======================
  /**
   * Handles when the user clears their location from the location popup
   */
  onLocationCleared(): void {
    // Reset map view to show all markers or default view
    if (!this.map) return;

    // Clear city boundary and reset city dropdown
    this.clearBoundary();
    this.currentCity = null; // <-- City dropdown reset

    // Reset sidebar and marker selection
    this.selectedMarker = null;
    this.filteredMarkers = [...this.markers];
    this.searchQuery = '';
    this.selectedCategories = [];
    this.isCategoryFilterActive = false;
    if (this.sidebar) {
      this.sidebar.selectedMarker = null;
      this.sidebar.searchQuery = '';
      this.sidebar.updateFilteredMarkers(this.filteredMarkers);
      if (this.sidebar.searchInput) {
        this.sidebar.searchInput.nativeElement.value = '';
      }
    }

    if (this.markers.length > 0) {
      // Get all marker layers
      const markerLayers = this.markers
        .filter(m => m && m['marker'])
        .map(m => m['marker']);

      if (markerLayers.length > 0) {
        const group = L.featureGroup(markerLayers);
        this.map.fitBounds(group.getBounds().pad(0.1));
        return;
      }
    }

    // Default to India view if no markers found
    this.map.setView([20.5937, 78.9629], 5);
    this.updateMapMarkers();
  }

  /**
   * Handles when the user's location is found
   * @param location The location event from Leaflet
   */
  onLocationFound(location: L.LatLng): void {
    console.log('Location found:', location);
    // Reset sidebar and marker selection
    this.selectedMarker = null;
    this.filteredMarkers = [...this.markers];
    this.searchQuery = '';
    this.selectedCategories = [];
    this.isCategoryFilterActive = false;
    this.currentCity = null; // <-- Reset city dropdown
    if (this.sidebar) {
      this.sidebar.selectedMarker = null;
      this.sidebar.searchQuery = '';
      this.sidebar.updateFilteredMarkers(this.filteredMarkers);
      if (this.sidebar.searchInput) {
        this.sidebar.searchInput.nativeElement.value = '';
      }
    }
    // You can add custom handling for when location is found
  }


  /**
   * Handles location errors from the MyLocationComponent
   * @param error The geolocation error
   */
  onLocationError(error: GeolocationPositionError): void {
    console.error('Error getting location:', error);
  }

  // ======================= Marker Selection =======================
  public handleMarkerSelect(marker: MarkerData): void {
    try {
      // Prevent recursive calls
      if (this.isHandlingMarkerSelect) return;
      this.isHandlingMarkerSelect = true;

      this.selectedMarker = marker;
      this.onMarkerSelected.emit(marker);

      if (!marker) {
        return;
      }

      // Get the marker reference
      const markerRef = this.markerRefs[marker.city.toLowerCase()];
      if (markerRef) {
        this.highlightMarker(markerRef);

        // If sidebar is available, update it
        if (this.sidebar) {
          this.sidebar.onMarkerSelect(marker);
        }
      } else {
        console.warn('Marker reference not found for city:', marker.city);
      }
    } catch (error) {
      console.error('Error in handleMarkerSelect:', error);
    } finally {
      // Reset the flag
      this.isHandlingMarkerSelect = false;
    }
  }

  // ======================= Boundary Loader =======================
  /**
   * Handles city selection change
   * @param city The selected city name or null if cleared
   */
  public onCityChange(city: string | null): void {
    if (!city) {
      this.clearBoundary();
      return;
    }

    this.currentCity = city.toLowerCase();
    this.loadBoundary(this.currentCity);

    // Filter markers for the selected city
    const cityMarkers = this.markers.filter(marker =>
      marker.city.toLowerCase() === this.currentCity
    );

    // Emit city selection event
    this.onCitySelected.emit(city);
  }

  /**
   * Clears the current boundary layer from the map
   */
  private clearBoundary(): void {
    console.log('map.component.ts clearBoundary executed, current boundaryLayer:', this.boundaryLayer);
    if (this.boundaryLayer) {
      this.map?.removeLayer(this.boundaryLayer);
      this.boundaryLayer = null;
      console.log('Boundary layer removed, new boundaryLayer:', this.boundaryLayer);
    }
    if (this.map) {
      this.map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.GeoJSON) {
          this.map.removeLayer(layer);
          console.log('Removed all GeoJSON layers');
        }
      });
    }
    this.boundaryService.clearBoundary(); // Sync with service
  }


  private loadBoundary(city: string): void {
    if (!this.map) {
      console.error('Map not initialized');
      return;
    }
    this.clearBoundary();
    if (!city || city.trim() === '') {
      console.warn('No city provided to load boundary');
      return;
    }
    const boundaryCity = city.toLowerCase() === 'new delhi' ? 'delhi' : city.toLowerCase();
    console.log(`Loading boundary for city: ${boundaryCity}, isCategoryFilterActive: ${this.isCategoryFilterActive}`);
    this.boundaryService.loadBoundary(boundaryCity, this.isCategoryFilterActive);
  }

  // ======================= Category Filter =======================
  public handleCategorySelected(categories: string[]): void {
    try {
      console.log('handleCategorySelected - Start with categories:', categories);

      // Clear search state
      this.currentCity = null; // Reset city dropdown
      this.searchQuery = '';
      this.isCategoryFilterActive = categories.length > 0;
      this.selectedCategories = [...categories];

      // Clear existing markers and boundary
      if (this.map) {
        // Remove all existing markers
        Object.values(this.markerRefs).forEach((ref: any) => {
          if (ref instanceof L.Marker) {
            this.map.removeLayer(ref);
          }
        });
        this.markerRefs = {}; // Clear the marker references
        this.clearBoundary();
      }

      // Apply category filter
      if (categories.length === 0) {
        this.filteredMarkers = [...this.markers];
        console.log('No categories selected, showing all markers');
      } else {
        this.filteredMarkers = this.markers.filter(marker =>
          marker.category && categories.includes(marker.category.trim())
        );
        console.log('Filtered Markers by category:', this.filteredMarkers.length);
      }

      // Update map with new markers
      this.updateMapMarkers();

      // Update sidebar with filtered markers but don't select any
      if (this.sidebar) {
        // Clear search state and selection
        this.sidebar.searchQuery = '';
        this.sidebar.selectedMarker = null;
        this.sidebar.markerSelect.emit(null);

        if (this.sidebar.searchInput) {
          this.sidebar.searchInput.nativeElement.value = '';
        }

        // Update filtered markers without selecting any
        this.sidebar.updateFilteredMarkers(this.filteredMarkers);

        // Clear any existing selection in the UI
        const selectedElements = document.querySelectorAll('.selected-marker');
        selectedElements.forEach(el => el.classList.remove('selected-marker', 'bg-blue-50'));
      }

      // Fit map to show all filtered markers
      if (this.filteredMarkers.length > 0) {
        this.onFitToMarkers(this.filteredMarkers);
      } else {
        // Default view if no markers found
        this.map?.setView([20.5937, 78.9629], 5);
      }
    } catch (error) {
      console.error('Error in handleCategorySelected:', error);
    }
  }

  // ======================= City Selection =======================
  public handleCitySelected(city: string | null): void {
    if (!city) {
      this.selectedMarker = null;
      this.clearBoundary();
      this.searchQuery = '';
      this.filteredMarkers = [...this.markers];
      if (this.sidebar) {
        this.sidebar.updateFilteredMarkers(this.filteredMarkers);
        this.sidebar.selectedMarker = null;
        this.sidebar.markerSelect.emit(null);
      }
      return;
    }

    this.currentCity = city;
    const marker = this.markers.find(m => m.city.toLowerCase() === city.toLowerCase());
    this.loadBoundary(city);
    this.searchQuery = '';
    this.filteredMarkers = marker ? [marker] : [];
    this.isCategoryFilterActive = false;
    this.selectedCategories = [];

    // Update sidebar first
    if (this.sidebar) {
      this.sidebar.updateFilteredMarkers(this.filteredMarkers);
      this.sidebar.searchQuery = '';
      if (this.sidebar.searchInput) {
        this.sidebar.searchInput.nativeElement.value = '';
      }
    }

    if (marker) {
      // First update the map view
      const markerRef = this.markerRefs[marker.city.toLowerCase()];
      if (markerRef && markerRef.getLatLng) {
        this.map?.setView(markerRef.getLatLng(), 11);
      } else {
        this.map?.setView([marker.lat, marker.lng], 11);
      }

      // Then update the marker selection
      this.selectedMarker = marker;

      // Finally update the sidebar selection
      if (this.sidebar) {
        // Small delay to ensure the filtered markers are updated
        setTimeout(() => {
          this.sidebar.selectedMarker = marker;
          this.sidebar.onMarkerSelect(marker);

          // Ensure the sidebar scrolls to show the selected marker
          const element = document.querySelector('.selected-marker');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      }
    } else {
      this.loadBoundary(city);
      this.onCitySelected.emit(city);
    }

    this.onCitySelected.emit(city);
    this.updateMapMarkers();
  }

  // ======================= Fit Markers =======================
  /**
   * Handles the fitToMarkers event from FilterCategoryComponent
   * @param markers Array of markers to fit the map to
   */
  public onFitToMarkers(markers: MarkerData[]): void {
    if (this.map && markers.length > 0) {
      const bounds = L.latLngBounds(
        markers.map(marker => [marker.lat, marker.lng] as L.LatLngTuple)
      );
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // ======================= Marker Click =======================
  /**
   * Handles marker click events
   * @param marker The marker data that was clicked
   */
  public onMarkerClick(marker: MarkerData): void {
    this.selectedMarker = marker;
    this.onMarkerSelected.emit(marker);
  }

  // ======================= City Select =======================
  /**
   * Handles city selection
   */
  public onCitySelect(city: string): void {
    this.currentCity = city;
    this.onCitySelected.emit(city);
    this.loadBoundary(city);
  }

  // ======================= Search Functionality =======================
  public onSearchFromSidebar(query: string): void {
    try {
      console.log('onSearchFromSidebar - Start with query:', query);

      // Reset category filter state
      this.selectedCategories = [];
      this.isCategoryFilterActive = false;
      this.searchQuery = query.trim();

      // Clear any existing markers and boundary
      if (this.map) {
        // Remove all existing markers
        Object.values(this.markerRefs).forEach((ref: any) => {
          if (ref instanceof L.Marker) {
            this.map.removeLayer(ref);
          }
        });
        this.markerRefs = {}; // Clear the marker references
        this.clearBoundary();
      }

      // Always reset city dropdown
      this.currentCity = null;
      this.cdr.detectChanges();

      if (!this.searchQuery) {
        // If search query is empty, show all markers
        this.filteredMarkers = [...this.markers];
        console.log('Empty search query, showing all markers:', this.filteredMarkers.length);
      } else {
        // Filter markers based on search query
        const searchTerm = this.searchQuery.toLowerCase();
        this.filteredMarkers = this.markers.filter(m =>
          (m.city && m.city.toLowerCase().includes(searchTerm)) ||
          (m.state && m.state.toLowerCase().includes(searchTerm)) ||
          (m.category && m.category.toLowerCase().includes(searchTerm)) ||
          (m.hindiName && m.hindiName.toLowerCase().includes(searchTerm))
        );
        console.log('Filtered Markers after search:', this.filteredMarkers.length);
      }

      // Update map with new markers
      this.updateMapMarkers();

      // Update sidebar and select first marker if any results
      if (this.sidebar) {
        // Clear any existing selection first
        this.sidebar.selectedMarker = null;
        this.sidebar.markerSelect.emit(null);

        // Update filtered markers in sidebar
        this.sidebar.updateFilteredMarkers(this.filteredMarkers);

        // If we have search results, select the first one to show details in sidebar
        if (this.filteredMarkers.length > 0) {
          setTimeout(() => {
            const firstMarker = this.filteredMarkers[0];
            // Update sidebar selection
            this.sidebar.selectedMarker = firstMarker;
            this.sidebar.markerSelect.emit(firstMarker);

            // Ensure the marker is visible in the sidebar
            setTimeout(() => {
              const element = document.querySelector('.selected-marker');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 100);
          });
        }
      }

      // Handle boundary for single result
      if (this.filteredMarkers.length === 1) {
        const city = this.filteredMarkers[0].city;
        console.log('Loading boundary for single result:', city);
        this.loadBoundary(city);
      } else {
        console.log('Clearing boundary - multiple or no results');
        this.clearBoundary();
      }

      // Fit map to show all markers
      if (this.filteredMarkers.length > 0) {
        this.onFitToMarkers(this.filteredMarkers);
      } else {
        // Default view if no markers found
        this.map?.setView([20.5937, 78.9629], 5);
      }
    } catch (error) {
      console.error('Error in onSearchFromSidebar:', error);
    }
  }

  // ======================= Marker Update Helper =======================
  /**
   * Calls the MarkerInteractionService to add or update markers on the map.
   * Centralizes marker logic in the service for maintainability.
   */
  private updateMapMarkers(): void {
    if (!this.map) return;
    this.markerService.map = this.map;
    this.markerService.addOrUpdateMarkers(
      this.filteredMarkers,
      this.sidebar,
      this.markerRefs,
      true // clear existing markers
    );
  }

  /**
   * Highlight marker using service
   */
  public highlightMarker(marker: MarkerData): void {
    this.markerService.highlightMarker(this.markerRefs, marker);
  }
}