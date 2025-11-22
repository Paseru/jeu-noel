import { Physics } from '@react-three/rapier'
import { Suspense } from 'react'
import { PlayerController } from './Player/PlayerController'
import { Lights } from './World/Lights'
import { Environment } from './World/Environment'
import { Map } from './World/Map'
import { Snow } from './World/Snow'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ZombieManager } from './Enemies/ZombieManager'
import { ZombieSummonZone } from './Enemies/ZombieSummonZone'

import { useGameStore } from './stores/useGameStore'
import RemotePlayer from './Multiplayer/RemotePlayer'

export const Experience = ({ isSettingsOpen }: { isSettingsOpen: boolean }) => {
    const { players, playerId, isDebugMode } = useGameStore()

    return (
        <>
            {/* Controls: Only active if settings are CLOSED and we are PLAYING */}

            {/* <MiniMap /> */}

            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />

            <Physics gravity={[0, -20, 0]} debug={isDebugMode}>
                <Lights />
                <Environment />
                <Snow />
                <ErrorBoundary fallback={
                    <mesh position={[0, 1, 0]}>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color="red" wireframe />
                    </mesh>
                }>
                    <Map />
                </ErrorBoundary>

                <ZombieSummonZone />

                <PlayerController isSettingsOpen={isSettingsOpen} />

                {/* Zombies */}
                <ZombieManager />

                {/* Remote Players */}
                <Suspense fallback={null}>
                    {Object.values(players).map((player) => {
                        if (playerId && player.id === playerId) return null
                        return (
                            <RemotePlayer
                                key={player.id}
                                id={player.id}
                                position={player.position}
                                quaternion={player.quaternion}
                                isMoving={player.isMoving}
                                isRunning={player.isRunning}
                                characterIndex={player.characterIndex}
                                nickname={player.nickname}
                                isSpeaking={player.isSpeaking}
                            />
                        )
                    })}
                </Suspense>
            </Physics>

            {/* <Lights /> */}
            {/* <Environment /> */}
        </>
    )
}
