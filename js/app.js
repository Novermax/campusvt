/**
 * APP.JS - Inizializzazione principale dell'applicazione (ES Module)
 * 
 * Questo è il file principale che:
 * - Importa Three.js come ES Module
 * - Coordina l'inizializzazione di tutti i moduli
 * - Gestisce il caricamento delle dipendenze esterne
 * - Configura l'applicazione al primo avvio
 * - Gestisce errori globali e fallback
 */

// ===== IMPORT THREE.JS E ADDONS =====
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Rendi Three.js disponibile globalmente per compatibilità
window.THREE = THREE;
window.OBJLoader = OBJLoader;
window.MTLLoader = MTLLoader;
window.STLLoader = STLLoader;
window.GLTFLoader = GLTFLoader;
window.DRACOLoader = DRACOLoader;

window.App = {
    
    /* ===== STATO APPLICAZIONE ===== */
    initialized: false,             // Flag inizializzazione completata
    modules: {},                    // Riferimenti ai moduli caricati
    startTime: null,                // Timestamp avvio applicazione
    
    /* ===== CONFIGURAZIONE MODULI ===== */
    requiredModules: [
        'AppConfig',               // Configurazioni globali
        'Scene3D',                 // Gestione scena 3D
        'ModelLoader',             // Caricamento modelli
        'UI'                       // Interfaccia utente
    ],
    
    /* ===== INIZIALIZZAZIONE PRINCIPALE ===== */
    
    /**
     * Avvia l'applicazione - punto di ingresso principale
     */
    init: function() {
        this.startTime = performance.now();
        
        console.log('🚀 Avvio Visualizzatore Modelli 3D');
        console.log('📅 Caricamento moduli in corso...');
        
        try {
            // Verifica compatibilità browser
            this.checkBrowserCompatibility();
            
            // Carica dipendenze esterne (già importate come ES Module)
            this.loadExternalDependencies()
                .then(() => {
                    // Carica moduli dinamicamente PRIMA
                    return this.loadModules();
                })
                .then(() => {
                    // Ora possiamo usare AppConfig
                    console.log('✅ Versione:', window.AppConfig?.version || '1.0');
                    console.log('📅 Build:', window.AppConfig?.buildDate || 'Development');
                    
                    // Inizializza moduli dell'applicazione
                    return this.initializeModules();
                })
                .then(() => {
                    // Completa l'inizializzazione
                    this.onInitializationComplete();
                })
                .catch((error) => {
                    this.onInitializationError(error);
                });
                
        } catch (error) {
            this.onInitializationError(error);
        }
    },
    
    /**
     * Verifica la compatibilità del browser
     */
    checkBrowserCompatibility: function() {
        const issues = [];
        
        // Verifica WebGL
        if (!this.isWebGLSupported()) {
            issues.push('WebGL non supportato');
        }
        
        // Verifica File API
        if (!window.File || !window.FileReader) {
            issues.push('File API non supportata');
        }
        
        // Verifica Canvas
        if (!document.createElement('canvas').getContext) {
            issues.push('Canvas non supportato');
        }
        
        // Verifica ES6+ features
        if (!window.Promise || !Array.from) {
            issues.push('Funzionalità JavaScript moderne non supportate');
        }
        
        if (issues.length > 0) {
            throw new Error('Browser non compatibile: ' + issues.join(', '));
        }
        
        console.log('✅ Browser compatibile');
    },
    
    /**
     * Verifica supporto WebGL
     */
    isWebGLSupported: function() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                     (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    },
    
    /**
     * Carica le dipendenze esterne (Three.js, etc.)
     * Ora Three.js è già importato come ES Module
     */
    loadExternalDependencies: function() {
        return new Promise((resolve, reject) => {
            console.log('📦 Verifica dipendenze ES Module...');
            
            // Verifica se Three.js è disponibile (importato come ES Module)
            if (window.THREE) {
                console.log('✅ Three.js ES Module disponibile, versione:', THREE.REVISION);
                resolve();
                return;
            }
            
            // Se non è disponibile, c'è un problema con gli imports
            reject(new Error('Three.js ES Module non caricato correttamente'));
        });
    },
    
    /**
     * Carica uno script con URLs di fallback
     */
    loadScript: function(urls) {
        if (!Array.isArray(urls)) {
            urls = [urls];
        }
        
        return new Promise((resolve, reject) => {
            let urlIndex = 0;
            
            const attemptLoad = () => {
                if (urlIndex >= urls.length) {
                    reject(new Error('Nessun URL disponibile per il caricamento'));
                    return;
                }
                
                const script = document.createElement('script');
                script.src = urls[urlIndex];
                
                script.onload = function() {
                    console.log(`✅ Script caricato da: ${urls[urlIndex]}`);
                    resolve();
                };
                
                script.onerror = function() {
                    console.warn(`❌ Fallimento caricamento da: ${urls[urlIndex]}`);
                    urlIndex++;
                    attemptLoad();
                };
                
                document.head.appendChild(script);
            };
            
            attemptLoad();
        });
    },
    
    /**
     * Carica dinamicamente i moduli JavaScript
     */
    loadModules: async function() {
        console.log('📦 Caricamento moduli dinamico...');
        
        try {
            // Carica i moduli in sequenza (ora con architettura modulare)
            await this.loadModule('./js/config.js?nocache=999999');

            // Carica ParticleSystem prima di scene3d-modular (richiesto per effetti aria)
            await this.loadModule('./js/core/ParticleSystem.js?v=1000018');
            console.log('✅ Sistema particellare caricato');

            // Carica InterchangeableTracker prima di DragDropSystem (richiesto per tracking posizioni)
            try {
                await this.loadModule('./js/core/InterchangeableTracker.js?v=1000001');
                console.log('✅ Sistema tracking intercambiabili caricato');
            } catch (error) {
                console.warn('⚠️ InterchangeableTracker non caricato (opzionale):', error.message);
            }

            // Carica SnapSystem prima di DragDropSystem (richiesto per logica snap)
            try {
                await this.loadModule('./js/core/SnapSystem.js?v=1000001');
                console.log('✅ Sistema snap caricato');
            } catch (error) {
                console.warn('⚠️ SnapSystem non caricato (opzionale):', error.message);
            }

            // Carica DragDropSystem opzionale (può fallire senza rompere l'app)
            try {
                await this.loadModule('./js/core/DragDropSystem.js?nocache=1000031');
                console.log('✅ Sistema drag & drop caricato');

                // Carica debug helpers per DragDropSystem
                try {
                    await this.loadModule('./js/core/DragDropDebugHelpers.js?v=1000001');
                    console.log('✅ Debug helpers drag & drop caricati');
                } catch (debugError) {
                    console.warn('⚠️ Debug helpers non caricati (opzionale):', debugError.message);
                }

                // Carica event handlers e drag lifecycle (mixin su DragDropSystem)
                try {
                    await this.loadModule('./js/core/DragDropEvents.js?v=1000001');
                    console.log('✅ Event handlers drag & drop caricati');
                } catch (eventsError) {
                    console.warn('⚠️ DragDropEvents non caricato (opzionale):', eventsError.message);
                }
            } catch (error) {
                console.warn('⚠️ DragDropSystem non caricato (opzionale):', error.message);
            }

            // Carica AssemblySystemSimplified (nuovo sistema semplificato)
            try {
                await this.loadModule('./js/core/AssemblySystemSimplified.js?v=2000001');
                console.log('✅ Sistema assemblaggio semplificato caricato');
            } catch (error) {
                console.warn('⚠️ AssemblySystemSimplified non caricato:', error.message);

                // Fallback al sistema vecchio se quello nuovo non è disponibile
                try {
                    await this.loadModule('./js/core/AssemblySystem.js?nocache=1000022');
                    console.log('✅ Sistema assemblaggio sequenziale (fallback) caricato');
                } catch (fallbackError) {
                    console.warn('⚠️ Nessun sistema di assemblaggio disponibile:', fallbackError.message);
                }
            }

            // Carica ScreenSystem per schermi interattivi (touchscreen simulati)
            try {
                await this.loadModule('./js/core/ScreenSystem.js?v=1000001');
                console.log('✅ Sistema schermi interattivi caricato');
            } catch (error) {
                console.warn('⚠️ ScreenSystem non caricato (opzionale):', error.message);
            }

            // Carica HoldableSystem per oggetti prendibili in mano
            try {
                await this.loadModule('./js/core/HoldableSystem.js?v=1000007');
                console.log('✅ Sistema oggetti prendibili caricato');
            } catch (error) {
                console.warn('⚠️ HoldableSystem non caricato (opzionale):', error.message);
            }

            // Carica StepController per gestione centralizzata trigger/azioni step
            try {
                await this.loadModule('./js/core/StepController.js?v=1000008');
                console.log('✅ Controller step centralizzato caricato (v1000008 - Fix auto-avanzamento dopo trigger)');
            } catch (error) {
                console.warn('⚠️ StepController non caricato (opzionale):', error.message);
            }

            // Carica StepGatingManager per gating pulsanti e camera basato su step
            try {
                await this.loadModule('./js/core/StepGatingManager.js?v=1000001');
                console.log('✅ Step Gating Manager caricato');
            } catch (error) {
                console.warn('⚠️ StepGatingManager non caricato (opzionale):', error.message);
            }

            // Carica InteractiveObject3D per oggetti 3D con figli interattivi (pulsanti, chiavi, LED)
            try {
                await this.loadModule('./js/core/InteractiveObject3D.js?v=1000003');
                console.log('✅ Sistema oggetti 3D interattivi caricato');
            } catch (error) {
                console.warn('⚠️ InteractiveObject3D non caricato (opzionale):', error.message);
            }

            // Carica AnimatedWindowSystem per finestre 2D con animazione a trigger alternato
            try {
                await this.loadModule('./js/core/AnimatedWindowSystem.js?v=1000001');
                console.log('✅ Sistema finestra 2D animata caricato');
            } catch (error) {
                console.warn('⚠️ AnimatedWindowSystem non caricato (opzionale):', error.message);
            }

            // Carica MovementParser per parsing comandi movimento tutorial
            await this.loadModule('./js/core/MovementParser.js?v=1000001');
            console.log('✅ Parser comandi movimento caricato');

            // Carica MultiStepAnimationSystem per gestione animazioni sequenziali
            await this.loadModule('./js/core/MultiStepAnimationSystem.js?v=1000001');
            console.log('✅ Sistema animazioni multi-step caricato');

            await this.loadModule('./js/scene3d-modular.js?nocache=1000032');  // REFACTOR: usa MovementParser e MultiStepAnimationSystem esterni
            await this.loadModule('./js/modelloader.js?nocache=1000011');

            // Carica moduli UI refactorizzati in ordine di dipendenza
            console.log('📦 Caricamento moduli UI refactorizzati...');
            await this.loadModule('./js/ui/UICore.js?nocache=1000026');
            await this.loadModule('./js/ui/ScenarioManager.js?nocache=1000027');
            await this.loadModule('./js/ui/TutorialManager.js?nocache=1000027');
            // ToolsManager.js è già caricato nell'HTML
            await this.loadModule('./js/ui/ui-coordinator.js?nocache=1000026');
            await this.loadModule('./js/ui/CVTScriptV3.js?v=1000001');  // Pre-processore v3→v2 (deve precedere ui.js)
            console.log('✅ Moduli UI refactorizzati caricati');

            await this.loadModule('./js/ui.js?nocache=1000041');  // CVTScript v3: pre-processore applicato in loadTutorial

            // Inizializza il sistema UI refactorizzato se disponibile
            if (window.UI && typeof window.UI.init === 'function' && window.UI._tutorialManager !== undefined) {
                console.log('🚀 Inizializzazione sistema UI refactorizzato...');
                try {
                    const initSuccess = window.UI.init();
                    if (initSuccess) {
                        console.log('✅ Sistema UI refactorizzato inizializzato con successo');
                    } else {
                        console.warn('⚠️ Inizializzazione sistema UI refactorizzato fallita');
                    }
                } catch (error) {
                    console.error('❌ Errore inizializzazione sistema UI refactorizzato:', error);
                }
            } else {
                console.log('📦 Sistema UI legacy attivo');
            }

            // Inizializza MobileOptimizer se disponibile
            if (window.MobileOptimizer && typeof window.MobileOptimizer.init === 'function') {
                window.MobileOptimizer.init();
            }

            console.log('✅ Tutti i moduli caricati (architettura modulare ottimizzata)');
        } catch (error) {
            throw new Error(`Errore caricamento moduli: ${error.message}`);
        }
    },
    
    /**
     * Carica un singolo modulo JavaScript
     */
    loadModule: function(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`✅ Modulo caricato: ${src}`);
                resolve();
            };
            script.onerror = () => {
                reject(new Error(`Impossibile caricare ${src}`));
            };
            document.head.appendChild(script);
        });
    },
    
    /**
     * Inizializza tutti i moduli dell'applicazione
     */
    initializeModules: function() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Inizializzazione moduli...');
            
            // Aggiungi un piccolo ritardo per permettere ai moduli di definirsi completamente
            setTimeout(() => {
                try {
                    // Verifica disponibilità moduli
                    this.checkModulesAvailability();
                    
                    // Inizializza in ordine di dipendenza
                    this.initializeModuleSequence()
                        .then(resolve)
                        .catch(reject);
                        
                } catch (error) {
                    reject(error);
                }
            }, 200); // Ritardo maggiore per permettere ai moduli di essere definiti completamente
        });
    },
    
    /**
     * Verifica che tutti i moduli richiesti siano disponibili
     */
    checkModulesAvailability: function() {
        const missingModules = [];
        const availableModules = [];
        
        this.requiredModules.forEach(moduleName => {
            if (!window[moduleName]) {
                missingModules.push(moduleName);
            } else {
                availableModules.push(moduleName);
            }
        });
        
        console.log('🔍 Verifica moduli:');
        console.log('  ✅ Disponibili:', availableModules);
        console.log('  ❌ Mancanti:', missingModules);
        
        // Lista tutti gli oggetti globali per debug
        const allGlobals = Object.keys(window).filter(key => 
            key.startsWith('App') || key.startsWith('Scene3D') || key.startsWith('ModelLoader') || key.startsWith('UI')
        );
        console.log('  🌐 Oggetti globali rilevanti:', allGlobals);
        
        if (missingModules.length > 0) {
            throw new Error('Moduli mancanti: ' + missingModules.join(', '));
        }
        
        console.log('✅ Tutti i moduli richiesti sono disponibili');
    },
    
    /**
     * Inizializza i moduli nella sequenza corretta
     */
    initializeModuleSequence: function() {
        return new Promise((resolve, reject) => {
            const sequence = [
                // 1. Configurazioni (già disponibili)
                () => Promise.resolve(),
                
                // 2. ModelLoader (non dipende dalla scena)
                () => this.initializeModule('ModelLoader'),
                
                // 3. UI (deve essere pronto prima della scena per feedback)
                () => this.initializeModule('UI'),
                
                // 4. Scene3D (ultimo perché potrebbe richiedere feedback UI)
                // Nota: La scena verrà inizializzata quando si passa alla pagina scenario
            ];
            
            // Esegui sequenza
            this.executeSequence(sequence, 0)
                .then(resolve)
                .catch(reject);
        });
    },
    
    /**
     * Esegue una sequenza di funzioni in ordine
     */
    executeSequence: function(sequence, index) {
        return new Promise((resolve, reject) => {
            if (index >= sequence.length) {
                resolve();
                return;
            }
            
            sequence[index]()
                .then(() => {
                    this.executeSequence(sequence, index + 1)
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    },
    
    /**
     * Inizializza un singolo modulo
     */
    initializeModule: function(moduleName) {
        return new Promise((resolve, reject) => {
            console.log(`🔧 Inizializzazione ${moduleName}...`);
            
            try {
                const module = window[moduleName];
                
                if (!module) {
                    throw new Error(`Modulo ${moduleName} non trovato`);
                }
                
                // Inizializza se ha un metodo init
                if (typeof module.init === 'function') {
                    const result = module.init();
                    
                    // Gestisci risultato Promise o sincrono
                    if (result && typeof result.then === 'function') {
                        result
                            .then(() => {
                                this.modules[moduleName] = module;
                                console.log(`✅ ${moduleName} inizializzato`);
                                resolve();
                            })
                            .catch(reject);
                    } else {
                        this.modules[moduleName] = module;
                        console.log(`✅ ${moduleName} inizializzato`);
                        resolve();
                    }
                } else {
                    // Modulo senza init (già pronto)
                    this.modules[moduleName] = module;
                    console.log(`✅ ${moduleName} pronto`);
                    resolve();
                }
                
            } catch (error) {
                console.error(`❌ Errore inizializzazione ${moduleName}:`, error);
                reject(error);
            }
        });
    },
    
    /* ===== GESTIONE COMPLETAMENTO/ERRORI ===== */
    
    /**
     * Chiamata quando l'inizializzazione è completata con successo
     */
    onInitializationComplete: function() {
        this.initialized = true;
        
        const elapsed = Math.round(performance.now() - this.startTime);
        console.log(`🎉 Applicazione inizializzata in ${elapsed}ms`);
        console.log('📊 Moduli attivi:', Object.keys(this.modules));
        
        // Log configurazione per debug
        if (window.AppConfig && window.AppConfig.debug.enableLogging) {
            console.log('⚙️ Configurazione:', {
                version: window.AppConfig.version,
                debug: window.AppConfig.debug.currentLogLevel,
                device: {
                    mobile: window.AppConfig.isMobile(),
                    tablet: window.AppConfig.isTablet(),
                    desktop: window.AppConfig.isDesktop()
                }
            });
        }
        
        // Nascondi eventuali loader di inizializzazione
        this.hideInitializationLoader();
        
        // Event per possibili hook esterni
        this.dispatchEvent('app:initialized');
    },
    
    /**
     * Chiamata quando l'inizializzazione fallisce
     */
    onInitializationError: function(error) {
        console.error('💥 Errore inizializzazione applicazione:', error);
        
        // Mostra errore all'utente
        this.showFatalError(error.message || 'Errore sconosciuto durante l\'inizializzazione');
        
        // Event per possibili hook esterni
        this.dispatchEvent('app:error', { error });
    },
    
    /**
     * Mostra un errore fatale all'utente
     */
    showFatalError: function(message) {
        // Crea un overlay di errore semplice
        const errorOverlay = document.createElement('div');
        errorOverlay.id = 'fatal-error';
        errorOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(231, 76, 60, 0.95);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            z-index: 9999;
            backdrop-filter: blur(5px);
        `;
        
        errorOverlay.innerHTML = `
            <div style=\"text-align: center; max-width: 500px; padding: 30px;\">
                <h1 style=\"font-size: 48px; margin: 0 0 20px 0;\">⚠️</h1>
                <h2 style=\"margin: 0 0 20px 0;\">Errore di Inizializzazione</h2>
                <p style=\"font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;\">${message}</p>
                <button onclick=\"location.reload()\" style=\"
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 2px solid white;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                \">
                    🔄 Ricarica Pagina
                </button>
                <p style=\"font-size: 12px; opacity: 0.8; margin: 20px 0 0 0;\">
                    Assicurati di avere un browser moderno con WebGL attivato
                </p>
            </div>
        `;
        
        document.body.appendChild(errorOverlay);
    },
    
    /**
     * Nasconde il loader di inizializzazione se presente
     */
    hideInitializationLoader: function() {
        const loader = document.getElementById('init-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    },
    
    /* ===== UTILITY ===== */
    
    /**
     * Dispatcha un evento personalizzato
     */
    dispatchEvent: function(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
    },
    
    /**
     * Restituisce informazioni sullo stato dell'applicazione
     */
    getStatus: function() {
        return {
            initialized: this.initialized,
            modules: Object.keys(this.modules),
            startTime: this.startTime,
            version: window.AppConfig?.version || 'unknown'
        };
    }
};

/* ===== AVVIO AUTOMATICO ===== */

// Avvia l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM pronto, avvio applicazione...');
    
    // Piccolo ritardo per permettere al browser di terminare il rendering iniziale
    setTimeout(() => {
        window.App.init();
    }, 100);
});

// Gestione errori JavaScript globali
window.addEventListener('error', function(event) {
    console.error('💥 Errore JavaScript globale:', event.error);
    
    // Se l'applicazione non è ancora inizializzata, potrebbe essere un errore critico
    if (!window.App.initialized) {
        window.App.showFatalError('Errore critico durante il caricamento: ' + event.message);
    }
});

// Gestione promise rejections non catturate
window.addEventListener('unhandledrejection', function(event) {
    console.error('💥 Promise rejection non gestita:', event.reason);
    
    // Previeni che l'errore venga loggato di default
    event.preventDefault();
});

console.log('📄 App.js caricato, in attesa del DOM...');