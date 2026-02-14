import type { CardDefinition, CardRarity } from './cards'
import {
  WAVE,
  WAVE_CLEAR,
  ENEMY_BASE as ENEMY_BASE_CONFIG,
  ENEMY_SCALING,
  SPAWN,
  SCORE,
  MAX_ENEMIES,
  getRarityWeights,
} from '../config'

// ── 型別定義 ──

/** 遊戲階段 */
export type GamePhase = 'INITIAL_PICK' | 'BATTLE' | 'WAVE_CLEAR' | 'CARD_PICK' | 'GAME_OVER'

/** 波次狀態 */
export interface WaveState {
  waveNumber: number
  killTarget: number
  killCount: number
}

/** 計分狀態 */
export interface ScoreState {
  totalKills: number
  score: number
  killScore: number
  waveBonus: number
  survivalTime: number
  killStreak: number
  lastKillTime: number
}

/** 強化碎片卡（拾取後疊在卡槽上，順序影響技能快照） */
export interface BuffCard {
  type: 'cooldown' | 'range' | 'count'
  label: string
  skillId?: string
}

/** 卡槽單一項目：一般卡片或強化碎片，按獲得順序排列 */
export type SlotItem =
  | { kind: 'card'; card: CardDefinition }
  | { kind: 'buff'; buff: BuffCard }

/** 單一卡槽：items 為統一序列（卡片+強化碎片），順序影響快照計算 */
export interface CardSlot {
  skillId: string | null
  /** 一般卡片與強化碎片按獲得順序混合，如：先數量碎片再分裂卡 vs 先分裂卡再數量碎片 效果不同 */
  items: SlotItem[]
}

/** 無限模式完整狀態 */
export interface InfiniteGameState {
  phase: GamePhase
  wave: WaveState
  score: ScoreState
  slots: [CardSlot, CardSlot, CardSlot]
  playerHp: number
  playerMaxHp: number
  invincibleUntil: number
  gameStartTime: number
}

/** localStorage 最佳紀錄 */
export interface BestRecord {
  score: number
  wave: number
  kills: number
  survivalTime: number
  date: string
}

// ── 常數（來自 config/infinite.config）──

const BEST_RECORD_KEY = 'card-survivor-infinite-best'

/** Walker 基礎數值（對外匯出，GameEngine 等會引用） */
export const WALKER_BASE = ENEMY_BASE_CONFIG

/** 畫面敵人上限（來自 config） */
export { MAX_ENEMIES }

// ── 工廠函式 ──

/** 建立初始狀態 */
export function createInfiniteState(): InfiniteGameState {
  return {
    phase: 'INITIAL_PICK',
    wave: { waveNumber: 0, killTarget: WAVE.initialKillTarget, killCount: 0 },
    score: { totalKills: 0, score: 0, killScore: 0, waveBonus: 0, survivalTime: 0, killStreak: 0, lastKillTime: 0 },
    slots: [
      { skillId: null, items: [] },
      { skillId: null, items: [] },
      { skillId: null, items: [] },
    ],
    playerHp: 100,
    playerMaxHp: 100,
    invincibleUntil: 0,
    gameStartTime: 0,
  }
}

// ── 波次計算 ──

/** 取得波次擊殺目標（四捨五入為整數，killTargetMultiplier 可為小數如 1.5） */
export function getKillTarget(waveNumber: number): number {
  if (waveNumber <= 0) return WAVE.initialKillTarget
  return Math.round(WAVE.initialKillTarget * Math.pow(WAVE.killTargetMultiplier, waveNumber - 1))
}

/** 取得敵人數值（隨波次成長） */
export function getWaveEnemyStats(waveNumber: number) {
  const w = Math.max(0, waveNumber - 1)
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

/** 取得生成間隔（秒），等比遞減讓後期更快 */
export function getSpawnInterval(waveNumber: number): number {
  return Math.max(
    SPAWN.minInterval,
    SPAWN.baseInterval * Math.pow(SPAWN.intervalDecayPerWave, waveNumber - 1),
  )
}

/** 每次生成幾隻敵人 */
export function getSpawnBatchSize(waveNumber: number): number {
  if (waveNumber >= SPAWN.batchWaveThreshold7) return SPAWN.batchSizeWave7
  if (waveNumber >= SPAWN.batchWaveThreshold4) return SPAWN.batchSizeWave4
  return 1
}

// ── 擊殺與計分 ──

/** 處理擊殺事件，回傳是否達成波次目標 */
export function handleKill(gs: InfiniteGameState): boolean {
  const now = performance.now()
  gs.wave.killCount++
  gs.score.totalKills++

  // 連殺
  if (now - gs.score.lastKillTime < SCORE.streakWindowMs) {
    gs.score.killStreak++
  } else {
    gs.score.killStreak = 1
  }
  gs.score.lastKillTime = now

  const streakMul = Math.min(SCORE.streakBonusCap, 1 + (gs.score.killStreak - 1) * SCORE.streakBonusPerKill)
  const killPts = Math.round(SCORE.killBase * streakMul)
  gs.score.killScore += killPts
  gs.score.score += killPts

  // 達標？
  return gs.wave.killCount >= gs.wave.killTarget
}

/** 波次結算：回血 + 準備下一波 */
export function advanceWave(gs: InfiniteGameState) {
  // 波次獎勵
  const bonus = SCORE.waveBonusPer * gs.wave.waveNumber
  gs.score.waveBonus += bonus
  gs.score.score += bonus

  // 回血
  gs.playerHp = Math.min(gs.playerMaxHp, gs.playerHp + gs.playerMaxHp * WAVE_CLEAR.hpRecoveryRatio)

  // 下一波
  gs.wave.waveNumber++
  gs.wave.killTarget = getKillTarget(gs.wave.waveNumber)
  gs.wave.killCount = 0
}

/** 更新存活時間分數（每幀呼叫） */
export function updateSurvivalScore(gs: InfiniteGameState, dt: number) {
  gs.score.survivalTime += dt
  const timePts = Math.floor(dt * SCORE.survivalPerSecond)
  if (timePts > 0) gs.score.score += timePts
}

// ── 抽卡邏輯 ──

/** 取得波次對應的稀有度權重（委派給 config） */
function getRarityWeightsForWave(waveNumber: number): Record<CardRarity, number> {
  return getRarityWeights(waveNumber)
}

/** 依權重隨機選一張卡 */
function weightedPick(cards: CardDefinition[], weights: Record<CardRarity, number>): CardDefinition | null {
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

/**
 * 生成三選一候選卡片
 * @param gs 遊戲狀態
 * @param allCards 所有卡片定義
 * @param isInitial 是否為初始抽卡（只出銅卡、不同技能）
 */
export function generateCardOffer(
  gs: InfiniteGameState,
  allCards: CardDefinition[],
  isInitial = false,
): CardDefinition[] {
  if (isInitial) {
    // 初始抽卡：3 張不同技能的銅卡
    const bronzeCards = allCards.filter(c => c.rarity === 'bronze')
    const skillIds = [...new Set(bronzeCards.map(c => c.skillId))]
    const shuffled = skillIds.sort(() => Math.random() - 0.5)
    const picked: CardDefinition[] = []
    for (const sid of shuffled) {
      if (picked.length >= 3) break
      const pool = bronzeCards.filter(c => c.skillId === sid)
      if (pool.length > 0) {
        picked.push(pool[Math.floor(Math.random() * pool.length)])
      }
    }
    return picked
  }

  const lockedSkills = gs.slots.filter(s => s.skillId !== null).map(s => s.skillId!)
  const hasEmptySlot = gs.slots.some(s => s.skillId === null)
  const weights = getRarityWeightsForWave(gs.wave.waveNumber)
  const result: CardDefinition[] = []

  if (hasEmptySlot) {
    // 至少 1 張來自未使用技能
    const unlockedCards = allCards.filter(c => !lockedSkills.includes(c.skillId))
    const newCard = weightedPick(unlockedCards, weights)
    if (newCard) result.push(newCard)

    // 其餘從所有可用卡片中抽取
    const remaining = [...allCards]
    while (result.length < 3 && remaining.length > 0) {
      const card = weightedPick(remaining, weights)
      if (!card) break
      // 避免同 id 重複（同技能但不同卡片 OK）
      if (!result.some(r => r.id === card.id)) {
        result.push(card)
      }
      const idx = remaining.findIndex(c => c.id === card.id)
      if (idx >= 0) remaining.splice(idx, 1)
    }
  } else {
    // 卡槽已滿：只從鎖定的技能抽，且三選一至少有兩種不同技能
    const uniqueSkills = [...new Set(lockedSkills)]
    if (uniqueSkills.length < 2) {
      // 只有一種技能時無法滿足「至少一不一樣」，直接抽三張
      const lockedCards = allCards.filter(c => lockedSkills.includes(c.skillId))
      const remaining = [...lockedCards]
      while (result.length < 3 && remaining.length > 0) {
        const card = weightedPick(remaining, weights)
        if (!card) break
        if (!result.some(r => r.id === card.id)) result.push(card)
        const idx = remaining.findIndex(c => c.id === card!.id)
        if (idx >= 0) remaining.splice(idx, 1)
      }
    } else {
      // 先確保至少 1 張來自「非主流」技能（與第一張不同的技能）
      const lockedCards = allCards.filter(c => lockedSkills.includes(c.skillId))
      const first = weightedPick(lockedCards, weights)
      if (first) {
        result.push(first)
        const otherSkillCards = lockedCards.filter(c => c.skillId !== first.skillId)
        const different = weightedPick(otherSkillCards, weights)
        if (different) result.push(different)
      }
      // 其餘補滿到 3 張
      const remaining = lockedCards.filter(c => !result.some(r => r.id === c.id))
      while (result.length < 3 && remaining.length > 0) {
        const card = weightedPick(remaining, weights)
        if (!card) break
        if (!result.some(r => r.id === card.id)) result.push(card)
        const idx = remaining.findIndex(c => c.id === card!.id)
        if (idx >= 0) remaining.splice(idx, 1)
      }
    }
  }

  return result
}

/** 選擇卡片放入卡槽（加入 items 序列尾端） */
export function placeCard(gs: InfiniteGameState, card: CardDefinition): boolean {
  const existing = gs.slots.find(s => s.skillId === card.skillId)
  if (existing) {
    existing.items.push({ kind: 'card', card })
    return true
  }

  const empty = gs.slots.find(s => s.skillId === null)
  if (empty) {
    empty.skillId = card.skillId
    empty.items.push({ kind: 'card', card })
    return true
  }

  return false
}

/** 取得 pickup 類型可套用的技能：cooldown=全部, range=冰箭以外, count=冰箭/火球/光束 */
export function getValidTargetSlotsForPickup(
  gs: InfiniteGameState,
  type: 'cooldown' | 'range' | 'count',
): number[] {
  const indices: number[] = []
  const RANGE_SKILLS = ['ice-spike', 'fireball', 'beam']
  const COUNT_SKILLS = ['ice-arrow', 'fireball', 'beam']
  gs.slots.forEach((s, i) => {
    if (!s.skillId) return
    if (type === 'cooldown') indices.push(i)
    else if (type === 'range' && RANGE_SKILLS.includes(s.skillId)) indices.push(i)
    else if (type === 'count' && COUNT_SKILLS.includes(s.skillId)) indices.push(i)
  })
  return indices
}

// ── 紀錄持久化 ──

export function loadBestRecord(): BestRecord | null {
  try {
    const raw = localStorage.getItem(BEST_RECORD_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BestRecord
  } catch {
    return null
  }
}

export function saveBestRecord(gs: InfiniteGameState) {
  const record: BestRecord = {
    score: gs.score.score,
    wave: gs.wave.waveNumber,
    kills: gs.score.totalKills,
    survivalTime: gs.score.survivalTime,
    date: new Date().toISOString(),
  }
  const existing = loadBestRecord()
  if (!existing || record.score > existing.score) {
    localStorage.setItem(BEST_RECORD_KEY, JSON.stringify(record))
  }
}
