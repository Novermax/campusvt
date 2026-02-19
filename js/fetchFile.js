/**
 * ============================================================================
 * FETCH FILE HELPER - Compatibilità Browser e Electron
 * ============================================================================
 *
 * Funzione helper per caricare file che funziona sia su browser (http/https)
 * che su Electron (file://).
 *
 * Problema: fetch() non funziona con file:// protocol in Electron per sicurezza
 * Soluzione: Usa XMLHttpRequest quando protocollo è file://
 *
 * Versione: 1.0.0
 * Data: 16 Febbraio 2026
 * ============================================================================
 */

/**
 * Carica un file in modo compatibile con browser e Electron
 * @param {string|Request} url - URL del file (stringa o oggetto Request)
 * @param {Object} options - Opzioni fetch (es. { cache: 'no-store' })
 * @returns {Promise<Response>} Promise che risolve con Response compatibile fetch API
 */
window.fetchFile = function(url, options = {}) {
    // Gestisci oggetto Request (Three.js passa Request invece di stringa)
    let actualUrl = url;
    if (url instanceof Request) {
        actualUrl = url.url;
        console.log(`[fetchFile] 📦 Request object rilevato - URL estratto: ${actualUrl}`);
    }

    // Rileva se siamo in Electron (protocollo file://)
    const isElectron = window.location.protocol === 'file:';

    if (!isElectron) {
        // Browser normale - usa fetch standard con opzioni
        return window.__originalFetch ? window.__originalFetch(url, options) : fetch(url, options);
    }

    // Electron - usa XMLHttpRequest per compatibilità file://
    console.log(`[fetchFile] 🔄 Caricamento con XMLHttpRequest: ${actualUrl}`);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // IMPORTANTE: Imposta responseType per file binari (GLB, STL, immagini)
        // Rileva tipo file dall'estensione URL (ignora query params come ?v=timestamp)
        // OPPURE se è un blob URL (blob:file:///) assumo sia binario
        const isBinary = /\.(glb|gltf|bin|stl|obj|png|jpg|jpeg|gif|webp|ico|wasm)(\?|$)/i.test(actualUrl) || actualUrl.startsWith('blob:');

        if (isBinary) {
            xhr.responseType = 'arraybuffer';
            console.log(`[fetchFile] 🔢 File binario rilevato - responseType=arraybuffer`);
        } else {
            console.log(`[fetchFile] 📝 File testo rilevato - responseType=text (default)`);
        }

        // Apri richiesta
        xhr.open('GET', actualUrl, true);
        console.log(`[fetchFile] 📂 XMLHttpRequest aperto per: ${actualUrl}`);

        // Handler successo
        xhr.onload = function() {
            console.log(`[fetchFile] ✅ XMLHttpRequest completato - Status: ${xhr.status}, StatusText: "${xhr.statusText}"`);

            // Per file di testo, logga preview
            if (!isBinary) {
                // File di testo - usa responseText
                const preview = xhr.responseText ? xhr.responseText.substring(0, 200) : '(vuoto)';
                console.log(`[fetchFile] 📄 Contenuto testo ricevuto (primi 200 caratteri):`, preview);
            } else {
                // File binario - usa response.byteLength
                const size = xhr.response && xhr.response.byteLength ? xhr.response.byteLength : 0;
                console.log(`[fetchFile] 📦 File binario ricevuto - Dimensione: ${size} bytes`);
            }

            // Crea oggetto Response compatibile con fetch API
            const response = {
                ok: xhr.status >= 200 && xhr.status < 300 || xhr.status === 0, // Status 0 è OK per file://
                status: xhr.status,
                statusText: xhr.statusText,
                url: actualUrl,

                // Metodi per file di testo
                text: () => {
                    if (isBinary) {
                        // Converti ArrayBuffer a testo se necessario
                        const decoder = new TextDecoder('utf-8');
                        return Promise.resolve(decoder.decode(xhr.response));
                    }
                    return Promise.resolve(xhr.responseText);
                },

                json: () => {
                    const text = isBinary ? new TextDecoder('utf-8').decode(xhr.response) : xhr.responseText;
                    return Promise.resolve(JSON.parse(text));
                },

                // Metodi per file binari (CRITICI per Three.js loaders)
                arrayBuffer: () => {
                    if (isBinary) {
                        return Promise.resolve(xhr.response); // Già ArrayBuffer
                    }
                    // Converti testo a ArrayBuffer se necessario
                    const encoder = new TextEncoder();
                    return Promise.resolve(encoder.encode(xhr.responseText).buffer);
                },

                blob: () => {
                    if (isBinary) {
                        return Promise.resolve(new Blob([xhr.response]));
                    }
                    return Promise.resolve(new Blob([xhr.responseText]));
                },

                headers: {
                    get: (name) => xhr.getResponseHeader(name)
                }
            };

            console.log(`[fetchFile] Response.ok = ${response.ok}`);
            resolve(response);
        };

        // Handler errore
        xhr.onerror = function() {
            const errorMsg = `XMLHttpRequest error per "${actualUrl}": ${xhr.statusText || 'Network error'}`;
            console.error(`[fetchFile] ❌ ${errorMsg}`);
            reject(new Error(errorMsg));
        };

        // Handler timeout
        xhr.ontimeout = function() {
            const errorMsg = `XMLHttpRequest timeout per "${actualUrl}"`;
            console.error(`[fetchFile] ⏱️ ${errorMsg}`);
            reject(new Error(errorMsg));
        };

        // Invia richiesta
        console.log(`[fetchFile] 🚀 Invio richiesta XMLHttpRequest...`);
        xhr.send();
    });
};

console.log('✅ fetchFile helper caricato (compatibilità Electron)');

// ============================================================================
// MONKEY-PATCH GLOBALE di fetch() per Electron
// ============================================================================
// Sovrascrivi window.fetch con fetchFile se siamo in Electron.
// Questo garantisce che TUTTI i fetch (inclusi quelli in Three.js, librerie
// esterne, ecc.) usino XMLHttpRequest invece di fetch quando il protocollo
// è file://.
//
// Questo risolve il caricamento dei modelli 3D (GLB/GLTF/OBJ/STL) che
// Three.js carica internamente usando fetch().
// ============================================================================

if (window.location.protocol === 'file:') {
    console.log('🔧 [fetchFile] Electron rilevato - Monkey-patch window.fetch con fetchFile');

    // Salva riferimento originale (per debug)
    window.__originalFetch = window.fetch;

    // Sovrascrivi fetch globalmente
    window.fetch = window.fetchFile;

    console.log('✅ [fetchFile] window.fetch ora usa XMLHttpRequest per compatibilità file://');
} else {
    console.log('🌐 [fetchFile] Browser normale - fetch standard attivo');
}
