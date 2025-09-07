// Debug Step 9 rotation issue
console.log('=== DEBUGGING STEP 9 ROTATION CENTER ===');

// Simulate the actual problematic scenario
const modelPosition = { x: 1.0, y: 0.5, z: 0.3 }; // Example current model position
const modelSize = { x: 0.8, y: 0.4, z: 0.2 }; // Example model size
const modelCenter = { x: 1.0, y: 0.5, z: 0.3 }; // Same as position for this test
const relativeCenter = { x: -0.1, y: 0, z: 0 }; // From step 9

console.log('Model position:', modelPosition);
console.log('Model size:', modelSize);
console.log('Model center:', modelCenter);
console.log('Relative center:', relativeCenter);

// Test the rotation center calculation
function calculateRelativeRotationCenter(modelCenter, modelSize, relativeCenter) {
    const absoluteCenter = {
        x: modelCenter.x + (relativeCenter.x * modelSize.x),
        y: modelCenter.y + (relativeCenter.y * modelSize.y), 
        z: modelCenter.z + (relativeCenter.z * modelSize.z)
    };
    
    console.log('Calculated absolute center:', absoluteCenter);
    return absoluteCenter;
}

const absoluteCenter = calculateRelativeRotationCenter(modelCenter, modelSize, relativeCenter);

// Test if the rotation matrix would work correctly
console.log('\n=== TESTING ROTATION MATRIX ===');
const initialPos = { x: modelPosition.x, y: modelPosition.y, z: modelPosition.z };
const pivotCenter = absoluteCenter;
const rotationDegrees = 90; // Z-axis rotation from step 9

console.log('Initial position:', initialPos);
console.log('Pivot center:', pivotCenter);
console.log('Rotation degrees (Z-axis):', rotationDegrees);

// Simulate the matrix transformation manually
const dx = initialPos.x - pivotCenter.x;
const dy = initialPos.y - pivotCenter.y;
const dz = initialPos.z - pivotCenter.z;

console.log('Offset from pivot:', { dx, dy, dz });

// Apply 90-degree Z rotation: (x,y) -> (-y,x)
const rotatedDx = -dy;
const rotatedDy = dx;
const rotatedDz = dz; // Z unchanged for Z-axis rotation

console.log('After rotation:', { rotatedDx, rotatedDy, rotatedDz });

const finalPosition = {
    x: pivotCenter.x + rotatedDx,
    y: pivotCenter.y + rotatedDy,
    z: pivotCenter.z + rotatedDz
};

console.log('Final position:', finalPosition);
console.log('Movement:', {
    x: finalPosition.x - initialPos.x,
    y: finalPosition.y - initialPos.y,
    z: finalPosition.z - initialPos.z
});

// Now add the translation from step 9: (-0.2, 0, 0)
const withTranslation = {
    x: finalPosition.x - 0.2,
    y: finalPosition.y + 0.0,
    z: finalPosition.z + 0.0
};

console.log('\n=== WITH TRANSLATION ===');
console.log('Final position with translation:', withTranslation);
console.log('Total movement:', {
    x: withTranslation.x - initialPos.x,
    y: withTranslation.y - initialPos.y,
    z: withTranslation.z - initialPos.z
});
