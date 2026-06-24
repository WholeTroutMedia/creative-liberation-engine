// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — Enterprise Financial Ledger
// Direct QuickBooks sync control panel, expenses, and TCO tracking.
// ═══════════════════════════════════════════════════════════════

export class FinancialLedger {
  constructor(container) {
    this.container = container;
    this.trips = [];
    this.tco = null;
    this.qbConfig = null;
    this.isLoading = true;
  }

  async init() {
    this.isLoading = true;
    this.render();
    await Promise.all([
      this.loadTrips(),
      this.loadTCO(),
      this.loadQBConfig()
    ]);
    this.isLoading = false;
    this.render();
  }

  async loadTrips() {
    try {
      const res = await fetch('/api/trips?limit=20');
      const data = await res.json();
      this.trips = data.trips || [];
    } catch (err) {
      console.error('[AutoMesh FinancialLedger] Trips fetch failed:', err);
    }
  }

  async loadTCO() {
    try {
      const res = await fetch('/api/analytics/tco');
      this.tco = await res.json();
    } catch (err) {
      console.error('[AutoMesh FinancialLedger] TCO fetch failed:', err);
    }
  }

  async loadQBConfig() {
    try {
      const res = await fetch('/api/integration/quickbooks/config');
      this.qbConfig = await res.json();
    } catch (err) {
      console.error('[AutoMesh FinancialLedger] QB config fetch failed:', err);
    }
  }

  async syncToQB(tripId, btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = `<span class="spinner"></span> Syncing...`;
    
    try {
      const res = await fetch(`/api/integration/quickbooks/sync/trip/${tripId}`, {
        method: 'POST'
      });
      const result = await res.json();
      
      if (result.status === 'success') {
        btnElement.className = 'btn-success btn-xs';
        btnElement.innerHTML = `<i class="check-icon">✓</i> Synced`;
        
        // Show high-fidelity status notification bubble
        const qbTxnId = result.transaction_id;
        const notification = document.createElement('div');
        notification.className = 'qb-toast anim-fade';
        notification.innerHTML = `
          <strong>QuickBooks Automated Sync</strong>
          <div style="font-size: 0.75rem;">Journal Entry created: <code>${qbTxnId}</code></div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
        
        // Update local status
        const tripIdx = this.trips.findIndex(t => t.trip_id === tripId);
        if (tripIdx !== -1) {
          this.trips[tripIdx].exported_qb = 1;
          this.trips[tripIdx].qb_transaction_id = qbTxnId;
        }
      } else {
        btnElement.disabled = false;
        btnElement.innerHTML = `Failed`;
      }
    } catch (err) {
      console.error('[AutoMesh FinancialLedger] Sync to QuickBooks failed:', err);
      btnElement.disabled = false;
      btnElement.innerHTML = `Error`;
    }
  }

  async saveQBConfig(mileageAcc, bankAcc) {
    try {
      await fetch('/api/integration/quickbooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_mileage_account: mileageAcc,
          default_bank_account: bankAcc
        })
      });
      await this.loadQBConfig();
      
      const statusPill = this.container.querySelector('.qb-config-status');
      statusPill.textContent = 'Settings Saved';
      statusPill.style.color = 'var(--accent-success)';
      setTimeout(() => {
        statusPill.textContent = '';
      }, 2000);
    } catch (err) {
      console.error('[AutoMesh FinancialLedger] Save QB config failed:', err);
    }
  }

  render() {
    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="card" style="height: 420px; display: flex; align-items: center; justify-content: center;">
          <div class="loading-skeleton" style="width: 90%; height: 85%; border-radius: var(--radius-lg);"></div>
        </div>
      `;
      return;
    }

    const tco = this.tco || {
      cash_outflow: { fuel: 0, maintenance: 0, incidental_expenses: 0, total: 0 },
      non_cash_expenses: { depreciation_annual: 0 },
      total_cost_of_ownership: 0,
      corporate_tax_savings: 0
    };

    const config = this.qbConfig || {
      default_mileage_account: '60000 Travel & Entertainment',
      default_bank_account: '10000 Checking'
    };

    this.container.innerHTML = `
      <div class="financial-grid anim-fade" style="display: grid; grid-template-columns: 1fr 340px; gap: var(--space-6);">
        <!-- Main Ledger Section -->
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3>Corporate Expense & QuickBooks Reconciliation</h3>
              <p class="text-xs text-secondary" style="margin-top: 4px;">Track mileage tax write-offs, log incidental trip costs, and reconcile directly to your QuickBooks general ledger.</p>
            </div>
            <a href="/api/integration/quickbooks/export/iif" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Download .IIF File
            </a>
          </div>
          
          <div style="overflow-x: auto; margin-top: var(--space-4);">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Route / Purpose</th>
                  <th>Deduction</th>
                  <th style="width: 130px;">Incidental Tolls</th>
                  <th style="width: 160px; text-align: center;">QuickBooks Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.trips.map(t => {
                  const dateStr = t.end_time.substring(5, 10) + ' ' + t.end_time.substring(11, 16);
                  const isBiz = t.category === 'BUSINESS';
                  const mileageDeduction = isBiz ? (t.distance_miles * 0.70 * (t.business_percentage / 100)).toFixed(2) : '0.00';
                  
                  return `
                    <tr style="height: 60px;">
                      <td>
                        <span style="font-weight: 500;">${dateStr}</span>
                        <div class="text-xs text-secondary">${t.distance_miles.toFixed(1)} mi</div>
                      </td>
                      <td>
                        <div style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">
                          ${t.start_address.split(',')[0]} → ${t.end_address.split(',')[0]}
                        </div>
                        <div class="text-xs text-secondary">${t.notes || 'No description'}</div>
                      </td>
                      <td>
                        <span class="${isBiz ? 'text-success' : 'text-tertiary'}" style="font-weight: 600;">
                          $${mileageDeduction}
                        </span>
                        <div class="text-xs text-secondary" style="font-size: 0.65rem;">${isBiz ? `${t.business_percentage}% Biz` : 'Personal'}</div>
                      </td>
                      <td>
                        <div class="input-group" style="display: flex; align-items: center; background: var(--bg-hover); border-radius: var(--radius); border: 1px solid var(--border); padding: 2px 6px;">
                          <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-right: 2px;">$</span>
                          <input type="number" step="0.25" class="exp-input" data-trip-id="${t.trip_id}" value="${t.other_expenses || 0.00}" style="width: 60px; border: none; background: transparent; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-primary); outline: none;" />
                        </div>
                      </td>
                      <td style="text-align: center;">
                        ${t.exported_qb 
                          ? `<span class="badge badge-success" style="font-size: 0.7rem; font-family: var(--font-mono);" title="Txn ID: ${t.qb_transaction_id}">✓ Synced</span>`
                          : isBiz 
                            ? `<button class="btn btn-primary btn-xs qb-sync-btn" data-trip-id="${t.trip_id}">Sync to QB</button>`
                            : `<span class="text-tertiary text-xs">—</span>`
                        }
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Sidebar Section with Configs & Total TCO Cards -->
        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          <!-- TCO Analytics Card -->
          <div class="card" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(59, 130, 246, 0.02) 100%);">
            <h3>Year TCO Summary</h3>
            <div style="margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
              <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div class="text-xs text-tertiary">YTD WRITE-OFF VALUE</div>
                  <div class="text-lg text-success" style="font-weight: 700; margin-top: 2px;">$${tco.corporate_tax_savings.toFixed(2)}</div>
                </div>
                <div style="padding: 6px; border-radius: 50%; background: rgba(5, 150, 105, 0.1); color: var(--accent-success);">
                  <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3);">
                  <div class="text-xs text-tertiary">ANNUAL DEPR.</div>
                  <div style="font-size: 1.05rem; font-weight: 600; margin-top: 2px; color: var(--text-primary); font-family: var(--font-mono);">$${tco.non_cash_expenses.depreciation_annual.toFixed(2)}</div>
                </div>
                <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3);">
                  <div class="text-xs text-tertiary">OPERATING OUTFLOW</div>
                  <div style="font-size: 1.05rem; font-weight: 600; margin-top: 2px; color: var(--text-primary); font-family: var(--font-mono);">$${tco.cash_outflow.total.toFixed(2)}</div>
                </div>
              </div>

              <div style="border-top: 1px dashed var(--border); padding-top: var(--space-3); display: flex; justify-content: space-between; align-items: center;">
                <span class="text-xs text-secondary" style="font-weight: 600;">ESTIMATED YTD TCO</span>
                <span style="font-size: 1.15rem; font-weight: 700; color: var(--accent-business); font-family: var(--font-mono);">$${tco.total_cost_of_ownership.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <!-- QuickBooks Ledger Configurations -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3>QuickBooks Accounts</h3>
              <span class="qb-config-status" style="font-size: 0.7rem; font-weight: 600;"></span>
            </div>
            <div style="margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
              <div>
                <label class="form-label" style="font-size: 0.7rem; color: var(--text-tertiary); margin-bottom: 4px; display: block;">TRAVEL DEBIT GL ACCOUNT</label>
                <input type="text" class="form-input qb-mileage-acc" value="${config.default_mileage_account}" style="font-size: 0.8rem; font-family: var(--font-mono); height: 32px;" />
              </div>
              <div>
                <label class="form-label" style="font-size: 0.7rem; color: var(--text-tertiary); margin-bottom: 4px; display: block;">BANK CREDIT GL ACCOUNT</label>
                <input type="text" class="form-input qb-bank-acc" value="${config.default_bank_account}" style="font-size: 0.8rem; font-family: var(--font-mono); height: 32px;" />
              </div>
              <button class="btn btn-secondary btn-xs save-qb-cfg-btn" style="margin-top: 4px; height: 30px; font-weight: 600;">Update Account Mapping</button>
            </div>
          </div>

          <!-- Google Sheets Integration Card -->
          <div class="card" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(5, 150, 105, 0.01) 100%); border-color: rgba(16, 185, 129, 0.15);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3>Google Sheets Mileage Page</h3>
              <span class="badge badge-success" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-success); font-size: 0.65rem; border: 1px solid rgba(16, 185, 129, 0.2);">LIVE CONNECTED</span>
            </div>
            <p class="text-xs text-secondary" style="margin-top: 6px;">Bidirectional sync enables trip classification (WORK / PERSONAL) directly inside Google Sheets.</p>
            <div style="margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
              <a href="https://docs.google.com/spreadsheets/d/1S309ogUDTbFkZKMWpdFI2ABd5iaerHF8AtG_zq0b-Dg/edit#gid=0" target="_blank" class="btn btn-secondary btn-xs" style="width: 100%; height: 32px; font-weight: 600; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                Open Google Sheet
              </a>
              <button class="btn btn-primary btn-xs sheets-sync-btn" style="width: 100%; height: 32px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; background: #10B981; border-color: #10B981;">
                🔄 Sync Sheets Now
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    // 1. Sync button triggers
    this.container.querySelectorAll('.qb-sync-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tripId = parseInt(btn.getAttribute('data-trip-id'));
        this.syncToQB(tripId, btn);
      });
    });

    // 2. Save QuickBooks configuration settings
    const saveBtn = this.container.querySelector('.save-qb-cfg-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const mileageAcc = this.container.querySelector('.qb-mileage-acc').value;
        const bankAcc = this.container.querySelector('.qb-bank-acc').value;
        this.saveQBConfig(mileageAcc, bankAcc);
      });
    }

    // 3. Save incidental costs when edited
    this.container.querySelectorAll('.exp-input').forEach(input => {
      input.addEventListener('change', async () => {
        const tripId = parseInt(input.getAttribute('data-trip-id'));
        const expVal = parseFloat(input.value) || 0.0;
        
        try {
          await fetch(`/api/trips/${tripId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ other_expenses: expVal })
          });
          // Silent refresh of TCO analytics in the background
          await this.loadTCO();
          // Update local display values
          const taxVal = this.tco?.cash_outflow?.total || 0.0;
          const depVal = this.tco?.total_cost_of_ownership || 0.0;
          
          const cashValEl = this.container.querySelectorAll('.text-mono')[1];
          const tcoValEl = this.container.querySelectorAll('.text-mono')[2];
          
          if (cashValEl) cashValEl.textContent = `$${taxVal.toFixed(2)}`;
          if (tcoValEl) tcoValEl.textContent = `$${depVal.toFixed(2)}`;
        } catch (err) {
          console.error('[AutoMesh FinancialLedger] Save incidental expense failed:', err);
        }
      });
    });

    // 4. Google Sheets manual sync trigger
    const sheetsSyncBtn = this.container.querySelector('.sheets-sync-btn');
    if (sheetsSyncBtn) {
      sheetsSyncBtn.addEventListener('click', async () => {
        sheetsSyncBtn.disabled = true;
        sheetsSyncBtn.innerHTML = `<span class="spinner"></span> Syncing...`;
        
        try {
          const res = await fetch('/api/integration/sheets/sync', { method: 'POST' });
          const result = await res.json();
          
          if (result.status === 'success') {
            sheetsSyncBtn.disabled = false;
            sheetsSyncBtn.innerHTML = `✓ Synced`;
            
            // Reload trips and TCO in background
            await Promise.all([
              this.loadTrips(),
              this.loadTCO()
            ]);
            this.render();
            
            // Show high-fidelity status notification bubble
            const notification = document.createElement('div');
            notification.className = 'qb-toast anim-fade';
            notification.style.background = '#10B981';
            notification.innerHTML = `
              <strong>Google Sheets Sync Complete</strong>
              <div style="font-size: 0.75rem;">Bidirectional Mileage Ledger sync complete!</div>
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 4000);
          } else {
            sheetsSyncBtn.disabled = false;
            sheetsSyncBtn.innerHTML = `Sync Failed`;
          }
        } catch (err) {
          console.error('[AutoMesh FinancialLedger] Google Sheets sync failed:', err);
          sheetsSyncBtn.disabled = false;
          sheetsSyncBtn.innerHTML = `Error`;
        }
      });
    }
  }
}
