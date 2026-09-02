import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
  MessageFlags
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";
import { db } from "../../database/client";
import { validateHierarchy } from "../../utils/hierarchy.util";
import { logger } from "../../utils/logger.util";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Hệ thống cảnh cáo thành viên vi phạm quy tắc.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Thêm một cảnh cáo cho thành viên")
        .addUserOption((opt) =>
          opt.setName("target").setDescription("Thành viên nhận cảnh cáo").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Lý do cảnh cáo").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Xem lịch sử các lần cảnh cáo của thành viên")
        .addUserOption((opt) =>
          opt.setName("target").setDescription("Thành viên cần tra cứu").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Gỡ bỏ một cảnh cáo theo mã ID")
        .addStringOption((opt) =>
          opt.setName("id").setDescription("Mã ID của cảnh cáo (tra cứu qua /warn list)").setRequired(true)
        )
    ),

  botPermissions: [PermissionFlagsBits.ModerateMembers],
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      // Đảm bảo cấu hình Guild đã tồn tại trong DB
      await db.guildConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId }
      });

      // 1. Subcommand: ADD
      if (subcommand === "add") {
        const targetUser = interaction.options.getUser("target", true);
        const reason = interaction.options.getString("reason", true);

        if (!targetUser) {
          await interaction.editReply({ content: "Vui lòng chỉ định thành viên cần cảnh cáo. Ví dụ: `nwarn add @thanhvien spam`." });
          return;
        }

        const moderatorMember = interaction.member as GuildMember;
        const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
        const botMember = interaction.guild?.members.me;

        if (!targetMember || !botMember) {
          await interaction.editReply({ content: "Không tìm thấy thành viên hoặc dữ liệu bot." });
          return;
        }

        const hierarchyCheck = validateHierarchy(moderatorMember, targetMember, botMember);
        if (!hierarchyCheck.canExecute) {
          await interaction.editReply({ content: `Thao tác bị từ chối: ${hierarchyCheck.reason}` });
          return;
        }

        const warning = await db.warning.create({
          data: {
            guildId,
            userId: targetUser.id,
            moderatorId: moderatorMember.id,
            reason
          }
        });

        const totalWarns = await db.warning.count({
          where: { guildId, userId: targetUser.id }
        });

        let punishmentNotice = "Không";
        // Tự động phạt lũy tiến: Đạt mốc 3 cảnh cáo -> Tự động Timeout 1 giờ
        if (totalWarns >= 3) {
          await targetMember.timeout(3600 * 1000, `Tự động phạt: Đạt ngưỡng ${totalWarns} lần cảnh cáo.`);
          punishmentNotice = "Tự động Timeout 1 giờ (Đạt ngưỡng ≥ 3 cảnh cáo)";
        }

        const embed = new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("Đã cấp cảnh cáo thành viên")
          .addFields(
            { name: "Mục tiêu", value: `<@${targetUser.id}>`, inline: true },
            { name: "Người xử lý", value: `<@${moderatorMember.id}>`, inline: true },
            { name: "Tổng cảnh cáo hiện tại", value: `**${totalWarns}**`, inline: true },
            { name: "Mã cảnh cáo (ID)", value: `\`${warning.id}\``, inline: true },
            { name: "Hình phạt bổ sung", value: punishmentNotice, inline: true },
            { name: "Lý do", value: reason }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }

      // 2. Subcommand: LIST
      else if (subcommand === "list") {
        const targetUser = interaction.options.getUser("target", true);

        if (!targetUser) {
          await interaction.editReply({ content: "Vui lòng chỉ định thành viên cần tra cứu. Ví dụ: `nwarn list @thanhvien`." });
          return;
        }

        const warnings = await db.warning.findMany({
          where: { guildId, userId: targetUser.id },
          orderBy: { createdAt: "desc" },
          take: 10
        });

        if (warnings.length === 0) {
          await interaction.editReply({ content: `Thành viên <@${targetUser.id}> chưa có tiền án cảnh cáo nào.` });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Hồ sơ vi phạm: ${targetUser.tag}`)
          .setDescription(`Tổng cộng: **${warnings.length}** lần vi phạm gần nhất:`)
          .setTimestamp();

        for (const [index, warn] of warnings.entries()) {
          embed.addFields({
            name: `#${index + 1} | Mã: ${warn.id}`,
            value: `**Lý do:** ${warn.reason}\n**Người phạt:** <@${warn.moderatorId}> - <t:${Math.floor(warn.createdAt.getTime() / 1000)}:R>`
          });
        }

        await interaction.editReply({ embeds: [embed] });
      }

      // 3. Subcommand: REMOVE
      else if (subcommand === "remove") {
        const warnId = interaction.options.getString("id", true);

        const existingWarn = await db.warning.findUnique({
          where: { id: warnId }
        });

        if (!existingWarn || existingWarn.guildId !== guildId) {
          await interaction.editReply({ content: `Không tìm thấy bản ghi cảnh cáo mang mã ID: \`${warnId}\`.` });
          return;
        }

        await db.warning.delete({
          where: { id: warnId }
        });

        await interaction.editReply({
          content: `Đã xóa thành công bản ghi cảnh cáo \`${warnId}\` của đối tượng <@${existingWarn.userId}>.`
        });
      }
    } catch (error) {
      logger.error("Lỗi khi xử lý lệnh /warn:", error);
      await interaction.editReply({ content: "Đã xảy ra sự cố cơ sở dữ liệu khi thao tác cảnh cáo." });
    }
  }
};

export default command;