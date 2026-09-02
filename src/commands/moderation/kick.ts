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
    .setName("kick")
    .setDescription("Trục xuất thành viên khỏi máy chủ (Kick).")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Thành viên cần trục xuất").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Lý do trục xuất").setRequired(false)
    ),

  botPermissions: [PermissionFlagsBits.KickMembers],
  userPermissions: [PermissionFlagsBits.KickMembers],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const targetUser = interaction.options.getUser("target", true);
      const reason = interaction.options.getString("reason") || "Không cung cấp lý do";

      const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
      const moderatorMember = interaction.member as GuildMember;
      const botMember = interaction.guild?.members.me;

      if (!targetMember) {
        await interaction.editReply({ content: "Thành viên này hiện không có trong máy chủ." });
        return;
      }

      if (!botMember) {
        await interaction.editReply({ content: "Lỗi hệ thống: Không thể xác định danh tính Bot." });
        return;
      }

      const hierarchyCheck = validateHierarchy(moderatorMember, targetMember, botMember);
      if (!hierarchyCheck.canExecute) {
        await interaction.editReply({ content: `Thao tác bị từ chối: ${hierarchyCheck.reason}` });
        return;
      }

      await targetMember.kick(`${moderatorMember.user.tag}: ${reason}`);
      logger.info(`Thành viên ${targetMember.user.tag} (${targetMember.id}) đã bị KICK bởi ${moderatorMember.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("Hành động: Trục xuất (Kick)")
        .addFields(
          { name: "Mục tiêu", value: `${targetMember.user.tag} (<@${targetMember.id}>)`, inline: true },
          { name: "Người xử lý", value: `<@${moderatorMember.id}>`, inline: true },
          { name: "Lý do", value: reason }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error("Lỗi khi thực thi lệnh /kick:", error);
      await interaction.editReply({ content: "Đã xảy ra lỗi nội bộ khi trục xuất thành viên." });
    }
  }
};

export default command;