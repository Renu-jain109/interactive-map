import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeojsonLoaderService {
  private basePath = 'assets/boundary';

  constructor(private http: HttpClient) { }

  getCityBoundary(city: string): Observable<any> {
    // Convert city name to lowercase to match file naming
    let fileName = city.toLowerCase();
    
    // Special case for Surat as we have a fixed file for it
    if (fileName === 'surat') {
      fileName = 'surat_fixed';
    }
    
    return this.http.get<any>(`${this.basePath}/${fileName}.geojson`).pipe(
      catchError(error => {
        console.error(`Error loading boundary for ${city}:`, error);
        return of(null);
      })
    );
  }
}




// import { HttpClient } from '@angular/common/http';
// import { Injectable } from '@angular/core';
// import { Observable, catchError, of } from 'rxjs';

// @Injectable({
//   providedIn: 'root'
// })
// export class GeojsonLoaderService {
//   private basePath = 'assets/boundary';

//   constructor(private http: HttpClient) { }

//   getCityBoundary(city: string): Observable<any> {
//     // Convert city name to lowercase to match file naming
//     const fileName = city.toLowerCase();
//     return this.http.get<any>(`${this.basePath}/${fileName}.geojson`).pipe(
//       catchError(error => {
//         console.error(`Error loading boundary for ${city}:`, error);
//         return of(null);
//       })
//     );
//   }
// }
