/**
 * ============================================================================
 * CAMPUS VIRTUAL TRAINING - ELECTRON PRELOAD SCRIPT
 * ============================================================================
 *
 * Espone in modo sicuro le API Node.js al renderer process tramite contextBridge.
 * Questo script gira con privilegi Node.js ma in modo isolato dal renderer.
 *
 * Versione: 1.0.0
 * Data: Febbraio 2026
 * ============================================================================
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Espone electronAPI al renderer (window.electronAPI)
 * Le funzioni qui esposte permettono al renderer di comunicare
 * con il main process in modo sicuro (no nodeIntegration).
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Legge un file di configurazione dalla directory dell'applicazione.
     * In modalità compilata (packaged), cerca prima accanto all'exe (extraFiles).
     * In modalità sviluppo, cerca nella directory del progetto (__dirname).
     *
     * @param {string} filename - Nome del file (es. 'InterfaceConfig.ini')
     * @returns {Promise<string|null>} Contenuto testuale del file, o null se non trovato
     */
    readConfigFile: (filename) => ipcRenderer.invoke('read-config-file', filename)
});

console.log('[Preload] ✅ electronAPI esposta al renderer process');
