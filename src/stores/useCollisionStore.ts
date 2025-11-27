import { create } from 'zustand'
import * as THREE from 'three'

interface CollisionStore {
    colliderMesh: THREE.Mesh | null
    setColliderMesh: (mesh: THREE.Mesh | null) => void
}

export const useCollisionStore = create<CollisionStore>((set) => ({
    colliderMesh: null,
    setColliderMesh: (mesh) => set({ colliderMesh: mesh })
}))
