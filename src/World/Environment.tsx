import { Environment as DreiEnvironment } from '@react-three/drei'

export const Environment = () => {
    return (
        <>
            {/* Background and distance fog */}
            <color attach="background" args={['#0a0a12']} />
            <fogExp2 attach="fog" args={['#0a0a12', 0.04]} />

            {/* HDRI for realistic reflections */}
            <DreiEnvironment preset="night" />
        </>
    )
}
