/**
 * DragDropDebugHelpers.js - Funzioni di Debug per DragDropSystem
 *
 * Funzioni globali per debug e risoluzione problemi del sistema drag & drop
 *
 * Versione: 1.0
 * Data: Dicembre 2025
 */

console.log('🔧 [DragDropDebugHelpers] Debug helpers caricati');

// Funzioni globali di debug
if (typeof window !== 'undefined') {

    /**
     * Debug completo stato drag & drop
     */
    window.debugDragDrop = function() {
        if (!window.DragDropSystem) {
            console.log('❌ DragDropSystem non disponibile');
            return null;
        }

        const system = window.DragDropSystem;

        console.log('🔍 DEBUG DRAG & DROP STATE:');
        console.log(`  ✅ enabled: ${system.enabled}`);
        console.log(`  🎯 isDragging: ${system.isDragging}`);
        console.log(`  📦 draggedObject: ${system.draggedObject?.name || 'null'}`);
        console.log(`  🖱️ mouseState:`, system.mouseState);
        console.log(`  📏 snapDistance: ${system.snapDistance}`);
        console.log(`  🎨 canvas: ${!!system.canvas}`);
        console.log(`  📐 scene: ${!!system.scene}`);
        console.log(`  📷 camera: ${!!system.camera}`);
        console.log(`  🔢 draggableObjects: ${system.draggableObjects?.length || 0}`);
        console.log(`  💾 originalPositions: ${system.originalPositions?.size || 0}`);

        // Assembly system info
        const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;
        if (assemblySystem) {
            console.log(`  🏗️ AssemblySystem: ${assemblySystem.assemblyMode ? 'ATTIVO' : 'inattivo'}`);
            if (assemblySystem.assemblyMode) {
                const status = assemblySystem.getAssemblyStatus();
                console.log(`    📍 currentStep: ${status.currentStep}`);
                console.log(`    ✅ stepComplete: ${status.currentStepComplete}`);
                console.log(`    🎯 allowedComponents: [${status.allowedComponents.join(', ')}]`);
                console.log(`    🔧 mountedComponents: [${status.mountedComponents.join(', ')}]`);
            }
        }

        return system.getSystemInfo ? system.getSystemInfo() : null;
    };

    /**
     * Forza il reset dello stato di drag
     */
    window.forceResetDrag = function() {
        if (!window.DragDropSystem) {
            console.log('❌ DragDropSystem non disponibile');
            return 'DragDropSystem non disponibile';
        }

        console.log('🚨 FORCE RESET comando console');
        window.DragDropSystem.forceResetDragState();

        // Verifica stato dopo reset
        setTimeout(() => {
            console.log('🔍 Stato dopo reset:');
            console.log(`  isDragging: ${window.DragDropSystem.isDragging}`);
            console.log(`  draggedObject: ${window.DragDropSystem.draggedObject?.name || 'null'}`);
        }, 100);

        return 'Reset completato';
    };

    /**
     * Debug posizioni originali
     */
    window.debugOriginalPositions = function() {
        if (!window.DragDropSystem || !window.DragDropSystem.originalPositions) {
            console.log('❌ originalPositions non disponibili');
            return;
        }

        const positions = window.DragDropSystem.originalPositions;
        console.log(`🔍 POSIZIONI ORIGINALI (${positions.size} oggetti):`);

        positions.forEach((position, uuid) => {
            // Trova l'oggetto corrispondente
            const obj = window.Scene3D?.scene?.children.find(child => child.uuid === uuid);
            const name = obj?.name || 'UNKNOWN';
            console.log(`  📦 ${name}: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        });

        return Array.from(positions.entries());
    };

    /**
     * Debug sistema assemblaggio
     */
    window.debugAssemblySystem = function() {
        const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;

        if (!assemblySystem) {
            console.log('❌ Nessun sistema di assemblaggio disponibile');
            return null;
        }

        console.log('🏗️ DEBUG ASSEMBLY SYSTEM:');
        console.log(`  📦 Tipo: ${window.AssemblySystemSimplified ? 'AssemblySystemSimplified' : 'AssemblySystem'}`);
        console.log(`  ✅ enabled: ${assemblySystem.enabled}`);
        console.log(`  🎯 assemblyMode: ${assemblySystem.assemblyMode}`);

        if (assemblySystem.debugCurrentState) {
            assemblySystem.debugCurrentState();
        }

        const status = assemblySystem.getAssemblyStatus();
        console.log('📊 Assembly Status:', status);

        return status;
    };

    /**
     * Test snap targets per un componente
     */
    window.testSnapTargets = function(componentName) {
        if (!componentName) {
            console.log('❌ Specifica un nome componente: testSnapTargets("tappino_grasso_dx")');
            return;
        }

        const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;

        if (!assemblySystem || !assemblySystem.assemblyMode) {
            console.log('❌ Sistema assemblaggio non attivo');
            return;
        }

        console.log(`🎯 TEST SNAP TARGETS per "${componentName}":`);

        if (window.AssemblySystemSimplified && assemblySystem.getCurrentGroupSnapTargets) {
            const snapTargets = assemblySystem.getCurrentGroupSnapTargets(componentName);
            console.log(`📊 Trovati ${snapTargets.length} snap targets:`);

            snapTargets.forEach((target, index) => {
                console.log(`  ${index + 1}. ${target.targetName}: (${target.position.x.toFixed(2)}, ${target.position.y.toFixed(2)}, ${target.position.z.toFixed(2)}) ${target.isPrimary ? '[PRIMARY]' : ''}`);
            });

            return snapTargets;
        } else {
            console.log('❌ getCurrentGroupSnapTargets non disponibile');
            return [];
        }
    };

    /**
     * Lista oggetti draggabili
     */
    window.listDraggableObjects = function() {
        if (!window.DragDropSystem || !window.DragDropSystem.draggableObjects) {
            console.log('❌ DragDropSystem o draggableObjects non disponibili');
            return [];
        }

        const objects = window.DragDropSystem.draggableObjects;
        console.log(`🔍 OGGETTI DRAGGABILI (${objects.length}):`);

        objects.forEach((obj, index) => {
            console.log(`  ${index + 1}. ${obj.name} (UUID: ${obj.uuid.substring(0, 8)}...)`);
        });

        return objects.map(obj => ({ name: obj.name, uuid: obj.uuid }));
    };

    /**
     * Help - mostra tutti i comandi disponibili
     */
    window.dragDropHelp = function() {
        console.log('🔧 DRAG & DROP DEBUG COMMANDS:');
        console.log('  debugDragDrop() - Debug stato completo sistema');
        console.log('  forceResetDrag() - Reset forzato stato drag');
        console.log('  debugOriginalPositions() - Mostra posizioni originali');
        console.log('  debugAssemblySystem() - Debug sistema assemblaggio');
        console.log('  testSnapTargets("nome_componente") - Test snap targets');
        console.log('  listDraggableObjects() - Lista oggetti draggabili');
        console.log('  dragDropHelp() - Mostra questo help');
        console.log('');
        console.log('⌨️  TASTO ESC durante drag = reset automatico');
        console.log('🎯 Per il tutorial Pompa Becker:');
        console.log('   testSnapTargets("tappino_grasso_dx")');
        console.log('   testSnapTargets("filtro")');
        console.log('   testSnapTargets("vite_coperchio_1")');
    };

    // Mostra help all'avvio
    console.log('🔧 Debug helpers disponibili - usa dragDropHelp() per lista comandi');
}