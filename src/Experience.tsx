import { Physics } from '@react-three/rapier'
import { PlayerController } from './Player/PlayerController'
import { Lights } from './World/Lights'
import { Environment } from './World/Environment'
import { Map } from './World/Map'
import { Snow } from './World/Snow'

import { useGameStore } from './stores/useGameStore'
import RemotePlayer from './Multiplayer/RemotePlayer'

export const Experience = ({ isSettingsOpen }: { isSettingsOpen: boolean }) => {
    const { players, playerId } = useGameStore()

    return (
        <>
            {/* Controls: Only active if settings are CLOSED and we are PLAYING */}

            {/* <MiniMap /> */}

            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />

            <Physics gravity={[0, -20, 0]}>
                <Lights />
                <Environment />
                <Snow />
                <Map />
                <PlayerController isSettingsOpen={isSettingsOpen} />

                {/* Remote Players */}
                {Object.values(players).map((player) => {
                    if (playerId && player.id === playerId) return null
                    return (
                        <RemotePlayer
                            key={player.id}
                            position={player.position}
                            rotation={player.rotation}
                            isMoving={player.isMoving}
                            isRunning={player.isRunning}
                            characterIndex={player.characterIndex}
                        />
                    )
                })}
            </Physics>

            {/* <Lights /> */}
            {/* <Environment /> */}
        </>
    )
}
