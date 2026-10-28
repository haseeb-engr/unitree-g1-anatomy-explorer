// Offline classroom test: opens dist/Unitree_G1_Anatomy_Explorer.html from file:// in headless
// Chrome with all network traffic blocked, checks the model, and saves screenshots.
// Usage: node --experimental-websocket build/test_offline.mjs [screenshotDir]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'dist', 'Unitree_G1_Anatomy_Explorer.html');
const shots = process.argv[2] || path.join(here, 'out', 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = 9333;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'g1chrome-'))}`,
  '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, nextId = 1; const pending = new Map();
const errors = [], external = [];
function send(method, params = {}) {
  const id = nextId++; ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(shots, name + '.png'), Buffer.from(r.data, 'base64'));
}
const results = [];
const check = (name, ok, detail = '') => { results.push([ok ? 'PASS' : 'FAIL', name, detail]); };

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; if (!/^(file|data|blob):/.test(u)) external.push(u); }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const t0 = Date.now();
  await send('Page.navigate', { url: pathToFileURL(file).href });
  let loaded = false;
  for (let i = 0; i < 240 && !loaded; i++) { await sleep(250); loaded = await evaluate(`!!(window.__g1 && document.getElementById('loading').hidden)`).catch(() => false); }
  check('Loads from file:// with network blocked', loaded, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!loaded) throw new Error('page did not finish loading: ' + await evaluate(`document.getElementById('loadmsg').textContent`).catch(() => '?'));

  check('29 actuated joints', await evaluate('__g1.RJ.length') === 29);

  const px = async () => { const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 520, y: 150, width: 400, height: 600, scale: 0.1 } }); return r.data.length; };
  await sleep(800);
  check('Canvas not blank', await px() > 1500, 'robot region screenshot has detail');
  await sleep(800); await shot('1_real');
  for (const [m, n] of [['solid', '2_3d'], ['skeleton', '3_skeleton'], ['blueprint', '4_blueprint']]) {
    await evaluate(`__g1.setMode('${m}')`); await sleep(1500); await shot(n);
    check(`Mode ${m}`, await evaluate('__g1.state.mode') === m);
  }
  await evaluate(`__g1.setMode('skeleton').then(()=>__g1.select({kind:'joint',id:'left_knee_joint'}))`); await sleep(900); await shot('5_skeleton_knee_selected');
  check('Inspector shows knee', /Left Knee/i.test(await evaluate(`document.getElementById('inspector').textContent`)));
  const q = await evaluate(`(()=>{const J=__g1.RJ.find(j=>j.name==='left_knee_joint');const i=document.getElementById('ins-q');i.value=1.2;i.dispatchEvent(new Event('input'));return J.q})()`);
  check('Slider moves the knee', Math.abs(q - 1.2) < 0.006, `q=${q}`);
  const lim = await evaluate(`(()=>{const J=__g1.RJ.find(j=>j.name==='left_knee_joint');const i=document.getElementById('ins-q');i.value=99;i.dispatchEvent(new Event('input'));return [J.q,J.upper]})()`);
  check('Joint limit respected', lim[0] <= lim[1] + 1e-9, `q=${lim[0]} upper=${lim[1]}`);
  const before = await evaluate(`__g1.RJ.map(j=>j.frame.position.toArray().join()).join('|')`);
  await evaluate(`__g1.setExplode(0.6)`); await sleep(500); await shot('6_exploded');
  await evaluate(`__g1.setExplode(0)`);
  check('Explode 0 restores exact transforms', before === await evaluate(`__g1.RJ.map(j=>j.frame.position.toArray().join()).join('|')`));
  await evaluate(`__g1.select(null); __g1.setMode('real'); __g1.runPreset(3)`); await sleep(1400); await shot('7_squat');
  await evaluate(`__g1.runPreset(1); __g1.setMode('blueprint').then(()=>__g1.goView('persp'))`); await sleep(1500); await shot('8_blueprint_3q');
  await evaluate(`__g1.select({kind:'module',id:'left_knee_joint'})`); await sleep(500); await shot('8b_blueprint_module');
  await evaluate(`(()=>{const i=document.getElementById('inspector');const f=i.querySelector('svg.foc');i.scrollTop+=f.getBoundingClientRect().top-i.getBoundingClientRect().top-120;})()`); await sleep(300); await shot('8b2_module_circuit');
  check('Module inspector', /actuator/i.test(await evaluate(`document.getElementById('inspector').textContent`)));
  await evaluate(`__g1.select({kind:'path',id:'bus-leg-left'})`); await sleep(500); await shot('8c_blueprint_wire');
  check('Wire inspector', /low-level motor bus/i.test(await evaluate(`document.getElementById('inspector').textContent`)));
  await evaluate(`__g1.select(null); __g1.goView('front')`); await sleep(900); await shot('8d_blueprint_front');
  await evaluate(`(()=>{const c=__g1.cam();__g1.controls.target.set(0,1.08,0);c.position.set(5,1.08,0);c.zoom=3.2;c.updateProjectionMatrix();__g1.controls.update();})()`); await sleep(600); await shot('8e_blueprint_torso_zoom');
  await evaluate(`__g1.select({kind:'board',id:'loco'})`); await sleep(500); await shot('8f_board_rk3588');
  check('Board inspector shows RK3588S', /RK3588S/.test(await evaluate(`document.getElementById('inspector').textContent`)));
  await evaluate(`__g1.select(null)`);
  await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 820, deviceScaleFactor: 1, mobile: true });
  await evaluate(`__g1.runPreset(1); __g1.setMode('blueprint')`); await sleep(1200); await shot('9_phone_blueprint');
  check('No horizontal page scroll at 400px', await evaluate('document.documentElement.scrollWidth <= 400'));
  check('No external network requests', external.length === 0, external.slice(0, 5).join(' '));
  check('No console errors or warnings', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (e) {
  check('Test run', false, e.message);
} finally {
  for (const [s, n, d] of results) console.log(`${s}  ${n}${d ? '  (' + d + ')' : ''}`);
  console.log('screenshots:', shots);
  try { ws && ws.close(); } catch {}
  chrome.kill();
  process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
}
