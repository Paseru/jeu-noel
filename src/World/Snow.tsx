import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SNOW_COUNT = 5000 // Increased count
const SNOW_RANGE = 50

export const Snow = () => {
    // Create a simple circle texture programmatically
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 32
        canvas.height = 32
        const context = canvas.getContext('2d')
        if (context) {
            context.fillStyle = 'white'
            context.beginPath()
            context.arc(16, 16, 8, 0, Math.PI * 2)
            context.fill()
            // Add a soft glow
            const gradient = context.createRadialGradient(16, 16, 4, 16, 16, 16)
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
            context.fillStyle = gradient
            context.fill()
        }
        const tex = new THREE.CanvasTexture(canvas)
        return tex
    }, [])

    const points = useRef<THREE.Points>(null!)

    const { positions, velocities, randomness } = useMemo(() => {
        const pos = new Float32Array(SNOW_COUNT * 3)
        const vel = new Float32Array(SNOW_COUNT * 3)
        const rand = new Float32Array(SNOW_COUNT)

        for (let i = 0; i < SNOW_COUNT; i++) {
            pos[i * 3] = (Math.random() - 0.5) * SNOW_RANGE
            pos[i * 3 + 1] = Math.random() * 20
            pos[i * 3 + 2] = (Math.random() - 0.5) * SNOW_RANGE

            vel[i * 3] = (Math.random() - 0.5) * 0.1
            vel[i * 3 + 1] = -(Math.random() * 0.05 + 0.02)
            vel[i * 3 + 2] = (Math.random() - 0.5) * 0.1

            rand[i] = Math.random()
        }

        return { positions: pos, velocities: vel, randomness: rand }
    }, [])

    useFrame((state) => {
        if (!points.current) return

        const positionsAttribute = points.current.geometry.getAttribute('position')

        for (let i = 0; i < SNOW_COUNT; i++) {
            let x = positionsAttribute.getX(i)
            let y = positionsAttribute.getY(i)
            let z = positionsAttribute.getZ(i)

            // Update position
            x += velocities[i * 3] + Math.sin(state.clock.elapsedTime + randomness[i] * 10) * 0.01
            y += velocities[i * 3 + 1]
            z += velocities[i * 3 + 2] + Math.cos(state.clock.elapsedTime + randomness[i] * 10) * 0.01

            // Reset
            if (y < -1) {
                y = 20
                x = (Math.random() - 0.5) * SNOW_RANGE
                z = (Math.random() - 0.5) * SNOW_RANGE
            }

            positionsAttribute.setXYZ(i, x, y, z)
        }

        positionsAttribute.needsUpdate = true
    })

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={SNOW_COUNT}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.15}
                color="white"
                transparent
                opacity={0.8}
                map={texture}
                alphaTest={0.01}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    )
}
