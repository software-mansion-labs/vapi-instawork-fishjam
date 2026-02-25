import { useState, useCallback, useRef, useEffect } from "react";
import {
  useConnection,
  useMicrophone,
  usePeers,
  useInitializeDevices,
} from "@fishjam-cloud/react-client";

interface LogEntry {
  time: string;
  text: string;
}

export function App() {
  const { joinRoom, leaveRoom, peerStatus } = useConnection();
  const { initializeDevices } = useInitializeDevices();
  const { isMicrophoneOn, toggleMicrophone, microphoneStream } =
    useMicrophone();
  const { remotePeers } = usePeers();

  const [status, setStatus] = useState<{
    text: string;
    level: "idle" | "active" | "error";
  }>({ text: "Idle", level: "idle" });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const micAnalyserRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
    raf: number;
  } | null>(null);
  const agentAnalyserRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
    raf: number;
  } | null>(null);

  const log = useCallback((text: string) => {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString(), text },
      ...prev,
    ]);
  }, []);

  const connectSSE = useCallback(
    (targetRoomId: string) => {
      sseRef.current?.close();
      const es = new EventSource(`/api/events/${targetRoomId}`);

      es.addEventListener("transcript", (e) => {
        const msg = JSON.parse(e.data) as {
          role: string;
          transcript: string;
          transcriptType: string;
        };
        if (msg.transcriptType === "final") {
          const who = msg.role === "assistant" ? "Agent" : "You";
          log(`[${who}] ${msg.transcript}`);
        }
      });

      es.addEventListener("speech-update", (e) => {
        const msg = JSON.parse(e.data) as {
          role: string;
          status: string;
        };
        if (msg.role === "assistant") {
          if (msg.status === "started") {
            setStatus({ text: "Agent speaking…", level: "active" });
          } else if (msg.status === "stopped") {
            setStatus({ text: "Listening…", level: "active" });
          }
        }
      });

      es.addEventListener("status-update", (e) => {
        const msg = JSON.parse(e.data) as { status: string };
        if (msg.status === "ended") {
          setStatus({ text: "Call ended by agent", level: "idle" });
          setCallActive(false);
        }
      });

      es.addEventListener("call-end", () => {
        setStatus({ text: "Call ended", level: "idle" });
        setCallActive(false);
      });

      sseRef.current = es;
    },
    [log],
  );

  useEffect(() => {
    if (remotePeers.length === 0) return;
    for (const peer of remotePeers) {
      console.log("[debug] remote peer", peer.id, {
        tracks: peer.tracks.length,
        microphoneTrack: !!peer.microphoneTrack,
        customAudio: peer.customAudioTracks.length,
        trackDetails: peer.tracks.map((t) => ({
          id: t.trackId,
          kind: t.track?.kind,
          readyState: t.track?.readyState,
          hasStream: !!t.stream,
          streamActive: t.stream?.active,
        })),
      });
    }
  }, [remotePeers]);

  const agentTrack = remotePeers
    .flatMap((p) => [
      ...p.customAudioTracks,
      ...(p.microphoneTrack ? [p.microphoneTrack] : []),
      ...p.tracks.filter(
        (t) => t.track?.kind === "audio" && t.stream,
      ),
    ])
    .at(0);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!agentTrack?.stream) {
      console.log("[debug] no agent audio stream available");
      audioRef.current.srcObject = null;
      return;
    }
    console.log("[debug] attaching agent stream", {
      streamId: agentTrack.stream.id,
      active: agentTrack.stream.active,
      audioTracks: agentTrack.stream.getAudioTracks().map((t) => ({
        id: t.id,
        readyState: t.readyState,
        enabled: t.enabled,
        muted: t.muted,
      })),
    });
    audioRef.current.srcObject = agentTrack.stream;
    audioRef.current.play().then(
      () => console.log("[debug] audio.play() succeeded"),
      (err) => console.error("[debug] audio.play() failed:", err),
    );
  }, [agentTrack?.stream]);

  useEffect(() => {
    if (!microphoneStream) {
      if (micAnalyserRef.current) {
        cancelAnimationFrame(micAnalyserRef.current.raf);
        micAnalyserRef.current.ctx.close();
        micAnalyserRef.current = null;
        setMicLevel(0);
      }
      return;
    }

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(microphoneStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
      micAnalyserRef.current!.raf = requestAnimationFrame(tick);
    }
    micAnalyserRef.current = { ctx, analyser, raf: 0 };
    tick();

    return () => {
      if (micAnalyserRef.current) {
        cancelAnimationFrame(micAnalyserRef.current.raf);
        micAnalyserRef.current.ctx.close();
        micAnalyserRef.current = null;
      }
    };
  }, [microphoneStream]);

  useEffect(() => {
    const stream = agentTrack?.stream ?? null;
    if (!stream) {
      if (agentAnalyserRef.current) {
        cancelAnimationFrame(agentAnalyserRef.current.raf);
        agentAnalyserRef.current.ctx.close();
        agentAnalyserRef.current = null;
        setAgentLevel(0);
      }
      return;
    }

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setAgentLevel(Math.min(100, Math.round((avg / 128) * 100)));
      agentAnalyserRef.current!.raf = requestAnimationFrame(tick);
    }
    agentAnalyserRef.current = { ctx, analyser, source: src, raf: 0 };
    tick();

    return () => {
      if (agentAnalyserRef.current) {
        cancelAnimationFrame(agentAnalyserRef.current.raf);
        agentAnalyserRef.current.ctx.close();
        agentAnalyserRef.current = null;
      }
    };
  }, [agentTrack?.stream]);

  useEffect(() => {
    if (!callActive) {
      setMicLevel(0);
      setAgentLevel(0);
      sseRef.current?.close();
      sseRef.current = null;
    }
  }, [callActive]);

  const handleStart = useCallback(async () => {
    setStatus({ text: "Connecting…", level: "active" });
    setCallActive(true);
    log("Starting call…");

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
      connectSSE(newRoomId);

      await initializeDevices({ enableVideo: false });
      await joinRoom({ peerToken });

      setStatus({ text: "Connected — listening", level: "active" });
      log("Call started");
    } catch (err) {
      setStatus({ text: "Failed to start", level: "error" });
      log(`Start failed: ${err}`);
      setCallActive(false);
    }
  }, [joinRoom, initializeDevices, log, connectSSE]);

  const handleStop = useCallback(async () => {
    setStatus({ text: "Stopping…", level: "idle" });
    log("Stop requested");

    sseRef.current?.close();
    sseRef.current = null;

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
    log("Call ended");
  }, [roomId, leaveRoom, log]);

  const handleMute = useCallback(() => {
    toggleMicrophone();
    log(isMicrophoneOn ? "Mic muted" : "Mic unmuted");
  }, [toggleMicrophone, isMicrophoneOn, log]);

  const isConnected = peerStatus === "connected";

  return (
    <>
    <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    <div id="app">
      <h1>Trivia Agent</h1>

      <div className="controls">
        <button
          id="btn-start"
          disabled={callActive}
          onClick={handleStart}
        >
          Start
        </button>
        <button
          id="btn-stop"
          disabled={!callActive}
          onClick={handleStop}
        >
          Stop
        </button>
        <button
          id="btn-mute"
          disabled={!isConnected}
          onClick={handleMute}
        >
          {isMicrophoneOn ? "Mute" : "Unmute"}
        </button>
      </div>

      <div className="status" data-level={status.level}>
        {status.text}
      </div>

      <div className="meters">
        <div className="meter">
          <span className="meter-label">You</span>
          <div className="meter-track">
            <div
              className="meter-fill mic"
              style={{ width: `${micLevel}%` }}
            />
          </div>
        </div>
        <div className="meter">
          <span className="meter-label">Agent</span>
          <div className="meter-track">
            <div
              className="meter-fill agent"
              style={{ width: `${agentLevel}%` }}
            />
          </div>
        </div>
      </div>

      <ul className="log">
        {logs.map((entry, i) => (
          <li key={i}>
            {entry.time} — {entry.text}
          </li>
        ))}
      </ul>
    </div>
    </>
  );
}
