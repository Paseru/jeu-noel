import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'

export const SUMMON_RADIUS = 6
export const SUMMON_COUNTDOWN_MS = 15000
const OFFSET_METERS = 10
const HEIGHT_TOLERANCE = 2.5
const GRACE_MS = 1200

export const ZombieSummonZone = () => {
    const phase = useGameStore((state) => state.phase)
    const mapLoaded = useGameStore((state) => state.mapLoaded)
    const rooms = useGameStore((state) => state.rooms)
    const currentRoomId = useGameStore((state) => state.currentRoomId)

    const spawnZombie = useGameStore((state) => state.spawnZombie)
    const setGatherState = useGameStore((state) => state.setGatherState)
    const resetGatherState = useGameStore((state) => state.resetGatherState)
    const setRoundActive = useGameStore((state) => state.setRoundActive)

    const ringRef = useRef<THREE.Mesh>(null)
    const discRef = useRef<THREE.Mesh>(null)
    const beaconRef = useRef<THREE.Mesh>(null)

    const statusRef = useRef<'idle' | 'countdown'>('idle')
    const countdownEndRef = useRef<number | null>(null)
    const graceUntilRef = useRef<number | null>(null)

    const spawnPoint = useMemo(() => {
        const room = rooms.find(r => r.id === currentRoomId)
        return room?.summonPoint || room?.zombieSpawnPoint || room?.spawnPoint || null
    }, [rooms, currentRoomId])

    const circleCenter = useMemo(() => {
        if (!spawnPoint) return null
        const spawnVec = new THREE.Vector3(spawnPoint[0], spawnPoint[1], spawnPoint[2])
        const towardsOrigin = new THREE.Vector3(0, spawnPoint[1], 0).sub(spawnVec)
        if (towardsOrigin.lengthSq() < 0.001) {
            towardsOrigin.set(0, 0, 1)
        }
        towardsOrigin.normalize().multiplyScalar(OFFSET_METERS)
        const center = spawnVec.clone().add(towardsOrigin)
        return center
    }, [spawnPoint])

    // Reset any ongoing countdown when map or room changes
    useEffect(() => {
        statusRef.current = 'idle'
        countdownEndRef.current = null
        graceUntilRef.current = null
        resetGatherState()
    }, [currentRoomId, mapLoaded, resetGatherState])

    useFrame((_state, delta) => {
        if (!circleCenter || phase !== 'PLAYING' || !mapLoaded) return

        // Animate visuals
        const pulse = (Math.sin(performance.now() / 500) + 1) * 0.5
        if (ringRef.current) {
            ringRef.current.rotation.z += delta * 0.5
            ringRef.current.scale.setScalar(1 + pulse * 0.08)
            const mat = ringRef.current.material as THREE.Material & { opacity?: number }
            if (mat.opacity !== undefined) mat.opacity = 0.35 + pulse * 0.15
        }
        if (discRef.current) {
            const mat = discRef.current.material as THREE.Material & { opacity?: number }
            if (mat.opacity !== undefined) mat.opacity = 0.12 + pulse * 0.1
        }
        if (beaconRef.current) {
            beaconRef.current.scale.y = 0.8 + pulse * 0.4
            const mat = beaconRef.current.material as THREE.MeshStandardMaterial
            if (mat.emissive) mat.emissiveIntensity = 1 + pulse * 0.6
        }

        const state = useGameStore.getState()
        const hasActiveZombie = state.roundActive || state.zombies.length > 0

        const players = Object.values(state.players)
        const alivePlayers = players.filter((p) => p && !p.isDead)

        const insideCount = alivePlayers.filter((p) => {
            const pos = p.position
            if (!pos) return false
            const dy = Math.abs(pos[1] - circleCenter.y)
            if (dy > HEIGHT_TOLERANCE) return false
            const dx = pos[0] - circleCenter.x
            const dz = pos[2] - circleCenter.z
            return Math.hypot(dx, dz) <= SUMMON_RADIUS
        }).length

        // While a zombie is active, keep state idle and exit early
        if (hasActiveZombie) {
            if (statusRef.current !== 'idle') {
                statusRef.current = 'idle'
                countdownEndRef.current = null
                graceUntilRef.current = null
            }

            const currentGather = state.gather
            if (
                currentGather.status !== 'idle' ||
                currentGather.inside !== insideCount ||
                currentGather.alive !== alivePlayers.length ||
                currentGather.total !== players.length
            ) {
                setGatherState({
                    status: 'idle',
                    countdownMs: null,
                    inside: insideCount,
                    alive: alivePlayers.length,
                    total: players.length
                })
            }
            return
        }

        const allInside = alivePlayers.length > 0 && insideCount === alivePlayers.length

        if (statusRef.current === 'idle' && allInside) {
            statusRef.current = 'countdown'
            countdownEndRef.current = performance.now() + SUMMON_COUNTDOWN_MS
            graceUntilRef.current = null
        } else if (statusRef.current === 'countdown') {
            if (!allInside) {
                if (!graceUntilRef.current) {
                    graceUntilRef.current = performance.now() + GRACE_MS
                } else if (performance.now() > graceUntilRef.current) {
                    statusRef.current = 'idle'
                    countdownEndRef.current = null
                    graceUntilRef.current = null
                }
            } else {
                graceUntilRef.current = null
            }

            if (
                statusRef.current === 'countdown' &&
                countdownEndRef.current &&
                performance.now() >= countdownEndRef.current
            ) {
                statusRef.current = 'idle'
                countdownEndRef.current = null
                graceUntilRef.current = null
                setRoundActive(true)
                spawnZombie()
            }
        }

        const remaining = statusRef.current === 'countdown' && countdownEndRef.current
            ? Math.max(0, countdownEndRef.current - performance.now())
            : null

        const roundedRemaining = remaining === null ? null : Math.max(0, Math.ceil(remaining / 100)) * 100
        const currentGather = state.gather

        if (
            currentGather.status !== statusRef.current ||
            currentGather.countdownMs !== roundedRemaining ||
            currentGather.inside !== insideCount ||
            currentGather.alive !== alivePlayers.length ||
            currentGather.total !== players.length
        ) {
            setGatherState({
                status: statusRef.current,
                countdownMs: roundedRemaining,
                inside: insideCount,
                alive: alivePlayers.length,
                total: players.length
            })
        }
    })

    if (!circleCenter || phase !== 'PLAYING' || !mapLoaded) return null

    return (
        <group position={[circleCenter.x, circleCenter.y + 0.05, circleCenter.z]}>
            <mesh ref={discRef} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[SUMMON_RADIUS * 0.72, 48]} />
                <meshStandardMaterial color={'#b50024'} transparent opacity={0.15} roughness={0.4} metalness={0.2} emissive={'#530010'} emissiveIntensity={0.5} />
            </mesh>

            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[SUMMON_RADIUS * 0.78, SUMMON_RADIUS, 80]} />
                <meshBasicMaterial color={'#ff2d55'} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>

            <mesh ref={beaconRef} position={[0, 0.6, 0]}>
                <cylinderGeometry args={[0.22, 0.6, 1.2, 14, 1, true]} />
                <meshStandardMaterial color={'#ff2d55'} transparent opacity={0.35} emissive={'#ff2d55'} emissiveIntensity={1.2} />
            </mesh>

            <pointLight color={'#ff2d55'} intensity={1.6} distance={14} decay={2} />
        </group>
    )
}
