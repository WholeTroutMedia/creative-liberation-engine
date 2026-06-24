/**
 * Sentinel Command — V2 Ideation Lifecycle Frontend
 * Wired to V2 registry API with full lifecycle state machine
 */
document.addEventListener('DOMContentLoaded', () => {
  // ── DOM Refs ──
  const views = document.querySelectorAll('.view');
  const navBtns = document.querySelectorAll('.nav-btn');
  const manifestList = document.getElementById('manifest-list');
  const emptyState = document.getElementById('empty-state');
  const detailPanel = document.getElementById('detail-panel');
  const chatPanel = document.getElementById('chat-panel');
  const cmdBar = document.getElementById('command-bar');
  const cmdInput = document.getElementById('command-input');
  const cmdResults = document.getElementById('command-results');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const filterStatus = document.getElementById('filter-status');
  const filterDomain = document.getElementById('filter-domain');
  const filterSource = document.getElementById('filter-source');
  const sortBy = document.getElementById('sort-by');
  const viewBtns = document.querySelectorAll('.toolbar__view-btn');

  // ── State ──
  let ideations = [];
  let stats = {};
  let currentIdeation = null;
  let chatHistory = [];

  // ── V2 Lifecycle Constants ──
  const STATUS_CONFIG = {
    INGESTED:    { label: 'Ingested',    color: '#6b7280', icon: '📥', group: 'pipeline' },
    BRAINSTORM:  { label: 'Brainstorm',  color: '#f59e0b', icon: '🧠', group: 'pipeline' },
    IDEATED:     { label: 'Ideated',     color: '#3b82f6', icon: '💡', group: 'review' },
    REVIEWED:    { label: 'Reviewed',    color: '#8b5cf6', icon: '👁️', group: 'review' },
    ACTIVATED:   { label: 'Activated',   color: '#10b981', icon: '⚡', group: 'active' },
    IN_PROGRESS: { label: 'In Progress', color: '#06b6d4', icon: '🔨', group: 'active' },
    SHIPPED:     { label: 'Shipped',     color: '#14b8a6', icon: '🚀', group: 'active' },
    VALIDATED:   { label: 'Validated',   color: '#22c55e', icon: '✅', group: 'done' },
    COMPLETED:   { label: 'Completed',   color: '#059669', icon: '🏆', group: 'done' },
    PARKED:      { label: 'Parked',      color: '#78716c', icon: '⏸️', group: 'hold' },
    ARCHIVED:    { label: 'Archived',    color: '#64748b', icon: '📦', group: 'hold' },
    DISCARDED:   { label: 'Discarded',   color: '#ef4444', icon: '🗑️', group: 'hold' },
  };

  const REVIEW_VERDICTS = [
    { value: 'activate_now',    label: 'Activate Now',     icon: '⚡', desc: 'Start work immediately' },
    { value: 'still_relevant',  label: 'Still Relevant',   icon: '✓',  desc: 'Keep in current state' },
    { value: 'needs_update',    label: 'Needs Re-analysis',icon: '🔄', desc: 'Send back through ATHENA' },
    { value: 'superseded',      label: 'Superseded',       icon: '📦', desc: 'Covered by another ideation' },
    { value: 'deprioritized',   label: 'Deprioritize',     icon: '⏸️', desc: 'Park for later review' },
    { value: 'discard',         label: 'Discard',          icon: '🗑️', desc: 'Reject permanently' },
  ];

  // ── Valid transitions per status ──
  const TRANSITIONS = {
    INGESTED:    ['BRAINSTORM', 'PARKED', 'DISCARDED'],
    BRAINSTORM:  ['IDEATED', 'PARKED', 'DISCARDED'],
    IDEATED:     ['REVIEWED', 'ACTIVATED', 'PARKED', 'ARCHIVED', 'DISCARDED'],
    REVIEWED:    ['ACTIVATED', 'PARKED', 'ARCHIVED', 'DISCARDED'],
    ACTIVATED:   ['IN_PROGRESS', 'PARKED', 'ARCHIVED'],
    IN_PROGRESS: ['SHIPPED', 'PARKED', 'ARCHIVED'],
    SHIPPED:     ['VALIDATED', 'IN_PROGRESS'],
    VALIDATED:   ['COMPLETED'],
    COMPLETED:   [],
    PARKED:      ['BRAINSTORM', 'ACTIVATED', 'ARCHIVED', 'DISCARDED'],
    ARCHIVED:    ['BRAINSTORM'],
    DISCARDED:   [],
  };

  // ── Polling ──
  const POLL_MS = 60000;
  setInterval(fetchData, POLL_MS);

  // ── Init ──
  function init() {
    fetchData();
    setupEventListeners();
    initTelemetry();
  }

  // ── Data Fetch ──
  async function fetchData() {
    try {
      const [statsRes, ideationsRes] = await Promise.all([
        fetch('/api/stats').catch(() => null),
        fetch('/api/ideations?limit=200').catch(() => null),
      ]);

      if (statsRes?.ok) {
        stats = await statsRes.json();
        updateStats(stats);
      }

      if (ideationsRes?.ok) {
        const data = await ideationsRes.json();
        ideations = data.items || data;
        renderIdeations();
        updateInsights();
        updateDomainFilter();
      }
    } catch (err) {
      console.error('[SENTINEL] Fetch error:', err);
    }
  }

  // ── Stats Strip ──
  function updateStats(s) {
    const byStatus = s.byStatus || {};
    const needsReview = byStatus.IDEATED || 0;
    const active = (byStatus.ACTIVATED || 0) + (byStatus.IN_PROGRESS || 0) + (byStatus.SHIPPED || 0);
    const completed = (byStatus.COMPLETED || 0) + (byStatus.VALIDATED || 0);
    const parked = (byStatus.PARKED || 0) + (byStatus.ARCHIVED || 0) + (byStatus.DISCARDED || 0);

    setText('stat-total', s.total || 0);
    setText('stat-review', needsReview);
    setText('stat-active', active);
    setText('stat-completed', completed);
    setText('stat-parked', parked);
    setText('feed-count', needsReview);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) {
      const old = el.textContent;
      el.textContent = val;
      if (old !== String(val) && old !== '—') {
        el.classList.add('metric-pop');
        setTimeout(() => el.classList.remove('metric-pop'), 500);
      }
    }
  }

  // ── Domain Filter ──
  function updateDomainFilter() {
    if (!filterDomain) return;
    const domains = new Set(ideations.map(i => i.domain).filter(Boolean));
    const currentVal = filterDomain.value;
    filterDomain.innerHTML = '<option value="">All Domains</option>';
    [...domains].sort().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d.charAt(0).toUpperCase() + d.slice(1);
      filterDomain.appendChild(opt);
    });
    filterDomain.value = currentVal;
  }

  // ── Render List ──
  function renderIdeations() {
    let filtered = ideations.filter(i => {
      if (filterStatus?.value && i.status !== filterStatus.value) return false;
      if (filterDomain?.value && i.domain !== filterDomain.value) return false;
      if (filterSource?.value) {
        if (filterSource.value === 'sentinel' && i.heritageSource) return false;
        if (filterSource.value === 'heritage' && !i.heritageSource) return false;
      }
      return true;
    });

    const sortVal = sortBy?.value || 'newest';
    filtered.sort((a, b) => {
      if (sortVal === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sortVal === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sortVal === 'relevance') return (b.relevance || 0) - (a.relevance || 0);
      if (sortVal === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortVal === 'priority') return (a.priority || 3) - (b.priority || 3);
      return 0;
    });

    manifestList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    filtered.forEach((item, i) => {
      const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.BRAINSTORM;
      const card = document.createElement('div');
      card.className = `manifest-card manifest-card--${sc.group}`;
      card.style.animationDelay = `${i * 0.03}s`;
      card.dataset.id = item.id;

      const relClass = item.relevance >= 90 ? 'rel--critical' : item.relevance >= 70 ? 'rel--high' : item.relevance >= 50 ? 'rel--mid' : 'rel--low';
      const age = timeAgo(item.createdAt);
      const priorityLabel = ['', 'P0 🔴', 'P1 🟠', 'P2 🟡', 'P3 ⚪'][item.priority] || '';

      card.innerHTML = `
        <div class="manifest-card__header">
          <h4 class="manifest-card__title">${esc(item.title || 'Untitled')}</h4>
          <span class="status-pill" style="--pill-color: ${sc.color}">
            <span class="status-pill__icon">${sc.icon}</span>
            <span>${sc.label}</span>
          </span>
        </div>
        <div class="manifest-card__directive">${esc((item.directive || '').substring(0, 140))}${item.directive?.length > 140 ? '…' : ''}</div>
        <div class="manifest-card__meta">
          <span class="meta-chip meta-chip--domain">${esc(item.domain || '—')}</span>
          <span class="meta-chip ${relClass}">🎯 ${item.relevance || 0}</span>
          ${priorityLabel ? `<span class="meta-chip meta-chip--priority">${priorityLabel}</span>` : ''}
          <span class="meta-chip meta-chip--time">${age}</span>
          ${item.heritageSource ? `<span class="meta-chip meta-chip--heritage">🏛️ ${item.heritageSource}</span>` : ''}
        </div>
      `;

      card.addEventListener('click', () => openDetail(item));
      manifestList.appendChild(card);
    });

    // Update count
    const countEl = document.getElementById('filter-count');
    if (countEl) countEl.textContent = `${filtered.length} of ${ideations.length}`;
  }

  // ── Detail Panel ──
  function openDetail(item) {
    currentIdeation = item;
    chatPanel.hidden = true;
    detailPanel.hidden = false;

    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.BRAINSTORM;

    document.getElementById('detail-title').textContent = item.title || 'Untitled';

    const statusBadge = document.getElementById('detail-status');
    statusBadge.innerHTML = `<span class="status-pill" style="--pill-color: ${sc.color}">${sc.icon} ${sc.label}</span>`;

    document.getElementById('detail-id').textContent = item.id || '';
    document.getElementById('detail-domain').textContent = `📂 ${item.domain || 'N/A'}`;
    document.getElementById('detail-source-type').textContent = `🔗 ${item.sourceType || item.heritageSource || 'N/A'}`;
    document.getElementById('detail-date').textContent = `📅 ${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}`;
    document.getElementById('detail-relevance').textContent = `🎯 Relevance: ${item.relevance || 0}/100`;
    document.getElementById('detail-urgency').textContent = `⚡ ${(item.urgency || 'low').toUpperCase()}`;

    document.getElementById('detail-directive').innerHTML = item.directive ? `<p>${esc(item.directive)}</p>` : '<p class="text-muted">No ATHENA directive yet.</p>';

    // Source link
    const srcLink = document.getElementById('detail-source-link');
    if (srcLink) {
      srcLink.innerHTML = item.sourceUrl
        ? `<a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener" class="source-link">Open Source Article ↗</a>`
        : '';
    }

    // Tags
    const tagsEl = document.getElementById('detail-tags');
    tagsEl.innerHTML = (item.categories || []).concat(item.tags || [])
      .map(t => `<span class="tag">${esc(t)}</span>`).join('');

    // Render lifecycle actions
    renderLifecycleActions(item);
  }

  function renderLifecycleActions(item) {
    const container = document.getElementById('detail-lifecycle-actions');
    if (!container) return;
    container.innerHTML = '';

    const validTransitions = TRANSITIONS[item.status] || [];

    // Quick transition buttons
    if (validTransitions.length > 0) {
      const transGroup = document.createElement('div');
      transGroup.className = 'lifecycle-group';
      transGroup.innerHTML = '<h5 class="lifecycle-group__title">Transition</h5>';

      const btnRow = document.createElement('div');
      btnRow.className = 'lifecycle-btn-row';

      validTransitions.forEach(status => {
        const sc = STATUS_CONFIG[status];
        if (!sc) return;
        const btn = document.createElement('button');
        btn.className = `lifecycle-btn lifecycle-btn--${sc.group}`;
        btn.innerHTML = `${sc.icon} ${sc.label}`;
        btn.addEventListener('click', () => doTransition(item.id, status));
        btnRow.appendChild(btn);
      });

      transGroup.appendChild(btnRow);
      container.appendChild(transGroup);
    }

    // Review panel (only for IDEATED or REVIEWED)
    if (item.status === 'IDEATED' || item.status === 'REVIEWED') {
      const reviewGroup = document.createElement('div');
      reviewGroup.className = 'lifecycle-group';
      reviewGroup.innerHTML = '<h5 class="lifecycle-group__title">Review Verdict</h5>';

      const verdictRow = document.createElement('div');
      verdictRow.className = 'verdict-grid';

      REVIEW_VERDICTS.forEach(v => {
        const btn = document.createElement('button');
        btn.className = 'verdict-btn';
        btn.innerHTML = `
          <span class="verdict-btn__icon">${v.icon}</span>
          <span class="verdict-btn__label">${v.label}</span>
          <span class="verdict-btn__desc">${v.desc}</span>
        `;
        btn.addEventListener('click', () => doReview(item.id, v.value));
        verdictRow.appendChild(btn);
      });

      reviewGroup.appendChild(verdictRow);
      container.appendChild(reviewGroup);
    }

    // Star button
    const starBtn = document.createElement('button');
    starBtn.className = `lifecycle-btn lifecycle-btn--star ${item.starred ? 'lifecycle-btn--starred' : ''}`;
    starBtn.innerHTML = `${item.starred ? '⭐' : '☆'} ${item.starred ? 'Starred' : 'Star'}`;
    starBtn.addEventListener('click', () => doStar(item.id));
    container.appendChild(starBtn);
  }

  // ── Lifecycle Actions ──
  async function doTransition(id, newStatus) {
    try {
      const res = await fetch(`/api/ideations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, operator: 'operator' })
      });
      const result = await res.json();
      if (result.ok) {
        showToast(`${STATUS_CONFIG[newStatus]?.icon || ''} Transitioned to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
        fetchData();
        if (currentIdeation) {
          currentIdeation.status = newStatus;
          openDetail(currentIdeation);
        }
      } else {
        showToast(`Error: ${result.error}`, 'error');
      }
    } catch (e) {
      showToast(`Network error: ${e.message}`, 'error');
    }
  }

  async function doReview(id, verdict) {
    const notes = prompt('Review notes (optional):');
    try {
      const res = await fetch(`/api/ideations/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict, notes: notes || '', operator: 'operator' })
      });
      const result = await res.json();
      if (result.ok) {
        showToast(`Review submitted: ${verdict}`);
        fetchData();
        if (currentIdeation) {
          currentIdeation.status = result.newStatus;
          openDetail(currentIdeation);
        }
      } else {
        showToast(`Error: ${result.error}`, 'error');
      }
    } catch (e) {
      showToast(`Network error: ${e.message}`, 'error');
    }
  }

  async function doStar(id) {
    try {
      await fetch(`/api/ideations/${id}/star`, { method: 'POST' });
      showToast('⭐ Toggled star');
      fetchData();
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    }
  }

  // ── Insights View ──
  function updateInsights() {
    // Status distribution
    renderBarChart('chart-status', 'Status Distribution', () => {
      const counts = {};
      ideations.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name: STATUS_CONFIG[name]?.label || name,
          count,
          color: STATUS_CONFIG[name]?.color || '#666',
          icon: STATUS_CONFIG[name]?.icon || '',
        }));
    });

    // Domain distribution
    renderBarChart('chart-domains', 'Domain Distribution', () => {
      const counts = {};
      ideations.forEach(i => { counts[i.domain || 'uncategorized'] = (counts[i.domain || 'uncategorized'] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count, color: domainColor(name) }));
    });

    // Source breakdown
    renderBarChart('chart-sources', 'Source Breakdown', () => {
      const counts = { 'Sentinel (V6)': 0, 'Heritage (V1-V5)': 0 };
      ideations.forEach(i => {
        if (i.heritageSource) counts['Heritage (V1-V5)']++;
        else counts['Sentinel (V6)']++;
      });
      return Object.entries(counts).map(([name, count]) => ({
        name, count, color: name.includes('Heritage') ? '#b184ff' : '#8b5cf6'
      }));
    });

    // Relevance tiers
    renderBarChart('chart-relevance', 'Relevance Tiers', () => {
      const tiers = { 'Critical (90+)': 0, 'Strategic (70-89)': 0, 'Standard (50-69)': 0, 'Low (<50)': 0 };
      ideations.forEach(i => {
        const r = i.relevance || 0;
        if (r >= 90) tiers['Critical (90+)']++;
        else if (r >= 70) tiers['Strategic (70-89)']++;
        else if (r >= 50) tiers['Standard (50-69)']++;
        else tiers['Low (<50)']++;
      });
      return Object.entries(tiers).map(([name, count], idx) => ({
        name, count, color: ['#ef4444', '#f59e0b', '#3b82f6', '#6b7280'][idx]
      }));
    });
  }

  function renderBarChart(containerId, title, dataFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const data = dataFn();
    const max = Math.max(...data.map(d => d.count), 1);

    el.innerHTML = data.map(d => `
      <div class="bar-row">
        <div class="bar-row__label">
          <span>${d.icon || ''} ${d.name}</span>
          <span class="bar-row__count">${d.count}</span>
        </div>
        <div class="bar-row__track">
          <div class="bar-row__fill" style="width: ${(d.count / max) * 100}%; background: ${d.color};"></div>
        </div>
      </div>
    `).join('');
  }

  function domainColor(d) {
    const colors = {
      infrastructure: '#3b82f6', business: '#f59e0b', creative: '#ec4899',
      operations: '#10b981', research: '#8b5cf6', security: '#ef4444',
      product: '#06b6d4', uncategorized: '#6b7280',
    };
    return colors[d] || '#6b7280';
  }

  // ── Command Bar (search) ──
  function handleCommandSearch(query) {
    if (!query) { cmdResults.innerHTML = ''; return; }
    const q = query.toLowerCase();
    const matches = ideations.filter(i =>
      (i.title || '').toLowerCase().includes(q) ||
      (i.directive || '').toLowerCase().includes(q) ||
      (i.id || '').toLowerCase().includes(q) ||
      (i.domain || '').toLowerCase().includes(q)
    ).slice(0, 8);

    cmdResults.innerHTML = matches.map(m => {
      const sc = STATUS_CONFIG[m.status] || {};
      return `<div class="command-result" data-id="${m.id}">
        <span class="command-result__icon">${sc.icon || '📄'}</span>
        <div class="command-result__body">
          <span class="command-result__title">${esc(m.title)}</span>
          <span class="command-result__meta">${m.id} · ${sc.label || m.status} · ${m.domain || ''}</span>
        </div>
        <span class="command-result__rel">🎯 ${m.relevance || 0}</span>
      </div>`;
    }).join('');

    cmdResults.querySelectorAll('.command-result').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const item = ideations.find(i => i.id === id);
        if (item) { openDetail(item); cmdBar.hidden = true; cmdInput.value = ''; }
      });
    });
  }

  // ── Event Listeners ──
  function setupEventListeners() {
    // Navigation
    navBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        navBtns.forEach(b => b.classList.remove('nav-btn--active'));
        e.currentTarget.classList.add('nav-btn--active');
        const viewId = e.currentTarget.dataset.view;
        views.forEach(v => v.classList.remove('view--active'));
        document.getElementById('view-' + viewId)?.classList.add('view--active');
      });
    });

    // Filters
    filterStatus?.addEventListener('change', renderIdeations);
    filterDomain?.addEventListener('change', renderIdeations);
    filterSource?.addEventListener('change', renderIdeations);
    sortBy?.addEventListener('change', renderIdeations);

    // Layout toggle
    viewBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        viewBtns.forEach(b => b.classList.remove('toolbar__view-btn--active'));
        e.currentTarget.classList.add('toolbar__view-btn--active');
        const layout = e.currentTarget.dataset.layout;
        manifestList.classList.toggle('grid-layout', layout === 'grid');
      });
    });

    // Detail close
    document.getElementById('close-detail')?.addEventListener('click', () => { detailPanel.hidden = true; });
    document.getElementById('close-chat')?.addEventListener('click', () => { chatPanel.hidden = true; });
    document.getElementById('open-chat-btn')?.addEventListener('click', () => {
      detailPanel.hidden = true;
      chatPanel.hidden = false;
      setTimeout(() => chatInput?.focus(), 300);
    });
    document.getElementById('open-command-btn')?.addEventListener('click', () => {
      cmdBar.hidden = false;
      setTimeout(() => cmdInput?.focus(), 100);
    });

    // Command bar search
    cmdInput?.addEventListener('input', e => handleCommandSearch(e.target.value));

    // Chat
    chatForm?.addEventListener('submit', async e => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      appendChat('user', text);
      chatInput.value = '';

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, contextId: currentIdeation?.id || null })
        });
        const data = await res.json();
        appendChat('athena', data.reply || 'No response.');
      } catch {
        appendChat('system', 'Connection to Genkit proxy failed.');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        cmdBar.hidden = false;
        setTimeout(() => cmdInput?.focus(), 100);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        detailPanel.hidden = true;
        chatPanel.hidden = !chatPanel.hidden;
        if (!chatPanel.hidden) setTimeout(() => chatInput?.focus(), 300);
      }
      if (e.key === 'Escape') {
        cmdBar.hidden = true;
        detailPanel.hidden = true;
        chatPanel.hidden = true;
      }
    });

    document.querySelector('.command-bar__backdrop')?.addEventListener('click', () => { cmdBar.hidden = true; });
  }

  // ── Chat ──
  function appendChat(sender, text) {
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg--${sender}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ── Toast Notification ──
  function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // ── Utilities ──
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  // ── Telemetry Logic ──
  function initTelemetry() {
    // 1. Dispatch Throughput Pillars
    const tpChart = document.getElementById('throughput-chart');
    if (tpChart) {
      tpChart.innerHTML = '';
      for(let i=0; i<24; i++) {
        const p = document.createElement('div');
        p.className = 'throughput-pillar';
        p.style.height = (Math.random() * 80 + 20) + '%';
        tpChart.appendChild(p);
      }
      setInterval(() => {
        if(tpChart.children.length > 0) {
          const i = Math.floor(Math.random() * tpChart.children.length);
          tpChart.children[i].style.height = (Math.random() * 90 + 10) + '%';
          tpChart.children[i].style.filter = 'brightness(1.5) drop-shadow(0 0 8px var(--accent))';
          setTimeout(() => {
            if(tpChart.children[i]) tpChart.children[i].style.filter = '';
          }, 300);
        }
      }, 250);
    }

    // 2. Capability Orbs (Interactive Skill Directory)
    const orbsContainer = document.getElementById('orbs-container');
    if (orbsContainer) {
      orbsContainer.innerHTML = '';
      const skills = [
        { label: 'Workspace', desc: 'Calendar & Mail' },
        { label: 'Memory', desc: 'Qdrant Vector' },
        { label: 'GitHub', desc: 'Code Sync' },
        { label: 'Security', desc: 'PKI mTLS' },
        { label: 'Orchestration', desc: 'DREAM Engine' },
        { label: 'Telemetry', desc: 'Log Streams' },
        { label: 'Mesh', desc: 'Node Discovery' }
      ];
      
      const orbs = skills.map((sk, i) => {
        const orb = document.createElement('div');
        orb.className = 'skill-orb';
        const size = Math.random() * 40 + 60; // 60-100px
        orb.style.width = size + 'px';
        orb.style.height = size + 'px';
        
        // Initial random position
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        
        orb.innerHTML = `
          <div class="skill-orb__content">
            <div class="skill-orb__label">${sk.label}</div>
            <div class="skill-orb__desc">${sk.desc}</div>
          </div>
        `;
        orbsContainer.appendChild(orb);
        
        return {
          el: orb,
          x: x, y: y,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
          size: size,
          baseSize: size,
          focused: false
        };
      });

      // Simple physics loop for orbs
      let draggedOrb = null;
      
      const updateOrbs = () => {
        orbs.forEach(orb => {
          if (!orb.focused && orb !== draggedOrb) {
            orb.x += orb.vx;
            orb.y += orb.vy;
            
            // Bounce off walls (percentages)
            if (orb.x <= 5 || orb.x >= 95) orb.vx *= -1;
            if (orb.y <= 5 || orb.y >= 95) orb.vy *= -1;
          }
          
          // Apply position
          orb.el.style.left = `${orb.x}%`;
          orb.el.style.top = `${orb.y}%`;
        });
        requestAnimationFrame(updateOrbs);
      };
      updateOrbs();

      // Interaction
      orbs.forEach(orb => {
        orb.el.addEventListener('click', () => {
          const isFocused = orb.focused;
          orbs.forEach(o => { o.focused = false; o.el.classList.remove('skill-orb--focused'); o.el.classList.add('skill-orb--blurred'); });
          
          if (!isFocused) {
            orb.focused = true;
            orb.el.classList.add('skill-orb--focused');
            orb.el.classList.remove('skill-orb--blurred');
            orb.x = 50; orb.y = 50; // Center it
          } else {
            orbs.forEach(o => o.el.classList.remove('skill-orb--blurred'));
          }
        });
      });
    }

    // 3. Radar Sweep Canvas (Agent Mesh Topology)
    const canvas = document.getElementById('radar-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let angle = 0;
      
      // Generate some persistent nodes
      const agents = Array.from({length: 12}, (_, i) => ({
        id: 'AGN-' + Math.floor(Math.random() * 9000 + 1000),
        task: 'TSK-' + Math.floor(Math.random() * 900 + 100),
        load: Math.floor(Math.random() * 80 + 10) + '%',
        cert: Math.random() > 0.1 ? 'VALID' : 'EXPIRED',
        distance: Math.random() * 0.8 + 0.1, // % of radius
        theta: Math.random() * Math.PI * 2,
        speed: (Math.random() - 0.5) * 0.005,
        status: Math.random() > 0.8 ? 'error' : (Math.random() > 0.4 ? 'active' : 'idle'),
        igniteFade: 0,
        x: 0, y: 0
      }));

      const radarContainer = document.querySelector('.radar-container');
      let tooltip = document.getElementById('radar-tooltip');
      if (!tooltip && radarContainer) {
        tooltip = document.createElement('div');
        tooltip.id = 'radar-tooltip';
        tooltip.className = 'radar-tooltip';
        radarContainer.appendChild(tooltip);
      }

      // Hover logic
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        let hoveredAgent = null;
        for (const agent of agents) {
          const dx = agent.x - mouseX;
          const dy = agent.y - mouseY;
          if (dx*dx + dy*dy < 144) { // 12px radius
            hoveredAgent = agent;
            break;
          }
        }

        if (hoveredAgent && tooltip) {
          tooltip.innerHTML = `
            <div class="radar-tooltip__row"><span class="radar-tooltip__label">ID:</span> <span style="color:var(--text-primary)">${hoveredAgent.id}</span></div>
            <div class="radar-tooltip__row"><span class="radar-tooltip__label">TASK:</span> <span style="color:var(--text-primary)">${hoveredAgent.task}</span></div>
            <div class="radar-tooltip__row"><span class="radar-tooltip__label">LOAD:</span> <span style="color:var(--text-primary)">${hoveredAgent.load}</span></div>
            <div class="radar-tooltip__row"><span class="radar-tooltip__label">CERT:</span> <span style="color:${hoveredAgent.cert === 'VALID' ? 'var(--accent)' : 'var(--danger)'}">${hoveredAgent.cert}</span></div>
          `;
          // center tooltip above node
          tooltip.style.left = hoveredAgent.x + 'px'; 
          tooltip.style.top = (hoveredAgent.y - 15) + 'px'; 
          tooltip.classList.add('radar-tooltip--visible');
          canvas.style.cursor = 'pointer';
        } else if (tooltip) {
          tooltip.classList.remove('radar-tooltip--visible');
          canvas.style.cursor = 'default';
        }
      });

      canvas.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.classList.remove('radar-tooltip--visible');
        canvas.style.cursor = 'default';
      });

      const drawRadar = () => {
        const w = canvas.parentElement.clientWidth;
        const h = canvas.parentElement.clientHeight;
        
        // Handle resize gracefully
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w * 2; // Retina
          canvas.height = h * 2;
          canvas.style.width = w + 'px';
          canvas.style.height = h + 'px';
          ctx.scale(2, 2);
        }

        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 15;

        // Clear canvas but leave a slight trail
        ctx.fillStyle = 'rgba(5, 5, 5, 0.2)';
        ctx.fillRect(0, 0, w, h);

        // Grid Rings
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.lineWidth = 1;
        [0.33, 0.66, 1].forEach(scale => {
          ctx.beginPath();
          ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Crosshairs
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();

        // The Sweep (Volumetric Light Ray)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const grad = ctx.createConicGradient(0, 0, 0);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.6)');
        grad.addColorStop(0.05, 'rgba(139, 92, 246, 0.1)');
        grad.addColorStop(0.2, 'transparent');
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        
        // Leading edge glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#8b5cf6';
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r, 0);
        ctx.stroke();
        ctx.restore();

        // Agent Nodes
        agents.forEach(agent => {
          agent.theta += agent.speed;
          const nx = cx + Math.cos(agent.theta) * (r * agent.distance);
          const ny = cy + Math.sin(agent.theta) * (r * agent.distance);
          agent.x = nx;
          agent.y = ny;
          
          // Check if sweep is passing over (angle collision)
          // Normalize angles
          let aTheta = agent.theta % (Math.PI * 2);
          if (aTheta < 0) aTheta += Math.PI * 2;
          let sAngle = angle % (Math.PI * 2);
          if (sAngle < 0) sAngle += Math.PI * 2;
          
          const diff = Math.abs(aTheta - sAngle);
          if (diff < 0.1 || diff > Math.PI * 2 - 0.1) {
            agent.igniteFade = 1.0; // Ignite
          } else {
            agent.igniteFade = Math.max(0, agent.igniteFade - 0.02); // Fade out
          }

          let color = '#8a93a2'; // Idle
          let shadowColor = 'transparent';
          if (agent.status === 'active') { color = '#8b5cf6'; shadowColor = '#8b5cf6'; }
          else if (agent.status === 'error') { color = '#ff3366'; shadowColor = '#ff3366'; }

          // Draw connections to center for active agents
          if (agent.status === 'active') {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(nx, ny);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 + agent.igniteFade * 0.3})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Node Sphere
          ctx.beginPath();
          ctx.arc(nx, ny, 4 + (agent.igniteFade * 3), 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowBlur = agent.igniteFade * 15;
          ctx.shadowColor = shadowColor;
          ctx.fill();
          
          // Ripple effect
          if (agent.igniteFade > 0) {
            ctx.beginPath();
            ctx.arc(nx, ny, 10 + (1 - agent.igniteFade) * 15, 0, Math.PI * 2);
            ctx.strokeStyle = \`\${color}\${Math.floor(agent.igniteFade * 255).toString(16).padStart(2, '0')}\`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.shadowBlur = 0; // reset
        });

        angle += 0.025;
        requestAnimationFrame(drawRadar);
      };
      drawRadar();
    }

    // 4. Compute Sparkline Animation
    const sparkline = document.querySelector('.sparkline-path');
    if (sparkline) {
      let offset = 0;
      setInterval(() => {
        offset -= 2;
        sparkline.style.strokeDashoffset = offset;
      }, 50);
    }
  }

  init();
});
