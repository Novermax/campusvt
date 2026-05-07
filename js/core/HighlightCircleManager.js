/**
 * HighlightCircleManager.js - Sistema cerchi pulsanti per evidenziazione trigger
 *
 * Funzionalità:
 * - Cerchi gialli pulsanti sovrapposti ai pulsanti 3D
 * - Dimensione configurabile per trigger
 * - Bordo spesso giallo puro con trasparenza
 * - Segue automaticamente i modelli durante rotazione camera
 *
 * Versione: 1.0
 * Data: Gennaio 2026
 */

class HighlightCircleManager {
    constructor() {
        this.circles = new Map(); // triggerId -> { element, mesh, size }
        this.container = null;
        this.camera = null;
        this.renderer = null;
        this.updateInterval = null;
        this.isEnabled = false;

        // Configurazione default
        this.config = {
            defaultSize: 80,        // Dimensione default cerchio in pixel
            borderWidth: 4,         // Spessore bordo in pixel
            borderColor: '#ffff00', // Giallo puro
            opacity: 0.9,           // Opacità bordo (visibile)
            pulseMin: 0.9,          // Scala minima pulse
            pulseMax: 1.1,          // Scala massima pulse
            pulseDuration: 1.5,     // Durata pulse in secondi
            updateRate: 60          // FPS aggiornamento posizione (60fps = ~16ms)
        };

        console.log('🔵 [HighlightCircleManager] Inizializzato');
    }

    /**
     * Inizializza il sistema con riferimenti Three.js
     * @param {THREE.Camera} camera - Camera Three.js
     * @param {THREE.WebGLRenderer} renderer - Renderer Three.js
     */
    init(camera, renderer) {
        if (!camera || !renderer) {
            console.error('❌ [HighlightCircleManager] Camera o renderer mancante');
            return false;
        }

        this.camera = camera;
        this.renderer = renderer;

        // Crea container overlay
        this.createContainer();

        // Avvia loop aggiornamento posizioni
        this.startUpdateLoop();

        this.isEnabled = true;
        console.log('✅ [HighlightCircleManager] Sistema inizializzato');
        return true;
    }

    /**
     * Crea container DOM per i cerchi
     */
    createContainer() {
        // Rimuovi container esistente se presente
        const existing = document.getElementById('highlightCirclesContainer');
        if (existing) existing.remove();

        // Crea nuovo container
        this.container = document.createElement('div');
        this.container.id = 'highlightCirclesContainer';
        this.container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 900;
        `;

        document.body.appendChild(this.container);
        console.log('🔵 [HighlightCircleManager] Container creato');
    }

    /**
     * Crea cerchio per un trigger specifico
     * @param {string} triggerId - ID del trigger (es. "pulpito.btn_start")
     * @param {THREE.Mesh} mesh - Mesh del pulsante 3D
     * @param {number} size - Dimensione cerchio in pixel (opzionale)
     * @param {number} opacity - Opacità cerchio 0.0-1.0 (opzionale, default da config)
     */
    createCircle(triggerId, mesh, size = null, opacity = null) {
        if (!this.container) {
            console.warn('⚠️ [HighlightCircleManager] Container non inizializzato');
            return;
        }

        // Rimuovi cerchio esistente per questo trigger
        this.removeCircle(triggerId);

        // Usa dimensione custom o default
        const circleSize = size || this.config.defaultSize;

        // Usa opacità custom o default
        const circleOpacity = (opacity !== null && opacity !== undefined) ? opacity : this.config.opacity;

        // Risolvi colore bordo dinamicamente da InterfaceConfig / InteractiveObject3D,
        // così il cerchio segue la stessa tinta del materiale del pulsante 3D.
        const borderColor = this._resolveBorderColor();

        // Crea elemento DOM cerchio
        const circle = document.createElement('div');
        circle.className = 'highlight-circle';
        circle.dataset.triggerId = triggerId;
        circle.style.cssText = `
            position: absolute;
            width: ${circleSize}px;
            height: ${circleSize}px;
            border: ${this.config.borderWidth}px solid ${borderColor};
            border-radius: 50%;
            background: transparent;
            opacity: ${circleOpacity};
            transform: translate(-50%, -50%);
            pointer-events: none;
            animation: pulseCircle ${this.config.pulseDuration}s ease-in-out infinite;
        `;

        this.container.appendChild(circle);

        // Salva riferimenti
        this.circles.set(triggerId, {
            element: circle,
            mesh: mesh,
            size: circleSize
        });

        console.log(`🔵 [HighlightCircleManager] Cerchio creato per "${triggerId}" (size: ${circleSize}px, opacity: ${circleOpacity})`);

        // Aggiorna posizione immediatamente
        this.updateCirclePosition(triggerId);
    }

    /**
     * Rimuove cerchio per un trigger specifico
     * @param {string} triggerId - ID del trigger
     */
    removeCircle(triggerId) {
        const circleData = this.circles.get(triggerId);
        if (circleData) {
            circleData.element.remove();
            this.circles.delete(triggerId);
            console.log(`🔵 [HighlightCircleManager] Cerchio rimosso per "${triggerId}"`);
        }
    }

    /**
     * Rimuove tutti i cerchi
     */
    clearAllCircles() {
        console.log(`🔵 [HighlightCircleManager] Rimozione ${this.circles.size} cerchi`);

        for (const [triggerId, circleData] of this.circles) {
            circleData.element.remove();
        }

        this.circles.clear();
    }

    /**
     * Aggiorna posizione di un cerchio specifico
     * @param {string} triggerId - ID del trigger
     */
    updateCirclePosition(triggerId) {
        const circleData = this.circles.get(triggerId);
        if (!circleData || !circleData.mesh || !this.camera || !this.renderer) {
            return;
        }

        const { element, mesh } = circleData;

        // Verifica visibilità mesh
        if (!mesh.visible) {
            element.style.display = 'none';
            return;
        }

        // Calcola posizione 3D del centro del pulsante
        mesh.updateMatrixWorld(true);
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        const center = boundingBox.getCenter(new THREE.Vector3());

        // Proietta posizione 3D → 2D schermo
        const screenPos = this.project3DTo2D(center);

        // Verifica se è davanti alla camera
        if (screenPos.z > 1) {
            element.style.display = 'none';
            return;
        }

        // Aggiorna posizione cerchio
        element.style.left = `${screenPos.x}px`;
        element.style.top = `${screenPos.y}px`;
        element.style.display = 'block';
    }

    /**
     * Proietta coordinate 3D a 2D schermo
     * @param {THREE.Vector3} position3D - Posizione 3D
     * @returns {Object} { x, y, z } coordinate 2D + depth
     */
    project3DTo2D(position3D) {
        const vector = position3D.clone();
        vector.project(this.camera);

        // Converti NDC (-1 to 1) in pixel schermo
        const canvas = this.renderer.domElement;
        const widthHalf = canvas.clientWidth / 2;
        const heightHalf = canvas.clientHeight / 2;

        return {
            x: (vector.x * widthHalf) + widthHalf,
            y: -(vector.y * heightHalf) + heightHalf,
            z: vector.z
        };
    }

    /**
     * Aggiorna posizioni di tutti i cerchi
     */
    updateAllPositions() {
        for (const [triggerId] of this.circles) {
            this.updateCirclePosition(triggerId);
        }
    }

    /**
     * Avvia loop aggiornamento continuo
     */
    startUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        const updateMs = 1000 / this.config.updateRate;

        this.updateInterval = setInterval(() => {
            if (this.circles.size > 0) {
                this.updateAllPositions();
            }
        }, updateMs);

        console.log(`🔵 [HighlightCircleManager] Loop aggiornamento avviato (${this.config.updateRate}fps)`);
    }

    /**
     * Ferma loop aggiornamento
     */
    stopUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('🔵 [HighlightCircleManager] Loop aggiornamento fermato');
        }
    }

    /**
     * Converte un colore (hex numerico, '#rrggbb' o 'rrggbb') in stringa CSS '#rrggbb'.
     * @param {number|string} color
     * @returns {string|null}
     */
    _toCssColor(color) {
        if (typeof color === 'number' && !isNaN(color)) {
            return '#' + (color & 0xffffff).toString(16).padStart(6, '0');
        }
        if (typeof color === 'string') {
            const trimmed = color.trim();
            if (trimmed.startsWith('#')) return trimmed;
            if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
                const n = parseInt(trimmed, 16);
                if (!isNaN(n)) return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
            }
            // Assume CSS named color o rgb()
            return trimmed;
        }
        return null;
    }

    /**
     * Risolve il colore bordo da usare: priorità InterfaceConfig.highlight.color,
     * poi InteractiveObject3D.config.highlightColor, infine config.borderColor.
     * @returns {string} CSS color
     */
    _resolveBorderColor() {
        const cfgColor = window.InterfaceConfig && window.InterfaceConfig.highlight
            && window.InterfaceConfig.highlight.color;
        if (cfgColor !== undefined && cfgColor !== null) {
            const css = this._toCssColor(cfgColor);
            if (css) return css;
        }
        const ioColor = window.InteractiveObject3D && window.InteractiveObject3D.config
            && window.InteractiveObject3D.config.highlightColor;
        if (ioColor !== undefined && ioColor !== null) {
            const css = this._toCssColor(ioColor);
            if (css) return css;
        }
        return this.config.borderColor;
    }

    /**
     * Imposta colore bordo cerchi (applica anche ai cerchi già creati).
     * @param {number|string} color - Hex numerico (0xrrggbb) o stringa CSS
     */
    setBorderColor(color) {
        const css = this._toCssColor(color);
        if (!css) {
            console.warn(`🔵 [HighlightCircleManager] Colore non valido: ${color}`);
            return;
        }
        this.config.borderColor = css;
        for (const [, circleData] of this.circles) {
            circleData.element.style.borderColor = css;
        }
        console.log(`🔵 [HighlightCircleManager] Colore bordo aggiornato: ${css}`);
    }

    /**
     * Imposta dimensione default cerchi
     * @param {number} size - Dimensione in pixel
     */
    setDefaultSize(size) {
        this.config.defaultSize = Math.max(20, Math.min(200, size));
        console.log(`🔵 [HighlightCircleManager] Dimensione default: ${this.config.defaultSize}px`);
    }

    /**
     * Imposta spessore bordo
     * @param {number} width - Spessore in pixel
     */
    setBorderWidth(width) {
        this.config.borderWidth = Math.max(1, Math.min(10, width));
        console.log(`🔵 [HighlightCircleManager] Spessore bordo: ${this.config.borderWidth}px`);

        // Aggiorna cerchi esistenti
        for (const [, circleData] of this.circles) {
            circleData.element.style.borderWidth = `${this.config.borderWidth}px`;
        }
    }

    /**
     * Debug: info sistema
     */
    debugInfo() {
        console.log('═══════════════════════════════════════');
        console.log('🔵 HighlightCircleManager - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Abilitato:', this.isEnabled);
        console.log('Cerchi attivi:', this.circles.size);
        console.log('Config:', this.config);
        console.log('───────────────────────────────────────');

        for (const [triggerId, circleData] of this.circles) {
            console.log(`  ${triggerId}:`);
            console.log(`    Size: ${circleData.size}px`);
            console.log(`    Visible: ${circleData.element.style.display !== 'none'}`);
            console.log(`    Mesh: ${circleData.mesh.name}`);
        }

        console.log('═══════════════════════════════════════');
    }

    /**
     * Cleanup completo
     */
    dispose() {
        this.stopUpdateLoop();
        this.clearAllCircles();

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.camera = null;
        this.renderer = null;
        this.isEnabled = false;

        console.log('🔵 [HighlightCircleManager] Cleanup completato');
    }
}

// Export globale
window.HighlightCircleManager = HighlightCircleManager;
