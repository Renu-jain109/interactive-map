import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkerData } from '../shared/types';
import { markers } from '../shared/data/markers';
import { MapBoundaryService } from '../shared/services/map-boundary.service';

@Component({
  selector: 'app-select-city',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './select-city.component.html',
  styleUrls: ['./select-city.component.css']
})
export class SelectCityComponent implements OnInit {
  // ======================= Inputs =======================
  @Input() selectedCity: string | null = null; // Currently selected city name (null if none)
  @Input() markers: MarkerData[] = markers; // All marker data to display/select from

  // ======================= Outputs =======================
  @Output() cityChange = new EventEmitter<string | null>(); // Emits when the selected city changes

  // ======================= Dependencies =======================
  private readonly boundaryService = inject(MapBoundaryService); // Service for loading/clearing city boundaries

  // ======================= Public Properties =======================
  public cities: string[] = []; // List of unique city names for selection

  // ======================= Lifecycle =======================
  ngOnInit(): void {
    // Get unique city names from markers
    this.cities = [...new Set(this.markers.map(marker => marker.city))];
  }

  // ======================= City Selection Handler =======================
  /**
   * Handles city selection change
   * @param city The selected city or null if cleared
   */
  public handleCitySelected(city: string | null): void {
    this.selectedCity = city;
    console.log('Selected city:', city);
    // Load or clear city boundary on selection
    if (city) {
      this.boundaryService.loadBoundary(city);
    } else {
      this.boundaryService.clearBoundary();
    }
    // Notify parent component
    this.cityChange.emit(city);
  }
}
