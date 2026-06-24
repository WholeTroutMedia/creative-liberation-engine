// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — Trip Ledger Component
// Data table and expandable card view for mileage ledger
// ═══════════════════════════════════════════════════════════════

import { fetchTrips, updateTrip, exportCSV } from '../lib/api.js';

export class TripLedger {
  constructor(container, onTripSelected) {
    this.container = container;
    this.onTripSelected = onTripSelected;
    this.trips = [];
    this.total = 0;
    this.filters = {
      category: '',
      startDate: '',
      endDate: '',
      limit: 50,
      offset: 0
    };
    this.isLoading = true;
    this.expandedTripId = null;
  }

  async init() {
    this.isLoading = true;
    this.render();
    await this.loadTrips();
  }

  async loadTrips() {
    try {
      this.isLoading = true;
      const res = await fetchTrips(this.filters);
      this.trips = res.trips || [];
      this.total = res.total || 0;
      this.isLoading = false;
      this.render();
    } catch (err) {
      console.error('[AutoMesh TripLedger] Failed to load trips:', err);
      this.container.innerHTML = `
        <div class="card" style="padding: var(--space-8); text-align: center; border-color: var(--accent-danger);">
          <div class="text-secondary">Failed to load mileage ledger.</div>
          <button class="btn btn-ghost mt-3" id="retry-ledger-btn">Retry Load</button>
        </div>
      `;
      const btn = this.container.querySelector('#retry-ledger-btn');
      if (btn) btn.addEventListener('click', () => this.init());
    }
  }

  async handleCategorize(tripId, category, businessPercentage = 100) {
    try {
      await updateTrip(tripId, { category, business_percentage: businessPercentage });
      
      // Update local state and trigger re-render
      const trip = this.trips.find(t => t.trip_id === tripId);
      if (trip) {
        trip.category = category;
        trip.business_percentage = businessPercentage;
        
        // Re-calculate deduction in local state
        const dist = trip.distance_miles || 0;
        const rate = 0.70; // 2026 standard
        if (category === 'BUSINESS') {
          trip.deduction = Math.round(dist * rate * (businessPercentage / 100) * 100) / 100;
        } else {
          trip.deduction = 0.0;
        }
      }
      
      this.render();
      
      // Fire global custom event to trigger stats panel updates!
      window.dispatchEvent(new CustomEvent('automesh-data-updated'));
    } catch (err) {
      alert(`Failed to update trip: ${err.message}`);
    }
  }

  async handleSaveNotes(tripId, notes) {
    try {
      await updateTrip(tripId, { notes });
      const trip = this.trips.find(t => t.trip_id === tripId);
      if (trip) trip.notes = notes;
      this.render();
    } catch (err) {
      alert(`Failed to save notes: ${err.message}`);
    }
  }

  toggleExpand(tripId) {
    this.expandedTripId = this.expandedTripId === tripId ? null : tripId;
    this.render();
    
    // Notify map listener if trip is selected
    if (this.expandedTripId && this.onTripSelected) {
      const trip = this.trips.find(t => t.trip_id === this.expandedTripId);
      if (trip) this.onTripSelected(trip);
    }
  }

  render() {
    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="card" style="padding: var(--space-8);">
          <div class="loading-skeleton" style="height: 40px; margin-bottom: var(--space-4);"></div>
          <div class="loading-skeleton" style="height: 250px;"></div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="card anim-fade">
        <div class="card-header" style="border-bottom: none; padding-bottom: 0;">
          <div>
            <h3>Mileage & Expense Ledger</h3>
            <span class="text-tertiary text-xs">${this.total} total trips recorded</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" id="export-csv-btn">
              <span>📥</span> Export IRS CSV
            </button>
          </div>
        </div>

        <!-- Inline Filters -->
        <div style="padding: 0 var(--space-6) var(--space-2); border-bottom: 1px solid var(--border);">
          <div class="filter-bar">
            <button class="btn btn-ghost btn-sm ${this.filters.category === '' ? 'active' : ''}" data-cat="">All</button>
            <button class="btn btn-ghost btn-sm ${this.filters.category === 'BUSINESS' ? 'active' : ''}" data-cat="BUSINESS">Business</button>
            <button class="btn btn-ghost btn-sm ${this.filters.category === 'PERSONAL' ? 'active' : ''}" data-cat="PERSONAL">Personal</button>
            <button class="btn btn-ghost btn-sm ${this.filters.category === 'UNASSIGNED' ? 'active' : ''}" data-cat="UNASSIGNED">Unassigned</button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 140px;">Date & Time</th>
                <th>Route (Start → End)</th>
                <th style="text-align: right; width: 100px;">Distance</th>
                <th style="text-align: right; width: 100px;">Odometer</th>
                <th style="width: 130px;">Classification</th>
                <th style="text-align: right; width: 110px;">IRS Deduction</th>
              </tr>
            </thead>
            <tbody>
              ${this.trips.length === 0 ? `
                <tr>
                  <td colspan="6">
                    <div class="empty-state">
                      <div class="empty-state-icon">📁</div>
                      <h3>No trips found</h3>
                      <p class="text-secondary text-sm">No recorded vehicle trips match your current filters.</p>
                    </div>
                  </td>
                </tr>
              ` : this.trips.map(t => {
                const isExpanded = this.expandedTripId === t.trip_id;
                const formattedDate = new Date(t.end_time).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                let badgeClass = 'badge-unassigned';
                if (t.category === 'BUSINESS') {
                  badgeClass = t.business_percentage < 100 ? 'badge-split' : 'badge-business';
                } else if (t.category === 'PERSONAL') {
                  badgeClass = 'badge-personal';
                }

                const displayDeduction = t.category === 'BUSINESS' && t.deduction !== null
                  ? `$${t.deduction.toFixed(2)}`
                  : '—';

                return `
                  <tr class="ledger-row" data-id="${t.trip_id}" style="cursor: pointer;">
                    <td class="text-mono text-sm">${formattedDate}</td>
                    <td>
                      <div style="font-weight: 500;">
                        ${t.start_address ? t.start_address.split(',')[0] : 'Start Location'}
                        <span class="text-tertiary" style="margin: 0 var(--space-1); font-size: 0.8rem;">→</span>
                        ${t.end_address ? t.end_address.split(',')[0] : 'End Location'}
                      </div>
                      <div class="text-xs text-secondary truncate" style="max-width: 320px;">
                        ${t.notes || '<span class="text-tertiary italic">No notes recorded. Click row to edit.</span>'}
                      </div>
                    </td>
                    <td style="text-align: right;" class="text-mono font-weight-600">
                      ${t.distance_miles.toFixed(1)} <span class="text-tertiary text-xs">mi</span>
                    </td>
                    <td style="text-align: right;" class="text-mono text-secondary text-sm">
                      ${t.start_odo.toFixed(0)} - ${t.end_odo.toFixed(0)}
                    </td>
                    <td>
                      <span class="badge ${badgeClass}">
                        ${t.category === 'BUSINESS' && t.business_percentage < 100 ? `SPLIT ${t.business_percentage}%` : t.category}
                      </span>
                    </td>
                    <td style="text-align: right;" class="text-mono text-success font-weight-600">
                      ${displayDeduction}
                    </td>
                  </tr>
                  
                  <!-- Expandable control block -->
                  <tr class="expand-row" data-id="${t.trip_id}" style="display: ${isExpanded ? 'table-row' : 'none'}; background: var(--bg-primary);">
                    <td colspan="6" style="padding: var(--space-4) var(--space-6); border-top: none;">
                      <div class="grid-2 anim-slide" style="gap: var(--space-6);">
                        
                        <!-- Categorization interface -->
                        <div>
                          <span class="form-label">Assign Category</span>
                          <div class="quick-buttons">
                            <button class="btn btn-ghost btn-sm ${t.category === 'BUSINESS' && t.business_percentage === 100 ? 'active' : ''}" 
                                    id="btn-biz-100-${t.trip_id}">
                              💼 Business (100%)
                            </button>
                            <button class="btn btn-ghost btn-sm ${t.category === 'PERSONAL' ? 'active' : ''}" 
                                    id="btn-pers-${t.trip_id}">
                              👤 Personal
                            </button>
                            <button class="btn btn-ghost btn-sm ${t.category === 'BUSINESS' && t.business_percentage < 100 ? 'active' : ''}" 
                                    id="btn-split-${t.trip_id}">
                              🔀 Custom Split
                            </button>
                          </div>
                          
                          <!-- Slider for split -->
                          <div id="split-slider-container-${t.trip_id}" style="display: ${t.category === 'BUSINESS' && t.business_percentage < 100 ? 'block' : 'none'}; margin-top: var(--space-3);">
                            <div class="flex justify-between items-center text-xs text-secondary">
                              <span>Personal Allocation: ${100 - t.business_percentage}%</span>
                              <span class="text-business" style="font-weight: 600;">Business Allocation: ${t.business_percentage}%</span>
                            </div>
                            <input type="range" class="split-slider" id="slider-${t.trip_id}" min="0" max="100" step="5" value="${t.business_percentage}">
                          </div>
                        </div>

                        <!-- Notes and detailed coordinates -->
                        <div>
                          <div class="form-group">
                            <label class="form-label" for="notes-${t.trip_id}">Trip Purpose / IRS Notes</label>
                            <div class="flex gap-2">
                              <input type="text" class="form-input" id="notes-${t.trip_id}" value="${t.notes || ''}" placeholder="e.g. Meeting with studio partner...">
                              <button class="btn btn-primary btn-sm" id="btn-save-notes-${t.trip_id}">Save</button>
                            </div>
                          </div>
                          <div class="text-xs text-secondary flex gap-4 mt-2">
                            <span><strong>Start address:</strong> ${t.start_address || 'Unavailable'}</span>
                            <span><strong>End address:</strong> ${t.end_address || 'Unavailable'}</span>
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Hook filter tabs
    this.container.querySelectorAll('.filter-bar button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.filters.category = btn.dataset.cat;
        this.filters.offset = 0;
        this.init();
      });
    });

    // Hook row click to expand
    this.container.querySelectorAll('.ledger-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = parseInt(row.dataset.id, 10);
        this.toggleExpand(id);
      });
    });

    // Hook inline buttons for expanded row
    if (this.expandedTripId) {
      const tripId = this.expandedTripId;
      const trip = this.trips.find(t => t.trip_id === tripId);
      
      const btnBiz = this.container.querySelector(`#btn-biz-100-${tripId}`);
      const btnPers = this.container.querySelector(`#btn-pers-${tripId}`);
      const btnSplit = this.container.querySelector(`#btn-split-${tripId}`);
      const slider = this.container.querySelector(`#slider-${tripId}`);
      const notesInput = this.container.querySelector(`#notes-${tripId}`);
      const btnSaveNotes = this.container.querySelector(`#btn-save-notes-${tripId}`);

      if (btnBiz) btnBiz.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCategorize(tripId, 'BUSINESS', 100);
      });

      if (btnPers) btnPers.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCategorize(tripId, 'PERSONAL', 0);
      });

      if (btnSplit) btnSplit.addEventListener('click', (e) => {
        e.stopPropagation();
        const sliderContainer = this.container.querySelector(`#split-slider-container-${tripId}`);
        if (sliderContainer) {
          sliderContainer.style.display = 'block';
          this.handleCategorize(tripId, 'BUSINESS', 70); // Default split 70%
        }
      });

      if (slider) {
        slider.addEventListener('change', (e) => {
          this.handleCategorize(tripId, 'BUSINESS', parseInt(e.target.value, 10));
        });
      }

      if (btnSaveNotes && notesInput) {
        btnSaveNotes.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleSaveNotes(tripId, notesInput.value);
        });
      }
    }

    // Hook Export CSV
    const exportBtn = this.container.querySelector('#export-csv-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportCSV(this.filters);
      });
    }
  }
}
