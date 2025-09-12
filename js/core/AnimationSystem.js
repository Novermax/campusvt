/**
 * ANIMATION SYSTEM MODULE
 * VERSION: 1000010 - Modular Architecture
 * 
 * Handles all model animations including single animations, multi-step sequences,
 * camera animations, and tutorial step management. Supports complex movement patterns
 * with custom rotation centers and target-based translations.
 */

export class AnimationSystem {
    constructor(modelManager, highlightSystem) {
        this.modelManager = modelManager;
        this.highlightSystem = highlightSystem;
        
        // Animation state
        this.activeAnimations = [];
        this.multiStepAnimations = new Map();
        this.clickEnabled = true;
        this.cameraAnimation = null;
        
        // Tutorial tracking
        this.tutorialTracker = {
            completedSteps: new Set(),
            lastStepCompleted: false
        };
    }

    /**
     * Handle model action when clicked
     */
    handleModelAction(model) {
        // Get current step to verify required tool
        const currentStep = this.getCurrentTutorialStep();
        const requiredTool = this.getRequiredToolForStep(currentStep);
        const activeTool = window.UI ? window.UI.getActiveTool() : null;
        
        console.log('🔧 Tool check - Required:', requiredTool, 'Active:', activeTool);
        
        // Remove highlighting ONLY if model is highlighted AND tool is correct
        if (this.highlightSystem.isHighlighting && 
            this.highlightSystem.highlightedModel === model) {
            
            if (requiredTool && activeTool === requiredTool) {
                AppConfig.log(2, '🔴✅ Removing highlight: correct tool active');
                this.highlightSystem.removeHighlight();
            } else {
                AppConfig.log(2, '🔴❌ Keeping highlight: wrong or missing tool');
                console.log(`🔧 Required tool: "${requiredTool}", active tool: "${activeTool}"`);
                return;
            }
        }
        
        // Verify correct tool is active
        if (!requiredTool || activeTool !== requiredTool) {
            AppConfig.log(2, `🖱️ Click ignored: tool "${requiredTool}" required, but "${activeTool}" active`);
            return;
        }
        
        if (!currentStep) {
            AppConfig.log(2, '🖱️ Click ignored: no active tutorial step');
            return;
        }
        
        // Verify model corresponds to step element
        const modelFilename = model.userData?.originalFilename || model.name;
        const stepElement = currentStep.properties.Elemento;
        
        console.log(`🔍 CHECK STEP: Clicked model "${modelFilename}", Current step: ${window.UI.currentStepIndex + 1}, Step element: "${stepElement}"`);
        console.log(`🔍 CHECK STEP: Step properties:`, currentStep.properties);
        
        // Maintain sequence control: only current step element
        if (!stepElement || !modelFilename.includes(stepElement.replace('.glb', ''))) {
            AppConfig.log(2, `🖱️ Click ignored: model "${modelFilename}" doesn't match element "${stepElement}" for step ${window.UI.currentStepIndex + 1}`);
            return;
        }
        
        // Check if it's last step and already completed
        const isLastStep = this.isLastTutorialStep(window.UI.currentStepIndex);
        if (isLastStep && this.tutorialTracker.lastStepCompleted) {
            AppConfig.log(2, '🏁 Last step already completed - action blocked');
            console.log('🏁 Tutorial completed - no additional action permitted');
            return;
        }
        
        // Allow multiple animations of same element type
        // Only prevent clicking on the SAME model, not others of same type
        console.log(`🔍 MULTI-ANIM: Checking model ${modelFilename}, object ID:`, model.id || model.uuid);
        console.log(`🔍 MULTI-ANIM: Active animations:`, this.activeAnimations.length);
        console.log(`🔍 MULTI-ANIM: Models in animation:`, this.activeAnimations.map(a => ({
            name: a.model?.userData?.originalFilename || a.model?.name,
            id: a.model?.id || a.model?.uuid
        })));
        
        if (this.isModelAnimating(model)) {
            AppConfig.log(2, `🖱️ This specific model "${modelFilename}" (ID: ${model.id || model.uuid}) is already animating`);
            return;
        }
        
        // If we get here, it's a valid element for current step and not already animating
        console.log(`✅ MULTI-ANIM: Authorized animation start for ${modelFilename}`);
        
        // Execute animation
        AppConfig.log(2, `🎬 Starting animation for: ${modelFilename}`);
        this.startModelAnimation(model, currentStep);
    }

    /**
     * Start animation for a model based on tutorial step
     */
    startModelAnimation(model, tutorialStep) {
        const modelFilename = model.userData?.originalFilename || model.name;
        console.log(`🎬 DEBUG startModelAnimation for: "${modelFilename}"`);
        console.log(`🎬 Tutorial step:`, tutorialStep);
        
        // Apply camera settings if present
        this.applyCameraSettings(tutorialStep);
        
        // Check if there are multi-step movements defined
        const movementSteps = this.parseMovementSteps(tutorialStep);
        if (movementSteps.length > 0) {
            console.log(`🎬 MULTI-STEP: Found ${movementSteps.length} sub-steps, starting multi-step sequence`);
            return this.startMultiStepMovement(model, movementSteps);
        }
        
        // Otherwise use traditional animation system
        console.log(`🎬 LEGACY: No sub-steps found, using traditional animation`);
        console.log(`🎬 Stored directions:`, this.modelManager.getAllModelDirections());
        console.log(`🎬 Specific direction for "${modelFilename}":`, this.modelManager.getModelDirection(modelFilename));
        
        const direction = this.modelManager.getModelDirection(modelFilename);
        console.log(`🎬 Direction to use:`, direction);
        
        if (!direction) {
            console.log(`❌ No direction configured for "${modelFilename}"`);
            console.log(`❌ Available keys:`, Object.keys(this.modelManager.getAllModelDirections()));
            AppConfig.log(1, `❌ No direction configured for ${modelFilename}`);
            return;
        }
        
        const action = tutorialStep.properties.Azione;
        if (!action) {
            AppConfig.log(1, `❌ No action specified in step`);
            return;
        }
        
        // Use direct model animation
        let targetModel = model;
        let modelCenter = null;
        
        // Calculate center for debug but don't create Groups
        if (action.toLowerCase() === 'svita' || action.toLowerCase() === 'avvita') {
            modelCenter = this.calculateModelCenter(model);
            console.log(`📐 Model center calculated for ${model.userData?.originalFilename}: (${modelCenter.x.toFixed(3)}, ${modelCenter.y.toFixed(3)}, ${modelCenter.z.toFixed(3)})`);
        }
        
        console.log(`📐 Using direct model animation for ${model.userData?.originalFilename} (action: ${action})`);
        console.log(`📐 Model current position: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
        
        // Create animation configuration
        let defaultDuration = (action.toLowerCase() === 'svita' || action.toLowerCase() === 'avvita') ? 4.5 : 2.5;
        const customDuration = parseFloat(tutorialStep.properties.Durata);
        const duration = customDuration || defaultDuration;
        
        if (customDuration) {
            console.log(`⏱️ DURATION: Custom override ${customDuration}s (default was ${defaultDuration}s)`);
        } else {
            console.log(`⏱️ DURATION: Default ${duration}s for action ${action}`);
        }
        
        const animConfig = {
            model: targetModel,
            originalModel: model,
            action: action,
            direction: new THREE.Vector3(direction.x, direction.y, direction.z),
            duration: duration,
            startTime: performance.now(),
            initialPosition: targetModel.position.clone(),
            initialRotation: targetModel.rotation.clone(),
            modelCenter: modelCenter,
            targetPosition: null,
            targetRotation: null,
            finished: false
        };
        
        // Calculate target positions and rotations based on action
        this.calculateAnimationTargets(animConfig, tutorialStep);
        
        // Add to active animations array
        this.activeAnimations.push(animConfig);
        
        AppConfig.log(2, `🎬 Animation started: ${action} for ${modelFilename}`, {
            direction: direction,
            duration: animConfig.duration,
            initialPos: animConfig.initialPosition,
            targetPos: animConfig.targetPosition
        });
    }

    /**
     * Calculate target positions and rotations for animation
     */
    calculateAnimationTargets(animConfig, tutorialStep) {
        const { action, direction, initialPosition, initialRotation } = animConfig;
        const movementDistance = parseFloat(tutorialStep.properties.Distanza) || 1.5;
        
        console.log(`🎯 calculateAnimationTargets - Action: ${action}`);
        console.log(`🎯 Direction vector:`, direction);
        console.log(`🎯 Initial position:`, initialPosition);
        console.log(`🎯 Movement distance:`, movementDistance);
        
        let targetPosition;
        let targetRotation = initialRotation.clone();
        
        switch (action.toLowerCase()) {
            case 'estrai':
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(movementDistance));
                break;
                
            case 'inserisci':
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(-movementDistance));
                break;
                
            case 'svita':
                const movement = direction.clone().multiplyScalar(movementDistance);
                targetPosition = initialPosition.clone().add(movement);
                
                console.log(`🎯 SVITA - Movement vector:`, movement);
                console.log(`🎯 SVITA - Target position:`, targetPosition);
                console.log(`🎯 SVITA - Direction:`, direction);
                console.log(`🎯 SVITA - About to call applyRotationBasedOnDirection...`);
                
                this.applyRotationBasedOnDirection(targetRotation, direction, -Math.PI * 6);
                console.log(`🎯 SVITA - applyRotationBasedOnDirection completed!`);
                break;
                
            case 'avvita':
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(-movementDistance));
                
                console.log(`🎯 AVVITA - Direction:`, direction);
                console.log(`🎯 AVVITA - About to call applyRotationBasedOnDirection...`);
                
                this.applyRotationBasedOnDirection(targetRotation, direction, Math.PI * 6);
                console.log(`🎯 AVVITA - applyRotationBasedOnDirection completed!`);
                break;
                
            default:
                AppConfig.log(1, `❌ Unrecognized action: ${action}`);
                targetPosition = initialPosition.clone();
                break;
        }
        
        animConfig.targetPosition = targetPosition;
        animConfig.targetRotation = targetRotation;
    }

    /**
     * Apply rotation based on movement direction
     */
    applyRotationBasedOnDirection(targetRotation, direction, rotationAmount) {
        const normalizedDir = direction.clone().normalize();
        
        const absX = Math.abs(normalizedDir.x);
        const absY = Math.abs(normalizedDir.y);
        const absZ = Math.abs(normalizedDir.z);
        
        console.log(`🔄 Direction analysis: X=${normalizedDir.x.toFixed(2)}, Y=${normalizedDir.y.toFixed(2)}, Z=${normalizedDir.z.toFixed(2)}`);
        console.log(`🔄 Abs values: absX=${absX.toFixed(2)}, absY=${absY.toFixed(2)}, absZ=${absZ.toFixed(2)}`);
        console.log(`🔄 Rotation amount: ${rotationAmount} rad = ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
        
        console.log(`🔄 Initial rotation: X=${targetRotation.x.toFixed(2)}, Y=${targetRotation.y.toFixed(2)}, Z=${targetRotation.z.toFixed(2)}`);
        
        // Apply rotation to main movement axis
        if (absX > absY && absX > absZ) {
            targetRotation.x += rotationAmount;
            console.log(`🔄 ✅ Rotating around X axis: ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
            console.log(`🔄 Final rotation X: ${targetRotation.x.toFixed(2)} rad = ${(targetRotation.x * 180 / Math.PI).toFixed(0)}°`);
        } else if (absY > absX && absY > absZ) {
            targetRotation.y += rotationAmount;
            console.log(`🔄 ✅ Rotating around Y axis: ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
            console.log(`🔄 Final rotation Y: ${targetRotation.y.toFixed(2)} rad = ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
        } else {
            targetRotation.z += rotationAmount;
            console.log(`🔄 ✅ Rotating around Z axis: ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
            console.log(`🔄 Final rotation Z: ${targetRotation.z.toFixed(2)} rad = ${(targetRotation * 180 / Math.PI).toFixed(0)}°`);
        }
        
        console.log(`🔄 Final target rotation: X=${targetRotation.x.toFixed(2)}, Y=${targetRotation.y.toFixed(2)}, Z=${targetRotation.z.toFixed(2)}`);
    }

    /**
     * Calculate geometric center of 3D model in local coordinates
     */
    calculateModelCenter(model) {
        const originalPosition = model.position.clone();
        
        // Temporarily move model to origin to calculate local center
        model.position.set(0, 0, 0);
        
        const boundingBox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // Restore original position
        model.position.copy(originalPosition);
        
        console.log(`📐 Local center for ${model.userData?.originalFilename}: `, center);
        console.log(`📐 Model position: `, model.position);
        
        return center;
    }

    /* ===== CAMERA ANIMATION SYSTEM ===== */

    /**
     * Apply camera settings from tutorial step
     */
    applyCameraSettings(tutorialStep) {
        if (!tutorialStep.properties) return;
        
        const props = tutorialStep.properties;
        let cameraChanged = false;
        
        // Check if there are actually camera parameters in this step
        const hasCameraSettings = props.CameraPos || props.CameraTarget || props.CameraZoom || props.CameraTransitionTime;
        if (!hasCameraSettings) {
            console.log(`📹 CAMERA: No camera parameters in step, camera stays still`);
            return;
        }
        
        // Parse CameraPos=(x, y, z) or CameraPos=element.glb:(x, y, z)
        if (props.CameraPos) {
            let targetPosition = null;
            
            // Check if it's relative element:offset format
            if (props.CameraPos.includes(':')) {
                const [elementName, offsetString] = props.CameraPos.split(':').map(s => s.trim());
                const offsetMatch = offsetString.match(/\(([^)]+)\)/);
                
                if (offsetMatch) {
                    const offsetCoords = offsetMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (offsetCoords.length === 3) {
                        const elementCenter = this.modelManager.getElementCenter(elementName);
                        if (elementCenter) {
                            targetPosition = new THREE.Vector3(
                                elementCenter.x + offsetCoords[0],
                                elementCenter.y + offsetCoords[1],
                                elementCenter.z + offsetCoords[2]
                            );
                            console.log(`📹 CAMERA: Position relative to "${elementName}" + offset(${offsetCoords[0]}, ${offsetCoords[1]}, ${offsetCoords[2]}) = (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);
                        } else {
                            console.log(`⚠️ CAMERA: Element "${elementName}" not found for relative position, using absolute coordinates`);
                        }
                    }
                }
            } else {
                // Standard absolute coordinates format (x, y, z)
                const posMatch = props.CameraPos.match(/\(([^)]+)\)/);
                if (posMatch) {
                    const coords = posMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (coords.length === 3) {
                        targetPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
                        console.log(`📹 CAMERA: Absolute position (${targetPosition.x}, ${targetPosition.y}, ${targetPosition.z})`);
                    }
                }
            }
            
            if (targetPosition) {
                cameraChanged = true;
                this.cameraAnimation = this.cameraAnimation || {};
                this.cameraAnimation.targetPosition = targetPosition;
            }
        }
        
        // Parse CameraTarget=(x, y, z) or CameraTarget=element.glb
        if (props.CameraTarget) {
            let targetLookAt = null;
            
            const coordMatch = props.CameraTarget.match(/\(([^)]+)\)/);
            if (coordMatch) {
                const coords = coordMatch[1].split(',').map(v => parseFloat(v.trim()));
                if (coords.length === 3) {
                    targetLookAt = new THREE.Vector3(coords[0], coords[1], coords[2]);
                    console.log(`📹 CAMERA: New target coordinates ${targetLookAt.x}, ${targetLookAt.y}, ${targetLookAt.z}`);
                }
            } else {
                const elementName = props.CameraTarget.trim();
                targetLookAt = this.modelManager.getElementCenter(elementName);
                if (targetLookAt) {
                    console.log(`📹 CAMERA: New target element "${elementName}" center=(${targetLookAt.x.toFixed(3)}, ${targetLookAt.y.toFixed(3)}, ${targetLookAt.z.toFixed(3)})`);
                } else {
                    console.log(`⚠️ CAMERA: Element "${elementName}" not found, using current target`);
                }
            }
            
            if (targetLookAt) {
                cameraChanged = true;
                this.cameraAnimation = this.cameraAnimation || {};
                this.cameraAnimation.targetLookAt = targetLookAt;
            }
        }
        
        // Parse CameraZoom
        if (props.CameraZoom) {
            const zoom = parseFloat(props.CameraZoom);
            if (!isNaN(zoom)) {
                console.log(`📹 CAMERA: New zoom ${zoom}`);
                cameraChanged = true;
                
                this.cameraAnimation = this.cameraAnimation || {};
                this.cameraAnimation.targetZoom = zoom;
            }
        }
        
        // Parse CameraTransitionTime
        let transitionTime = 1.0; // Default
        if (props.CameraTransitionTime) {
            const time = parseFloat(props.CameraTransitionTime);
            if (!isNaN(time)) {
                transitionTime = time;
            }
        }
        
        // If there's at least one camera parameter, start animation
        if (cameraChanged) {
            this.animateCamera(transitionTime);
        }
    }

    /**
     * Animate camera to target position
     */
    animateCamera(duration) {
        if (!this.cameraAnimation) return;
        
        // This would need camera reference - simplified for modular approach
        console.log(`📹 CAMERA: Animation would start (duration: ${duration}s)`);
        console.log(`📹 CAMERA: Target settings:`, this.cameraAnimation);
        
        // Clear camera animation data
        this.cameraAnimation = null;
    }

    /* ===== MULTI-STEP ANIMATION SYSTEM ===== */

    /**
     * Parse movement sub-steps from tutorial step
     */
    parseMovementSteps(tutorialStep) {
        const movementSteps = [];
        let stepIndex = 1;
        
        while (tutorialStep.properties[`MovimentoStep${stepIndex}`]) {
            const stepString = tutorialStep.properties[`MovimentoStep${stepIndex}`];
            const parsedStep = this.parseMovementStepString(stepString, stepIndex);
            
            if (parsedStep) {
                movementSteps.push(parsedStep);
                console.log(`🎬 MULTI-STEP: Parsed step ${stepIndex}:`, parsedStep);
            }
            
            stepIndex++;
        }
        
        console.log(`🎬 MULTI-STEP: Total ${movementSteps.length} sub-steps found`);
        return movementSteps;
    }

    /**
     * Parse movement step string
     * Format: "rotazione:(x,y,z,duration);traslazione:(x,y,z,duration)"
     */
    parseMovementStepString(stepString, stepIndex) {
        try {
            const step = {
                index: stepIndex,
                rotazione: null,
                traslazione: null,
                centro: null,
                durata: 1.0
            };
            
            const operations = stepString.split(';');
            
            for (const operation of operations) {
                const trimmed = operation.trim();
                
                if (trimmed.startsWith('rotazione:')) {
                    step.rotazione = this.parseMovementOperation(trimmed, 'rotazione');
                } else if (trimmed.startsWith('traslazione:')) {
                    step.traslazione = this.parseMovementOperation(trimmed, 'traslazione');
                } else if (trimmed.startsWith('centro:')) {
                    step.centro = this.parseMovementOperation(trimmed, 'centro');
                }
            }
            
            // Duration is max between rotation and translation (for parallelism)
            if (step.rotazione && step.traslazione) {
                step.durata = Math.max(step.rotazione.durata, step.traslazione.durata);
            } else if (step.rotazione) {
                step.durata = step.rotazione.durata;
            } else if (step.traslazione) {
                step.durata = step.traslazione.durata;
            }
            
            return step;
            
        } catch (error) {
            console.error(`❌ Error parsing MovimentoStep${stepIndex}:`, error);
            return null;
        }
    }

    /**
     * Parse single movement operation
     */
    parseMovementOperation(operationString, type) {
        // Handle translation to target element (including _original references)
        if (type === 'traslazione' && operationString.includes(':') && !operationString.match(/^traslazione:\(/)) {
            const colonIndex = operationString.indexOf(':');
            const afterColon = operationString.substring(colonIndex + 1);
            
            let targetElement = null;
            let offsetValues = null;
            let isOriginalReference = false;
            
            if (afterColon.includes(',')) {
                const commaIndex = afterColon.indexOf(',');
                targetElement = afterColon.substring(0, commaIndex).trim();
                const offsetPart = afterColon.substring(commaIndex + 1);
                
                const offsetMatch = offsetPart.match(/\(([^)]+)\)/);
                if (offsetMatch) {
                    offsetValues = offsetMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (offsetValues.length !== 4) {
                        throw new Error(`Translation offset to target must have 4 values (x,y,z,duration): ${operationString}`);
                    }
                } else {
                    throw new Error(`Invalid offset format in translation to target: ${operationString}`);
                }
            } else {
                targetElement = afterColon.trim();
                offsetValues = [0, 0, 0, 1.0]; // Default: no offset, 1s duration
            }
            
            // Check if this is a reference to original position
            isOriginalReference = targetElement.endsWith('_original');
            
            if (isOriginalReference) {
                console.log(`🎯 TRANSLATION: To ORIGINAL position of "${targetElement}" with offset (${offsetValues[0]}, ${offsetValues[1]}, ${offsetValues[2]}) duration ${offsetValues[3]}s`);
            } else {
                console.log(`🎯 TRANSLATION: To element "${targetElement}" with offset (${offsetValues[0]}, ${offsetValues[1]}, ${offsetValues[2]}) duration ${offsetValues[3]}s`);
            }
            
            return {
                x: offsetValues[0],
                y: offsetValues[1],
                z: offsetValues[2], 
                durata: offsetValues[3],
                targetElement: targetElement,
                isOriginalReference: isOriginalReference
            };
        }
        
        // Standard handling for rotation, center, and relative translation
        const match = operationString.match(/\(([^)]+)\)/);
        if (!match) {
            throw new Error(`Invalid ${type} format: ${operationString}`);
        }
        
        const values = match[1].split(',').map(v => parseFloat(v.trim()));
        
        // Centro command has only 3 parameters (x,y,z relative), no duration
        if (type === 'centro') {
            if (values.length !== 3) {
                throw new Error(`${type} must have 3 values (x,y,z): ${operationString}`);
            }
            return {
                x: values[0],
                y: values[1], 
                z: values[2]
            };
        } else {
            // Rotation and translation have 4 parameters (x,y,z,duration)
            if (values.length !== 4) {
                throw new Error(`${type} must have 4 values (x,y,z,duration): ${operationString}`);
            }
            return {
                x: values[0],
                y: values[1], 
                z: values[2],
                durata: values[3]
            };
        }
    }

    /**
     * Start multi-step movement sequence for a model
     */
    startMultiStepMovement(model, movementSteps) {
        if (!movementSteps || movementSteps.length === 0) {
            console.log('🎬 MULTI-STEP: No movement sub-steps defined');
            return false;
        }
        
        const modelUuid = model.uuid;
        const modelName = model.userData?.originalFilename || model.name;
        
        console.log(`🎬 MULTI-STEP: Starting ${movementSteps.length} step sequence for ${modelName}`);
        
        // Save sequence in map
        this.multiStepAnimations.set(modelUuid, {
            model: model,
            steps: movementSteps,
            currentStepIndex: 0,
            isActive: true,
            modelName: modelName
        });
        
        // Start first step
        this.executeCurrentMultiStep(modelUuid);
        return true;
    }

    /**
     * Execute current step of multi-step movement
     */
    executeCurrentMultiStep(modelUuid) {
        const multiStepData = this.multiStepAnimations.get(modelUuid);
        if (!multiStepData || !multiStepData.isActive) {
            return;
        }
        
        const currentStep = multiStepData.steps[multiStepData.currentStepIndex];
        if (!currentStep) {
            console.log(`🎬 MULTI-STEP: Sequence completed for ${multiStepData.modelName}`);
            this.finishMultiStepMovement(modelUuid);
            return;
        }
        
        console.log(`🎬 MULTI-STEP: Executing step ${multiStepData.currentStepIndex + 1}/${multiStepData.steps.length} for ${multiStepData.modelName}`);
        console.log(`🎬 MULTI-STEP: Step data:`, currentStep);
        
        const model = multiStepData.model;
        
        // Calculate initial and final positions/rotations
        const initialPosition = model.position.clone();
        const initialRotation = new THREE.Euler().copy(model.rotation);
        
        let targetPosition = initialPosition.clone();
        let targetRotation = new THREE.Euler().copy(initialRotation);
        
        // Apply translation if present
        if (currentStep.traslazione) {
            // Translation to target element (including _original references)
            if (currentStep.traslazione.targetElement) {
                let targetCenter = null;
                
                // Handle _original references using Scene3D system
                if (currentStep.traslazione.isOriginalReference && window.Scene3D) {
                    const originalRef = window.Scene3D.findModelByName(currentStep.traslazione.targetElement);
                    if (originalRef && originalRef.position) {
                        targetCenter = originalRef.position.clone();
                        console.log(`🎯 ORIGINAL REF: Found original position for "${currentStep.traslazione.targetElement}": (${targetCenter.x.toFixed(3)}, ${targetCenter.y.toFixed(3)}, ${targetCenter.z.toFixed(3)})`);
                    } else {
                        console.log(`⚠️ ORIGINAL REF: Could not find original reference for "${currentStep.traslazione.targetElement}"`);
                    }
                } else {
                    // Standard target element lookup
                    targetCenter = this.modelManager.getElementCenter(currentStep.traslazione.targetElement);
                }
                
                if (targetCenter) {
                    console.log(`🎯 ALIGNMENT DEBUG: Moving element: "${model.userData?.originalFilename || model.name}"`);
                    console.log(`🎯 ALIGNMENT DEBUG: Current position: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
                    
                    if (currentStep.traslazione.isOriginalReference) {
                        console.log(`🎯 ALIGNMENT DEBUG: Target ORIGINAL position "${currentStep.traslazione.targetElement}": (${targetCenter.x.toFixed(3)}, ${targetCenter.y.toFixed(3)}, ${targetCenter.z.toFixed(3)})`);
                    } else {
                        console.log(`🎯 ALIGNMENT DEBUG: Target center "${currentStep.traslazione.targetElement}": (${targetCenter.x.toFixed(3)}, ${targetCenter.y.toFixed(3)}, ${targetCenter.z.toFixed(3)})`);
                    }
                    
                    console.log(`🎯 ALIGNMENT DEBUG: Required offset: (${currentStep.traslazione.x.toFixed(3)}, ${currentStep.traslazione.y.toFixed(3)}, ${currentStep.traslazione.z.toFixed(3)})`);
                    
                    // Move to target center + offset
                    targetPosition = new THREE.Vector3(
                        targetCenter.x + currentStep.traslazione.x,
                        targetCenter.y + currentStep.traslazione.y,
                        targetCenter.z + currentStep.traslazione.z
                    );
                    console.log(`🎯 ALIGNMENT DEBUG: Calculated final position: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);
                    
                    const distance = model.position.distanceTo(targetPosition);
                    console.log(`🎯 ALIGNMENT DEBUG: Distance to travel: ${distance.toFixed(3)} units`);
                } else {
                    console.log(`⚠️ MULTI-STEP: Target "${currentStep.traslazione.targetElement}" not found, using relative movement`);
                    // Fallback: normal relative movement
                    targetPosition.add(new THREE.Vector3(
                        currentStep.traslazione.x,
                        currentStep.traslazione.y,
                        currentStep.traslazione.z
                    ));
                }
            } else {
                // Standard relative translation
                targetPosition.add(new THREE.Vector3(
                    currentStep.traslazione.x,
                    currentStep.traslazione.y,
                    currentStep.traslazione.z
                ));
            }
        }
        
        // Calculate rotation center (if specified)
        let rotationCenter = null;
        if (currentStep.rotazione && currentStep.centro) {
            rotationCenter = this.calculateRelativeRotationCenter(model, currentStep.centro);
        }
        
        // Apply rotation if present (degrees -> radians)
        if (currentStep.rotazione) {
            targetRotation.x += THREE.MathUtils.degToRad(currentStep.rotazione.x);
            targetRotation.y += THREE.MathUtils.degToRad(currentStep.rotazione.y);
            targetRotation.z += THREE.MathUtils.degToRad(currentStep.rotazione.z);
        }
        
        // Create animation with step duration
        const animation = {
            model: model,
            modelUuid: modelUuid,
            stepIndex: multiStepData.currentStepIndex,
            
            // Position
            initialPosition: initialPosition,
            targetPosition: targetPosition,
            
            // Rotation
            initialRotation: initialRotation,
            targetRotation: targetRotation,
            rotationCenter: rotationCenter,
            
            // Timing
            startTime: performance.now(),
            duration: currentStep.durata,
            
            // Flags
            finished: false,
            isMultiStep: true,
            
            // Debug
            action: `MultiStep-${multiStepData.currentStepIndex + 1}`
        };
        
        // Add to active animations array
        this.activeAnimations.push(animation);
        
        console.log(`🎬 MULTI-STEP: Step ${multiStepData.currentStepIndex + 1} animation started (duration: ${currentStep.durata}s)`);
    }

    /**
     * Calculate relative rotation center
     */
    calculateRelativeRotationCenter(model, relativeCenter) {
        if (!relativeCenter) {
            const box = new THREE.Box3().setFromObject(model);
            return box.getCenter(new THREE.Vector3());
        }
        
        const boundingBox = new THREE.Box3().setFromObject(model);
        const objectCenter = boundingBox.getCenter(new THREE.Vector3());
        const objectSize = boundingBox.getSize(new THREE.Vector3());
        
        const absoluteCenter = new THREE.Vector3(
            objectCenter.x + (relativeCenter.x * objectSize.x),
            objectCenter.y + (relativeCenter.y * objectSize.y), 
            objectCenter.z + (relativeCenter.z * objectSize.z)
        );
        
        console.log(`🎯 CENTER: Object center=(${objectCenter.x.toFixed(3)}, ${objectCenter.y.toFixed(3)}, ${objectCenter.z.toFixed(3)})`);
        console.log(`🎯 CENTER: Object size=(${objectSize.x.toFixed(3)}, ${objectSize.y.toFixed(3)}, ${objectSize.z.toFixed(3)})`);
        console.log(`🎯 CENTER: Relative=(${relativeCenter.x}, ${relativeCenter.y}, ${relativeCenter.z})`);
        console.log(`🎯 CENTER: Absolute=(${absoluteCenter.x.toFixed(3)}, ${absoluteCenter.y.toFixed(3)}, ${absoluteCenter.z.toFixed(3)})`);
        
        return absoluteCenter;
    }

    /**
     * Called when multi-step movement is completed
     */
    onMultiStepCompleted(modelUuid) {
        const multiStepData = this.multiStepAnimations.get(modelUuid);
        if (!multiStepData || !multiStepData.isActive) {
            return;
        }
        
        // Advance to next step
        multiStepData.currentStepIndex++;
        
        console.log(`🎬 MULTI-STEP: Step ${multiStepData.currentStepIndex}/${multiStepData.steps.length} completed for ${multiStepData.modelName}`);
        
        // Small pause before next step (optional)
        setTimeout(() => {
            this.executeCurrentMultiStep(modelUuid);
        }, 100);
    }

    /**
     * Finish multi-step sequence
     */
    finishMultiStepMovement(modelUuid) {
        const multiStepData = this.multiStepAnimations.get(modelUuid);
        if (multiStepData) {
            console.log(`🎬 MULTI-STEP: ✅ Sequence completed for ${multiStepData.modelName}`);
            this.multiStepAnimations.delete(modelUuid);
            
            // Mark tutorial step as completed
            if (window.UI && window.UI.currentStepIndex !== undefined && window.UI.currentStepIndex >= 0) {
                this.markStepAsCompleted(window.UI.currentStepIndex);
            }
            
            // Auto-advance to next tutorial step
            this.advanceToNextTutorialStep();
        }
    }

    /* ===== ANIMATION UPDATE LOOP ===== */

    /**
     * Update all active animations (called in render loop)
     */
    updateAnimations() {
        if (this.activeAnimations.length === 0) return;
        
        const currentTime = performance.now();
        
        // Update each animation
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.activeAnimations[i];
            
            if (anim.finished) {
                this.activeAnimations.splice(i, 1);
                continue;
            }
            
            const elapsed = (currentTime - anim.startTime) / 1000;
            let progress;
            
            // Camera animation (duration in ms)
            if (anim.isCamera) {
                progress = Math.min(elapsed / (anim.duration / 1000), 1.0);
                progress = this.smootherStep(progress);
                // Camera animation update would go here
            } 
            // Model animations (duration in seconds)
            else {
                progress = Math.min(elapsed / anim.duration, 1.0);
                progress = this.smoothStep(progress);
                
                // Position interpolation
                if (anim.targetPosition) {
                    anim.model.position.lerpVectors(anim.initialPosition, anim.targetPosition, progress);
                }
                
                // Rotation interpolation
                if (anim.targetRotation) {
                    // Multi-step with custom center
                    if (anim.isMultiStep && anim.rotationCenter) {
                        this.applyRotationAroundCustomCenter(anim, progress);
                    }
                    // For actions with rotation (svita/avvita) use rotation around geometric center
                    else if (anim.action === 'svita' || anim.action === 'avvita') {
                        this.applyRotationAroundCenter(anim, progress);
                    } else {
                        // For other actions use slerp for smoother interpolation
                        const tempQuaternion1 = new THREE.Quaternion().setFromEuler(anim.initialRotation);
                        const tempQuaternion2 = new THREE.Quaternion().setFromEuler(anim.targetRotation);
                        const resultQuaternion = tempQuaternion1.slerp(tempQuaternion2, progress);
                        anim.model.setRotationFromQuaternion(resultQuaternion);
                    }
                }
            }
            
            // Mark as completed if reached 100%
            if (progress >= 1.0) {
                anim.finished = true;
                
                if (anim.isCamera) {
                    console.log('📹 CAMERA: Camera animation completed');
                } else {
                    const modelName = anim.model?.userData?.originalFilename || anim.model?.name || 'Unknown';
                    AppConfig.log(2, `✅ Animation completed: ${anim.action} for ${modelName}`);
                    
                    if (anim.isMultiStep) {
                        this.onMultiStepCompleted(anim.modelUuid);
                    } else {
                        if (window.UI && window.UI.currentStepIndex !== undefined && window.UI.currentStepIndex >= 0) {
                            this.markStepAsCompleted(window.UI.currentStepIndex);
                        }
                        this.advanceToNextTutorialStep();
                    }
                }
            }
        }
    }

    /**
     * Apply rotation around custom center
     */
    applyRotationAroundCustomCenter(anim, progress) {
        const currentRotation = new THREE.Euler(
            anim.initialRotation.x + (anim.targetRotation.x - anim.initialRotation.x) * progress,
            anim.initialRotation.y + (anim.targetRotation.y - anim.initialRotation.y) * progress,
            anim.initialRotation.z + (anim.targetRotation.z - anim.initialRotation.z) * progress
        );
        
        const pivotCenter = anim.rotationCenter;
        
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(-pivotCenter.x, -pivotCenter.y, -pivotCenter.z);
        
        const deltaRotation = new THREE.Euler(
            currentRotation.x - anim.initialRotation.x,
            currentRotation.y - anim.initialRotation.y,
            currentRotation.z - anim.initialRotation.z
        );
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(deltaRotation);
        matrix.premultiply(rotationMatrix);
        
        const translateBack = new THREE.Matrix4();
        translateBack.makeTranslation(pivotCenter.x, pivotCenter.y, pivotCenter.z);
        matrix.premultiply(translateBack);
        
        const rotatedPosition = anim.initialPosition.clone();
        rotatedPosition.applyMatrix4(matrix);
        
        if (anim.targetPosition && !anim.initialPosition.equals(anim.targetPosition)) {
            const translationOffset = new THREE.Vector3()
                .subVectors(anim.targetPosition, anim.initialPosition)
                .multiplyScalar(progress);
            rotatedPosition.add(translationOffset);
        }
        
        anim.model.position.copy(rotatedPosition);
        anim.model.rotation.copy(currentRotation);
    }

    /**
     * Apply rotation around geometric center  
     */
    applyRotationAroundCenter(anim, progress) {
        const currentRotation = new THREE.Euler(
            anim.initialRotation.x + (anim.targetRotation.x - anim.initialRotation.x) * progress,
            anim.initialRotation.y + (anim.targetRotation.y - anim.initialRotation.y) * progress,
            anim.initialRotation.z + (anim.targetRotation.z - anim.initialRotation.z) * progress
        );
        
        const linearMovement = new THREE.Vector3().lerpVectors(anim.initialPosition, anim.targetPosition, progress);
        
        if (anim.modelCenter && anim.modelCenter.length() > 0.001) {
            const pivot = anim.modelCenter;
            
            const matrix = new THREE.Matrix4();
            matrix.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
            
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationFromEuler(currentRotation);
            matrix.premultiply(rotationMatrix);
            
            const translateBack = new THREE.Matrix4();
            translateBack.makeTranslation(pivot.x, pivot.y, pivot.z);
            matrix.premultiply(translateBack);
            
            const transformedPosition = anim.initialPosition.clone();
            transformedPosition.applyMatrix4(matrix);
            
            const finalPosition = linearMovement.clone();
            const offset = transformedPosition.clone().sub(anim.initialPosition);
            finalPosition.add(offset);
            
            anim.model.position.copy(finalPosition);
            anim.model.rotation.copy(currentRotation);
        } else {
            anim.model.rotation.copy(currentRotation);
            anim.model.position.copy(linearMovement);
        }
    }

    /* ===== EASING FUNCTIONS ===== */

    /**
     * Smooth step easing function
     */
    smoothStep(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    }

    /**
     * Smoother step easing function for camera
     */
    smootherStep(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    /* ===== TUTORIAL MANAGEMENT ===== */

    /**
     * Get current tutorial step
     */
    getCurrentTutorialStep() {
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex === undefined || window.UI.currentStepIndex < 0) {
            return null;
        }
        
        const stepIndex = window.UI.currentStepIndex;
        return window.UI.tutorialSteps[stepIndex] || null;
    }

    /**
     * Get required tool for step
     */
    getRequiredToolForStep(step) {
        if (!step || !step.properties) {
            return null;
        }
        
        if (step.properties.Utensile) {
            const toolMapping = {
                'ChiaveBrugola': 'brugola',
                'ChiaveInglese': 'chiave_inglese',
                'Mani': 'mano',
                'Aria': 'aria'
            };
            
            const mappedTool = toolMapping[step.properties.Utensile];
            console.log(`🔧 Tool mapping: "${step.properties.Utensile}" -> "${mappedTool}"`);
            return mappedTool || null;
        }
        
        return 'mano';
    }

    /**
     * Check if step index is last tutorial step
     */
    isLastTutorialStep(stepIndex) {
        if (!window.UI || !window.UI.tutorialSteps) {
            return false;
        }
        
        return stepIndex === (window.UI.tutorialSteps.length - 1);
    }

    /**
     * Mark step as completed
     */
    markStepAsCompleted(stepIndex) {
        this.tutorialTracker.completedSteps.add(stepIndex);
        
        if (this.isLastTutorialStep(stepIndex)) {
            this.tutorialTracker.lastStepCompleted = true;
            console.log('🏁 TUTORIAL COMPLETED - Last step executed');
            AppConfig.log(2, '🏁 Tutorial completed successfully');
            
            if (this.highlightSystem.isHighlighting) {
                this.highlightSystem.removeHighlight();
            }
        }
        
        console.log(`✅ Step ${stepIndex + 1} marked as completed`);
        console.log(`📊 Completed steps: ${Array.from(this.tutorialTracker.completedSteps).map(i => i + 1).join(', ')}`);
    }

    /**
     * Reset tutorial tracker
     */
    resetTutorialTracker() {
        this.tutorialTracker.completedSteps.clear();
        this.tutorialTracker.lastStepCompleted = false;
        console.log('🔄 Tutorial tracker reset');
        AppConfig.log(3, 'Tutorial tracker reset for new tutorial');
    }

    /**
     * Auto-advance to next tutorial step
     */
    advanceToNextTutorialStep() {
        if (!window.UI || !window.UI.tutorialSteps) {
            AppConfig.log(3, '🎯 No tutorial system available for auto-advancement');
            return;
        }
        
        const currentIndex = window.UI.currentStepIndex;
        const totalSteps = window.UI.tutorialSteps.length;
        
        if (currentIndex < totalSteps - 1) {
            AppConfig.log(2, `🎯 Auto-advance from step ${currentIndex + 1} to step ${currentIndex + 2}`);
            
            setTimeout(() => {
                if (window.UI && window.UI.goToStep) {
                    window.UI.goToStep(currentIndex + 1);
                }
            }, 100);
        } else {
            AppConfig.log(2, `🎯 Tutorial completed! Step ${currentIndex + 1}/${totalSteps}`);
        }
    }

    /**
     * Stop all animations
     */
    stopAllAnimations() {
        this.activeAnimations.forEach(anim => {
            anim.finished = true;
        });
        this.activeAnimations = [];
        
        AppConfig.log(2, '⏹️ All animations stopped');
    }

    /**
     * Check if model is animating
     */
    isModelAnimating(model) {
        return this.activeAnimations.some(anim => anim.model === model);
    }
}