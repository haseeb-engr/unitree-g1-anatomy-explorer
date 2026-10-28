// Records a scripted walkthrough of dist/Unitree_G1_Anatomy_Explorer.html as PNG/JPEG frames
// at a fixed 30 fps (the page clock is replaced, so slow rendering does not change timing).
// Usage: node --experimental-websocket build/record_video.mjs <framesDir> [width] [height]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'dist', 'Unitree_G1_Anatomy_Explorer.html');
const framesDir = process.argv[2];
const W = +(process.argv[3] || 1920), H = +(process.argv[4] || 1080);
const FPS = 30, DURATION = 43;
rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true });

const PORT = 9355;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'g1rec-'))}`,
  '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, nextId = 1; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const id = nextId++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

// Fake clock: performance.now and requestAnimationFrame advance only when __tick() is called.
const CLOCK = `(() => { let t = 0; const q = [];
  performance.now = () => t;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__tick = (dt) => { t += dt; q.splice(0).forEach((cb) => cb(t)); };
})();`;

// Timeline, run inside the page once per frame with the video time in seconds.
function timeline() {
  const g = window.__g1, T = THREE;
  const css = document.createElement('style');
  css.textContent = `
    #hint, #views { display: none !important; }
    .rec { position: absolute; z-index: 40; pointer-events: none; opacity: 0; }
    #rec-title { left: 7%; top: 30%; color: #e4ebf2; }
    #rec-title b { display: block; font: 700 104px/0.95 var(--display); letter-spacing: 0.03em; text-transform: uppercase; }
    #rec-title i { display: block; font: 600 54px/1.1 var(--display); letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); font-style: normal; margin-top: 6px; }
    #rec-title span { display: block; margin-top: 22px; font: 400 22px/1.5 var(--mono); color: #b9c6d3; }
    #rec-cap { left: 50%; bottom: 46px; transform: translateX(-50%); text-align: center; background: rgba(10,14,19,0.86); border: 1px solid #2b3846; border-radius: 14px; padding: 14px 28px 16px; white-space: nowrap; }
    #rec-cap b { display: block; font: 700 38px/1.1 var(--display); letter-spacing: 0.05em; text-transform: uppercase; color: #e4ebf2; }
    #rec-cap span { display: block; margin-top: 6px; font: 400 19px/1.3 var(--mono); color: #f0a63a; }
    #rec-cursor { left: 0; top: 0; width: 34px; height: 34px; z-index: 45; }
    #rec-ring { left: 0; top: 0; width: 56px; height: 56px; margin: -28px 0 0 -28px; border: 4px solid #f0a63a; border-radius: 50%; z-index: 44; }
    #rec-end { inset: 0; display: grid; place-items: center; background: radial-gradient(circle at 50% 45%, rgba(18,26,35,0.92), rgba(6,9,12,0.97)); z-index: 50; text-align: center; color: #e4ebf2; }
    #rec-end b { display: block; font: 700 96px/1 var(--display); letter-spacing: 0.03em; text-transform: uppercase; }
    #rec-end i { display: block; font: 600 50px/1.1 var(--display); letter-spacing: 0.08em; text-transform: uppercase; color: #f0a63a; font-style: normal; margin-top: 8px; }
    #rec-end p { margin: 34px 0 0; font: 400 24px/1.6 var(--mono); color: #b9c6d3; }
    #rec-end p.cr { margin-top: 40px; font-size: 21px; color: #8d9cac; }
    #rec-end p.cr strong { color: #e4ebf2; font-weight: 500; }`;
  document.head.appendChild(css);
  const add = (id, html) => { const d = document.createElement('div'); d.id = id; d.className = 'rec'; d.innerHTML = html; document.getElementById('app').appendChild(d); return d; };
  const title = add('rec-title', '<b>Unitree G1</b><i>Anatomy Explorer</i><span>Interactive 3D · built from Unitree’s official URDF<br>29 joints · 34 official meshes</span>');
  const cap = add('rec-cap', '<b></b><span></span>');
  const cursor = add('rec-cursor', '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L18 14 Z" fill="#fff" stroke="#0b0f14" stroke-width="1.6" stroke-linejoin="round"/></svg>');
  const ring = add('rec-ring', '');
  const end = add('rec-end', '<div><b>Unitree G1</b><i>Anatomy Explorer</i><p>Real · 3D · Skeleton · Blueprint<br>Click any joint, actuator, circuit or wire</p><p class="cr">Powered by <strong>Fraunhofer IOSB-INA</strong><br>Developed by <strong>muhammad.haseeb@iosb-ina.fraunhofer.de</strong></p></div>');

  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const ramp = (t, a, b, fade = 0.4) => Math.max(0, Math.min(1, (t - a) / fade, (b - t) / fade));
  const caps = [
    [4.6, 7.9, 'Real', 'Official Unitree G1 meshes, realistic finish'],
    [8.1, 11.4, '3D', 'Colour-coded assemblies: legs, arms, waist, torso, head'],
    [11.6, 14.3, 'Skeleton', '29 joint axes · red X · green Y · blue Z'],
    [14.5, 18.3, 'Click any joint', 'Axis, range, torque, motor family, live angle'],
    [18.6, 22.0, 'Blueprint', 'Engineering X-ray: actuators, circuit boards, wiring'],
    [23.2, 28.3, 'Every part is clickable', 'Actuator module: motor, gears, encoders, driver board'],
    [28.5, 31.7, 'Colour-coded wiring', 'Power · motor bus · Ethernet · sensor data'],
    [32.0, 35.7, 'Wiring follows the motion', 'Kinematic walk cycle'],
    [36.0, 38.8, 'Runs in any browser', 'One HTML file · works offline · no installation']
  ];
  const screenOf = (v) => { const p = v.clone().project(g.cam()); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
  const jointPos = (n) => g.RJ.find((j) => j.name === n).frame.getWorldPosition(new T.Vector3());
  let cur = [innerWidth * 0.82, innerHeight * 0.9], from = cur, to = cur, mv = null, clickAt = -1;
  const moveTo = (t, target, dur) => { from = cur; to = target; mv = [t, dur]; };
  const done = new Set();
  const once = (t, at, id, fn) => { if (t >= at && !done.has(id)) { done.add(id); fn(); } };
  const ins = document.getElementById('inspector');
  let scroll = null;

  window.__recFrame = (t) => {
    once(t, 8.0, 'solid', () => g.setMode('solid'));
    once(t, 11.5, 'skel', () => g.setMode('skeleton'));
    once(t, 12.8, 'stopspin', () => { g.controls.autoRotate = false; });
    once(t, 13.0, 'mv1', () => moveTo(t, screenOf(jointPos('left_knee_joint')), 1.2));
    once(t, 14.3, 'click1', () => { clickAt = t; g.select({ kind: 'joint', id: 'left_knee_joint' }); });
    once(t, 14.7, 'sweep', () => document.getElementById('ins-sweep').click());
    once(t, 18.4, 'bp', () => { g.select(null); g.setMode('blueprint'); });
    once(t, 20.0, 'bp34', () => g.goView('persp'));
    once(t, 22.0, 'mv2', () => moveTo(t, screenOf(jointPos('left_knee_joint')), 1.0));
    once(t, 23.1, 'click2', () => { clickAt = t; g.select({ kind: 'module', id: 'left_knee_joint' }); });
    once(t, 24.8, 'scroll', () => { const f = ins.querySelector('svg.foc'); scroll = [t, ins.scrollTop, ins.scrollTop + f.getBoundingClientRect().top - ins.getBoundingClientRect().top - 140]; });
    once(t, 27.0, 'mv3', () => {
      const a = jointPos('left_hip_yaw_joint'), b = jointPos('left_knee_joint');
      moveTo(t, screenOf(a.lerp(b, 0.55)), 0.9);
    });
    once(t, 28.0, 'click3', () => { clickAt = t; g.select({ kind: 'path', id: 'bus-leg-left' }); });
    once(t, 31.8, 'walk', () => { g.select(null); g.runPreset(5); g.controls.autoRotateSpeed = 1.6; g.controls.autoRotate = true; });
    once(t, 35.8, 'real', () => g.setMode('real'));

    if (mv) { const k = Math.min(1, (t - mv[0]) / mv[1]), e = ease(k); cur = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]; if (k >= 1) mv = null; }
    cursor.style.opacity = ramp(t, 12.9, 31.9, 0.3);
    cursor.style.transform = 'translate(' + (cur[0] - 6) + 'px,' + (cur[1] - 3) + 'px)';
    const ck = clickAt < 0 ? 1 : (t - clickAt) / 0.45;
    ring.style.opacity = ck < 1 ? (1 - ck) : 0;
    ring.style.transform = 'translate(' + cur[0] + 'px,' + cur[1] + 'px) scale(' + (0.4 + ck * 1.1) + ')';
    if (scroll) { const k = Math.min(1, (t - scroll[0]) / 1.6); ins.scrollTop = scroll[1] + (scroll[2] - scroll[1]) * ease(k); if (k >= 1) scroll = null; }

    title.style.opacity = ramp(t, 0.3, 4.3, 0.6);
    const c = caps.find(([a, b]) => t >= a - 0.01 && t <= b + 0.01);
    if (c) { cap.querySelector('b').textContent = c[2]; cap.querySelector('span').textContent = c[3]; cap.style.opacity = ramp(t, c[0], c[1], 0.3); }
    else cap.style.opacity = 0;
    end.style.opacity = ramp(t, 39.0, 99, 0.8);
    __tick(1000 / 30);
  };
}

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
  await send('Page.navigate', { url: pathToFileURL(file).href });
  let ok = false;
  for (let i = 0; i < 240 && !ok; i++) { await sleep(250); ok = await evaluate(`!!(window.__g1 && document.getElementById('loading').hidden)`).catch(() => false); }
  if (!ok) throw new Error('viewer did not load');
  // warm up: build line drawings once, settle the stand pose, start the turntable
  await evaluate(`(async () => { await __g1.setMode('skeleton'); await __g1.setMode('real'); __g1.state.introClosed = true; __g1.select(null);
    __g1.runPreset(1); __g1.controls.autoRotateSpeed = 2.2; __g1.controls.autoRotate = true; for (let i = 0; i < 40; i++) __tick(1000 / 30); })()`);
  await evaluate(`(${timeline})()`);
  const N = Math.round(DURATION * FPS);
  for (let f = 0; f < N; f++) {
    await evaluate(`__recFrame(${(f / FPS).toFixed(4)})`);
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    writeFileSync(path.join(framesDir, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64'));
    if (f % 150 === 0) console.log(`frame ${f}/${N}`);
  }
  console.log('done', N, 'frames');
} catch (e) {
  console.error('FAILED', e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
}
