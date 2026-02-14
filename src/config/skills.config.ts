/**
 * 技能基礎參數配置
 *
 * 定義各技能的初始數值，與機制邏輯分離。
 * 修改此檔即可調整技能平衡，無需改動 cards.ts / GameEngine 邏輯。
 */

/** 冰箭基礎參數 */
export const ICE_ARROW_BASE = {
  damage: 12,
  speed: 220,
  cooldown: 1.2,
  count: 3,
  pierceCount: 0,
  spreadAngle: 30,
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
