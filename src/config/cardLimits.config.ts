/**
 * 卡片數量上限（依 CardsDetail-ice-v4 等規格）
 * 未列出的卡片視為無上限（如強化碎片、他技能卡片尚未定義時）
 */
export const CARD_MAX_COUNT: Record<string, number> = {
  // 冰箭
  'ice-arrow-homing': 4,
  'ice-arrow-frostbite': 4,
  'ice-arrow-volley': 4,
  'ice-arrow-fracture': 4,
  'ice-arrow-pierce': 3,
  'ice-arrow-cascade': 3,
  'ice-arrow-ricochet': 1,
  'ice-arrow-detonate': 1,
  'ice-arrow-glacier': 1,
  'ice-arrow-freeze': 1,
}

export function getCardMaxCount(cardId: string): number {
  return CARD_MAX_COUNT[cardId] ?? Infinity
}
