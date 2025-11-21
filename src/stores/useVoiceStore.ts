import { create } from 'zustand'
import * as THREE from 'three'

interface VoiceState {
    localStream: MediaStream | null
    remoteStreams: Record<string, MediaStream>
    audioListener: THREE.AudioListener | null
    setLocalStream: (stream: MediaStream | null) => void
    addRemoteStream: (id: string, stream: MediaStream) => void
    removeRemoteStream: (id: string) => void
    setAudioListener: (listener: THREE.AudioListener | null) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
    localStream: null,
    remoteStreams: {},
    audioListener: null,
    setLocalStream: (stream) => set({ localStream: stream }),
    addRemoteStream: (id, stream) => set((state) => ({
        remoteStreams: { ...state.remoteStreams, [id]: stream }
    })),
    removeRemoteStream: (id) => set((state) => {
        const { [id]: _, ...rest } = state.remoteStreams
        return { remoteStreams: rest }
    }),
    setAudioListener: (listener) => set({ audioListener: listener })
}))
