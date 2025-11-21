import { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'

interface DoorProps {
    object: THREE.Object3D
}

export const Door = ({ object }: DoorProps) => {
    const group = useRef<THREE.Group>(null)
    const rigidBody = useRef<RapierRigidBody>(null)
    const [isOpen, setIsOpen] = useState(false)
    const setInteractionText = useGameStore((state) => state.setInteractionText)
    const { camera } = useThree()
    // const [subscribeKeys, getKeys] = useKeyboardControls()

    // Store initial transform
    const initialPosition = useRef(object.position.clone())
    const initialQuaternion = useRef(object.quaternion.clone())
    const initialScale = useRef(object.scale.clone())

    // Calculate door dimensions for collider
    const dimensions = useRef(new THREE.Vector3())

    useEffect(() => {
        const box = new THREE.Box3().setFromObject(object)
        box.getSize(dimensions.current)
    }, [object])

    // Target rotation
    const targetRotation = useRef(initialQuaternion.current.clone())

    useFrame(() => {
        if (!group.current || !rigidBody.current) return

        const playerPos = camera.position
        const doorPos = group.current.getWorldPosition(new THREE.Vector3())
        const distance = playerPos.distanceTo(doorPos)

        // Interaction Logic
        if (distance < 2.5) {
            setInteractionText(isOpen ? "Press E to Close" : "Press E to Open")

            // const { interact } = getKeys()
            // We'll use a direct key listener for now to be safe if 'interact' isn't in controls
        } else {
            // Only clear if we were the ones setting it (simple check: distance)
            // In a real app, we'd check if ID matches, but this is fine for now
            if (useGameStore.getState().interactionText?.includes("Press E")) {
                setInteractionText(null)
            }
        }

        // Smooth Rotation Logic
        group.current.quaternion.slerp(targetRotation.current, 0.1)

        // Sync Physics
        rigidBody.current.setNextKinematicRotation(group.current.quaternion)
    })

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyE') {
                const playerPos = camera.position
                const doorPos = group.current?.getWorldPosition(new THREE.Vector3())

                if (doorPos && playerPos.distanceTo(doorPos) < 2.5) {
                    setIsOpen(prev => {
                        const newState = !prev

                        if (newState) {
                            // Opening: Rotate AWAY from player
                            const doorForward = new THREE.Vector3(0, 0, 1).applyQuaternion(initialQuaternion.current)
                            const playerDir = new THREE.Vector3().subVectors(playerPos, doorPos).normalize()

                            // Dot product to check if player is in front or behind
                            // We want to rotate 90 degrees. Direction depends on side.
                            const dot = doorForward.dot(playerDir)
                            const rotationAxis = new THREE.Vector3(0, 1, 0)
                            const angle = dot > 0 ? -Math.PI / 2 : Math.PI / 2

                            const rotationQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle)
                            targetRotation.current = initialQuaternion.current.clone().multiply(rotationQuat)
                        } else {
                            // Closing: Return to initial
                            targetRotation.current = initialQuaternion.current.clone()
                        }

                        return newState
                    })
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [camera])

    return (
        <RigidBody
            ref={rigidBody}
            type="kinematicPosition"
            colliders={false} // We'll add custom collider
            position={initialPosition.current}
        // quaternion={initialQuaternion.current} // Controlled by logic
        >
            <group ref={group} quaternion={initialQuaternion.current} scale={initialScale.current}>
                <primitive object={object} position={[0, 0, 0]} rotation={[0, 0, 0]} />
            </group>

            {/* Approximate collider - assuming door is roughly box shaped */}
            {/* We center it based on the object's bounding box center relative to its position */}
            <CuboidCollider
                args={[dimensions.current.x / 2, dimensions.current.y / 2, dimensions.current.z / 2]}
            // Adjust center if needed, but usually GLTF origins are bottom-center or center-center
            // For doors, often bottom-corner. We might need to adjust.
            // For now, let's assume the mesh is centered enough or rely on visual mesh for physics if it was convex
            />
        </RigidBody>
    )
}
