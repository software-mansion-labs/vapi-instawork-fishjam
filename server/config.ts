import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  VITE_FISHJAM_ID: z.string(),
  FISHJAM_MANAGEMENT_TOKEN: z.string(),
  VAPI_PRIVATE_API_KEY: z.string(),
  VAPI_ASSISTANT_ID: z.string(),
  PORT: z.coerce.number().int().default(3001),
});

export const CONFIG = configSchema.parse(process.env);
