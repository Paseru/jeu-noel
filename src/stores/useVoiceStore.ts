import { create } from 'zustand'
import * as THREE from 'three'

interface VoiceState {
    localStream: MediaStream | null
    remoteStreams: Record<string, MediaStream>
    audioListener: THREE.AudioListener | null
    isMicrophoneActive: boolean
    mutedPlayers: Record<string, boolean>
    setLocalStream: (stream: MediaStream | null) => void
    addRemoteStream: (id: string, stream: MediaStream) => void
    removeRemoteStream: (id: string) => void
    setAudioListener: (listener: THREE.AudioListener | null) => void
    setMicrophoneActive: (isActive: boolean) => void
    toggleMute: (playerId: string) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
    localStream: null,
    remoteStreams: {},
    audioListener: null,
    isMicrophoneActive: false,
    mutedPlayers: {},
    setLocalStream: (stream) => set({ localStream: stream }),
    addRemoteStream: (id, stream) => set((state) => ({
        remoteStreams: { ...state.remoteStreams, [id]: stream }
    })),
    removeRemoteStream: (id) => set((state) => {
        const { [id]: _, ...rest } = state.remoteStreams
        return { remoteStreams: rest }
    }),
    setAudioListener: (listener) => set({ audioListener: listener }),
    setMicrophoneActive: (isActive) => set({ isMicrophoneActive: isActive }),
    toggleMute: (playerId) => set((state) => ({
        mutedPlayers: {
            ...state.mutedPlayers,
            [playerId]: !state.mutedPlayers[playerId]
        }
    }))
}))
