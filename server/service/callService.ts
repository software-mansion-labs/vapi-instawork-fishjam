import { FishjamClient } from "@fishjam-cloud/js-server-sdk";
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

    await createVapiCall(room.id);

    return { roomId: room.id, peerToken };
  }

  stopCall(roomId: string): boolean {
    console.log(`[call] stopped room=${roomId}`);
    return true;
  }
}

export const callService = new CallService();
