import type { FishjamAgent } from "@fishjam-cloud/js-server-sdk";
import type WebSocket from "ws";

export interface ActiveCall {
  roomId: string;
  agent: FishjamAgent;
  agentTrackId: string;
  vapiWs: WebSocket;
}
