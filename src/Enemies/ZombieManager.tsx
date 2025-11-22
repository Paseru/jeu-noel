import { Suspense } from 'react'
import { Zombie } from './Zombie'
import { useGameStore } from '../stores/useGameStore'
import { ErrorBoundary } from '../components/ErrorBoundary'

export const ZombieManager = () => {
    const zombies = useGameStore((state) => state.zombies)

    if (!zombies.length) return null

    return (
        <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
                {zombies
                    .filter((z) => Array.isArray(z.spawnPoint) && z.spawnPoint.length === 3)
                    .map((zombie) => (
                        <Zombie key={zombie.id} spawnPoint={zombie.spawnPoint as [number, number, number]} />
                    ))}
            </Suspense>
        </ErrorBoundary>
    )
}
