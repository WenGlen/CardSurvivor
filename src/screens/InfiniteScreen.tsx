import { useEffect, useRef, useCallback, useState } from 'react'
import { GameEngine } from '../models/GameEngine'
import type { GameModeConfig } from '../models/GameEngine'
import { allSkills } from '../models/skills'
import {
  iceArrowCards,
  iceSpikeCards,
  fireballCards,
  beamCards,
  rarityHexColors,
  rarityNames,
} from '../models/cards'
import {
  computeIceArrowSnapshotFromSequence,
  computeIceSpikeSnapshotFromSequence,
  computeFireballSnapshotFromSequence,
  computeBeamSnapshotFromSequence,
} from '../models/infiniteSnapshot'
import { getSlotStatusLines, getSkillIcon } from '../models/skillStatus'
import type { CardDefinition } from '../models/cards'
import { drawGame } from '../rendering/drawFunctions'
import type { HudConfig } from '../rendering/drawFunctions'
import { getBuffLabels } from '../config'
import {
  createInfiniteState,
  generateCardOffer,
  placeCard,
  handleKill,
  advanceWave,
  updateSurvivalScore,
  getWaveEnemyStats,
  getSpawnInterval,
  getSpawnBatchSize,
  saveBestRecord,
  loadBestRecord,
  getValidTargetSlotsForPickup,
  MAX_ENEMIES,
} from '../models/InfiniteGameLogic'
import type { InfiniteGameState, GamePhase, BestRecord } from '../models/InfiniteGameLogic'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

/** 所有卡片合集 */
const allCards: CardDefinition[] = [
  ...iceArrowCards,
  ...iceSpikeCards,
  ...fireballCards,
  ...beamCards,
]

/** 套用所有卡槽快照到引擎（從 slot.items 依序計算，順序影響效果） */
function applyAllSnapshotsWithBuffs(engine: GameEngine, gs: InfiniteGameState) {
  for (const slot of gs.slots) {
    if (!slot.skillId) continue
    const hasCards = slot.items.some(i => i.kind === 'card')
    if (!hasCards) continue

    switch (slot.skillId) {
      case 'ice-arrow':
        engine.setIceArrowSnapshot(computeIceArrowSnapshotFromSequence(slot.items))
        break
      case 'ice-spike':
        engine.setIceSpikeSnapshot(computeIceSpikeSnapshotFromSequence(slot.items))
        break
      case 'fireball':
        engine.setFireballSnapshot(computeFireballSnapshotFromSequence(slot.items))
        break
      case 'beam':
        engine.setBeamSnapshot(computeBeamSnapshotFromSequence(slot.items))
        break
    }
  }
}

/** 無限模式畫面 */
export default function InfiniteScreen({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const gsRef = useRef<InfiniteGameState>(createInfiniteState())
  const spawnTimerRef = useRef(0)

  const [phase, setPhase] = useState<GamePhase>('INITIAL_PICK')
  const [cardOffer, setCardOffer] = useState<CardDefinition[]>([])
  const [, forceRender] = useState(0)
  const [gameOverState, setGameOverState] = useState<{ gs: InfiniteGameState; best: BestRecord | null } | null>(null)
  const [paused, setPaused] = useState(false)

  const triggerRender = useCallback(() => {
    forceRender((n) => n + 1)
  }, [])

  /** 拾取強化碎片：buff 加入 targetSlotIndex 對應卡槽的 items 序列 */
  const onPickupCollected = useCallback((type: 'cooldown' | 'range' | 'count', targetSlotIndex: number) => {
    const gs = gsRef.current
    const engine = engineRef.current
    if (!engine) return

    const slot = gs.slots[targetSlotIndex]
    if (!slot?.skillId) return

    const buffLabel = getBuffLabels()
    const skillName = allSkills.find(s => s.id === slot.skillId)?.name ?? slot.skillId ?? ''
    const label = type === 'count' ? `${buffLabel.count}（${skillName}）` : buffLabel[type]
    slot.items.push({ kind: 'buff', buff: { type, label, skillId: slot.skillId } })

    applyAllSnapshotsWithBuffs(engine, gs)
    triggerRender()
  }, [triggerRender])

  /** 生成 pickup 時解析目標卡槽（隨機選一個有效槽位） */
  const resolvePickupTarget = useCallback((type: 'cooldown' | 'range' | 'count'): number | null => {
    const gs = gsRef.current
    const valid = getValidTargetSlotsForPickup(gs, type)
    if (valid.length === 0) return null
    return valid[Math.floor(Math.random() * valid.length)]!
  }, [])

  /** 擊殺回呼 */
  const onEnemyKilled = useCallback(() => {
    const gs = gsRef.current
    if (gs.phase !== 'BATTLE') return

    const waveComplete = handleKill(gs)
    if (waveComplete) {
      // 波次結算（回血 + 準備下波）
      advanceWave(gs)
      // 暫停引擎，直接進入選卡（不重置場景、不移動玩家）
      engineRef.current?.pause()
      gs.phase = 'CARD_PICK'
      setPhase('CARD_PICK')
      const offer = generateCardOffer(gs, allCards)
      setCardOffer(offer)
    }
  }, [])

  /** 初始化引擎 */
  useEffect(() => {
    const modeConfig: GameModeConfig = {
      removeDeadEnemies: true,
      enableEnemyAI: true,
      enablePlayerDamage: true,
      contactDamage: 5,
      fireAllEquippedSkills: true,
      noInitialEnemies: true,
      onEnemyKilled: onEnemyKilled,
      enableMapPickups: true,
      resolvePickupTarget,
      onPickupCollected,
    }

    const engine = new GameEngine(CANVAS_WIDTH, CANVAS_HEIGHT, triggerRender, modeConfig)
    allSkills.forEach((s) => engine.registerSkill(s))
    engineRef.current = engine
    engine.start()

    // 產生初始抽卡
    const gs = gsRef.current
    const offer = generateCardOffer(gs, allCards, true)
    setCardOffer(offer)

    return () => engine.stop()
  }, [triggerRender, onEnemyKilled, onPickupCollected, resolvePickupTarget])

  /** 暫停/繼續切換 */
  const togglePause = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const gs = gsRef.current
    if (gs.phase !== 'BATTLE') return

    if (engine.isPaused) {
      engine.resume()
      setPaused(false)
    } else {
      engine.pause()
      setPaused(true)
    }
  }, [])

  // 鍵盤事件
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        togglePause()
        return
      }
      engineRef.current?.keyDown(e.key)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => engineRef.current?.keyUp(e.key)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [togglePause])

  // 遊戲主迴圈更新（生成敵人、波次切換、Game Over 偵測）
  useEffect(() => {
    const gs = gsRef.current
    const engine = engineRef.current
    if (!engine) return

    let raf = 0
    let lastFrameTime = performance.now()

    const gameLoop = () => {
      const now = performance.now()
      const dt = (now - lastFrameTime) / 1000
      lastFrameTime = now

      if (gs.phase === 'BATTLE' && !engine.isPaused) {
        // 更新存活時間
        updateSurvivalScore(gs, dt)

        // 生成敵人
        spawnTimerRef.current += dt
        const interval = getSpawnInterval(gs.wave.waveNumber)
        if (spawnTimerRef.current >= interval && engine.state.enemies.length < MAX_ENEMIES) {
          spawnTimerRef.current = 0
          const stats = getWaveEnemyStats(gs.wave.waveNumber)
          const batch = getSpawnBatchSize(gs.wave.waveNumber)
          for (let b = 0; b < batch && engine.state.enemies.length < MAX_ENEMIES; b++) {
            engine.spawnEnemyAtEdge(stats)
          }
        }

        // 同步 HP 到引擎（接觸傷害由引擎計算）
        gs.playerHp = engine.state.player.hp

        // Game Over 偵測
        if (gs.playerHp <= 0) {
          gs.phase = 'GAME_OVER'
          setPhase('GAME_OVER')
          engine.stop()
          saveBestRecord(gs)
          setGameOverState({ gs: { ...gs, score: { ...gs.score } }, best: loadBestRecord() })
          return
        }
      }

      raf = requestAnimationFrame(gameLoop)
    }

    raf = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // Canvas 繪製
  useEffect(() => {
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gs = gsRef.current
    const hud: HudConfig | undefined = gs.phase === 'BATTLE'
      ? {
          playerHp: gs.playerHp,
          playerMaxHp: gs.playerMaxHp,
          waveNumber: gs.wave.waveNumber,
          score: gs.score.score,
          killCount: gs.wave.killCount,
          waveTarget: gs.wave.killTarget,
          killStreak: gs.score.killStreak,
          survivalTime: gs.score.survivalTime,
          invincibleUntil: engine.state.invincibleUntil,
        }
      : undefined

    drawGame(ctx, engine.state, hud)
  })

  /** 選擇卡片 */
  const handlePickCard = (card: CardDefinition) => {
    const gs = gsRef.current
    const engine = engineRef.current
    if (!engine) return

    placeCard(gs, card)

    // 同步所有卡槽的快照到引擎（含強化碎片加成）
    applyAllSnapshotsWithBuffs(engine, gs)

    if (gs.phase === 'INITIAL_PICK') {
      // 初始抽卡完成 → 進入 Wave 1
      gs.phase = 'BATTLE'
      gs.wave.waveNumber = 1
      gs.gameStartTime = performance.now()
      setPhase('BATTLE')
      spawnTimerRef.current = 0

      // 設定玩家 HP
      engine.state.player.hp = gs.playerMaxHp
      engine.resume()
    } else {
      // 一般抽卡 → 進入戰鬥
      gs.phase = 'BATTLE'
      setPhase('BATTLE')
      spawnTimerRef.current = 0

      // 回復 HP 同步到引擎
      engine.state.player.hp = gs.playerHp
      engine.resume()
    }

    setCardOffer([])
  }

  /** 重新開始 */
  const handleRestart = () => {
    gsRef.current = createInfiniteState()
    const gs = gsRef.current

    // 停止舊引擎
    engineRef.current?.stop()

    // 建立新引擎
    const modeConfig: GameModeConfig = {
      removeDeadEnemies: true,
      enableEnemyAI: true,
      enablePlayerDamage: true,
      contactDamage: 5,
      fireAllEquippedSkills: true,
      noInitialEnemies: true,
      onEnemyKilled: onEnemyKilled,
      enableMapPickups: true,
      resolvePickupTarget,
      onPickupCollected,
    }
    const engine = new GameEngine(CANVAS_WIDTH, CANVAS_HEIGHT, triggerRender, modeConfig)
    allSkills.forEach((s) => engine.registerSkill(s))
    engineRef.current = engine
    engine.start()

    // 產生初始抽卡
    const offer = generateCardOffer(gs, allCards, true)
    setCardOffer(offer)
    setPhase('INITIAL_PICK')
    setGameOverState(null)
  }

  const gs = gsRef.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 16, fontFamily: 'monospace', color: '#e0e0e0' }}>
      {/* 頂部資訊列 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <button onClick={onExit} style={btnStyle}>← 返回</button>
        <span style={{ fontSize: 18, fontWeight: 'bold' }}>無限模式</span>
        {(gs.phase === 'BATTLE' || paused) && (
          <>
            <span>Wave {gs.wave.waveNumber} | 分數 {gs.score.score} | 擊殺 {gs.wave.killCount}/{gs.wave.killTarget}</span>
            <button onClick={togglePause} style={btnStyle}>
              {paused ? '▶ 繼續' : '⏸ 暫停'}
            </button>
          </>
        )}
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{ border: '2px solid #333', borderRadius: 8, display: 'block' }}
        />

        {/* INITIAL_PICK overlay */}
        {phase === 'INITIAL_PICK' && (
          <CardPickOverlay
            title="選擇起始技能"
            subtitle="選擇一張銅卡開始冒險"
            cards={cardOffer}
            onPick={handlePickCard}
            slots={gs.slots}
          />
        )}

        {/* CARD_PICK overlay */}
        {phase === 'CARD_PICK' && (
          <CardPickOverlay
            title={`Wave ${gs.wave.waveNumber} — 選擇強化`}
            subtitle={`下一波需要擊殺 ${gs.wave.killTarget} 隻敵人`}
            cards={cardOffer}
            onPick={handlePickCard}
            slots={gs.slots}
          />
        )}

        {/* PAUSED overlay */}
        {paused && (
          <div style={overlayStyle}>
            <div style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 12 }}>⏸ 暫停</div>
            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 24 }}>按 ESC 或點擊繼續</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={togglePause} style={{ ...btnStyle, background: '#4CAF50', fontSize: 16, padding: '10px 24px' }}>
                繼續遊戲
              </button>
              <button onClick={onExit} style={{ ...btnStyle, fontSize: 16, padding: '10px 24px' }}>
                返回選單
              </button>
            </div>
          </div>
        )}

        {/* GAME_OVER overlay */}
        {phase === 'GAME_OVER' && gameOverState && (
          <GameOverOverlay
            gs={gameOverState.gs}
            best={gameOverState.best}
            onRestart={handleRestart}
            onExit={onExit}
          />
        )}
      </div>

      {/* 底部卡槽預覽（疊卡樣式）+ 冷卻倒數；狀態摘要置於卡槽右側 */}
      {(phase === 'BATTLE' || phase === 'CARD_PICK') && (
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {gs.slots.map((slot, i) => {
            const engine = engineRef.current
            const skill = slot.skillId ? allSkills.find(s => s.id === slot.skillId) : null
            const remaining = (slot.skillId && engine) ? (engine.state.skillCooldowns.get(slot.skillId) ?? 0) : 0
            const total = (slot.skillId && skill && engine) ? engine.getCooldownForSkill(slot.skillId, skill) : 1
            const ratio = Math.max(0, Math.min(1, remaining / total))
            const isReady = remaining <= 0 && !!slot.skillId
            const pct = Math.round((1 - ratio) * 360)

            const borderColor = !slot.skillId ? '#333'
              : isReady ? '#4CAF50'
              : '#555'
            const borderImg = (slot.skillId && !isReady)
              ? `conic-gradient(#FFB74D ${pct}deg, #333 ${pct}deg)`
              : undefined

            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 220, minHeight: 100, position: 'relative',
                  padding: 4, borderRadius: 10,
                  background: borderImg ?? borderColor,
                }}>
                  <div style={{
                    borderRadius: 7, minHeight: 92,
                    background: slot.skillId ? '#1a1a2e' : '#15152a',
                    position: 'relative', overflow: 'hidden',
                  }}>
                  {/* 技能名稱 + 冷卻 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                    borderBottom: slot.items.length > 0 ? '1px solid #333' : undefined,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', flex: 1, color: '#ccc', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {slot.skillId && <span style={{ fontSize: 14 }}>{getSkillIcon(slot.skillId)}</span>}
                      {slot.skillId ? (skill?.name ?? slot.skillId) : `卡槽 ${i + 1}`}
                    </div>
                    {slot.skillId && (
                      <span style={{
                        fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace',
                        color: isReady ? '#4CAF50' : '#FFB74D',
                      }}>
                        {isReady ? 'READY' : remaining.toFixed(1) + 's'}
                      </span>
                    )}
                  </div>

                  {/* 疊卡：一般卡片 + 強化碎片卡，標題在上，最上一張多顯示說明 */}
                  {slot.items.length > 0 ? (
                    <div style={{
                      padding: 6, position: 'relative',
                      display: 'flex', flexDirection: 'column', gap: 0,
                    }}>
                      {slot.items.map((item, j) => {
                        const isTop = j === slot.items.length - 1
                        if (item.kind === 'card') {
                          const c = item.card
                          return (
                            <div
                              key={'c-' + j}
                              style={{
                                marginTop: j === 0 ? 0 : -20,
                                padding: isTop ? '8px 10px 10px' : '6px 10px 8px',
                                paddingBottom: isTop ? 10 : 14,
                                borderRadius: 4,
                                background: `linear-gradient(to bottom, ${rarityHexColors[c.rarity]}28, ${rarityHexColors[c.rarity]}10)`,
                                border: `1px solid ${rarityHexColors[c.rarity]}55`,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                zIndex: j,
                              }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 'bold', color: rarityHexColors[c.rarity] }}>
                                {c.name}
                              </div>
                              {isTop && (
                                <div style={{ fontSize: 10, color: '#999', lineHeight: 1.4, marginTop: 6 }}>
                                  {c.description}
                                </div>
                              )}
                            </div>
                          )
                        }
                        const b = item.buff
                        const buffColors = { cooldown: '#4FC3F7', range: '#81C784', count: '#FFB74D' }
                        const color = buffColors[b.type]
                        return (
                          <div
                            key={'b-' + j}
                            style={{
                              marginTop: j === 0 ? 0 : -20,
                              padding: isTop ? '8px 10px 10px' : '6px 10px 8px',
                              paddingBottom: isTop ? 10 : 14,
                              borderRadius: 4,
                              background: `linear-gradient(to bottom, ${color}28, ${color}10)`,
                              border: `1px solid ${color}55`,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              zIndex: j,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 'bold', color }}>
                              {b.label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: 16, fontSize: 11, color: '#555', textAlign: 'center' }}>
                      空
                    </div>
                  )}
                </div>
              </div>

              {/* 技能狀態摘要：置於卡槽右側，冷卻/範圍＋效果標籤 */}
              {slot.skillId && (
                <div style={{
                  minWidth: 140, padding: '6px 10px 8px',
                  background: '#15152a',
                  borderRadius: 6,
                  border: '1px solid #333',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#aaa',
                  lineHeight: 1.4,
                }}>
                  {getSlotStatusLines(slot.skillId, slot.items).map((line, k) => (
                    <div key={k} title={line}>{line}</div>
                  ))}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 子元件 ──

/** 卡片選擇 overlay */
function CardPickOverlay({ title, subtitle, cards, onPick, slots }: {
  title: string
  subtitle: string
  cards: CardDefinition[]
  onPick: (card: CardDefinition) => void
  slots: InfiniteGameState['slots']
}) {
  return (
    <div style={overlayStyle}>
      <div style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>{subtitle}</div>

      <div style={{ display: 'flex', gap: 16 }}>
        {cards.map((card) => {
          const skill = allSkills.find(s => s.id === card.skillId)
          const existingSlot = slots.find(s => s.skillId === card.skillId)
          const isNewSkill = !existingSlot && slots.some(s => s.skillId === null)

          return (
            <div
              key={card.id}
              onClick={() => onPick(card)}
              style={{
                width: 200, padding: 16, borderRadius: 12, cursor: 'pointer',
                background: '#2a2a3e', border: `2px solid ${rarityHexColors[card.rarity]}`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = `0 8px 24px ${rarityHexColors[card.rarity]}44`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: rarityHexColors[card.rarity], fontWeight: 'bold' }}>
                  {rarityNames[card.rarity]}
                </span>
                {isNewSkill && (
                  <span style={{ fontSize: 10, color: '#4CAF50', fontWeight: 'bold' }}>新技能</span>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>{card.name}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{getSkillIcon(card.skillId)}</span>
                {skill?.name ?? card.skillId}
              </div>
              <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.4 }}>{card.description}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Game Over overlay */
function GameOverOverlay({ gs, best, onRestart, onExit }: {
  gs: InfiniteGameState
  best: BestRecord | null
  onRestart: () => void
  onExit: () => void
}) {
  const minutes = Math.floor(gs.score.survivalTime / 60)
  const seconds = Math.floor(gs.score.survivalTime % 60)

  return (
    <div style={overlayStyle}>
      <div style={{ fontSize: 36, fontWeight: 'bold', color: '#EF5350', marginBottom: 12 }}>
        GAME OVER
      </div>

      <div style={{
        background: '#1a1a2e', borderRadius: 12, padding: 20, width: 320,
        border: '1px solid #444',
      }}>
        <div style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>
          分數：{gs.score.score}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
          <span style={{ color: '#aaa' }}>到達波次</span>
          <span style={{ textAlign: 'right' }}>Wave {gs.wave.waveNumber}</span>
          <span style={{ color: '#aaa' }}>總擊殺</span>
          <span style={{ textAlign: 'right' }}>{gs.score.totalKills}</span>
          <span style={{ color: '#aaa' }}>存活時間</span>
          <span style={{ textAlign: 'right' }}>{minutes}:{seconds.toString().padStart(2, '0')}</span>
          <span style={{ color: '#aaa' }}>擊殺分</span>
          <span style={{ textAlign: 'right' }}>{gs.score.killScore}</span>
          <span style={{ color: '#aaa' }}>波次獎勵</span>
          <span style={{ textAlign: 'right' }}>{gs.score.waveBonus}</span>
        </div>

        {best && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #333' }}>
            <div style={{ fontSize: 12, color: '#FFD700', fontWeight: 'bold', marginBottom: 6 }}>
              最佳紀錄
            </div>
            <div style={{ fontSize: 13, color: '#aaa' }}>
              分數 {best.score} · Wave {best.wave} · {best.kills} 殺
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={onRestart} style={{ ...btnStyle, background: '#4CAF50', fontSize: 16, padding: '10px 24px' }}>
          再來一局
        </button>
        <button onClick={onExit} style={{ ...btnStyle, fontSize: 16, padding: '10px 24px' }}>
          返回
        </button>
      </div>
    </div>
  )
}

// ── 樣式 ──

const overlayStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.8)', borderRadius: 8,
}

const btnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: 'none', borderRadius: 6,
  padding: '6px 16px', cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
}
