/**
 * MOBILEOPTIMIZER.JS - Ottimizzazioni per dispositivi mobili
 *
 * Questo modulo gestisce:
 * - Rilevamento capacità dispositivo (RAM, GPU, performance)
 * - Lazy loading modelli (carica solo step corrente + prossimo)
 * - Riduzione qualità materiali/texture per mobile
 * - Gestione memoria e disposal automatico
 * - Fallback per dispositivi con capacità limitate
 */

(function() {
    'use strict';

    const MobileOptimizer = {
        /* ===== STATO E CONFIGURAZIONE ===== */
        enabled: false,
        deviceCapabilities: {
            isMobile: false,
            isLowEnd: false,
            maxMemoryMB: 0,
            gpuTier: 'high', // 'low', 'medium', 'high'
            maxConcurrentModels: 10
        },

        loadedModels: new Map(), // Traccia modelli caricati: nome → { model, stepIndex }
        currentStepIndex: -1,
        preloadedSteps: new Set(), // Step già pre-caricati

        config: {
            lowEnd: {
                maxConcurrentModels: 3,      // Carica max 3 modelli contemporaneamente
                textureMaxSize: 512,         // Riduci texture a 512x512
                shadowsEnabled: false,       // Disabilita ombre
                antialiasEnabled: false,     // Disabilita antialiasing
                pixelRatio: 1,               // Pixel ratio ridotto
                preloadSteps: 1              // Pre-carica solo step successivo
            },
            mediumEnd: {
                maxConcurrentModels: 6,
                textureMaxSize: 1024,
                shadowsEnabled: true,
                antialiasEnabled: false,
                pixelRatio: 1.5,
                preloadSteps: 2
            },
            highEnd: {
                maxConcurrentModels: 10,
                textureMaxSize: 2048,
                shadowsEnabled: true,
                antialiasEnabled: true,
                pixelRatio: window.devicePixelRatio || 2,
                preloadSteps: 3
            }
        },

        /* ===== INIZIALIZZAZIONE ===== */

        /**
         * Inizializza il sistema di ottimizzazione mobile
         */
        init: function() {
            console.log('[MobileOptimizer] Inizializzazione...');

            // Rileva capacità dispositivo
            this.detectDeviceCapabilities();

            // DISABILITATO: Il lazy loading causa schermo vuoto quando si avanza step
            // perché rimuove i modelli dalla scena. Per ora disabilitiamo su mobile.
            this.enabled = false;
            console.log('⚠️ [MobileOptimizer] DISABILITATO - lazy loading causava schermo vuoto');

            // Se è mobile, abilita ottimizzazioni
            // if (this.deviceCapabilities.isMobile) {
            //     this.enabled = true;
            //     this.applyOptimizations();
            //     console.log('📱 [MobileOptimizer] Ottimizzazioni mobile ATTIVE');
            //     console.log('📊 Device tier:', this.deviceCapabilities.gpuTier);
            //     console.log('📊 Max concurrent models:', this.deviceCapabilities.maxConcurrentModels);
            // } else {
            //     console.log('💻 [MobileOptimizer] Desktop rilevato - ottimizzazioni disabilitate');
            // }
        },

        /**
         * Rileva capacità hardware del dispositivo
         */
        detectDeviceCapabilities: function() {
            // 1. Rileva se è mobile
            this.deviceCapabilities.isMobile = window.isMobileDevice ? window.isMobileDevice() : false;

            // 2. Stima RAM disponibile
            if (navigator.deviceMemory) {
                this.deviceCapabilities.maxMemoryMB = navigator.deviceMemory * 1024;
                console.log('📊 RAM rilevata:', navigator.deviceMemory, 'GB');
            } else {
                // Stima conservativa per mobile
                this.deviceCapabilities.maxMemoryMB = this.deviceCapabilities.isMobile ? 2048 : 8192;
                console.log('📊 RAM stimata:', this.deviceCapabilities.maxMemoryMB / 1024, 'GB');
            }

            // 3. Rileva GPU tier
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    console.log('📊 GPU:', renderer);

                    // Classifica GPU (molto semplificato)
                    const lowEndKeywords = ['mali', 'adreno 3', 'adreno 4', 'powervr', 'vivante'];
                    const isLowEnd = lowEndKeywords.some(keyword =>
                        renderer.toLowerCase().includes(keyword)
                    );

                    if (isLowEnd) {
                        this.deviceCapabilities.gpuTier = 'low';
                    } else if (this.deviceCapabilities.maxMemoryMB < 4096) {
                        this.deviceCapabilities.gpuTier = 'medium';
                    } else {
                        this.deviceCapabilities.gpuTier = 'high';
                    }
                }
            }

            // 4. Determina se è low-end
            this.deviceCapabilities.isLowEnd = (
                this.deviceCapabilities.gpuTier === 'low' ||
                this.deviceCapabilities.maxMemoryMB < 3072
            );

            // 5. Imposta max concurrent models basato su tier
            const tierConfig = this.config[this.deviceCapabilities.gpuTier + 'End'];
            this.deviceCapabilities.maxConcurrentModels = tierConfig.maxConcurrentModels;

            console.log('📊 [MobileOptimizer] Capacità dispositivo:', this.deviceCapabilities);
        },

        /**
         * Applica ottimizzazioni globali basate su device tier
         */
        applyOptimizations: function() {
            const tierConfig = this.config[this.deviceCapabilities.gpuTier + 'End'];

            // 1. Ottimizza Scene3D se disponibile
            if (window.Scene3D) {
                // Riduce pixel ratio per migliorare performance
                if (window.Scene3D.renderer) {
                    window.Scene3D.renderer.setPixelRatio(tierConfig.pixelRatio);
                    console.log('📊 Pixel ratio impostato a:', tierConfig.pixelRatio);
                }

                // Disabilita ombre per low-end
                if (!tierConfig.shadowsEnabled && window.Scene3D.renderer) {
                    window.Scene3D.renderer.shadowMap.enabled = false;
                    console.log('📊 Ombre disabilitate (low-end)');
                }
            }

            // 2. Imposta limite caricamenti paralleli in ModelLoader
            if (window.ModelLoader) {
                // Modifica il concurrent loader
                console.log('📊 Limite caricamenti paralleli:', tierConfig.maxConcurrentModels);
            }

            console.log('✅ [MobileOptimizer] Ottimizzazioni applicate per tier:', this.deviceCapabilities.gpuTier);
        },

        /* ===== LAZY LOADING MODELLI ===== */

        /**
         * Carica solo i modelli necessari per lo step corrente
         * @param {number} stepIndex - Indice step corrente
         * @param {Array} allSteps - Array completo di tutti gli step del tutorial
         */
        loadModelsForStep: function(stepIndex, allSteps) {
            if (!this.enabled) return; // Se non mobile, non fare nulla

            console.log(`[MobileOptimizer] 📥 Caricamento modelli per step ${stepIndex + 1}/${allSteps.length}`);

            this.currentStepIndex = stepIndex;
            const currentStep = allSteps[stepIndex];

            // 1. Identifica modelli richiesti per step corrente
            const requiredModels = this.getRequiredModelsForStep(currentStep);
            console.log(`[MobileOptimizer] Modelli richiesti:`, requiredModels);

            // 2. Rimuovi modelli non più necessari (cleanup)
            this.cleanupUnusedModels(requiredModels, stepIndex, allSteps);

            // 3. Pre-carica step successivi se c'è memoria
            const tierConfig = this.config[this.deviceCapabilities.gpuTier + 'End'];
            for (let i = 1; i <= tierConfig.preloadSteps; i++) {
                const nextStepIndex = stepIndex + i;
                if (nextStepIndex < allSteps.length && !this.preloadedSteps.has(nextStepIndex)) {
                    const nextStep = allSteps[nextStepIndex];
                    const nextModels = this.getRequiredModelsForStep(nextStep);
                    console.log(`[MobileOptimizer] 🔮 Pre-caricamento step ${nextStepIndex + 1}:`, nextModels);
                    this.preloadedSteps.add(nextStepIndex);
                }
            }
        },

        /**
         * Estrae i nomi dei modelli richiesti da uno step
         */
        getRequiredModelsForStep: function(step) {
            const models = [];

            if (!step || !step.properties) return models;

            // Elemento principale
            if (step.properties.Elemento) {
                models.push(this.getModelNameFromPath(step.properties.Elemento));
            }

            // DragDropObjects
            if (step.properties.DragDropObjects) {
                const dragDropModels = step.properties.DragDropObjects.split(',').map(m => m.trim());
                dragDropModels.forEach(model => {
                    models.push(this.getModelNameFromPath(model));
                });
            }

            // DrivenObjects
            if (step.properties.DrivenObjectsConfig && Array.isArray(step.properties.DrivenObjectsConfig)) {
                step.properties.DrivenObjectsConfig.forEach(config => {
                    models.push(this.getModelNameFromPath(config.objectName));
                });
            }

            // SlaveObjects
            if (step.properties.SlaveObjects) {
                const slaveModels = step.properties.SlaveObjects.split(',').map(m => m.trim());
                slaveModels.forEach(model => {
                    models.push(this.getModelNameFromPath(model));
                });
            }

            return [...new Set(models)]; // Rimuovi duplicati
        },

        /**
         * Estrae il nome del modello dal percorso
         */
        getModelNameFromPath: function(path) {
            if (!path) return '';
            // Rimuovi path e estensione: "models/vite_coperchio_1.glb" → "vite_coperchio_1"
            const basename = path.split('/').pop();
            return basename.replace(/\.(glb|gltf|obj|stl)$/i, '');
        },

        /**
         * Rimuove modelli non più necessari dalla scena per liberare memoria
         */
        cleanupUnusedModels: function(requiredModels, currentStepIndex, allSteps) {
            if (!window.Scene3D || !window.Scene3D.scene) return;

            const tierConfig = this.config[this.deviceCapabilities.gpuTier + 'End'];
            const keepStepsRange = tierConfig.preloadSteps;

            // Trova modelli richiesti negli step vicini (corrente + prossimi N)
            const modelsToKeep = new Set(requiredModels);
            for (let i = 1; i <= keepStepsRange; i++) {
                const nextStepIndex = currentStepIndex + i;
                if (nextStepIndex < allSteps.length) {
                    const nextStepModels = this.getRequiredModelsForStep(allSteps[nextStepIndex]);
                    nextStepModels.forEach(model => modelsToKeep.add(model));
                }
            }

            console.log('[MobileOptimizer] 🧹 Pulizia modelli - da mantenere:', Array.from(modelsToKeep));

            // Itera modelli caricati e rimuovi quelli non necessari
            const scene = window.Scene3D.scene;
            const modelsToRemove = [];

            scene.traverse((object) => {
                if (object.isMesh || object.isGroup) {
                    const modelName = object.name.replace(/\.(glb|gltf|obj|stl)$/i, '');

                    // Se il modello non è nella lista da mantenere, marcalo per rimozione
                    if (modelName && !modelsToKeep.has(modelName) &&
                        !modelName.toLowerCase().includes('planaxis') &&
                        !modelName.toLowerCase().includes('assi')) {
                        modelsToRemove.push(object);
                    }
                }
            });

            // Rimuovi e libera memoria
            modelsToRemove.forEach(object => {
                console.log('[MobileOptimizer] 🗑️ Rimozione modello:', object.name);

                // Libera geometria
                if (object.geometry) {
                    object.geometry.dispose();
                }

                // Libera materiali
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                    }
                }

                // Rimuovi dalla scena
                if (object.parent) {
                    object.parent.remove(object);
                }

                this.loadedModels.delete(object.name);
            });

            if (modelsToRemove.length > 0) {
                console.log(`[MobileOptimizer] ✅ Rimossi ${modelsToRemove.length} modelli non necessari`);

                // Forza garbage collection (se supportato)
                if (window.gc) {
                    window.gc();
                }
            }
        },

        /* ===== OTTIMIZZAZIONE MATERIALI ===== */

        /**
         * Riduce la qualità dei materiali per dispositivi low-end
         */
        optimizeMaterial: function(material) {
            if (!this.enabled || !material) return;
            if (this.deviceCapabilities.gpuTier === 'high') return; // Non ottimizzare per high-end

            const tierConfig = this.config[this.deviceCapabilities.gpuTier + 'End'];

            // Riduce risoluzione texture
            if (material.map) {
                this.reduceTextureSize(material.map, tierConfig.textureMaxSize);
            }

            // Disabilita bump/normal maps per low-end
            if (this.deviceCapabilities.isLowEnd) {
                if (material.bumpMap) material.bumpMap = null;
                if (material.normalMap) material.normalMap = null;
                if (material.roughnessMap) material.roughnessMap = null;
                if (material.metalnessMap) material.metalnessMap = null;
            }

            // Forza aggiornamento
            material.needsUpdate = true;
        },

        /**
         * Riduce dimensione texture
         */
        reduceTextureSize: function(texture, maxSize) {
            if (!texture || !texture.image) return;

            const img = texture.image;
            if (img.width <= maxSize && img.height <= maxSize) return; // Già sotto soglia

            console.log(`[MobileOptimizer] 📉 Riduzione texture da ${img.width}x${img.height} a ${maxSize}x${maxSize}`);

            // Crea canvas per resize
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const scale = maxSize / Math.max(img.width, img.height);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            texture.image = canvas;
            texture.needsUpdate = true;
        },

        /* ===== GESTIONE ERRORI ===== */

        /**
         * Gestisce errori di caricamento modelli su mobile
         */
        handleLoadError: function(modelName, error) {
            console.error(`[MobileOptimizer] ❌ Errore caricamento ${modelName}:`, error);

            // Se low-end, suggerisci modalità AutoMode
            if (this.deviceCapabilities.isLowEnd && window.AutoMode) {
                console.log('[MobileOptimizer] 💡 Suggerimento: Usa AutoMode per esperienza ottimizzata');
            }

            // Notifica utente se troppi errori
            // (implementare contatore errori se necessario)
        },

        /* ===== UTILITY ===== */

        /**
         * Restituisce statistiche memoria corrente
         */
        getMemoryStats: function() {
            if (performance.memory) {
                const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
                const limit = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
                console.log(`[MobileOptimizer] 📊 Memoria JS: ${used}MB / ${limit}MB`);
                return { used, limit };
            }
            return null;
        },

        /**
         * Disabilita ottimizzazioni (per debug)
         */
        disable: function() {
            this.enabled = false;
            console.log('[MobileOptimizer] ⚠️ Ottimizzazioni disabilitate manualmente');
        }
    };

    // Esporta globalmente
    window.MobileOptimizer = MobileOptimizer;

    console.log('[MobileOptimizer] Modulo caricato');
})();
