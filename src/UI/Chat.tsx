import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export default function Chat() {
    const [isOpen, setIsOpen] = useState(false)
    const [inputValue, setInputValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const messages = useGameStore((state) => state.messages)
    const sendMessage = useGameStore((state) => state.sendMessage)
    const nickname = useGameStore((state) => state.nickname)

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Handle Enter key to toggle chat
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                if (isOpen) {
                    // If open and has text, send it
                    if (inputValue.trim()) {
                        sendMessage(inputValue)
                        setInputValue('')
                    }
                    // Close chat (blur input)
                    setIsOpen(false)
                    inputRef.current?.blur()
                } else {
                    // Open chat (focus input)
                    setIsOpen(true)
                    // Small timeout to ensure focus works after state update
                    setTimeout(() => inputRef.current?.focus(), 10)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, inputValue, sendMessage])

    return (
        <div className="absolute top-1/2 -translate-y-1/2 left-8 w-80 z-50 flex flex-col gap-2 pointer-events-none">
            {/* Messages List */}
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto mask-image-gradient">
                {messages.map((msg) => (
                    <div key={msg.id} className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-sm border border-white/5 self-start animate-in fade-in slide-in-from-left-2 duration-200">
                        <span className="font-bold text-white/80 mr-2">{msg.senderName}:</span>
                        <span className="text-white/90">{msg.text}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Field */}
            <div className={`transition-opacity duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`Message as ${nickname}...`}
                    className="w-full bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/20 focus:border-white/50 outline-none"
                    onBlur={() => setIsOpen(false)}
                />
            </div>
        </div>
    )
}
