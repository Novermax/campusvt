/**
 * VISUALIZZATORE MODELLI 3D - VERSIONE MODULI ES6
 * 
 * Questa versione usa i moduli ES6 per importare Three.js
 * per evitare problemi di compatibilità con le CDN
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// ===== VARIABILI GLOBALI =====
let scene, camera, renderer, currentModel, controls;
let canvas, fileInput, loader, errorDiv, resetButton, fileName, testButton, debugInfo;

/**
 * INIZIALIZZAZIONE DELL'APPLICAZIONE
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione del visualizzatore 3D (versione moduli)...');
    
    // Otteniamo i riferimenti agli elementi HTML
    if (!initializeElements()) {
        console.error('❌ Errore nell\'inizializzazione degli elementi HTML');
        return;
    }
    
    // Configuriamo la scena 3D
    initializeScene();
    
    // Configuriamo i controlli per il mouse
    initializeControls();
    
    // Aggiungiamo i listener per gli eventi
    setupEventListeners();
    
    // Iniziamo il loop di rendering
    startRenderLoop();
    
    console.log('✅ Visualizzatore 3D inizializzato con successo!');
    updateDebugInfo('Visualizzatore inizializzato - Pronto per caricare modelli');
    
    // Test immediato con un cubo per verificare il funzionamento
    setTimeout(() => {
        addTestCube();
    }, 1000);
});

/**
 * INIZIALIZZAZIONE ELEMENTI HTML
 */
function initializeElements() {
    canvas = document.getElementById('canvas3d');
    fileInput = document.getElementById('fileInput');
    loader = document.getElementById('loader');
    errorDiv = document.getElementById('error');
    resetButton = document.getElementById('resetView');
    fileName = document.getElementById('fileName');
    testButton = document.getElementById('testCube');
    debugInfo = document.getElementById('debugInfo');
    
    if (!canvas || !fileInput || !loader || !errorDiv) {
        console.error('❌ Alcuni elementi HTML non sono stati trovati!');
        return false;
    }
    
    console.log('✅ Tutti gli elementi HTML trovati');
    return true;
}

/**
 * INIZIALIZZAZIONE SCENA 3D
 */
function initializeScene() {
    console.log('🎬 Inizializzazione scena 3D...');
    
    // Creiamo la scena 3D
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Creiamo la telecamera prospettica
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(0, 0, 5);
    
    // Creiamo il renderer WebGL
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Aggiungiamo l'illuminazione
    setupLighting();
    
    console.log('✅ Scena 3D inizializzata');
    console.log('📐 Dimensioni canvas:', canvas.clientWidth, 'x', canvas.clientHeight);
}

/**
 * CONFIGURAZIONE ILLUMINAZIONE
 */
function setupLighting() {
    // Luce ambientale
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Luce direzionale principale
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Luce di riempimento
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 0, -10);
    scene.add(fillLight);
    
    console.log('💡 Illuminazione configurata');
}

/**
 * INIZIALIZZAZIONE CONTROLLI
 */
function initializeControls() {
    controls = {
        isRotating: false,
        isPanning: false,
        previousMouse: { x: 0, y: 0 },
        rotationSpeed: 0.005,
        panSpeed: 0.003,
        zoomSpeed: 0.1,
        minZoom: 0.1,
        maxZoom: 50,
        initialCameraPosition: { x: 0, y: 0, z: 5 }
    };
    console.log('🎮 Controlli inizializzati');
}

/**
 * CONFIGURAZIONE EVENT LISTENERS
 */
function setupEventListeners() {
    // File input
    fileInput.addEventListener('change', handleFileSelect);
    
    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleMouseWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Window events
    window.addEventListener('resize', handleWindowResize);
    
    // Button events
    resetButton.addEventListener('click', resetView);
    testButton.addEventListener('click', () => addTestCube(true));
    document.getElementById('closeError').addEventListener('click', hideError);
    
    console.log('📡 Event listeners configurati');
}

/**
 * AGGIUNGE UN CUBO DI TEST
 */
function addTestCube(permanent = false) {
    console.log('🧊 Aggiunta cubo di test...');
    updateDebugInfo('Creazione cubo di test...');
    
    // Rimuovi il modello corrente se presente
    if (currentModel) {
        scene.remove(currentModel);
    }
    
    // Crea la geometria di un cubo
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    
    // Crea un materiale colorato con bordi
    const material = new THREE.MeshLambertMaterial({ 
        color: 0xff4444,
        transparent: true,
        opacity: 0.8
    });
    
    // Crea il wireframe per i bordi
    const wireframe = new THREE.WireframeGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    const wireframeMesh = new THREE.LineSegments(wireframe, lineMaterial);
    
    // Crea il mesh del cubo
    const testCube = new THREE.Mesh(geometry, material);
    testCube.add(wireframeMesh);
    
    // Posiziona il cubo al centro
    testCube.position.set(0, 0, 0);
    testCube.castShadow = true;
    testCube.receiveShadow = true;
    
    // Imposta come modello corrente
    currentModel = testCube;
    
    // Aggiungi il cubo alla scena
    scene.add(testCube);
    
    // Aggiorna le info
    fileName.textContent = 'Cubo di test';
    updateDebugInfo(`Cubo di test creato - Posizione: ${testCube.position.x}, ${testCube.position.y}, ${testCube.position.z}`);
    
    console.log('✅ Cubo di test aggiunto alla scena');
    console.log('📊 Oggetti nella scena:', scene.children.length);
    
    // Se non è permanente, rimuovi dopo 5 secondi
    if (!permanent) {
        setTimeout(() => {
            if (currentModel === testCube) {
                scene.remove(testCube);
                currentModel = null;
                fileName.textContent = 'Nessun modello caricato';
                updateDebugInfo('Cubo di test rimosso automaticamente');
                console.log('🗑️ Cubo di test rimosso automaticamente');
            }
        }, 5000);
    }
}

/**
 * GESTIONE SELEZIONE FILE
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    console.log('📄 File selezionato:', file.name, 'Dimensione:', file.size, 'bytes');
    updateDebugInfo(`File selezionato: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    showLoader();
    fileName.textContent = file.name;
    
    loadModel(file);
}

/**
 * CARICAMENTO MODELLO 3D
 */
function loadModel(file) {
    console.log('📦 Inizio caricamento modello:', file.name);
    
    // Rimuovi il modello precedente
    if (currentModel) {
        scene.remove(currentModel);
        console.log('🗑️ Modello precedente rimosso');
    }
    
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    console.log('🔍 Estensione rilevata:', fileExtension);
    
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
            const errorMsg = `Formato file non supportato: ${fileExtension}. Usa GLTF, GLB, OBJ, PLY o STL.`;
            showError(errorMsg);
            updateDebugInfo(`Errore: ${errorMsg}`);
            hideLoader();
            return;
    }
}

/**
 * CARICAMENTO MODELLO GLTF/GLB
 */
function loadGLTFModel(file) {
    console.log('📦 Caricamento modello GLTF/GLB...');
    updateDebugInfo('Caricamento modello GLTF/GLB...');
    
    const loader = new GLTFLoader();
    const fileURL = URL.createObjectURL(file);
    
    loader.load(
        fileURL,
        function(gltf) {
            console.log('✅ Modello GLTF caricato con successo:', gltf);
            updateDebugInfo('Modello GLTF caricato con successo');
            
            currentModel = gltf.scene;
            scene.add(currentModel);
            
            console.log('📊 Figli del modello:', gltf.scene.children.length);
            console.log('📐 Posizione modello:', currentModel.position);
            
            setupModel();
            URL.revokeObjectURL(fileURL);
            hideLoader();
        },
        function(progress) {
            const percent = (progress.loaded / progress.total * 100).toFixed(1);
            console.log('⏳ Caricamento GLTF:', percent + '%');
            updateDebugInfo(`Caricamento GLTF: ${percent}%`);
        },
        function(error) {
            console.error('❌ Errore caricamento GLTF:', error);
            const errorMsg = 'Errore nel caricamento del file GLTF/GLB: ' + (error.message || 'Errore sconosciuto');
            showError(errorMsg);
            updateDebugInfo(`Errore GLTF: ${error.message}`);
            URL.revokeObjectURL(fileURL);
            hideLoader();
        }
    );
}

/**
 * CARICAMENTO MODELLO OBJ
 */
function loadOBJModel(file) {
    console.log('📦 Caricamento modello OBJ...');
    updateDebugInfo('Caricamento modello OBJ...');
    
    const loader = new OBJLoader();
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const objData = event.target.result;
            currentModel = loader.parse(objData);
            
            // Aggiungi materiale di default se necessario
            currentModel.traverse(function(child) {
                if (child.isMesh && !child.material) {
                    child.material = new THREE.MeshLambertMaterial({ color: 0x888888 });
                }
            });
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('✅ Modello OBJ caricato con successo');
            updateDebugInfo('Modello OBJ caricato con successo');
            
        } catch (error) {
            console.error('❌ Errore parsing OBJ:', error);
            const errorMsg = 'Errore nel caricamento del file OBJ: ' + error.message;
            showError(errorMsg);
            updateDebugInfo(`Errore OBJ: ${error.message}`);
            hideLoader();
        }
    };
    
    reader.onerror = function() {
        const errorMsg = 'Errore nella lettura del file OBJ';
        showError(errorMsg);
        updateDebugInfo(errorMsg);
        hideLoader();
    };
    
    reader.readAsText(file);
}

/**
 * CARICAMENTO MODELLO PLY
 */
function loadPLYModel(file) {
    console.log('📦 Caricamento modello PLY...');
    updateDebugInfo('Caricamento modello PLY...');
    
    const loader = new PLYLoader();
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const plyData = event.target.result;
            const geometry = loader.parse(plyData);
            
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x888888,
                side: THREE.DoubleSide
            });
            
            currentModel = new THREE.Mesh(geometry, material);
            
            if (!geometry.attributes.normal) {
                geometry.computeVertexNormals();
            }
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('✅ Modello PLY caricato con successo');
            updateDebugInfo('Modello PLY caricato con successo');
            
        } catch (error) {
            console.error('❌ Errore parsing PLY:', error);
            const errorMsg = 'Errore nel caricamento del file PLY: ' + error.message;
            showError(errorMsg);
            updateDebugInfo(`Errore PLY: ${error.message}`);
            hideLoader();
        }
    };
    
    reader.onerror = function() {
        const errorMsg = 'Errore nella lettura del file PLY';
        showError(errorMsg);
        updateDebugInfo(errorMsg);
        hideLoader();
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * CARICAMENTO MODELLO STL
 */
function loadSTLModel(file) {
    console.log('📦 Caricamento modello STL...');
    updateDebugInfo('Caricamento modello STL...');
    
    const loader = new STLLoader();
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const stlData = event.target.result;
            const geometry = loader.parse(stlData);
            
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x888888,
                side: THREE.DoubleSide
            });
            
            currentModel = new THREE.Mesh(geometry, material);
            geometry.computeVertexNormals();
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('✅ Modello STL caricato con successo');
            updateDebugInfo('Modello STL caricato con successo');
            
        } catch (error) {
            console.error('❌ Errore parsing STL:', error);
            const errorMsg = 'Errore nel caricamento del file STL: ' + error.message;
            showError(errorMsg);
            updateDebugInfo(`Errore STL: ${error.message}`);
            hideLoader();
        }
    };
    
    reader.onerror = function() {
        const errorMsg = 'Errore nella lettura del file STL';
        showError(errorMsg);
        updateDebugInfo(errorMsg);
        hideLoader();
    };
    
    reader.readAsArrayBuffer(file);
}

/**
 * CONFIGURAZIONE MODELLO
 */
function setupModel() {
    if (!currentModel) return;
    
    console.log('⚙️ Configurazione modello...');
    
    // Abilita ombre
    currentModel.traverse(function(child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (!child.material) {
                child.material = new THREE.MeshLambertMaterial({ color: 0x888888 });
            }
        }
    });
    
    // Auto-zoom
    autoFitModel();
    
    console.log('✅ Modello configurato');
    updateDebugInfo('Modello configurato e auto-zoom applicato');
}

/**
 * AUTO-ZOOM DEL MODELLO
 */
function autoFitModel() {
    if (!currentModel) {
        console.log('❓ autoFitModel: Nessun modello presente');
        return;
    }
    
    console.log('🔍 Calcolo auto-zoom...');
    
    const boundingBox = new THREE.Box3().setFromObject(currentModel);
    
    if (boundingBox.isEmpty()) {
        console.warn('⚠️ Bounding box vuota, forzo calcolo...');
        currentModel.updateMatrixWorld(true);
        boundingBox.setFromObject(currentModel);
    }
    
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    console.log('📐 Centro:', center, 'Dimensioni:', size);
    
    if (size.x === 0 && size.y === 0 && size.z === 0) {
        console.warn('⚠️ Dimensioni zero, uso valori default');
        size.set(1, 1, 1);
    }
    
    const maxDimension = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const distance = Math.max(maxDimension / (2 * Math.tan(fov / 2)), 1);
    const finalDistance = Math.max(distance * 2, 5);
    
    console.log('📏 Dimensione max:', maxDimension, 'Distanza:', finalDistance);
    
    // Centra il modello
    currentModel.position.sub(center);
    
    // Posiziona la telecamera
    camera.position.set(0, 0, finalDistance);
    camera.lookAt(0, 0, 0);
    
    controls.initialCameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
    };
    
    console.log('✅ Auto-zoom completato. Distanza telecamera:', finalDistance);
    updateDebugInfo(`Auto-zoom completato. Distanza: ${finalDistance.toFixed(2)}`);
}

// ===== CONTROLLI MOUSE =====

function handleMouseDown(event) {
    event.preventDefault();
    
    controls.previousMouse.x = event.clientX;
    controls.previousMouse.y = event.clientY;
    
    if (event.button === 0) {
        controls.isPanning = true;
        canvas.style.cursor = 'move';
    } else if (event.button === 2) {
        controls.isRotating = true;
        canvas.style.cursor = 'grabbing';
    }
}

function handleMouseMove(event) {
    if (!controls.isPanning && !controls.isRotating) {
        return;
    }
    
    const deltaX = event.clientX - controls.previousMouse.x;
    const deltaY = event.clientY - controls.previousMouse.y;
    
    if (controls.isRotating && currentModel) {
        currentModel.rotation.y += deltaX * controls.rotationSpeed;
        currentModel.rotation.x += deltaY * controls.rotationSpeed;
    } else if (controls.isPanning) {
        camera.position.x -= deltaX * controls.panSpeed;
        camera.position.y += deltaY * controls.panSpeed;
    }
    
    controls.previousMouse.x = event.clientX;
    controls.previousMouse.y = event.clientY;
}

function handleMouseUp(event) {
    controls.isPanning = false;
    controls.isRotating = false;
    canvas.style.cursor = 'grab';
}

function handleMouseWheel(event) {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 1 : -1;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    camera.position.add(direction.multiplyScalar(delta * controls.zoomSpeed * 2));
    
    const distance = camera.position.length();
    if (distance < controls.minZoom) {
        camera.position.normalize().multiplyScalar(controls.minZoom);
    } else if (distance > controls.maxZoom) {
        camera.position.normalize().multiplyScalar(controls.maxZoom);
    }
}

/**
 * RESET VISTA
 */
function resetView() {
    if (!camera) return;
    
    camera.position.set(
        controls.initialCameraPosition.x,
        controls.initialCameraPosition.y,
        controls.initialCameraPosition.z
    );
    
    camera.rotation.set(0, 0, 0);
    
    if (currentModel) {
        currentModel.rotation.set(0, 0, 0);
    }
    
    camera.lookAt(0, 0, 0);
    
    console.log('🔄 Vista resettata');
    updateDebugInfo('Vista resettata alla posizione iniziale');
}

/**
 * GESTIONE RESIZE FINESTRA
 */
function handleWindowResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    
    console.log('📺 Finestra ridimensionata:', width + 'x' + height);
}

/**
 * LOOP DI RENDERING
 */
function startRenderLoop() {
    let frameCount = 0;
    
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        
        // Aggiorna info debug ogni 60 frame
        if (frameCount % 60 === 0) {
            updateDebugInfo(`Rendering attivo - Frame: ${frameCount} - Oggetti scena: ${scene.children.length}`);
        }
        frameCount++;
    }
    
    animate();
    console.log('🎬 Loop di rendering avviato');
}

// ===== FUNZIONI UTILITY =====

function updateDebugInfo(message) {
    if (debugInfo) {
        const timestamp = new Date().toLocaleTimeString();
        debugInfo.textContent = `[${timestamp}] ${message}`;
    }
}

function showLoader() {
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    errorDiv.classList.add('hidden');
}

console.log('📄 viewer3d_module.js caricato completamente');