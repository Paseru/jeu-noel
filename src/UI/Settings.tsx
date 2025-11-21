

interface SettingsProps {
    isOpen: boolean
    onClose: () => void
    volume: number
    setVolume: (volume: number) => void
}

export default function Settings({ isOpen, onClose, volume, setVolume }: SettingsProps) {
    if (!isOpen) return null

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-8 landscape:p-4 rounded-3xl w-96 max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-8 landscape:mb-4">
                    <h2 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                        SETTINGS
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-8 landscape:space-y-4">
                    {/* Volume Control */}
                    <div>
                        <div className="flex justify-between text-white mb-4 landscape:mb-2">
                            <span className="text-sm font-bold tracking-wider text-white/70 uppercase">Music Volume</span>
                            <span className="text-sm font-mono text-white/50">{Math.round(volume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-gray-200 transition-all"
                        />
                    </div>

                    {/* Controls Guide */}
                    <div className="pt-8 landscape:pt-4 border-t border-white/10">
                        <h3 className="text-sm font-bold tracking-wider text-white/70 uppercase mb-6 landscape:mb-3">Controls</h3>
                        <div className="space-y-3 landscape:space-y-2">
                            <ControlRow label="Move" keys={['WASD', 'Arrows']} />
                            <ControlRow label="Run" keys={['Shift']} />
                            <ControlRow label="Jump" keys={['Space']} />
                            <ControlRow label="Talk (Hold)" keys={['V']} />
                            <ControlRow label="Chat" keys={['Enter']} />
                            <ControlRow label="Change View" keys={['C']} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ControlRow({ label, keys }: { label: string, keys: string[] }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-white/60 font-medium">{label}</span>
            <div className="flex gap-1">
                {keys.map((key) => (
                    <span key={key} className="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white/80 border border-white/5">
                        {key}
                    </span>
                ))}
            </div>
        </div>
    )
}
