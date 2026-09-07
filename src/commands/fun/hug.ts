import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command, ExtendedClient } from "../../@type";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("Ôm một thành viên")
    .setDMPermission(false)
    .addUserOption((option) => option.setName("target").setDescription("Thành viên cần ôm").setRequired(true)),

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    const target = interaction.options.getUser("target", true);
    const embed = new EmbedBuilder()
      .setColor(0x001857)
      .setDescription(`🤗 <@${interaction.user.id}> đã ôm <@${target.id}>!`)
      .setImage("https://res.cloudinary.com/dgwy52a5x/image/upload/v1788761748/51718513773fe938a87375d53b211b36_ki0wtq.gif")
      
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
