import { RigidBody } from '@react-three/rapier'

export const Floor = () => {
    // Since we can't easily download textures, we'll use a high-quality procedural material
    // or a simple noise texture if available. For now, let's tweak the material to look like snow.

    return (
        <RigidBody type="fixed" restitution={0.1} friction={2}>
            <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]} receiveShadow>
                <planeGeometry args={[100, 100, 64, 64]} />
                <meshStandardMaterial
                    color="#ffffff"
                    roughness={1}
                    metalness={0}
                    displacementScale={0.2}
                />
            </mesh>
        </RigidBody>
    )
}
