import { useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

interface MobileControlsProps {
    onOpenMenu: () => void
}

export default function MobileControls({ onOpenMenu }: MobileControlsProps) {
    const { setJoystick, addLookDelta, setMobileJump, setMobileRun, setMobileAttack } = useGameStore()
    const joystickRef = useRef<HTMLDivElement>(null)
    const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)

    // Track specific touch IDs to avoid conflicts
    const joystickTouchId = useRef<number | null>(null)
    const cameraTouchId = useRef<number | null>(null)

    // Mic Toggle
    const playerId = useGameStore((state) => state.playerId)
    const isSpeaking = useGameStore((state) => playerId ? state.players[playerId]?.isSpeaking : false)
    const setSpeaking = useGameStore((state) => state.setSpeaking)
    
    // Attack Button Visibility
    const isInfected = useGameStore((state) => state.isInfected)
    const infectedGameState = useGameStore((state) => state.infectedGameState)

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

    return (
        // Changed md:hidden to lg:hidden to ensure it shows on landscape tablets/phones
        <div className="fixed inset-0 z-[2000] pointer-events-none flex select-none touch-none block lg:hidden">

            {/* Settings Button (Top Left) - Redirects to Pause Menu */}
            <button
                onTouchEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onOpenMenu()
                }}
                className="absolute top-4 left-4 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white pointer-events-auto active:scale-95 transition-transform z-[2001]"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>

            {/* Mic Toggle Button (Moved outside joystick, positioned above it) */}
            <button
                onTouchEnd={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSpeaking(!isSpeaking)
                }}
                className={`absolute left-8 w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md border transition-all pointer-events-auto active:scale-95 z-[2001] ${isSpeaking
                    ? 'bg-green-500/80 border-green-400 text-white shadow-[0_0_15px_rgba(74,222,128,0.5)]'
                    : 'bg-red-500/40 border-red-400/50 text-white/90'
                    }`}
                style={{
                    bottom: 'calc(max(2rem, env(safe-area-inset-bottom)) + 12rem)' // Positioned above joystick
                }}
            >
                {isSpeaking ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                        <path fillRule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM15.75 4.5a3.75 3.75 0 10-7.5 0v3.682l7.5 7.5V4.5zM8.25 9.818v2.932a3.75 3.75 0 004.5 3.682v-2.114a5.25 5.25 0 01-6.75-2.064V9.818zM16.5 13.282v-1.532a5.25 5.25 0 00-3.065-4.824l1.965 1.965A5.237 5.237 0 0116.5 11.75zM12.75 19.459V21a.75.75 0 01-1.5 0v-1.541a6.75 6.75 0 01-5.166-5.209.75.75 0 011.492-.15 5.25 5.25 0 003.674 3.884v.016h.001v-.016a5.25 5.25 0 002.874-1.154l1.02 1.02a6.75 6.75 0 01-2.395 1.609z" clipRule="evenodd" />
                    </svg>
                )}
            </button>

            {/* Jump and Sprint Buttons (Bottom Right) */}
            <div
                className="absolute right-8 pointer-events-auto z-[2001] flex gap-4 items-end"
                style={{
                    bottom: 'max(2rem, env(safe-area-inset-bottom))'
                }}
            >
                {/* Sprint Button (Left of Jump) */}
                <button
                    onTouchStart={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMobileRun(true)
                    }}
                    onTouchEnd={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMobileRun(false)
                    }}
                    className="w-20 h-12 rounded-lg bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold text-sm active:bg-white/20 active:scale-95 transition-all"
                >
                    SPRINT
                </button>

                {/* Right Column: Attack (if infected) and Jump */}
                <div className="flex flex-col gap-4 items-center">
                    {/* Attack Button (Only for infected players) */}
                    {isInfected && infectedGameState === 'PLAYING' && (
                        <button
                            onTouchStart={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setMobileAttack(true)
                            }}
                            onTouchEnd={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setMobileAttack(false)
                            }}
                            className="w-20 h-20 rounded-full bg-red-600/60 backdrop-blur-md border-2 border-red-400 flex items-center justify-center text-white font-bold text-sm active:bg-red-500/80 active:scale-95 transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                        >
                            ATTACK
                        </button>
                    )}

                    {/* Jump Button */}
                    <button
                        onTouchStart={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setMobileJump(true)
                        }}
                        onTouchEnd={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setMobileJump(false)
                        }}
                        className="w-20 h-12 rounded-lg bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold text-sm active:bg-white/20 active:scale-95 transition-all"
                    >
                        JUMP
                    </button>
                </div>
            </div>

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
