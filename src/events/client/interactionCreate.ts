import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, Interaction, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ExtendedClient } from "../../@type";
import { db } from "../../database/client";
import { buildEmbedPanel, makeEmbed } from "../../commands/config/embed";
import { activeGiveaways, finishGiveaway } from "../../services/giveaway.service";

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, client: ExtendedClient) {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName !== "autoresponder" || !interaction.guildId) {
        await interaction.respond([]);
        return;
      }

      const focused = interaction.options.getFocused().toLowerCase();
      const responders = await db.autoResponder.findMany({
        where: { guildId: interaction.guildId },
        orderBy: { trigger: "asc" },
        take: 25
      }).catch(() => []);
      await interaction.respond(
        responders
          .filter((responder) => responder.trigger.includes(focused))
          .slice(0, 25)
          .map((responder) => ({ name: responder.trigger, value: responder.trigger }))
      ).catch(() => undefined);
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        const content = "Đã xảy ra lỗi khi xử lý lệnh.";
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(content).catch(() => undefined);
        } else {
          await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
        }
        console.error(error);
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("autoresponder_editreply_modal:")) {
      const responderId = interaction.customId.slice("autoresponder_editreply_modal:".length);
      const reply = interaction.fields.getTextInputValue("reply").trim();
      await db.autoResponder.update({ where: { id: responderId }, data: { response: reply } });
      await interaction.reply("Đã cập nhật reply của autoresponder.");
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("embed_modal:")) {
      const [, field, presetId] = interaction.customId.split(":");
      const preset = await db.embedPreset.findUnique({ where: { id: presetId } });
      if (!preset) {
        await interaction.reply({ content: "Embed này không còn tồn tại.", flags: MessageFlags.Ephemeral });
        return;
      }

      const title = field === "content" ? interaction.fields.getTextInputValue("title").trim() : preset.title;
      const description = field === "content" ? interaction.fields.getTextInputValue("description").trim() : preset.description;
      const color = field === "color" ? interaction.fields.getTextInputValue("color").trim() : preset.color;
      const thumbnailUrl = field === "thumbnail" ? interaction.fields.getTextInputValue("thumbnail").trim() || null : preset.thumbnailUrl;
      const imageUrl = field === "image" ? interaction.fields.getTextInputValue("image").trim() || null : preset.imageUrl;
      if (!title || !description || !/^#[0-9a-f]{6}$/i.test(color)) {
        await interaction.reply({ content: "Dữ liệu embed không hợp lệ. Màu phải có dạng #5865F2.", flags: MessageFlags.Ephemeral });
        return;
      }

      const updated = await db.embedPreset.update({
        where: { id: preset.id },
        data: { title, description, color, thumbnailUrl, imageUrl }
      });
      await interaction.message?.edit(buildEmbedPanel(updated));
      await interaction.reply({ content: "Đã cập nhật embed.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.isButton()) {
      return;
    }

    if (interaction.customId.startsWith("embed_")) {
      const [action, presetId] = interaction.customId.split(":");
      const preset = await db.embedPreset.findUnique({ where: { id: presetId } });
      if (!preset) {
        await interaction.reply({ content: "Embed này không còn tồn tại.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (action === "embed_send") {
        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || !("send" in channel)) {
          await interaction.reply({ content: "Kênh hiện tại không thể nhận embed.", flags: MessageFlags.Ephemeral });
          return;
        }
        await channel.send({ embeds: [makeEmbed(preset.title, preset.description, preset.color, preset.thumbnailUrl, preset.imageUrl)] });
        await interaction.reply({ content: "Đã gửi embed vào kênh.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (action === "embed_remove") {
        await db.embedPreset.delete({ where: { id: preset.id } });
        await interaction.update({ content: `Đã xóa embed **${preset.name}**.`, embeds: [], components: [] });
        return;
      }
      if (action === "embed_share") {
        const updated = await db.embedPreset.update({ where: { id: preset.id }, data: { shared: !preset.shared } });
        await interaction.update(buildEmbedPanel(updated));
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`embed_modal:${action.slice("embed_".length)}:${preset.id}`)
        .setTitle(action === "embed_content" ? "Tiêu đề & Nội dung" : action === "embed_color" ? "Màu Embed" : action === "embed_thumbnail" ? "Ảnh thu nhỏ" : "Ảnh lớn");
      const inputs: TextInputBuilder[] = [];
      if (action === "embed_content") {
        inputs.push(
          new TextInputBuilder().setCustomId("title").setLabel("Tiêu đề").setStyle(TextInputStyle.Short).setMaxLength(256).setValue(preset.title).setRequired(true),
          new TextInputBuilder().setCustomId("description").setLabel("Nội dung").setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setValue(preset.description.slice(0, 4000)).setRequired(true)
        );
      } else {
        const field = action === "embed_color" ? "color" : action === "embed_thumbnail" ? "thumbnail" : "image";
        const value = field === "color" ? preset.color : field === "thumbnail" ? preset.thumbnailUrl : preset.imageUrl;
        inputs.push(new TextInputBuilder().setCustomId(field).setLabel(field === "color" ? "Màu hex (#5865F2)" : "URL ảnh (để trống để xóa)").setStyle(TextInputStyle.Short).setMaxLength(2048).setValue(value ?? "").setRequired(false));
      }
      modal.addComponents(...inputs.map((input) => new ActionRowBuilder<TextInputBuilder>().addComponents(input)));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId.startsWith("autoresponder_editreply:")) {
      const responderId = interaction.customId.slice("autoresponder_editreply:".length);
      const responder = await db.autoResponder.findUnique({ where: { id: responderId } });
      if (!responder) {
        await interaction.reply({ content: "Autoresponder không còn tồn tại.", flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`autoresponder_editreply_modal:${responder.id}`)
        .setTitle("Edit autoresponder reply");
      const replyInput = new TextInputBuilder()
        .setCustomId("reply")
        .setLabel("Reply")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setValue(responder.response)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(replyInput));
      await interaction.showModal(modal);
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