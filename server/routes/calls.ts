import { Router } from "express";
import { callService } from "../service/callService.ts";

const router = Router();

router.post("/api/start-call", async (_req, res) => {
  try {
    const result = await callService.startCall();
    res.json(result);
  } catch (err) {
    console.error("[start-call] error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/api/stop-call", (req, res) => {
  const { roomId } = req.body as { roomId?: string };
  if (!roomId) {
    res.status(400).json({ error: "roomId required" });
    return;
  }

  if (!callService.stopCall(roomId)) {
    res.status(404).json({ error: "call not found" });
    return;
  }

  res.json({ ok: true });
});

export default router;
