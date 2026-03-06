/**
 * ============================================================================
 * CAMPUS VIRTUAL TRAINING - ELECTRON MAIN PROCESS
 * ============================================================================
 *
 * Entry point per l'applicazione Electron.
 * Gestisce la finestra principale e il ciclo di vita dell'app.
 *
 * Versione: 1.0.0
 * Data: Febbraio 2026
 * ============================================================================
 */

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

let mainWindow;

/**
 * Crea la finestra principale dell'applicazione
 */
function createWindow() {
    // Ottiene le dimensioni dello schermo primario
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Configurazione finestra
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        fullscreen: false, // Parte in modalità finestra
        autoHideMenuBar: true, // Nasconde menu bar di default
        backgroundColor: '#1a1a2e', // Colore di sfondo durante il caricamento
        show: false, // Non mostra finestra finché non è pronta
        icon: path.join(__dirname, 'build', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Espone electronAPI al renderer
            nodeIntegration: false, // Sicurezza: disabilita Node.js nel renderer
            contextIsolation: true, // Sicurezza: isola contesti
            enableRemoteModule: false, // Sicurezza: disabilita remote
            webgl: true, // Abilita WebGL per Three.js
            webSecurity: true,
            allowRunningInsecureContent: false,
            // Abilita supporto touch
            experimentalFeatures: true
        }
    });

    // Carica index.html
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Mostra finestra quando è pronta (evita flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Opzionale: Apri DevTools per debug
        // mainWindow.webContents.openDevTools();

        console.log('✅ Campus Virtual Training avviato correttamente');
    });

    // Gestisce chiusura finestra
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Gestisce errori di caricamento
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('❌ Errore caricamento:', errorDescription);
    });

    // Log quando la pagina è completamente caricata
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('✅ Pagina caricata completamente');
    });

    // Previene navigazione esterna (sicurezza)
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);

        // Permette solo file:// protocol
        if (parsedUrl.protocol !== 'file:') {
            event.preventDefault();
            console.warn('⚠️ Navigazione esterna bloccata:', navigationUrl);
        }
    });

    // Previene apertura nuove finestre
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        console.warn('⚠️ Apertura finestra esterna bloccata:', url);
        return { action: 'deny' };
    });

    // Shortcuts tastiera
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // F11: Toggle fullscreen
        if (input.key === 'F11' && input.type === 'keyDown') {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }

        // F12: Toggle DevTools (solo in dev)
        if (input.key === 'F12' && input.type === 'keyDown') {
            mainWindow.webContents.toggleDevTools();
        }

        // ESC: Esci da fullscreen
        if (input.key === 'Escape' && input.type === 'keyDown' && mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        }
    });
}

/**
 * IPC: Leggi file di configurazione dall'esterno del pacchetto ASAR.
 *
 * Logica di ricerca (in ordine):
 * 1. Modalità packaged: cerca accanto all'exe (extraFiles dalla build)
 * 2. Fallback / modalità sviluppo: cerca nella directory del progetto (__dirname)
 *
 * Questo permette all'utente di modificare InterfaceConfig.cvtscript accanto all'exe
 * installato e di rilanciare il programma per applicare le modifiche.
 */
ipcMain.handle('read-config-file', async (event, filename) => {
    const searchPaths = [];

    if (app.isPackaged) {
        // App compilata: cerca prima nella directory dell'exe (file editabile dall'utente)
        const exeDir = path.dirname(app.getPath('exe'));
        searchPaths.push(path.join(exeDir, filename));
    }

    // Dev mode o fallback: cerca nella directory del progetto / dentro ASAR
    searchPaths.push(path.join(__dirname, filename));

    for (const filePath of searchPaths) {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                console.log(`✅ Config letto da: ${filePath}`);
                return content;
            }
        } catch (e) {
            console.warn(`⚠️ Impossibile leggere: ${filePath} - ${e.message}`);
        }
    }

    console.log(`ℹ️ File config non trovato: ${filename}`);
    return null;
});

/**
 * Evento: App pronta
 */
app.whenReady().then(() => {
    console.log('🚀 Avvio Campus Virtual Training...');
    createWindow();

    // macOS: Ricrea finestra quando dock icon è cliccata
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

/**
 * Evento: Tutte le finestre sono state chiuse
 */
app.on('window-all-closed', () => {
    // Su macOS le app rimangono attive finché non si fa Cmd+Q
    // Su Windows/Linux chiude l'app
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * Evento: Prima che l'app si chiuda
 */
app.on('before-quit', () => {
    console.log('👋 Campus Virtual Training in chiusura...');
});

/**
 * Gestione errori non gestiti
 */
process.on('uncaughtException', (error) => {
    console.error('❌ Errore non gestito:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejection non gestita:', reason);
});
