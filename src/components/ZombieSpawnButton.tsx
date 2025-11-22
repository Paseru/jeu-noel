import { useEffect } from 'react'
import { useGameStore } from '../stores/useGameStore'

export const ZombieSpawnButton = () => {
    const spawnZombie = useGameStore((state) => state.spawnZombie)
    const phase = useGameStore((state) => state.phase)

    // Keyboard shortcut (K)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (phase !== 'PLAYING') return
            if (e.code === 'KeyK') {
                spawnZombie()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [phase, spawnZombie])

    if (phase !== 'PLAYING') return null

    return (
        <button
            onClick={spawnZombie}
            className="fixed right-4 bottom-4 z-20 rounded-md bg-red-600/90 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/40 hover:bg-red-500 transition-colors"
        >
            Spawn Zombie (K)
        </button>
    )
}
