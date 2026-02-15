/**
 * 技能基礎參數配置
 *
 * 定義各技能的初始數值，與機制邏輯分離。
 * 修改此檔即可調整技能平衡，無需改動 cards.ts / GameEngine 邏輯。
 */

/** 冰箭基礎參數（CardsDetail-ice-v4：數量 4、冷卻 1.2s、觸發失溫 20%） */
export const ICE_ARROW_BASE = {
  damage: 20,
  speed: 220,
  cooldown: 1.2,
  count: 4,
  pierceCount: 0,
  spreadAngle: 360,
  /** 基礎觸發失溫機率 0~1 */
  chillChanceBase: 0.2,
} as const

/** 凍土基礎參數 */
export const ICE_SPIKE_BASE = {
  /** 主體傷害（dps 計算用：約 8*2/3 ≈ 5.3，這裡用 damage 代表每秒傷害） */
  damage: 5,
  arcAngle: 90,
  castRange: 180,
  duration: 4,
  cooldown: 5,
  slowRate: 0.8,
  /** 凍土 dps 計算：dps = baseDps * 2/3，baseDps 約 8 */
  baseDps: 8,
  dpsRatio: 2 / 3,
} as const

/** 火球基礎參數 */
export const FIREBALL_BASE = {
  damage: 45,
  explosionRadius: 80,
  throwDistance: 250,
  cooldown: 3,
  count: 1,
  spreadAngle: 30,
} as const

/** 光束基礎參數 */
export const BEAM_BASE = {
  pulseDamage: 70,
  width: 25,
  range: 400,
  duration: 0.3,
  cooldown: 3,
  pulseInterval: 250,
  singleShot: true,
} as const

/** 電球基礎參數（CardsDetail-v3：環繞物，主角身邊旋轉的電球） */
export const ELECTRIC_BALL_BASE = {
  damage: 20,
  rotationSpeed: 180,
  radius: 80,
  count: 2,
  paralyzeChance: 0.4,
} as const
