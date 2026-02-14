/**
 * 技能圖示與狀態標籤
 *
 * 用於卡槽右側顯示技能數值、強化效果摘要。
 * 每項標籤盡量簡短（1～2 字＋數值），避免疊太多時版面溢位。
 */
import type {
  IceArrowSnapshot,
  IceSpikeSnapshot,
  FireballSnapshot,
  BeamSnapshot,
  ArrowInstance,
  FireballInstance,
  BeamInstance,
} from './cards'
import {
  ICE_ARROW_CARD,
  ICE_SPIKE_CARD,
  FIREBALL_CARD,
  BEAM_CARD,
} from '../config'
import {
  computeIceArrowSnapshotFromSequence,
  computeIceSpikeSnapshotFromSequence,
  computeFireballSnapshotFromSequence,
  computeBeamSnapshotFromSequence,
} from './infiniteSnapshot'
import type { SlotItem } from './InfiniteGameLogic'

/** 技能圖示（emoji 或短字） */
export const SKILL_ICONS: Record<string, string> = {
  'ice-arrow': '❄️',
  'ice-spike': '🧊',
  fireball: '🔥',
  beam: '⚡',
}

/** 取得技能圖示 */
export function getSkillIcon(skillId: string): string {
  return SKILL_ICONS[skillId] ?? '◆'
}

/** 冰箭：單支箭效果 → 短標籤字串（含數值） */
function formatArrowInstance(a: ArrowInstance): string {
  const tags: string[] = []
  if (a.hasTracking) tags.push('追')
  if (a.hasSplit) tags.push(`裂${Math.round(a.splitDamageRatio * 100)}%`)
  if (a.chillChanceBonus > 0) tags.push(`${Math.round(a.chillChanceBonus * 100)}%失溫`)
  if (a.hasConvergence) {
    const cfg = ICE_ARROW_CARD['ice-arrow-convergence']
    tags.push(`聚${cfg.requiredHitCount}支${cfg.convergeWindowMs / 1000}s`)
  }
  if (a.hasShardBarrage) {
    const cfg = ICE_ARROW_CARD['ice-arrow-shard-barrage']
    tags.push(`彈${Math.round(cfg.shardDamageRatio * 100)}%`)
  }
  if (a.pierceCount > 0) tags.push(`穿${a.pierceCount}`)
  if (a.hasColdZone) {
    const cfg = ICE_ARROW_CARD['ice-arrow-cold-zone']
    tags.push(`寒${cfg.coldZoneRadius}px`)
  }
  if (a.hasChainExplosion) {
    const cfg = ICE_ARROW_CARD['ice-arrow-chain']
    tags.push(`連${Math.round(cfg.chainDamageRatio * 100)}%`)
  }
  return tags.length > 0 ? tags.join('＋') : '—'
}

/** 冰箭快照 → 冷卻＋每支箭一行 */
export function formatIceArrowStatus(snapshot: IceArrowSnapshot): string[] {
  const header = `冷${snapshot.cooldown.toFixed(1)}s`
  const lines = snapshot.arrows.map((a) => `${SKILL_ICONS['ice-arrow']} ${formatArrowInstance(a)}`)
  return [header, ...lines]
}

/** 凍土：單一實例，多標籤含數值 */
function formatIceSpikeTags(s: IceSpikeSnapshot): string {
  const tags: string[] = []
  if (s.hasTracking) tags.push('追')
  if (s.isCage) tags.push(`環${ICE_SPIKE_CARD['ice-spike-cage'].cageRadius}`)
  if (s.isMine) tags.push(`雷${ICE_SPIKE_CARD['ice-spike-mine'].mineDuration}s`)
  if (s.hasSpread) tags.push(`蔓${Math.round(ICE_SPIKE_CARD['ice-spike-spread'].spreadDamageRatio * 100)}%`)
  if (s.hasDoubleHit) tags.push(`二${Math.round(ICE_SPIKE_CARD['ice-spike-double-hit'].secondHitMultiplier * 100)}%`)
  if (s.hasShardSplash) tags.push(`濺${Math.round(ICE_SPIKE_CARD['ice-spike-shard-splash'].shardDamageRatio * 100)}%`)
  if (s.hasPermafrost) tags.push(`永${ICE_SPIKE_CARD['ice-spike-permafrost'].freezeDurationMs / 1000}s`)
  if (s.hasResonance) tags.push(`振${ICE_SPIKE_CARD['ice-spike-resonance'].waveRadius}/${Math.round(ICE_SPIKE_CARD['ice-spike-resonance'].waveDamageRatio * 100)}%`)
  return tags.length > 0 ? tags.join('＋') : '—'
}

/** 凍土快照 → 冷卻＋範圍＋效果 */
export function formatIceSpikeStatus(snapshot: IceSpikeSnapshot): string[] {
  const header = `冷${snapshot.cooldown.toFixed(1)}s 範${snapshot.castRange}px`
  return [header, `${SKILL_ICONS['ice-spike']} ${formatIceSpikeTags(snapshot)}`]
}

/** 火球：單顆效果 → 短標籤含數值 */
function formatFireballInstance(fb: FireballInstance): string {
  const tags: string[] = []
  if (fb.hasBounce) tags.push(`彈${Math.round(FIREBALL_CARD['fireball-bounce'].bounceDamageRatio * 100)}%`)
  if (fb.hasLava) tags.push(`熔${FIREBALL_CARD['fireball-lava'].lavaDurationMs / 1000}s/${Math.round(FIREBALL_CARD['fireball-lava'].lavaDpsRatio * 100)}%`)
  if (fb.hasScatter) tags.push(`散${FIREBALL_CARD['fireball-scatter'].sparkCount}/${Math.round(FIREBALL_CARD['fireball-scatter'].sparkDamageRatio * 100)}%`)
  if (fb.isMeteor) tags.push(`隕${FIREBALL_CARD['fireball-meteor'].damageMultiplier}x`)
  if (fb.hasWildfire) tags.push(`野${FIREBALL_CARD['fireball-wildfire'].corpseBurnDurationMs / 1000}s`)
  if (fb.hasChainExplosion) tags.push(`爆${FIREBALL_CARD['fireball-chain-explosion'].burnExplodeMultiplier}x`)
  return tags.length > 0 ? tags.join('＋') : '—'
}

/** 火球快照 → 冷卻＋射程＋每顆一行 */
export function formatFireballStatus(snapshot: FireballSnapshot): string[] {
  const header = `冷${snapshot.cooldown.toFixed(1)}s 射${snapshot.throwDistance}px`
  const lines = snapshot.fireballs.map((fb) => `${SKILL_ICONS['fireball']} ${formatFireballInstance(fb)}`)
  return [header, ...lines]
}

/** 光束：單道效果 → 短標籤含數值 */
function formatBeamInstance(b: BeamInstance): string {
  const tags: string[] = []
  if (b.hasKnockback) tags.push(`退${BEAM_CARD['beam-knockback'].knockbackDistance}`)
  if (b.hasDualLine) tags.push(`雙${Math.round(BEAM_CARD['beam-dual-line'].damageRatioPerBeam * 100)}%`)
  if (b.hasRefraction) tags.push(`折${Math.round(BEAM_CARD['beam-refraction'].refractionDamageRatio * 100)}%`)
  if (b.hasFocusBurn) tags.push(`灼${Math.round(BEAM_CARD['beam-focus-burn'].incrementPerSecond * 100)}%`)
  if (b.hasPrismSplit) tags.push(`稜${Math.round(BEAM_CARD['beam-prism'].damageRatioPerBeam * 100)}%`)
  if (b.hasOverloadTail) tags.push(`尾${BEAM_CARD['beam-overload-tail'].tailDurationMs / 1000}s×${BEAM_CARD['beam-overload-tail'].tailDamageMultiplier}`)
  if (b.hasBurningTrail) tags.push(`殘${Math.round(BEAM_CARD['beam-burning-trail'].trailDpsRatio * 100)}%`)
  if (b.hasOverload) tags.push(`載×${BEAM_CARD['beam-overload'].overloadDamageMultiplier}`)
  return tags.length > 0 ? tags.join('＋') : '—'
}

/** 光束快照 → 冷卻＋範圍＋每道一行 */
export function formatBeamStatus(snapshot: BeamSnapshot): string[] {
  const header = `冷${snapshot.cooldown.toFixed(1)}s 範${snapshot.range}px`
  const lines = snapshot.beams.map((b) => `${SKILL_ICONS['beam']} ${formatBeamInstance(b)}`)
  return [header, ...lines]
}

/** 依技能與 items 計算並回傳狀態摘要（第一行冷卻/範圍，後為每實例一行） */
export function getSlotStatusLines(skillId: string, items: SlotItem[]): string[] {
  switch (skillId) {
    case 'ice-arrow':
      return formatIceArrowStatus(computeIceArrowSnapshotFromSequence(items))
    case 'ice-spike':
      return formatIceSpikeStatus(computeIceSpikeSnapshotFromSequence(items))
    case 'fireball':
      return formatFireballStatus(computeFireballSnapshotFromSequence(items))
    case 'beam':
      return formatBeamStatus(computeBeamSnapshotFromSequence(items))
    default:
      return []
  }
}
