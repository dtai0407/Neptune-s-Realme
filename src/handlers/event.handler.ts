import { ExtendedClient } from "../@type";
import { readdirSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.util";

export async function loadEvents(client: ExtendedClient) {
  const eventsPath = join(__dirname, "../events");
  const folders = readdirSync(eventsPath);

  for (const folder of folders) {
    const folderPath = join(eventsPath, folder);
    const eventFiles = readdirSync(folderPath).filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js")
    );

    for (const file of eventFiles) {
      const filePath = join(folderPath, file);
      const imported = require(filePath);
      const event = imported.default ? imported.default : imported;

      if (event && event.name && typeof event.execute === "function") {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
        logger.info(`Đã nạp sự kiện: ${event.name}`);
      } else {
        logger.warn(`File sự kiện tại ${filePath} thiếu thuộc tính name hoặc execute.`);
      }
    }
  }
}