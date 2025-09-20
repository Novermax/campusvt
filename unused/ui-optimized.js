window.UI = {
    
    version: '2.0',
    buildType: 'Modular Architecture',
    buildDate: 'Settembre 2025',
    
    initialized: false,
    core: null,
    
    init: function() {
        console.log(`[UI] Inizializzazione UI v${this.version} (${this.buildType})`);
        
        try {
            this.checkModulesAvailability();
            
            if (window.UICore) {
                this.core = window.UICore;
                this.core.init();
                
                this.initialized = true;
                console.log('[UI] ✅ Inizializzazione UI completata con successo');
                
                this.updateStatus('Sistema UI caricato');
                
            } else {
                throw new Error('UICore non disponibile - impossibile inizializzare UI');
            }
            
        } catch (error) {
            console.error('[UI] ❌ Errore inizializzazione UI:', error);
            this.showError('Errore inizializzazione interfaccia: ' + error.message);
        }
    },
    
    checkModulesAvailability: function() {
        const requiredModules = {
            'UICore': window.UICore,
            'FeedbackManager': window.FeedbackManager,
            'PageManager': window.PageManager
        };
        
        const optionalModules = {
            'ScenarioManager': window.ScenarioManager,
            'ModelManager': window.ModelManager,
            'TutorialManager': window.TutorialManager,
            'ToolsManager': window.ToolsManager,
            'MobileControlsManager': window.MobileControlsManager
        };
        
        const missingRequired = [];
        for (const [name, module] of Object.entries(requiredModules)) {
            if (!module) {
                missingRequired.push(name);
            }
        }
        
        if (missingRequired.length > 0) {
            throw new Error(`Moduli richiesti mancanti: ${missingRequired.join(', ')}`);
        }
        
        const availableOptional = Object.values(optionalModules).filter(Boolean).length;
        const totalOptional = Object.keys(optionalModules).length;
        
        console.log(`[UI] Moduli disponibili: Richiesti ✅, Opzionali ${availableOptional}/${totalOptional}`);
        
        return {
            requiredAvailable: true,
            optionalCount: availableOptional,
            totalOptional: totalOptional
        };
    },
    
    updateStatus: function(message) {
        const feedbackManager = this.getModule('feedbackManager');
        if (feedbackManager) {
            feedbackManager.updateStatus(message);
        } else {
            console.log(`[UI] Status: ${message}`);
        }
    },
    
    showError: function(message) {
        const feedbackManager = this.getModule('feedbackManager');
        if (feedbackManager) {
            feedbackManager.showError(message);
        } else {
            console.error(`[UI] Errore: ${message}`);
        }
    },
    
    showLoader: function(message) {
        const feedbackManager = this.getModule('feedbackManager');
        if (feedbackManager) {
            feedbackManager.showLoader(message);
        }
    },
    
    hideLoader: function() {
        const feedbackManager = this.getModule('feedbackManager');
        if (feedbackManager) {
            feedbackManager.hideLoader();
        }
    },
    
    goHome: function() {
        const pageManager = this.getModule('pageManager');
        if (pageManager) {
            pageManager.goHome();
        } else {
            console.warn('[UI] PageManager non disponibile per goHome');
        }
    },
    
    showPage: function(page) {
        const pageManager = this.getModule('pageManager');
        if (pageManager) {
            pageManager.showPage(page);
        } else {
            console.warn(`[UI] PageManager non disponibile per showPage(${page})`);
        }
    },
    
    clearAll: function() {
        const modelManager = this.getModule('modelManager');
        if (modelManager) {
            modelManager.clearAll();
        } else {
            console.warn('[UI] ModelManager non disponibile per clearAll');
        }
    },
    
    resetView: function() {
        if (window.Scene3D && window.Scene3D.resetView) {
            window.Scene3D.resetView();
            this.updateStatus('Vista reimpostata');
        } else {
            console.warn('[UI] Scene3D.resetView non disponibile');
        }
    },
    
    startAnimation: function() {
        console.log('[UI] Avvio animazione richiesto');
        this.updateStatus('Animazione avviata');
    },
    
    executeScenario: function() {
        const scenarioManager = this.getModule('scenarioManager');
        if (scenarioManager && scenarioManager.currentScenario) {
            console.log(`[UI] Esecuzione scenario: ${scenarioManager.currentScenario.name}`);
            this.updateStatus('Scenario in esecuzione...');
        } else {
            this.showError('Nessuno scenario selezionato');
        }
    },
    
    hideError: function() {
        const feedbackManager = this.getModule('feedbackManager');
        if (feedbackManager) {
            feedbackManager.hideError();
        }
    },
    
    getModule: function(moduleName) {
        if (this.core) {
            return this.core.getModule(moduleName);
        }
        return null;
    },
    
    isInitialized: function() {
        return this.initialized;
    },
    
    getModulesInfo: function() {
        if (this.core) {
            return this.core.checkModules();
        }
        return { allRequiredAvailable: false, availableOptionalCount: 0, totalOptionalCount: 0 };
    },
    
    getUIState: function() {
        const feedbackManager = this.getModule('feedbackManager');
        const pageManager = this.getModule('pageManager');
        const modelManager = this.getModule('modelManager');
        const mobileControlsManager = this.getModule('mobileControlsManager');
        
        return {
            version: this.version,
            buildType: this.buildType,
            initialized: this.initialized,
            modulesInfo: this.getModulesInfo(),
            currentPage: pageManager ? pageManager.getCurrentPage() : 'unknown',
            feedbackState: feedbackManager ? feedbackManager.getFeedbackState() : null,
            isLoadingModels: modelManager ? modelManager.isCurrentlyLoading() : false,
            isMobile: mobileControlsManager ? mobileControlsManager.isMobile : false
        };
    },
    
    debugUIState: function() {
        const state = this.getUIState();
        console.log('[UI] 🔍 STATO UI COMPLETO:', state);
        return state;
    },
    
    validateUIIntegrity: function() {
        const issues = [];
        
        if (!this.initialized) {
            issues.push('UI non inizializzata');
        }
        
        if (!this.core) {
            issues.push('UICore non disponibile');
        }
        
        const essentialModules = ['feedbackManager', 'pageManager'];
        essentialModules.forEach(moduleName => {
            if (!this.getModule(moduleName)) {
                issues.push(`Modulo essenziale mancante: ${moduleName}`);
            }
        });
        
        if (this.core) {
            const moduleStatus = this.core.checkModules();
            if (!moduleStatus.allRequiredAvailable) {
                issues.push('Alcuni moduli richiesti non sono disponibili');
            }
        }
        
        if (issues.length > 0) {
            console.warn('[UI] ⚠️ Problemi integrità rilevati:', issues);
        } else {
            console.log('[UI] ✅ Integrità sistema UI verificata');
        }
        
        return issues;
    },
    
    cleanup: function() {
        console.log('[UI] 🧹 Avvio cleanup sistema UI...');
        
        try {
            if (this.core) {
                this.core.cleanup();
            }
            
            this.initialized = false;
            this.core = null;
            
            console.log('[UI] ✅ Cleanup sistema UI completato');
            
        } catch (error) {
            console.error('[UI] ❌ Errore durante cleanup:', error);
        }
    },
    
    reinitialize: function() {
        console.log('[UI] 🔄 Reinizializzazione sistema UI...');
        
        this.cleanup();
        
        setTimeout(() => {
            this.init();
        }, 100);
    },
    
    getBuildInfo: function() {
        return {
            version: this.version,
            buildType: this.buildType,
            buildDate: this.buildDate,
            architecture: 'Modular',
            modules: Object.keys({
                UICore: window.UICore,
                FeedbackManager: window.FeedbackManager,
                PageManager: window.PageManager,
                ScenarioManager: window.ScenarioManager,
                ModelManager: window.ModelManager,
                TutorialManager: window.TutorialManager,
                ToolsManager: window.ToolsManager,
                MobileControlsManager: window.MobileControlsManager
            }).filter(name => window[name])
        };
    }
};

window.goHome = function() {
    if (window.UI && window.UI.isInitialized()) {
        window.UI.goHome();
    } else {
        console.warn('UI non inizializzata per goHome');
    }
};

window.executeScenario = function() {
    if (window.UI && window.UI.isInitialized()) {
        window.UI.executeScenario();
    } else {
        console.warn('UI non inizializzata per executeScenario');
    }
};

window.clearAll = function() {
    if (window.UI && window.UI.isInitialized()) {
        window.UI.clearAll();
    } else {
        console.warn('UI non inizializzata per clearAll');
    }
};

window.resetView = function() {
    if (window.UI && window.UI.isInitialized()) {
        window.UI.resetView();
    } else {
        console.warn('UI non inizializzata per resetView');
    }
};

window.startAnimation = function() {
    if (window.UI && window.UI.isInitialized()) {
        window.UI.startAnimation();
    } else {
        console.warn('UI non inizializzata per startAnimation');
    }
};

window.hideError = function() {
    if (window.UI && window.UI.isInitialized()) {
        window.UI.hideError();
    } else {
        console.warn('UI non inizializzata per hideError');
    }
};

console.log('✅ UI Sistema Modulare v2.0 caricato - Pronto per inizializzazione');