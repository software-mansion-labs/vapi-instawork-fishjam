import { FishjamClient } from "@fishjam-cloud/js-server-sdk";
import WebSocket from "ws";
import { CONFIG } from "../config.ts";
import { createVapiCall } from "./vapiClient.ts";
import type { ActiveCall } from "../types.ts";

class CallService {
  private activeCalls = new Map<string, ActiveCall>();
  private fishjam = new FishjamClient({
    fishjamId: CONFIG.VITE_FISHJAM_ID,
    managementToken: CONFIG.FISHJAM_MANAGEMENT_TOKEN,
  });

  getCall(roomId: string) {
    return this.activeCalls.get(roomId);
  }

  async startCall() {
    const room = await this.fishjam.createRoom();
    const { peerToken } = await this.fishjam.createPeer(room.id);

    const { agent } = await this.fishjam.createAgent(
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

    const { callId, websocketUrl } = await createVapiCall();
    const vapiWs = new WebSocket(websocketUrl);

    const call: ActiveCall = {
      roomId: room.id,
      agent,
      agentTrackId: agentTrack.id,
      vapiWs,
    };

    vapiWs.on("open", () => console.log("[vapi-ws] connected"));
    vapiWs.on("close", () => {
      console.log("[vapi-ws] closed");
      if (this.activeCalls.has(room.id)) {
        call.agent.disconnect();
        this.activeCalls.delete(room.id);
      }
    });
    vapiWs.on("error", (err) => console.error("[vapi-ws] error:", err));

    vapiWs.on("message", (data, isBinary) => {
      if (isBinary) {
        const buf =
          data instanceof Buffer ? data : Buffer.concat(data as Buffer[]);
        agent.sendData(
          agentTrack.id,
          new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
        );
      } else {
        console.log("[vapi-ws] text:", data.toString());
      }
    });

    agent.on("trackData", ({ data }) => {
      if (vapiWs.readyState === WebSocket.OPEN) {
        vapiWs.send(data);
      }
    });

    this.activeCalls.set(room.id, call);

    console.log(`[call] started room=${room.id} vapiCall=${callId}`);
    return { roomId: room.id, peerToken, vapiCallId: callId };
  }

  stopCall(roomId: string): boolean {
    const call = this.activeCalls.get(roomId);
    if (!call) return false;

    if (call.vapiWs.readyState === WebSocket.OPEN) {
      call.vapiWs.send(JSON.stringify({ type: "end-call" }));
      call.vapiWs.close();
    }
    call.agent.disconnect();
    this.activeCalls.delete(roomId);

    console.log(`[call] stopped room=${roomId}`);
    return true;
  }
}

export const callService = new CallService();
