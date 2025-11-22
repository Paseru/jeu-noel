import { create } from 'zustand'

interface ZombieState {
    spawnNonce: number
    requestSpawn: () => void
}

// Tiny store used to trigger zombie spawns from UI / keyboard without prop drilling
export const useZombieStore = create<ZombieState>((set) => ({
    spawnNonce: 0,
    requestSpawn: () => set((state) => ({ spawnNonce: state.spawnNonce + 1 }))
}))
