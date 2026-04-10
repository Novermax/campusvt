/**
 * DragDropSnapConfig.js - Configurazione snap, object registry, indicatori
 * Mixin: aggiunge metodi a window.DragDropSystem
 */
(function() {
    const DDS = window.DragDropSystem;

    DDS.setDraggableObjects = function(objectNames) {
        this.whitelistedObjects.clear();
        
        if (!Array.isArray(objectNames)) {
            console.warn('[DragDropSystem] objectNames deve essere un array');
            return;
        }
        
        objectNames.forEach(name => {
            this.whitelistedObjects.add(name.toLowerCase());
        });
        
        this.detectDraggableObjects();
        
        console.log(`[DragDropSystem] Whitelist aggiornata: ${objectNames.length} oggetti`);
    };
    /**
     * Rileva oggetti draggabili dal scene basandosi su whitelist o tutti i modelli
     */
    DDS.detectDraggableObjects = function() {
        this.draggableObjects = [];
        
        // Accede ai modelli caricati tramite Scene3D
        const loadedModels = window.Scene3D?.loadedModels || [];
        
        loadedModels.forEach(model => {
            if (this.isDraggableObject(model)) {
                this.draggableObjects.push(model);
            }
        });
        
        console.log(`[DragDropSystem] Rilevati ${this.draggableObjects.length} oggetti draggabili`);
    };
    /**
     * Verifica se un oggetto è draggabile
     * @param {THREE.Object3D} obj - Oggetto da verificare
     * @returns {boolean}
     */
    DDS.isDraggableObject = function(obj) {
        if (!obj || !obj.name) return false;

        const cleanName = obj.name.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');

        // PRIMO CONTROLLO: Blacklist - oggetti mai draggabili (priorità assoluta)
        if (this.blacklistedObjects.has(cleanName)) {
            console.log(`[DragDropSystem] 🚫 Oggetto "${cleanName}" è in blacklist - non draggabile`);
            return false;
        }

        // DEBUG MODE: Bypass controlli per troubleshooting
        if (this.debugMode) {
            console.log(`[DragDropSystem] 🔧 DEBUG MODE: "${cleanName}" sempre draggabile`);
            return true;
        }

        // MODALITÀ ASSEMBLAGGIO: Solo whitelist (restrittiva)
        if (window.AssemblySystem && window.AssemblySystem.enabled) {
            console.log(`[DragDropSystem] 🔍 ASSEMBLY MODE CHECK per "${cleanName}"`);
            console.log(`  - AssemblySystem abilitato: ${window.AssemblySystem.enabled}`);
            console.log(`  - AssemblySystem assemblyMode: ${window.AssemblySystem.assemblyMode}`);
            console.log(`  - Whitelist size: ${this.whitelistedObjects.size}`);
            console.log(`  - Whitelist contenuto: [${Array.from(this.whitelistedObjects).join(', ')}]`);

            // In modalità assemblaggio, SOLO gli oggetti in whitelist sono draggabili
            if (this.whitelistedObjects.size === 0) {
                console.log(`[DragDropSystem] 🔒 Modalità assemblaggio: nessuna whitelist - "${cleanName}" non draggabile`);
                return false;
            }

            const isInWhitelist = this.whitelistedObjects.has(cleanName);
            console.log(`  - "${cleanName}" in whitelist: ${isInWhitelist}`);

            if (!isInWhitelist) {
                console.log(`[DragDropSystem] 🔒 Modalità assemblaggio: "${cleanName}" non in whitelist - non draggabile`);
                return false;
            }

            // Verifica anche se è montabile secondo AssemblySystem
            let isMountable = true;
            try {
                isMountable = window.AssemblySystem.isComponentMountable(cleanName);
                console.log(`  - "${cleanName}" montabile (AssemblySystem): ${isMountable}`);
            } catch (error) {
                console.warn(`[DragDropSystem] ⚠️ Errore verifica montabilità per "${cleanName}":`, error);
                // In caso di errore, permetti il drag per non bloccare il sistema
                isMountable = true;
            }

            if (!isMountable) {
                console.log(`[DragDropSystem] ❌ Componente "${cleanName}" in whitelist ma non montabile (AssemblySystem)`);
                return false;
            }

            console.log(`[DragDropSystem] ✅ Modalità assemblaggio: "${cleanName}" draggabile (whitelist + montabile)`);
            return true;
        }

        // MODALITÀ NORMALE: Usa whitelist se presente, altrimenti fallback keywords
        if (this.whitelistedObjects.size > 0) {
            const isInWhitelist = this.whitelistedObjects.has(cleanName);

            // Durante sincronizzazione step, la whitelist ha priorità assoluta
            if (this.isStepSyncing) {
                console.log(`[DragDropSystem] 🔄 Durante sincronizzazione: "${cleanName}" whitelist=${isInWhitelist}`);
                return isInWhitelist;
            }

            return isInWhitelist;
        }

        // Fallback per modalità normale senza whitelist: escludi oggetti non selezionabili
        const nonDraggableKeywords = [
            'pavimento', 'piano', 'base', 'superficie', 'ground', 'floor',
            'basement', 'sfondo', 'background', 'assi', 'axis', 'gizmo'
        ];

        return !nonDraggableKeywords.some(keyword =>
            cleanName.includes(keyword)
        );
    };
    /**
     * Memorizza le posizioni e rotazioni originali di tutti gli oggetti draggabili
     * Se draggableObjects non è ancora definito, salva tutti i modelli caricati
    DDS.createSnapIndicators = function() {
        this.removeAllSnapIndicators();
        
        this.draggableObjects.forEach(obj => {
            this.createSnapIndicatorForObject(obj);
        });
        
        console.log(`[DragDropSystem] Creati ${this.snapIndicators.size} indicatori snap`);
    };
    /**
     * Crea indicatore snap per un singolo oggetto
     * @param {THREE.Object3D} obj - Oggetto per cui creare l'indicatore
     */
    DDS.createSnapIndicatorForObject = function(obj) {
        const originalPos = this.originalPositions.get(obj.uuid);
        if (!originalPos) return;
        
        // Crea sfera verde piccola per snap zone
        const sphereGeometry = new THREE.SphereGeometry(
            0.05,                     // Raggio fisso piccolo (5cm)
            12,                       // Segmenti larghezza
            8                         // Segmenti altezza
        );

        // Materiale sfera verde semplice
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,          // Verde fisso
            transparent: false,        // Non trasparente
            wireframe: false          // Sfera piena normale
        });

        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.copy(originalPos);
        sphere.name = `SnapIndicator_${obj.name}`;
        sphere.visible = false; // Nascosto di default

        console.log(`[DragDropSystem] 🎯 Creata sfera snap verde per ${obj.name} alla posizione:`, originalPos);

        this.snapIndicators.set(obj.uuid, sphere);
        this.scene.add(sphere);
    };
    /**
     * Rimuove tutti gli indicatori snap
     */
    DDS.removeAllSnapIndicators = function() {
        this.snapIndicators.forEach(indicator => {
            this.scene.remove(indicator);
            indicator.geometry?.dispose();
            indicator.material?.dispose();
        });
        this.snapIndicators.clear();
    };
    /**
     * Aggiorna gli indicatori snap in base al componente correntemente trascinato
     * Mostra punti di snap originali + quelli intercambiabili
     */
    DDS.updateSnapIndicators = function() {
        // Se gli indicatori sono disabilitati, non creare nulla
        if (!this.showSnapIndicators) {
            return;
        }

        // Prima rimuovi tutti gli indicatori esistenti
        this.removeAllSnapIndicators();

        // Se non c'è un oggetto trascinato, non mostrare indicatori
        if (!this.draggedObject) {
            return;
        }

        const objectName = this.draggedObject.name.toLowerCase().trim();
        console.log(`[DragDropSystem] 🔄 Aggiornamento indicatori snap per "${objectName}"`);

        // 1. Crea indicatore per posizione originale (sempre)
        const originalPos = this.originalPositions.get(this.draggedObject.uuid);
        if (originalPos) {
            this.createSingleSnapIndicator(this.draggedObject.uuid, originalPos, 0x00ff00, `Original_${objectName}`);
            console.log(`[DragDropSystem] ➕ Indicatore posizione originale creato`);
        }

        // 2. Crea indicatori per posizioni originali di altri componenti intercambiabili
        if (window.AssemblySystem && window.AssemblySystem.assemblyMode && window.AssemblySystem.currentConfig) {
            const interchangeableTargets = window.AssemblySystem.getInterchangeableSnapTargets(objectName);

            if (interchangeableTargets.length > 0) {
                console.log(`[DragDropSystem] 🎯 Creazione ${interchangeableTargets.length} indicatori per posizioni intercambiabili`);

                interchangeableTargets.forEach((target, index) => {
                    // DEBUG: Verifica posizioni
                    console.log(`[DragDropSystem] 🔍 Target ${index + 1}: "${target.targetName}" alla posizione (${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)}, ${target.position.z.toFixed(3)})`);

                    // Colore arancione per posizioni di altri componenti intercambiabili
                    const color = 0xff8800;
                    const uniqueId = `${this.draggedObject.uuid}_interchangeable_${index}`;

                    this.createSingleSnapIndicator(uniqueId, target.position, color, `Interch_${target.targetName}`);
                });

                console.log(`[DragDropSystem] ✅ Creati ${interchangeableTargets.length} indicatori intercambiabili`);
            } else {
                console.log(`[DragDropSystem] ℹ️ Nessun target intercambiabile trovato per "${objectName}"`);
            }
        }

        console.log(`[DragDropSystem] 📊 Totale indicatori snap attivi: ${this.snapIndicators.size}`);
    };
    /**
     * Crea un singolo indicatore snap
     * @param {string} id - ID univoco per l'indicatore
     * @param {THREE.Vector3} position - Posizione dell'indicatore
     * @param {number} color - Colore esadecimale
     * @param {string} name - Nome dell'indicatore
     */
    DDS.createSingleSnapIndicator = function(id, position, color, name) {
        const sphereGeometry = new THREE.SphereGeometry(0.05, 12, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            wireframe: false
        });

        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.copy(position);
        sphere.name = `SnapIndicator_${name}`;
        sphere.visible = true; // Visibile quando viene creato durante il drag

        this.snapIndicators.set(id, sphere);
        this.scene.add(sphere);

        console.log(`[DragDropSystem] 🎯 Indicatore "${name}" creato alla posizione (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    };
    /* ===== STATE QUERIES ===== */

    DDS.isEnabled = function() {
        return this.enabled;
    };
    /**
     * Aggiunge un oggetto alla blacklist (non draggabile)
     * @param {string} objectName - Nome dell'oggetto da blacklistare
     */
    DDS.addToBlacklist = function(objectName) {
        const cleanName = objectName.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');
        this.blacklistedObjects.add(cleanName);
        console.log(`[DragDropSystem] 🚫 Aggiunto "${cleanName}" alla blacklist`);
    };
    /**
     * Rimuove un oggetto dalla blacklist
     * @param {string} objectName - Nome dell'oggetto da rimuovere dalla blacklist
     */
    DDS.removeFromBlacklist = function(objectName) {
        const cleanName = objectName.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');
        this.blacklistedObjects.delete(cleanName);
        console.log(`[DragDropSystem] ✅ Rimosso "${cleanName}" dalla blacklist`);
    };
    /**
     * Ottiene la lista degli oggetti in blacklist
     * @returns {Array<string>}
     */
    DDS.getBlacklistedObjects = function() {
        return Array.from(this.blacklistedObjects);
    };
    /**
     * Ottiene stato dragging
     * @returns {boolean}
     */
    DDS.isDraggingActive = function() {
        return this.isDragging;
    };
    /**
     * Verifica se l'utensile corretto è attivo per il drag & drop
     * @returns {boolean}
     */
    DDS.isCorrectToolActive = function() {
        // Verifica se ToolsManager è disponibile
        if (!window.ToolsManager) {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile - drag permesso (fallback)`);
            return true; // Fallback: permetti drag se ToolsManager non è disponibile
        }

        // Ottieni utensile attualmente attivo
        if (!window.ToolsManager || typeof window.ToolsManager.getActiveTool !== 'function') {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile o getActiveTool non è una funzione - drag permesso (fallback)`);
            return true; // Fallback: permetti drag se ToolsManager non è disponibile
        }

        const activeTool = window.ToolsManager.getActiveTool();
        const isHandActive = (activeTool === 'mano' || activeTool === 'Mani');

        console.log(`[DragDropSystem] 🔧 Controllo utensile: attivo="${activeTool}", richiesto="mano", permesso=${isHandActive}`);

        return isHandActive;
    };
    /**
     * Mostra messaggio che richiede selezione utensile "Mano"
     */
    DDS.showToolRequiredMessage = function() {
        // Aggiorna status nell'interfaccia utente se disponibile
        if (window.UI && window.UI.core && window.UI.core.updateStatus) {
            window.UI.core.updateStatus('⚠️ Seleziona l\'utensile "Mano" per trascinare gli oggetti');
        } else {
            console.warn(`[DragDropSystem] 💡 SELEZIONA UTENSILE "MANO" per trascinare gli oggetti`);
        }
    };
    DDS.createSnapPositionKey = function(targetName, position) {
        if (targetName) {
            // Per SnapTargets: usa il nome del target
            return `target_${targetName}`;
        } else if (position) {
            // Per SnapPoints: usa coordinate arrotondate
            const x = position.x.toFixed(3);
            const y = position.y.toFixed(3);
            const z = position.z.toFixed(3);
            return `coord_${x}_${y}_${z}`;
        }
        return null;
    };
    /**
     * Occupa una posizione di snap per un oggetto
     * @param {string} positionKey - Chiave univoca posizione
     * @param {THREE.Object3D} object - Oggetto che occupa la posizione
     */
    DDS.occupySnapPosition = function(positionKey, object) {
        if (!positionKey) return;

        // Libera posizione precedente se l'oggetto ne occupava già una
        const previousKey = this.objectSnapPosition.get(object.uuid);
        if (previousKey) {
            this.occupiedSnapPositions.delete(previousKey);
            console.log(`[DragDropSystem] 🔓 Posizione "${previousKey}" liberata da "${object.name}"`);
        }

        // Occupa nuova posizione
        this.occupiedSnapPositions.set(positionKey, object.name);
        this.objectSnapPosition.set(object.uuid, positionKey);
        console.log(`[DragDropSystem] 🔒 Posizione "${positionKey}" occupata da "${object.name}"`);
    };
    /**
     * Libera la posizione di snap occupata da un oggetto
     * @param {THREE.Object3D} object - Oggetto che libera la posizione
     */
    DDS.releaseSnapPosition = function(object) {
        const positionKey = this.objectSnapPosition.get(object.uuid);
        if (positionKey) {
            this.occupiedSnapPositions.delete(positionKey);
            this.objectSnapPosition.delete(object.uuid);
            console.log(`[DragDropSystem] 🔓 Posizione "${positionKey}" liberata da "${object.name}"`);
        }
    };
    /**
     * Verifica se una posizione di snap è già occupata
     * @param {string} positionKey - Chiave univoca posizione
     * @param {THREE.Object3D} currentObject - Oggetto che sta verificando (escluso dal check)
     * @returns {boolean} True se occupata da un altro oggetto
     */
    DDS.isSnapPositionOccupied = function(positionKey, currentObject) {
        if (!positionKey) return false;

        const occupyingObjectName = this.occupiedSnapPositions.get(positionKey);
        if (!occupyingObjectName) {
            return false; // Posizione libera
        }

        // Se occupata dallo stesso oggetto che sta controllando, considerala libera
        if (occupyingObjectName === currentObject.name) {
            return false;
        }

        console.log(`[DragDropSystem] 🚫 Posizione "${positionKey}" già occupata da "${occupyingObjectName}"`);
        return true;
    };
    /**
     * Resetta tutte le posizioni occupate (chiamato quando si cambia step)
     */
    DDS.resetOccupiedPositions = function() {
        const count = this.occupiedSnapPositions.size;
        this.occupiedSnapPositions.clear();
        this.objectSnapPosition.clear();
        if (count > 0) {
            console.log(`[DragDropSystem] 🔄 Reset: ${count} posizioni snap liberate`);
        }
    };
    /**
     * Imposta distanza di snap
     * @param {number} distance - Nuova distanza di snap
     */
    DDS.setSnapDistance = function(distance) {
        const oldDistance = this.snapDistance;
        // Rimozione clamping minimo per permettere distanze precise come 0.01
        this.snapDistance = Math.max(0.001, distance); // Minimo tecnico ridotto a 0.001
        console.log(`[DragDropSystem] 🔧 setSnapDistance chiamato:`);
        console.log(`  📥 Valore richiesto: ${distance}`);
        console.log(`  📤 Valore applicato: ${this.snapDistance} (minimo tecnico: 0.001)`);
        console.log(`  🔄 Cambio: ${oldDistance} → ${this.snapDistance}`);

        // Ricrea indicatori con nuova distanza se abilitato E se showSnapIndicators è true
        if (this.enabled && this.showSnapIndicators) {
            this.createSnapIndicators();
        }
    };
    /**
     * Configura oggetti richiesti per auto-avanzamento step
     * @param {Array<string>} objectNames - Array di nomi oggetti che devono fare snap
     */
    DDS.setRequiredSnapObjects = function(objectNames) {
        this.requiredSnapObjects.clear();
        objectNames.forEach(name => {
            const cleanName = name.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
            this.requiredSnapObjects.add(cleanName);
        });
        console.log(`[DragDropSystem] 🎯 Oggetti richiesti per completamento: [${Array.from(this.requiredSnapObjects).join(', ')}]`);
    };
    /**
     * Abilita auto-avanzamento quando tutti gli oggetti richiesti hanno fatto snap
     */
    DDS.enableAutoAdvance = function() {
        this.autoAdvanceEnabled = true;
        console.log(`[DragDropSystem] ⏭️ Auto-avanzamento step abilitato`);
    };
    /**
     * Disabilita auto-avanzamento step
     */
    DDS.disableAutoAdvance = function() {
        this.autoAdvanceEnabled = false;
        console.log(`[DragDropSystem] ⏸️ Auto-avanzamento step disabilitato`);
    };
    /**
     * Resetta tracking snap completati (chiamato quando si cambia step)
     */
    DDS.resetSnapTracking = function() {
        this.completedSnapObjects.clear();
        this.requiredSnapObjects.clear();
        this.autoAdvanceEnabled = false;
        console.log(`[DragDropSystem] 🔄 Tracking snap resettato`);
    };
    /**
     * Ottiene lista oggetti draggabili
     * @returns {Array} - Array di oggetti 3D draggabili
     */
    DDS.getDraggableObjects = function() {
        return [...this.draggableObjects];
    };
    /**
     * Imposta target di snap personalizzato per un oggetto
     * @param {string} objectName - Nome dell'oggetto da configurare
     * @param {string} targetName - Nome del target (può includere _original)
     * @param {THREE.Vector3} offset - Offset opzionale dalla posizione target
     */
    DDS.setCustomSnapTarget = function(objectName, targetName, offset = null) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap personalizzati');
            return;
        }
        
        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] Oggetto "${objectName}" non trovato per snap personalizzato`);
            return;
        }
        
        const isOriginalRef = targetName.endsWith('_original');
        this.customSnapTargets.set(object.uuid, {
            targetName: targetName,
            isOriginalRef: isOriginalRef,
            offset: offset ? offset.clone() : null
        });
        
        console.log(`[DragDropSystem] 🎯 Snap personalizzato per "${objectName}" -> "${targetName}"${isOriginalRef ? ' (original)' : ''}${offset ? ' con offset' : ''}`);
    };
    /**
     * Imposta snap a coordinate arbitrarie (x,y,z) nello spazio
     * @param {string} objectName - Nome dell'oggetto
     * @param {number} x - Coordinata X
     * @param {number} y - Coordinata Y
     * @param {number} z - Coordinata Z
     */
    DDS.setCustomSnapPosition = function(objectName, x, y, z) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap personalizzati');
            return;
        }

        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] Oggetto "${objectName}" non trovato per snap personalizzato`);
            return;
        }

        this.customSnapTargets.set(object.uuid, {
            directPosition: new THREE.Vector3(x, y, z),
            isDirectPosition: true
        });

        console.log(`[DragDropSystem] 🎯 Snap a coordinate dirette per "${objectName}" -> (${x}, ${y}, ${z})`);
    };
    /**
     * Imposta snap a coordinate arbitrarie (x,y,z) usando il PIVOT dell'oggetto
     * invece del centro del bounding box. Utile per oggetti con pivot non centrato.
     * @param {string} objectName - Nome dell'oggetto
     * @param {number} x - Coordinata X
     * @param {number} y - Coordinata Y
     * @param {number} z - Coordinata Z
     */
    DDS.setCustomSnapPositionPivot = function(objectName, x, y, z) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap personalizzati');
            return;
        }

        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] 🔴🔴🔴 Oggetto "${objectName}" NON TROVATO per snap personalizzato (pivot)`);
            return;
        }

        const config = {
            directPosition: new THREE.Vector3(x, y, z),
            isDirectPosition: true,
            usePivot: true  // FLAG: usa pivot invece del centro BB
        };

        this.customSnapTargets.set(object.uuid, config);

        console.log(`[DragDropSystem] 📍✅✅✅ Snap PIVOT configurato per "${objectName}" (UUID: ${object.uuid.substr(0,8)}...) -> (${x}, ${y}, ${z})`);
        console.log(`[DragDropSystem] 📍 Config salvato:`, config);
        console.log(`[DragDropSystem] 📍 Totale customSnapTargets: ${this.customSnapTargets.size}`);
    };
    /**
     * Imposta target di snap multipli intercambiabili per un oggetto
     * @param {string} objectName - Nome dell'oggetto
     * @param {Array<string>} targetNames - Array di nomi target (possono includere "_original")
     */
    DDS.setMultipleSnapTargets = function(objectName, targetNames) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap multipli');
            return;
        }

        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] Oggetto "${objectName}" non trovato per snap multipli`);
            return;
        }

        // Converti array di nomi in array di configurazioni target
        const targets = targetNames.map(targetName => {
            const isOriginalRef = targetName.endsWith('_original');
            return {
                targetName: targetName,
                isOriginalRef: isOriginalRef,
                offset: null
            };
        });

        this.customSnapTargets.set(object.uuid, {
            isMultiTarget: true,
            targets: targets
        });

        console.log(`[DragDropSystem] 🎯 Snap multipli per "${objectName}" -> [${targetNames.join(', ')}]`);
    };
    /**
     * Rimuove target di snap personalizzato per un oggetto
     * @param {string} objectName - Nome dell'oggetto
     */
    DDS.removeCustomSnapTarget = function(objectName) {
        if (!window.Scene3D) return;

        const object = window.Scene3D.findModelByName(objectName);
        if (object) {
            this.customSnapTargets.delete(object.uuid);
            console.log(`[DragDropSystem] Rimosso snap personalizzato per "${objectName}"`);
        }
    };
    /**
     * Ottiene tutti i target di snap personalizzati
     * @returns {Map} - Mappa degli snap personalizzati
     */
    DDS.getCustomSnapTargets = function() {
        return new Map(this.customSnapTargets);
    };
    console.log('[DragDropSnapConfig] Modulo caricato');
})();
