/**
 * MODELLOADER.JS - Caricamento modelli 3D e risorse
 * 
 * Questo modulo gestisce:
 * - Caricamento modelli OBJ, STL, GLTF/GLB
 * - Gestione materiali MTL e texture
 * - Cache per ottimizzare caricamenti multipli
 * - Validazione file e gestione errori
 * - Progress callbacks per feedback utente
 */

window.ModelLoader = {
    
    /* ===== CACHE E STATO ===== */
    textureCache: {},              // Cache per texture già caricate
    materialCache: {},             // Cache per materiali
    loadingQueue: [],              // Coda di caricamento
    isLoading: false,              // Stato caricamento attivo
    
    /* ===== LOADER THREE.JS ===== */
    loaders: {
        obj: null,                 // Loader per file OBJ
        mtl: null,                 // Loader per file MTL
        stl: null,                 // Loader per file STL
        gltf: null,                // Loader per file GLTF/GLB
        texture: null              // Loader per texture
    },
    
    /**
     * Inizializza i loader Three.js
     */
    init: function() {
        try {
            // Verifica disponibilità Three.js
            if (typeof THREE === 'undefined') {
                throw new Error('Three.js non disponibile');
            }
            
            // Inizializza loader base
            this.loaders.texture = new THREE.TextureLoader();
            
            // I loader specifici verranno inizializzati quando necessari
            // per non caricare librerie non utilizzate
            
            AppConfig.log(2, 'ModelLoader inizializzato');
            
        } catch (error) {
            AppConfig.log(0, 'Errore inizializzazione ModelLoader:', error);
            throw error;
        }
    },
    
    /* ===== CARICAMENTO FILE MULTIPLI ===== */
    
    /**
     * Carica file multipli selezionati dall'utente
     * @param {FileList} files - Lista file da caricare
     * @param {Function} onProgress - Callback progresso
     * @param {Function} onComplete - Callback completamento
     * @param {Function} onError - Callback errore
     */
    loadFiles: function(files, onProgress, onComplete, onError) {
        if (!files || files.length === 0) {
            if (onError) onError('Nessun file selezionato');
            return;
        }
        
        AppConfig.log(2, `Inizio caricamento di ${files.length} file(s)`);
        
        // Reset stato
        this.isLoading = true;
        this.loadingQueue = [];
        
        // Organizza i file per tipo
        const fileGroups = this.organizeFiles(files);
        
        // Valida i file
        const validation = this.validateFiles(fileGroups);
        if (!validation.valid) {
            this.isLoading = false;
            if (onError) onError(validation.error);
            return;
        }
        
        // Avvia caricamento sequenziale
        this.processFileGroups(fileGroups, onProgress, onComplete, onError);
    },
    
    /**
     * Organizza i file per tipo e associazioni
     */
    organizeFiles: function(files) {
        const groups = {
            models: [],        // File modello principale
            materials: [],     // File materiali (MTL)
            textures: [],      // File texture
            animations: []     // File animazioni
        };
        
        // Classifica ogni file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = this.getFileExtension(file.name).toLowerCase();
            
            if (AppConfig.files.supportedFormats.models.includes(extension)) {
                groups.models.push(file);
            } else if (AppConfig.files.supportedFormats.materials.includes(extension)) {
                groups.materials.push(file);
            } else if (AppConfig.files.supportedFormats.textures.includes(extension)) {
                groups.textures.push(file);
            } else if (AppConfig.files.supportedFormats.animations.includes(extension)) {
                groups.animations.push(file);
            }
        }
        
        AppConfig.log(3, 'File organizzati per tipo:', groups);
        console.log('📁 File organizzati:', {
            modelli: groups.models.map(f => f.name),
            materiali: groups.materials.map(f => f.name),
            texture: groups.textures.map(f => f.name)
        });
        return groups;
    },
    
    /**
     * Valida i file organizzati
     */
    validateFiles: function(groups) {
        // Deve esserci almeno un modello
        if (groups.models.length === 0) {
            return {
                valid: false,
                error: 'Nessun file modello 3D trovato. Formati supportati: ' + 
                       AppConfig.files.supportedFormats.models.join(', ')
            };
        }
        
        // Verifica dimensioni file
        const allFiles = [...groups.models, ...groups.materials, ...groups.textures];
        for (const file of allFiles) {
            const sizeMB = file.size / (1024 * 1024);
            const extension = this.getFileExtension(file.name).toLowerCase();
            
            let maxSize = AppConfig.files.maxSizes.model; // Default
            if (AppConfig.files.supportedFormats.textures.includes(extension)) {
                maxSize = AppConfig.files.maxSizes.texture;
            }
            
            if (sizeMB > maxSize) {
                return {
                    valid: false,
                    error: `File ${file.name} troppo grande (${sizeMB.toFixed(1)}MB). ` +
                          `Massimo consentito: ${maxSize}MB`
                };
            }
        }
        
        return { valid: true };
    },
    
    /**
     * Processa i gruppi di file in parallelo con controllo concurrency
     * OTTIMIZZATO: Caricamento parallelo + zero delay artificiali + batch rendering
     */
    processFileGroups: function(groups, onProgress, onComplete, onError) {
        const totalSteps = groups.models.length;
        const loadedModels = [];

        // Determina concurrency dinamicamente in base al dispositivo
        let CONCURRENT_LOADS = 6; // Default desktop

        // NUOVO: Rileva dispositivi mobili/VR direttamente (anche se MobileOptimizer è disabilitato)
        const isMobileOrVR = window.isMobileDevice && window.isMobileDevice();
        if (isMobileOrVR) {
            // Quest 2 e dispositivi mobili: limita a 3 caricamenti paralleli
            CONCURRENT_LOADS = 3;
            console.log(`📱 Dispositivo mobile/VR rilevato - Concurrency ridotta a ${CONCURRENT_LOADS}`);
        } else if (window.MobileOptimizer && window.MobileOptimizer.enabled) {
            CONCURRENT_LOADS = window.MobileOptimizer.deviceCapabilities.maxConcurrentModels;
            console.log(`📱 MobileOptimizer attivo - Concurrency ridotta a ${CONCURRENT_LOADS}`);
        }

        // Aggiorna progress iniziale (0/total)
        if (onProgress) {
            onProgress(0, {
                current: 0,
                total: totalSteps,
                fileName: '',
                message: `Preparazione caricamento ${totalSteps} modelli...`
            });
        }

        console.log(`🚀 Avvio caricamento parallelo: ${totalSteps} modelli, concurrency=${CONCURRENT_LOADS}`);

        // Crea array di promise per caricamento parallelo
        const loadPromises = groups.models.map((modelFile, index) => {
            const baseName = this.getBaseName(modelFile.name);

            // Trova file associati con nome simile
            const associatedMaterial = groups.materials.find(f =>
                this.getBaseName(f.name) === baseName);
            const associatedTextures = groups.textures.filter(f =>
                this.getBaseName(f.name) === baseName);

            // Restituisce una Promise per questo modello
            return new Promise((resolve, reject) => {
                this.loadSingleModel(
                    modelFile,
                    associatedMaterial,
                    associatedTextures,
                    (model) => {
                        loadedModels.push(model);
                        console.log(`✅ Modello ${loadedModels.length}/${totalSteps} caricato: ${modelFile.name}`);

                        // Aggiorna progresso in tempo reale
                        if (onProgress) {
                            onProgress(loadedModels.length / totalSteps, {
                                current: loadedModels.length,
                                total: totalSteps,
                                fileName: modelFile.name,
                                message: `✓ Caricato ${loadedModels.length}/${totalSteps}: ${modelFile.name}`
                            });
                        }

                        resolve(model);
                    },
                    (error) => {
                        console.error(`❌ Errore caricamento ${modelFile.name}:`, error);
                        reject(error);
                    }
                );
            });
        });

        // Carica in batch paralleli con controllo concurrency
        this.loadInBatches(loadPromises, CONCURRENT_LOADS)
            .then(() => {
                console.log('✅ Tutti i modelli caricati, rendering finale...');
                this.isLoading = false;

                // Rendering finale UNICO invece di uno per ogni modello (OTTIMIZZAZIONE #3)
                if (window.Scene3D && typeof window.Scene3D.render === 'function') {
                    requestAnimationFrame(() => {
                        window.Scene3D.render();
                        console.log('🎨 Batch rendering completato');

                        // Callback immediato (OTTIMIZZAZIONE #2: zero delay)
                        if (onComplete) onComplete(loadedModels);
                    });
                } else {
                    // Nessun rendering necessario, callback immediato
                    if (onComplete) onComplete(loadedModels);
                }
            })
            .catch((error) => {
                this.isLoading = false;
                console.error('❌ Errore durante caricamento modelli:', error);

                // Se mobile optimizer attivo, notifica l'errore
                if (window.MobileOptimizer && window.MobileOptimizer.enabled) {
                    window.MobileOptimizer.handleLoadError('batch', error);
                }

                // Mostra messaggio più user-friendly su mobile/VR
                if (window.isMobileDevice && window.isMobileDevice()) {
                    const userAgent = navigator.userAgent;
                    const isVR = ['Quest', 'Oculus', 'OculusBrowser', 'VR', 'MetaQuest'].some(k => userAgent.includes(k));

                    let friendlyError;
                    if (isVR) {
                        friendlyError = `Impossibile caricare tutti i modelli 3D sul visore VR. Memoria limitata. Alcuni modelli potrebbero non essere visibili. Riprova riavviando il browser.`;
                    } else {
                        friendlyError = `Impossibile caricare tutti i modelli 3D. Il tuo dispositivo potrebbe avere memoria limitata. Prova ad attivare la modalità AutoMode per un'esperienza ottimizzata.`;
                    }
                    if (onError) onError(friendlyError);
                } else {
                    if (onError) onError(error);
                }
            });
    },

    /**
     * Carica promise in batch paralleli con limite di concurrency
     * OTTIMIZZAZIONE #1: Caricamento parallelo controllato
     */
    loadInBatches: function(promises, batchSize) {
        return new Promise((resolve, reject) => {
            let currentIndex = 0;
            let completedCount = 0;
            let failedCount = 0;
            const results = [];

            const loadNext = () => {
                if (completedCount + failedCount >= promises.length) {
                    // Se troppi fallimenti su mobile, rigetta
                    const failureRate = failedCount / promises.length;
                    if (failureRate > 0.5 && window.MobileOptimizer && window.MobileOptimizer.enabled) {
                        console.error(`❌ Troppi fallimenti: ${failedCount}/${promises.length} modelli non caricati`);
                        reject(new Error(`Impossibile caricare ${failedCount}/${promises.length} modelli`));
                        return;
                    }

                    console.log(`✅ Caricamento completato: ${completedCount} successi, ${failedCount} fallimenti`);
                    resolve(results);
                    return;
                }

                // Avvia batch di caricamenti paralleli
                const batch = [];
                while (batch.length < batchSize && currentIndex < promises.length) {
                    const index = currentIndex++;
                    batch.push(
                        promises[index]
                            .then(result => {
                                results[index] = result;
                                completedCount++;
                                loadNext(); // Avvia prossimo quando questo completa
                            })
                            .catch(error => {
                                console.warn(`⚠️ Errore caricamento modello ${index}:`, error);
                                failedCount++;
                                loadNext(); // Continua con prossimo anche se questo fallisce
                            })
                    );
                }
            };

            // Avvia primo batch
            loadNext();
        });
    },
    
    /* ===== CARICAMENTO SINGOLO MODELLO ===== */
    
    /**
     * Carica un singolo modello con materiali e texture associate
     */
    loadSingleModel: function(modelFile, materialFile, textureFiles, onSuccess, onError) {
        const extension = this.getFileExtension(modelFile.name).toLowerCase();
        
        AppConfig.log(3, `Caricamento modello ${modelFile.name} (${extension})`);
        
        switch (extension) {
            case '.obj':
                this.loadOBJModel(modelFile, materialFile, textureFiles, onSuccess, onError);
                break;
            case '.stl':
                this.loadSTLModel(modelFile, onSuccess, onError);
                break;
            case '.gltf':
            case '.glb':
                this.loadGLTFModel(modelFile, onSuccess, onError);
                break;
            default:
                onError(`Formato file non supportato: ${extension}`);
        }
    },
    
    /**
     * Carica modello OBJ (con eventuale MTL)
     */
    loadOBJModel: function(objFile, mtlFile, textureFiles, onSuccess, onError) {
        console.log('🔧 loadOBJModel - OBJLoader disponibile?', typeof window.OBJLoader !== 'undefined');
        console.log('🔧 loadOBJModel - MTL file presente?', !!mtlFile);
        
        // Inizializza OBJLoader se necessario
        if (!this.loaders.obj && typeof window.OBJLoader !== 'undefined') {
            this.loaders.obj = new window.OBJLoader();
            console.log('✅ OBJLoader inizializzato');
        }
        
        if (!this.loaders.obj) {
            console.log('❌ OBJLoader non disponibile, uso fallback');
            // Fallback: carica senza materiali
            this.loadOBJWithoutMaterials(objFile, onSuccess, onError);
            return;
        }
        
        // Carica prima i materiali se disponibili
        if (mtlFile) {
            this.loadMTLMaterials(mtlFile, textureFiles, (materials) => {
                console.log('🔗 Applicando materiali al loader OBJ:', materials);
                this.loaders.obj.setMaterials(materials);
                this.loadOBJGeometry(objFile, (object) => {
                    console.log('🔗 Oggetto caricato, verifico materiali applicati:');
                    this.debugObjectMaterials(object);
                    onSuccess(object);
                }, onError);
            }, (error) => {
                AppConfig.log(1, 'Errore caricamento materiali, proseguo senza:', error);
                this.loadOBJGeometry(objFile, onSuccess, onError);
            });
        } else {
            this.loadOBJGeometry(objFile, onSuccess, onError);
        }
    },
    
    /**
     * Carica la geometria OBJ
     */
    loadOBJGeometry: function(objFile, onSuccess, onError) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const object = this.loaders.obj.parse(event.target.result);
                this.processLoadedModel(object, objFile.name);
                onSuccess(object);
            } catch (error) {
                onError(`Errore parsing OBJ: ${error.message}`);
            }
        };
        
        reader.onerror = () => onError('Errore lettura file OBJ');
        reader.readAsText(objFile);
    },
    
    /**
     * Carica OBJ senza materiali (fallback)
     */
    loadOBJWithoutMaterials: function(objFile, onSuccess, onError) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                // Parser OBJ semplificato
                const object = this.parseOBJSimple(event.target.result);
                this.processLoadedModel(object, objFile.name);
                onSuccess(object);
            } catch (error) {
                onError(`Errore parsing OBJ: ${error.message}`);
            }
        };
        
        reader.onerror = () => onError('Errore lettura file OBJ');
        reader.readAsText(objFile);
    },
    
    /**
     * Carica materiali MTL
     */
    loadMTLMaterials: function(mtlFile, textureFiles, onSuccess, onError) {
        console.log('🔧 loadMTLMaterials - MTLLoader disponibile?', typeof window.MTLLoader !== 'undefined');
        
        if (!this.loaders.mtl && typeof window.MTLLoader !== 'undefined') {
            this.loaders.mtl = new window.MTLLoader();
            console.log('✅ MTLLoader inizializzato');
        }
        
        if (!this.loaders.mtl) {
            console.log('❌ MTLLoader non disponibile');
            onError('MTLLoader non disponibile');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                // Pre-carica le texture se disponibili
                this.preloadTextures(textureFiles, () => {
                    console.log('🎨 Parsing file MTL...');
                    const materials = this.loaders.mtl.parse(event.target.result);
                    console.log('🎨 Materiali parsati:', materials);
                    
                    // Prima esegui preload per creare effettivamente i materiali
                    materials.preload();
                    
                    // Poi migliora i materiali per la visualizzazione
                    console.log('🎨 Materiali dopo preload:', materials.materials);
                    this.enhanceMaterials(materials.materials);
                    
                    onSuccess(materials);
                });
            } catch (error) {
                onError(`Errore parsing MTL: ${error.message}`);
            }
        };
        
        reader.onerror = () => onError('Errore lettura file MTL');
        reader.readAsText(mtlFile);
    },
    
    /**
     * Carica modello STL
     */
    loadSTLModel: function(stlFile, onSuccess, onError) {
        if (!this.loaders.stl && typeof THREE.STLLoader !== 'undefined') {
            this.loaders.stl = new THREE.STLLoader();
        }
        
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                let geometry;
                if (this.loaders.stl) {
                    geometry = this.loaders.stl.parse(event.target.result);
                } else {
                    // Fallback parser STL semplice
                    geometry = this.parseSTLSimple(event.target.result);
                }
                
                // Crea mesh con materiale di default
                const material = new THREE.MeshLambertMaterial({
                    color: AppConfig.scene3D.materials.defaultColor
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.name = stlFile.name;
                
                this.processLoadedModel(mesh, stlFile.name);
                onSuccess(mesh);
                
            } catch (error) {
                onError(`Errore parsing STL: ${error.message}`);
            }
        };
        
        reader.onerror = () => onError('Errore lettura file STL');
        reader.readAsArrayBuffer(stlFile);
    },
    
    /**
     * Pre-carica texture nella cache
     */
    preloadTextures: function(textureFiles, onComplete) {
        if (!textureFiles || textureFiles.length === 0) {
            onComplete();
            return;
        }
        
        let loaded = 0;
        
        textureFiles.forEach(file => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                // Crea URL oggetto per la texture
                const blob = new Blob([event.target.result]);
                const url = URL.createObjectURL(blob);
                
                // Carica texture in cache
                const texture = this.loaders.texture.load(url);
                this.textureCache[file.name] = texture;
                
                loaded++;
                if (loaded === textureFiles.length) {
                    onComplete();
                }
            };
            
            reader.readAsArrayBuffer(file);
        });
    },
    
    /* ===== PROCESSAMENTO MODELLI ===== */
    
    /**
     * Processa un modello caricato (normalizzazione, ottimizzazioni)
     */
    processLoadedModel: function(model, filename) {
        // Calcola normali se mancanti
        model.traverse((child) => {
            if (child.isMesh) {
                if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
                
                // Centra la geometria
                child.geometry.center();
                
                // Abilita ombre (escluso per assi.glb e planaxis.glb)
                const shouldCastShadow = !filename.toLowerCase().includes('assi') && !filename.toLowerCase().includes('planaxis');
                child.castShadow = shouldCastShadow;
                child.receiveShadow = shouldCastShadow;
                
                // Assegna nome per debug
                child.name = child.name || filename;
            }
        });
        
        // Assegna nome al modello principale
        model.name = filename;
        
        AppConfig.log(3, `Modello ${filename} processato`);
    },
    
    /* ===== UTILITY ===== */
    
    /**
     * Estrae l'estensione di un file
     */
    getFileExtension: function(filename) {
        return filename.substring(filename.lastIndexOf('.'));
    },
    
    /**
     * Estrae il nome base di un file (senza estensione)
     */
    getBaseName: function(filename) {
        return filename.substring(0, filename.lastIndexOf('.'));
    },
    
    /**
     * Parser OBJ semplificato per fallback
     */
    parseOBJSimple: function(text) {
        // Implementazione parser OBJ base
        // (semplificato per brevità, in produzione usare parser completo)
        const geometry = new THREE.BufferGeometry();
        
        const vertices = [];
        const faces = [];
        
        const lines = text.split('\n');
        
        lines.forEach(line => {
            const parts = line.trim().split(' ');
            
            if (parts[0] === 'v') {
                // Vertice
                vertices.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            } else if (parts[0] === 'f') {
                // Faccia (semplificato: solo triangoli)
                faces.push(
                    parseInt(parts[1]) - 1,
                    parseInt(parts[2]) - 1,
                    parseInt(parts[3]) - 1
                );
            }
        });
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(faces);
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshLambertMaterial({
            color: AppConfig.scene3D.materials.defaultColor
        });
        
        return new THREE.Mesh(geometry, material);
    },
    
    /**
     * Migliora i materiali per una migliore visualizzazione
     */
    enhanceMaterials: function(materials) {
        console.log('🎨 Miglioramento materiali...');
        console.log('🎨 Struttura materials:', materials);
        console.log('🎨 Chiavi materials:', Object.keys(materials));
        
        Object.keys(materials).forEach(materialName => {
            const material = materials[materialName];
            console.log(`🎨 Materiale "${materialName}":`, {
                color: material.color,
                opacity: material.opacity,
                transparent: material.transparent
            });
            
            // Assicura che i materiali molto scuri siano più visibili
            if (material.color) {
                const color = material.color;
                console.log(`🎨 Colore originale "${materialName}": R=${color.r.toFixed(3)}, G=${color.g.toFixed(3)}, B=${color.b.toFixed(3)}`);
                
                // Se il materiale è troppo scuro, schiariscilo mantenendo le proporzioni
                if (color.r < 0.15 && color.g < 0.15 && color.b < 0.15) {
                    console.log(`🎨 Schiarisco materiale scuro "${materialName}"`);
                    
                    // Per materiali come "nero", usa grigio medio scuro
                    if (materialName === 'nero') {
                        material.color.setRGB(0.15, 0.15, 0.15); // Grigio più scuro per contrasto
                    } 
                    // Per "Acciaio", usa un grigio metallico più chiaro
                    else if (materialName === 'Acciaio') {
                        material.color.setRGB(0.6, 0.6, 0.65); // Grigio metallico chiaro con sfumatura blu
                    }
                    // Per altri materiali scuri, moltiplica per un fattore
                    else {
                        const factor = 4.0; // Fattore di schiarimento aumentato
                        material.color.setRGB(
                            Math.min(color.r * factor, 1.0),
                            Math.min(color.g * factor, 1.0),
                            Math.min(color.b * factor, 1.0)
                        );
                    }
                    
                    console.log(`🎨 Nuovo colore "${materialName}": R=${material.color.r.toFixed(3)}, G=${material.color.g.toFixed(3)}, B=${material.color.b.toFixed(3)}`);
                }
            }
            
            // Assicura che i materiali siano compatibili con le nostre luci
            if (material.type === 'MeshPhongMaterial' || material.type === 'MeshLambertMaterial') {
                // Aumenta leggermente la riflessione ambientale
                if (material.emissive) {
                    material.emissive.setRGB(0.05, 0.05, 0.05);
                }
            }
        });
    },
    
    /**
     * Debug per verificare i materiali applicati all'oggetto
     */
    debugObjectMaterials: function(object) {
        object.traverse(function(child) {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    console.log(`🔗 Mesh "${child.name}" (${child.material.length} materiali):`)
                    child.material.forEach((mat, index) => {
                        console.log(`  Material ${index}: "${mat.name || 'unnamed'}" - Color: R=${mat.color?.r?.toFixed(3) || 'N/A'}, G=${mat.color?.g?.toFixed(3) || 'N/A'}, B=${mat.color?.b?.toFixed(3) || 'N/A'} - Type: ${mat.type}`);
                    });
                } else {
                    console.log(`🔗 Mesh "${child.name}":`, {
                        materialName: child.material.name || 'unnamed',
                        color: child.material.color,
                        type: child.material.type
                    });
                }
            }
        });
    },
    
    /**
     * Carica modello GLTF/GLB
     */
    loadGLTFModel: function(gltfFile, onSuccess, onError) {
        console.log('🔧 loadGLTFModel - GLTFLoader disponibile?', typeof window.GLTFLoader !== 'undefined');
        
        // Inizializza GLTFLoader se necessario
        if (!this.loaders.gltf && typeof window.GLTFLoader !== 'undefined') {
            this.loaders.gltf = new window.GLTFLoader();
            console.log('✅ GLTFLoader inizializzato');
        }
        
        if (!this.loaders.gltf) {
            console.error('❌ GLTFLoader non disponibile');
            if (onError) onError('GLTFLoader non disponibile');
            return;
        }
        
        // Crea URL dal file
        const fileURL = URL.createObjectURL(gltfFile);
        
        console.log('🔄 Inizio caricamento GLTF/GLB:', gltfFile.name);
        
        this.loaders.gltf.load(
            fileURL,
            (gltf) => {
                console.log('✅ GLTF/GLB caricato con successo:', gltf);
                
                // Libera l'URL temporaneo
                URL.revokeObjectURL(fileURL);
                
                // Il modello GLTF è in gltf.scene
                const model = gltf.scene;
                model.name = this.getBaseName(gltfFile.name);
                
                // Attraversa tutti i mesh per correggere i materiali
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (!child.material) {
                            // Crea materiale di default se mancante
                            child.material = new THREE.MeshStandardMaterial({ 
                                color: 0x808080,
                                metalness: 0.1,
                                roughness: 0.8
                            });
                        } else {
                            // Correggi materiali esistenti che appaiono troppo scuri
                            if (Array.isArray(child.material)) {
                                // Multipli materiali
                                child.material.forEach(mat => {
                                    this.fixGLTFMaterial(mat);
                                    this.fixLuminousMaterial(mat, child.name);
                                });
                            } else {
                                // Singolo materiale
                                this.fixGLTFMaterial(child.material);
                                this.fixLuminousMaterial(child.material, child.name);
                            }
                        }
                        
                        // Abilita ombre (escluso per assi.glb e planaxis.glb)
                        const shouldCastShadow = !gltfFile.name.toLowerCase().includes('assi') && !gltfFile.name.toLowerCase().includes('planaxis');
                        child.castShadow = shouldCastShadow;
                        child.receiveShadow = shouldCastShadow;
                    }
                });
                
                console.log('🎯 GLTF/GLB processato, chiamando onSuccess');
                if (onSuccess) onSuccess(model);
            },
            (progress) => {
                // Progress callback (opzionale)
                if (progress.lengthComputable) {
                    const percent = (progress.loaded / progress.total * 100).toFixed(2);
                    console.log(`📊 GLTF/GLB Progress: ${percent}%`);
                }
            },
            (error) => {
                console.error('❌ Errore caricamento GLTF/GLB:', error);
                
                // Libera l'URL temporaneo anche in caso di errore
                URL.revokeObjectURL(fileURL);
                
                if (onError) onError(`Errore caricamento GLTF/GLB: ${error.message || error}`);
            }
        );
    },
    
    /**
     * Corregge i materiali GLTF per renderli visibili
     */
    fixGLTFMaterial: function(material) {
        if (!material) return;
        
        // Log del materiale per debug
        console.log('🎨 Fixing material:', material.name, 'Type:', material.type, 'Color:', material.color);
        console.log('🎨 Color RGB values:', material.color.r, material.color.g, material.color.b);
        console.log('🎨 Color sum:', material.color.r + material.color.g + material.color.b);
        
        // Per materiali PBR troppo scuri o metallici
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
            
            // CORREZIONE SELETTIVA: Lascia il nero come nero, correggi solo materiali invisibili
            const colorSum = material.color.r + material.color.g + material.color.b;
            console.log('🔍 Controllo material:', material.name, 'colorSum=' + colorSum);
            
            // Controlla se il materiale si chiama "nero" o simili - mantienilo nero
            // Include anche "schermo" per preservare texture degli schermi
            const isIntentionallyBlack = material.name &&
                (material.name.toLowerCase().includes('nero') ||
                 material.name.toLowerCase().includes('black') ||
                 material.name.toLowerCase().includes('dark') ||
                 material.name.toLowerCase().includes('schermo') ||
                 material.name.toLowerCase().includes('screen') ||
                 material.name.toLowerCase().includes('display'));
            
            if (isIntentionallyBlack) {
                console.log('🖤 MATERIALE INTENZIONALMENTE NERO - Non modificato:', material.name);
            } else if (material.color && colorSum < 0.1) {
                // Solo per materiali MOLTO scuri che non dovrebbero essere neri
                console.log('⚠️ MATERIALE INVISIBILE! Correggendo colore da:', material.color.getHex().toString(16));
                material.color.setRGB(0.2, 0.2, 0.2); // Grigio molto scuro ma visibile
                console.log('🎨 NUOVO COLORE:', material.color.getHex().toString(16));
            } else {
                console.log('✅ Colore OK, non modificato');
            }
            
            // Riduci metalness eccessiva che può causare aspetto nero senza HDR
            if (material.metalness !== undefined && material.metalness > 0.8) {
                console.log('⚠️ Metalness troppo alta, riducendo');
                material.metalness = 0.3;
            }
            
            // Aumenta roughness per ridurre riflessi eccessivi
            if (material.roughness !== undefined && material.roughness < 0.3) {
                console.log('⚠️ Roughness troppo bassa, aumentando');
                material.roughness = 0.5;
            }
            
            // Assicura che il materiale non sia trasparente accidentalmente
            if (material.transparent && material.opacity < 0.1) {
                console.log('⚠️ Materiale troppo trasparente, correggendo');
                material.opacity = 1.0;
                material.transparent = false;
            }
        }
        
        // Per materiali Lambert/Phong convertili in Standard per migliore compatibilità
        else if (material.isMeshLambertMaterial || material.isMeshPhongMaterial) {
            console.log('🔄 Convertendo materiale legacy in MeshStandardMaterial');
            
            // Mantieni il colore originale
            const originalColor = material.color ? material.color.clone() : new THREE.Color(0x808080);
            const originalMap = material.map;
            
            // Non possiamo cambiare il tipo direttamente, ma possiamo impostare proprietà compatibili
            if (originalColor.r + originalColor.g + originalColor.b < 0.1) {
                material.color.setHex(0x808080);
            }
        }
        
        // Forza aggiornamento del materiale
        material.needsUpdate = true;
        
        console.log('✅ Materiale corretto:', {
            name: material.name,
            color: material.color,
            metalness: material.metalness,
            roughness: material.roughness,
            opacity: material.opacity
        });
    },

    /**
     * Potenzia materiali luminosi/emissivi (es. "luminoso.001" sui pulsanti)
     */
    fixLuminousMaterial: function(material, meshName) {
        if (!material || !material.name) return;

        const matName = material.name.toLowerCase();

        // Materiali luminosi/emissivi
        if (matName.includes('luminoso') || matName.includes('emissive') || matName.includes('glow')) {
            // Aumenta intensità emissiva
            material.emissiveIntensity = 3.0;

            // Se non ha già un colore emissivo, usa il colore base o bianco
            if (material.emissive && material.emissive.r === 0 && material.emissive.g === 0 && material.emissive.b === 0) {
                material.emissive = material.color ? material.color.clone() : new THREE.Color(1, 1, 1);
            }

            material.needsUpdate = true;

            console.log(`💡 [ModelLoader] Materiale luminoso potenziato: ${material.name} su mesh ${meshName}, emissiveIntensity=${material.emissiveIntensity}`);
        }
    },
    
    /**
     * Libera la cache delle texture
     */
    clearCache: function() {
        Object.values(this.textureCache).forEach(texture => {
            if (texture.dispose) texture.dispose();
        });
        
        this.textureCache = {};
        this.materialCache = {};
        
        AppConfig.log(2, 'Cache texture liberata');
    }
};