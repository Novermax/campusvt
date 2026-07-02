/**
 * ScenarioEditor.js - Controller dell'editor di scenari (Fase 1).
 *
 * Coordina V3Document (modello testo), StepTimeline, StepWizard, CodeView e
 * PreviewBridge (motore 3D reale). Apre/chiude la pagina #editorPage, popola la
 * tendina scene da UI.scenariosConfig, gestisce tabs/splitter e il salvataggio.
 *
 * Sincronizzazione: il testo v3 è l'unica fonte di verità.
 *   wizard edit  → doc → CodeView.setText + timeline + preview (debounced)
 *   code  edit   → doc → wizard.render + timeline + preview (debounced)
 *
 * Esposto come window.ScenarioEditor.
 */
(function () {
    'use strict';

    const PREVIEW_DEBOUNCE = 300;

    const Editor = {
        doc: null,
        scenario: null,
        currentStepIdx: -1,
        selectedSection: null,   // sezione selezionata (editor proprietà) o null
        sceneSelected: false,    // true = editor proprietà [scene]
        clipboard: null,
        opened: false,
        dirty: false,
        _previewTimer: null,
        els: {},

        init: function () {
            this.els.page = document.getElementById('editorPage');
            this.els.openBtn = document.getElementById('openEditorBtn');
            if (!this.els.page) return;

            this.els.select = document.getElementById('editorScenarioSelect');
            this.els.timeline = document.getElementById('editorTimeline');
            this.els.wizard = document.getElementById('editorWizard');
            this.els.codePanel = document.getElementById('editorCodePanel');
            this.els.previewHost = document.getElementById('editorPreviewHost');
            this.els.status = document.getElementById('editorStatus');
            this.els.splitter = document.getElementById('editorSplitter');
            this.els.left = document.getElementById('editorLeft');
            this.els.saveBtn = document.getElementById('editorSaveBtn');

            // Bottoni toolbar
            this._bind('editorCloseBtn', 'click', () => this.close());
            this._bind('editorSaveBtn', 'click', () => this.save());
            this._bind('editorDownloadBtn', 'click', () => this.download());
            this._bind('editorAddStepBtn', 'click', () => this.addStep());
            this._bind('editorAddSectionBtn', 'click', () => this.addSection());
            this._bind('editorValidateBtn', 'click', () => this.showValidationReport());
            if (this.els.openBtn) this.els.openBtn.addEventListener('click', () => this.open());
            if (this.els.select) this.els.select.addEventListener('change', () => this.onScenarioChange());

            // Modifiche non salvate: avvisa prima di chiudere la pagina/app
            window.addEventListener('beforeunload', (e) => {
                if (this.opened && this.dirty) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });

            // Tabs wizard/codice
            document.querySelectorAll('#editorPage [data-tab]').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.getAttribute('data-tab')));
            });

            // Help contestuale: delega globale + icone "?" della toolbar/tabs
            if (window.HelpSystem) {
                window.HelpSystem.attach(document);
                this._injectToolbarHelp();
            }

            // Sotto-moduli
            this.doc = new window.V3Document('');
            window.EditorStepTimeline.mount(this.els.timeline, {
                onSelect: (i) => this.selectStep(i),
                onAdd: (i) => this.addStep(i),
                onDelete: (i) => this.deleteStep(i),
                onMove: (i, d) => this.moveStep(i, d),
                onCopy: (i) => this.copyStep(i),
                onPasteAfter: (i) => this.pasteStepAfter(i),
                onPasteSection: (s) => this.pasteStepIntoSection(s),
                onClipboardClear: () => this.clearStepClipboard(),
                onSectionRename: (s) => this.renameSection(s),
                onSectionMove: (s, d) => this.moveSection(s, d),
                onSectionDelete: (s) => this.deleteSection(s),
                onSectionAddStep: (s) => this.addStepInSection(s),
                onSelectSection: (s) => this.selectSection(s),
                onSelectScene: () => this.selectScene()
            });
            window.EditorStepWizard.mount(this.els.wizard, {
                onEdit: (e) => this.onWizardEdit(e),
                onCaptureCamera: () => this.captureCamera(),
                onPick: (armed) => this.togglePick(armed)
            });
            window.EditorCodeView.mount(this.els.codePanel, {
                onChange: (txt) => this.onCodeChange(txt)
            });

            // Pannello "Schermate" (PNG → GLB utility)
            this.els.screenPanel = document.getElementById('editorScreenPanel');
            if (this.els.screenPanel && window.EditorScreenPanel) {
                window.EditorScreenPanel.mount(this.els.screenPanel);
            }

            this._setupSplitter();
            this._setupAccess();
        },

        _bind: function (id, ev, fn) {
            const el = document.getElementById(id);
            if (el) el.addEventListener(ev, fn);
        },

        // Icone "?" accanto ai controlli statici (toolbar + tabs + intestazione timeline)
        _injectToolbarHelp: function () {
            const H = window.HelpSystem;
            const map = {
                editorScenarioSelect: 'tb-scenario',
                editorAddStepBtn: 'tb-addstep',
                editorAddSectionBtn: 'tb-addsection',
                editorValidateBtn: 'tb-validate',
                editorSaveBtn: 'tb-save',
                editorDownloadBtn: 'tb-download',
                editorCloseBtn: 'tb-close'
            };
            Object.keys(map).forEach(id => H.inject(document.getElementById(id), map[id]));
            document.querySelectorAll('#editorPage [data-tab]').forEach(btn => {
                const key = { wizard: 'tab-wizard', code: 'tab-code', screens: 'tab-screens' }[btn.getAttribute('data-tab')];
                if (key) H.inject(btn, key);
            });
            const head = document.querySelector('#editorPage .editor-section-head span');
            if (head) H.inject(head, 'tl-panel');
        },

        /* ===== Modifiche non salvate ===== */
        _touch: function () {
            if (!this.dirty) {
                this.dirty = true;
                this._updateDirtyUI();
            }
        },

        _markClean: function () {
            this.dirty = false;
            this._updateDirtyUI();
        },

        _updateDirtyUI: function () {
            if (this.els.saveBtn) {
                this.els.saveBtn.classList.toggle('has-changes', this.dirty);
                this.els.saveBtn.textContent = this.dirty ? '💾 Salva ●' : '💾 Salva';
            }
        },

        // Conferma la perdita delle modifiche non salvate. Ritorna Promise<bool>.
        _confirmDiscard: function (actionLabel) {
            if (!this.dirty) return Promise.resolve(true);
            if (window.EditorUI) {
                return window.EditorUI.confirm({
                    title: 'Modifiche non salvate',
                    message: `Ci sono modifiche non salvate al tutorial.\n${actionLabel} le perderà definitivamente.`,
                    okLabel: 'Continua senza salvare',
                    danger: true
                });
            }
            return Promise.resolve(window.confirm('Ci sono modifiche non salvate. Continuare senza salvare?'));
        },

        /* ===== Accesso (gate admin) ===== */
        _setupAccess: function () {
            this.refreshAccess();
            const container = document.getElementById('container');
            if (container) {
                new MutationObserver(() => this.refreshAccess())
                    .observe(container, { attributes: true, attributeFilter: ['class'] });
            }
        },

        refreshAccess: function () {
            if (!this.els.openBtn) return;
            // Editor riservato agli utenti con ruolo 'admin' (5° campo di users.txt),
            // sia in browser che in Electron: i clienti non devono modificare le scene.
            const isAdmin = window.currentUser && window.currentUser.role === 'admin';
            this.els.openBtn.style.display = isAdmin ? 'inline-block' : 'none';
        },

        /* ===== Apertura / chiusura ===== */
        open: function () {
            const isAdmin = window.currentUser && window.currentUser.role === 'admin';
            if (!isAdmin) {
                console.warn('Editor scenari: accesso negato (richiede ruolo admin).');
                return;
            }
            this.opened = true;
            this.els.page.classList.remove('hidden');
            this._toggleRuntimeChrome(false);
            this.populateScenarios();
            window.EditorPreviewBridge.attach(this.els.previewHost);

            // Stato pulito ad ogni apertura: nessuna scena selezionata, doc vuoto,
            // dropdown azzerato. populateScenarios() preserva il valore precedente
            // del select: lo sovrascriviamo qui dopo. Pulisce anche eventuali
            // residui 3D (modello solitario rimasto da una sessione precedente).
            this.scenario = null;
            this.currentStepIdx = -1;
            this.selectedSection = null;
            this.sceneSelected = false;
            this.clipboard = null;
            this._markClean();
            if (this.doc) this.doc.setText('');
            if (this.els.select) this.els.select.value = '';
            if (window.EditorCodeView) window.EditorCodeView.setText('');
            this.renderTimeline();
            this.renderWizard();
            window.EditorPreviewBridge.resetScene();

            this.setStatus('Seleziona una scena da modificare.');
        },

        close: async function () {
            const ok = await this._confirmDiscard('Chiudere l\'editor');
            if (!ok) return;
            this._markClean();
            this.opened = false;
            window.EditorPreviewBridge.detach();
            this.els.page.classList.add('hidden');
            this._toggleRuntimeChrome(true);
            // La preview riusa Scene3D/UI reali: senza reset completo, fumetto step,
            // pulsante reset vista, tool legend e finestra animata restano popolati
            // sopra la home. goHome() esegue il reset completo come l'uscita scenario.
            if (window.AnimatedWindowSystem && window.AnimatedWindowSystem.hide) {
                try { window.AnimatedWindowSystem.hide(); } catch (e) {}
            }
            if (window.UI && typeof window.UI.goHome === 'function') {
                window.UI.goHome();
            } else if (window.UI && typeof window.UI.showPage === 'function') {
                window.UI.showPage('home');
            }
        },

        // Nasconde la "chrome" del runtime (barre/fumetti) mentre l'editor è aperto
        _toggleRuntimeChrome: function (restore) {
            ['tutorialStepsBar', 'stepSpeechBubble', 'resetCameraBtn', 'toolsLegend'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (restore) el.classList.remove('editor-force-hide');
                else el.classList.add('editor-force-hide');
            });
        },

        /* ===== Tendina scene ===== */
        populateScenarios: function () {
            const cfg = (window.UI && window.UI.scenariosConfig) || [];
            const list = Array.isArray(cfg) ? cfg : (cfg.scenarios || []);
            const withTutorial = list.filter(s => s && s.tutorial);
            const sel = this.els.select;
            const prev = sel.value;
            sel.innerHTML = '<option value="">— scegli scena —</option>' +
                withTutorial.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
            this._scenarioList = withTutorial;
            if (prev) sel.value = prev;
        },

        onScenarioChange: async function () {
            const i = parseInt(this.els.select.value, 10);
            if (isNaN(i) || !this._scenarioList[i]) return;
            const target = this._scenarioList[i];
            if (target === this.scenario) return;
            const ok = await this._confirmDiscard('Cambiare scena');
            if (!ok) {
                // Ripristina la selezione precedente
                const prevIdx = this._scenarioList.indexOf(this.scenario);
                this.els.select.value = (prevIdx >= 0) ? String(prevIdx) : '';
                return;
            }
            this.loadScenario(target);
        },

        loadScenario: async function (scenario) {
            this.scenario = scenario;
            this.clipboard = null;
            this.selectedSection = null;
            this.sceneSelected = false;
            this._markClean();
            this.setStatus(`Caricamento "${scenario.name}"…`);
            if (window.EditorAfterPicker && typeof window.EditorAfterPicker.clearCache === 'function') {
                window.EditorAfterPicker.clearCache();
            }
            // Testo grezzo v3 del tutorial
            let raw = '';
            let loadFailed = false;
            try {
                const resp = await window.fetchFile(scenario.tutorial + '?v=' + Date.now());
                if (resp && resp.ok === false) throw new Error('HTTP ' + resp.status);
                raw = await resp.text();
            } catch (e) {
                loadFailed = true;
                this.setStatus(`⚠️ Tutorial non leggibile (${e.message || e}) — puoi crearne uno nuovo con "＋ Sezione"; al salvataggio verrà scritto in ${scenario.tutorial}.`);
            }
            this.doc.setText(raw);
            window.EditorCodeView.setText(this.doc.getText());
            this.currentStepIdx = this.doc.getStepCount() > 0 ? 0 : -1;
            this.renderTimeline();
            this.renderWizard();

            // Carica modelli/luci/camera reali, poi anteprima
            try {
                await window.EditorPreviewBridge.loadScenario(scenario);
            } catch (e) {
                console.warn('[Editor] loadScenario preview:', e);
            }
            this.schedulePreview(0);
            if (!loadFailed) {
                this.setStatus(`Scena "${scenario.name}" pronta — ${this.doc.getStepCount()} step.`);
            }
        },

        /* ===== Rendering ===== */
        // Map stepIdx → livello peggiore ('error' vince su 'warn') per i badge timeline
        _issuesByStep: function () {
            const map = new Map();
            if (!this.doc || typeof this.doc.validate !== 'function') return map;
            let issues = [];
            try { issues = this.doc.validate(); } catch (e) { return map; }
            for (const it of issues) {
                if (typeof it.stepIdx !== 'number' || it.level === 'info') continue;
                const cur = map.get(it.stepIdx);
                if (cur !== 'error') map.set(it.stepIdx, it.level === 'error' ? 'error' : 'warn');
            }
            return map;
        },

        renderTimeline: function () {
            window.EditorStepTimeline.render(this.doc, this.currentStepIdx, this.clipboard, this._issuesByStep(), {
                section: this.selectedSection,
                scene: this.sceneSelected
            });
        },
        renderWizard: function () {
            if (this.sceneSelected) {
                window.EditorStepWizard.renderScene(this.doc);
            } else if (this.selectedSection != null && this.selectedSection < this.doc.getSectionCount()) {
                window.EditorStepWizard.renderSection(this.doc, this.selectedSection);
            } else {
                window.EditorStepWizard.render(this.doc, this.currentStepIdx);
            }
        },
        syncCodeFromDoc: function () {
            window.EditorCodeView.setText(this.doc.getText());
        },

        /* ===== Eventi edit ===== */
        onWizardEdit: function (e) {
            this._touch();
            this.syncCodeFromDoc();
            if (e && e.titleChanged) this.renderTimeline();
            this.schedulePreview();
        },

        onCodeChange: function (txt) {
            this._touch();
            this.doc.setText(txt);
            if (this.currentStepIdx >= this.doc.getStepCount()) {
                this.currentStepIdx = this.doc.getStepCount() - 1;
            }
            this.renderTimeline();
            this.renderWizard();
            this.schedulePreview();
        },

        /* ===== Timeline ops ===== */
        selectStep: function (i) {
            this.currentStepIdx = i;
            this.selectedSection = null;
            this.sceneSelected = false;
            this.renderTimeline();
            this.renderWizard();
            this.switchTab('wizard');
            this.schedulePreview(0);
        },

        // Selezione di una sezione → editor proprietà (camera, stato iniziale).
        // L'anteprima salta al primo step della sezione.
        selectSection: function (s) {
            this.selectedSection = s;
            this.sceneSelected = false;
            const first = this.doc.getOutline().find(o => o.kind === 'step' && o.sectionIdx === s);
            if (first) this.currentStepIdx = first.stepIdx;
            this.renderTimeline();
            this.renderWizard();
            this.switchTab('wizard');
            this.schedulePreview(0);
        },

        selectScene: function () {
            this.sceneSelected = true;
            this.selectedSection = null;
            this.renderTimeline();
            this.renderWizard();
            this.switchTab('wizard');
        },

        // Refresh completo dopo una mutazione del documento
        _afterDocMutation: function (newCurrentIdx) {
            if (typeof newCurrentIdx === 'number') this.currentStepIdx = newCurrentIdx;
            const count = this.doc.getStepCount();
            if (this.currentStepIdx >= count) this.currentStepIdx = count - 1;
            this._touch();
            this.syncCodeFromDoc();
            this.renderTimeline();
            this.renderWizard();
            this.schedulePreview(0);
        },

        addStep: function (afterIdx) {
            const ref = (typeof afterIdx === 'number') ? afterIdx : this.currentStepIdx;
            const newIdx = this.doc.addStepAfter(ref, 'Nuovo step');
            this._afterDocMutation(newIdx);
        },

        addSection: async function (afterIdx) {
            const ref = (typeof afterIdx === 'number') ? afterIdx : this.currentStepIdx;
            const def = 'Nuova sezione';
            let title = def;
            if (window.EditorUI) {
                const t = await window.EditorUI.prompt({
                    title: 'Nuova sezione (tutorial)',
                    message: 'La sezione apparirà come tutorial selezionabile dall\'utente.',
                    value: def,
                    placeholder: 'es. Sostituzione filtro'
                });
                if (t === null) return; // annullato
                title = t.trim() || def;
            }
            const newStepIdx = this.doc.addSectionAfter(ref, title);
            this._afterDocMutation((typeof newStepIdx === 'number' && newStepIdx >= 0) ? newStepIdx : undefined);
            this.setStatus(`Sezione "${title}" aggiunta.`);
        },

        deleteStep: async function (i) {
            const info = this.doc.getStepInfo(i);
            const name = (info && info.title) || `step ${i + 1}`;
            if (window.EditorUI) {
                const ok = await window.EditorUI.confirm({
                    title: 'Elimina step',
                    message: `Eliminare lo step "${name}"?\nL'operazione può essere annullata solo ricaricando la scena senza salvare.`,
                    okLabel: 'Elimina',
                    danger: true
                });
                if (!ok) return;
            }
            this.doc.removeStep(i);
            this._afterDocMutation();
            this.setStatus(`Step "${name}" eliminato.`);
        },

        moveStep: function (i, dir) {
            const newIdx = this.doc.moveStep(i, dir);
            if (i === this.currentStepIdx) this.currentStepIdx = newIdx;
            this._touch();
            this.syncCodeFromDoc();
            this.renderTimeline();
            this.renderWizard();
        },

        /* ===== Operazioni sulle sezioni ===== */
        renameSection: async function (sectionIdx) {
            const outline = this.doc.getOutline();
            const sec = outline.find(o => o.kind === 'section' && o.sectionIdx === sectionIdx);
            if (!sec) return;
            let title = null;
            if (window.EditorUI) {
                title = await window.EditorUI.prompt({
                    title: 'Rinomina sezione',
                    value: sec.title || '',
                    placeholder: 'Titolo della sezione'
                });
            } else if (typeof window.prompt === 'function') {
                title = window.prompt('Nuovo titolo della sezione:', sec.title || '');
            }
            if (title === null || !title.trim()) return;
            if (this.doc.renameSection(sectionIdx, title.trim())) {
                this._afterDocMutation();
                this.setStatus(`Sezione rinominata in "${title.trim()}".`);
            }
        },

        moveSection: function (sectionIdx, dir) {
            const newIdx = this.doc.moveSection(sectionIdx, dir);
            if (newIdx === sectionIdx) return;
            if (this.selectedSection === sectionIdx) this.selectedSection = newIdx;
            else if (this.selectedSection === newIdx) this.selectedSection = sectionIdx;
            this._afterDocMutation();
            this.setStatus('Sezione spostata.');
        },

        deleteSection: async function (sectionIdx) {
            const outline = this.doc.getOutline();
            const sec = outline.find(o => o.kind === 'section' && o.sectionIdx === sectionIdx);
            if (!sec) return;
            const stepsIn = outline.filter(o => o.kind === 'step' && o.sectionIdx === sectionIdx).length;
            if (window.EditorUI) {
                const ok = await window.EditorUI.confirm({
                    title: 'Elimina sezione',
                    message: `Eliminare la sezione "${sec.title || '(senza titolo)'}" e i suoi ${stepsIn} step?\nL'operazione può essere annullata solo ricaricando la scena senza salvare.`,
                    okLabel: 'Elimina tutto',
                    danger: true
                });
                if (!ok) return;
            }
            const removed = this.doc.removeSection(sectionIdx);
            if (this.selectedSection != null) {
                if (this.selectedSection === sectionIdx) this.selectedSection = null;
                else if (this.selectedSection > sectionIdx) this.selectedSection--;
            }
            this._afterDocMutation();
            this.setStatus(`Sezione eliminata (${removed} step rimossi).`);
        },

        addStepInSection: function (sectionIdx) {
            const newIdx = this.doc.addStepAtSectionEnd(sectionIdx, 'Nuovo step');
            if (newIdx < 0) return;
            this._afterDocMutation(newIdx);
        },

        /* ===== Copia / incolla step ===== */
        copyStep: function (i) {
            const lines = this.doc.copyStepLines(i);
            if (!lines) return;
            const info = this.doc.getStepInfo(i);
            this.clipboard = { lines, title: (info && info.title) || 'step' };
            this.renderTimeline();
            this.setStatus(`📋 Step "${this.clipboard.title}" copiato — clicca "incolla qui" nel punto desiderato.`);
        },

        pasteStepAfter: function (i) {
            if (!this.clipboard) return;
            this._afterPaste(this.doc.insertStepAfterStep(i, this.clipboard.lines));
        },

        pasteStepIntoSection: function (sectionIdx) {
            if (!this.clipboard) return;
            this._afterPaste(this.doc.insertStepAtSectionStart(sectionIdx, this.clipboard.lines));
        },

        _afterPaste: function (newIdx) {
            if (typeof newIdx !== 'number' || newIdx < 0) {
                this.setStatus('⚠️ Impossibile incollare lo step in questo punto.');
                return;
            }
            this._afterDocMutation(newIdx);
            this.setStatus(`✅ Step "${this.clipboard.title}" incollato — la copia resta disponibile (✕ per annullarla).`);
        },

        clearStepClipboard: function () {
            this.clipboard = null;
            this.renderTimeline();
            this.setStatus('Copia annullata.');
        },

        /* ===== Anteprima ===== */
        schedulePreview: function (delay) {
            const d = (typeof delay === 'number') ? delay : PREVIEW_DEBOUNCE;
            clearTimeout(this._previewTimer);
            this._previewTimer = setTimeout(() => this.runPreview(), d);
        },

        runPreview: function () {
            if (this.currentStepIdx < 0) return;
            const res = window.EditorPreviewBridge.applyText(
                this.doc.getText(), this.currentStepIdx, this.doc);
            window.EditorPreviewBridge.resize();
            if (!res.ok) this.setStatus('⚠️ Anteprima: ' + res.error);
        },

        captureCamera: function () {
            const cam = window.EditorPreviewBridge.captureCameraV3();
            if (cam) {
                window.EditorStepWizard.setFieldValue('camera', cam);
                this.setStatus('📷 Camera catturata.');
            }
        },

        togglePick: function (armed) {
            if (armed) {
                this.setStatus('🎯 Clicca un oggetto nell\'anteprima per impostare l\'element…');
                window.EditorPreviewBridge.enablePick((name) => {
                    window.EditorStepWizard.setFieldValue('element', name);
                    this.setStatus('Element impostato: ' + name);
                    window.EditorPreviewBridge.disablePick();
                    const btn = this.els.wizard.querySelector('[data-wact="pick"]');
                    if (btn) btn.classList.remove('armed');
                });
            } else {
                window.EditorPreviewBridge.disablePick();
            }
        },

        /* ===== Tabs / splitter / status ===== */
        switchTab: function (tab) {
            document.querySelectorAll('#editorPage [data-tab]').forEach(b =>
                b.classList.toggle('active', b.getAttribute('data-tab') === tab));
            this.els.wizard.classList.toggle('hidden', tab !== 'wizard');
            this.els.codePanel.classList.toggle('hidden', tab !== 'code');
            if (this.els.screenPanel) {
                this.els.screenPanel.classList.toggle('hidden', tab !== 'screens');
                // Riaggiorna la lista ScreenSnap quando si apre il tab
                if (tab === 'screens' && window.EditorScreenPanel && window.EditorScreenPanel.refresh) {
                    window.EditorScreenPanel.refresh();
                }
            }
        },

        _setupSplitter: function () {
            const sp = this.els.splitter, left = this.els.left;
            if (!sp || !left) return;
            let dragging = false;
            sp.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); document.body.style.userSelect = 'none'; });
            window.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                const min = 320, max = window.innerWidth - 360;
                const w = Math.max(min, Math.min(max, e.clientX));
                left.style.width = w + 'px';
                window.EditorPreviewBridge.resize();
            });
            window.addEventListener('mouseup', () => { dragging = false; document.body.style.userSelect = ''; });
        },

        setStatus: function (msg) {
            if (this.els.status) this.els.status.textContent = msg;
        },

        /* ===== Validazione ===== */
        showValidationReport: async function () {
            if (!this.scenario) { this.setStatus('Nessuna scena caricata.'); return; }
            const issues = this.doc.validate();
            this.renderTimeline(); // aggiorna i badge ⚠/❌
            if (window.EditorUI) {
                await window.EditorUI.report({
                    title: `Verifica tutorial — ${issues.length ? issues.length + ' segnalazioni' : 'tutto ok'}`,
                    items: issues,
                    emptyMessage: 'Nessun problema rilevato: il tutorial è pronto. ✅'
                });
            } else {
                console.table(issues);
            }
            const errors = issues.filter(i => i.level === 'error').length;
            const warns = issues.filter(i => i.level === 'warn').length;
            this.setStatus(errors || warns
                ? `Verifica: ${errors} errori, ${warns} avvisi.`
                : '✅ Verifica: nessun problema.');
        },

        /* ===== Salvataggio ===== */
        save: async function () {
            if (!this.scenario) { this.setStatus('Nessuna scena caricata.'); return; }

            // Validazione pre-salvataggio: gli errori richiedono conferma esplicita
            const issues = this.doc.validate();
            const errors = issues.filter(i => i.level === 'error');
            if (errors.length && window.EditorUI) {
                const ok = await window.EditorUI.confirm({
                    title: `${errors.length} errori nel tutorial`,
                    message: 'La verifica ha trovato errori che possono impedire il funzionamento del tutorial:\n' +
                        errors.slice(0, 5).map(e => `• ${e.where}: ${e.msg}`).join('\n') +
                        (errors.length > 5 ? `\n…e altri ${errors.length - 5}.` : '') +
                        '\n\nSalvare comunque?',
                    okLabel: 'Salva comunque',
                    danger: true
                });
                if (!ok) { this.showValidationReport(); return; }
            }

            const text = this.doc.getText();
            const path = this.scenario.tutorial;
            if (window.electronAPI && window.electronAPI.writeConfigFile) {
                try {
                    const res = await window.electronAPI.writeConfigFile(path, text);
                    if (res && res.success) {
                        this._markClean();
                        this.setStatus('✅ Salvato: ' + path);
                    } else {
                        this.setStatus('❌ Errore salvataggio: ' + ((res && res.error) || 'scrittura fallita') + ' — il file NON è stato salvato.');
                    }
                } catch (e) {
                    this.setStatus('❌ Errore salvataggio: ' + (e.message || e) + ' — il file NON è stato salvato.');
                }
            } else {
                this.download();
                this._markClean();
                this.setStatus(`💾 Browser: file scaricato — copialo in ${path} (nell'app desktop il salvataggio è diretto).`);
            }
        },

        download: function () {
            const text = this.doc.getText();
            const name = (this.scenario && this.scenario.tutorial || 'tutorial.cvtscript').split('/').pop();
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Ritarda per garantire che il DOM dell'editor esista
        setTimeout(() => Editor.init(), 300);
    });

    window.ScenarioEditor = Editor;
    // Scorciatoia da console (utile se il pulsante è nascosto)
    window.openScenarioEditor = () => Editor.open();
})();
