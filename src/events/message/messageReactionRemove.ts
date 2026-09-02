import { Events, MessageReaction, User } from "discord.js";
import { ExtendedClient } from "../../@type";
import { activeGiveaways, GIVEAWAY_EMOJI_ID } from "../../services/giveaway.service";

export default {
  name: Events.MessageReactionRemove,
  async execute(reaction: MessageReaction, user: User, _client: ExtendedClient) {
    if (user.bot || (reaction.emoji.id !== GIVEAWAY_EMOJI_ID && reaction.emoji.name !== "🎉")) return;
    if (reaction.partial) await reaction.fetch().catch(() => null);

    const giveaway = activeGiveaways.get(reaction.message.id);
    if (!giveaway) return;
    giveaway.participants.delete(user.id);
  }
};