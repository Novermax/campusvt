/**
 * V3Document.js - Modello editabile di un file tutorial CVTScript v3
 *
 * Il TESTO è l'unica fonte di verità. Questa classe lo tiene in un array
 * di righe, individua i blocchi ([scene]/[section]/[step]/[state]/[object]/...)
 * e offre lettura/scrittura mirata dei campi di uno step preservando
 * commenti, ordine e righe non riconosciute.
 *
 * Usato da StepWizard (form), CodeView (testo), StepTimeline (outline) e
 * PreviewBridge (mapping sezione/step per la live preview).
 *
 * Esposto come window.V3Document (non un ES module, coerente col resto del progetto).
 */
(function () {
    'use strict';

    const TOOL_VALUES = ['hand', 'hex_key', 'wrench', 'air', 'spray'];

    // Campi step a riga singola gestiti dal wizard (chiavi v3 lowercase).
    const SINGLE_FIELDS = [
        'description', 'element', 'tool', 'camera',
        'message', 'title', 'video', 'image', 'after', 'drag',
        'hold', 'animation', 'view', 'sound'
    ];

    function classifyHeader(inner) {
        const t = inner.trim();
        const lower = t.toLowerCase();

        // --- v3 ---
        if (lower === 'scene') return { type: 'scene', title: '', flags: [] };
        if (/^section\b/.test(lower)) {
            return { type: 'section', title: extractQuoted(t) || t.replace(/^section\s*/i, '').trim(), flags: [] };
        }
        if (/^step\b/.test(lower)) {
            const title = extractQuoted(t) || '';
            const flags = extractStepFlags(t);
            return { type: 'step', title, flags };
        }
        if (/^state\b/.test(lower)) return { type: 'state', title: t.replace(/^state\s*/i, '').trim(), flags: [] };
        if (/^object\b/.test(lower)) return { type: 'object', title: t.replace(/^object\s*/i, '').trim(), flags: [] };
        if (/^(hotspot|screen|screenview|screenaction|action)\b/.test(lower)) {
            return { type: 'other', title: t, flags: [] };
        }

        // --- legacy v1/v2 ---
        if (/^step\s*-/i.test(t)) {
            const rest = t.replace(/^step\s*-\s*/i, '');
            const parts = rest.split('|');
            const title = (parts[0] || '').trim();
            const flags = (parts[1] || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
            return { type: 'step', title, flags, legacy: true };
        }
        if (/^section\s*-/i.test(t) || /^tutorial$/i.test(t)) {
            return { type: 'section', title: t.replace(/^section\s*-\s*/i, '').trim(), flags: [], legacy: true };
        }
        return { type: 'other', title: t, flags: [] };
    }

    function extractQuoted(s) {
        const m = s.match(/"([^"]*)"/);
        return m ? m[1] : null;
    }

    function extractStepFlags(headerInner) {
        // Tutto ciò che segue la stringa quotata sono flag (auto, machine, highlight)
        const afterQuote = headerInner.replace(/^step\s*/i, '').replace(/"[^"]*"/, '').trim();
        if (!afterQuote) return [];
        return afterQuote.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    }

    class V3Document {
        constructor(text = '') {
            this.setText(text);
        }

        setText(text) {
            this.lines = String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            this._reparse();
        }

        getText() {
            return this.lines.join('\n');
        }

        _reparse() {
            this.blocks = [];
            const headerIdx = [];
            for (let i = 0; i < this.lines.length; i++) {
                const l = this.lines[i].trim();
                if (l.startsWith('[') && l.endsWith(']') && l.length > 2) {
                    headerIdx.push(i);
                }
            }
            for (let k = 0; k < headerIdx.length; k++) {
                const start = headerIdx[k];
                const end = (k + 1 < headerIdx.length) ? headerIdx[k + 1] - 1 : this.lines.length - 1;
                const inner = this.lines[start].trim().slice(1, -1);
                const info = classifyHeader(inner);
                this.blocks.push({
                    type: info.type,
                    title: info.title,
                    flags: info.flags,
                    legacy: !!info.legacy,
                    headerIndex: start,
                    rangeEnd: end
                });
            }
        }

        /* ===== Outline (per timeline e preview mapping) ===== */
        getOutline() {
            const out = [];
            let sectionIdx = -1;
            let localStepIdx = -1;
            let stepIdx = -1;
            for (const b of this.blocks) {
                if (b.type === 'section') {
                    sectionIdx++;
                    localStepIdx = -1;
                    out.push({ kind: 'section', title: b.title, sectionIdx, block: b });
                } else if (b.type === 'step') {
                    stepIdx++;
                    localStepIdx++;
                    out.push({
                        kind: 'step',
                        title: b.title,
                        flags: b.flags.slice(),
                        legacy: b.legacy,
                        stepIdx,
                        sectionIdx: Math.max(0, sectionIdx),
                        localStepIdx,
                        block: b
                    });
                }
            }
            return out;
        }

        getStepCount() {
            return this.blocks.filter(b => b.type === 'step').length;
        }

        _stepBlock(stepIdx) {
            let n = -1;
            for (const b of this.blocks) {
                if (b.type === 'step') {
                    n++;
                    if (n === stepIdx) return b;
                }
            }
            return null;
        }

        getStepInfo(stepIdx) {
            const b = this._stepBlock(stepIdx);
            if (!b) return null;
            const fields = {};
            const actions = [];
            const rawLines = [];
            for (let i = b.headerIndex + 1; i <= b.rangeEnd; i++) {
                const raw = this.lines[i];
                rawLines.push(raw);
                const line = raw.trim();
                if (!line || line.startsWith('#') || line.startsWith('//')) continue;
                const doMatch = line.match(/^do\s*:\s*(.*)$/i);
                if (doMatch) { actions.push(doMatch[1].trim()); continue; }
                const eq = line.indexOf('=');
                const colon = line.indexOf(':');
                // Campo con due punti (es. "after : schermo = schermo002") quando ':' precede '='
                if (colon > 0 && (eq === -1 || colon < eq)) {
                    const ckey = line.slice(0, colon).trim().toLowerCase();
                    const cval = line.slice(colon + 1).trim();
                    if (/^\w+$/.test(ckey) && !(ckey in fields)) fields[ckey] = cval;
                    continue;
                }
                if (eq > 0) {
                    const key = line.slice(0, eq).trim().toLowerCase();
                    const val = line.slice(eq + 1).trim();
                    if (!(key in fields)) fields[key] = val; // prima occorrenza
                }
            }
            // element può avere "repeat N"
            let element = fields.element || '';
            let repeat = '';
            const rep = element.match(/^(.*?)\s+repeat\s+(\d+)\s*$/i);
            if (rep) { element = rep[1].trim(); repeat = rep[2]; }

            // hold legacy: `pick obj at (...)` / `held obj` portano l'oggetto inline.
            // Per il wizard preferiamo la forma normalizzata (element separato + hold
            // senza oggetto). Lo splittiamo solo per la visualizzazione: il file
            // viene riscritto nella forma nuova alla prima edit.
            if (fields.hold) {
                const holdMatch = fields.hold.match(/^pick\s+(?!at\b|facing\b)(\S+)(\s+at\s+\([^)]+\))?(\s+facing\s+\([^)]+\))?\s*$/i);
                const heldMatch = fields.hold.match(/^held\s+(\S+)\s*$/i);
                if (holdMatch) {
                    if (!element) element = holdMatch[1];
                    fields.hold = ('pick' + (holdMatch[2] || '') + (holdMatch[3] || '')).trim();
                } else if (heldMatch) {
                    if (!element) element = heldMatch[1];
                    fields.hold = 'held';
                }
            }

            return {
                stepIdx,
                title: b.title,
                flags: b.flags.slice(),
                legacy: b.legacy,
                fields,
                element,
                repeat,
                tool: fields.tool || '',
                actions,
                rawLines
            };
        }

        /* ===== Blocco [scene] ===== */
        _sceneBlock() {
            return this.blocks.find(b => b.type === 'scene') || null;
        }

        /** Info del blocco [scene] (camera iniziale globale). */
        getSceneInfo() {
            const b = this._sceneBlock();
            if (!b) return { exists: false, fields: {} };
            const fields = {};
            for (let i = b.headerIndex + 1; i <= b.rangeEnd; i++) {
                const line = this.lines[i].trim();
                if (!line || line.startsWith('#') || line.startsWith('//')) continue;
                const eq = line.indexOf('=');
                if (eq > 0) {
                    const key = line.slice(0, eq).trim().toLowerCase();
                    if (!(key in fields)) fields[key] = line.slice(eq + 1).trim();
                }
            }
            return { exists: true, fields };
        }

        /** Scrive un campo del blocco [scene]; lo crea in testa al file se manca. */
        setSceneField(key, value) {
            let b = this._sceneBlock();
            if (!b) {
                this.lines.splice(0, 0, '[scene]', '');
                this._reparse();
                b = this._sceneBlock();
            }
            const idx = this._findFieldLine(b, key);
            const v = (value == null ? '' : String(value)).trim();
            if (v === '') {
                if (idx !== -1) { this.lines.splice(idx, 1); this._reparse(); }
                return;
            }
            const newLine = `${key} = ${v}`;
            if (idx !== -1) this.lines[idx] = newLine;
            else this.lines.splice(this._appendIndex(b), 0, newLine);
            this._reparse();
        }

        /* ===== Sezioni ===== */
        _sectionBlocks() {
            return this.blocks.filter(b => b.type === 'section');
        }

        getSectionCount() {
            return this._sectionBlocks().length;
        }

        _sectionBlock(sectionIdx) {
            const secs = this._sectionBlocks();
            return (sectionIdx >= 0 && sectionIdx < secs.length) ? secs[sectionIdx] : null;
        }

        /**
         * Regione completa di una sezione: dall'header fino alla riga prima
         * dell'header della sezione successiva (o EOF). Include tutti gli step.
         */
        _sectionRegion(sectionIdx) {
            const secs = this._sectionBlocks();
            const b = secs[sectionIdx];
            if (!b) return null;
            const next = secs[sectionIdx + 1];
            const end = next ? next.headerIndex - 1 : this.lines.length - 1;
            return { from: b.headerIndex, to: end, block: b };
        }

        /** Indice della sezione che contiene lo step dato. */
        sectionIdxOfStep(stepIdx) {
            const item = this.getOutline().find(o => o.kind === 'step' && o.stepIdx === stepIdx);
            return item ? item.sectionIdx : -1;
        }

        renameSection(sectionIdx, title) {
            const b = this._sectionBlock(sectionIdx);
            if (!b) return false;
            const t = String(title || '').trim();
            if (!t) return false;
            this.lines[b.headerIndex] = b.legacy ? `[Section - ${t}]` : `[section "${t}"]`;
            this._reparse();
            return true;
        }

        /**
         * Proprietà della sezione (corpo del blocco [section], prima del primo step):
         *   fields   — coppie key=value (camera, view, …), prima occorrenza
         *   doLines  — righe `do : …` nell'ordine del file (stato iniziale)
         *   extraLines — righe position/rotation/companion verbatim
         */
        getSectionInfo(sectionIdx) {
            const b = this._sectionBlock(sectionIdx);
            if (!b) return null;
            const fields = {};
            const doLines = [];
            const extraLines = [];
            for (let i = b.headerIndex + 1; i <= b.rangeEnd; i++) {
                const line = this.lines[i].trim();
                if (!line || line.startsWith('#') || line.startsWith('//')) continue;
                const doM = line.match(/^do\s*:\s*(.*)$/i);
                if (doM) { doLines.push(doM[1].trim()); continue; }
                if (/^(position|rotation|companion)\s*=/i.test(line)) { extraLines.push(line); continue; }
                const eq = line.indexOf('=');
                if (eq > 0) {
                    const key = line.slice(0, eq).trim().toLowerCase();
                    if (!(key in fields)) fields[key] = line.slice(eq + 1).trim();
                }
            }
            return { sectionIdx, title: b.title, legacy: b.legacy, fields, doLines, extraLines };
        }

        setSectionField(sectionIdx, key, value) {
            const b = this._sectionBlock(sectionIdx);
            if (!b) return;
            const idx = this._findFieldLine(b, key);
            const v = (value == null ? '' : String(value)).trim();
            if (v === '') {
                if (idx !== -1) { this.lines.splice(idx, 1); this._reparse(); }
                return;
            }
            const newLine = `${key} = ${v}`;
            if (idx !== -1) this.lines[idx] = newLine;
            else this.lines.splice(this._appendIndex(b), 0, newLine);
            this._reparse();
        }

        /** Sostituisce tutte le righe `do :` del corpo sezione (stato iniziale). */
        setSectionDoLines(sectionIdx, linesArr) {
            const b = this._sectionBlock(sectionIdx);
            if (!b) return;
            let insertAt = -1;
            for (let i = b.rangeEnd; i > b.headerIndex; i--) {
                if (/^do\s*:/i.test(this.lines[i].trim())) {
                    insertAt = i;
                    this.lines.splice(i, 1);
                }
            }
            this._reparse();
            const clean = (linesArr || []).map(l => String(l).trim()).filter(Boolean);
            if (!clean.length) return;
            const nb = this._sectionBlock(sectionIdx);
            const at = (insertAt !== -1 && insertAt <= nb.rangeEnd + 1) ? insertAt : this._appendIndex(nb);
            this.lines.splice(at, 0, ...clean.map(l => `do : ${l}`));
            this._reparse();
        }

        /** Sostituisce le righe position/rotation/companion del corpo sezione (verbatim). */
        setSectionExtraLines(sectionIdx, linesArr) {
            const b = this._sectionBlock(sectionIdx);
            if (!b) return;
            let insertAt = -1;
            for (let i = b.rangeEnd; i > b.headerIndex; i--) {
                if (/^(position|rotation|companion)\s*=/i.test(this.lines[i].trim())) {
                    insertAt = i;
                    this.lines.splice(i, 1);
                }
            }
            this._reparse();
            const clean = (linesArr || []).map(l => String(l).trim()).filter(Boolean);
            if (!clean.length) return;
            const nb = this._sectionBlock(sectionIdx);
            const at = (insertAt !== -1 && insertAt <= nb.rangeEnd + 1) ? insertAt : this._appendIndex(nb);
            this.lines.splice(at, 0, ...clean);
            this._reparse();
        }

        /** Rimuove la sezione e tutti i suoi step. Ritorna il numero di step rimossi. */
        removeSection(sectionIdx) {
            const region = this._sectionRegion(sectionIdx);
            if (!region) return 0;
            let removed = 0;
            for (const b of this.blocks) {
                if (b.type === 'step' && b.headerIndex >= region.from && b.headerIndex <= region.to) removed++;
            }
            this.lines.splice(region.from, region.to - region.from + 1);
            this._reparse();
            return removed;
        }

        /** Scambia la sezione con quella adiacente (dir = -1 su, +1 giù). */
        moveSection(sectionIdx, dir) {
            const other = sectionIdx + dir;
            if (other < 0 || other >= this.getSectionCount()) return sectionIdx;
            const a = this._sectionRegion(Math.min(sectionIdx, other));
            const b = this._sectionRegion(Math.max(sectionIdx, other));
            if (!a || !b) return sectionIdx;
            const segA = this.lines.slice(a.from, a.to + 1);
            const segB = this.lines.slice(b.from, b.to + 1);
            this.lines.splice(b.from, b.to - b.from + 1, ...segA);
            this.lines.splice(a.from, a.to - a.from + 1, ...segB);
            this._reparse();
            return other;
        }

        /** Aggiunge uno step vuoto in fondo alla sezione. Ritorna l'indice flat del nuovo step. */
        addStepAtSectionEnd(sectionIdx, title) {
            const region = this._sectionRegion(sectionIdx);
            if (!region) return -1;
            const insertAt = region.to + 1;
            const block = ['', `[step "${title || 'Nuovo step'}"]`, 'description = '];
            this.lines.splice(insertAt, 0, ...block);
            this._reparse();
            return this._stepIdxAtHeaderIndex(insertAt + 1);
        }

        /* ===== Mutazioni ===== */
        _bodyRange(b) {
            return { from: b.headerIndex + 1, to: b.rangeEnd };
        }

        /**
         * Punto di inserimento "pulito" in coda al corpo di un blocco:
         * subito dopo l'ultima riga non vuota, così i nuovi campi non
         * finiscono dopo le righe vuote che separano i blocchi.
         */
        _appendIndex(b) {
            for (let i = b.rangeEnd; i > b.headerIndex; i--) {
                if (this.lines[i].trim() !== '') return i + 1;
            }
            return b.headerIndex + 1;
        }

        _findFieldLine(b, key) {
            const r = this._bodyRange(b);
            const re = new RegExp('^\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=', 'i');
            for (let i = r.from; i <= r.to; i++) {
                const l = this.lines[i].trim();
                if (l.startsWith('#') || l.startsWith('//')) continue;
                if (re.test(this.lines[i])) return i;
            }
            return -1;
        }

        setStepTitle(stepIdx, title) {
            const b = this._stepBlock(stepIdx);
            if (!b) return;
            const flagStr = b.flags.length ? ' ' + b.flags.join(', ') : '';
            this.lines[b.headerIndex] = `[step "${title}"${flagStr}]`;
            this._reparse();
        }

        setStepFlags(stepIdx, flags) {
            const b = this._stepBlock(stepIdx);
            if (!b) return;
            const clean = flags.filter(Boolean);
            const flagStr = clean.length ? ' ' + clean.join(', ') : '';
            this.lines[b.headerIndex] = `[step "${b.title}"${flagStr}]`;
            this._reparse();
        }

        /**
         * Se lo step ha `hold = pick X at ...` o `hold = held X` (forma legacy
         * con oggetto inline) e nessuna riga `element = ...`, riscrive il file
         * in forma nuova: `element = X` + `hold = pick at ...`. Idempotente.
         * Restituisce true se ha modificato il testo.
         */
        normalizeHoldStep(stepIdx) {
            const b = this._stepBlock(stepIdx);
            if (!b) return false;
            const holdIdx = this._findFieldLine(b, 'hold');
            if (holdIdx === -1) return false;
            const holdVal = this.lines[holdIdx].split('=').slice(1).join('=').trim();
            const pickM = holdVal.match(/^pick\s+(?!at\b|facing\b)(\S+)(\s+at\s+\([^)]+\))?(\s+facing\s+\([^)]+\))?\s*$/i);
            const heldM = holdVal.match(/^held\s+(\S+)\s*$/i);
            if (!pickM && !heldM) return false;
            const obj = pickM ? pickM[1] : heldM[1];
            const newHold = pickM
                ? ('pick' + (pickM[2] || '') + (pickM[3] || '')).trim()
                : 'held';
            const elemIdx = this._findFieldLine(b, 'element');
            this.lines[holdIdx] = `hold = ${newHold}`;
            if (elemIdx === -1) {
                this.lines.splice(holdIdx, 0, `element = ${obj}`);
            }
            this._reparse();
            return true;
        }

        setStepField(stepIdx, key, value) {
            const b = this._stepBlock(stepIdx);
            if (!b) return;
            const idx = this._findFieldLine(b, key);
            const v = (value == null ? '' : String(value)).trim();
            if (v === '') {
                if (idx !== -1) { this.lines.splice(idx, 1); this._reparse(); }
                return;
            }
            const newLine = `${key} = ${v}`;
            if (idx !== -1) {
                this.lines[idx] = newLine;
            } else {
                // inserisci in coda al corpo del blocco (prima delle righe vuote)
                this.lines.splice(this._appendIndex(b), 0, newLine);
            }
            this._reparse();
        }

        _findColonFieldLine(b, key) {
            const r = this._bodyRange(b);
            const re = new RegExp('^\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:', 'i');
            for (let i = r.from; i <= r.to; i++) {
                const l = this.lines[i].trim();
                if (l.startsWith('#') || l.startsWith('//')) continue;
                if (/^do\s*:/i.test(l)) continue;
                if (re.test(this.lines[i])) return i;
            }
            return -1;
        }

        setStepColonField(stepIdx, key, value) {
            const b = this._stepBlock(stepIdx);
            if (!b) return;
            const idx = this._findColonFieldLine(b, key);
            const v = (value == null ? '' : String(value)).trim();
            if (v === '') {
                if (idx !== -1) { this.lines.splice(idx, 1); this._reparse(); }
                return;
            }
            const newLine = `${key} : ${v}`;
            if (idx !== -1) this.lines[idx] = newLine;
            else this.lines.splice(this._appendIndex(b), 0, newLine);
            this._reparse();
        }

        setStepActions(stepIdx, actionsArr) {
            const b = this._stepBlock(stepIdx);
            if (!b) return;
            const r = this._bodyRange(b);
            // rimuovi tutte le righe do: esistenti (dal fondo per non sballare gli indici)
            let insertAt = -1;
            for (let i = r.to; i >= r.from; i--) {
                if (/^do\s*:/i.test(this.lines[i].trim())) {
                    insertAt = i;
                    this.lines.splice(i, 1);
                }
            }
            const clean = (actionsArr || []).map(a => a.trim()).filter(Boolean);
            if (clean.length === 0) { this._reparse(); return; }
            // ricalcola range dopo le rimozioni
            this._reparse();
            const nb = this._stepBlock(stepIdx);
            const at = (insertAt !== -1 && insertAt <= nb.rangeEnd + 1) ? insertAt : this._appendIndex(nb);
            const toInsert = clean.map(a => `do : ${a}`);
            this.lines.splice(at, 0, ...toInsert);
            this._reparse();
        }

        addStepAfter(stepIdx, title) {
            const newTitle = title || 'Nuovo step';
            const blockText = ['', `[step "${newTitle}"]`, 'description = '];
            const b = (stepIdx >= 0) ? this._stepBlock(stepIdx) : null;
            let insertAt;
            if (b) {
                insertAt = b.rangeEnd + 1;
            } else if (this.getSectionCount() > 0) {
                // Nessuno step di riferimento: accoda alla prima sezione
                const region = this._sectionRegion(0);
                insertAt = region.to + 1;
            } else {
                // File senza sezioni: crea la struttura minima
                insertAt = this.lines.length;
                blockText.unshift('', '[section "Nuova sezione"]');
            }
            this.lines.splice(insertAt, 0, ...blockText);
            this._reparse();
            // nuovo indice = vecchio + 1 (o 0 se non c'erano step)
            return (stepIdx >= 0) ? stepIdx + 1 : this.getStepCount() - 1;
        }

        /**
         * Crea una nuova sezione (tutorial) con un primo step vuoto.
         * Viene inserita DOPO la fine della sezione che contiene lo step di
         * riferimento — mai in mezzo a una sezione esistente.
         * Ritorna l'indice flat del nuovo step.
         */
        addSectionAfter(stepIdx, title) {
            const newTitle = title || 'Nuova sezione';
            const blockText = [
                '',
                `[section "${newTitle}"]`,
                '',
                `[step "Nuovo step"]`,
                'description = '
            ];
            let insertAt = this.lines.length;
            const secIdx = (stepIdx >= 0) ? this.sectionIdxOfStep(stepIdx) : this.getSectionCount() - 1;
            if (secIdx >= 0) {
                const region = this._sectionRegion(secIdx);
                if (region) insertAt = region.to + 1;
            }
            this.lines.splice(insertAt, 0, ...blockText);
            this._reparse();
            const headerOffset = blockText.findIndex(l => /^\[step/.test(l));
            return this._stepIdxAtHeaderIndex(insertAt + headerOffset);
        }

        removeStep(stepIdx) {
            const b = this._stepBlock(stepIdx);
            if (!b) return;
            this.lines.splice(b.headerIndex, b.rangeEnd - b.headerIndex + 1);
            this._reparse();
        }

        /* ===== Copia / incolla step ===== */
        copyStepLines(stepIdx) {
            const b = this._stepBlock(stepIdx);
            if (!b) return null;
            return this.lines.slice(b.headerIndex, b.rangeEnd + 1);
        }

        _normalizePastedBlock(srcLines) {
            const block = (srcLines || []).slice();
            while (block.length && !block[0].trim()) block.shift();
            while (block.length && !block[block.length - 1].trim()) block.pop();
            if (!block.length) return null;
            return ['', ...block, ''];
        }

        _stepIdxAtHeaderIndex(headerIndex) {
            let n = -1;
            for (const b of this.blocks) {
                if (b.type === 'step') {
                    n++;
                    if (b.headerIndex === headerIndex) return n;
                }
            }
            return -1;
        }

        insertStepAfterStep(stepIdx, srcLines) {
            const b = this._stepBlock(stepIdx);
            const block = this._normalizePastedBlock(srcLines);
            if (!b || !block) return -1;
            this.lines.splice(b.rangeEnd + 1, 0, ...block);
            this._reparse();
            return stepIdx + 1;
        }

        insertStepAtSectionStart(sectionIdx, srcLines) {
            let n = -1, target = null;
            for (const blk of this.blocks) {
                if (blk.type === 'section') {
                    n++;
                    if (n === sectionIdx) { target = blk; break; }
                }
            }
            const block = this._normalizePastedBlock(srcLines);
            if (!target || !block) return -1;
            // dopo le proprietà di sezione, prima del primo step esistente
            const insertAt = target.rangeEnd + 1;
            this.lines.splice(insertAt, 0, ...block);
            this._reparse();
            const headerOffset = block.findIndex(l => l.trim().startsWith('['));
            return this._stepIdxAtHeaderIndex(insertAt + headerOffset);
        }

        moveStep(stepIdx, dir) {
            const a = this._stepBlock(stepIdx);
            const other = this._stepBlock(stepIdx + dir);
            if (!a || !other) return stepIdx;
            const segA = this.lines.slice(a.headerIndex, a.rangeEnd + 1);
            const segB = this.lines.slice(other.headerIndex, other.rangeEnd + 1);
            // sostituisci entrambi i segmenti (parti dal più in basso)
            const first = (a.headerIndex < other.headerIndex) ? a : other;
            const second = (a.headerIndex < other.headerIndex) ? other : a;
            const firstSeg = (first === a) ? segA : segB;
            const secondSeg = (first === a) ? segB : segA;
            this.lines.splice(second.headerIndex, second.rangeEnd - second.headerIndex + 1, ...firstSeg);
            this.lines.splice(first.headerIndex, first.rangeEnd - first.headerIndex + 1, ...secondSeg);
            this._reparse();
            return stepIdx + dir;
        }

        /* ===== Validazione =====
         * Controllo sintattico del documento. Ritorna una lista di
         * { level: 'error'|'warn'|'info', where, msg, stepIdx? } ordinata
         * come il file. Non modifica nulla. */
        validate() {
            const issues = [];
            const outline = this.getOutline();
            const push = (level, where, msg, stepIdx) =>
                issues.push({ level, where, msg, stepIdx });

            const balanced = (s) => {
                let depth = 0;
                for (const ch of String(s)) {
                    if (ch === '(') depth++;
                    else if (ch === ')') { depth--; if (depth < 0) return false; }
                }
                return depth === 0;
            };

            // Sezioni: vuote o con titoli duplicati
            const sectionTitles = new Map();
            const sections = outline.filter(o => o.kind === 'section');
            for (const s of sections) {
                const stepsIn = outline.filter(o => o.kind === 'step' && o.sectionIdx === s.sectionIdx);
                const where = `Sezione "${s.title || '(senza titolo)'}"`;
                if (!s.title) push('warn', where, 'La sezione non ha titolo.');
                if (stepsIn.length === 0) push('warn', where, 'La sezione non contiene step.');
                const key = (s.title || '').toLowerCase();
                if (key) {
                    if (sectionTitles.has(key)) push('warn', where, 'Titolo di sezione duplicato.');
                    sectionTitles.set(key, true);
                }
            }
            if (sections.length === 0 && this.getStepCount() > 0) {
                push('warn', 'Documento', 'Ci sono step ma nessuna sezione: aggiungi una [section "…"] prima degli step.');
            }

            const ACTION_VERBS = ['unscrew', 'screw', 'extract', 'insert', 'place',
                'move', 'rotate', 'pump', 'idle'];
            const FLAGS = ['auto', 'machine', 'highlight'];
            const CAMERA_KEYS = ['position', 'target', 'zoom', 'fade', 'pivot',
                'distance', 'fov', 'rotation', 'free'];

            for (const item of outline) {
                if (item.kind !== 'step') continue;
                const info = this.getStepInfo(item.stepIdx);
                if (!info) continue;
                const where = `Step ${item.stepIdx + 1} "${info.title || '(senza titolo)'}"`;
                if (info.legacy) {
                    push('info', where, 'Step in sintassi legacy: non verificato (modificabile dalla scheda Codice).', item.stepIdx);
                    continue;
                }
                if (!info.title) push('error', where, 'Titolo dello step mancante.', item.stepIdx);
                for (const fl of info.flags) {
                    if (FLAGS.indexOf(fl) === -1) {
                        push('warn', where, `Flag sconosciuto "${fl}" (validi: ${FLAGS.join(', ')}).`, item.stepIdx);
                    }
                }
                if (info.tool && TOOL_VALUES.indexOf(info.tool) === -1) {
                    push('error', where, `Tool "${info.tool}" non valido (validi: ${TOOL_VALUES.join(', ')}).`, item.stepIdx);
                }
                if (info.element && /\s/.test(info.element)) {
                    push('error', where, `Element "${info.element}" contiene spazi: controlla il nome (o la sintassi "repeat N").`, item.stepIdx);
                }
                for (const a of info.actions) {
                    if (!balanced(a)) {
                        push('error', where, `Azione "${a}": parentesi non bilanciate.`, item.stepIdx);
                        continue;
                    }
                    const verb = (a.split(/\s+/)[0] || '').toLowerCase();
                    const isSetState = a.indexOf('=') !== -1 && ACTION_VERBS.indexOf(verb) === -1;
                    if (!isSetState && ACTION_VERBS.indexOf(verb) === -1) {
                        push('error', where, `Azione "${a}": verbo "${verb}" sconosciuto (validi: ${ACTION_VERBS.join(', ')}, oppure "gruppo = variante").`, item.stepIdx);
                    }
                }
                if (info.actions.length > 0 && !info.element && !info.fields.drag) {
                    push('warn', where, 'Ci sono azioni ma nessun element: le animazioni non hanno un oggetto target.', item.stepIdx);
                }
                if (info.tool && !info.element) {
                    push('warn', where, 'È indicato un tool ma nessun element su cui usarlo.', item.stepIdx);
                }
                const f = info.fields;
                if (f.camera) {
                    if (!balanced(f.camera)) {
                        push('error', where, 'Camera: parentesi non bilanciate.', item.stepIdx);
                    } else {
                        const firstWord = (f.camera.split(/[\s(]/)[0] || '').toLowerCase();
                        if (firstWord && CAMERA_KEYS.indexOf(firstWord) === -1) {
                            push('warn', where, `Camera: chiave "${firstWord}" inattesa (attese: ${CAMERA_KEYS.join(', ')}).`, item.stepIdx);
                        }
                    }
                }
                if (f.drag && !balanced(f.drag)) {
                    push('error', where, 'Drag: parentesi non bilanciate.', item.stepIdx);
                }
                if (f.button != null) {
                    push('warn', where, '"button =" è deprecato: usa "element =".', item.stepIdx);
                }
                const hasContent = info.title && (f.description || info.element || info.actions.length ||
                    f.message || f.drag || f.hold || f.after || f.animation);
                if (info.title && !hasContent) {
                    push('warn', where, 'Step vuoto: nessuna descrizione, element, azione o messaggio.', item.stepIdx);
                }
            }
            return issues;
        }
    }

    V3Document.TOOL_VALUES = TOOL_VALUES;
    V3Document.SINGLE_FIELDS = SINGLE_FIELDS;
    window.V3Document = V3Document;
})();
