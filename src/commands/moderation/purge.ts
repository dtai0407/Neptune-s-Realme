import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
  EmbedBuilder
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";
import { logger } from "../../utils/logger.util";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Dọn dẹp tin nhắn hàng loạt trong kênh.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Số lượng tin nhắn cần xóa (1 - 100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Chỉ xóa tin nhắn của người này").setRequired(false)
    ),

  botPermissions: [PermissionFlagsBits.ManageMessages],
  userPermissions: [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    const channel = interaction.channel;
    const isTextBasedChannel = !!channel && "messages" in channel && "bulkDelete" in channel;

    if (!isTextBasedChannel) {
      const fallback = interaction.deferred || interaction.replied ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      await fallback({ content: "Lệnh chỉ thực thi được trong kênh tin nhắn văn bản." });
      return;
    }

    const amount = Math.max(1, Math.min(100, Number(interaction.options.getInteger("amount", true) ?? 1)));
    const targetUser = interaction.options.getUser("target");
    const sourceMessage = (interaction as any).message;

    try {
      const messages = await channel.messages.fetch({ limit: amount + (sourceMessage ? 1 : 0) });

      let toDelete = messages;
      if (sourceMessage) {
        toDelete = messages.filter((msg) => msg.id !== sourceMessage.id);
      }
      if (targetUser) {
        toDelete = toDelete.filter((msg) => msg.author.id === targetUser.id);
      }

      const safeLimit = Math.max(1, Math.min(100, amount));
      const finalDelete = toDelete.size > safeLimit ? toDelete.first(safeLimit) : toDelete;

      const deleted = finalDelete && finalDelete instanceof Map ? await channel.bulkDelete(finalDelete, true) : { size: 0 };

      if (sourceMessage && typeof sourceMessage.delete === "function") {
        await sourceMessage.delete();
      }

      const deletedCount = deleted.size + (sourceMessage ? 1 : 0);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("Dọn dẹp hoàn tất")
        .setDescription(`Đã xóa thành công **${deletedCount}** tin nhắn.`)
        .setFooter({ text: "Tin nhắn cũ hơn 14 ngày sẽ tự động bị bỏ qua do giới hạn của Discord." });

      if (targetUser) {
        embed.addFields({ name: "Bộ lọc người dùng", value: `<@${targetUser.id}>` });
      }

      const replyMethod = interaction.deferred || interaction.replied ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const sentMessage = await replyMethod({ embeds: [embed] });

      if (sentMessage && typeof (sentMessage as any).delete === "function") {
        setTimeout(() => {
          (sentMessage as any).delete().catch(() => undefined);
        }, 5000);
      }
    } catch (error) {
      logger.error("Lỗi khi thực thi lệnh /purge:", error);
      const fallback = interaction.deferred || interaction.replied ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      await fallback({ content: "Đã xảy ra lỗi trong quá trình dọn dẹp tin nhắn." });
    }
  }
};

export default command;