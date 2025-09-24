/**
 * AssemblySystemSimplified.js - Sistema di Assemblaggio Semplificato
 *
 * Nuova versione semplificata che elimina completamente la dipendenza da file JSON:
 * - Auto-detection posizioni originali come snap points
 * - Gruppi definiti da AllowedComponents (comma-separated)
 * - Sequenza implicita basata su ordine step nel tutorial.txt
 * - AssemblyMode=true per attivare modalità assemblaggio
 *
 * Versione: 2.0 - Semplificata
 * Data: Dicembre 2025
 */

console.log('🚀 [AssemblySystemSimplified] Versione 2.0 caricata - Dicembre 2025');

window.AssemblySystemSimplified = {
    // Stato sistema
    enabled: false,
    assemblyMode: false,

    // Stato assemblaggio corrente
    currentStepName: null,
    mountedComponents: new Map(), // component_id -> snap_point_position
    allowedComponents: new Set(), // Componenti montabili nel step corrente
    assemblyHistory: [], // Per undo

    // Riferimenti sistemi esterni
    dragDropSystem: null,
    scene3D: null,

    /**
     * Inizializza il sistema di assemblaggio semplificato
     */
    init: function(scene3D) {
        console.log('[AssemblySystemSimplified] 🏗️ Inizializzazione sistema assemblaggio semplificato...');

        this.scene3D = scene3D;
        this.dragDropSystem = window.DragDropSystem;

        if (!this.dragDropSystem) {
            console.error('[AssemblySystemSimplified] Errore: DragDropSystem non disponibile');
            return false;
        }

        console.log('[AssemblySystemSimplified] ✅ Sistema assemblaggio semplificato inizializzato');
        return true;
    },

    /**
     * Abilita modalità assemblaggio semplificata
     * @param {Array|string} allowedComponents - Lista componenti per step corrente
     * @param {string} stepName - Nome step (opzionale, per tracking)
     */
    enableAssemblyMode: function(allowedComponents = null, stepName = null) {
        console.log('[AssemblySystemSimplified] 🔧 Abilitazione modalità assemblaggio semplificata...');

        this.assemblyMode = true;
        this.enabled = true;
        this.currentStepName = stepName || 'assembly_step';

        // Configura componenti permessi se forniti
        if (allowedComponents) {
            this.setAllowedComponents(allowedComponents);
        }

        console.log(`[AssemblySystemSimplified] ✅ Modalità assemblaggio abilitata - Step: ${this.currentStepName}`);
        return true;
    },

    /**
     * Disabilita modalità assemblaggio
     */
    disableAssemblyMode: function() {
        console.log('[AssemblySystemSimplified] 🔴 Disabilitazione modalità assemblaggio...');

        this.assemblyMode = false;
        this.enabled = false;
        this.currentStepName = null;
        this.mountedComponents.clear();
        this.allowedComponents.clear();
        this.assemblyHistory = [];

        console.log('[AssemblySystemSimplified] ✅ Modalità assemblaggio disabilitata');
    },

    /**
     * Imposta componenti montabili per step corrente
     * @param {Array|string} components - Lista nomi componenti o stringa comma-separated
     */
    setAllowedComponents: function(components) {
        console.log(`[AssemblySystemSimplified] 🎯 setAllowedComponents chiamata con:`, components);
        this.allowedComponents.clear();

        if (Array.isArray(components)) {
            components.forEach(comp => {
                this.allowedComponents.add(comp.trim());
            });
        } else if (typeof components === 'string') {
            // Split da stringa comma-separated
            components.split(',').forEach(comp => {
                this.allowedComponents.add(comp.trim());
            });
        }

        console.log(`[AssemblySystemSimplified] 🎯 Componenti permessi: [${Array.from(this.allowedComponents).join(', ')}]`);

        // SYNC: Aggiorna anche la whitelist del DragDropSystem
        if (window.DragDropSystem && typeof window.DragDropSystem.enable === 'function') {
            const componentsArray = Array.from(this.allowedComponents);
            console.log(`[AssemblySystemSimplified] 🔄 Sincronizzazione con DragDropSystem: [${componentsArray.join(', ')}]`);
            try {
                window.DragDropSystem.enable(componentsArray);
                console.log(`[AssemblySystemSimplified] ✅ DragDropSystem sincronizzato con ${componentsArray.length} componenti`);
            } catch (error) {
                console.error(`[AssemblySystemSimplified] ❌ Errore sincronizzazione DragDropSystem:`, error);
            }
        }

        // Setup snap targets intercambiabili per il gruppo
        this.setupGroupSnapTargets();
    },

    /**
     * Ottiene snap target automatico basato su posizione originale del componente
     * @param {string} componentName - Nome del componente
     * @returns {THREE.Vector3|null} - Posizione originale (centro bounding box)
     */
    getOriginalPositionSnapTarget: function(componentName) {
        if (!window.Scene3D || !window.DragDropSystem) {
            console.warn('[AssemblySystemSimplified] Scene3D o DragDropSystem non disponibili');
            return null;
        }

        // Trova l'oggetto nella scena
        const object = window.Scene3D.findModelByName(componentName);
        if (!object) {
            console.warn(`[AssemblySystemSimplified] Oggetto "${componentName}" non trovato nella scena`);
            return null;
        }

        // Ottieni posizione originale salvata dal DragDropSystem
        const originalPosition = window.DragDropSystem.originalPositions.get(object.uuid);
        if (!originalPosition) {
            console.warn(`[AssemblySystemSimplified] Posizione originale per "${componentName}" non trovata`);
            return null;
        }

        console.log(`[AssemblySystemSimplified] 🎯 Snap target per "${componentName}": (${originalPosition.x.toFixed(2)}, ${originalPosition.y.toFixed(2)}, ${originalPosition.z.toFixed(2)})`);
        return originalPosition.clone();
    },

    /**
     * Setup snap targets intercambiabili per tutti i componenti del gruppo corrente
     */
    setupGroupSnapTargets: function() {
        if (!window.DragDropSystem || this.allowedComponents.size === 0) {
            return;
        }

        const componentGroup = Array.from(this.allowedComponents);
        console.log(`[AssemblySystemSimplified] 🔗 Setup snap intercambiabili per gruppo: [${componentGroup.join(', ')}]`);

        // Per ogni componente del gruppo, configura snap verso le posizioni originali di tutti i componenti del gruppo
        componentGroup.forEach(componentName => {
            const snapTargets = [];

            // Aggiungi posizioni originali di tutti i componenti del gruppo come targets
            componentGroup.forEach(targetComponent => {
                const targetPosition = this.getOriginalPositionSnapTarget(targetComponent);
                if (targetPosition) {
                    snapTargets.push({
                        targetName: `${targetComponent}_original`,
                        position: targetPosition,
                        isPrimary: (targetComponent === componentName) // Target primario = propria posizione
                    });
                }
            });

            console.log(`[AssemblySystemSimplified] 🎯 Componente "${componentName}" ha ${snapTargets.length} snap targets nel gruppo`);
        });
    },

    /**
     * Verifica se un componente è montabile
     * @param {string} componentName - Nome del componente
     * @returns {boolean}
     */
    isComponentMountable: function(componentName) {
        if (!this.assemblyMode) {
            return true; // Modalità normale
        }

        // Verifica se è nei componenti permessi del gruppo corrente
        if (this.allowedComponents.size > 0 && !this.allowedComponents.has(componentName)) {
            console.log(`[AssemblySystemSimplified] ❌ Componente "${componentName}" non permesso in questo step`);
            return false;
        }

        console.log(`[AssemblySystemSimplified] ✅ Componente "${componentName}" montabile`);
        return true;
    },

    /**
     * Segna componente come montato
     * @param {string} componentName - Nome del componente
     * @param {THREE.Vector3} snapPosition - Posizione dello snap
     */
    markComponentMounted: function(componentName, snapPosition = null) {
        console.log(`[AssemblySystemSimplified] 🎯 markComponentMounted: "${componentName}"`);

        this.mountedComponents.set(componentName, snapPosition);

        // Salva stato per undo
        this.assemblyHistory.push({
            action: 'mount',
            component: componentName,
            position: snapPosition ? snapPosition.clone() : null,
            timestamp: Date.now()
        });

        console.log(`[AssemblySystemSimplified] 🔧 Componente montato: ${componentName}`);

        // Verifica se lo step è completato
        this.checkStepCompletion();
    },

    /**
     * Verifica se lo step corrente è completato
     * @returns {boolean}
     */
    isCurrentStepComplete: function() {
        if (!this.assemblyMode || this.allowedComponents.size === 0) {
            return true; // Nessun componente richiesto = completato
        }

        // Verifica che tutti i componenti permessi siano montati
        const requiredComponents = Array.from(this.allowedComponents);
        const mountedComponentsList = Array.from(this.mountedComponents.keys());

        const allMounted = requiredComponents.every(componentName =>
            mountedComponentsList.includes(componentName)
        );

        console.log(`[AssemblySystemSimplified] 🔍 Step "${this.currentStepName}" completato: ${allMounted}`);
        console.log(`  📋 Richiesti: [${requiredComponents.join(', ')}]`);
        console.log(`  ✅ Montati: [${mountedComponentsList.join(', ')}]`);

        return allMounted;
    },

    /**
     * Controlla completamento step e notifica TutorialManager
     */
    checkStepCompletion: function() {
        if (this.isCurrentStepComplete()) {
            console.log(`[AssemblySystemSimplified] 🎉 Step "${this.currentStepName}" COMPLETATO!`);

            // Notifica il TutorialManager per avanzare al prossimo step
            if (window.TutorialManager && typeof window.TutorialManager.advanceToNextStep === 'function') {
                setTimeout(() => {
                    console.log('[AssemblySystemSimplified] 📢 Notifica TutorialManager per avanzare...');
                    window.TutorialManager.advanceToNextStep();
                }, 500); // Breve delay per stabilità
            }
        }
    },

    /**
     * Ottiene tutti gli snap targets per componenti del gruppo corrente
     * @param {string} componentName - Nome del componente che si sta trascinando
     * @returns {Array} - Lista delle posizioni originali disponibili
     */
    getCurrentGroupSnapTargets: function(componentName) {
        const snapTargets = [];

        if (!this.allowedComponents.has(componentName)) {
            console.log(`[AssemblySystemSimplified] ❌ Componente "${componentName}" non appartiene al gruppo corrente`);
            return snapTargets;
        }

        console.log(`[AssemblySystemSimplified] 🎯 Ricerca snap targets per componente "${componentName}" nel gruppo corrente`);

        // Ottieni tutti i componenti del gruppo corrente (AllowedComponents)
        const groupComponents = Array.from(this.allowedComponents);

        groupComponents.forEach(groupComponent => {
            // Ottieni la posizione originale di ogni componente del gruppo
            const originalPosition = this.getOriginalPositionSnapTarget(groupComponent);
            if (originalPosition) {
                snapTargets.push({
                    targetName: groupComponent,
                    position: originalPosition,
                    isGroupMember: true,
                    isPrimary: (groupComponent === componentName) // Propria posizione = target primario
                });

                console.log(`[AssemblySystemSimplified] ➕ Snap target: "${groupComponent}" → (${originalPosition.x.toFixed(2)}, ${originalPosition.y.toFixed(2)}, ${originalPosition.z.toFixed(2)})`);
            }
        });

        console.log(`[AssemblySystemSimplified] 📊 Totale snap targets per "${componentName}": ${snapTargets.length}`);
        return snapTargets;
    },

    /**
     * Ottiene status completo assemblaggio
     * @returns {Object}
     */
    getAssemblyStatus: function() {
        const currentStepComplete = this.isCurrentStepComplete();

        return {
            enabled: this.enabled,
            assemblyMode: this.assemblyMode,
            currentStep: this.currentStepName,
            currentStepComplete: currentStepComplete,
            canAdvanceToNext: currentStepComplete, // Per compatibilità con DragDropSystem
            mountedComponents: Array.from(this.mountedComponents.keys()),
            allowedComponents: Array.from(this.allowedComponents),
            historyLength: this.assemblyHistory.length,
            requiredCount: this.allowedComponents.size,
            mountedCount: this.mountedComponents.size
        };
    },

    /**
     * Tutorial Step Management - Dummy methods per compatibilità
     * In AssemblySystemSimplified i tutorial step sono gestiti dall'UI,
     * non dall'assembly system
     */
    getNextStep: function() {
        // Non gestiamo i tutorial step qui - è responsabilità dell'UI
        console.log('[AssemblySystemSimplified] ℹ️ getNextStep() - Step management delegato a UI');
        return null; // Indica che non c'è prossimo step da gestire qui
    },

    setCurrentStep: function(stepName) {
        console.log(`[AssemblySystemSimplified] ℹ️ setCurrentStep("${stepName}") - Step management delegato a UI`);
        this.currentStepName = stepName;
        return true;
    },

    /**
     * Sistema Undo - Annulla ultima operazione
     * @returns {boolean}
     */
    undoAssembly: function() {
        if (this.assemblyHistory.length === 0) {
            console.log('[AssemblySystemSimplified] ❌ Nessuna operazione da annullare');
            return false;
        }

        const lastOperation = this.assemblyHistory.pop();

        if (lastOperation.action === 'mount') {
            this.mountedComponents.delete(lastOperation.component);
            console.log(`[AssemblySystemSimplified] ↶ Undo: Smontato ${lastOperation.component}`);
        }

        return true;
    },

    /**
     * Verifica se due componenti sono nello stesso gruppo AllowedComponents
     * @param {string} component1 - Nome primo componente
     * @param {string} component2 - Nome secondo componente
     * @returns {boolean} - true se sono nello stesso gruppo corrente
     */
    areComponentsInSameGroup: function(component1, component2) {
        const comp1InGroup = this.allowedComponents.has(component1);
        const comp2InGroup = this.allowedComponents.has(component2);

        const sameGroup = comp1InGroup && comp2InGroup;
        console.log(`[AssemblySystemSimplified] 🔄 Componenti "${component1}" e "${component2}" ${sameGroup ? 'SONO' : 'NON SONO'} nello stesso gruppo`);
        return sameGroup;
    },

    /**
     * Debug stato completo sistema
     */
    debugCurrentState: function() {
        console.group('[AssemblySystemSimplified] 🔍 DEBUG STATE');
        console.log('Enabled:', this.enabled);
        console.log('Assembly Mode:', this.assemblyMode);
        console.log('Current Step:', this.currentStepName);
        console.log('Mounted Components:', Array.from(this.mountedComponents.keys()));
        console.log('Allowed Components:', Array.from(this.allowedComponents));
        console.log('History Length:', this.assemblyHistory.length);
        console.log('Step Complete:', this.isCurrentStepComplete());
        console.groupEnd();
    }
};

// Inizializzazione automatica quando disponibile
if (typeof window !== 'undefined') {
    console.log('[AssemblySystemSimplified] 📦 Modulo caricato e disponibile globalmente');
}