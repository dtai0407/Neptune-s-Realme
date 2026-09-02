import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  MessageFlags
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";
import { db } from "../../database/client";
import { logger } from "../../utils/logger.util";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("setlog")
    .setDescription("Thiết lập kênh gửi thông báo nhật ký (Audit Log) cho máy chủ.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Chọn kênh văn bản làm nơi gửi log")
        .addChannelOption((opt) =>
          opt
            .setName("target")
            .setDescription("Kênh văn bản muốn nhận log")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Tắt tính năng gửi log tập trung")
    ),

  botPermissions: [PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.SendMessages],
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      if (subcommand === "channel") {
        const channel = interaction.options.getChannel("target", true) as TextChannel;
        const botMember = interaction.guild?.members.me;

        if (!botMember) {
          await interaction.editReply({ content: "Không thể lấy dữ liệu bot trong server." });
          return;
        }

        // Kiểm tra quyền gửi tin nhắn và xem kênh của bot tại channel được chọn
        const botPermissions = channel.permissionsFor(botMember);
        if (!botPermissions.has(PermissionFlagsBits.SendMessages) || !botPermissions.has(PermissionFlagsBits.EmbedLinks)) {
          await interaction.editReply({
            content: `Bot thiếu quyền **Send Messages** hoặc **Embed Links** trong kênh <#${channel.id}>.`
          });
          return;
        }

        await db.guildConfig.upsert({
          where: { guildId },
          update: { logChannelId: channel.id },
          create: {
            guildId,
            logChannelId: channel.id
          }
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Cấu hình Kênh Nhật Ký Hoàn Tất")
          .setDescription(`Từ bây giờ các sự kiện audit sẽ được ghi nhận tại kênh: <#${channel.id}>.`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === "disable") {
        await db.guildConfig.upsert({
          where: { guildId },
          update: { logChannelId: null },
          create: { guildId }
        });

        await interaction.editReply({ content: "Đã hủy kích hoạt kênh nhật ký của máy chủ." });
      }
    } catch (error) {
      logger.error("Lỗi thực thi lệnh /setlog:", error);
      await interaction.editReply({
        content: "Đã xảy ra sự cố khi lưu cấu hình kênh nhật ký vào database."
      });
    }
  }
};

export default command;