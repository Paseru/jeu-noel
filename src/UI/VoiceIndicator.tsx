import { useVoiceStore } from '../stores/useVoiceStore'

export default function VoiceIndicator() {
    const isMicrophoneActive = useVoiceStore((state) => state.isMicrophoneActive)

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-none">
            {/* Hint Text */}
            <span className={`text-white font-mono text-sm tracking-widest uppercase transition-opacity duration-200 hidden lg:block ${isMicrophoneActive ? 'opacity-100' : 'opacity-30'}`}>
                Press V to talk
            </span>

            {/* Active Indicator */}
            <div className={`transition-all duration-200 ${isMicrophoneActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                <div className="bg-green-500/20 backdrop-blur-sm p-2 rounded-full border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-400">
                        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                    </svg>
                </div>
            </div>
        </div>
    )
}
