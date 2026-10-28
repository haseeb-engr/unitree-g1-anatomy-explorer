// Mobile UI check: phone-sized viewport with touch, screenshots of each state.
// Usage: node --experimental-websocket build/test_mobile.mjs [outDir]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'dist', 'Unitree_G1_Anatomy_Explorer.html');
const out = process.argv[2] || path.join(here, 'out', 'mobile');
mkdirSync(out, { recursive: true });
const PORT = 9377;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'g1mob-'))}`,
  '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, nextId = 1; const pending = new Map(); const errors = [];
const send = (method, params = {}) => new Promise((res, rej) => { const id = nextId++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); };
async function tap(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(60);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
}
async function tapSel(sel) {
  const c = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]})()`);
  if (!c) throw new Error('not found: ' + sel);
  await tap(c[0], c[1]);
}
// layout audit: horizontal overflow, controls off-screen, small tap targets, overlapping fixed panels
const AUDIT = `(() => {
  const W = innerWidth, H = innerHeight, issues = [];
  if (document.documentElement.scrollWidth > W) issues.push('page scrolls sideways: ' + document.documentElement.scrollWidth + 'px');
  const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; for (let p = e; p; p = p.parentElement) if (p.hidden || getComputedStyle(p).display === 'none') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  document.querySelectorAll('button, input, a, label').forEach((e) => {
    if (!vis(e)) return; const r = e.getBoundingClientRect();
    const name = (e.id ? '#' + e.id : '') + ' ' + (e.textContent || e.getAttribute('aria-label') || e.type || '').trim().slice(0, 24);
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) {
      const box = e.closest('#inspector, #pose, #about .panel');
      if (!box || !(box.scrollHeight > box.clientHeight)) issues.push('off-screen: ' + name + ' [' + Math.round(r.left) + ',' + Math.round(r.top) + ']');
    }
    if (Math.min(r.width, r.height) < 24 && e.tagName !== 'A') issues.push('small tap target (' + Math.round(r.width) + 'x' + Math.round(r.height) + '): ' + name);
  });
  const panels = ['#top', '#legend', '#inspector', '#pose', '#views', '#credit', '#hint', '#titleblock'].map((s) => [s, document.querySelector(s)]).filter(([, e]) => e && vis(e)).map(([s, e]) => [s, e.getBoundingClientRect()]);
  for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) {
    const [a, A] = panels[i], [b, B] = panels[j];
    const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (ox > 4 && oy > 4) issues.push('overlap ' + a + ' / ' + b + ' (' + Math.round(ox) + 'x' + Math.round(oy) + ')');
  }
  const top = document.getElementById('top').getBoundingClientRect();
  return { W, H, topBarHeight: Math.round(top.height), issues: [...new Set(issues)] };
})()`;

const report = [];
try {
  let t; for (let i = 0; i < 50 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch { await sleep(200); } }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' ')); });
  await send('Page.enable'); await send('Runtime.enable');
  const phone = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 3, mobile: true, screenOrientation: w > h ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); };
  await phone(390, 844);
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await send('Page.navigate', { url: pathToFileURL(file).href });
  let ok = false; for (let i = 0; i < 240 && !ok; i++) { await sleep(250); ok = await evaluate(`!!(window.__g1 && document.getElementById('loading').hidden)`).catch(() => false); }
  if (!ok) throw new Error('did not load');
  await sleep(1200);
  const step = async (name) => { await sleep(700); await shot(name); report.push([name, await evaluate(AUDIT)]); };

  await step('m1_real');
  await tapSel('#modes [data-mode="solid"]'); await step('m2_3d');
  await tapSel('#modes [data-mode="skeleton"]'); await step('m3_skeleton');
  // tap the left knee joint marker
  const knee = await evaluate(`(()=>{const J=__g1.RJ.find(j=>j.name==='left_knee_joint');const v=J.frame.getWorldPosition(new THREE.Vector3()).project(__g1.cam());return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]})()`);
  await tap(knee[0], knee[1]);
  const sel = await evaluate('JSON.stringify(__g1.state.sel)');
  await step('m4_skeleton_tap_knee');
  report.push(['tap on knee selects', sel]);
  await tapSel('#ins-close'); await sleep(300);
  await tapSel('#modes [data-mode="blueprint"]'); await step('m5_blueprint');
  await tapSel('#t-pose'); await step('m6_pose_panel');
  await tapSel('#t-pose');
  await tapSel('#t-about'); await step('m7_about');
  await tapSel('#about-close');
  await phone(844, 390); await sleep(800); await evaluate(`dispatchEvent(new Event('resize'))`);
  await tapSel('#modes [data-mode="real"]'); await step('m8_landscape');
} catch (e) { report.push(['FAILED', e.message]); }
finally {
  for (const [n, r] of report) console.log(n, JSON.stringify(r));
  console.log('errors:', errors.length ? errors : 'none');
  try { ws && ws.close(); } catch {}
  chrome.kill(); process.exit(0);
}
