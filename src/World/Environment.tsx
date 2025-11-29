import { Environment as DreiEnvironment } from '@react-three/drei'

export const Environment = () => {
    return (
        <>
            {/* Dense horror fog - dark blue-gray color */}
            <color attach="background" args={['#0a0a12']} />
            <fogExp2 attach="fog" args={['#0a0a12', 0.065]} />

            {/* HDRI for realistic reflections */}
            <DreiEnvironment preset="night" />
        </>
    )
}
