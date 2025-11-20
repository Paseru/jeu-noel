import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import CharacterModel from '../Player/CharacterModel'

interface RemotePlayerProps {
    position: [number, number, number]
    rotation: [number, number, number]
    characterIndex?: number
}

export default function RemotePlayer({ position, rotation, characterIndex = 1 }: RemotePlayerProps) {
    const group = useRef<any>()
    const [isMoving, setIsMoving] = useState(false)
    const previousPosition = useRef(new Vector3(...position))

    useFrame((_state, delta) => {
        if (group.current) {
            // Interpolate position for smoothness
            const targetPos = new Vector3(...position)
            group.current.position.lerp(targetPos, delta * 10)
            group.current.rotation.set(...rotation)

            // Calculate movement for animation
            const dist = previousPosition.current.distanceTo(targetPos)
            // Threshold for moving (approx speed)
            // If distance > small amount, we are moving
            // Since position updates come from server, they might be jumpy.
            // But we interpolate group.current.position.
            // Let's check the distance between current interpolated pos and target pos? No.
            // Let's check distance moved per frame?
            // Or just check if targetPos is different from previous targetPos?

            // Better: Check if position prop changed significantly recently.
            // But we only get props when parent re-renders.
            // Actually, `position` prop changes every time store updates.

            // Let's use the distance between the new prop position and the stored previous prop position.
            if (dist > 0.01) {
                setIsMoving(true)
            } else {
                setIsMoving(false)
            }
            previousPosition.current.copy(targetPos)
        }
    })

    return (
        <group ref={group} position={position}>
            <CharacterModel
                characterIndex={characterIndex}
                isMoving={isMoving}
                // We don't know if remote player is running easily without sending it.
                // For now assume running if speed is high? Or just walk.
                // Let's just pass isMoving.
                isRunning={false}
            />
        </group>
    )
}
