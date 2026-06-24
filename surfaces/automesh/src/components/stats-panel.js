// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — Stats Panel Component
// Renders the 6 beautiful minimalist stat cards
// ═══════════════════════════════════════════════════════════════

import { fetchStats } from '../lib/api.js';

export class StatsPanel {
  constructor(container) {
    this.container = container;
    this.stats = null;
    this.isLoading = true;
  }

  async init() {
    this.isLoading = true;
    this.render();
    await this.loadStats();
  }

  async loadStats() {
    try {
      this.stats = await fetchStats();
      this.isLoading = false;
      this.render();
    } catch (err) {
      console.error('[AutoMesh StatsPanel] Failed to load stats:', err);
      this.container.innerHTML = `
        <div class="card" style="grid-column: span 3; padding: var(--space-6); text-align: center; border-color: var(--accent-danger);">
          <div class="text-secondary">Failed to load statistics panel.</div>
          <button class="btn btn-ghost btn-sm mt-3" id="retry-stats-btn">Retry Load</button>
        </div>
      `;
      const btn = this.container.querySelector('#retry-stats-btn');
      if (btn) btn.addEventListener('click', () => this.init());
    }
  }

  render() {
    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="grid-6">
          ${Array(6).fill(0).map(() => `
            <div class="stat-card loading-skeleton" style="height: 104px;"></div>
          `).join('')}
        </div>
      `;
      return;
    }

    const s = this.stats || {
      total_miles: 0,
      business_miles: 0,
      personal_miles: 0,
      unassigned_miles: 0,
      deduction_total: 0,
      trips_this_month: 0,
      avg_trip_distance: 0,
      total_trips: 0,
      irs_rate_per_mile: 0.70
    };

    const bizPct = s.total_miles > 0 ? Math.round((s.business_miles / s.total_miles) * 100) : 0;
    const persPct = s.total_miles > 0 ? Math.round((s.personal_miles / s.total_miles) * 100) : 0;
    const unasPct = s.total_miles > 0 ? Math.round((s.unassigned_miles / s.total_miles) * 100) : 0;

    const unassignedAlert = s.unassigned_miles > 0 
      ? `style="border-color: var(--accent-warning); background: #FFFBEB;"` 
      : '';

    this.container.innerHTML = `
      <div class="grid-6 anim-fade">
        <!-- 1. Total Mileage -->
        <div class="stat-card">
          <div class="stat-value">${s.total_miles.toLocaleString(undefined, { minimumFractionDigits: 1 })}</div>
          <div class="stat-label">Total Miles (2026)</div>
          <div class="text-xs text-secondary mt-1">Avg trip: ${s.avg_trip_distance} mi</div>
        </div>

        <!-- 2. Business Miles -->
        <div class="stat-card accent-business">
          <div class="stat-value">${s.business_miles.toLocaleString(undefined, { minimumFractionDigits: 1 })}</div>
          <div class="stat-label">Business Miles</div>
          <div class="text-xs text-secondary mt-1">${bizPct}% of total</div>
        </div>

        <!-- 3. Personal Miles -->
        <div class="stat-card accent-personal">
          <div class="stat-value">${s.personal_miles.toLocaleString(undefined, { minimumFractionDigits: 1 })}</div>
          <div class="stat-label">Personal Miles</div>
          <div class="text-xs text-secondary mt-1">${persPct}% of total</div>
        </div>

        <!-- 4. Unassigned Miles -->
        <div class="stat-card" ${unassignedAlert}>
          <div class="stat-value ${s.unassigned_miles > 0 ? 'text-warning' : 'text-tertiary'}">
            ${s.unassigned_miles.toLocaleString(undefined, { minimumFractionDigits: 1 })}
          </div>
          <div class="stat-label">Unassigned Miles</div>
          <div class="text-xs ${s.unassigned_miles > 0 ? 'text-warning' : 'text-tertiary'} mt-1">
            ${s.unassigned_miles > 0 ? `Action required (${unasPct}%)` : 'All classified!'}
          </div>
        </div>

        <!-- 5. Tax Deduction -->
        <div class="stat-card accent-success">
          <div class="stat-value">$${s.deduction_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div class="stat-label">IRS Deduction</div>
          <div class="text-xs text-secondary mt-1">Rate: $${s.irs_rate_per_mile.toFixed(2)}/mi</div>
        </div>

        <!-- 6. Volume Dynamics -->
        <div class="stat-card">
          <div class="stat-value">${s.trips_this_month}</div>
          <div class="stat-label">Trips This Month</div>
          <div class="text-xs text-secondary mt-1">${s.total_trips} total trips YTD</div>
        </div>
      </div>
    `;
  }
}
