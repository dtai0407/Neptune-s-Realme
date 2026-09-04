import { GatewayIntentBits, Partials } from "discord.js";
import { ExtendedClient } from "./@type";
import { Config } from "./config";
import { loadCommands } from "./handlers/command.handler";
import { loadEvents } from "./handlers/event.handler";
import { logger } from "./utils/logger.util";

// Cấu hình Client Gateway Intents chuẩn doanh nghiệp
const baseIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildModeration
];

// Privileged intents (require enabling in Discord Developer Portal)
const privilegedIntents = [
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.MessageContent
];

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.MessageContent
];

const client = new ExtendedClient({
  intents,
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction],
  prefix: "np"
});

// Toàn cục chặn crash tiến trình (Process Unhandled Exception Guards)
process.on("unhandledRejection", (reason: Error | any) => {
  logger.error("Unhandled Promise Rejection Detected:", reason);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception Encountered:", error);
  // Khi chạy trong Docker/K8s, tiến trình nên được ghi log đầy đủ trước khi restart
  process.exit(1);
});

async function bootstrap() {
  try {
    logger.info("Đang khởi tạo các module của hệ thống...");
    await loadCommands(client);
    await loadEvents(client);

    await client.login(Config.DISCORD_TOKEN);
  } catch (error) {
    logger.error("Khởi động hệ thống thất bại:", error);
    process.exit(1);
  }
}

bootstrap();