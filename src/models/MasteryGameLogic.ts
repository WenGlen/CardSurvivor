import type { CardDefinition, CardRarity } from './cards'
import type { BuffCard, CardSlot, SlotItem } from './InfiniteGameLogic'
import {
  MASTERY_PICK,
  MASTERY_SPAWN,
  MASTERY_ENEMY_SCALING,
  getFragmentWeightsForSkillMastery,
  type MasteryPickupType,
} from '../config/mastery.config'
import { getBuffLabels } from '../config/fragments.config'
import { getRarityWeights } from '../config/infinite.config'
import { getCardMaxCount } from '../config/cardLimits.config'
import { ENEMY_SCALING } from '../config/infinite.config'
import { WALKER_BASE } from './InfiniteGameLogic'

// ── 型別 ──

export type MasteryPhase = 'MASTERY_SKILL_PICK' | 'BATTLE' | 'STAR_PICK' | 'GAME_OVER'

export interface MasteryScoreState {
  totalKills: number
  score: number
  killScore: number
  survivalTime: number
  killStreak: number
  lastKillTime: number
}

export interface MasteryGameState {
  phase: MasteryPhase
  /** 單一卡槽（專精大師只有一個技能槽） */
  slot: CardSlot
  /** 本局鎖定的技能 id */
  masterySkillId: string
  /** 已拾取星星次數 */
  starsCollected: number
  score: MasteryScoreState
  playerHp: number
  playerMaxHp: number
  invincibleUntil: number
  gameStartTime: number
}

/** 三選一候選：技能卡或強化碎片 */
export type MasteryOfferItem =
  | { kind: 'card'; card: CardDefinition }
  | { kind: 'fragment'; buff: BuffCard }

/** 專精大師最佳紀錄 */
export interface MasteryBestRecord {
  score: number
  kills: number
  survivalTime: number
  starsCollected: number
  date: string
}

const BEST_RECORD_KEY = 'card-survivor-mastery-best'

// ── 工廠 ──

export function createMasteryState(): MasteryGameState {
  return {
    phase: 'MASTERY_SKILL_PICK',
    slot: { skillId: null, items: [] },
    masterySkillId: '',
    starsCollected: 0,
    score: {
      totalKills: 0,
      score: 0,
      killScore: 0,
      survivalTime: 0,
      killStreak: 0,
      lastKillTime: 0,
    },
    playerHp: 100,
    playerMaxHp: 100,
    invincibleUntil: 0,
    gameStartTime: 0,
  }
}

/** 選定技能後開始戰鬥 */
export function startMasteryGame(gs: MasteryGameState, skillId: string) {
  gs.masterySkillId = skillId
  gs.slot.skillId = skillId
  gs.phase = 'BATTLE'
  gs.gameStartTime = performance.now()
}

// ── 敵人生成（隨時間） ──

/** 依經過時間取得生成間隔（秒） */
export function getMasterySpawnInterval(elapsedTimeSec: number): number {
  const interval = MASTERY_SPAWN.baseInterval * (1 - MASTERY_SPAWN.accelRate * elapsedTimeSec)
  return Math.max(MASTERY_SPAWN.minInterval, interval)
}

/** 虛擬波次（用於敵人強度）：時間越久視為波次越高 */
function getVirtualWave(elapsedTimeSec: number): number {
  return Math.floor(elapsedTimeSec * MASTERY_ENEMY_SCALING.virtualWavePerSec) + 1
}

/** 依經過時間取得敵人數值 */
export function getMasteryEnemyStats(elapsedTimeSec: number) {
  const w = Math.max(0, getVirtualWave(elapsedTimeSec) - 1)
  return {
    hp: Math.round(WALKER_BASE.hp * (1 + ENEMY_SCALING.hpPerWave * w)),
    speed: Math.min(
      WALKER_BASE.speed * ENEMY_SCALING.speedMaxMultiplier,
      WALKER_BASE.speed * (1 + ENEMY_SCALING.speedPerWave * w),
    ),
    damage: Math.round(WALKER_BASE.damage * (1 + ENEMY_SCALING.damagePerWave * w)),
    size: WALKER_BASE.size,
    color: WALKER_BASE.color,
  }
}

// ── 計分（與無限模式一致） ──

const SCORE_KILL_BASE = 10
const SCORE_STREAK_WINDOW_MS = 2000
const SCORE_STREAK_BONUS_PER = 0.1
const SCORE_STREAK_CAP = 2.0
const SCORE_SURVIVAL_PER_SEC = 2

export function handleMasteryKill(gs: MasteryGameState) {
  const now = performance.now()
  gs.score.totalKills++

  if (now - gs.score.lastKillTime < SCORE_STREAK_WINDOW_MS) {
    gs.score.killStreak++
  } else {
    gs.score.killStreak = 1
  }
  gs.score.lastKillTime = now

  const streakMul = Math.min(SCORE_STREAK_CAP, 1 + (gs.score.killStreak - 1) * SCORE_STREAK_BONUS_PER)
  const killPts = Math.round(SCORE_KILL_BASE * streakMul)
  gs.score.killScore += killPts
  gs.score.score += killPts
}

export function updateMasterySurvivalScore(gs: MasteryGameState, dt: number) {
  gs.score.survivalTime += dt
  const timePts = Math.floor(dt * SCORE_SURVIVAL_PER_SEC)
  if (timePts > 0) gs.score.score += timePts
}

// ── 三選一（40% 技能卡 / 60% 強化碎片） ──

function weightedRarityPick(cards: CardDefinition[], weights: Record<CardRarity, number>): CardDefinition | null {
  if (cards.length === 0) return null
  const weighted = cards.map(c => ({ card: c, w: weights[c.rarity] }))
  const total = weighted.reduce((s, v) => s + v.w, 0)
  if (total <= 0) return cards[Math.floor(Math.random() * cards.length)]
  let r = Math.random() * total
  for (const { card, w } of weighted) {
    r -= w
    if (r <= 0) return card
  }
  return weighted[weighted.length - 1].card
}

/** 依拾星次數取得稀有度權重（拾星越多越容易出銀金） */
function getRarityWeightsByStars(starsCollected: number): Record<CardRarity, number> {
  if (starsCollected <= 2) return getRarityWeights(1)
  if (starsCollected <= 5) return getRarityWeights(3)
  return getRarityWeights(6)
}

/** 從候選中依權重抽一個碎片類型（只從 allowedTypes 中抽） */
function pickFragmentType(
  fragWeights: Record<MasteryPickupType, number>,
  allowedTypes: MasteryPickupType[],
): MasteryPickupType {
  if (allowedTypes.length === 0) return 'cooldown'
  const total = allowedTypes.reduce((s, t) => s + fragWeights[t], 0)
  let r = Math.random() * total
  for (const t of allowedTypes) {
    r -= fragWeights[t]
    if (r <= 0) return t
  }
  return allowedTypes[allowedTypes.length - 1]
}

/** 生成專精大師三選一：不重複（同卡不重複、同類型碎片不重複），且至少一張技能卡（可配置） */
export function generateMasteryOffer(
  gs: MasteryGameState,
  allCards: CardDefinition[],
  skillName: string,
): MasteryOfferItem[] {
  const skillCards = allCards.filter(c => c.skillId === gs.masterySkillId)
  const allowedCards = skillCards.filter(c => {
    const items = gs.slot.items
    const count = items.filter((i): i is SlotItem & { kind: 'card' } => i.kind === 'card' && i.card.id === c.id).length
    return count < getCardMaxCount(c.id)
  })
  const fragWeights = getFragmentWeightsForSkillMastery(gs.masterySkillId)
  const fragTypes = (['cooldown', 'range', 'count', 'damage'] as const).filter(t => fragWeights[t] > 0)
  const rarityWeights = getRarityWeightsByStars(gs.starsCollected)
  const buffLabels = getBuffLabels()

  const result: MasteryOfferItem[] = []
  const usedCardIds = new Set<string>()
  const usedFragmentTypes = new Set<MasteryPickupType>()
  let remainingCards = allowedCards.slice()

  const addCard = (): boolean => {
    const pool = remainingCards.filter(c => !usedCardIds.has(c.id))
    if (pool.length === 0) return false
    const card = weightedRarityPick(pool, rarityWeights)
    if (!card) return false
    result.push({ kind: 'card', card })
    usedCardIds.add(card.id)
    const idx = remainingCards.findIndex(c => c.id === card.id)
    if (idx >= 0) remainingCards.splice(idx, 1)
    return true
  }

  const addFragment = (type: MasteryPickupType) => {
    const label = (type === 'count' || type === 'damage')
      ? `${buffLabels[type]}（${skillName}）`
      : buffLabels[type]
    result.push({ kind: 'fragment', buff: { type, label, skillId: gs.masterySkillId } })
    usedFragmentTypes.add(type)
  }

  const minCards = MASTERY_PICK.minSkillCardsInOffer ?? 0
  if (minCards > 0 && allowedCards.length > 0) {
    for (let i = 0; i < minCards && result.length < 3; i++) {
      if (!addCard()) break
    }
  }

  while (result.length < 3) {
    const wantCard = Math.random() < MASTERY_PICK.skillCardRatio
    const canCard = remainingCards.some(c => !usedCardIds.has(c.id))
    const availableFragTypes = fragTypes.filter(t => !usedFragmentTypes.has(t))

    if (wantCard && canCard && addCard()) continue
    if (availableFragTypes.length > 0) {
      const type = pickFragmentType(fragWeights, availableFragTypes)
      addFragment(type)
      continue
    }
    if (canCard && addCard()) continue
    addFragment(fragTypes[Math.floor(Math.random() * fragTypes.length)]!)
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/** 將選中的技能卡放入唯一卡槽 */
export function placeMasteryCard(gs: MasteryGameState, card: CardDefinition): boolean {
  if (gs.slot.skillId !== card.skillId) return false
  const items = gs.slot.items
  const count = items.filter((i): i is SlotItem & { kind: 'card' } => i.kind === 'card' && i.card.id === card.id).length
  if (count >= getCardMaxCount(card.id)) return false
  items.push({ kind: 'card', card })
  return true
}

/** 將選中的強化碎片放入唯一卡槽 */
export function placeMasteryBuff(gs: MasteryGameState, buff: BuffCard): void {
  gs.slot.items.push({ kind: 'buff', buff })
}

/** 套用選中的候選（卡或碎片） */
export function applyMasteryOfferItem(gs: MasteryGameState, item: MasteryOfferItem): boolean {
  if (item.kind === 'card') return placeMasteryCard(gs, item.card)
  placeMasteryBuff(gs, item.buff)
  return true
}

// ── 紀錄 ──

export function loadMasteryBestRecord(): MasteryBestRecord | null {
  try {
    const raw = localStorage.getItem(BEST_RECORD_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MasteryBestRecord
  } catch {
    return null
  }
}

export function saveMasteryBestRecord(gs: MasteryGameState) {
  const record: MasteryBestRecord = {
    score: gs.score.score,
    kills: gs.score.totalKills,
    survivalTime: gs.score.survivalTime,
    starsCollected: gs.starsCollected,
    date: new Date().toISOString(),
  }
  const existing = loadMasteryBestRecord()
  if (!existing || record.score > existing.score) {
    localStorage.setItem(BEST_RECORD_KEY, JSON.stringify(record))
  }
}
