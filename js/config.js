/**
 * CONFIG.JS - Configurazioni e costanti dell'applicazione
 * 
 * Questo modulo contiene:
 * - Configurazioni globali dell'applicazione
 * - URL di risorse esterne
 * - Impostazioni di default per la scena 3D
 * - Costanti per animazioni e controlli
 */

/* ===== CONFIGURAZIONI GLOBALI ===== */

window.AppConfig = {
    
    /* ===== CONFIGURAZIONI 3D ===== */
    scene3D: {
        // Impostazioni camera
        camera: {
            fov: 75,                    // Campo visivo della camera in gradi
            near: 0.1,                  // Piano near della camera (oggetti più vicini non vengono renderizzati)
            far: 1000,                  // Piano far della camera (oggetti più lontani non vengono renderizzati)
            initialPosition: {          // Posizione iniziale della camera
                x: 0,
                y: 0,
                z: 5
            }
        },
        
        // Impostazioni luci
        lighting: {
            ambient: {
                color: 0x404040,        // Colore luce ambientale (grigio scuro)
                intensity: 0.8          // Intensità luce ambientale aumentata
            },
            directional: {
                color: 0xffffff,        // Colore luce direzionale (bianco)
                intensity: 0.8,         // Intensità luce direzionale
                position: {             // Posizione della luce
                    x: 1,
                    y: 1,
                    z: 1
                }
            }
        },
        
        // Impostazioni renderer
        renderer: {
            antialias: true,            // Attiva l'antialiasing per bordi più lisci
            alpha: true,                // Sfondo trasparente
            shadowMapEnabled: true,     // Abilita le ombre
            shadowMapType: 'PCFSoft'    // Tipo di shadow map (più morbide)
        },
        
        // Colori di default per materiali
        materials: {
            defaultColor: 0x888888,     // Grigio visibile per materiali di default
            wireframeColor: 0xff0000,   // Rosso per modalità wireframe
            selectedColor: 0xffff00     // Giallo per oggetti selezionati
        }
    },
    
    /* ===== CONFIGURAZIONI CONTROLLI ===== */
    controls: {
        // Sensibilità controlli mouse
        mouseSensitivity: {
            rotation: 0.01,             // Sensibilità rotazione (più basso = meno sensibile)
            pan: 0.002,                 // Sensibilità panoramica
            zoom: 0.1                   // Sensibilità zoom
        },
        
        // Limiti di movimento
        limits: {
            minZoom: 0.1,               // Zoom minimo
            maxZoom: 100,               // Zoom massimo
            maxPolarAngle: Math.PI      // Angolo massimo verticale
        },
        
        // Inerzia e smorzamento
        damping: {
            enabled: true,              // Abilita smorzamento movimento
            factor: 0.05                // Fattore di smorzamento (più basso = più fluido)
        }
    },
    
    /* ===== CONFIGURAZIONI ANIMAZIONI ===== */
    animations: {
        // Durata delle transizioni in millisecondi
        transitions: {
            pageChange: 500,            // Transizione tra pagine
            modelLoad: 300,             // Apparizione modello caricato
            cameraMove: 1000,           // Movimento camera automatico
            error: 200                  // Apparizione messaggio errore
        },
        
        // Impostazioni animazioni scenario
        scenario: {
            defaultDuration: 5000,      // Durata default animazione (5 secondi)
            stepDelay: 100,             // Ritardo tra passi animazione
            loopDelay: 2000             // Pausa tra loop animazione
        }
    },
    
    /* ===== CONFIGURAZIONI FILE ===== */
    files: {
        // Tipi di file supportati
        supportedFormats: {
            models: ['.obj', '.stl', '.gltf', '.glb'],
            materials: ['.mtl'],
            textures: ['.jpg', '.jpeg', '.png', '.bmp', '.tga'],
            animations: ['.txt', '.csv'],
            configs: ['.txt', '.cfg']
        },
        
        // Dimensioni massime file (in MB)
        maxSizes: {
            model: 50,                  // 50MB per modelli 3D
            texture: 10,                // 10MB per texture
            animation: 5,               // 5MB per file animazione
            config: 1                   // 1MB per file configurazione
        },
        
        // Encoding di default
        encoding: 'utf-8'
    },
    
    /* ===== URL E RISORSE ESTERNE ===== */
    external: {
        // URL Three.js (possibili CDN di fallback)
        threejs: [
            'https://unpkg.com/three@0.155.0/build/three.min.js',
            'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js'
        ],
        
        // Loader aggiuntivi se necessari
        loaders: {
            obj: 'https://unpkg.com/three@0.155.0/examples/js/loaders/OBJLoader.js',
            mtl: 'https://unpkg.com/three@0.155.0/examples/js/loaders/MTLLoader.js',
            gltf: 'https://unpkg.com/three@0.155.0/examples/js/loaders/GLTFLoader.js'
        }
    },
    
    /* ===== CONFIGURAZIONI UI ===== */
    ui: {
        // Messaggi di stato per l'utente
        messages: {
            loading: 'Caricamento in corso...',
            ready: 'Pronto',
            error: 'Si è verificato un errore',
            noFile: 'Nessun file selezionato',
            processing: 'Elaborazione...',
            success: 'Operazione completata'
        },
        
        // Timeout per operazioni (in millisecondi)
        timeouts: {
            fileLoad: 30000,            // 30 secondi per caricamento file
            sceneRender: 5000,          // 5 secondi per rendering scena
            userFeedback: 3000          // 3 secondi per messaggi utente
        },
        
        // Impostazioni responsive
        breakpoints: {
            mobile: 768,                // Larghezza massima per mobile
            tablet: 1024,               // Larghezza massima per tablet
            desktop: 1920               // Larghezza massima per desktop
        }
    },
    
    /* ===== CONFIGURAZIONI DEBUG ===== */
    debug: {
        // Abilita/disabilita log console
        enableLogging: true,
        
        // Livelli di log
        logLevel: {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        },
        
        // Livello corrente (cambiare per più/meno dettagli)
        currentLogLevel: 2, // INFO
        
        // Mostra statistiche performance
        showStats: false,
        
        // Mostra helper wireframe
        showWireframe: false
    },
    
    /* ===== VERSIONING ===== */
    version: '1.0.0',
    buildDate: new Date().toISOString().split('T')[0], // Data corrente in formato YYYY-MM-DD
    
    /* ===== FUNZIONI HELPER ===== */
    
    /**
     * Verifica se siamo su dispositivo mobile
     * @returns {boolean} True se dispositivo mobile
     */
    isMobile: function() {
        return window.innerWidth <= this.ui.breakpoints.mobile;
    },
    
    /**
     * Verifica se siamo su tablet
     * @returns {boolean} True se tablet
     */
    isTablet: function() {
        return window.innerWidth > this.ui.breakpoints.mobile && 
               window.innerWidth <= this.ui.breakpoints.tablet;
    },
    
    /**
     * Verifica se siamo su desktop
     * @returns {boolean} True se desktop
     */
    isDesktop: function() {
        return window.innerWidth > this.ui.breakpoints.tablet;
    },
    
    /**
     * Log con controllo del livello
     * @param {number} level - Livello del log
     * @param {string} message - Messaggio da loggare
     * @param {...any} args - Argomenti aggiuntivi
     */
    log: function(level, message, ...args) {
        if (!this.debug.enableLogging || level > this.debug.currentLogLevel) {
            return;
        }
        
        const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
        const levelName = levelNames[level] || 'LOG';
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`[${timestamp}] ${levelName}: ${message}`, ...args);
    }
};

// Esporta configurazioni per compatibilità con sistemi di moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.AppConfig;
}