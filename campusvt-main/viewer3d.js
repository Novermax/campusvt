/**
 * VISUALIZZATORE MODELLI 3D
 * 
 * Questo file contiene tutta la logica per:
 * - Inizializzazione della scena 3D
 * - Caricamento di modelli da file locale
 * - Controlli mouse per navigazione
 * - Auto-zoom per inquadrare il modello
 * 
 * Libreria utilizzata: Three.js per il rendering 3D
 */

// ===== VARIABILI GLOBALI =====
// Queste variabili vengono utilizzate in tutto il programma

let scene;          // La scena 3D che contiene tutti gli oggetti
let camera;         // La telecamera che determina il punto di vista
let renderer;       // Il renderer che disegna la scena sul canvas
let currentModel;   // Riferimento al modello 3D attualmente caricato
let controls;       // Oggetto che gestisce i controlli mouse personalizzati

// Elementi HTML che useremo frequentemente
let canvas;         // Il canvas HTML dove viene renderizzata la scena
let fileInput;      // L'input per selezionare file dal disco
let loader;         // Elemento HTML per mostrare lo stato di caricamento
let errorDiv;       // Elemento HTML per mostrare errori
let resetButton;    // Pulsante per resettare la vista
let fileName;       // Elemento HTML che mostra il nome del file caricato

/**
 * INIZIALIZZAZIONE DELL'APPLICAZIONE
 * Questa funzione viene chiamata quando la pagina è completamente caricata
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inizializzazione del visualizzatore 3D...');
    
    // Otteniamo i riferimenti agli elementi HTML
    initializeElements();
    
    // Configuriamo la scena 3D
    initializeScene();
    
    // Configuriamo i controlli per il mouse
    initializeControls();
    
    // Aggiungiamo i listener per gli eventi
    setupEventListeners();
    
    // Iniziamo il loop di rendering
    startRenderLoop();
    
    console.log('Visualizzatore 3D inizializzato con successo!');
    
    // Aggiungiamo un cubo di test per verificare che tutto funzioni
    addTestCube();
});

/**
 * AGGIUNGE UN CUBO DI TEST
 * Crea un cubo semplice per testare il funzionamento del viewer
 */
function addTestCube() {
    // Crea la geometria di un cubo
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    
    // Crea un materiale rosso
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    
    // Crea il mesh del cubo
    const testCube = new THREE.Mesh(geometry, material);
    
    // Posiziona il cubo al centro
    testCube.position.set(0, 0, 0);
    
    // Aggiungi il cubo alla scena (temporaneamente per test)
    scene.add(testCube);
    
    console.log('Cubo di test aggiunto alla scena');
    
    // Rimuovi il cubo dopo 3 secondi
    setTimeout(() => {
        scene.remove(testCube);
        console.log('Cubo di test rimosso');
    }, 3000);
}

/**
 * INIZIALIZZAZIONE ELEMENTI HTML
 * Ottiene i riferimenti agli elementi HTML che useremo
 */
function initializeElements() {
    canvas = document.getElementById('canvas3d');
    fileInput = document.getElementById('fileInput');
    loader = document.getElementById('loader');
    errorDiv = document.getElementById('error');
    resetButton = document.getElementById('resetView');
    fileName = document.getElementById('fileName');
    
    // Verifica che tutti gli elementi siano stati trovati
    if (!canvas || !fileInput || !loader || !errorDiv) {
        console.error('Errore: alcuni elementi HTML non sono stati trovati!');
        return false;
    }
    
    return true;
}

/**
 * INIZIALIZZAZIONE SCENA 3D
 * Crea la scena, la telecamera, il renderer e l'illuminazione
 */
function initializeScene() {
    // Creiamo la scena 3D (il contenitore di tutti gli oggetti)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Colore di sfondo grigio chiaro
    
    // Creiamo la telecamera prospettica
    // Parametri: angolo di visuale (75°), rapporto aspetto, distanza minima, distanza massima
    camera = new THREE.PerspectiveCamera(
        75, // Campo visivo in gradi
        window.innerWidth / window.innerHeight, // Rapporto aspetto
        0.1, // Distanza minima di rendering
        1000 // Distanza massima di rendering
    );
    
    // Posizioniamo la telecamera
    camera.position.set(0, 0, 5); // x=0, y=0, z=5 (davanti al centro della scena)
    
    // Creiamo il renderer WebGL
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true, // Attiva l'anti-aliasing per bordi più lisci
        alpha: true      // Permette trasparenza
    });
    
    // Configuriamo il renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Abilita le ombre
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Tipo di ombre morbide
    
    // Aggiungiamo l'illuminazione alla scena
    setupLighting();
    
    console.log('Scena 3D inizializzata');
}

/**
 * CONFIGURAZIONE ILLUMINAZIONE
 * Aggiunge diverse luci per illuminare bene il modello
 */
function setupLighting() {
    // Luce ambientale: illumina uniformemente tutta la scena
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Colore grigio scuro, intensità 60%
    scene.add(ambientLight);
    
    // Luce direzionale principale: simula il sole
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Luce bianca, intensità 80%
    directionalLight.position.set(10, 10, 5); // Posizionata in alto a destra
    directionalLight.castShadow = true; // Abilita le ombre per questa luce
    
    // Configurazione delle ombre per la luce direzionale
    directionalLight.shadow.mapSize.width = 2048;  // Risoluzione ombre
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    
    scene.add(directionalLight);
    
    // Luce di riempimento: illumina le zone in ombra
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 0, -10); // Dalla parte opposta
    scene.add(fillLight);
    
    console.log('Illuminazione configurata');
}

/**
 * INIZIALIZZAZIONE CONTROLLI MOUSE
 * Crea l'oggetto per gestire i controlli personalizzati
 */
function initializeControls() {
    controls = {
        // Stato dei controlli
        isRotating: false,    // Se stiamo ruotando il modello
        isPanning: false,     // Se stiamo spostando la vista (pan)
        isZooming: false,     // Se stiamo zoomando
        
        // Posizione precedente del mouse per calcolare i movimenti
        previousMouse: { x: 0, y: 0 },
        
        // Parametri di sensibilità
        rotationSpeed: 0.005,  // Velocità di rotazione
        panSpeed: 0.003,       // Velocità del pan
        zoomSpeed: 0.1,        // Velocità dello zoom
        
        // Limiti dello zoom
        minZoom: 0.1,          // Zoom minimo
        maxZoom: 10,           // Zoom massimo
        
        // Posizione e rotazione iniziali della telecamera (per il reset)
        initialCameraPosition: { x: 0, y: 0, z: 5 },
        initialCameraRotation: { x: 0, y: 0, z: 0 }
    };
    
    console.log('Controlli inizializzati');
}

/**
 * CONFIGURAZIONE EVENT LISTENERS
 * Aggiunge tutti i listener per mouse, tastiera e file input
 */
function setupEventListeners() {
    // === EVENTI DEL FILE INPUT ===
    fileInput.addEventListener('change', handleFileSelect);
    
    // === EVENTI DEL MOUSE ===
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleMouseWheel);
    
    // Preveniamo il menu contestuale con il tasto destro
    canvas.addEventListener('contextmenu', function(event) {
        event.preventDefault();
    });
    
    // === EVENTI DELLA FINESTRA ===
    window.addEventListener('resize', handleWindowResize);
    
    // === EVENTI DEI PULSANTI ===
    resetButton.addEventListener('click', resetView);
    document.getElementById('closeError').addEventListener('click', hideError);
    
    console.log('Event listeners configurati');
}

/**
 * GESTIONE SELEZIONE FILE
 * Viene chiamata quando l'utente seleziona un file
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return; // Nessun file selezionato
    }
    
    console.log('File selezionato:', file.name);
    
    // Mostra il loader
    showLoader();
    
    // Aggiorna il nome del file nell'interfaccia
    fileName.textContent = file.name;
    
    // Carica il modello
    loadModel(file);
}

/**
 * CARICAMENTO MODELLO 3D
 * Carica un modello 3D dal file selezionato
 */
function loadModel(file) {
    // Se c'è già un modello caricato, lo rimuoviamo dalla scena
    if (currentModel) {
        scene.remove(currentModel);
        console.log('Modello precedente rimosso dalla scena');
    }
    
    // Otteniamo l'estensione del file per decidere quale loader usare
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    console.log('Estensione file rilevata:', fileExtension);
    
    // Scegliamo il loader appropriato in base all'estensione
    switch (fileExtension) {
        case 'gltf':
        case 'glb':
            loadGLTFModel(file);
            break;
        case 'obj':
            loadOBJModel(file);
            break;
        case 'ply':
            loadPLYModel(file);
            break;
        case 'stl':
            loadSTLModel(file);
            break;
        default:
            showError('Formato file non supportato. Usa GLTF, GLB, OBJ, PLY o STL.');
            hideLoader();
            return;
    }
}

/**
 * CARICAMENTO MODELLO GLTF/GLB
 * Utilizza GLTFLoader per caricare modelli GLTF e GLB
 */
function loadGLTFModel(file) {
    console.log('Inizio caricamento modello GLTF/GLB:', file.name);
    
    // Verifica se GLTFLoader è disponibile
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader non è disponibile');
        showError('GLTFLoader non è caricato correttamente');
        hideLoader();
        return;
    }
    
    const loader = new THREE.GLTFLoader();
    const fileURL = URL.createObjectURL(file);
    
    console.log('URL creato per il file:', fileURL);
    
    loader.load(
        fileURL,
        function(gltf) {
            console.log('Modello GLTF caricato con successo:', gltf);
            console.log('Scena GLTF:', gltf.scene);
            console.log('Figli della scena:', gltf.scene.children);
            
            currentModel = gltf.scene;
            scene.add(currentModel);
            
            console.log('Modello aggiunto alla scena. Posizione:', currentModel.position);
            console.log('Scala del modello:', currentModel.scale);
            
            setupModel();
            URL.revokeObjectURL(fileURL);
            hideLoader();
        },
        function(progress) {
            const percent = progress.loaded / progress.total * 100;
            console.log('Caricamento GLTF in corso:', percent.toFixed(1) + '%');
        },
        function(error) {
            console.error('Errore dettagliato nel caricamento GLTF:', error);
            showError('Errore nel caricamento del file GLTF/GLB: ' + (error.message || 'Errore sconosciuto'));
            URL.revokeObjectURL(fileURL);
            hideLoader();
        }
    );
}

/**
 * CARICAMENTO MODELLO OBJ
 * Utilizza OBJLoader per caricare modelli OBJ
 */
function loadOBJModel(file) {
    const loader = new THREE.OBJLoader();
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const objData = event.target.result;
            currentModel = loader.parse(objData);
            
            // Aggiungiamo un materiale di base se il modello non ne ha uno
            currentModel.traverse(function(child) {
                if (child.isMesh && !child.material) {
                    child.material = new THREE.MeshLambertMaterial({ color: 0x888888 });
                }
            });
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('Modello OBJ caricato con successo');
            
        } catch (error) {
            console.error('Errore nel parsing del file OBJ:', error);
            showError('Errore nel caricamento del file OBJ: ' + error.message);
            hideLoader();
        }
    };
    
    reader.onerror = function() {
        showError('Errore nella lettura del file OBJ');
        hideLoader();
    };
    
    reader.readAsText(file);
}

/**
 * CARICAMENTO MODELLO PLY
 * Utilizza PLYLoader per caricare modelli PLY
 */
function loadPLYModel(file) {
    const loader = new THREE.PLYLoader();
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const plyData = event.target.result;
            const geometry = loader.parse(plyData);
            
            // Creiamo un materiale di base per il modello PLY
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x888888,
                side: THREE.DoubleSide // Renderizza entrambi i lati delle facce
            });
            
            // Creiamo il mesh
            currentModel = new THREE.Mesh(geometry, material);
            
            // Calcoliamo le normali se non ci sono
            if (!geometry.attributes.normal) {
                geometry.computeVertexNormals();
            }
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('Modello PLY caricato con successo');
            
        } catch (error) {
            console.error('Errore nel parsing del file PLY:', error);
            showError('Errore nel caricamento del file PLY: ' + error.message);
            hideLoader();
        }
    };
    
    reader.onerror = function() {
        showError('Errore nella lettura del file PLY');
        hideLoader();
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * CARICAMENTO MODELLO STL
 * Utilizza STLLoader per caricare modelli STL
 */
function loadSTLModel(file) {
    const loader = new THREE.STLLoader();
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const stlData = event.target.result;
            const geometry = loader.parse(stlData);
            
            // Creiamo un materiale di base per il modello STL
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x888888,
                side: THREE.DoubleSide // Renderizza entrambi i lati delle facce
            });
            
            // Creiamo il mesh
            currentModel = new THREE.Mesh(geometry, material);
            
            // Calcoliamo le normali per l'illuminazione corretta
            geometry.computeVertexNormals();
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('Modello STL caricato con successo');
            
        } catch (error) {
            console.error('Errore nel parsing del file STL:', error);
            showError('Errore nel caricamento del file STL: ' + error.message);
            hideLoader();
        }
    };
    
    reader.onerror = function() {
        showError('Errore nella lettura del file STL');
        hideLoader();
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * CONFIGURAZIONE MODELLO
 * Configura il modello appena caricato (materiali, ombre, auto-zoom)
 */
function setupModel() {
    if (!currentModel) return;
    
    // Abilita le ombre per tutti i mesh del modello
    currentModel.traverse(function(child) {
        if (child.isMesh) {
            child.castShadow = true;    // Il modello proietta ombre
            child.receiveShadow = true; // Il modello riceve ombre
            
            // Se il materiale non esiste, ne creiamo uno di default
            if (!child.material) {
                child.material = new THREE.MeshLambertMaterial({
                    color: 0x888888 // Grigio medio
                });
            }
        }
    });
    
    // Eseguiamo l'auto-zoom per inquadrare il modello
    autoFitModel();
    
    console.log('Modello configurato e auto-zoom applicato');
}

/**
 * AUTO-ZOOM DEL MODELLO
 * Calcola automaticamente la posizione della telecamera per inquadrare tutto il modello
 */
function autoFitModel() {
    if (!currentModel) {
        console.log('autoFitModel: Nessun modello presente');
        return;
    }
    
    console.log('Inizio auto-zoom per il modello:', currentModel);
    
    // Calcoliamo la bounding box del modello (le dimensioni totali)
    const boundingBox = new THREE.Box3().setFromObject(currentModel);
    
    // Verifica se la bounding box è valida
    if (boundingBox.isEmpty()) {
        console.warn('Bounding box vuota, provo a forzare il calcolo...');
        currentModel.updateMatrixWorld(true);
        boundingBox.setFromObject(currentModel);
    }
    
    const center = boundingBox.getCenter(new THREE.Vector3()); // Centro del modello
    const size = boundingBox.getSize(new THREE.Vector3());     // Dimensioni del modello
    
    console.log('Bounding box - Centro:', center, 'Dimensioni:', size);
    
    // Se le dimensioni sono 0, impostiamo valori di default
    if (size.x === 0 && size.y === 0 && size.z === 0) {
        console.warn('Modello con dimensioni zero, uso valori di default');
        size.set(1, 1, 1);
    }
    
    // Calcoliamo la distanza necessaria per inquadrare tutto il modello
    const maxDimension = Math.max(size.x, size.y, size.z); // La dimensione maggiore
    const fov = camera.fov * (Math.PI / 180); // Converti il campo visivo in radianti
    const distance = Math.max(maxDimension / (2 * Math.tan(fov / 2)), 1); // Distanza ottimale (minimo 1)
    
    // Aggiungiamo un margine del 100% per non avere il modello troppo vicino ai bordi
    const finalDistance = Math.max(distance * 2, 5);
    
    console.log('Dimensione massima:', maxDimension, 'Distanza calcolata:', finalDistance);
    
    // Spostiamo il modello al centro della scena
    currentModel.position.sub(center);
    
    console.log('Modello centrato. Nuova posizione modello:', currentModel.position);
    
    // Posizioniamo la telecamera alla distanza calcolata
    camera.position.set(0, 0, finalDistance);
    camera.lookAt(0, 0, 0);
    
    console.log('Telecamera posizionata a:', camera.position);
    
    // Aggiorniamo la posizione iniziale per il reset
    controls.initialCameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
    };
    
    console.log('Auto-zoom completato. Distanza telecamera:', finalDistance);
}

/**
 * GESTIONE MOUSE DOWN
 * Viene chiamata quando si preme un pulsante del mouse
 */
function handleMouseDown(event) {
    event.preventDefault();
    
    // Salviamo la posizione iniziale del mouse
    controls.previousMouse.x = event.clientX;
    controls.previousMouse.y = event.clientY;
    
    // Determiniamo il tipo di controllo in base al pulsante premuto
    if (event.button === 0) {
        // Pulsante sinistro = PAN (spostamento della vista)
        controls.isPanning = true;
        canvas.style.cursor = 'move';
        console.log('Iniziato PAN con pulsante sinistro');
        
    } else if (event.button === 2) {
        // Pulsante destro = ROTAZIONE
        controls.isRotating = true;
        canvas.style.cursor = 'grabbing';
        console.log('Iniziata ROTAZIONE con pulsante destro');
    }
}

/**
 * GESTIONE MOUSE MOVE
 * Viene chiamata quando si muove il mouse
 */
function handleMouseMove(event) {
    if (!controls.isPanning && !controls.isRotating) {
        return; // Non stiamo facendo nessuna operazione
    }
    
    // Calcoliamo quanto si è spostato il mouse
    const deltaX = event.clientX - controls.previousMouse.x;
    const deltaY = event.clientY - controls.previousMouse.y;
    
    if (controls.isRotating && currentModel) {
        // ROTAZIONE DEL MODELLO
        // Ruotiamo il modello in base al movimento del mouse
        currentModel.rotation.y += deltaX * controls.rotationSpeed; // Rotazione orizzontale
        currentModel.rotation.x += deltaY * controls.rotationSpeed; // Rotazione verticale
        
    } else if (controls.isPanning) {
        // PAN DELLA TELECAMERA
        // Spostiamo la telecamera in base al movimento del mouse
        camera.position.x -= deltaX * controls.panSpeed;
        camera.position.y += deltaY * controls.panSpeed; // Invertiamo Y per un controllo più naturale
    }
    
    // Aggiorniamo la posizione precedente del mouse
    controls.previousMouse.x = event.clientX;
    controls.previousMouse.y = event.clientY;
}

/**
 * GESTIONE MOUSE UP
 * Viene chiamata quando si rilascia un pulsante del mouse
 */
function handleMouseUp(event) {
    // Fermiamo tutte le operazioni
    controls.isPanning = false;
    controls.isRotating = false;
    
    // Ripristiniamo il cursore normale
    canvas.style.cursor = 'grab';
    
    console.log('Operazione mouse terminata');
}

/**
 * GESTIONE ROTELLA MOUSE
 * Viene chiamata quando si usa la rotella del mouse per lo zoom
 */
function handleMouseWheel(event) {
    event.preventDefault();
    
    // Determiniamo la direzione dello zoom
    const delta = event.deltaY > 0 ? 1 : -1; // 1 = zoom out, -1 = zoom in
    
    // Calcoliamo il nuovo valore di zoom
    const zoomFactor = 1 + (delta * controls.zoomSpeed);
    
    // Applichiamo lo zoom muovendo la telecamera avanti o indietro
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Direzione in cui sta guardando la telecamera
    
    // Spostiamo la telecamera lungo la sua direzione
    camera.position.add(direction.multiplyScalar(delta * controls.zoomSpeed * 2));
    
    // Limitiamo lo zoom per evitare di andare troppo vicino o troppo lontano
    const distance = camera.position.length();
    if (distance < controls.minZoom) {
        camera.position.normalize().multiplyScalar(controls.minZoom);
    } else if (distance > controls.maxZoom) {
        camera.position.normalize().multiplyScalar(controls.maxZoom);
    }
    
    console.log('Zoom applicato. Distanza telecamera:', distance);
}

/**
 * RESET DELLA VISTA
 * Riporta la telecamera alla posizione iniziale
 */
function resetView() {
    if (!camera) return;
    
    // Ripristiniamo la posizione iniziale della telecamera
    camera.position.set(
        controls.initialCameraPosition.x,
        controls.initialCameraPosition.y,
        controls.initialCameraPosition.z
    );
    
    // Ripristiniamo la rotazione della telecamera
    camera.rotation.set(0, 0, 0);
    
    // Se c'è un modello, azzeriamo anche la sua rotazione
    if (currentModel) {
        currentModel.rotation.set(0, 0, 0);
    }
    
    // Facciamo guardare la telecamera al centro
    camera.lookAt(0, 0, 0);
    
    console.log('Vista resettata alla posizione iniziale');
}

/**
 * GESTIONE RESIZE FINESTRA
 * Aggiorna le dimensioni quando la finestra cambia dimensione
 */
function handleWindowResize() {
    // Aggiorniamo il rapporto aspetto della telecamera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Aggiorniamo le dimensioni del renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    console.log('Finestra ridimensionata:', window.innerWidth + 'x' + window.innerHeight);
}

/**
 * LOOP DI RENDERING
 * Questa funzione viene chiamata continuamente per disegnare la scena
 */
function startRenderLoop() {
    function animate() {
        // Richiediamo il prossimo frame di animazione
        requestAnimationFrame(animate);
        
        // Renderizziamo la scena
        renderer.render(scene, camera);
    }
    
    // Iniziamo il loop
    animate();
    console.log('Loop di rendering avviato');
}

/**
 * FUNZIONI UTILITY PER L'INTERFACCIA
 */

// Mostra l'indicatore di caricamento
function showLoader() {
    loader.classList.remove('hidden');
}

// Nasconde l'indicatore di caricamento
function hideLoader() {
    loader.classList.add('hidden');
}

// Mostra un messaggio di errore
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    errorDiv.classList.remove('hidden');
}

// Nasconde il messaggio di errore
function hideError() {
    errorDiv.classList.add('hidden');
}

// Log finale per confermare che il file è stato caricato
console.log('File viewer3d.js caricato completamente');