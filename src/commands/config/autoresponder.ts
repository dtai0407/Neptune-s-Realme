import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";
import { db } from "../../database/client";
import { logger } from "../../utils/logger.util";

function buildResponderMessage(responder: { id: string; trigger: string; response: string; matchMode: string }) {
  const detail = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: "Neptune's Realme" })
    .setTitle("⭐ created autoresponder")
    .setDescription([
      "• not sure how to configure all these options?",
      "• check out the using ar functions guide in our docs",
      "",
      `\`\`\`${responder.response}\`\`\``
    ].join("\n"))
    .addFields(
      { name: "trigger", value: responder.trigger, inline: true },
      { name: "match mode", value: responder.matchMode, inline: true },
      { name: "response method", value: "sends in current channel", inline: true },
      { name: "has embed(s)", value: "none", inline: true },
      { name: "has buttons?", value: "none", inline: true },
      { name: "cooldown?", value: "no cooldown", inline: true },
      { name: "makes choices?", value: "no", inline: true },
      { name: "makes changes user balances?", value: "no balance modifications", inline: true },
      { name: "changes user item inventories?", value: "no inventory modifications", inline: true },
      { name: "requires/denies any permissions?", value: "none required", inline: true },
      { name: "requires/denies any roles?", value: "none required", inline: true },
      { name: "requires specific user(s)?", value: "none required", inline: true },
      { name: "requires/denies any channels?", value: "none required", inline: true },
      { name: "requires specific argument type?", value: "none required", inline: true },
      { name: "requires balances?", value: "none required", inline: true },
      { name: "requires item(s)?", value: "none required", inline: true },
      { name: "adds/removes roles?", value: "added: none\nremoved: none", inline: true },
      { name: "silent errors?", value: "no (recommended)", inline: true },
      { name: "deletes messages?", value: "trigger: no\nreply: no", inline: true },
      { name: "react emojis?", value: "trigger: none\nreply: none", inline: true },
      { name: "reply", value: responder.response }
    )
    .setFooter({ text: "Autoresponder" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`autoresponder_editreply:${responder.id}`)
      .setLabel("📝 edit reply")
      .setStyle(ButtonStyle.Secondary)
  );

    return { embeds: [detail], components: [row] };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autoresponder")
    .setDescription("Tạo và quản lý autoresponder")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) => subcommand.setName("add").setDescription("Tạo hoặc cập nhật một autoresponder")
      .addStringOption((option) => option.setName("trigger").setDescription("Từ khóa kích hoạt mới").setMaxLength(100).setRequired(true))
      .addStringOption((option) => option.setName("reply").setDescription("Nội dung bot trả lời").setMaxLength(2000).setRequired(true))
      .addStringOption((option) => option.setName("matchmode").setDescription("Cách khớp trigger").addChoices(
        { name: "exact", value: "exact" },
        { name: "startswith", value: "startswith" },
        { name: "endswith", value: "endswith" },
        { name: "includes", value: "includes" }
      )))
    .addSubcommand((subcommand) => subcommand.setName("editreply").setDescription("Sửa nội dung trả lời")
      .addStringOption((option) => option.setName("trigger").setDescription("Trigger cần sửa").setMaxLength(100).setRequired(true).setAutocomplete(true))
      .addStringOption((option) => option.setName("reply").setDescription("Nội dung mới").setMaxLength(2000).setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName("editmatchmode").setDescription("Sửa cách khớp trigger")
      .addStringOption((option) => option.setName("trigger").setDescription("Trigger cần sửa").setMaxLength(100).setRequired(true).setAutocomplete(true))
      .addStringOption((option) => option.setName("matchmode").setDescription("Cách khớp mới").setRequired(true).addChoices(
        { name: "exact", value: "exact" },
        { name: "startswith", value: "startswith" },
        { name: "endswith", value: "endswith" },
        { name: "includes", value: "includes" }
      )))
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("Xem các autoresponder của server"))
    .addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Xóa một autoresponder")
      .addStringOption((option) => option.setName("trigger").setDescription("Trigger cần xóa").setMaxLength(100).setRequired(true).setAutocomplete(true)))
    .addSubcommand((subcommand) => subcommand.setName("show").setDescription("Xem chi tiết một autoresponder")
      .addStringOption((option) => option.setName("trigger").setDescription("Trigger cần xem").setMaxLength(100).setRequired(true).setAutocomplete(true)))
    .addSubcommand((subcommand) => subcommand.setName("showraw").setDescription("Xem raw reply của autoresponder")
      .addStringOption((option) => option.setName("trigger").setDescription("Trigger cần xem").setMaxLength(100).setRequired(true).setAutocomplete(true))),

  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const trigger = interaction.options.getString("trigger")?.trim().toLowerCase();

    try {
      if (subcommand === "add") {
        const response = interaction.options.getString("reply", true).trim();
        const matchMode = interaction.options.getString("matchmode") ?? "exact";
        const responder = await db.autoResponder.upsert({
          where: { guildId_trigger: { guildId, trigger: trigger! } },
          update: { response, matchMode },
          create: { guildId, trigger: trigger!, response, matchMode }
        });
        await interaction.reply(buildResponderMessage(responder));
        return;
      }

      if (subcommand === "editreply" || subcommand === "editmatchmode") {
        const responder = trigger ? await db.autoResponder.findUnique({ where: { guildId_trigger: { guildId, trigger } } }) : null;
        if (!responder) throw new Error("Không tìm thấy autoresponder");
        await db.autoResponder.update({
          where: { id: responder.id },
          data: subcommand === "editreply"
            ? { response: interaction.options.getString("reply", true).trim() }
            : { matchMode: interaction.options.getString("matchmode", true) }
        });
          await interaction.reply("Đã cập nhật autoresponder.");
        return;
      }

      if (subcommand === "remove") {
        const result = await db.autoResponder.deleteMany({ where: { guildId, trigger } });
          await interaction.reply(result.count ? `Đã xóa **${trigger}**.` : `Không tìm thấy **${trigger}**.`);
        return;
      }

      if (subcommand === "list") {
        const responders = await db.autoResponder.findMany({ where: { guildId }, orderBy: { trigger: "asc" } });
          await interaction.reply(responders.length ? responders.map((item) => `• **${item.trigger}** (${item.matchMode})`).join("\n") : "Chưa có autoresponder nào.");
        return;
      }

      const responder = trigger ? await db.autoResponder.findUnique({ where: { guildId_trigger: { guildId, trigger } } }) : null;
      if (!responder) throw new Error("Không tìm thấy autoresponder");
      if (subcommand === "showraw") {
          await interaction.reply(responder.response);
        return;
      }

      await interaction.reply(buildResponderMessage(responder));
    } catch (error) {
      logger.error("Lỗi thực thi lệnh /autoresponder:", error);
      const content = "Không tìm thấy autoresponder hoặc dữ liệu không hợp lệ.";
        await interaction.reply(content).catch(() => interaction.editReply(content));
    }
  }
};

export default command;
