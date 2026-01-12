/**
 * MovementParser - Parser comandi movimento tutorial
 * @module core/MovementParser
 * @version 1.0.0
 *
 * @description
 * Parse comandi movimento da tutorial.txt in oggetti strutturati
 * per il sistema di animazione.
 *
 * Supporta comandi:
 * - traslazione:(x,y,z,durata)
 * - rotazione:(rx,ry,rz,durata)
 * - svita / svita(distanza)
 * - avvita / avvita(distanza)
 * - estrai / estrai(distanza)
 * - inserisci / inserisci(distanza)
 * - appoggia(durata)
 * - centro:(x,y,z)
 * - resetCenteredOriginal(durata)
 *
 * @example
 * const steps = MovementParser.parseMovementSteps(tutorialStep, 'vite.glb');
 * // Ritorna array di step parsati con traslazione, rotazione, etc.
 */
window.MovementParser = {
    /**
     * Storage per direzioni modelli (caricati da home_config.txt)
     * Formato: { 'modello.glb': {x: 0, y: 0, z: 1}, ... }
     */
    modelDirections: {},

    /**
     * Parse tutte le azioni (Azione1, Azione2, ...) da uno step tutorial
     * @param {Object} tutorialStep - Step tutorial con properties
     * @param {string} modelFilename - Nome file modello per home_config lookup
     * @returns {Array} Array di step parsati
     */
    parseMovementSteps: function(tutorialStep, modelFilename = null) {
        console.log(`🔍 [PARSE_STEPS] Inizio parsing per modelFilename="${modelFilename}"`);
        console.log(`🔍 [PARSE_STEPS] Proprietà disponibili:`, Object.keys(tutorialStep.properties || {}));

        const movementSteps = [];
        let stepIndex = 1;

        while (tutorialStep.properties[`Azione${stepIndex}`]) {
            const stepString = tutorialStep.properties[`Azione${stepIndex}`];
            console.log(`🔍 [PARSE_STEPS] Trovata Azione${stepIndex}: "${stepString}"`);
            const parsedStep = this.parseMovementStepString(stepString, stepIndex, modelFilename);

            if (parsedStep) {
                console.log(`🔍 [PARSE_STEPS] Step ${stepIndex} parsato con successo:`, parsedStep);
                movementSteps.push(parsedStep);
            } else {
                console.warn(`⚠️ [PARSE_STEPS] Step ${stepIndex} NON parsato!`);
            }

            stepIndex++;
        }

        console.log(`🔍 [PARSE_STEPS] Risultato finale: ${movementSteps.length} step trovati`);
        return movementSteps;
    },

    /**
     * Parse singolo step movimento (es: "traslazione:(0,0,1,1.0);rotazione:(0,0,90,1.0)")
     * @param {string} stepString - Stringa comando (può contenere multiple operazioni separate da ;)
     * @param {number} stepIndex - Indice step per debug
     * @param {string} modelFilename - Nome file modello per home_config lookup
     * @returns {Object|null} Oggetto step parsato o null se errore
     */
    parseMovementStepString: function(stepString, stepIndex, modelFilename = null) {
        try {
            const step = {
                index: stepIndex,
                rotazione: null,
                traslazione: null,
                appoggia: null,
                resetCenteredOriginal: null,
                svita: null,
                avvita: null,
                estrai: null,
                inserisci: null,
                centro: null,
                durata: 1.0
            };

            const operations = stepString.split(';');

            for (const operation of operations) {
                const trimmed = operation.trim();

                if (trimmed.startsWith('rotazione:')) {
                    step.rotazione = this.parseMovementOperation(trimmed, 'rotazione', modelFilename);
                } else if (trimmed.startsWith('traslazione:')) {
                    step.traslazione = this.parseMovementOperation(trimmed, 'traslazione', modelFilename);
                } else if (trimmed.startsWith('appoggia')) {
                    step.appoggia = this.parseMovementOperation(trimmed, 'appoggia', modelFilename);
                } else if (trimmed.startsWith('resetCenteredOriginal')) {
                    step.resetCenteredOriginal = this.parseMovementOperation(trimmed, 'resetCenteredOriginal', modelFilename);
                } else if (trimmed.startsWith('svita')) {
                    step.svita = this.parseMovementOperation(trimmed, 'svita', modelFilename);
                } else if (trimmed.startsWith('avvita')) {
                    step.avvita = this.parseMovementOperation(trimmed, 'avvita', modelFilename);
                } else if (trimmed.startsWith('estrai')) {
                    step.estrai = this.parseMovementOperation(trimmed, 'estrai', modelFilename);
                } else if (trimmed.startsWith('inserisci')) {
                    step.inserisci = this.parseMovementOperation(trimmed, 'inserisci', modelFilename);
                } else if (trimmed.startsWith('centro:')) {
                    step.centro = this.parseMovementOperation(trimmed, 'centro', modelFilename);
                }
            }

            // Calcola durata massima tra tutte le operazioni
            const durateOperazioni = [];
            if (step.rotazione) durateOperazioni.push(step.rotazione.durata);
            if (step.traslazione) durateOperazioni.push(step.traslazione.durata);
            if (step.appoggia) durateOperazioni.push(step.appoggia.durata);
            if (step.resetCenteredOriginal) durateOperazioni.push(step.resetCenteredOriginal.durata);
            if (step.svita) durateOperazioni.push(step.svita.durata);
            if (step.avvita) durateOperazioni.push(step.avvita.durata);
            if (step.estrai) durateOperazioni.push(step.estrai.durata);
            if (step.inserisci) durateOperazioni.push(step.inserisci.durata);
            if (step.centro && step.centro.durata) durateOperazioni.push(step.centro.durata);

            if (durateOperazioni.length > 0) {
                step.durata = Math.max(...durateOperazioni);
            }

            return step;

        } catch (error) {
            console.error(`❌ [PARSE_STEPS] Errore parsing step ${stepIndex}:`, error);
            return null;
        }
    },

    /**
     * Parse singola operazione movimento
     * @param {string} operationString - Stringa operazione (es: "traslazione:(0,0,1,1.0)")
     * @param {string} type - Tipo operazione (traslazione, rotazione, svita, etc)
     * @param {string} modelFilename - Nome file modello per home_config lookup
     * @returns {Object} Oggetto operazione parsata
     * @throws {Error} Se formato non valido
     */
    parseMovementOperation: function(operationString, type, modelFilename = null) {
        // CASO SPECIALE: traslazione verso target (traslazione:target o traslazione:target,(x,y,z,dur))
        if (type === 'traslazione' && operationString.includes(':') && !operationString.match(/^traslazione:\(/)) {
            return this._parseTargetTraslazione(operationString);
        }

        // CASI SEMPLIFICATI: svita, avvita, estrai, inserisci (con direction da home_config)
        if (type === 'svita') return this._parseSvita(operationString, modelFilename);
        if (type === 'avvita') return this._parseAvvita(operationString, modelFilename);
        if (type === 'estrai') return this._parseEstrai(operationString, modelFilename);
        if (type === 'inserisci') return this._parseInserisci(operationString, modelFilename);

        // CASI SPECIALI: appoggia, resetCenteredOriginal
        if (type === 'appoggia') return this._parseAppoggia(operationString);
        if (type === 'resetCenteredOriginal') return this._parseResetCenteredOriginal(operationString);

        // CASI STANDARD: rotazione, traslazione, centro
        const match = operationString.match(/\(([^)]+)\)/);
        if (!match) {
            throw new Error(`Formato ${type} non valido: ${operationString}`);
        }
        const values = match[1].split(',').map(v => parseFloat(v.trim()));

        if (type === 'centro') {
            if (values.length !== 3) {
                throw new Error(`${type} deve avere 3 valori (x,y,z): ${operationString}`);
            }
            return { x: values[0], y: values[1], z: values[2] };
        } else {
            // rotazione, traslazione
            if (values.length !== 4) {
                throw new Error(`${type} deve avere 4 valori (x,y,z,durata): ${operationString}`);
            }
            return {
                x: values[0],
                y: values[1],
                z: values[2],
                durata: values[3]
            };
        }
    },

    /**
     * Parse traslazione verso target (interno)
     * Formato: traslazione:target o traslazione:target,(x,y,z,durata)
     */
    _parseTargetTraslazione: function(operationString) {
        const colonIndex = operationString.indexOf(':');
        const afterColon = operationString.substring(colonIndex + 1);

        let targetElement = null;
        let offsetValues = null;
        let isAbsoluteToOriginal = false;

        if (afterColon.includes(',')) {
            // Formato: traslazione:target,(x,y,z,durata)
            const commaIndex = afterColon.indexOf(',');
            targetElement = afterColon.substring(0, commaIndex).trim();
            const offsetPart = afterColon.substring(commaIndex + 1);

            const offsetMatch = offsetPart.match(/\(([^)]+)\)/);
            if (offsetMatch) {
                offsetValues = offsetMatch[1].split(',').map(v => parseFloat(v.trim()));
                if (offsetValues.length !== 4) {
                    throw new Error(`Offset traslazione verso target deve avere 4 valori (x,y,z,durata): ${operationString}`);
                }
            } else {
                throw new Error(`Formato offset non valido in traslazione verso target: ${operationString}`);
            }
        } else {
            // Formato: traslazione:target
            targetElement = afterColon.trim();

            // Verifica se è una traslazione assoluta verso posizione originale
            if (targetElement.endsWith('_original')) {
                isAbsoluteToOriginal = true;
                offsetValues = [0, 0, 0, 1.0];
            } else {
                offsetValues = [0, 0, 0, 1.0];
            }
        }

        console.log(`🎯 TRASLAZIONE: Target=${targetElement}, Absolute to Original=${isAbsoluteToOriginal}`);

        return {
            x: offsetValues[0],
            y: offsetValues[1],
            z: offsetValues[2],
            durata: offsetValues[3],
            targetElement: targetElement,
            isAbsoluteToOriginal: isAbsoluteToOriginal
        };
    },

    /**
     * Parse comando svita (interno)
     * Formato: svita o svita(distanza)
     */
    _parseSvita: function(operationString, modelFilename) {
        const direction = this.getModelDirection(modelFilename);

        // Estrai parametro distanza opzionale
        let extractionDistance = 0.5; // Default
        const distanceMatch = operationString.match(/svita\(([0-9.]+)\)/);
        if (distanceMatch) {
            extractionDistance = parseFloat(distanceMatch[1]);
            if (isNaN(extractionDistance) || extractionDistance < 0) {
                console.warn(`⚠️ Distanza svita non valida: ${distanceMatch[1]}, uso default 0.5`);
                extractionDistance = 0.5;
            }
        }

        const rotazione = {
            x: direction.x * 1800, // 5 giri completi
            y: direction.y * 1800,
            z: direction.z * 1800,
            durata: 1.0
        };

        console.log(`🔄 SVITA per ${modelFilename}: direction=`, direction, `distanza=${extractionDistance}`, `rotazione=`, rotazione);

        return {
            tipo: 'svita',
            rotazione: rotazione,
            traslazione: {
                x: direction.x * extractionDistance,
                y: direction.y * extractionDistance,
                z: direction.z * extractionDistance,
                durata: 1.0
            },
            durata: 2.0
        };
    },

    /**
     * Parse comando avvita (interno)
     * Formato: avvita o avvita(distanza)
     */
    _parseAvvita: function(operationString, modelFilename) {
        const direction = this.getModelDirection(modelFilename);

        let insertionDistance = 0.5; // Default
        const distanceMatch = operationString.match(/avvita\(([0-9.]+)\)/);
        if (distanceMatch) {
            insertionDistance = parseFloat(distanceMatch[1]);
            if (isNaN(insertionDistance) || insertionDistance < 0) {
                console.warn(`⚠️ Distanza avvita non valida: ${distanceMatch[1]}, uso default 0.5`);
                insertionDistance = 0.5;
            }
        }

        console.log(`🔄 AVVITA per ${modelFilename}: direction=`, direction, `distanza=${insertionDistance}`);

        return {
            tipo: 'avvita',
            rotazione: {
                x: direction.x * -1800, // 5 giri completi inverso
                y: direction.y * -1800,
                z: direction.z * -1800,
                durata: 1.0
            },
            traslazione: {
                x: -direction.x * insertionDistance,
                y: -direction.y * insertionDistance,
                z: -direction.z * insertionDistance,
                durata: 1.0
            },
            durata: 2.0
        };
    },

    /**
     * Parse comando estrai (interno)
     * Formato: estrai o estrai(distanza)
     */
    _parseEstrai: function(operationString, modelFilename) {
        const direction = this.getModelDirection(modelFilename);

        let extractionDistance = 0.4; // Default
        const distanceMatch = operationString.match(/estrai\(([0-9.]+)\)/);
        if (distanceMatch) {
            extractionDistance = parseFloat(distanceMatch[1]);
            if (isNaN(extractionDistance) || extractionDistance < 0) {
                console.warn(`⚠️ Distanza estrai non valida: ${distanceMatch[1]}, uso default 0.4`);
                extractionDistance = 0.4;
            }
        }

        console.log(`🔄 ESTRAI per ${modelFilename}: direction=`, direction, `distanza=${extractionDistance}`);

        return {
            tipo: 'estrai',
            traslazione: {
                x: direction.x * extractionDistance,
                y: direction.y * extractionDistance,
                z: direction.z * extractionDistance,
                durata: 1.0
            },
            durata: 1.0
        };
    },

    /**
     * Parse comando inserisci (interno)
     * Formato: inserisci o inserisci(distanza)
     */
    _parseInserisci: function(operationString, modelFilename) {
        const direction = this.getModelDirection(modelFilename);

        let insertionDistance = 0.4; // Default
        const distanceMatch = operationString.match(/inserisci\(([0-9.]+)\)/);
        if (distanceMatch) {
            insertionDistance = parseFloat(distanceMatch[1]);
            if (isNaN(insertionDistance) || insertionDistance < 0) {
                console.warn(`⚠️ Distanza inserisci non valida: ${distanceMatch[1]}, uso default 0.4`);
                insertionDistance = 0.4;
            }
        }

        console.log(`🔄 INSERISCI per ${modelFilename}: direction=`, direction, `distanza=${insertionDistance}`);

        return {
            tipo: 'inserisci',
            traslazione: {
                x: -direction.x * insertionDistance,
                y: -direction.y * insertionDistance,
                z: -direction.z * insertionDistance,
                durata: 1.0
            },
            durata: 1.0
        };
    },

    /**
     * Parse comando appoggia (interno)
     * Formato: appoggia o appoggia(durata)
     */
    _parseAppoggia: function(operationString) {
        const matchWithParens = operationString.match(/appoggia\(([^)]+)\)/);
        const matchWithoutParens = operationString.match(/^appoggia$/);

        if (matchWithParens) {
            const durata = parseFloat(matchWithParens[1]);
            if (isNaN(durata)) {
                throw new Error(`Durata non valida in appoggia: ${operationString}`);
            }
            return { durata: durata };
        } else if (matchWithoutParens) {
            return { durata: 1.0 }; // Default
        } else {
            throw new Error(`Formato appoggia non valido: ${operationString}`);
        }
    },

    /**
     * Parse comando resetCenteredOriginal (interno)
     * Formato: resetCenteredOriginal o resetCenteredOriginal(durata)
     */
    _parseResetCenteredOriginal: function(operationString) {
        const matchWithParens = operationString.match(/resetCenteredOriginal\(([^)]+)\)/);
        const matchWithoutParens = operationString.match(/^resetCenteredOriginal$/);

        if (matchWithParens) {
            const durata = parseFloat(matchWithParens[1]);
            if (isNaN(durata)) {
                throw new Error(`Durata non valida in resetCenteredOriginal: ${operationString}`);
            }
            return {
                durata: durata,
                animated: true  // Se ha durata, usa animazione
            };
        } else if (matchWithoutParens) {
            return {
                durata: 0,
                animated: false // Reset immediato
            };
        } else {
            throw new Error(`Formato resetCenteredOriginal non valido: ${operationString}`);
        }
    },

    /**
     * Carica direzioni modelli da configurazione scenario
     * @param {Object} scenarioConfig - Configurazione scenario con array models
     */
    loadModelDirections: function(scenarioConfig) {
        // Per backward compatibility: scenario TEST hardcoded
        if (scenarioConfig && scenarioConfig.name === 'TEST') {
            this.modelDirections = {
                'tappino_grasso_dx': { x: -1, y: 0, z: 0 },
                'ingrassatore': { x: -1, y: 0, z: 0 },
                'tappino_grasso_sx': { x: -1, y: 0, z: 0 },
                'assi': { x: -1, y: 0, z: 0 },
                'vite_coperchio_1': { x: -1, y: 0, z: 0 }
            };
            return;
        }

        if (!scenarioConfig || !scenarioConfig.models) {
            return;
        }

        scenarioConfig.models.forEach(modelConfig => {
            if (modelConfig.model && modelConfig.direction) {
                const modelName = modelConfig.model.split('/').pop().replace('.glb', '');
                this.modelDirections[modelName] = modelConfig.direction;
            }
        });
    },

    /**
     * Ottieni direzione per modello da configurazione
     * @param {string} modelFilename - Nome file modello
     * @returns {Object} Direction vector {x, y, z}
     */
    getModelDirection: function(modelFilename) {
        if (!this.modelDirections) {
            this.modelDirections = {};
        }

        // Prova prima con nome completo, poi solo nome file
        const cleanName = modelFilename ? modelFilename.split('/').pop().replace('.glb', '') : '';

        if (modelFilename && this.modelDirections[modelFilename]) {
            console.log(`🧭 Using direction for ${modelFilename}:`, this.modelDirections[modelFilename]);
            return this.modelDirections[modelFilename];
        }

        if (cleanName && this.modelDirections[cleanName]) {
            console.log(`🧭 Using direction for ${cleanName}:`, this.modelDirections[cleanName]);
            return this.modelDirections[cleanName];
        }

        console.log(`⚠️ No direction found for ${modelFilename}, using default (0,0,1)`);
        // Default fallback direction
        return { x: 0, y: 0, z: 1 };
    }
};

// Export per compatibilità
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MovementParser;
}

console.log('📦 MovementParser module loaded');
