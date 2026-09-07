import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Xem thông tin của một thành viên")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Thành viên cần xem thông tin")
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = await interaction.guild!.members.fetch(user.id).catch(() => null) as GuildMember | null;
    const createdAt = Math.floor(user.createdTimestamp / 1000);
    const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
    const roles = member?.roles.cache
      .filter((role) => role.id !== interaction.guild!.id)
      .sort((first, second) => second.position - first.position)
      .map((role) => role.toString())
      .join(", ");

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Tài khoản tạo", value: `<t:${createdAt}:F>\n(<t:${createdAt}:R>)`, inline: true },
        { name: "Bot", value: user.bot ? "Có" : "Không", inline: true }
      )
      .setFooter({ text: `Thông tin trong ${interaction.guild!.name}` })
      .setTimestamp();

    if (joinedAt) {
      embed.addFields({ name: "Tham gia server", value: `<t:${joinedAt}:F>\n(<t:${joinedAt}:R>)`, inline: true });
    }
    if (member?.nickname) {
      embed.addFields({ name: "Nickname", value: member.nickname, inline: true });
    }
    if (roles) {
      embed.addFields({ name: `Vai trò (${member!.roles.cache.size - 1})`, value: roles.slice(0, 1024) });
    }

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
