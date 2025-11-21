import React from 'react'

interface PauseMenuProps {
    onResume: () => void
    onOpenSettings: () => void
    onQuit: () => void
}

export default function PauseMenu({ onResume, onOpenSettings, onQuit }: PauseMenuProps) {
    // Stop propagation of clicks to prevent game interaction
    const handleContainerClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return (
        <div
            className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm overflow-hidden"
            onClick={handleContainerClick}
        >
            <div className="text-center mb-12 landscape:mb-4 landscape:scale-75 origin-bottom transition-transform">
                <h1 className="text-8xl landscape:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
                    Frozen Hollow
                </h1>
                <p className="text-white/60 text-xl landscape:text-lg font-mono tracking-[0.5em] mt-4 uppercase">
                    Game Paused
                </p>
            </div>

            <div className="flex flex-col gap-6 w-80 landscape:scale-75 origin-top transition-transform">
                <button
                    onClick={onResume}
                    className="group relative px-8 py-4 bg-white text-black font-bold text-xl rounded-full hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]"
                >
                    <span className="relative z-10">RESUME</span>
                    <div className="absolute inset-0 rounded-full bg-white blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                </button>

                <button
                    onClick={onOpenSettings}
                    className="px-8 py-4 bg-white/10 text-white font-bold text-xl rounded-full hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all duration-300 hover:scale-105"
                >
                    SETTINGS
                </button>

                <button
                    onClick={onQuit}
                    className="px-8 py-4 bg-red-500/10 text-red-400 font-bold text-xl rounded-full hover:bg-red-500/20 backdrop-blur-md border border-red-500/20 transition-all duration-300 hover:scale-105"
                >
                    BACK TO MENU
                </button>
            </div>

            <div className="absolute bottom-8 landscape:bottom-2 text-white/30 text-sm font-mono">
                v0.1.0 • PRE-ALPHA
            </div>
        </div>
    )
}
