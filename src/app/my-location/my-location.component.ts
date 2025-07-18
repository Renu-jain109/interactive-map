import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-my-location',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-location.component.html',
  styleUrls: ['./my-location.component.css']
})
export class MyLocationComponent implements OnDestroy {
  // ======================= Inputs =======================
  @Input() map!: L.Map; // Leaflet map instance

  // ======================= Outputs =======================
  @Output() locationFound = new EventEmitter<L.LatLng>(); // Emits when location is found
  @Output() locationError = new EventEmitter<GeolocationPositionError>(); // Emits on geolocation error
  @Output() locationCleared = new EventEmitter<void>(); // Emits when location is cleared

  // ======================= Public State =======================
  isLoading = false; // Loading state for geolocation

  // ======================= Private State =======================
  private marker: L.Marker | null = null; // Current location marker
  private watchId: number | null = null; // Geolocation watch ID
  private circle: L.Circle | null = null; // Accuracy circle

  // ======================= Lifecycle =======================
  /**
   * Cleanup on destroy: remove marker/circle and stop geolocation
   */
  ngOnDestroy(): void {
    this.clearLocation();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }

  // ======================= Public Methods =======================
  /**
   * Start geolocation and show loading spinner
   */
  locateUser(): void {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }
    this.clearLocation();
    this.isLoading = true;
    // Start watching user location
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handleSuccess(pos),
      (err) => this.handleError(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  /**
   * Handle successful geolocation
   * - Add marker and accuracy circle
   * - Show popup with accuracy
   * - Center map and emit event
   */
  public handleSuccess(pos: GeolocationPosition): void {
    const { latitude, longitude, accuracy } = pos.coords;
    const latlng = L.latLng(latitude, longitude);
    this.clearLocation();
    // Add accuracy circle
    this.circle = L.circle(latlng, {
      radius: accuracy,
      color: '#3182ce',
      fillColor: '#3182ce',
      fillOpacity: 0.2,
      weight: 1,
      dashArray: '5, 5'
    }).addTo(this.map);
    // Add location marker
    this.marker = L.marker(latlng, {
      icon: L.divIcon({
        html: `
          <div class="relative">
            <div class="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center">
              <div class="h-2 w-2 bg-white rounded-full"></div>
            </div>
            <div class="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-75"></div>
          </div>
        `,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(this.map);
    // Create popup with close handler
    const popup = L.popup({
      closeButton: true,
      autoClose: false,
      closeOnClick: false,
      className: 'location-popup',
      closeOnEscapeKey: true
    });
    // Set popup content and open it
    popup.setLatLng(latlng)
      .setContent(`<div class="text-sm">Accuracy: ${Math.round(accuracy)} meters</div>`)
      .openOn(this.map);
    // Handle popup close (clear marker and emit event)
    popup.on('remove', () => {
      this.clearLocation();
      this.locationCleared.emit();
    });
    // Center map on location
    this.map.setView(latlng, 15);
    this.locationFound.emit(latlng);
    // Stop watching after first success
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isLoading = false;
  }

  // ======================= Private Methods =======================
  /**
   * Handle geolocation error
   * - Emit error event and stop loading
   */
  private handleError(err: GeolocationPositionError): void {
    console.error('Error getting location:', err);
    this.locationError.emit(err);
    this.isLoading = false;
  }

  /**
   * Remove marker, circle, and popup from map
   */
  private clearLocation(): void {
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    if (this.circle) {
      this.map.removeLayer(this.circle);
      this.circle = null;
    }
    this.map.closePopup();
  }
}
