import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGameStore } from '../stores/useGameStore'
import { useCollisionStore } from '../stores/useCollisionStore'

import { Door } from './Door'

// Extend THREE.Mesh to use accelerated raycast
THREE.Mesh.prototype.raycast = acceleratedRaycast

const MapContent = ({ modelPath, scale }: { modelPath: string, scale: number }) => {
    const gltf: any = useGLTF(modelPath)
    const scene = gltf?.scene as THREE.Scene | undefined
    const setMapLoaded = useGameStore((state) => state.setMapLoaded)
    const setColliderMesh = useCollisionStore((state) => state.setColliderMesh)

    // Extract plants and DOORS to separate groups
    const { solidScene, plantScene, doors } = useMemo(() => {
        try {
            if (!scene || typeof (scene as any).traverse !== 'function') {
                return { solidScene: new THREE.Scene(), plantScene: new THREE.Scene(), doors: [] as THREE.Object3D[] }
            }
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

                    const materials = Array.isArray(child.material) ? child.material : [child.material]
                    materials.forEach(mat => {
                        if (mat) {
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

                    const isDoor = name.includes('door')
                    if (isDoor) {
                        doorsToMove.push(child)
                        return
                    }

                    const isPlantOrTree = name.includes('grass') || name.includes('flower') || name.includes('plant') || name.includes('leaf') || name.includes('vegetation') || name.includes('tree') || name.includes('pine') || name.includes('spruce')
                    const isRock = name.includes('rock') || name.includes('stone') || name.includes('cliff') || name.includes('boulder') || name.includes('mountain') || name.includes('ice') || name.includes('log') || name.includes('stump')

                    if (isPlantOrTree && !isRock) {
                        const bbox = new THREE.Box3().setFromObject(child)
                        const height = bbox.max.y - bbox.min.y
                        if (height > 1.0) {
                            plantsToMove.push(child)
                        }
                    }
                }
            })

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

    // Build BVH collider from all solid meshes
    useEffect(() => {
        if (!solidScene) return

        // Small delay to ensure scene is fully loaded
        const timer = setTimeout(() => {
            const geometries: THREE.BufferGeometry[] = []
            const tempMatrix = new THREE.Matrix4()
            const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale)

            solidScene.updateMatrixWorld(true)

            solidScene.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry) {
                    const clonedGeo = child.geometry.clone()
                    // Apply world transform then scale
                    tempMatrix.copy(child.matrixWorld).multiply(scaleMatrix)
                    clonedGeo.applyMatrix4(tempMatrix)
                    geometries.push(clonedGeo)
                }
            })

            if (geometries.length === 0) {
                console.warn('[Map] No geometries found for BVH')
                return
            }

            console.log(`[Map] Merging ${geometries.length} geometries for BVH...`)

            try {
                const mergedGeometry = mergeGeometries(geometries, false)
                if (!mergedGeometry) {
                    console.warn('[Map] Failed to merge geometries')
                    return
                }

                // Build BVH
                console.log('[Map] Building BVH...')
                const bvh = new MeshBVH(mergedGeometry)
                mergedGeometry.boundsTree = bvh

                const colliderMesh = new THREE.Mesh(
                    mergedGeometry,
                    new THREE.MeshBasicMaterial({ visible: false })
                )
                colliderMesh.name = 'BVH_Collider'
                
                setColliderMesh(colliderMesh)
                console.log('[Map] BVH collider ready!')
            } catch (err) {
                console.error('[Map] BVH build failed:', err)
            }
        }, 100)

        return () => {
            clearTimeout(timer)
            setColliderMesh(null)
        }
    }, [solidScene, scale, setColliderMesh])

    // Signal map readiness
    useEffect(() => {
        setMapLoaded(true)
        return () => setMapLoaded(false)
    }, [modelPath, setMapLoaded])

    return (
        <>
            {/* Map visuals only - collision handled by BVH */}
            <primitive object={solidScene} scale={scale} />

            {/* Plants (Decoration) */}
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

    if (!modelPath) return null

    return <MapContent modelPath={modelPath} scale={scale} />
}
