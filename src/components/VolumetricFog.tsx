import { Clouds, Cloud } from '@react-three/drei'
import * as THREE from 'three'

export const VolumetricFog = () => {
    const fogY = 10 // Spawn height
    
    return (
        <Clouds material={THREE.MeshBasicMaterial} limit={400}>
            {/* Dense ground layer */}
            <Cloud
                seed={1}
                bounds={[100, 8, 100]}
                position={[0, fogY - 15, 0]}
                volume={30}
                color="#c8c8d0"
                opacity={0.8}
                speed={0.15}
                segments={60}
                fade={100}
            />
            <Cloud
                seed={10}
                bounds={[100, 8, 100]}
                position={[0, fogY - 12, 0]}
                volume={28}
                color="#b0b0c0"
                opacity={0.75}
                speed={0.12}
                segments={55}
                fade={100}
            />
            
            {/* Main fog at spawn level */}
            <Cloud
                seed={2}
                bounds={[120, 12, 120]}
                position={[0, fogY - 5, 0]}
                volume={35}
                color="#d0d0d8"
                opacity={0.85}
                speed={0.1}
                segments={70}
                fade={120}
            />
            <Cloud
                seed={20}
                bounds={[110, 10, 110]}
                position={[0, fogY, 0]}
                volume={32}
                color="#e0e0e8"
                opacity={0.9}
                speed={0.08}
                segments={65}
                fade={110}
            />
            <Cloud
                seed={21}
                bounds={[100, 8, 100]}
                position={[0, fogY + 2, 0]}
                volume={30}
                color="#d8d8e0"
                opacity={0.8}
                speed={0.11}
                segments={60}
                fade={100}
            />
            
            {/* Upper fog layers */}
            <Cloud
                seed={3}
                bounds={[100, 10, 100]}
                position={[0, fogY + 8, 0]}
                volume={28}
                color="#c0c0d0"
                opacity={0.7}
                speed={0.06}
                segments={50}
                fade={90}
            />
            <Cloud
                seed={30}
                bounds={[90, 8, 90]}
                position={[0, fogY + 12, 0]}
                volume={25}
                color="#b8b8c8"
                opacity={0.65}
                speed={0.07}
                segments={45}
                fade={85}
            />
            <Cloud
                seed={4}
                bounds={[80, 6, 80]}
                position={[0, fogY + 18, 0]}
                volume={22}
                color="#a8a8b8"
                opacity={0.55}
                speed={0.05}
                segments={40}
                fade={80}
            />
            
            {/* Extra thick patches */}
            <Cloud
                seed={100}
                bounds={[60, 15, 60]}
                position={[-20, fogY, -20]}
                volume={40}
                color="#e8e8f0"
                opacity={0.95}
                speed={0.09}
                segments={50}
                fade={70}
            />
            <Cloud
                seed={101}
                bounds={[60, 15, 60]}
                position={[20, fogY - 3, 20]}
                volume={38}
                color="#e0e0e8"
                opacity={0.9}
                speed={0.1}
                segments={50}
                fade={70}
            />
            <Cloud
                seed={102}
                bounds={[50, 12, 50]}
                position={[30, fogY + 5, -30]}
                volume={35}
                color="#d8d8e0"
                opacity={0.85}
                speed={0.08}
                segments={45}
                fade={65}
            />
            <Cloud
                seed={103}
                bounds={[50, 12, 50]}
                position={[-30, fogY - 8, 30]}
                volume={35}
                color="#d0d0d8"
                opacity={0.85}
                speed={0.11}
                segments={45}
                fade={65}
            />
        </Clouds>
    )
}
