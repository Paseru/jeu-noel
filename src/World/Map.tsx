import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGameStore } from '../stores/useGameStore'
import { useCollisionStore } from '../stores/useCollisionStore'

// Enable BVH-accelerated raycasts on meshes that have a boundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

// Create a simple, non-interleaved geometry containing only positions.
// This avoids mergeGeometries errors with mixed attributes/interleaved buffers.
const sanitizeGeometry = (geometry: THREE.BufferGeometry): THREE.BufferGeometry | null => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null
    if (!posAttr) return null

    const count = posAttr.count
    const positionArray = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
        positionArray[i * 3] = (posAttr as any).getX(i)
        positionArray[i * 3 + 1] = (posAttr as any).getY(i)
        positionArray[i * 3 + 2] = (posAttr as any).getZ(i)
    }

    const clean = new THREE.BufferGeometry()
    clean.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
    clean.clearGroups()
    return clean
}

const MapContent = ({ modelPath, scale }: { modelPath: string, scale: number }) => {
    const gltf: any = useGLTF(modelPath)
    const scene = gltf?.scene as THREE.Scene | undefined
    const setMapLoaded = useGameStore((state) => state.setMapLoaded)
    const setColliderMesh = useCollisionStore((state) => state.setColliderMesh)
    const setFallbackFloorY = useCollisionStore((state) => state.setFallbackFloorY)

    // Build a single BVH collider from all meshes in the scene
    useEffect(() => {
        if (!scene) return

        setMapLoaded(false)
        setColliderMesh(null)
        setFallbackFloorY(null)

        const timer = setTimeout(() => {
            const geometries: THREE.BufferGeometry[] = []
            const tempMatrix = new THREE.Matrix4()
            const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale)
            let worldMinY = Number.POSITIVE_INFINITY

            scene.updateMatrixWorld(true)

            scene.traverse((child) => {
                if (child instanceof THREE.Mesh && child.geometry) {
                    const clean = sanitizeGeometry(child.geometry)
                    if (!clean) return

                    tempMatrix.copy(child.matrixWorld).multiply(scaleMatrix)
                    clean.applyMatrix4(tempMatrix)

                    clean.computeBoundingBox()
                    const bb = clean.boundingBox
                    if (bb) worldMinY = Math.min(worldMinY, bb.min.y)

                    geometries.push(clean)
                }
            })

            if (geometries.length === 0) {
                console.warn('[Map] No geometries found for BVH')
                setMapLoaded(true)
                return
            }

            try {
                const merged = mergeGeometries(geometries, false)
                if (!merged) {
                    console.warn('[Map] Failed to merge geometries for BVH')
                    setMapLoaded(true)
                    return
                }

                const bvh = new MeshBVH(merged)
                merged.boundsTree = bvh

                const collider = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false }))
                collider.name = 'BVH_Collider'

                setColliderMesh(collider)
                setFallbackFloorY(Number.isFinite(worldMinY) ? worldMinY : null)
                setMapLoaded(true)
                console.log('[Map] BVH collider ready')
            } catch (err) {
                console.error('[Map] BVH build failed:', err)
                setMapLoaded(true)
            }
        }, 50)

        return () => {
            clearTimeout(timer)
            setColliderMesh(null)
            setFallbackFloorY(null)
            setMapLoaded(false)
        }
    }, [scene, scale, setColliderMesh, setFallbackFloorY, setMapLoaded])

    if (!scene) return null
    return <primitive object={scene} scale={scale} />
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
