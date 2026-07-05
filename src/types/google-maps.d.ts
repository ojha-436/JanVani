// Minimal ambient types for the Google Maps JS API, loaded via a plain
// <script> tag (see HotspotMap.tsx) rather than an npm package — avoids
// pulling in @types/google.maps just for a handful of calls.
declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts: { center: { lat: number; lng: number }; zoom: number });
  }
  class Marker {
    constructor(opts: {
      position: { lat: number; lng: number };
      map: Map;
      title?: string;
      icon?: Record<string, unknown>;
    });
    addListener(event: string, handler: () => void): void;
  }
  class InfoWindow {
    setContent(content: string): void;
    open(map: Map, anchor: Marker): void;
  }
  const SymbolPath: { CIRCLE: number };
}

interface Window {
  google?: typeof google;
}
