// Confronta la z della superficie dello schermo con la z frontale dei pulsanti
// nelle rispettive posizioni XY (camera guarda verso -Z: z maggiore = davanti).
const fs = require('fs');
const b = fs.readFileSync('models/pulpito.glb');
const jsonLen = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jsonLen).toString());
// chunk binario: subito dopo il chunk JSON
const binStart = 20 + jsonLen + 8;

function readPositions(accIdx) {
    const acc = j.accessors[accIdx];
    const bv = j.bufferViews[acc.bufferView];
    const off = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = bv.byteStride || 12;
    const out = [];
    for (let i = 0; i < acc.count; i++) {
        const p = off + i * stride;
        out.push([b.readFloatLE(p), b.readFloatLE(p + 4), b.readFloatLE(p + 8)]);
    }
    return out;
}

const nodes = j.nodes;
const screenNode = nodes.find(n => n.name === 'schermo.008');
const screenVerts = readPositions(j.meshes[screenNode.mesh].primitives[0].attributes.POSITION);

const buttons = ['Pulsante_WH', 'Pulsante_electrospindle', 'Pulsante_LU', 'Pulsante_mdi', 'Pulsante_tool'];
for (const name of buttons) {
    const n = nodes.find(x => x.name === name);
    const acc = j.accessors[j.meshes[n.mesh].primitives[0].attributes.POSITION];
    const t = n.translation || [0, 0, 0];
    const s = n.scale || [1, 1, 1];
    const cx = t[0], cy = t[1];
    const frontZ = t[2] + Math.max(acc.min[2] * s[2], acc.max[2] * s[2]);
    // vertici dello schermo entro 2cm in XY dal centro pulsante
    const near = screenVerts.filter(v => Math.abs(v[0] - cx) < 0.02 && Math.abs(v[1] - cy) < 0.02);
    if (near.length === 0) {
        console.log(`${name}: nessun vertice schermo vicino (il pulsante è fuori dal pannello video)`);
        continue;
    }
    const zs = near.map(v => v[2]);
    const screenZ = Math.max(...zs);
    const diff = ((frontZ - screenZ) * 1000).toFixed(1);
    console.log(`${name}: fronte pulsante z=${frontZ.toFixed(4)}  superficie schermo z=${screenZ.toFixed(4)}  → pulsante ${frontZ > screenZ ? 'DAVANTI' : 'DIETRO'} (${diff} mm)`);
}
