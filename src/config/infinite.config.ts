/**
 * 無限模式參數配置
 *
 * 波次、敵人成長、生成、抽卡權重、計分等數值。
 */

/** 波次擊殺目標 */
export const WAVE = {
  /** 第一波需擊殺數 */
  initialKillTarget: 4,
  /** 每波倍率（第 n 波 = initialKillTarget × mult^(n-1)，四捨五入為整數，可為小數如 1.5） */
  killTargetMultiplier: 1.5,
} as const

/** 波次達成時的回復 */
export const WAVE_CLEAR = {
  /** 回復最大 HP 的此比例 */
  hpRecoveryRatio: 0.2,
} as const

/** 敵人基礎數值（Walker） */
export const ENEMY_BASE = {
  hp: 20,
  speed: 60,
  damage: 5,
  size: 14,
  color: '#EF5350',
} as const

/** 敵人隨波次成長係數（第 w 波：base * (1 + coeff * (w-1))） */
export const ENEMY_SCALING = {
  hpPerWave: 0.15,
  speedPerWave: 0.05,
  damagePerWave: 0.1,
  speedMaxMultiplier: 2,
} as const

/** 生成間隔（秒） */
export const SPAWN = {
  /** 基礎間隔 */
  baseInterval: 1.5,
  /** 每波遞減係數（1.5 × 0.82^(wave-1)） */
  intervalDecayPerWave: 0.82,
  /** 最小間隔（秒） */
  minInterval: 0.25,
  /** 每批生成數量：wave 4+ 生 2 隻，wave 7+ 生 3 隻 */
  batchSizeWave4: 2,
  batchSizeWave7: 3,
  batchWaveThreshold4: 4,
  batchWaveThreshold7: 7,
} as const

/** 抽卡稀有度權重（依波次變化） */
export const RARITY_WEIGHTS: Record<number, { bronze: number; silver: number; gold: number }> = {
  0: { bronze: 0.8, silver: 0.2, gold: 0 },
  1: { bronze: 0.8, silver: 0.2, gold: 0 },
  2: { bronze: 0.8, silver: 0.2, gold: 0 },
  3: { bronze: 0.6, silver: 0.35, gold: 0.05 },
  4: { bronze: 0.6, silver: 0.35, gold: 0.05 },
  5: { bronze: 0.4, silver: 0.45, gold: 0.15 },
  6: { bronze: 0.4, silver: 0.45, gold: 0.15 },
  7: { bronze: 0.25, silver: 0.5, gold: 0.25 },
}

/** 取得波次對應的稀有度權重 */
export function getRarityWeights(waveNumber: number) {
  if (waveNumber <= 2) return RARITY_WEIGHTS[0]
  if (waveNumber <= 4) return RARITY_WEIGHTS[3]
  if (waveNumber <= 6) return RARITY_WEIGHTS[5]
  return RARITY_WEIGHTS[7]
}

/** 計分 */
export const SCORE = {
  killBase: 10,
  waveBonusPer: 100,
  survivalPerSecond: 2,
  streakWindowMs: 2000,
  streakBonusPerKill: 0.1,
  streakBonusCap: 2.0,
} as const

/** 畫面敵人上限 */
export const MAX_ENEMIES = 30
