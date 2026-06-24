// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — Main Application Entry & SPA Router
// Orchestrates views, state management, and updates
// ═══════════════════════════════════════════════════════════════

import { Header } from './components/header.js';
import { StatsPanel } from './components/stats-panel.js';
import { VehicleSchematic } from './components/vehicle-schematic.js';
import { TripLedger } from './components/trip-ledger.js';
import { MapView } from './components/map-view.js';
import { MaintenanceLog } from './components/maintenance.js';
import { FinancialLedger } from './components/financial-ledger.js';

class App {
  constructor() {
    this.appEl = document.getElementById('app');
    this.header = null;
    this.activeComponent = null;
    this.statsPanel = null;
    this.currentView = 'dashboard';
    this.iphoneData = null;
  }

  async init() {
    // Scaffold main application container structure
    this.appEl.innerHTML = `
      <div id="header-container"></div>
      <main id="main-content" class="page-content"></main>
    `;

    const headerContainer = document.getElementById('header-container');
    
    // Initialize Header with navigation routing callback
    this.header = new Header(headerContainer, (view) => this.navigate(view));
    await this.header.init();

    // Listen to data update events to sync stats/header
    window.addEventListener('automesh-data-updated', () => {
      this.refreshActiveStats();
    });

    // Initial routing based on window location hash
    this.handleHashRoute();
    window.addEventListener('hashchange', () => this.handleHashRoute());
  }

  handleHashRoute() {
    const hash = window.location.hash || '#';
    let view = 'dashboard';
    if (hash.startsWith('#trips')) view = 'trips';
    else if (hash.startsWith('#financials')) view = 'financials';
    else if (hash.startsWith('#map')) view = 'map';
    else if (hash.startsWith('#maintenance')) view = 'maintenance';

    this.navigate(view, false);
  }

  async navigate(view, updateHash = true) {
    if (this.activeComponent && typeof this.activeComponent.destroy === 'function') {
      this.activeComponent.destroy();
    }

    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
      this.dashboardInterval = null;
    }

    this.currentView = view;
    if (updateHash) {
      window.location.hash = view === 'dashboard' ? '' : `#${view}`;
    }

    this.header.setActiveTab(view);
    const mainEl = document.getElementById('main-content');
    mainEl.innerHTML = '';

    if (view === 'dashboard') {
      await this.renderDashboard(mainEl);
    } else if (view === 'trips') {
      await this.renderTripsPage(mainEl);
    } else if (view === 'financials') {
      await this.renderFinancialsPage(mainEl);
    } else if (view === 'map') {
      await this.renderMapPage(mainEl);
    } else if (view === 'maintenance') {
      await this.renderMaintenancePage(mainEl);
    }
  }

  async refreshActiveStats() {
    // If stats panel is currently rendered, refresh it
    if (this.statsPanel) {
      await this.statsPanel.loadStats();
    }
    // Also trigger header refresh for live odometer
    if (this.header) {
      await this.header.updateTelemetry();
    }
  }

  async loadIphoneTelemetry() {
    try {
      const res = await fetch('/api/telemetry/iphone');
      this.iphoneData = await res.json();
    } catch (err) {
      console.warn('[AutoMesh main] Failed to load iPhone telemetry:', err);
    }
    
    // Set fallback if loading failed or returned empty
    if (!this.iphoneData || !this.iphoneData.telemetry) {
      this.iphoneData = {
        hostname: "iDevil-Max",
        mesh_status: "CONNECTED",
        telemetry: {
          location: { latitude: 40.946438, longitude: -72.583206 },
          battery: { level: 100.0, state: "Not Charging" },
          network: { ssid: "Venza Car Wi-Fi", connection_type: "Wi-Fi", geocoded_location: "Home, Riverhead NY" },
          esim: { carrier: "Telnyx eSIM (AT&T Roaming)", data_plan_usage_gb: 4.27, data_plan_limit_gb: 10.0 }
        }
      };
    }
  }

  async loadNetworkClients() {
    try {
      const res = await fetch('/api/telemetry/network-clients');
      this.networkClients = await res.json();
    } catch (err) {
      console.warn('[AutoMesh main] Failed to load network clients:', err);
      this.networkClients = [];
    }
  }

  async renderNetworkClients() {
    await this.loadNetworkClients();
    const tbody = document.getElementById('mesh-clients-tbody');
    const countEl = document.getElementById('mesh-clients-count');
    if (!tbody) return;

    if (!this.networkClients || this.networkClients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 24px; text-align: center; color: var(--text-tertiary); font-size: 0.85rem;">
            No clients discovered on the mesh network.
          </td>
        </tr>
      `;
      if (countEl) countEl.innerText = "0 Nodes Active";
      return;
    }

    // Sort active first, then hostname
    const sortedClients = [...this.networkClients].sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return a.hostname.localeCompare(b.hostname);
    });

    if (countEl) {
      const activeCount = sortedClients.filter(c => c.status === 'ACTIVE').length;
      countEl.innerText = `${activeCount} / ${sortedClients.length} Nodes Active`;
    }

    tbody.innerHTML = sortedClients.map(client => {
      const isActive = client.status === 'ACTIVE';
      const statusColor = isActive ? 'var(--accent-success)' : 'var(--text-tertiary)';
      const statusBg = isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(156, 163, 175, 0.05)';
      const statusBorder = isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(156, 163, 175, 0.1)';
      
      const batStr = client.battery !== null && client.battery !== undefined ? 
        `<span style="margin-left: 8px; font-size: 0.7rem; color: var(--text-secondary);">🔋 ${client.battery}%</span>` : '';
      
      // Safe date format parser
      let lastSeenFormatted = 'Unknown';
      if (client.last_seen) {
        try {
          const dateObj = new Date(client.last_seen);
          lastSeenFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
            ' ' + dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch (e) {}
      }

      // Model emojis helper
      const nameLower = client.hostname.toLowerCase();
      let emoji = '💻';
      if (nameLower.includes('iphone') || nameLower.includes('phone') || nameLower.includes('max') || nameLower.includes('pro') || nameLower.includes('devil')) {
        emoji = '📱';
      } else if (nameLower.includes('toyota') || nameLower.includes('venza') || nameLower.includes('car')) {
        emoji = '🚗';
      } else if (nameLower.includes('ipad') || nameLower.includes('tablet')) {
        emoji = '📟';
      } else if (nameLower.includes('nas') || nameLower.includes('server') || nameLower.includes('media')) {
        emoji = '🖳';
      } else if (nameLower.includes('sonos') || nameLower.includes('speaker') || nameLower.includes('tv') || nameLower.includes('tstat')) {
        emoji = '🔌';
      }

      return `
        <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;">
          <td style="padding: 14px 16px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.15rem;">${emoji}</span>
            <div>
              <div style="color: var(--text-primary); font-size: 0.85rem;">${client.hostname}</div>
              <span class="text-tertiary text-xs" style="font-size: 0.65rem; text-transform: uppercase;">${client.source}</span>
            </div>
          </td>
          <td style="padding: 14px 16px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">${client.ip}</td>
          <td style="padding: 14px 16px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-tertiary);">${client.mac}</td>
          <td style="padding: 14px 16px; font-size: 0.8rem; color: var(--text-secondary);">${client.connection} ${batStr}</td>
          <td style="padding: 14px 16px; font-size: 0.8rem; color: var(--text-tertiary);">${lastSeenFormatted}</td>
          <td style="padding: 14px 16px;">
            <span class="badge" style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; padding: 3px 10px; border-radius: 100px; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.05em;">
              ${client.status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ── Render Views ────────────────────────────────────────────────

  async renderDashboard(container) {
    await this.loadIphoneTelemetry();
    const iphone = this.iphoneData;
    const tel = iphone.telemetry;
    const loc = tel.location || { latitude: 40.946438, longitude: -72.583206 };
    const bat = tel.battery || { level: 100, state: "Not Charging" };
    const net = tel.network || { ssid: "Venza Car Wi-Fi", connection_type: "Wi-Fi" };
    const esim = tel.esim || { carrier: "Telnyx eSIM (AT&T Roaming)", data_plan_usage_gb: 4.27, data_plan_limit_gb: 10.0 };

    container.innerHTML = `
      <div class="page-title-row anim-fade">
        <div>
          <h2>Tactical Fleet Workspace</h2>
          <p class="text-secondary text-sm">Real-time Toyota Venza metrics & mileage categorization panel.</p>
        </div>
      </div>
      
      <!-- Top level unified 6-card stats panel -->
      <div id="dashboard-stats" class="section-gap"></div>

      <!-- Full-Width Interactive Skeletal Blueprint & Manual Explorer -->
      <div id="schematic-view" class="section-gap anim-slide-delay-1"></div>

      <!-- Bottom Grid Split -->
      <div class="grid-2 anim-slide-delay-2" style="align-items: start;">
        
        <!-- Left: Quick Classify Ledger -->
        <div class="card" id="quick-action-ledger">
          <div class="card-header">
            <h3>Quick Classify Ledger</h3>
            <span class="text-tertiary text-xs">Recent Activities</span>
          </div>
          <div class="card-body" id="quick-ledger-container" style="padding: 0;"></div>
        </div>

        <!-- Right: GPS Telemetry & Mobile Mesh Node Tracker -->
        <div class="card" style="display: flex; flex-direction: column;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: var(--space-3);">
            <h3>GPS Telemetry & Mesh Node</h3>
            <span class="badge badge-success" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-success); border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.65rem;">
              NODE: ${iphone.hostname} ${iphone.mesh_status}
            </span>
          </div>
          <div style="padding: var(--space-4); flex-grow: 1; display: flex; flex-direction: column; gap: var(--space-4);">
            <!-- Real Dynamic Google Map Canvas -->
            <div id="mini-map-canvas" style="background: var(--bg-hover); border: 1px solid var(--border); border-radius: var(--radius-lg); height: 180px; position: relative; overflow: hidden;"></div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);" class="text-mono">
              <div style="background: var(--bg-hover); border: 1px solid var(--border); padding: var(--space-2) var(--space-3); border-radius: var(--radius);">
                <span class="text-tertiary text-xs" style="font-size: 0.6rem;">LATITUDE</span>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
                  ${loc.latitude.toFixed(6)} N
                </div>
              </div>
              <div style="background: var(--bg-hover); border: 1px solid var(--border); padding: var(--space-2) var(--space-3); border-radius: var(--radius);">
                <span class="text-tertiary text-xs" style="font-size: 0.6rem;">LONGITUDE</span>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
                  ${Math.abs(loc.longitude).toFixed(6)} W
                </div>
              </div>
            </div>

            <!-- In-Car Mobile Mesh Network Diagnostics -->
            <div style="border-top: 1px dashed var(--border); padding-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
              <h4 style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 2px;">In-Car eSIM Node Details</h4>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div style="background: var(--bg-hover); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius); display: flex; flex-direction: column; justify-content: space-between;">
                  <span class="text-tertiary" style="font-size: 0.6rem;">SSID / CONNECTION</span>
                  <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                    📶 ${net.ssid}
                  </div>
                </div>
                <div style="background: var(--bg-hover); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius); display: flex; flex-direction: column; justify-content: space-between;">
                  <span class="text-tertiary" style="font-size: 0.6rem;">NODE POWER / IGNITION</span>
                  <div style="font-size: 0.8rem; font-weight: 600; color: ${bat.state.includes('Charging') ? 'var(--accent-success)' : 'var(--text-primary)'}; margin-top: 4px;">
                    🔋 ${bat.level}% (${bat.state.includes('Charging') ? 'Ignition ON' : 'Ignition OFF'})
                  </div>
                </div>
              </div>

              <!-- Data Plan Progress -->
              <div style="background: var(--bg-hover); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.6rem; color: var(--text-tertiary);">
                  <span>TELNYX eSIM DATA PLAN</span>
                  <span style="font-weight: 600; color: var(--text-secondary);">${esim.data_plan_usage_gb} GB / ${esim.data_plan_limit_gb} GB</span>
                </div>
                <!-- Mini Progress Bar -->
                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.1); border-radius: 3px; overflow: hidden; margin-top: 6px;">
                  <div style="width: ${(esim.data_plan_usage_gb / esim.data_plan_limit_gb * 100).toFixed(1)}%; height: 100%; background: var(--accent-business); border-radius: 3px;"></div>
                </div>
              </div>
            </div>
            
            <button class="btn btn-secondary open-full-map-btn" style="width: 100%; height: 34px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              🌐 Load Full Map Canvas
            </button>
          </div>
        </div>

      </div>

      <!-- Sovereign Mesh Client Registry -->
      <div class="card anim-slide-delay-3 section-gap">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-success); box-shadow: 0 0 8px var(--accent-success);"></span>
            <h3>Sovereign Mesh Client Registry</h3>
          </div>
          <span class="text-tertiary text-xs" id="mesh-clients-count">Scanning...</span>
        </div>
        <div class="card-body" style="padding: 0; overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; margin: 0;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="padding: 12px 16px; text-align: left; font-size: 0.75rem; color: var(--text-tertiary);">HOSTNAME / NODE</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 0.75rem; color: var(--text-tertiary);">IP ADDRESS</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 0.75rem; color: var(--text-tertiary);">MAC ADDRESS</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 0.75rem; color: var(--text-tertiary);">CONNECTION MEDIUM</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 0.75rem; color: var(--text-tertiary);">LAST ACTIVE</th>
                <th style="padding: 12px 16px; text-align: left; font-size: 0.75rem; color: var(--text-tertiary);">STATUS</th>
              </tr>
            </thead>
            <tbody id="mesh-clients-tbody">
              <tr>
                <td colspan="6" style="padding: 24px; text-align: center; color: var(--text-tertiary);">
                  Discovered nodes loading...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Render Stats
    const statsContainer = document.getElementById('dashboard-stats');
    this.statsPanel = new StatsPanel(statsContainer);
    await this.statsPanel.init();

    // Render Blueprint
    const schematicContainer = document.getElementById('schematic-view');
    const schematic = new VehicleSchematic(schematicContainer);
    await schematic.init();

    // Render Network Clients Registry
    await this.renderNetworkClients();
    this.dashboardInterval = setInterval(() => {
      this.renderNetworkClients();
    }, 15000);

    // Render Recent trips with Quick action categorizer
    const quickLedgerContainer = document.getElementById('quick-ledger-container');
    const miniLedger = new TripLedger(quickLedgerContainer, (trip) => {
      // If trip selected on quick ledger, go to map view
      this.navigate('map');
      setTimeout(() => {
        if (this.activeComponent && typeof this.activeComponent.selectTrip === 'function') {
          this.activeComponent.selectTrip(trip.trip_id);
        }
      }, 300);
    });
    // Set filter limit to 5 recent trips and load
    miniLedger.filters.limit = 5;
    await miniLedger.init();
    
    this.activeComponent = miniLedger;

    // Attach GPS map click routing
    const mapBtn = container.querySelector('.open-full-map-btn');
    if (mapBtn) {
      mapBtn.addEventListener('click', () => this.navigate('map'));
    }

    // Mount proper Google Map into dashboard mini-canvas
    try {
      await window.__loadGoogleMaps();
      const miniMapCanvas = container.querySelector('#mini-map-canvas');
      if (miniMapCanvas) {
        const miniMap = new google.maps.Map(miniMapCanvas, {
          center: { lat: loc.latitude, lng: loc.longitude }, // live Venza location from iPhone node
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: false,
          styles: [
            { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
            { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
            { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
            { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
            { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
            { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
            { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
            { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
            { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
            { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca3af" }] },
            { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
            { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
            { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
            { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
            { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
            { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
            { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
          ]
        });

        // Add vehicle marker on the dashboard map
        new google.maps.Marker({
          position: { lat: loc.latitude, lng: loc.longitude },
          map: miniMap,
          title: "Venza Position",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: '#3B82F6', // cyan
            fillOpacity: 0.9,
            strokeColor: '#FFFFFF',
            strokeWeight: 1.5
          }
        });
      }
    } catch (err) {
      console.warn('[AutoMesh Dashboard] Failed to load mini Google Map:', err.message);
    }
  }

  async renderTripsPage(container) {
    container.innerHTML = `
      <div class="page-title-row anim-fade">
        <div>
          <h2>Mileage Expense Ledger</h2>
          <p class="text-secondary text-sm">Manage tax year expenses, specify mileage split parameters, and download IRS compliance records.</p>
        </div>
      </div>

      <!-- Unified 6-card Stats context -->
      <div id="ledger-stats" class="section-gap"></div>

      <div id="full-ledger-view" class="anim-slide-delay-1"></div>
    `;

    // Render Stats
    const statsContainer = document.getElementById('ledger-stats');
    this.statsPanel = new StatsPanel(statsContainer);
    await this.statsPanel.init();

    // Render Ledger
    const ledgerContainer = document.getElementById('full-ledger-view');
    const ledger = new TripLedger(ledgerContainer);
    await ledger.init();

    this.activeComponent = ledger;
  }

  async renderMapPage(container) {
    // Map view goes full width/height, with custom body container styling to prevent scrolling
    container.style.maxWidth = '100%';
    container.style.padding = '0';
    
    container.innerHTML = `
      <div id="full-map-view" class="anim-fade" style="height: calc(100vh - 105px);"></div>
    `;

    const mapContainer = document.getElementById('full-map-view');
    const mapView = new MapView(mapContainer);
    await mapView.init();

    this.activeComponent = mapView;
  }

  async renderMaintenancePage(container) {
    container.innerHTML = `
      <div class="page-title-row anim-fade">
        <div>
          <h2>Automotive Maintenance Log</h2>
          <p class="text-secondary text-sm">Track vehicle oil status, tire rotations, cabin filter changes, and operating costs.</p>
        </div>
      </div>

      <div id="maintenance-view" class="section-gap anim-slide-delay-1"></div>
    `;

    const maintContainer = document.getElementById('maintenance-view');
    const log = new MaintenanceLog(maintContainer);
    await log.init();

    this.activeComponent = log;
  }

  async renderFinancialsPage(container) {
    container.innerHTML = `
      <div class="page-title-row anim-fade">
        <div>
          <h2>Corporate Fleet Financials</h2>
          <p class="text-secondary text-sm">Automate IRS driving write-offs, track gasoline asset cash flows, and sync with QuickBooks Online general ledgers.</p>
        </div>
      </div>

      <div id="financials-view" class="section-gap anim-slide-delay-1"></div>
    `;

    const financialsContainer = document.getElementById('financials-view');
    const ledger = new FinancialLedger(financialsContainer);
    await ledger.init();

    this.activeComponent = ledger;
  }
}

// Instantiate and launch app when DOM is fully built
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
