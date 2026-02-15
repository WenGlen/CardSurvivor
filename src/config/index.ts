/**
 * 遊戲參數配置統一入口
 *
 * 將機制與數值分離，方便平衡調整。
 * - skills.config：技能基礎參數
 * - cards.config：卡片效果數值
 * - fragments.config：強化碎片（地圖掉落物）
 * - infinite.config：無限模式（波次、敵人、抽卡、計分）
 * - combat.config：戰鬥通用（無敵、減速、倍率邊界等）
 */

export * from './skills.config'
export * from './cards.config'
export * from './cardLimits.config'
export * from './fragments.config'
export * from './infinite.config'
export * from './mastery.config'
export * from './combat.config'
