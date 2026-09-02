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
    .setName("timeout")
    .setDescription("Tạm dừng quyền hoạt động (Mute/Timeout) một thành viên.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Thành viên cần xử lý").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Thời lượng timeout")
        .setRequired(true)
        .addChoices(
          { name: "60 Giây", value: 60 },
          { name: "5 Phút", value: 300 },
          { name: "10 Phút", value: 600 },
          { name: "1 Giờ", value: 3600 },
          { name: "1 Ngày", value: 86400 },
          { name: "1 Tuần", value: 604800 }
        )
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Lý do phạt").setRequired(false)
    ),

  botPermissions: [PermissionFlagsBits.ModerateMembers],
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction, client: ExtendedClient) => {
    // Trì hoãn phản hồi để tránh lỗi 3s timeout của Discord
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const targetUser = interaction.options.getUser("target", true);
      const durationSeconds = interaction.options.getInteger("duration", true);
      const reason = interaction.options.getString("reason") || "Không cung cấp lý do cụ thể";

      if (!targetUser) {
        await interaction.editReply({ content: "Vui lòng chỉ định thành viên cần timeout. Ví dụ: `ntimeout @thanhvien 5 lý do`." });
        return;
      }

      const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
      const moderatorMember = interaction.member as GuildMember;
      const botMember = interaction.guild?.members.me;

      if (!targetMember) {
        await interaction.editReply({ content: "Thành viên này không tồn tại trong máy chủ." });
        return;
      }

      if (!botMember) {
        await interaction.editReply({ content: "Lỗi hệ thống: Không thể xác định thông tin Bot." });
        return;
      }

      // Kiểm tra thứ bậc role
      const hierarchyCheck = validateHierarchy(moderatorMember, targetMember, botMember);
      if (!hierarchyCheck.canExecute) {
        await interaction.editReply({ content: `Thao tác bị từ chối: ${hierarchyCheck.reason}` });
        return;
      }

      // Thực thi Timeout
      const durationMs = durationSeconds * 1000;
      await targetMember.timeout(durationMs, `${moderatorMember.user.tag}: ${reason}`);

      logger.info(
        `Thành viên ${targetMember.user.tag} (${targetMember.id}) đã bị timeout ${durationSeconds}s bởi ${moderatorMember.user.tag}`
      );

      const durationLabel = durationSeconds % 86400 === 0
        ? `${durationSeconds / 86400} ngày`
        : durationSeconds % 3600 === 0
          ? `${durationSeconds / 3600} giờ`
          : durationSeconds % 60 === 0
            ? `${durationSeconds / 60} phút`
            : `${durationSeconds} giây`;

      const successEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("Xử phạt: Thành viên bị cách ly")
        .addFields(
          { name: "Mục tiêu", value: `<@${targetMember.id}> (${targetMember.user.tag})`, inline: true },
          { name: "Người xử lý", value: `<@${moderatorMember.id}>`, inline: true },
          { name: "Thời lượng", value: durationLabel, inline: true },
          { name: "Lý do", value: reason }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      logger.error("Lỗi khi thực thi lệnh /timeout:", error);
      await interaction.editReply({
        content: "Đã xảy ra lỗi nội bộ trong quá trình áp dụng hình phạt. Vui lòng kiểm tra log hệ thống."
      });
    }
  }
};

export default command;