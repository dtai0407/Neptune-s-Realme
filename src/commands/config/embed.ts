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
    .addBooleanOption((option: any) => option.setName("shared").setDescription("Cho phép liệt kê trong embed shared"));
}

export function makeEmbed(title: string, description: string, color: string, thumbnail?: string | null, image?: string | null) {
  const embed = new EmbedBuilder().setColor(parseInt(color.slice(1), 16)).setTitle(title).setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  return embed;
}

export function buildEmbedPanel(preset: { id: string; name: string; title: string; description: string; color: string; thumbnailUrl: string | null; imageUrl: string | null; shared: boolean }) {
  const preview = makeEmbed(preset.title, preset.description, preset.color, preset.thumbnailUrl, preset.imageUrl)
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
  return { embeds: [preview], components: [firstRow, secondRow] };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Tạo và quản lý embed đã lưu")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addSubcommand((subcommand: any) => subcommand.setName("create").setDescription("Tạo một embed mới").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true)))
    .addSubcommand((subcommand: any) => addContentOptions(subcommand.setName("edit").setDescription("Chỉnh sửa một embed đã lưu").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true)), false))
    .addSubcommand((subcommand: any) => subcommand.setName("delete").setDescription("Xóa một embed đã lưu").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true)))
    .addSubcommand((subcommand: any) => subcommand.setName("show").setDescription("Gửi một embed đã lưu").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true)).addChannelOption((option: any) => option.setName("channel").setDescription("Kênh gửi embed").addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((subcommand: any) => subcommand.setName("shared").setDescription("Xem các embed được chia sẻ"))
    .addSubcommand((subcommand: any) => subcommand.setName("import").setDescription("Nhập dữ liệu JSON vào embed").addStringOption((option: any) => option.setName("name").setDescription("Tên embed").setMaxLength(100).setRequired(true)).addStringOption((option: any) => option.setName("data").setDescription("JSON gồm title, description, color, image, thumbnail").setMaxLength(6000).setRequired(true))),
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
        if (!name || !title || !description || !colorPattern.test(color)) throw new Error("Dữ liệu JSON không hợp lệ");
        await db.embedPreset.upsert({ where: { guildId_name: { guildId, name } }, update: { title, description, color, thumbnailUrl: data.thumbnail ?? null, imageUrl: data.image ?? null }, create: { guildId, name, title, description, color, thumbnailUrl: data.thumbnail ?? null, imageUrl: data.image ?? null, ownerId: interaction.user.id } });
        await interaction.reply({ content: `Đã import embed **${name}**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (subcommand === "create" || subcommand === "edit") {
        if (subcommand === "create") {
          await interaction.deferReply();
        }
        const current = subcommand === "edit" && name ? await db.embedPreset.findUnique({ where: { guildId_name: { guildId, name } } }) : null;
        if (!name || (subcommand === "edit" && !current)) throw new Error("Không tìm thấy embed");
        const title = interaction.options.getString("title") ?? current?.title ?? "Embed mới";
        const description = interaction.options.getString("description") ?? current?.description ?? "Chưa có nội dung";
        const color = interaction.options.getString("color") ?? current?.color ?? "#5865F2";
        const thumbnail = interaction.options.getString("thumbnail") ?? current?.thumbnailUrl ?? null;
        const image = interaction.options.getString("image") ?? current?.imageUrl ?? null;
        const shared = interaction.options.getBoolean("shared") ?? current?.shared ?? false;
        if (!title || !description || !colorPattern.test(color)) throw new Error("Thiếu dữ liệu hoặc màu không hợp lệ");
        await db.embedPreset.upsert({ where: { guildId_name: { guildId, name } }, update: { title, description, color, thumbnailUrl: thumbnail, imageUrl: image, shared }, create: { guildId, name, title, description, color, thumbnailUrl: thumbnail, imageUrl: image, shared, ownerId: interaction.user.id } });
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
      await target.send({ embeds: [makeEmbed(preset.title, preset.description, preset.color, preset.thumbnailUrl, preset.imageUrl)] });
      await interaction.reply({ content: `Đã gửi embed **${name}** tại <#${target.id}>.`, flags: MessageFlags.Ephemeral });
    } catch {
      const reply = interaction.replied || interaction.deferred ? interaction.editReply("Dữ liệu embed không hợp lệ hoặc thao tác thất bại.") : interaction.reply({ content: "Dữ liệu embed không hợp lệ hoặc thao tác thất bại.", flags: MessageFlags.Ephemeral });
      await reply;
    }
  }
};

export default command;
