/**
 * AutoMode.js - Sistema di Esecuzione Automatica Tutorial per Dispositivi Mobili
 *
 * Funzionalità:
 * - Rilevamento automatico dispositivi mobili
 * - Attivazione tramite click su fumetto descrizione
 * - Auto-esecuzione azioni con tool (svita, avvita, traslazione, etc.)
 * - Auto-drag & drop con snap automatico in ordine casuale
 * - Avanzamento automatico step
 *
 * @version 1.0.0
 * @date Gennaio 2026
 */

(function() {
    'use strict';

    const AutoMode = {
        // Stato sistema
        enabled: false,
        isMobile: false,
        isExecuting: false,

        // Configurazione
        config: {
            actionDelay: 1500,        // Delay tra azioni automatiche (ms)
            dragDropDelay: 1000,      // Delay tra drag&drop multipli (ms)
            clickSimulationDelay: 500, // Delay prima di simulare click
            autoAdvanceDelay: 1000    // Delay prima di avanzare step successivo
        },

        /**
         * Inizializzazione sistema AutoMode
         */
        init: function() {
            console.log('[AutoMode] Inizializzazione sistema...');

            // Rileva se siamo su mobile
            this.isMobile = window.isMobileDevice ? window.isMobileDevice() : false;

            if (this.isMobile) {
                console.log('📱 [AutoMode] Dispositivo mobile rilevato - Sistema attivo');
                this.setupUI();

                // ATTIVA AUTOMATICAMENTE AutoMode su mobile e mostra notifica
                this.enabled = true;
                this.showToast('🤖 Modalità AutoMode Attiva', 'Modalità interattiva disponibile solo su desktop. Per avanzare di step, clicca sul fumetto azzurro di descrizione.', 6000);
                console.log('📱 [AutoMode] ATTIVATO AUTOMATICAMENTE su mobile');
            } else {
                console.log('💻 [AutoMode] Dispositivo desktop - AutoMode disabilitato');
            }
        },

        /**
         * Setup UI - Aggiunge pulsante toggle al fumetto descrizione
         */
        setupUI: function() {
            // Trova il fumetto descrizione
            const tutorialBubble = document.getElementById('tutorialBubble');
            if (!tutorialBubble) {
                console.warn('[AutoMode] Fumetto tutorial non trovato');
                return;
            }

            // Crea pulsante toggle AutoMode
            const toggleButton = document.createElement('button');
            toggleButton.id = 'autoModeToggle';
            toggleButton.className = 'auto-mode-toggle active'; // Attivo di default su mobile
            toggleButton.innerHTML = '🤖 AUTO ON';
            toggleButton.title = 'Modalità automatica sempre attiva su mobile';
            toggleButton.disabled = true; // Non cliccabile su mobile - sempre attivo
            toggleButton.style.cursor = 'default';
            toggleButton.style.opacity = '1';

            // Aggiungi al fumetto (in alto a destra)
            tutorialBubble.style.position = 'relative';
            tutorialBubble.appendChild(toggleButton);

            console.log('[AutoMode] UI configurata - Pulsante sempre attivo su mobile');
        },

        /**
         * Toggle AutoMode ON/OFF
         */
        toggle: function() {
            this.enabled = !this.enabled;

            const toggleButton = document.getElementById('autoModeToggle');
            if (toggleButton) {
                if (this.enabled) {
                    toggleButton.classList.add('active');
                    toggleButton.innerHTML = '🤖 AUTO ON';
                } else {
                    toggleButton.classList.remove('active');
                    toggleButton.innerHTML = '🤖 AUTO';
                }
            }

            console.log(`📱 [AutoMode] ${this.enabled ? 'ATTIVATO' : 'DISATTIVATO'}`);

            // Se attivato, esegui subito step corrente
            if (this.enabled && !this.isExecuting) {
                this.executeCurrentStep();
            }
        },

        /**
         * Esegue automaticamente lo step corrente
         */
        executeCurrentStep: function() {
            if (!this.enabled || this.isExecuting) return;

            this.isExecuting = true;
            console.log('[AutoMode] 🚀 Esecuzione automatica step corrente...');

            // Ottieni step corrente da UI
            if (!window.UI || !window.UI.getCurrentStep) {
                console.error('[AutoMode] UI non disponibile');
                this.isExecuting = false;
                return;
            }

            const currentStep = window.UI.getCurrentStep();
            if (!currentStep) {
                console.warn('[AutoMode] Nessuno step corrente');
                this.isExecuting = false;
                return;
            }

            console.log(`[AutoMode] Step corrente: "${currentStep.title}"`);

            // Determina tipo di step ed esegui
            this.analyzeAndExecuteStep(currentStep);
        },

        /**
         * Analizza lo step e determina come eseguirlo
         */
        analyzeAndExecuteStep: function(step) {
            const properties = step.properties || {};

            // Priority 1: Step con solo Message (modal informativo)
            if (properties.Message && !properties.Elemento && !properties.DragDrop) {
                console.log('[AutoMode] Step con solo messaggio - avanza dopo chiusura modal');
                // Il modal si chiuderà con click OK utente, poi avanza automaticamente
                this.isExecuting = false;
                return;
            }

            // Priority 2: Step con DragDrop
            if (properties.DragDrop === 'true') {
                console.log('[AutoMode] Step con Drag & Drop rilevato');
                this.autoExecuteDragDrop(step);
                return;
            }

            // Priority 3: Step con azioni tool (Elemento + Azione)
            if (properties.Elemento && (properties.Azione1 || properties.Azione2)) {
                console.log('[AutoMode] Step con azioni tool rilevato');
                this.autoExecuteToolActions(step);
                return;
            }

            // Priority 4: Step senza azioni particolari - avanza direttamente
            console.log('[AutoMode] Step semplice - avanzamento diretto');
            this.autoAdvanceStep();
        },

        /**
         * Auto-esecuzione azioni con tool (svita, avvita, traslazione, etc.)
         */
        autoExecuteToolActions: function(step) {
            const properties = step.properties || {};
            const elementName = properties.Elemento;

            console.log(`[AutoMode] 🔧 Auto-esecuzione azioni per: ${elementName}`);

            // Trova il modello nella scena 3D
            if (!window.Scene3D || !window.Scene3D.findModelByName) {
                console.error('[AutoMode] Scene3D non disponibile');
                this.isExecuting = false;
                return;
            }

            const cleanName = elementName.replace(/^models\//, '').replace(/\.(glb|gltf|obj|stl)$/i, '');
            const model = window.Scene3D.findModelByName(cleanName);

            if (!model) {
                console.warn(`[AutoMode] Modello "${cleanName}" non trovato`);
                this.autoAdvanceStep();
                return;
            }

            // Simula click sul modello per attivare le azioni
            setTimeout(() => {
                console.log('[AutoMode] 🖱️ Simulazione click su modello...');

                // Simula evento click sul canvas
                const canvas = document.getElementById('canvas');
                if (canvas && window.Scene3D.handleModelClick) {
                    // Crea evento click simulato
                    const boundingBox = new THREE.Box3().setFromObject(model);
                    const center = boundingBox.getCenter(new THREE.Vector3());

                    // Proietta posizione 3D su schermo 2D
                    const camera = window.Scene3D.camera;
                    const screenPosition = center.clone().project(camera);

                    const canvasRect = canvas.getBoundingClientRect();
                    const clientX = ((screenPosition.x + 1) / 2) * canvasRect.width + canvasRect.left;
                    const clientY = ((-screenPosition.y + 1) / 2) * canvasRect.height + canvasRect.top;

                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: clientX,
                        clientY: clientY
                    });

                    canvas.dispatchEvent(clickEvent);
                    console.log('[AutoMode] ✅ Click simulato con successo');

                    // Le animazioni partiranno automaticamente
                    // Attendi completamento e avanza
                    this.waitForAnimationsAndAdvance();
                } else {
                    console.error('[AutoMode] Canvas o handleModelClick non disponibili');
                    this.isExecuting = false;
                }
            }, this.config.clickSimulationDelay);
        },

        /**
         * Auto-esecuzione drag & drop con snap automatico
         */
        autoExecuteDragDrop: function(step) {
            const properties = step.properties || {};
            const dragDropObjectsRaw = properties.DragDropObjects || '';

            if (!dragDropObjectsRaw) {
                console.warn('[AutoMode] Nessun oggetto DragDrop specificato');
                this.autoAdvanceStep();
                return;
            }

            // Parse oggetti draggabili
            const objects = dragDropObjectsRaw.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0);

            if (objects.length === 0) {
                console.warn('[AutoMode] Lista oggetti DragDrop vuota');
                this.autoAdvanceStep();
                return;
            }

            console.log(`[AutoMode] 🎯 Auto-snap ${objects.length} oggetti: [${objects.join(', ')}]`);

            // Randomizza ordine oggetti
            const shuffledObjects = this.shuffleArray([...objects]);
            console.log(`[AutoMode] Ordine randomizzato: [${shuffledObjects.join(', ')}]`);

            // Snap ogni oggetto con delay sequenziale
            shuffledObjects.forEach((objectName, index) => {
                setTimeout(() => {
                    this.autoSnapObject(objectName, index, shuffledObjects.length);
                }, index * this.config.dragDropDelay);
            });
        },

        /**
         * Auto-snap singolo oggetto
         */
        autoSnapObject: function(objectName, index, total) {
            console.log(`[AutoMode] 🎯 Auto-snap oggetto ${index + 1}/${total}: "${objectName}"`);

            if (!window.DragDropSystem) {
                console.error('[AutoMode] DragDropSystem non disponibile');
                return;
            }

            // Verifica se DragDropSystem ha metodo autoSnap
            if (typeof window.DragDropSystem.autoSnapToClosestTarget === 'function') {
                window.DragDropSystem.autoSnapToClosestTarget(objectName);
            } else {
                console.warn('[AutoMode] DragDropSystem.autoSnapToClosestTarget non disponibile');
            }

            // Se è l'ultimo oggetto, attendi e avanza step
            if (index === total - 1) {
                setTimeout(() => {
                    console.log('[AutoMode] ✅ Tutti gli oggetti snappati');
                    this.autoAdvanceStep();
                }, this.config.autoAdvanceDelay);
            }
        },

        /**
         * Attende completamento animazioni e avanza step
         */
        waitForAnimationsAndAdvance: function() {
            // Controlla se ci sono animazioni attive
            const checkAnimations = () => {
                if (window.Scene3D && window.Scene3D.animationSystem) {
                    const activeAnimations = window.Scene3D.animationSystem.activeAnimations || [];
                    const multiStepAnimations = window.Scene3D.animationSystem.multiStepAnimations || new Map();

                    const hasActiveAnimations = activeAnimations.length > 0 || multiStepAnimations.size > 0;

                    if (hasActiveAnimations) {
                        console.log('[AutoMode] ⏳ Animazioni in corso, attendo...');
                        setTimeout(checkAnimations, 500);
                    } else {
                        console.log('[AutoMode] ✅ Animazioni completate');
                        this.autoAdvanceStep();
                    }
                } else {
                    // Fallback se non possiamo controllare animazioni
                    setTimeout(() => {
                        this.autoAdvanceStep();
                    }, this.config.actionDelay * 2);
                }
            };

            setTimeout(checkAnimations, this.config.actionDelay);
        },

        /**
         * Avanza automaticamente allo step successivo
         */
        autoAdvanceStep: function() {
            setTimeout(() => {
                console.log('[AutoMode] ⏭️ Avanzamento automatico step successivo...');

                if (window.UI && typeof window.UI.nextStep === 'function') {
                    window.UI.nextStep();
                    this.isExecuting = false;

                    // Se AutoMode ancora attivo, esegui prossimo step
                    if (this.enabled) {
                        setTimeout(() => {
                            this.executeCurrentStep();
                        }, this.config.autoAdvanceDelay);
                    }
                } else {
                    console.error('[AutoMode] UI.nextStep non disponibile');
                    this.isExecuting = false;
                }
            }, this.config.autoAdvanceDelay);
        },

        /**
         * Shuffle array (algoritmo Fisher-Yates)
         */
        shuffleArray: function(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        },

        /**
         * Ottiene step corrente (wrapper sicuro)
         */
        getCurrentStep: function() {
            if (window.UI && typeof window.UI.getCurrentStep === 'function') {
                return window.UI.getCurrentStep();
            }
            return null;
        },

        /**
         * Mostra notifica toast
         * @param {string} title - Titolo notifica
         * @param {string} message - Messaggio notifica (opzionale)
         * @param {number} duration - Durata in ms (default: 3000)
         * @param {string} type - Tipo: 'success', 'info', 'warning', 'error' (default: 'success')
         */
        showToast: function(title, message = '', duration = 3000, type = 'success') {
            // Rimuovi toast esistenti
            const existingToast = document.querySelector('.toast-notification');
            if (existingToast) {
                existingToast.remove();
            }

            // Crea elemento toast
            const toast = document.createElement('div');
            toast.className = `toast-notification ${type}`;

            // Contenuto
            let content = `<span class="toast-emoji">${this.getEmojiForType(type)}</span>`;
            content += `<div style="display: inline-block; vertical-align: middle;">`;
            content += `<div style="font-weight: 700;">${title}</div>`;
            if (message) {
                content += `<div style="font-size: 0.9em; opacity: 0.9; margin-top: 4px;">${message}</div>`;
            }
            content += `</div>`;

            toast.innerHTML = content;

            // Aggiungi al body
            document.body.appendChild(toast);

            // Trigger animazione show
            setTimeout(() => {
                toast.classList.add('show');
            }, 100);

            // Auto-hide dopo duration
            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide');

                // Rimuovi dal DOM dopo animazione
                setTimeout(() => {
                    toast.remove();
                }, 400);
            }, duration);

            console.log(`[AutoMode] Toast mostrato: ${title}`);
        },

        /**
         * Restituisce emoji in base al tipo di notifica
         */
        getEmojiForType: function(type) {
            const emojis = {
                'success': '✅',
                'info': 'ℹ️',
                'warning': '⚠️',
                'error': '❌'
            };
            return emojis[type] || '✅';
        },

        /**
         * Reset stato AutoMode
         */
        reset: function() {
            this.enabled = false;
            this.isExecuting = false;

            const toggleButton = document.getElementById('autoModeToggle');
            if (toggleButton) {
                toggleButton.classList.remove('active');
                toggleButton.innerHTML = '🤖 AUTO';
            }

            console.log('[AutoMode] Sistema resettato');
        }
    };

    // Esponi globalmente
    window.AutoMode = AutoMode;

    console.log('[AutoMode] Modulo caricato');
})();
