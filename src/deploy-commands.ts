import { REST, Routes } from "discord.js";
import { Config } from "./config";
import { logger } from "./utils/logger.util";

// Import trực tiếp từng lệnh vào deploy script
import timeoutCommand from "./commands/moderation/timeout";
import banCommand from "./commands/moderation/ban";
import kickCommand from "./commands/moderation/kick";
import purgeCommand from "./commands/moderation/purge";
import warnCommand from "./commands/moderation/warn";
import autoroleCommand from "./commands/admin/autorole";
import setlogCommand from "./commands/config/setlog";
import autoresponderCommand from "./commands/config/autoresponder";
import embedCommand from "./commands/config/embed";

const commandsList = [
  timeoutCommand,
  banCommand,
  kickCommand,
  purgeCommand,
  warnCommand,
  autoroleCommand,
  setlogCommand,
  autoresponderCommand,
  embedCommand
];

const commands = commandsList
  .filter((cmd) => cmd && "data" in cmd)
  .map((cmd) => cmd.data.toJSON());

async function deploy() {
  const rest = new REST({ version: "10" }).setToken(Config.DISCORD_TOKEN);

  try {
    logger.info(`Đang đồng bộ ${commands.length} slash commands lên Discord API...`);

    const route = Config.GUILD_ID
      ? Routes.applicationGuildCommands(Config.CLIENT_ID, Config.GUILD_ID)
      : Routes.applicationCommands(Config.CLIENT_ID);

    if (Config.GUILD_ID) {
      await rest.put(Routes.applicationCommands(Config.CLIENT_ID), { body: [] });
      logger.info("Đã xóa các slash command global cũ để tránh bị trùng.");
    }

    await rest.put(
      route,
      { body: commands }
    );

    logger.info("Đồng bộ toàn bộ Slash Commands lên Discord thành công!");
  } catch (error) {
    logger.error("Lỗi trong quá trình đăng ký lệnh:", error);
  }
}

deploy();