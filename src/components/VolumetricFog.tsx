import { Clouds, Cloud } from '@react-three/drei'
import * as THREE from 'three'

export const VolumetricFog = () => {
    return (
        <Clouds material={THREE.MeshBasicMaterial}>
            <Cloud
                seed={1}
                bounds={[60, 4, 60]}
                volume={20}
                color="#1a1a2e"
                opacity={0.4}
                speed={0.1}
                segments={30}
                fade={50}
            />
            <Cloud
                seed={2}
                bounds={[80, 8, 80]}
                position={[0, 6, 0]}
                volume={15}
                color="#0a0a15"
                opacity={0.25}
                speed={0.05}
                segments={20}
                fade={80}
            />
        </Clouds>
    )
}
