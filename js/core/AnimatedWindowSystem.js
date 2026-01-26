/**
 * AnimatedWindowSystem - Sistema Finestra 2D con Animazione a Trigger Alternato
 *
 * Versione: 1.0.0
 * Data: Gennaio 2026
 *
 * Funzionalità:
 * - Finestra 2D per visualizzazione sequenziale di immagini
 * - Trigger alternato sullo stesso oggetto (avanti/indietro)
 * - Conteggio trigger fino a maxTriggers
 * - Posizione, scala e timing configurabili
 * - Auto-chiusura e avanzamento step al completamento
 */

console.log('[AnimatedWindowSystem] Modulo caricato v1.0.0');

window.AnimatedWindowSystem = {
    // ═══════════════════════════════════════════════════════════════════════════
    // STATO SISTEMA
    // ═══════════════════════════════════════════════════════════════════════════

    enabled: true,
    initialized: false,
    isVisible: false,
    isAnimating: false,

    // Stato interno finestra corrente
    state: {
        images: [],              // Array di URL immagini
        currentIndex: 0,         // Indice immagine corrente
        direction: 'forward',    // 'forward' o 'backward'
        triggerCount: 0,         // Numero di attivazioni
        maxTriggers: 2,          // N-esima attivazione per chiusura
        frameDelay: 100,         // Millisecondi tra frame (default 100ms)
        onComplete: null,        // Callback al completamento
        externalTriggerOnly: false // Se true, ignora click interni (solo trigger da StepController)
    },

    // Configurazione finestra
    config: {
        position: { x: '50%', y: '50%' },  // Posizione (CSS o pixel)
        anchor: 'center',                   // 'center', 'top-left', 'top-right', etc.
        scale: 1.0,                         // Scala immagine
        width: null,                        // Larghezza (override scale)
        height: null,                       // Altezza (override scale)
        zIndex: 9500,                       // z-index overlay
        showBorder: true,                   // Mostra bordo decorativo
        showProgress: true                  // Mostra indicatore progresso
    },

    // Riferimenti DOM
    elements: {
        overlay: null,
        container: null,
        image: null,
        progress: null,
        closeBtn: null
    },

    // Timer animazione
    animationTimer: null,

    // ═══════════════════════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Inizializza il sistema
     */
    init: function() {
        console.log('[AnimatedWindowSystem] Inizializzazione...');

        if (this.initialized) {
            console.log('[AnimatedWindowSystem] Già inizializzato');
            return true;
        }

        // Crea elementi DOM
        this.createDOMElements();

        // Bind eventi
        this.bindEvents();

        this.initialized = true;
        console.log('[AnimatedWindowSystem] ✅ Inizializzato');
        return true;
    },

    /**
     * Crea gli elementi DOM per la finestra
     */
    createDOMElements: function() {
        // Verifica se elementi esistono già
        if (document.getElementById('animatedWindowOverlay')) {
            this.elements.overlay = document.getElementById('animatedWindowOverlay');
            this.elements.container = document.getElementById('animatedWindowContainer');
            this.elements.image = document.getElementById('animatedWindowImage');
            this.elements.progress = document.getElementById('animatedWindowProgress');
            return;
        }

        // Crea overlay
        const overlay = document.createElement('div');
        overlay.id = 'animatedWindowOverlay';
        overlay.className = 'animated-window-overlay';
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: ${this.config.zIndex};
            pointer-events: auto;
        `;

        // Crea container finestra
        const container = document.createElement('div');
        container.id = 'animatedWindowContainer';
        container.className = 'animated-window-container';
        container.style.cssText = `
            position: absolute;
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 2px solid #4a90d9;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(74, 144, 217, 0.3), 0 0 60px rgba(74, 144, 217, 0.1);
            padding: 15px;
            transform: translate(-50%, -50%);
            transition: opacity 0.3s ease, transform 0.3s ease;
        `;

        // Crea elemento immagine
        const image = document.createElement('img');
        image.id = 'animatedWindowImage';
        image.className = 'animated-window-image';
        image.style.cssText = `
            display: block;
            max-width: 100%;
            max-height: 80vh;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        // Crea indicatore progresso
        const progress = document.createElement('div');
        progress.id = 'animatedWindowProgress';
        progress.className = 'animated-window-progress';
        progress.style.cssText = `
            margin-top: 10px;
            text-align: center;
            font-family: 'Segoe UI', sans-serif;
            font-size: 12px;
            color: #8892b0;
        `;

        // Crea indicatore trigger
        const triggerInfo = document.createElement('div');
        triggerInfo.id = 'animatedWindowTriggerInfo';
        triggerInfo.className = 'animated-window-trigger-info';
        triggerInfo.style.cssText = `
            margin-top: 8px;
            text-align: center;
            font-family: 'Segoe UI', sans-serif;
            font-size: 11px;
            color: #64ffda;
        `;

        // Assembla struttura
        container.appendChild(image);
        container.appendChild(progress);
        container.appendChild(triggerInfo);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Salva riferimenti
        this.elements.overlay = overlay;
        this.elements.container = container;
        this.elements.image = image;
        this.elements.progress = progress;
        this.elements.triggerInfo = triggerInfo;

        console.log('[AnimatedWindowSystem] 🎨 Elementi DOM creati');
    },

    /**
     * Bind eventi
     */
    bindEvents: function() {
        // Click sull'overlay (fuori dalla finestra) → trigger (se non externalTriggerOnly)
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay || e.target === this.elements.container) {
                if (this.state.externalTriggerOnly) {
                    console.log('[AnimatedWindowSystem] 🚫 Click interno ignorato - richiede trigger da pulsante 3D');
                    return;
                }
                this.handleTrigger();
            }
        });

        // Click sull'immagine → trigger (se non externalTriggerOnly)
        this.elements.image.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.state.externalTriggerOnly) {
                console.log('[AnimatedWindowSystem] 🚫 Click interno ignorato - richiede trigger da pulsante 3D');
                return;
            }
            this.handleTrigger();
        });

        // Tasto spazio o invio → trigger (se non externalTriggerOnly)
        document.addEventListener('keydown', (e) => {
            if (this.isVisible && (e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                if (this.state.externalTriggerOnly) {
                    console.log('[AnimatedWindowSystem] 🚫 Tasto ignorato - richiede trigger da pulsante 3D');
                    return;
                }
                this.handleTrigger();
            }
        });
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // API PUBBLICA
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Mostra finestra animata
     * @param {Object} options - Configurazione
     * @param {string[]} options.images - Array URL immagini
     * @param {Object} options.position - Posizione {x, y} (CSS o pixel)
     * @param {number} options.scale - Scala immagine (default 1.0)
     * @param {number} options.width - Larghezza in pixel (override scale)
     * @param {number} options.height - Altezza in pixel (override scale)
     * @param {number} options.maxTriggers - Numero attivazioni prima di chiudere
     * @param {number} options.frameDelay - Millisecondi tra frame (default 100)
     * @param {Function} options.onComplete - Callback al completamento
     * @returns {boolean} Successo
     */
    show: function(options = {}) {
        if (!this.initialized) {
            this.init();
        }

        if (!options.images || options.images.length === 0) {
            console.error('[AnimatedWindowSystem] ❌ Nessuna immagine fornita');
            return false;
        }

        console.log('[AnimatedWindowSystem] 🖼️ Mostra finestra con', options.images.length, 'immagini');

        // Reset stato
        this.state = {
            images: options.images,
            currentIndex: 0,
            direction: 'forward',
            triggerCount: 0,
            maxTriggers: options.maxTriggers || 2,
            frameDelay: options.frameDelay || 100,
            externalTriggerOnly: options.externalTriggerOnly || false,
            onComplete: options.onComplete || null
        };

        // Se externalTriggerOnly, l'overlay non deve bloccare i click sul canvas 3D
        if (this.state.externalTriggerOnly) {
            this.elements.overlay.style.pointerEvents = 'none';
            this.elements.container.style.pointerEvents = 'none';
            // Rendi l'overlay più trasparente per vedere meglio il pulsante 3D
            this.elements.overlay.style.background = 'rgba(0, 0, 0, 0.3)';
            console.log('[AnimatedWindowSystem] 🎮 pointer-events disabilitati - click passano al canvas 3D');
        } else {
            this.elements.overlay.style.pointerEvents = 'auto';
            this.elements.container.style.pointerEvents = 'auto';
            this.elements.overlay.style.background = 'rgba(0, 0, 0, 0.6)';
        }

        // Applica configurazione posizione
        if (options.position) {
            this.config.position = options.position;
        }
        if (options.scale !== undefined) {
            this.config.scale = options.scale;
        }
        if (options.width !== undefined) {
            this.config.width = options.width;
        }
        if (options.height !== undefined) {
            this.config.height = options.height;
        }
        if (options.anchor !== undefined) {
            this.config.anchor = options.anchor;
        }

        // Applica stili posizione
        this.applyPositionStyles();

        // Mostra prima immagine
        this.showImage(0);

        // Aggiorna indicatori
        this.updateProgressIndicator();
        this.updateTriggerInfo();

        // Mostra overlay
        this.elements.overlay.style.display = 'block';
        this.isVisible = true;

        console.log('[AnimatedWindowSystem] ✅ Finestra visibile - Clicca per avviare animazione');

        return true;
    },

    /**
     * Nasconde la finestra
     */
    hide: function() {
        if (!this.isVisible) return;

        console.log('[AnimatedWindowSystem] 🚪 Chiusura finestra');

        // Ferma animazione in corso
        this.stopAnimation();

        // Ripristina pointer-events e stile overlay per prossimo utilizzo
        this.elements.overlay.style.pointerEvents = 'auto';
        this.elements.container.style.pointerEvents = 'auto';
        this.elements.overlay.style.background = 'rgba(0, 0, 0, 0.6)';

        // Nascondi overlay
        this.elements.overlay.style.display = 'none';
        this.isVisible = false;

        // Callback completamento
        if (this.state.onComplete && typeof this.state.onComplete === 'function') {
            console.log('[AnimatedWindowSystem] 📢 Callback onComplete');
            this.state.onComplete();
        }

        // Reset stato
        this.resetState();
    },

    /**
     * Gestisce il trigger (click o tasto)
     */
    handleTrigger: function() {
        if (!this.isVisible) return;

        // Se animazione in corso, ignora
        if (this.isAnimating) {
            console.log('[AnimatedWindowSystem] ⏳ Animazione in corso, trigger ignorato');
            return;
        }

        // Incrementa contatore trigger
        this.state.triggerCount++;

        console.log(`[AnimatedWindowSystem] 🎯 TRIGGER #${this.state.triggerCount}/${this.state.maxTriggers}`);

        // Verifica se raggiunto maxTriggers
        if (this.state.triggerCount >= this.state.maxTriggers) {
            console.log('[AnimatedWindowSystem] 🏁 Raggiunto maxTriggers - Avvio ultima animazione poi chiusura');
        }

        // Determina direzione in base a parità trigger
        // Dispari = avanti, Pari = indietro
        if (this.state.triggerCount % 2 === 1) {
            this.state.direction = 'forward';
            console.log('[AnimatedWindowSystem] ➡️ Direzione: AVANTI (trigger dispari)');
        } else {
            this.state.direction = 'backward';
            console.log('[AnimatedWindowSystem] ⬅️ Direzione: INDIETRO (trigger pari)');
        }

        // Avvia animazione
        this.startAnimation();
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ANIMAZIONE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Avvia la sequenza di animazione
     */
    startAnimation: function() {
        if (this.isAnimating) return;

        this.isAnimating = true;

        const direction = this.state.direction;
        const images = this.state.images;
        const frameDelay = this.state.frameDelay;

        console.log(`[AnimatedWindowSystem] 🎬 Avvio animazione ${direction} - ${images.length} frame, ${frameDelay}ms/frame`);

        // Determina indice iniziale e finale
        let startIndex, endIndex, step;

        if (direction === 'forward') {
            startIndex = 0;
            endIndex = images.length - 1;
            step = 1;
        } else {
            startIndex = images.length - 1;
            endIndex = 0;
            step = -1;
        }

        // Se già all'indice corretto (dopo animazione precedente), parti da lì
        if (direction === 'forward' && this.state.currentIndex === images.length - 1) {
            startIndex = 0;
        } else if (direction === 'backward' && this.state.currentIndex === 0) {
            startIndex = images.length - 1;
        } else {
            // Usa indice corrente come start
            startIndex = this.state.currentIndex;
        }

        let currentFrameIndex = startIndex;

        // Mostra primo frame
        this.showImage(currentFrameIndex);
        this.updateProgressIndicator();

        // Animazione con setInterval
        this.animationTimer = setInterval(() => {
            // Prossimo frame
            currentFrameIndex += step;

            // Verifica se raggiunto fine
            const reachedEnd = (direction === 'forward' && currentFrameIndex > endIndex) ||
                               (direction === 'backward' && currentFrameIndex < endIndex);

            if (reachedEnd) {
                // Fine animazione
                this.stopAnimation();

                // Aggiorna indice corrente
                this.state.currentIndex = endIndex;
                this.showImage(endIndex);
                this.updateProgressIndicator();

                console.log(`[AnimatedWindowSystem] ✅ Animazione completata - Frame finale: ${endIndex + 1}/${images.length}`);

                // Verifica se era l'ultima attivazione
                if (this.state.triggerCount >= this.state.maxTriggers) {
                    console.log('[AnimatedWindowSystem] 🏁 Tutorial completato - Chiusura finestra');

                    // Delay prima di chiudere per vedere ultimo frame
                    setTimeout(() => {
                        this.hide();
                    }, 500);
                } else {
                    this.updateTriggerInfo();
                }

                return;
            }

            // Mostra frame corrente
            this.showImage(currentFrameIndex);
            this.state.currentIndex = currentFrameIndex;
            this.updateProgressIndicator();

        }, frameDelay);
    },

    /**
     * Ferma l'animazione
     */
    stopAnimation: function() {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
        this.isAnimating = false;
    },

    /**
     * Mostra immagine specifica
     * @param {number} index - Indice immagine
     */
    showImage: function(index) {
        if (index < 0 || index >= this.state.images.length) {
            console.warn('[AnimatedWindowSystem] ⚠️ Indice immagine non valido:', index);
            return;
        }

        const imageUrl = this.state.images[index];
        this.elements.image.src = imageUrl;
        this.state.currentIndex = index;
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // UI E STILI
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Applica stili posizione al container
     */
    applyPositionStyles: function() {
        const container = this.elements.container;
        const pos = this.config.position;
        const anchor = this.config.anchor;

        // Posizione
        if (typeof pos.x === 'number') {
            container.style.left = pos.x + 'px';
        } else {
            container.style.left = pos.x;
        }

        if (typeof pos.y === 'number') {
            container.style.top = pos.y + 'px';
        } else {
            container.style.top = pos.y;
        }

        // Anchor/transform
        switch (anchor) {
            case 'top-left':
                container.style.transform = 'translate(0, 0)';
                break;
            case 'top-right':
                container.style.transform = 'translate(-100%, 0)';
                break;
            case 'bottom-left':
                container.style.transform = 'translate(0, -100%)';
                break;
            case 'bottom-right':
                container.style.transform = 'translate(-100%, -100%)';
                break;
            case 'center':
            default:
                container.style.transform = 'translate(-50%, -50%)';
                break;
        }

        // Dimensioni immagine
        const image = this.elements.image;

        if (this.config.width) {
            image.style.width = this.config.width + 'px';
            image.style.height = 'auto';
        } else if (this.config.height) {
            image.style.width = 'auto';
            image.style.height = this.config.height + 'px';
        } else if (this.config.scale !== 1.0) {
            image.style.transform = `scale(${this.config.scale})`;
            image.style.transformOrigin = 'center center';
        } else {
            image.style.width = 'auto';
            image.style.height = 'auto';
            image.style.transform = 'none';
        }
    },

    /**
     * Aggiorna indicatore progresso frame
     */
    updateProgressIndicator: function() {
        if (!this.config.showProgress || !this.elements.progress) return;

        const current = this.state.currentIndex + 1;
        const total = this.state.images.length;
        const direction = this.state.direction === 'forward' ? '➡️' : '⬅️';

        this.elements.progress.innerHTML = `
            Frame ${current}/${total} ${direction}
        `;
    },

    /**
     * Aggiorna info trigger
     */
    updateTriggerInfo: function() {
        if (!this.elements.triggerInfo) return;

        const current = this.state.triggerCount;
        const max = this.state.maxTriggers;
        const remaining = max - current;
        const externalOnly = this.state.externalTriggerOnly;

        let message = '';
        if (current === 0) {
            if (externalOnly) {
                message = `🎮 Premi il pulsante 3D per avviare (${max} cicli totali)`;
            } else {
                message = `🖱️ Clicca per avviare (${max} cicli totali)`;
            }
        } else if (remaining > 0) {
            if (externalOnly) {
                message = `Ciclo ${current}/${max} - Premi il pulsante 3D per continuare`;
            } else {
                message = `Ciclo ${current}/${max} completato - Clicca per continuare`;
            }
        } else {
            message = `✅ Tutti i cicli completati!`;
        }

        this.elements.triggerInfo.textContent = message;
    },

    /**
     * Reset stato interno
     */
    resetState: function() {
        this.state = {
            images: [],
            currentIndex: 0,
            direction: 'forward',
            triggerCount: 0,
            maxTriggers: 2,
            frameDelay: 100,
            externalTriggerOnly: false,
            onComplete: null
        };
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // CARICAMENTO IMMAGINI DA CARTELLA
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Carica immagini da una cartella in modo sequenziale
     * Prova formati: 001.png, 002.png... oppure 1.png, 2.png... oppure 01.png, 02.png...
     * @param {string} folderPath - Percorso cartella (es. "screens/mandrino")
     * @returns {Promise<Array>} Array di URL immagini trovate
     */
    loadImagesFromFolder: async function(folderPath) {
        console.log(`[AnimatedWindowSystem] 📁 Scoperta immagini in: ${folderPath}`);

        // Normalizza path (rimuovi slash finale se presente)
        const basePath = folderPath.replace(/\/+$/, '');

        // Estensioni da provare
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

        // Formati numerici da provare (in ordine di priorità)
        const numberFormats = [
            (n) => String(n).padStart(4, '0'),  // 0001, 0002, 0003...
            (n) => String(n).padStart(3, '0'),  // 001, 002, 003...
            (n) => String(n).padStart(2, '0'),  // 01, 02, 03...
            (n) => String(n)                     // 1, 2, 3...
        ];

        let foundImages = [];
        let formatFound = null;
        let extensionFound = null;

        // Prima: trova il formato e l'estensione corretti provando la prima immagine
        for (const format of numberFormats) {
            if (formatFound) break;

            for (const ext of extensions) {
                const testUrl = `${basePath}/${format(1)}.${ext}`;
                const exists = await this.checkImageExists(testUrl);

                if (exists) {
                    formatFound = format;
                    extensionFound = ext;
                    console.log(`[AnimatedWindowSystem] ✓ Formato trovato: ${format(1)}.${ext}`);
                    break;
                }
            }
        }

        if (!formatFound || !extensionFound) {
            console.warn(`[AnimatedWindowSystem] ⚠️ Nessuna immagine trovata in ${basePath}`);
            console.log(`[AnimatedWindowSystem] Provati formati: 001.ext, 01.ext, 1.ext con estensioni: ${extensions.join(', ')}`);
            return [];
        }

        // Ora carica tutte le immagini sequenzialmente
        let index = 1;
        const maxImages = 100; // Limite sicurezza

        while (index <= maxImages) {
            const imageUrl = `${basePath}/${formatFound(index)}.${extensionFound}`;
            const exists = await this.checkImageExists(imageUrl);

            if (exists) {
                foundImages.push(imageUrl);
                index++;
            } else {
                // Fine sequenza
                break;
            }
        }

        console.log(`[AnimatedWindowSystem] 📁 Trovate ${foundImages.length} immagini in ${basePath}`);
        return foundImages;
    },

    /**
     * Verifica se un'immagine esiste
     * @param {string} url - URL immagine
     * @returns {Promise<boolean>} True se esiste
     */
    checkImageExists: function(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // INTEGRAZIONE TUTORIAL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Mostra finestra animata da configurazione step tutorial
     * @param {Object} stepProps - Proprietà dello step
     * @returns {Promise<boolean>} Successo
     */
    showFromStepConfig: async function(stepProps) {
        console.log('[AnimatedWindowSystem] 📋 Configurazione da step tutorial');

        let images = [];

        // NUOVO: Supporto AnimatedImagesFolder
        if (stepProps.AnimatedImagesFolder) {
            console.log(`[AnimatedWindowSystem] 📁 Caricamento immagini da cartella: ${stepProps.AnimatedImagesFolder}`);
            images = await this.loadImagesFromFolder(stepProps.AnimatedImagesFolder);

            if (images.length === 0) {
                console.error('[AnimatedWindowSystem] ❌ Nessuna immagine trovata nella cartella');
                return false;
            }
            console.log(`[AnimatedWindowSystem] ✅ Trovate ${images.length} immagini nella cartella`);
        }
        // Parse immagini lista (AnimatedImages=img1.png,img2.png,img3.png)
        else if (stepProps.AnimatedImages) {
            images = stepProps.AnimatedImages.split(',').map(img => img.trim());
        }
        else {
            console.error('[AnimatedWindowSystem] ❌ Proprietà AnimatedImages o AnimatedImagesFolder mancante');
            return false;
        }

        // Parse posizione (AnimatedPosition=(x,y) o AnimatedPosition=center)
        let position = { x: '50%', y: '50%' };
        let anchor = 'center';

        if (stepProps.AnimatedPosition) {
            const posValue = stepProps.AnimatedPosition.trim();

            if (posValue === 'center') {
                position = { x: '50%', y: '50%' };
                anchor = 'center';
            } else if (posValue === 'top-left') {
                position = { x: '10%', y: '10%' };
                anchor = 'top-left';
            } else if (posValue === 'top-right') {
                position = { x: '90%', y: '10%' };
                anchor = 'top-right';
            } else if (posValue === 'bottom-left') {
                position = { x: '10%', y: '90%' };
                anchor = 'bottom-left';
            } else if (posValue === 'bottom-right') {
                position = { x: '90%', y: '90%' };
                anchor = 'bottom-right';
            } else {
                // Parse coordinate (x,y)
                const coordMatch = posValue.match(/\(?\s*(-?[\d.]+%?)\s*,\s*(-?[\d.]+%?)\s*\)?/);
                if (coordMatch) {
                    position = {
                        x: coordMatch[1].includes('%') ? coordMatch[1] : parseInt(coordMatch[1]) + 'px',
                        y: coordMatch[2].includes('%') ? coordMatch[2] : parseInt(coordMatch[2]) + 'px'
                    };
                }
            }
        }

        // Parse anchor se specificato separatamente
        if (stepProps.AnimatedAnchor) {
            anchor = stepProps.AnimatedAnchor.trim();
        }

        // Parse scala/dimensioni
        let scale = 1.0;
        let width = null;
        let height = null;

        if (stepProps.AnimatedScale) {
            scale = parseFloat(stepProps.AnimatedScale);
        }
        if (stepProps.AnimatedWidth) {
            width = parseInt(stepProps.AnimatedWidth);
        }
        if (stepProps.AnimatedHeight) {
            height = parseInt(stepProps.AnimatedHeight);
        }

        // Parse maxTriggers (default 2)
        let maxTriggers = 2;
        if (stepProps.AnimatedMaxTriggers) {
            maxTriggers = parseInt(stepProps.AnimatedMaxTriggers);
        }

        // Parse frameDelay (default 100ms)
        let frameDelay = 100;
        if (stepProps.AnimatedFrameDelay) {
            frameDelay = parseInt(stepProps.AnimatedFrameDelay);
        }

        // Se lo step ha AcceptTrigger_Physical, i click interni sono ignorati
        // Solo il pulsante 3D può far avanzare l'animazione
        let externalTriggerOnly = false;
        if (stepProps.AcceptTrigger_Physical) {
            externalTriggerOnly = true;
            console.log('[AnimatedWindowSystem] 🎮 Modalità trigger esterno - solo pulsante 3D può avanzare');
        }

        // Callback per avanzamento step
        const onComplete = () => {
            console.log('[AnimatedWindowSystem] 🚀 Avanzamento allo step successivo');
            if (window.UI && typeof window.UI.nextStep === 'function') {
                setTimeout(() => {
                    window.UI.nextStep();
                }, 300);
            }
        };

        // Mostra finestra
        return this.show({
            images: images,
            position: position,
            anchor: anchor,
            scale: scale,
            width: width,
            height: height,
            maxTriggers: maxTriggers,
            frameDelay: frameDelay,
            externalTriggerOnly: externalTriggerOnly,
            onComplete: onComplete
        });
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Info debug sistema
     */
    debugInfo: function() {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🖼️ AnimatedWindowSystem - Debug Info');
        console.log('═══════════════════════════════════════════════════════');
        console.log('Stato:');
        console.log('  - Inizializzato:', this.initialized);
        console.log('  - Visibile:', this.isVisible);
        console.log('  - Animazione in corso:', this.isAnimating);
        console.log('');
        console.log('Configurazione corrente:');
        console.log('  - Immagini:', this.state.images.length);
        console.log('  - Frame corrente:', this.state.currentIndex + 1);
        console.log('  - Direzione:', this.state.direction);
        console.log('  - Trigger count:', this.state.triggerCount);
        console.log('  - Max triggers:', this.state.maxTriggers);
        console.log('  - Frame delay:', this.state.frameDelay, 'ms');
        console.log('');
        console.log('Posizione:');
        console.log('  - X:', this.config.position.x);
        console.log('  - Y:', this.config.position.y);
        console.log('  - Anchor:', this.config.anchor);
        console.log('  - Scale:', this.config.scale);
        console.log('═══════════════════════════════════════════════════════');
    },

    /**
     * Test rapido del sistema
     * @param {number} numFrames - Numero frame da generare (default 5)
     */
    test: function(numFrames = 5) {
        console.log('[AnimatedWindowSystem] 🧪 Avvio test con', numFrames, 'frame placeholder');

        // Genera immagini placeholder colorate
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        const images = [];

        for (let i = 0; i < numFrames; i++) {
            // Usa placeholder.com per immagini test
            const color = colors[i % colors.length].replace('#', '');
            images.push(`https://via.placeholder.com/400x300/${color}/ffffff?text=Frame+${i + 1}`);
        }

        this.show({
            images: images,
            position: { x: '50%', y: '50%' },
            anchor: 'center',
            maxTriggers: 3,
            frameDelay: 150,
            onComplete: () => {
                console.log('[AnimatedWindowSystem] 🧪 Test completato!');
            }
        });
    }
};

// Auto-init se DOM pronto
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.AnimatedWindowSystem.init();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        window.AnimatedWindowSystem.init();
    });
}

console.log('[AnimatedWindowSystem] ✅ Modulo pronto');
