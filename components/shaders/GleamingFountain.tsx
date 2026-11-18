import {
  Shader,
  Ascii,
  CRTScreen,
  SineWave,
  SolidColor,
  Stripes,
  StudioBackground,
} from 'shaders/react'

export default function GleamingFountain() {
  return (
    <Shader>
      <SolidColor
        color="#000000"
        visible={true} />
      <StudioBackground
        fillColor="#ffffff"
        keyColor="#000000"
        keyIntensity={39}
        opacity={0.67}
        visible={true} />
      <SineWave
        amplitude={0.1}
        visible={true} />
      <Stripes
        balance={0.3}
        blendMode="multiply"
        opacity={0.91}
        softness={0.5}
        speed={-0.2}
        visible={true} />
      <Ascii
        blendMode="hardLight"
        gamma={0.55}
        opacity={0.09}
        visible={true} />
      <SolidColor
        color="#000000"
        opacity={0.91}
        visible={true} />
      <CRTScreen />
    </Shader>
  )
}
