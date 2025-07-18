import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { IonIcon } from '@ionic/angular/standalone';
import { MarkerInteractionService } from '../shared/services/marker-interaction.service';
import { markers } from '../shared/data/markers';
import { MapBoundaryService } from '../shared/services/map-boundary.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, IonIcon, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnChanges, OnInit {
  // ======================= Inputs =======================
  @Input() map!: L.Map; // Leaflet map instance
  @Input() markers: any[] = markers; // All marker data
  @Input() selectedMarker: any; // Currently selected marker
  @Input() isMapReady: boolean = false; // Map ready state
  @Input() markerRefs: Record<string, L.Marker> = {}; // References to marker instances
  @Input() highlightMarker!: (marker: any) => void; // Marker highlight function
  @Input() isCategoryFilterActive!: boolean; // Category filter state

  // ======================= Outputs =======================
  @Output() markerSelect = new EventEmitter<any>(); // Emits when a marker is selected
  @Output() search = new EventEmitter<string>(); // Emits on search

  // ======================= Services =======================
  markerService = inject(MarkerInteractionService); // Marker service
  boundaryService = inject(MapBoundaryService); // Boundary service

  // ======================= Public Properties =======================
  public filteredMarkers: any[] = []; // Markers filtered by search/category
  public searchQuery: string = ''; // Current search query
  public categories: string[] = []; // List of all categories
  public selectedCategories: string[] = []; // Selected categories for filtering
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>; // Search input ref
  public selectedCity: string | null = null; // Currently selected city

  // ======================= Private Properties =======================
  private searchTimeout: any = null; // Debounce timeout for search

  // ======================= Lifecycle =======================
  ngOnInit(): void { }

  ngOnChanges(changes: SimpleChanges) {
    // Re-initialize data if markers input changes
    if (changes['markers'] && this.markers.length > 0) this.initializeData();
  }

  // ======================= Data Initialization =======================
  /**
   * Initialize categories and filtered markers from input markers
   */
  private initializeData() {
    const categorySet = new Set<string>();
    this.markers.forEach(marker => marker.category && categorySet.add(marker.category));
    this.categories = Array.from(categorySet).sort();
    this.filteredMarkers = [...this.markers];
  }

  // ======================= Update Filtered Markers =======================
  /**
   * Updates the filteredMarkers array and resets selection state.
   * Clears the selected marker and search input if no markers remain.
   */
  updateFilteredMarkers(markers: any[]): void {
    this.filteredMarkers = markers || [];
    // Always clear the selected marker when updating filtered markers
    // This prevents any marker from being automatically selected
    this.selectedMarker = null;
    this.markerSelect.emit(null);
    if (markers.length === 0) {
      this.searchQuery = '';
      this.boundaryService.clearBoundary();
      if (this.searchInput) this.searchInput.nativeElement.value = '';
    }
  }

  // ======================= Marker Selection =======================
  /**
   * Select a marker and emit event. Scrolls to marker in sidebar.
   */
  public onMarkerSelect(marker: any): void {
    console.log('onMarkerSelect called with marker:', marker);
    this.selectedMarker = marker;
    this.markerSelect.emit(marker);
    // Scroll to selected marker in sidebar
    if (marker && this.searchInput) {
      setTimeout(() => {
        const element = document.querySelector('.selected-marker');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }

  // ======================= Category Filter Change =======================
  /**
   * Update selected categories and apply filters
   */
  onCategoryFilterChange(categories: string[]): void {
    this.selectedCategories = categories;
    this.applyFilters();
  }

  // ======================= City Selection =======================
  /**
   * Handle city selection from dropdown or other component
   */
  onCitySelected(city: string | null): void {
    if (!city) {
      this.selectedMarker = null;
      this.markerSelect.emit(null);
      return;
    }
    const marker = this.markers.find(m => m.city === city);
    if (marker) this.onMarkerSelect(marker);
    // Load city boundary if not filtering by category
    if (!this.isCategoryFilterActive) this.loadBoundary(marker.city);
    // Show popup and center map on marker
    const markerRef = this.markerRefs[marker.city.toLowerCase()];
    if (markerRef) {
      this.map?.setView(markerRef.getLatLng(), 13);
    }
  }

  // ======================= Boundary Loader =======================
  /**
   * Load city boundary on map, or clear if not needed
   */
  private loadBoundary(city: string): void {
    console.log('sidebar loadBoundary called for city:', city, 'isCategoryFilterActive:', this.isCategoryFilterActive);
    if (!city || this.isCategoryFilterActive) {
      console.log('loadBoundary skipped due to isCategoryFilterActive or no city');
      this.boundaryService.clearBoundary();
      return;
    }
    if (this.selectedCity === city) return;
    this.selectedCity = city;
    this.boundaryService.loadBoundary(city, this.isCategoryFilterActive);
  }

  // ======================= Search Input Handler =======================
  /**
   * Handle search input changes, filter markers, and emit events
   */
  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.searchQuery = query;
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (!query) {
        this.filteredMarkers = [...this.markers];
        this.search.emit('');
        this.selectedMarker = null;
        this.markerSelect.emit(null);
        return;
      }
      // Filter markers by city, state, or category
      const filtered = this.markers.filter(marker =>
        (marker.city && marker.city.toLowerCase().includes(query)) ||
        (marker.state && marker.state.toLowerCase().includes(query)) ||
        (marker.category && marker.category.toLowerCase().includes(query))
      );
      this.filteredMarkers = filtered;
      this.search.emit(query);
      // Only select marker if user clicks or presses Enter
      this.selectedMarker = null;
      this.markerSelect.emit(null);
    }, 300);
  }

  // ======================= Search Enter Handler =======================
  /**
   * Handle pressing Enter in search input, select and highlight first match
   */
  onSearchEnter(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const query = inputElement.value.trim().toLowerCase();
    if (!query) return;
    const firstMatch = this.markers.find(marker =>
      (marker.city && marker.city.toLowerCase().includes(query)) ||
      (marker.state && marker.state.toLowerCase().includes(query)) ||
      (marker.category && marker.category.toLowerCase().includes(query))
    );
    if (firstMatch) {
      this.selectedMarker = firstMatch;
      this.markerSelect.emit(firstMatch);
      if (!this.isCategoryFilterActive) this.loadBoundary(firstMatch.city);
      if (this.highlightMarker) this.highlightMarker(firstMatch);
    }
  }

  // ======================= Clear Search =======================
  /**
   * Clears the search input, resets the search query, filtered markers, and selected marker.
   * Refocuses the search input field for user convenience.
   */
  clearSearch(input: HTMLInputElement) {
    input.value = '';
    this.searchQuery = '';
    this.search.emit('');
    this.filteredMarkers = [...this.markers];
    this.selectedMarker = null;
    this.markerSelect.emit(null);
    if (this.searchInput) this.searchInput.nativeElement.focus();
  }

  // ======================= Apply Category Filters =======================
  /**
   * Filters the markers list based on selected categories.
   * If no categories are selected, all markers are shown.
   */
  public applyFilters() {
    if (!this.selectedCategories || this.selectedCategories.length === 0) {
      this.filteredMarkers = [...this.markers];
      return;
    }
    this.filteredMarkers = this.markers.filter(marker =>
      this.selectedCategories.includes(marker.category)
    );
  }
}