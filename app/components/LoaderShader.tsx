"use client";

import { useState } from "react";
import {
  Shader,
  Ascii,
  CRTScreen,
  SineWave,
  SolidColor,
  Stripes,
  StudioBackground,
} from "shaders/react";

/**
 * Animated backdrop behind the loader wordmark (shaders.com composition).
 * Fades in once the GPU renderer is ready; if the browser cannot run it,
 * the canvas stays transparent and the loader's black background shows.
 */
export default function LoaderShader() {
  const [ready, setReady] = useState(false);

  return (
    <Shader
      className={`loader-shader${ready ? " is-ready" : ""}`}
      onReady={() => setReady(true)}
    >
      <SolidColor color="#000000" visible={true} />
      <StudioBackground
        fillColor="#ffffff"
        keyColor="#000000"
        keyIntensity={39}
        opacity={0.67}
        visible={true}
      />
      <SineWave amplitude={0.1} visible={true} />
      <Stripes
        balance={0.3}
        blendMode="multiply"
        opacity={0.91}
        softness={0.5}
        speed={-0.2}
        visible={true}
      />
      <Ascii blendMode="hardLight" gamma={0.55} opacity={0.09} visible={true} />
      <SolidColor color="#000000" opacity={0.91} visible={true} />
      <CRTScreen />
    </Shader>
  );
}
