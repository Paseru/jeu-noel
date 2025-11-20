import { Environment as DreiEnvironment } from '@react-three/drei'

export const Environment = () => {
    return (
        <>
            {/* Exponential Fog for the dense atmosphere */}
            {/* Color matches the background to blend seamlessly */}
            <color attach="background" args={['#050511']} />
            <fogExp2 attach="fog" args={['#050511', 0.03]} />

            {/* Volumetric Fog removed by user request */}

            {/* HDRI for realistic reflections, even if not visible directly */}
            <DreiEnvironment preset="night" />
        </>
    )
}
