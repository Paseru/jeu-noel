import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'
import { useCollisionStore } from '../stores/useCollisionStore'

const MapContent = ({ modelPath, scale }: { modelPath: string, scale: number }) => {
    const gltf: any = useGLTF(modelPath)
    const scene = gltf?.scene as THREE.Scene | undefined
    const setMapLoaded = useGameStore((state) => state.setMapLoaded)
    const setColliderMesh = useCollisionStore((state) => state.setColliderMesh)
    const setFallbackFloorY = useCollisionStore((state) => state.setFallbackFloorY)

    useEffect(() => {
        if (!scene) return
        // Clear any previous collider logic; this map is visual-only.
        setColliderMesh(null)
        setFallbackFloorY(null)
        setMapLoaded(true)
        return () => {
            setColliderMesh(null)
            setFallbackFloorY(null)
            setMapLoaded(false)
        }
    }, [scene, setColliderMesh, setFallbackFloorY, setMapLoaded])

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
