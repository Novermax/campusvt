/**
 * PngToGlbUtility.js - Conversione PNG → mesh schermo "acceso" → GLB binario
 *
 * Una schermata 2D di un software macchina è un'immagine piatta: la modelliamo
 * come un quad (PlaneGeometry) con la PNG come texture. Niente luci di scena
 * la oscurano (MeshBasicMaterial + toneMapped:false + SRGBColorSpace).
 *
 * API pubblica (window.PngToGlbUtility):
 *   - loadPngTexture(input)        → Promise<{texture, image, width, height, aspect}>
 *   - buildScreenMesh(textureData) → THREE.Mesh con userData.aspect
 *   - exportMeshAsGlb(mesh, opts)  → Promise<Blob>  (model/gltf-binary)
 *   - pngToGlb(input, opts)        → Promise<{blob, mesh, width, height, aspect}>
 *
 * Il GLB esportato è ricaricabile con il GLTFLoader esistente del progetto:
 * userData.aspect viene salvato in mesh.userData e propagato nel nodo glTF
 * tramite "extras" (così SnapSystem può applicare il fit "contain").
 *
 * Versione: 1.0
 * Data: 2026-05-31
 */

(function () {
    'use strict';

    /* ====================================================================== */
    /* 1) Caricamento PNG → texture Three.js                                  */
    /* ====================================================================== */

    /**
     * Carica una PNG da File, Blob o URL e produce una THREE.Texture pronta
     * per essere applicata a un MeshBasicMaterial come "schermo acceso".
     * @param {File|Blob|string} input
     * @returns {Promise<{texture:THREE.Texture, image:HTMLImageElement, pngBytes:Uint8Array, width:number, height:number, aspect:number}>}
     */
    function loadPngTexture(input) {
        return _readAsUint8(input).then(pngBytes => {
            return _decodeImage(pngBytes).then(image => {
                const THREE = window.THREE;
                if (!THREE) throw new Error('THREE non disponibile');
                const texture = new THREE.Texture(image);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.flipY = false;          // Convenzione glTF (UV origine in alto-sx)
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.generateMipmaps = true;
                texture.needsUpdate = true;
                const w = image.naturalWidth  || image.width;
                const h = image.naturalHeight || image.height;
                return { texture, image, pngBytes, width: w, height: h, aspect: w / h };
            });
        });
    }

    /* ====================================================================== */
    /* 2) Costruzione mesh "schermo acceso"                                   */
    /* ====================================================================== */

    /**
     * Crea il quad schermo. PlaneGeometry(1, 1/aspect): larghezza unitaria,
     * altezza proporzionale → nessuna distorsione. Lo SnapSystem applicherà
     * poi la scala "contain" in base alle dimensioni del frame monitor.
     */
    function buildScreenMesh(textureData) {
        const THREE = window.THREE;
        if (!THREE) throw new Error('THREE non disponibile');
        const aspect = textureData.aspect || 1;
        const geom = new THREE.PlaneGeometry(1, 1 / aspect);
        // Flip UV.y per compensare flipY=false della texture
        // (glTF aspetta UV con origine in alto-sx; PlaneGeometry produce origine in basso-sx)
        const uv = geom.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
        uv.needsUpdate = true;

        const mat = new THREE.MeshBasicMaterial({
            map: textureData.texture,
            toneMapped: false,         // schermo "acceso", non influenzato dal toneMap
            side: THREE.DoubleSide,    // visibile da entrambi i lati
            transparent: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData.aspect = aspect;
        mesh.userData.screenAspect = aspect;     // alias esplicito per SnapSystem
        mesh.userData.isPngScreen = true;
        mesh.name = 'PngScreen';
        return mesh;
    }

    /* ====================================================================== */
    /* 3) Mini-builder GLB binario (single quad + texture PNG embedded)       */
    /* ====================================================================== */

    /**
     * Esporta il mesh come Blob model/gltf-binary.
     * Specifica: glTF 2.0 binario (header 12B + chunk JSON + chunk BIN).
     * Riferimento: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
     *
     * Limitazioni intenzionali: gestisce esclusivamente l'esportazione del
     * formato prodotto da buildScreenMesh (singola PlaneGeometry indicizzata
     * con POSITION + NORMAL + TEXCOORD_0 + MeshBasicMaterial con map PNG).
     */
    function exportMeshAsGlb(mesh, opts) {
        opts = opts || {};
        const THREE = window.THREE;
        if (!THREE) return Promise.reject(new Error('THREE non disponibile'));
        if (!mesh || !mesh.geometry) return Promise.reject(new Error('mesh.geometry mancante'));

        const geom = mesh.geometry;
        // Assicura attributi richiesti
        if (!geom.attributes.position) return Promise.reject(new Error('Posizioni mancanti'));
        if (!geom.attributes.normal) geom.computeVertexNormals();
        if (!geom.attributes.uv) return Promise.reject(new Error('UV mancanti'));
        if (!geom.index) return Promise.reject(new Error('Indici mancanti (PlaneGeometry deve essere indicizzata)'));

        const pos = geom.attributes.position;
        const nrm = geom.attributes.normal;
        const uv  = geom.attributes.uv;
        const idx = geom.index;

        // === Bin chunk: position(F32) | normal(F32) | uv(F32) | index(U16) | png ===
        const posBytes = new Uint8Array(new Float32Array(pos.array).buffer);
        const nrmBytes = new Uint8Array(new Float32Array(nrm.array).buffer);
        const uvBytes  = new Uint8Array(new Float32Array(uv.array).buffer);
        // Indici come UNSIGNED_SHORT (sufficiente per un quad, 4 vertici)
        const idxArr = new Uint16Array(idx.array);
        const idxBytes = new Uint8Array(idxArr.buffer);

        // PNG bytes
        const pngBytes = opts.pngBytes;
        if (!pngBytes) return Promise.reject(new Error('pngBytes mancanti in opts'));

        // Pad ogni view a multiplo di 4 (glTF richiede alignment)
        const parts = [
            { name: 'POSITION', bytes: posBytes,  byteStride: 12 },
            { name: 'NORMAL',   bytes: nrmBytes,  byteStride: 12 },
            { name: 'TEXCOORD', bytes: uvBytes,   byteStride: 8  },
            { name: 'INDEX',    bytes: idxBytes,  byteStride: 0  },
            { name: 'PNG',      bytes: pngBytes,  byteStride: 0  }
        ];
        let binOffset = 0;
        const layout = parts.map(p => {
            const off = binOffset;
            const padded = _alignUp(p.bytes.length, 4);
            binOffset += padded;
            return { name: p.name, byteOffset: off, byteLength: p.bytes.length, padded };
        });

        // Assembla il blob binario unico
        const binBuffer = new Uint8Array(binOffset);
        layout.forEach((entry, i) => binBuffer.set(parts[i].bytes, entry.byteOffset));

        // Min/Max per accessor POSITION (richiesto dalla spec)
        const posMin = [Infinity, Infinity, Infinity];
        const posMax = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            if (x < posMin[0]) posMin[0] = x; if (x > posMax[0]) posMax[0] = x;
            if (y < posMin[1]) posMin[1] = y; if (y > posMax[1]) posMax[1] = y;
            if (z < posMin[2]) posMin[2] = z; if (z > posMax[2]) posMax[2] = z;
        }

        const aspect = (mesh.userData && mesh.userData.aspect) || 1;
        const meshName = opts.meshName || mesh.name || 'PngScreen';

        // === JSON glTF ===
        // KHR_materials_unlit: il GLTFLoader di Three.js mappa questo a
        // MeshBasicMaterial — lo schermo resta "acceso" indipendentemente
        // dalle luci di scena, esattamente come da spec del task.
        const gltf = {
            asset: { version: '2.0', generator: 'CVT PngToGlbUtility 1.0' },
            extensionsUsed: ['KHR_materials_unlit'],
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ mesh: 0, name: meshName }],
            meshes: [{
                name: meshName,
                primitives: [{
                    attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
                    indices: 3,
                    material: 0,
                    mode: 4 // TRIANGLES
                }],
                extras: { aspect: aspect, isPngScreen: true }
            }],
            materials: [{
                name: 'ScreenMaterial',
                pbrMetallicRoughness: {
                    baseColorTexture: { index: 0, texCoord: 0 },
                    baseColorFactor: [1, 1, 1, 1],
                    metallicFactor: 0,
                    roughnessFactor: 1
                },
                doubleSided: true,
                alphaMode: 'OPAQUE',
                extensions: { KHR_materials_unlit: {} },
                extras: { toneMapped: false }
            }],
            textures: [{ source: 0, sampler: 0 }],
            images: [{ bufferView: 4, mimeType: 'image/png', name: 'screen.png' }],
            samplers: [{
                magFilter: 9729,   // LINEAR
                minFilter: 9987,   // LINEAR_MIPMAP_LINEAR
                wrapS: 33071,      // CLAMP_TO_EDGE
                wrapT: 33071
            }],
            accessors: [
                { bufferView: 0, componentType: 5126, count: pos.count, type: 'VEC3', min: posMin, max: posMax }, // POSITION (F32)
                { bufferView: 1, componentType: 5126, count: nrm.count, type: 'VEC3' },                          // NORMAL   (F32)
                { bufferView: 2, componentType: 5126, count: uv.count,  type: 'VEC2' },                          // TEXCOORD (F32)
                { bufferView: 3, componentType: 5123, count: idx.count, type: 'SCALAR' }                         // INDEX    (U16)
            ],
            bufferViews: [
                { buffer: 0, byteOffset: layout[0].byteOffset, byteLength: layout[0].byteLength, target: 34962 }, // ARRAY_BUFFER
                { buffer: 0, byteOffset: layout[1].byteOffset, byteLength: layout[1].byteLength, target: 34962 },
                { buffer: 0, byteOffset: layout[2].byteOffset, byteLength: layout[2].byteLength, target: 34962 },
                { buffer: 0, byteOffset: layout[3].byteOffset, byteLength: layout[3].byteLength, target: 34963 }, // ELEMENT_ARRAY_BUFFER
                { buffer: 0, byteOffset: layout[4].byteOffset, byteLength: layout[4].byteLength }                 // PNG (no target)
            ],
            buffers: [{ byteLength: binOffset }],
            extras: { aspect: aspect, generator: 'CVT PngToGlbUtility' }
        };

        // Encoding JSON con padding a multiplo di 4 (spazi)
        const jsonStr = JSON.stringify(gltf);
        let jsonBytes = new TextEncoder().encode(jsonStr);
        const jsonPad = _alignUp(jsonBytes.length, 4) - jsonBytes.length;
        if (jsonPad > 0) {
            const padded = new Uint8Array(jsonBytes.length + jsonPad);
            padded.set(jsonBytes, 0);
            for (let i = 0; i < jsonPad; i++) padded[jsonBytes.length + i] = 0x20; // space
            jsonBytes = padded;
        }
        // BIN chunk già allineato (vedi layout)
        const binPadded = binBuffer; // già padded a 4

        // === GLB container ===
        // Header: magic 'glTF' (0x46546C67), version 2, totalLength
        // Chunk JSON: length (UInt32), type (0x4E4F534A 'JSON'), data
        // Chunk BIN : length (UInt32), type (0x004E4942 'BIN\0'), data
        const totalLength = 12 + 8 + jsonBytes.length + 8 + binPadded.length;
        const glb = new ArrayBuffer(totalLength);
        const dv = new DataView(glb);
        let p = 0;
        // Header
        dv.setUint32(p, 0x46546C67, true); p += 4;     // 'glTF'
        dv.setUint32(p, 2, true);          p += 4;     // version 2
        dv.setUint32(p, totalLength, true); p += 4;
        // Chunk JSON
        dv.setUint32(p, jsonBytes.length, true); p += 4;
        dv.setUint32(p, 0x4E4F534A, true);       p += 4;   // 'JSON'
        new Uint8Array(glb, p, jsonBytes.length).set(jsonBytes); p += jsonBytes.length;
        // Chunk BIN
        dv.setUint32(p, binPadded.length, true); p += 4;
        dv.setUint32(p, 0x004E4942, true);       p += 4;   // 'BIN\0'
        new Uint8Array(glb, p, binPadded.length).set(binPadded);

        const blob = new Blob([glb], { type: 'model/gltf-binary' });
        if (opts.download) _triggerDownload(blob, opts.filename || 'screen.glb');
        return Promise.resolve(blob);
    }

    /* ====================================================================== */
    /* 4) Pipeline end-to-end: PNG → mesh + GLB                                */
    /* ====================================================================== */

    function pngToGlb(input, opts) {
        opts = opts || {};
        return loadPngTexture(input).then(td => {
            const mesh = buildScreenMesh(td);
            return exportMeshAsGlb(mesh, {
                pngBytes: td.pngBytes,
                meshName: opts.meshName,
                filename: opts.filename,
                download: !!opts.download
            }).then(blob => ({
                blob,
                mesh,
                width: td.width,
                height: td.height,
                aspect: td.aspect
            }));
        });
    }

    /* ====================================================================== */
    /* Helpers                                                                */
    /* ====================================================================== */

    function _readAsUint8(input) {
        if (input instanceof Uint8Array) return Promise.resolve(input);
        if (input instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(input));
        if (typeof Blob !== 'undefined' && input instanceof Blob) {
            return input.arrayBuffer().then(ab => new Uint8Array(ab));
        }
        if (typeof input === 'string') {
            // URL
            return (window.fetchFile ? window.fetchFile(input) : fetch(input))
                .then(r => r.arrayBuffer())
                .then(ab => new Uint8Array(ab));
        }
        return Promise.reject(new Error('Input PNG non riconosciuto'));
    }

    function _decodeImage(pngBytes) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([pngBytes], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
            img.src = url;
        });
    }

    function _alignUp(n, mult) { return Math.ceil(n / mult) * mult; }

    function _triggerDownload(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    /* ====================================================================== */

    window.PngToGlbUtility = {
        loadPngTexture: loadPngTexture,
        buildScreenMesh: buildScreenMesh,
        exportMeshAsGlb: exportMeshAsGlb,
        pngToGlb: pngToGlb
    };

    console.log('[PngToGlbUtility] 📦 Modulo caricato (v1.0)');
})();
