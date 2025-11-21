import { useGameStore } from '../stores/useGameStore'

export const InteractionPrompt = () => {
    const interactionText = useGameStore((state) => state.interactionText)

    if (!interactionText) return null

    return (
        <div style={{
            position: 'absolute',
            bottom: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '16px',
            fontWeight: '500',
            pointerEvents: 'none',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
            <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#ffffff',
                color: '#000000',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px'
            }}>
                E
            </div>
            {interactionText}
        </div>
    )
}
