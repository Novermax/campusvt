/**
 * ============================================================================
 * MOBILE BROWSER UI MANAGER - Sistema Auto-Nascondimento Barra Navigazione
 * ============================================================================
 *
 * Gestisce automaticamente la barra di navigazione del browser mobile per
 * massimizzare lo spazio disponibile per i controlli del tutorial.
 *
 * Funzionalità:
 * - Auto-scroll per nascondere address bar
 * - Fullscreen API quando disponibile
 * - Gestione orientamento dispositivo
 * - Fix altezza viewport per mobile (100vh issue)
 *
 * Versione: 1.0.0
 * Data: Febbraio 2026
 * ============================================================================
 */

(function() {
    'use strict';

    window.MobileBrowserUI = {
        initialized: false,
        isFullscreen: false,
        isMobile: false,

        config: {
            autoHideDelay: 300,        // Delay prima di nascondere barra (ms)
            scrollAmount: 100,         // Pixel da scrollare per nascondere (aumentato)
            fullscreenEnabled: true,   // Abilita fullscreen API
            retryAttempts: 3,          // Tentativi nascondimento barra
            retryDelay: 500            // Delay tra tentativi (ms)
        },

        /**
         * Inizializza il sistema di gestione UI mobile
         */
        init: function() {
            if (this.initialized) {
                console.warn('[MobileBrowserUI] Sistema già inizializzato');
                return;
            }

            // Rileva se è dispositivo mobile
            this.isMobile = this.detectMobile();

            if (!this.isMobile) {
                console.log('[MobileBrowserUI] Desktop rilevato - sistema inattivo');
                return;
            }

            console.log('[MobileBrowserUI] Inizializzazione su dispositivo mobile...');

            // Setup
            this.setupViewportHeight();
            this.setupOrientationChange();
            this.setupFullscreenAPI();
            this.setupFullscreenModal();

            // Mostra modal fullscreen dopo breve delay (se non già rifiutato)
            setTimeout(() => {
                this.showFullscreenModalIfNeeded();
            }, 1000);

            this.initialized = true;
            console.log('✅ [MobileBrowserUI] Sistema attivo');
        },

        /**
         * Rileva se è un dispositivo mobile
         */
        detectMobile: function() {
            // Usa la funzione globale se disponibile
            if (window.isMobileDevice && typeof window.isMobileDevice === 'function') {
                return window.isMobileDevice();
            }

            // Fallback: controllo user agent
            const ua = navigator.userAgent.toLowerCase();
            const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'windows phone'];
            return mobileKeywords.some(keyword => ua.includes(keyword));
        },

        /**
         * Nasconde la barra degli indirizzi con scroll trick
         */
        hideAddressBar: function() {
            let attempts = 0;
            const maxAttempts = this.config.retryAttempts;
            let scrollHelper = null;

            const tryHide = () => {
                attempts++;

                // Crea elemento scrollabile temporaneo se non esiste
                if (!scrollHelper) {
                    // Salva overflow originale del body
                    const originalOverflow = document.body.style.overflow;

                    // Rimuovi temporaneamente overflow: hidden
                    document.body.style.overflow = 'auto';

                    scrollHelper = document.createElement('div');
                    scrollHelper.id = 'mobile-scroll-helper';
                    scrollHelper.style.cssText = `
                        position: relative;
                        width: 1px;
                        height: 200vh;
                        pointer-events: none;
                        visibility: hidden;
                        z-index: -9999;
                    `;
                    document.body.appendChild(scrollHelper);
                    console.log('📱 [MobileBrowserUI] Elemento scrollabile temporaneo creato (200vh)');

                    // Salva overflow originale per ripristinarlo dopo
                    scrollHelper.dataset.originalOverflow = originalOverflow || 'hidden';
                }

                // Scrolla di 100px per nascondere la barra
                window.scrollTo(0, this.config.scrollAmount);

                console.log(`📱 [MobileBrowserUI] Tentativo ${attempts}/${maxAttempts} nascondimento barra (scroll ${this.config.scrollAmount}px)`);

                // Retry se necessario
                if (attempts < maxAttempts) {
                    setTimeout(tryHide, this.config.retryDelay);
                } else {
                    console.log('✅ [MobileBrowserUI] Barra navigazione nascosta');

                    // Rimuovi elemento helper e ripristina overflow dopo 2 secondi
                    setTimeout(() => {
                        if (scrollHelper && scrollHelper.parentNode) {
                            // Ripristina overflow originale del body
                            const originalOverflow = scrollHelper.dataset.originalOverflow || 'hidden';
                            document.body.style.overflow = originalOverflow;

                            scrollHelper.parentNode.removeChild(scrollHelper);
                            console.log('📱 [MobileBrowserUI] Elemento scrollabile rimosso + overflow ripristinato');
                        }
                    }, 2000);
                }
            };

            // Avvia dopo un breve delay
            setTimeout(tryHide, this.config.autoHideDelay);
        },

        /**
         * Fix altezza viewport per mobile (100vh issue)
         *
         * Su mobile, 100vh include la barra degli indirizzi, causando overflow.
         * Questo fix calcola l'altezza reale del viewport e la setta come CSS custom property.
         */
        setupViewportHeight: function() {
            const setViewportHeight = () => {
                // Calcola altezza reale viewport
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);

                console.log(`📐 [MobileBrowserUI] Viewport height: ${window.innerHeight}px (--vh: ${vh}px)`);
            };

            // Calcola all'avvio
            setViewportHeight();

            // Ricalcola al resize (orientamento, tastiera, ecc.)
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(setViewportHeight, 100);
            });

            // Ricalcola allo scroll (per gestire barra che appare/scompare)
            let scrollTimeout;
            window.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(setViewportHeight, 100);
            });
        },

        /**
         * Gestisce cambio orientamento dispositivo
         */
        setupOrientationChange: function() {
            const handleOrientationChange = () => {
                console.log('📱 [MobileBrowserUI] Cambio orientamento rilevato');

                // Rimuovi vecchio helper se esiste e ripristina overflow
                const oldHelper = document.getElementById('mobile-scroll-helper');
                if (oldHelper && oldHelper.parentNode) {
                    const originalOverflow = oldHelper.dataset.originalOverflow || 'hidden';
                    document.body.style.overflow = originalOverflow;
                    oldHelper.parentNode.removeChild(oldHelper);
                }

                // Attendi che il browser completi il cambio orientamento
                setTimeout(() => {
                    this.setupViewportHeight();
                    this.hideAddressBar();
                }, 300);
            };

            // Event listener orientamento
            window.addEventListener('orientationchange', handleOrientationChange);

            // Fallback: resize per browser che non supportano orientationchange
            let lastWidth = window.innerWidth;
            window.addEventListener('resize', () => {
                const currentWidth = window.innerWidth;
                if (Math.abs(currentWidth - lastWidth) > 100) {
                    // Cambio significativo dimensioni = probabile rotazione
                    handleOrientationChange();
                    lastWidth = currentWidth;
                }
            });
        },

        /**
         * Setup Fullscreen API (opzionale)
         */
        setupFullscreenAPI: function() {
            if (!this.config.fullscreenEnabled) {
                return;
            }

            // Verifica supporto Fullscreen API
            const docEl = document.documentElement;
            this.fullscreenEnabled = !!(
                docEl.requestFullscreen ||
                docEl.webkitRequestFullscreen ||
                docEl.mozRequestFullScreen ||
                docEl.msRequestFullscreen
            );

            if (!this.fullscreenEnabled) {
                console.log('[MobileBrowserUI] Fullscreen API non supportata');
                return;
            }

            console.log('✅ [MobileBrowserUI] Fullscreen API disponibile');

            // Event listener per cambio stato fullscreen
            const fullscreenChangeHandler = () => {
                this.isFullscreen = !!(
                    document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement
                );

                console.log(`📱 [MobileBrowserUI] Fullscreen: ${this.isFullscreen ? 'ATTIVO' : 'DISATTIVO'}`);

                // Ricalcola viewport se uscito da fullscreen
                if (!this.isFullscreen) {
                    this.setupViewportHeight();
                }
            };

            document.addEventListener('fullscreenchange', fullscreenChangeHandler);
            document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
            document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
            document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
        },

        /**
         * Richiede fullscreen (da chiamare su interazione utente)
         */
        requestFullscreen: function() {
            if (!this.fullscreenEnabled || this.isFullscreen) {
                return false;
            }

            const docEl = document.documentElement;

            try {
                if (docEl.requestFullscreen) {
                    docEl.requestFullscreen();
                } else if (docEl.webkitRequestFullscreen) {
                    docEl.webkitRequestFullscreen();
                } else if (docEl.mozRequestFullScreen) {
                    docEl.mozRequestFullScreen();
                } else if (docEl.msRequestFullscreen) {
                    docEl.msRequestFullscreen();
                }

                console.log('📱 [MobileBrowserUI] Fullscreen richiesto');
                return true;
            } catch (error) {
                console.error('[MobileBrowserUI] Errore richiesta fullscreen:', error);
                return false;
            }
        },

        /**
         * Esci da fullscreen
         */
        exitFullscreen: function() {
            if (!this.isFullscreen) {
                return false;
            }

            try {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }

                console.log('📱 [MobileBrowserUI] Uscita da fullscreen');
                return true;
            } catch (error) {
                console.error('[MobileBrowserUI] Errore uscita fullscreen:', error);
                return false;
            }
        },

        /**
         * Toggle fullscreen
         */
        toggleFullscreen: function() {
            if (this.isFullscreen) {
                return this.exitFullscreen();
            } else {
                return this.requestFullscreen();
            }
        },

        /**
         * Setup modal fullscreen
         */
        setupFullscreenModal: function() {
            const modal = document.getElementById('fullscreenModal');
            const activateBtn = document.getElementById('fullscreenActivateBtn');
            const dismissBtn = document.getElementById('fullscreenDismissBtn');

            if (!modal || !activateBtn || !dismissBtn) {
                console.warn('[MobileBrowserUI] Elementi modal fullscreen non trovati');
                return;
            }

            // Click su "Attiva Schermo Intero"
            activateBtn.addEventListener('click', () => {
                console.log('📱 [MobileBrowserUI] Utente ha richiesto fullscreen');

                // Nascondi modal
                this.hideFullscreenModal();

                // Attiva fullscreen
                if (this.requestFullscreen()) {
                    // Salva preferenza
                    localStorage.setItem('fullscreenPreference', 'accepted');
                    console.log('✅ [MobileBrowserUI] Fullscreen attivato');
                } else {
                    console.warn('⚠️ [MobileBrowserUI] Fullscreen non disponibile');
                }
            });

            // Click su "Continua così"
            dismissBtn.addEventListener('click', () => {
                console.log('📱 [MobileBrowserUI] Utente ha rifiutato fullscreen');

                // Nascondi modal
                this.hideFullscreenModal();

                // Salva preferenza
                localStorage.setItem('fullscreenPreference', 'dismissed');

                // Fallback: prova comunque lo scroll trick
                this.hideAddressBar();
            });

            console.log('✅ [MobileBrowserUI] Modal fullscreen configurato');
        },

        /**
         * Mostra modal fullscreen se necessario
         */
        showFullscreenModalIfNeeded: function() {
            // Controlla preferenza salvata
            const preference = localStorage.getItem('fullscreenPreference');

            if (preference === 'accepted' || preference === 'dismissed') {
                console.log('[MobileBrowserUI] Preferenza fullscreen già salvata:', preference);

                // Se già accettato in passato, attiva automaticamente
                if (preference === 'accepted' && !this.isFullscreen) {
                    this.requestFullscreen();
                } else if (preference === 'dismissed') {
                    // Se dismissato, prova scroll trick
                    this.hideAddressBar();
                }
                return;
            }

            // Verifica supporto Fullscreen API
            if (!this.fullscreenEnabled) {
                console.log('[MobileBrowserUI] Fullscreen API non supportata, uso scroll trick');
                this.hideAddressBar();
                return;
            }

            // Mostra modal
            const modal = document.getElementById('fullscreenModal');
            if (modal) {
                modal.classList.remove('hidden');
                console.log('📱 [MobileBrowserUI] Modal fullscreen mostrato');
            }
        },

        /**
         * Nascondi modal fullscreen
         */
        hideFullscreenModal: function() {
            const modal = document.getElementById('fullscreenModal');
            if (modal) {
                modal.classList.add('hidden');
                console.log('📱 [MobileBrowserUI] Modal fullscreen nascosto');
            }
        },

        /**
         * Debug info
         */
        debugInfo: function() {
            console.log(`
═══════════════════════════════════════
📱 MobileBrowserUI - Debug Info
═══════════════════════════════════════
Inizializzato: ${this.initialized}
Mobile: ${this.isMobile}
Fullscreen attivo: ${this.isFullscreen}
Fullscreen API: ${this.fullscreenEnabled ? 'supportata' : 'non supportata'}
───────────────────────────────────────
Window:
  innerWidth: ${window.innerWidth}px
  innerHeight: ${window.innerHeight}px
  outerWidth: ${window.outerWidth}px
  outerHeight: ${window.outerHeight}px
  devicePixelRatio: ${window.devicePixelRatio}
───────────────────────────────────────
Screen:
  width: ${screen.width}px
  height: ${screen.height}px
  availWidth: ${screen.availWidth}px
  availHeight: ${screen.availHeight}px
  orientation: ${screen.orientation ? screen.orientation.type : 'N/A'}
───────────────────────────────────────
CSS Custom Properties:
  --vh: ${getComputedStyle(document.documentElement).getPropertyValue('--vh')}
═══════════════════════════════════════
            `);
        }
    };

    // Auto-inizializza quando DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.MobileBrowserUI.init();
        });
    } else {
        // DOM già pronto
        window.MobileBrowserUI.init();
    }

})();
