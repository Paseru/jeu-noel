import { Environment as DreiEnvironment } from '@react-three/drei'

export const Environment = () => {
    return (
        <>
            {/* Background and distance fog */}
            <color attach="background" args={['#1C1917']} />
            <fogExp2 attach="fog" args={['#1C1917', 0.1]} />

            {/* HDRI for realistic reflections */}
            <DreiEnvironment preset="night" />
        </>
    )
}
