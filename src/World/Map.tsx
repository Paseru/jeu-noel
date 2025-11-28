import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGameStore } from '../stores/useGameStore'
import { useCollisionStore } from '../stores/useCollisionStore'

// Extend THREE.Mesh to use accelerated raycast
THREE.Mesh.prototype.raycast = acceleratedRaycast

// Normalize geometry for BVH merge: produce a fresh geometry containing only a non-interleaved
// position attribute. BVH only needs positions, so dropping normals/uvs avoids merge issues
// with interleaved/extra attributes. Returns null if no position.
const sanitizeGeometry = (geometry: THREE.BufferGeometry): THREE.BufferGeometry | null => {
    const posAttr = geometry.getAttribute('position')
    if (!posAttr) return null

    // De-interleave if needed
    const positionArray = new Float32Array(posAttr.count * posAttr.itemSize)
    ;(posAttr as any).toArray(positionArray)
    const position = new THREE.BufferAttribute(positionArray, posAttr.itemSize)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', position)
    geo.clearGroups()
    return geo
}

const MapContent = ({ modelPath, scale }: { modelPath: string, scale: number }) => {
    const gltf: any = useGLTF(modelPath)
    const scene = gltf?.scene as THREE.Scene | undefined
    const setMapLoaded = useGameStore((state) => state.setMapLoaded)
    const setColliderMesh = useCollisionStore((state) => state.setColliderMesh)
    const setFallbackFloorY = useCollisionStore((state) => state.setFallbackFloorY)

    // Extract plants to separate group
    const { solidScene, plantScene } = useMemo(() => {
        try {
            if (!scene || typeof (scene as any).traverse !== 'function') {
                return { solidScene: new THREE.Scene(), plantScene: new THREE.Scene() }
            }
            const clonedScene = scene.clone()

            const plants = new THREE.Scene()
            const solids = clonedScene

            const plantsToMove: THREE.Object3D[] = []

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

            return { solidScene: solids, plantScene: plants }
        } catch (err) {
            console.warn('[Map] failed to process scene', err)
            return { solidScene: new THREE.Scene(), plantScene: new THREE.Scene() }
        }
    }, [scene, modelPath])

    // Build BVH collider from all solid meshes
    useEffect(() => {
        if (!solidScene) return

        setMapLoaded(false)

        // Small delay to ensure scene is fully loaded
        const timer = setTimeout(() => {
            const geometries: THREE.BufferGeometry[] = []
            const tempMatrix = new THREE.Matrix4()
            const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale)
            let worldMinY = Number.POSITIVE_INFINITY

            solidScene.updateMatrixWorld(true)

            solidScene.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry) {
                    const sanitized = sanitizeGeometry(child.geometry)
                    if (!sanitized) return

                    // Apply world transform then scale
                    tempMatrix.copy(child.matrixWorld).multiply(scaleMatrix)
                    sanitized.applyMatrix4(tempMatrix)

                    // Track world-space min Y for fallback floor
                    sanitized.computeBoundingBox()
                    const bb = sanitized.boundingBox
                    if (bb) {
                        worldMinY = Math.min(worldMinY, bb.min.y)
                    }

                    geometries.push(sanitized)
                }
            })

            if (geometries.length === 0) {
                console.warn('[Map] No geometries found for BVH')
                setFallbackFloorY(null)
                return
            }

            console.log(`[Map] Merging ${geometries.length} geometries for BVH...`)

            try {
                const mergedGeometry = mergeGeometries(geometries, false)
                if (!mergedGeometry) {
                    console.warn('[Map] Failed to merge geometries')
                    setFallbackFloorY(null)
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

                setFallbackFloorY(Number.isFinite(worldMinY) ? worldMinY : null)
                setColliderMesh(colliderMesh)
                setMapLoaded(true)
                console.log('[Map] BVH collider ready!')
            } catch (err) {
                console.error('[Map] BVH build failed:', err)
                setFallbackFloorY(null)
            }
        }, 100)

        return () => {
            clearTimeout(timer)
            setColliderMesh(null)
            setFallbackFloorY(null)
            setMapLoaded(false)
        }
    }, [solidScene, scale, setColliderMesh, setFallbackFloorY, setMapLoaded])

    return (
        <>
            {/* Map visuals only - collision handled by BVH */}
            <primitive object={solidScene} scale={scale} />

            {/* Plants (Decoration) */}
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

    if (!modelPath) return null

    return <MapContent modelPath={modelPath} scale={scale} />
}
