import { useRef } from 'react'
import * as THREE from 'three'

export const Lights = () => {
    const directionalLightRef = useRef<THREE.DirectionalLight>(null!)

    // Optional: Debug helper
    // useHelper(directionalLightRef, THREE.DirectionalLightHelper, 1)

    return (
        <>
            {/* Ambient Light: Increased for visibility */}
            <ambientLight intensity={0.5} color="#050511" />

            {/* Main Moon Light: Dim, cold blue */}
            <directionalLight
                ref={directionalLightRef}
                castShadow
                position={[10, 20, 10]}
                intensity={0.5}
                color="#88aaff"
                shadow-mapSize={[2048, 2048]}
                shadow-camera-near={1}
                shadow-camera-far={50}
                shadow-camera-top={20}
                shadow-camera-right={20}
                shadow-camera-bottom={-20}
                shadow-camera-left={-20}
                shadow-bias={-0.0001}
            />
        </>
    )
}
