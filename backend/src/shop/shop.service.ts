import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CosmeticType } from '@prisma/client';

/* ── Shop catalog ── */
export interface ShopItem {
  id: string;
  type: CosmeticType;
  value: string;
  label: string;
  description: string;
  xpCost: number;
  permanent: boolean; // false = 30 days
}

const SHOP_CATALOG: ShopItem[] = [
  // Chat colors
  { id: 'color-pink', type: 'CHAT_COLOR', value: '#ff00aa', label: 'Neon Różowy', description: 'Twój nick w czacie świeci na różowo', xpCost: 200, permanent: false },
  { id: 'color-cyan', type: 'CHAT_COLOR', value: '#00f5ff', label: 'Neon Cyan', description: 'Twój nick w czacie świeci na cyjanowo', xpCost: 200, permanent: false },
  { id: 'color-gold', type: 'CHAT_COLOR', value: '#ffd700', label: 'Złoty', description: 'Złoty nick w czacie', xpCost: 500, permanent: false },
  { id: 'color-rainbow', type: 'CHAT_COLOR', value: 'rainbow', label: 'Tęczowy', description: 'Animowany tęczowy nick', xpCost: 1000, permanent: false },

  // Chat borders / effects
  { id: 'border-fire', type: 'CHAT_BORDER', value: 'fire', label: 'Ognista Ramka', description: 'Ognista ramka wokół wiadomości', xpCost: 500, permanent: false },
  { id: 'border-ice', type: 'CHAT_BORDER', value: 'ice', label: 'Lodowa Ramka', description: 'Lodowa ramka wokół wiadomości', xpCost: 500, permanent: false },
  { id: 'border-neon', type: 'CHAT_BORDER', value: 'neon', label: 'Neonowa Ramka', description: 'Neonowa poświata wokół wiadomości', xpCost: 750, permanent: false },
  { id: 'border-glitch', type: 'CHAT_BORDER', value: 'glitch', label: 'Glitch Ramka', description: 'Glitchowy efekt na wiadomościach', xpCost: 1000, permanent: false },

  // Chat badges (cosmetic, not earned)
  { id: 'badge-vip', type: 'CHAT_BADGE', value: 'vip', label: 'VIP Badge', description: 'Odznaka VIP przy nicku', xpCost: 2000, permanent: true },
  { id: 'badge-crown', type: 'CHAT_BADGE', value: 'crown', label: 'Korona', description: 'Korona przy nicku w czacie', xpCost: 3000, permanent: true },
  { id: 'badge-diamond', type: 'CHAT_BADGE', value: 'diamond', label: 'Diament', description: 'Diamentowa odznaka przy nicku', xpCost: 5000, permanent: true },

  // Nickname effects
  { id: 'nick-glow', type: 'NICKNAME_EFFECT', value: 'glow', label: 'Poświata', description: 'Twój nick świeci delikatną poświatą', xpCost: 300, permanent: false },
  { id: 'nick-shake', type: 'NICKNAME_EFFECT', value: 'shake', label: 'Trzęsienie', description: 'Twój nick lekko się trzęsie', xpCost: 400, permanent: false },
  { id: 'nick-typing', type: 'NICKNAME_EFFECT', value: 'typewriter', label: 'Maszyna do pisania', description: 'Efekt pisania na maszynie', xpCost: 600, permanent: false },
];

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}

  /** Get shop catalog */
  getCatalog() {
    return SHOP_CATALOG;
  }

  /** Get user's purchased cosmetics */
  async getUserCosmetics(userId: number) {
    const cosmetics = await this.prisma.userCosmetic.findMany({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
    });

    // Filter out expired
    const now = new Date();
    return cosmetics.map((c) => ({
      ...c,
      isExpired: c.expiresAt ? c.expiresAt < now : false,
    }));
  }

  /** Get user's ACTIVE cosmetics (for chat rendering) */
  async getActiveCosmetics(userId: number) {
    const now = new Date();
    return this.prisma.userCosmetic.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    });
  }

  /** Purchase a cosmetic item */
  async purchase(userId: number, itemId: string) {
    const item = SHOP_CATALOG.find((i) => i.id === itemId);
    if (!item) throw new BadRequestException('Item not found');

    // Check XP
    const userXp = await this.prisma.userXp.findUnique({ where: { userId } });
    if (!userXp || userXp.totalXp < item.xpCost) {
      throw new BadRequestException('Za mało XP');
    }

    // Check if user already has this active cosmetic type+value
    const existing = await this.prisma.userCosmetic.findFirst({
      where: {
        userId,
        type: item.type,
        value: item.value,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    if (existing) throw new BadRequestException('Masz już ten przedmiot aktywny');

    const expiresAt = item.permanent ? null : new Date(Date.now() + 30 * 86_400_000);

    // Deduct XP & create cosmetic
    const [, , cosmetic] = await this.prisma.$transaction([
      this.prisma.userXp.update({
        where: { userId },
        data: { totalXp: { decrement: item.xpCost } },
      }),
      this.prisma.xpTransaction.create({
        data: {
          userId,
          action: 'DAILY_CHALLENGE_BONUS', // reuse for shop spending
          amount: -item.xpCost,
          metadata: JSON.stringify({ shopItemId: itemId, type: 'purchase' }),
        },
      }),
      this.prisma.userCosmetic.create({
        data: {
          userId,
          type: item.type,
          value: item.value,
          xpCost: item.xpCost,
          expiresAt,
        },
      }),
    ]);

    return {
      purchased: true,
      cosmetic,
      remainingXp: (userXp.totalXp - item.xpCost),
    };
  }

  /** Toggle a cosmetic on/off */
  async toggleCosmetic(userId: number, cosmeticId: number) {
    const cosmetic = await this.prisma.userCosmetic.findFirst({
      where: { id: cosmeticId, userId },
    });
    if (!cosmetic) throw new BadRequestException('Cosmetic not found');

    // If activating, deactivate others of same type
    if (!cosmetic.isActive) {
      await this.prisma.userCosmetic.updateMany({
        where: { userId, type: cosmetic.type, isActive: true },
        data: { isActive: false },
      });
    }

    const updated = await this.prisma.userCosmetic.update({
      where: { id: cosmeticId },
      data: { isActive: !cosmetic.isActive },
    });

    return updated;
  }
}
