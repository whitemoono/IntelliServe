/* ============================================
   IntelliServe IT Suite — Shared Interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initMobileMenu();
  initSidebarToggle();
  initTabs();
  initSearch();
  initCountUp();
  initChartAnimations();
});

/* ---------- Scroll Animations ---------- */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Animate progress bars
          const bars = entry.target.querySelectorAll('.progress-bar-fill');
          bars.forEach((bar) => {
            const width = bar.dataset.width || '0%';
            setTimeout(() => { bar.style.width = width; }, 200);
          });
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('.animate-in').forEach((el) => observer.observe(el));
}

/* ---------- Mobile Menu ---------- */
function initMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const links = document.querySelector('.navbar-links');
  if (!btn || !links) return;
  if (btn.classList.contains('sidebar-toggle')) return;

  btn.addEventListener('click', () => {
    links.classList.toggle('show');
    btn.setAttribute('aria-expanded', links.classList.contains('show') ? 'true' : 'false');
  });
}

/* ---------- Sidebar Toggle (Docs & System) ---------- */
function initSidebarToggle() {
  const toggleBtn = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.docs-sidebar, .sys-sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (!toggleBtn || !sidebar) return;

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('active');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

/* ---------- Tabs ---------- */
function initTabs() {
  document.querySelectorAll('[data-tab-group]').forEach((group) => {
    const tabs = group.querySelectorAll('.sys-tab, .chart-tab');
    const groupName = group.dataset.tabGroup;

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        // Deactivate all tabs in group
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        // Show corresponding content
        const target = tab.dataset.tab;
        const contents = document.querySelectorAll(
          `[data-tab-content-group="${groupName}"] .tab-content`
        );
        contents.forEach((c) => {
          c.classList.toggle('active', c.dataset.tabContent === target);
        });
      });
    });
  });
}

/* ---------- Search ---------- */
function initSearch() {
  const searchInput = document.querySelector('.docs-search-box input');
  if (!searchInput) return;

  if (window.Fuse) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.doc-item');
    const categories = document.querySelectorAll('.doc-category');

    if (!query) {
      items.forEach((item) => (item.style.display = ''));
      categories.forEach((cat) => (cat.style.display = ''));
      return;
    }

    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) ? '' : 'none';
    });

    // Hide empty categories
    categories.forEach((cat) => {
      const visibleItems = cat.querySelectorAll('.doc-item[style=""], .doc-item:not([style])');
      const hasVisible = Array.from(cat.querySelectorAll('.doc-item')).some(
        (item) => item.style.display !== 'none'
      );
      cat.style.display = hasVisible ? '' : 'none';
    });
  });

  // Keyboard shortcut: Ctrl+K or /
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

/* ---------- Count Up Animation ---------- */
function initCountUp() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const suffix = el.dataset.suffix || '';
          const duration = 1500;
          const start = 0;
          const startTime = performance.now();

          function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - start) * eased);
            el.textContent = current.toLocaleString() + suffix;
            if (progress < 1) requestAnimationFrame(animate);
          }

          requestAnimationFrame(animate);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => observer.observe(el));
}

/* ---------- Chart Animations ---------- */
function initChartAnimations() {
  // Animate bar chart bars on scroll
  const barCharts = document.querySelectorAll('.mini-chart');
  if (!barCharts.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const bars = entry.target.querySelectorAll('.chart-bar');
          bars.forEach((bar, i) => {
            const height = bar.dataset.height || '50%';
            setTimeout(() => { bar.style.height = height; }, i * 50);
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  barCharts.forEach((chart) => observer.observe(chart));
}

/* ---------- Donut Chart SVG ---------- */
function drawDonut(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let svg = `<svg viewBox="0 0 ${size} ${size}">`;
  let offset = 0;

  data.forEach((d) => {
    const pct = d.value / total;
    const dash = pct * circumference;
    svg += `<circle
      cx="${size / 2}" cy="${size / 2}" r="${radius}"
      fill="none" stroke="${d.color}" stroke-width="${strokeWidth}"
      stroke-dasharray="${dash} ${circumference - dash}"
      stroke-dashoffset="${-offset}"
      style="transition: stroke-dasharray 1s ease"
    />`;
    offset += dash;
  });

  // Center text
  svg += `<text x="${size / 2}" y="${size / 2}" text-anchor="middle"
    dy="0.35em" fill="var(--text-primary)" font-size="24" font-weight="800">${total}</text>`;
  svg += `<text x="${size / 2}" y="${size / 2 + 18}" text-anchor="middle"
    dy="0.35em" fill="var(--text-muted)" font-size="11">总计</text>`;
  svg += '</svg>';

  container.innerHTML = svg;
}

/* ---------- Line Chart SVG ---------- */
function drawLineChart(containerId, data, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = data.datasets.flatMap((ds) => ds.values);
  const maxVal = Math.max(...allValues) * 1.1;
  const minVal = Math.min(0, Math.min(...allValues));

  const xStep = chartW / (data.labels.length - 1);

  function getX(i) { return padding.left + i * xStep; }
  function getY(v) {
    return padding.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  }

  let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`;

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    const val = Math.round(maxVal - (maxVal - minVal) * (i / 4));
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"
      stroke="var(--border-color)" stroke-width="1" />`;
    svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end"
      fill="var(--text-muted)" font-size="10">${val}%</text>`;
  }

  // X labels
  data.labels.forEach((label, i) => {
    svg += `<text x="${getX(i)}" y="${height - 5}" text-anchor="middle"
      fill="var(--text-muted)" font-size="10">${label}</text>`;
  });

  // Lines
  data.datasets.forEach((ds) => {
    // Area fill
    let areaPath = `M ${getX(0)} ${getY(ds.values[0])}`;
    ds.values.forEach((v, i) => {
      if (i > 0) areaPath += ` L ${getX(i)} ${getY(v)}`;
    });
    areaPath += ` L ${getX(ds.values.length - 1)} ${padding.top + chartH}`;
    areaPath += ` L ${getX(0)} ${padding.top + chartH} Z`;

    svg += `<path d="${areaPath}" fill="url(#grad-${ds.color})" opacity="0.3" />`;

    // Line
    let linePath = `M ${getX(0)} ${getY(ds.values[0])}`;
    ds.values.forEach((v, i) => {
      if (i > 0) linePath += ` L ${getX(i)} ${getY(v)}`;
    });
    svg += `<path d="${linePath}" fill="none" stroke="${ds.color}" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" />`;

    // Dots
    ds.values.forEach((v, i) => {
      svg += `<circle cx="${getX(i)}" cy="${getY(v)}" r="3.5"
        fill="${ds.color}" stroke="var(--bg-card)" stroke-width="2" />`;
    });
  });

  // Gradient defs
  svg += '<defs>';
  data.datasets.forEach((ds) => {
    svg += `<linearGradient id="grad-${ds.color}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ds.color}" stop-opacity="0.4" />
      <stop offset="100%" stop-color="${ds.color}" stop-opacity="0" />
    </linearGradient>`;
  });
  svg += '</defs>';
  svg += '</svg>';

  container.innerHTML = svg;
}

/* ---------- Utility: Format Number ---------- */
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
