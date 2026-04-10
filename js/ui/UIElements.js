/**
 * UIElements.js - Elementi UI (fumetto, modal, progress bar, status)
 * Mixin: aggiunge metodi a window.UI
 */
(function() {
    const UI = window.UI;

    /* ===== FEEDBACK UTENTE ===== */

    /**
     * Aggiorna il messaggio di stato
     */
    UI.updateStatus = function(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
        AppConfig.log(3, `Status: ${message}`);
    };

    /**
     * Mostra il loader con messaggio
     */
    UI.showLoader = function(message = 'Caricamento...') {
        if (this.elements.loader) {
            const loaderText = this.elements.loader.querySelector('p');
            if (loaderText) {
                loaderText.textContent = message;
            }
            this.elements.loader.classList.remove('hidden');
        }
    };

    /**
     * Nasconde il loader
     */
    UI.hideLoader = function() {
        if (this.elements.loader) {
            this.elements.loader.classList.add('hidden');
        }
    };

    /**
     * Mostra messaggio di errore
     */
    UI.showError = function(message) {
        if (this.elements.error && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.error.classList.remove('hidden');
        }
        AppConfig.log(0, `Errore UI: ${message}`);
    };

    /**
     * Nasconde messaggio di errore
     */
    UI.hideError = function() {
        if (this.elements.error) {
            this.elements.error.classList.add('hidden');
        }
    };

    /* ===== PROGRESS BAR MODELLI ===== */

    /**
     * Mostra la progress bar per il caricamento modelli
     */
    UI.showModelProgressBar = function(totalFiles = 0) {
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar) {
            // Reset elementi
            this.updateModelProgress(0, totalFiles, 'Preparazione...');

            // Mostra la progress bar
            progressBar.classList.remove('hidden');

            console.log('📊 Progress bar modelli mostrata');
        }

        // Disabilita pulsanti tutorial durante caricamento 3D
        document.querySelectorAll('.tutorial-arrow-btn').forEach(btn => {
            btn.classList.add('loading-disabled');
        });
        console.log('🔒 Pulsanti tutorial disabilitati durante caricamento 3D');
    };

    /**
     * Aggiorna la progress bar
     */
    UI.updateModelProgress = function(currentFile, totalFiles, fileName = '', percentage = null) {
        const progressBarFill = document.getElementById('progress-bar-fill');
        const progressCurrentFile = document.getElementById('progress-current-file');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressFilesCount = document.getElementById('progress-files-count');

        // Calcola percentuale se non fornita
        if (percentage === null) {
            percentage = totalFiles > 0 ? Math.round((currentFile / totalFiles) * 100) : 0;
        }

        // Aggiorna elementi
        if (progressBarFill) {
            progressBarFill.style.width = `${percentage}%`;
        }

        if (progressCurrentFile) {
            if (fileName) {
                // Estrai solo il nome del file senza percorso
                const cleanFileName = fileName.split('/').pop() || fileName;
                progressCurrentFile.textContent = cleanFileName;
            }
        }

        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }

        if (progressFilesCount) {
            progressFilesCount.textContent = `${currentFile} / ${totalFiles} file`;
        }

        console.log(`📊 Progress aggiornato: ${percentage}% - ${fileName}`);
    };

    /**
     * Nasconde la progress bar
     */
    UI.hideModelProgressBar = function() {
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar) {
            progressBar.classList.add('hidden');
            console.log('📊 Progress bar modelli nascosta');
        }

        // Riabilita pulsanti tutorial al termine del caricamento 3D
        document.querySelectorAll('.tutorial-arrow-btn').forEach(btn => {
            btn.classList.remove('loading-disabled');
        });
        console.log('🔓 Pulsanti tutorial riabilitati dopo caricamento 3D');
    };

    /* ===== GESTIONE FUMETTO STEP TUTORIAL ===== */

    /**
     * Mostra il fumetto per la descrizione step
     */
    UI.showStepSpeechBubble = function() {
        // GUARD: Non mostrare se siamo sulla home page
        if (this.currentPage === 'home') {
            console.log('💬 [UI] showStepSpeechBubble BLOCCATO - siamo sulla home page');
            return;
        }

        const bubble = document.getElementById('stepSpeechBubble');
        if (bubble) {
            bubble.classList.remove('hidden');
            // Rimuovi TUTTI gli inline style (inclusi !important impostati da goHome)
            bubble.removeAttribute('style');
        }
    };

    /**
     * Nasconde il fumetto per la descrizione step
     */
    UI.hideStepSpeechBubble = function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (bubble) {
            // Rimuovi tutte le classi di animazione che potrebbero interferire
            bubble.classList.remove('flash', 'pulse', 'dramatic-intro');

            // Aggiungi classe hidden
            bubble.classList.add('hidden');

            // Force inline style per extra sicurezza
            bubble.style.display = 'none';

            console.log('💬 [UI] Fumetto step nascosto');
        }
    };

    /**
     * Attiva l'effetto flash sul fumetto per attirare l'attenzione
     */
    UI.flashStepBubble = function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (!bubble || bubble.classList.contains('hidden')) {
            return;
        }

        // Rimuovi eventuali classi di animazione precedenti
        bubble.classList.remove('flash', 'pulse');

        // Usa requestAnimationFrame per riavviare l'animazione senza reflow forzato
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                bubble.classList.add('flash');
            });
        });

        // Rimuovi la classe dopo l'animazione per permettere flash futuri
        setTimeout(() => {
            bubble.classList.remove('flash');
        }, 2000); // Durata aggiornata (2s per glowPulse più lungo)
    };

    /**
     * Attiva un effetto pulse più sottile sul fumetto
     */
    UI.pulseStepBubble = function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (!bubble || bubble.classList.contains('hidden')) {
            return;
        }

        // Rimuovi eventuali classi di animazione precedenti
        bubble.classList.remove('flash', 'pulse');

        // Forza un reflow
        bubble.offsetHeight;

        // Aggiungi la classe pulse
        bubble.classList.add('pulse');

        // Rimuovi la classe dopo l'animazione
        setTimeout(() => {
            bubble.classList.remove('pulse');
        }, 800); // Durata dell'animazione pulse (0.8s)
    };

    /**
     * Aggiorna il contenuto del fumetto con lo step corrente
     */
    UI.updateStepSpeechBubble = function() {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0 || this.currentStepIndex < 0) {
            this.hideStepSpeechBubble();
            return;
        }

        const bubble = document.getElementById('stepSpeechBubble');
        const stepCurrentNumber = document.getElementById('stepCurrentNumber');
        const stepTotalNumber = document.getElementById('stepTotalNumber');
        const stepDescription = document.getElementById('stepDescription');
        const content = bubble ? bubble.querySelector('.speech-bubble-content') : null;

        if (!bubble || !stepCurrentNumber || !stepTotalNumber || !stepDescription || !content) {
            return;
        }

        const currentStep = this.tutorialSteps[this.currentStepIndex];
        const isFirstAppearance = bubble.classList.contains('hidden');

        // Aggiungi/rimuovi classe per ultimo step
        if (this.currentStepIndex === this.tutorialSteps.length - 1) {
            bubble.classList.add('last-step');
        } else {
            bubble.classList.remove('last-step');
        }

        // ═══════════════════════════════════════════════════════════════
        // ANIMAZIONE DRAMMATICA: Parametro HighlightDescription=true
        // ═══════════════════════════════════════════════════════════════
        if (currentStep && currentStep.properties && currentStep.properties.HighlightDescription === 'true') {
            // Per dramatic-intro: aggiorna contenuto direttamente e avvia animazione
            stepCurrentNumber.textContent = this.currentStepIndex + 1;
            stepTotalNumber.textContent = this.tutorialSteps.length;
            if (currentStep.properties.Descrizione) {
                stepDescription.textContent = currentStep.properties.Descrizione;
            } else {
                stepDescription.textContent = currentStep?.name || `Step ${this.currentStepIndex + 1}`;
            }

            content.classList.remove('entering');
            this.showStepSpeechBubble();

            console.log('🎬 [UI] HighlightDescription=true → Animazione drammatica fumetto');
            bubble.classList.remove('dramatic-intro', 'flash', 'pulse');
            requestAnimationFrame(() => {
                bubble.classList.add('dramatic-intro');
            });
            const dramaticDuration = this.dramaticAnimationDuration || 1000;
            bubble.style.animationDuration = dramaticDuration + 'ms';
            setTimeout(() => {
                bubble.classList.remove('dramatic-intro');
                bubble.style.animationDuration = '';
                console.log('🎬 [UI] Animazione drammatica completata');
            }, dramaticDuration);
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // TRANSIZIONE SMOOTH: fade-out → aggiorna testo → fade-in
        // ═══════════════════════════════════════════════════════════════
        if (isFirstAppearance) {
            // Prima apparizione: parte nascosto, poi entra smooth
            content.classList.add('entering');
            stepCurrentNumber.textContent = this.currentStepIndex + 1;
            stepTotalNumber.textContent = this.tutorialSteps.length;
            if (currentStep && currentStep.properties && currentStep.properties.Descrizione) {
                stepDescription.textContent = currentStep.properties.Descrizione;
            } else {
                stepDescription.textContent = currentStep?.name || `Step ${this.currentStepIndex + 1}`;
            }
            this.showStepSpeechBubble();
            // Attende un frame per applicare lo stato "entering", poi rimuove per animare l'ingresso
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    content.classList.remove('entering');
                    // Flash glow dopo che il contenuto è apparso
                    setTimeout(() => this.flashStepBubble(), 400);
                });
            });
        } else {
            // Step successivi: fade-out → aggiorna → fade-in
            content.classList.add('entering');
            setTimeout(() => {
                // Aggiorna contenuto mentre è nascosto
                stepCurrentNumber.textContent = this.currentStepIndex + 1;
                stepTotalNumber.textContent = this.tutorialSteps.length;
                if (currentStep && currentStep.properties && currentStep.properties.Descrizione) {
                    stepDescription.textContent = currentStep.properties.Descrizione;
                } else {
                    stepDescription.textContent = currentStep?.name || `Step ${this.currentStepIndex + 1}`;
                }
                // Fade-in con nuovo contenuto
                requestAnimationFrame(() => {
                    content.classList.remove('entering');
                    // Flash glow dopo che il contenuto è apparso
                    setTimeout(() => this.flashStepBubble(), 400);
                });
            }, 350); // Durata fade-out prima di aggiornare
        }
    };

    /* ===== MODAL INFORMATIVO ===== */

    /**
     * Mostra modal informativo con messaggio e media opzionali
     * @param {string} message - Messaggio da mostrare
     * @param {string} title - Titolo del modal (opzionale)
     * @param {Object} options - Opzioni aggiuntive { image: 'path/to/image.jpg', video: 'path/to/video.mp4' }
     * @returns {Promise} - Promessa risolta quando l'utente clicca OK
     */
    UI.showInfoModal = function(message, title = 'Informazione', options = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('infoModal');
            const titleElement = document.getElementById('infoModalTitle');
            const messageElement = document.getElementById('infoModalMessage');
            const mediaContainer = document.getElementById('infoModalMedia');
            const okButton = document.getElementById('infoModalOkBtn');

            if (!modal || !titleElement || !messageElement || !okButton || !mediaContainer) {
                AppConfig.log(0, '[UI] Elementi modal informativo non trovati');
                resolve();
                return;
            }

            // Salva callback resolve per poterla chiamare da hideInfoModal
            this._infoModalResolve = resolve;
            this._infoModalCloseHandler = null;

            // Resetta inline style eventualmente impostato da goHome()
            modal.style.display = '';

            // Imposta contenuto testuale
            titleElement.textContent = title;
            // Supporta \n come a capo nel messaggio
            messageElement.innerHTML = message.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');

            // Pulisci e nascondi contenitore media
            mediaContainer.innerHTML = '';
            mediaContainer.classList.add('hidden');

            // Gestione immagine
            if (options.image) {
                const img = document.createElement('img');
                img.src = options.image;
                img.alt = 'Immagine informativa';
                img.onerror = () => {
                    AppConfig.log(1, `[UI] Errore caricamento immagine: ${options.image}`);
                    mediaContainer.classList.add('hidden');
                };
                img.onload = () => {
                    mediaContainer.classList.remove('hidden');
                    AppConfig.log(2, `[UI] Immagine caricata: ${options.image}`);
                };
                mediaContainer.appendChild(img);
            }

            // Gestione video
            if (options.video) {
                const video = document.createElement('video');
                video.src = options.video;
                video.controls = true;
                video.autoplay = true;
                video.preload = 'auto';
                video.onerror = () => {
                    AppConfig.log(1, `[UI] Errore caricamento video: ${options.video}`);
                    mediaContainer.classList.add('hidden');
                };
                mediaContainer.appendChild(video);
                mediaContainer.classList.remove('hidden');
                AppConfig.log(2, `[UI] Video aggiunto: ${options.video}`);
            }

            // Handler per chiusura
            const self = this;
            const closeModal = () => {
                modal.classList.remove('show');
                okButton.removeEventListener('click', closeModal);
                self._infoModalCloseHandler = null;

                // Ferma video se presente
                const videoElement = mediaContainer.querySelector('video');
                if (videoElement) {
                    videoElement.pause();
                    videoElement.currentTime = 0;
                }

                // Risolvi la promessa dopo l'animazione
                setTimeout(() => {
                    // Pulisci contenitore media
                    mediaContainer.innerHTML = '';
                    mediaContainer.classList.add('hidden');
                    // Risolvi solo se questa è ancora la promise attiva
                    if (self._infoModalResolve === resolve) {
                        self._infoModalResolve = null;
                        resolve();
                    }
                }, 300);
            };

            // Salva handler per poterlo rimuovere da hideInfoModal
            this._infoModalCloseHandler = closeModal;

            // Aggiungi listener al pulsante OK
            okButton.addEventListener('click', closeModal);

            // Mostra modal
            setTimeout(() => {
                modal.classList.add('show');
            }, 100);

            AppConfig.log(2, `[UI] Modal informativo mostrato: "${message.substring(0, 50)}..."`);
        });
    };

    /**
     * Nasconde modal informativo e risolve la promise pendente
     */
    UI.hideInfoModal = function() {
        const modal = document.getElementById('infoModal');
        if (modal) {
            modal.classList.remove('show');
        }

        // Rimuovi handler click dal pulsante OK per evitare listener orfani
        if (this._infoModalCloseHandler) {
            const okButton = document.getElementById('infoModalOkBtn');
            if (okButton) {
                okButton.removeEventListener('click', this._infoModalCloseHandler);
            }
            this._infoModalCloseHandler = null;
        }

        // Ferma video e pulisci media
        const mediaContainer = document.getElementById('infoModalMedia');
        if (mediaContainer) {
            const videoElement = mediaContainer.querySelector('video');
            if (videoElement) {
                videoElement.pause();
                videoElement.currentTime = 0;
            }
            mediaContainer.innerHTML = '';
            mediaContainer.classList.add('hidden');
        }

        // CRITICO: Risolvi la promise pendente per sbloccare executeStep
        if (this._infoModalResolve) {
            console.log('[UI] ⚠️ hideInfoModal: Risoluzione forzata promise modal pendente');
            const pendingResolve = this._infoModalResolve;
            this._infoModalResolve = null;
            pendingResolve();
        }
    };

    console.log('[UIElements] Modulo caricato');
})();
