/**
 * ParticleSystem.js - Sistema particellare per effetti visivi 3D
 * 
 * Specializzato per simulazione getto aria compressa integrato con tool Aria
 * Compatible con architettura modulare del progetto
 */

window.ParticleSystem = {
    
    // Stato sistema
    scene: null,
    camera: null,
    isActive: false,
    
    // Sistemi particellari attivi
    activeEffects: new Map(),
    
    // Configurazioni predefinite
    presets: {
        airJet: {
            particleCount: 800,
            life: 1.5,
            speed: { min: 15, max: 35 },
            size: { min: 0.0005, max: 0.002 },
            color: new THREE.Color(0.85, 0.92, 1.0),
            opacity: { start: 0.6, end: 0.0 },
            spread: { x: 0.15, y: 0.15, z: 0.15 },
            gravity: { x: 0, y: 0, z: 0 },
            turbulence: 1.2,
            burst: true,
            burstCount: 3,
            burstDelay: 0.1
        },
        
        dust: {
            particleCount: 200,
            life: 3.0,
            speed: { min: 1, max: 4 },
            size: { min: 0.01, max: 0.04 },
            color: new THREE.Color(0.7, 0.6, 0.5),
            opacity: { start: 0.6, end: 0.0 },
            spread: { x: 0.5, y: 0.2, z: 0.5 },
            gravity: { x: 0, y: -0.5, z: 0 },
            turbulence: 0.3
        }
    },
    
    /**
     * Inizializzazione sistema particellare
     */
    init: function(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.isActive = true;
        
        console.log('[ParticleSystem] Sistema particellare inizializzato');
        
        return this;
    },
    
    /**
     * Crea sistema particellare per getto aria compressa
     */
    createAirJet: function(startPosition, direction, options = {}) {
        const config = { ...this.presets.airJet, ...options };
        const effectId = `airJet_${Date.now()}`;
        
        // Crea geometria per le particelle
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(config.particleCount * 3);
        const velocities = new Float32Array(config.particleCount * 3);
        const lifetimes = new Float32Array(config.particleCount);
        const sizes = new Float32Array(config.particleCount);
        const randomValues = new Float32Array(config.particleCount);
        
        // Inizializza particelle
        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;
            
            // Posizione iniziale con spread
            positions[i3] = startPosition.x + (Math.random() - 0.5) * config.spread.x;
            positions[i3 + 1] = startPosition.y + (Math.random() - 0.5) * config.spread.y;
            positions[i3 + 2] = startPosition.z + (Math.random() - 0.5) * config.spread.z;
            
            // Velocità con variazione casuale
            const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);
            velocities[i3] = direction.x * speed + (Math.random() - 0.5) * config.turbulence;
            velocities[i3 + 1] = direction.y * speed + (Math.random() - 0.5) * config.turbulence;
            velocities[i3 + 2] = direction.z * speed + (Math.random() - 0.5) * config.turbulence;
            
            // Attributi particella
            lifetimes[i] = Math.random() * config.life;
            sizes[i] = config.size.min + Math.random() * (config.size.max - config.size.min);
            randomValues[i] = Math.random();
        }
        
        // Imposta attributi geometria
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('randomValue', new THREE.BufferAttribute(randomValues, 1));
        
        // Materiale particelle con shader personalizzato
        const material = new THREE.PointsMaterial({
            size: 0.05,
            color: config.color,
            transparent: true,
            opacity: config.opacity.start,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: false,
            sizeAttenuation: true
        });
        
        // Crea sistema particellare
        const particleSystem = new THREE.Points(geometry, material);
        this.scene.add(particleSystem);
        
        // Salva configurazione per aggiornamento
        this.activeEffects.set(effectId, {
            system: particleSystem,
            config: config,
            startTime: Date.now(),
            startPosition: startPosition.clone(),
            direction: direction.clone(),
            originalPositions: positions.slice(),
            originalVelocities: velocities.slice()
        });
        
        console.log(`[ParticleSystem] Getto aria creato: ${effectId}`);
        return effectId;
    },
    
    /**
     * Crea effetto polvere dispersa
     */
    createDustEffect: function(position, options = {}) {
        const config = { ...this.presets.dust, ...options };
        const effectId = `dust_${Date.now()}`;
        
        // Direzioni casuali per dispersione polvere
        const directions = [];
        for (let i = 0; i < config.particleCount; i++) {
            directions.push(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 2
            ).normalize());
        }
        
        return this.createAirJet(position, new THREE.Vector3(0, 1, 0), {
            ...config,
            customDirections: directions
        });
    },
    
    /**
     * Aggiorna tutti i sistemi particellari attivi
     */
    update: function(deltaTime) {
        if (!this.isActive) return;
        
        const currentTime = Date.now();
        
        this.activeEffects.forEach((effect, effectId) => {
            this.updateParticleEffect(effect, deltaTime, currentTime);
            
            // Rimuovi effetti scaduti
            const elapsed = (currentTime - effect.startTime) / 1000;
            if (elapsed > effect.config.life * 2) {
                this.removeEffect(effectId);
            }
        });
    },
    
    /**
     * Aggiorna singolo effetto particellare
     */
    updateParticleEffect: function(effect, deltaTime, currentTime) {
        const { system, config, startTime, startPosition, direction } = effect;
        const geometry = system.geometry;
        
        const positions = geometry.attributes.position.array;
        const velocities = geometry.attributes.velocity.array;
        const lifetimes = geometry.attributes.lifetime.array;
        const sizes = geometry.attributes.size.array;
        
        const elapsed = (currentTime - startTime) / 1000;
        
        // Aggiorna ogni particella
        for (let i = 0; i < config.particleCount; i++) {
            const i3 = i * 3;
            
            // Calcola vita particella
            lifetimes[i] -= deltaTime;
            
            // Reset particella se morta
            if (lifetimes[i] <= 0) {
                // Rispawn dalla posizione iniziale
                positions[i3] = startPosition.x + (Math.random() - 0.5) * config.spread.x;
                positions[i3 + 1] = startPosition.y + (Math.random() - 0.5) * config.spread.y;
                positions[i3 + 2] = startPosition.z + (Math.random() - 0.5) * config.spread.z;
                
                // Reset velocità
                const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);
                velocities[i3] = direction.x * speed + (Math.random() - 0.5) * config.turbulence;
                velocities[i3 + 1] = direction.y * speed + (Math.random() - 0.5) * config.turbulence;
                velocities[i3 + 2] = direction.z * speed + (Math.random() - 0.5) * config.turbulence;
                
                // Reset vita
                lifetimes[i] = config.life;
            } else {
                // Aggiorna posizione con fisica
                positions[i3] += velocities[i3] * deltaTime;
                positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
                positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
                
                // Applica gravità
                velocities[i3] += config.gravity.x * deltaTime;
                velocities[i3 + 1] += config.gravity.y * deltaTime;
                velocities[i3 + 2] += config.gravity.z * deltaTime;
                
                // Turbolenza
                const turbulence = Math.sin(currentTime * 0.01 + i) * config.turbulence * deltaTime;
                velocities[i3] += turbulence;
                velocities[i3 + 2] += turbulence;
            }
        }
        
        // Aggiorna opacità materiale basata su vita media
        const lifeRatio = Math.max(0, Math.min(1, elapsed / config.life));
        const opacity = config.opacity.start * (1 - lifeRatio) + config.opacity.end * lifeRatio;
        system.material.opacity = Math.max(0.1, opacity);
        
        // Marca attributi per aggiornamento
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.lifetime.needsUpdate = true;
    },
    
    /**
     * Crea getto aria dalla posizione del mouse (integrazione tool Aria)
     */
    createAirJetFromMouse: function(mousePosition, camera, scene) {
        // Raycasting per determinare punto di impatto
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mousePosition, camera);
        
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        if (intersects.length > 0) {
            const intersectPoint = intersects[0].point;
            const normal = intersects[0].face ? intersects[0].face.normal.clone() : new THREE.Vector3(0, 1, 0);
            
            // Posizione leggermente spostata dalla superficie
            const startPos = intersectPoint.clone().add(normal.multiplyScalar(0.1));
            
            // Direzione del getto (normale alla superficie + componente verso l'esterno)
            const jetDirection = normal.clone().normalize();
            
            // Crea getto aria
            const airJetId = this.createAirJet(startPos, jetDirection, {
                particleCount: 300,
                life: 1.5,
                speed: { min: 8, max: 20 },
                spread: { x: 0.2, y: 0.2, z: 0.2 }
            });
            
            // Crea anche effetto polvere se impatto su superficie
            setTimeout(() => {
                this.createDustEffect(intersectPoint, {
                    particleCount: 150,
                    life: 2.0
                });
            }, 100);
            
            return airJetId;
        }
        
        return null;
    },
    
    /**
     * Rimuovi effetto specifico
     */
    removeEffect: function(effectId) {
        const effect = this.activeEffects.get(effectId);
        if (effect) {
            this.scene.remove(effect.system);
            effect.system.geometry.dispose();
            effect.system.material.dispose();
            this.activeEffects.delete(effectId);
            
            console.log(`[ParticleSystem] Effetto rimosso: ${effectId}`);
        }
    },
    
    /**
     * Rimuovi tutti gli effetti attivi
     */
    clearAllEffects: function() {
        this.activeEffects.forEach((effect, effectId) => {
            this.removeEffect(effectId);
        });
        
        console.log('[ParticleSystem] Tutti gli effetti particellari rimossi');
    },
    
    /**
     * Abilita/disabilita sistema
     */
    setEnabled: function(enabled) {
        this.isActive = enabled;
        
        if (!enabled) {
            this.clearAllEffects();
        }
        
        console.log(`[ParticleSystem] Sistema ${enabled ? 'abilitato' : 'disabilitato'}`);
    },
    
    /**
     * Ottieni statistiche sistema
     */
    getStats: function() {
        let totalParticles = 0;
        this.activeEffects.forEach(effect => {
            totalParticles += effect.config.particleCount;
        });
        
        return {
            activeEffects: this.activeEffects.size,
            totalParticles: totalParticles,
            isActive: this.isActive
        };
    },
    
    /**
     * Test sistema con getto aria di esempio
     */
    testAirJet: function() {
        if (!this.scene) {
            console.warn('[ParticleSystem] Scena non inizializzata');
            return;
        }
        
        const testPosition = new THREE.Vector3(0, 1, 0);
        const testDirection = new THREE.Vector3(1, 0.2, 0).normalize();
        
        const effectId = this.createAirJet(testPosition, testDirection);
        
        console.log(`[ParticleSystem] Test getto aria creato: ${effectId}`);
        
        // Rimuovi automaticamente dopo 5 secondi
        setTimeout(() => {
            this.removeEffect(effectId);
        }, 5000);
        
        return effectId;
    },
    
    /**
     * Cleanup sistema
     */
    cleanup: function() {
        console.log('[ParticleSystem] Cleanup...');
        
        this.clearAllEffects();
        this.scene = null;
        this.camera = null;
        this.isActive = false;
        
        console.log('[ParticleSystem] Cleanup completato');
    }
};