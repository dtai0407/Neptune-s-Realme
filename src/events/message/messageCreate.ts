import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, Message } from "discord.js";
import { ExtendedClient } from "../../@type";
import { db } from "../../database/client";
import { activeGiveaways, completedGiveaways, finishGiveaway, GiveawayState, rerollGiveaway } from "../../services/giveaway.service";
import { buildImageControls, getImageUrls, makeEmbed } from "../../commands/config/embed";
import { parseAutoresponderEmbedNames } from "../../utils/autoresponder.util";

async function safeSendMessage(message: Message, payload: any) {
  if (!("send" in message.channel)) {
    return null;
  }

  return message.channel.send(payload);
}

function resolveMentionOrId(input: string | undefined, message: Message) {
  if (!input) return null;

  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return message.mentions.users.get(mentionMatch[1])
      ?? message.guild?.members.cache.get(mentionMatch[1])?.user
      ?? message.client.users.cache.get(mentionMatch[1])
      ?? null;
  }

  return message.guild?.members.cache.get(input)?.user ?? message.client.users.cache.get(input) ?? null;
}

function parseTimeoutDuration(input: string | undefined) {
  if (!input) return 300;

  const durationMatch = input.toLowerCase().match(/^(\d+)(s|m|h|d)$/);
  if (durationMatch) {
    const value = Number(durationMatch[1]);
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60
    };

    return value * multipliers[durationMatch[2]];
  }

  const minutes = Number(input);
  return Number.isFinite(minutes) ? minutes * 60 : 300;
}

function canUseAdminCommand(message: Message) {
  return message.guild?.ownerId === message.author.id || message.member?.permissions.has("Administrator");
}

const interactionGifs: Record<"hug" | "pat" | "slap" | "kiss", string[]> = {
  hug: [
    "https://res.cloudinary.com/dgwy52a5x/image/upload/v1788761748/51718513773fe938a87375d53b211b36_ki0wtq.gif",
    "https://res.cloudinary.com/dgwy52a5x/image/upload/v1788762066/f4e65f103fe0addd71506c821a9003e4_jozshs.gif"
  ],
  pat: [
    ""
  ],
  slap: [
    ""
  ],
  kiss: [
    "https://res.cloudinary.com/dgwy52a5x/image/upload/v1788762102/69047c455a0f85a7eba0033a46fcf283_r9ww4q.gif"
  ]
};

async function sendInteraction(message: Message, action: "hug" | "pat" | "slap" | "kiss", description: string, color: number) {
  const gifs = interactionGifs[action];
  const gifUrl = gifs[Math.floor(Math.random() * gifs.length)];
  const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(description)
    .setImage(gifUrl)
    .setTimestamp();

  await safeSendMessage(message, { embeds: [embed] });
}

function buildMessageInteraction(message: Message, client: ExtendedClient, commandName: string, args: string[]) {
  const guild = message.guild;
  const member = message.member;

  const warnSubcommand = commandName === "warn" ? args[0]?.toLowerCase() : "";
  const targetArg = commandName === "warn" && warnSubcommand !== "remove" ? args[1] : args[0];
  const targetUser = resolveMentionOrId(targetArg, message);
  const reasonStartIndex = commandName === "warn" || commandName === "timeout" ? 2 : 1;
  const reason = args.slice(reasonStartIndex).join(" ") || "Không cung cấp lý do";

  const commandFlags = {
    ban: { reason, delete_days: 0 },
    kick: { reason },
    timeout: { reason, duration: 60 },
    purge: { amount: Number(args[0] ?? 10), target: resolveMentionOrId(args[1], message) },
    warn: { subcommand: "add", reason, targetUser }
  };

  const options: any = {
    getUser: (name: string, _required?: boolean) => {
      if (name === "target") return targetUser ?? null;
      if (name === "user") return targetUser ?? null;
      return null;
    },
    getString: (name: string, _required?: boolean) => {
      if (name === "reason") return reason;
      if (name === "id") return commandName === "warn" ? args[1] ?? null : args[0] ?? null;
      return null;
    },
    getInteger: (name: string, _required?: boolean) => {
      if (name === "delete_days") {
        const value = Number(args[args.length - 1] || 0);
        return Number.isFinite(value) ? value : 0;
      }
      if (name === "amount") {
        return Number(args[0] ?? 10);
      }
      if (name === "duration") {
        return commandName === "timeout" ? parseTimeoutDuration(args[1]) : 60;
      }
      return null;
    },
    getSubcommand: () => {
      if (commandName === "warn") {
        if (warnSubcommand === "list") return "list";
        if (warnSubcommand === "remove") return "remove";
        return "add";
      }
      return "";
    }
  };

  return {
    message,
    guild,
    guildId: guild?.id ?? null,
    member,
    channel: message.channel,
    user: message.author,
    options,
    deferReply: async () => undefined,
    editReply: async (payload: any) => {
      const replyPayload = payload && typeof payload === "object" && ("content" in payload || "embeds" in payload || "components" in payload || "files" in payload)
        ? payload
        : { content: typeof payload === "string" ? payload : "Đã xử lý." };

      return safeSendMessage(message, replyPayload);
    },
    reply: async (payload: any) => {
      const replyPayload = payload && typeof payload === "object" && ("content" in payload || "embeds" in payload || "components" in payload || "files" in payload)
        ? payload
        : { content: typeof payload === "string" ? payload : "Đã xử lý." };

      return safeSendMessage(message, replyPayload);
    }
  };
}

export default {
  name: Events.MessageCreate,
  async execute(message: Message, client: ExtendedClient) {
    if (message.author.bot) return;

    const prefix = client.prefix ?? "np";
    const content = message.content.trim();

    if (message.guild && !content.toLowerCase().startsWith(prefix.toLowerCase())) {
      const trigger = content.toLowerCase();
      if (trigger) {
        const responders = await db.autoResponder.findMany({ where: { guildId: message.guild.id } }).catch(() => []);
        const responder = responders.find((item) =>
          item.matchMode === "includes" ? trigger.includes(item.trigger) :
            item.matchMode === "startswith" ? trigger.startsWith(item.trigger) :
              item.matchMode === "endswith" ? trigger.endsWith(item.trigger) : trigger === item.trigger
        );
        if (responder) {
          const embedNames = parseAutoresponderEmbedNames((responder as { embedName?: string | null }).embedName);
          const embeds = embedNames.length
            ? await db.embedPreset.findMany({ where: { guildId: message.guild.id, name: { in: embedNames } } }).catch(() => [])
            : [];
          const orderedEmbeds = embedNames
            .map((name) => embeds.find((embed) => embed.name === name))
            .filter((embed): embed is (typeof embeds)[number] => Boolean(embed));
          if (orderedEmbeds.length) {
            const firstEmbed = orderedEmbeds[0];
            await safeSendMessage(message, {
              content: responder.response || undefined,
              embeds: orderedEmbeds.slice(0, 10).map((embed) => {
                const imageUrls = getImageUrls(embed);
                return makeEmbed(embed.title, embed.description, embed.color, embed.thumbnailUrl, imageUrls[0] ?? null);
              }),
              components: orderedEmbeds.length === 1 ? buildImageControls(firstEmbed.id, getImageUrls(firstEmbed)) : []
            });
          } else {
            await safeSendMessage(message, responder.response);
          }
          return;
        }
      }
    }

    if (!content.toLowerCase().startsWith(prefix.toLowerCase())) return;

    const args = content.slice(prefix.length).trim().split(/\s+/);
    const rawCommandName = args.shift()?.toLowerCase();
    if (!rawCommandName) return;

    const aliasMap: Record<string, string> = {
      help: "help",
      ping: "ping",
      status: "status",
      av: "avatar",
      avatar: "avatar",
      ga: "giveaway",
      giveaway: "giveaway",
      ban: "ban",
      b: "ban",
      kick: "kick",
      k: "kick",
      purge: "purge",
      p: "purge",
      timeout: "timeout",
      t: "timeout",
      warn: "warn",
      w: "warn",
      hug: "hug",
      pat: "pat",
      slap: "slap",
      kiss: "kiss",
    };

    const commandName = aliasMap[rawCommandName] ?? rawCommandName;

    const builtInHandlers: Record<string, (msg: Message, args: string[], bot: ExtendedClient) => Promise<void>> = {
      help: async (msg, _args, bot) => {
        const commandDescriptions: Record<string, string> = {
          ban: "Cấm thành viên khỏi máy chủ",
          kick: "Đuổi thành viên khỏi máy chủ",
          purge: "Xóa nhiều tin nhắn trong kênh",
          timeout: "Tạm thời hạn chế thành viên",
          warn: "Quản lý cảnh cáo thành viên",
          autorole: "Tự động cấp role cho thành viên mới",
          setlog: "Thiết lập kênh nhật ký máy chủ",
          giveaway: "Tạo giveaway, chọn người thắng tự động hoặc reroll lại kết quả",
          hug: "Ôm một thành viên",
          pat: "Xoa đầu một thành viên",
          slap: "Tát nhẹ một thành viên",
          kiss: "Gửi một nụ hôn thân thiện"
        };

        const availableCommands = new Set(bot.commands.keys());
        const commandLine = (name: string, usage: string, aliases?: string) => {
          if (!availableCommands.has(name)) return null;
          return `\`${bot.prefix}${usage}\` - ${commandDescriptions[name]}${aliases ? `\n  Bí danh: \`${aliases}\`` : ""}`;
        };

        const moderationCommands = [
          commandLine("ban", "ban <@user> [lý do]", "npb"),
          commandLine("kick", "kick <@user> [lý do]", "npk"),
          commandLine("purge", "purge <số lượng> [@user]", "npp"),
          commandLine("timeout", "timeout <@user> <thời lượng> [lý do]", "npt"),
          commandLine("warn", "warn <add/list/remove> ...", "npw"),
          commandLine("giveaway", "giveaway <thời gian> <số người thắng> <phần thưởng> | giveaway reroll <messageId> [số người thắng]", "npg")
        ].filter(Boolean).join("\n");

        const funCommands = [
          commandLine("hug", "hug <@user>"),
          commandLine("pat", "pat <@user>"),
          commandLine("slap", "slap <@user>"),
          commandLine("kiss", "kiss <@user>")
        ].filter(Boolean).join("\n");

        const configurationCommands = [
          commandLine("autorole", "autorole <set/disable> ..."),
          commandLine("setlog", "setlog <channel/disable> ..."),
        ].filter(Boolean).join("\n");

        const helpEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Neptune Bot | Trung tâm trợ giúp")
          .setDescription(
            `Xin chào **${msg.author.displayName}**. Dưới đây là danh sách lệnh bạn có thể sử dụng.\n\n` +
            `Mọi lệnh đều bắt đầu bằng prefix **${bot.prefix}**.`
          )
          .addFields(
            {
              name: "Tiện ích",
              value: [
                `\`${bot.prefix}help\` - Hiển thị bảng trợ giúp này`,
                `\`${bot.prefix}ping\` - Kiểm tra độ trễ của bot`,
                `\`${bot.prefix}status\` - Xem trạng thái hoạt động`,
                `\`${bot.prefix}av [@user]\` - Xem avatar và banner`,
                `\`${bot.prefix}ga 10m 1 Nitro\` - Tạo giveaway`
              ].join("\n")
            },
            {
              name: "Kiểm duyệt",
              value: moderationCommands || "Chưa có lệnh khả dụng"
            },
            {
              name: "Cấu hình máy chủ",
              value: configurationCommands || "Chưa có lệnh khả dụng"
            },
            {
              name: "Tương tác",
              value: funCommands || "Chưa có lệnh khả dụng"
            },
            {
              name: "Cú pháp nhanh",
              value: [
                `Dùng \`${bot.prefix}purge 5\` để xóa 5 tin nhắn gần nhất`,
                `Dùng \`${bot.prefix}timeout @user 1h\` để timeout 1 giờ`,
                `Thời lượng timeout: số giây/phút hoặc hậu tố \`s\`, \`m\`, \`h\`, \`d\``,
                `Dùng \`${bot.prefix}help\` bất cứ lúc nào để mở lại bảng này`
              ].join("\n")
            }
          )
          .setFooter({ text: `Neptune Bot • ${bot.commands.size + 3} lệnh • Prefix: ${bot.prefix}` })
          .setTimestamp();

        await safeSendMessage(msg, { embeds: [helpEmbed] });
      },
      ping: async (msg) => {
        await safeSendMessage(msg, `Pong! Latency: ${Date.now() - msg.createdTimestamp}ms`);
      },
      status: async (msg, _args, bot) => {
        if (!canUseAdminCommand(msg)) {
          await safeSendMessage(msg, "Chỉ admin hoặc owner của server mới dùng được lệnh này.");
          return;
        }
        const commandsCount = bot.commands.size;
        await safeSendMessage(msg, `Bot đang online. Prefix: \`${bot.prefix}\`. Tổng lệnh hiện có: **${commandsCount}**.`);
      },
      avatar: async (msg, args) => {
        const targetUser = args[0] ? resolveMentionOrId(args[0], msg) : msg.author;

        if (!targetUser) {
          await safeSendMessage(msg, "Không tìm thấy người dùng. Hãy dùng `npav @user` hoặc `npav <user_id>`." );
          return;
        }

        const avatarUrl = targetUser.displayAvatarURL({ size: 1024, extension: "png" });
        const avatarEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${targetUser.displayName} • Avatar`)
          .setImage(avatarUrl)
          .setFooter({ text: `Yêu cầu bởi ${msg.author.displayName}` })
          .setTimestamp();

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`avatar_user:${targetUser.id}`)
            .setLabel("User")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`avatar_server:${targetUser.id}`)
            .setLabel("Server")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!msg.guild),
          new ButtonBuilder()
            .setCustomId(`avatar_banner:${targetUser.id}`)
            .setLabel("Banner")
            .setStyle(ButtonStyle.Secondary)
        );

        await safeSendMessage(msg, { embeds: [avatarEmbed], components: [actionRow] });
      },
      giveaway: async (msg, args) => {
        if (!msg.guild) {
          await safeSendMessage(msg, "Lệnh giveaway chỉ dùng được trong server.");
          return;
        }
        if (!canUseAdminCommand(msg)) {
          await safeSendMessage(msg, "Chỉ admin hoặc owner của server mới dùng được lệnh này.");
          return;
        }

        const firstArg = args[0]?.toLowerCase();
        if (firstArg === "reroll") {
          const messageId = args[1]?.trim();
          const customWinnerCount = Number(args[2] ?? 0);

          if (!messageId) {
            await safeSendMessage(msg, `Sai cú pháp. Ví dụ: \`${client.prefix}ga reroll <messageId> [số người thắng]\`.`);
            return;
          }

          const historicalGiveaway = completedGiveaways.get(messageId)
            ?? activeGiveaways.get(messageId);

          if (!historicalGiveaway) {
            await safeSendMessage(msg, "Không tìm thấy giveaway tương ứng với messageId đó. Hãy đảm bảo đây là message giveaway đã kết thúc hoặc đang active.");
            return;
          }

          if (!Number.isInteger(customWinnerCount) || customWinnerCount < 1 || customWinnerCount > 20) {
            const result = await rerollGiveaway(client, historicalGiveaway, historicalGiveaway.winnerCount);
            await safeSendMessage(msg, result ? `Đã reroll giveaway **${historicalGiveaway.prize}** bằng số người thắng mặc định (${historicalGiveaway.winnerCount}).` : "Không thể reroll giveaway lúc này.");
            return;
          }

          const result = await rerollGiveaway(client, historicalGiveaway, customWinnerCount);
          await safeSendMessage(msg, result ? `Đã reroll giveaway **${historicalGiveaway.prize}** với ${customWinnerCount} người thắng mới.` : "Không thể reroll giveaway lúc này.");
          return;
        }

        const durationSeconds = parseTimeoutDuration(args[0]);
        const winnerCount = Number(args[1]);
        const prize = args.slice(2).join(" ").trim();

        if (!args[0] || !/^\d+(s|m|h|d)$/i.test(args[0]) || durationSeconds <= 0) {
          await safeSendMessage(msg, `Sai thời gian. Ví dụ: \`${client.prefix}ga 10m 1 Nitro\`.`);
          return;
        }
        if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) {
          await safeSendMessage(msg, `Số người thắng phải từ 1 đến 20. Ví dụ: \`${client.prefix}ga 10m 1 Nitro\`.`);
          return;
        }
        if (!prize || prize.length > 256) {
          await safeSendMessage(msg, `Vui lòng nhập phần thưởng, ví dụ: \`${client.prefix}ga 10m 1 Nitro\`.`);
          return;
        }

        const endsAt = Date.now() + durationSeconds * 1000;
        const giveawayEmbed = new EmbedBuilder()
          .setColor(0x00FFF0)
          .setAuthor({
            name: `${msg.guild.name} • Giveaway`,
            iconURL: msg.guild.iconURL({ extension: "png" }) ?? undefined
          })
          .setTitle("<a:bluewing1:1539229950417043546> GIVEAWAY BẮT ĐẦU <a:bluewing2:1539229993937141770>")
          .setDescription(
            `## ${prize}\n\n` +
            `<a:ngoisao1:1539230685238136902> **Nhấn vào <a:buntim:1539230634738978856> để tham gia**\n` +
            `<a:heart2:1539230300096167936> **Đếm ngược:** <t:${Math.floor(endsAt / 1000)}:R>\n` +
            `<a:muiten2:1539231710812704778> **Tổ chức bởi:** <@${msg.author.id}>`
          )
          .setThumbnail(msg.author.displayAvatarURL({ size: 256, extension: "png" }))
          .setFooter({ text: `Giveaway với ${winnerCount} giải • Hôm nay lúc ${new Date(endsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` })
          .setTimestamp(endsAt);
        const giveawayMessage = await safeSendMessage(msg, { embeds: [giveawayEmbed] });
        if (!giveawayMessage) return;

        const giveaway: GiveawayState = {
          messageId: giveawayMessage.id,
          channelId: msg.channel.id,
          hostId: msg.author.id,
          prize,
          winnerCount,
          endsAt,
          participants: new Set([msg.author.id])
        };
        activeGiveaways.set(giveaway.messageId, giveaway);
        await giveawayMessage.react("<a:buntim:1539230634738978856>");
        await msg.delete().catch(() => undefined);

        setTimeout(() => {
          finishGiveaway(client, giveaway).catch((error) => console.error("Lỗi kết thúc giveaway:", error));
        }, durationSeconds * 1000);
      },
      hug: async (msg, args) => {
        const target = resolveMentionOrId(args[0], msg);
        if (!target) {
          await safeSendMessage(msg, `Vui lòng tag thành viên. Ví dụ: \`${client.prefix}hug @user\`.`);
          return;
        }
        await sendInteraction(msg, "hug", `🤗 <@${msg.author.id}> đã ôm <@${target.id}>!`, 0x001857);
      },
      pat: async (msg, args) => {
        const target = resolveMentionOrId(args[0], msg);
        if (!target) {
          await safeSendMessage(msg, `Vui lòng tag thành viên. Ví dụ: \`${client.prefix}pat @user\`.`);
          return;
        }
        await sendInteraction(msg, "pat", `😊 <@${msg.author.id}> đã xoa đầu <@${target.id}>!`, 0x001857);
      },
      slap: async (msg, args) => {
        const target = resolveMentionOrId(args[0], msg);
        if (!target) {
          await safeSendMessage(msg, `Vui lòng tag thành viên. Ví dụ: \`${client.prefix}slap @user\`.`);
          return;
        }
        await sendInteraction(msg, "slap", `🖐️ <@${msg.author.id}> đã tát nhẹ <@${target.id}>!`, 0x001857);
      },
      kiss: async (msg, args) => {
        const target = resolveMentionOrId(args[0], msg);
        if (!target) {
          await safeSendMessage(msg, `Vui lòng tag thành viên. Ví dụ: \`${client.prefix}kiss @user\`.`);
          return;
        }
        await sendInteraction(msg, "kiss", `😘 <@${msg.author.id}> đã gửi một nụ hôn thân thiện đến <@${target.id}>!`, 0x001857);
      }
    };

    if (builtInHandlers[commandName]) {
      try {
        await builtInHandlers[commandName](message, args, client);
      } catch (error) {
        await safeSendMessage(message, "Đã xảy ra lỗi khi xử lý lệnh prefix.");
        console.error(error);
      }
      return;
    }

    const command = client.commands.get(commandName);
    if (!command) {
      await safeSendMessage(message, `Lệnh \`${prefix}${commandName}\` không tồn tại. Dùng \`${prefix}help\` để xem danh sách.`);
      return;
    }

    try {
      const interaction = buildMessageInteraction(message, client, commandName, args);
      await command.execute(interaction as any, client);
    } catch (error) {
      await safeSendMessage(message, "Đã xảy ra lỗi khi xử lý lệnh prefix.");
      console.error(error);
    }
  }
};