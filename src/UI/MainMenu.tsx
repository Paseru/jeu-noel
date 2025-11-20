import { useGameStore } from '../stores/useGameStore'

interface MainMenuProps {
    onOpenSettings: () => void
}

export default function MainMenu({ onOpenSettings }: MainMenuProps) {
    const startPlaying = useGameStore((state) => state.startPlaying)

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-center mb-12">
                <h1 className="text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
                    NOËL RÉALISTE
                </h1>
                <p className="text-white/60 text-xl font-mono tracking-[0.5em] mt-4 uppercase">
                    Multiplayer Experience
                </p>
            </div>

            <div className="flex flex-col gap-6 w-80">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="PSEUDO"
                        maxLength={15}
                        className="w-full px-8 py-4 bg-white/10 text-white font-bold text-xl rounded-full border border-white/20 focus:border-white focus:bg-white/20 outline-none transition-all text-center placeholder:text-white/30"
                        onChange={(e) => useGameStore.getState().setNickname(e.target.value)}
                    />
                </div>

                <button
                    onClick={() => {
                        const nickname = useGameStore.getState().nickname
                        if (nickname.trim().length > 0) {
                            startPlaying()
                        }
                    }}
                    className="group relative px-8 py-4 bg-white text-black font-bold text-xl rounded-full hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="relative z-10">JOUER</span>
                    <div className="absolute inset-0 rounded-full bg-white blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                </button>

                <button
                    onClick={onOpenSettings}
                    className="px-8 py-4 bg-white/10 text-white font-bold text-xl rounded-full hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all duration-300 hover:scale-105"
                >
                    PARAMÈTRES
                </button>
            </div>

            <div className="absolute bottom-8 text-white/30 text-sm font-mono">
                v0.1.0 • PRE-ALPHA
            </div>
        </div>
    )
}
