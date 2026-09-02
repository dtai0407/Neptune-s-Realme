import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, Interaction, MessageFlags } from "discord.js";
import { ExtendedClient } from "../../@type";
import { activeGiveaways, finishGiveaway } from "../../services/giveaway.service";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, _client: ExtendedClient) {
    if (interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.isButton()) {
      return;
    }

    if (interaction.customId.startsWith("giveaway_join:")) {
      const messageId = interaction.customId.slice("giveaway_join:".length);
      const giveaway = activeGiveaways.get(messageId);

      if (!giveaway) {
        await interaction.reply({ content: "Giveaway này đã kết thúc hoặc không còn tồn tại.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (Date.now() >= giveaway.endsAt) {
        await finishGiveaway(interaction.client, giveaway);
        await interaction.reply({ content: "Giveaway vừa kết thúc.", flags: MessageFlags.Ephemeral });
        return;
      }

      const userId = interaction.user.id;
      const joined = giveaway.participants.has(userId);
      if (joined) {
        giveaway.participants.delete(userId);
      } else {
        giveaway.participants.add(userId);
      }

      const joinRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join:${giveaway.messageId}`)
          .setLabel(`🎉 ${giveaway.participants.size}`)
          .setStyle(ButtonStyle.Success)
      );
      await interaction.update({ components: [joinRow] });
      await interaction.followUp({
        content: joined ? "Bạn đã rời giveaway." : "Bạn đã tham gia giveaway.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!interaction.customId.startsWith("avatar_")) {
      return;
    }

    const [action, userId] = interaction.customId.slice("avatar_".length).split(":");
    const user = userId ? await interaction.client.users.fetch(userId).catch(() => null) : null;
    const embed = new EmbedBuilder().setColor(0x5865f2).setTimestamp();

    if (action === "user" && user) {
      embed
        .setTitle(`${user.displayName} • Avatar`)
        .setImage(user.displayAvatarURL({ size: 1024, extension: "png" }));
    } else if (action === "server" && interaction.guild && user) {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const serverAvatarUrl = member?.displayAvatarURL({ size: 1024, extension: "png" });
      if (!serverAvatarUrl) {
        await interaction.reply({ content: "User này chưa có avatar riêng trong server.", flags: MessageFlags.Ephemeral });
        return;
      }

      embed.setTitle(`${user.displayName} • Server Avatar`).setImage(serverAvatarUrl);
    } else if (action === "banner" && user) {
      const fetchedUser = await user.fetch();
      const bannerUrl = fetchedUser.bannerURL({ size: 1024, extension: "png" });
      if (!bannerUrl) {
        await interaction.reply({ content: "Người dùng này chưa có banner.", flags: MessageFlags.Ephemeral });
        return;
      }

      embed.setTitle(`${user.displayName} • Banner`).setImage(bannerUrl);
    } else {
      await interaction.reply({ content: "Không thể tải dữ liệu hình ảnh.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.update({ embeds: [embed] });
  }
};