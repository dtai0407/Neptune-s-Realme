import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Xem thông tin server hiện tại")
    .setDMPermission(false),

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    const guild = interaction.guild!;
    const owner = await guild.fetchOwner().catch(() => null);
    const textChannels = guild.channels.cache.filter((channel) => channel.isTextBased()).size;
    const voiceChannels = guild.channels.cache.filter((channel) => channel.isVoiceBased()).size;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .addFields(
        { name: "ID", value: guild.id, inline: true },
        { name: "Chủ server", value: owner?.user.tag ?? `<@${guild.ownerId}>`, inline: true },
        { name: "Thành viên", value: guild.memberCount.toLocaleString("vi-VN"), inline: true },
        { name: "Kênh", value: `${textChannels} text / ${voiceChannels} voice`, inline: true },
        { name: "Vai trò", value: String(guild.roles.cache.size - 1), inline: true },
        { name: "Tạo lúc", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Xác minh: ${guild.verificationLevel}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
