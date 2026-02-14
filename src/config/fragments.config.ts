/**
 * 強化碎片（地圖掉落物）參數配置
 *
 * 無限模式中，擊殺敵人後地圖上會隨機生成強化碎片，
 * 拾取後對應卡槽獲得冷卻/範圍/數量加成。
 */

/** 碎片類型權重（cooldown | range | count），總和應為 1 */
export const PICKUP_TYPE_WEIGHTS = {
  cooldown: 0.5,
  range: 0.35,
  count: 0.15,
} as const

/** 碎片存在時間（ms），倒數完消失 */
export const PICKUP_DURATION_MS = 12_000

/** 碎片生成間隔（秒），約每 N 秒生成一次 */
export const PICKUP_SPAWN_INTERVAL = 10

/** 拾取判定半徑（px） */
export const PICKUP_COLLECT_RADIUS = 28

/** 拾取後套用的倍率（每次拾取疊乘） */
export const BUFF_MULTIPLIERS = {
  /** 冷卻縮短：每次 ×0.95，最低由 skills 決定 */
  cooldown: 0.9,
  /** 範圍增加：每次 ×1.08 */
  range: 1.1,
  /** 數量：+1 單位，由快照邏輯處理 */
  count: 1,
} as const

/** 冷卻倍率下限（避免技能過於頻繁） */
export const MIN_COOLDOWN_MULTIPLIER = 0.3

/** 取得強化碎片 UI 標籤（依 BUFF_MULTIPLIERS 動態計算） */
export function getBuffLabels(): Record<'cooldown' | 'range' | 'count', string> {
  const cdPct = Math.round((BUFF_MULTIPLIERS.cooldown - 1) * 100)
  const rangePct = Math.round((BUFF_MULTIPLIERS.range - 1) * 100)
  return {
    cooldown: `冷卻 ${cdPct}%`,
    range: `範圍 ${rangePct > 0 ? '+' : ''}${rangePct}%`,
    count: '數量 +1',
  }
}
