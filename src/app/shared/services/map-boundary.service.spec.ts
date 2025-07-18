import { TestBed } from '@angular/core/testing';

import { MapBoundaryService } from './map-boundary.service';

describe('MapBoundaryService', () => {
  let service: MapBoundaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapBoundaryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
