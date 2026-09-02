import { GuildMember } from "discord.js";

export interface HierarchyCheckResult {
  canExecute: boolean;
  reason?: string;
}

export function validateHierarchy(
  moderator: GuildMember,
  target: GuildMember,
  bot: GuildMember
): HierarchyCheckResult {
  if (target.id === moderator.id) {
    return { canExecute: false, reason: "Bạn không thể thực hiện thao tác này lên chính mình." };
  }

  if (target.id === moderator.guild.ownerId) {
    return { canExecute: false, reason: "Không thể thao tác lên Chủ sở hữu server (Server Owner)." };
  }

  // Kiểm tra quyền của người gọi lệnh so với mục tiêu
  if (
    moderator.id !== moderator.guild.ownerId &&
    moderator.roles.highest.position <= target.roles.highest.position
  ) {
    return { canExecute: false, reason: "Role của bạn phải cao hơn role của đối tượng mục tiêu." };
  }

  // Kiểm tra quyền của Bot so với mục tiêu
  if (bot.roles.highest.position <= target.roles.highest.position) {
    return { canExecute: false, reason: "Role của Bot phải cao hơn role của đối tượng mục tiêu mới có thể xử lý." };
  }

  return { canExecute: true };
}

export default validateHierarchy;