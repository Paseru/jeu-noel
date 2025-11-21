import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'

// Internal component that handles the actual loading
// This component MUST only be rendered when modelPath is valid
const MapContent = ({ modelPath, scale }: { modelPath: string, scale: number }) => {
    const { scene } = useGLTF(modelPath)

    // Extract plants to a separate group to disable their physics
    // We use useMemo to do this only once
    const { solidScene, plantScene } = useMemo(() => {
        // Clone the scene to avoid mutating the cached GLTF result
        // This fixes issues where issues disappear on hot reload because they were removed from the original scene
        const clonedScene = scene.clone()

        // We will modify the original scene structure, so we don't clone the whole thing (saves memory)
        // But we need a container for the plants
        const plants = new THREE.Scene()
        const solids = clonedScene // The rest of the scene stays here

        const plantsToMove: THREE.Object3D[] = []

        clonedScene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
                child.receiveShadow = true

                // Universal Material Handling for PS1/Retro Style
                // Fixes transparency sorting issues by using Alpha Testing (Cutout) instead of Blending
                const materials = Array.isArray(child.material) ? child.material : [child.material]

                materials.forEach(mat => {
                    if (mat) {
                        // 1. Clone to avoid side effects
                        // Note: We are already traversing a cloned scene, but materials might be shared. 
                        // Ideally we should clone materials if we modify them, but for now we modify in place 
                        // as we want this style globally.

                        // 2. Darken textures (existing logic)
                        if (!mat.userData.darkened) {
                            mat.color.multiplyScalar(0.8)
                            mat.userData.darkened = true
                        }

                        // 3. APPLY THE FIX: Alpha Test instead of Transparency
                        mat.transparent = false // Disable sorting
                        mat.depthWrite = true   // Force depth write so objects hide what's behind them

                        // If it has a texture, use alpha test to cut out the transparent parts
                        if (mat.map) {
                            mat.alphaTest = 0.5
                            mat.side = THREE.DoubleSide // Ensure leaves are visible from both sides
                        }
                    }
                })

                const name = child.name.toLowerCase()
                const isPlantOrTree = name.includes('grass') || name.includes('flower') || name.includes('plant') || name.includes('leaf') || name.includes('vegetation') || name.includes('tree') || name.includes('pine') || name.includes('spruce')
                const isRock = name.includes('rock') || name.includes('stone') || name.includes('cliff') || name.includes('boulder') || name.includes('mountain') || name.includes('ice') || name.includes('log') || name.includes('stump')

                // Rocks stay in solidScene (physics)
                // Plants/Trees go to plantScene (no physics)
                if (isPlantOrTree && !isRock) {
                    plantsToMove.push(child)
                }
            }
        })

        // Move plants to the ghost scene, PRESERVING TRANSFORMS
        plantsToMove.forEach(child => {
            // 1. Get world transform
            const worldPos = new THREE.Vector3()
            const worldQuat = new THREE.Quaternion()
            const worldScale = new THREE.Vector3()

            child.getWorldPosition(worldPos)
            child.getWorldQuaternion(worldQuat)
            child.getWorldScale(worldScale)

            // 2. Remove from parent
            if (child.parent) child.parent.remove(child)

            // 3. Add to new scene
            plants.add(child)

            // 4. Apply world transform explicitly
            child.position.copy(worldPos)
            child.quaternion.copy(worldQuat)
            child.scale.copy(worldScale)
        })

        return { solidScene: solids, plantScene: plants }
    }, [scene])

    return (
        <>
            {/* Solid World (Walls, Floor) - Has Physics */}
            <RigidBody type="fixed" colliders="trimesh">
                <primitive object={solidScene} scale={scale} />
            </RigidBody>

            {/* Plants (Decoration) - No Physics */}
            <primitive object={plantScene} scale={scale} />
        </>
    )
}

export const Map = () => {
    const { currentRoomId, rooms } = useGameStore()

    const { modelPath, scale } = useMemo(() => {
        const room = rooms.find(r => r.id === currentRoomId)
        if (!room) return { modelPath: null, scale: 1 }

        return {
            modelPath: room.modelPath,
            scale: room.scale || 1
        }
    }, [currentRoomId, rooms])

    // If no map is selected (e.g. Main Menu), render nothing
    if (!modelPath) return null

    return <MapContent modelPath={modelPath} scale={scale} />
}
