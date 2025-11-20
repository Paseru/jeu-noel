import { create } from 'zustand'

interface VoiceState {
    localStream: MediaStream | null
    remoteStreams: Record<string, MediaStream>
    setLocalStream: (stream: MediaStream | null) => void
    addRemoteStream: (id: string, stream: MediaStream) => void
    removeRemoteStream: (id: string) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
    localStream: null,
    remoteStreams: {},
    setLocalStream: (stream) => set({ localStream: stream }),
    addRemoteStream: (id, stream) => set((state) => ({
        remoteStreams: { ...state.remoteStreams, [id]: stream }
    })),
    removeRemoteStream: (id) => set((state) => {
        const { [id]: _, ...rest } = state.remoteStreams
        return { remoteStreams: rest }
    })
}))
