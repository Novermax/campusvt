/**
 * ScreenSnapRegistry.js - Registro globale degli snap point "schermo"
 *
 * Uno ScreenSnap rappresenta il frame di un monitor di una macchina: posizione,
 * orientamento, dimensioni reali (in metri). Serve a SnapSystem per agganciare
 * automaticamente un quad-schermata (PngScreen) sopra il monitor, allineando
 * posizione e rotazione e applicando un fit "contain" basato sull'aspect.
 *
 * Sintassi tutorial.cvtscript / config.cvtscript:
 *
 *   [ScreenSnap:monitor_principale]
 *   Name=Monitor Principale          # opzionale
 *   Position=(x, y, z)               # centro del frame in coord. mondo
 *   Rotation=(rx, ry, rz)            # gradi — orientamento del piano frame
 *   # Normal=(nx, ny, nz)            # alternativa a Rotation (vettore normale)
 *   Width=0.32                       # larghezza frame in metri
 *   Height=0.18                      # altezza frame in metri
 *   Target=a500.SchermoMonitor       # opzionale: nome modello/child che descrive
 *                                    # il piano dello schermo (per snap a runtime)
 *
 * Versione: 1.0
 * Data: 2026-05-31
 */

(function () {
    'use strict';

    window.ScreenSnapRegistry = {
        // id → { name, position:Vector3, rotation:Euler, normal:Vector3, width, height, target? }
        snaps: new Map(),

        clear: function () {
            this.snaps.clear();
        },

        /**
         * Registra uno ScreenSnap a partire dalle proprietà del blocco [ScreenSnap:id].
         * @param {string} id
         * @param {Object} props
         */
        register: function (id, props) {
            const THREE = window.THREE;
            if (!THREE) {
                console.warn('[ScreenSnapRegistry] THREE non disponibile');
                return null;
            }
            if (!id || !props) return null;

            const position = _parseVec3(props.Position) || new THREE.Vector3();
            let rotation = null;
            let normal = null;

            if (props.Rotation) {
                const r = _parseVec3(props.Rotation);
                if (r) {
                    rotation = new THREE.Euler(
                        THREE.MathUtils.degToRad(r.x),
                        THREE.MathUtils.degToRad(r.y),
                        THREE.MathUtils.degToRad(r.z),
                        'XYZ'
                    );
                }
            }
            if (props.Normal) {
                const n = _parseVec3(props.Normal);
                if (n) normal = n.normalize();
            }
            if (!rotation && !normal) {
                // Default: piano frontale (normale = +Z)
                normal = new THREE.Vector3(0, 0, 1);
            }
            if (!rotation && normal) {
                rotation = _rotationFromNormal(normal);
            }
            if (!normal && rotation) {
                normal = _normalFromRotation(rotation);
            }

            const width  = _parseNumber(props.Width)  || 0.3;
            const height = _parseNumber(props.Height) || 0.2;
            const name   = props.Name || id;
            const target = props.Target || null;

            const entry = { id, name, position, rotation, normal, width, height, target };
            this.snaps.set(id, entry);
            console.log(`[ScreenSnapRegistry] 📺 Registrato "${id}" — ${width.toFixed(3)}m × ${height.toFixed(3)}m @ (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
            return entry;
        },

        get: function (id) { return this.snaps.get(id) || null; },

        list: function () {
            return Array.from(this.snaps.values());
        },

        /**
         * Calcola lo scale "contain" per agganciare un mesh PngScreen al frame.
         * Il quad ha dimensione base 1 × (1/aspect): cerchiamo lo scale uniforme
         * massimo che mantenga il quad dentro il frame W×H.
         * @param {Object} snap - voce ottenuta da get(id)
         * @param {number} pngAspect - width/height della PNG sorgente
         * @returns {number} scale uniforme (Vector3 scale.x = scale.y = scale.z)
         */
        computeContainScale: function (snap, pngAspect) {
            if (!snap || !pngAspect || pngAspect <= 0) return 1;
            const W = snap.width, H = snap.height;
            // quad base: larghezza 1, altezza 1/aspect
            // scale per fit-width = W; altezza risultante = W/aspect
            // scale per fit-height = H * aspect; larghezza risultante = H*aspect
            // contain = min dei due (entrambi rientrano nel frame)
            return Math.min(W, H * pngAspect);
        },

        /**
         * Suggerisce un blocco [ScreenSnap:...] a partire da un child mesh del modello
         * del monitor. Calcola posizione/rotazione/larghezza/altezza dalla bounding box
         * locale del target (asse più piccolo = normale del piano schermo).
         *
         * Uso da console:
         *   ScreenSnapRegistry.suggestFromChild('pulpito.SchermoMonitor')
         *   ScreenSnapRegistry.suggestFromChild('pulpito.SchermoMonitor', { id: 'monitor_pulpito', register: true })
         *
         * Opzioni:
         *   id        slug del blocco (default: nome child)
         *   name      label leggibile (default: nome target)
         *   register  se true (default) registra subito nel registry e aggiorna la
         *             dropdown dell'editor (effetto solo runtime: per persistere
         *             incolla il blocco stampato nel tutorial.cvtscript)
         *
         * @param {string|THREE.Object3D} childRef
         * @param {Object} [opts]
         * @returns {Object|null}
         */
        suggestFromChild: function (childRef, opts) {
            opts = opts || {};
            const THREE = window.THREE;
            if (!THREE)         { console.warn('[ScreenSnapRegistry] THREE non disponibile'); return null; }
            if (!window.Scene3D) { console.warn('[ScreenSnapRegistry] Scene3D non disponibile'); return null; }

            let target = null;
            let labelId = opts.id || null;
            let modelName = null, childName = null;

            if (typeof childRef === 'string') {
                const parts = childRef.split('.');
                modelName = parts.shift();
                childName = parts.length ? parts.join('.') : null;
                target = window.Scene3D.findModelByName(modelName, childName);
                if (!labelId) labelId = _slug(childName || modelName);
            } else if (childRef && childRef.isObject3D) {
                target = childRef;
                if (!labelId) labelId = _slug(childRef.name || 'monitor');
            }

            if (!target) {
                console.warn('[ScreenSnapRegistry] suggestFromChild: target non trovato per', childRef);
                if (modelName) {
                    const m = window.Scene3D.findModelByName(modelName);
                    if (m) console.warn('  Child disponibili in', modelName + ':', window.Scene3D.listChildNames(m));
                }
                return null;
            }
            if (childName && target.name !== childName) {
                console.warn(`[ScreenSnapRegistry] Child "${childName}" non trovato: uso il modello "${target.name}" come fallback. Le dimensioni includeranno l'intero modello.`);
            }

            target.updateMatrixWorld(true);
            const targetInv = new THREE.Matrix4().copy(target.matrixWorld).invert();

            // Box in spazio target-locale (unione delle geometrie discendenti)
            const localBox = new THREE.Box3();
            let hasGeom = false;
            target.traverse(o => {
                if (o.isMesh && o.geometry) {
                    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
                    const bb = o.geometry.boundingBox.clone();
                    const meshToTarget = new THREE.Matrix4().multiplyMatrices(targetInv, o.matrixWorld);
                    bb.applyMatrix4(meshToTarget);
                    localBox.union(bb);
                    hasGeom = true;
                }
            });
            if (!hasGeom) {
                console.warn('[ScreenSnapRegistry] Nessuna geometria nel target');
                return null;
            }

            const sizeLocal   = new THREE.Vector3(); localBox.getSize(sizeLocal);
            const centerLocal = new THREE.Vector3(); localBox.getCenter(centerLocal);

            // Asse "spessore" = asse più piccolo nello spazio locale del target
            const axes = ['x', 'y', 'z'];
            let thinAxis = 'z', minDim = Infinity;
            axes.forEach(a => { if (sizeLocal[a] < minDim) { minDim = sizeLocal[a]; thinAxis = a; } });
            const planeAxes = axes.filter(a => a !== thinAxis);
            const localNormal = new THREE.Vector3(0, 0, 0); localNormal[thinAxis] = 1;

            // Posizione mondo del centro frame
            const worldPos = centerLocal.clone().applyMatrix4(target.matrixWorld);

            // Normale mondo
            const worldNormal = localNormal.clone().transformDirection(target.matrixWorld).normalize();

            // Rotazione mondo = quella che porta +Z mondo → worldNormal
            const up = new THREE.Vector3(0, 0, 1);
            const q  = new THREE.Quaternion().setFromUnitVectors(up, worldNormal);
            const eul = new THREE.Euler().setFromQuaternion(q, 'XYZ');

            // Dimensioni mondo: applica scale mondo agli assi del piano
            const worldScale = new THREE.Vector3(); target.getWorldScale(worldScale);
            const dim0 = sizeLocal[planeAxes[0]] * Math.abs(worldScale[planeAxes[0]]);
            const dim1 = sizeLocal[planeAxes[1]] * Math.abs(worldScale[planeAxes[1]]);
            const width  = Math.max(dim0, dim1);
            const height = Math.min(dim0, dim1);
            const thickness = sizeLocal[thinAxis] * Math.abs(worldScale[thinAxis]);

            const fmt    = n => (Math.round(n * 1000) / 1000).toFixed(3);
            const fmtDeg = r => (Math.round(THREE.MathUtils.radToDeg(r) * 10) / 10).toFixed(1);

            const targetName = opts.target || _composeTargetName(target);
            const displayName = opts.name || target.name || labelId;

            const block =
`[ScreenSnap:${labelId}]
Name=${displayName}
Position=(${fmt(worldPos.x)}, ${fmt(worldPos.y)}, ${fmt(worldPos.z)})
Rotation=(${fmtDeg(eul.x)}, ${fmtDeg(eul.y)}, ${fmtDeg(eul.z)})
Width=${fmt(width)}
Height=${fmt(height)}
Target=${targetName}`;

            console.log(`%c[ScreenSnapRegistry] 📋 Blocco suggerito (asse normale locale "${thinAxis}", spessore ${fmt(thickness)} m):`, 'color:#0bf;font-weight:bold');
            console.log('%c' + block, 'font-family:monospace;background:#111;color:#9f9;padding:6px 10px;border-radius:4px;');
            console.log('💡 Incolla nel tutorial.cvtscript PRIMA di [section ...]. Se la normale punta nel verso opposto al volto utente, somma 180 alla rotazione Y. Se Width/Height sono invertiti, scambiali.');

            const result = {
                id: labelId, name: displayName,
                position: worldPos, rotation: eul, normal: worldNormal,
                width, height, thickness,
                target: targetName, block
            };

            // Registrazione runtime (ephemeral) + refresh dropdown editor
            if (opts.register !== false) {
                this.register(labelId, {
                    Name: displayName,
                    Position: `(${worldPos.x}, ${worldPos.y}, ${worldPos.z})`,
                    Rotation: `(${THREE.MathUtils.radToDeg(eul.x)}, ${THREE.MathUtils.radToDeg(eul.y)}, ${THREE.MathUtils.radToDeg(eul.z)})`,
                    Width: width,
                    Height: height,
                    Target: targetName
                });
                if (window.EditorScreenPanel && typeof window.EditorScreenPanel._refreshScreenSnapList === 'function' && window.EditorScreenPanel.mounted) {
                    window.EditorScreenPanel._refreshScreenSnapList();
                    console.log('🔄 Dropdown editor aggiornata: lo ScreenSnap è ora selezionabile.');
                }
            }

            return result;
        }
    };

    /* ---------- helpers di parsing ---------- */

    function _parseVec3(str) {
        if (!str) return null;
        const THREE = window.THREE;
        const m = String(str).match(/-?\d+(?:\.\d+)?/g);
        if (!m || m.length < 3) return null;
        return new THREE.Vector3(parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2]));
    }

    function _parseNumber(str) {
        if (str === undefined || str === null) return null;
        const n = parseFloat(String(str).replace(',', '.'));
        return isFinite(n) ? n : null;
    }

    /**
     * Da una normale produce una rotazione Euler tale che un piano XY (normale +Z)
     * ruotato con quella Euler abbia la stessa normale.
     */
    function _rotationFromNormal(normal) {
        const THREE = window.THREE;
        const up = new THREE.Vector3(0, 0, 1);
        const q = new THREE.Quaternion().setFromUnitVectors(up, normal.clone().normalize());
        return new THREE.Euler().setFromQuaternion(q, 'XYZ');
    }

    /**
     * Dato un Euler, produce la normale del piano XY ruotato.
     */
    function _normalFromRotation(euler) {
        const THREE = window.THREE;
        const n = new THREE.Vector3(0, 0, 1);
        n.applyEuler(euler);
        return n.normalize();
    }

    function _slug(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'monitor';
    }

    /**
     * Costruisce il nome "modello.child" risalendo la catena dei parent fino a
     * trovare un nodo con userData.originalFilename (= GLB caricato come modello).
     */
    function _composeTargetName(obj) {
        if (!obj) return 'unknown';
        let modelRoot = null;
        let node = obj.parent;
        while (node) {
            if (node.userData && node.userData.originalFilename) {
                modelRoot = node;
                break;
            }
            node = node.parent;
        }
        if (modelRoot) {
            const modelName = (modelRoot.userData.originalFilename || modelRoot.name || '').split('/').pop().replace('.glb', '');
            if (obj.name && modelName) return `${modelName}.${obj.name}`;
        }
        // Se obj è già il root del modello
        if (obj.userData && obj.userData.originalFilename) {
            return (obj.userData.originalFilename || obj.name || '').split('/').pop().replace('.glb', '');
        }
        return obj.name || 'unknown';
    }

    console.log('[ScreenSnapRegistry] 📦 Modulo caricato (v1.0)');
})();
