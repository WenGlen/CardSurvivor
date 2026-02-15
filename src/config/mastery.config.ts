/**
 * 專精大師模式參數配置
 *
 * 單一技能、無波次、隨時間加速敵人生成、星星升級三選一（技能卡 40% / 強化碎片 60%）。
 */

/** 三選一類型比例（可調，總和建議 1） */
export const MASTERY_PICK = {
  /** 技能卡片出現機率（用於後兩格的 roll） */
  skillCardRatio: 0.4,
  /** 強化碎片出現機率 */
  fragmentRatio: 0.6,
  /** 三選一至少出現幾張技能卡（有可選卡時），設 0 則可三張都碎片 */
  minSkillCardsInOffer: 1,
} as const

/** 星星出現規則 */
export const STAR = {
  /** 拾取後多久（秒）生成下一顆；同時僅存在一顆時為間隔 */
  spawnIntervalSec: 20,
  /** 星星存在時長（ms），未拾取則消失 */
  durationMs: 10_000,
  /** 拾取判定半徑（px） */
  collectRadius: 25,
  /** 拾取一顆星星時回復的 HP（不超過上限） */
  hpRecoverOnCollect: 10,
  /** 星星生成時與畫面邊緣的最小距離（px），避免貼牆吃不到 */
  spawnMarginFromEdge: 100,
} as const

/** 敵人生成（隨時間加速，無波次） */
export const MASTERY_SPAWN = {
  /** 基礎生成間隔（秒） */
  baseInterval: 1.5,
  /** 每秒縮短比例（spawnInterval = max(min, base * (1 - accelRate * elapsed)) */
  accelRate: 0.035,
  /** 最小間隔（秒） */
  minInterval: 0.01,
} as const

/** 敵人強度隨遊戲時間成長（等效「虛擬波次」由時間推算） */
export const MASTERY_ENEMY_SCALING = {
  /** 每 60 秒視為 +1 虛擬波次（用於 HP/速度/傷害成長） */
  virtualWavePerSec: 1 / 60,
}

/** 專精大師內強化碎片類型權重（可與無限模式不同，例如傷害 30%） */
export const FRAGMENT_WEIGHTS_MASTERY: Record<string, Partial<Record<'cooldown' | 'range' | 'count' | 'damage', number>>> = {
  'ice-arrow': { cooldown: 0.35, count: 0.35, damage: 0.3 },
  'ice-spike': { cooldown: 0.5, range: 0.5 },
  'fireball': { cooldown: 0.5, range: 0.35, count: 0.15 },
  'electric-ball': { cooldown: 0.5, range: 0.35, count: 0.15 },
  'beam': { cooldown: 0.5, range: 0.35, count: 0.15 },
}

export type MasteryPickupType = 'cooldown' | 'range' | 'count' | 'damage'

/** 依技能取得專精大師內碎片類型權重（總和 1） */
export function getFragmentWeightsForSkillMastery(skillId: string): Record<MasteryPickupType, number> {
  const raw = FRAGMENT_WEIGHTS_MASTERY[skillId] ?? { cooldown: 0.5, range: 0.35, count: 0.15, damage: 0 }
  const sum = (raw.cooldown ?? 0) + (raw.range ?? 0) + (raw.count ?? 0) + (raw.damage ?? 0)
  if (sum <= 0) return { cooldown: 0.5, range: 0.35, count: 0.15, damage: 0 }
  return {
    cooldown: (raw.cooldown ?? 0) / sum,
    range: (raw.range ?? 0) / sum,
    count: (raw.count ?? 0) / sum,
    damage: (raw.damage ?? 0) / sum,
  }
}
