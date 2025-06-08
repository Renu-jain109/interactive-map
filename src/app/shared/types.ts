// types.ts
export type GeoJSONFeature = {
    type: "Feature";
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: any;
    };
    properties: {
      name: string;
      [key: string]: any;
    };
  };
  