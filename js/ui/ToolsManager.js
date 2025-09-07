/**
 * ToolsManager.js - Gestione strumenti e legenda
 * 
 * Responsabilità:
 * - Inizializzazione legenda strumenti
 * - Gestione stati strumenti (attivo/inattivo)
 * - Modalità esclusiva (solo uno strumento attivo)
 * - Eventi cambio stato per comunicazione inter-modulo
 * - Integrazione con tutorial steps
 */

window.ToolsManager = {
    
    // Stato strumenti
    toolsState: {},
    
    // Configurazione strumenti disponibili
    availableTools: [
        { name: 'brugola', icon: 'utilimages/brugola.png', displayName: 'Brugola' },
        { name: 'chiave_inglese', icon: 'utilimages/chiave_inglese.png', displayName: 'Chiave Inglese' },
        { name: 'mano', icon: 'utilimages/mano.png', displayName: 'Mano' },
        { name: 'martello', icon: 'utilimages/martello.png', displayName: 'Martello' }
    ],
    
    // Riferimenti ai moduli
    feedbackManager: null,
    
    // Cache elementi DOM
    elements: {},
    
    /**
     * Inizializzazione ToolsManager
     */
    init: function(feedbackManager) {
        this.feedbackManager = feedbackManager;
        
        // Cache elementi DOM
        this.cacheElements();
        
        // Inizializza la legenda degli strumenti
        this.initToolsLegend();
        
        console.log('[ToolsManager] Inizializzato');
    },
    
    /**
     * Cache elementi DOM
     */
    cacheElements: function() {
        this.elements.toolsContainer = document.getElementById('toolsContainer');
        
        console.log('[ToolsManager] Elementi DOM cachati');
    },
    
    /**
     * Inizializza la legenda strumenti
     */
    initToolsLegend: function() {
        if (!this.elements.toolsContainer) {
            console.warn('[ToolsManager] Container strumenti non trovato');
            return;
        }
        
        // Pulisce il container
        this.elements.toolsContainer.innerHTML = '';
        
        // Crea le icone degli strumenti
        this.availableTools.forEach(tool => {
            const toolElement = this.createToolElement(tool);
            this.elements.toolsContainer.appendChild(toolElement);
            
            // Inizializza lo stato dello strumento
            this.toolsState[tool.name] = false;
        });
        
        console.log('[ToolsManager] Legenda strumenti inizializzata');
    },
    
    /**
     * Crea elemento strumento
     */
    createToolElement: function(tool) {
        const toolElement = document.createElement('div');
        toolElement.className = 'tool-icon';
        toolElement.dataset.tool = tool.name;
        toolElement.title = tool.displayName;
        
        const img = document.createElement('img');
        img.src = tool.icon;
        img.alt = tool.displayName;
        img.onerror = function() {
            console.warn(`[ToolsManager] Icona non trovata: ${tool.icon}`);
            this.style.display = 'none';
        };
        
        toolElement.appendChild(img);
        toolElement.addEventListener('click', () => this.toggleTool(tool.name));
        
        return toolElement;
    },
    
    /**
     * Attiva/disattiva uno strumento
     */
    toggleTool: function(toolName) {
        // Se lo strumento è già attivo, non fare nulla (rimane attivo)
        if (this.toolsState[toolName]) {
            console.log(`[ToolsManager] Strumento già attivo: ${toolName}`);
            return;
        }
        
        // Disattiva tutti gli altri strumenti (modalità esclusiva)
        this.deactivateAllToolsExcept(toolName);
        
        // Attiva lo strumento corrente
        this.activateTool(toolName);
    },
    
    /**
     * Disattiva tutti gli strumenti eccetto quello specificato
     */
    deactivateAllToolsExcept: function(exceptToolName) {
        Object.keys(this.toolsState).forEach(tool => {
            if (tool !== exceptToolName && this.toolsState[tool]) {
                this.deactivateToolInternal(tool);
            }
        });
    },
    
    /**
     * Attiva uno strumento specifico
     */
    activateTool: function(toolName) {
        if (!this.availableTools.find(tool => tool.name === toolName)) {
            console.warn(`[ToolsManager] Strumento sconosciuto: ${toolName}`);
            return;
        }
        
        this.toolsState[toolName] = true;
        
        const element = this.getToolElement(toolName);
        if (element) {
            element.classList.add('active');
        }
        
        const displayName = this.getToolDisplayName(toolName);
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus(`Strumento attivo: ${displayName}`);
        }
        
        console.log(`[ToolsManager] Strumento attivato: ${toolName}`);
        
        // Notifica il cambio di stato
        this.notifyToolStateChanged(toolName, true);
    },
    
    /**
     * Disattiva manualmente uno strumento specifico
     */
    deactivateTool: function(toolName) {
        if (!this.toolsState[toolName]) {
            return; // Già disattivato
        }
        
        this.deactivateToolInternal(toolName);
        
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus('Nessuno strumento attivo');
        }
        
        console.log(`[ToolsManager] Strumento disattivato: ${toolName}`);
    },
    
    /**
     * Disattivazione interna di uno strumento
     */
    deactivateToolInternal: function(toolName) {
        this.toolsState[toolName] = false;
        
        const element = this.getToolElement(toolName);
        if (element) {
            element.classList.remove('active');
        }
        
        // Notifica il cambio di stato
        this.notifyToolStateChanged(toolName, false);
    },
    
    /**
     * Disattiva tutti gli strumenti
     */
    deactivateAllTools: function() {
        let wasAnyActive = false;
        
        Object.keys(this.toolsState).forEach(toolName => {
            if (this.toolsState[toolName]) {
                this.deactivateToolInternal(toolName);
                wasAnyActive = true;
            }
        });
        
        if (wasAnyActive && this.feedbackManager) {
            this.feedbackManager.updateStatus('Tutti gli strumenti disattivati');
        }
        
        console.log('[ToolsManager] Tutti gli strumenti disattivati');
    },
    
    /**
     * Ottiene lo stato di uno strumento
     */
    getToolState: function(toolName) {
        return this.toolsState[toolName] || false;
    },
    
    /**
     * Ottiene lo strumento attualmente attivo
     */
    getActiveTool: function() {
        for (const [toolName, isActive] of Object.entries(this.toolsState)) {
            if (isActive) return toolName;
        }
        return null;
    },
    
    /**
     * Verifica se almeno uno strumento è attivo
     */
    hasActiveTool: function() {
        return Object.values(this.toolsState).some(isActive => isActive);
    },
    
    /**
     * Ottiene tutti gli stati degli strumenti
     */
    getAllToolsState: function() {
        return { ...this.toolsState };
    },
    
    /**
     * Ottiene elemento DOM di uno strumento
     */
    getToolElement: function(toolName) {
        return document.querySelector(`[data-tool="${toolName}"]`);
    },
    
    /**
     * Ottiene nome display di uno strumento
     */
    getToolDisplayName: function(toolName) {
        const tool = this.availableTools.find(t => t.name === toolName);
        return tool ? tool.displayName : toolName;
    },
    
    /**
     * Notifica cambio stato strumento
     */
    notifyToolStateChanged: function(toolName, isActive) {
        // Dispatch evento personalizzato per altri moduli
        const event = new CustomEvent('toolStateChanged', {
            detail: {
                toolName: toolName,
                isActive: isActive,
                allStates: this.getAllToolsState(),
                activeTool: this.getActiveTool()
            }
        });
        document.dispatchEvent(event);
    },
    
    /**
     * Attiva strumento da nome tutorial
     */
    activateToolFromTutorial: function(tutorialToolName) {
        const mapping = {
            'ChiaveBrugola': 'brugola',
            'ChiaveInglese': 'chiave_inglese',
            'Mani': 'mano',
            'Martello': 'martello'
        };
        
        const toolName = mapping[tutorialToolName];
        if (toolName) {
            console.log(`[ToolsManager] Attivazione strumento da tutorial: ${tutorialToolName} -> ${toolName}`);
            this.toggleTool(toolName);
            return true;
        }
        
        console.warn(`[ToolsManager] Strumento tutorial non riconosciuto: ${tutorialToolName}`);
        return false;
    },
    
    /**
     * Reset tutti gli strumenti allo stato iniziale
     */
    resetAllTools: function() {
        console.log('[ToolsManager] Reset di tutti gli strumenti');
        
        Object.keys(this.toolsState).forEach(toolName => {
            this.toolsState[toolName] = false;
            const element = this.getToolElement(toolName);
            if (element) {
                element.classList.remove('active');
            }
        });
        
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus('Strumenti resettati');
        }
    },
    
    /**
     * Aggiorna visibilità pannello strumenti
     */
    setToolsVisibility: function(visible) {
        if (this.elements.toolsContainer) {
            if (visible) {
                this.elements.toolsContainer.classList.remove('hidden');
            } else {
                this.elements.toolsContainer.classList.add('hidden');
            }
        }
    },
    
    /**
     * Ottiene statistiche utilizzo strumenti
     */
    getToolsStats: function() {
        const stats = {
            totalTools: this.availableTools.length,
            activeTools: Object.values(this.toolsState).filter(Boolean).length,
            inactiveTools: Object.values(this.toolsState).filter(state => !state).length,
            activeTool: this.getActiveTool(),
            allStates: this.getAllToolsState()
        };
        
        return stats;
    },
    
    /**
     * Verifica integrità stato strumenti
     */
    validateToolsState: function() {
        const issues = [];
        
        // Verifica che non ci siano più strumenti attivi contemporaneamente (modalità esclusiva)
        const activeCount = Object.values(this.toolsState).filter(Boolean).length;
        if (activeCount > 1) {
            issues.push(`Modalità esclusiva violata: ${activeCount} strumenti attivi`);
        }
        
        // Verifica che tutti gli strumenti configurati abbiano uno stato
        this.availableTools.forEach(tool => {
            if (!(tool.name in this.toolsState)) {
                issues.push(`Strumento ${tool.name} non ha stato inizializzato`);
            }
        });
        
        // Verifica che gli elementi DOM esistano
        Object.keys(this.toolsState).forEach(toolName => {
            if (!this.getToolElement(toolName)) {
                issues.push(`Elemento DOM mancante per strumento ${toolName}`);
            }
        });
        
        if (issues.length > 0) {
            console.warn('[ToolsManager] Problemi rilevati:', issues);
        } else {
            console.log('[ToolsManager] Stato strumenti valido');
        }
        
        return issues;
    },
    
    /**
     * Cleanup del modulo
     */
    cleanup: function() {
        console.log('[ToolsManager] Cleanup...');
        
        // Disattiva tutti gli strumenti
        this.deactivateAllTools();
        
        // Reset stato
        this.toolsState = {};
        this.elements = {};
        this.feedbackManager = null;
        
        // Pulisci container se presente
        const toolsContainer = document.getElementById('toolsContainer');
        if (toolsContainer) {
            toolsContainer.innerHTML = '';
        }
        
        console.log('[ToolsManager] Cleanup completato');
    }
};