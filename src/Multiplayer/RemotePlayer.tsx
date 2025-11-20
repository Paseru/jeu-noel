import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import CharacterModel from '../Player/CharacterModel'

interface RemotePlayerProps {
    position: [number, number, number]
    rotation: [number, number, number]
    isMoving?: boolean
    isRunning?: boolean
    characterIndex?: number
}

export default function RemotePlayer({ position, rotation, isMoving = false, isRunning = false, characterIndex = 1 }: RemotePlayerProps) {
    const group = useRef<any>()

    useFrame((_state, delta) => {
        if (group.current) {
            // Interpolate position for smoothness
            const targetPos = new Vector3(...position)
            group.current.position.lerp(targetPos, delta * 10)

            // Apply rotation directly (Y-axis is most important)
            // We receive Euler angles [x, y, z]
            group.current.rotation.set(...rotation)
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
                />
            </group>
        </group>
    )
}
