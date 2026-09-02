import { ExtendedClient } from "../@type";
import { readdirSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.util";

export async function loadCommands(client: ExtendedClient) {
  const commandsPath = join(__dirname, "../commands");
  const categories = readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = join(commandsPath, category);
    const commandFiles = readdirSync(categoryPath).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js")
    );

    for (const file of commandFiles) {
      const filePath = join(categoryPath, file);
      const commandModule = require(filePath);
      const command = commandModule.default || commandModule;

      if (command && "data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Đã nạp lệnh: /${command.data.name} [${category}]`);
      } else {
        logger.warn(`Lệnh tại ${filePath} thiếu thuộc tính data hoặc execute.`);
      }
    }
  }
}