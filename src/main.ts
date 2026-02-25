import Vapi from "@vapi-ai/web";
import "./style.css";

const ASSISTANT_ID = "a890daee-47ba-4472-b843-6904f69b5fed";

const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnMute = document.getElementById("btn-mute") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;
const micBar = document.getElementById("mic-bar")!;
const volumeBar = document.getElementById("volume-bar")!;
const logEl = document.getElementById("log")!;

let vapi: Vapi | null = null;
let micCleanup: (() => void) | null = null;

function setStatus(text: string, level: "idle" | "active" | "error" = "idle") {
  statusEl.textContent = text;
  statusEl.dataset.level = level;
}

function log(text: string) {
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} — ${text}`;
  logEl.prepend(li);
}

function setCallActive(active: boolean) {
  btnStart.disabled = active;
  btnStop.disabled = !active;
  btnMute.disabled = !active;
  apiKeyInput.disabled = active;
  if (!active) {
    volumeBar.style.width = "0%";
    micBar.style.width = "0%";
    stopMicMonitor();
  }
}

function startMicMonitor() {
  stopMicMonitor();

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
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
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        micBar.style.width = `${pct}%`;
        raf = requestAnimationFrame(tick);
      }
      tick();

      micCleanup = () => {
        cancelAnimationFrame(raf);
        ctx.close();
        stream.getTracks().forEach((t) => t.stop());
        micBar.style.width = "0%";
      };

      log("Mic monitor active");
    })
    .catch((err) => {
      log(`Mic access denied: ${err.message}`);
      setStatus("Mic blocked — check browser permissions", "error");
    });
}

function stopMicMonitor() {
  micCleanup?.();
  micCleanup = null;
}

btnStart.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setStatus("Enter your Vapi public key first", "error");
    apiKeyInput.focus();
    return;
  }

  vapi = new Vapi(key);

  vapi.on("call-start", () => {
    setStatus("Connected — listening", "active");
    log("Call started");
    setCallActive(true);
    startMicMonitor();
  });

  vapi.on("speech-start", () => {
    setStatus("Agent speaking…", "active");
  });

  vapi.on("speech-end", () => {
    setStatus("Listening…", "active");
  });

  vapi.on("volume-level", (level) => {
    volumeBar.style.width = `${Math.round(level * 100)}%`;
  });

  vapi.on("message", (msg) => {
    if (msg.type === "transcript") {
      const who = msg.role === "assistant" ? "Agent" : "You";
      log(`[${who}] ${msg.transcript}`);
    }
    if (msg.type === "status-update" && msg.status === "ended") {
      setStatus("Call ended by agent", "idle");
      setCallActive(false);
    }
  });

  vapi.on("error", (err) => {
    setStatus("Error — check console", "error");
    log(`Error: ${err?.error?.message ?? JSON.stringify(err)}`);
    console.error("Vapi error:", err);
  });

  vapi.on("call-end", () => {
    setStatus("Call ended", "idle");
    log("Call ended");
    setCallActive(false);
  });

  setStatus("Connecting…", "active");
  setCallActive(true);
  log("Starting call…");

  try {
    await vapi.start(ASSISTANT_ID);
  } catch (e) {
    setStatus("Failed to start", "error");
    log(`Start failed: ${e}`);
    setCallActive(false);
  }
});

btnStop.addEventListener("click", () => {
  vapi?.stop();
  setStatus("Stopping…", "idle");
  log("Stop requested");
});

btnMute.addEventListener("click", () => {
  if (!vapi) return;
  const muted = vapi.isMuted();
  vapi.setMuted(!muted);
  btnMute.textContent = muted ? "Mute" : "Unmute";
  log(muted ? "Mic unmuted" : "Mic muted");
});
