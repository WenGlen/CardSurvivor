/**
 * 無限模式：依 items 順序（卡片+強化碎片）計算快照
 * 順序會影響效果，例如：先數量碎片再分裂卡 → 全部有分裂；先分裂卡再數量碎片 → 新增的箭沒有分裂
 */
import type { SlotItem } from './InfiniteGameLogic'
import {
  BUFF_MULTIPLIERS,
  MIN_COOLDOWN_MULTIPLIER,
  ICE_ARROW_BASE,
  FIREBALL_BASE,
  ELECTRIC_BALL_BASE,
  BEAM_BASE,
  FIREBALL_CARD,
} from '../config'
import type { CardDefinition } from './cards'
import {
  getBaseArrowForExtra,
  getBaseFireballForExtra,
  getBaseElectricBallForExtra,
  getBaseBeamForExtra,
  applyIceArrowSequentialCardToArrows,
  applyIceArrowGoldCardToArrow,
  applyFireballSequentialCardToFireballs,
  applyFireballGoldCardToFireball,
  applyElectricBallSequentialCardToElectricBalls,
  applyElectricBallGoldCardToElectricBall,
  applyBeamSequentialCardToBeams,
  applyBeamGoldCardToBeam,
  computeIceSpikeSnapshot,
} from './cards'
import type { IceArrowSnapshot, IceSpikeSnapshot, FireballSnapshot, ElectricBallSnapshot, BeamSnapshot } from './cards'

function cardsFromItems(items: SlotItem[]): CardDefinition[] {
  return items.filter((i): i is SlotItem & { kind: 'card' } => i.kind === 'card').map(i => i.card)
}

/** 冰箭：依序處理，count 時加入的是「到目前為止的 template」（base + 已處理的銅/銀卡），不是最後一支箭 */
export function computeIceArrowSnapshotFromSequence(items: SlotItem[]): IceArrowSnapshot {
  const template = { ...getBaseArrowForExtra() }
  const arrows: IceArrowSnapshot['arrows'] = [
    { ...getBaseArrowForExtra() },
    { ...getBaseArrowForExtra() },
    { ...getBaseArrowForExtra() },
  ]
  const goldCards: CardDefinition[] = []
  let cooldown = ICE_ARROW_BASE.cooldown

  for (const item of items) {
    if (item.kind === 'card') {
      const card = item.card
      if (card.rarity === 'gold') {
        goldCards.push(card)
        applyIceArrowGoldCardToArrow(card, template)
        for (const a of arrows) applyIceArrowGoldCardToArrow(card, a)
      } else {
        applyIceArrowSequentialCardToArrows(card, [template])
        applyIceArrowSequentialCardToArrows(card, arrows)
      }
    } else if (item.kind === 'buff') {
      if (item.buff.type === 'cooldown') cooldown *= BUFF_MULTIPLIERS.cooldown
      if (item.buff.type === 'count') {
        const newArrow = { ...template }
        for (const g of goldCards) applyIceArrowGoldCardToArrow(g, newArrow)
        arrows.push(newArrow)
      }
    }
  }

  return {
    cooldown: Math.max(MIN_COOLDOWN_MULTIPLIER, cooldown),
    spreadAngle: ICE_ARROW_BASE.spreadAngle,
    arrows,
  }
}

/** 凍土：buff 只影響 cooldown / castRange，無數量碎片 */
export function computeIceSpikeSnapshotFromSequence(items: SlotItem[]): IceSpikeSnapshot {
  const cards = cardsFromItems(items)
  const snapshot = computeIceSpikeSnapshot(cards)

  let cooldownMult = 1
  let rangeMult = 1
  for (const item of items) {
    if (item.kind === 'buff') {
      if (item.buff.type === 'cooldown') cooldownMult *= BUFF_MULTIPLIERS.cooldown
      if (item.buff.type === 'range') rangeMult *= BUFF_MULTIPLIERS.range
    }
  }
  snapshot.cooldown = Math.max(MIN_COOLDOWN_MULTIPLIER, snapshot.cooldown * cooldownMult)
  snapshot.castRange = Math.round(snapshot.castRange * rangeMult)
  return snapshot
}

/** 火球：依序處理，count 時加入 template（base + 已處理銅/銀卡） */
export function computeFireballSnapshotFromSequence(items: SlotItem[]): FireballSnapshot {
  const template = { ...getBaseFireballForExtra() }
  const fireballs: FireballSnapshot['fireballs'] = [{ ...getBaseFireballForExtra() }]
  const goldCards: CardDefinition[] = []
  let cooldown: number = FIREBALL_BASE.cooldown
  let throwDistance: number = FIREBALL_BASE.throwDistance

  for (const item of items) {
    if (item.kind === 'card') {
      const card = item.card
      if (card.rarity === 'gold') {
        goldCards.push(card)
        applyFireballGoldCardToFireball(card, template)
        for (const fb of fireballs) applyFireballGoldCardToFireball(card, fb)
      } else {
        if (card.id === 'fireball-cooldown') {
          const cfg = FIREBALL_CARD['fireball-cooldown']
          cooldown = Math.max(cfg.minCooldown, cooldown - cfg.cooldownReduction)
        } else {
          applyFireballSequentialCardToFireballs(card, [template])
          applyFireballSequentialCardToFireballs(card, fireballs)
        }
      }
    } else if (item.kind === 'buff') {
      if (item.buff.type === 'cooldown') cooldown *= BUFF_MULTIPLIERS.cooldown
      if (item.buff.type === 'range') throwDistance *= BUFF_MULTIPLIERS.range
      if (item.buff.type === 'count') {
        const newFb = { ...template }
        for (const g of goldCards) applyFireballGoldCardToFireball(g, newFb)
        fireballs.push(newFb)
      }
    }
  }

  return {
    cooldown: Math.max(MIN_COOLDOWN_MULTIPLIER, cooldown),
    throwDistance: Math.round(throwDistance),
    spreadAngle: FIREBALL_BASE.spreadAngle,
    fireballs,
  }
}

/** 電球：依序處理，count buff 時加入 template（環繞物無冷卻） */
export function computeElectricBallSnapshotFromSequence(items: SlotItem[]): ElectricBallSnapshot {
  const template = { ...getBaseElectricBallForExtra() }
  const orbs: ElectricBallSnapshot['orbs'] = [...Array(ELECTRIC_BALL_BASE.count)].map(() => ({ ...getBaseElectricBallForExtra() }))
  const goldCards: CardDefinition[] = []
  let radiusMult = 1

  for (const item of items) {
    if (item.kind === 'card') {
      const card = item.card
      if (card.rarity === 'gold') {
        goldCards.push(card)
        applyElectricBallGoldCardToElectricBall(card, template)
        for (const eb of orbs) applyElectricBallGoldCardToElectricBall(card, eb)
      } else {
        applyElectricBallSequentialCardToElectricBalls(card, [template])
        applyElectricBallSequentialCardToElectricBalls(card, orbs)
      }
    } else if (item.kind === 'buff') {
      if (item.buff.type === 'range') radiusMult *= BUFF_MULTIPLIERS.range
      if (item.buff.type === 'count') {
        const newEb = { ...template }
        for (const g of goldCards) applyElectricBallGoldCardToElectricBall(g, newEb)
        orbs.push(newEb)
      }
    }
  }

  if (radiusMult !== 1) {
    for (const eb of orbs) {
      eb.radius = Math.round(eb.radius * radiusMult)
    }
  }

  return { orbs }
}

/** 光束：依序處理，count buff 時加入 template（v3：脈衝制、無純數值卡） */
export function computeBeamSnapshotFromSequence(items: SlotItem[]): BeamSnapshot {
  const template = { ...getBaseBeamForExtra() }
  const beams: BeamSnapshot['beams'] = [{ ...getBaseBeamForExtra() }]
  const goldCards: CardDefinition[] = []
  let cooldown: number = BEAM_BASE.cooldown
  let range: number = BEAM_BASE.range

  for (const item of items) {
    if (item.kind === 'card') {
      const card = item.card
      if (card.rarity === 'gold') {
        goldCards.push(card)
        applyBeamGoldCardToBeam(card, template)
        for (const b of beams) applyBeamGoldCardToBeam(card, b)
      } else {
        applyBeamSequentialCardToBeams(card, [template])
        applyBeamSequentialCardToBeams(card, beams)
      }
    } else if (item.kind === 'buff') {
      if (item.buff.type === 'cooldown') cooldown *= BUFF_MULTIPLIERS.cooldown
      if (item.buff.type === 'range') range = Math.round(range * BUFF_MULTIPLIERS.range)
      if (item.buff.type === 'count') {
        const newBeam = { ...template }
        for (const g of goldCards) applyBeamGoldCardToBeam(g, newBeam)
        beams.push(newBeam)
      }
    }
  }

  return {
    cooldown: Math.max(MIN_COOLDOWN_MULTIPLIER, cooldown),
    range: Math.round(range),
    duration: BEAM_BASE.duration,
    pulseInterval: BEAM_BASE.pulseInterval,
    beams,
  }
}
