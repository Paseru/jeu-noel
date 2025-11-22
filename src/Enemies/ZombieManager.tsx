import { Suspense, useEffect, useMemo, useState } from 'react'
import { Zombie } from './Zombie'
import { useGameStore } from '../stores/useGameStore'
import { useZombieStore } from '../stores/useZombieStore'

interface SpawnedZombie {
    id: number
    spawnPoint: [number, number, number]
}

export const ZombieManager = () => {
    const spawnNonce = useZombieStore((state) => state.spawnNonce)
    const { rooms, currentRoomId } = useGameStore()
    const [zombies, setZombies] = useState<SpawnedZombie[]>([])

    const currentSpawnPoint = useMemo<[number, number, number] | null>(() => {
        const room = rooms.find(r => r.id === currentRoomId)
        return room?.spawnPoint || null
    }, [rooms, currentRoomId])

    // Clear zombies when changing room to avoid stale instances
    useEffect(() => {
        setZombies([])
    }, [currentRoomId])

    // Whenever spawnNonce increments (user pressed spawn), add a zombie
    useEffect(() => {
        if (!currentSpawnPoint) return
        if (spawnNonce === 0) return // skip initial mount
        setZombies((prev) => [
            ...prev,
            { id: Date.now(), spawnPoint: currentSpawnPoint }
        ])
    }, [spawnNonce, currentSpawnPoint])

    if (!currentSpawnPoint) return null

    return (
        <Suspense fallback={null}>
            {zombies.map((zombie) => (
                <Zombie key={zombie.id} spawnPoint={zombie.spawnPoint} />
            ))}
        </Suspense>
    )
}
