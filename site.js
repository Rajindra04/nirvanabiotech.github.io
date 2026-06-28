/* ============================================================
   NIRVANA BIOTECH — shared site script
   Loads data.json, hydrates per-page content, handles nav + modal
   ============================================================ */

const FALLBACK_IMG = "https://picsum.photos/id/1015/400/300";
let SITE_DATA = null;

const PAGES = [
  { id: "home",        href: "index.html",       label: "Home" },
  { id: "about",        href: "about.html",        label: "About" },
  { id: "innovations",  href: "innovations.html",  label: "Innovations" },
  { id: "team",         href: "team.html",         label: "Team" },
  { id: "research",     href: "research.html",     label: "Research" },
  { id: "contact",      href: "contact.html",      label: "Contact" },
];

async function loadSiteData() {
  try {
    const res = await fetch('data.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('no data.json');
    SITE_DATA = await res.json();
  } catch (e) {
    console.warn('Falling back to embedded defaults', e);
    SITE_DATA = window.__DEFAULT_DATA__ || {};
  }
  hydrateBrand();
  if (typeof renderPage === 'function') renderPage(SITE_DATA);
}

function hydrateBrand() {
  document.querySelectorAll('[data-brand-name]').forEach(el => el.textContent = SITE_DATA.brandName || 'NIRVANA');
  document.querySelectorAll('[data-brand-sub]').forEach(el => el.textContent = SITE_DATA.brandSub || 'BIOTECH');
  document.querySelectorAll('[data-brand-logo]').forEach(el => { if (SITE_DATA.logoUrl) el.src = SITE_DATA.logoUrl; el.onerror = () => el.src = FALLBACK_IMG; });
}

function buildNav(activeId) {
  document.querySelectorAll('[data-navlinks]').forEach(container => {
    container.innerHTML = PAGES.map(p =>
      `<a href="${p.href}" class="${p.id === activeId ? 'is-active' : ''}">${p.label}</a>`
    ).join('');
  });
  document.querySelectorAll('[data-rail]').forEach(container => {
    container.innerHTML = PAGES.map((p, i) =>
      `<a href="${p.href}" class="rail-item ${p.id === activeId ? 'is-active' : ''}">
         <span class="num">${String(i + 1).padStart(2, '0')}</span>
         <span class="label">${p.label}</span>
       </a>`
    ).join('');
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.mobile-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => menu.classList.toggle('open'));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
}

/* ---------------- detail modal (innovations / research) ---------------- */
function openDetail(section, idx) {
  const item = SITE_DATA?.[section]?.[idx];
  if (!item) return;
  const overlay = document.getElementById('detail-modal');
  if (!overlay) return;
  const img = overlay.querySelector('.modal-box img');
  const tag = overlay.querySelector('.modal-tag');
  const title = overlay.querySelector('.modal-body h3');
  const text = overlay.querySelector('.modal-body p');
  const linkWrap = overlay.querySelector('.modal-link-wrap');

  if (item.imageUrl) { img.src = item.imageUrl; img.style.display = 'block'; img.onerror = () => img.style.display = 'none'; }
  else { img.style.display = 'none'; }

  tag.textContent = item.date ? item.date : section.toUpperCase();
  title.textContent = item.title || '';
  text.textContent = (item.fullText && item.fullText.trim()) ? item.fullText : (item.desc || '');

  if (linkWrap) {
    if (item.linkUrl && item.linkUrl.trim()) {
      linkWrap.innerHTML = `<a class="btn btn--solid" href="${item.linkUrl}" target="_blank" rel="noopener noreferrer">${item.linkLabel && item.linkLabel.trim() ? item.linkLabel : 'View link'}</a>`;
    } else {
      linkWrap.innerHTML = '';
    }
  }
  overlay.classList.add('open');
}
function closeDetail() {
  document.getElementById('detail-modal')?.classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

/* ---------------- chromatogram trace SVG (signature motif) ---------------- */
function traceSVG(opts = {}) {
  const w = opts.w || 720, h = opts.h || 90, seed = opts.seed || 1;
  let d1 = `M0 ${h*0.6}`;
  let d2 = `M0 ${h*0.7}`;
  const steps = 28;
  for (let i = 1; i <= steps; i++) {
    const x = (w / steps) * i;
    const n1 = Math.sin(i * 0.7 + seed) * 0.5 + Math.sin(i * 1.9 + seed * 2) * 0.3;
    const n2 = Math.cos(i * 0.5 + seed * 1.3) * 0.4 + Math.sin(i * 2.3) * 0.25;
    const y1 = h * 0.5 - n1 * (h * 0.38);
    const y2 = h * 0.55 - n2 * (h * 0.3);
    d1 += ` L${x.toFixed(1)} ${y1.toFixed(1)}`;
    d2 += ` L${x.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return `<svg class="trace" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path class="trace-teal" d="${d2}"/>
    <path d="${d1}"/>
  </svg>`;
}
function injectTraces() {
  document.querySelectorAll('[data-trace]').forEach((el, i) => {
    const w = el.clientWidth || 720;
    el.innerHTML = traceSVG({ w, h: parseInt(el.dataset.traceH || '90', 10), seed: i + 1 });
  });
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  loadSiteData().then(() => {
    injectTraces();
  });
  window.addEventListener('resize', () => injectTraces());
});
