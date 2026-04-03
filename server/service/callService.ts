import { FishjamClient, RoomId } from "@fishjam-cloud/js-server-sdk";
import { CONFIG } from "../config.ts";
import { createVapiCall } from "./vapiClient.ts";

class CallService {
  private activeCalls = new Set<RoomId>;
  private fishjam = new FishjamClient({
    fishjamId: CONFIG.VITE_FISHJAM_ID,
    managementToken: CONFIG.FISHJAM_MANAGEMENT_TOKEN,
  });

  async startCall() {
    const room = await this.fishjam.createRoom();
    const { peerToken } = await this.fishjam.createPeer(room.id);
    const { callId } = await createVapiCall();
    await this.fishjam.createVAPIAgent(
      room.id,
      {
        apiKey: CONFIG.VAPI_PRIVATE_API_KEY,
        callId: callId
      }
    );

    this.activeCalls.add(room.id);

    console.log(`[call] started room=${room.id} vapiCall=${callId}`);
    return { roomId: room.id, peerToken, vapiCallId: callId };
  }

  stopCall(roomId: RoomId): boolean {
    if (!this.activeCalls.has(roomId)) return false;

    this.activeCalls.delete(roomId);
    this.fishjam.deleteRoom(roomId);
    console.log(`[call] stopped room=${roomId}`);
    return true;
  }
}

export const callService = new CallService();
