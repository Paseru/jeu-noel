import { Suspense } from 'react'
import { Zombie } from './Zombie'
import { useGameStore } from '../stores/useGameStore'

export const ZombieManager = () => {
    const zombies = useGameStore((state) => state.zombies)

    if (!zombies.length) return null

    return (
        <Suspense fallback={null}>
            {zombies.map((zombie) => (
                <Zombie key={zombie.id} spawnPoint={zombie.spawnPoint} />
            ))}
        </Suspense>
    )
}
