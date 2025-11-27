import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'

import { Door } from './Door'

// Internal component that handles the actual loading
// This component MUST only be rendered when modelPath is valid
const MapContent = ({ modelPath, scale }: { modelPath: string, scale: number }) => {
    const gltf: any = useGLTF(modelPath)
    const scene = gltf?.scene as THREE.Scene | undefined
    const setMapLoaded = useGameStore((state) => state.setMapLoaded)

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
        try {
            // Safety: if GLTF not ready yet (edge cases outside Suspense), return empty scenes
            if (!scene || typeof (scene as any).traverse !== 'function') {
                return { solidScene: new THREE.Scene(), plantScene: new THREE.Scene(), doors: [] as THREE.Object3D[] }
            }
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
                        // Only darken if material has a color property
                        if (!mat.userData.darkened && mat.color) {
                            mat.color.multiplyScalar(0.8)
                            mat.userData.darkened = true
                        }
                        mat.depthWrite = true
                        if (mat.map) {
                            mat.side = THREE.DoubleSide
                        }
                    }
                })

                const name = child.name.toLowerCase()

                // Detect doors and detach them so we can animate them independently
                const isDoor = name.includes('door')
                if (isDoor) {
                    doorsToMove.push(child)
                    return
                }

                const isPlantOrTree = name.includes('grass') || name.includes('flower') || name.includes('plant') || name.includes('leaf') || name.includes('vegetation') || name.includes('tree') || name.includes('pine') || name.includes('spruce')
                const isRock = name.includes('rock') || name.includes('stone') || name.includes('cliff') || name.includes('boulder') || name.includes('mountain') || name.includes('ice') || name.includes('log') || name.includes('stump')

                if (isPlantOrTree && !isRock) {
                    // Avoid stripping flat ground (e.g., grass floors). Only move tall vegetation.
                    const bbox = new THREE.Box3().setFromObject(child)
                    const height = bbox.max.y - bbox.min.y
                    if (height > 1.0) {
                        plantsToMove.push(child)
                    }
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

        // Collect doors (compute world transform, then detach)
        doorsToMove.forEach(child => {
            const worldPos = new THREE.Vector3()
            const worldQuat = new THREE.Quaternion()
            const worldScale = new THREE.Vector3()

            child.getWorldPosition(worldPos)
            child.getWorldQuaternion(worldQuat)
            child.getWorldScale(worldScale)

            if (child.parent) child.parent.remove(child)
            child.position.copy(worldPos)
            child.quaternion.copy(worldQuat)
            child.scale.copy(worldScale)

            doorObjects.push(child)
        })

            return { solidScene: solids, plantScene: plants, doors: doorObjects }
        } catch (err) {
            console.warn('[Map] failed to process scene', err)
            return { solidScene: new THREE.Scene(), plantScene: new THREE.Scene(), doors: [] as THREE.Object3D[] }
        }
    }, [scene, modelPath])

    return (
        <>
            {/* Map with hull colliders - faster than trimesh */}
            <RigidBody type="fixed" colliders="hull">
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
