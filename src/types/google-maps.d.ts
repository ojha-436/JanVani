// Minimal ambient types for the Google Maps JS API, loaded via a plain
// <script> tag (see HotspotMap.tsx) rather than an npm package — avoids
// pulling in @types/google.maps just for a handful of calls.
declare namespace google.maps {
  class Map {
    constructor(
      el: HTMLElement,
      opts: {
        center: { lat: number; lng: number };
        zoom: number;
        disableDefaultUI?: boolean;
        zoomControl?: boolean;
        gestureHandling?: string;
      }
    );
    addListener(event: string, handler: () => void): void;
    setZoom(zoom: number): void;
    getZoom(): number;
    setCenter(latLng: { lat: number; lng: number }): void;
  }
  class Marker {
    constructor(opts: {
      position: { lat: number; lng: number };
      map: Map | null;
      title?: string;
      icon?: Record<string, unknown>;
      label?: string | { text: string; color?: string; fontWeight?: string; fontSize?: string };
      zIndex?: number;
    });
    addListener(event: string, handler: () => void): void;
    setMap(map: Map | null): void;
  }
  class InfoWindow {
    setContent(content: string | Node): void;
    open(map: Map, anchor: Marker): void;
  }
  class LatLng {
    constructor(lat: number, lng: number);
  }
  const SymbolPath: { CIRCLE: number };

  namespace visualization {
    class HeatmapLayer {
      constructor(opts: { data: LatLng[]; radius?: number });
      setMap(map: Map | null): void;
    }
  }
}

interface Window {
  google?: typeof google;
}
