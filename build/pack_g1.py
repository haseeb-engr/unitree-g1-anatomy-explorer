"""Pack Unitree's official G1 (29-DOF mode 15) URDF + STL meshes into one compact
data block for the browser viewer.

Output: build/out/g1_data.js  ->  window.G1_DATA = {manifest..., blob: "<base64 gzip>"}

Per mesh: vertices welded, creased normals (smooth below CREASE_DEG, hard above),
positions quantized to uint16 inside the mesh bounding box, normals to int8.
"""
import base64, gzip, json, math, os, struct, sys
import xml.etree.ElementTree as ET
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DESC = os.path.join(HERE, '..', 'source', 'repo', 'robots', 'g1_description')
URDF = os.path.join(DESC, 'g1_29dof_mode_15.urdf')
OUT = os.path.join(HERE, 'out')
CREASE_DEG = 35.0


def read_stl(path):
    with open(path, 'rb') as f:
        data = f.read()
    n = struct.unpack_from('<I', data, 80)[0]
    if 84 + n * 50 == len(data):
        rec = np.frombuffer(data, dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]),
                            count=n, offset=84)
        return rec['v'].astype(np.float64)
    # ASCII fallback
    pts = [list(map(float, l.split()[1:4])) for l in data.decode('ascii', 'ignore').splitlines()
           if l.strip().startswith('vertex')]
    return np.array(pts, dtype=np.float64).reshape(-1, 3, 3)


def process_mesh(tris):
    T = len(tris)
    corners = tris.reshape(-1, 3)
    key = np.round(corners * 1e6).astype(np.int64)
    uniq, vid = np.unique(key, axis=0, return_inverse=True)
    vid = vid.reshape(-1)
    verts = uniq.astype(np.float64) / 1e6

    e1 = tris[:, 1] - tris[:, 0]
    e2 = tris[:, 2] - tris[:, 0]
    fn = np.cross(e1, e2)
    area = np.linalg.norm(fn, axis=1)
    keep = area > 1e-14
    fn_unit = np.zeros_like(fn)
    fn_unit[keep] = fn[keep] / area[keep, None]

    # corner -> face pairs sharing the same welded vertex
    C = 3 * T
    cface = np.repeat(np.arange(T), 3)
    order = np.argsort(vid, kind='stable')
    svid = vid[order]
    starts = np.r_[0, np.flatnonzero(np.diff(svid)) + 1]
    sizes = np.diff(np.r_[starts, C])
    grp_of_sorted = np.repeat(np.arange(len(starts)), sizes)
    d = sizes[grp_of_sorted]             # group size for each sorted corner
    s = starts[grp_of_sorted]
    total = int(d.sum())
    a_idx = np.repeat(np.arange(C), d)   # sorted corner index
    off = np.arange(total) - np.repeat(np.cumsum(d) - d, d)
    b_idx = np.repeat(s, d) + off        # partner sorted corner index
    fa = cface[order[a_idx]]
    fb = cface[order[b_idx]]
    dots = np.einsum('ij,ij->i', fn_unit[fa], fn_unit[fb])
    ok = dots > math.cos(math.radians(CREASE_DEG))
    acc = np.zeros((C, 3))
    np.add.at(acc, a_idx[ok], fn[fb[ok]])          # area weighted
    cn = np.zeros((C, 3))
    cn[order] = acc
    ln = np.linalg.norm(cn, axis=1)
    cn = np.where(ln[:, None] > 0, cn / np.maximum(ln, 1e-30)[:, None], fn_unit[cface])
    qn = np.clip(np.round(cn * 127), -127, 127).astype(np.int8)

    k2 = np.concatenate([vid[:, None].astype(np.int64), qn.astype(np.int64)], axis=1)
    fin, inv = np.unique(k2, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    pos = verts[fin[:, 0]]
    nrm = fin[:, 1:4].astype(np.int8)
    idx = inv.reshape(-1, 3)[keep].reshape(-1)

    lo, hi = pos.min(0), pos.max(0)
    rng = np.maximum(hi - lo, 1e-9)
    qp = np.round((pos - lo) / rng * 65535).astype(np.uint16)
    return qp, nrm, idx.astype(np.uint32), lo, rng, T


def fl(s, n=3):
    return [float(x) for x in (s or ' '.join(['0'] * n)).split()]


def main():
    root = ET.parse(URDF).getroot()
    links, joints, meshes = [], [], []
    pos_parts, nrm_parts, idx_parts = [], [], []
    p_off = n_off = i_off = 0
    mesh_cache = {}
    tri_total = 0
    for L in root.findall('link'):
        name = L.get('name')
        inertial = L.find('inertial')
        mass = float(inertial.find('mass').get('value')) if inertial is not None else None
        com = fl(inertial.find('origin').get('xyz')) if inertial is not None and inertial.find('origin') is not None else None
        visuals = []
        for v in L.findall('visual'):
            m = v.find('geometry/mesh')
            if m is None:
                continue
            fn = os.path.basename(m.get('filename'))
            o = v.find('origin')
            mat = v.find('material')
            if fn not in mesh_cache:
                tris = read_stl(os.path.join(DESC, 'meshes', fn))
                qp, nrm, idx, lo, rng, T = process_mesh(tris)
                tri_total += T
                big = qp.shape[0] > 65535
                mesh_cache[fn] = len(meshes)
                meshes.append(dict(file=fn, v=int(qp.shape[0]), i=int(idx.size), big=big,
                                   lo=[round(x, 7) for x in lo], rng=[round(x, 7) for x in rng],
                                   p=p_off, n=n_off, x=i_off))
                pos_parts.append(qp.tobytes()); p_off += qp.nbytes
                nrm_parts.append(nrm.tobytes()); n_off += nrm.nbytes
                ib = idx.astype(np.uint32 if big else np.uint16).tobytes()
                idx_parts.append(ib); i_off += len(ib)
                if i_off % 4:
                    idx_parts.append(b'\0' * (4 - i_off % 4)); i_off += 4 - i_off % 4
                print(f'  {fn:36s} tris {T:6d} -> verts {qp.shape[0]:6d}', file=sys.stderr)
            visuals.append(dict(mesh=mesh_cache[fn],
                                xyz=fl(o.get('xyz') if o is not None else None),
                                rpy=fl(o.get('rpy') if o is not None else None),
                                mat=mat.get('name') if mat is not None else 'white'))
        links.append(dict(name=name, mass=mass, com=com, visuals=visuals))
    for J in root.findall('joint'):
        o = J.find('origin'); a = J.find('axis'); lim = J.find('limit')
        joints.append(dict(
            name=J.get('name'), type=J.get('type'),
            parent=J.find('parent').get('link'), child=J.find('child').get('link'),
            xyz=fl(o.get('xyz') if o is not None else None),
            rpy=fl(o.get('rpy') if o is not None else None),
            axis=fl(a.get('xyz')) if a is not None else [1, 0, 0],
            lower=float(lim.get('lower')) if lim is not None and lim.get('lower') else None,
            upper=float(lim.get('upper')) if lim is not None and lim.get('upper') else None,
            effort=float(lim.get('effort')) if lim is not None and lim.get('effort') else None,
            velocity=float(lim.get('velocity')) if lim is not None and lim.get('velocity') else None))

    # sections: positions (uint16) | pad to 4 | indices | normals (int8)
    P = b''.join(pos_parts)
    pad = (4 - len(P) % 4) % 4
    I = b''.join(idx_parts)
    N = b''.join(nrm_parts)
    raw = P + b'\0' * pad + I + N
    sections = dict(pos=0, idx=len(P) + pad, nrm=len(P) + pad + len(I), total=len(raw))
    gz = gzip.compress(raw, 9)
    data = dict(source='unitreerobotics/unitree_ros robots/g1_description/g1_29dof_mode_15.urdf',
                links=links, joints=joints, meshes=meshes, sections=sections,
                blob=base64.b64encode(gz).decode('ascii'))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'g1_data.js'), 'w') as f:
        f.write('window.G1_DATA=' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(f'triangles {tri_total}, raw {len(raw)/1e6:.2f} MB, gzip {len(gz)/1e6:.2f} MB, '
          f'base64 {len(data["blob"])/1e6:.2f} MB, links {len(links)}, joints {len(joints)}', file=sys.stderr)


if __name__ == '__main__':
    main()
