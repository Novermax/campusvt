/**
 * ToolsManager.js - Gestione strumenti e legenda
 *
 * Responsabilità:
 * - Inizializzazione legenda strumenti con icone
 * - Gestione stato attivazione/disattivazione strumenti
 * - Aggiornamento cursori canvas personalizzati
 * - Mappatura nomi strumenti da tutorial a nomi interni
 * - Evidenziazione strumenti richiesti (opzionale)
 * - Eventi customizzati per notifiche cambio stato
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

class ToolsManager {
    constructor() {
        this.toolsState = {};
        this.availableTools = [
            { name: 'brugola', icon: 'utilimages/brugola.png' },
            { name: 'chiave_inglese', icon: 'utilimages/chiave_inglese.png' },
            { name: 'mano', icon: 'utilimages/mano.png' },
            { name: 'aria', icon: 'utilimages/air.png' }
        ];
        this.isInitialized = false;
    }

    /**
     * Log sicuro che funziona anche se AppConfig non è caricato
     */
    safeLog(level, message, ...args) {
        if (window.AppConfig && AppConfig.log) {
            AppConfig.log(level, message, ...args);
        } else {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
            const levelName = levelNames[level] || 'LOG';
            console.log(`[${levelName}] ${message}`, ...args);
        }
    }

    /**
     * Inizializza il sistema di gestione strumenti
     */
    init() {
        this.safeLog(2, '[ToolsManager] Inizializzazione gestione strumenti...');

        try {
            this.initToolsLegend();
            this.isInitialized = true;
            this.safeLog(2, '[ToolsManager] Sistema strumenti inizializzato con successo');
            return true;

        } catch (error) {
            this.safeLog(0, '[ToolsManager] Errore inizializzazione:', error);
            return false;
        }
    }

    /**
     * Inizializza la legenda strumenti con icone
     */
    initToolsLegend() {
        const toolsContainer = document.getElementById('toolsContainer');
        if (!toolsContainer) {
            this.safeLog(1, '[ToolsManager] Contenitore strumenti non trovato');
            return;
        }

        // Pulisce il container
        toolsContainer.innerHTML = '';

        // Ottieni tool dinamici da ToolRegistry (se disponibile) o fallback a array hardcoded
        let tools;
        if (window.ToolRegistry && typeof window.ToolRegistry.getAllTools === 'function') {
            tools = window.ToolRegistry.getAllTools();
            this.safeLog(2, `[ToolsManager] Caricati ${tools.length} tool da ToolRegistry`);
        } else {
            // Fallback a tool hardcoded
            tools = this.availableTools;
            this.safeLog(1, '[ToolsManager] ToolRegistry non disponibile, uso tool di default');
        }

        // Crea le icone degli strumenti
        tools.forEach(tool => {
            const toolElement = document.createElement('div');
            toolElement.className = 'tool-icon';
            toolElement.dataset.tool = tool.id || tool.name; // Usa id da ToolRegistry, fallback a name
            toolElement.title = tool.label || tool.name.replace('_', ' ');

            const img = document.createElement('img');
            img.src = tool.icon;
            img.alt = tool.label || tool.name;
            img.onerror = () => {
                this.safeLog(1, `[ToolsManager] Icona non trovata: ${tool.icon}`);
                img.style.display = 'none';
            };

            toolElement.appendChild(img);
            toolElement.addEventListener('click', () => this.toggleTool(tool.id || tool.name));

            toolsContainer.appendChild(toolElement);

            // Inizializza lo stato dello strumento
            this.toolsState[tool.id || tool.name] = false;
        });

        this.safeLog(2, '[ToolsManager] Legenda strumenti inizializzata');
    }

    /**
     * Aggiorna la UI degli strumenti ricaricando da ToolRegistry
     * Usato dopo caricamento configurazione scenario
     */
    refreshToolsUI() {
        this.safeLog(2, '[ToolsManager] Refresh UI strumenti...');

        // Disattiva tutti i tool correnti
        this.deactivateAllTools();

        // Reset stato
        this.toolsState = {};

        // Ricrea la legenda
        this.initToolsLegend();

        this.safeLog(2, '[ToolsManager] UI strumenti aggiornata');
    }

    /**
     * Attiva/disattiva uno strumento (modalità esclusiva)
     * @param {string} toolName - Nome dello strumento
     */
    toggleTool(toolName) {
        // Se lo strumento è già attivo, non fare nulla (rimane attivo)
        if (this.toolsState[toolName]) {
            this.safeLog(2, `[ToolsManager] Strumento già attivo: ${toolName}`);
            return;
        }

        // Disattiva tutti gli altri strumenti (modalità esclusiva)
        Object.keys(this.toolsState).forEach(tool => {
            if (tool !== toolName) {
                this.toolsState[tool] = false;
                const element = document.querySelector(`[data-tool="${tool}"]`);
                if (element) element.classList.remove('active');
            }
        });

        // Attiva lo strumento corrente
        this.toolsState[toolName] = true;
        const element = document.querySelector(`[data-tool="${toolName}"]`);

        if (element) {
            element.classList.add('active');
        }

        // Aggiorna interfaccia e notifica cambio stato
        this.updateStatus(`Strumento attivo: ${toolName.replace('_', ' ')}`);
        this.safeLog(2, `[ToolsManager] Strumento attivato: ${toolName}`);
        this.onToolStateChanged(toolName, true);
    }

    /**
     * Disattiva manualmente uno strumento specifico
     * @param {string} toolName - Nome dello strumento
     */
    deactivateTool(toolName) {
        if (!this.toolsState[toolName]) return; // Già disattivato

        this.toolsState[toolName] = false;
        const element = document.querySelector(`[data-tool="${toolName}"]`);
        if (element) element.classList.remove('active');

        this.updateStatus('Nessuno strumento attivo');
        this.safeLog(2, `[ToolsManager] Strumento disattivato: ${toolName}`);
        this.onToolStateChanged(toolName, false);
    }

    /**
     * Disattiva tutti gli strumenti e ripristina cursori al default
     */
    deactivateAllTools() {
        // Disattiva ogni tool individualmente
        Object.keys(this.toolsState).forEach(toolName => {
            this.deactivateTool(toolName);
        });

        // IMPORTANTE: Rimuovi TUTTE le classi tool-*-active dal body (sia hardcoded che dinamiche)
        const bodyClasses = Array.from(document.body.classList);
        bodyClasses.forEach(cls => {
            if (cls.startsWith('tool-') && cls.endsWith('-active')) {
                document.body.classList.remove(cls);
            }
        });

        // Rimuovi anche classi animazione cursore
        document.body.classList.remove('cursor-frame-1', 'cursor-frame-2', 'mouse-pressed');

        // Reset inline style cursor su body
        document.body.style.cursor = '';

        // Reset classi cursore dal canvas
        const canvas = document.querySelector('#canvas3d, canvas');
        if (canvas) {
            canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            canvas.style.cursor = '';
        }

        this.safeLog(2, '[ToolsManager] Tutti gli strumenti disattivati e cursori ripristinati');
    }

    /**
     * Attiva strumento da nome tutorial (mapping automatico)
     * @param {string} tutorialToolName - Nome strumento da tutorial
     */
    activateToolFromTutorial(tutorialToolName) {
        const internalName = this.mapToolName(tutorialToolName);
        if (internalName) {
            this.toggleTool(internalName);
            this.safeLog(3, `[ToolsManager] Tool attivato da tutorial: ${tutorialToolName} → ${internalName}`);
        } else {
            this.safeLog(1, `[ToolsManager] Tool tutorial non riconosciuto: ${tutorialToolName}`);
        }
    }

    /**
     * Ottiene lo stato di uno strumento
     * @param {string} toolName - Nome dello strumento
     * @returns {boolean} Stato dello strumento
     */
    getToolState(toolName) {
        return this.toolsState[toolName] || false;
    }

    /**
     * Ottiene lo strumento attualmente attivo
     * @returns {string|null} Nome dello strumento attivo o null
     */
    getActiveTool() {
        for (const [toolName, isActive] of Object.entries(this.toolsState)) {
            if (isActive) return toolName;
        }
        return null;
    }

    /**
     * Ottiene tutti gli stati strumenti
     * @returns {Object} Oggetto con stati di tutti gli strumenti
     */
    getToolsState() {
        return { ...this.toolsState };
    }

    /**
     * Mappa i nomi degli strumenti dal tutorial ai nomi interni
     * @param {string} tutorialToolName - Nome strumento da tutorial
     * @returns {string|null} Nome interno o null se non trovato
     */
    mapToolName(tutorialToolName) {
        // Usa ToolRegistry per mapping dinamico se disponibile
        if (window.ToolRegistry && typeof window.ToolRegistry.getToolByTutorialName === 'function') {
            const toolConfig = window.ToolRegistry.getToolByTutorialName(tutorialToolName);
            if (toolConfig) {
                return toolConfig.id;
            }
        }

        // Fallback a mapping hardcoded per compatibilità
        const mapping = {
            'ChiaveBrugola': 'brugola',
            'ChiaveInglese': 'chiave_inglese',
            'Mani': 'mano',
            'Aria': 'aria'
        };

        const mapped = mapping[tutorialToolName];
        if (mapped) {
            return mapped;
        }

        // Warning se tool non trovato
        this.safeLog(1, `[ToolsManager] ⚠️ Tool non trovato per nome tutorial: ${tutorialToolName}`);
        this.safeLog(1, `💡 Verifica che il tool sia definito in config.txt con TutorialNames=${tutorialToolName}`);

        return null;
    }

    /**
     * Evidenzia lo strumento richiesto senza attivarlo (per tutorial)
     * @param {string} toolName - Nome dello strumento
     */
    highlightRequiredTool(toolName) {
        if (!toolName) return;

        // Trova elemento DOM del tool
        const toolElement = document.querySelector(`[data-tool="${toolName}"]`);
        if (!toolElement) {
            this.safeLog(1, `[ToolsManager] Elemento tool non trovato: ${toolName}`);
            return;
        }

        // Rimuovi evidenziazione precedente da tutti i tool
        document.querySelectorAll('.tool-icon').forEach(icon => {
            icon.classList.remove('required', 'tool-highlight');
        });

        // Aggiungi evidenziazione al tool richiesto
        toolElement.classList.add('required', 'tool-highlight');
        this.safeLog(3, `[ToolsManager] Tool evidenziato come richiesto: ${toolName}`);

        // Rimuovi evidenziazione dopo un timeout se non viene cliccato
        setTimeout(() => {
            if (toolElement && !this.toolsState[toolName]) {
                toolElement.classList.remove('required', 'tool-highlight');
                this.safeLog(3, `[ToolsManager] Evidenziazione tool rimossa: ${toolName}`);
            }
        }, 10000); // 10 secondi
    }

    /**
     * Rimuove evidenziazione da tutti gli strumenti
     */
    clearToolHighlights() {
        document.querySelectorAll('.tool-icon').forEach(icon => {
            icon.classList.remove('required', 'tool-highlight');
        });
        this.safeLog(3, '[ToolsManager] Evidenziazioni strumenti rimosse');
    }

    /**
     * Callback chiamata quando cambia lo stato di uno strumento
     * @param {string} toolName - Nome dello strumento
     * @param {boolean} isActive - Stato attivo/inattivo
     */
    onToolStateChanged(toolName, isActive) {
        // Aggiorna cursore del canvas 3D
        this.updateCanvasCursor();

        // Evento personalizzabile per altri moduli
        const event = new CustomEvent('toolStateChanged', {
            detail: {
                toolName,
                isActive,
                allStates: this.toolsState,
                activeTool: this.getActiveTool()
            }
        });
        document.dispatchEvent(event);

        this.safeLog(3, `[ToolsManager] Evento toolStateChanged emesso per: ${toolName}`);
    }

    /**
     * Aggiorna il cursore del canvas 3D basato sullo strumento attivo
     * Supporta sia tool hardcoded che tool dinamici da ToolRegistry
     */
    updateCanvasCursor() {
        const canvas = document.querySelector('#canvas3d, canvas');
        if (!canvas) {
            this.safeLog(1, '[ToolsManager] Canvas 3D non trovato per aggiornamento cursore');
            return;
        }

        const activeTool = this.getActiveTool();

        // Rimuovi classi cursore canvas
        canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');

        // Rimuovi TUTTE le classi tool-*-active dal body (sia hardcoded che dinamiche)
        const bodyClasses = Array.from(document.body.classList);
        bodyClasses.forEach(cls => {
            if (cls.startsWith('tool-') && cls.endsWith('-active')) {
                document.body.classList.remove(cls);
            }
        });

        // Se nessun tool attivo, applica default
        if (!activeTool) {
            canvas.classList.add('cursor-default');
            this.safeLog(3, '[ToolsManager] Nessun tool attivo, cursore default');
            return;
        }

        // Sistema dinamico: usa ToolRegistry se disponibile
        if (window.ToolRegistry && typeof window.ToolRegistry.getTool === 'function') {
            const toolConfig = window.ToolRegistry.getTool(activeTool);
            if (toolConfig && toolConfig.cursor) {
                // Applica classe body dinamica per questo tool
                document.body.classList.add(`tool-${activeTool}-active`);
                this.safeLog(3, `[ToolsManager] Cursore dinamico applicato: tool-${activeTool}-active`);
                return;
            }
        }

        // Fallback hardcoded per scenari senza config.txt
        const hardcodedTools = ['aria', 'chiave_inglese', 'brugola', 'mano'];
        const normalizedTool = activeTool.toLowerCase();

        // Mappa nomi alternativi
        const toolMap = {
            'aria': 'aria',
            'chiaveinglese': 'chiave_inglese',
            'chiave_inglese': 'chiave_inglese',
            'brugola': 'brugola',
            'chiavebrugola': 'brugola',
            'mano': 'mano',
            'mani': 'mano'
        };

        const mappedTool = toolMap[normalizedTool] || normalizedTool;

        if (hardcodedTools.includes(mappedTool)) {
            document.body.classList.add(`tool-${mappedTool}-active`);
            this.safeLog(3, `[ToolsManager] Cursore hardcoded applicato: tool-${mappedTool}-active`);
            return;
        }

        // Tool non riconosciuto - usa default
        canvas.classList.add('cursor-default');
        this.safeLog(2, `[ToolsManager] Tool "${activeTool}" non riconosciuto, cursore default`);
    }

    /**
     * OPZIONALE: Inizializza cursore canvas animato per tool complessi
     * @param {string} toolName - Nome dello strumento
     */
    initAnimatedCursor(toolName) {
        // Solo per tool che beneficiano di animazioni avanzate
        const animatedTools = ['brugola', 'ChiaveBrugola', 'aria', 'Aria'];

        if (!animatedTools.includes(toolName)) {
            this.removeAnimatedCursor();
            return;
        }

        // Implementazione cursore canvas (da attivare se necessario)
        this.safeLog(3, `[ToolsManager] Cursore animato disponibile per: ${toolName}`);
    }

    /**
     * Rimuove cursore animato se presente
     */
    removeAnimatedCursor() {
        // Cleanup cursore canvas se presente
        const animatedCursor = document.getElementById('animatedCursor');
        if (animatedCursor) {
            animatedCursor.remove();
            this.safeLog(3, '[ToolsManager] Cursore animato rimosso');
        }
    }

    /**
     * Aggiorna messaggio di stato (delega al core UI)
     * @param {string} message - Messaggio da mostrare
     */
    updateStatus(message) {
        if (window.UI && window.UI.core && window.UI.core.updateStatus) {
            window.UI.core.updateStatus(message);
        } else {
            this.safeLog(3, `[ToolsManager] Status: ${message}`);
        }
    }

    /**
     * Ottiene stato corrente del sistema strumenti
     * @returns {Object} Stato completo sistema
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            activeTool: this.getActiveTool(),
            toolsState: this.getToolsState(),
            availableTools: this.availableTools.map(tool => tool.name)
        };
    }

    /**
     * Cleanup risorse
     */
    dispose() {
        // Disattiva tutti gli strumenti
        this.deactivateAllTools();

        // Rimuovi cursori animati
        this.removeAnimatedCursor();

        // Rimuovi evidenziazioni
        this.clearToolHighlights();

        // Reset stato
        this.toolsState = {};
        this.isInitialized = false;

        this.safeLog(2, '[ToolsManager] Cleanup completato');
    }
}

// Export per uso come modulo
window.ToolsManager = ToolsManager;