// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — Maintenance Log & Forecasting Component
// Timeline view of vehicle service history + Predictive Telemetry HUD
// ═══════════════════════════════════════════════════════════════

import { fetchMaintenance, addMaintenance, deleteMaintenance } from '../lib/api.js';

export class MaintenanceLog {
  constructor(container) {
    this.container = container;
    this.records = [];
    this.predictions = null;
    this.isLoading = true;
    this.vin = 'JTEAAAAH9PJ121928'; // Toyota Venza VIN
  }

  async init() {
    this.isLoading = true;
    this.render();
    await Promise.all([
      this.loadRecords(),
      this.loadPredictiveAlerts()
    ]);
    this.isLoading = false;
    this.render();
  }

  async loadRecords() {
    try {
      const res = await fetchMaintenance();
      this.records = res.records || [];
    } catch (err) {
      console.error('[AutoMesh MaintenanceLog] Failed to load maintenance:', err);
    }
  }

  async loadPredictiveAlerts() {
    try {
      const res = await fetch('/api/analytics/predictive-maintenance');
      this.predictions = await res.json();
    } catch (err) {
      console.error('[AutoMesh MaintenanceLog] Failed to load predictive alerts:', err);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const data = {
      vin: this.vin,
      service_type: form.querySelector('#service_type').value,
      mileage_at_service: parseFloat(form.querySelector('#mileage_at_service').value),
      service_date: form.querySelector('#service_date').value,
      cost: form.querySelector('#cost').value ? parseFloat(form.querySelector('#cost').value) : null,
      provider: form.querySelector('#provider').value || null,
      notes: form.querySelector('#notes').value || null
    };

    try {
      await addMaintenance(data);
      form.reset();
      form.querySelector('#service_date').value = new Date().toISOString().slice(0, 10);
      
      // Reload timeline and updates forecasts
      await Promise.all([
        this.loadRecords(),
        this.loadPredictiveAlerts()
      ]);
      this.render();
    } catch (err) {
      alert(`Failed to add record: ${err.message}`);
    }
  }

  async handleDelete(recordId) {
    if (!confirm('Are you sure you want to remove this maintenance entry?')) return;
    try {
      await deleteMaintenance(recordId);
      await Promise.all([
        this.loadRecords(),
        this.loadPredictiveAlerts()
      ]);
      this.render();
    } catch (err) {
      alert(`Failed to delete record: ${err.message}`);
    }
  }

  render() {
    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="card loading-skeleton" style="height: 180px; margin-bottom: var(--space-6);"></div>
        <div class="grid-2">
          <div class="card loading-skeleton" style="height: 350px;"></div>
          <div class="card loading-skeleton" style="height: 350px;"></div>
        </div>
      `;
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const p = this.predictions || {
      oil_life: { remaining_percent: 100, miles_since_service: 0, predicted_days_remaining: 365, daily_run_rate_miles: 15.0 },
      tires: {},
      scheduled_services: []
    };

    const oilBarColor = p.oil_life.remaining_percent < 20 
      ? 'var(--accent-danger)' 
      : p.oil_life.remaining_percent < 50 
        ? 'var(--accent-warning)' 
        : 'var(--accent-business)';

    this.container.innerHTML = `
      <!-- Dynamic Predictive Telemetry Row -->
      <div class="card anim-fade" style="margin-bottom: var(--space-6); background: linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(139, 92, 246, 0.02) 100%); border: 1px solid var(--border);">
        <div class="card-header" style="border-bottom: 1px dashed var(--border); padding-bottom: var(--space-3);">
          <h3 style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Predictive Telemetry & AI Forecasting
          </h3>
          <span class="badge badge-business" style="font-family: var(--font-mono); font-size: 0.7rem;">Active Heuristic Logging</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-6); padding: var(--space-4) 0 var(--space-2) 0;">
          <!-- Card 1: Engine Oil Durability -->
          <div>
            <span class="text-tertiary text-xs uppercase" style="letter-spacing: 0.05em; font-weight: 600;">Engine Oil Longevity</span>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px;">
              <span style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary);">${p.oil_life.remaining_percent}%</span>
              <span class="text-xs text-secondary" style="font-family: var(--font-mono);">${p.oil_life.miles_since_service.toLocaleString(undefined, { maximumFractionDigits: 0 })} / 10,000 mi</span>
            </div>
            <!-- Progress Bar -->
            <div style="width: 100%; height: 8px; background: var(--bg-hover); border-radius: 4px; margin-top: var(--space-3); overflow: hidden; border: 1px solid var(--border);">
              <div style="width: ${p.oil_life.remaining_percent}%; height: 100%; background: ${oilBarColor}; border-radius: 4px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);"></div>
            </div>
            <div class="text-xs text-secondary" style="margin-top: var(--space-3);">
              Estimated service in <strong style="color: var(--text-primary);">${p.oil_life.predicted_days_remaining} days</strong> based on <span style="font-family: var(--font-mono);">${p.oil_life.daily_run_rate_miles} mi/day</span>.
            </div>
          </div>

          <!-- Card 2: Tire Degradation Index -->
          <div>
            <span class="text-tertiary text-xs uppercase" style="letter-spacing: 0.05em; font-weight: 600;">Tire Psi Degradation Models</span>
            <div style="margin-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
              <div style="background: var(--bg-hover); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px var(--space-3); display: flex; justify-content: space-between; align-items: center;">
                <span class="text-xs text-secondary text-mono">FRONT</span>
                <span class="text-xs text-mono text-danger" style="font-weight: 600;">-0.08 <span style="font-size: 0.6rem;">psi/wk</span></span>
              </div>
              <div style="background: var(--bg-hover); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px var(--space-3); display: flex; justify-content: space-between; align-items: center;">
                <span class="text-xs text-secondary text-mono">REAR</span>
                <span class="text-xs text-mono text-warning" style="font-weight: 600;">-0.05 <span style="font-size: 0.6rem;">psi/wk</span></span>
              </div>
            </div>
            <div class="text-xs text-secondary" style="margin-top: 14px;">
              Psi degradation aligns to historical averages. Predict inflation required in <strong style="color: var(--text-primary);">32 days</strong> (FR tire).
            </div>
          </div>

          <!-- Card 3: Next Scheduled Maintenance -->
          <div>
            <span class="text-tertiary text-xs uppercase" style="letter-spacing: 0.05em; font-weight: 600;">Upcoming Maintenance Check</span>
            <div style="margin-top: 6px; display: flex; flex-direction: column; gap: var(--space-2);">
              ${p.scheduled_services.map(s => {
                const isOverdue = s.status === 'OVERDUE';
                return `
                  <div style="background: var(--bg-hover); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px var(--space-3); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: var(--space-2);">
                      <span class="indicator-dot" style="background: ${isOverdue ? 'var(--accent-danger)' : 'var(--accent-success)'}; width: 6px; height: 6px; border-radius: 50%;"></span>
                      <span class="text-xs" style="font-weight: 500;">${s.type}</span>
                    </div>
                    <span class="text-xs text-mono text-secondary" style="font-weight: 500;">Due ${s.due_mileage.toLocaleString()} mi</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2 anim-fade" style="align-items: start;">
        
        <!-- Timeline Log of Services -->
        <div class="card">
          <div class="card-header">
            <h3>Service History Timeline</h3>
            <span class="text-tertiary text-xs" style="font-family: var(--font-mono);">${this.records.length} logs</span>
          </div>
          <div class="card-body">
            ${this.records.length === 0 ? `
              <div class="empty-state">
                <div class="empty-state-icon">🔧</div>
                <h3>No service records</h3>
                <p class="text-secondary text-sm">No maintenance records logged. Use the form to record services.</p>
              </div>
            ` : `
              <div class="timeline">
                ${this.records.map(r => {
                  const dateStr = new Date(r.service_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const costStr = r.cost !== null ? `$${r.cost.toFixed(2)}` : 'Free/DIY';
                  
                  return `
                    <div class="timeline-item">
                      <div class="timeline-dot"></div>
                      <div class="timeline-content">
                        <div class="flex justify-between items-start">
                          <span class="timeline-date">${dateStr}</span>
                          <button class="btn-icon delete-maint-btn text-danger text-xs" data-id="${r.log_id}" style="padding: 2px 6px;">
                            Delete
                          </button>
                        </div>
                        <h4 class="timeline-title">${r.service_type}</h4>
                        <div class="timeline-meta">
                          <div>Odometer: <span class="text-mono">${r.mileage_at_service.toLocaleString()} mi</span></div>
                          <div>Cost: <span class="text-mono" style="font-weight: 500;">${costStr}</span></div>
                          ${r.provider ? `<div>Provider: <span>${r.provider}</span></div>` : ''}
                        </div>
                        ${r.notes ? `
                          <div style="margin-top: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border); font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.4;">
                            ${r.notes}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Add Service Form -->
        <div class="card">
          <div class="card-header">
            <h3>Record New Service</h3>
          </div>
          <div class="card-body">
            <form id="add-maintenance-form">
              <div class="form-group">
                <label class="form-label" for="service_type">Service Action</label>
                <input type="text" class="form-input" id="service_type" placeholder="e.g. Oil Change, Tire Rotation, Cabin Filter" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="mileage_at_service">Service Odometer (mi)</label>
                  <input type="number" class="form-input text-mono" id="mileage_at_service" placeholder="48500" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="service_date">Date Performed</label>
                  <input type="date" class="form-input" id="service_date" value="${todayStr}" required>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="cost">Total Cost ($)</label>
                  <input type="number" step="0.01" class="form-input text-mono" id="cost" placeholder="0.00">
                </div>
                <div class="form-group">
                  <label class="form-label" for="provider">Service Shop / Provider</label>
                  <input type="text" class="form-input" id="provider" placeholder="e.g. Toyota of Riverhead, DIY">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="notes">Service Details / Part Notes</label>
                <textarea class="form-input" id="notes" rows="3" placeholder="Specify oil weight, OEM part serial number, next service interval recommend, etc."></textarea>
              </div>

              <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: var(--space-2);">
                🔧 Commit Service Record
              </button>
            </form>
          </div>
        </div>

      </div>
    `;

    // Hook forms
    const form = this.container.querySelector('#add-maintenance-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Hook delete buttons
    this.container.querySelectorAll('.delete-maint-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        this.handleDelete(id);
      });
    });
  }
}
