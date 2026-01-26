/**
 * ToolRegistry.js
 * Sistema centralizzato per gestione strumenti (Tools) runtime
 *
 * Responsabilità:
 * - Registrazione strumenti da file config.txt
 * - Fornire accesso a configurazione strumenti per UI e tutorial
 * - Validazione asset (icone, cursori)
 * - Fallback a configurazione default se config non presente
 *
 * @version 1.0.0
 * @date Gennaio 2026
 */

window.ToolRegistry = (function() {
    'use strict';

    // ============================================================================
    // STATE
    // ============================================================================

    const state = {
        tools: new Map(),           // Map<toolId, ToolConfig>
        toolsOrder: [],             // Array di toolId nell'ordine di dichiarazione
        isInitialized: false,       // Flag inizializzazione
        configLoaded: false,        // Flag config caricato
        scenarioPath: null          // Path scenario corrente
    };

    // Configurazione default strumenti (fallback)
    const DEFAULT_TOOLS = [
        {
            id: 'brugola',
            label: 'Chiave a Brugola',
            icon: 'utilimages/brugola.png',
            cursor: 'cursors/brugola_normal.svg',
            cursorPressed: 'cursors/brugola_premuto_frame1.svg',
            type: 'tool',
            tutorialNames: ['ChiaveBrugola', 'brugola']
        },
        {
            id: 'chiave_inglese',
            label: 'Chiave Inglese',
            icon: 'utilimages/chiave_inglese.png',
            cursor: 'cursors/chiave_inglese_normal.svg',
            cursorPressed: 'cursors/chiave_inglese_premuto_frame1.svg',
            type: 'tool',
            tutorialNames: ['ChiaveInglese', 'chiave_inglese']
        },
        {
            id: 'mano',
            label: 'Mano',
            icon: 'utilimages/mano.png',
            cursor: 'cursors/mano.svg',
            type: 'hand',
            tutorialNames: ['Mani', 'Mano', 'mano']
        },
        {
            id: 'aria',
            label: 'Aria Compressa',
            icon: 'utilimages/air.png',
            cursor: 'cursors/pistola_normal.svg',
            cursorPressed: 'cursors/pistola_premuto.svg',
            type: 'tool',
            tutorialNames: ['Aria', 'AriaCompressa', 'aria']
        }
    ];

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Inizializza il registry con configurazione default
     */
    function init() {
        if (state.isInitialized) {
            console.warn('[ToolRegistry] Già inizializzato');
            return;
        }

        console.log('[ToolRegistry] Inizializzazione con configurazione default...');
        loadDefaultTools();
        state.isInitialized = true;
        console.log(`[ToolRegistry] ✅ Inizializzato con ${state.tools.size} strumenti default`);
    }

    /**
     * Carica strumenti default nel registry
     */
    function loadDefaultTools() {
        state.tools.clear();
        state.toolsOrder = [];

        DEFAULT_TOOLS.forEach(tool => {
            state.tools.set(tool.id, tool);
            state.toolsOrder.push(tool.id);
        });

        state.configLoaded = false;
    }

    // ============================================================================
    // CONFIG LOADING
    // ============================================================================

    /**
     * Carica config.txt da path specificato
     * @param {string} configPath - Path relativo del file config.txt
     * @param {string} scenarioPath - Path scenario per risolvere path relativi
     * @returns {Promise<boolean>} - true se caricato con successo
     */
    async function loadConfig(configPath, scenarioPath) {
        if (!configPath) {
            console.log('[ToolRegistry] Nessun config.txt specificato, uso configurazione default');
            loadDefaultTools();
            return false;
        }

        console.log(`[ToolRegistry] 📥 Caricamento config da: ${configPath}`);
        state.scenarioPath = scenarioPath;

        try {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const configText = await response.text();
            parseConfig(configText, scenarioPath);

            console.log(`[ToolRegistry] ✅ Config caricato: ${state.tools.size} strumenti definiti`);
            state.configLoaded = true;
            return true;

        } catch (error) {
            console.error(`[ToolRegistry] ❌ Errore caricamento config: ${error.message}`);
            console.warn('[ToolRegistry] Fallback a configurazione default');
            loadDefaultTools();
            return false;
        }
    }

    /**
     * Parser config.txt (formato INI-style)
     * @param {string} configText - Contenuto file config.txt
     * @param {string} scenarioPath - Path scenario per path relativi
     */
    function parseConfig(configText, scenarioPath) {
        const lines = configText.split('\n');
        const toolSlots = [null, null, null, null]; // 4 slot fissi (index 0-3 → Slot1-4)
        const toolDefinitions = new Map(); // Map<toolId, ToolConfig>

        let currentSection = null;
        let currentToolId = null;
        let currentToolConfig = null;

        // Prima passata: identifica sezioni e raccogli dati
        lines.forEach((line, index) => {
            line = line.trim();

            // Ignora commenti e righe vuote
            if (!line || line.startsWith('#') || line.startsWith(';')) return;

            // Sezione [Tools]
            if (line === '[Tools]') {
                currentSection = 'tools';
                currentToolId = null;
                return;
            }

            // Sezione [Tool:ToolId]
            const toolSectionMatch = line.match(/^\[Tool:(\w+)\]$/);
            if (toolSectionMatch) {
                currentSection = 'tool-definition';
                currentToolId = toolSectionMatch[1];
                currentToolConfig = {
                    id: currentToolId,
                    label: currentToolId,
                    icon: null,
                    cursor: null,
                    cursorPressed: null,
                    cursorPressedFrame2: null,
                    cursorHotspotX: 0,
                    cursorHotspotY: 0,
                    type: 'tool',
                    tutorialNames: [currentToolId]
                };
                toolDefinitions.set(currentToolId, currentToolConfig);
                return;
            }

            // Parsing proprietà
            const propMatch = line.match(/^(\w+)=(.+)$/);
            if (!propMatch) return;

            const [, key, value] = propMatch;

            if (currentSection === 'tools') {
                // Supporto NUOVO formato: Slot1=toolId, Slot2=toolId, ...
                // E formato VECCHIO: Tool=toolId per backwards compatibility
                const slotMatch = key.match(/^Slot(\d+)$/);
                if (slotMatch) {
                    const slotIndex = parseInt(slotMatch[1], 10) - 1; // Slot1 → index 0
                    if (slotIndex >= 0 && slotIndex < 4) {
                        toolSlots[slotIndex] = value.trim();
                    } else {
                        console.warn(`[ToolRegistry] ⚠️ Slot ${slotMatch[1]} non valido (ammessi: 1-4)`);
                    }
                } else if (key === 'Tool') {
                    // Formato vecchio: Tool=toolId → aggiungi al primo slot libero
                    const freeSlotIndex = toolSlots.findIndex(slot => slot === null);
                    if (freeSlotIndex !== -1) {
                        toolSlots[freeSlotIndex] = value.trim();
                    } else {
                        console.warn(`[ToolRegistry] ⚠️ Tool="${value}" ignorato: tutti gli slot già occupati`);
                    }
                }
            } else if (currentSection === 'tool-definition' && currentToolConfig) {
                // Proprietà strumento in [Tool:...]
                switch (key) {
                    case 'Label':
                        currentToolConfig.label = value.trim();
                        break;
                    case 'Icon':
                        currentToolConfig.icon = value.trim();
                        break;
                    case 'Cursor':
                        currentToolConfig.cursor = value.trim();
                        break;
                    case 'CursorPressed':
                        currentToolConfig.cursorPressed = value.trim();
                        break;
                    case 'CursorPressedFrame2':
                        currentToolConfig.cursorPressedFrame2 = value.trim();
                        break;
                    case 'CursorHotspotX':
                        currentToolConfig.cursorHotspotX = parseInt(value.trim(), 10) || 0;
                        break;
                    case 'CursorHotspotY':
                        currentToolConfig.cursorHotspotY = parseInt(value.trim(), 10) || 0;
                        break;
                    case 'Type':
                        currentToolConfig.type = value.trim();
                        break;
                    case 'TutorialNames':
                        // Lista separata da virgola
                        currentToolConfig.tutorialNames = value.split(',').map(n => n.trim());
                        break;
                }
            }
        });

        // Seconda passata: registra strumenti nei 4 slot fissi
        state.tools.clear();
        state.toolsOrder = [];

        // Popola sempre esattamente 4 slot
        for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
            const toolId = toolSlots[slotIndex];
            const slotNumber = slotIndex + 1;

            if (toolId) {
                // Slot specificato nel config
                // Cerca prima nelle definizioni custom
                let toolConfig = toolDefinitions.get(toolId);

                // Se non trovato nelle custom, cerca nei default
                if (!toolConfig) {
                    toolConfig = DEFAULT_TOOLS.find(t => t.id === toolId);
                    if (toolConfig) {
                        console.log(`[ToolRegistry] 🔧 Slot${slotNumber}: ${toolId} (default)`);
                    } else {
                        console.warn(`[ToolRegistry] ⚠️ Slot${slotNumber}: Tool "${toolId}" non trovato, uso default slot`);
                        toolConfig = DEFAULT_TOOLS[slotIndex];
                        console.log(`[ToolRegistry] 🔧 Slot${slotNumber}: ${toolConfig.id} (fallback slot default)`);
                    }
                } else {
                    validateToolAssets(toolConfig, scenarioPath);
                    console.log(`[ToolRegistry] 🔧 Slot${slotNumber}: ${toolId} (${toolConfig.label}) custom`);
                }

                if (toolConfig) {
                    state.tools.set(toolConfig.id, toolConfig);
                    state.toolsOrder.push(toolConfig.id);
                }
            } else {
                // Slot non specificato → usa tool default per questo slot
                const defaultTool = DEFAULT_TOOLS[slotIndex];
                if (defaultTool) {
                    state.tools.set(defaultTool.id, defaultTool);
                    state.toolsOrder.push(defaultTool.id);
                    console.log(`[ToolRegistry] 🔧 Slot${slotNumber}: ${defaultTool.id} (default)`);
                }
            }
        }

        // Warning per strumenti definiti ma non assegnati ad alcuno slot
        toolDefinitions.forEach((config, toolId) => {
            if (!toolSlots.includes(toolId)) {
                console.warn(`[ToolRegistry] ⚠️ Strumento "${toolId}" definito ma non assegnato ad alcuno slot`);
            }
        });
    }

    /**
     * Valida asset strumento (icone, cursori)
     * @param {object} toolConfig - Configurazione strumento
     * @param {string} scenarioPath - Path scenario
     */
    function validateToolAssets(toolConfig, scenarioPath) {
        // Validazione icona
        if (!toolConfig.icon) {
            console.warn(`[ToolRegistry] ⚠️ Strumento "${toolConfig.id}": icona mancante`);
        } else if (!toolConfig.icon.startsWith('utilimages/')) {
            console.warn(`[ToolRegistry] ⚠️ Strumento "${toolConfig.id}": icona deve essere in /utilimages/`);
        }

        // Validazione cursor
        if (!toolConfig.cursor) {
            console.warn(`[ToolRegistry] ⚠️ Strumento "${toolConfig.id}": cursor mancante`);
        } else if (!toolConfig.cursor.startsWith('cursor/') && !toolConfig.cursor.startsWith('cursors/')) {
            console.warn(`[ToolRegistry] ⚠️ Strumento "${toolConfig.id}": cursor deve essere in /cursor/ o /cursors/`);
        }
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    /**
     * Ottiene strumento per ID
     * @param {string} toolId - ID strumento
     * @returns {object|null} - Configurazione strumento o null
     */
    function getTool(toolId) {
        return state.tools.get(toolId) || null;
    }

    /**
     * Ottiene tutti gli strumenti nell'ordine di dichiarazione
     * @returns {Array<object>} - Array configurazioni strumenti
     */
    function getAllTools() {
        return state.toolsOrder.map(toolId => state.tools.get(toolId));
    }

    /**
     * Ottiene strumento per nome usato nel tutorial (Utensile=...)
     * @param {string} tutorialName - Nome strumento nel tutorial
     * @returns {object|null} - Configurazione strumento o null
     */
    function getToolByTutorialName(tutorialName) {
        for (const [toolId, config] of state.tools) {
            if (config.tutorialNames && config.tutorialNames.includes(tutorialName)) {
                return config;
            }
            // Fallback: confronto diretto con ID
            if (toolId === tutorialName.toLowerCase()) {
                return config;
            }
        }

        console.warn(`[ToolRegistry] ⚠️ Strumento tutorial "${tutorialName}" non definito in config`);
        return null;
    }

    /**
     * Verifica se uno strumento è definito
     * @param {string} toolId - ID strumento
     * @returns {boolean}
     */
    function hasTool(toolId) {
        return state.tools.has(toolId);
    }

    /**
     * Ottiene numero di strumenti registrati
     * @returns {number}
     */
    function getToolCount() {
        return state.tools.size;
    }

    /**
     * Reset registry (utile per cambio scenario)
     */
    function reset() {
        console.log('[ToolRegistry] Reset registry');
        loadDefaultTools();
        state.scenarioPath = null;
    }

    /**
     * Debug info
     */
    function debugInfo() {
        console.log('═══════════════════════════════════════');
        console.log('📋 ToolRegistry - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log(`Inizializzato: ${state.isInitialized}`);
        console.log(`Config caricato: ${state.configLoaded}`);
        console.log(`Scenario path: ${state.scenarioPath || 'N/A'}`);
        console.log(`Strumenti registrati: ${state.tools.size}`);
        console.log('───────────────────────────────────────');

        state.toolsOrder.forEach((toolId, index) => {
            const config = state.tools.get(toolId);
            console.log(`${index + 1}. ${toolId}`);
            console.log(`   Label: ${config.label}`);
            console.log(`   Icon: ${config.icon || 'N/A'}`);
            console.log(`   Cursor: ${config.cursor || 'N/A'}`);
            console.log(`   Type: ${config.type}`);
            console.log(`   Tutorial Names: [${config.tutorialNames.join(', ')}]`);
        });

        console.log('═══════════════════════════════════════');
    }

    // ============================================================================
    // PUBLIC INTERFACE
    // ============================================================================

    return {
        // Initialization
        init,
        loadConfig,
        reset,

        // Getters
        getTool,
        getAllTools,
        getToolByTutorialName,
        hasTool,
        getToolCount,

        // State
        get isInitialized() { return state.isInitialized; },
        get configLoaded() { return state.configLoaded; },

        // Debug
        debugInfo
    };

})();
