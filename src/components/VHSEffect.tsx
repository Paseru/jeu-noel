import { EffectComposer, Noise, Scanline, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'

export const VHSEffect = () => {
    return (
        <EffectComposer>
            <Noise
                opacity={0.12}
                blendFunction={BlendFunction.OVERLAY}
            />
            <Scanline
                density={1.4}
                blendFunction={BlendFunction.OVERLAY}
                opacity={0.15}
            />
            <ChromaticAberration
                offset={new Vector2(0.0015, 0.0015)}
                blendFunction={BlendFunction.NORMAL}
                radialModulation={false}
                modulationOffset={0.5}
            />
            <Vignette
                darkness={0.65}
                offset={0.25}
                blendFunction={BlendFunction.NORMAL}
            />
        </EffectComposer>
    )
}
