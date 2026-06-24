// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — API Client
// Fetch wrapper for all backend endpoints
// ═══════════════════════════════════════════════════════════════

const BASE = '/api';

/**
 * Core fetch wrapper with error handling and JSON parsing.
 */
async function request(path, opts = {}) {
  const url = `${BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${res.statusText}${errorBody ? ` — ${errorBody}` : ''}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return await res.json();
    }
    return await res.text();
  } catch (err) {
    console.error(`[AutoMesh API] ${opts.method || 'GET'} ${url} failed:`, err.message);
    throw err;
  }
}

// ── Telemetry ──────────────────────────────────────────────────

/**
 * Fetch live vehicle telemetry from venza-state.json.
 * @returns {Promise<Object>} Live telemetry data
 */
export function fetchLiveTelemetry() {
  return request('/telemetry/live');
}

/**
 * Fetch telemetry history for a given number of days.
 * @param {number} days - Number of days of history (default 30)
 * @returns {Promise<Array>} Array of telemetry snapshots
 */
export function fetchHistory(days = 30) {
  return request(`/telemetry/history?days=${days}`);
}

// ── Trips ──────────────────────────────────────────────────────

/**
 * Fetch trips with optional filters.
 * @param {Object} filters - { category, startDate, endDate, limit, offset }
 * @returns {Promise<Object>} { trips: [...], total: N }
 */
export function fetchTrips(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category)  params.set('category', filters.category);
  if (filters.startDate) params.set('start_date', filters.startDate);
  if (filters.endDate)   params.set('end_date', filters.endDate);
  if (filters.limit)     params.set('limit', String(filters.limit));
  if (filters.offset)    params.set('offset', String(filters.offset));
  const qs = params.toString();
  return request(`/trips${qs ? '?' + qs : ''}`);
}

/**
 * Update a trip's category, notes, or split percentage.
 * @param {string|number} id - Trip ID
 * @param {Object} data - { category, notes, split_percent }
 * @returns {Promise<Object>} Updated trip
 */
export function updateTrip(id, data) {
  return request(`/trips/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Batch update multiple trips.
 * @param {Array<string|number>} ids - Trip IDs
 * @param {Object} data - { category }
 * @returns {Promise<Object>} Result
 */
export function batchUpdateTrips(ids, data) {
  return request('/trips/batch', {
    method: 'PATCH',
    body: JSON.stringify({ ids, ...data }),
  });
}

// ── Stats ──────────────────────────────────────────────────────

/**
 * Fetch aggregate stats (totals, deductions, averages).
 * @returns {Promise<Object>} Stats object
 */
export function fetchStats() {
  return request('/stats');
}

// ── Export ──────────────────────────────────────────────────────

/**
 * Export trips as CSV. Triggers a file download.
 * @param {Object} filters - { category, startDate, endDate }
 */
export async function exportCSV(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category)  params.set('category', filters.category);
  if (filters.startDate) params.set('start_date', filters.startDate);
  if (filters.endDate)   params.set('end_date', filters.endDate);
  const qs = params.toString();
  const url = `${BASE}/export/csv${qs ? '?' + qs : ''}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `automesh-trips-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  } catch (err) {
    console.error('[AutoMesh API] CSV export failed:', err.message);
    throw err;
  }
}

// ── Maintenance ────────────────────────────────────────────────

/**
 * Fetch maintenance log entries.
 * @returns {Promise<Array>} Array of maintenance records
 */
export function fetchMaintenance() {
  return request('/maintenance');
}

/**
 * Add a new maintenance entry.
 * @param {Object} data - { service_type, mileage, date, cost, provider, notes }
 * @returns {Promise<Object>} Created maintenance record
 */
export function addMaintenance(data) {
  return request('/maintenance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a maintenance entry.
 * @param {string|number} id - Maintenance record ID
 * @returns {Promise<void>}
 */
export function deleteMaintenance(id) {
  return request(`/maintenance/${id}`, { method: 'DELETE' });
}
