import { Events, Client } from "discord.js";
import { logger } from "../../utils/logger.util";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    logger.info(`>>> Neptune Bot đã trực tuyến thành công với tài khoản: ${client.user?.tag} <<<`);
  }
};