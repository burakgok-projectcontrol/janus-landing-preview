// Blueprint drawing sheet shown behind the EVM charts: grid paper, frames, a title block and a
// technical drawing of the scene's project (dam section, runway plan, tower elevation), drawn on a canvas.
import * as THREE from 'three';
import { t, num } from './i18n.js';

let W = 2048; // follows the screen's aspect (redrawn in place())
const H = 1152;
const INK = a => `rgba(170, 214, 255, ${a})`;
const fmtM = v => num(v);

function base(ctx, kind, frame = true) {
  ctx.fillStyle = 'rgba(18, 52, 112, 0.35)';
  ctx.fillRect(0, 0, W, H);
  // The sheet behind a chart is only paper and drawing: the screen backdrop already has the grid, frame, title
  // block and north arrow, and a second, offset set looked like a double image.
  if (!frame) return;
  for (const [step, a] of [[32, 0.07], [160, 0.16]]) {
    ctx.strokeStyle = INK(a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
  }
  ctx.strokeStyle = INK(0.7);
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(56, 56, W - 112, H - 112);
  // Zone marks along the frame.
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillStyle = INK(0.55);
  ctx.textAlign = 'center';
  for (let i = 0; i < 8; i++) { const x = 56 + ((W - 112) * (i + 0.5)) / 8; ctx.fillText(String(i + 1), x, 50); ctx.fillText(String(i + 1), x, H - 30); }
  for (let i = 0; i < 4; i++) { const y = 56 + ((H - 112) * (i + 0.5)) / 4 + 8; ctx.fillText('ABCD'[i], 48, y); ctx.fillText('ABCD'[i], W - 48, y); }
  // Title block.
  const tw = 640, th = 200, tx = W - 56 - tw, ty = H - 56 - th;
  ctx.fillStyle = 'rgba(7, 17, 31, 0.6)';
  ctx.fillRect(tx, ty, tw, th);
  ctx.strokeStyle = INK(0.7);
  ctx.lineWidth = 2;
  ctx.strokeRect(tx, ty, tw, th);
  ctx.beginPath();
  for (const y of [50, 110, 160]) { ctx.moveTo(tx, ty + y); ctx.lineTo(tx + tw, ty + y); }
  ctx.moveTo(tx + 200, ty); ctx.lineTo(tx + 200, ty + 50);
  ctx.moveTo(tx + 220, ty + 110); ctx.lineTo(tx + 220, ty + 160);
  ctx.moveTo(tx + 430, ty + 110); ctx.lineTo(tx + 430, ty + 160);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = INK(0.9);
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('JANUS', tx + 20, ty + 36);
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText(t('PROJE KONTROL PAFTASI', 'PROJECT CONTROL SHEET'), tx + 220, ty + 34);
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(kind.title, tx + 20, ty + 90);
  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillText(`${t('Ölçek', 'Scale')} ${kind.scale}`, tx + 20, ty + 142);
  ctx.fillText(`${t('Pafta', 'Sheet')} ${kind.sheet}`, tx + 240, ty + 142);
  ctx.fillText('Rev. 0', tx + 450, ty + 142);
  ctx.fillStyle = INK(0.6);
  ctx.fillText(t('ÖRNEK SENARYO · TEMSİLÎ ÇİZİM', 'SAMPLE SCENARIO · ILLUSTRATIVE DRAWING'), tx + 20, ty + 188);
  // North arrow.
  const nx = 150, ny = 170;
  ctx.strokeStyle = INK(0.7);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(nx, ny, 46, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(nx, ny - 40); ctx.lineTo(nx + 16, ny + 24); ctx.lineTo(nx, ny + 12); ctx.lineTo(nx - 16, ny + 24); ctx.closePath();
  ctx.fillStyle = INK(0.6); ctx.fill();
  ctx.font = '700 24px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = INK(0.85);
  ctx.fillText('K', nx, ny - 56);
}

// Dimension line between (x1,y1) and (x2,y2), drawn at an offset with architectural ticks.
function dim(ctx, x1, y1, x2, y2, text, off = 40) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  const a = [x1 + nx * off, y1 + ny * off], b = [x2 + nx * off, y2 + ny * off];
  ctx.strokeStyle = INK(0.65);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * 8, y1 + ny * 8); ctx.lineTo(a[0] + nx * 10, a[1] + ny * 10);
  ctx.moveTo(x2 + nx * 8, y2 + ny * 8); ctx.lineTo(b[0] + nx * 10, b[1] + ny * 10);
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  for (const p of [a, b]) { ctx.moveTo(p[0] - 9, p[1] + 9); ctx.lineTo(p[0] + 9, p[1] - 9); }
  ctx.stroke();
  ctx.save();
  ctx.translate((a[0] + b[0]) / 2 + nx * 16, (a[1] + b[1]) / 2 + ny * 16);
  let ang = Math.atan2(dy, dx);
  if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
  ctx.rotate(ang);
  ctx.font = '600 22px ui-monospace, Consolas, monospace';
  ctx.fillStyle = INK(0.85);
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 7);
  ctx.restore();
}
function hatch(ctx, path, gap = 14, a = 0.25) {
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = INK(a);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -H; x < W; x += gap) { ctx.moveTo(x, H); ctx.lineTo(x + H, 0); }
  ctx.stroke();
  ctx.restore();
}
function label(ctx, text, x, y, size = 26, a = 0.85) {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.fillStyle = INK(a);
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}
function level(ctx, x, y, text) {
  ctx.strokeStyle = INK(0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 60, y); ctx.lineTo(x + 30, y); ctx.moveTo(x, y); ctx.lineTo(x - 10, y - 16); ctx.lineTo(x + 10, y - 16); ctx.closePath(); ctx.stroke();
  ctx.font = '600 20px ui-monospace, Consolas, monospace'; ctx.fillStyle = INK(0.85); ctx.textAlign = 'left';
  ctx.fillText(text, x + 36, y + 7);
}

const DRAW = {
  dam(ctx) {
    // A-A cross-section, 18 px per metre: crest 6, height 15, slopes 1:1,3 and 1:1,2.
    const s = 18, ox = 520, oy = 940, Hm = 15, cw = 6, su = 1.3, sd = 1.2;
    const P = (x, y) => [ox + x * s, oy - y * s];
    const pts = [P(-(cw / 2 + su * Hm), 0), P(-cw / 2, Hm), P(cw / 2, Hm), P(cw / 2 + sd * Hm, 0)];
    const body = new Path2D();
    body.moveTo(...pts[0]); pts.slice(1).forEach(p => body.lineTo(...p)); body.closePath();
    ctx.strokeStyle = INK(0.9); ctx.lineWidth = 3; ctx.stroke(body);
    hatch(ctx, body, 22, 0.12);
    const core = new Path2D();
    [P(-4, 0), P(-1, Hm - 0.6), P(1, Hm - 0.6), P(4, 0)].forEach((p, i) => (i ? core.lineTo(...p) : core.moveTo(...p)));
    core.closePath();
    ctx.lineWidth = 2; ctx.stroke(core);
    hatch(ctx, core, 8, 0.4);
    // Ground with hatch, upstream water with level symbol.
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox - 560, oy); ctx.lineTo(ox + 520, oy); ctx.stroke();
    const ground = new Path2D(); ground.rect(ox - 560, oy, 1080, 26); hatch(ctx, ground, 10, 0.35);
    const wl = P(-(cw / 2 + su * 2), Hm - 2);
    ctx.setLineDash([16, 10]);
    ctx.beginPath(); ctx.moveTo(ox - 560, wl[1]); ctx.lineTo(wl[0], wl[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ox - 420, wl[1] - 4); ctx.lineTo(ox - 436, wl[1] - 26); ctx.lineTo(ox - 404, wl[1] - 26); ctx.closePath(); ctx.stroke();
    label(ctx, t('MEMBA', 'UPSTREAM'), ox - 540, wl[1] - 40, 20, 0.7);
    label(ctx, t('MANSAP', 'DOWNSTREAM'), ox + 330, oy - 40, 20, 0.7);
    dim(ctx, ...P(-cw / 2, Hm), ...P(cw / 2, Hm), fmtM(cw), -40);
    dim(ctx, ...P(cw / 2 + sd * Hm, 0), ...P(cw / 2 + sd * Hm, Hm), fmtM(Hm), -60);
    dim(ctx, ...P(-(cw / 2 + su * Hm), 0), ...P(cw / 2 + sd * Hm, 0), fmtM(cw + (su + sd) * Hm), 70);
    label(ctx, t('1:1,3', '1:1.3'), ...P(-cw / 2 - su * Hm * 0.62, Hm * 0.5), 22, 0.75);
    label(ctx, t('1:1,2', '1:1.2'), ...P(cw / 2 + sd * Hm * 0.38, Hm * 0.55), 22, 0.75);
    label(ctx, t('KİL ÇEKİRDEK', 'CLAY CORE'), ...P(-2.4, 4), 18, 0.7);
    label(ctx, t('A-A EN KESİT', 'SECTION A-A'), ox - 560, oy - Hm * s - 90, 34);
  },
  airport(ctx) {
    const ox = 140, oy = 860, len = 1500, wid = 96;
    label(ctx, t('PİST VE APRON PLANI', 'RUNWAY AND APRON PLAN'), ox, 330, 34);
    ctx.strokeStyle = INK(0.9); ctx.lineWidth = 3;
    ctx.strokeRect(ox, oy, len, wid);
    ctx.lineWidth = 3; ctx.setLineDash([40, 30]);
    ctx.beginPath(); ctx.moveTo(ox + 150, oy + wid / 2); ctx.lineTo(ox + len - 150, oy + wid / 2); ctx.stroke();
    ctx.setLineDash([]);
    for (const end of [ox + 20, ox + len - 60]) for (let k = 0; k < 8; k++) ctx.strokeRect(end, oy + 10 + k * 10.5, 40, 4);
    ctx.font = '800 40px system-ui, sans-serif'; ctx.fillStyle = INK(0.8); ctx.textAlign = 'center';
    ctx.fillText('09', ox + 110, oy + wid / 2 + 14); ctx.fillText('27', ox + len - 110, oy + wid / 2 + 14);
    dim(ctx, ox, oy + wid, ox + len, oy + wid, '120,00', 60);
    dim(ctx, ox + len, oy, ox + len, oy + wid, '12,00', -50);
    // Taxiway, apron, terminal, tower.
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 1000, oy - 140, 70, 140);
    ctx.strokeRect(ox + 540, oy - 260, 700, 120);
    const term = new Path2D(); term.rect(ox + 420, oy - 470, 640, 190);
    ctx.lineWidth = 3; ctx.stroke(term); hatch(ctx, term, 16, 0.18);
    ctx.beginPath(); ctx.arc(ox + 1240, oy - 400, 44, 0, Math.PI * 2); ctx.stroke();
    label(ctx, t('TERMİNAL', 'TERMINAL'), ox + 650, oy - 365, 24, 0.8);
    label(ctx, 'APRON', ox + 840, oy - 190, 22, 0.7);
    label(ctx, t('KULE', 'TOWER'), ox + 1210, oy - 335, 20, 0.7);
    label(ctx, t('TAKSİ YOLU', 'TAXIWAY'), ox + 1085, oy - 60, 18, 0.7);
    dim(ctx, ox + 420, oy - 470, ox + 1060, oy - 470, '52,00', -40);
  },
  tower(ctx) {
    // Elevation: 20 floors x 3,50 m, 14 px per metre.
    const s = 11, ox = 260, oy = 1020, w = 18 * s, floors = 20, fh = 3.5;
    label(ctx, t('GÖRÜNÜŞ', 'ELEVATION'), ox - 60, oy - floors * fh * s - 150, 34);
    ctx.strokeStyle = INK(0.9); ctx.lineWidth = 3;
    ctx.strokeRect(ox, oy - floors * fh * s, w, floors * fh * s);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 1; i < floors; i++) { const y = oy - i * fh * s; ctx.moveTo(ox, y); ctx.lineTo(ox + w, y); }
    for (let k = 1; k < 6; k++) { ctx.moveTo(ox + (w * k) / 6, oy); ctx.lineTo(ox + (w * k) / 6, oy - floors * fh * s); }
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ox + w * 0.18, oy - floors * fh * s - 52, w * 0.64, 52);
    ctx.beginPath(); ctx.moveTo(ox + w / 2, oy - floors * fh * s - 52); ctx.lineTo(ox + w / 2, oy - floors * fh * s - 160); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox - 120, oy); ctx.lineTo(ox + w + 300, oy); ctx.stroke();
    const g = new Path2D(); g.rect(ox - 120, oy, w + 420, 24); hatch(ctx, g, 10, 0.35);
    for (const [y, t] of [[0, '±0,00'], [10 * fh, '+35,00'], [floors * fh, '+70,00']]) level(ctx, ox + w + 90, oy - y * s, t);
    dim(ctx, ox, oy - floors * fh * s, ox + w, oy - floors * fh * s, '18,00', -40);
    // Typical floor plan.
    const px = 820, py = 620, ps = 16, pw = 18 * ps;
    label(ctx, t('NORMAL KAT PLANI', 'TYPICAL FLOOR PLAN'), px, py - 50, 28);
    ctx.lineWidth = 3; ctx.strokeRect(px, py, pw, pw);
    const core = new Path2D(); core.rect(px + pw / 2 - 3 * ps, py + pw / 2 - 3 * ps, 6 * ps, 6 * ps);
    ctx.lineWidth = 2; ctx.stroke(core); hatch(ctx, core, 8, 0.4);
    for (const a of [0, 1 / 3, 2 / 3, 1]) for (const b of [0, 1 / 3, 2 / 3, 1]) if (a % 1 === 0 || b % 1 === 0) ctx.strokeRect(px + a * pw - 6, py + b * pw - 6, 12, 12);
    ctx.setLineDash([10, 8]); ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const a of [1 / 3, 2 / 3]) { ctx.moveTo(px + a * pw, py - 30); ctx.lineTo(px + a * pw, py + pw + 30); ctx.moveTo(px - 30, py + a * pw); ctx.lineTo(px + pw + 30, py + a * pw); }
    ctx.stroke(); ctx.setLineDash([]);
    dim(ctx, px, py + pw, px + pw, py + pw, '18,00', 50);
    label(ctx, t('ÇEKİRDEK', 'CORE'), px + pw / 2 - 52, py + pw / 2 + 8, 18, 0.75);
  },
  metro(ctx) {
    // Tunnel cross-section A-A, 62 px per metre: lining 6,30 / 5,70, six segments and a key per ring, track and walkway.
    const s = 62, ox = 420, oy = 600, ro = 3.15 * s, ri = 2.85 * s;
    label(ctx, t('A-A TÜNEL EN KESİTİ', 'TUNNEL CROSS-SECTION A-A'), ox - 300, oy - ro - 110, 34);
    const ring = new Path2D();
    ring.arc(ox, oy, ro, 0, Math.PI * 2);
    ring.moveTo(ox + ri, oy);
    ring.arc(ox, oy, ri, 0, Math.PI * 2, true);
    ctx.strokeStyle = INK(0.9); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ox, oy, ro, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(ox, oy, ri, 0, Math.PI * 2); ctx.stroke();
    hatch(ctx, ring, 9, 0.4);
    // Segment joints: six segments and a smaller key at the crown.
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const a of [-80, -100, -20, 40, 100, 160, 220].map(d => (d * Math.PI) / 180)) { ctx.moveTo(ox + Math.cos(a) * ri, oy + Math.sin(a) * ri); ctx.lineTo(ox + Math.cos(a) * ro, oy + Math.sin(a) * ro); }
    ctx.stroke();
    // Invert fill, track and walkway.
    const yb = oy + ri * 0.62, half = Math.sqrt(ri * ri - (ri * 0.62) ** 2);
    const inv = new Path2D();
    inv.moveTo(ox - half, yb);
    inv.lineTo(ox + half, yb);
    inv.arc(ox, oy, ri, Math.asin(0.62), Math.PI - Math.asin(0.62));
    inv.closePath();
    ctx.lineWidth = 2; ctx.stroke(inv); hatch(ctx, inv, 14, 0.25);
    ctx.fillStyle = INK(0.8);
    for (const x of [-0.72, 0.72]) ctx.fillRect(ox + x * s - 6, yb - 10, 12, 10);
    ctx.strokeRect(ox + 1.7 * s, yb - 0.9 * s, 0.9 * s, 0.9 * s);
    label(ctx, t('YÜRÜME YOLU', 'WALKWAY'), ox + 1.55 * s, yb - 1.1 * s, 16, 0.7);
    // Centre lines.
    ctx.setLineDash([18, 8, 4, 8]); ctx.lineWidth = 1.2; ctx.strokeStyle = INK(0.5);
    ctx.beginPath(); ctx.moveTo(ox - ro - 40, oy); ctx.lineTo(ox + ro + 40, oy); ctx.moveTo(ox, oy - ro - 40); ctx.lineTo(ox, oy + ro + 40); ctx.stroke();
    ctx.setLineDash([]);
    dim(ctx, ox - ro, oy + ro, ox + ro, oy + ro, `Ø ${num(6.3)}`, 60);
    label(ctx, `Ø ${t('iç', 'inner')} ${num(5.7)}`, ox - 70, oy - 30, 20, 0.8);
    label(ctx, t('1 HALKA = 6 SEGMENT + ANAHTAR · 1,50 m', '1 RING = 6 SEGMENTS + KEY · 1.50 m'), ox - 300, oy + ro + 150, 20, 0.75);
  },
};
const KIND = {
  dam: { title: t('Baraj gövdesi · en kesit', 'Dam body · cross-section'), scale: '1:500', sheet: '01/04', fit: 1120 },
  airport: { title: t('Pist ve apron · vaziyet planı', 'Runway and apron · site plan'), scale: '1:2000', sheet: '02/04', fit: 1720 },
  tower: { title: t('Gökdelen · görünüş ve kat planı', 'Tower · elevation and floor plan'), scale: '1:500', sheet: '04/04', fit: 1180 },
  metro: { title: t('Metro tüneli · en kesit', 'Metro tunnel · cross-section'), scale: '1:100', sheet: '03/04', fit: 1250 },
};

export function createSheet(kind) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const draw = width => {
    W = canvas.width = width;
    canvas.height = H;
    base(ctx, KIND[kind], false);
    // The drawing lives in the left third (behind the caption); the chart covers the rest of the sheet. The sheet is
    // 1.4 times as wide as the view, so the drawing starts where the view does (about 15 % in).
    const k = Math.min(1, (W * 0.34) / KIND[kind].fit);
    ctx.save();
    ctx.translate(W * 0.15 + 40 * (1 - k), (H - 120) * (1 - k));
    ctx.scale(k, k);
    DRAW[kind](ctx);
    ctx.restore();
  };
  draw(2048);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = -1;
  mesh.visible = false;
  // Stand the sheet behind the chart, facing the chart camera, large enough to fill the view.
  function place(camera, target, dir, dist, back = 110) {
    const d = dist + back;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d * 1.06;
    const w = h * camera.aspect * 1.4; // extra width: the landing page shifts the view sideways
    const width = Math.round(Math.min(4096, Math.max(1600, (H * w) / h)));
    // A new size needs a new GPU texture (the old storage keeps its size): dispose, then upload again.
    if (width !== canvas.width) { draw(width); tex.dispose(); tex.needsUpdate = true; }
    mesh.scale.set(w, h, 1);
    mesh.position.copy(target).addScaledVector(dir, -back);
    mesh.lookAt(mesh.position.clone().add(dir));
  }
  function set(o) { mat.opacity = o; mesh.visible = o > 0.01; }
  return { mesh, place, set };
}

// Screen background for the blueprint look: grid paper, frame, zone marks and title block, no drawing.
// It is used as scene.background (stretched to the screen), so it is redrawn for the screen's aspect.
const BACKDROP = {
  dam: { title: t('Baraj · yapım sahası', 'Dam · construction site'), scale: '1:1000', sheet: '01/04' },
  airport: { title: t('Havalimanı · yapım sahası', 'Airport · construction site'), scale: '1:2500', sheet: '02/04' },
  tower: { title: t('Gökdelen · yapım sahası', 'Tower · construction site'), scale: '1:1000', sheet: '04/04' },
  metro: { title: t('Metro · tünel boy kesiti', 'Metro · tunnel long section'), scale: '1:2500', sheet: '03/04' },
};
export function createBackdrop(kind) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  let last = 0;
  function resize(aspect) {
    const width = Math.round(Math.min(4096, Math.max(900, H * aspect)));
    if (width === last) return;
    last = width;
    W = canvas.width = width;
    canvas.height = H;
    ctx.fillStyle = '#07111F';
    ctx.fillRect(0, 0, W, H);
    base(ctx, BACKDROP[kind]);
    texture.dispose(); // new size: let three.js allocate a new GPU texture
    texture.needsUpdate = true;
  }
  resize(innerWidth / Math.max(innerHeight, 1));
  return { texture, resize };
}
