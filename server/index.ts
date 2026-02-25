import "dotenv/config";
import express from "express";
import type { Response } from "express";
import { FishjamClient } from "@fishjam-cloud/js-server-sdk";
import type { FishjamAgent } from "@fishjam-cloud/js-server-sdk";
import WebSocket from "ws";

const FISHJAM_ID = process.env.FISHJAM_ID!;
const FISHJAM_TOKEN = process.env.FISHJAM_MANAGEMENT_TOKEN!;
const VAPI_API_KEY = process.env.VAPI_API_KEY!;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID!;
const PORT = 3001;

const fishjamClient = new FishjamClient({
  fishjamId: FISHJAM_ID,
  managementToken: FISHJAM_TOKEN,
});

interface ActiveCall {
  roomId: string;
  agent: FishjamAgent;
  agentTrackId: string;
  vapiWs: WebSocket;
  sseClients: Set<Response>;
}

const activeCalls = new Map<string, ActiveCall>();

function broadcast(call: ActiveCall, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of call.sseClients) {
    res.write(payload);
  }
}

const app = express();
app.use(express.json());

app.get("/api/events/:roomId", (req, res) => {
  const call = activeCalls.get(req.params.roomId);
  if (!call) {
    res.status(404).json({ error: "call not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");

  call.sseClients.add(res);
  req.on("close", () => call.sseClients.delete(res));
});

app.post("/api/start-call", async (_req, res) => {
  try {
    const room = await fishjamClient.createRoom();
    const { peerToken } = await fishjamClient.createPeer(room.id);

    const { agent } = await fishjamClient.createAgent(
      room.id,
      {
        subscribeMode: "auto",
        output: { audioFormat: "pcm16", audioSampleRate: 16000 },
      },
      {
        onError: (err) => console.error("[agent] error:", err),
        onClose: (code, reason) =>
          console.log("[agent] closed:", code, reason),
      },
    );

    const agentTrack = agent.createTrack({
      encoding: "pcm16",
      sampleRate: 16000,
      channels: 1,
    });

    const vapiRes = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: VAPI_ASSISTANT_ID,
        transport: {
          provider: "vapi.websocket",
          audioFormat: {
            format: "pcm_s16le",
            container: "raw",
            sampleRate: 16000,
          },
        },
      }),
    });

    if (!vapiRes.ok) {
      const text = await vapiRes.text();
      throw new Error(`Vapi API error ${vapiRes.status}: ${text}`);
    }

    const vapiCall = (await vapiRes.json()) as {
      id: string;
      transport: { websocketCallUrl: string };
    };

    const vapiWs = new WebSocket(vapiCall.transport.websocketCallUrl);

    const call: ActiveCall = {
      roomId: room.id,
      agent,
      agentTrackId: agentTrack.id,
      vapiWs,
      sseClients: new Set(),
    };

    let bytesSent = 0;
    let lastLog = 0;

    vapiWs.on("open", () => console.log("[vapi-ws] connected"));
    vapiWs.on("close", () => {
      console.log("[vapi-ws] closed");
      broadcast(call, "call-end", {});
      if (activeCalls.has(room.id)) {
        call.agent.disconnect();
        activeCalls.delete(room.id);
      }
    });
    vapiWs.on("error", (err) => console.error("[vapi-ws] error:", err));

    vapiWs.on("message", (data, isBinary) => {
      if (isBinary) {
        const buf =
          data instanceof Buffer
            ? data
            : Buffer.concat(data as Buffer[]);
        agent.sendData(
          agentTrack.id,
          new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
        );
        bytesSent += buf.byteLength;
        const now = Date.now();
        if (now - lastLog > 2000) {
          console.log(`[agent] sent ${bytesSent} bytes to fishjam track`);
          bytesSent = 0;
          lastLog = now;
        }
      } else {
        const text = data.toString();
        try {
          const msg = JSON.parse(text) as Record<string, unknown>;
          handleVapiControl(call, msg);
        } catch {
          console.log("[vapi-ws] text:", text);
        }
      }
    });

    agent.on("trackData", ({ data }) => {
      if (vapiWs.readyState === WebSocket.OPEN) {
        vapiWs.send(data);
      }
    });

    activeCalls.set(room.id, call);

    console.log(`[call] started room=${room.id} vapiCall=${vapiCall.id}`);

    res.json({
      roomId: room.id,
      peerToken,
      vapiCallId: vapiCall.id,
    });
  } catch (err) {
    console.error("[start-call] error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

function handleVapiControl(call: ActiveCall, msg: Record<string, unknown>) {
  const type = msg.type as string;

  if (type === "speech-update") {
    broadcast(call, "speech-update", msg);
  }

  if (type === "transcript") {
    broadcast(call, "transcript", msg);
  }

  if (type === "status-update") {
    broadcast(call, "status-update", msg);
  }

  if (type === "transcript" || type === "speech-update" || type === "status-update") {
    console.log("[vapi-ws]", type, JSON.stringify(msg));
  }
}

app.post("/api/stop-call", (req, res) => {
  const { roomId } = req.body as { roomId?: string };
  if (!roomId) {
    res.status(400).json({ error: "roomId required" });
    return;
  }

  const call = activeCalls.get(roomId);
  if (!call) {
    res.status(404).json({ error: "call not found" });
    return;
  }

  if (call.vapiWs.readyState === WebSocket.OPEN) {
    call.vapiWs.send(JSON.stringify({ type: "end-call" }));
    call.vapiWs.close();
  }
  call.agent.disconnect();
  activeCalls.delete(roomId);

  console.log(`[call] stopped room=${roomId}`);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
