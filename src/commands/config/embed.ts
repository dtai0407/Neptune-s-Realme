import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { Command, ExtendedClient } from "../../@type";
import { db } from "../../database/client";

const colorPattern = /^#[0-9a-f]{6}$/i;

function addContentOptions(subcommand: any, required: boolean) {
  return subcommand
    .addStringOption((option: any) => option.setName("title").setDescription("Tiêu đề embed").setMaxLength(256).setRequired(required))
    .addStringOption((option: any) => option.setName("description").setDescription("Nội dung embed").setMaxLength(4096).setRequired(required))
    .addStringOption((option: any) => option.setName("color").setDescription("Màu hex, ví dụ #5865F2").setMaxLength(7))
    .addStringOption((option: any) => option.setName("thumbnail").setDescription("URL ảnh thumbnail").setMaxLength(2048))
    .addStringOption((option: any) => option.setName("image").setDescription("URL ảnh lớn").setMaxLength(2048))
    .addStringOption((option: any) => option.setName("images").setDescription("Nhiều URL ảnh, mỗi URL một dòng").setMaxLength(6000))
    .addBooleanOption((option: any) => option.setName("shared").setDescription("Cho phép liệt kê trong embed shared"));
}

export function getImageUrls(preset: { imageUrl: string | null; imageUrls?: string }) {
  let imageUrls: string[] = [];
  try {
    imageUrls = JSON.parse(preset.imageUrls || "[]");
  } catch {
    imageUrls = [];
  }

  const urls = imageUrls.filter((url): url is string => typeof url === "string" && url.length > 0);
  if (preset.imageUrl && !urls.includes(preset.imageUrl)) urls.unshift(preset.imageUrl);
  return urls;
}

export function parseImageUrls(value: string) {
  return value.split(/[\n,]/).map((url) => url.trim()).filter(Boolean);
}

export function makeEmbed(title: string, description: string, color: string, thumbnail?: string | null, image?: string | null) {
  const embed = new EmbedBuilder().setColor(parseInt(color.slice(1), 16)).setDescription(description);
  if (title) embed.setTitle(title);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  return embed;
}

export function buildImageControls(presetId: string, imageUrls: string[], imageIndex = 0) {
  if (imageUrls.length < 2) return [];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`embed_image_prev:${presetId}:${imageIndex}`).setLabel("‹").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embed_image_count:${presetId}:${imageIndex}`).setLabel(`${imageIndex + 1} / ${imageUrls.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`embed_image_next:${presetId}:${imageIndex}`).setLabel("›").setStyle(ButtonStyle.Secondary)
  )];
}

export function buildEmbedPanel(preset: { id: string; name: string; title: string; description: string; color: string; thumbnailUrl: string | null; imageUrl: string | null; imageUrls?: string; shared: boolean }) {
  const imageUrls = getImageUrls(preset);
  const preview = makeEmbed(preset.title, preset.description, preset.color, preset.thumbnailUrl, imageUrls[0] ?? null)
    .setFooter({ text: `Embed: ${preset.name} • ${preset.shared ? "Shared" : "Private"}` });
  const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`embed_send:${preset.id}`).setLabel("📨 Đầu Embed").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`embed_content:${preset.id}`).setLabel("📝 Tiêu đề & Nội dung").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`embed_remove:${preset.id}`).setLabel("🗑️ Chặn Embed").setStyle(ButtonStyle.Danger)
  );
  const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`embed_color:${preset.id}`).setLabel("🎨 Màu").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embed_thumbnail:${preset.id}`).setLabel("🖼️ Ảnh thu nhỏ").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embed_image:${preset.id}`).setLabel("🌄 Ảnh lớn").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embed_share:${preset.id}`).setLabel("🔗 Share").setStyle(preset.shared ? ButtonStyle.Success : ButtonStyle.Secondary)
  );
  return { embeds: [preview], components: [...buildImageControls(preset.id, imageUrls), firstRow, secondRow] };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Tạo và quản lý embed đã lưu")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addSubcommand((subcommand: any) => subcommand.setName("create").setDescription("Tạo một embed mới").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true)))
    .addSubcommand((subcommand: any) => addContentOptions(subcommand.setName("edit").setDescription("Chỉnh sửa một embed đã lưu").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true).setAutocomplete(true)), false))
    .addSubcommand((subcommand: any) => subcommand.setName("delete").setDescription("Xóa một embed đã lưu").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true).setAutocomplete(true)))
    .addSubcommand((subcommand: any) => subcommand.setName("show").setDescription("Gửi một embed đã lưu").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true).setAutocomplete(true)).addChannelOption((option: any) => option.setName("channel").setDescription("Kênh gửi embed").addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((subcommand: any) => subcommand.setName("shared").setDescription("Xem các embed được chia sẻ"))
    .addSubcommand((subcommand: any) => subcommand.setName("import").setDescription("Nhập dữ liệu JSON vào embed").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true).setAutocomplete(true)).addStringOption((option: any) => option.setName("data").setDescription("JSON gồm title, description, color, image, images, thumbnail").setMaxLength(6000).setRequired(true))),
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction, _client: ExtendedClient) => {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const name = interaction.options.getString("name")?.trim().toLowerCase();

    try {
      if (subcommand === "delete") {
        const result = await db.embedPreset.deleteMany({ where: { guildId, name } });
        await interaction.reply({ content: result.count ? `Đã xóa embed **${name}**.` : `Không tìm thấy embed **${name}**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (subcommand === "shared") {
        const presets = await db.embedPreset.findMany({ where: { guildId, shared: true }, orderBy: { name: "asc" } });
        await interaction.reply({ content: presets.length ? presets.map((preset) => `**${preset.name}** - ${preset.title}`).join("\n") : "Chưa có embed nào được chia sẻ.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (subcommand === "import") {
        const data = JSON.parse(interaction.options.getString("data", true));
        const title = String(data.title ?? "").trim();
        const description = String(data.description ?? "").trim();
        const color = String(data.color ?? "#5865F2");
        if (!name || !description || !colorPattern.test(color)) throw new Error("Dữ liệu JSON không hợp lệ");
        const imageUrls = Array.isArray(data.images) ? data.images.filter((url: unknown): url is string => typeof url === "string") : [];
        await db.embedPreset.upsert({ where: { guildId_name: { guildId, name } }, update: { title, description, color, thumbnailUrl: data.thumbnail ?? null, imageUrl: data.image ?? imageUrls[0] ?? null, imageUrls: JSON.stringify(imageUrls) }, create: { guildId, name, title, description, color, thumbnailUrl: data.thumbnail ?? null, imageUrl: data.image ?? imageUrls[0] ?? null, imageUrls: JSON.stringify(imageUrls), ownerId: interaction.user.id } });
        await interaction.reply({ content: `Đã import embed **${name}**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (subcommand === "create" || subcommand === "edit") {
        if (subcommand === "create") {
          await interaction.deferReply();
        }
        const current = subcommand === "edit" && name ? await db.embedPreset.findUnique({ where: { guildId_name: { guildId, name } } }) : null;
        if (!name || (subcommand === "edit" && !current)) throw new Error("Không tìm thấy embed");
        const title = interaction.options.getString("title") ?? current?.title ?? "";
        const description = interaction.options.getString("description") ?? current?.description ?? "Chưa có nội dung";
        const color = interaction.options.getString("color") ?? current?.color ?? "#5865F2";
        const thumbnail = interaction.options.getString("thumbnail") ?? current?.thumbnailUrl ?? null;
        const image = interaction.options.getString("image") ?? current?.imageUrl ?? null;
        const imagesInput = interaction.options.getString("images");
        const shared = interaction.options.getBoolean("shared") ?? current?.shared ?? false;
        if (!description || !colorPattern.test(color)) throw new Error("Thiếu dữ liệu hoặc màu không hợp lệ");
        const imageUrls = imagesInput !== null ? parseImageUrls(imagesInput) : current ? getImageUrls(current) : image ? [image] : [];
        const primaryImage = imageUrls[0] ?? null;
        await db.embedPreset.upsert({ where: { guildId_name: { guildId, name } }, update: { title, description, color, thumbnailUrl: thumbnail, imageUrl: primaryImage, imageUrls: JSON.stringify(imageUrls), shared }, create: { guildId, name, title, description, color, thumbnailUrl: thumbnail, imageUrl: primaryImage, imageUrls: JSON.stringify(imageUrls), shared, ownerId: interaction.user.id } });
        const saved = await db.embedPreset.findUnique({ where: { guildId_name: { guildId, name } } });
        if (!saved) throw new Error("Không thể đọc embed vừa lưu");
        await (subcommand === "create"
          ? interaction.editReply(buildEmbedPanel(saved))
          : interaction.reply({ content: `Đã cập nhật embed **${name}**.`, flags: MessageFlags.Ephemeral }));
        return;
      }

      const preset = name ? await db.embedPreset.findUnique({ where: { guildId_name: { guildId, name } } }) : null;
      const channel = interaction.options.getChannel("channel") as TextChannel | null;
      const target = channel ?? interaction.channel;
      if (!preset || !target || !target.isTextBased() || !("send" in target)) throw new Error("Không tìm thấy embed hoặc kênh không hợp lệ");
      const imageUrls = getImageUrls(preset);
      await target.send({ embeds: [makeEmbed(preset.title, preset.description, preset.color, preset.thumbnailUrl, imageUrls[0] ?? null)], components: buildImageControls(preset.id, imageUrls) });
      await interaction.reply({ content: `Đã gửi embed **${name}** tại <#${target.id}>.`, flags: MessageFlags.Ephemeral });
    } catch {
      const reply = interaction.replied || interaction.deferred ? interaction.editReply("Dữ liệu embed không hợp lệ hoặc thao tác thất bại.") : interaction.reply({ content: "Dữ liệu embed không hợp lệ hoặc thao tác thất bại.", flags: MessageFlags.Ephemeral });
      await reply;
    }
  }
};

export default command;
