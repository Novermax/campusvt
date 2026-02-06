/**
 * TouchUIHandler - Gestione interazioni UI via touch
 *
 * Responsabilità:
 * - Tap su legenda strumenti → Selezione tool
 * - Tap su pulsanti navigazione → Avanzamento step
 * - Tap su elementi UI generici → Propagazione eventi nativi
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.TouchUIHandler = {

    // Stato
    initialized: false,

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    init: function() {
        this.initialized = true;
        console.log('[TouchUIHandler] Inizializzato');
    },

    // ═══════════════════════════════════════════════════════════
    // TAP SU ELEMENTI UI
    // ═══════════════════════════════════════════════════════════

    handleTap: function(event, element) {
        if (!element) return;

        console.log('[TouchUIHandler] TAP su elemento UI:', element.className || element.tagName);

        // 1. Elemento legenda strumenti
        if (this.isToolLegendItem(element)) {
            this.handleToolSelection(element);
            return;
        }

        // 2. Pulsante navigazione
        if (this.isNavigationButton(element)) {
            this.handleNavigationButton(element);
            return;
        }

        // 3. Modal OK button
        if (this.isModalButton(element)) {
            this.handleModalButton(element);
            return;
        }

        // 4. Altri elementi - simula click nativo
        this.simulateClick(element);
    },

    handleDoubleTap: function(event, element) {
        // Double tap su UI - solitamente non necessario
        // Propaga come click singolo
        this.simulateClick(element);
    },

    // ═══════════════════════════════════════════════════════════
    // GESTIONE LEGENDA STRUMENTI
    // ═══════════════════════════════════════════════════════════

    isToolLegendItem: function(element) {
        return element.classList.contains('strumento-item') ||
               element.closest('.strumento-item') !== null;
    },

    handleToolSelection: function(element) {
        // Trova l'elemento .strumento-item
        const toolItem = element.classList.contains('strumento-item') ?
            element : element.closest('.strumento-item');

        if (!toolItem) return;

        const toolId = toolItem.dataset.tool;
        console.log('[TouchUIHandler] Selezione tool:', toolId);

        // Rimuovi active da tutti
        const allItems = document.querySelectorAll('.strumento-item');
        allItems.forEach(item => item.classList.remove('active'));

        // Aggiungi active al selezionato
        toolItem.classList.add('active');

        // Notifica ToolsManager
        if (window.ToolsManager && window.ToolsManager.selectTool) {
            window.ToolsManager.selectTool(toolId);
        }

        // Aggiorna cursore (se su desktop)
        if (window.Scene3D && window.Scene3D.updateCursor) {
            window.Scene3D.updateCursor(toolId);
        }
    },

    // ═══════════════════════════════════════════════════════════
    // GESTIONE NAVIGAZIONE
    // ═══════════════════════════════════════════════════════════

    isNavigationButton: function(element) {
        return element.classList.contains('navigation-btn') ||
               element.classList.contains('nav-prev') ||
               element.classList.contains('nav-next') ||
               element.id === 'prevStepBtn' ||
               element.id === 'nextStepBtn' ||
               element.closest('.navigation-controls') !== null;
    },

    handleNavigationButton: function(element) {
        // Determina direzione
        const isPrev = element.classList.contains('nav-prev') ||
                      element.id === 'prevStepBtn' ||
                      element.querySelector('.fa-chevron-left') !== null;

        const isNext = element.classList.contains('nav-next') ||
                      element.id === 'nextStepBtn' ||
                      element.querySelector('.fa-chevron-right') !== null;

        console.log('[TouchUIHandler] Navigazione:', isPrev ? 'PREV' : isNext ? 'NEXT' : 'UNKNOWN');

        if (window.UI) {
            if (isPrev && window.UI.prevStep) {
                window.UI.prevStep();
            } else if (isNext && window.UI.nextStep) {
                window.UI.nextStep();
            }
        }
    },

    // ═══════════════════════════════════════════════════════════
    // GESTIONE MODAL
    // ═══════════════════════════════════════════════════════════

    isModalButton: function(element) {
        return element.classList.contains('info-ok-btn') ||
               element.id === 'infoModalOkBtn' ||
               element.closest('.info-modal') !== null && element.tagName === 'BUTTON';
    },

    handleModalButton: function(element) {
        console.log('[TouchUIHandler] Click modal button');

        // Simula click per attivare i listener esistenti
        this.simulateClick(element);
    },

    // ═══════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════

    /**
     * Simula un click nativo sull'elemento
     */
    simulateClick: function(element) {
        if (!element) return;

        // Crea e dispatch evento click
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });

        element.dispatchEvent(clickEvent);
    },

    // ═══════════════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════════════

    debugInfo: function() {
        console.log('═══════════════════════════════════════');
        console.log('🖥️ TouchUIHandler - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Initialized:', this.initialized);

        // Lista tool disponibili
        const toolItems = document.querySelectorAll('.strumento-item');
        console.log('Tool items trovati:', toolItems.length);
        toolItems.forEach(item => {
            console.log('  -', item.dataset.tool, item.classList.contains('active') ? '(active)' : '');
        });

        console.log('═══════════════════════════════════════');
    }
};
