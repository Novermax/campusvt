/**
 * DynamicToolStyles - Sistema di generazione CSS dinamico per tool custom
 *
 * Genera regole CSS runtime per supportare:
 * - Cursori personalizzati per tool custom
 * - Animazione frame1/frame2 durante click mouse
 * - Hotspot cursori configurabili
 *
 * Version: 1.0.0
 * Date: Gennaio 2026
 */

window.DynamicToolStyles = {
    /**
     * Elemento <style> che contiene il CSS generato dinamicamente
     * @type {HTMLStyleElement|null}
     */
    styleElement: null,

    /**
     * Flag di inizializzazione
     * @type {boolean}
     */
    isInitialized: false,

    /**
     * Inizializza il sistema di stili dinamici
     */
    init: function() {
        if (this.isInitialized) {
            console.log('[DynamicToolStyles] Sistema già inizializzato');
            return;
        }

        console.log('[DynamicToolStyles] Inizializzazione sistema CSS dinamico...');

        // Crea elemento <style> nel DOM
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'dynamic-tool-styles';
        this.styleElement.setAttribute('data-generated-by', 'DynamicToolStyles');
        document.head.appendChild(this.styleElement);

        this.isInitialized = true;
        console.log('[DynamicToolStyles] ✅ Sistema inizializzato');
    },

    /**
     * Genera CSS per tutti i tool registrati in ToolRegistry
     * @returns {boolean} True se generazione riuscita
     */
    generateToolStyles: function() {
        if (!window.ToolRegistry) {
            console.warn('[DynamicToolStyles] ⚠️ ToolRegistry non disponibile');
            return false;
        }

        // Inizializza se necessario
        if (!this.isInitialized) {
            this.init();
        }

        // Ottieni tutti i tool registrati
        const tools = window.ToolRegistry.getAllTools();

        if (!tools || tools.length === 0) {
            console.warn('[DynamicToolStyles] ⚠️ Nessun tool trovato in ToolRegistry');
            return false;
        }

        let cssRules = '';

        // Genera CSS per ogni tool
        tools.forEach(tool => {
            const toolCSS = this.generateToolCSS(tool);
            if (toolCSS) {
                cssRules += toolCSS + '\n\n';
            }
        });

        // Applica CSS all'elemento style
        if (this.styleElement) {
            this.styleElement.textContent = cssRules;
            console.log(`[DynamicToolStyles] ✅ CSS dinamico generato per ${tools.length} tool`);
            return true;
        }

        console.error('[DynamicToolStyles] ❌ Elemento style non disponibile');
        return false;
    },

    /**
     * Genera regole CSS per un singolo tool
     * @param {Object} toolConfig - Configurazione tool da ToolRegistry
     * @returns {string} CSS generato per il tool
     */
    generateToolCSS: function(toolConfig) {
        if (!toolConfig || !toolConfig.id) {
            console.warn('[DynamicToolStyles] ⚠️ Tool config invalido:', toolConfig);
            return '';
        }

        const {
            id,
            cursor,
            cursorPressed,
            cursorPressedFrame2,
            cursorHotspotX,
            cursorHotspotY
        } = toolConfig;

        // Hotspot con fallback a 0,0
        const hotspotX = cursorHotspotX !== undefined ? cursorHotspotX : 0;
        const hotspotY = cursorHotspotY !== undefined ? cursorHotspotY : 0;

        let css = '';

        // ═══════════════════════════════════════════════════════════
        // 1. Cursore normale (stato default quando tool attivo)
        // ═══════════════════════════════════════════════════════════
        if (cursor) {
            css += this._generateCursorRule(
                id,
                cursor,
                hotspotX,
                hotspotY,
                'normale',
                '' // Nessun suffisso per stato normale
            );
        }

        // ═══════════════════════════════════════════════════════════
        // 2. Cursore pressed frame1 (durante click)
        // ═══════════════════════════════════════════════════════════
        if (cursorPressed) {
            css += this._generateCursorRule(
                id,
                cursorPressed,
                hotspotX,
                hotspotY,
                'pressed frame 1',
                '.cursor-frame-1'
            );
        }

        // ═══════════════════════════════════════════════════════════
        // 3. Cursore pressed frame2 (alternanza durante click)
        // ═══════════════════════════════════════════════════════════
        if (cursorPressedFrame2) {
            // Frame 2 esplicito
            css += this._generateCursorRule(
                id,
                cursorPressedFrame2,
                hotspotX,
                hotspotY,
                'pressed frame 2',
                '.cursor-frame-2'
            );
        } else if (cursorPressed) {
            // Fallback: se non c'è frame2, usa frame1 anche per frame2
            css += this._generateCursorRule(
                id,
                cursorPressed,
                hotspotX,
                hotspotY,
                'pressed frame 2 (fallback a frame1)',
                '.cursor-frame-2'
            );
        }

        return css;
    },

    /**
     * Genera una singola regola CSS per cursore
     * @private
     * @param {string} toolId - ID del tool
     * @param {string} cursorPath - Path del cursore SVG
     * @param {number} hotspotX - Coordinata X hotspot
     * @param {number} hotspotY - Coordinata Y hotspot
     * @param {string} description - Descrizione per commento CSS
     * @param {string} stateSuffix - Suffisso body class (es. '.cursor-frame-1')
     * @returns {string} Regola CSS completa
     */
    _generateCursorRule: function(toolId, cursorPath, hotspotX, hotspotY, description, stateSuffix) {
        // Sanitizza il path del cursore (rimuovi spazi)
        const sanitizedPath = cursorPath.trim();

        // Costruisci selector body
        const bodyClass = `body.tool-${toolId}-active${stateSuffix}`;

        return `
/* Tool: ${toolId} - Cursore ${description} */
${bodyClass},
${bodyClass} * {
    cursor: url("${sanitizedPath}") ${hotspotX} ${hotspotY}, auto !important;
}

/* Eccezioni - pulsanti e tool icons mantengono pointer */
${bodyClass} button,
${bodyClass} .tool-icon,
${bodyClass} input[type="button"],
${bodyClass} input[type="submit"] {
    cursor: pointer !important;
}
`;
    },

    /**
     * Rimuove tutto il CSS dinamico generato
     */
    clear: function() {
        if (this.styleElement) {
            this.styleElement.textContent = '';
            console.log('[DynamicToolStyles] 🗑️ CSS dinamico pulito');
        }
    },

    /**
     * Rigenera CSS dopo modifiche al ToolRegistry
     */
    refresh: function() {
        console.log('[DynamicToolStyles] 🔄 Refresh CSS dinamico...');
        this.clear();
        return this.generateToolStyles();
    },

    /**
     * Rimuove completamente il sistema (cleanup completo)
     */
    dispose: function() {
        if (this.styleElement && this.styleElement.parentNode) {
            this.styleElement.parentNode.removeChild(this.styleElement);
        }

        this.styleElement = null;
        this.isInitialized = false;

        console.log('[DynamicToolStyles] ♻️ Sistema disposed');
    },

    /**
     * Ottiene informazioni di debug sul sistema
     * @returns {Object} Informazioni debug
     */
    debugInfo: function() {
        const info = {
            isInitialized: this.isInitialized,
            hasStyleElement: !!this.styleElement,
            cssRulesCount: this.styleElement ? this.styleElement.textContent.split('\n').length : 0,
            toolRegistryAvailable: !!window.ToolRegistry,
            registeredToolsCount: window.ToolRegistry ? window.ToolRegistry.getToolCount() : 0
        };

        console.log('═══════════════════════════════════════════════════');
        console.log('📊 [DynamicToolStyles] Debug Info');
        console.log('═══════════════════════════════════════════════════');
        console.log('Inizializzato:', info.isInitialized);
        console.log('Style Element:', info.hasStyleElement ? '✅ Presente' : '❌ Mancante');
        console.log('Righe CSS:', info.cssRulesCount);
        console.log('ToolRegistry:', info.toolRegistryAvailable ? '✅ Disponibile' : '❌ Non disponibile');
        console.log('Tool Registrati:', info.registeredToolsCount);
        console.log('═══════════════════════════════════════════════════');

        if (this.styleElement && this.styleElement.textContent) {
            console.log('\n📝 CSS Generato (preview primi 500 caratteri):');
            console.log(this.styleElement.textContent.substring(0, 500) + '...');
        }

        return info;
    }
};

// Log caricamento modulo
console.log('[DynamicToolStyles] 📦 Modulo caricato');
