import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  MessageFlags
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";
import { validateHierarchy } from "../../utils/hierarchy.util";
import { logger } from "../../utils/logger.util";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Cấm thành viên khỏi máy chủ (Ban).")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Thành viên cần cấm").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Lý do cấm").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete_days")
        .setDescription("Xóa tin nhắn của đối tượng trong vòng X ngày qua")
        .setRequired(false)
        .addChoices(
          { name: "Không xóa", value: 0 },
          { name: "24 Giờ qua", value: 1 },
          { name: "7 Ngày qua", value: 7 }
        )
    ),

  botPermissions: [PermissionFlagsBits.BanMembers],
  userPermissions: [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const targetUser = interaction.options.getUser("target", true);
      const reason = interaction.options.getString("reason") || "Không cung cấp lý do";
      const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

      const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
      const moderatorMember = interaction.member as GuildMember;
      const botMember = interaction.guild?.members.me;

      if (!botMember) {
        await interaction.editReply({ content: "Lỗi hệ thống: Không thể xác định danh tính Bot." });
        return;
      }

      if (targetMember) {
        const hierarchyCheck = validateHierarchy(moderatorMember, targetMember, botMember);
        if (!hierarchyCheck.canExecute) {
          await interaction.editReply({ content: `Thao tác bị từ chối: ${hierarchyCheck.reason}` });
          return;
        }
      }

      await interaction.guild?.members.ban(targetUser.id, {
        reason: `${moderatorMember.user.tag}: ${reason}`,
        deleteMessageSeconds: deleteDays * 86400
      });

      logger.info(`Thành viên ${targetUser.tag} (${targetUser.id}) đã bị BAN bởi ${moderatorMember.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("Hành động: Cấm thành viên (Ban)")
        .addFields(
          { name: "Mục tiêu", value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
          { name: "Người xử lý", value: `<@${moderatorMember.id}>`, inline: true },
          { name: "Xóa tin nhắn", value: `${deleteDays} ngày`, inline: true },
          { name: "Lý do", value: reason }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Lỗi khi thực thi lệnh /ban:", error);
      await interaction.editReply({ content: "Đã xảy ra lỗi nội bộ khi thực hiện lệnh cấm." });
    }
  }
};

export default command;