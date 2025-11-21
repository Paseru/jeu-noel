import { useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export default function MobileControls() {
    const { setJoystick, addLookDelta } = useGameStore()
    const joystickRef = useRef<HTMLDivElement>(null)
    const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)

    // Track specific touch IDs to avoid conflicts
    const joystickTouchId = useRef<number | null>(null)
    const cameraTouchId = useRef<number | null>(null)

    // Joystick Logic
    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault() // Prevent scrolling/zooming

        // If already dragging, ignore new touches
        if (joystickTouchId.current !== null) return

        const touch = e.changedTouches[0]
        joystickTouchId.current = touch.identifier
        setIsDragging(true)
        updateJoystick(touch)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        e.preventDefault()
        if (joystickTouchId.current === null) return

        // Find the touch that started the joystick
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId.current) {
                updateJoystick(e.changedTouches[i])
                break
            }
        }
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault()
        if (joystickTouchId.current === null) return

        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId.current) {
                setIsDragging(false)
                setJoystickPos({ x: 0, y: 0 })
                setJoystick(0, 0)
                joystickTouchId.current = null
                break
            }
        }
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
        setJoystick(dx / maxDist, dy / maxDist)
    }

    // Camera Logic
    const lastTouchRef = useRef<{ x: number, y: number } | null>(null)

    const handleCameraTouchStart = (e: React.TouchEvent) => {
        e.preventDefault()
        if (cameraTouchId.current !== null) return

        const touch = e.changedTouches[0]
        cameraTouchId.current = touch.identifier
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleCameraTouchMove = (e: React.TouchEvent) => {
        e.preventDefault()
        if (cameraTouchId.current === null || !lastTouchRef.current) return

        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === cameraTouchId.current) {
                const touch = e.changedTouches[i]
                const dx = touch.clientX - lastTouchRef.current.x
                const dy = touch.clientY - lastTouchRef.current.y

                addLookDelta(dx, dy)

                lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
                break
            }
        }
    }

    const handleCameraTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault()
        if (cameraTouchId.current === null) return

        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === cameraTouchId.current) {
                cameraTouchId.current = null
                lastTouchRef.current = null
                break
            }
        }
    }

    // Mic Toggle
    const isSpeaking = useGameStore((state) => state.players[useGameStore.getState().playerId || '']?.isSpeaking)
    const setSpeaking = useGameStore((state) => state.setSpeaking)

    return (
        // Changed md:hidden to lg:hidden to ensure it shows on landscape tablets/phones
        <div className="fixed inset-0 z-[2000] pointer-events-none flex select-none touch-none block lg:hidden">
            {/* Left Side: Joystick Zone */}
            <div
                className="absolute left-8 w-48 h-48 pointer-events-auto"
                style={{
                    bottom: 'max(2rem, env(safe-area-inset-bottom))'
                }}
            >
                {/* Mic Toggle Button */}
                <button
                    onTouchEnd={(e) => {
                        e.preventDefault()
                        setSpeaking(!isSpeaking)
                    }}
                    className={`absolute -top-20 left-0 w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${isSpeaking
                        ? 'bg-green-500/20 border-green-400 text-green-400'
                        : 'bg-white/10 border-white/20 text-white/40'
                        }`}
                >
                    {isSpeaking ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                            <path d="M12.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                            <path d="M10 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 0110 10.5z" />
                            <path fillRule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM20.25 12.75a.75.75 0 00-1.5 0v1.5c0 .409-.02.812-.058 1.209l1.495 1.495c.042-.886.063-1.786.063-2.704v-1.5z" clipRule="evenodd" />
                        </svg>
                    )}
                </button>

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
