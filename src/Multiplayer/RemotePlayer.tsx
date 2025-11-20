import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, Quaternion } from 'three'

interface RemotePlayerProps {
    position: [number, number, number]
    rotation: [number, number, number]
}

export default function RemotePlayer({ position, rotation }: RemotePlayerProps) {
    const group = useRef<any>()

    useFrame((state, delta) => {
        if (group.current) {
            // Interpolate position for smoothness
            group.current.position.lerp(new Vector3(...position), delta * 10)
            // Interpolate rotation? simple slerp or just set for now
            // group.current.rotation.set(...rotation) 
            // Rotation is usually a quaternion or Euler. Assuming Euler [x,y,z] from server.
            // Let's just set it for now.
            group.current.rotation.set(...rotation)
        }
    })

    return (
        <group ref={group} position={position}>
            {/* Simple visual representation */}
            <mesh castShadow position={[0, 0.9, 0]}>
                <capsuleGeometry args={[0.3, 1.8, 4, 8]} />
                <meshStandardMaterial color="red" />
            </mesh>
            <mesh position={[0, 1.6, 0.2]}>
                <boxGeometry args={[0.3, 0.1, 0.1]} />
                <meshStandardMaterial color="black" />
            </mesh>
        </group>
    )
}
