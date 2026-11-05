// 3D earned-value chart that a construction scene turns into: optional monthly cumulative EV columns,
// PV / EV / AC curves, a "today" line, the EV forecast, an optional Earned Schedule construction and
// floating labels. Values are an illustrative scenario, not data.
import * as THREE from 'three';
import { t as L_, num, pct } from './i18n.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const clamp01 = t => Math.min(1, Math.max(0, t));
export const S = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ramp = (k, a, b) => S((k - a) / (b - a));
export const fmt = num;

// Chart labels and indicator cards, shared by the three scenes (one typography, one card, one colour code).
// Indicator tone: good (green), warn (amber), bad (red); without a tone the card is cyan.
export const CHART_CSS = `
.evm-label { font: 600 13px/1.25 system-ui, -apple-system, "Segoe UI", sans-serif; color: #e6edf7; white-space: nowrap; transition: opacity .35s; text-shadow: 0 1px 6px #07111F, 0 0 2px #07111F; }
.evm-label.pv { color: #8FDCF0; }
.evm-label.ev, .evm-label.fc { color: #67e8f9; }
.evm-label.ac { color: #fcd34d; }
.evm-label.axis { color: #b4cdea; font-weight: 500; font-size: 12px; }
.evm-label.today { color: #fff; }
.evm-label.gap { color: #fca5a5; font-weight: 700; }
.evm-label.kpi { --tone: #67e8f9; min-width: 150px; background: rgba(7, 17, 31, .9); border: 1px solid rgba(165, 214, 255, .25); border-left: 3px solid var(--tone); border-radius: 4px; padding: 10px 14px 10px 12px;
  font: 600 11px/1.2 ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace; letter-spacing: .06em; text-transform: uppercase; color: #cfe0f5; text-shadow: none; }
.evm-label.kpi b { display: block; margin: 5px 0 3px; font: 700 30px/1.05 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: -.01em; text-transform: none; color: var(--tone); }
.evm-label.kpi span { display: block; font: 400 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: 0; text-transform: none; color: #9fb0c9; }
.evm-label.kpi.good { --tone: #4ade80; } .evm-label.kpi.warn { --tone: #fbbf24; } .evm-label.kpi.bad { --tone: #f87171; }
@media (max-width: 600px) {
  .evm-label { font-size: 10px; } .evm-label.axis { font-size: 9px; }
  .evm-label.kpi { min-width: 0; padding: 6px 9px; font-size: 9px; } .evm-label.kpi b { font-size: 18px; margin: 3px 0 1px; } .evm-label.kpi span { font-size: 9px; }
  .evm-label .long { display: none; } /* phones: short labels; the caption card explains them */
}`;
export function chartStyles() {
  if (document.getElementById('evm-chart-css')) return;
  const st = document.createElement('style');
  st.id = 'evm-chart-css';
  st.textContent = CHART_CSS;
  document.head.appendChild(st);
}

// A soft dark panel (w × h, in the XY plane) drawn over the terrain and under a chart, so the chart reads clearly.
// Its material's userData.base is the full opacity; the caller fades it with the chart.
export function chartPanel(w, h) {
  const m = new THREE.MeshBasicMaterial({ map: softPanel(), color: '#07111F', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  m.userData.base = 0.6;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.renderOrder = -0.5; // after the drawing sheet (-1), before the chart
  return mesh;
}

// Soft-edged dark panel texture (alpha falls off towards the edges).
function softPanel() {
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d'), img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const e = Math.min(x, n - 1 - x, y, n - 1 - y) / (n * 0.22);
    const a = e >= 1 ? 1 : e * e * (3 - 2 * e);
    const i = (y * n + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// rate > 1: work is earned faster than planned (ahead), rate < 1: behind. EV(m) = PV(m · rate).
export function scenario({ months = 20, today = 11, rate = 20 / 19.6, cpi = 1.04 } = {}) {
  const pv = m => 100 * S(m / months);
  const ev = m => pv(m * rate);
  const ac = m => ev(m) / cpi;
  const es = today * rate; // earned schedule: when the plan reached today's EV
  return { months, today, rate, cpi, pv, ev, ac, es, earnedEnd: months / rate, spi: ev(today) / pv(today), spiT: es / today };
}

// origin: point at (month 0, value 0); axis: unit vector along time; len: axis length; height: 100 % in metres.
// thick: curve thickness factor (a far chart camera, e.g. the airport on a phone, needs bolder curves).
export function createEvmChart(sc, { origin, axis, len, height, columns = true, ac = true, es = false, kpis = [], labelAt = {}, thick = 1 }) {
  chartStyles();
  const g = new THREE.Group();
  const UP = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3().crossVectors(axis, UP).normalize(); // towards the viewer's side
  const P = (m, v, side = 0) => origin.clone().addScaledVector(axis, (len * m) / sc.months).addScaledVector(UP, (height * v) / 100).addScaledVector(across, side);
  const mats = [];
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: true, ...extra });
    m.userData.base = m.opacity;
    mats.push(m);
    return m;
  };
  const lineMat = (color, opacity, dashed) => {
    const m = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.7, gapSize: 0.5 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    m.userData.base = opacity;
    mats.push(m);
    return m;
  };
  const C = {
    pv: mat('#8FDCF0', { emissive: '#3478F6', emissiveIntensity: 0.6 }),
    ev: mat('#35C7E8', { emissive: '#35C7E8', emissiveIntensity: 0.7 }),
    ac: mat('#fcd34d', { emissive: '#f59e0b', emissiveIntensity: 0.9 }),
    col: mat('#35C7E8', { opacity: 0.28, emissive: '#0e7490', emissiveIntensity: 0.4, depthWrite: false }),
    pvBar: mat('#8FDCF0', { opacity: 0.55, emissive: '#3478F6', emissiveIntensity: 0.5 }),
    evBar: mat('#35C7E8', { opacity: 0.75, emissive: '#35C7E8', emissiveIntensity: 0.6 }),
    colEdge: lineMat('#a5f3fc', 0.8),
    axis: lineMat('#cfe8ff', 0.7),
    grid: lineMat('#5fa8ff', 0.3, true),
    today: lineMat('#ffffff', 0.9, true),
    es: lineMat('#67e8f9', 0.9, true),
    esTube: mat('#a5f3fc', { emissive: '#35C7E8', emissiveIntensity: 1 }),
    gap: mat('#f87171', { opacity: 0.22, emissive: '#dc2626', emissiveIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  };
  const line = (pts, m, parent = g) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
    l.computeLineDistances();
    parent.add(l);
    return l;
  };
  const alongQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis);

  // A soft dark panel in the chart's plane, drawn over the terrain (no depth test) and under the chart: it dims what
  // is behind and around the curves so they and their labels read clearly. It fades with the chart.
  const panel = chartPanel(len * 1.42, height * 1.5);
  mats.push(panel.material);
  panel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis.clone().normalize(), UP, across));
  panel.position.copy(P(sc.months * 0.56, 50));
  g.add(panel);

  // Axes and 50 % / 100 % guides.
  line([P(0, 0), P(sc.months, 0)], C.axis);
  line([P(0, 0), P(0, 105)], C.axis);
  for (const v of [50, 100]) line([P(0, v), P(sc.months, v)], C.grid);
  for (let m = 0; m <= sc.months; m += 5) line([P(m, 0), P(m, -2)], C.axis);

  // Monthly columns of cumulative EV up to today.
  const cols = [];
  if (columns) for (let m = 1; m <= Math.floor(sc.today); m++) {
    const h = (height * sc.ev(m)) / 100;
    const geo = new THREE.BoxGeometry(1.6, 1, 1.4).translate(0, 0.5, 0);
    const col = new THREE.Mesh(geo, C.col);
    col.quaternion.copy(alongQ);
    col.position.copy(P(m - 0.5, 0));
    col.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), C.colEdge));
    col.userData.h = h;
    g.add(col);
    cols.push(col);
  }

  // Curves as tubes, revealed progressively with drawRange.
  const tube = (fn, m0, m1, r, material, segs = 120) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) { const m = m0 + ((m1 - m0) * i) / 60; pts.push(P(m, fn(m))); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, r, 8);
    const mesh = new THREE.Mesh(geo, material);
    mesh.userData.total = geo.index.count;
    geo.setDrawRange(0, 0);
    g.add(mesh);
    return mesh;
  };
  const reveal = (mesh, k) => mesh.geometry.setDrawRange(0, Math.floor((mesh.userData.total * k) / 6) * 6);
  const dashes = (fn, m0, m1, r, material) => {
    const out = [];
    for (let m = m0; m < m1; m += 0.5) { const d = tube(fn, m, Math.min(m1, m + 0.32), r, material, 6); reveal(d, 1); out.push(d); }
    return out;
  };
  const pvDashes = dashes(sc.pv, 0, sc.months, 0.2 * thick, C.pv);
  const evLine = tube(sc.ev, 0, sc.today, 0.3 * thick, C.ev);
  const acLine = ac ? tube(sc.ac, 0, sc.today, 0.28 * thick, C.ac) : null;
  const fcDashes = dashes(sc.ev, sc.today, Math.min(sc.earnedEnd, sc.months * 1.25), 0.17 * thick, C.ev);

  const todayLine = line([P(sc.today, 0), P(sc.today, 112)], C.today);

  // Earned Schedule: EV(today) traced back to the date the plan reached it, and two bars on the time axis.
  const esGroup = new THREE.Group();
  if (es) {
    g.add(esGroup);
    const v = sc.ev(sc.today);
    // ES trace: from today's EV back along the curve's level to the month the plan reached it, then down. Drawn as
    // solid tubes so it reads as clearly as the curves.
    const esH = tube(() => v, sc.es, sc.today, 0.16 * thick, C.esTube);
    reveal(esH, 1);
    esGroup.add(esH);
    const esV = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * thick, 0.16 * thick, (height * v) / 100, 8), C.esTube);
    esV.position.copy(P(sc.es, v / 2));
    esGroup.add(esV);
    // The delay: a red band between the earned schedule and today, up to today's EV.
    const gap = new THREE.Mesh(new THREE.PlaneGeometry((len * (sc.today - sc.es)) / sc.months, (height * v) / 100), C.gap);
    gap.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis.clone().normalize(), UP, across));
    gap.position.copy(P((sc.es + sc.today) / 2, v / 2));
    esGroup.add(gap);
    const bar = (m, side, material) => {
      const geo = new THREE.BoxGeometry(1, 0.3, 1.8).translate(0.5, 0.15, 0);
      const b = new THREE.Mesh(geo, material);
      b.quaternion.copy(alongQ);
      b.position.copy(P(0, 0, side));
      b.userData.full = (len * m) / sc.months;
      esGroup.add(b);
      return b;
    };
    esGroup.userData.bars = [bar(sc.today, 5, C.pvBar), bar(sc.es, -5, C.evBar)];
  }

  // Labels (HTML, follow the 3D points).
  const labels = [];
  const label = (html, pos, cls, at) => {
    const div = document.createElement('div');
    div.className = 'evm-label ' + cls;
    div.innerHTML = html;
    const o = new CSS2DObject(div);
    o.position.copy(pos);
    o.userData.at = at;
    g.add(o);
    labels.push(o);
    return o;
  };
  const t = sc.today, up = v => new THREE.Vector3(0, v, 0);
  const L = { pv: [sc.months * 0.8, 0, 3.5], ev: [t * 0.64, 0, 6], ac: [t + 0.4, 0, -3.5], ...labelAt };
  label(L_('PV · planlanan değer', 'PV · planned value'), P(L.pv[0], sc.pv(L.pv[0]), L.pv[1]).add(up(L.pv[2])), 'pv', 0.45);
  label(L_('EV · kazanılmış değer', 'EV · earned value'), P(L.ev[0], sc.ev(L.ev[0]), L.ev[1]).add(up(L.ev[2])), 'ev', 0.6);
  if (ac) label(L_('AC · gerçekleşen maliyet', 'AC · actual cost'), P(L.ac[0], sc.ac(t), L.ac[1]).add(up(L.ac[2])), 'ac', 0.7);
  label(L_('Bugün · ay ', 'Today · month ') + fmt(t, 0), P(t, 112).add(up(1.5)), 'today', 0.75);
  if (es) {
    label(L_(`ES · kazanılan zaman: ay ${fmt(sc.es, 1)}`, `ES · earned schedule: month ${fmt(sc.es, 1)}`), P(sc.es * 0.55, 0, -5).add(up(2)), 'ev', 0.8);
    label(L_(`plana göre bugün: ay ${fmt(t, 0)}`, `planned for today: month ${fmt(t, 0)}`), P(t * 0.3, 0, 5).add(up(-8.5)), 'pv', 0.8);
    label(L_(`${fmt(t - sc.es, 1)} ay geride`, `${fmt(t - sc.es, 1)} months behind`), P((sc.es + t) / 2, sc.ev(t)).add(up(4)), 'gap', 0.8);
  }
  // Indicator cards: same card in every scene; they appear once the curves are drawn.
  kpis.forEach((k, i) => label(`${k.name} <b>${k.value}</b><span>${k.sub}</span>`, P(k.m ?? t + 5, k.v ?? 46 - i * 32), `kpi ${k.tone || ''}`, 0.74 + i * 0.05));

  // Phones: the chart is too small for labels on the curves, so the names and indices sit in a strip above it instead.
  if (!document.getElementById('evm-strip-css')) {
    const st = document.createElement('style');
    st.id = 'evm-strip-css';
    st.textContent = `.evm-strip { display: none; }
@media (max-width: 600px) {
  .evm-label.pv, .evm-label.ev, .evm-label.ac, .evm-label.fc, .evm-label.kpi { display: none; }
  .evm-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 12px; position: fixed; left: 12px; right: 12px; top: 72px; z-index: 2; pointer-events: none;
    font: 600 11px/1.3 system-ui, sans-serif; color: #e6edf7; text-shadow: 0 1px 6px #07111F; }
  .evm-strip > span { transition: opacity .35s; white-space: nowrap; }
  .evm-strip i { display: inline-block; width: 12px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 5px; }
  .evm-strip .kpi { background: rgba(7, 17, 31, .85); border: 1px solid #35C7E8; border-radius: 8px; padding: 3px 8px; }
  .evm-strip .kpi b { color: #67e8f9; font-size: 14px; margin-left: 4px; }
  .evm-strip .kpi.good { border-color: #4ade80; } .evm-strip .kpi.good b { color: #4ade80; }
  .evm-strip .kpi.warn { border-color: #fbbf24; } .evm-strip .kpi.warn b { color: #fcd34d; }
  .evm-strip .kpi.bad { border-color: #f87171; } .evm-strip .kpi.bad b { color: #f87171; }
  .evm-strip .row { flex-basis: 100%; height: 0; }
}`;
    document.head.appendChild(st);
  }
  const strip = document.createElement('div');
  strip.className = 'evm-strip';
  strip.setAttribute('aria-hidden', 'true');
  const chips = [];
  const chip = (html, at, cls = '') => { const s = document.createElement('span'); s.className = cls; s.innerHTML = html; strip.appendChild(s); chips.push([s, at]); };
  chip(`<i style="background:#8FDCF0"></i>${L_('PV planlanan', 'PV planned')}`, 0.45);
  chip(`<i style="background:#67e8f9"></i>${L_('EV kazanılmış', 'EV earned')}`, 0.6);
  if (ac) chip(`<i style="background:#fcd34d"></i>${L_('AC gerçekleşen', 'AC actual')}`, 0.7);
  if (es) chip(`<i style="background:#67e8f9"></i>${L_('ES ay', 'ES month')} ${fmt(sc.es, 1)}`, 0.8);
  strip.appendChild(Object.assign(document.createElement('span'), { className: 'row' }));
  kpis.forEach((k, i) => chip(`${k.name}<b>${k.value}</b>`, 0.74 + i * 0.05, `kpi ${k.tone || ''}`));
  document.body.appendChild(strip);
  label(L_('tahmin', 'forecast'), P((t + sc.earnedEnd) / 2, sc.ev((t + sc.earnedEnd) / 2)).add(up(2.4)), 'fc', 0.92);
  label(pct(100), P(-0.9, 100), 'axis', 0.05);
  label(pct(50), P(-0.9, 50), 'axis', 0.05);
  for (let m = 0; m <= sc.months; m += 5) label(m === 0 ? L_('ay 0', 'month 0') : String(m), P(m, 0).add(up(-4.5)), 'axis', 0.05);

  // k: build-up 0..1; fade: overall opacity 0..1.
  function set(k, fade = 1) {
    g.visible = k > 0 && fade > 0.01;
    for (const m of mats) m.opacity = m.userData.base * fade;
    cols.forEach((c, i) => {
      const a = 0.1 + (0.35 * i) / cols.length;
      const kk = ramp(k, a, a + 0.15);
      c.visible = kk > 0.001;
      c.scale.y = Math.max(kk * c.userData.h, 0.001);
    });
    const pvK = ramp(k, 0.15, 0.55);
    pvDashes.forEach((d, i) => (d.visible = i / pvDashes.length < pvK));
    reveal(evLine, ramp(k, 0.3, 0.65));
    if (acLine) reveal(acLine, ramp(k, 0.4, 0.72));
    todayLine.visible = k > 0.74;
    if (es) {
      esGroup.visible = k > 0.76;
      esGroup.userData.bars.forEach(b => b.scale.set(Math.max(ramp(k, 0.76, 0.86) * b.userData.full, 0.001), 1, 1));
    }
    const fcK = ramp(k, 0.88, 1);
    fcDashes.forEach((d, i) => (d.visible = fcK > 0 && i / fcDashes.length < fcK));
    for (const l of labels) {
      l.element.style.opacity = k >= l.userData.at ? fade : 0;
      l.visible = g.visible;
    }
    for (const [s, at] of chips) s.style.opacity = g.visible && k >= at ? fade : 0;
  }
  set(0);
  return { group: g, set, cols, P };
}
