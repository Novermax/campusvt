/**
 * ScreenPanel.js - Pannello "Schermate" dell'Editor scenari (Fase 2)
 *
 * Flusso UI:
 *   1) Drop o selezione PNG (screen-grab del software macchina)
 *   2) Preview 2D (canvas piccolo) + info aspect
 *   3) "Carica in viewport" → mesh PngScreen aggiunto alla scena live (PreviewBridge)
 *   4) Dropdown ScreenSnap disponibili (dal ScreenSnapRegistry)
 *   5) "Aggancia allo schermo" → applica setScreenSnapTarget e simula uno snap
 *      con la stessa logica del runtime
 *   6) "Esporta GLB" → blob model/gltf-binary scaricato come <name>.glb
 *
 * Esposto come window.EditorScreenPanel.
 */
(function () {
    'use strict';

    const Panel = {
        host: null,
        mounted: false,
        state: {
            file: null,
            pngBytes: null,
            width: 0,
            height: 0,
            aspect: 0,
            mesh: null,
            objectName: ''
        },

        mount: function (host) {
            if (!host) return;
            this.host = host;
            this._render();
            this.mounted = true;
        },

        unmount: function () {
            if (this.host) this.host.innerHTML = '';
            this.mounted = false;
            this._removeMesh();
        },

        /* ====================================================== UI render */

        _render: function () {
            const H = (key) => (window.HelpSystem ? window.HelpSystem.icon(key) : '');
            this.host.innerHTML = `
                <div class="sp-section">
                    <div class="sp-section-title">1 · Sorgente PNG ${H('sp-png')}</div>
                    <label class="sp-drop" for="spFileInput">
                        <div class="sp-drop-icon">🖼️</div>
                        <div class="sp-drop-text">Trascina qui una PNG o clicca per selezionarla</div>
                        <input type="file" id="spFileInput" accept="image/png" hidden>
                    </label>
                    <div class="sp-preview-row">
                        <div class="sp-preview-box">
                            <img id="spPreviewImg" alt="" hidden>
                            <div id="spPreviewEmpty" class="sp-empty">Nessuna PNG caricata</div>
                        </div>
                        <div class="sp-meta">
                            <div><span>Dimensioni:</span> <b id="spDims">—</b></div>
                            <div><span>Aspect:</span>     <b id="spAspect">—</b></div>
                            <div><span>File:</span>       <b id="spName">—</b></div>
                        </div>
                    </div>
                </div>

                <div class="sp-section">
                    <div class="sp-section-title">2 · Inserimento in scena ${H('sp-viewport')}</div>
                    <div class="sp-field">
                        <label for="spObjectName">Nome del mesh in scena</label>
                        <input type="text" id="spObjectName" placeholder="es. schermata_mdi" />
                    </div>
                    <button id="spLoadInViewport" class="ed-btn primary" disabled>📥 Carica in viewport</button>
                    <button id="spRemoveFromViewport" class="ed-btn ghost" disabled>🗑 Rimuovi dalla scena</button>
                </div>

                <div class="sp-section">
                    <div class="sp-section-title">3 · Aggancio al monitor ${H('sp-snap')}</div>
                    <div class="sp-field">
                        <label for="spScreenSnap">ScreenSnap disponibili (da tutorial.cvtscript)</label>
                        <select id="spScreenSnap"></select>
                    </div>
                    <button id="spSnapToScreen" class="ed-btn" disabled>🧲 Aggancia allo schermo</button>
                    <div id="spSnapStatus" class="sp-status"></div>
                </div>

                <div class="sp-section">
                    <div class="sp-section-title">4 · Esportazione ${H('sp-export')}</div>
                    <div class="sp-field">
                        <label for="spExportName">Nome file</label>
                        <input type="text" id="spExportName" placeholder="schermata.glb" />
                    </div>
                    <button id="spExportGlb" class="ed-btn primary" disabled>⬇ Esporta GLB</button>
                </div>
            `;

            this._bind('spFileInput', 'change', e => this._onFileSelected(e.target.files && e.target.files[0]));
            this._bind('spLoadInViewport', 'click', () => this._onLoadInViewport());
            this._bind('spRemoveFromViewport', 'click', () => this._removeMesh(true));
            this._bind('spSnapToScreen', 'click', () => this._onSnapToScreen());
            this._bind('spExportGlb', 'click', () => this._onExportGlb());

            const drop = this.host.querySelector('.sp-drop');
            ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
                e.preventDefault(); e.stopPropagation();
                drop.classList.add('sp-drop-hover');
            }));
            ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
                e.preventDefault(); e.stopPropagation();
                drop.classList.remove('sp-drop-hover');
            }));
            drop.addEventListener('drop', e => {
                const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) this._onFileSelected(f);
            });

            this._refreshScreenSnapList();
        },

        _bind: function (id, ev, fn) {
            const el = this.host.querySelector('#' + id);
            if (el) el.addEventListener(ev, fn);
        },

        /* ====================================================== File flow */

        _onFileSelected: function (file) {
            if (!file) return;
            if (file.type && file.type !== 'image/png') {
                this._setSnapStatus('⚠️ Servono file PNG (rilevato: ' + file.type + ')');
                return;
            }
            this.state.file = file;
            file.arrayBuffer().then(buf => {
                this.state.pngBytes = new Uint8Array(buf);
                return window.PngToGlbUtility.loadPngTexture(this.state.pngBytes);
            }).then(td => {
                this.state.width  = td.width;
                this.state.height = td.height;
                this.state.aspect = td.aspect;
                this.host.querySelector('#spDims').textContent  = `${td.width} × ${td.height} px`;
                this.host.querySelector('#spAspect').textContent = td.aspect.toFixed(3) + (
                    Math.abs(td.aspect - 16/9) < 0.01 ? ' (16:9)' :
                    Math.abs(td.aspect - 4/3)  < 0.01 ? ' (4:3)'  :
                    Math.abs(td.aspect - 1)    < 0.01 ? ' (1:1)'  : '');
                this.host.querySelector('#spName').textContent  = file.name;

                const img = this.host.querySelector('#spPreviewImg');
                const empty = this.host.querySelector('#spPreviewEmpty');
                const blob = new Blob([this.state.pngBytes], { type: 'image/png' });
                const url = URL.createObjectURL(blob);
                img.onload = () => URL.revokeObjectURL(url);
                img.src = url;
                img.hidden = false;
                empty.hidden = true;

                // Pre-popola nome mesh / export se vuoti
                const base = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_').toLowerCase();
                const nameInput = this.host.querySelector('#spObjectName');
                const expInput  = this.host.querySelector('#spExportName');
                if (!nameInput.value) nameInput.value = base || 'schermata';
                if (!expInput.value)  expInput.value  = (base || 'schermata') + '.glb';

                this.host.querySelector('#spLoadInViewport').disabled = false;
                this.host.querySelector('#spExportGlb').disabled = false;
                this._setSnapStatus('PNG pronta. Carica in viewport per agganciarla.');
            }).catch(err => {
                console.error('[ScreenPanel] Errore caricamento PNG:', err);
                this._setSnapStatus('❌ Errore caricamento PNG: ' + (err.message || err));
            });
        },

        /* ====================================================== Viewport mesh */

        _onLoadInViewport: function () {
            if (!this.state.pngBytes) return;
            const S = window.Scene3D;
            if (!S || !S.scene) { this._setSnapStatus('⚠️ Scene3D non pronto'); return; }

            this._removeMesh();
            window.PngToGlbUtility.loadPngTexture(this.state.pngBytes).then(td => {
                const mesh = window.PngToGlbUtility.buildScreenMesh(td);
                const name = (this.host.querySelector('#spObjectName').value || 'schermata').trim();
                mesh.name = name;
                this.state.objectName = name;
                this.state.mesh = mesh;

                // Posiziona iniziale: davanti alla camera, a mezza distanza dal target
                _placeInFrontOfCamera(mesh, 0.6);
                S.scene.add(mesh);

                // Registra il mesh come draggabile e abilita il sistema snap
                if (window.DragDropSystem) {
                    if (!window.DragDropSystem.enabled) {
                        window.DragDropSystem.enable([name]);
                    } else {
                        window.DragDropSystem.setDraggableObjects([name]);
                    }
                    if (window.DragDropSystem.snapSystem) {
                        window.DragDropSystem.snapSystem.enable();
                    }
                    // Posizione originale per fallback snap
                    if (window.DragDropSystem.originalPositions) {
                        window.DragDropSystem.originalPositions.set(mesh.uuid, mesh.position.clone());
                    }
                }

                this.host.querySelector('#spRemoveFromViewport').disabled = false;
                this.host.querySelector('#spSnapToScreen').disabled = false;
                this._setSnapStatus(`✅ Mesh "${name}" aggiunto alla scena. Trascinabile.`);
            }).catch(err => {
                this._setSnapStatus('❌ Errore creazione mesh: ' + (err.message || err));
            });
        },

        _removeMesh: function (notify) {
            const mesh = this.state.mesh;
            if (mesh && mesh.parent) mesh.parent.remove(mesh);
            if (mesh && mesh.geometry) mesh.geometry.dispose();
            if (mesh && mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            this.state.mesh = null;
            const btnRemove = this.host && this.host.querySelector('#spRemoveFromViewport');
            const btnSnap   = this.host && this.host.querySelector('#spSnapToScreen');
            if (btnRemove) btnRemove.disabled = true;
            if (btnSnap)   btnSnap.disabled = true;
            if (notify) this._setSnapStatus('Mesh rimosso dalla scena.');
        },

        /* ====================================================== Snap */

        /** API pubblica: riaggiorna la tendina degli ScreenSnap (chiamata al cambio tab). */
        refresh: function () {
            this._refreshScreenSnapList();
        },

        _refreshScreenSnapList: function () {
            const sel = this.host.querySelector('#spScreenSnap');
            if (!sel) return;
            const reg = window.ScreenSnapRegistry;
            const items = reg ? reg.list() : [];
            if (!items.length) {
                sel.innerHTML = '<option value="">— nessuno ScreenSnap in questa scena —</option>';
            } else {
                sel.innerHTML = items.map(s =>
                    `<option value="${s.id}">${s.name || s.id} (${s.width.toFixed(2)}×${s.height.toFixed(2)} m)</option>`
                ).join('');
            }
        },

        _onSnapToScreen: function () {
            const mesh = this.state.mesh;
            if (!mesh) { this._setSnapStatus('⚠️ Carica prima un mesh in viewport'); return; }
            const sel = this.host.querySelector('#spScreenSnap');
            const snapId = sel.value;
            if (!snapId) { this._setSnapStatus('⚠️ Nessuno ScreenSnap selezionato'); return; }
            if (!window.DragDropSystem || !window.DragDropSystem.snapSystem) {
                this._setSnapStatus('⚠️ DragDrop/SnapSystem non disponibile'); return;
            }

            // Configura il custom target screen
            window.DragDropSystem.setScreenSnapTarget(mesh.name, snapId);

            // Aumenta temporaneamente la distanza di snap per forzare l'aggancio
            // (l'utente in editor vuole il fit immediato, non un test di prossimità)
            const snap = window.ScreenSnapRegistry.get(snapId);
            if (!snap) { this._setSnapStatus('⚠️ ScreenSnap non trovato'); return; }
            const oldDist = window.DragDropSystem.snapSystem.snapDistance;
            window.DragDropSystem.snapSystem.snapDistance = 1e6; // override temporaneo

            try {
                const target = window.DragDropSystem.snapSystem.findSnapTarget(mesh);
                if (target) {
                    window.DragDropSystem.snapSystem.performSnap(mesh, target);
                    this._setSnapStatus(`✅ Snap a "${snap.name || snap.id}" eseguito (W=${snap.width}m, H=${snap.height}m)`);
                } else {
                    this._setSnapStatus('⚠️ Nessun target risolto per lo snap (controlla la registrazione)');
                }
            } finally {
                window.DragDropSystem.snapSystem.snapDistance = oldDist;
            }
        },

        /* ====================================================== Export */

        _onExportGlb: function () {
            if (!this.state.pngBytes) {
                this._setSnapStatus('⚠️ Carica prima una PNG'); return;
            }
            const filename = (this.host.querySelector('#spExportName').value || 'schermata.glb').trim();
            const meshName = (this.host.querySelector('#spObjectName').value || 'schermata').trim();
            window.PngToGlbUtility.pngToGlb(this.state.pngBytes, {
                meshName: meshName,
                filename: filename,
                download: true
            }).then(res => {
                const kb = Math.round(res.blob.size / 1024);
                this._setSnapStatus(`✅ Esportato "${filename}" — ${res.width}×${res.height} px, ${kb} KB`);
            }).catch(err => {
                this._setSnapStatus('❌ Errore export: ' + (err.message || err));
            });
        },

        /* ====================================================== Misc */

        _setSnapStatus: function (msg) {
            const el = this.host && this.host.querySelector('#spSnapStatus');
            if (el) el.textContent = msg;
        }
    };

    function _placeInFrontOfCamera(mesh, distance) {
        const S = window.Scene3D;
        if (!S || !S.camera) {
            mesh.position.set(0, 0.8, 0);
            return;
        }
        const dir = new THREE.Vector3();
        S.camera.getWorldDirection(dir);
        const p = S.camera.position.clone().addScaledVector(dir, distance || 1);
        mesh.position.copy(p);
        // Faccia rivolta verso la camera
        mesh.lookAt(S.camera.position);
    }

    window.EditorScreenPanel = Panel;
    console.log('[EditorScreenPanel] 📦 Modulo caricato (v1.0)');
})();
