/**
 * DragDropMaterialHighlight.js - Gestione materiali highlight per drag & drop
 * Mixin: aggiunge metodi a window.DragDropSystem
 */
(function() {
    const DDS = window.DragDropSystem;

    DDS.initMaterials = function() {
        // Materiale per zone di snap (anelli intorno agli oggetti)
        this.snapZoneMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            wireframe: true,
            side: THREE.DoubleSide
        });
        
        // Materiale per indicatori di snap attivo
        this.snapIndicatorMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        // Materiale per evidenziazione oggetti draggabili
        this.highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ccff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        console.log('[DragDropSystem] Materiali visivi inizializzati');
    };
    DDS.showSnapIndicators = function(draggedObject) {
        this.snapIndicators.forEach((indicator, uuid) => {
            if (uuid === draggedObject.uuid) {
                // Mostra l'indicatore della posizione originale dell'oggetto trascinato
                indicator.visible = true;
                indicator.material.opacity = 0.8;
                indicator.material.color.set(0x00ff00); // Verde per la posizione originale

                console.log(`[DragDropSystem] 🎯 Mostro indicatore snap per: ${draggedObject.name}`);
            } else {
                // Nasconde indicatori di altri oggetti per chiarezza
                indicator.visible = false;
            }
        });
    };
    /**
     * Nasconde tutti gli indicatori snap
     */
    DDS.hideAllSnapIndicators = function() {
        this.snapIndicators.forEach(indicator => {
            indicator.visible = false;
        });
    };
    /* ===== UTILITY FUNCTIONS ===== */
    
    /**
     * Trova il modello root partendo da un oggetto figlio (stesso logic del sistema esistente)
     * @param {THREE.Object3D} clickedObject - Oggetto cliccato
     * @returns {THREE.Object3D|null} - Modello root

    /**
     * Ripristina i materiali originali di un oggetto dopo highlight
     */
    DDS.restoreMaterialHighlight = function(object) {
        if (!object || !this.originalMaterialsMap) return;
        const key = object.uuid;
        if (this.originalMaterialsMap.has(key)) {
            const originalMaterials = this.originalMaterialsMap.get(key);
            object.traverse((child) => {
                if (child.isMesh && originalMaterials.has(child.uuid)) {
                    child.material = originalMaterials.get(child.uuid);
                    child.renderOrder = 0;
                }
            });
            this.originalMaterialsMap.delete(key);
        }
    };

    console.log('[DragDropMaterialHighlight] Modulo caricato');
})();
