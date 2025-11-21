import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'
import SimplePeer from 'simple-peer'

export default function VoiceChatManager() {
    const socket = useGameStore((state) => state.socket)
    const playerId = useGameStore((state) => state.playerId)
    const players = useGameStore((state) => state.players)
    const setSpeaking = useGameStore((state) => state.setSpeaking)

    const { setLocalStream, addRemoteStream, removeRemoteStream } = useVoiceStore()

    const localStreamRef = useRef<MediaStream | null>(null)
    const peersRef = useRef<Record<string, SimplePeer.Instance>>({})
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)

    // Initialize Audio and Local Stream
    useEffect(() => {
        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                localStreamRef.current = stream
                setLocalStream(stream)

                // Audio Analysis for "Speaking" detection
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext
                const audioContext = new AudioContext()
                audioContextRef.current = audioContext
                const analyser = audioContext.createAnalyser()
                analyser.fftSize = 256
                analyserRef.current = analyser
                const source = audioContext.createMediaStreamSource(stream)
                source.connect(analyser)

                // Disable tracks by default (Push to Talk)
                stream.getAudioTracks().forEach(track => track.enabled = false)
            } catch (err) {
                console.error("Error accessing microphone:", err)
            }
        }

        initAudio()

        return () => {
            localStreamRef.current?.getTracks().forEach(track => track.stop())
            audioContextRef.current?.close()
        }
    }, [setLocalStream])

    // Push to Talk Logic (V key)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyV' && localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true)
                setSpeaking(true)
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyV' && localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false)
                setSpeaking(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [setSpeaking])

    // Socket Events for WebRTC
    useEffect(() => {
        if (!socket || !playerId || !localStreamRef.current) return

        // Handle incoming signals
        socket.on('signal', ({ sender, signal }) => {
            const peer = peersRef.current[sender]
            if (peer) {
                peer.signal(signal)
            } else {
                // Incoming connection (Answerer)
                // We only accept signals if we didn't initiate (or if we lost the race but that shouldn't happen with deterministic logic)
                const newPeer = createPeer(sender, socket, localStreamRef.current!, false)
                peersRef.current[sender] = newPeer
                newPeer.signal(signal)
            }
        })

        // Handle new player (Initiator)
        socket.on('newPlayer', (player) => {
            if (player.id === playerId) return
            // Deterministic initiation: Only initiate if my ID is "greater" than theirs
            // This prevents double-initiation collisions
            if (!peersRef.current[player.id] && playerId > player.id) {
                const peer = createPeer(player.id, socket, localStreamRef.current!, true)
                peersRef.current[player.id] = peer
            }
        })

        // Handle player disconnected
        socket.on('playerDisconnected', (id) => {
            if (peersRef.current[id]) {
                peersRef.current[id].destroy()
                delete peersRef.current[id]
                removeRemoteStream(id)
            }
        })

        // Connect to existing players
        Object.keys(players).forEach((id) => {
            if (id !== playerId && !peersRef.current[id]) {
                // Same deterministic logic
                if (playerId > id) {
                    const peer = createPeer(id, socket, localStreamRef.current!, true)
                    peersRef.current[id] = peer
                }
            }
        })

        return () => {
            socket.off('signal')
            socket.off('newPlayer')
            socket.off('playerDisconnected')
        }
    }, [socket, playerId, players, removeRemoteStream])

    function createPeer(targetId: string, socket: any, stream: MediaStream, initiator: boolean) {
        const peer = new SimplePeer({
            initiator,
            trickle: false,
            stream,
        })

        peer.on('signal', (signal: any) => {
            socket.emit('signal', { target: targetId, signal })
        })

        peer.on('stream', (remoteStream: MediaStream) => {
            addRemoteStream(targetId, remoteStream)
        })

        peer.on('error', (err: Error) => {
            console.error('Peer error:', err)
        })

        return peer
    }

    return null
}
