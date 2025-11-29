import { EffectComposer, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'

export const VHSEffect = () => {
    return (
        <EffectComposer multisampling={0}>
            <Noise
                opacity={0.1}
                blendFunction={BlendFunction.OVERLAY}
            />
            <ChromaticAberration
                offset={new Vector2(0.0012, 0.0012)}
                blendFunction={BlendFunction.NORMAL}
                radialModulation={false}
                modulationOffset={0.5}
            />
            <Vignette
                darkness={0.6}
                offset={0.25}
                blendFunction={BlendFunction.NORMAL}
            />
        </EffectComposer>
    )
}
