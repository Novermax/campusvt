/**
 * AssemblyConfigParser.js - Parser e Validatore per Configurazioni Assemblaggio
 * 
 * Gestisce:
 * - Parsing e validazione configurazioni JSON assemblaggio
 * - Schema validation per configurazioni
 * - Loading asincrono configurazioni da file
 * - Caching configurazioni validate
 * 
 * Versione: 1.0
 * Data: Settembre 2025
 */

window.AssemblyConfigParser = {
    // Cache configurazioni validate
    configCache: new Map(),
    
    // Schema validation rules
    validationSchema: {
        required: ['sequence', 'snapPoints'],
        optional: ['interchangeableNodes', 'dependencies', 'metadata'],
        types: {
            sequence: 'array',
            snapPoints: 'object',
            interchangeableNodes: 'object',
            dependencies: 'object',
            metadata: 'object'
        }
    },
    
    /**
     * Carica e valida configurazione assemblaggio da file
     * @param {string} configPath - Percorso file configurazione
     * @returns {Promise<Object>} - Configurazione validata
     */
    async loadAssemblyConfig(configPath) {
        console.log(`[AssemblyConfigParser] 📁 Caricamento configurazione: ${configPath}`);
        
        // Check cache
        if (this.configCache.has(configPath)) {
            console.log('[AssemblyConfigParser] ⚡ Configurazione trovata in cache');
            return this.configCache.get(configPath);
        }
        
        try {
            // Carica file JSON
            const response = await fetchFile(configPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const rawConfig = await response.json();
            
            // Valida configurazione
            const validatedConfig = this.validateConfig(rawConfig, configPath);
            
            // Cache configurazione validata
            this.configCache.set(configPath, validatedConfig);
            
            console.log(`[AssemblyConfigParser] ✅ Configurazione caricata e validata: ${configPath}`);
            return validatedConfig;
            
        } catch (error) {
            console.error(`[AssemblyConfigParser] ❌ Errore caricamento configurazione ${configPath}:`, error);
            throw new AssemblyConfigError(`Errore caricamento configurazione: ${error.message}`, configPath);
        }
    },
    
    /**
     * Valida configurazione assemblaggio contro schema
     * @param {Object} config - Configurazione da validare
     * @param {string} source - Sorgente configurazione per debug
     * @returns {Object} - Configurazione validata e normalizzata
     */
    validateConfig(config, source = 'inline') {
        console.log(`[AssemblyConfigParser] 🔍 Validazione configurazione da: ${source}`);
        
        const errors = [];
        
        // Verifica campi obbligatori
        this.validationSchema.required.forEach(field => {
            if (!config.hasOwnProperty(field)) {
                errors.push(`Campo obbligatorio mancante: ${field}`);
            }
        });
        
        // Verifica tipi
        Object.entries(this.validationSchema.types).forEach(([field, expectedType]) => {
            if (config.hasOwnProperty(field)) {
                const actualType = this.getType(config[field]);
                if (actualType !== expectedType) {
                    errors.push(`Tipo non valido per campo '${field}': atteso '${expectedType}', trovato '${actualType}'`);
                }
            }
        });
        
        // Validazione specifica campi
        if (config.sequence) {
            this.validateSequenceField(config.sequence, errors);
        }
        
        if (config.snapPoints) {
            this.validateSnapPointsField(config.snapPoints, errors);
        }
        
        if (config.interchangeableNodes) {
            this.validateInterchangeableNodesField(config.interchangeableNodes, errors);
        }
        
        if (config.dependencies) {
            this.validateDependenciesField(config.dependencies, errors);
        }
        
        // Se ci sono errori, throw
        if (errors.length > 0) {
            const errorMsg = `Configurazione non valida (${source}):\n${errors.map(e => `- ${e}`).join('\n')}`;
            throw new AssemblyConfigError(errorMsg, source);
        }
        
        // Normalizza e ottimizza configurazione
        const normalizedConfig = this.normalizeConfig(config);
        
        console.log(`[AssemblyConfigParser] ✅ Configurazione validata: ${Object.keys(config).length} campi`);
        return normalizedConfig;
    },
    
    /**
     * Valida campo sequence
     */
    validateSequenceField(sequence, errors) {
        if (!Array.isArray(sequence)) {
            errors.push("'sequence' deve essere un array");
            return;
        }
        
        if (sequence.length === 0) {
            errors.push("'sequence' non può essere vuoto");
            return;
        }
        
        // Verifica duplicati
        const uniqueSteps = new Set(sequence);
        if (uniqueSteps.size !== sequence.length) {
            errors.push("'sequence' contiene step duplicati");
        }
        
        // Verifica che ogni step sia una stringa non vuota
        sequence.forEach((step, index) => {
            if (typeof step !== 'string' || step.trim().length === 0) {
                errors.push(`Step ${index} in 'sequence' deve essere una stringa non vuota`);
            }
        });
    },
    
    /**
     * Valida campo snapPoints
     */
    validateSnapPointsField(snapPoints, errors) {
        if (typeof snapPoints !== 'object' || Array.isArray(snapPoints)) {
            errors.push("'snapPoints' deve essere un oggetto");
            return;
        }
        
        Object.entries(snapPoints).forEach(([componentName, config]) => {
            if (!config.hasOwnProperty('positions') || !Array.isArray(config.positions)) {
                errors.push(`SnapPoints per '${componentName}': campo 'positions' deve essere un array`);
                return;
            }
            
            config.positions.forEach((position, index) => {
                // Verifica campi obbligatori per position
                if (!position.hasOwnProperty('id') || typeof position.id !== 'string') {
                    errors.push(`SnapPoint ${index} per '${componentName}': campo 'id' obbligatorio (stringa)`);
                }
                
                if (!position.hasOwnProperty('position') || !Array.isArray(position.position) || position.position.length !== 3) {
                    errors.push(`SnapPoint ${index} per '${componentName}': campo 'position' deve essere array [x,y,z]`);
                }
                
                if (!position.hasOwnProperty('rotation') || !Array.isArray(position.rotation) || position.rotation.length !== 3) {
                    errors.push(`SnapPoint ${index} per '${componentName}': campo 'rotation' deve essere array [x,y,z]`);
                }
                
                // Verifica che position e rotation siano numeri
                if (position.position && Array.isArray(position.position)) {
                    position.position.forEach((coord, coordIndex) => {
                        if (typeof coord !== 'number') {
                            errors.push(`SnapPoint ${index} per '${componentName}': position[${coordIndex}] deve essere un numero`);
                        }
                    });
                }
                
                if (position.rotation && Array.isArray(position.rotation)) {
                    position.rotation.forEach((rot, rotIndex) => {
                        if (typeof rot !== 'number') {
                            errors.push(`SnapPoint ${index} per '${componentName}': rotation[${rotIndex}] deve essere un numero`);
                        }
                    });
                }
            });
        });
    },
    
    /**
     * Valida campo interchangeableNodes
     */
    validateInterchangeableNodesField(nodes, errors) {
        if (typeof nodes !== 'object' || Array.isArray(nodes)) {
            errors.push("'interchangeableNodes' deve essere un oggetto");
            return;
        }
        
        Object.entries(nodes).forEach(([nodeName, components]) => {
            if (!Array.isArray(components)) {
                errors.push(`InterchangeableNode '${nodeName}': valore deve essere array di componenti`);
                return;
            }
            
            if (components.length === 0) {
                errors.push(`InterchangeableNode '${nodeName}': non può essere vuoto`);
                return;
            }
            
            components.forEach((component, index) => {
                if (typeof component !== 'string' || component.trim().length === 0) {
                    errors.push(`InterchangeableNode '${nodeName}': componente ${index} deve essere stringa non vuota`);
                }
            });
        });
    },
    
    /**
     * Valida campo dependencies
     */
    validateDependenciesField(dependencies, errors) {
        if (typeof dependencies !== 'object' || Array.isArray(dependencies)) {
            errors.push("'dependencies' deve essere un oggetto");
            return;
        }
        
        Object.entries(dependencies).forEach(([component, deps]) => {
            if (!Array.isArray(deps)) {
                errors.push(`Dependencies per '${component}': deve essere array di dipendenze`);
                return;
            }
            
            deps.forEach((dep, index) => {
                if (typeof dep !== 'string' || dep.trim().length === 0) {
                    errors.push(`Dependency ${index} per '${component}': deve essere stringa non vuota`);
                }
            });
        });
    },
    
    /**
     * Normalizza configurazione validata
     */
    normalizeConfig(config) {
        const normalized = JSON.parse(JSON.stringify(config)); // Deep copy
        
        // Aggiungi metadata se mancante
        if (!normalized.metadata) {
            normalized.metadata = {
                version: '1.0',
                createdAt: new Date().toISOString(),
                source: 'AssemblyConfigParser'
            };
        }
        
        // Normalizza nomi componenti (lowercase, trim)
        normalized.sequence = normalized.sequence.map(step => step.trim().toLowerCase());
        
        // Normalizza snapPoints
        const normalizedSnapPoints = {};
        Object.entries(normalized.snapPoints).forEach(([componentName, config]) => {
            const normalizedName = componentName.trim().toLowerCase();
            normalizedSnapPoints[normalizedName] = {
                ...config,
                positions: config.positions.map(pos => ({
                    ...pos,
                    id: pos.id.trim()
                }))
            };
        });
        normalized.snapPoints = normalizedSnapPoints;
        
        // Normalizza interchangeableNodes se presente
        if (normalized.interchangeableNodes) {
            const normalizedNodes = {};
            Object.entries(normalized.interchangeableNodes).forEach(([nodeName, components]) => {
                const normalizedNodeName = nodeName.trim().toLowerCase();
                normalizedNodes[normalizedNodeName] = components.map(comp => comp.trim().toLowerCase());
            });
            normalized.interchangeableNodes = normalizedNodes;
        }
        
        // Normalizza dependencies se presente
        if (normalized.dependencies) {
            const normalizedDeps = {};
            Object.entries(normalized.dependencies).forEach(([component, deps]) => {
                const normalizedComponent = component.trim().toLowerCase();
                normalizedDeps[normalizedComponent] = deps.map(dep => dep.trim().toLowerCase());
            });
            normalized.dependencies = normalizedDeps;
        }
        
        // Aggiungi index lookup per performance
        normalized._internal = {
            componentToSnapPoints: this.buildComponentToSnapPointsIndex(normalized.snapPoints),
            nodeToComponents: normalized.interchangeableNodes || {},
            sequenceIndex: this.buildSequenceIndex(normalized.sequence)
        };
        
        return normalized;
    },
    
    /**
     * Costruisce index componente -> snapPoints per performance
     */
    buildComponentToSnapPointsIndex(snapPoints) {
        const index = {};
        
        Object.entries(snapPoints).forEach(([componentName, config]) => {
            index[componentName] = config.positions.map(pos => pos.id);
        });
        
        return index;
    },
    
    /**
     * Costruisce index sequenza per lookup veloci
     */
    buildSequenceIndex(sequence) {
        const index = {};
        
        sequence.forEach((step, stepIndex) => {
            index[step] = stepIndex;
        });
        
        return index;
    },
    
    /**
     * Ottiene tipo JavaScript di un valore
     */
    getType(value) {
        if (Array.isArray(value)) return 'array';
        if (value === null) return 'null';
        return typeof value;
    },
    
    /**
     * Valida configurazione inline (senza caricamento file)
     * @param {Object} config - Configurazione da validare
     * @returns {Object} - Configurazione validata
     */
    validateInlineConfig(config) {
        return this.validateConfig(config, 'inline');
    },
    
    /**
     * Pulisce cache configurazioni
     */
    clearCache() {
        this.configCache.clear();
        console.log('[AssemblyConfigParser] 🗑️ Cache configurazioni pulita');
    },
    
    /**
     * Ottiene configurazione da cache se disponibile
     * @param {string} configPath - Percorso configurazione
     * @returns {Object|null} - Configurazione cached o null
     */
    getCachedConfig(configPath) {
        return this.configCache.get(configPath) || null;
    },
    
    /**
     * Lista configurazioni disponibili in cache
     * @returns {Array} - Lista percorsi configurazioni in cache
     */
    listCachedConfigs() {
        return Array.from(this.configCache.keys());
    },
    
    /**
     * Genera configurazione esempio per sviluppatori
     * @returns {Object} - Configurazione esempio completa
     */
    generateExampleConfig() {
        return {
            sequence: ["base", "gruppo_viti", "coperchio", "maniglia"],
            
            snapPoints: {
                "base": {
                    nodeId: "base",
                    positions: [
                        {
                            id: "snap_base_center",
                            position: [0, 0, 0],
                            rotation: [0, 0, 0]
                        }
                    ]
                },
                "vite_1": {
                    nodeId: "gruppo_viti",
                    positions: [
                        {
                            id: "snap_vite_1a",
                            position: [1, 0, 1],
                            rotation: [0, 0, 0]
                        },
                        {
                            id: "snap_vite_1b",
                            position: [1, 0, -1],
                            rotation: [0, 0, 0]
                        }
                    ]
                },
                "vite_2": {
                    nodeId: "gruppo_viti",
                    positions: [
                        {
                            id: "snap_vite_2a",
                            position: [-1, 0, 1],
                            rotation: [0, 0, 0]
                        },
                        {
                            id: "snap_vite_2b",
                            position: [-1, 0, -1],
                            rotation: [0, 0, 0]
                        }
                    ]
                }
            },
            
            interchangeableNodes: {
                "gruppo_viti": ["vite_1", "vite_2", "vite_3", "vite_4"],
                "coperchio": ["coperchio_standard", "coperchio_rinforzato"]
            },
            
            dependencies: {
                "gruppo_viti": ["base"],
                "coperchio": ["base", "gruppo_viti"],
                "maniglia": ["coperchio"]
            },
            
            metadata: {
                version: "1.0",
                description: "Configurazione esempio per assemblaggio meccanico",
                author: "AssemblySystem",
                createdAt: new Date().toISOString()
            }
        };
    }
};

/**
 * Classe errore personalizzata per configurazioni assemblaggio
 */
class AssemblyConfigError extends Error {
    constructor(message, configSource = null) {
        super(message);
        this.name = 'AssemblyConfigError';
        this.configSource = configSource;
        this.timestamp = new Date().toISOString();
    }
    
    toString() {
        return `${this.name}: ${this.message}${this.configSource ? ` (source: ${this.configSource})` : ''}`;
    }
}

// Esporta classe errore per uso globale
window.AssemblyConfigError = AssemblyConfigError;