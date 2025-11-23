import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'

import { Door } from './Door'

// Internal component that handles the actual loading
// This component MUST only be rendered when modelPath is valid
const MapContent = ({ modelPath, scale }: { modelPath: string, scale: number }) => {
    const { scene } = useGLTF(modelPath)
    const setMapLoaded = useGameStore((state) => state.setMapLoaded)
    const isHouseMap = modelPath.toLowerCase().includes('house_map')

    // Signal map readiness
    useEffect(() => {
        setMapLoaded(true)
        return () => setMapLoaded(false)
    }, [modelPath, setMapLoaded])

    useEffect(() => {
        console.log("MapContent mounted. ModelPath:", modelPath, "Scale:", scale)
    }, [modelPath, scale])

    // Extract plants and DOORS to separate groups
    const { solidScene, plantScene, doors } = useMemo(() => {
        // Clone the scene to avoid mutating the cached GLTF result
        const clonedScene = scene.clone()

        const plants = new THREE.Scene()
        const solids = clonedScene
        const doorObjects: THREE.Object3D[] = []

        const plantsToMove: THREE.Object3D[] = []
        const doorsToMove: THREE.Object3D[] = []

        clonedScene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
                child.receiveShadow = true

                // Universal Material Handling
                const materials = Array.isArray(child.material) ? child.material : [child.material]

                materials.forEach(mat => {
                    if (mat) {
                        if (!mat.userData.darkened) {
                            mat.color.multiplyScalar(0.8)
                            mat.userData.darkened = true
                        }
                        mat.transparent = false
                        mat.depthWrite = true
                        if (mat.map) {
                            mat.alphaTest = 0.5
                            mat.side = THREE.DoubleSide
                        }
                    }
                })

                // For the House map, keep all meshes in the solid collider to avoid holes.
                if (isHouseMap) return

                const name = child.name.toLowerCase()

                const isPlantOrTree = name.includes('grass') || name.includes('flower') || name.includes('plant') || name.includes('leaf') || name.includes('vegetation') || name.includes('tree') || name.includes('pine') || name.includes('spruce')
                const isRock = name.includes('rock') || name.includes('stone') || name.includes('cliff') || name.includes('boulder') || name.includes('mountain') || name.includes('ice') || name.includes('log') || name.includes('stump')

                if (isPlantOrTree && !isRock) {
                    plantsToMove.push(child)
                }
            }
        })

        // Move plants
        plantsToMove.forEach(child => {
            const worldPos = new THREE.Vector3()
            const worldQuat = new THREE.Quaternion()
            const worldScale = new THREE.Vector3()

            child.getWorldPosition(worldPos)
            child.getWorldQuaternion(worldQuat)
            child.getWorldScale(worldScale)

            if (child.parent) child.parent.remove(child)

            plants.add(child)

            child.position.copy(worldPos)
            child.quaternion.copy(worldQuat)
            child.scale.copy(worldScale)
        })

        // Move doors
        doorsToMove.forEach(child => {
            // We need to preserve the transform relative to the map origin
            // Since we are removing it from the hierarchy, we need its world transform
            // BUT, we will be rendering it inside the MapContent which is already scaled.
            // The Door component expects an object. We should probably just detach it.

            if (child.parent) child.parent.remove(child)
            doorObjects.push(child)
        })

        return { solidScene: solids, plantScene: plants, doors: doorObjects }
    }, [scene, modelPath])

    return (
        <>
            {/* Solid World (Walls, Floor) - Has Physics */}
            <RigidBody type="fixed" colliders="trimesh">
                <primitive object={solidScene} scale={scale} />
            </RigidBody>

            {/* Plants (Decoration) - No Physics */}
            <primitive object={plantScene} scale={scale} />

            {/* Interactive Doors */}
            {doors.map((door, index) => (
                <group key={index} scale={scale}>
                    <Door object={door} />
                </group>
            ))}
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
