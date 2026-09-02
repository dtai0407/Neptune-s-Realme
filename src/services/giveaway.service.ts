import { Client, EmbedBuilder } from "discord.js";
import { logger } from "../utils/logger.util";

export interface GiveawayState {
  messageId: string;
  channelId: string;
  hostId: string;
  prize: string;
  winnerCount: number;
  endsAt: number;
  participants: Set<string>;
}

export const GIVEAWAY_EMOJI_ID = "1539230634738978856";
export const activeGiveaways = new Map<string, GiveawayState>();

export async function finishGiveaway(client: Client, giveaway: GiveawayState) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel || !("messages" in channel) || !("send" in channel)) return;

  const giveawayMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!giveawayMessage) return;

  const giveawayReaction = giveawayMessage.reactions.cache.get(GIVEAWAY_EMOJI_ID)
    ?? giveawayMessage.reactions.cache.find((reaction) => reaction.emoji.name === "<a:buntim:1539230634738978856>");
  if (giveawayReaction) {
    const reactionUsers = await giveawayReaction.users.fetch().catch(() => null);
    reactionUsers?.forEach((user) => {
      if (!user.bot) giveaway.participants.add(user.id);
    });
  }
  giveaway.participants.add(giveaway.hostId);
  activeGiveaways.delete(giveaway.messageId);

  const participants = [...giveaway.participants];
  const winners = participants
    .sort(() => Math.random() - 0.5)
    .slice(0, giveaway.winnerCount);
  const winnerText = winners.length > 0
    ? winners.map((userId) => `<@${userId}>`).join(", ")
    : "Không có người tham gia";

  const endedEmbed = EmbedBuilder.from(giveawayMessage.embeds[0])
    .setColor(0x95a5a6)
    .setTitle("<a:bluewing1:1539229950417043546> GIVEAWAY ĐÃ KẾT THÚC <a:bluewing2:1539229993937141770>")
    .setDescription(
      `## ${giveaway.prize}\n\n` +
      (winners.length > 0
        ? `<a:HelloKittyDance:1536911012962373753> **Người thắng:** ${winnerText}\n`
        : `<a:HelloKittyDance:1536911012962373753> **Người thắng:** Không có người tham gia\n`) +
      `<a:ngoisao1:1539230685238136902> **Tổ chức bởi:** <@${giveaway.hostId}>\n` +
      `<a:muiten:1539230151852691547> **Số người tham gia:** ${participants.length}`
    )
    .setFooter({ text: `Giveaway với ${giveaway.winnerCount} giải • Đã kết thúc` })
    .setTimestamp();

  await giveawayMessage.edit({ embeds: [endedEmbed] }).catch(() => undefined);
  const resultContent = winners.length > 0
    ? `<a:buntim:1539230634738978856> **Xin chúc mừng ${winnerText}!** Bạn đã trúng giveaway **${giveaway.prize}** của <@${giveaway.hostId}>.`
    : `<:npt_bun:1539321159848304740> Giveaway **${giveaway.prize}** của <@${giveaway.hostId}> đã kết thúc nhưng không có người tham gia.`;

  await channel.send({
    content: resultContent,
    allowedMentions: {
      users: [...new Set([giveaway.hostId, ...winners])]
    }
  }).catch((error) => {
    logger.error("Không thể gửi thông báo kết quả giveaway:", error);
    channel.send(resultContent).catch((fallbackError) => {
      logger.error("Không thể gửi thông báo giveaway bằng phương án dự phòng:", fallbackError);
    });
  });
}
