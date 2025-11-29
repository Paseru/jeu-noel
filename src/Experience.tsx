import { Physics } from '@react-three/rapier'
import { Suspense } from 'react'
import { PlayerController } from './Player/PlayerController'
import { Lights } from './World/Lights'
import { Environment } from './World/Environment'
import { Map } from './World/Map'
import { ErrorBoundary } from './components/ErrorBoundary'
import SpectatorController from './components/SpectatorController'

import { useGameStore } from './stores/useGameStore'
import RemotePlayer from './Multiplayer/RemotePlayer'

export const Experience = ({ isSettingsOpen }: { isSettingsOpen: boolean }) => {
    const { players, playerId, isDebugMode, isSpectator, infectedPlayers, playersBeingInfected } = useGameStore()

    return (
        <>
            {/* Controls: Only active if settings are CLOSED and we are PLAYING */}

            {/* <MiniMap /> */}

            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />

            <Physics gravity={[0, -20, 0]} debug={isDebugMode}>
                <Lights />
                <Environment />
                <ErrorBoundary fallback={
                    <mesh position={[0, 1, 0]}>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color="red" wireframe />
                    </mesh>
                }>
                    <Suspense fallback={null}>
                        <Map />
                    </Suspense>
                </ErrorBoundary>

                {/* Player controller - hidden for spectators */}
                {!isSpectator && <PlayerController isSettingsOpen={isSettingsOpen} />}
                
                {/* Spectator camera controller */}
                {isSpectator && <SpectatorController />}

                {/* Remote Players */}
                <Suspense fallback={null}>
                    {Object.values(players).map((player) => {
                        if (playerId && player.id === playerId && !isSpectator) return null
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
                                isInfected={infectedPlayers.includes(player.id) && !playersBeingInfected.includes(player.id)}
                                isBeingInfected={playersBeingInfected.includes(player.id)}
                            />
                        )
                    })}
                </Suspense>
            </Physics>
        </>
    )
}
