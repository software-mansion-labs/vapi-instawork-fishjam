import { CONFIG } from "../config.ts";

export async function createVapiCall() {
  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.VAPI_PRIVATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId: CONFIG.VAPI_ASSISTANT_ID,
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    id: string;
    transport: { websocketCallUrl: string };
  };

  return {
    callId: data.id,
    websocketUrl: data.transport.websocketCallUrl,
  };
}
