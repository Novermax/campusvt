/**
 * EditorUI.js - Componenti dialog riutilizzabili dell'editor.
 *
 * Sostituisce window.confirm / window.prompt con dialog coerenti con il tema
 * dell'editor, basati su Promise:
 *   EditorUI.confirm({ title, message, okLabel, danger }) → Promise<boolean>
 *   EditorUI.prompt({ title, message, value, placeholder }) → Promise<string|null>
 *   EditorUI.report({ title, items:[{level,msg}], okLabel }) → Promise<void>
 *
 * Un solo dialog alla volta; Esc = annulla, Enter = conferma (nel prompt).
 * Esposto come window.EditorUI.
 */
(function () {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const LEVEL_ICONS = { error: '❌', warn: '⚠️', info: 'ℹ️' };

    const UI = {
        _overlay: null,

        _close: function () {
            if (this._overlay) {
                this._overlay.remove();
                this._overlay = null;
            }
            if (this._keyHandler) {
                document.removeEventListener('keydown', this._keyHandler, true);
                this._keyHandler = null;
            }
        },

        _show: function (innerHtml, onKey) {
            this._close();
            const ov = document.createElement('div');
            ov.className = 'ed-dialog-overlay';
            ov.innerHTML = `<div class="ed-dialog" role="dialog" aria-modal="true">${innerHtml}</div>`;
            document.body.appendChild(ov);
            this._overlay = ov;
            this._keyHandler = (e) => {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    e.stopPropagation();
                    if (onKey) onKey(e.key);
                }
            };
            document.addEventListener('keydown', this._keyHandler, true);
            return ov;
        },

        /**
         * Dialog di conferma. Risolve true (OK) / false (annulla o Esc).
         * opts: { title, message, okLabel='OK', cancelLabel='Annulla', danger=false }
         */
        confirm: function (opts) {
            const o = opts || {};
            return new Promise((resolve) => {
                const done = (val) => { this._close(); resolve(val); };
                const ov = this._show(`
                    <div class="ed-dialog-title">${esc(o.title || 'Conferma')}</div>
                    <div class="ed-dialog-body">${esc(o.message || 'Confermi l’operazione?').replace(/\n/g, '<br>')}</div>
                    <div class="ed-dialog-actions">
                        <button class="ed-btn ghost" data-dlg="cancel">${esc(o.cancelLabel || 'Annulla')}</button>
                        <button class="ed-btn ${o.danger ? 'danger' : 'primary'}" data-dlg="ok">${esc(o.okLabel || 'OK')}</button>
                    </div>`,
                    (key) => done(key === 'Enter'));
                ov.addEventListener('click', (e) => {
                    const b = e.target.closest('[data-dlg]');
                    if (b) done(b.getAttribute('data-dlg') === 'ok');
                    else if (e.target === ov) done(false);
                });
                const okBtn = ov.querySelector('[data-dlg="ok"]');
                if (okBtn) okBtn.focus();
            });
        },

        /**
         * Dialog con campo di testo. Risolve la stringa inserita, oppure null
         * se annullato. opts: { title, message, value, placeholder, okLabel }
         */
        prompt: function (opts) {
            const o = opts || {};
            return new Promise((resolve) => {
                const done = (val) => { this._close(); resolve(val); };
                const ov = this._show(`
                    <div class="ed-dialog-title">${esc(o.title || 'Inserisci un valore')}</div>
                    ${o.message ? `<div class="ed-dialog-body">${esc(o.message)}</div>` : ''}
                    <input type="text" class="ed-dialog-input" value="${esc(o.value || '')}"
                           placeholder="${esc(o.placeholder || '')}">
                    <div class="ed-dialog-actions">
                        <button class="ed-btn ghost" data-dlg="cancel">Annulla</button>
                        <button class="ed-btn primary" data-dlg="ok">${esc(o.okLabel || 'OK')}</button>
                    </div>`,
                    null /* gestito sotto: Enter dentro l'input conferma */);
                const input = ov.querySelector('.ed-dialog-input');
                const submit = () => done(input.value);
                this._keyHandler = (e) => {
                    if (e.key === 'Escape') { e.stopPropagation(); done(null); }
                };
                document.addEventListener('keydown', this._keyHandler, true);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); submit(); }
                });
                ov.addEventListener('click', (e) => {
                    const b = e.target.closest('[data-dlg]');
                    if (b) (b.getAttribute('data-dlg') === 'ok') ? submit() : done(null);
                    else if (e.target === ov) done(null);
                });
                setTimeout(() => { input.focus(); input.select(); }, 0);
            });
        },

        /**
         * Report a lista (es. risultati di validazione).
         * opts: { title, items: [{level:'error'|'warn'|'info', msg, where}], emptyMessage }
         */
        report: function (opts) {
            const o = opts || {};
            const items = o.items || [];
            return new Promise((resolve) => {
                const done = () => { this._close(); resolve(); };
                const listHtml = items.length
                    ? `<div class="ed-dialog-list">` + items.map(it => `
                        <div class="ed-dialog-item lvl-${esc(it.level || 'info')}">
                            <span class="ed-dialog-item-icon">${LEVEL_ICONS[it.level] || LEVEL_ICONS.info}</span>
                            <span class="ed-dialog-item-msg">${it.where ? `<b>${esc(it.where)}</b> — ` : ''}${esc(it.msg)}</span>
                        </div>`).join('') + `</div>`
                    : `<div class="ed-dialog-body">${esc(o.emptyMessage || 'Nessun problema rilevato. ✅')}</div>`;
                const ov = this._show(`
                    <div class="ed-dialog-title">${esc(o.title || 'Report')}</div>
                    ${listHtml}
                    <div class="ed-dialog-actions">
                        <button class="ed-btn primary" data-dlg="ok">${esc(o.okLabel || 'Chiudi')}</button>
                    </div>`,
                    () => done());
                ov.addEventListener('click', (e) => {
                    if (e.target.closest('[data-dlg]') || e.target === ov) done();
                });
            });
        }
    };

    window.EditorUI = UI;
})();
