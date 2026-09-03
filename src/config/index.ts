import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN là bắt buộc"),
  CLIENT_ID: z.string().min(1, "CLIENT_ID là bắt buộc"),
  GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().url("DATABASE_URL phải là một URL hợp lệ"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Cấu hình môi trường không hợp lệ:", parsedEnv.error.format());
  process.exit(1);
}

export const Config = parsedEnv.data;

export default Config;