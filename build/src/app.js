/* Unitree G1 Explorer: builds the robot from the packed official URDF + meshes
   (window.G1_DATA) and the teaching text (window.G1_INFO). Three.js r147. */
(function () {
  'use strict';
  const T = THREE, D = window.G1_DATA, INFO = window.G1_INFO;
  const $ = (s, r = document) => r.querySelector(s);
  const DEG = 180 / Math.PI;
  const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mm = (m) => (m * 1000).toFixed(1);
  const TAG = { urdf: ['Documented · URDF', '#5cb85f'], motor: ['Documented · motor_info.md', '#4f97f0'], teardown: ['Teardown-based', '#d88a35'], docs: ['Documented · Unitree/partner docs', '#5cb85f'], illus: ['Illustrative', '#d96cc4'] };
  const tag = (k) => `<span class="tag" style="--c:${TAG[k][1]}">${TAG[k][0]}</span>`;
  const OVER = 1; // render layer for diagram overlays (drawn on top of the shell)

  const COL = { x: 0xe5574f, y: 0x5cb85f, z: 0x4f97f0, accent: 0xf0a63a, bp: 0x0f3e70, bpLine: 0xd6e9ff,
    power: 0xff6b5a, bus: 0xffd060, eth: 0xe98cff, usb: 0x5fe0ff, pcb: 0x8ff0c0, pcbFill: 0x1d6b48, copper: 0xe8a15a, sensor: 0x3fc98a };
  const ASM = {
    leg: { c: 0x4f86c6, label: 'Legs' }, arm: { c: 0x4ea887, label: 'Arms' }, waist: { c: 0xd88a35, label: 'Waist' },
    pelvis: { c: 0xb5679a, label: 'Pelvis' }, torso: { c: 0xaab4bf, label: 'Torso' }, head: { c: 0x7b80d6, label: 'Head' }
  };
  const MOTOR_SIZE = { '7519': [0.048, 0.046], '6010': [0.040, 0.036], '5019': [0.034, 0.036], '5010': [0.028, 0.030] };

  /* ---------------- decode packed meshes ---------------- */
  async function decodeBlob() {
    if (!('DecompressionStream' in window)) throw new Error('This browser cannot unpack the model. Open the file in a current version of Chrome, Edge, Firefox or Safari.');
    const bin = atob(D.blob);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  function buildGeometries(buf) {
    const S = D.sections;
    return D.meshes.map((m) => {
      const q = new Uint16Array(buf, S.pos + m.p, m.v * 3);
      const pos = new Float32Array(m.v * 3);
      for (let i = 0; i < pos.length; i++) { const k = i % 3; pos[i] = m.lo[k] + (q[i] / 65535) * m.rng[k]; }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.BufferAttribute(new Int8Array(buf, S.nrm + m.n, m.v * 3), 3, true));
      g.setIndex(new T.BufferAttribute(m.big ? new Uint32Array(buf, S.idx + m.x, m.i) : new Uint16Array(buf, S.idx + m.x, m.i), 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      return g;
    });
  }

  /* ---------------- renderer, scene, cameras ---------------- */
  const canvas = $('#stage');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;

  const persp = new T.PerspectiveCamera(32, 1, 0.01, 60);
  const ortho = new T.OrthographicCamera(-1, 1, 1, -1, -20, 60);
  [persp, ortho].forEach((c) => c.layers.enable(OVER));
  let camera = persp;
  persp.position.set(2.0, 1.05, 1.6);
  const controls = new T.OrbitControls(persp, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.target.set(0, 0.68, 0);
  controls.minDistance = 0.25; controls.maxDistance = 8;
  controls.autoRotateSpeed = 1.4;

  const hemi = new T.HemisphereLight(0xe4ecf5, 0x1d2329, 0.55);
  const key = new T.DirectionalLight(0xffffff, 2.3);
  key.position.set(2.2, 4.2, 2.4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1.6, bottom: -0.3, near: 0.5, far: 10 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const rim = new T.DirectionalLight(0xa9c8ff, 1.1); rim.position.set(-3, 2.4, -2.6);
  const fill = new T.DirectionalLight(0xffffff, 0.35); fill.position.set(-1, 1, 3);
  [hemi, key, rim, fill].forEach((l) => { l.layers.enable(OVER); scene.add(l); });

  // backgrounds
  function gradientTex(top, bottom) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  const BG = {
    real: gradientTex('#2a3139', '#0a0c0f'),
    solid: gradientTex('#f3f5f7', '#d5dce3'),
    skeleton: gradientTex('#121c27', '#070b10'),
    blueprint: new T.Color(COL.bp)
  };

  // floor pieces
  const shadowFloor = new T.Mesh(new T.PlaneGeometry(8, 8), new T.ShadowMaterial({ opacity: 0.38 }));
  shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
  const glow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(120,150,180,0.35)'); g.addColorStop(1, 'rgba(120,150,180,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const m = new T.Mesh(new T.PlaneGeometry(2.4, 2.4), new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.001; scene.add(m); return m;
  })();
  function grid(size, div, c1, c2, op) {
    const g = new T.GridHelper(size, div, c1, c2);
    g.material.transparent = true; g.material.opacity = op; g.material.toneMapped = false; g.material.depthWrite = false;
    return g;
  }
  const solidGrid = grid(4, 40, 0x93a1ae, 0xb8c2cc, 0.6); scene.add(solidGrid);
  const skelGrid = grid(4, 40, 0x2c4157, 0x1a2836, 0.9); scene.add(skelGrid);
  const bpGrids = new T.Group(); scene.add(bpGrids);
  {
    const c = lin(COL.bpLine);
    const floor = grid(3, 60, c, c, 0.13); bpGrids.add(floor);
    const back = grid(3, 60, c, c, 0.13); back.rotation.z = Math.PI / 2; back.position.set(-0.7, 1.5, 0); bpGrids.add(back);
    const side = grid(3, 60, c, c, 0.13); side.rotation.x = Math.PI / 2; side.position.set(0, 1.5, 0.7); bpGrids.add(side);
  }

  /* ---------------- materials ---------------- */
  const MAT = {
    real: {
      dark: new T.MeshPhysicalMaterial({ color: lin(0x1c1f23), metalness: 0.2, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.9 }),
      white: new T.MeshStandardMaterial({ color: lin(0x878d94), metalness: 0.85, roughness: 0.42, envMapIntensity: 0.85 })
    },
    realSel: new T.MeshStandardMaterial({ color: lin(0xf0a63a), metalness: 0.55, roughness: 0.32, emissive: lin(0x3a2200) }),
    solid: {},
    solidSel: new T.MeshStandardMaterial({ color: lin(0xf0a63a), roughness: 0.55, metalness: 0.05, emissive: lin(0x2a1800) }),
    ghost: new T.MeshStandardMaterial({ color: lin(0x9cc0e4), transparent: true, opacity: 0.09, depthWrite: false, roughness: 0.5 }),
    ghostSel: new T.MeshStandardMaterial({ color: lin(0xf0a63a), transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.5 }),
    bpFill: new T.MeshBasicMaterial({ color: lin(COL.bp), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, toneMapped: false }),
    bpFillSel: new T.MeshBasicMaterial({ color: lin(0x23558a), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, toneMapped: false }),
    bpEdge: new T.LineBasicMaterial({ color: lin(COL.bpLine), transparent: true, opacity: 0.92, toneMapped: false }),
    skEdge: new T.LineBasicMaterial({ color: lin(0x9cc0e4), transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }),
    edgeSel: new T.LineBasicMaterial({ color: lin(0xffc56b), toneMapped: false })
  };
  for (const k in ASM) MAT.solid[k] = new T.MeshStandardMaterial({ color: lin(ASM[k].c), roughness: 0.62, metalness: 0.05, envMapIntensity: 0.6 });

  /* ---------------- robot hierarchy ---------------- */
  const world = new T.Group(); scene.add(world);
  const robot = new T.Group(); robot.rotation.x = -Math.PI / 2; world.add(robot); // URDF z-up -> three y-up
  const linkObj = {}, linkData = {}, meshesByLink = {}, allMeshes = [];
  const jointByName = {}, jointByChild = {}, childJoints = {};
  const RJ = []; // revolute joints in URDF order (ids 0..28)

  function assemblyOf(n) {
    if (/^(left|right)_(hip|knee|ankle)/.test(n)) return 'leg';
    if (/^(left|right)_(shoulder|elbow|wrist)|rubber_hand/.test(n)) return 'arm';
    if (/^waist/.test(n)) return 'waist';
    if (n === 'pelvis') return 'pelvis';
    if (n === 'head_link') return 'head';
    return 'torso';
  }
  const sideOf = (n) => (n.startsWith('left_') ? 'Left' : n.startsWith('right_') ? 'Right' : '');
  const shortKey = (n) => n.replace(/^(left|right)_/, '').replace(/_joint$/, '');

  function buildRobot(geoms) {
    D.links.forEach((L) => {
      const g = new T.Group(); g.name = L.name; linkObj[L.name] = g; linkData[L.name] = L; meshesByLink[L.name] = [];
      L.visuals.forEach((v) => {
        const mesh = new T.Mesh(geoms[v.mesh], MAT.real[v.mat] || MAT.real.white);
        mesh.position.fromArray(v.xyz); mesh.rotation.set(v.rpy[0], v.rpy[1], v.rpy[2], 'ZYX');
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData = { kind: 'link', id: L.name, mat: v.mat, asm: assemblyOf(L.name) };
        g.add(mesh); meshesByLink[L.name].push(mesh); allMeshes.push(mesh);
      });
    });
    D.joints.forEach((J) => {
      J.frame = new T.Group(); J.frame.position.fromArray(J.xyz);
      J.frame.quaternion.setFromEuler(new T.Euler(J.rpy[0], J.rpy[1], J.rpy[2], 'ZYX'));
      J.pivot = new T.Group(); J.frame.add(J.pivot); J.pivot.add(linkObj[J.child]);
      linkObj[J.parent].add(J.frame);
      J.axisV = new T.Vector3().fromArray(J.axis).normalize();
      J.q = 0;
      jointByName[J.name] = J; jointByChild[J.child] = J;
      (childJoints[J.parent] = childJoints[J.parent] || []).push(J);
      if (J.type === 'revolute') { J.id = RJ.length; RJ.push(J); J.key = shortKey(J.name); J.side = sideOf(J.name); }
    });
    robot.add(linkObj.pelvis);
  }
  let explode = 0;
  function setExplode(k) {
    explode = k;
    D.joints.forEach((J) => {
      const base = new T.Vector3().fromArray(J.xyz);
      // spread every part away from its parent; joints with no offset get a small fixed gap outward
      const dir = base.lengthSq() > 1e-8 ? base.clone() : new T.Vector3(0, 0, 0.05);
      J.frame.position.copy(base).addScaledVector(dir, k * 0.5);
    });
    ground();
  }
  function setQ(J, q) { J.q = clamp(q, J.lower, J.upper); J.pivot.quaternion.setFromAxisAngle(J.axisV, J.q); }
  function massBelow(link) { return (linkData[link].mass || 0) + (childJoints[link] || []).reduce((s, J) => s + massBelow(J.child), 0); }

  /* ---------------- grounding ---------------- */
  const solePts = [];
  function initGround() {
    ['left_ankle_roll_link', 'right_ankle_roll_link'].forEach((n) => {
      const b = meshesByLink[n][0].geometry.boundingBox;
      [[b.min.x, b.min.y], [b.min.x, b.max.y], [b.max.x, b.min.y], [b.max.x, b.max.y]].forEach(([x, y]) => solePts.push([n, new T.Vector3(x, y, b.min.z)]));
    });
  }
  const _v = new T.Vector3();
  function ground() {
    world.position.y = 0; world.updateMatrixWorld(true);
    let lo = Infinity;
    solePts.forEach(([n, p]) => { _v.copy(p); linkObj[n].localToWorld(_v); lo = Math.min(lo, _v.y); });
    world.position.y = -lo; world.updateMatrixWorld(true); O.dirty = true;
    renderer.shadowMap.needsUpdate = true;
  }

  /* ---------------- overlay: joints, rods, sensors, motors, linkage, wiring, internals, dims ---------------- */
  const O = { markers: [], hits: [], arcs: [], rods: [], sensors: [], dims: [], pick: [] };
  const axisIdx = (a) => { const v = [Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)]; return v.indexOf(Math.max(...v)); };
  const AXIS_COL = [COL.x, COL.y, COL.z];
  const markerMats = AXIS_COL.map((c) => new T.MeshStandardMaterial({ color: lin(c), roughness: 0.35, metalness: 0.1, emissive: lin(c), emissiveIntensity: 0.25 }));
  const markerBp = new T.MeshBasicMaterial({ color: lin(COL.bpLine), toneMapped: false });
  const markerSel = new T.MeshBasicMaterial({ color: lin(COL.accent), toneMapped: false });
  const rodMat = new T.MeshStandardMaterial({ color: lin(0xc9d4df), roughness: 0.45, metalness: 0.4 });
  const rodBp = new T.MeshBasicMaterial({ color: lin(0x8fb8e6), toneMapped: false });
  const hitMat = new T.MeshBasicMaterial({ visible: false });
  const onTop = (o, order = 5) => { o.traverse((c) => { c.layers.set(OVER); c.renderOrder = order; }); return o; };

  function cylBetween(a, b, r, mat) {
    const d = new T.Vector3().subVectors(b, a); const len = d.length();
    if (len < 1e-4) return null;
    const m = new T.Mesh(new T.CylinderGeometry(r, r, 1, 10), mat);
    m.scale.y = len; m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  function placeCyl(m, a, b) {
    const d = _d.subVectors(b, a); const len = d.length();
    m.scale.y = Math.max(len, 1e-4); m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(_up, d.normalize());
  }
  const _d = new T.Vector3(), _up = new T.Vector3(0, 1, 0);

  function buildOverlay() {
    // joint markers + limit arcs
    RJ.forEach((J) => {
      const a = J.axisV, ai = axisIdx(a); J.axisLetter = 'XYZ'[ai];
      const r = J.key.startsWith('wrist') ? 0.010 : 0.014;
      const s = new T.Mesh(new T.SphereGeometry(r, 20, 14), markerMats[ai]);
      s.userData = { kind: 'joint', id: J.name, ai };
      const axisRod = new T.Mesh(new T.CylinderGeometry(0.0025, 0.0025, r * 5.2, 8), markerMats[ai]);
      axisRod.quaternion.setFromUnitVectors(_up, a); axisRod.userData = s.userData;
      const hit = new T.Mesh(new T.SphereGeometry(r * 2, 8, 6), hitMat); hit.userData = s.userData;
      const grp = new T.Group(); grp.add(s, axisRod, hit); J.frame.add(onTop(grp, 6));
      J.marker = s; J.axisRod = axisRod; J.markerGrp = grp;
      O.markers.push(grp); O.hits.push(hit);
      // arc of allowed motion, in the joint frame, starting from reference direction u
      const c = Math.abs(a.z) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 0, -1);
      const u = c.clone().addScaledVector(a, -a.dot(c)).normalize();
      const w = new T.Vector3().crossVectors(a, u);
      const basis = new T.Matrix4().makeBasis(u, w, a);
      const arcMat = new T.MeshBasicMaterial({ color: lin(COL.accent), transparent: true, opacity: 0.55, side: T.DoubleSide, depthTest: false, toneMapped: false });
      const arc = new T.Mesh(new T.RingGeometry(0.038, 0.05, 64, 1, J.lower, J.upper - J.lower), arcMat);
      arc.quaternion.setFromRotationMatrix(basis);
      const zeroTick = new T.Line(new T.BufferGeometry().setFromPoints([u.clone().multiplyScalar(0.034), u.clone().multiplyScalar(0.054)]),
        new T.LineBasicMaterial({ color: 0xffffff, depthTest: false, toneMapped: false }));
      const needle = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), u.clone().multiplyScalar(0.058)]),
        new T.LineBasicMaterial({ color: lin(0xfff1d6), depthTest: false, toneMapped: false, linewidth: 2 }));
      const arcGrp = new T.Group(); arcGrp.add(arc, zeroTick); J.frame.add(onTop(arcGrp, 9));
      J.pivot.add(onTop(needle, 10));
      J.arc = arcGrp; J.needle = needle; O.arcs.push(arcGrp, needle);
    });
    // rods: link origin -> each child joint origin
    Object.keys(childJoints).forEach((ln) => {
      childJoints[ln].forEach((J) => {
        if (J.type !== 'revolute' && !/hand_palm/.test(J.name)) return;
        const m = cylBetween(new T.Vector3(), new T.Vector3().fromArray(J.xyz), 0.0045, rodMat);
        if (m) { linkObj[ln].add(onTop(m, 4)); O.rods.push(m); }
      });
    });
    { // spine up to the head sensors
      const m = cylBetween(new T.Vector3(), new T.Vector3(0, 0, 0.43), 0.0045, rodMat);
      linkObj.torso_link.add(onTop(m, 4)); O.rods.push(m);
    }
    // sensors
    const sensMat = new T.MeshStandardMaterial({ color: lin(COL.sensor), emissive: lin(COL.sensor), emissiveIntensity: 0.35, roughness: 0.4 });
    Object.keys(INFO.sensors).forEach((n) => {
      const s = new T.Mesh(new T.OctahedronGeometry(0.013), sensMat); s.userData = { kind: 'sensor', id: n };
      linkObj[n].add(onTop(s, 6)); O.sensors.push(s);
    });
    // ================= Blueprint internals (illustrative layouts) =================
    const LM = (c, op = 1) => new T.LineBasicMaterial({ color: lin(c), transparent: op < 1, opacity: op, toneMapped: false });
    const BM = (c, op) => new T.MeshBasicMaterial({ color: lin(c), transparent: true, opacity: op, depthWrite: false, toneMapped: false, side: T.DoubleSide });
    const M = O.M = { line: LM(COL.bpLine), dim: LM(COL.bpLine, 0.5), fill: BM(0x3a78bd, 0.45), copper: BM(COL.copper, 0.9), pcb: BM(COL.pcbFill, 0.9),
      pcbL: LM(COL.pcb), chip: BM(0x0a1c2e, 0.95), sel: LM(COL.accent), bat: BM(0xe25b4f, 0.2), batL: LM(0xff8a7a), sens: BM(COL.usb, 0.22), sensL: LM(COL.usb), xt: LM(COL.bus), copperL: LM(COL.copper), cap: BM(0xd6e9ff, 0.25),
      center: new T.LineDashedMaterial({ color: lin(COL.bpLine), dashSize: 0.006, gapSize: 0.004, transparent: true, opacity: 0.6, toneMapped: false }) };
    const circle = (r, y, mat, seg = 40) => {
      const pts = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
      return new T.Line(new T.BufferGeometry().setFromPoints(pts), mat);
    };
    const outline = (mesh, mat, th = 1) => { const e = new T.LineSegments(new T.EdgesGeometry(mesh.geometry, th), mat); e.position.copy(mesh.position); e.quaternion.copy(mesh.quaternion); return e; };
    const tagAll = (g, ud) => { g.userData = ud; g.traverse((o) => { if (o.isMesh) o.userData = ud; }); return g; };
    O.modules = []; O.boards = []; O.linkage = []; O.paths = []; O.rodsDyn = [];

    function buildModule(r, h, ud) { // cylinder along local Y; +Y = output side
      const g = new T.Group();
      g.add(new T.Mesh(new T.CylinderGeometry(r, r, h, 40, 1, true), M.fill));
      g.add(circle(r, h / 2, M.line), circle(r, -h / 2, M.line));
      const coil = new T.Mesh(new T.TorusGeometry(r * 0.72, r * 0.1, 8, 36), M.copper); coil.rotation.x = Math.PI / 2; coil.position.y = -h * 0.05; g.add(coil);
      g.add(circle(r * 0.56, -h * 0.05, M.line)); // rotor
      const gy = h * 0.3; // planetary stage
      g.add(circle(r * 0.5, gy, M.dim), circle(r * 0.11, gy, M.line));
      for (let i = 0; i < 3; i++) { const a = (i * 2 * Math.PI) / 3, c = circle(r * 0.17, gy, M.line, 20); c.position.set(Math.cos(a) * r * 0.29, 0, Math.sin(a) * r * 0.29); g.add(c); }
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3, c = circle(r * 0.055, h / 2, M.dim, 12); c.position.set(Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8); g.add(c); }
      const py = -h * 0.42; // driver PCB on the back face
      const pcb = new T.Mesh(new T.CylinderGeometry(r * 0.86, r * 0.86, 0.0016, 40), M.pcb); pcb.position.y = py; g.add(pcb, circle(r * 0.86, py, M.pcbL));
      [[0.3, 0.1, 0.24, 0.24], [-0.38, 0.05, 0.2, 0.12], [0.0, -0.45, 0.3, 0.1], [-0.12, 0.42, 0.12, 0.12]].forEach(([x, z, w, d]) => {
        const c = new T.Mesh(new T.BoxGeometry(r * w, 0.0025, r * d), M.chip); c.position.set(r * x, py - 0.002, r * z); g.add(c, outline(c, M.pcbL));
      });
      [[0.56, 0.5], [-0.56, -0.5]].forEach(([x, z]) => { // XT30 2+2 in/out
        const c = new T.Mesh(new T.BoxGeometry(r * 0.24, 0.005, r * 0.15), M.chip); c.position.set(r * x, py - 0.003, r * z); g.add(c, outline(c, M.xt));
      });
      g.add(circle(r * 0.26, -h * 0.33, M.pcbL)); // encoder
      g.add(circle(r * 0.14, h / 2, M.line), circle(r * 0.14, -h / 2, M.line)); // hollow shaft
      const cl = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, -h * 0.9, 0), new T.Vector3(0, h * 0.9, 0)]), M.center);
      cl.computeLineDistances(); g.add(cl);
      return tagAll(g, ud);
    }
    RJ.forEach((J) => {
      if (J.key.startsWith('ankle')) return;
      const [r, h] = MOTOR_SIZE[INFO.motorOf[J.key].slice(0, 4)];
      const m = buildModule(r, h, { kind: 'module', id: J.name });
      m.quaternion.setFromUnitVectors(_up, J.axisV);
      J.frame.add(onTop(m, 3)); O.modules.push(m); J.module = m;
    });
    // ankle: two calf motors driving push rods to the heel
    const rodFill = BM(COL.bpLine, 0.85);
    ['left', 'right'].forEach((side) => {
      const knee = linkObj[side + '_knee_link'], foot = linkObj[side + '_ankle_roll_link'];
      const yc = jointByName[side + '_ankle_pitch_joint'].xyz[1];
      [-1, 1].forEach((k) => {
        const y = yc + k * 0.021, ud = { kind: 'module', id: side + '_ankle_pitch_joint', ankle: true };
        const m = buildModule(0.023, 0.02, ud); m.position.set(-0.03, y, -0.1); knee.add(onTop(m, 3)); O.modules.push(m);
        const top = new T.Vector3(-0.062, y, -0.1), footPin = new T.Vector3(-0.05, y, 0.012);
        const crank = cylBetween(new T.Vector3(-0.03, y, -0.1), top, 0.0035, rodFill); knee.add(onTop(crank, 4));
        const rod = new T.Mesh(new T.CylinderGeometry(0.003, 0.003, 1, 8), rodFill); rod.userData = ud; knee.add(onTop(rod, 4));
        const b1 = new T.Mesh(new T.SphereGeometry(0.006, 12, 8), rodFill); b1.position.copy(top); knee.add(onTop(b1, 4));
        const b2 = new T.Mesh(new T.SphereGeometry(0.006, 12, 8), rodFill); b2.position.copy(footPin); foot.add(onTop(b2, 4));
        O.linkage.push(crank, rod, b1, b2); O.rodsDyn.push({ rod, knee, foot, top, footPin });
      });
    });
    // circuit boards: board plane = local YZ, components on the +X face
    const torso = linkObj.torso_link, headL = linkObj.head_link;
    function board(id, w, hgt, chips, parent, pos, kind = 'board') {
      const g = new T.Group();
      const b = new T.Mesh(new T.BoxGeometry(0.0016, w, hgt), M.pcb); g.add(b, outline(b, M.pcbL));
      chips.forEach(([y, z, cw, ch, t = 0.003]) => {
        const c = new T.Mesh(new T.BoxGeometry(t, cw, ch), M.chip); c.position.set(0.0008 + t / 2, (y * w) / 2, (z * hgt) / 2); g.add(c, outline(c, M.pcbL));
      });
      g.position.fromArray(pos); parent.add(onTop(tagAll(g, { kind, id }), 3)); O.boards.push(g); return g;
    }
    const loco = board('loco', 0.11, 0.075, [[-0.5, -0.5, 0.02, 0.016], [0.6, -0.55, 0.018, 0.012], [-0.75, 0.7, 0.012, 0.01, 0.006]], torso, [-0.028, 0, 0.245]);
    { // RK3588S cooler: finned heatsink + fan on the board's front face
      const fins = new T.Group();
      for (let k = 0; k < 9; k++) { const f = new T.Mesh(new T.BoxGeometry(0.012, 0.0012, 0.05), M.fill); f.position.set(0.0075, -0.024 + k * 0.006, 0.006); fins.add(f, outline(f, M.line)); }
      const fan = circle(0.019, 0, M.line, 32); fan.rotation.z = Math.PI / 2; fan.position.set(0.0145, 0.0, 0.006);
      fins.add(fan);
      for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5; const b = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0.0146, 0, 0.006), new T.Vector3(0.0146, Math.cos(a) * 0.017, 0.006 + Math.sin(a) * 0.017)]), M.line); fins.add(b); }
      loco.add(fins); tagAll(loco, loco.userData); loco.traverse((o) => o.layers.set(OVER));
    }
    const dev = board('dev', 0.1, 0.08, [[-0.75, -0.75, 0.014, 0.008, 0.006], [0.75, -0.75, 0.014, 0.008, 0.006], [0.6, 0.75, 0.02, 0.008, 0.006]], torso, [0.03, 0, 0.14]);
    { // Orin NX module + copper thermal block
      const mod = new T.Mesh(new T.BoxGeometry(0.004, 0.07, 0.045), M.pcb); mod.position.set(0.003, 0, 0.004);
      const cu = new T.Mesh(new T.BoxGeometry(0.008, 0.05, 0.032), M.copper); cu.position.set(0.009, 0, 0.004);
      dev.add(mod, outline(mod, M.pcbL), cu, outline(cu, M.copperL)); tagAll(dev, dev.userData); dev.traverse((o) => o.layers.set(OVER));
    }
    board('power', 0.12, 0.045, [[-0.5, 0, 0.025, 0.02, 0.01], [0.5, 0, 0.025, 0.02, 0.01], [0, 0.4, 0.03, 0.01], [0, -0.55, 0.05, 0.008, 0.008]], torso, [0.05, 0, 0.06]);
    board('bms', 0.05, 0.03, [[-0.3, 0.2, 0.012, 0.012], [0.4, -0.3, 0.01, 0.008]], torso, [-0.038, 0, 0.035]);
    board('headmcu', 0.03, 0.02, [[0, 0, 0.01, 0.01]], headL, [0.02, 0, 0.405]);
    { // neck I/O panel (faces the rear)
      const io = board('io', 0.085, 0.035, [[-0.62, 0.2, 0.016, 0.013, 0.012], [-0.2, 0.2, 0.016, 0.013, 0.012], [0.2, 0.35, 0.009, 0.0035, 0.004], [0.42, 0.35, 0.009, 0.0035, 0.004], [0.64, 0.35, 0.009, 0.0035, 0.004],
        [-0.55, -0.55, 0.008, 0.008, 0.008], [-0.15, -0.55, 0.008, 0.008, 0.008], [0.25, -0.55, 0.008, 0.008, 0.008], [0.62, -0.55, 0.008, 0.008, 0.008]], torso, [-0.06, 0, 0.3]);
      io.rotation.z = Math.PI;
    }
    board('switch', 0.045, 0.025, [[0, 0, 0.014, 0.014], [0.7, 0, 0.008, 0.012, 0.008]], torso, [0.03, 0.045, 0.285]);
    board('imu_in_torso', 0.022, 0.022, [[0, 0, 0.008, 0.008]], linkObj.imu_in_torso, [0, 0, 0], 'sensor');
    board('imu_in_pelvis', 0.022, 0.022, [[0, 0, 0.008, 0.008]], linkObj.imu_in_pelvis, [0, 0, 0], 'sensor');
    { // battery pack with cells
      const g = new T.Group(); const box = new T.Mesh(new T.BoxGeometry(0.024, 0.15, 0.2), M.bat); g.add(box, outline(box, M.batL));
      for (let k = 0; k < 13; k++) { // 13 series groups (13S)
        const row = k < 7 ? 0 : 1, iy = row ? k - 7 : k;
        const c = new T.Mesh(new T.CylinderGeometry(0.0085, 0.0085, 0.085, 16)); c.rotation.x = Math.PI / 2;
        c.position.set(0, -0.06 + iy * 0.02 + row * 0.01, row ? 0.047 : -0.047); g.add(outline(c, M.batL, 30));
      }
      g.position.set(-0.054, 0, 0.15); torso.add(onTop(tagAll(g, { kind: 'board', id: 'battery' }), 3)); O.boards.push(g);
    }
    { // head: depth camera, LiDAR, microphones, speaker
      const cam = new T.Group(); const cb = new T.Mesh(new T.BoxGeometry(0.025, 0.09, 0.025), M.sens); cam.add(cb, outline(cb, M.sensL));
      [-0.03, 0, 0.03].forEach((y) => { const l = circle(0.006, 0, M.sensL, 20); l.rotation.z = Math.PI / 2; l.position.set(0.0126, y, 0); cam.add(l); });
      linkObj.d435_link.add(onTop(tagAll(cam, { kind: 'sensor', id: 'd435_link' }), 3)); O.boards.push(cam);
      const lid = new T.Group(); const lb = new T.Mesh(new T.CylinderGeometry(0.0325, 0.0325, 0.065, 32), M.sens); lb.rotation.x = Math.PI / 2; lid.add(lb, outline(lb, M.sensL, 20));
      const win = circle(0.0327, 0, M.sensL); win.rotation.x = Math.PI / 2; win.position.z = 0.012; lid.add(win);
      linkObj.mid360_link.add(onTop(tagAll(lid, { kind: 'sensor', id: 'mid360_link' }), 3)); O.boards.push(lid);
      const mic = new T.Group(); const md = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.0016, 32), M.pcb); md.rotation.x = Math.PI / 2; mic.add(md, outline(md, M.pcbL, 20));
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3, c = circle(0.003, 0, M.pcbL, 10); c.rotation.x = Math.PI / 2; c.position.set(Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0.001); mic.add(c); }
      mic.position.set(0.0, 0, 0.44); headL.add(onTop(tagAll(mic, { kind: 'board', id: 'mic' }), 3)); O.boards.push(mic);
      const spk = new T.Group(); const sb = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.012, 24), M.fill); sb.rotation.z = Math.PI / 2; spk.add(sb, outline(sb, M.line, 20));
      spk.position.set(0.035, 0, 0.37); headL.add(onTop(tagAll(spk, { kind: 'board', id: 'speaker' }), 3)); O.boards.push(spk);
    }
    // distal capacitor buffers: one teaching example per limb
    ['left', 'right'].forEach((s) => {
      const yc = jointByName[`${s}_ankle_pitch_joint`].xyz[1];
      [[linkObj[`${s}_wrist_roll_link`], [0.02, 0, 0.016]], [linkObj[`${s}_knee_link`], [-0.035, yc, -0.16]]].forEach(([parent, p]) => {
        const g = new T.Group();
        const plate = new T.Mesh(new T.BoxGeometry(0.03, 0.012, 0.0015), M.fill); g.add(plate, outline(plate, M.line));
        [-0.009, 0, 0.009].forEach((x) => { const c = new T.Mesh(new T.CylinderGeometry(0.0045, 0.0045, 0.014, 16), M.cap); c.rotation.x = Math.PI / 2; c.position.set(x, 0, 0.008); g.add(c, outline(c, M.line, 30)); });
        g.position.fromArray(p); parent.add(onTop(tagAll(g, { kind: 'board', id: 'caps' }), 3)); O.boards.push(g);
      });
    });
    // ================= wiring network (Line2: wide, clickable, follows the pose) =================
    const WT = { power: [COL.power, 3.2], bus: [COL.bus, 2.4], eth: [COL.eth, 2.4], data: [COL.usb, 2.2] };
    const at = (o, p = [0, 0, 0]) => [o, p];
    const jf = (n, dx = 0) => at(jointByName[n].frame, [dx, 0, 0]);
    const ARM = ['shoulder_pitch', 'shoulder_roll', 'shoulder_yaw', 'elbow', 'wrist_roll', 'wrist_pitch', 'wrist_yaw'];
    const LEG = ['hip_pitch', 'hip_roll', 'hip_yaw', 'knee'];
    const paths = [
      { id: 'pw-batt', type: 'power', conf: false, title: 'Battery to power distribution', from: 'Battery pack (13S, 46.8 V nominal)', to: 'Battery management board, then power distribution board',
        pts: [at(torso, [-0.042, 0, 0.1]), at(torso, [-0.038, 0, 0.035]), at(torso, [0.049, 0, 0.06])] },
      { id: 'pw-comp', type: 'power', conf: false, title: 'Computer power feed', from: 'Power distribution board', to: 'PC2 (Jetson) and PC1 (RK3588S)', note: 'Regulation and voltages are not specified.',
        pts: [at(torso, [0.049, 0.05, 0.06]), at(torso, [0.031, 0.05, 0.14]), at(torso, [-0.026, 0.05, 0.245])] },
      { id: 'eth-loco', type: 'eth', conf: true, title: 'Ethernet: PC1 to switch', from: 'PC1, RK3588S (192.168.123.161)', to: 'Internal Ethernet switch',
        pts: [at(torso, [-0.026, 0.04, 0.265]), at(torso, [0.03, 0.045, 0.275])] },
      { id: 'eth-dev', type: 'eth', conf: true, title: 'Ethernet: switch to PC2', from: 'Internal Ethernet switch', to: 'PC2, Jetson Orin NX (192.168.123.164)',
        pts: [at(torso, [0.031, 0.03, 0.28]), at(torso, [0.031, 0.03, 0.175])] },
      { id: 'eth-lidar', type: 'eth', conf: true, title: 'Ethernet: switch to LiDAR', from: 'Internal Ethernet switch', to: 'Livox MID-360 (192.168.123.20)',
        pts: [at(torso, [0.03, 0.05, 0.293]), at(torso, [0.0, 0.01, 0.33]), at(linkObj.mid360_link)] },
      { id: 'eth-ext', type: 'eth', conf: true, title: 'Ethernet: switch to external RJ45 ports', from: 'Internal Ethernet switch', to: 'Two RJ45 ports on the neck I/O panel, for an external laptop',
        pts: [at(torso, [0.03, 0.04, 0.29]), at(torso, [-0.02, 0.03, 0.305]), at(torso, [-0.058, 0.03, 0.3])] },
      { id: 'usb-cam-pc2', type: 'data', conf: false, title: 'Depth camera USB, newer batches', from: 'RealSense D435i', to: 'PC2, Jetson Orin NX', note: 'Batch-dependent: newer production batches connect the camera to the development computer. Earlier batches use PC1 instead.',
        pts: [at(linkObj.d435_link), at(torso, [0.01, -0.01, 0.33]), at(torso, [0.031, -0.03, 0.17])] },
      { id: 'usb-cam-pc1', type: 'data', conf: false, title: 'Depth camera USB, earlier batches', from: 'RealSense D435i', to: 'PC1, RK3588S', note: 'Batch-dependent: earlier production batches connect the camera to the locomotion computer. Newer batches use PC2 instead.',
        pts: [at(linkObj.d435_link, [0, 0.006, 0]), at(torso, [0.0, -0.015, 0.33]), at(torso, [-0.026, -0.03, 0.26])] },
      { id: 'imu-torso', type: 'data', conf: false, title: 'Torso IMU data', from: 'Torso IMU', to: 'PC1, locomotion computer',
        pts: [at(linkObj.imu_in_torso), at(torso, [-0.026, -0.02, 0.23])] },
      { id: 'imu-pelvis', type: 'data', conf: false, title: 'Pelvis IMU data', from: 'Pelvis IMU', to: 'PC1, through the waist',
        pts: [at(linkObj.imu_in_pelvis), jf('waist_yaw_joint', 0.012), jf('waist_pitch_joint', 0.012), at(torso, [-0.026, -0.035, 0.23])] },
      { id: 'audio', type: 'data', conf: false, title: 'Head audio and control wiring', from: 'Speaker and microphone array', to: 'Head controller board, then PC2', note: 'A head MCU and communication wiring are reported; the exact board and pinout are not confirmed.',
        pts: [at(headL, [0.035, 0, 0.37]), at(headL, [0.02, 0, 0.405]), at(headL, [0, 0, 0.44]), at(torso, [0.0, -0.02, 0.33]), at(torso, [0.031, -0.04, 0.17])] }
    ];
    ['left', 'right'].forEach((s) => {
      const sg = s === 'left' ? 1 : -1, S = s[0].toUpperCase() + s.slice(1);
      const arm = (dx) => ARM.map((k) => jf(`${s}_${k}_joint`, dx));
      const knee = linkObj[`${s}_knee_link`], yc = jointByName[`${s}_ankle_pitch_joint`].xyz[1];
      const leg = (dx) => [jf('waist_pitch_joint', dx), jf('waist_yaw_joint', dx), ...LEG.map((k) => jf(`${s}_${k}_joint`, dx)),
        at(knee, [-0.03 + dx, yc - 0.021, -0.1]), at(knee, [-0.03 + dx, yc + 0.021, -0.1])];
      paths.push(
        { id: `pw-arm-${s}`, type: 'power', conf: false, title: `${S} arm power`, from: 'Power distribution board', to: `${S} arm motor drivers, shoulder to wrist`,
          pts: [at(torso, [0.049, sg * 0.03, 0.06]), at(torso, [-0.004, sg * 0.06, 0.2]), at(torso, [-0.004, sg * 0.09, 0.25]), ...arm(-0.005)] },
        { id: `bus-arm-${s}`, type: 'bus', conf: false, title: `${S} arm low-level motor bus`, from: 'PC1, RK3588S', to: `${S} arm driver boards, chained shoulder to wrist`,
          pts: [at(torso, [-0.026, sg * 0.03, 0.245]), at(torso, [0.006, sg * 0.09, 0.25]), ...arm(0.005)] },
        { id: `pw-leg-${s}`, type: 'power', conf: false, title: `${S} leg power`, from: 'Power distribution board', to: `Waist and ${s} leg motor drivers, down to the ankle motors`,
          pts: [at(torso, [0.049, sg * 0.02, 0.06]), at(torso, [0.005, sg * 0.02, 0.01]), ...leg(-0.005)] },
        { id: `bus-leg-${s}`, type: 'bus', conf: false, title: `${S} leg low-level motor bus`, from: 'PC1, RK3588S', to: `Waist and ${s} leg driver boards, chained hip to ankle`,
          pts: [at(torso, [-0.026, sg * 0.02, 0.22]), at(torso, [0.012, sg * 0.02, 0.03]), ...leg(0.005)] }
      );
    });
    paths.forEach((p) => {
      const [c, w] = WT[p.type];
      const mat = new T.LineMaterial({ linewidth: w, dashed: !p.conf, dashSize: 0.012, gapSize: 0.007, toneMapped: false });
      mat.color.copy(lin(c)); mat.userData = { base: mat.color.clone(), w };
      const geo = new T.LineGeometry(); geo.setPositions(new Array(p.pts.length * 3).fill(0));
      const line = new T.Line2(geo, mat); line.frustumCulled = false;
      line.userData = { kind: 'path', id: p.id, path: p };
      scene.add(onTop(line, 7)); O.paths.push(line);
    });
    O.pathById = Object.fromEntries(paths.map((p) => [p.id, p]));
    O.pick = [...O.hits, ...O.sensors, ...O.linkage.filter((m) => m.userData.kind), ...O.paths];
    [...O.modules, ...O.boards].forEach((g) => g.traverse((o) => { if (o.isMesh) O.pick.push(o); }));
    O.dirty = true;
  }

  function updateDynamic() {
    if (!O.dirty) return;
    O.dirty = false;
    if (O.linkage[0] && O.linkage[0].visible) O.rodsDyn.forEach((r) => {
      const b = r.knee.worldToLocal(r.foot.localToWorld(_v.copy(r.footPin)));
      placeCyl(r.rod, r.top, b.clone());
    });
    O.paths.forEach((l) => {
      if (!l.visible) return;
      const arr = [];
      l.userData.path.pts.forEach(([o, p]) => { _v.set(p[0], p[1], p[2]); o.localToWorld(_v); arr.push(_v.x, _v.y, _v.z); });
      l.geometry.setPositions(arr); l.computeLineDistances();
    });
  }

  /* dimensions for the blueprint, measured at zero pose, built in the URDF (pelvis) frame */
  const dimLabels = [];
  function buildDims(zero) {
    const mat = new T.LineBasicMaterial({ color: lin(COL.bpLine), toneMapped: false, depthTest: false });
    const grp = new T.Group(); robot.add(grp);
    const X = 0.0;
    function dim(a, b, off, text) { // a,b in URDF frame [y,z]; offset vector [dy,dz] for the dimension line
      const A = new T.Vector3(X, a[0], a[1]), B = new T.Vector3(X, b[0], b[1]);
      const o = new T.Vector3(0, off[0], off[1]);
      const A2 = A.clone().add(o), B2 = B.clone().add(o);
      const dir = B2.clone().sub(A2).normalize(); const n = new T.Vector3(0, -dir.z, dir.y).multiplyScalar(0.008);
      const t = dir.clone().multiplyScalar(0.012);
      const pts = [A, A2.clone().add(o.clone().normalize().multiplyScalar(0.01)), B, B2.clone().add(o.clone().normalize().multiplyScalar(0.01)),
        A2, B2, A2.clone().add(t).add(n), A2, A2.clone().add(t).sub(n), A2, B2.clone().sub(t).add(n), B2, B2.clone().sub(t).sub(n), B2];
      const l = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), mat);
      grp.add(onTop(l, 8)); O.dims.push(l);
      const mid = A2.clone().add(B2).multiplyScalar(0.5);
      const el = document.createElement('div'); el.className = 'lbl dim'; el.textContent = text; $('#labels').appendChild(el);
      dimLabels.push({ el, obj: grp, p: mid });
    }
    const z = (n) => zero[n][2], y = (n) => zero[n][1];
    const sole = zero.sole, top = zero.top;
    dim([-0.3, sole], [-0.3, top], [-0.05, 0], `${Math.round((top - sole) * 1000)} overall`);
    dim([-0.3, sole], [-0.3, 0], [-0.13, 0], `${Math.round(-sole * 1000)} pelvis`);
    const L = 'left_', R = 'right_';
    dim([y(R + 'shoulder_pitch_joint'), z(R + 'shoulder_pitch_joint')], [y(L + 'shoulder_pitch_joint'), z(L + 'shoulder_pitch_joint')], [0, top - z(L + 'shoulder_pitch_joint') + 0.035],
      `${mm(y(L + 'shoulder_pitch_joint') - y(R + 'shoulder_pitch_joint'))} shoulder`);
    dim([y(R + 'hip_pitch_joint'), z(R + 'hip_pitch_joint')], [y(L + 'hip_pitch_joint'), z(L + 'hip_pitch_joint')], [0, -0.06], `${mm(y(L + 'hip_pitch_joint') - y(R + 'hip_pitch_joint'))} hip`);
    dim([y(R + 'ankle_roll_joint'), z(R + 'ankle_roll_joint')], [y(L + 'ankle_roll_joint'), z(L + 'ankle_roll_joint')], [0, sole - z(L + 'ankle_roll_joint') - 0.06],
      `${mm(y(L + 'ankle_roll_joint') - y(R + 'ankle_roll_joint'))} feet`);
    const yl = 0.3;
    dim([yl, z(L + 'hip_pitch_joint')], [yl, z(L + 'knee_joint')], [0.03, 0], `${mm(z(L + 'hip_pitch_joint') - z(L + 'knee_joint'))} thigh`);
    dim([yl, z(L + 'knee_joint')], [yl, z(L + 'ankle_pitch_joint')], [0.03, 0], `${mm(z(L + 'knee_joint') - z(L + 'ankle_pitch_joint'))} shank`);
    dim([yl, z(L + 'shoulder_pitch_joint')], [yl, z(L + 'elbow_joint')], [0.03, 0], `${mm(z(L + 'shoulder_pitch_joint') - z(L + 'elbow_joint'))} upper arm`);
    // centre line
    const cl = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(X, 0, sole - 0.03), new T.Vector3(X, 0, top + 0.03)]),
      new T.LineDashedMaterial({ color: lin(COL.bpLine), dashSize: 0.03, gapSize: 0.012, toneMapped: false, transparent: true, opacity: 0.5 }));
    cl.computeLineDistances(); grp.add(onTop(cl, 2)); O.dims.push(cl);
    O.dimGrp = grp;
  }

  /* ---------------- edges (built on first use) ---------------- */
  let edgesBuilt = false;
  function ensureEdges() {
    if (edgesBuilt) return Promise.resolve();
    $('#busy').hidden = false;
    return new Promise((res) => setTimeout(() => {
      const cache = new Map();
      allMeshes.forEach((m) => {
        let e = cache.get(m.geometry); if (!e) { e = new T.EdgesGeometry(m.geometry, 24); cache.set(m.geometry, e); }
        const ls = new T.LineSegments(e, MAT.bpEdge); ls.userData.edge = true; ls.raycast = () => {};
        m.add(ls); m.userData.edges = ls;
      });
      edgesBuilt = true; $('#busy').hidden = true; res();
    }, 30));
  }

  /* ---------------- state ---------------- */
  const state = { mode: 'real', sel: null, labels: false, ortho: false,
    layers: { skeleton: { shell: true, joints: true, rods: true, sensors: true },
      blueprint: { outline: true, modules: true, boards: true, power: true, bus: true, data: true, linkage: true, dims: false, skeleton: false } } };
  const isDiagram = () => state.mode === 'skeleton' || state.mode === 'blueprint';
  const selIs = (kind, id) => !!(state.sel && state.sel.kind === kind && state.sel.id === id);
  const vis = (arr, v) => arr.forEach((o) => { o.visible = v; });

  function highlight(g, on) {
    g.traverse((o) => { if (o.isLine && !o.isLineSegments2) { if (!o.userData.base) o.userData.base = o.material; o.material = on ? O.M.sel : o.userData.base; } });
  }
  function refreshMaterials() {
    const sel = state.sel, SK = state.layers.skeleton, BL = state.layers.blueprint;
    const sk = state.mode === 'skeleton', bp = state.mode === 'blueprint';
    const selLinks = new Set();
    if (sel && sel.kind === 'link') selLinks.add(sel.id);
    MAT.bpEdge.opacity = BL.modules || BL.boards ? 0.42 : 0.92;
    allMeshes.forEach((m) => {
      const ud = m.userData, hi = selLinks.has(ud.id);
      if (state.mode === 'real') m.material = hi ? MAT.realSel : MAT.real[ud.mat] || MAT.real.white;
      else if (state.mode === 'solid') m.material = hi ? MAT.solidSel : MAT.solid[ud.asm];
      else if (sk) m.material = hi ? MAT.ghostSel : MAT.ghost;
      else m.material = hi ? MAT.bpFillSel : MAT.bpFill;
      m.visible = (!sk || SK.shell || hi) && (!bp || BL.outline || hi);
      m.castShadow = state.mode === 'real' || state.mode === 'solid';
      if (ud.edges) {
        ud.edges.visible = bp || (sk && SK.shell);
        ud.edges.material = hi ? MAT.edgeSel : bp ? MAT.bpEdge : MAT.skEdge;
      }
    });
    const selId = sel && (sel.kind === 'joint' || sel.kind === 'module') ? sel.id : null;
    RJ.forEach((J) => {
      const on = selIs('joint', J.name);
      J.marker.material = on ? markerSel : bp ? markerBp : markerMats[axisIdx(J.axisV)];
      J.axisRod.material = J.marker.material;
      J.markerGrp.visible = (sk && SK.joints) || (bp && BL.skeleton) || on;
      J.markerGrp.scale.setScalar(on ? 1.35 : 1);
      J.arc.visible = on; J.needle.visible = on;
    });
    O.rods.forEach((r) => { r.material = bp ? rodBp : rodMat; });
    vis(O.rods, (sk && SK.rods) || (bp && BL.skeleton));
    vis(O.sensors, sk && SK.sensors);
    vis(O.modules, bp && BL.modules);
    vis(O.boards, bp && BL.boards);
    vis(O.linkage, bp && BL.linkage);
    O.modules.forEach((g) => highlight(g, g.userData.id === selId));
    O.boards.forEach((g) => highlight(g, !!sel && g.userData.kind === sel.kind && g.userData.id === sel.id));
    O.paths.forEach((l) => {
      const t = l.userData.path.type, on = selIs('path', l.userData.id);
      l.visible = bp && BL[t === 'eth' ? 'data' : t];
      l.material.color.copy(on ? lin(COL.accent) : l.material.userData.base);
      l.material.linewidth = l.material.userData.w * (on ? 1.8 : 1);
    });
    vis(O.dims, bp && BL.dims);
    dimLabels.forEach((d) => { d.el.hidden = !(bp && BL.dims); });
    O.dirty = true;
    renderer.shadowMap.needsUpdate = true;
  }

  async function setMode(mode) {
    if (mode === 'blueprint' || mode === 'skeleton') await ensureEdges();
    state.mode = mode;
    document.body.classList.toggle('bp', mode === 'blueprint');
    document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    scene.background = BG[mode];
    scene.environment = mode === 'real' || mode === 'solid' ? envTex : null;
    shadowFloor.visible = mode === 'real' || mode === 'solid';
    shadowFloor.material.opacity = mode === 'real' ? 0.45 : 0.2;
    glow.visible = mode === 'real';
    solidGrid.visible = mode === 'solid';
    skelGrid.visible = mode === 'skeleton';
    bpGrids.visible = mode === 'blueprint';
    renderer.toneMappingExposure = mode === 'solid' ? 0.95 : mode === 'real' ? 0.95 : 1.05;
    hemi.intensity = mode === 'skeleton' ? 0.9 : 0.55;
    $('#titleblock').hidden = mode !== 'blueprint';
    if (mode === 'blueprint' && !state.ortho) { setOrtho(true); goView('front'); }
    if (mode !== 'blueprint' && state.ortho && state.autoOrtho) setOrtho(false);
    refreshMaterials(); renderLegend();
    if (!state.sel && !state.introClosed) renderIntro();
  }

  /* ---------------- camera views ---------------- */
  let camTween = null;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    persp.aspect = w / h; persp.updateProjectionMatrix();
    (O.paths || []).forEach((l) => l.material.resolution.set(w, h));
    const hh = 0.88, a = w / h;
    Object.assign(ortho, { left: -hh * a, right: hh * a, top: hh, bottom: -hh }); ortho.updateProjectionMatrix();
  }
  function setOrtho(on, auto = true) {
    state.ortho = on; state.autoOrtho = auto;
    const from = camera, to = on ? ortho : persp;
    const dir = from.position.clone().sub(controls.target).normalize();
    to.position.copy(controls.target).addScaledVector(dir, on ? 5 : 2.6);
    to.up.set(0, 1, 0); to.lookAt(controls.target);
    if (on) { ortho.zoom = 1; ortho.updateProjectionMatrix(); }
    camera = to; controls.object = to; controls.update();
    $('#v-ortho').setAttribute('aria-pressed', String(on));
  }
  const VIEWS = { persp: [2.0, 1.05, 1.6], front: [1, 0, 0], side: [0, 0, -1], back: [-1, 0, 0], top: [0, 1, 0.0001] };
  function goView(name) {
    const tgt = new T.Vector3(0, 0.68, 0);
    let end;
    if (name === 'persp') end = new T.Vector3(...VIEWS.persp);
    else end = new T.Vector3(...VIEWS[name]).normalize().multiplyScalar(camera.isOrthographicCamera ? 5 : 2.9).add(tgt);
    if (name === 'top') end.y = tgt.y + (camera.isOrthographicCamera ? 5 : 2.9);
    const start = camera.position.clone(), st = controls.target.clone();
    const z0 = camera.zoom || 1;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    camTween = { t0: performance.now(), dur: reduce ? 1 : 650, start, end, st, tgt, z0 };
    document.querySelectorAll('#views [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  }
  function stepCam(now) {
    if (!camTween) return;
    const k = clamp((now - camTween.t0) / camTween.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camera.position.lerpVectors(camTween.start, camTween.end, e);
    controls.target.lerpVectors(camTween.st, camTween.tgt, e);
    if (camera.isOrthographicCamera) { camera.zoom = camTween.z0 + (1 - camTween.z0) * e; camera.updateProjectionMatrix(); }
    if (k >= 1) camTween = null;
  }

  /* ---------------- poses and animation ---------------- */
  const MIRROR = new Set(['hip_roll', 'hip_yaw', 'shoulder_roll', 'shoulder_yaw', 'ankle_roll', 'wrist_roll', 'wrist_yaw']);
  function sym(spec) { // {key: leftValue} -> {jointName: value}
    const out = {};
    Object.entries(spec).forEach(([k, v]) => {
      if (k.startsWith('waist') || k.includes('_joint')) { out[k.includes('_joint') ? k : k + '_joint'] = v; return; }
      out[`left_${k}_joint`] = v; out[`right_${k}_joint`] = MIRROR.has(k) ? -v : v;
    });
    return out;
  }
  const STAND = { hip_pitch: -0.12, knee: 0.3, ankle_pitch: -0.18, shoulder_pitch: 0.12, shoulder_roll: 0.16, elbow: 0.85 };
  const PRESETS = [
    ['Zero pose', 'URDF zero: every joint at 0', () => ({})],
    ['Stand', 'Relaxed standing pose', () => sym(STAND)],
    ['Wave', 'Right arm raised, elbow waving', () => Object.assign(sym(STAND), { right_shoulder_roll_joint: -1.35, right_shoulder_yaw_joint: -1.35, right_elbow_joint: -0.1, right_shoulder_pitch_joint: -0.15 }), 'wave'],
    ['Squat', 'Deep knee bend with arms forward', () => sym({ hip_pitch: -1.05, knee: 2.0, ankle_pitch: -0.85, shoulder_pitch: -0.85, elbow: 0.55, waist_pitch: 0.22, shoulder_roll: 0.1 })],
    ['Reach', 'Both arms reaching forward', () => sym({ ...STAND, shoulder_pitch: -1.45, elbow: 1.45, shoulder_roll: 0.08 })],
    ['Walk cycle', 'Looping kinematic demo, not Unitree’s gait controller', null, 'walk']
  ];
  const anim = { tween: null, loop: null, sweep: null };
  function poseTo(target, dur = 700) {
    anim.loop = null; anim.sweep = null;
    const from = RJ.map((J) => J.q), to = RJ.map((J) => clamp(target[J.name] ?? 0, J.lower, J.upper));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) dur = 1;
    anim.tween = { t0: performance.now(), dur, from, to };
  }
  function walkAt(t) {
    const ph = t * 2 * Math.PI * 0.85, s = Math.sin(ph);
    const q = {};
    [['left', 0], ['right', Math.PI]].forEach(([side, off]) => {
      const sp = Math.sin(ph + off);
      const hip = -0.22 - 0.34 * sp;
      const knee = 0.32 + 0.55 * Math.max(0, Math.sin(ph + off + 0.9));
      q[`${side}_hip_pitch_joint`] = hip; q[`${side}_knee_joint`] = knee;
      q[`${side}_ankle_pitch_joint`] = clamp(-(hip + knee) * 0.85, -0.87, 0.52);
      q[`${side}_shoulder_pitch_joint`] = 0.1 + 0.32 * sp;
      q[`${side}_elbow_joint`] = 0.8 - 0.15 * sp;
      q[`${side}_shoulder_roll_joint`] = side === 'left' ? 0.14 : -0.14;
    });
    q.waist_yaw_joint = 0.07 * s;
    return q;
  }
  function stepAnim(now) {
    let changed = false;
    if (anim.tween) {
      const a = anim.tween, k = clamp((now - a.t0) / a.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      RJ.forEach((J, i) => setQ(J, a.from[i] + (a.to[i] - a.from[i]) * e));
      changed = true;
      if (k >= 1) { anim.tween = null; if (a.then) a.then(); }
    } else if (anim.loop === 'walk') {
      const q = walkAt((now - anim.t0) / 1000);
      RJ.forEach((J) => { if (J.name in q) setQ(J, q[J.name]); });
      changed = true;
    } else if (anim.loop === 'wave') {
      const t = (now - anim.t0) / 1000;
      setQ(jointByName.right_elbow_joint, -0.35 + 0.35 * Math.sin(t * 7));
      setQ(jointByName.right_wrist_roll_joint, 0.3 * Math.sin(t * 7));
      changed = true;
      if (t > 3.2) anim.loop = null;
    } else if (anim.sweep) {
      // q0 -> upper limit -> lower limit -> q0 at a steady speed
      const s = anim.sweep, J = s.J, legs = [[s.q0, J.upper], [J.upper, J.lower], [J.lower, s.q0]];
      let t = (now - s.t0) / 1000, done = true;
      for (const [a, b] of legs) {
        const dur = Math.max(0.3, Math.abs(b - a) / 1.8);
        if (t < dur) { const k = t / dur, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; setQ(J, a + (b - a) * e); done = false; break; }
        t -= dur;
      }
      if (done) { setQ(J, s.q0); anim.sweep = null; }
      changed = true;
    }
    if (changed) { ground(); syncSliders(); }
  }
  function runPreset(i) {
    const [, , fn, loop] = PRESETS[i];
    if (loop === 'walk') { anim.tween = null; anim.sweep = null; anim.loop = 'walk'; anim.t0 = performance.now(); }
    else { poseTo(fn()); if (loop === 'wave') anim.tween.then = () => { anim.loop = 'wave'; anim.t0 = performance.now(); }; }
    document.querySelectorAll('#presets .btn').forEach((b, k) => b.classList.toggle('primary', k === i));
  }

  /* ---------------- pose panel ---------------- */
  const sliders = {};
  function buildPosePanel() {
    const pre = $('#presets');
    PRESETS.forEach(([name, title], i) => {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = name; b.title = title;
      b.addEventListener('click', () => runPreset(i)); pre.appendChild(b);
    });
    const groups = [['Left leg', /^left_(hip|knee|ankle)/], ['Right leg', /^right_(hip|knee|ankle)/], ['Waist', /^waist/], ['Left arm', /^left_(shoulder|elbow|wrist)/], ['Right arm', /^right_(shoulder|elbow|wrist)/]];
    const host = $('#jointGroups');
    groups.forEach(([gname, re], gi) => {
      const det = document.createElement('details'); det.className = 'grp'; if (gi === 0) det.open = true;
      det.innerHTML = `<summary>${gname}</summary>`;
      RJ.filter((J) => re.test(J.name)).forEach((J) => {
        const row = document.createElement('div'); row.className = 'jrow';
        const id = 'q-' + J.name;
        row.innerHTML = `<button type="button" title="Show details">${esc(INFO.joints[J.key].title)}</button>
          <input type="range" id="${id}" min="${J.lower}" max="${J.upper}" step="0.005" value="0" aria-label="${esc(J.side + ' ' + INFO.joints[J.key].title)} angle">
          <output for="${id}">0°</output>`;
        const [btn, inp, out] = row.children;
        btn.addEventListener('click', () => select({ kind: 'joint', id: J.name }));
        inp.addEventListener('input', () => { anim.tween = anim.loop = anim.sweep = null; setQ(J, +inp.value); ground(); syncSliders(); });
        sliders[J.name] = { inp, out };
        det.appendChild(row);
      });
      host.appendChild(det);
    });
  }
  function syncSliders() {
    RJ.forEach((J) => {
      const s = sliders[J.name]; if (!s) return;
      if (document.activeElement !== s.inp) s.inp.value = J.q;
      s.out.textContent = Math.round(J.q * DEG) + '°';
    });
    const ins = $('#ins-q');
    if (ins && state.sel && state.sel.kind === 'joint') {
      const J = jointByName[state.sel.id];
      if (document.activeElement !== ins) ins.value = J.q;
      $('#ins-qv').textContent = (J.q * DEG).toFixed(1) + '°';
    }
  }

  /* ---------------- inspector ---------------- */
  const ins = $('#inspector');
  function head(eyebrow, title, closable = true) {
    return `<div class="eyebrow">${esc(eyebrow)}</div><div class="ins-head"><h2>${esc(title)}</h2>${closable ? '<button class="close" id="ins-close" aria-label="Close">✕</button>' : ''}</div>`;
  }
  const chip = (L) => `<span class="axis-chip" style="background:${['var(--x)', 'var(--y)', 'var(--z)']['XYZ'.indexOf(L)]}">${L}</span>`;
  const MODE_TEXT = {
    real: 'The official Unitree meshes with a realistic finish: black anodised covers and machined aluminium limbs.',
    solid: 'The same meshes coloured by assembly, so you can see where each body section starts and ends.',
    skeleton: 'The kinematic skeleton: how the 29 joints connect and which way each one turns. Each sphere is a joint axis, coloured by the axis it turns around.',
    blueprint: 'An engineering X-ray. The official outline is drawn in lines, with actuator modules, circuit boards and colour-coded wiring inside. Click any module, board or wire. Internal layouts are illustrative.'
  };
  function renderIntro() {
    document.body.classList.add('has-inspector'); ins.hidden = false;
    ins.innerHTML = head('Explore the robot', 'Click any joint or part', false) + `<div class="ins-body">
      <p>${MODE_TEXT[state.mode]}</p>
      <dl class="kv">
        <dt>Height</dt><dd>${Math.round(ZERO.height)} mm</dd>
        <dt>Mass (URDF)</dt><dd>${totalMass.toFixed(1)} kg</dd>
        <dt>Motorised joints</dt><dd>29: legs 2×6, waist 3, arms 2×7</dd>
        <dt>Actuators</dt><dd>PMSM motors + planetary gears</dd>
      </dl>
      <h3>Try this</h3>
      <ol class="stack">
        <li>Press <b>3</b> for Skeleton and click a coloured sphere.</li>
        <li>Press <b>Sweep</b> in the panel to see that joint's full range.</li>
        <li>Open <b>Pose</b> and run the Walk cycle.</li>
      </ol>
      <div class="btns"><button class="btn" id="intro-hide">Hide panel</button></div>
    </div>`;
    $('#intro-hide').addEventListener('click', closeInspector);
  }
  function closeInspector() { state.introClosed = true; ins.hidden = true; document.body.classList.remove('has-inspector'); }

  function jointHTML(J) {
    const I = INFO.joints[J.key], fam = INFO.motorOf[J.key], F = INFO.motorFamilies[fam];
    const z = ZERO[J.name];
    const chain = J.name.includes('waist') ? 'Waist' : (J.side + (/(hip|knee|ankle)/.test(J.key) ? ' leg' : ' arm'));
    const inChain = RJ.filter((j) => (j.name.includes('waist') && J.name.includes('waist')) || (j.side === J.side && /(hip|knee|ankle)/.test(j.key) === /(hip|knee|ankle)/.test(J.key) && j.side));
    const pos = inChain.indexOf(J) + 1;
    return head(`${chain} · joint ${pos} of ${inChain.length} · id ${J.id}`, (J.side ? J.side + ' ' : '') + I.title) + `<div class="ins-body">
      <p>${esc(I.does)}</p>
      <div class="ctrl">
        <div class="row"><input type="range" id="ins-q" min="${J.lower}" max="${J.upper}" step="0.005" value="${J.q}" aria-label="Joint angle"><output id="ins-qv">${(J.q * DEG).toFixed(1)}°</output></div>
        <div class="btns"><button class="btn primary" id="ins-sweep">Sweep range</button><button class="btn" id="ins-zero">Set to 0°</button></div>
      </div>
      <dl class="kv">
        <dt>Source</dt><dd>${tag('urdf')} ${tag('motor')}</dd>
        <dt>SDK motor</dt><dd>index ${J.id} · ${(J.side ? J.side[0] + '_' : '') + J.key.toUpperCase()}</dd>
        <dt>Turns around</dt><dd>${chip(J.axisLetter)} local ${J.axisLetter} axis (${J.key.includes('pitch') || J.key === 'knee' || J.key === 'elbow' ? 'pitch' : J.key.includes('roll') ? 'roll' : 'yaw'})</dd>
        <dt>Range</dt><dd>${(J.lower * DEG).toFixed(0)}° to ${(J.upper * DEG).toFixed(0)}° (${((J.upper - J.lower) * DEG).toFixed(0)}° total)</dd>
        <dt>Torque limit</dt><dd>${J.effort} N·m (URDF)</dd>
        <dt>Speed limit</dt><dd>${J.velocity} rad/s (URDF)</dd>
        <dt>Motor family</dt><dd>${fam} · ${F.size}<br>${F.effort} N·m, ${F.velocity} rad/s (motor_info.md)</dd>
        <dt>Position</dt><dd>x ${mm(z[0])} · y ${mm(z[1])} · z ${mm(z[2])} mm<br><span style="color:var(--muted)">from pelvis, zero pose</span></dd>
        <dt>Local origin</dt><dd>xyz ${J.xyz.map((v) => mm(v)).join(', ')} mm<br>rpy ${J.rpy.map((v) => v.toFixed(4)).join(', ')} rad</dd>
        <dt>Carries</dt><dd>${massBelow(J.child).toFixed(2)} kg of robot beyond it</dd>
        <dt>Connects</dt><dd><button class="linklike" data-link="${J.parent}">${esc(J.parent)}</button> → <button class="linklike" data-link="${J.child}">${esc(J.child)}</button></dd>
      </dl>
      <h3>How it is built ${tag('teardown')}</h3><p style="margin-top:0">${esc(I.build)}</p>
      ${I.note ? `<div class="note">${esc(I.note)}</div>` : ''}
      <h3>Inside a G1 joint actuator ${tag('teardown')}</h3>
      <ol class="stack">${INFO.actuatorStack.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="src">Parts list from teardowns; the exact stacking order varies by motor size. The orange arc on the model shows the allowed range, and the white tick marks 0°.</div>
    </div>`;
  }
  function linkHTML(n) {
    const key = n.replace(/^(left|right)_/, ''), I = INFO.links[key] || { title: n, group: '', does: '' };
    const L = linkData[n], pj = jointByChild[n], side = sideOf(n);
    const kids = (childJoints[n] || []).filter((J) => J.type === 'revolute');
    return head(`Part · ${ASM[assemblyOf(n)].label}`, (side ? side + ' ' : '') + I.title) + `<div class="ins-body">
      <p>${esc(I.does)}</p>
      <dl class="kv">
        <dt>Source</dt><dd>${tag('urdf')}</dd>
        <dt>URDF link</dt><dd>${esc(n)}</dd>
        <dt>Mass</dt><dd>${L.mass != null ? L.mass.toFixed(3) + ' kg' : '—'}</dd>
        <dt>Mesh</dt><dd>${esc(D.meshes[L.visuals[0].mesh].file)}</dd>
        <dt>Moved by</dt><dd>${pj && pj.type === 'revolute' ? `<button class="linklike" data-joint="${pj.name}">${esc((pj.side ? pj.side + ' ' : '') + INFO.joints[pj.key].title)}</button>` : pj ? 'Fixed to ' + esc(pj.parent) : 'Root of the robot'}</dd>
        ${kids.length ? `<dt>Drives</dt><dd>${kids.map((J) => `<button class="linklike" data-joint="${J.name}">${esc((J.side ? J.side + ' ' : '') + INFO.joints[J.key].title)}</button>`).join('<br>')}</dd>` : ''}
      </dl>
      <div class="src">Shape and mass from Unitree's official URDF and mesh files.</div>${refsHTML(['urdf'])}
    </div>`;
  }
  const refsHTML = (keys) => (keys && keys.length ? `<div class="src">Sources: ${keys.map((k) => `<a href="${INFO.refs[k][1]}" target="_blank" rel="noopener">${esc(INFO.refs[k][0])}</a>`).join(' · ')}</div>` : '');
  function simpleHTML(eyebrow, I, extra = '') {
    const rows = I.rows ? `<dl class="kv">${I.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd style="font-family:var(--body)">${esc(v)}</dd>`).join('')}</dl>` : '';
    return head(eyebrow, I.title) + `<div class="ins-body"><p>${esc(I.does)}</p>${rows}${extra}${I.conf ? `<dl class="kv"><dt>Confidence</dt><dd style="font-family:var(--body)">${esc(I.conf)}</dd></dl>` : ''}${I.note ? `<div class="note">${esc(I.note)}</div>` : ''}${refsHTML(I.refs)}</div>`;
  }
  const FOC_SVG = `<svg class="foc" viewBox="0 0 320 196" role="img" aria-label="Driver board block diagram: DC bus, DC-link capacitors, MOSFET inverter, motor, current shunts, microcontroller, encoders and differential bus">
    <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8z" fill="currentColor"></path></marker></defs>
    <g class="b"><rect x="4" y="14" width="70" height="34" rx="4" style="stroke:#ff6b5a"></rect><text x="39" y="29">DC+ / DC−</text><text x="39" y="41">from harness</text></g>
    <g class="b"><rect x="92" y="14" width="66" height="34" rx="4"></rect><text x="125" y="29">DC-link</text><text x="125" y="41">capacitors</text></g>
    <g class="b"><rect x="176" y="14" width="72" height="34" rx="4"></rect><text x="212" y="29">3-phase MOSFET</text><text x="212" y="41">inverter</text></g>
    <g class="b"><rect x="266" y="14" width="50" height="34" rx="4" style="stroke:#e8a15a"></rect><text x="291" y="29">PMSM</text><text x="291" y="41">U V W</text></g>
    <g class="b"><rect x="176" y="80" width="72" height="30" rx="4"></rect><text x="212" y="93">Current</text><text x="212" y="104">shunts</text></g>
    <g class="b"><rect x="92" y="80" width="66" height="30" rx="4" style="stroke:#8ff0c0"></rect><text x="125" y="93">Local MCU</text><text x="125" y="104">FOC</text></g>
    <g class="b"><rect x="4" y="80" width="70" height="30" rx="4" style="stroke:#ffd060"></rect><text x="39" y="93">Diff. pair</text><text x="39" y="104">CAN reported</text></g>
    <g class="b"><rect x="92" y="146" width="66" height="30" rx="4"></rect><text x="125" y="159">Dual</text><text x="125" y="170">encoders</text></g>
    <g class="w"><path d="M74,31 H90" marker-end="url(#ah)"></path><path d="M158,31 H174" marker-end="url(#ah)"></path><path d="M248,31 H264" marker-end="url(#ah)"></path>
      <path d="M212,48 V78" marker-end="url(#ah)"></path><path d="M176,95 H160" marker-end="url(#ah)"></path><path d="M140,80 V62 H196 V50" marker-end="url(#ah)"></path>
      <path d="M76,95 H90" marker-start="url(#ah)" marker-end="url(#ah)"></path><path d="M125,146 V112" marker-end="url(#ah)"></path><path d="M291,48 V161 H160" marker-end="url(#ah)"></path></g>
    <text class="t" x="166" y="58">gate drive</text>
  </svg>`;
  const SW = { xt30: '#ffd060', housing: '#3a78bd', copper: '#e8a15a', rotor: '#d6e9ff', gear: '#d6e9ff', pcb: '#1d6b48', encoder: '#8ff0c0', shaft: '#d6e9ff' };
  function moduleHTML(J) {
    const fam = INFO.motorOf[J.key], F = INFO.motorFamilies[fam], ankle = J.key.startsWith('ankle');
    const side = J.side ? J.side + ' ' : '';
    const [r, h] = MOTOR_SIZE[fam.slice(0, 4)];
    const chain = J.name.includes('waist') || /(hip|knee|ankle)/.test(J.key) ? (J.side ? J.side.toLowerCase() + ' leg' : 'leg') : J.side.toLowerCase() + ' arm';
    return head(`Actuator module · ${fam}`, ankle ? `${side}ankle drive motors` : `${side}${INFO.joints[J.key].title} actuator`) + `<div class="ins-body">
      <p>${esc(ankle ? INFO.module.ankle : INFO.module.intro)}</p>
      <p>${esc(INFO.module.official)} <span class="tag" style="--c:#5cb85f">Documented · Unitree</span></p>
      <h3>What the drawing shows ${tag('teardown')}</h3>
      <ul class="parts">${INFO.module.parts.map(([k, t, d]) => `<li><b><i style="background:${SW[k]}"></i>${esc(t)}</b>${esc(d)}</li>`).join('')}</ul>
      <h3>Numbers</h3>
      <dl class="kv">
        <dt>Motor family</dt><dd>${fam} · ${F.size} ${tag('motor')}</dd>
        <dt>Rated</dt><dd>${F.effort} N·m, ${F.velocity} rad/s (motor_info.md)</dd>
        <dt>URDF limits</dt><dd>${J.effort} N·m, ${J.velocity} rad/s ${tag('urdf')}</dd>
        <dt>Drawn size</dt><dd>⌀${Math.round(r * 2000)} × ${Math.round(h * 1000)} mm ${tag('illus')}</dd>
        <dt>Wired to</dt><dd>Power and low-level motor bus of the ${esc(chain)} chain</dd>
      </dl>
      <h3>How the driver board works ${tag('teardown')}</h3>
      ${FOC_SVG}
      <div class="src">Educational block diagram, not an official circuit. Pin numbers, bus termination, phase map, transistor types and component values are not published.</div>
      <div class="note">Drawn size is a guess from the family name (for example, 7519 is commonly read as a 75 mm stator, 19 mm thick). Unitree does not publish the module dimensions or internal layout.</div>
      <div class="btns"><button class="btn primary" data-joint="${J.name}">Open joint details</button></div>
      ${refsHTML(['g1d', 'amass', 'cps', 'urdf'])}
    </div>`;
  }
  function connectionsHTML(sel) {
    const near = { loco: ['bus', 'eth-loco', 'imu', 'pw-comp', 'usb-cam-pc1'], dev: ['eth-dev', 'usb-cam-pc2', 'audio', 'pw-comp'], power: ['pw-'], bms: ['pw-batt'], battery: ['pw-batt'], switch: ['eth-'],
      io: ['eth-ext'], headmcu: ['audio'], caps: ['pw-arm', 'pw-leg'], mic: ['audio'], speaker: ['audio'], d435_link: ['usb-cam'], mid360_link: ['eth-lidar'], imu_in_torso: ['imu-torso'], imu_in_pelvis: ['imu-pelvis'] }[sel.id] || [];
    const list = Object.values(O.pathById).filter((p) => near.some((k) => p.id.startsWith(k)));
    if (!list.length) return '';
    return `<div class="ins-body"><h3>Connections</h3><dl class="kv">${list.map((p) => `<dt><i style="display:inline-block;width:14px;height:3px;background:${INFO.wireTypes[p.type].colour};vertical-align:3px;margin-right:6px"></i>${INFO.wireTypes[p.type].title}</dt><dd><button class="linklike" data-path="${p.id}">${esc(p.title)}</button></dd>`).join('')}</dl></div>`;
  }
  function pathHTML(p) {
    const W = INFO.wireTypes[p.type];
    return head(`Wiring · ${W.title}`, p.title) + `<div class="ins-body">
      <p>${esc(W.does)}</p>
      <dl class="kv">
        <dt>From</dt><dd style="font-family:var(--body)">${esc(p.from)}</dd>
        <dt>To</dt><dd style="font-family:var(--body)">${esc(p.to)}</dd>
        <dt>Connection</dt><dd>${p.conf ? '<span class="tag" style="--c:#5cb85f">Documented</span> solid line' : '<span class="tag" style="--c:#d88a35">Inferred</span> dashed line'}</dd>
        <dt>Route</dt><dd>${tag('illus')}</dd>
      </dl>
      ${p.note ? `<div class="note">${esc(p.note)}</div>` : ''}${W.note ? `<div class="note">${esc(W.note)}</div>` : ''}${refsHTML(W.refs)}
      <div class="src">Cables in the G1 run through the hollow centres of the joints. This line shows what connects to what, not the measured cable path, gauge or connector pins.</div>
    </div>`;
  }
  function select(sel) {
    state.sel = sel;
    if (!sel) { refreshMaterials(); if (state.introClosed) closeInspector(); else renderIntro(); return; }
    let html;
    if (sel.kind === 'joint') html = jointHTML(jointByName[sel.id]);
    else if (sel.kind === 'link') html = linkHTML(sel.id);
    else if (sel.kind === 'sensor') {
      const p = ZERO[sel.id];
      html = simpleHTML('Sensor · fixed frame', INFO.sensors[sel.id], `<dl class="kv"><dt>Source</dt><dd>${tag('urdf')}</dd><dt>URDF frame</dt><dd>${sel.id}</dd><dt>Position</dt><dd>x ${mm(p[0])} · y ${mm(p[1])} · z ${mm(p[2])} mm</dd></dl>`);
      html += connectionsHTML(sel);
    } else if (sel.kind === 'module') html = moduleHTML(jointByName[sel.id]);
    else if (sel.kind === 'board') {
      const B = INFO.boards[sel.id], r = B.refs || [];
      const tags = `${r.includes('weston') || r.includes('qre') ? tag('docs') : ''} ${r.includes('cps') ? tag('teardown') : ''} ${tag('illus')}`;
      html = simpleHTML('Circuit · illustrative layout', B, `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${tags}</div>`) + connectionsHTML(sel);
    }
    else if (sel.kind === 'path') html = pathHTML(O.pathById[sel.id]);
    document.body.classList.add('has-inspector'); ins.hidden = false; ins.innerHTML = html;
    $('#ins-close').addEventListener('click', () => { select(null); closeInspector(); });
    ins.querySelectorAll('[data-joint]').forEach((b) => b.addEventListener('click', () => select({ kind: 'joint', id: b.dataset.joint })));
    ins.querySelectorAll('[data-path]').forEach((b) => b.addEventListener('click', () => select({ kind: 'path', id: b.dataset.path })));
    ins.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => select({ kind: 'link', id: b.dataset.link })));
    if (sel.kind === 'joint') {
      const J = jointByName[sel.id];
      $('#ins-q').addEventListener('input', (e) => { anim.tween = anim.loop = anim.sweep = null; setQ(J, +e.target.value); ground(); syncSliders(); });
      $('#ins-sweep').addEventListener('click', () => { anim.tween = anim.loop = null; anim.sweep = { J, t0: performance.now(), q0: J.q }; });
      $('#ins-zero').addEventListener('click', () => { const t = {}; RJ.forEach((j) => { t[j.name] = j === J ? 0 : j.q; }); poseTo(t, 500); });
    }
    refreshMaterials();
  }

  /* ---------------- legend ---------------- */
  function renderLegend() {
    const lg = $('#legend'); let h = '';
    const L = state.layers[state.mode] || {};
    const tog = (k, label) => `<label><input type="checkbox" data-layer="${k}" ${L[k] ? 'checked' : ''}>${label}</label>`;
    const wire = (t, dashed) => `<span><i style="background:${INFO.wireTypes[t].colour};height:3px;width:16px;border-radius:2px"></i>${INFO.wireTypes[t].title}</span>`;
    if (state.mode === 'real') h = `<div class="lg-title">Real</div><div class="sw"><span><i style="background:#26292e;border:1px solid #444"></i>Black covers</span><span><i style="background:#878d94"></i>Aluminium structure</span></div>`;
    else if (state.mode === 'solid') h = `<div class="lg-title">3D · assemblies</div><div class="sw">${Object.values(ASM).map((a) => `<span><i style="background:#${a.c.toString(16).padStart(6, '0')}"></i>${a.label}</span>`).join('')}</div>`;
    else if (state.mode === 'skeleton') h = `<div class="lg-title">Skeleton · kinematics</div><div class="sw"><span><i style="background:var(--x)"></i>X roll</span><span><i style="background:var(--y)"></i>Y pitch</span><span><i style="background:var(--z)"></i>Z yaw</span><span><i style="background:#3fc98a"></i>Sensor frame</span></div>
      <div class="layers">${tog('shell', 'Shell')}${tog('joints', 'Joints')}${tog('rods', 'Links')}${tog('sensors', 'Sensors')}</div>`;
    else h = `<div class="lg-title">Blueprint · internals</div><div class="sw">${wire('power')}${wire('bus')}${wire('eth')}${wire('data')}<span><i style="background:#1d6b48;border:1px solid #8ff0c0"></i>Circuit board</span><span><i style="background:#e8a15a"></i>Motor windings</span></div>
      <div class="src" style="margin-top:6px">Solid line: documented connection. Dashed: inferred. All routes and layouts are illustrative.</div>
      <div class="layers">${tog('outline', 'Outline')}${tog('modules', 'Actuators')}${tog('boards', 'Circuits')}${tog('power', 'Power')}${tog('bus', 'Motor bus')}${tog('data', 'Network + sensors')}${tog('linkage', 'Ankle linkage')}${tog('dims', 'Dimensions')}${tog('skeleton', 'Skeleton')}</div>`;
    h += `<div class="explode"><label for="explode">Explode</label><input type="range" id="explode" min="0" max="1" step="0.01" value="${explode}"><output>${Math.round(explode * 100)}%</output></div>`;
    lg.innerHTML = h;
    const ex = $('#explode', lg);
    ex.addEventListener('input', () => { setExplode(+ex.value); ex.nextElementSibling.textContent = Math.round(explode * 100) + '%'; });
    lg.querySelectorAll('[data-layer]').forEach((c) => c.addEventListener('change', () => { L[c.dataset.layer] = c.checked; refreshMaterials(); }));
  }

  /* ---------------- labels + picking ---------------- */
  const jointLabels = [];
  function buildLabels() {
    RJ.forEach((J) => {
      const el = document.createElement('div'); el.className = 'lbl'; el.hidden = true;
      el.textContent = (J.side ? J.side[0] + ' ' : '') + INFO.joints[J.key].title.toLowerCase();
      $('#labels').appendChild(el); jointLabels.push({ el, J });
    });
  }
  const _p = new T.Vector3();
  function place(el, wpos, w, h) {
    _p.copy(wpos).project(camera);
    const off = _p.z > 1 || _p.z < -1;
    el.style.visibility = off ? 'hidden' : 'visible';
    if (!off) el.style.transform = `translate(${((_p.x + 1) / 2) * w}px, ${((1 - _p.y) / 2) * h}px) translate(-50%, -150%)`;
  }
  function updateLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    jointLabels.forEach(({ el, J }) => {
      el.hidden = !state.labels; if (el.hidden) return;
      place(el, J.frame.getWorldPosition(_v), w, h);
    });
    dimLabels.forEach((d) => {
      if (d.el.hidden) return;
      _v.copy(d.p); d.obj.localToWorld(_v); _p.copy(_v).project(camera);
      d.el.style.transform = `translate(${((_p.x + 1) / 2) * w}px, ${((1 - _p.y) / 2) * h}px) translate(-50%, -50%)`;
    });
  }
  const ray = new T.Raycaster(); ray.layers.enableAll();
  const ndc = new T.Vector2();
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  function pickAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    ray.params.Line.threshold = 0.006;
    const over = ray.intersectObjects(O.pick.filter(shown), false);
    if (over.length) return over[0].object.userData;
    const hits = ray.intersectObjects(allMeshes.filter(shown), false);
    return hits.length ? hits[0].object.userData : null;
  }
  function labelFor(ud) {
    if (!ud) return '';
    if (ud.kind === 'joint') { const J = jointByName[ud.id]; return (J.side ? J.side + ' ' : '') + INFO.joints[J.key].title; }
    if (ud.kind === 'link') { const k = ud.id.replace(/^(left|right)_/, ''); return (sideOf(ud.id) ? sideOf(ud.id) + ' ' : '') + ((INFO.links[k] || {}).title || ud.id); }
    if (ud.kind === 'sensor') return INFO.sensors[ud.id].title;
    if (ud.kind === 'board') return INFO.boards[ud.id].title;
    if (ud.kind === 'module') { const J = jointByName[ud.id]; return ud.ankle ? `${J.side} ankle drive motor` : `${J.side ? J.side + ' ' : ''}${INFO.joints[J.key].title} actuator`; }
    if (ud.kind === 'path') return O.pathById[ud.id].title;
    return '';
  }

  /* ---------------- UI wiring ---------------- */
  function bindUI() {
    document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    document.querySelectorAll('#views [data-view]').forEach((b) => b.addEventListener('click', () => goView(b.dataset.view)));
    $('#v-ortho').addEventListener('click', () => setOrtho(!state.ortho, false));
    const toggle = (btn, fn) => btn.addEventListener('click', fn);
    toggle($('#t-pose'), togglePose);
    toggle($('#t-labels'), toggleLabels);
    toggle($('#t-spin'), toggleSpin);
    toggle($('#t-full'), fullscreen);
    toggle($('#t-about'), () => openAbout(true));
    $('#about').addEventListener('click', (e) => { if (e.target.id === 'about') openAbout(false); });

    let down = null; const tip = $('#tip');
    canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const ud = pickAt(e.clientX, e.clientY);
      if (ud) { anim.loop = anim.loop === 'walk' ? anim.loop : null; select({ kind: ud.kind, id: ud.id }); }
      else if (state.sel) select(null);
    });
    let hoverQ = 0;
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons || e.pointerType === 'touch') { tip.hidden = true; return; }
      if (++hoverQ % 2) return;
      const ud = pickAt(e.clientX, e.clientY);
      canvas.style.cursor = ud ? 'pointer' : 'grab';
      tip.hidden = !ud; if (!ud) return;
      tip.textContent = labelFor(ud);
      const r = $('#app').getBoundingClientRect();
      tip.style.left = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 8) + 'px';
      tip.style.top = (e.clientY - r.top + 14) + 'px';
    });
    canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea') && !/^[1-4]$/.test(e.key)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (/^[1-4]$/.test(k)) setMode(['real', 'solid', 'skeleton', 'blueprint'][+k - 1]);
      else if (k === 'p') togglePose(); else if (k === 'l') toggleLabels(); else if (k === 't') toggleSpin();
      else if (k === 'f') fullscreen(); else if (k === 'o') setOrtho(!state.ortho, false);
      else if (k === 'r') goView('persp');
      else if (k === 'escape') { if (!$('#about').hidden) openAbout(false); else { select(null); closeInspector(); } }
      else return;
      e.preventDefault();
    });
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  }
  function togglePose() {
    const p = $('#pose'); p.hidden = !p.hidden;
    document.body.classList.toggle('has-pose', !p.hidden);
    $('#t-pose').setAttribute('aria-pressed', String(!p.hidden));
  }
  function toggleLabels() { state.labels = !state.labels; $('#t-labels').setAttribute('aria-pressed', String(state.labels)); }
  function toggleSpin() { controls.autoRotate = !controls.autoRotate; $('#t-spin').setAttribute('aria-pressed', String(controls.autoRotate)); }
  function fullscreen() {
    const d = document;
    try {
      if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen().catch(() => {});
      else { const r = d.documentElement.requestFullscreen && d.documentElement.requestFullscreen(); r && r.catch && r.catch(() => {}); }
    } catch (_) { /* not available in this view */ }
  }
  function openAbout(on) {
    const a = $('#about');
    if (on && !a.dataset.built) {
      a.dataset.built = '1';
      $('#aboutBody').innerHTML = `<div class="ins-head"><h2 id="about-h">Unitree G1 Anatomy Explorer</h2><button class="close" id="about-close" aria-label="Close">✕</button></div>
        <p>An interactive teaching model of the Unitree G1 humanoid, 29-DOF configuration (URDF <code>g1_29dof_mode_15</code>). Every part shape, joint position, axis, range and mass comes from Unitree's official robot description. Coordinates are in millimetres from the pelvis origin: x forward, y to the robot's left, z up.</p>
        <h3>What is official and what is illustrative</h3>
        <ul>
          <li><b>Official (URDF):</b> mesh shapes, joint positions and axes, joint limits, torque and speed limits, link masses, sensor frames.</li>
          <li><b>Official (motor_info.md):</b> motor family per joint.</li>
          <li><b>Illustrative:</b> motor size cylinders, ankle linkage rods and calf motors, wiring routes, electronics boxes. Their existence is documented in teardowns and guides, but their exact geometry is not published.</li>
          <li>This is a teaching model, not a manufacturing drawing.</li>
        </ul>
        <h3>Keyboard</h3>
        <table><tbody>
          <tr><td>1 2 3 4</td><td>Real · 3D · Skeleton · Blueprint</td></tr>
          <tr><td>P</td><td>Pose panel with presets and joint sliders</td></tr>
          <tr><td>L</td><td>Joint name labels</td></tr>
          <tr><td>T</td><td>Turntable rotation</td></tr>
          <tr><td>O</td><td>Orthographic camera</td></tr>
          <tr><td>R</td><td>Reset camera</td></tr>
          <tr><td>F</td><td>Full screen</td></tr>
          <tr><td>Esc</td><td>Close panel</td></tr>
        </tbody></table>
        <h3>Credits</h3>
        <p>Powered by <b>Fraunhofer IOSB-INA</b>.<br>Developed by <span style="user-select:all">muhammad.haseeb@iosb-ina.fraunhofer.de</span></p>
        <h3>Sources</h3>
        <ul>${INFO.sources.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
        <h3>Unitree mesh licence (BSD 3-Clause)</h3>
        <pre>${esc(INFO.license)}</pre>
        <p class="src">Rendering: three.js r147 (MIT).</p>`;
      $('#about-close').addEventListener('click', () => openAbout(false));
    }
    a.hidden = !on;
    if (on) $('#about-close').focus();
  }

  /* ---------------- boot ---------------- */
  const ZERO = {}; let totalMass = 0;
  function render() {
    renderer.clear();
    camera.layers.set(0);
    renderer.render(scene, camera);
    renderer.shadowMap.needsUpdate = false;
    const bg = scene.background; scene.background = null;
    renderer.clearDepth(); camera.layers.set(OVER);
    renderer.render(scene, camera);
    scene.background = bg;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    stepAnim(now); stepCam(now);
    if (controls.autoRotate) renderer.shadowMap.needsUpdate = true;
    controls.update();
    updateDynamic();
    render();
    updateLabels();
  }

  async function boot() {
    try {
      const buf = await decodeBlob();
      $('#loadmsg').textContent = 'Building the robot…';
      await new Promise((r) => setTimeout(r, 0));
      const geoms = buildGeometries(buf);
      buildRobot(geoms);
      // zero-pose reference numbers in the pelvis frame
      robot.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(linkObj.pelvis.matrixWorld).invert();
      D.joints.forEach((J) => { const p = J.frame.getWorldPosition(new T.Vector3()).applyMatrix4(inv); ZERO[J.name] = [p.x, p.y, p.z]; ZERO[J.child] = ZERO[J.name]; });
      const box = new T.Box3();
      allMeshes.forEach((m) => { const b = m.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld)); box.union(b); });
      ZERO.sole = box.min.z; ZERO.top = box.max.z; ZERO.height = (box.max.z - box.min.z) * 1000;
      totalMass = D.links.reduce((s, L) => s + (L.mass || 0), 0);
      initGround(); buildOverlay(); buildDims(ZERO); buildLabels(); buildPosePanel(); bindUI();
      resize();
      RJ.forEach((J) => setQ(J, sym(STAND)[J.name] || 0));
      ground(); syncSliders();
      document.querySelectorAll('#presets .btn')[1].classList.add('primary');
      if (window.innerWidth < 760) state.introClosed = true;
      const HASH = { real: 'real', '3d': 'solid', skeleton: 'skeleton', blueprint: 'blueprint' };
      const fromHash = () => HASH[location.hash.slice(1).toLowerCase()];
      await setMode(fromHash() || 'real');
      window.addEventListener('hashchange', () => { const m = fromHash(); if (m) setMode(m); });
      window.__g1 = { RJ, state, select, setMode, setExplode, runPreset, goView, controls, cam: () => camera }; // test hook
      $('#loading').hidden = true;
      requestAnimationFrame(frame);
    } catch (err) {
      console.error(err);
      $('#loadmsg').textContent = err.message || String(err);
    }
  }
  boot();
})();
