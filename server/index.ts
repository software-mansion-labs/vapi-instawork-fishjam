import express from "express";
import { CONFIG } from "./config.ts";
import callRoutes from "./routes/calls.ts";

const app = express();
app.use(express.json());
app.use(callRoutes);

app.listen(CONFIG.PORT, () => {
  console.log(`Server running on http://localhost:${CONFIG.PORT}`);
});
