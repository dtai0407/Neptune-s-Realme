import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command, ExtendedClient } from "../../@type";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kiss")
    .setDescription("Gửi một nụ hôn thân thiện")
    .setDMPermission(false)
    .addUserOption((option) => option.setName("target").setDescription("Thành viên nhận nụ hôn").setRequired(true)),

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    const target = interaction.options.getUser("target", true);
    const embed = new EmbedBuilder()
      .setColor(0x001857)
      .setDescription(`😘 <@${interaction.user.id}> đã gửi một nụ hôn thân thiện đến <@${target.id}>!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
