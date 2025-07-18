import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { markers } from '../shared/data/markers';
import { MarkerInteractionService } from '../shared/services/marker-interaction.service';
import { MarkerData } from '../shared/types';

@Component({
  selector: 'app-filter-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-category.component.html',
  styleUrls: ['./filter-category.component.css']
})
export class FilterCategoryComponent implements OnInit {
  // ======================= Inputs =======================
  @Input() selectedCategories: string[] = []; // Currently selected categories
  @Input() markers: MarkerData[] = markers; // All marker data

  // ======================= Outputs =======================
  @Output() categoryChange = new EventEmitter<string[]>(); // Emits when categories change
  @Output() fitToMarkers = new EventEmitter<MarkerData[]>(); // Emits to fit map to filtered markers

  // ======================= Dependencies =======================
  private markerService = inject(MarkerInteractionService); // Marker service

  // ======================= UI State =======================
  isCategoryOpen = false; // Dropdown open state
  searchQuery = ''; // Search query for categories
  filteredCategories: string[] = []; // Categories filtered by search
  categories: string[] = []; // All available categories
  filteredMarkers: MarkerData[] = []; // Markers filtered by category

  // ======================= Lifecycle =======================
  ngOnInit(): void {
    // Use service to extract unique categories
    this.categories = this.markerService.extractCategories(this.markers);
    this.filteredCategories = [...this.categories];
    this.filteredMarkers = [...this.markers];
  }

  // ======================= Category Filter UI =======================
  /** Toggle category filter dropdown */
  public toggleCategoryFilter(): void {
    this.isCategoryOpen = !this.isCategoryOpen;
  }

  /** Close dropdown when mouse leaves */
  public onCategoryFilterMouseLeave(): void {
    this.isCategoryOpen = false;
  }

  /** Toggle category selection */
  public toggleCategory(category: string): void {
    if (!category) return;
    const normalizedCategory = category.toLowerCase();
    const index = this.selectedCategories.findIndex(c => c.toLowerCase() === normalizedCategory);
    if (index === -1) {
      this.selectedCategories = [...this.selectedCategories, category];
    } else {
      this.selectedCategories = this.selectedCategories.filter(c => c.toLowerCase() !== normalizedCategory);
    }
    this.applyFilters();
    this.filterCategories();
  }

  /** Remove a category from selected */
  public removeCategory(event: Event, category: string): void {
    event.stopPropagation();
    this.selectedCategories = this.selectedCategories.filter(c => c !== category);
    this.applyFilters();
  }

  /** Filter categories based on search query */
  public filterCategories(): void {
    if (!this.searchQuery) {
      this.filteredCategories = [...this.categories];
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredCategories = this.categories.filter(category => 
      category.toLowerCase().includes(query)
    );
  }

  /** Clear all selected categories */
  public clearFilters(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedCategories = [];
    this.searchQuery = '';
    this.filterCategories();
    this.applyFilters();
  }

  // ======================= Category Filter Logic =======================
  /**
   * Apply filters and update the view
   * - If no categories selected, show all markers
   * - If categories selected, show only markers matching any selected category
   * - Emits categoryChange and fitToMarkers events for parent components
   */
  private applyFilters(): void {
    if (!this.markers) {
      this.filteredMarkers = [];
      this.categoryChange.emit(this.selectedCategories);
      return;
    }
    // Use service for filtering
    if (!this.selectedCategories || this.selectedCategories.length === 0) {
      this.filteredMarkers = [...this.markers];
      this.categoryChange.emit([]);
      return;
    }
    this.filteredMarkers = this.markerService.filterMarkersByCategories(this.markers, this.selectedCategories);
    this.categoryChange.emit([...this.selectedCategories]);
    if (this.filteredMarkers.length > 0) {
      this.fitToMarkers.emit([...this.filteredMarkers]);
    } else {
      this.fitToMarkers.emit([]);
    }
  }

  /**
   * Returns true if the given category is currently selected
   * Used for checkbox and highlighting in the UI
   * @param category Category string to check
   */
  public isCategorySelected(category: string): boolean {
    if (!category) return false;
    // Check if category is present in selectedCategories (case-insensitive)
    return this.selectedCategories.some(c => c.toLowerCase() === category.toLowerCase());
  }
}

