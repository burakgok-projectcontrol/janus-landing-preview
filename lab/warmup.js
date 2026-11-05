import * as THREE from 'three';

// Prepares a scene before it is shown: shaders, first draws and GPU uploads, spread over many short tasks so the page
// never freezes for long while a scene starts (one big first frame used to block it for 0.5–1.7 s).
// - Compiles for the target the scene is really drawn into: with post-processing that is the composer's buffer
//   (linear colour, no tone mapping), so the canvas variants of every shader are not built for nothing.
// - Draws the scene one material at a time (everything else hidden, lights kept), yielding to the browser whenever
//   a slice has run for about BUDGET ms. Hidden and off-screen objects are included, so nothing compiles later.
const BUDGET = 25, CHUNK = 40;
// Lets the browser run other work (input, the page's own frames) between start-up slices.
export const pause = () => new Promise(r => setTimeout(r, 0));

export async function warmUp(renderer, scene, camera, post = null) {
  const shown = [], uncull = [], meshes = [];
  scene.traverse(o => {
    if (!o.visible) { shown.push(o); o.visible = true; }
    if (o.frustumCulled) { uncull.push(o); o.frustumCulled = false; }
    if (o.isMesh || o.isLine || o.isPoints || o.isSprite) meshes.push(o);
  });
  const target = post ? post.target : null;
  renderer.setRenderTarget(target);
  await renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(null);

  // Textures go up one by one (a large one can take ~100 ms on its own).
  let t = performance.now();
  const textures = new Set();
  for (const o of meshes) for (const m of [].concat(o.material)) if (m) for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v);
  for (const tex of textures) {
    if (performance.now() - t > BUDGET) { await pause(); t = performance.now(); }
    renderer.initTexture(tex);
  }

  // Group the drawables by material (at most CHUNK per group, so geometry uploads are spread too), then draw group
  // after group.
  const groups = [], byMat = new Map();
  for (const o of meshes) {
    const k = [].concat(o.material).map(m => m && m.uuid).join();
    let list = byMat.get(k);
    if (!list || list.length >= CHUNK) { list = []; byMat.set(k, list); groups.push(list); }
    list.push(o);
  }
  for (const o of meshes) o.visible = false;
  for (const list of groups) {
    if (performance.now() - t > BUDGET) { await pause(); t = performance.now(); }
    for (const o of list) o.visible = true;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    for (const o of list) o.visible = false;
  }
  renderer.setRenderTarget(null);
  for (const o of meshes) o.visible = true;

  // Post-processing shaders (bloom, output) get the same treatment, then one full frame.
  if (post) {
    const q = new THREE.Scene(), geo = new THREE.PlaneGeometry(2, 2), seen = new Set();
    for (const p of post.composer.passes) for (const v of Object.values(p)) for (const x of [].concat(v)) {
      if (x && x.isMaterial && !seen.has(x)) { seen.add(x); const m = new THREE.Mesh(geo, x); m.frustumCulled = false; q.add(m); }
    }
    await renderer.compileAsync(q, camera);
    // A tiny target is enough for a first draw; the composer's own buffers are drawn by the full frame below.
    const tiny = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    renderer.setRenderTarget(tiny);
    for (const m of q.children) m.visible = false;
    for (const m of q.children) { await pause(); m.visible = true; renderer.render(q, camera); m.visible = false; }
    renderer.setRenderTarget(null);
    tiny.dispose();
    geo.dispose();
  }
  await pause();
  if (post) post.render(); else renderer.render(scene, camera);
  shown.forEach(o => { o.visible = false; });
  uncull.forEach(o => { o.frustumCulled = true; });
}
