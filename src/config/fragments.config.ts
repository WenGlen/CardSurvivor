/**
 * 強化碎片（地圖掉落物）參數配置
 *
 * 無限模式中，擊殺敵人後地圖上會隨機生成強化碎片，
 * 拾取後對應卡槽獲得冷卻/範圍/數量/傷害加成。
 * 各技能可設定不同的碎片類型出現機率（見 FRAGMENT_WEIGHTS_BY_SKILL）。
 */

export type PickupType = 'cooldown' | 'range' | 'count' | 'damage'

/** 碎片類型權重（舊版全局，僅供未指定技能時 fallback），總和應為 1 */
export const PICKUP_TYPE_WEIGHTS: Record<PickupType, number> = {
  cooldown: 0.5,
  range: 0.35,
  count: 0.15,
  damage: 0,
}

/**
 * 依技能設定碎片類型出現機率（總和應為 1）。
 * 冰箭：冷卻 50%、數量 10%、傷害 40%，不出現範圍。
 * 凍土：冷卻 50%、範圍 50%，無數量/傷害。
 * 未列出的技能使用 DEFAULT_FRAGMENT_WEIGHTS。
 */
export const FRAGMENT_WEIGHTS_BY_SKILL: Partial<Record<string, Partial<Record<PickupType, number>>>> = {
  'ice-arrow': { cooldown: 0.5, count: 0.1, damage: 0.4 },
  'ice-spike': { cooldown: 0.5, range: 0.5 },
}

/** 未在 FRAGMENT_WEIGHTS_BY_SKILL 設定的技能使用的權重 */
export const DEFAULT_FRAGMENT_WEIGHTS: Record<PickupType, number> = {
  cooldown: 0.5,
  range: 0.35,
  count: 0.15,
  damage: 0,
}

/** 依技能取得碎片類型權重（僅包含該技能會出現的類型，總和 1） */
export function getFragmentWeightsForSkill(skillId: string): Record<PickupType, number> {
  const raw = FRAGMENT_WEIGHTS_BY_SKILL[skillId] ?? DEFAULT_FRAGMENT_WEIGHTS
  const sum = (raw.cooldown ?? 0) + (raw.range ?? 0) + (raw.count ?? 0) + (raw.damage ?? 0)
  if (sum <= 0) return { ...DEFAULT_FRAGMENT_WEIGHTS }
  return {
    cooldown: (raw.cooldown ?? 0) / sum,
    range: (raw.range ?? 0) / sum,
    count: (raw.count ?? 0) / sum,
    damage: (raw.damage ?? 0) / sum,
  }
}

/** 碎片存在時間（ms），倒數完消失 */
export const PICKUP_DURATION_MS = 12_000

/** 碎片生成間隔（秒），約每 N 秒生成一次 */
export const PICKUP_SPAWN_INTERVAL = 10

/** 拾取判定半徑（px） */
export const PICKUP_COLLECT_RADIUS = 28

/** 拾取後套用的倍率或數值（每次拾取疊乘或累加） */
export const BUFF_MULTIPLIERS = {
  /** 冷卻縮短：每次 ×0.9，最低由 skills 決定 */
  cooldown: 0.9,
  /** 範圍增加：每次 ×1.1 */
  range: 1.1,
  /** 數量：+1 單位，由快照邏輯處理 */
  count: 1,
  /** 傷害：+N（冰箭等由快照邏輯處理，見 BUFF_DAMAGE_AMOUNT） */
  damage: 1,
} as const

/** 傷害碎片每次拾取增加的傷害值（依技能可能不同，目前冰箭 +5） */
export const BUFF_DAMAGE_AMOUNT: Partial<Record<string, number>> = {
  'ice-arrow': 5,
}

/** 冷卻倍率下限（避免技能過於頻繁） */
export const MIN_COOLDOWN_MULTIPLIER = 0.3

/** 取得強化碎片 UI 標籤（依 BUFF_MULTIPLIERS / BUFF_DAMAGE_AMOUNT 動態計算） */
export function getBuffLabels(): Record<PickupType, string> {
  const cdPct = Math.round((BUFF_MULTIPLIERS.cooldown - 1) * 100)
  const rangePct = Math.round((BUFF_MULTIPLIERS.range - 1) * 100)
  return {
    cooldown: `冷卻 ${cdPct}%`,
    range: `範圍 ${rangePct > 0 ? '+' : ''}${rangePct}%`,
    count: '數量 +1',
    damage: '傷害 +5',
  }
}
