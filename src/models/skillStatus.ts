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
  ElectricBallSnapshot,
  BeamSnapshot,
  ArrowInstance,
  FireballInstance,
  ElectricBallInstance,
  BeamInstance,
} from './cards'
import {
  ICE_SPIKE_CARD,
  FIREBALL_CARD,
  ELECTRIC_BALL_BASE,
  BEAM_CARD,
} from '../config'
import {
  computeIceArrowSnapshotFromSequence,
  computeIceSpikeSnapshotFromSequence,
  computeFireballSnapshotFromSequence,
  computeElectricBallSnapshotFromSequence,
  computeBeamSnapshotFromSequence,
} from './infiniteSnapshot'
import type { SlotItem } from './InfiniteGameLogic'

/** 技能圖示（emoji 或短字） */
export const SKILL_ICONS: Record<string, string> = {
  'ice-arrow': '❄️',
  'ice-spike': '🧊',
  fireball: '🔥',
  'electric-ball': '⚡',
  beam: '✧',
}

/** 取得技能圖示 */
export function getSkillIcon(skillId: string): string {
  return SKILL_ICONS[skillId] ?? '◆'
}

/** 冰箭：用於分組的簽名（含穿/連鎖順序） */
function iceArrowSignature(a: ArrowInstance): string {
  return [
    a.damage,
    a.speed,
    a.pierceCount,
    (a.pierceRicochetSequence ?? []).join(','),
    a.hasTracking ? 1 : 0,
    a.chillChanceBonus,
    a.hasSplit ? `${a.splitCount}-${a.splitDamageRatio}` : '',
    (a as { cascadeCount?: number }).cascadeCount ?? (a.hasCascade ? 1 : 0),
    a.hasRicochet ? 1 : 0,
    a.hasDetonate ? 1 : 0,
    a.hasColdZone ? 1 : 0,
    a.hasFreeze ? 1 : 0,
  ].join('_')
}

/**
 * 冰箭：依規格「摘要縮寫」→ ❄️ x{n} 🎯… 🌡️… +追 +穿＋連鎖＋穿…（順序依 pierceRicochetSequence，連鎖可疊加 連鎖x2）
 */
function formatArrowInstance(a: ArrowInstance, groupCount: number): string {
  const parts: string[] = []
  parts.push(`🎯${a.damage}`)
  if (a.chillChanceBonus > 0) parts.push(`🌡️${Math.round(a.chillChanceBonus * 100)}%`)
  if (a.hasTracking) parts.push(groupCount > 1 ? `+追x${groupCount}` : '+追')
  if ((a.pierceRicochetSequence?.length ?? 0) > 0) {
    const seq = a.pierceRicochetSequence!
    let i = 0
    while (i < seq.length) {
      const kind = seq[i]!
      let n = 0
      while (i < seq.length && seq[i] === kind) { n++; i++ }
      parts.push(kind === 'ricochet' ? (n > 1 ? `+連鎖x${n}` : '+連鎖') : (n > 1 ? `+穿x${n}` : '+穿'))
    }
  } else if (a.pierceCount > 0 || a.hasRicochet) {
    if (a.pierceCount > 0) parts.push(`+穿${a.pierceCount}`)
    if (a.hasRicochet) parts.push('+連鎖')
  }
  if (a.hasSplit) parts.push(`+分${a.splitCount}`)
  const cascadeN = (a as { cascadeCount?: number }).cascadeCount ?? (a.hasCascade ? 1 : 0)
  if (cascadeN > 0) parts.push(cascadeN > 1 ? `+分x${cascadeN}` : '+分1')
  if (a.hasDetonate) parts.push('+噴冰')
  if (a.hasColdZone) parts.push('+凍土')
  if (a.hasFreeze) parts.push('+凍')
  return parts.join(' ')
}

/** 冰箭快照依相同數值分組（全域合併，含雜碎冰塊加倍後仍顯示 x8 / x2）startIndex 為該組首次出現的 1-based 索引 */
export function getIceArrowGroups(snapshot: IceArrowSnapshot): { arrow: ArrowInstance; count: number; startIndex: number }[] {
  const bySig = new Map<string, { arrow: ArrowInstance; count: number; firstIndex: number }>()
  for (let i = 0; i < snapshot.arrows.length; i++) {
    const a = snapshot.arrows[i]!
    const sig = iceArrowSignature(a)
    const existing = bySig.get(sig)
    if (existing) {
      existing.count += 1
    } else {
      bySig.set(sig, { arrow: a, count: 1, firstIndex: i + 1 })
    }
  }
  return [...bySig.values()]
    .sort((x, y) => x.firstIndex - y.firstIndex)
    .map(({ arrow, count, firstIndex }) => ({ arrow, count, startIndex: firstIndex }))
}

/** 冰箭快照 → 冷卻＋數量；相同數值整併為「❄️ x{n} 🎯… 🌡️… +追 +穿 +分…」 */
export function formatIceArrowStatus(snapshot: IceArrowSnapshot): string[] {
  const header = `冷${snapshot.cooldown.toFixed(1)}s · ${snapshot.arrows.length}支 · 360° 均分`
  const groups = getIceArrowGroups(snapshot)
  const lines = groups.map(({ arrow, count }) => {
    const tags = formatArrowInstance(arrow, count)
    const prefix = `x${count} `
    return `${SKILL_ICONS['ice-arrow']} ${prefix}${tags}`
  })
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

/** 電球：單顆效果 → 短標籤含數值（環繞物） */
function formatElectricBallInstance(eb: ElectricBallInstance): string {
  const tags: string[] = []
  if (eb.hasLightningChain) tags.push('連線')
  if (eb.hasAttach) tags.push('吸附')
  if (eb.hasEmp) tags.push('EMP')
  if (eb.hasStormCore) tags.push('雷暴')
  if (eb.hasChainBoost) tags.push('增幅')
  if (eb.hasAttachBurst) tags.push('爆發')
  if (eb.hasTesla) tags.push('特斯拉')
  if (eb.hasSuperconduct) tags.push('磁場')
  return tags.length > 0 ? tags.join('＋') : '—'
}

/** 電球快照 → 數量＋半徑＋每顆一行（環繞物無冷卻） */
export function formatElectricBallStatus(snapshot: ElectricBallSnapshot): string[] {
  const r = snapshot.orbs[0]?.radius ?? ELECTRIC_BALL_BASE.radius
  const header = `數量${snapshot.orbs.length} 半徑${r}px`
  const lines = snapshot.orbs.map((eb) => `${SKILL_ICONS['electric-ball']} ${formatElectricBallInstance(eb)}`)
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
    case 'electric-ball':
      return formatElectricBallStatus(computeElectricBallSnapshotFromSequence(items))
    case 'beam':
      return formatBeamStatus(computeBeamSnapshotFromSequence(items))
    default:
      return []
  }
}
