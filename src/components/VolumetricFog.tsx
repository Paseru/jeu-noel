import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const FOG_COUNT = 3000
const FOG_RANGE_X = 120
const FOG_RANGE_Z = 120
const FOG_MIN_Y = -15
const FOG_MAX_Y = 25

export const VolumetricFog = () => {
    const points = useRef<THREE.Points>(null!)

    const texture = useMemo(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const ctx = canvas.getContext('2d')
        if (ctx) {
            const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
            gradient.addColorStop(0.3, 'rgba(240, 240, 245, 0.5)')
            gradient.addColorStop(0.6, 'rgba(220, 220, 230, 0.2)')
            gradient.addColorStop(1, 'rgba(200, 200, 210, 0)')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, 64, 64)
        }
        const tex = new THREE.CanvasTexture(canvas)
        return tex
    }, [])

    const { positions, velocities, sizes } = useMemo(() => {
        const pos = new Float32Array(FOG_COUNT * 3)
        const vel = new Float32Array(FOG_COUNT * 3)
        const siz = new Float32Array(FOG_COUNT)

        for (let i = 0; i < FOG_COUNT; i++) {
            pos[i * 3] = (Math.random() - 0.5) * FOG_RANGE_X
            pos[i * 3 + 1] = FOG_MIN_Y + Math.random() * (FOG_MAX_Y - FOG_MIN_Y)
            pos[i * 3 + 2] = (Math.random() - 0.5) * FOG_RANGE_Z

            vel[i * 3] = (Math.random() - 0.5) * 0.3
            vel[i * 3 + 1] = (Math.random() - 0.5) * 0.1
            vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3

            siz[i] = 8 + Math.random() * 25
        }

        return { positions: pos, velocities: vel, sizes: siz }
    }, [])

    useFrame((state) => {
        if (!points.current) return

        const posAttr = points.current.geometry.getAttribute('position')
        const time = state.clock.elapsedTime

        for (let i = 0; i < FOG_COUNT; i++) {
            let x = posAttr.getX(i)
            let y = posAttr.getY(i)
            let z = posAttr.getZ(i)

            x += velocities[i * 3] * 0.016 + Math.sin(time * 0.5 + i) * 0.02
            y += velocities[i * 3 + 1] * 0.016 + Math.sin(time * 0.3 + i * 0.5) * 0.01
            z += velocities[i * 3 + 2] * 0.016 + Math.cos(time * 0.4 + i) * 0.02

            if (x > FOG_RANGE_X / 2) x = -FOG_RANGE_X / 2
            if (x < -FOG_RANGE_X / 2) x = FOG_RANGE_X / 2
            if (z > FOG_RANGE_Z / 2) z = -FOG_RANGE_Z / 2
            if (z < -FOG_RANGE_Z / 2) z = FOG_RANGE_Z / 2
            if (y > FOG_MAX_Y) y = FOG_MIN_Y
            if (y < FOG_MIN_Y) y = FOG_MAX_Y

            posAttr.setXYZ(i, x, y, z)
        }

        posAttr.needsUpdate = true
    })

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={FOG_COUNT}
                    array={positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-size"
                    count={FOG_COUNT}
                    array={sizes}
                    itemSize={1}
                />
            </bufferGeometry>
            <pointsMaterial
                size={18}
                color="#e8e8f0"
                transparent
                opacity={0.35}
                map={texture}
                alphaTest={0.01}
                depthWrite={false}
                blending={THREE.NormalBlending}
                sizeAttenuation={true}
            />
        </points>
    )
}
