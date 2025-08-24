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
     * Processa i gruppi di file in sequenza
     */
    processFileGroups: function(groups, onProgress, onComplete, onError) {
        const totalSteps = groups.models.length;
        let currentStep = 0;
        const loadedModels = [];
        
        // Carica ogni modello con i suoi file associati
        const loadNextModel = () => {
            if (currentStep >= groups.models.length) {
                // Tutti i modelli caricati
                this.isLoading = false;
                if (onComplete) onComplete(loadedModels);
                return;
            }
            
            const modelFile = groups.models[currentStep];
            const baseName = this.getBaseName(modelFile.name);
            
            // Trova file associati con nome simile
            const associatedMaterial = groups.materials.find(f => 
                this.getBaseName(f.name) === baseName);
            const associatedTextures = groups.textures.filter(f => 
                this.getBaseName(f.name) === baseName);
            
            // Aggiorna progresso
            if (onProgress) {
                onProgress(`Caricamento ${modelFile.name}...`, currentStep / totalSteps);
            }
            
            // Carica il modello
            this.loadSingleModel(
                modelFile, 
                associatedMaterial, 
                associatedTextures,
                (model) => {
                    loadedModels.push(model);
                    currentStep++;
                    setTimeout(loadNextModel, 100); // Piccola pausa per UI responsiva
                },
                onError
            );
        };
        
        loadNextModel();
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
                
                // Abilita ombre
                child.castShadow = true;
                child.receiveShadow = true;
                
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