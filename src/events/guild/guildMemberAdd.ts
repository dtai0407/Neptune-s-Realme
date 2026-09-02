import { Events, GuildMember } from "discord.js";
import { ExtendedClient } from "../../@type";
import { db } from "../../database/client";
import { logger } from "../../utils/logger.util";

export default {
  name: Events.GuildMemberAdd,
  async execute(member: GuildMember, _client: ExtendedClient) {
    if (member.user.bot) return;

    try {
      const config = await db.guildConfig.findUnique({
        where: { guildId: member.guild.id }
      });

      if (!config || !config.autoRoleId) return;

      const role = await member.guild.roles.fetch(config.autoRoleId).catch(() => null);
      if (!role) {
        logger.warn(`Auto-Role ID ${config.autoRoleId} không còn tồn tại trong Guild ${member.guild.id}`);
        return;
      }

      await member.roles.add(role);
      logger.info(`Đã tự động cấp role [${role.name}] cho thành viên mới: ${member.user.tag}`);
    } catch (error) {
      logger.error(`Lỗi khi tự động cấp role cho ${member.user.tag}:`, error);
    }
  }
};