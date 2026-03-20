import { CONFIG } from "../config.ts";

export async function createVapiCall(roomId: string) {
  const url = `${CONFIG.VITE_FISHJAM_ID}/room/${roomId}/peer`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.FISHJAM_MANAGEMENT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "vapi",
      options: {
        apiKey: CONFIG.VAPI_PRIVATE_API_KEY,
        assistantId: CONFIG.VAPI_ASSISTANT_ID
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi API error ${res.status}: ${text}`);
  }

  return;
}
