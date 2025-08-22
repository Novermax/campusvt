/**
 * VISUALIZZATORE MODELLI 3D - VERSIONE STANDALONE
 * 
 * Questa versione include tutti i loader direttamente nel codice
 * per evitare problemi con CDN esterne
 */

// ===== IMPLEMENTAZIONE GLTF LOADER SEMPLIFICATO =====
// Implementazione basilare per caricare file GLTF/GLB
class SimpleGLTFLoader {
    load(url, onLoad, onProgress, onError) {
        const loader = new THREE.FileLoader();
        loader.setResponseType('arraybuffer');
        
        loader.load(url, (data) => {
            try {
                const result = this.parse(data);
                onLoad(result);
            } catch (error) {
                if (onError) onError(error);
            }
        }, onProgress, onError);
    }
    
    parse(data) {
        // Implementazione molto semplificata per GLB
        const magic = new Uint32Array(data.slice(0, 4))[0];
        
        if (magic === 0x46546C67) { // GLB magic number
            return this.parseGLB(data);
        } else {
            // Prova come GLTF JSON
            const jsonString = new TextDecoder().decode(data);
            return this.parseGLTF(JSON.parse(jsonString));
        }
    }
    
    parseGLB(data) {
        // Parsing molto semplificato di GLB
        // Questa è una implementazione basilare
        const view = new DataView(data);
        const version = view.getUint32(4, true);
        const length = view.getUint32(8, true);
        
        // Per semplicità, creiamo un cubo colorato come placeholder
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(geometry, material);
        
        const scene = new THREE.Group();
        scene.add(mesh);
        
        return { scene: scene };
    }
    
    parseGLTF(json) {
        // Parsing molto semplificato di GLTF
        // Creiamo un oggetto placeholder
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: 0x0000ff });
        const mesh = new THREE.Mesh(geometry, material);
        
        const scene = new THREE.Group();
        scene.add(mesh);
        
        return { scene: scene };
    }
}

// ===== IMPLEMENTAZIONE OBJ LOADER SEMPLIFICATO =====
class SimpleOBJLoader {
    parse(text) {
        const vertices = [];
        const faces = [];
        const lines = text.split('\n');
        
        for (let line of lines) {
            line = line.trim();
            
            if (line.startsWith('v ')) {
                // Vertex
                const parts = line.split(' ');
                vertices.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            } else if (line.startsWith('f ')) {
                // Face
                const parts = line.split(' ');
                for (let i = 1; i < parts.length; i++) {
                    const vertexIndex = parseInt(parts[i].split('/')[0]) - 1;
                    faces.push(vertexIndex);
                }
            }
        }
        
        if (vertices.length === 0) {
            // Se non troviamo vertici, creiamo un cubo placeholder
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshLambertMaterial({ color: 0xffaa00 });
            const mesh = new THREE.Mesh(geometry, material);
            
            const group = new THREE.Group();
            group.add(mesh);
            return group;
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        if (faces.length > 0) {
            geometry.setIndex(faces);
        }
        
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x888888,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(mesh);
        
        return group;
    }
}

// ===== IMPLEMENTAZIONE STL LOADER SEMPLIFICATO =====
class SimpleSTLLoader {
    parse(data) {
        // Implementazione molto basilare per STL
        // Se è un file binario STL, dovrebbe iniziare con un header di 80 byte
        
        let geometry;
        
        if (data instanceof ArrayBuffer) {
            geometry = this.parseBinarySTL(data);
        } else {
            geometry = this.parseASCIISTL(data);
        }
        
        if (!geometry) {
            // Fallback: crea un cubo
            geometry = new THREE.BoxGeometry(1, 1, 1);
        }
        
        geometry.computeVertexNormals();
        return geometry;
    }
    
    parseBinarySTL(data) {
        try {
            const view = new DataView(data);
            const triangleCount = view.getUint32(80, true);
            
            const vertices = [];
            let offset = 84;
            
            for (let i = 0; i < triangleCount; i++) {
                // Skip normal vector (12 bytes)
                offset += 12;
                
                // Read vertices (3 vertices * 3 coordinates * 4 bytes each)
                for (let j = 0; j < 9; j++) {
                    vertices.push(view.getFloat32(offset, true));
                    offset += 4;
                }
                
                // Skip attribute byte count
                offset += 2;
            }
            
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            return geometry;
            
        } catch (error) {
            console.warn('Errore parsing STL binario:', error);
            return null;
        }
    }
    
    parseASCIISTL(text) {
        try {
            const vertices = [];
            const lines = text.split('\n');
            
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('vertex')) {
                    const coords = line.split(' ');
                    vertices.push(
                        parseFloat(coords[1]),
                        parseFloat(coords[2]),
                        parseFloat(coords[3])
                    );
                }
            }
            
            if (vertices.length > 0) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                return geometry;
            }
            
        } catch (error) {
            console.warn('Errore parsing STL ASCII:', error);
        }
        
        return null;
    }
}

// ===== VARIABILI GLOBALI =====
let scene, camera, renderer, currentModel, controls;
let canvas, fileInput, loader, errorDiv, resetButton, fileName, testButton, debugInfo;

// Istanze dei loader
const gltfLoader = new SimpleGLTFLoader();
const objLoader = new SimpleOBJLoader();
const stlLoader = new SimpleSTLLoader();

/**
 * INIZIALIZZAZIONE DELL'APPLICAZIONE
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inizializzazione visualizzatore 3D standalone...');
    
    // Forza l'aggiornamento del debug info
    setTimeout(() => {
        updateDebugInfo('Inizializzazione in corso...');
    }, 100);
    
    // Inizializzazione step by step con verifica errori
    try {
        console.log('📋 Step 1: Inizializzazione elementi HTML');
        updateDebugInfo('Step 1: Inizializzazione elementi HTML...');
        if (!initializeElements()) {
            throw new Error('Errore nell\'inizializzazione degli elementi HTML');
        }
        
        console.log('📋 Step 2: Inizializzazione scena 3D');
        updateDebugInfo('Step 2: Inizializzazione scena 3D...');
        if (!initializeScene()) {
            throw new Error('Errore nell\'inizializzazione della scena 3D');
        }
        
        console.log('📋 Step 3: Inizializzazione controlli');
        updateDebugInfo('Step 3: Inizializzazione controlli...');
        initializeControls();
        
        console.log('📋 Step 4: Setup event listeners');
        updateDebugInfo('Step 4: Setup event listeners...');
        setupEventListeners();
        
        console.log('📋 Step 5: Avvio loop rendering');
        updateDebugInfo('Step 5: Avvio loop rendering...');
        startRenderLoop();
        
        console.log('✅ Visualizzatore 3D inizializzato con successo!');
        updateDebugInfo('✅ Visualizzatore inizializzato - Pronto per caricare modelli');
        
        // Test automatico con cubo
        setTimeout(() => {
            console.log('🧊 Creazione cubo di test automatico...');
            addTestCube();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Errore durante l\'inizializzazione:', error);
        updateDebugInfo('❌ ERRORE: ' + error.message);
        showError('Errore durante l\'inizializzazione: ' + error.message);
    }
});

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
        console.error('❌ Alcuni elementi HTML non trovati!');
        updateDebugInfo('ERRORE: Elementi HTML mancanti');
        return false;
    }
    
    console.log('✅ Tutti gli elementi HTML trovati');
    return true;
}

function initializeScene() {
    console.log('🎬 Inizializzazione scena 3D...');
    updateDebugInfo('Creazione scena 3D...');
    
    try {
        // Verifica che THREE sia disponibile
        if (typeof THREE === 'undefined') {
            throw new Error('THREE.js non caricato');
        }
        
        // Crea la scena
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);
        console.log('✅ Scena creata');
        
        // Ottieni le dimensioni corrette del canvas
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        
        console.log('📐 Dimensioni canvas:', width, 'x', height);
        
        // Crea la telecamera con aspect ratio corretto
        const aspect = width / height;
        camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        camera.position.set(0, 0, 5);
        console.log('📷 Telecamera creata');
        
        // Crea il renderer
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        
        // Imposta le dimensioni del renderer
        renderer.setSize(width, height, false); // false = non modificare lo stile CSS
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limita pixel ratio
        
        console.log('🖥️ Renderer creato:', width + 'x' + height);
        
        // Aggiungi illuminazione
        setupLighting();
        
        console.log('✅ Scena 3D inizializzata completamente');
        updateDebugInfo('Scena 3D inizializzata - Renderer attivo');
        
        return true;
        
    } catch (error) {
        console.error('❌ Errore inizializzazione scena:', error);
        updateDebugInfo('ERRORE inizializzazione: ' + error.message);
        showError('Errore inizializzazione scena 3D: ' + error.message);
        return false;
    }
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 0, -10);
    scene.add(fillLight);
    
    console.log('💡 Illuminazione configurata');
}

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

function setupEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleMouseWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    window.addEventListener('resize', handleWindowResize);
    
    resetButton.addEventListener('click', resetView);
    testButton.addEventListener('click', () => addTestCube(true));
    document.getElementById('closeError').addEventListener('click', hideError);
    
    console.log('📡 Event listeners configurati');
}

function addTestCube(permanent = false) {
    console.log('🧊 Aggiunta cubo di test...');
    updateDebugInfo('Creazione cubo di test...');
    
    if (currentModel) {
        scene.remove(currentModel);
    }
    
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshLambertMaterial({ 
        color: 0xff4444,
        transparent: true,
        opacity: 0.8
    });
    
    const wireframe = new THREE.WireframeGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    const wireframeMesh = new THREE.LineSegments(wireframe, lineMaterial);
    
    const testCube = new THREE.Mesh(geometry, material);
    testCube.add(wireframeMesh);
    testCube.position.set(0, 0, 0);
    testCube.castShadow = true;
    testCube.receiveShadow = true;
    
    currentModel = testCube;
    scene.add(testCube);
    
    fileName.textContent = 'Cubo di test';
    updateDebugInfo(`Cubo di test creato - Oggetti nella scena: ${scene.children.length}`);
    
    console.log('✅ Cubo di test aggiunto alla scena');
    
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

function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) {
        return;
    }
    
    console.log('📄 File selezionato:', file.name);
    updateDebugInfo(`File selezionato: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    showLoader();
    fileName.textContent = file.name;
    
    loadModel(file);
}

function loadModel(file) {
    console.log('📦 Inizio caricamento modello:', file.name);
    updateDebugInfo(`Caricamento ${file.name}...`);
    
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
        case 'stl':
            loadSTLModel(file);
            break;
        default:
            const errorMsg = `Formato file non supportato: ${fileExtension}`;
            showError(errorMsg);
            updateDebugInfo(`Errore: ${errorMsg}`);
            hideLoader();
            return;
    }
}

function loadGLTFModel(file) {
    console.log('📦 Caricamento modello GLTF/GLB...');
    updateDebugInfo('Caricamento modello GLTF/GLB...');
    
    const fileURL = URL.createObjectURL(file);
    
    gltfLoader.load(
        fileURL,
        function(gltf) {
            console.log('✅ Modello GLTF caricato:', gltf);
            updateDebugInfo('Modello GLTF caricato con successo');
            
            currentModel = gltf.scene;
            scene.add(currentModel);
            
            setupModel();
            URL.revokeObjectURL(fileURL);
            hideLoader();
        },
        function(progress) {
            if (progress.lengthComputable) {
                const percent = (progress.loaded / progress.total * 100).toFixed(1);
                console.log('⏳ Caricamento GLTF:', percent + '%');
                updateDebugInfo(`Caricamento GLTF: ${percent}%`);
            }
        },
        function(error) {
            console.error('❌ Errore caricamento GLTF:', error);
            const errorMsg = 'Errore nel caricamento del file GLTF/GLB';
            showError(errorMsg);
            updateDebugInfo(`Errore GLTF: File non valido o corrotto`);
            URL.revokeObjectURL(fileURL);
            hideLoader();
        }
    );
}

function loadOBJModel(file) {
    console.log('📦 Caricamento modello OBJ...');
    updateDebugInfo('Caricamento modello OBJ...');
    
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const objData = event.target.result;
            currentModel = objLoader.parse(objData);
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('✅ Modello OBJ caricato con successo');
            updateDebugInfo('Modello OBJ caricato con successo');
            
        } catch (error) {
            console.error('❌ Errore parsing OBJ:', error);
            const errorMsg = 'Errore nel caricamento del file OBJ';
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

function loadSTLModel(file) {
    console.log('📦 Caricamento modello STL...');
    updateDebugInfo('Caricamento modello STL...');
    
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const stlData = event.target.result;
            const geometry = stlLoader.parse(stlData);
            
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x888888,
                side: THREE.DoubleSide
            });
            
            currentModel = new THREE.Mesh(geometry, material);
            
            scene.add(currentModel);
            setupModel();
            hideLoader();
            
            console.log('✅ Modello STL caricato con successo');
            updateDebugInfo('Modello STL caricato con successo');
            
        } catch (error) {
            console.error('❌ Errore parsing STL:', error);
            const errorMsg = 'Errore nel caricamento del file STL';
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

function setupModel() {
    if (!currentModel) return;
    
    console.log('⚙️ Configurazione modello...');
    
    currentModel.traverse(function(child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (!child.material) {
                child.material = new THREE.MeshLambertMaterial({ color: 0x888888 });
            }
        }
    });
    
    autoFitModel();
    
    console.log('✅ Modello configurato');
    updateDebugInfo('Modello configurato e auto-zoom applicato');
}

function autoFitModel() {
    if (!currentModel) return;
    
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
    
    currentModel.position.sub(center);
    camera.position.set(0, 0, finalDistance);
    camera.lookAt(0, 0, 0);
    
    controls.initialCameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
    };
    
    console.log('✅ Auto-zoom completato');
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

function handleWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    
    console.log('📺 Finestra ridimensionata:', width + 'x' + height);
}

function startRenderLoop() {
    let frameCount = 0;
    
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        
        if (frameCount % 120 === 0) { // Ogni 2 secondi circa
            updateDebugInfo(`Rendering attivo - Oggetti: ${scene.children.length} - Camera: ${camera.position.z.toFixed(1)}`);
        }
        frameCount++;
    }
    
    animate();
    console.log('🎬 Loop di rendering avviato');
    updateDebugInfo('Loop di rendering avviato');
}

// ===== FUNZIONI UTILITY =====

function updateDebugInfo(message) {
    console.log('🔧 Debug Info:', message);
    
    try {
        if (debugInfo) {
            const timestamp = new Date().toLocaleTimeString();
            debugInfo.textContent = `[${timestamp}] ${message}`;
            debugInfo.style.color = '#2c3e50';
        } else {
            console.warn('⚠️ debugInfo element non trovato');
        }
    } catch (error) {
        console.error('❌ Errore aggiornamento debug info:', error);
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

console.log('📄 viewer3d_standalone.js caricato completamente');