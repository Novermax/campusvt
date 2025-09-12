/**
 * AssemblySystem.js - Sistema di Assemblaggio Sequenziale con Punti di Aggancio Multipli
 * 
 * Estende il DragDropSystem esistente con funzionalità avanzate:
 * - Sequenze di assemblaggio obbligatorie
 * - Punti di aggancio multipli per stesso componente
 * - Nodi di intercambiabilità (componenti sostituibili)
 * - Validazione assemblaggio con dipendenze
 * - Sistema undo/redo per assemblaggi
 * 
 * Versione: 1.0
 * Data: Settembre 2025
 */

window.AssemblySystem = {
    // Stato sistema
    enabled: false,
    assemblyMode: false,
    
    // Configurazione assemblaggio corrente
    currentConfig: null,
    currentStep: 0,
    
    // Gestori moduli specializzati
    assemblyManager: null,
    snapPointManager: null,
    interchangeableNodeSystem: null,
    visualFeedback: null,
    undoRedoSystem: null,
    
    // Stato assemblaggio
    mountedComponents: new Map(), // component_id -> snap_point_id
    occupiedSnapPoints: new Set(), // snap_point_ids occupati
    assemblyHistory: [], // Per undo/redo
    
    // Riferimenti sistemi esterni
    dragDropSystem: null,
    scene3D: null,
    
    /**
     * Inizializza il sistema di assemblaggio
     */
    init: function(scene3D) {
        console.log('[AssemblySystem] 🏗️ Inizializzazione sistema assemblaggio...');
        
        this.scene3D = scene3D;
        this.dragDropSystem = window.DragDropSystem;
        
        if (!this.dragDropSystem) {
            console.error('[AssemblySystem] Errore: DragDropSystem non disponibile');
            return false;
        }
        
        // Inizializza moduli specializzati
        this.initializeModules();
        
        console.log('[AssemblySystem] ✅ Sistema assemblaggio inizializzato');
        return true;
    },
    
    /**
     * Inizializza tutti i moduli specializzati
     */
    initializeModules: function() {
        // AssemblyManager - Gestisce sequenze e validazioni
        this.assemblyManager = new AssemblyManager(this);
        
        // SnapPointManager - Gestisce punti di aggancio multipli
        this.snapPointManager = new SnapPointManager(this);
        
        // InterchangeableNodeSystem - Gestisce nodi di intercambiabilità
        this.interchangeableNodeSystem = new InterchangeableNodeSystem(this);
        
        // VisualFeedback - Gestisce feedback visivo avanzato
        this.visualFeedback = new AssemblyVisualFeedback(this);
        
        // UndoRedoSystem - Gestisce undo/redo assemblaggio
        this.undoRedoSystem = new AssemblyUndoRedoSystem(this);
        
        console.log('[AssemblySystem] Moduli specializzati inizializzati');
    },
    
    /**
     * Abilita modalità assemblaggio con configurazione specifica
     * @param {Object} assemblyConfig - Configurazione assemblaggio
     * @param {number} startStep - Step di partenza (default: 0)
     */
    enableAssemblyMode: function(assemblyConfig, startStep = 0) {
        if (!assemblyConfig) {
            console.error('[AssemblySystem] Configurazione assemblaggio richiesta');
            return false;
        }
        
        console.log('[AssemblySystem] 🔧 Abilitazione modalità assemblaggio...');
        
        // Valida configurazione
        if (!this.assemblyManager.validateConfig(assemblyConfig)) {
            console.error('[AssemblySystem] Configurazione assemblaggio non valida');
            return false;
        }
        
        // Memorizza configurazione
        this.currentConfig = assemblyConfig;
        this.currentStep = startStep;
        
        // Abilita DragDropSystem se non già abilitato
        if (!this.dragDropSystem.isEnabled()) {
            this.dragDropSystem.enable();
        }
        
        // Inizializza state assemblaggio
        this.initializeAssemblyState();
        
        // Configura punti di snap multipli
        this.snapPointManager.configureSnapPoints(assemblyConfig.snapPoints);
        
        // Configura nodi intercambiabili
        this.interchangeableNodeSystem.configureNodes(assemblyConfig.interchangeableNodes);
        
        // Aggiorna feedback visivo
        this.visualFeedback.updateForAssemblyStep(this.currentStep);
        
        // Sostituisce handler drag & drop con quelli assemblaggio
        this.overrideDragDropHandlers();
        
        this.enabled = true;
        this.assemblyMode = true;
        
        console.log(`[AssemblySystem] ✅ Modalità assemblaggio abilitata - Step: ${startStep}`);
        return true;
    },
    
    /**
     * Disabilita modalità assemblaggio
     */
    disableAssemblyMode: function() {
        if (!this.enabled) {
            console.log('[AssemblySystem] Sistema già disabilitato');
            return;
        }
        
        console.log('[AssemblySystem] 🔴 Disabilitazione modalità assemblaggio...');
        
        // Ripristina handler originali DragDropSystem
        this.restoreOriginalHandlers();
        
        // Pulisce stato assemblaggio
        this.clearAssemblyState();
        
        // Pulisce feedback visivo
        this.visualFeedback.clearAllFeedback();
        
        // Reset configurazione
        this.currentConfig = null;
        this.currentStep = 0;
        
        this.enabled = false;
        this.assemblyMode = false;
        
        console.log('[AssemblySystem] ✅ Modalità assemblaggio disabilitata');
    },
    
    /**
     * Inizializza stato assemblaggio da configurazione
     */
    initializeAssemblyState: function() {
        this.mountedComponents.clear();
        this.occupiedSnapPoints.clear();
        this.assemblyHistory = [];
        
        // Se ci sono prerequisiti per lo step corrente, verificali
        this.assemblyManager.validateCurrentStep();
    },
    
    /**
     * Pulisce stato assemblaggio
     */
    clearAssemblyState: function() {
        this.mountedComponents.clear();
        this.occupiedSnapPoints.clear();
        this.assemblyHistory = [];
    },
    
    /**
     * Sostituisce handler DragDropSystem con quelli assemblaggio
     */
    overrideDragDropHandlers: function() {
        // Memorizza handler originali
        this._originalStartDrag = this.dragDropSystem.startDrag.bind(this.dragDropSystem);
        this._originalEndDrag = this.dragDropSystem.endDrag.bind(this.dragDropSystem);
        this._originalFindSnapTarget = this.dragDropSystem.findSnapTarget.bind(this.dragDropSystem);
        
        // Sostituisce con handler assemblaggio
        this.dragDropSystem.startDrag = this.onAssemblyStartDrag.bind(this);
        this.dragDropSystem.endDrag = this.onAssemblyEndDrag.bind(this);
        this.dragDropSystem.findSnapTarget = this.onAssemblyFindSnapTarget.bind(this);
        
        console.log('[AssemblySystem] Handler DragDrop sostituiti per assemblaggio');
    },
    
    /**
     * Ripristina handler originali DragDropSystem
     */
    restoreOriginalHandlers: function() {
        if (this._originalStartDrag) {
            this.dragDropSystem.startDrag = this._originalStartDrag;
        }
        if (this._originalEndDrag) {
            this.dragDropSystem.endDrag = this._originalEndDrag;
        }
        if (this._originalFindSnapTarget) {
            this.dragDropSystem.findSnapTarget = this._originalFindSnapTarget;
        }
        
        console.log('[AssemblySystem] Handler DragDrop originali ripristinati');
    },
    
    /* ===== ASSEMBLY DRAG HANDLERS ===== */
    
    /**
     * Handler personalizzato per inizio drag in modalità assemblaggio
     */
    onAssemblyStartDrag: function(object, intersectionPoint) {
        console.log(`[AssemblySystem] 🎯 Assembly StartDrag: ${object.name}`);
        
        // Verifica se componente è montabile nel step corrente
        if (!this.assemblyManager.isComponentMountable(object.name)) {
            console.log(`[AssemblySystem] ❌ Componente ${object.name} non montabile nello step corrente`);
            this.visualFeedback.showComponentBlocked(object);
            return; // Blocca il drag
        }
        
        // Esegue il drag normale
        this._originalStartDrag(object, intersectionPoint);
        
        // Aggiorna feedback visivo per assemblaggio
        this.visualFeedback.showAssemblyDragFeedback(object);
    },
    
    /**
     * Handler personalizzato per fine drag in modalità assemblaggio
     */
    onAssemblyEndDrag: function() {
        console.log('[AssemblySystem] 🏁 Assembly EndDrag');
        
        if (!this.dragDropSystem.draggedObject) {
            return;
        }
        
        const draggedObject = this.dragDropSystem.draggedObject;
        
        // Trova target di snap per assemblaggio (multi-point)
        const snapTarget = this.onAssemblyFindSnapTarget(draggedObject);
        
        if (snapTarget) {
            // Esegue snap assemblaggio con validazioni
            this.performAssemblySnap(draggedObject, snapTarget);
        }
        
        // Cleanup visivo
        this.visualFeedback.hideAssemblyDragFeedback();
        
        // Termina drag normale
        this.dragDropSystem.isDragging = false;
        this.dragDropSystem.draggedObject = null;
        this.dragDropSystem.canvas.style.cursor = 'default';
        
        // Riabilita sistema click
        if (this.scene3D && this.scene3D.animationSystem) {
            this.scene3D.animationSystem.clickEnabled = true;
        }
    },
    
    /**
     * Handler personalizzato per trovare target snap in modalità assemblaggio
     */
    onAssemblyFindSnapTarget: function(object) {
        if (!object || !this.currentConfig) return null;
        
        // Usa SnapPointManager per trovare punti di snap multipli
        const availableSnapPoints = this.snapPointManager.getAvailableSnapPoints(object.name);
        
        if (availableSnapPoints.length === 0) {
            return null;
        }
        
        // Trova il punto più vicino
        const closestSnapPoint = this.snapPointManager.findClosestSnapPoint(
            object.position, 
            availableSnapPoints
        );
        
        if (closestSnapPoint && closestSnapPoint.distance <= this.dragDropSystem.snapDistance) {
            return closestSnapPoint;
        }
        
        return null;
    },
    
    /**
     * Esegue snap assemblaggio con validazioni e registrazione history
     */
    performAssemblySnap: function(object, snapTarget) {
        console.log(`[AssemblySystem] 🎯 Assembly snap: ${object.name} -> ${snapTarget.id}`);
        
        // Salva stato per undo
        this.undoRedoSystem.saveState();
        
        // Registra montaggio
        this.mountedComponents.set(object.name, snapTarget.id);
        this.occupiedSnapPoints.add(snapTarget.id);
        
        // Esegue snap animato
        this.dragDropSystem.performSnap(object, snapTarget.position);
        
        // Aggiorna feedback visivo
        this.visualFeedback.showComponentMounted(object);
        
        // Verifica completamento step
        this.assemblyManager.checkStepCompletion();
    },
    
    /* ===== API PUBBLICHE ===== */
    
    /**
     * Imposta step corrente assemblaggio
     */
    setCurrentAssemblyStep: function(stepIndex) {
        if (!this.currentConfig || stepIndex < 0 || stepIndex >= this.currentConfig.sequence.length) {
            console.error('[AssemblySystem] Step index non valido');
            return false;
        }
        
        this.currentStep = stepIndex;
        console.log(`[AssemblySystem] Step assemblaggio aggiornato: ${stepIndex}`);
        
        // Aggiorna validazioni e feedback
        this.assemblyManager.validateCurrentStep();
        this.visualFeedback.updateForAssemblyStep(stepIndex);
        
        return true;
    },
    
    /**
     * Ottiene stato assemblaggio corrente
     */
    getAssemblyStatus: function() {
        return {
            enabled: this.enabled,
            assemblyMode: this.assemblyMode,
            currentStep: this.currentStep,
            totalSteps: this.currentConfig?.sequence.length || 0,
            mountedComponents: Array.from(this.mountedComponents.entries()),
            availableComponents: this.assemblyManager?.getAvailableComponents() || []
        };
    },
    
    /**
     * Valida sequenza assemblaggio corrente
     */
    validateAssemblySequence: function() {
        if (!this.assemblyManager) {
            return { valid: false, errors: ['AssemblyManager non inizializzato'] };
        }
        
        return this.assemblyManager.validateFullSequence();
    },
    
    /**
     * Ottiene punti di snap disponibili per un componente
     */
    getAvailableSnapPoints: function(componentName) {
        if (!this.snapPointManager) {
            return [];
        }
        
        return this.snapPointManager.getAvailableSnapPoints(componentName);
    },
    
    /**
     * Verifica se componente è montabile
     */
    isComponentMountable: function(componentName) {
        if (!this.assemblyManager) {
            return false;
        }
        
        return this.assemblyManager.isComponentMountable(componentName);
    },
    
    /**
     * Undo ultimo montaggio
     */
    undo: function() {
        if (!this.undoRedoSystem) {
            return false;
        }
        
        return this.undoRedoSystem.undo();
    },
    
    /**
     * Redo ultimo montaggio annullato
     */
    redo: function() {
        if (!this.undoRedoSystem) {
            return false;
        }
        
        return this.undoRedoSystem.redo();
    },
    
    /**
     * Reset completo assemblaggio
     */
    reset: function() {
        console.log('[AssemblySystem] Reset completo sistema assemblaggio...');
        
        this.disableAssemblyMode();
        this.clearAssemblyState();
        
        // Reset moduli
        this.assemblyManager?.reset();
        this.snapPointManager?.reset();
        this.interchangeableNodeSystem?.reset();
        this.visualFeedback?.reset();
        this.undoRedoSystem?.reset();
        
        console.log('[AssemblySystem] ✅ Reset completato');
    },
    
    /**
     * Dispose completo sistema
     */
    dispose: function() {
        console.log('[AssemblySystem] Dispose sistema assemblaggio...');
        
        this.reset();
        
        // Dispose moduli
        this.assemblyManager?.dispose();
        this.snapPointManager?.dispose();
        this.interchangeableNodeSystem?.dispose();
        this.visualFeedback?.dispose();
        this.undoRedoSystem?.dispose();
        
        // Clear riferimenti
        this.assemblyManager = null;
        this.snapPointManager = null;
        this.interchangeableNodeSystem = null;
        this.visualFeedback = null;
        this.undoRedoSystem = null;
        this.dragDropSystem = null;
        this.scene3D = null;
        
        console.log('[AssemblySystem] ✅ Dispose completato');
    }
};

/* ===== MODULI SPECIALIZZATI ===== */

/**
 * AssemblyManager - Gestisce sequenze e validazioni assemblaggio
 */
class AssemblyManager {
    constructor(assemblySystem) {
        this.assembly = assemblySystem;
        this.config = null;
    }
    
    /**
     * Valida configurazione assemblaggio
     */
    validateConfig(config) {
        if (!config.sequence || !Array.isArray(config.sequence)) {
            console.error('[AssemblyManager] Sequenza assemblaggio mancante');
            return false;
        }
        
        if (!config.snapPoints || typeof config.snapPoints !== 'object') {
            console.error('[AssemblyManager] Punti di snap mancanti');
            return false;
        }
        
        this.config = config;
        return true;
    }
    
    /**
     * Verifica se componente è montabile nello step corrente
     */
    isComponentMountable(componentName) {
        if (!this.config) return false;
        
        const currentStepComponents = this.getCurrentStepComponents();
        
        // Verifica se componente fa parte dello step corrente
        if (!currentStepComponents.includes(componentName)) {
            return false;
        }
        
        // Verifica dipendenze
        return this.checkDependencies(componentName);
    }
    
    /**
     * Ottiene componenti dello step corrente
     */
    getCurrentStepComponents() {
        if (!this.config || this.assembly.currentStep >= this.config.sequence.length) {
            return [];
        }
        
        const currentStepName = this.config.sequence[this.assembly.currentStep];
        
        // Se è un nodo intercambiabile, ottieni tutti i componenti del nodo
        if (this.config.interchangeableNodes && this.config.interchangeableNodes[currentStepName]) {
            return this.config.interchangeableNodes[currentStepName];
        }
        
        // Altrimenti è un componente singolo
        return [currentStepName];
    }
    
    /**
     * Verifica dipendenze per un componente
     */
    checkDependencies(componentName) {
        if (!this.config.dependencies) return true;
        
        const dependencies = this.config.dependencies[componentName];
        if (!dependencies) return true;
        
        // Verifica che tutte le dipendenze siano montate
        return dependencies.every(dep => {
            return Array.from(this.assembly.mountedComponents.keys()).includes(dep) ||
                   this.isNodeMounted(dep);
        });
    }
    
    /**
     * Verifica se un nodo (gruppo componenti) è montato
     */
    isNodeMounted(nodeName) {
        if (!this.config.interchangeableNodes || !this.config.interchangeableNodes[nodeName]) {
            return false;
        }
        
        const nodeComponents = this.config.interchangeableNodes[nodeName];
        return nodeComponents.some(component => 
            this.assembly.mountedComponents.has(component)
        );
    }
    
    /**
     * Verifica completamento step corrente
     */
    checkStepCompletion() {
        const currentComponents = this.getCurrentStepComponents();
        
        // Conta quanti componenti dello step sono montati
        const mountedCount = currentComponents.filter(component => 
            this.assembly.mountedComponents.has(component)
        ).length;
        
        // Per nodi intercambiabili, basta un componente montato
        const isNodeStep = this.config.interchangeableNodes && 
                          this.config.interchangeableNodes[this.config.sequence[this.assembly.currentStep]];
        
        const required = isNodeStep ? 1 : currentComponents.length;
        
        if (mountedCount >= required) {
            console.log(`[AssemblyManager] ✅ Step ${this.assembly.currentStep} completato`);
            this.assembly.setCurrentAssemblyStep(this.assembly.currentStep + 1);
        }
    }
    
    /**
     * Ottiene componenti disponibili per il montaggio
     */
    getAvailableComponents() {
        return this.getCurrentStepComponents().filter(component => 
            this.isComponentMountable(component)
        );
    }
    
    /**
     * Valida sequenza assemblaggio completa
     */
    validateFullSequence() {
        const errors = [];
        
        // Verifica cicli nelle dipendenze
        this.config.sequence.forEach(step => {
            if (this.hasCyclicDependency(step, [])) {
                errors.push(`Dipendenza ciclica rilevata per step: ${step}`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Verifica dipendenze cicliche
     */
    hasCyclicDependency(component, visited) {
        if (visited.includes(component)) {
            return true;
        }
        
        const dependencies = this.config.dependencies?.[component] || [];
        const newVisited = [...visited, component];
        
        return dependencies.some(dep => 
            this.hasCyclicDependency(dep, newVisited)
        );
    }
    
    /**
     * Valida step corrente
     */
    validateCurrentStep() {
        const available = this.getAvailableComponents();
        console.log(`[AssemblyManager] Step ${this.assembly.currentStep}: ${available.length} componenti disponibili`);
    }
    
    reset() {
        this.config = null;
    }
    
    dispose() {
        this.reset();
        this.assembly = null;
    }
}

/**
 * SnapPointManager - Gestisce punti di aggancio multipli
 */
class SnapPointManager {
    constructor(assemblySystem) {
        this.assembly = assemblySystem;
        this.snapPointsConfig = null;
        this.snapPointObjects = new Map(); // snap_point_id -> THREE.Object3D
    }
    
    /**
     * Configura punti di snap da configurazione
     */
    configureSnapPoints(snapPointsConfig) {
        this.snapPointsConfig = snapPointsConfig;
        this.createSnapPointObjects();
        console.log(`[SnapPointManager] Configurati punti snap per ${Object.keys(snapPointsConfig).length} componenti`);
    }
    
    /**
     * Crea oggetti 3D per rappresentare i punti di snap
     */
    createSnapPointObjects() {
        this.clearSnapPointObjects();
        
        Object.entries(this.snapPointsConfig).forEach(([componentName, config]) => {
            config.positions.forEach(snapPoint => {
                this.createSnapPointObject(snapPoint);
            });
        });
    }
    
    /**
     * Crea singolo oggetto punto di snap
     */
    createSnapPointObject(snapPoint) {
        const geometry = new THREE.SphereGeometry(0.05, 8, 6);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            visible: false
        });
        
        const snapObject = new THREE.Mesh(geometry, material);
        snapObject.position.set(...snapPoint.position);
        snapObject.rotation.set(...snapPoint.rotation);
        snapObject.name = `SnapPoint_${snapPoint.id}`;
        
        this.snapPointObjects.set(snapPoint.id, snapObject);
        this.assembly.scene3D.scene.add(snapObject);
    }
    
    /**
     * Ottiene punti di snap disponibili per un componente
     */
    getAvailableSnapPoints(componentName) {
        const config = this.snapPointsConfig?.[componentName];
        if (!config) return [];
        
        // Filtra punti non occupati
        return config.positions.filter(snapPoint => 
            !this.assembly.occupiedSnapPoints.has(snapPoint.id)
        );
    }
    
    /**
     * Trova il punto di snap più vicino alla posizione
     */
    findClosestSnapPoint(position, availableSnapPoints) {
        if (!availableSnapPoints.length) return null;
        
        let closest = null;
        let minDistance = Infinity;
        
        availableSnapPoints.forEach(snapPoint => {
            const snapPos = new THREE.Vector3(...snapPoint.position);
            const distance = position.distanceTo(snapPos);
            
            if (distance < minDistance) {
                minDistance = distance;
                closest = {
                    ...snapPoint,
                    position: snapPos,
                    distance: distance
                };
            }
        });
        
        return closest;
    }
    
    /**
     * Mostra punti di snap disponibili
     */
    showAvailableSnapPoints(componentName) {
        const available = this.getAvailableSnapPoints(componentName);
        
        available.forEach(snapPoint => {
            const snapObject = this.snapPointObjects.get(snapPoint.id);
            if (snapObject) {
                snapObject.visible = true;
                snapObject.material.color.setHex(0x00ff00); // Verde
            }
        });
    }
    
    /**
     * Nasconde tutti i punti di snap
     */
    hideAllSnapPoints() {
        this.snapPointObjects.forEach(snapObject => {
            snapObject.visible = false;
        });
    }
    
    /**
     * Pulisce oggetti punti di snap
     */
    clearSnapPointObjects() {
        this.snapPointObjects.forEach(snapObject => {
            this.assembly.scene3D.scene.remove(snapObject);
            snapObject.geometry.dispose();
            snapObject.material.dispose();
        });
        this.snapPointObjects.clear();
    }
    
    reset() {
        this.clearSnapPointObjects();
        this.snapPointsConfig = null;
    }
    
    dispose() {
        this.reset();
        this.assembly = null;
    }
}

/**
 * InterchangeableNodeSystem - Gestisce nodi di intercambiabilità
 */
class InterchangeableNodeSystem {
    constructor(assemblySystem) {
        this.assembly = assemblySystem;
        this.nodesConfig = null;
    }
    
    /**
     * Configura nodi intercambiabili
     */
    configureNodes(nodesConfig) {
        this.nodesConfig = nodesConfig;
        console.log(`[InterchangeableNodeSystem] Configurati ${Object.keys(nodesConfig).length} nodi intercambiabili`);
    }
    
    /**
     * Ottiene componenti intercambiabili per un nodo
     */
    getInterchangeableComponents(nodeName) {
        return this.nodesConfig?.[nodeName] || [];
    }
    
    /**
     * Verifica se due componenti sono intercambiabili
     */
    areInterchangeable(componentA, componentB) {
        for (const [nodeName, components] of Object.entries(this.nodesConfig || {})) {
            if (components.includes(componentA) && components.includes(componentB)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Ottiene nodo di appartenenza di un componente
     */
    getComponentNode(componentName) {
        for (const [nodeName, components] of Object.entries(this.nodesConfig || {})) {
            if (components.includes(componentName)) {
                return nodeName;
            }
        }
        return null;
    }
    
    reset() {
        this.nodesConfig = null;
    }
    
    dispose() {
        this.reset();
        this.assembly = null;
    }
}

/**
 * AssemblyVisualFeedback - Gestisce feedback visivo avanzato
 */
class AssemblyVisualFeedback {
    constructor(assemblySystem) {
        this.assembly = assemblySystem;
        this.materials = {
            available: null,    // Verde - componente montabile
            blocked: null,      // Rosso - componente bloccato
            mounted: null,      // Blu - componente montato
            dragging: null      // Giallo - componente in drag
        };
        
        this.initMaterials();
    }
    
    /**
     * Inizializza materiali per feedback
     */
    initMaterials() {
        this.materials.available = new THREE.MeshBasicMaterial({
            color: 0x00ff00, transparent: true, opacity: 0.6
        });
        
        this.materials.blocked = new THREE.MeshBasicMaterial({
            color: 0xff0000, transparent: true, opacity: 0.6
        });
        
        this.materials.mounted = new THREE.MeshBasicMaterial({
            color: 0x0000ff, transparent: true, opacity: 0.6
        });
        
        this.materials.dragging = new THREE.MeshBasicMaterial({
            color: 0xffff00, transparent: true, opacity: 0.7
        });
    }
    
    /**
     * Aggiorna feedback per step assemblaggio
     */
    updateForAssemblyStep(stepIndex) {
        if (!this.assembly.assemblyManager) return;
        
        const availableComponents = this.assembly.assemblyManager.getAvailableComponents();
        
        // Mostra componenti disponibili in verde
        availableComponents.forEach(componentName => {
            this.highlightComponent(componentName, 'available');
        });
        
        // Mostra punti di snap per componenti disponibili
        availableComponents.forEach(componentName => {
            this.assembly.snapPointManager.showAvailableSnapPoints(componentName);
        });
        
        console.log(`[AssemblyVisualFeedback] Feedback aggiornato per step ${stepIndex}`);
    }
    
    /**
     * Evidenzia componente con colore specifico
     */
    highlightComponent(componentName, materialType) {
        const component = this.findComponentByName(componentName);
        if (!component) return;
        
        // Salva materiale originale se non già fatto
        if (!component._originalMaterial) {
            component._originalMaterial = component.material;
        }
        
        // Applica materiale feedback
        component.material = this.materials[materialType];
    }
    
    /**
     * Trova componente per nome
     */
    findComponentByName(componentName) {
        const loadedModels = this.assembly.scene3D.loadedModels || [];
        return loadedModels.find(model => {
            const cleanName = model.name.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');
            return cleanName === componentName.toLowerCase();
        });
    }
    
    /**
     * Mostra feedback componente bloccato
     */
    showComponentBlocked(component) {
        this.highlightComponent(component.name, 'blocked');
        
        // Timer per reset
        setTimeout(() => {
            this.restoreComponentMaterial(component);
        }, 2000);
    }
    
    /**
     * Mostra feedback drag assemblaggio
     */
    showAssemblyDragFeedback(component) {
        this.highlightComponent(component.name, 'dragging');
        
        // Mostra punti di snap per questo componente
        this.assembly.snapPointManager.showAvailableSnapPoints(component.name);
    }
    
    /**
     * Nasconde feedback drag assemblaggio
     */
    hideAssemblyDragFeedback() {
        this.assembly.snapPointManager.hideAllSnapPoints();
    }
    
    /**
     * Mostra componente montato
     */
    showComponentMounted(component) {
        this.highlightComponent(component.name, 'mounted');
    }
    
    /**
     * Ripristina materiale originale componente
     */
    restoreComponentMaterial(component) {
        if (component._originalMaterial) {
            component.material = component._originalMaterial;
        }
    }
    
    /**
     * Pulisce tutto il feedback
     */
    clearAllFeedback() {
        const loadedModels = this.assembly.scene3D.loadedModels || [];
        loadedModels.forEach(model => {
            this.restoreComponentMaterial(model);
        });
        
        this.assembly.snapPointManager.hideAllSnapPoints();
    }
    
    reset() {
        this.clearAllFeedback();
    }
    
    dispose() {
        this.reset();
        
        // Dispose materiali
        Object.values(this.materials).forEach(material => {
            material?.dispose();
        });
        
        this.assembly = null;
    }
}

/**
 * AssemblyUndoRedoSystem - Gestisce undo/redo assemblaggio
 */
class AssemblyUndoRedoSystem {
    constructor(assemblySystem) {
        this.assembly = assemblySystem;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
    }
    
    /**
     * Salva stato corrente per undo
     */
    saveState() {
        const state = {
            mountedComponents: new Map(this.assembly.mountedComponents),
            occupiedSnapPoints: new Set(this.assembly.occupiedSnapPoints),
            currentStep: this.assembly.currentStep,
            timestamp: Date.now()
        };
        
        this.undoStack.push(state);
        
        // Limita dimensione stack
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        
        // Pulisce redo stack quando si salva nuovo stato
        this.redoStack = [];
        
        console.log(`[UndoRedoSystem] Stato salvato - Stack size: ${this.undoStack.length}`);
    }
    
    /**
     * Undo ultimo montaggio
     */
    undo() {
        if (this.undoStack.length === 0) {
            console.log('[UndoRedoSystem] Nulla da undofare');
            return false;
        }
        
        // Salva stato corrente nel redo stack
        this.redoStack.push({
            mountedComponents: new Map(this.assembly.mountedComponents),
            occupiedSnapPoints: new Set(this.assembly.occupiedSnapPoints),
            currentStep: this.assembly.currentStep,
            timestamp: Date.now()
        });
        
        // Ripristina stato precedente
        const previousState = this.undoStack.pop();
        this.restoreState(previousState);
        
        console.log(`[UndoRedoSystem] ✅ Undo eseguito - Stack size: ${this.undoStack.length}`);
        return true;
    }
    
    /**
     * Redo ultimo montaggio annullato
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('[UndoRedoSystem] Nulla da rifare');
            return false;
        }
        
        // Salva stato corrente nell'undo stack
        this.undoStack.push({
            mountedComponents: new Map(this.assembly.mountedComponents),
            occupiedSnapPoints: new Set(this.assembly.occupiedSnapPoints),
            currentStep: this.assembly.currentStep,
            timestamp: Date.now()
        });
        
        // Ripristina stato successivo
        const nextState = this.redoStack.pop();
        this.restoreState(nextState);
        
        console.log(`[UndoRedoSystem] ✅ Redo eseguito - Redo stack size: ${this.redoStack.length}`);
        return true;
    }
    
    /**
     * Ripristina stato assemblaggio
     */
    restoreState(state) {
        this.assembly.mountedComponents = new Map(state.mountedComponents);
        this.assembly.occupiedSnapPoints = new Set(state.occupiedSnapPoints);
        this.assembly.currentStep = state.currentStep;
        
        // Aggiorna posizioni fisiche componenti
        this.restorePhysicalPositions();
        
        // Aggiorna feedback visivo
        this.assembly.visualFeedback.updateForAssemblyStep(state.currentStep);
    }
    
    /**
     * Ripristina posizioni fisiche componenti
     */
    restorePhysicalPositions() {
        // Per ogni componente montato, ripristina la posizione
        this.assembly.mountedComponents.forEach((snapPointId, componentName) => {
            const component = this.assembly.visualFeedback.findComponentByName(componentName);
            const snapPointConfig = this.findSnapPointConfig(snapPointId);
            
            if (component && snapPointConfig) {
                component.position.set(...snapPointConfig.position);
                component.rotation.set(...snapPointConfig.rotation);
            }
        });
        
        // Per componenti non montati, ripristina posizione originale
        const loadedModels = this.assembly.scene3D.loadedModels || [];
        loadedModels.forEach(model => {
            if (!this.assembly.mountedComponents.has(model.name)) {
                const originalPos = this.assembly.dragDropSystem.originalPositions.get(model.uuid);
                const originalRot = this.assembly.dragDropSystem.originalRotations.get(model.uuid);
                
                if (originalPos) model.position.copy(originalPos);
                if (originalRot) model.rotation.copy(originalRot);
            }
        });
    }
    
    /**
     * Trova configurazione snap point per ID
     */
    findSnapPointConfig(snapPointId) {
        const snapPointsConfig = this.assembly.snapPointManager.snapPointsConfig;
        if (!snapPointsConfig) return null;
        
        for (const [componentName, config] of Object.entries(snapPointsConfig)) {
            const snapPoint = config.positions.find(sp => sp.id === snapPointId);
            if (snapPoint) return snapPoint;
        }
        
        return null;
    }
    
    reset() {
        this.undoStack = [];
        this.redoStack = [];
    }
    
    dispose() {
        this.reset();
        this.assembly = null;
    }
}