// =======================
// GeojsonLoaderService: Loads city boundary GeoJSON files
// =======================
// This service provides a method to fetch city boundary data from local assets.
// Used by map and boundary-related components to display city outlines.

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeojsonLoaderService {
  private basePath = 'assets/boundary'; // Path to boundary GeoJSON files

  constructor(private http: HttpClient) { }

  /**
   * Fetches the GeoJSON boundary for a given city.
   * @param city City name (case-insensitive)
   * @returns Observable with GeoJSON data or null on error
   */
  getCityBoundary(city: string): Observable<any> {
    // Convert city name to lowercase to match file naming
    let fileName = city.toLowerCase();
    // Special case for Surat as we have a fixed file for it
    if (fileName === 'surat') {
      fileName = 'surat_fixed';
    }
    // Fetch the GeoJSON file and handle errors
    return this.http.get<any>(`${this.basePath}/${fileName}.geojson`).pipe(
      catchError(error => {
        console.error(`Error loading boundary for ${city}:`, error);
        return of(null);
      })
    );
  }
}

// Note: This service is used by map and boundary-related components to load city outlines for display.
// Usage example (in another file):
//   constructor(private geojsonLoader: GeojsonLoaderService) {}
//   this.geojsonLoader.getCityBoundary('Bhopal').subscribe(data => { ... });




