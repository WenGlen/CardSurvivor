/**
 * 戰鬥通用參數配置
 *
 * 玩家、 debuff、碰撞、視覺等與技能無直接綁定的數值。
 * 技能/卡片專屬的數值請放在 cards.config.ts。
 */

/** 玩家受擊後無敵時間（ms） */
export const INVINCIBLE_DURATION_MS = 500

/** 減速 debuff / 寒氣區域 下的移動係數（0.7 = 剩 70% 移速） */
export const SLOW_MOVE_MULTIPLIER = 0.7

/** 冷卻倍率邊界（setCooldownMultiplier 的 clamp） */
export const COOLDOWN_MULTIPLIER_BOUNDS = { min: 0.3, max: 1 } as const

/** 範圍倍率邊界（setRangeMultiplier 的 clamp） */
export const RANGE_MULTIPLIER_BOUNDS = { min: 0.5, max: 2 } as const

/** 傷害數字浮動顯示 */
export const DAMAGE_NUMBER = {
  durationMs: 800,
  offsetX: 20,
  offsetY: 20,
} as const
