/**
 * StepTimeline.js - Elenco sezioni/step dell'editor (pannello sinistro).
 *
 * Mostra l'outline del V3Document come card selezionabili, evidenzia lo step
 * corrente e offre nuovo/elimina/sposta. Comunica col controller via callback.
 *
 * Esposto come window.EditorStepTimeline (singleton: un editor per pagina).
 */
(function () {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const Timeline = {
        el: null,
        cb: {},

        mount: function (containerEl, callbacks) {
            this.el = containerEl;
            this.cb = callbacks || {};
            this.el.addEventListener('click', (e) => this._onClick(e));
        },

        _onClick: function (e) {
            const secBtn = e.target.closest('[data-sact]');
            if (secBtn) {
                e.stopPropagation();
                const sIdx = parseInt(secBtn.getAttribute('data-sidx'), 10);
                const act = secBtn.getAttribute('data-sact');
                if (act === 'rename' && this.cb.onSectionRename) this.cb.onSectionRename(sIdx);
                else if (act === 'up' && this.cb.onSectionMove) this.cb.onSectionMove(sIdx, -1);
                else if (act === 'down' && this.cb.onSectionMove) this.cb.onSectionMove(sIdx, 1);
                else if (act === 'addstep' && this.cb.onSectionAddStep) this.cb.onSectionAddStep(sIdx);
                else if (act === 'del' && this.cb.onSectionDelete) this.cb.onSectionDelete(sIdx);
                return;
            }
            const actBtn = e.target.closest('[data-act]');
            if (actBtn) {
                e.stopPropagation();
                const idx = parseInt(actBtn.getAttribute('data-idx'), 10);
                const act = actBtn.getAttribute('data-act');
                if (act === 'del' && this.cb.onDelete) this.cb.onDelete(idx);
                else if (act === 'up' && this.cb.onMove) this.cb.onMove(idx, -1);
                else if (act === 'down' && this.cb.onMove) this.cb.onMove(idx, 1);
                else if (act === 'add' && this.cb.onAdd) this.cb.onAdd(idx);
                else if (act === 'copy' && this.cb.onCopy) this.cb.onCopy(idx);
                return;
            }
            const clipClear = e.target.closest('[data-clip-clear]');
            if (clipClear) {
                e.stopPropagation();
                if (this.cb.onClipboardClear) this.cb.onClipboardClear();
                return;
            }
            const pasteAfter = e.target.closest('[data-paste-after]');
            if (pasteAfter) {
                e.stopPropagation();
                if (this.cb.onPasteAfter) this.cb.onPasteAfter(parseInt(pasteAfter.getAttribute('data-paste-after'), 10));
                return;
            }
            const pasteSection = e.target.closest('[data-paste-section]');
            if (pasteSection) {
                e.stopPropagation();
                if (this.cb.onPasteSection) this.cb.onPasteSection(parseInt(pasteSection.getAttribute('data-paste-section'), 10));
                return;
            }
            const sceneRow = e.target.closest('[data-scene-sel]');
            if (sceneRow) {
                if (this.cb.onSelectScene) this.cb.onSelectScene();
                return;
            }
            const secTitle = e.target.closest('[data-ssel]');
            if (secTitle) {
                if (this.cb.onSelectSection) this.cb.onSelectSection(parseInt(secTitle.getAttribute('data-ssel'), 10));
                return;
            }
            const card = e.target.closest('[data-step]');
            if (card && this.cb.onSelect) {
                this.cb.onSelect(parseInt(card.getAttribute('data-step'), 10));
            }
        },

        /**
         * @param issuesByStep opzionale: Map stepIdx → 'error'|'warn' (da V3Document.validate)
         * @param sel opzionale: { section: idx|null, scene: bool } — selezione non-step
         */
        render: function (doc, currentStepIdx, clipboard, issuesByStep, sel) {
            if (!this.el) return;
            const outline = doc.getOutline();
            const total = doc.getStepCount();
            const sections = doc.getSectionCount ? doc.getSectionCount() : 0;
            const selection = sel || {};
            let html = '';
            let stepShown = 0;

            if (clipboard) {
                html += `
                <div class="tl-clipboard">
                    <span>📋 «${esc(clipboard.title || 'step')}» copiato — clicca un punto qui sotto</span>
                    <button data-clip-clear title="Annulla copia">✕</button>
                </div>`;
            }

            // Riga proprietà scena (camera iniziale globale)
            html += `<div class="tl-scene${selection.scene ? ' active' : ''}" data-scene-sel title="Camera iniziale applicata al caricamento dello scenario">🎬 Proprietà scena</div>`;

            if (outline.length === 0) {
                html += '<div class="tl-empty">Nessuno step. Usa "＋ Sezione" per creare il primo tutorial di questa scena.</div>';
            }

            for (const item of outline) {
                if (item.kind === 'section') {
                    const s = item.sectionIdx;
                    const secActive = selection.section === s ? ' active' : '';
                    html += `
                    <div class="tl-section${secActive}">
                        <span class="tl-section-title" data-ssel="${s}" title="Clicca per modificare le proprietà della sezione (camera, stato iniziale)">${esc(item.title || 'Sezione')}</span>
                        <span class="tl-section-actions">
                            <button data-sact="rename" data-sidx="${s}" title="Rinomina sezione">✎</button>
                            <button data-sact="up" data-sidx="${s}" title="Sposta sezione su" ${s === 0 ? 'disabled' : ''}>▲</button>
                            <button data-sact="down" data-sidx="${s}" title="Sposta sezione giù" ${s === sections - 1 ? 'disabled' : ''}>▼</button>
                            <button data-sact="addstep" data-sidx="${s}" title="Aggiungi step in fondo alla sezione">＋</button>
                            <button data-sact="del" data-sidx="${s}" title="Elimina sezione e i suoi step" class="danger">✕</button>
                        </span>
                    </div>`;
                    if (clipboard) {
                        html += `<div class="tl-paste-bar" data-paste-section="${s}" title="Incolla in cima alla sezione">⤵ incolla qui</div>`;
                    }
                    continue;
                }
                stepShown++;
                const active = item.stepIdx === currentStepIdx ? ' active' : '';
                const legacy = item.legacy ? '<span class="tl-badge legacy">legacy</span>' : '';
                const flags = (item.flags || [])
                    .map(f => `<span class="tl-badge flag-${esc(f)}">${esc(f)}</span>`).join('');
                const lvl = issuesByStep && issuesByStep.get(item.stepIdx);
                const issueBadge = lvl
                    ? `<span class="tl-badge issue-${lvl}" title="${lvl === 'error' ? 'Errori' : 'Avvisi'} in questo step — vedi Verifica">${lvl === 'error' ? '❌' : '⚠'}</span>`
                    : '';
                html += `
                <div class="tl-card${active}" data-step="${item.stepIdx}">
                    <div class="tl-num">${stepShown}</div>
                    <div class="tl-body">
                        <div class="tl-title">${esc(item.title || '(senza titolo)')}</div>
                        <div class="tl-badges">${flags}${legacy}${issueBadge}</div>
                    </div>
                    <div class="tl-actions">
                        <button data-act="up" data-idx="${item.stepIdx}" title="Su" ${item.stepIdx === 0 ? 'disabled' : ''}>▲</button>
                        <button data-act="down" data-idx="${item.stepIdx}" title="Giù" ${item.stepIdx === total - 1 ? 'disabled' : ''}>▼</button>
                        <button data-act="copy" data-idx="${item.stepIdx}" title="Copia step">⧉</button>
                        <button data-act="add" data-idx="${item.stepIdx}" title="Aggiungi dopo">＋</button>
                        <button data-act="del" data-idx="${item.stepIdx}" title="Elimina" class="danger">✕</button>
                    </div>
                </div>`;
                if (clipboard) {
                    html += `<div class="tl-paste-bar" data-paste-after="${item.stepIdx}" title="Incolla dopo questo step">⤵ incolla qui</div>`;
                }
            }

            this.el.innerHTML = html;
            const activeCard = this.el.querySelector('.tl-card.active');
            if (activeCard) activeCard.scrollIntoView({ block: 'nearest' });
        }
    };

    window.EditorStepTimeline = Timeline;
})();
