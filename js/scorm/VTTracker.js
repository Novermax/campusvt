/**
 * VTTracker — Virtual Training Tracker
 *
 * Traccia tempi, errori e punteggio di una sessione tutorial e li notifica
 * al frame contenitore (LMS/SCORM wrapper) via window.parent.postMessage.
 *
 * Oggetto globale: window.VTTracker. Caricato come script classico (non module)
 * in index.html dopo gli altri script. Gli hook sono chiamati dai file esistenti:
 *   - index.html              → onSessionInit()      ('vt:session_init')
 *   - js/ui.js selectTutorial → onTutorialStart()    ('vt:tutorial_start')
 *   - js/ui.js goToStep       → onStepChange()       ('vt:step_complete')
 *   - js/scene3d-modular.js    → onTutorialComplete() ('vt:tutorial_complete')
 *   - js/scene3d-modular.js    → onWrongAction()      ('vt:wrong_action')
 *
 * Una responsabilità = un file. Non dipende da altri moduli: legge lo stato da
 * window.UI / window.currentUser difensivamente (optional chaining + fallback).
 */
(function () {
    'use strict';

    const VTTracker = {
        // ───────────────────────────── Timer ─────────────────────────────
        _tutorialStart: 0,   // Date.now() all'avvio del tutorial
        _stepStart: 0,       // Date.now() all'inizio dello step corrente
        _pausedMs: 0,        // tempo totale in pausa (tab nascosta) nel tutorial
        _stepPausedMs: 0,    // tempo in pausa accumulato nello step corrente
        _pauseStart: 0,      // Date.now() di inizio pausa corrente
        _paused: false,
        _started: false,

        // ──────────────────────────── Stato interno ───────────────────────
        stepTimings: [],     // [{ stepIndex, stepTitle, durationMs, errors }]
        wrongActions: 0,     // contatore errori dello step corrente (reset a ogni step)
        tutorialId: null,
        userId: null,
        _currentStepIndex: -1,
        _currentStepTitle: null,

        /**
         * Avvia i timer del tutorial. _tutorialStart e _stepStart = adesso.
         */
        start: function () {
            const now = Date.now();
            this._tutorialStart = now;
            this._stepStart = now;
            this._pausedMs = 0;
            this._stepPausedMs = 0;
            this._pauseStart = 0;
            this._paused = false;
            this._started = true;
        },

        /**
         * Chiude lo step corrente: ritorna la durata (ms, al netto delle pause)
         * dallo _stepStart e riallinea _stepStart ad adesso.
         */
        stopStep: function () {
            const now = Date.now();
            let stepPaused = this._stepPausedMs;
            if (this._paused) stepPaused += (now - this._pauseStart);
            const durationMs = now - this._stepStart - stepPaused;
            this._stepStart = now;
            this._stepPausedMs = 0;
            return Math.max(0, durationMs);
        },

        /**
         * Ritorna il tempo totale (ms, al netto delle pause) dallo _tutorialStart.
         */
        stopTutorial: function () {
            const now = Date.now();
            let paused = this._pausedMs;
            if (this._paused) paused += (now - this._pauseStart);
            return Math.max(0, now - this._tutorialStart - paused);
        },

        // ──────────────────── Pausa su visibilitychange ───────────────────
        _onHidden: function () {
            if (this._paused || !this._started) return;
            this._paused = true;
            this._pauseStart = Date.now();
        },

        _onVisible: function () {
            if (!this._paused) return;
            const delta = Date.now() - this._pauseStart;
            this._pausedMs += delta;
            this._stepPausedMs += delta;
            this._paused = false;
            this._pauseStart = 0;
        },

        // ─────────────────────────────── Emit ─────────────────────────────
        /**
         * Emette un messaggio verso il frame contenitore con schema base
         * { type, ts, userId, tutorialId, ...extraPayload }.
         */
        emit: function (type, extraPayload) {
            const payload = Object.assign({
                type: type,
                ts: Date.now(),
                userId: this.userId,
                tutorialId: this.tutorialId
            }, extraPayload || {});
            try {
                window.parent.postMessage(payload, '*');
            } catch (e) {
                console.warn('[VTTracker] postMessage fallito:', e);
            }
            return payload;
        },

        // ────────────────────────────── Score ─────────────────────────────
        _totalErrors: function () {
            let sum = 0;
            for (let i = 0; i < this.stepTimings.length; i++) {
                sum += (this.stepTimings[i].errors || 0);
            }
            return sum;
        },

        /**
         * Punteggio: 100 - (totalErrors * 5) - floor(totalMs / 60000), clampato 0..100.
         * Se totalMs non è passato, usa il tempo corrente del tutorial.
         */
        score: function (totalMs) {
            if (typeof totalMs !== 'number') totalMs = this.stopTutorial();
            const s = 100 - (this._totalErrors() * 5) - Math.floor(totalMs / 60000);
            return Math.max(0, Math.min(100, s));
        },

        // ─────────────────────────────── Hook ─────────────────────────────
        /**
         * Login completato: window.currentUser disponibile.
         */
        onSessionInit: function () {
            const u = window.currentUser || {};
            this.userId = u.name || null;
            this.emit('vt:session_init', {
                userId: this.userId,
                userName: u.name || null,
                role: u.role || null
            });
        },

        /**
         * Inizio di un tutorial: window.UI.currentTutorial impostato.
         */
        onTutorialStart: function () {
            
            const newId = (window.UI && window.UI.currentTutorial && window.UI.currentTutorial.name) || null;
            if (this._started && this.tutorialId === newId) return;
            this._started = true;
            
            const t = (window.UI && window.UI.currentTutorial) || null;
            this.tutorialId = (t && t.name) || null;
            if (!this.userId) {
                this.userId = (window.currentUser && window.currentUser.name) || null;
            }

            // Reset stato sessione tutorial
            this.stepTimings = [];
            this.wrongActions = 0;
            this._currentStepIndex = 0;
            this._currentStepTitle = null;

            const stepCount = (t && t.steps && t.steps.length) || 0;
            this.start();

            this.emit('vt:tutorial_start', {
                tutorialId: this.tutorialId,
                tutorialName: this.tutorialId,
                stepCount: stepCount
            });
        },

        /**
         * Cambio step (inizio di UI.goToStep, PRIMA che currentStepIndex sia aggiornato).
         * Emette 'vt:step_complete' per lo step PRECEDENTE, poi resetta contatore
         * errori e timer dello step.
         * @param {number} newIndex            indice dello step di destinazione
         * @param {string} completedStepTitle  titolo dello step che si sta lasciando
         *                                      (UI.getCurrentStep()?.title pre-update)
         */
        onStepChange: function (newIndex, completedStepTitle) {
            if (this._started && this._currentStepIndex >= 0) {
                const durationMs = this.stopStep();
                const prevIndex = this._currentStepIndex;
                const prevTitle = (completedStepTitle != null) ? completedStepTitle : this._currentStepTitle;
                const errors = this.wrongActions;

                this.stepTimings.push({
                    stepIndex: prevIndex,
                    stepTitle: prevTitle,
                    durationMs: durationMs,
                    errors: errors
                });
                this.emit('vt:step_complete', {
                    stepIndex: prevIndex,
                    stepTitle: prevTitle,
                    durationMs: durationMs,
                    errors: errors
                });
            } else {
                // Primo step / tracker non avviato: allinea solo il timer dello step.
                this._stepStart = Date.now();
                this._stepPausedMs = 0;
            }

            // Reset contatore errori per il nuovo step
            this.wrongActions = 0;
            this._currentStepIndex = newIndex;
            this._currentStepTitle = (completedStepTitle != null) ? null : this._currentStepTitle;
        },

        /**
         * Tutorial completato: chiude lo step corrente, calcola score e tempo totale.
         */
        onTutorialComplete: function () {
            if (this._started && this._currentStepIndex >= 0) {
                const durationMs = this.stopStep();
                const liveStep = (window.UI && typeof window.UI.getCurrentStep === 'function')
                    ? window.UI.getCurrentStep() : null;
                const title = (liveStep && liveStep.title) || this._currentStepTitle;
                this.stepTimings.push({
                    stepIndex: this._currentStepIndex,
                    stepTitle: title,
                    durationMs: durationMs,
                    errors: this.wrongActions
                });
                this.wrongActions = 0;
            }

            const totalTimeMs = this.stopTutorial();
            const scoreValue = this.score(totalTimeMs);

            this.emit('vt:tutorial_complete', {
                totalTimeMs: totalTimeMs,
                score: scoreValue,
                stepTimings: this.stepTimings.slice()
            });

            this._started = false;
        },

        /**
         * Azione errata dell'utente (oggetto o tool sbagliato).
         * @param {string} errorType  es. 'wrong_element' | 'wrong_tool'
         */
        onWrongAction: function (errorType) {
            this.wrongActions++;
            const stepIndex = (window.UI && typeof window.UI.currentStepIndex === 'number')
                ? window.UI.currentStepIndex : this._currentStepIndex;
            this.emit('vt:wrong_action', {
                stepIndex: stepIndex,
                errorType: errorType || null
            });
        }
    };

    // Pausa/ripresa automatica quando la tab viene nascosta/mostrata.
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) VTTracker._onHidden();
            else VTTracker._onVisible();
        });
    }

    window.VTTracker = VTTracker;
})();
