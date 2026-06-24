// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — Header Component
// Nav tabs, live odometer, and system status pill
// ═══════════════════════════════════════════════════════════════

import { fetchLiveTelemetry } from '../lib/api.js';

export class Header {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.currentTab = 'dashboard';
    this.telemetryInterval = null;
    this.state = {
      odometer: 48511.2,
      status: 'optimal',
      statusText: 'Telemetry Active'
    };
  }

  async init() {
    await this.updateTelemetry();
    this.render();
    // Poll telemetry every 10 seconds
    this.telemetryInterval = setInterval(() => this.updateTelemetry(true), 10000);
  }

  destroy() {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
    }
  }

  async updateTelemetry(silent = false) {
    try {
      const data = await fetchLiveTelemetry();
      if (data) {
        const t = data.telemetry || {};
        const rawOdo = t.odometer_km || t.odometer || data.odometer;
        if (rawOdo !== undefined) {
          this.state.odometer = rawOdo;
        }
        
        // Compute status based on tires and fuel
        let isCritical = false;
        let isWarning = false;
        
        const tires = t.tire_pressure_psi || t.tire_pressure || {};
        for (const tire of ['front_left', 'front_right', 'rear_left', 'rear_right', 'fl', 'fr', 'rl', 'rr']) {
          const press = tires[tire];
          if (press && (press < 26 || press > 42)) isCritical = true;
          else if (press && (press < 30 || press > 38)) isWarning = true;
        }

        const fuel = t.fuel_level_percent || t.fuel_level;
        if (fuel !== undefined && fuel < 10) isCritical = true;
        else if (fuel !== undefined && fuel < 20) isWarning = true;

        if (isCritical) {
          this.state.status = 'critical';
          this.state.statusText = 'Attention Required';
        } else if (isWarning) {
          this.state.status = 'warning';
          this.state.statusText = 'System Alert';
        } else {
          this.state.status = 'optimal';
          this.state.statusText = 'Telemetry Active';
        }

        if (silent) {
          // Update DOM directly without full re-render
          const odoEl = this.container.querySelector('.odo-val');
          if (odoEl) odoEl.textContent = this.state.odometer.toLocaleString(undefined, { minimumFractionDigits: 1 });
          
          const dotEl = this.container.querySelector('.status-dot');
          const textEl = this.container.querySelector('.status-text');
          if (dotEl && textEl) {
            dotEl.className = `status-dot ${this.state.status}`;
            textEl.textContent = this.state.statusText;
          }
        }
      }
    } catch (err) {
      console.warn('[AutoMesh Header] Odometer telemetry poll failed:', err.message);
      this.state.status = 'offline';
      this.state.statusText = 'Telemetry Stale';
      if (silent) {
        const dotEl = this.container.querySelector('.status-dot');
        const textEl = this.container.querySelector('.status-text');
        if (dotEl && textEl) {
          dotEl.className = `status-dot offline`;
          textEl.textContent = this.state.statusText;
        }
      }
    }
  }

  setActiveTab(tabId) {
    this.currentTab = tabId;
    const tabs = this.container.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  render() {
    this.container.innerHTML = `
      <header class="app-header">
        <div class="header-top">
          <div class="header-brand">
            <div class="flex items-center gap-2">
              <span style="font-size: 1.5rem;">🚗</span>
              <div>
                <h1>Sovereign AutoMesh</h1>
                <div class="brand-sub">Toyota Venza LE &bull; JTEAAAAH9PJ121928</div>
              </div>
            </div>
          </div>
          <div class="header-meta">
            <div class="status-pill">
              <span class="status-dot ${this.state.status}"></span>
              <span class="status-text">${this.state.statusText}</span>
            </div>
            <div class="odo-display">
              <span class="text-tertiary text-xs text-mono" style="margin-right: 4px;">ODO</span>
              <span class="text-mono odo-val">${this.state.odometer.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
              <span class="text-tertiary text-xs">mi</span>
            </div>
          </div>
        </div>
        <nav class="nav-tabs">
          <button class="nav-tab ${this.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button>
          <button class="nav-tab ${this.currentTab === 'trips' ? 'active' : ''}" data-tab="trips">Trip Ledger</button>
          <button class="nav-tab ${this.currentTab === 'financials' ? 'active' : ''}" data-tab="financials">QuickBooks Sync</button>
          <button class="nav-tab ${this.currentTab === 'map' ? 'active' : ''}" data-tab="map">Interactive Map</button>
          <button class="nav-tab ${this.currentTab === 'maintenance' ? 'active' : ''}" data-tab="maintenance">Maintenance</button>
        </nav>
      </header>
    `;

    // Hook events
    this.container.querySelectorAll('.nav-tab').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        this.setActiveTab(tab);
        this.onNavigate(tab);
      });
    });
  }
}
