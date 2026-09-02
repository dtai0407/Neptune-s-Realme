import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  Role
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";
import { db } from "../../database/client";
import { logger } from "../../utils/logger.util";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Cấu hình vai trò (role) tự động cấp cho thành viên mới.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Chọn role sẽ tự động cấp cho thành viên mới vào máy chủ")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Vai trò chỉ định").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Tắt tính năng tự động cấp vai trò")
    ),

  botPermissions: [PermissionFlagsBits.ManageRoles],
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      if (subcommand === "set") {
        const role = interaction.options.getRole("role", true) as Role;
        const botMember = interaction.guild?.members.me;

        if (!botMember) {
          await interaction.editReply({ content: "Không thể lấy thông tin bot trong máy chủ." });
          return;
        }

        // Không cho phép gán role quản trị nguy hiểm hoặc role bot tích hợp sẵn
        if (role.managed) {
          await interaction.editReply({
            content: "Không thể chọn role do hệ thống bot/ứng dụng bên ngoài quản lý."
          });
          return;
        }

        // Kiểm tra thứ bậc: Role của bot phải cao hơn role muốn gán
        if (role.position >= botMember.roles.highest.position) {
          await interaction.editReply({
            content: `Thao tác thất bại: Role **${role.name}** nằm ngang hoặc cao hơn role cao nhất của Bot. Hãy kéo role của Bot lên cao hơn.`
          });
          return;
        }

        await db.guildConfig.upsert({
          where: { guildId },
          update: { autoRoleId: role.id },
          create: {
            guildId,
            autoRoleId: role.id
          }
        });

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("Cấu hình Auto-Role thành công")
          .setDescription(`Thành viên mới tham gia máy chủ sẽ tự động nhận role: <@&${role.id}>.`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === "disable") {
        await db.guildConfig.upsert({
          where: { guildId },
          update: { autoRoleId: null },
          create: { guildId }
        });

        await interaction.editReply({
          content: "Đã tắt tính năng tự động cấp vai trò cho thành viên mới."
        });
      }
    } catch (error) {
      logger.error("Lỗi thực thi lệnh /autorole:", error);
      await interaction.editReply({
        content: "Đã xảy ra lỗi trong quá trình lưu cấu hình vào cơ sở dữ liệu."
      });
    }
  }
};

export default command;