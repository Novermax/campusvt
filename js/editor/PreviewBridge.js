/**
 * PreviewBridge.js - Ponte tra l'editor e il motore 3D reale (Scene3D + UI).
 *
 * L'anteprima dell'editor NON è un mock: riusa lo stesso Scene3D/UI del
 * runtime. Questo modulo:
 *  - inizializza Scene3D se serve,
 *  - sposta il canvas #canvas3d dentro l'host dell'anteprima e lo ridimensiona
 *    al contenitore (il renderer di default usa l'intera finestra),
 *  - carica lo scenario reale (modelli, luci, camera) via UI.loadScenario,
 *  - reinietta il tutorial dal testo dell'editor (CVTScriptV3.preprocess +
 *    parseTutorialContent) e naviga allo step in lavorazione,
 *  - cattura la camera corrente in sintassi v3,
 *  - permette il "click-to-pick" di un oggetto come element dello step.
 *
 * Esposto come window.EditorPreviewBridge.
 */
(function () {
    'use strict';

    const Bridge = {
        host: null,
        canvas: null,
        _originalParent: null,
        _originalNextSibling: null,
        _resizeHandler: null,
        _resizeObserver: null,
        _pickHandler: null,
        pickCallback: null,
        active: false,
        _lastSectionIdx: -1,
        _lastFlatStepIdx: -1,

        /* ===== Inizializzazione Scene3D ===== */
        ensureScene: function () {
            if (window.Scene3D && !window.Scene3D.isInitialized) {
                try { window.Scene3D.init(); } catch (e) { console.warn('[PreviewBridge] init Scene3D:', e); }
            }
            return !!(window.Scene3D && window.Scene3D.isInitialized);
        },

        /* ===== Aggancio canvas al pannello anteprima ===== */
        attach: function (hostEl) {
            this.ensureScene();
            this.host = hostEl;
            this.canvas = document.getElementById('canvas3d');
            if (!this.canvas || !this.host) {
                console.warn('[PreviewBridge] canvas o host mancante');
                return;
            }
            if (this.canvas.parentElement !== this.host) {
                this._originalParent = this.canvas.parentElement;
                this._originalNextSibling = this.canvas.nextSibling;
                this.host.appendChild(this.canvas);
            }
            this.canvas.classList.add('editor-preview-canvas');

            this._resizeHandler = () => this.resize();
            // Si registra DOPO il listener globale di Scene3D, quindi gira per ultimo
            window.addEventListener('resize', this._resizeHandler);
            if (window.ResizeObserver) {
                this._resizeObserver = new ResizeObserver(() => this.resize());
                this._resizeObserver.observe(this.host);
            }
            this.active = true;
            // Ritarda il primo resize al layout completo
            setTimeout(() => this.resize(), 50);
        },

        detach: function () {
            this.disablePick();
            if (this._resizeHandler) {
                window.removeEventListener('resize', this._resizeHandler);
                this._resizeHandler = null;
            }
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            if (this.canvas) {
                this.canvas.classList.remove('editor-preview-canvas');
                if (this._originalParent) {
                    this._originalParent.insertBefore(this.canvas, this._originalNextSibling);
                }
            }
            this.active = false;
            // Ripristina il sizing a finestra intera per il runtime normale
            if (window.Scene3D && window.Scene3D.onWindowResize) {
                setTimeout(() => window.Scene3D.onWindowResize(), 50);
            }
        },

        resize: function () {
            if (!this.host || !window.Scene3D || !window.Scene3D.renderer || !window.Scene3D.camera) return;
            const w = this.host.clientWidth;
            const h = this.host.clientHeight;
            if (w === 0 || h === 0) return;
            window.Scene3D.renderer.setSize(w, h, true);
            window.Scene3D.camera.aspect = w / h;
            window.Scene3D.camera.updateProjectionMatrix();
        },

        /* ===== Reset scena (come il goHome del runtime) ===== */
        resetScene: function () {
            const S = window.Scene3D;
            if (S) {
                if (S.removeHighlight) try { S.removeHighlight(); } catch (e) {}
                if (S.initialModelPositions) S.initialModelPositions.clear();
                if (S.scenarioOriginalPositions) S.scenarioOriginalPositions.clear();
                if (S.clearAllModels) S.clearAllModels();
            }
            if (window.ParticleSystem && window.ParticleSystem.clearAllEffects) {
                try { window.ParticleSystem.clearAllEffects(); } catch (e) {}
            }
            if (window.HoldableSystem && window.HoldableSystem.reset) {
                try { window.HoldableSystem.reset(); } catch (e) {}
            }
        },

        /* ===== Caricamento scenario reale ===== */
        loadScenario: function (scenario) {
            this._lastSectionIdx = -1;
            this._lastFlatStepIdx = -1;
            if (!window.UI || typeof window.UI.loadScenario !== 'function') {
                return Promise.reject(new Error('UI.loadScenario non disponibile'));
            }
            // Pulisci la scena precedente: l'editor cambia scenario senza passare
            // dalla Home, dove normalmente avviene il reset (vedi UI goHome).
            this.resetScene();
            // Carica modelli + luci + camera + tutorial da disco.
            window.UI.loadScenario(scenario);
            // Attendi che i modelli/tutorial siano pronti (polling leggero).
            return new Promise((resolve) => {
                let tries = 0;
                const check = () => {
                    tries++;
                    const ready = window.UI.availableTutorials && window.UI.availableTutorials.length > 0;
                    const modelsReady = window.Scene3D && window.Scene3D.scene &&
                        window.Scene3D.scene.children && window.Scene3D.scene.children.length > 3;
                    if ((ready && modelsReady) || tries > 120) {
                        setTimeout(() => this.resize(), 30);
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        },

        /* ===== Reiniezione tutorial dal testo editor =====
         * Strategia:
         *  - parsiamo il testo con UI._suppressAutoSelect attivo, così
         *    parseTutorialContent NON chiama selectTutorial(0) come side-effect
         *    (che schedulerebbe un auto-exec dello Step 1 in grado di
         *    sovrascrivere la camera del jumpToStep dopo ~200ms);
         *  - cancelliamo anche eventuali timer pendenti da precedenti selectTutorial
         *    (es. quello rinviato a onModelLoadComplete in fase di loadScenario);
         *  - se la sezione cambia (o è la prima applicazione) chiamiamo
         *    selectTutorial(sectionIdx, {skipAutoExec:true}) per il setup;
         *  - se la sezione è la stessa aggiorniamo solo tutorialSteps con il
         *    parsing fresco (le modifiche del wizard restano visibili) ed
         *    evitiamo i reset pesanti di selectTutorial;
         *  - infine jumpToStep applica camera + trasformazioni dello step. */
        applyText: function (text, flatStepIdx, doc) {
            if (!window.UI || typeof window.UI.parseTutorialContent !== 'function') {
                return { ok: false, error: 'parser non disponibile' };
            }
            try {
                let processed = text;
                if (window.CVTScriptV3 && typeof window.CVTScriptV3.preprocess === 'function') {
                    processed = window.CVTScriptV3.preprocess(text);
                }
                const prevSuppress = window.UI._suppressAutoSelect;
                window.UI._suppressAutoSelect = true;
                let tutorials;
                try {
                    tutorials = window.UI.parseTutorialContent(processed);
                } finally {
                    window.UI._suppressAutoSelect = prevSuppress;
                }
                window.UI.availableTutorials = tutorials;
                if (!tutorials || tutorials.length === 0) {
                    return { ok: false, error: 'nessuno step trovato' };
                }
                // Cancella un eventuale auto-select pendente da onModelLoadComplete
                // (es. al primo loadScenario, prima che i modelli fossero pronti).
                window.UI._pendingAutoSelectTutorialIndex = null;
                // Cancella anche un eventuale timeout di auto-exec residuo.
                if (window.UI._selectTutorialAutoTimeout) {
                    clearTimeout(window.UI._selectTutorialAutoTimeout);
                    window.UI._selectTutorialAutoTimeout = null;
                }
                // Mappa lo step "piatto" su (sezione, indice locale) tramite l'outline
                let sectionIdx = 0, localStepIdx = 0;
                if (doc && typeof doc.getOutline === 'function') {
                    const item = doc.getOutline().find(o => o.kind === 'step' && o.stepIdx === flatStepIdx);
                    if (item) { sectionIdx = item.sectionIdx; localStepIdx = item.localStepIdx; }
                }
                if (sectionIdx >= tutorials.length) sectionIdx = 0;
                const sectionChanged = (sectionIdx !== this._lastSectionIdx);
                if (sectionChanged && typeof window.UI.selectTutorial === 'function') {
                    window.UI.selectTutorial(sectionIdx, { skipAutoExec: true });
                } else {
                    // Stessa sezione: aggiorna solo tutorialSteps con il parsing fresco
                    // (l'utente può aver modificato/aggiunto/rimosso step nel wizard).
                    window.UI.currentTutorial = tutorials[sectionIdx];
                    window.UI.tutorialSteps = tutorials[sectionIdx].steps;
                }
                this._lastSectionIdx = sectionIdx;
                this._lastFlatStepIdx = flatStepIdx;
                if (typeof window.UI.jumpToStep === 'function') {
                    // 1-based, con fast-forward — applica camera + trasformazioni precedenti
                    window.UI.jumpToStep(localStepIdx + 1);
                }
                // Evita che un modal "message" blocchi la modifica live
                this._suppressModal();
                return { ok: true };
            } catch (e) {
                console.warn('[PreviewBridge] applyText:', e);
                return { ok: false, error: e.message || String(e) };
            }
        },

        _suppressModal: function () {
            const m = document.getElementById('infoModal');
            if (m) {
                setTimeout(() => { m.classList.remove('show'); m.style.display = ''; }, 60);
            }
        },

        /* ===== Cattura camera in sintassi v3 =====
         * Delega a Scene3D.getCameraScript() — sorgente di verità che produce
         * la stessa stringa suggerita dalla console (position+target+pivot+zoom+fov+rotation+fade).
         * Il campo dello step contiene SOLO il valore (senza prefisso "camera = "). */
        captureCameraV3: function () {
            if (!window.Scene3D) return null;
            if (typeof window.Scene3D.getCameraScript === 'function') {
                const line = window.Scene3D.getCameraScript();
                if (!line) return null;
                return line.replace(/^\s*camera\s*=\s*/i, '');
            }
            // Fallback minimale se getCameraScript non è disponibile
            if (typeof window.Scene3D.getCameraInfo !== 'function') return null;
            const info = window.Scene3D.getCameraInfo();
            if (!info) return null;
            const fmt = v => parseFloat((+v || 0).toFixed(2));
            const p = info.position;
            const parts = [`position (${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)})`];
            if (info.pivot) {
                parts.push(`target (${fmt(info.pivot.x)}, ${fmt(info.pivot.y)}, ${fmt(info.pivot.z)})`);
                parts.push(`pivot (${fmt(info.pivot.x)}, ${fmt(info.pivot.y)}, ${fmt(info.pivot.z)})`);
            }
            if (info.distance != null) parts.push(`zoom ${fmt(info.distance)}`);
            if (info.fov != null) parts.push(`fov ${fmt(info.fov)}`);
            if (info.rotation) parts.push(`rotation (${fmt(info.rotation.x)}, ${fmt(info.rotation.y)}, ${fmt(info.rotation.z)})`);
            parts.push('fade 1.0');
            return parts.join(', ');
        },

        /* ===== Click-to-pick di un oggetto come element ===== */
        enablePick: function (cb) {
            this.pickCallback = cb;
            if (!this.canvas) return;
            this._pickHandler = (e) => this._onPick(e);
            this.canvas.addEventListener('click', this._pickHandler, true);
            this.canvas.classList.add('editor-pick-mode');
        },

        disablePick: function () {
            if (this.canvas && this._pickHandler) {
                this.canvas.removeEventListener('click', this._pickHandler, true);
                this.canvas.classList.remove('editor-pick-mode');
            }
            this._pickHandler = null;
            this.pickCallback = null;
        },

        _onPick: function (e) {
            e.preventDefault();
            e.stopPropagation();
            const THREE = window.THREE;
            const S = window.Scene3D;
            if (!THREE || !S || !S.camera || !S.scene) return;
            const rect = this.canvas.getBoundingClientRect();
            const ndc = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            const ray = new THREE.Raycaster();
            ray.setFromCamera(ndc, S.camera);
            const hits = ray.intersectObjects(S.scene.children, true);
            if (!hits.length) return;
            const name = this._resolveModelName(hits[0].object, S.scene);
            if (name && this.pickCallback) this.pickCallback(name);
        },

        _resolveModelName: function (obj, scene) {
            let node = obj;
            let topName = obj.name || '';
            while (node && node.parent && node.parent !== scene) {
                node = node.parent;
                if (node.name) topName = node.name;
            }
            if (node && node.parent === scene && node.name) topName = node.name;
            // I modelli sono caricati con nome = nome file senza .glb (convenzione progetto)
            return topName;
        }
    };

    window.EditorPreviewBridge = Bridge;
})();
