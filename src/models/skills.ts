import type { SkillDefinition } from './types'
import { ICE_ARROW_BASE, ICE_SPIKE_BASE, FIREBALL_BASE, BEAM_BASE } from '../config'

/** 冰箭技能定義（數值來自 config/skills.config） */
export const iceArrow: SkillDefinition = {
  id: 'ice-arrow',
  name: '冰箭',
  element: 'ICE',
  damageType: 'PROJECTILE',
  description: '所有冰箭平分 360° 發射，以最近敵人為主方向。因平均擴散，單體傷害中等。',
  initialStats: { ...ICE_ARROW_BASE },
}

/** 凍土技能定義（數值來自 config/skills.config） */
export const iceSpike: SkillDefinition = {
  id: 'ice-spike',
  name: '凍土',
  element: 'ICE',
  damageType: 'AREA',
  description: '在主角前方生成扇形凍土區域，進入範圍的敵人持續受傷並減速。',
  initialStats: {
    damage: ICE_SPIKE_BASE.damage,
    angle: ICE_SPIKE_BASE.arcAngle,
    castRange: ICE_SPIKE_BASE.castRange,
    cooldown: ICE_SPIKE_BASE.cooldown,
    duration: ICE_SPIKE_BASE.duration,
    slowRate: ICE_SPIKE_BASE.slowRate,
  },
}

/** 火球技能定義（數值來自 config/skills.config） */
export const fireball: SkillDefinition = {
  id: 'fireball',
  name: '火球',
  element: 'FIRE',
  damageType: 'PROJECTILE',
  description: '向主角前方拋出火球，落地時造成範圍爆炸傷害。因需要主動控制方向，傷害較高。',
  initialStats: {
    damage: FIREBALL_BASE.damage,
    radius: FIREBALL_BASE.explosionRadius,
    range: FIREBALL_BASE.throwDistance,
    cooldown: FIREBALL_BASE.cooldown,
    count: FIREBALL_BASE.count,
  },
}

/** 光束技能定義（數值來自 config/skills.config） */
export const beam: SkillDefinition = {
  id: 'beam',
  name: '光束',
  element: 'FIRE',
  damageType: 'AREA',
  description: '向主角前方發射單道光束，範圍內敵人受傷。單發高傷，畫面簡潔。',
  initialStats: {
    damage: BEAM_BASE.pulseDamage,
    range: BEAM_BASE.range,
    radius: BEAM_BASE.width,
    duration: BEAM_BASE.duration,
    cooldown: BEAM_BASE.cooldown,
    count: 1,
  },
}

/** 所有可用技能列表 */
export const allSkills: SkillDefinition[] = [iceArrow, iceSpike, fireball, beam]
