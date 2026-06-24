document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  const views = document.querySelectorAll('.view');
  const loaded = new Set();

  async function loadView(name) {
    const el = document.getElementById('view-' + name);
    if (!el) return;
    if (!loaded.has(name) && el.dataset.src) {
      try {
        const r = await fetch(el.dataset.src);
        if (r.ok) el.innerHTML = await r.text();
      } catch(e) { el.innerHTML = '<p>Failed to load section.</p>'; }
      loaded.add(name);
    }
  }

  function switchView(name) {
    views.forEach(v => v.style.display = 'none');
    navItems.forEach(n => n.classList.remove('nav-item--active'));
    const el = document.getElementById('view-' + name);
    const btn = document.querySelector(`[data-view="${name}"]`);
    if (el) el.style.display = 'block';
    if (btn) btn.classList.add('nav-item--active');
    loadView(name);
    document.getElementById('main-content').scrollTop = 0;
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Load initial view
  loadView('overview');
});
