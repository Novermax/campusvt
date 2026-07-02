/**
 * AfterPicker.js - Picker visivo per il campo "after" dello step wizard.
 *
 * Legge i StateGroup registrati dalla scena corrente (objects.ini →
 * window.InteractiveObject3D.stateGroups) e li presenta come gruppi di
 * varianti con thumbnail 3D renderizzate al volo. Il click su una variante
 * scrive nel campo `after` la coppia "gruppo = variante" (e supporta più
 * gruppi separati da `;`).
 *
 * Le thumbnail sono generate da un WebGLRenderer dedicato (offscreen),
 * piccolo, condiviso e lazy-init. Le meshes vengono clonate dalla scena
 * live così l'aspetto è esattamente quello che vedrà l'utente.
 *
 * Esposto come window.EditorAfterPicker.
 */
(function () {
    'use strict';

    const THUMB_W = 96;
    const THUMB_H = 72;
    const PREVIEW_W = 320;
    const PREVIEW_H = 240;

    // Cache delle dataURL: key = `${groupName}|${variantName}|${size}` → dataURL
    const thumbCache = new Map();

    // Renderer condiviso (creato la prima volta che serve)
    let renderer = null;
    let renderScene = null;
    let renderCamera = null;
    let renderLight1 = null;
    let renderLight2 = null;
    let renderLightAmb = null;

    function ensureRenderer() {
        if (renderer) return true;
        const THREE = window.THREE;
        if (!THREE) return false;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: true
            });
            renderer.setPixelRatio(1);
            renderer.setClearColor(0x000000, 0);
            renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;

            renderScene = new THREE.Scene();
            renderLightAmb = new THREE.AmbientLight(0xffffff, 0.6);
            renderLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
            renderLight1.position.set(2, 3, 4);
            renderLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
            renderLight2.position.set(-3, -1, -2);
            renderScene.add(renderLightAmb);
            renderScene.add(renderLight1);
            renderScene.add(renderLight2);

            renderCamera = new THREE.PerspectiveCamera(35, THUMB_W / THUMB_H, 0.001, 1000);
            return true;
        } catch (e) {
            console.warn('[AfterPicker] WebGLRenderer init fallito:', e);
            renderer = null;
            return false;
        }
    }

    /**
     * Renderizza la variante in una dataURL PNG di dimensioni date.
     * Clona l'Object3D dalla scena live, ne calcola il bounding box e
     * posiziona la camera per inquadrarlo. Ritorna '' se non renderizzabile.
     */
    function renderVariantToDataURL(object3D, w, h) {
        const THREE = window.THREE;
        if (!THREE || !object3D || !ensureRenderer()) return '';

        renderer.setSize(w, h, false);
        renderCamera.aspect = w / h;

        // Clona l'oggetto per non disturbare la scena live.
        // clone(true) duplica children; le geometrie/materiali sono condivise
        // (sicuro per il rendering, niente double-dispose qui).
        const clone = object3D.clone(true);
        clone.visible = true;
        clone.traverse((o) => { o.visible = true; });

        // Aggiungi al render scene
        renderScene.add(clone);

        // Forza l'aggiornamento delle matrici world (la clone parte da identità)
        clone.updateMatrixWorld(true);

        // Bounding box per inquadrare
        const box = new THREE.Box3().setFromObject(clone);
        if (box.isEmpty()) {
            renderScene.remove(clone);
            return '';
        }
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 0.1;

        // Camera in 3/4: leggermente sopra, leggermente di lato, davanti
        const fov = renderCamera.fov * (Math.PI / 180);
        const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.8;
        renderCamera.position.set(
            center.x + dist * 0.6,
            center.y + dist * 0.35,
            center.z + dist * 0.85
        );
        renderCamera.lookAt(center);
        renderCamera.near = Math.max(0.001, dist * 0.01);
        renderCamera.far = dist * 10;
        renderCamera.updateProjectionMatrix();

        let dataURL = '';
        try {
            renderer.render(renderScene, renderCamera);
            dataURL = renderer.domElement.toDataURL('image/png');
        } catch (e) {
            console.warn('[AfterPicker] render variante fallito:', e);
        }

        renderScene.remove(clone);
        return dataURL;
    }

    function thumbFor(groupName, variantName, size) {
        const key = `${groupName}|${variantName}|${size}`;
        if (thumbCache.has(key)) return thumbCache.get(key);
        const IO = window.InteractiveObject3D;
        if (!IO) return '';
        const grp = IO.stateGroups && IO.stateGroups.get(groupName);
        if (!grp) return '';
        const mesh = grp.meshRefs && grp.meshRefs.get(variantName);
        if (!mesh) return '';
        const dim = (size === 'large') ? { w: PREVIEW_W, h: PREVIEW_H } : { w: THUMB_W, h: THUMB_H };
        const url = renderVariantToDataURL(mesh, dim.w, dim.h);
        if (url) thumbCache.set(key, url);
        return url;
    }

    // Parsing/serializzazione del valore del campo "after"
    // Formato: "group1 = variant1 ; group2 = variant2"
    function parseAfter(value) {
        const map = new Map();
        const order = [];
        if (!value) return { map, order };
        const parts = String(value).split(';').map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
            const eq = p.indexOf('=');
            if (eq <= 0) continue;
            const k = p.slice(0, eq).trim().replace(/^state\./i, '');
            const v = p.slice(eq + 1).trim();
            if (!k || !v) continue;
            if (!map.has(k)) order.push(k);
            map.set(k, v);
        }
        return { map, order };
    }

    function serializeAfter(parsed) {
        const out = [];
        for (const g of parsed.order) out.push(`${g} = ${parsed.map.get(g)}`);
        return out.join('; ');
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const Picker = {
        wrapEl: null,
        popEl: null,
        previewEl: null,
        previewImg: null,
        previewCaption: null,
        listEl: null,
        chipsEl: null,
        filterEl: null,
        onApply: null,
        currentValue: '',
        _docClickHandler: null,
        _open: false,

        /**
         * Monta il picker dentro `wrapEl` (la cella che già contiene
         * l'input "after"). Aggiunge il bottone trigger e il popover.
         * `getValue` legge il valore corrente del campo; `onApply(newValue)`
         * lo aggiorna e dispatcha l'input event.
         */
        mount: function (wrapEl, getValue, onApply) {
            // Se c'era un'istanza precedente con popover aperto, chiudila e
            // smonta i listener globali (la vecchia wrapEl è già stata
            // sostituita dal re-render del wizard).
            if (this._open) this.close();
            this.wrapEl = wrapEl;
            this.onApply = onApply;
            this.getValue = getValue;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wz-btn';
            btn.title = 'Scegli variante con anteprima grafica';
            btn.textContent = '🎨';
            btn.setAttribute('data-after-pick-btn', '1');
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });
            wrapEl.appendChild(btn);

            const pop = document.createElement('div');
            pop.className = 'wz-after-popover hidden';
            pop.innerHTML = `
                <div class="wz-after-head">
                    <input type="text" class="wz-after-filter" placeholder="Filtra gruppi o varianti…" data-after-filter>
                    <button type="button" class="wz-tree-close" data-after-close title="Chiudi">✕</button>
                </div>
                <div class="wz-after-body">
                    <div class="wz-after-list" data-after-list>
                        <div class="wz-tree-empty">Carica una scena per vedere i gruppi di stato disponibili.</div>
                    </div>
                    <div class="wz-after-preview" data-after-preview>
                        <div class="wz-after-preview-img" data-after-preview-img></div>
                        <div class="wz-after-preview-caption" data-after-preview-caption>
                            Passa il mouse su una variante per l'anteprima ingrandita.
                        </div>
                    </div>
                </div>
                <div class="wz-after-foot">
                    <div class="wz-after-chips" data-after-chips></div>
                    <div class="wz-after-actions">
                        <button type="button" class="wz-btn" data-after-clear title="Svuota campo">🗑 Pulisci</button>
                    </div>
                </div>
            `;
            wrapEl.appendChild(pop);
            this.popEl = pop;
            this.listEl = pop.querySelector('[data-after-list]');
            this.previewEl = pop.querySelector('[data-after-preview-img]');
            this.previewCaption = pop.querySelector('[data-after-preview-caption]');
            this.chipsEl = pop.querySelector('[data-after-chips]');
            this.filterEl = pop.querySelector('[data-after-filter]');

            pop.addEventListener('click', (e) => this._onPopClick(e));
            pop.addEventListener('mouseover', (e) => this._onPopMouseover(e));
            pop.addEventListener('mouseout', (e) => this._onPopMouseout(e));
            this.filterEl.addEventListener('input', () => this._applyFilter(this.filterEl.value));
        },

        toggle: function () {
            if (this._open) this.close();
            else this.open();
        },

        open: function () {
            if (!this.popEl) return;
            this.currentValue = (this.getValue && this.getValue()) || '';
            this._renderList();
            this._renderChips();
            this.popEl.classList.remove('hidden');
            this._open = true;
            this._positionPopover();
            this._reposHandler = () => this._positionPopover();
            window.addEventListener('resize', this._reposHandler);
            window.addEventListener('scroll', this._reposHandler, true);
            setTimeout(() => {
                this._docClickHandler = (e) => {
                    if (!this.popEl.contains(e.target) && !e.target.closest('[data-after-pick-btn]')) {
                        this.close();
                    }
                };
                document.addEventListener('mousedown', this._docClickHandler, true);
            }, 0);
            if (this.filterEl) {
                this.filterEl.value = '';
                setTimeout(() => this.filterEl.focus(), 0);
            }
        },

        _positionPopover: function () {
            if (!this.popEl || !this.wrapEl) return;
            const r = this.wrapEl.getBoundingClientRect();
            const popW = this.popEl.offsetWidth || 760;
            const popH = this.popEl.offsetHeight || 400;
            const margin = 8;
            let left = r.left;
            // Allinea a destra del wrap se sborderebbe
            if (left + popW > window.innerWidth - margin) {
                left = Math.max(margin, window.innerWidth - popW - margin);
            }
            // Sotto se c'è spazio, sopra altrimenti
            let top = r.bottom + 4;
            if (top + popH > window.innerHeight - margin) {
                const above = r.top - popH - 4;
                top = (above >= margin) ? above : Math.max(margin, window.innerHeight - popH - margin);
            }
            this.popEl.style.left = left + 'px';
            this.popEl.style.top = top + 'px';
        },

        close: function () {
            if (this.popEl) this.popEl.classList.add('hidden');
            this._open = false;
            if (this._docClickHandler) {
                document.removeEventListener('mousedown', this._docClickHandler, true);
                this._docClickHandler = null;
            }
            if (this._reposHandler) {
                window.removeEventListener('resize', this._reposHandler);
                window.removeEventListener('scroll', this._reposHandler, true);
                this._reposHandler = null;
            }
        },

        _stateGroups: function () {
            const IO = window.InteractiveObject3D;
            if (!IO || !IO.stateGroups) return [];
            const out = [];
            for (const [name, grp] of IO.stateGroups) {
                out.push({
                    name,
                    variants: grp.variants.slice(),
                    default: grp.default,
                    current: grp.current,
                    hasMesh: (variantName) => grp.meshRefs && grp.meshRefs.has(variantName)
                });
            }
            return out;
        },

        _renderList: function () {
            if (!this.listEl) return;
            const groups = this._stateGroups();
            if (!groups.length) {
                this.listEl.innerHTML = '<div class="wz-tree-empty">Nessun StateGroup definito per questa scena.<br><small>Definiscili in <code>objects.ini</code> della scena.</small></div>';
                return;
            }
            const parsed = parseAfter(this.currentValue);
            let html = '';
            for (const g of groups) {
                const sel = parsed.map.get(g.name);
                html += `<details class="wz-after-group" open data-group="${esc(g.name)}">
                    <summary>
                        <span class="wz-after-group-name">${esc(g.name)}</span>
                        <span class="wz-after-group-meta">default: ${esc(g.default || '—')}${sel ? ` · <b>scelto: ${esc(sel)}</b>` : ''}</span>
                    </summary>
                    <div class="wz-after-variants">`;
                for (const v of g.variants) {
                    const isSel = sel === v;
                    const has = g.hasMesh(v);
                    const dataKey = `${g.name}|${v}`;
                    html += `<div class="wz-after-variant${isSel ? ' selected' : ''}${has ? '' : ' no-mesh'}"
                        data-group="${esc(g.name)}"
                        data-variant="${esc(v)}"
                        data-key="${esc(dataKey)}"
                        title="${esc(v)}${has ? '' : ' (mesh non trovata)'}">
                        <div class="wz-after-thumb" data-thumb-host>
                            ${has ? '<span class="wz-after-thumb-spin">…</span>' : '<span class="wz-after-thumb-na">∅</span>'}
                        </div>
                        <div class="wz-after-vname">${esc(v)}</div>
                    </div>`;
                }
                html += `</div></details>`;
            }
            this.listEl.innerHTML = html;
            // Renderizza le thumbnails in modo asincrono (1 per tick) per non
            // bloccare il layout. Lo scheduling è lineare: piccola lista, OK.
            const variantEls = this.listEl.querySelectorAll('.wz-after-variant:not(.no-mesh)');
            let i = 0;
            const step = () => {
                if (i >= variantEls.length) return;
                const el = variantEls[i++];
                const group = el.getAttribute('data-group');
                const variant = el.getAttribute('data-variant');
                const url = thumbFor(group, variant, 'small');
                const host = el.querySelector('[data-thumb-host]');
                if (host) {
                    if (url) host.innerHTML = `<img src="${url}" alt="${esc(variant)}">`;
                    else host.innerHTML = '<span class="wz-after-thumb-na">×</span>';
                }
                requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        },

        _renderChips: function () {
            if (!this.chipsEl) return;
            const parsed = parseAfter(this.currentValue);
            if (!parsed.order.length) {
                this.chipsEl.innerHTML = '<span class="wz-after-empty">Nessuna assegnazione.</span>';
                return;
            }
            this.chipsEl.innerHTML = parsed.order.map(g =>
                `<span class="wz-after-chip" data-chip-group="${esc(g)}">
                    <b>${esc(g)}</b>=${esc(parsed.map.get(g))}
                    <button type="button" data-after-remove="${esc(g)}" title="Rimuovi">×</button>
                </span>`
            ).join('');
        },

        _onPopClick: function (e) {
            const close = e.target.closest('[data-after-close]');
            if (close) { this.close(); return; }
            const clear = e.target.closest('[data-after-clear]');
            if (clear) {
                this.currentValue = '';
                this._renderList();
                this._renderChips();
                this.onApply && this.onApply('');
                return;
            }
            const rem = e.target.closest('[data-after-remove]');
            if (rem) {
                e.stopPropagation();
                const g = rem.getAttribute('data-after-remove');
                const parsed = parseAfter(this.currentValue);
                parsed.map.delete(g);
                parsed.order = parsed.order.filter(x => x !== g);
                this.currentValue = serializeAfter(parsed);
                this._renderList();
                this._renderChips();
                this.onApply && this.onApply(this.currentValue);
                return;
            }
            const variant = e.target.closest('.wz-after-variant');
            if (variant && !variant.classList.contains('no-mesh')) {
                const g = variant.getAttribute('data-group');
                const v = variant.getAttribute('data-variant');
                const parsed = parseAfter(this.currentValue);
                if (parsed.map.get(g) === v) {
                    // Click sulla variante già selezionata = deselezione del gruppo
                    parsed.map.delete(g);
                    parsed.order = parsed.order.filter(x => x !== g);
                } else {
                    if (!parsed.map.has(g)) parsed.order.push(g);
                    parsed.map.set(g, v);
                }
                this.currentValue = serializeAfter(parsed);
                this._renderList();
                this._renderChips();
                this.onApply && this.onApply(this.currentValue);
            }
        },

        _onPopMouseover: function (e) {
            const variant = e.target.closest('.wz-after-variant');
            if (!variant || variant.classList.contains('no-mesh')) return;
            const g = variant.getAttribute('data-group');
            const v = variant.getAttribute('data-variant');
            const url = thumbFor(g, v, 'large');
            if (this.previewEl) {
                if (url) this.previewEl.innerHTML = `<img src="${url}" alt="${esc(v)}">`;
                else this.previewEl.innerHTML = '<span class="wz-after-thumb-na">Anteprima non disponibile</span>';
            }
            if (this.previewCaption) {
                this.previewCaption.innerHTML = `<b>${esc(g)}</b> → <code>${esc(v)}</code>`;
            }
        },

        _onPopMouseout: function (e) {
            // niente reset: lascia l'ultima anteprima visibile, è più utile
        },

        _applyFilter: function (q) {
            if (!this.listEl) return;
            const norm = (q || '').trim().toLowerCase();
            const groups = this.listEl.querySelectorAll('details.wz-after-group');
            groups.forEach(grp => {
                if (!norm) {
                    grp.style.display = '';
                    grp.querySelectorAll('.wz-after-variant').forEach(v => v.style.display = '');
                    grp.open = true;
                    return;
                }
                const gname = (grp.getAttribute('data-group') || '').toLowerCase();
                let anyMatch = gname.indexOf(norm) !== -1;
                grp.querySelectorAll('.wz-after-variant').forEach(v => {
                    const vname = (v.getAttribute('data-variant') || '').toLowerCase();
                    const match = vname.indexOf(norm) !== -1 || gname.indexOf(norm) !== -1;
                    v.style.display = match ? '' : 'none';
                    if (match) anyMatch = true;
                });
                grp.style.display = anyMatch ? '' : 'none';
                if (anyMatch) grp.open = true;
            });
        },

        /**
         * Aggiornato dall'esterno quando il valore del campo è cambiato
         * (es. l'utente ha digitato a mano). Sincronizza chips e selezione.
         */
        syncFromField: function (value) {
            this.currentValue = value || '';
            if (this._open) {
                this._renderList();
                this._renderChips();
            }
        },

        /** Invalida la cache (es. cambio scenario). */
        clearCache: function () {
            thumbCache.clear();
        }
    };

    window.EditorAfterPicker = Picker;
})();
