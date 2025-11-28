import { create } from 'zustand'
import * as THREE from 'three'

interface CollisionStore {
    colliderMesh: THREE.Mesh | null
    setColliderMesh: (mesh: THREE.Mesh | null) => void
    // Lowest Y world position of the current map; used as safe fallback floor when collider not ready
    fallbackFloorY: number | null
    setFallbackFloorY: (y: number | null) => void
}

export const useCollisionStore = create<CollisionStore>((set) => ({
    colliderMesh: null,
    setColliderMesh: (mesh) => set({ colliderMesh: mesh }),
    fallbackFloorY: null,
    setFallbackFloorY: (y) => set({ fallbackFloorY: y })
}))
