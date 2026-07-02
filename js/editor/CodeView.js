/**
 * CodeView.js - Editor di testo .cvtscript con syntax highlighting v3, leggero e
 * senza dipendenze (textarea trasparente sopra un overlay <pre> colorato).
 *
 * Niente Monaco/CodeMirror: il progetto è offline e questo basta per evidenziare
 * la DSL v3 (header di blocco, chiavi, do:/after:, commenti, coordinate).
 *
 * Esposto come window.EditorCodeView.
 */
(function () {
    'use strict';

    const V3_KEYS = ['element', 'tool', 'description', 'camera', 'message', 'title',
        'video', 'image', 'drag', 'hold', 'position', 'rotation', 'companion',
        'animation', 'view', 'sound'];

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function highlightLine(raw) {
        const trimmed = raw.trim();
        if (trimmed === '') return '&nbsp;';
        // Commenti
        if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
            return `<span class="hl-comment">${esc(raw)}</span>`;
        }
        // Header di blocco [ ... ]
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const inner = trimmed.slice(1, -1);
            let h = esc(inner)
                .replace(/&quot;([^&]*)&quot;/g, '<span class="hl-string">"$1"</span>')
                .replace(/^(\w+)/, '<span class="hl-block">$1</span>');
            return `<span class="hl-bracket">[</span>${h}<span class="hl-bracket">]</span>`;
        }
        // do : / after :  (colon keys)
        const colonKey = raw.match(/^(\s*)(do|after)(\s*:\s*)(.*)$/i);
        if (colonKey) {
            return `${colonKey[1]}<span class="hl-action">${esc(colonKey[2])}</span><span class="hl-op">${esc(colonKey[3])}</span>${highlightValue(colonKey[4])}`;
        }
        // key = value
        const kv = raw.match(/^(\s*)([A-Za-z_][\w.]*)(\s*=\s*)(.*)$/);
        if (kv) {
            const keyClass = V3_KEYS.indexOf(kv[2].toLowerCase()) !== -1 ? 'hl-key' : 'hl-key-other';
            return `${kv[1]}<span class="${keyClass}">${esc(kv[2])}</span><span class="hl-op">${esc(kv[3])}</span>${highlightValue(kv[4])}`;
        }
        return esc(raw);
    }

    function highlightValue(v) {
        return esc(v)
            .replace(/(\([-\d.,\s]+\))/g, '<span class="hl-coord">$1</span>')
            .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-num">$1</span>');
    }

    function highlight(text) {
        return text.split('\n').map(highlightLine).join('\n');
    }

    const CodeView = {
        wrap: null, ta: null, pre: null, cb: {},

        mount: function (containerEl, callbacks) {
            this.cb = callbacks || {};
            containerEl.classList.add('code-view');
            containerEl.innerHTML = `
                <pre class="code-highlight"><code></code></pre>
                <textarea class="code-input" spellcheck="false" wrap="off"></textarea>`;
            this.wrap = containerEl;
            this.pre = containerEl.querySelector('code');
            this.ta = containerEl.querySelector('textarea');

            this.ta.addEventListener('input', () => {
                this._renderHL();
                if (this.cb.onChange) this.cb.onChange(this.ta.value);
            });
            this.ta.addEventListener('scroll', () => {
                this.pre.parentElement.scrollTop = this.ta.scrollTop;
                this.pre.parentElement.scrollLeft = this.ta.scrollLeft;
            });
            this.ta.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const s = this.ta.selectionStart, en = this.ta.selectionEnd;
                    this.ta.value = this.ta.value.slice(0, s) + '    ' + this.ta.value.slice(en);
                    this.ta.selectionStart = this.ta.selectionEnd = s + 4;
                    this.ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        },

        _renderHL: function () {
            this.pre.innerHTML = highlight(this.ta.value);
        },

        // Imposta il testo senza emettere onChange (sync da wizard/timeline)
        setText: function (text) {
            if (!this.ta) return;
            if (this.ta.value === text) return;
            this.ta.value = text;
            this._renderHL();
        },

        getText: function () {
            return this.ta ? this.ta.value : '';
        },

        focus: function () { if (this.ta) this.ta.focus(); }
    };

    window.EditorCodeView = CodeView;
})();
