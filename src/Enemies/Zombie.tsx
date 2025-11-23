import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { CapsuleCollider, RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier'
import { Group } from 'three'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// @ts-ignore three-pathfinding n'a pas de typings TS
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import RecastModule from 'recast-detour'
import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'
import { AudioLoader, PositionalAudio } from 'three'

const RUN_SPEED = 5
const ATTACK_RANGE = 1.0
const NAVMESH_PATH = '/navmesh/navmesh.glb'

type CrowdBundle = {
    recast: any,
    nav: any,
    crowd: any,
    lastUpdateTime: number
}

const crowdCache: Record<string, CrowdBundle> = {}
let recastPromise: Promise<any> | null = null

const loadRecast = () => {
    if (!recastPromise) {
        recastPromise = Promise.resolve(RecastModule).then((mod: any) =>
            typeof mod === 'function' ? mod() : mod
        )
    }
    return recastPromise
}

const geometryToVerts = (geom: THREE.BufferGeometry) => {
    const pos = geom.getAttribute('position')
    const idxAttr = geom.getIndex()
    const vertices = Array.from(pos.array as Iterable<number>)
    const indices = idxAttr ? Array.from(idxAttr.array as Iterable<number>) : Array.from({ length: pos.count }, (_, i) => i)
    return { vertices, indices }
}

const buildCrowdForNavmesh = async (key: string, geometry: THREE.BufferGeometry): Promise<CrowdBundle> => {
    if (crowdCache[key]) return crowdCache[key]
    const recast = await loadRecast()
    const { vertices, indices } = geometryToVerts(geometry)

    const cfg = new recast.rcConfig()
    // Basic params; navmesh already carved, so coarse settings are fine
    cfg.cs = 0.2
    cfg.ch = 0.2
    cfg.walkableSlopeAngle = 50
    cfg.walkableHeight = 2
    cfg.walkableClimb = 0.5
    cfg.walkableRadius = 0.35
    cfg.maxEdgeLen = 12
    cfg.maxSimplificationError = 1.3
    cfg.minRegionArea = 8
    cfg.mergeRegionArea = 20
    cfg.maxVertsPerPoly = 6
    cfg.detailSampleDist = 6
    cfg.detailSampleMaxError = 1

    // Compute bounds from vertices
    let minx = Infinity, miny = Infinity, minz = Infinity
    let maxx = -Infinity, maxy = -Infinity, maxz = -Infinity
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2]
        if (x < minx) minx = x
        if (y < miny) miny = y
        if (z < minz) minz = z
        if (x > maxx) maxx = x
        if (y > maxy) maxy = y
        if (z > maxz) maxz = z
    }
    cfg.bmin = { x: minx, y: miny, z: minz }
    cfg.bmax = { x: maxx, y: maxy, z: maxz }

    const nav = new recast.NavMesh()
    nav.build(vertices, vertices.length / 3, indices, indices.length, cfg)

    const crowd = new recast.Crowd(32, cfg.walkableRadius, nav.getNavMesh())
    crowd.setDefaultQueryExtent(new recast.Vec3(2, 4, 2))

    const bundle: CrowdBundle = { recast, nav, crowd, lastUpdateTime: -1 }
    crowdCache[key] = bundle
    return bundle
}

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
    const [navMeshGeometry, setNavMeshGeometry] = useState<THREE.BufferGeometry | null>(null)
    const lockIdRef = useRef<string>(`zombie-lock-${Math.random().toString(36).slice(2)}`)
    const agentRef = useRef<{ id: number | null, crowdKey: string | null }>({ id: null, crowdKey: null })
    const killCamTargetRef = useRef<THREE.Vector3 | null>(null)

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
            if (killCamTargetRef.current) {
                killCamTargetRef.current = null
                useGameStore.getState().setKillCamTarget(null)
            }
        }
    }, [])

    // Adapter le chemin du navmesh à la map courante
    useEffect(() => {
        const room = rooms.find(r => r.id === currentRoomId)
        const model = room?.modelPath?.toLowerCase() || ''

        let path = NAVMESH_PATH
        if (model.includes('taco')) path = '/navmesh/navmesh_tacos.glb'
        else if (model.includes('snow')) path = '/navmesh/navmesh.glb'
        else if (model) {
            const base = model.split('/').pop()?.replace(/\.(gltf|glb)$/i, '') || 'navmesh'
            path = `/navmesh/${base}.glb`
        }

        setNavMeshPath(path)
        setNavMeshGeometry(null)
    }, [currentRoomId, rooms])

    // Navmesh loading (silencieux si le fichier est absent)
    useEffect(() => {
        let cancelled = false
        if (!navMeshPath) return
        const loader = new GLTFLoader()
        loader.load(
            navMeshPath,
            (gltf) => {
                if (cancelled) return
                const mesh = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh | null
                if (mesh?.geometry) {
                    setNavMeshGeometry(mesh.geometry.clone())
                } else {
                    console.warn('[Zombie] navmesh loaded but no mesh found in glb')
                }
            },
            undefined,
            (err: any) => {
                console.warn('[Zombie] navmesh not found, fallback to raycast avoidance', err)
            }
        )
        return () => {
            cancelled = true
        }
    }, [navMeshPath])

    // Construire le crowd Detour une fois le navmesh chargé et enregistrer un agent
    useEffect(() => {
        let disposed = false
        if (!navMeshGeometry) return
        buildCrowdForNavmesh(navMeshPath, navMeshGeometry).then(bundle => {
            if (disposed) return
            const recast = bundle.recast
            const params = new recast.dtCrowdAgentParams()
            params.radius = 0.35
            params.height = 2
            params.maxAcceleration = 12
            params.maxSpeed = RUN_SPEED + 0.5
            params.collisionQueryRange = 2
            params.pathOptimizationRange = 6
            params.separationWeight = 2

            // Position de spawn projetée sur le navmesh
            const spawn = new recast.Vec3(spawnPoint[0], 0, spawnPoint[2])
            const closest = bundle.nav.getClosestPoint(spawn)
            const agentId = bundle.crowd.addAgent(closest, params)
            agentRef.current = { id: agentId, crowdKey: navMeshPath }
        }).catch(err => {
            console.warn('[Zombie] failed to init crowd', err)
        })

        return () => {
            disposed = true
            const bundle = agentRef.current.crowdKey ? crowdCache[agentRef.current.crowdKey] : null
            if (bundle && agentRef.current.id !== null && agentRef.current.id !== undefined) {
                try { bundle.crowd.removeAgent(agentRef.current.id) } catch (e) { /* ignore */ }
            }
            agentRef.current = { id: null, crowdKey: null }
        }
    }, [navMeshGeometry, navMeshPath, spawnPoint])

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

    useFrame((state, delta) => {
        const body = bodyRef.current
        if (!body) return

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
        const setKillCamTarget = useGameStore.getState().setKillCamTarget
        const isPlayerDead = useGameStore.getState().isPlayerDead
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
                if (!isPlayerDead && killCamTargetRef.current) {
                    killCamTargetRef.current = null
                    setKillCamTarget(null)
                }
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

        // Lock local player controls & force first-person when grabbed
        if (isLocalTarget && withinAttackRange) {
            lockMovement(lockIdRef.current)
            forceCameraMode('FIRST', lockIdRef.current)

            // Keep a live target for the killcam to aim the player's view at the attacker's face
            const headTarget = new THREE.Vector3(pos.x, pos.y + 0.9, pos.z)
            const lastTarget = killCamTargetRef.current
            if (!lastTarget || lastTarget.distanceTo(headTarget) > 0.05) {
                killCamTargetRef.current = headTarget.clone()
                setKillCamTarget([headTarget.x, headTarget.y, headTarget.z])
            }

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
            if (!isPlayerDead && killCamTargetRef.current) {
                killCamTargetRef.current = null
                setKillCamTarget(null)
            }
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
        // MOVEMENT LOGIC (Detour Crowd) with fallback
        // ---------------------------------------------------------
        playState('run')

        const bundle = agentRef.current.crowdKey ? crowdCache[agentRef.current.crowdKey] : null
        const agentId = agentRef.current.id

        if (bundle && agentId !== null && agentId !== undefined) {
            const recast = bundle.recast
            const dest = bundle.nav.getClosestPoint(new recast.Vec3(targetPos[0], 0, targetPos[2]))
            bundle.crowd.agentGoto(agentId, dest)

            const t = state.clock.elapsedTime
            if (bundle.lastUpdateTime !== t) {
                bundle.crowd.update(delta || 0.016)
                bundle.lastUpdateTime = t
            }

            const agentPos = bundle.crowd.getAgentPosition(agentId)
            const agentVel = bundle.crowd.getAgentVelocity(agentId)

            body.setTranslation({ x: agentPos.x, y: pos.y, z: agentPos.z }, true)
            body.setLinvel({ x: agentVel.x, y: body.linvel().y, z: agentVel.z }, true)

            const velDir = new THREE.Vector3(agentVel.x, 0, agentVel.z)
            if (velDir.lengthSq() > 0.0001 && modelRef.current) {
                const targetQuat = new THREE.Quaternion()
                targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(velDir.x, velDir.z))
                modelRef.current.quaternion.slerp(targetQuat, 0.25)
            }
        } else {
            // Fallback: simple steer if crowd not ready
            dir.y = 0
            const dirNorm = dir.lengthSq() > 0 ? dir.normalize() : new THREE.Vector3(0, 0, 0)
            const desiredDir = steerWithAvoidance(dirNorm, pos, world, body.handle)
            const hasDir = desiredDir.lengthSq() > 0.0001
            body.setLinvel({
                x: hasDir ? desiredDir.x * RUN_SPEED : 0,
                y: body.linvel().y,
                z: hasDir ? desiredDir.z * RUN_SPEED : 0
            }, true)
            if (modelRef.current && hasDir) {
                const targetQuat = new THREE.Quaternion()
                targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(desiredDir.x, desiredDir.z))
                modelRef.current.quaternion.slerp(targetQuat, 0.2)
            }
        }
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
