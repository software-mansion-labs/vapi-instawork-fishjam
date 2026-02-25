import { useRef, useMemo, useEffect } from "react";
import { usePeers } from "@fishjam-cloud/react-client";

export function useAgentAudio() {
  const { remotePeers } = usePeers();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const agentStream = useMemo(() => {
    const track = remotePeers
      .flatMap((p) => [
        ...p.customAudioTracks,
        ...(p.microphoneTrack ? [p.microphoneTrack] : []),
        ...p.tracks.filter((t) => t.track?.kind === "audio" && t.stream),
      ])
      .at(0);
    return track?.stream ?? null;
  }, [remotePeers]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!agentStream) {
      audioRef.current.srcObject = null;
      return;
    }
    audioRef.current.srcObject = agentStream;
    audioRef.current.play().catch(() => {});
  }, [agentStream]);

  return { audioRef, agentStream };
}
