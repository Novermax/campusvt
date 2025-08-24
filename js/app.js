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

// Rendi Three.js disponibile globalmente per compatibilità
window.THREE = THREE;
window.OBJLoader = OBJLoader;
window.MTLLoader = MTLLoader;
window.STLLoader = STLLoader;
window.GLTFLoader = GLTFLoader;

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
            // Carica i moduli in sequenza
            await this.loadModule('./js/config.js?nocache=999999');
            await this.loadModule('./js/scene3d.js?nocache=1000006');  
            await this.loadModule('./js/modelloader.js?nocache=1000005');
            await this.loadModule('./js/ui.js?nocache=1000003');
            
            console.log('✅ Tutti i moduli caricati');
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
        });
    },
    
    /**
     * Verifica che tutti i moduli richiesti siano disponibili
     */
    checkModulesAvailability: function() {
        const missingModules = [];
        
        this.requiredModules.forEach(moduleName => {
            if (!window[moduleName]) {
                missingModules.push(moduleName);
            }
        });
        
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