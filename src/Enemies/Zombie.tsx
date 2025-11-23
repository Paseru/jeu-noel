import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier'
import { Group } from 'three'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as YUKA from 'yuka'
import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'
import { AudioLoader, PositionalAudio } from 'three'

const RUN_SPEED = 5
const ATTACK_RANGE = 1.0
const NAVMESH_PATH = '/navmesh/navmesh_snowy_village.glb'

type ZombieState = 'idle' | 'run' | 'attack'

interface ZombieProps {
    spawnPoint: [number, number, number]
}

export function Zombie({ spawnPoint }: ZombieProps) {
    const { currentRoomId, rooms } = useGameStore()
    const bodyRef = useRef<RapierRigidBody>(null!)
    const modelRef = useRef<Group>(null)
    const { scene, animations } = useGLTF('/models/zombies/terror_engine_-_psycho_zombie.glb')
    const cloneScene = useMemo(() => clone(scene), [scene])
    const { actions } = useAnimations(animations, modelRef)
    const { rapier, world } = useRapier()
    const [currentState, setCurrentState] = useState<ZombieState>('idle')
    const attackStartRef = useRef<number | null>(null)
    const attackDurationRef = useRef<number>(1)
    const attackAppliedRef = useRef<boolean>(false)
    const attackLockUntilRef = useRef<number>(0) // timestamp in ms
    const attackClipDuration = useMemo(() => {
        const clip = animations.find(a => a.name.toLowerCase().includes('attack'))
        return clip?.duration || 1.167
    }, [animations])
    const zombieSoundRef = useRef<PositionalAudio | null>(null)
    const agonyBufferRef = useRef<AudioBuffer | null>(null)
    const wasCloseRef = useRef<boolean>(false)
    const [navMeshPath, setNavMeshPath] = useState<string>(NAVMESH_PATH)
    const yukaNavMeshRef = useRef<any | null>(null)
    const pathRef = useRef<THREE.Vector3[]>([])
    const waypointIndexRef = useRef<number>(0)
    const lastTargetRef = useRef<THREE.Vector3 | null>(null)
    const lastReplanRef = useRef<number>(0)
    const stuckCounterRef = useRef<number>(0)
    const lastPosRef = useRef<THREE.Vector3 | null>(null)
    const lockIdRef = useRef<string>(`zombie-lock-${Math.random().toString(36).slice(2)}`)
    const lastWpDistRef = useRef<number | null>(null)
    const noImproveCounterRef = useRef<number>(0)
    const stuckTimeRef = useRef<number>(0)
    const lastUpdateMsRef = useRef<number | null>(null)

    // Helper to find actions by partial name (case insensitive)
    const findAction = (name: string) => {
        const clip = animations.find(a => a.name.toLowerCase().includes(name.toLowerCase()))
        return clip ? actions[clip.name] : null
    }

    const playState = (next: ZombieState) => {
        if (next === currentState) return
        const idle = findAction('idle') || actions[Object.keys(actions)[0]]
        const run = findAction('run')
        const attack = findAction('attack')

        const fade = (action: THREE.AnimationAction | null | undefined) => {
            if (action) action.reset().fadeIn(0.2).play()
        }
        // Fade out others
        Object.values(actions).forEach(act => {
            if (act) act.fadeOut(0.15)
        })

        if (next === 'idle') {
            attackStartRef.current = null
            attackAppliedRef.current = false
            fade(idle)
        }
        if (next === 'run') {
            attackStartRef.current = null
            attackAppliedRef.current = false
            fade(run || idle)
        }
        if (next === 'attack') {
            const now = performance.now()
            const clipDuration = attack?.getClip()?.duration || attackClipDuration
            if (now < attackLockUntilRef.current) return // prevent spam/restart while attack is active
            attackLockUntilRef.current = now + clipDuration * 1000

            attackStartRef.current = performance.now()
            attackAppliedRef.current = false
            attackDurationRef.current = clipDuration
            fade(attack || run || idle)
        }
        setCurrentState(next)
    }

    // Initial idle
    useEffect(() => {
        playState('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Looping zombie growl (positional)
    useEffect(() => {
        const listener = useVoiceStore.getState().audioListener
        if (!listener) return
        const loader = new AudioLoader()
        let disposed = false
        loader.load('/sounds/zombie/zombie sound.mp3', (buffer) => {
            if (disposed) return
            const sound = new PositionalAudio(listener)
            zombieSoundRef.current = sound
            sound.setBuffer(buffer)
            sound.setLoop(true)
            sound.setVolume(0.4)
            sound.setRefDistance(1.5)
            sound.setMaxDistance(10)
            sound.setRolloffFactor(2)
            if (modelRef.current) {
                modelRef.current.add(sound)
            }
            sound.play()
        })

        return () => {
            disposed = true
            if (zombieSoundRef.current) {
                zombieSoundRef.current.stop()
                zombieSoundRef.current.disconnect()
                zombieSoundRef.current = null
            }
        }
    }, [])

    // Preload player agony sound once (used when a zombie reaches the player)
    useEffect(() => {
        const loader = new AudioLoader()
        loader.load('/sounds/player/death/agonie.mp3', (buffer) => {
            agonyBufferRef.current = buffer
        })
    }, [])

    // Clean up any locks if the zombie gets unmounted
    useEffect(() => {
        return () => {
            if (wasCloseRef.current) {
                useGameStore.getState().unlockMovement(lockIdRef.current)
                useGameStore.getState().releaseCameraMode(lockIdRef.current)
            }
        }
    }, [])

    // Adapter le chemin du navmesh à la map courante
    useEffect(() => {
        const room = rooms.find(r => r.id === currentRoomId)
        const model = room?.modelPath?.toLowerCase() || ''

        // Priorité au chemin explicite fourni par la salle (plus fiable que les heuristiques sur le nom du fichier)
        let path = room?.navMeshPath

        // Fallbacks pour compatibilité rétro et vieilles rooms sans navMeshPath
        if (!path) {
            if (model.includes('taco')) path = '/navmesh/navmesh_tacos.glb'
            else if (model.includes('snow')) path = NAVMESH_PATH
            else if (model) {
                const base = model.split('/').pop()?.replace(/\.(gltf|glb)$/i, '') || 'navmesh'
                path = `/navmesh/${base}.glb`
            }
        }

        setNavMeshPath(path || NAVMESH_PATH)
        yukaNavMeshRef.current = null
        pathRef.current = []
        waypointIndexRef.current = 0
    }, [currentRoomId, rooms])

    // Charger le navmesh Yuka (silencieux si le fichier est absent)
    useEffect(() => {
        let cancelled = false
        if (!navMeshPath) return
        const loader = new YUKA.NavMeshLoader()
        loader.load(navMeshPath).then((navMesh: any) => {
            if (cancelled) return
            yukaNavMeshRef.current = navMesh
            console.info('[Zombie] yuka navmesh loaded', navMeshPath)
        }).catch((err: any) => {
            console.warn('[Zombie] navmesh not found, fallback to raycast avoidance', err)
        })
        return () => {
            cancelled = true
        }
    }, [navMeshPath])

    const replanPath = (start: THREE.Vector3, target: THREE.Vector3) => {
        const nav = yukaNavMeshRef.current
        if (!nav) return false

        const from = new YUKA.Vector3(start.x, start.y, start.z)
        const to = new YUKA.Vector3(target.x, target.y, target.z)
        const fromRegion = nav.getClosestRegion(from)
        const toRegion = nav.getClosestRegion(to)
        const path = nav.findPath(fromRegion ? fromRegion.centroid : from, toRegion ? toRegion.centroid : to)

        if (path && path.length > 0) {
            pathRef.current = path.map((p: any) => new THREE.Vector3(p.x, p.y, p.z))
            waypointIndexRef.current = 0
            lastTargetRef.current = target.clone()
            lastReplanRef.current = performance.now()
            console.info('[Zombie] yuka path len', path.length)
            return true
        }

        console.warn('[Zombie] navmesh path failed, fallback to raycast')
        return false
    }

    // Calcul direction avec évitement local + slide
    const steerWithAvoidance = (
        dir: THREE.Vector3,
        pos: { x: number, y: number, z: number },
        world: any,
        excludeRigidBodyHandle?: number
    ) => {
        const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3]
        let bestDir = dir.clone()
        let bestScore = -Infinity

        // Points de départ des rayons: centre + épaules pour sentir les piliers
        const upOffset = 0.4
        const base = new THREE.Vector3(pos.x, pos.y + upOffset, pos.z)
        const right = new THREE.Vector3(dir.z, 0, -dir.x)
        if (right.lengthSq() < 1e-5) right.set(1, 0, 0)
        right.normalize()
        const origins = [
            base,
            base.clone().add(right.clone().multiplyScalar(0.35)),
            base.clone().add(right.clone().multiplyScalar(-0.35))
        ]

        // Check collision droit devant pour déclencher un pivot franc
        let frontHitDist = Infinity
        let frontHitNormal: THREE.Vector3 | null = null
        {
            const ray = new rapier.Ray(
                new rapier.Vector3(base.x, base.y, base.z),
                new rapier.Vector3(dir.x, 0, dir.z)
            )
            const hit = world.castRayAndGetNormal(ray, 1.4, true, undefined, undefined, undefined, excludeRigidBodyHandle) as any
            if (hit) {
                frontHitDist = hit.toi
                if (hit.normal) frontHitNormal = new THREE.Vector3(hit.normal.x, 0, hit.normal.z).normalize()
            }
        }

        for (const angle of angles) {
            const testDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
            let closestHit = 3
            let hitNormal: THREE.Vector3 | null = null

            for (const o of origins) {
                const ray = new rapier.Ray(
                    new rapier.Vector3(o.x, o.y, o.z),
                    new rapier.Vector3(testDir.x, 0, testDir.z)
                )
                // Exclure le corps du zombie pour éviter l'auto-hit
                const hit = world.castRayAndGetNormal(
                    ray,
                    2.4,
                    true,
                    undefined,
                    undefined,
                    undefined,
                    excludeRigidBodyHandle
                ) as any
                if (hit && hit.toi < closestHit) {
                    closestHit = hit.toi
                    if (hit.normal) {
                        hitNormal = new THREE.Vector3(hit.normal.x, 0, hit.normal.z).normalize()
                    }
                }
            }

            let score = closestHit - Math.abs(angle) * 0.5
            let candidate = testDir
            if (hitNormal && closestHit < 0.9) {
                const slide = testDir.clone().projectOnPlane(hitNormal).normalize()
                candidate = slide.lengthSq() > 0 ? slide : testDir
                score -= 0.3
            }

            // Pivot d'urgence si un obstacle est très proche devant
            if (frontHitDist < 0.7 && frontHitNormal) {
                const left = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
                const right = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
                // Choisir côté le plus opposé à la normale
                const goLeft = left.dot(frontHitNormal) < right.dot(frontHitNormal)
                candidate = goLeft ? left.normalize() : right.normalize()
                score = 5 // force la priorité
            }
            if (score > bestScore) {
                bestScore = score
                bestDir = candidate
            }
        }
        return bestDir.normalize()
    }

    useFrame(() => {
        const body = bodyRef.current
        if (!body) return

        const nowMs = performance.now()
        const dt = lastUpdateMsRef.current ? (nowMs - lastUpdateMsRef.current) / 1000 : 1 / 60
        lastUpdateMsRef.current = nowMs

        // Current position
        const pos = body.translation()

        // Pick nearest player (includes self thanks to setLocalPlayerTransform)
        const players = useGameStore.getState().players as Record<string, { position: [number, number, number], isDead?: boolean }>
        const localId = useGameStore.getState().playerId
        const setPlayerDead = useGameStore.getState().setPlayerDead
        const lockMovement = useGameStore.getState().lockMovement
        const unlockMovement = useGameStore.getState().unlockMovement
        const forceCameraMode = useGameStore.getState().forceCameraMode
        const releaseCameraMode = useGameStore.getState().releaseCameraMode
        const sfxVolume = useGameStore.getState().volumes.sfx
        let nearest: { id: string, position: [number, number, number] } | null = null
        let minDist = Infinity

        Object.entries(players).forEach(([id, p]) => {
            if (!p || p.isDead) return
            const d = Math.hypot(
                p.position[0] - pos.x,
                p.position[1] - pos.y,
                p.position[2] - pos.z
            )
            if (d < minDist) {
                minDist = d
                nearest = { id, position: p.position }
            }
        })

        if (!nearest) {
            if (wasCloseRef.current) {
                unlockMovement(lockIdRef.current)
                releaseCameraMode(lockIdRef.current)
                wasCloseRef.current = false
            }
            playState('idle')
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)
            return
        }

        const nearestTarget = nearest as { id: string, position: [number, number, number] }

        // Direction on XZ plane
        const targetPos = nearestTarget.position
        const currentPosVector = new THREE.Vector3(pos.x, pos.y, pos.z)
        const targetVector = new THREE.Vector3(targetPos[0], pos.y, targetPos[2])
        const dir = targetVector.clone().sub(currentPosVector)
        const flatLen = Math.hypot(dir.x, dir.z)
        const isLocalTarget = nearestTarget.id === localId
        const withinAttackRange = flatLen < ATTACK_RANGE

        // Lock local player controls & force 3rd person when grabbed
        if (isLocalTarget && withinAttackRange) {
            lockMovement(lockIdRef.current)
            forceCameraMode('THIRD', lockIdRef.current)

            // Play agony sound once when entering the grab range
            if (!wasCloseRef.current) {
                const listener = useVoiceStore.getState().audioListener
                if (listener && agonyBufferRef.current) {
                    const sound = new PositionalAudio(listener)
                    sound.setBuffer(agonyBufferRef.current)
                    sound.setLoop(false)
                    sound.setVolume(0.8 * sfxVolume)
                    sound.setRefDistance(1.5)
                    sound.setMaxDistance(12)
                    sound.setRolloffFactor(1.5)
                    sound.position.set(targetPos[0], targetPos[1], targetPos[2])
                    modelRef.current?.add(sound)
                    sound.play()
                    sound.source?.addEventListener('ended', () => {
                        sound.disconnect()
                        modelRef.current?.remove(sound)
                    })
                }
            }
            wasCloseRef.current = true
        } else if (wasCloseRef.current) {
            unlockMovement(lockIdRef.current)
            releaseCameraMode(lockIdRef.current)
            wasCloseRef.current = false
        }

        // ---------------------------------------------------------
        // ATTACK LOGIC
        // ---------------------------------------------------------
        
        // If we are currently attacking, handle the animation/damage lifecycle
        if (currentState === 'attack') {
            // Look at player while attacking (optional, but good for realism)
            // dir is not normalized yet, but we can use it
            if (modelRef.current) {
                const lookDir = dir.clone().normalize()
                const targetQuat = new THREE.Quaternion()
                targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(lookDir.x, lookDir.z))
                modelRef.current.quaternion.slerp(targetQuat, 0.1)
            }

            // Stop movement
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)

            if (attackStartRef.current !== null) {
                const elapsed = (performance.now() - attackStartRef.current) / 1000
                
                // Attempt damage at 90% of animation
                if (!attackAppliedRef.current && elapsed >= attackDurationRef.current * 0.9) {
                    // Check hit range (slightly forgiving)
                    if (flatLen < ATTACK_RANGE + 0.5) {
                        attackAppliedRef.current = true
                        if (nearestTarget.id === localId && !useGameStore.getState().isPlayerDead) {
                            setPlayerDead(true)
                            if (document.pointerLockElement) document.exitPointerLock()
                        }
                    }
                }

                // End attack when animation finishes
                if (elapsed >= attackDurationRef.current) {
                    playState('run')
                }
            }
            
            // Skip movement logic while attacking
            return
        }

        // Attempt to start attack if in range
        if (withinAttackRange) {
            playState('attack')
            // If we successfully switched to attack, return to stop movement logic for this frame
            // (We rely on the next frame to catch 'currentState === attack')
            // However, playState might fail due to lock. 
            // If it failed (still 'run' or 'idle'), we should probably stop or idle if we are VERY close.
            
            // Check if switch happened (using a small delay or just assuming logic holds)
            // Ideally playState would return success. 
            // Let's just verify state in next frame. But for this frame, if we are that close, stop moving.
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true)
            return 
        }

        // ---------------------------------------------------------
        // MOVEMENT LOGIC
        // ---------------------------------------------------------
        playState('run')

        dir.y = 0
        const dirNorm = dir.lengthSq() > 0 ? dir.normalize() : new THREE.Vector3(0, 0, 0)
        let desiredDir = dirNorm.clone()

        // Replan si navmesh dispo et cible a bougé / pas de path / path épuisé
        const targetVec3 = new THREE.Vector3(targetPos[0], pos.y, targetPos[2])
        const now = performance.now()
        const targetMoved = lastTargetRef.current ? lastTargetRef.current.distanceTo(targetVec3) > 1 : true
        const pathEmpty = pathRef.current.length === 0 || waypointIndexRef.current >= pathRef.current.length
        const replanCooldown = now - lastReplanRef.current > 1500
        if (yukaNavMeshRef.current && (targetMoved || pathEmpty || replanCooldown)) {
            replanPath(currentPosVector, targetVec3)
        }

        // Suivi de waypoint si path navmesh
        if (pathRef.current.length > 0 && waypointIndexRef.current < pathRef.current.length) {
            const waypoint = pathRef.current[waypointIndexRef.current]
            const toWaypoint = waypoint.clone().sub(currentPosVector)
            toWaypoint.y = 0
            const distWp = toWaypoint.length()
            // Mesure de progrès vers le waypoint pour détecter blocage
            if (lastWpDistRef.current !== null && distWp > lastWpDistRef.current - 0.05) {
                noImproveCounterRef.current += 1
            } else {
                noImproveCounterRef.current = 0
            }
            lastWpDistRef.current = distWp

            if (noImproveCounterRef.current > 30) { // ~0.5s à 60fps
                replanPath(currentPosVector, targetVec3)
                waypointIndexRef.current = 0
                noImproveCounterRef.current = 0
                // petit pivot pour décrocher
                desiredDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2)
            }

            if (distWp < 0.35 && waypointIndexRef.current < pathRef.current.length - 1) {
                waypointIndexRef.current += 1
            }
            if (distWp > 0.05) {
                desiredDir = toWaypoint.normalize()
            }
        }

        // Anti stuck : si on ne bouge pas, on replanifie et on ajoute une légère dérive
        if (lastPosRef.current) {
            const moved = currentPosVector.clone().sub(lastPosRef.current).lengthSq()
            if (moved < 0.0004) {
                stuckCounterRef.current += 1
                if (stuckCounterRef.current > 45) {
                    replanPath(currentPosVector, targetVec3)
                    waypointIndexRef.current = 0
                    stuckCounterRef.current = 0
                    // petit pivot aléatoire pour se décrocher
                    desiredDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2)
                }
            } else {
                stuckCounterRef.current = 0
            }
        }
        lastPosRef.current = currentPosVector.clone()

        // Détection de stagnation (vitesse quasi nulle)
        const linvel = body.linvel()
        const speed = Math.hypot(linvel.x, linvel.z)
        if (speed < 0.1) stuckTimeRef.current += dt
        else stuckTimeRef.current = 0

        // Stratégie anti-stuck : pas de côté puis recul avant téléport filet
        let moveCandidate = desiredDir.clone()
        if (stuckTimeRef.current > 0.6 && stuckTimeRef.current < 1.5) {
            const side = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2
            moveCandidate = desiredDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), side)
        } else if (stuckTimeRef.current >= 1.5 && stuckTimeRef.current < 2.0) {
            moveCandidate = desiredDir.clone().negate()
        }

        // Évitement local + slide sur normale
        const moveDir = steerWithAvoidance(moveCandidate, pos, world, body.handle)

        const hasDir = moveDir.lengthSq() > 0.0001

        // Apply velocity
        body.setLinvel({
            x: hasDir ? moveDir.x * RUN_SPEED : 0,
            y: body.linvel().y,
            z: hasDir ? moveDir.z * RUN_SPEED : 0
        }, true)

        // Rotate visual model toward movement direction
        if (modelRef.current && hasDir) {
            const targetQuat = new THREE.Quaternion()
            targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(moveDir.x, moveDir.z))
            modelRef.current.quaternion.slerp(targetQuat, 0.2)
        }

        // Filet de sécurité désactivé (Yuka clamp possible, mais on reste soft pour éviter les sauts visibles)
    })

    return (
        <RigidBody
            ref={bodyRef}
            colliders={false}
            friction={0.5}
            mass={10}
            position={spawnPoint}
            enabledRotations={[false, false, false]}
        >
            <CapsuleCollider args={[0.5, 0.25]} />
            <group ref={modelRef} position={[0, -0.55, 0]} scale={0.5}>
                <primitive object={cloneScene} />
            </group>
        </RigidBody>
    )
}

useGLTF.preload('/models/zombies/terror_engine_-_psycho_zombie.glb')
