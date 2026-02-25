import { useState, useEffect } from "react";

export function useAudioLevel(stream: MediaStream | null | undefined): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      return;
    }

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    function tick() {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setLevel(Math.min(100, Math.round((avg / 128) * 100)));
      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ctx.close();
    };
  }, [stream]);

  return level;
}
