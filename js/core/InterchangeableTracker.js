/**
 * InterchangeableTracker.js - Sistema di Tracking Posizioni Intercambiabili
 *
 * Gestisce il tracking delle posizioni occupate dagli elementi intercambiabili
 * per evitare sovrapposizioni e conflitti durante le operazioni di snap.
 *
 * Versione: 1.0
 * Data: Dicembre 2025
 */

window.InterchangeableTracker = {
    // Stato del sistema
    enabled: false,

    // Maps per il tracking
    occupiedInterchangeablePositions: new Map(), // positionKey -> objectName (es: "1.5,0.2,3.1" -> "connettore_tipo_b")
    currentInterchangeablePositions: new Map(), // objectUuid -> currentPosition (dove si trova attualmente l'elemento)

    // Riferimenti ai sistemi esterni
    dragDropSystem: null,
    assemblySystem: null,

    /**
     * Inizializza il sistema di tracking
     * @param {Object} dragDropSystem - Riferimento al DragDropSystem
     * @returns {boolean} - true se inizializzazione riuscita
     */
    init: function(dragDropSystem) {
        console.log('[InterchangeableTracker] 🏗️ Inizializzazione sistema tracking...');

        this.dragDropSystem = dragDropSystem;
        this.assemblySystem = window.AssemblySystem;

        if (!this.dragDropSystem) {
            console.error('[InterchangeableTracker] Errore: DragDropSystem non disponibile');
            return false;
        }

        console.log('[InterchangeableTracker] ✅ Sistema tracking inizializzato');
        return true;
    },

    /**
     * Abilita il sistema di tracking
     */
    enable: function() {
        this.enabled = true;
        console.log('[InterchangeableTracker] ✅ Sistema tracking abilitato');
    },

    /**
     * Disabilita il sistema di tracking
     */
    disable: function() {
        this.enabled = false;
        this.reset();
        console.log('[InterchangeableTracker] ❌ Sistema tracking disabilitato');
    },

    /**
     * Reset completo del tracking
     */
    reset: function() {
        this.occupiedInterchangeablePositions.clear();
        this.currentInterchangeablePositions.clear();
        console.log('[InterchangeableTracker] 🔄 Reset completo tracking');
    },

    /**
     * Genera una chiave stringa per una posizione Vector3 (per il tracking occupazioni)
     * @param {THREE.Vector3} position - Posizione 3D
     * @returns {string} - Chiave univoca per la posizione
     */
    getPositionKey: function(position) {
        // Usa 2 decimali per evitare problemi di floating point
        return `${position.x.toFixed(2)},${position.y.toFixed(2)},${position.z.toFixed(2)}`;
    },

    /**
     * Marca una posizione intercambiabile come occupata
     * @param {THREE.Vector3} position - Posizione occupata
     * @param {string} objectName - Nome dell'oggetto che occupa la posizione
     */
    markInterchangeablePositionOccupied: function(position, objectName) {
        if (!this.enabled) return;

        const positionKey = this.getPositionKey(position);
        this.occupiedInterchangeablePositions.set(positionKey, objectName);
        console.log(`[InterchangeableTracker] 🔒 Posizione intercambiabile occupata da "${objectName}": ${positionKey}`);
    },

    /**
     * Libera una posizione intercambiabile
     * @param {THREE.Vector3} position - Posizione da liberare
     * @returns {boolean} - true se la posizione era occupata
     */
    freeInterchangeablePosition: function(position) {
        if (!this.enabled) return false;

        const positionKey = this.getPositionKey(position);
        const wasOccupied = this.occupiedInterchangeablePositions.has(positionKey);
        if (wasOccupied) {
            const previousOccupant = this.occupiedInterchangeablePositions.get(positionKey);
            this.occupiedInterchangeablePositions.delete(positionKey);
            console.log(`[InterchangeableTracker] 🔓 Posizione intercambiabile liberata da "${previousOccupant}": ${positionKey}`);
        }
        return wasOccupied;
    },

    /**
     * Verifica se una posizione intercambiabile è occupata
     * @param {THREE.Vector3} position - Posizione da verificare
     * @returns {boolean} - true se occupata
     */
    isInterchangeablePositionOccupied: function(position) {
        if (!this.enabled) return false;

        const positionKey = this.getPositionKey(position);
        return this.occupiedInterchangeablePositions.has(positionKey);
    },

    /**
     * Aggiorna la posizione corrente di un elemento intercambiabile
     * @param {string} objectUuid - UUID dell'oggetto
     * @param {THREE.Vector3} newPosition - Nuova posizione
     */
    updateCurrentPosition: function(objectUuid, newPosition) {
        if (!this.enabled) return;

        this.currentInterchangeablePositions.set(objectUuid, newPosition.clone());
    },

    /**
     * Ottiene la posizione corrente di un elemento intercambiabile
     * @param {string} objectUuid - UUID dell'oggetto
     * @returns {THREE.Vector3|null} - Posizione corrente o null se non trovata
     */
    getCurrentPosition: function(objectUuid) {
        if (!this.enabled) return null;

        return this.currentInterchangeablePositions.get(objectUuid) || null;
    },

    /**
     * Gestisce il cambio di posizione di un elemento intercambiabile
     * Libera la posizione precedente e occupa quella nuova
     * @param {THREE.Object3D} object - Oggetto spostato
     * @param {THREE.Vector3} newPosition - Nuova posizione
     */
    handlePositionChange: function(object, newPosition) {
        if (!this.enabled || !this.assemblySystem || !this.assemblySystem.assemblyMode) {
            return;
        }

        const objectName = object.name.toLowerCase().trim();
        const interchangeableGroup = this.assemblySystem.findInterchangeableGroup(objectName);

        if (!interchangeableGroup) {
            return; // Non è un elemento intercambiabile
        }

        // Libera la posizione dove si trovava PRIMA del movimento
        const previousCurrentPosition = this.getCurrentPosition(object.uuid);
        if (previousCurrentPosition) {
            this.freeInterchangeablePosition(previousCurrentPosition);
            console.log(`[InterchangeableTracker] 🔓 Liberata posizione precedente di "${objectName}"`);
        }

        // Marca la nuova posizione come occupata
        this.markInterchangeablePositionOccupied(newPosition, objectName);

        // Aggiorna la posizione corrente dell'elemento
        this.updateCurrentPosition(object.uuid, newPosition);

        console.log(`[InterchangeableTracker] 🔄 Elemento intercambiabile "${objectName}" ha cambiato posizione`);
    },

    /**
     * Inizializza il tracking delle occupazioni per elementi intercambiabili
     * Marca le posizioni originali come occupate dai rispettivi elementi
     */
    initializeInterchangeableOccupations: function() {
        if (!this.enabled || !this.assemblySystem || !this.assemblySystem.assemblyMode || !this.assemblySystem.currentConfig) {
            console.log(`[InterchangeableTracker] ℹ️ AssemblySystem non in modalità assemblaggio - skip inizializzazione occupazioni`);
            return;
        }

        if (!this.dragDropSystem || !this.dragDropSystem.originalPositions || !this.dragDropSystem.draggableObjects) {
            console.log(`[InterchangeableTracker] ℹ️ DragDropSystem non pronto - skip inizializzazione occupazioni`);
            return;
        }

        console.log(`[InterchangeableTracker] 🏗️ Inizializzazione tracking occupazioni elementi intercambiabili...`);

        // Reset tracking precedente
        this.reset();

        // Per ogni oggetto che ha una posizione originale salvata
        this.dragDropSystem.originalPositions.forEach((originalPosition, uuid) => {
            const object = this.dragDropSystem.draggableObjects.find(obj => obj.uuid === uuid);
            if (object) {
                const objectName = object.name.toLowerCase().trim();
                const interchangeableGroup = this.assemblySystem.findInterchangeableGroup(objectName);

                if (interchangeableGroup) {
                    // È un elemento intercambiabile - marca la sua posizione originale come occupata
                    this.markInterchangeablePositionOccupied(originalPosition, objectName);

                    // Traccia la posizione originale come posizione corrente iniziale
                    this.updateCurrentPosition(uuid, originalPosition);

                    console.log(`[InterchangeableTracker] 🔒 Posizione iniziale marcata per elemento intercambiabile "${objectName}"`);
                }
            }
        });

        console.log(`[InterchangeableTracker] ✅ Inizializzazione occupazioni completata - ${this.occupiedInterchangeablePositions.size} posizioni tracciate`);
    },

    /**
     * Debug: Mostra tutte le posizioni intercambiabili occupate
     */
    debugOccupiedPositions: function() {
        console.log(`[InterchangeableTracker] 🔍 POSIZIONI INTERCAMBIABILI OCCUPATE (${this.occupiedInterchangeablePositions.size}):`);
        this.occupiedInterchangeablePositions.forEach((objectName, positionKey) => {
            console.log(`  🔒 ${positionKey} <- "${objectName}"`);
        });

        console.log(`[InterchangeableTracker] 🔍 POSIZIONI CORRENTI ELEMENTI INTERCAMBIABILI (${this.currentInterchangeablePositions.size}):`);
        this.currentInterchangeablePositions.forEach((currentPosition, uuid) => {
            const object = this.dragDropSystem?.draggableObjects?.find(obj => obj.uuid === uuid);
            const objectName = object ? object.name : 'SCONOSCIUTO';
            const positionKey = this.getPositionKey(currentPosition);
            console.log(`  📍 "${objectName}" si trova in: ${positionKey}`);
        });
    },

    /**
     * Ottiene statistiche del sistema
     * @returns {Object} - Statistiche complete
     */
    getStats: function() {
        return {
            enabled: this.enabled,
            occupiedPositionsCount: this.occupiedInterchangeablePositions.size,
            currentPositionsCount: this.currentInterchangeablePositions.size,
            assemblyModeActive: this.assemblySystem?.assemblyMode || false
        };
    }
};

// Inizializzazione automatica quando disponibile
if (typeof window !== 'undefined') {
    console.log('[InterchangeableTracker] 📦 Modulo caricato e disponibile globalmente');
}