/**
 * CVTScriptV3.js - Pre-processor CVTScript v3 → v2
 *
 * Converte un file `.cvtscript` v3 (sintassi inglese pulita, header
 * quotati, `do :` auto-numerato, vocabolario tool chiuso, prosa per i
 * comandi di movimento) in testo v2 che il parser esistente in
 * `js/ui.js` (parseTutorialContent) sa gestire.
 *
 * Strato sottile, idempotente: testo v1/v2 nativo passa attraverso
 * inalterato. Tutte le proprietà non riconosciute come v3 sono
 * pass-through.
 *
 * --------------------------------------------------------------------
 *  KEYWORD UNIFICATA `element` (v3.1)
 * --------------------------------------------------------------------
 *  In v3.1 la keyword `button` è stata assorbita da `element`.
 *  L'utente clicca SEMPRE sull'`element`. Il pre-processore decide
 *  automaticamente se l'element è un semplice target animato o anche
 *  un trigger fisico, in base al contesto dello step:
 *
 *    | tool? | do?   | after?  | flag auto/machine | comportamento                       |
 *    |-------|-------|---------|--------------------|--------------------------------------|
 *    |  sì   |  -    |   -     |  -                 | flusso tool (click con tool)        |
 *    |  no   |  no   |  no     |  no                | click element → step avanza         |
 *    |  no   |  no   |  sì     |  no                | click element → state change + avanza|
 *    |  no   |  sì   |  -      |  no                | click element → animazione → avanza |
 *    |  -    |  -    |   -     |  sì                | step automatico, niente trigger     |
 *
 *  La forma `element = X repeat N` aggiunge `AnimatedMaxTriggers=N`.
 *  La keyword `button = ...` è mantenuta come alias deprecato e si
 *  comporta come `element = ...` con stesso suffisso.
 */
(function () {
    'use strict';

    const TOOL_V3_TO_V2 = {
        'hand': 'Mani',
        'hex_key': 'ChiaveBrugola',
        'wrench': 'ChiaveInglese',
        'air': 'Aria',
        'spray': 'Spray'
    };

    const KEY_V3_TO_V2 = {
        'tool': 'Tool',
        'description': 'Description',
        'message': 'Message',
        'title': 'MessageTitle',
        'video': 'MessageVideo',
        'image': 'MessageImage',
        'sound': 'OnAnyTrigger',
        'view': 'DefaultView',
        'auto': 'Auto',
        'machine': 'Machine',
        'position': 'Posizione',
        'rotation': 'Rotazione'
    };

    const V3_BLOCK_TYPES = new Set([
        'scene', 'section', 'step',
        'state', 'object',
        'hotspot', 'screen', 'screenview', 'screenaction', 'action'
    ]);

    // Flag che marcano lo step come "automatico" (niente click).
    const AUTO_FLAGS = new Set(['auto', 'machine']);

    function cleanCoords(s) {
        return s.split(',').map(c => c.trim()).join(',');
    }

    function splitTopLevel(s, sep) {
        const out = [];
        let depth = 0, cur = '';
        for (const ch of s) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (ch === sep && depth === 0) { out.push(cur); cur = ''; }
            else cur += ch;
        }
        if (cur) out.push(cur);
        return out;
    }

    /**
     * Tenta di interpretare il contenuto interno di un block header.
     * Ritorna { type, name, flags } se v3 valido, altrimenti null.
     */
    function parseHeader(inner) {
        if (!inner) return null;
        const firstSpace = inner.indexOf(' ');
        const first = (firstSpace === -1 ? inner : inner.substring(0, firstSpace)).toLowerCase();
        if (!V3_BLOCK_TYPES.has(first)) return null;

        if (firstSpace === -1) return { type: first, name: null, flags: [] };

        let rest = inner.substring(firstSpace + 1).trim();
        let name = null, flags = [];

        if (rest.startsWith('"')) {
            const end = rest.indexOf('"', 1);
            if (end === -1) return null;
            name = rest.substring(1, end);
            rest = rest.substring(end + 1).trim();
        } else {
            const ns = rest.indexOf(' ');
            if (ns === -1) { name = rest; rest = ''; }
            else { name = rest.substring(0, ns); rest = rest.substring(ns + 1).trim(); }
        }

        if (rest) flags = rest.split(/[\s,]+/).map(f => f.trim()).filter(Boolean);
        return { type: first, name, flags };
    }

    /**
     * Traduce header v3 in inner-section v2.
     * Ritorna null per `[scene]` (riga da scartare; le proprietà
     * pre-tutorial sono già raccolte come globali dal parser).
     */
    function headerToV2(v3) {
        switch (v3.type) {
            case 'scene':       return null;
            case 'section':     return `Section - ${v3.name || ''}`;
            case 'step': {
                const flags = v3.flags.length ? ` | ${v3.flags.join(', ')}` : '';
                return `Step - ${v3.name || ''}${flags}`;
            }
            case 'state':         return `StateGroup:${v3.name || ''}`;
            case 'object':        return `InteractiveObject:${v3.name || ''}`;
            case 'hotspot':       return `Hotspot:${v3.name || ''}`;
            case 'screen':        return `Screen:${v3.name || ''}`;
            case 'screenview':    return `ScreenView:${v3.name || ''}`;
            case 'screenaction':
            case 'action':        return `ScreenAction:${v3.name || ''}`;
            default:              return null;
        }
    }

    /**
     * Traduce un valore di azione v3 (es. "move by (x,y,z) duration t")
     * in stringa v2 che _v2NormalizeActionValue / MovementParser sa parsare.
     */
    function normalizeProseAction(value) {
        const v = value.trim();
        let m;

        if ((m = v.match(/^unscrew(?:\s+distance\s+([\d.]+))?$/i)))
            return m[1] ? `unscrew(${m[1]})` : 'unscrew';
        if ((m = v.match(/^screw(?:\s+distance\s+([\d.]+))?$/i)))
            return m[1] ? `screw(${m[1]})` : 'screw';
        if ((m = v.match(/^extract(?:\s+distance\s+([\d.]+))?$/i)))
            return m[1] ? `extract(${m[1]})` : 'extract';
        if ((m = v.match(/^insert(?:\s+distance\s+([\d.]+))?$/i)))
            return m[1] ? `insert(${m[1]})` : 'insert';
        if ((m = v.match(/^place(?:\s+duration\s+([\d.]+))?$/i)))
            return m[1] ? `place(${m[1]})` : 'place(0.5)';

        if ((m = v.match(/^move\s+by\s+\(([^)]+)\)\s+duration\s+([\d.]+)$/i)))
            return `translate:(${cleanCoords(m[1])},${m[2]})`;
        if ((m = v.match(/^move\s+from\s+(\S+)\s+by\s+\(([^)]+)\)\s+duration\s+([\d.]+)$/i)))
            return `translate_from:${m[1]}(${cleanCoords(m[2])},${m[3]})`;
        if ((m = v.match(/^rotate\s+by\s+\(([^)]+)\)\s+duration\s+([\d.]+)$/i)))
            return `rotate:(${cleanCoords(m[1])},${m[2]})`;
        if ((m = v.match(/^rotate\s+around\s+\(([^)]+)\)\s+by\s+\(([^)]+)\)\s+duration\s+([\d.]+)$/i)))
            return `rotate_around:(${cleanCoords(m[1])}),(${cleanCoords(m[2])},${m[3]})`;

        if ((m = v.match(/^pump\s+along\s+([xyz])\s+amplitude\s+([\d.]+)\s+cycles\s+(\d+)\s+duration\s+([\d.]+)\s+from\s+(\S+)$/i)))
            return `pump:${m[5]}(axis=${m[1]}, amplitude=${m[2]}, cycles=${m[3]}, duration=${m[4]})`;
        if ((m = v.match(/^pump\s+from\s+(\S+)\s+between\s+\(([^)]+)\)\s+and\s+\(([^)]+)\)\s+cycles\s+(\d+)\s+duration\s+([\d.]+)$/i)))
            return `pump:${m[1]}(from=(${cleanCoords(m[2])}), to=(${cleanCoords(m[3])}), cycles=${m[4]}, duration=${m[5]})`;

        if (/^idle\s+reset$/i.test(v)) return 'resetCenteredOriginal';

        return v; // pass-through (assume già v2 / verb compatto)
    }

    /**
     * Espande `camera = position (...), target (...), zoom Z, fade T, ...`
     * in più righe `CameraPos=...`, `CameraTarget=...`, `CameraZoom=...`, `CameraTransitionTime=...`.
     */
    function expandCameraLine(value) {
        const out = [];
        for (const raw of splitTopLevel(value, ',')) {
            const c = raw.trim();
            let m;
            if ((m = c.match(/^position\s+\(([^)]+)\)$/i)))
                out.push(`CameraPos=(${cleanCoords(m[1])})`);
            else if ((m = c.match(/^target\s+\(([^)]+)\)$/i)))
                out.push(`CameraTarget=(${cleanCoords(m[1])})`);
            else if ((m = c.match(/^target\s+(\S+)$/i)))
                out.push(`CameraTarget=${m[1]}`);
            else if ((m = c.match(/^pivot\s+\(([^)]+)\)$/i)))
                out.push(`CameraPivot=(${cleanCoords(m[1])})`);
            else if ((m = c.match(/^rotation\s+\(([^)]+)\)$/i)))
                out.push(`CameraRotation=(${cleanCoords(m[1])})`);
            else if ((m = c.match(/^distance\s+([\d.]+)$/i)))
                out.push(`CameraDistance=${m[1]}`);
            else if ((m = c.match(/^zoom\s+([\d.]+)$/i)))
                out.push(`CameraZoom=${m[1]}`);
            else if ((m = c.match(/^fov\s+([\d.]+)$/i)))
                out.push(`CameraFOV=${m[1]}`);
            else if ((m = c.match(/^fade\s+([\d.]+)s?$/i)))
                out.push(`CameraTransitionTime=${m[1]}`);
            else if ((m = c.match(/^free\s+within\s+\(([^)]+)\)$/i))) {
                out.push(`CameraUnlocked=true`);
                out.push(`CameraLimits=(${cleanCoords(m[1])})`);
            }
        }
        return out;
    }

    /**
     * Espande la riga `hold = ...` nelle forme:
     *   - `pick at (...) facing (...)`        ← forma corrente: l'oggetto viene da `element = ...`
     *   - `pick obj at (...) facing (...)`    ← forma legacy: oggetto inline (emette Element)
     *   - `held`                              ← forma corrente: oggetto da `element = ...`
     *   - `held obj`                          ← forma legacy
     *   - `release`
     */
    function expandHoldLine(value) {
        const out = [];
        const v = value.trim();
        let m;
        if ((m = v.match(/^pick(?:\s+(?!at\b|facing\b)(\S+))?(?:\s+at\s+\(([^)]+)\))?(?:\s+facing\s+\(([^)]+)\))?$/i))) {
            out.push('HoldAction=pick');
            out.push('Holdable=true');
            if (m[1]) out.push(`Element=${m[1]}`);
            if (m[2]) out.push(`HoldPosition=(${cleanCoords(m[2])})`);
            if (m[3]) out.push(`HoldRotation=(${cleanCoords(m[3])})`);
        } else if (/^held$/i.test(v)) {
            out.push('HoldState=held');
        } else if ((m = v.match(/^held\s+(\S+)$/i))) {
            out.push('HoldState=held');
            out.push(`Element=${m[1]}`);
        } else if (/^release$/i.test(v)) {
            out.push('HoldAction=release');
        }
        return out;
    }

    /**
     * Espande `drag = obj1, obj2 distance D snap offset (...) snap targets a, b ...`
     * in righe DragDrop / DragDropObjects / DragDropDistance / SnapPoint / SnapTargets.
     */
    function expandDragLine(value) {
        const out = ['DragDrop=true'];
        let v = value.trim();

        const distSplit = v.match(/^(.+?)\s+distance\s+([\d.]+)(?:\s+(.*))?$/i);
        let dragObjects, distance = null, snapPart = null;

        if (distSplit) {
            dragObjects = distSplit[1].trim();
            distance = distSplit[2];
            snapPart = (distSplit[3] || '').trim();
        } else {
            const snapSplit = v.match(/^(.+?)\s+snap\s+(.*)$/i);
            if (snapSplit) {
                dragObjects = snapSplit[1].trim();
                snapPart = 'snap ' + snapSplit[2].trim();
            } else {
                dragObjects = v;
            }
        }

        out.push(`DragDropObjects=${dragObjects}`);
        if (distance) out.push(`DragDropDistance=${distance}`);

        if (snapPart) {
            const snapClauses = snapPart.split(/(?:^|\s+)snap\s+/i).map(s => s.trim()).filter(Boolean);
            for (const sc of snapClauses) {
                let m;
                if ((m = sc.match(/^offset\s+\(([^)]+)\)$/i)))
                    out.push(`SnapPoint=offset:(${cleanCoords(m[1])})`);
                else if ((m = sc.match(/^pivot\s+\(([^)]+)\)$/i)))
                    out.push(`SnapPoint=pivot:(${cleanCoords(m[1])})`);
                else if ((m = sc.match(/^targets\s+(.+)$/i)))
                    out.push(`SnapTargets=${m[1].trim()}`);
                else if ((m = sc.match(/^\(([^)]+)\)$/)))
                    out.push(`SnapPoint=(${cleanCoords(m[1])})`);
            }
        }

        return out;
    }

    /**
     * Parse del valore di `element = X [repeat N]` o `button = X [wait|repeat N]`.
     * Ritorna { ref, repeatN, waitFlag } dove:
     *   - ref      = identificativo (es. "a500.porta" o "vite_coperchio_1")
     *   - repeatN  = numero ripetizioni (string) se presente `repeat N`, altrimenti null
     *   - waitFlag = true se è presente il flag `wait` (legacy button)
     */
    function parseTriggerValue(value) {
        let v = value.trim();
        let repeatN = null;
        let waitFlag = false;

        let m;
        if ((m = v.match(/^(.+?)\s+repeat\s+(\d+)$/i))) {
            return { ref: m[1].trim(), repeatN: m[2], waitFlag: false };
        }
        if ((m = v.match(/^(.+?)\s+wait$/i))) {
            return { ref: m[1].trim(), repeatN: null, waitFlag: true };
        }
        return { ref: v, repeatN: null, waitFlag: false };
    }

    function meshNameFromRef(ref) {
        const dotIdx = ref.indexOf('.');
        return dotIdx !== -1 ? ref.substring(dotIdx + 1) : ref;
    }

    /**
     * Espande `animation = folder NAME at (X%, Y%) frame Tms`.
     * Ogni clausola è opzionale e indipendente dall'ordine.
     */
    function expandAnimationLine(value) {
        const out = [];
        const v = value.trim();
        let m;

        if ((m = v.match(/folder\s+(\S+)/i)))
            out.push(`AnimatedImagesFolder=${m[1]}`);
        if ((m = v.match(/at\s+\(([^)]+)\)/i)))
            out.push(`AnimatedPosition=(${cleanCoords(m[1])})`);
        if ((m = v.match(/frame\s+(\d+)\s*ms?/i)))
            out.push(`AnimatedFrameDelay=${m[1]}`);

        return out;
    }

    /**
     * Traduce un singolo `companion = X follows master` o
     * `companion = X moves by (...) duration t` nel segmento atteso da
     * DrivenObjects= (verrà unito con `;` da pipeline).
     */
    function companionToSegment(value) {
        const v = value.trim();
        let m;
        if ((m = v.match(/^(\S+)\s+follows\s+master$/i)))
            return `${m[1]}.glb,follow`;
        if ((m = v.match(/^(\S+)\s+moves\s+by\s+\(([^)]+)\)\s+duration\s+([\d.]+)$/i)))
            return `${m[1]}.glb,traslazione:(${cleanCoords(m[2])},${m[3]})`;
        return v;
    }

    /**
     * Pipeline principale: testo v3 → testo v2.
     * Stateful per:
     *   - auto-numerare le righe `do : ...` come Action1, Action2, ...
     *   - unire `companion = ...` multipli in un solo `DrivenObjects=` per step
     *   - decidere a fine step se l'`element` è anche un trigger fisico
     *     (in base alla presenza di `tool`, `do`, `after`, flag auto/machine)
     */
    function preprocess(content) {
        const lines = content.split('\n');
        const out = [];
        let actionCounter = 0;
        let pendingCompanions = [];
        let pendingAfter = null;
        let v3Detected = false;

        // Stato per-step (resettato a ogni nuovo block header)
        let stepFlags = [];
        let stepIsAuto = false;
        let stepHasTool = false;
        let stepDoCount = 0;
        let stepElementRef = null;       // ref dell'element come trigger candidato
        let stepElementRepeat = null;    // N di repeat se presente
        let stepLegacyButton = null;     // { ref, repeatN, waitFlag } se è stato usato `button =`

        const flushCompanions = () => {
            if (pendingCompanions.length) {
                out.push(`DrivenObjects=${pendingCompanions.join(';')}`);
                pendingCompanions = [];
            }
        };

        /**
         * A fine step, decide se emettere righe di trigger fisico per l'element
         * (o per il button legacy). Emette anche pendingAfter nel formato corretto.
         */
        const flushStepTriggers = () => {
            // Determina chi è il trigger candidato e con quali flag.
            // `button = X` legacy ha precedenza su `element = X` per la decisione
            // del trigger (mantiene il vecchio comportamento se l'utente l'ha scritto).
            let triggerRef = null;
            let triggerRepeat = null;
            let triggerWait = false;
            let triggerSource = null; // 'button' | 'element' | null

            if (stepLegacyButton) {
                triggerRef = stepLegacyButton.ref;
                triggerRepeat = stepLegacyButton.repeatN;
                triggerWait = stepLegacyButton.waitFlag;
                triggerSource = 'button';
            } else if (stepElementRef && !stepIsAuto && !(stepHasTool && stepDoCount > 0)) {
                // Element diventa trigger fisico se NON è in flusso tool puro
                // (tool + do: l'utente clicca con il tool, niente trigger esplicito)
                // e NON è uno step automatico.
                triggerRef = stepElementRef;
                triggerRepeat = stepElementRepeat;
                // `wait` implicito quando c'è `do :` (l'animazione gestisce l'avanzamento)
                // oppure c'è `repeat N` (avanzamento via AnimatedMaxTriggers).
                triggerWait = (stepDoCount > 0) || (triggerRepeat !== null);
                triggerSource = 'element';
            }

            if (triggerRef !== null) {
                const meshName = meshNameFromRef(triggerRef);

                if (triggerRepeat !== null) {
                    // Forma esplicita ActiveButtons + AcceptTrigger_Physical + AnimatedMaxTriggers.
                    // L'avanzamento è gestito dal contatore di trigger (AnimatedMaxTriggers).
                    out.push(`ActiveButtons=${meshName}`);
                    out.push(`AcceptTrigger_Physical=${triggerRef}`);
                    out.push(`AnimatedMaxTriggers=${triggerRepeat}`);
                    if (pendingAfter !== null) {
                        out.push(`OnPhysicalTrigger=setVariant:${pendingAfter}`);
                    }
                } else if (triggerWait) {
                    // Forma esplicita: nessun auto-advance.
                    // - `do :` presente → l'animazione gestisce l'avanzamento.
                    // - solo state changes → l'utente deve cliccare → freccia avanti
                    //   (comportamento originale di `button = X wait`).
                    out.push(`ActiveButtons=${meshName}`);
                    out.push(`AcceptTrigger_Physical=${triggerRef}`);
                    if (pendingAfter !== null) {
                        out.push(`OnPhysicalTrigger=setVariant:${pendingAfter}`);
                    }
                } else {
                    // Forma compatta: il parser v2 espande Button=X in
                    // ActiveButtons + AcceptTrigger_Physical + AutoAdvance.
                    out.push(`Button=${triggerRef}`);
                    if (pendingAfter !== null) {
                        out.push(`AfterClick=${pendingAfter}`);
                    }
                }
                pendingAfter = null;
                return;
            }

            // Nessun trigger fisico: pendingAfter diventa AutoSetVariant
            // (comportamento per step puramente automatici).
            if (pendingAfter !== null) {
                out.push(`AutoSetVariant=${pendingAfter}`);
                pendingAfter = null;
            }
        };

        const flushStep = () => {
            flushCompanions();
            flushStepTriggers();
        };

        const resetStepState = () => {
            stepFlags = [];
            stepIsAuto = false;
            stepHasTool = false;
            stepDoCount = 0;
            stepElementRef = null;
            stepElementRepeat = null;
            stepLegacyButton = null;
        };

        for (let raw of lines) {
            const trimmed = raw.trim();

            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
                out.push(raw);
                continue;
            }

            // ── Block headers ────────────────────────────
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                flushStep();
                resetStepState();
                const v3 = parseHeader(trimmed.slice(1, -1).trim());
                if (v3) {
                    v3Detected = true;
                    if (v3.type === 'step') {
                        actionCounter = 0;
                        stepFlags = v3.flags.slice();
                        stepIsAuto = stepFlags.some(f => AUTO_FLAGS.has(f.toLowerCase()));
                    }
                    const v2 = headerToV2(v3);
                    if (v2 === null) continue; // [scene] → drop
                    out.push('[' + v2 + ']');
                    continue;
                }
                out.push(raw); // header non v3, pass-through
                continue;
            }

            // ── key = value ──────────────────────────────
            // v3: `do : value` — separatore speciale (colon, non equals).
            const doMatch = trimmed.match(/^do\s*:\s*(.+)$/);
            if (doMatch) {
                v3Detected = true;
                const doValue = doMatch[1].trim();

                // `do : key = val [; key2 = val2]` → set di stato DIRETTO (nessun trigger).
                // Forma corretta per cambi di stato a inizio sezione o in step automatici,
                // dove `after :` sarebbe semanticamente errato (nessun evento a cui agganciarsi).
                // Emette AutoSetVariant in place: a livello sezione diventa proprietà del
                // tutorial (applicata alla selezione), a livello step proprietà dello step.
                if (/^[\w.]+\s*=\s*[\w.]+(\s*;\s*[\w.]+\s*=\s*[\w.]+)*$/.test(doValue)) {
                    const assigns = doValue.split(';')
                        .map(p => p.trim().replace(/^state\./i, '').replace(/\s*=\s*/, '='))
                        .filter(Boolean)
                        .join(';');
                    out.push(`AutoSetVariant=${assigns}`);
                    continue;
                }

                actionCounter++;
                stepDoCount++;
                out.push(`Action${actionCounter}=${normalizeProseAction(doValue)}`);
                continue;
            }

            // v3: `after : key = val; key2 = val2` — separatore colon, valore con `=`.
            // Differito: l'emissione finale (AfterClick / OnPhysicalTrigger / AutoSetVariant)
            // è decisa da flushStepTriggers in base al tipo di trigger.
            const afterMatch = trimmed.match(/^after\s*:\s*(.+)$/);
            if (afterMatch) {
                v3Detected = true;
                pendingAfter = afterMatch[1].split(';')
                    .map(p => p.trim().replace(/^state\./i, '').replace(/\s*=\s*/, '='))
                    .filter(Boolean)
                    .join(';');
                continue;
            }

            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) { out.push(raw); continue; }

            const rawKey = trimmed.substring(0, eqIdx).trim();
            const value = trimmed.substring(eqIdx + 1).trim();
            const isLowercase = rawKey === rawKey.toLowerCase();

            // Solo le chiavi totalmente lowercase sono v3.
            // (TitleCase = v1/v2 native, pass-through.)
            if (!isLowercase) { out.push(raw); continue; }

            // ── element = X [repeat N] ──────────────────
            // Emette subito Element=X (le successive Action devono trovarlo già impostato).
            // Salva ref + repeatN per la decisione di trigger a fine step.
            if (rawKey === 'element') {
                v3Detected = true;
                const parsed = parseTriggerValue(value);
                stepElementRef = parsed.ref;
                stepElementRepeat = parsed.repeatN;
                out.push(`Element=${parsed.ref}`);
                continue;
            }

            // ── button = X [wait|repeat N] (alias deprecato) ─────
            // Mantiene esattamente il comportamento storico: si comporta come
            // `element = X` ma con il flag `wait`/`repeat` esplicito. NON imposta
            // `Element=` (lo step può avere un element diverso); registra solo
            // il trigger e annota la presenza per flushStepTriggers.
            if (rawKey === 'button') {
                v3Detected = true;
                stepLegacyButton = parseTriggerValue(value);
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn(`[CVTScript v3] 'button =' è deprecato — usa 'element =' (riga: ${trimmed})`);
                }
                continue;
            }

            // Sentinel v3 keys
            if (rawKey === 'tool') {
                v3Detected = true;
                stepHasTool = true;
                const lower = value.toLowerCase();
                out.push(`Tool=${TOOL_V3_TO_V2[lower] || value}`);
                continue;
            }
            if (rawKey === 'camera') {
                v3Detected = true;
                for (const e of expandCameraLine(value)) out.push(e);
                continue;
            }
            if (rawKey === 'hold') {
                v3Detected = true;
                for (const e of expandHoldLine(value)) out.push(e);
                continue;
            }
            if (rawKey === 'drag') {
                v3Detected = true;
                for (const e of expandDragLine(value)) out.push(e);
                continue;
            }
            if (rawKey === 'snap') {
                v3Detected = true;
                let m;
                if ((m = value.match(/^offset\s+\(([^)]+)\)$/i)))
                    out.push(`SnapPoint=offset:(${cleanCoords(m[1])})`);
                else if ((m = value.match(/^pivot\s+\(([^)]+)\)$/i)))
                    out.push(`SnapPoint=pivot:(${cleanCoords(m[1])})`);
                else if ((m = value.match(/^targets\s+(.+)$/i)))
                    out.push(`SnapTargets=${m[1].trim()}`);
                else
                    out.push(`SnapPoint=${value}`);
                continue;
            }
            if (rawKey === 'companion') {
                v3Detected = true;
                pendingCompanions.push(companionToSegment(value));
                continue;
            }
            if (rawKey === 'animation') {
                v3Detected = true;
                for (const e of expandAnimationLine(value)) out.push(e);
                continue;
            }

            // position = name at (x,y,z)  → Posizione=name:(x,y,z)
            // rotation = name by (rx,ry,rz) → Rotazione=name:(rx,ry,rz)
            if (rawKey === 'position' || rawKey === 'rotation') {
                v3Detected = true;
                const targetKey = rawKey === 'position' ? 'Posizione' : 'Rotazione';
                const prep = rawKey === 'position' ? 'at' : 'by';
                const reAt = new RegExp(`^(\\S+)\\s+${prep}\\s+\\(([^)]+)\\)$`, 'i');
                const m = value.match(reAt);
                if (m) {
                    out.push(`${targetKey}=${m[1]}:(${cleanCoords(m[2])})`);
                } else {
                    // Fallback: passa il valore così com'è (può essere già in formato v2 `name:(x,y,z)`)
                    out.push(`${targetKey}=${value}`);
                }
                continue;
            }

            // Default: rinomina key se è in mappa
            const v2Key = KEY_V3_TO_V2[rawKey];
            if (v2Key) {
                v3Detected = true;
                out.push(`${v2Key}=${value}`);
                continue;
            }

            // Lowercase non riconosciuto: pass-through letterale
            out.push(raw);
        }

        flushStep();

        if (v3Detected && typeof console !== 'undefined') {
            console.log('[CVTScript v3] Pre-processing applicato (v3 syntax rilevata)');
        }

        return out.join('\n');
    }

    window.CVTScriptV3 = {
        preprocess: preprocess,
        // Esposti per test/debug:
        _parseHeader: parseHeader,
        _headerToV2: headerToV2,
        _normalizeProseAction: normalizeProseAction,
        _expandCameraLine: expandCameraLine,
        _expandHoldLine: expandHoldLine,
        _expandDragLine: expandDragLine,
        _parseTriggerValue: parseTriggerValue,
        _expandAnimationLine: expandAnimationLine,
        _companionToSegment: companionToSegment
    };

    console.log('[CVTScriptV3] ✅ Modulo caricato — pre-processore v3→v2 disponibile su window.CVTScriptV3');
})();
