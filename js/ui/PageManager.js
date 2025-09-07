/**
 * PageManager.js - Gestione navigazione tra pagine
 * 
 * Responsabilità:
 * - Navigazione tra home e scenario
 * - Cache elementi DOM
 * - Gestione stati pagina
 * - Cleanup transizioni
 */

window.PageManager = {
    
    // Stato corrente
    currentPage: 'home',
    
    // Cache elementi DOM
    elements: {},
    
    // Riferimento al FeedbackManager
    feedbackManager: null,
    
    /**
     * Inizializzazione PageManager
     */
    init: function(feedbackManager) {
        this.feedbackManager = feedbackManager;
        
        // Cache elementi DOM
        this.cacheElements();
        
        // Setup event listeners specifici della navigazione
        this.setupNavigationListeners();
        
        console.log('[PageManager] Inizializzato');
    },
    
    /**
     * Cachea i riferimenti agli elementi DOM per performance migliori
     */
    cacheElements: function() {
        // Pagine principali
        this.elements.homePage = document.getElementById('homePage');
        this.elements.scenarioPage = document.getElementById('scenarioPage');
        
        // Elementi scenario
        this.elements.scenariosList = document.getElementById('scenariosList');
        this.elements.scenarioTitle = document.getElementById('scenarioTitle');
        
        // Controlli navigazione
        this.elements.homeButton = document.querySelector('[onclick="goHome()"]');
        
        console.log('[PageManager] Elementi DOM cachati');
    },
    
    /**
     * Setup event listeners per la navigazione
     */
    setupNavigationListeners: function() {
        // Click sulle card scenario
        if (this.elements.scenariosList) {
            this.elements.scenariosList.addEventListener('click', 
                this.onScenarioCardClick.bind(this));
            
            // Gestione navigazione da tastiera
            this.elements.scenariosList.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.onScenarioCardClick(event);
                }
            });
        }
        
        console.log('[PageManager] Event listeners configurati');
    },
    
    /**
     * Mostra una specifica pagina
     * @param {string} page - Nome della pagina ('home' o 'scenario')
     */
    showPage: function(page) {
        console.log(`[PageManager] Navigazione verso pagina: ${page}`);
        
        // Nascondi tutte le pagine
        this.hideAllPages();
        
        // Mostra la pagina richiesta
        if (page === 'home' && this.elements.homePage) {
            this.elements.homePage.classList.remove('hidden');
            this.currentPage = 'home';
            this.onHomePageShown();
            
        } else if (page === 'scenario' && this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.remove('hidden');
            this.currentPage = 'scenario';
            this.onScenarioPageShown();
        }
        
        // Notifica cambio pagina
        this.dispatchPageChangeEvent(page);
    },
    
    /**
     * Nascondi tutte le pagine
     */
    hideAllPages: function() {
        if (this.elements.homePage) {
            this.elements.homePage.classList.add('hidden');
        }
        if (this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.add('hidden');
        }
    },
    
    /**
     * Callback quando viene mostrata la home page
     */
    onHomePageShown: function() {
        console.log('[PageManager] Home page mostrata');
        
        // Cleanup scena 3D
        if (window.Scene3D && window.Scene3D.clearAllModels) {
            window.Scene3D.clearAllModels();
        }
        
        // Update status
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus('Home');
        }
    },
    
    /**
     * Callback quando viene mostrata la pagina scenario
     */
    onScenarioPageShown: function() {
        console.log('[PageManager] Scenario page mostrata');
        
        // Inizializza la scena 3D se non già fatto
        if (window.Scene3D && !window.Scene3D.scene) {
            try {
                window.Scene3D.init();
            } catch (error) {
                if (this.feedbackManager) {
                    this.feedbackManager.showError('Errore inizializzazione scena 3D: ' + error.message);
                }
            }
        }
    },
    
    /**
     * Gestisce il click su una card scenario
     */
    onScenarioCardClick: function(event) {
        const card = event.target.closest('.scenario-card');
        if (!card) return;
        
        // Se è la card placeholder, non fare nulla
        if (card.classList.contains('placeholder')) {
            return;
        }
        
        // Controlla se è la card "Modalità Manuale"
        if (card.dataset.manual === 'true') {
            console.log('[PageManager] Modalità manuale selezionata');
            this.showPage('scenario');
            return;
        }
        
        // Gestisce scenario specifico
        const scenarioIndexStr = card.dataset.scenarioIndex;
        if (!scenarioIndexStr) {
            console.warn('[PageManager] Card scenario senza indice trovata');
            return;
        }
        
        const scenarioIndex = parseInt(scenarioIndexStr);
        if (isNaN(scenarioIndex)) {
            if (this.feedbackManager) {
                this.feedbackManager.showError('Dati scenario non validi');
            }
            return;
        }
        
        // Dispatch evento per notificare altri moduli
        this.dispatchScenarioSelectedEvent(scenarioIndex);
        
        // Mostra pagina scenario
        this.showPage('scenario');
    },
    
    /**
     * Torna alla home page
     */
    goHome: function() {
        console.log('[PageManager] Ritorno alla home');
        
        // Dispatch evento per cleanup altri moduli
        this.dispatchPageChangeEvent('home', { fromPage: this.currentPage });
        
        // Mostra home
        this.showPage('home');
    },
    
    /**
     * Ottiene la pagina corrente
     */
    getCurrentPage: function() {
        return this.currentPage;
    },
    
    /**
     * Verifica se siamo in una specifica pagina
     */
    isCurrentPage: function(page) {
        return this.currentPage === page;
    },
    
    /**
     * Aggiorna il titolo dello scenario
     */
    updateScenarioTitle: function(title) {
        if (this.elements.scenarioTitle) {
            this.elements.scenarioTitle.textContent = title;
        }
    },
    
    /**
     * Dispatch evento cambio pagina
     */
    dispatchPageChangeEvent: function(newPage, details = {}) {
        const event = new CustomEvent('pageChanged', {
            detail: {
                newPage: newPage,
                oldPage: this.currentPage,
                ...details
            }
        });
        document.dispatchEvent(event);
    },
    
    /**
     * Dispatch evento selezione scenario
     */
    dispatchScenarioSelectedEvent: function(scenarioIndex) {
        const event = new CustomEvent('scenarioSelected', {
            detail: { scenarioIndex: scenarioIndex }
        });
        document.dispatchEvent(event);
    },
    
    /**
     * Cleanup del modulo
     */
    cleanup: function() {
        console.log('[PageManager] Cleanup...');
        
        // Rimuovi event listeners se necessario
        // (gli addEventListener con bind mantengono il riferimento)
        
        // Reset stato
        this.currentPage = 'home';
        this.elements = {};
        this.feedbackManager = null;
        
        console.log('[PageManager] Cleanup completato');
    }
};