import { TestBed } from '@angular/core/testing';

import { GeojsonLoaderService } from '../services/geojson-loader.service';

describe('GeojsonLoaderService', () => {
  let service: GeojsonLoaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeojsonLoaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
