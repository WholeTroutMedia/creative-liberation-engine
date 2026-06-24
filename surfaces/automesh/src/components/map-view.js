// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — Interactive Map Component
// Rich Google Maps visualization with polylines, directions, and styles
// ═══════════════════════════════════════════════════════════════

import { fetchTrips } from '../lib/api.js';

export class MapView {
  constructor(container) {
    this.container = container;
    this.trips = [];
    this.map = null;
    this.markers = [];
    this.polylines = [];
    this.directionsRenderer = null;
    this.directionsService = null;
    this.selectedTrip = null;
    this.isLoading = true;
  }

  async init() {
    this.isLoading = true;
    this.render();
    
    try {
      // 1. Fetch trip data
      const res = await fetchTrips({ limit: 20 });
      this.trips = res.trips || [];

      // 2. Load Google Maps API (deferred loading mechanism)
      await window.__loadGoogleMaps();
      
      this.isLoading = false;
      this.render();
      
      // 3. Mount the map
      this.mountMap();
    } catch (err) {
      console.error('[AutoMesh MapView] Failed to load Map view:', err);
      this.container.innerHTML = `
        <div class="card" style="padding: var(--space-8); text-align: center; border-color: var(--accent-danger);">
          <div class="text-secondary">Failed to initialize Google Maps interface. Please verify your credentials/network.</div>
          <button class="btn btn-ghost mt-3" id="retry-map-btn">Retry Load</button>
        </div>
      `;
      const btn = this.container.querySelector('#retry-map-btn');
      if (btn) btn.addEventListener('click', () => this.init());
    }
  }

  mountMap() {
    const mapEl = this.container.querySelector('#google-map-canvas');
    if (!mapEl) return;

    // Swiss Minimalist light-grey Map Custom Styling JSON
    const premiumMapStyle = [
      { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
      { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
      { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
      { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
      { "featureLayer": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
      { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
      { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
      { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
      { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
      { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
      { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
      { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
      { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
      { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
      { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
      { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
      { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
      { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
    ];

    // Default center (Riverhead, NY Home)
    const defaultCenter = { lat: 40.946396, lng: -72.583240 };

    this.map = new google.maps.Map(mapEl, {
      center: defaultCenter,
      zoom: 10,
      styles: premiumMapStyle,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true
    });

    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2563EB', // business accent primary
        strokeWeight: 4,
        strokeOpacity: 0.85
      }
    });

    // Plot initial view markers/polylines for all trips
    this.plotAllTrips();
  }

  clearMapOverlays() {
    this.markers.forEach(m => m.setMap(null));
    this.polylines.forEach(p => p.setMap(null));
    this.markers = [];
    this.polylines = [];
    if (this.directionsRenderer) {
      this.directionsRenderer.setDirections({ routes: [] });
    }
  }

  plotAllTrips() {
    this.clearMapOverlays();
    if (!this.map || this.trips.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    this.trips.forEach(t => {
      if (!t.start_lat || !t.start_lon || !t.end_lat || !t.end_lon) return;

      const start = { lat: t.start_lat, lng: t.start_lon };
      const end = { lat: t.end_lat, lng: t.end_lon };

      bounds.extend(start);
      bounds.extend(end);

      // Draw light dashed connection line for overview
      const color = t.category === 'BUSINESS' ? '#2563EB' : t.category === 'PERSONAL' ? '#8B5CF6' : '#9CA3AF';
      const poly = new google.maps.Polyline({
        path: [start, end],
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.4,
        strokeWeight: 2,
        map: this.map
      });
      this.polylines.push(poly);

      // Simple start dots
      const marker = new google.maps.Marker({
        position: start,
        map: this.map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: color,
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 1.5
        },
        title: `Trip from ${t.start_address}`
      });

      marker.addListener('click', () => {
        this.selectTrip(t.trip_id);
      });

      this.markers.push(marker);
    });

    this.map.fitBounds(bounds);
  }

  async selectTrip(tripId) {
    const trip = this.trips.find(t => t.trip_id === tripId);
    if (!trip) return;

    this.selectedTrip = trip;
    
    // Highlight in sidebar
    this.container.querySelectorAll('.map-sidebar-item').forEach(el => {
      if (parseInt(el.dataset.id, 10) === tripId) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });

    // Render selected trip route details overlay in sidebar
    this.renderSelectedInfoPanel(trip);

    if (!this.map || !trip.start_lat || !trip.start_lon || !trip.end_lat || !trip.end_lon) return;

    const start = new google.maps.LatLng(trip.start_lat, trip.start_lon);
    const end = new google.maps.LatLng(trip.end_lat, trip.end_lon);

    // Show dynamic high-fidelity directions route
    this.directionsService.route({
      origin: start,
      destination: end,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        this.directionsRenderer.setDirections(result);
        
        // Custom styling for Directions polyline based on classification
        const color = trip.category === 'BUSINESS' ? '#2563EB' : trip.category === 'PERSONAL' ? '#8B5CF6' : '#9CA3AF';
        this.directionsRenderer.setOptions({
          polylineOptions: {
            strokeColor: color,
            strokeWeight: 5,
            strokeOpacity: 0.9,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
          }
        });
      } else {
        // Fallback to direct path polyline if Directions API quota fails or route not found
        console.warn('[AutoMesh Map] Directions failed, drawing geodesic path.');
        this.clearMapOverlays();
        const pathPoly = new google.maps.Polyline({
          path: [start, end],
          geodesic: true,
          strokeColor: '#DC2626',
          strokeWeight: 4,
          map: this.map
        });
        this.polylines.push(pathPoly);
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(start);
        bounds.extend(end);
        this.map.fitBounds(bounds);
      }
    });
  }

  renderSelectedInfoPanel(t) {
    const infoPanel = this.container.querySelector('#selected-trip-details');
    if (!infoPanel) return;

    const formattedDate = new Date(t.end_time).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const isBiz = t.category === 'BUSINESS';
    const deductionStr = isBiz && t.deduction !== null ? `$${t.deduction.toFixed(2)}` : '—';
    const badgeClass = t.category === 'BUSINESS' ? 'badge-business' : t.category === 'PERSONAL' ? 'badge-personal' : 'badge-unassigned';

    infoPanel.innerHTML = `
      <div class="anim-slide" style="padding: var(--space-4); border-top: 1px solid var(--border); background: var(--bg-primary);">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs text-tertiary text-mono">${formattedDate}</span>
          <span class="badge ${badgeClass}">${t.category}</span>
        </div>
        <h4 style="margin-bottom: 4px;">Route Details</h4>
        <div class="text-xs text-secondary" style="line-height: 1.4; margin-bottom: 8px;">
          <div><strong>Start:</strong> ${t.start_address || 'Home Location'}</div>
          <div style="margin-top: 4px;"><strong>End:</strong> ${t.end_address || 'Destination'}</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;" class="text-mono">
          <div style="background: white; border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px;">
            <div class="text-xs text-tertiary">DISTANCE</div>
            <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${t.distance_miles.toFixed(1)} mi</div>
          </div>
          <div style="background: white; border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px;">
            <div class="text-xs text-tertiary">IRS DEDUCTION</div>
            <div style="font-size: 0.9rem; font-weight: 600; color: var(--accent-success);">${deductionStr}</div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="card" style="height: 500px; display: flex; align-items: center; justify-content: center;">
          <div class="loading-skeleton" style="width: 90%; height: 90%; border-radius: var(--radius-lg);"></div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="card map-layout anim-fade">
        <div class="map-sidebar">
          <h3 style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: var(--space-3);">
            Recorded Path Layers
          </h3>
          
          <div style="display: flex; flex-direction: column; gap: var(--space-1); max-height: calc(100vh - 380px); overflow-y: auto;">
            ${this.trips.map(t => {
              const date = new Date(t.end_time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
              const name = t.end_address ? t.end_address.split(',')[0] : 'Trip';
              const activeClass = this.selectedTrip?.trip_id === t.trip_id ? 'active' : '';
              const categoryColorClass = t.category.toLowerCase();
              return `
                <div class="map-sidebar-item ${categoryColorClass} ${activeClass}" data-id="${t.trip_id}">
                  <div class="flex justify-between items-center">
                    <span style="font-weight: 600; font-size: 0.8125rem;">${name}</span>
                    <span class="text-mono text-xs text-secondary">${t.distance_miles.toFixed(1)} mi</span>
                  </div>
                  <div class="flex justify-between items-center text-xs text-tertiary" style="margin-top: 2px;">
                    <span>${date}</span>
                    <span>${t.category}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Bottom placeholder for detail specs -->
          <div id="selected-trip-details" style="margin-top: var(--space-4);">
            <div class="text-center text-tertiary text-xs py-4">
              Select a trip block on the list or marker to compute high-fidelity pathing.
            </div>
          </div>
        </div>
        
        <div class="map-container">
          <div id="google-map-canvas" style="width: 100%; height: 100%; min-height: 450px;"></div>
        </div>
      </div>
    `;

    // Hook sidebar clicks
    this.container.querySelectorAll('.map-sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id, 10);
        this.selectTrip(id);
      });
    });
  }
}
