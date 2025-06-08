import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, IonIcon, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  @Input() markers: any[] = [];
  @Input() selectedMarker: any;
  @Input() isMapReady: boolean = false;
  @Output() search = new EventEmitter<string>();
  @Output() markerSelect = new EventEmitter<any>();
  
  public filteredMarkers: any[] = [];
  private searchTimeout: any = null;

  displayMarkerDetails(marker: any) {
    this.selectedMarker = marker;
    this.markerSelect.emit(marker);
  }

  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    
    // Debounce the search
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.search.emit(query);
    }, 300);
  }

  clearSearch(input: HTMLInputElement) {
    input.value = '';
    this.search.emit('');
    this.filteredMarkers = [];
    this.selectedMarker = null; // Clear the selected marker
    this.markerSelect.emit(null); // Notify parent to clear selection
    this.searchInput.nativeElement.focus();
  }

  // This method will be called from parent component to update filtered markers
  updateFilteredMarkers(markers: any[]) {
    this.filteredMarkers = markers || [];
  }
}
