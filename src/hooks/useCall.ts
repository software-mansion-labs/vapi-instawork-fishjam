import { useState, useCallback } from "react";
import {
  useConnection,
  useMicrophone,
  useInitializeDevices,
} from "@fishjam-cloud/react-client";
import type { CallStatus } from "../types/call";
import { useAgentAudio } from "./useAgentAudio";
import { useAudioLevel } from "./useAudioLevel";

export function useCall() {
  const { joinRoom, leaveRoom, peerStatus } = useConnection();
  const { initializeDevices } = useInitializeDevices();
  const { isMicrophoneOn, toggleMicrophone, microphoneStream } =
    useMicrophone();
  const { audioRef, agentStream } = useAgentAudio();

  const [status, setStatus] = useState<CallStatus>({
    text: "Idle",
    level: "idle",
  });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [callActive, setCallActive] = useState(false);

  const micLevel = useAudioLevel(microphoneStream);
  const agentLevel = useAudioLevel(agentStream);

  const handleStart = useCallback(async () => {
    setStatus({ text: "Connecting…", level: "active" });
    setCallActive(true);

    try {
      const res = await fetch("/api/start-call", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const { peerToken, roomId: newRoomId } = body as {
        peerToken: string;
        roomId: string;
      };

      setRoomId(newRoomId);

      await initializeDevices({ enableVideo: false });
      await joinRoom({ peerToken });

      setStatus({ text: "Connected — listening", level: "active" });
    } catch (err) {
      setStatus({ text: "Failed to start", level: "error" });
      setCallActive(false);
    }
  }, [joinRoom, initializeDevices]);

  const handleStop = useCallback(async () => {
    setStatus({ text: "Stopping…", level: "idle" });

    if (roomId) {
      await fetch("/api/stop-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
    }

    leaveRoom();
    setCallActive(false);
    setRoomId(null);
    setStatus({ text: "Call ended", level: "idle" });
  }, [roomId, leaveRoom]);

  const handleMute = useCallback(() => {
    toggleMicrophone();
  }, [toggleMicrophone]);

  return {
    status,
    callActive,
    isConnected: peerStatus === "connected",
    isMicrophoneOn,
    micLevel,
    agentLevel,
    audioRef,
    handleStart,
    handleStop,
    handleMute,
  };
}
