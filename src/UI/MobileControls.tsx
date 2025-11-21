import { useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export default function MobileControls() {
    const { setJoystick, addLookDelta } = useGameStore()
    const joystickRef = useRef<HTMLDivElement>(null)
    const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)

    // Joystick Logic
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true)
        updateJoystick(e.touches[0])
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isDragging) {
            updateJoystick(e.touches[0])
        }
    }

    const handleTouchEnd = () => {
        setIsDragging(false)
        setJoystickPos({ x: 0, y: 0 })
        setJoystick(0, 0)
    }

    const updateJoystick = (touch: React.Touch) => {
        if (!joystickRef.current) return

        const rect = joystickRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const maxDist = rect.width / 2

        let dx = touch.clientX - centerX
        let dy = touch.clientY - centerY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx)
            dx = Math.cos(angle) * maxDist
            dy = Math.sin(angle) * maxDist
        }

        setJoystickPos({ x: dx, y: dy })

        // Normalize output -1 to 1
        // Invert Y because screen Y is down, but we want up to be negative (forward)
        // Actually, let's keep it standard: -1 is up (forward), 1 is down (backward)
        setJoystick(dx / maxDist, dy / maxDist)
    }

    // Camera Logic
    const lastTouchRef = useRef<{ x: number, y: number } | null>(null)

    const handleCameraTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0]
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleCameraTouchMove = (e: React.TouchEvent) => {
        if (!lastTouchRef.current) return

        const touch = e.touches[0]
        const dx = touch.clientX - lastTouchRef.current.x
        const dy = touch.clientY - lastTouchRef.current.y

        addLookDelta(dx, dy)

        lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleCameraTouchEnd = () => {
        lastTouchRef.current = null
    }

    return (
        <div className="fixed inset-0 z-50 pointer-events-none flex select-none touch-none block md:hidden">
            {/* Left Side: Joystick Zone */}
            <div
                className="absolute left-8 w-48 h-48 pointer-events-auto"
                style={{
                    bottom: 'max(2rem, env(safe-area-inset-bottom))'
                }}
            >
                <div
                    ref={joystickRef}
                    className="w-full h-full rounded-full bg-white/10 backdrop-blur-sm border border-white/20 relative flex items-center justify-center"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Joystick Knob */}
                    <div
                        className="w-16 h-16 rounded-full bg-white/50 shadow-lg absolute"
                        style={{
                            transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                        }}
                    />
                </div>
            </div>

            {/* Right Side: Camera Zone */}
            <div
                className="absolute top-0 right-0 w-1/2 h-full pointer-events-auto"
                onTouchStart={handleCameraTouchStart}
                onTouchMove={handleCameraTouchMove}
                onTouchEnd={handleCameraTouchEnd}
            />
        </div>
    )
}
