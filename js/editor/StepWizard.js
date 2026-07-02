/**
 * StepWizard.js - Form guidato per lo step selezionato.
 *
 * Legge i campi da V3Document.getStepInfo(stepIdx) e, a ogni modifica,
 * riscrive solo le righe interessate nel documento (testo = fonte di verità),
 * poi notifica il controller (onEdit) che aggiorna codice e anteprima.
 *
 * Per non perdere il focus durante la digitazione il wizard NON si ri-renderizza
 * sulle proprie modifiche: lo fa solo il controller quando cambia step o quando
 * il testo viene modificato dalla vista Codice.
 *
 * Esposto come window.EditorStepWizard.
 */
(function () {
    'use strict';

    const TOOLS = ['', 'hand', 'hex_key', 'wrench', 'air', 'spray'];
    const TOOL_LABELS = {
        '': '(nessuno)', hand: 'mano', hex_key: 'brugola',
        wrench: 'chiave inglese', air: 'aria', spray: 'spray'
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const Wizard = {
        el: null,
        doc: null,
        stepIdx: -1,
        mode: 'step',       // 'step' | 'section' | 'scene'
        sectionIdx: -1,
        cb: {},

        mount: function (containerEl, callbacks) {
            this.el = containerEl;
            this.cb = callbacks || {};
            this.el.addEventListener('input', (e) => this._onInput(e));
            this.el.addEventListener('change', (e) => this._onInput(e));
            this.el.addEventListener('click', (e) => this._onClick(e));
        },

        render: function (doc, stepIdx) {
            this.doc = doc;
            this.stepIdx = stepIdx;
            this.mode = 'step';
            this.sectionIdx = -1;
            if (!this.el) return;
            const info = (stepIdx >= 0) ? doc.getStepInfo(stepIdx) : null;
            if (!info) {
                this.el.innerHTML = '<div class="wz-empty">Seleziona uno step a sinistra, oppure creane uno nuovo.</div>';
                return;
            }
            if (info.legacy) {
                this.el.innerHTML = '<div class="wz-empty">Questo è uno step in sintassi <b>legacy</b>. Modificalo dalla scheda <b>Codice</b>.</div>';
                return;
            }

            const f = info.fields;
            const has = (k) => f[k] != null && f[k] !== '';
            const advOpen = has('message') || has('title') || has('image') || has('video') || has('after') || has('drag') || has('hold');
            const H = (key) => (window.HelpSystem ? window.HelpSystem.icon(key) : '');

            this.el.innerHTML = `
            <div class="wz-field">
                <label>Titolo step ${H('wz-title')}</label>
                <input type="text" data-field="title" value="${esc(info.title)}" placeholder="Titolo dello step">
            </div>

            <div class="wz-field">
                <label>Flag ${H('wz-flags')}</label>
                <div class="wz-flags">
                    ${this._flag('auto', info.flags)}
                    ${this._flag('machine', info.flags)}
                    ${this._flag('highlight', info.flags)}
                </div>
            </div>

            <div class="wz-field">
                <label>Descrizione (fumetto) ${H('wz-description')}</label>
                <textarea data-field="description" rows="2" placeholder="Testo mostrato all'utente">${esc(f.description || '')}</textarea>
            </div>

            <div class="wz-row">
                <div class="wz-field wz-grow">
                    <label>Element <span class="wz-hint">oggetto su cui si agisce</span> ${H('wz-element')}</label>
                    <div class="wz-inline wz-element-wrap">
                        <input type="text" data-field="element" value="${esc(info.element)}" placeholder="es. vite_coperchio_1 oppure a500.Basamento">
                        <button class="wz-btn" data-wact="tree" title="Scegli da elenco gerarchico modelli">📋</button>
                        <button class="wz-btn" data-wact="pick" title="Scegli cliccando nell'anteprima 3D">🎯</button>
                        <div class="wz-tree-popover hidden" data-tree-popover>
                            <div class="wz-tree-head">
                                <input type="text" class="wz-tree-filter" placeholder="Filtra…" data-tree-filter>
                                ${H('wz-tree')}
                                <button class="wz-tree-close" data-wact="treeClose" title="Chiudi">✕</button>
                            </div>
                            <div class="wz-tree-body" data-tree-body></div>
                        </div>
                    </div>
                </div>
                <div class="wz-field wz-narrow">
                    <label>Repeat ${H('wz-repeat')}</label>
                    <input type="number" min="0" data-field="repeat" value="${esc(info.repeat)}" placeholder="—">
                </div>
            </div>

            <div class="wz-field">
                <label>Tool ${H('wz-tool')}</label>
                <select data-field="tool">
                    ${TOOLS.map(t => `<option value="${t}" ${info.tool === t ? 'selected' : ''}>${TOOL_LABELS[t]}</option>`).join('')}
                </select>
            </div>

            <div class="wz-field">
                <label>Azioni <span class="wz-hint">una per riga, senza "do :"</span> ${H('wz-actions')}</label>
                <textarea data-field="actions" rows="3" class="wz-mono" placeholder="unscrew distance 0.3&#10;extract distance 0.4">${esc(info.actions.join('\n'))}</textarea>
                <div class="wz-chips">
                    ${['unscrew', 'screw', 'extract', 'insert', 'place duration 0.2', 'move by (0,0,0.1) duration 0.5', 'rotate by (0,0,90) duration 0.5', 'idle reset']
                    .map(a => `<button class="wz-chip" data-wact="addaction" data-val="${esc(a)}">+ ${esc(a.split(' ')[0])}</button>`).join('')}
                </div>
            </div>

            <div class="wz-field">
                <label>Camera ${H('wz-camera')}</label>
                <div class="wz-inline">
                    <input type="text" data-field="camera" value="${esc(f.camera || '')}" placeholder="position (x,y,z), target (x,y,z), zoom 1.2, fade 1">
                    <button class="wz-btn" data-wact="camera" title="Cattura la camera corrente dall'anteprima">📷</button>
                    ${H('wz-camerabtn')}
                </div>
            </div>

            <details class="wz-adv" ${advOpen ? 'open' : ''}>
                <summary>Avanzate (messaggio, drag, dopo-click, hold)</summary>
                <div class="wz-field">
                    <label>Drag &amp; drop ${H('wz-drag')}</label>
                    <input type="text" data-field="drag" value="${esc(f.drag || '')}" placeholder="vite distance 1.5 snap targets foro_1.origin">
                </div>
                <div class="wz-field">
                    <label>Dopo il click (after) <span class="wz-hint">cambia stato (es. schermo = schermo002)</span> ${H('wz-after')}</label>
                    <div class="wz-inline wz-after-wrap" data-after-wrap>
                        <input type="text" data-field="after" value="${esc(f.after || '')}" placeholder="schermo = schermo002">
                    </div>
                </div>
                <div class="wz-field">
                    <label>Hold <span class="wz-hint">oggetto da prendere/lasciare: usa il campo Element sopra</span> ${H('wz-hold')}</label>
                    <input type="text" data-field="hold" value="${esc(f.hold || '')}" placeholder="pick at (-0.25,-0.07,0.25) facing (0,5,0)  |  held  |  release">
                </div>
                <hr class="wz-sep">
                <div class="wz-field">
                    <label>Messaggio (modal) ${H('wz-message')}</label>
                    <textarea data-field="message" rows="2" placeholder="Testo del messaggio">${esc(f.message || '')}</textarea>
                </div>
                <div class="wz-field">
                    <label>Titolo messaggio ${H('wz-msgtitle')}</label>
                    <input type="text" data-field="msgtitle" value="${esc(f.title || '')}" placeholder="Titolo del modal">
                </div>
                <div class="wz-row">
                    <div class="wz-field wz-grow">
                        <label>Immagine ${H('wz-image')}</label>
                        <input type="text" data-field="image" value="${esc(f.image || '')}" placeholder="scenes/X/img.jpg">
                    </div>
                    <div class="wz-field wz-grow">
                        <label>Video ${H('wz-video')}</label>
                        <input type="text" data-field="video" value="${esc(f.video || '')}" placeholder="media/x.mp4">
                    </div>
                </div>
                <hr class="wz-sep">
                <div class="wz-row">
                    <div class="wz-field wz-grow">
                        <label>View (schermo) ${H('wz-view')}</label>
                        <input type="text" data-field="view" value="${esc(f.view || '')}" placeholder="main">
                    </div>
                    <div class="wz-field wz-grow">
                        <label>Sound ${H('wz-sound')}</label>
                        <input type="text" data-field="sound" value="${esc(f.sound || '')}" placeholder="sounds/click.mp3">
                    </div>
                </div>
                <div class="wz-field">
                    <label>Animation (frame 2D) ${H('wz-animation')}</label>
                    <input type="text" data-field="animation" value="${esc(f.animation || '')}" placeholder="folder screens/mandrino at (60%, 60%) frame 20ms">
                </div>
            </details>`;

            // Monta il picker visuale sul wrapper del campo "after" (se disponibile)
            const afterWrap = this.el.querySelector('[data-after-wrap]');
            if (afterWrap && window.EditorAfterPicker) {
                window.EditorAfterPicker.mount(
                    afterWrap,
                    () => this._val('after'),
                    (newVal) => this.setFieldValue('after', newVal)
                );
            }
        },

        /* ===== Editor proprietà di sezione ===== */
        renderSection: function (doc, sectionIdx) {
            this.doc = doc;
            this.stepIdx = -1;
            this.mode = 'section';
            this.sectionIdx = sectionIdx;
            if (!this.el) return;
            const info = doc.getSectionInfo(sectionIdx);
            if (!info) {
                this.el.innerHTML = '<div class="wz-empty">Sezione non trovata.</div>';
                return;
            }
            const H = (key) => (window.HelpSystem ? window.HelpSystem.icon(key) : '');
            this.el.innerHTML = `
            <div class="wz-mode-banner">⚙ Proprietà della sezione <b>${esc(info.title || '(senza titolo)')}</b> ${H('sec-editor')}</div>
            <div class="wz-field">
                <label>Titolo sezione ${H('sec-title')}</label>
                <input type="text" data-field="sec_title" value="${esc(info.title)}" placeholder="Titolo del tutorial">
            </div>
            <div class="wz-field">
                <label>Camera della sezione ${H('sec-camera')}</label>
                <div class="wz-inline">
                    <input type="text" data-field="sec_camera" value="${esc(info.fields.camera || '')}" placeholder="position (x,y,z), target (x,y,z), zoom 1.2, fade 1">
                    <button class="wz-btn" data-wact="camera" title="Cattura la camera corrente dall'anteprima">📷</button>
                </div>
            </div>
            <div class="wz-field">
                <label>Stato iniziale (do) <span class="wz-hint">una per riga, senza "do :"</span> ${H('sec-do')}</label>
                <textarea data-field="sec_do" rows="2" class="wz-mono" placeholder="schermo = schermo001 ; tool = tool0">${esc(info.doLines.join('\n'))}</textarea>
            </div>
            <div class="wz-field">
                <label>Posizioni iniziali <span class="wz-hint">righe position/rotation/companion complete</span> ${H('sec-extra')}</label>
                <textarea data-field="sec_extra" rows="2" class="wz-mono" placeholder="position = a500.Basamento at (0, 0, 0)">${esc(info.extraLines.join('\n'))}</textarea>
            </div>
            <div class="wz-empty">Gli step della sezione si modificano selezionandoli nell'elenco a sinistra.</div>`;
        },

        /* ===== Editor blocco [scene] ===== */
        renderScene: function (doc) {
            this.doc = doc;
            this.stepIdx = -1;
            this.mode = 'scene';
            this.sectionIdx = -1;
            if (!this.el) return;
            const info = doc.getSceneInfo();
            const H = (key) => (window.HelpSystem ? window.HelpSystem.icon(key) : '');
            this.el.innerHTML = `
            <div class="wz-mode-banner">🎬 Proprietà globali della scena ${H('scene-editor')}</div>
            <div class="wz-field">
                <label>Camera iniziale ${H('scene-camera')}</label>
                <div class="wz-inline">
                    <input type="text" data-field="scene_camera" value="${esc(info.fields.camera || '')}" placeholder="position (x,y,z), target (x,y,z), fov 75, fade 2">
                    <button class="wz-btn" data-wact="camera" title="Cattura la camera corrente dall'anteprima">📷</button>
                </div>
            </div>
            <div class="wz-empty">${info.exists
                ? 'La camera iniziale viene applicata al caricamento dello scenario, prima di avviare un tutorial.'
                : 'Il blocco [scene] non esiste ancora: verrà creato in testa al file appena scrivi la camera.'}</div>`;
        },

        _flag: function (name, flags) {
            const on = flags.indexOf(name) !== -1;
            return `<label class="wz-check"><input type="checkbox" data-field="flag" data-flag="${name}" ${on ? 'checked' : ''}> ${name}</label>`;
        },

        _val: function (field) {
            const el = this.el.querySelector(`[data-field="${field}"]`);
            return el ? el.value : '';
        },

        _onInput: function (e) {
            const t = e.target;
            const field = t.getAttribute && t.getAttribute('data-field');
            if (!field || !this.doc) return;

            // Campi sezione / scena (modalità non-step)
            if (field.indexOf('sec_') === 0 || field.indexOf('scene_') === 0) {
                const s = this.sectionIdx;
                switch (field) {
                    case 'sec_title':
                        if (t.value.trim()) this.doc.renameSection(s, t.value.trim());
                        break;
                    case 'sec_camera': this.doc.setSectionField(s, 'camera', t.value); break;
                    case 'sec_do': this.doc.setSectionDoLines(s, t.value.split('\n')); break;
                    case 'sec_extra': this.doc.setSectionExtraLines(s, t.value.split('\n')); break;
                    case 'scene_camera': this.doc.setSceneField('camera', t.value); break;
                    default: return;
                }
                if (this.cb.onEdit) this.cb.onEdit({ field, titleChanged: field === 'sec_title' });
                return;
            }

            if (this.stepIdx < 0) return;
            const d = this.doc, i = this.stepIdx;

            switch (field) {
                case 'title': d.setStepTitle(i, t.value); break;
                case 'flag': {
                    const checks = this.el.querySelectorAll('[data-field="flag"]');
                    const flags = [];
                    checks.forEach(c => { if (c.checked) flags.push(c.getAttribute('data-flag')); });
                    d.setStepFlags(i, flags);
                    break;
                }
                case 'element':
                case 'repeat': {
                    if (typeof d.normalizeHoldStep === 'function') d.normalizeHoldStep(i);
                    const el = this._val('element').trim();
                    const rep = this._val('repeat').trim();
                    const combined = el ? (rep ? `${el} repeat ${rep}` : el) : '';
                    d.setStepField(i, 'element', combined);
                    break;
                }
                case 'tool': d.setStepField(i, 'tool', t.value); break;
                case 'actions': d.setStepActions(i, t.value.split('\n')); break;
                case 'camera': d.setStepField(i, 'camera', t.value); break;
                case 'description': d.setStepField(i, 'description', t.value); break;
                case 'message': d.setStepField(i, 'message', t.value); break;
                case 'msgtitle': d.setStepField(i, 'title', t.value); break;
                case 'image': d.setStepField(i, 'image', t.value); break;
                case 'video': d.setStepField(i, 'video', t.value); break;
                case 'drag': d.setStepField(i, 'drag', t.value); break;
                case 'view': d.setStepField(i, 'view', t.value); break;
                case 'sound': d.setStepField(i, 'sound', t.value); break;
                case 'animation': d.setStepField(i, 'animation', t.value); break;
                case 'hold': {
                    if (typeof d.normalizeHoldStep === 'function') d.normalizeHoldStep(i);
                    d.setStepField(i, 'hold', t.value);
                    break;
                }
                case 'after':
                    d.setStepColonField(i, 'after', t.value);
                    if (window.EditorAfterPicker && typeof window.EditorAfterPicker.syncFromField === 'function') {
                        window.EditorAfterPicker.syncFromField(t.value);
                    }
                    break;
                default: return;
            }
            if (this.cb.onEdit) this.cb.onEdit({ field, titleChanged: field === 'title' || field === 'flag' });
        },

        _onClick: function (e) {
            const btn = e.target.closest('[data-wact]');
            if (!btn) return;
            const act = btn.getAttribute('data-wact');
            if (act === 'camera' && this.cb.onCaptureCamera) {
                this.cb.onCaptureCamera();
            } else if (act === 'pick' && this.cb.onPick) {
                btn.classList.toggle('armed');
                this.cb.onPick(btn.classList.contains('armed'));
            } else if (act === 'tree') {
                this._toggleTreePopover();
            } else if (act === 'treeClose') {
                this._closeTreePopover();
            } else if (act === 'treePick') {
                const path = btn.getAttribute('data-path');
                if (path) this.setFieldValue('element', path);
                this._closeTreePopover();
            } else if (act === 'addaction') {
                const ta = this.el.querySelector('[data-field="actions"]');
                if (ta) {
                    const v = ta.value.trim();
                    ta.value = v ? v + '\n' + btn.getAttribute('data-val') : btn.getAttribute('data-val');
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.focus();
                }
            }
        },

        _toggleTreePopover: function () {
            const pop = this.el.querySelector('[data-tree-popover]');
            if (!pop) return;
            if (pop.classList.contains('hidden')) {
                this._renderTree();
                pop.classList.remove('hidden');
                const f = pop.querySelector('[data-tree-filter]');
                if (f) {
                    f.value = '';
                    f.oninput = () => this._filterTree(f.value);
                    setTimeout(() => f.focus(), 0);
                }
                setTimeout(() => {
                    this._docClickHandler = (e) => {
                        if (!pop.contains(e.target) && !e.target.closest('[data-wact="tree"]')) {
                            this._closeTreePopover();
                        }
                    };
                    document.addEventListener('mousedown', this._docClickHandler, true);
                }, 0);
            } else {
                this._closeTreePopover();
            }
        },

        _closeTreePopover: function () {
            const pop = this.el.querySelector('[data-tree-popover]');
            if (pop) pop.classList.add('hidden');
            if (this._docClickHandler) {
                document.removeEventListener('mousedown', this._docClickHandler, true);
                this._docClickHandler = null;
            }
        },

        _renderTree: function () {
            const body = this.el.querySelector('[data-tree-body]');
            if (!body) return;
            const models = (window.Scene3D && window.Scene3D.loadedModels) || [];
            if (!models.length) {
                body.innerHTML = '<div class="wz-tree-empty">Nessun modello caricato.</div>';
                return;
            }
            const html = models.map(m => this._renderModelNode(m)).join('');
            body.innerHTML = html;
        },

        // Nome "pulito" del modello (rimuove path + .glb come fa findModelByName).
        _cleanModelName: function (obj) {
            const raw = (obj.userData && obj.userData.originalFilename) || obj.name || '';
            return String(raw).split('/').pop().replace(/\.glb$/i, '');
        },

        // Conta i discendenti con nome di un nodo (escludendo wrapper col modelName).
        _countNamedDescendants: function (node, modelName) {
            let n = 0;
            if (!node.children) return 0;
            for (const c of node.children) {
                if (c.name && c.name !== modelName) n++;
                n += this._countNamedDescendants(c, modelName);
            }
            return n;
        },

        // Render del modello root + struttura gerarchica completa.
        // I path emessi sono SEMPRE "modelName.childName" (due livelli max), perché
        // Scene3D.findModelByName usa traverse() e trova il child a qualsiasi profondità.
        // La gerarchia visiva serve solo per browsing.
        _renderModelNode: function (model) {
            const modelName = this._cleanModelName(model) || '(senza nome)';
            const seen = new Set();  // nomi già emessi nell'intero albero del modello
            const childrenHtml = this._renderChildren(model, modelName, seen);
            const count = this._countNamedDescendants(model, modelName);
            const rootPath = modelName;

            if (!childrenHtml) {
                return `<div class="wz-tree-leaf" data-path="${esc(rootPath.toLowerCase())}">
                    <button class="wz-tree-item" data-wact="treePick" data-path="${esc(rootPath)}">${esc(modelName)}</button>
                </div>`;
            }
            return `<details class="wz-tree-node" open data-path="${esc(rootPath.toLowerCase())}">
                <summary>
                    <button class="wz-tree-item" data-wact="treePick" data-path="${esc(rootPath)}">${esc(modelName)}</button>
                    <span class="wz-tree-count">${count}</span>
                </summary>
                <div class="wz-tree-children">${childrenHtml}</div>
            </details>`;
        },

        // Ricorre sui figli di `parent`. Nodi con nome → details/leaf con path
        // "modelName.nodeName". Nodi anonimi o wrapper col nome del modello →
        // render dei loro figli "inline" (l'utente non li vede, salta il wrapper).
        // `seen` è condiviso sull'intero albero per marcare duplicati cross-branch.
        _renderChildren: function (parent, modelName, seen) {
            if (!parent.children || parent.children.length === 0) return '';
            let out = '';
            for (const child of parent.children) {
                const name = child.name;
                if (!name || name === modelName) {
                    out += this._renderChildren(child, modelName, seen);
                    continue;
                }
                const isDup = seen.has(name);
                if (!isDup) seen.add(name);
                out += this._renderNamedChild(child, modelName, name, isDup, seen);
            }
            return out;
        },

        _renderNamedChild: function (node, modelName, name, isDup, seen) {
            const path = `${modelName}.${name}`;
            const dataPath = esc(path.toLowerCase());
            const dupMark = isDup
                ? '<span class="wz-tree-dup" title="Duplicato — a runtime vince il primo trovato">↺</span>'
                : '';
            const btn = `<button class="wz-tree-item${isDup ? ' is-dup' : ''}" data-wact="treePick" data-path="${esc(path)}" title="${esc(node.type || '')}${isDup ? ' (duplicato)' : ''}">${esc(name)}</button>`;
            const subHtml = this._renderChildren(node, modelName, seen);
            if (!subHtml) {
                return `<div class="wz-tree-leaf" data-path="${dataPath}">${btn}${dupMark}</div>`;
            }
            const subCount = this._countNamedDescendants(node, modelName);
            const badge = subCount > 0 ? `<span class="wz-tree-count">${subCount}</span>` : '';
            return `<details class="wz-tree-node" data-path="${dataPath}">
                <summary>${btn}${badge}${dupMark}</summary>
                <div class="wz-tree-children">${subHtml}</div>
            </details>`;
        },

        _filterTree: function (query) {
            const body = this.el.querySelector('[data-tree-body]');
            if (!body) return;
            const q = (query || '').trim().toLowerCase();
            const all = body.querySelectorAll('[data-path]');
            if (!q) {
                all.forEach(n => { n.style.display = ''; });
                body.querySelectorAll('details.wz-tree-node').forEach(d => {
                    d.open = true; // root model nodes restano aperti
                });
                return;
            }
            all.forEach(n => {
                const p = n.getAttribute('data-path') || '';
                const match = p.indexOf(q) !== -1;
                n.style.display = match ? '' : 'none';
                if (match && n.tagName === 'DETAILS') n.open = true;
                // Se un discendente matcha, mantieni visibili e aperti tutti gli antenati
                if (match) {
                    let p2 = n.parentElement;
                    while (p2 && p2 !== body) {
                        if (p2.tagName === 'DETAILS') { p2.style.display = ''; p2.open = true; }
                        else if (p2.classList && p2.classList.contains('wz-tree-children')) p2.style.display = '';
                        p2 = p2.parentElement;
                    }
                }
            });
        },

        // Imposta un valore di campo dall'esterno (es. cattura camera / pick) e propaga.
        // La cattura camera funziona anche in modalità sezione/scena (campo diverso).
        setFieldValue: function (field, value) {
            let el = this.el.querySelector(`[data-field="${field}"]`);
            if (!el && field === 'camera') {
                el = this.el.querySelector('[data-field="sec_camera"]') ||
                     this.el.querySelector('[data-field="scene_camera"]');
            }
            if (el) {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    };

    window.EditorStepWizard = Wizard;
})();
