import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import CharacterModel from '../Player/CharacterModel'

interface RemotePlayerProps {
    id: string
    position: [number, number, number]
    quaternion: [number, number, number, number]
    isMoving?: boolean
    isRunning?: boolean
    characterIndex?: number
    nickname?: string
    isSpeaking?: boolean
}

export default function RemotePlayer({
    id,
    position,
    quaternion,
    isMoving = false,
    isRunning = false,
    characterIndex = 1,
    nickname,
    isSpeaking
}: RemotePlayerProps) {
    const group = useRef<any>()

    useFrame((_state, delta) => {
        if (group.current) {
            // Interpolate position for smoothness
            const targetPos = new THREE.Vector3(...position)
            group.current.position.lerp(targetPos, delta * 15)

            // Interpolate rotation (Slerp)
            const targetQuat = new THREE.Quaternion(...quaternion)
            group.current.quaternion.slerp(targetQuat, delta * 15)
        }
    })

    return (
        <group ref={group} position={position}>
            {/* Vertical offset to align model with ground (matches PlayerController) */}
            <group position={[0, -0.8, 0]}>
                <CharacterModel
                    characterIndex={characterIndex}
                    isMoving={isMoving}
                    isRunning={isRunning}
                    nickname={nickname}
                    isSpeaking={isSpeaking}
                    playerId={id}
                />
            </group>
        </group>
    )
}
