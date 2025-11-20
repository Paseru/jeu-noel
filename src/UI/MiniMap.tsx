import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { OrthographicCamera, Hud, RenderTexture } from '@react-three/drei'
import * as THREE from 'three'
import { Map } from '../World/Map' // We need to render the map inside the texture too

export const MiniMap = () => {
    const { camera: mainCamera } = useThree()
    const mapCamera = useRef<THREE.OrthographicCamera>(null!)

    useFrame(() => {
        if (mapCamera.current) {
            // Sync MiniMap camera with player position
            mapCamera.current.position.x = mainCamera.position.x
            mapCamera.current.position.z = mainCamera.position.z
            mapCamera.current.rotation.set(-Math.PI / 2, 0, 0) // Look down
        }
    })

    return (
        <Hud>
            {/* The HUD Camera (Screen Space) */}
            <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={1} />

            {/* The MiniMap Display (A circle in bottom right) */}
            <mesh position={[window.innerWidth / 2 - 120, -window.innerHeight / 2 + 120, 0]}>
                <circleGeometry args={[100, 64]} />
                <meshBasicMaterial>
                    {/* The Virtual Camera rendering the world */}
                    <RenderTexture attach="map" width={512} height={512}>
                        <color attach="background" args={['#000']} />
                        <OrthographicCamera
                            ref={mapCamera}
                            makeDefault
                            position={[0, 100, 0]}
                            zoom={10}
                            near={0.1}
                            far={1000}
                        />

                        {/* Lighting for MiniMap */}
                        <ambientLight intensity={2} />
                        <directionalLight position={[10, 10, 5]} intensity={2} />

                        {/* 
                   CRITICAL: We need to render the Map here too. 
                   Since we can't easily share the exact same instance of the GLTF scene (Three.js limitation),
                   we create a new instance of the Map component. 
                   It's a bit heavier on memory but safe.
                */}
                        <Map />

                        {/* Player Marker (Red Dot) */}
                        <mesh position={[0, 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <coneGeometry args={[2, 6, 32]} />
                            <meshBasicMaterial color="red" />
                        </mesh>
                    </RenderTexture>
                </meshBasicMaterial>
            </mesh>
        </Hud>
    )
}
