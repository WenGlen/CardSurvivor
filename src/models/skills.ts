import type { SkillDefinition } from './types'

/**
 * 冰箭技能定義
 * 以主方向為軸心，平均往各方向發出數個冰箭。
 * 初始數值：傷害 12 ｜ 速度 220 px/s ｜ 冷卻 1.2s ｜ 數量 3 ｜ 穿透 0 ｜ 散射角 30°
 */
export const iceArrow: SkillDefinition = {
  id: 'ice-arrow',
  name: '冰箭',
  element: 'ICE',
  damageType: 'PROJECTILE',
  description: '以主方向為軸心，平均往各方向發出數個冰箭。因平均各方向擴散，單體傷害較低。',
  initialStats: {
    damage: 12,
    speed: 220,
    cooldown: 1.2,
    count: 3,
    pierceCount: 0,
    spreadAngle: 30,
  },
}

/**
 * 冰錐技能定義
 * 以主方向前方一段距離外的弧形為範圍，從地面射出冰錐。
 * 初始數值：傷害 25 ｜ 範圍弧度 60° ｜ 施法距離 200px ｜ 冷卻 2.5s ｜ 冰錐柱數 5
 */
export const iceSpike: SkillDefinition = {
  id: 'ice-spike',
  name: '冰錐',
  element: 'ICE',
  damageType: 'AREA',
  description: '以主方向前方一段距離外的弧形為範圍，從地面射出冰錐。',
  initialStats: {
    damage: 25,
    angle: 60,
    castRange: 200,
    cooldown: 2.5,
    count: 5,
  },
}

/**
 * 火球技能定義
 * 向主角前方拋出火球，落地時造成範圍爆炸傷害。
 * 初始數值：傷害 45 ｜ 爆炸半徑 80px ｜ 拋射距離 250px ｜ 冷卻 3s ｜ 數量 1
 */
export const fireball: SkillDefinition = {
  id: 'fireball',
  name: '火球',
  element: 'FIRE',
  damageType: 'PROJECTILE',
  description: '向主角前方拋出火球，落地時造成範圍爆炸傷害。因需要主動控制方向，傷害較高。',
  initialStats: {
    damage: 45,
    radius: 80,
    range: 250,
    cooldown: 3,
    count: 1,
  },
}

/**
 * 光束技能定義
 * 向主角前方直線發射光束，持續照射造成範圍傷害。
 * 初始數值：傷害 30/s ｜ 射程 400px ｜ 寬度 20px ｜ 持續 2s ｜ 冷卻 3s ｜ 數量 1
 */
export const beam: SkillDefinition = {
  id: 'beam',
  name: '光束',
  element: 'FIRE',
  damageType: 'AREA',
  description: '向主角前方直線發射光束，持續照射造成範圍傷害。因需要主動控制方向，傷害較高。',
  initialStats: {
    damage: 30,
    range: 400,
    radius: 20, // 寬度（半寬）
    duration: 2,
    cooldown: 3,
    count: 1,
  },
}

/** 所有可用技能列表 */
export const allSkills: SkillDefinition[] = [iceArrow, iceSpike, fireball, beam]
