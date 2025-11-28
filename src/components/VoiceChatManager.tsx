import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/useGameStore'
import { useVoiceStore } from '../stores/useVoiceStore'
import SimplePeer from 'simple-peer'

export default function VoiceChatManager() {
    const socket = useGameStore((state) => state.socket)
    const playerId = useGameStore((state) => state.playerId)
    const players = useGameStore((state) => state.players)
    const setSpeaking = useGameStore((state) => state.setSpeaking)

    const { localStream, setLocalStream, addRemoteStream, removeRemoteStream } = useVoiceStore()

    const localStreamRef = useRef<MediaStream | null>(null)
    const peersRef = useRef<Record<string, SimplePeer.Instance>>({})
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)

    // Initialize Audio and Local Stream
    useEffect(() => {
        let cancelled = false

        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                })
                if (cancelled) return

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
            cancelled = true
            localStreamRef.current?.getTracks().forEach(track => track.stop())
            audioContextRef.current?.close()
            localStreamRef.current = null
            setLocalStream(null)
        }
    }, [setLocalStream])

    // Push to Talk Logic (V key)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyV' && localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true)
                setSpeaking(true)
                useVoiceStore.getState().setMicrophoneActive(true)
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyV' && localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false)
                setSpeaking(false)
                useVoiceStore.getState().setMicrophoneActive(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [setSpeaking])

    // Socket Events for WebRTC - Stable Listeners
    useEffect(() => {
        if (!socket || !playerId) return

        // Handle incoming signals
        const handleSignal = ({ sender, signal }: { sender: string, signal: any }) => {
            console.log(`[VoiceChat] Received signal from ${sender}`)
            const peer = peersRef.current[sender]
            if (peer) {
                peer.signal(signal)
            } else {
                console.log(`[VoiceChat] New incoming connection from ${sender}`)
                const newPeer = createPeer(sender, socket, false)
                peersRef.current[sender] = newPeer
                newPeer.signal(signal)
            }
        }

        // Handle new player (Initiator)
        const handleNewPlayer = (player: any) => {
            if (player.id === playerId) return
            if (!peersRef.current[player.id] && playerId > player.id) {
                console.log(`[VoiceChat] Initiating connection to ${player.id}`)
                const peer = createPeer(player.id, socket, true)
                peersRef.current[player.id] = peer
            }
        }

        // Handle player disconnected
        const handlePlayerDisconnected = (id: string) => {
            if (peersRef.current[id]) {
                console.log(`[VoiceChat] Player disconnected: ${id}`)
                peersRef.current[id].destroy()
                delete peersRef.current[id]
                removeRemoteStream(id)
            }
        }

        socket.on('signal', handleSignal)
        socket.on('newPlayer', handleNewPlayer)
        socket.on('playerDisconnected', handlePlayerDisconnected)

        return () => {
            socket.off('signal', handleSignal)
            socket.off('newPlayer', handleNewPlayer)
            socket.off('playerDisconnected', handlePlayerDisconnected)
        }
    }, [socket, playerId, removeRemoteStream])

    // Connection Maintenance - Dynamic (Checks for missing connections)
    useEffect(() => {
        if (!socket || !playerId) return

        Object.keys(players).forEach((id) => {
            if (id !== playerId && !peersRef.current[id]) {
                if (playerId > id) {
                    console.log(`[VoiceChat] Maintenance: Initiating connection to ${id}`)
                    const peer = createPeer(id, socket, true)
                    peersRef.current[id] = peer
                }
            }
        })
    }, [players, playerId, socket])

    // Handle Muting + Infected isolation (zombies can't hear survivors and vice versa)
    const mutedPlayers = useVoiceStore((state) => state.mutedPlayers)
    const remoteStreams = useVoiceStore((state) => state.remoteStreams)
    const isInfected = useGameStore((state) => state.isInfected)
    const infectedPlayers = useGameStore((state) => state.infectedPlayers)
    const infectedGameState = useGameStore((state) => state.infectedGameState)

    useEffect(() => {
        Object.keys(remoteStreams).forEach((id) => {
            const stream = remoteStreams[id]
            const isMuted = mutedPlayers[id]
            
            // Infected isolation: during PLAYING, zombies and survivors can't hear each other
            let isIsolated = false
            if (infectedGameState === 'PLAYING') {
                const targetIsInfected = infectedPlayers.includes(id)
                // If I'm infected and target is not, or I'm not infected and target is -> isolate
                if (isInfected !== targetIsInfected) {
                    isIsolated = true
                }
            }
            
            stream.getAudioTracks().forEach((track) => {
                track.enabled = !isMuted && !isIsolated
            })
        })
    }, [mutedPlayers, remoteStreams, isInfected, infectedPlayers, infectedGameState])

    // Ensure all peers carry the current microphone tracks (added even if peers were created before mic was ready)
    useEffect(() => {
        if (!localStreamRef.current) return

        const stream = localStreamRef.current
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length === 0) return

        Object.values(peersRef.current).forEach((peer) => {
            // Avoid adding duplicates
            const senders = (peer as any)?._pc?.getSenders?.() || []
            audioTracks.forEach((track) => {
                const alreadySending = senders.some((sender: RTCRtpSender) => sender.track === track)
                if (!alreadySending) {
                    peer.addTrack(track, stream)
                }
            })
        })
    }, [localStream])

    // Destroy all peers on unmount to avoid zombie connections when rejoining
    useEffect(() => {
        return () => {
            Object.values(peersRef.current).forEach(peer => peer.destroy())
            peersRef.current = {}
        }
    }, [])

    function createPeer(targetId: string, socket: any, initiator: boolean) {
        console.log(`[VoiceChat] Creating peer for ${targetId} (Initiator: ${initiator})`)
        const stream = localStreamRef.current || undefined
        const peer = new SimplePeer({
            initiator,
            trickle: false,
            stream,
        })

        peer.on('signal', (signal: any) => {
            // console.log(`[VoiceChat] Sending signal to ${targetId}`)
            socket.emit('signal', { target: targetId, signal })
        })

        peer.on('stream', (remoteStream: MediaStream) => {
            console.log(`[VoiceChat] Received stream from ${targetId}`)
            addRemoteStream(targetId, remoteStream)
        })

        peer.on('error', (err: Error) => {
            console.error(`[VoiceChat] Peer error with ${targetId}:`, err)
        })

        peer.on('connect', () => {
            console.log(`[VoiceChat] Connected to ${targetId}`)
        })

        return peer
    }

    return null
}
