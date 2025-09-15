
export interface ParsedStorm {
  type: 'polygon' | 'marker' | 'multipolygon';
  coordinates: any;
}


export type UGCJson = Record<string, any>;


export interface Storm {
        id: string;
        geometry: {
            type: string;
            coordinates: any;
        } | null;
        properties: {
            id: string;
            areaDesc: string;
            event: string;
            headline: string;
            description: string;
            instruction: string;
            severity: string;
            certainty: string;
            urgency: string;
            effective: string;
            expires: string;
            senderName: string;
            [key: string]: any;
        };
    };
    



export function getStormShape(storm: Storm, UGC_LOOKUP: UGCJson): ParsedStorm | null {

  
  if (storm.geometry) {
    return {
      type: 'polygon',
      coordinates: storm.geometry.coordinates,
    };
  }
  if (storm.properties.geocode?.UGC && storm.properties.geocode?.UGC.length > 0) {
    const ugc = storm.properties.geocode.UGC[0];
    const ugcPolygon = UGC_LOOKUP[ugc];
    if (!ugcPolygon) {
      //console.log("missing lookup for:", ugc)
    }
    //handle multipolygon here
    if (ugcPolygon && ugcPolygon.type === 'Polygon' && ugcPolygon.coordinates) {
      return {
        type: 'polygon',
        coordinates: ugcPolygon.coordinates,
      };
    }
    if (ugcPolygon && ugcPolygon.type === 'MultiPolygon' && ugcPolygon.coordinates) {
      return {
        type: 'multipolygon',
        coordinates: ugcPolygon.coordinates,
      };
    }
  }

  return null;
}

