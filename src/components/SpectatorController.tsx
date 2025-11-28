import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../stores/useGameStore'

export const SpectatorController = () => {
    const { camera } = useThree()
    const spectatingPlayerId = useGameStore((state) => state.spectatingPlayerId)
    const players = useGameStore((state) => state.players)
    
    const targetPosition = useRef(new THREE.Vector3())
    const cameraOffset = useRef(new THREE.Vector3(0, 3, 5))
    
    useFrame(() => {
        if (!spectatingPlayerId) return
        
        const player = players[spectatingPlayerId]
        if (!player) return
        
        // Target position is player position
        targetPosition.current.set(
            player.position[0],
            player.position[1],
            player.position[2]
        )
        
        // Camera follows from behind/above
        const playerQuat = new THREE.Quaternion(
            player.quaternion[0],
            player.quaternion[1],
            player.quaternion[2],
            player.quaternion[3]
        )
        
        // Calculate offset based on player rotation
        const offset = cameraOffset.current.clone()
        offset.applyQuaternion(playerQuat)
        
        const desiredCameraPos = targetPosition.current.clone().add(offset)
        
        // Smoothly move camera
        camera.position.lerp(desiredCameraPos, 0.1)
        
        // Look at player
        const lookTarget = targetPosition.current.clone()
        lookTarget.y += 1 // Look at head level
        camera.lookAt(lookTarget)
    })
    
    // Handle keyboard controls for switching players
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                useGameStore.getState().nextSpectatorTarget()
            } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                useGameStore.getState().prevSpectatorTarget()
            }
        }
        
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])
    
    return null
}

export default SpectatorController
