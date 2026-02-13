import type { CardDefinition, CardRarity } from './cards'

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

/** 單一卡槽 */
export interface CardSlot {
  skillId: string | null
  cards: CardDefinition[]
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

// ── 常數 ──

const INITIAL_KILL_TARGET = 4
const KILL_TARGET_MULTIPLIER = 2
const HP_RECOVERY_RATIO = 0.2
const STREAK_WINDOW_MS = 2000
const STREAK_BONUS_PER = 0.1
const STREAK_BONUS_CAP = 2.0
const KILL_BASE_SCORE = 10
const WAVE_BONUS_PER = 100
const SURVIVAL_SCORE_PER_SEC = 2
const BEST_RECORD_KEY = 'card-survivor-infinite-best'

/** Walker 基礎數值 */
export const WALKER_BASE = {
  hp: 20,
  speed: 60,
  damage: 5,
  size: 14,
  color: '#EF5350',
}

/** 畫面敵人上限 */
export const MAX_ENEMIES = 30

// ── 工廠函式 ──

/** 建立初始狀態 */
export function createInfiniteState(): InfiniteGameState {
  return {
    phase: 'INITIAL_PICK',
    wave: { waveNumber: 0, killTarget: INITIAL_KILL_TARGET, killCount: 0 },
    score: { totalKills: 0, score: 0, killScore: 0, waveBonus: 0, survivalTime: 0, killStreak: 0, lastKillTime: 0 },
    slots: [
      { skillId: null, cards: [] },
      { skillId: null, cards: [] },
      { skillId: null, cards: [] },
    ],
    playerHp: 100,
    playerMaxHp: 100,
    invincibleUntil: 0,
    gameStartTime: 0,
  }
}

// ── 波次計算 ──

/** 取得波次擊殺目標 */
export function getKillTarget(waveNumber: number): number {
  if (waveNumber <= 0) return INITIAL_KILL_TARGET
  return INITIAL_KILL_TARGET * Math.pow(KILL_TARGET_MULTIPLIER, waveNumber - 1)
}

/** 取得敵人數值（隨波次成長） */
export function getWaveEnemyStats(waveNumber: number) {
  const w = Math.max(0, waveNumber - 1)
  return {
    hp: Math.round(WALKER_BASE.hp * (1 + 0.15 * w)),
    speed: Math.min(WALKER_BASE.speed * 2, WALKER_BASE.speed * (1 + 0.05 * w)),
    damage: Math.round(WALKER_BASE.damage * (1 + 0.10 * w)),
    size: WALKER_BASE.size,
    color: WALKER_BASE.color,
  }
}

/** 取得生成間隔（秒），等比遞減讓後期更快 */
export function getSpawnInterval(waveNumber: number): number {
  // 1.5s × 0.82^(wave-1)，最小 0.25s
  return Math.max(0.25, 1.5 * Math.pow(0.82, waveNumber - 1))
}

/** 每次生成幾隻敵人（wave 4+ 開始一次生 2 隻，wave 7+ 生 3 隻） */
export function getSpawnBatchSize(waveNumber: number): number {
  if (waveNumber >= 7) return 3
  if (waveNumber >= 4) return 2
  return 1
}

// ── 擊殺與計分 ──

/** 處理擊殺事件，回傳是否達成波次目標 */
export function handleKill(gs: InfiniteGameState): boolean {
  const now = performance.now()
  gs.wave.killCount++
  gs.score.totalKills++

  // 連殺
  if (now - gs.score.lastKillTime < STREAK_WINDOW_MS) {
    gs.score.killStreak++
  } else {
    gs.score.killStreak = 1
  }
  gs.score.lastKillTime = now

  const streakMul = Math.min(STREAK_BONUS_CAP, 1 + (gs.score.killStreak - 1) * STREAK_BONUS_PER)
  const killPts = Math.round(KILL_BASE_SCORE * streakMul)
  gs.score.killScore += killPts
  gs.score.score += killPts

  // 達標？
  return gs.wave.killCount >= gs.wave.killTarget
}

/** 波次結算：回血 + 準備下一波 */
export function advanceWave(gs: InfiniteGameState) {
  // 波次獎勵
  const bonus = WAVE_BONUS_PER * gs.wave.waveNumber
  gs.score.waveBonus += bonus
  gs.score.score += bonus

  // 回血
  gs.playerHp = Math.min(gs.playerMaxHp, gs.playerHp + gs.playerMaxHp * HP_RECOVERY_RATIO)

  // 下一波
  gs.wave.waveNumber++
  gs.wave.killTarget = getKillTarget(gs.wave.waveNumber)
  gs.wave.killCount = 0
}

/** 更新存活時間分數（每幀呼叫） */
export function updateSurvivalScore(gs: InfiniteGameState, dt: number) {
  gs.score.survivalTime += dt
  const timePts = Math.floor(dt * SURVIVAL_SCORE_PER_SEC)
  if (timePts > 0) gs.score.score += timePts
}

// ── 抽卡邏輯 ──

/** 取得波次對應的稀有度權重 */
function getRarityWeights(waveNumber: number): Record<CardRarity, number> {
  if (waveNumber <= 2) return { bronze: 0.80, silver: 0.20, gold: 0 }
  if (waveNumber <= 4) return { bronze: 0.60, silver: 0.35, gold: 0.05 }
  if (waveNumber <= 6) return { bronze: 0.40, silver: 0.45, gold: 0.15 }
  return { bronze: 0.25, silver: 0.50, gold: 0.25 }
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
  const weights = getRarityWeights(gs.wave.waveNumber)
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
    // 卡槽已滿：只從鎖定的 3 種技能抽
    const lockedCards = allCards.filter(c => lockedSkills.includes(c.skillId))
    const remaining = [...lockedCards]
    while (result.length < 3 && remaining.length > 0) {
      const card = weightedPick(remaining, weights)
      if (!card) break
      if (!result.some(r => r.id === card.id)) {
        result.push(card)
      }
      const idx = remaining.findIndex(c => c.id === card.id)
      if (idx >= 0) remaining.splice(idx, 1)
    }
  }

  return result
}

/** 選擇卡片放入卡槽 */
export function placeCard(gs: InfiniteGameState, card: CardDefinition): boolean {
  // 已有此技能的卡槽？
  const existing = gs.slots.find(s => s.skillId === card.skillId)
  if (existing) {
    existing.cards.push(card)
    return true
  }

  // 空卡槽？
  const empty = gs.slots.find(s => s.skillId === null)
  if (empty) {
    empty.skillId = card.skillId
    empty.cards.push(card)
    return true
  }

  // 沒有可放的槽（不應發生）
  return false
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
