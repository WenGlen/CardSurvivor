import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import MobileTouchControls from '../components/MobileTouchControls'
import { useIsMobile } from '../hooks/useIsMobile'
import { GameEngine } from '../models/GameEngine'
import type { GameModeConfig } from '../models/GameEngine'
import { allSkills } from '../models/skills'
import {
  iceArrowCards,
  iceSpikeCards,
  fireballCards,
  electricBallCards,
  beamCards,
  rarityHexColors,
  rarityNames,
} from '../models/cards'
import {
  computeIceArrowSnapshotFromSequence,
  computeIceSpikeSnapshotFromSequence,
  computeFireballSnapshotFromSequence,
  computeElectricBallSnapshotFromSequence,
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

/**
 * 無限模式：地圖邊界（直式 4:3 = 寬:高 = 3:4）
 * - 主角可移動範圍限制在此邊界內，與畫面上固定直式 4:3 外框一致。
 * - 之後若要改為「靠近邊界才阻擋」或調整可移動範圍，只需改這裡或由這裡推 playerBounds。
 */
const INFINITE_MAP = {
  /** 寬:高 = 3:4（直式） */
  aspectRatio: 3 / 4,
  /** 邏輯寬度（短邊），高度 = width / aspectRatio */
  width: 600,
} as const
const INFINITE_MAP_HEIGHT = Math.round(INFINITE_MAP.width / INFINITE_MAP.aspectRatio) // 800

/** Canvas 邏輯尺寸 = 地圖邊界（直式 4:3） */
const CANVAS_WIDTH = INFINITE_MAP.width
const CANVAS_HEIGHT = INFINITE_MAP_HEIGHT

/** 畫面上外框的 CSS 長寬比（直式 4:3），與地圖一致 */
const MAP_ASPECT_RATIO = '3 / 4'

/** 所有卡片合集 */
const allCards: CardDefinition[] = [
  ...iceArrowCards,
  ...iceSpikeCards,
  ...fireballCards,
  ...electricBallCards,
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
      case 'electric-ball':
        engine.setElectricBallSnapshot(computeElectricBallSnapshotFromSequence(slot.items))
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
  /** 卡槽捲動容器 ref，用於新卡加入時自動捲到底部 */
  const slotScrollRefs = useRef<(HTMLDivElement | null)[]>([])
  const prevSlotLengths = useRef<number[]>([0, 0, 0])

  const [phase, setPhase] = useState<GamePhase>('INITIAL_PICK')
  const [cardOffer, setCardOffer] = useState<CardDefinition[]>([])
  const [, forceRender] = useState(0)
  const [gameOverState, setGameOverState] = useState<{ gs: InfiniteGameState; best: BestRecord | null } | null>(null)
  const [paused, setPaused] = useState(false)
  const isMobile = useIsMobile()

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
      ...(isMobile && { enemySpeedMultiplier: 0.7 }),
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

  /** 手機模式切換時更新引擎（敵人速度） */
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.updateModeConfig({ enemySpeedMultiplier: isMobile ? 0.7 : 1 })
  }, [isMobile])

  /** 新卡加入時，該卡槽自動捲到底部（顯示最新）；使用者可往回滑看舊卡 */
  useLayoutEffect(() => {
    const gs = gsRef.current
    for (let i = 0; i < 3; i++) {
      const len = gs.slots[i]?.items.length ?? 0
      const prev = prevSlotLengths.current[i] ?? 0
      prevSlotLengths.current[i] = len
      if (len > prev) {
        const el = slotScrollRefs.current[i]
        if (el) el.scrollTop = el.scrollHeight
      }
    }
  })

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
          hideHudOverlay: true,
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

  // 手機版專用排版（圖 B）：上地圖（全寬 3:4）、下為卡槽(左2/3) + 搖桿(右1/3)
  if (isMobile) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '100dvh',
        overflow: 'hidden', fontFamily: 'monospace', color: '#e0e0e0',
        background: '#0d0d1a',
      }}>
        {/* 頂部：返回 | Card Survivor 置中 | 模式靠右 */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: '1px solid #333', background: '#0d0d1a',
        }}>
          <button onClick={onExit} style={{ ...btnStyle, padding: '6px 12px', fontSize: 12 }}>← 返回</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, color: '#aaa' }}>Card Survivor</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>無限模式</span>
        </div>

        {/* 血量、分數、關卡、擊殺進度（戰鬥時顯示，條狀＋數值） */}
        {(phase === 'BATTLE' || phase === 'CARD_PICK') && (
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
            padding: '6px 12px', fontSize: 10, background: '#15152a',
            borderBottom: '1px solid #2a2a3e', flexWrap: 'wrap',
          }}>
            {/* HP 條 + 數值 */}
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#66BB6A' }}>HP</span>
                <span style={{ color: '#66BB6A' }}>{gs.playerHp}/{gs.playerMaxHp}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(0, (gs.playerHp / gs.playerMaxHp) * 100)}%`,
                  height: '100%',
                  background: (gs.playerHp / gs.playerMaxHp) < 0.3 ? '#EF5350' : '#66BB6A',
                  borderRadius: 3,
                }} />
              </div>
            </div>
            {/* 擊殺條 + 數值 */}
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>擊殺</span>
                <span style={{ color: '#4FC3F7' }}>{gs.wave.killCount}/{gs.wave.killTarget}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, (gs.wave.killCount / Math.max(1, gs.wave.killTarget)) * 100)}%`,
                  height: '100%',
                  background: '#4FC3F7',
                  borderRadius: 3,
                }} />
              </div>
            </div>
            {/* 分數、Wave */}
            <span style={{ color: '#FFD54F', alignSelf: 'center' }}>分數: {gs.score.score.toLocaleString()}</span>
            <span style={{ alignSelf: 'center' }}>Wave {gs.wave.waveNumber}</span>
          </div>
        )}

        {/* 地圖區：全寬、直式 4:3，不預留自適應空間，外框貼齊地圖邊界 */}
        <div style={{
          flexShrink: 0,
          width: '100%',
          aspectRatio: MAP_ASPECT_RATIO,
          background: '#0d0d1a',
          border: '2px solid #333',
          boxSizing: 'border-box',
        }}>
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{
                width: '100%', height: '100%',
                objectFit: 'contain',
              }}
            />
            {phase === 'INITIAL_PICK' && (
              <CardPickOverlay title="選擇起始技能" subtitle="選擇一張銅卡開始冒險" cards={cardOffer} onPick={handlePickCard} slots={gs.slots} />
            )}
            {phase === 'CARD_PICK' && (
              <CardPickOverlay title={`Wave ${gs.wave.waveNumber} — 選擇強化`} subtitle={`擊殺 ${gs.wave.killTarget} 隻`} cards={cardOffer} onPick={handlePickCard} slots={gs.slots} />
            )}
            {paused && (
              <div style={overlayStyle}>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 12 }}>⏸ 暫停</div>
                <button onClick={togglePause} style={{ ...btnStyle, background: '#4CAF50', padding: '10px 20px' }}>繼續</button>
              </div>
            )}
            {phase === 'GAME_OVER' && gameOverState && (
              <GameOverOverlay gs={gameOverState.gs} best={gameOverState.best} onRestart={handleRestart} onExit={onExit} />
            )}
          </div>
        </div>

        {/* 底部：卡槽 + 操作區撐滿剩餘空間 */}
        {(phase === 'BATTLE' || phase === 'CARD_PICK') && (
          <div style={{
            flex: 1, minHeight: 0, display: 'flex', padding: 6, gap: 8,
            background: '#0d0d1a',
          }}>
            {/* 左 2/3：卡槽，三格並排 */}
            <div style={{
              flex: 2, minWidth: 0, display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
              overflow: 'hidden',
            }}>
              {gs.slots.map((slot, i) => {
                const engine = engineRef.current
                const skill = slot.skillId ? allSkills.find(s => s.id === slot.skillId) : null
                const remaining = (slot.skillId && engine) ? (engine.state.skillCooldowns.get(slot.skillId) ?? 0) : 0
                const total = (slot.skillId && skill && engine) ? engine.getCooldownForSkill(slot.skillId, skill) : 1
                const hasCooldown = slot.skillId === 'electric-ball' ? false : total > 0
                const ratio = hasCooldown ? Math.max(0, Math.min(1, remaining / total)) : 0
                const isReady = (slot.skillId === 'electric-ball' ? true : remaining <= 0) && !!slot.skillId
                const pct = Math.round((1 - ratio) * 360)
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
                    {/* 摘要在上，倒計時於摘要外框（外層 conic 當邊框） */}
                    <div style={{
                      flexShrink: 0, padding: 2, borderRadius: 6,
                      background: (slot.skillId && !isReady)
                        ? `conic-gradient(#FFB74D ${pct}deg, #333 ${pct}deg)`
                        : (isReady && slot.skillId ? '#4CAF50' : '#333'),
                    }}>
                      <div style={{
                        padding: 4, background: '#15152a', borderRadius: 4,
                        fontSize: 8, fontFamily: 'monospace', color: '#aaa', lineHeight: 1.3,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          {slot.skillId && <span style={{ fontSize: 12 }}>{getSkillIcon(slot.skillId)}</span>}
                          <span style={{ fontWeight: 'bold', color: '#ccc' }}>{slot.skillId ? (skill?.name ?? slot.skillId) : `卡槽 ${i + 1}`}</span>
                          {slot.skillId && (
                            <span style={{ marginLeft: 'auto', color: isReady ? '#4CAF50' : '#FFB74D', fontWeight: 'bold' }}>
                              {slot.skillId === 'electric-ball' ? '常駐' : isReady ? 'OK' : remaining.toFixed(1) + 's'}
                            </span>
                          )}
                        </div>
                        {slot.skillId && getSlotStatusLines(slot.skillId, slot.items).map((line, k) => (
                          <div key={k}>{line}</div>
                        ))}
                      </div>
                    </div>
                    {/* 卡在下：每張都顯示標題，新卡自動推到底部，可往回滑看舊卡 */}
                    <div
                      ref={(el) => { if (el) slotScrollRefs.current[i] = el }}
                      style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
                    >
                      {slot.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {slot.items.map((item, j) => {
                            const cardStyle = { width: '100%' }
                            if (item.kind === 'card') {
                              const c = item.card
                              return (
                                <div key={'c-' + j} style={{
                                  ...cardStyle,
                                  padding: 4, borderRadius: 4,
                                  background: `linear-gradient(to bottom, ${rarityHexColors[c.rarity]}28, ${rarityHexColors[c.rarity]}10)`,
                                  border: `1px solid ${rarityHexColors[c.rarity]}55`,
                                  fontSize: 9, fontWeight: 'bold', color: rarityHexColors[c.rarity],
                                }}>
                                  {c.name}
                                </div>
                              )
                            }
                            const b = item.buff
                            const buffColors = { cooldown: '#4FC3F7', range: '#81C784', count: '#FFB74D' }
                            return (
                              <div key={'b-' + j} style={{
                                ...cardStyle,
                                padding: 4, borderRadius: 4,
                                background: `linear-gradient(to bottom, ${buffColors[b.type]}28, ${buffColors[b.type]}10)`,
                                border: `1px solid ${buffColors[b.type]}55`,
                                fontSize: 9, fontWeight: 'bold', color: buffColors[b.type],
                              }}>
                                {b.label}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: 6, fontSize: 9, color: '#555', textAlign: 'center' }}>空</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 右 1/3：搖桿置中 + 暫停最下 */}
            <div style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 8, justifyContent: 'space-between',
            }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MobileTouchControls
                  onMove={(dx, dy) => engineRef.current?.setMoveInput(dx, dy)}
                  onEnd={() => engineRef.current?.setMoveInput(null, null)}
                  size={90}
                  placement="center"
                />
              </div>
              <button
                onClick={togglePause}
                style={{ ...btnStyle, padding: '10px 20px', fontSize: 12, flexShrink: 0 }}
              >
                {paused ? '▶ 繼續' : '⏸ 暫停'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 桌機版排版：左地圖撐滿到底、右側卡槽（約地圖一半寬）+ 搖桿與暫停，與手機版區塊邏輯一致
  return (
    <div style={{
      width: '100%', minHeight: '100dvh', fontFamily: 'monospace', color: '#e0e0e0',
      background: '#2a2a3a',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 1200, height: '100dvh',
        overflow: 'hidden', background: '#0d0d1a',
      }}>
        {/* 頂部：返回 | Card Survivor 置中 | 模式靠右 */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: '1px solid #333', background: '#0d0d1a',
        }}>
          <button onClick={onExit} style={btnStyle}>← 返回</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, color: '#aaa' }}>Card Survivor</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>無限模式</span>
        </div>

        {/* 血量、分數、關卡、擊殺（戰鬥時顯示，與手機版一致） */}
        {(phase === 'BATTLE' || phase === 'CARD_PICK') && (
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
            padding: '6px 12px', fontSize: 10, background: '#15152a',
            borderBottom: '1px solid #2a2a3e', flexWrap: 'wrap',
          }}>
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#66BB6A' }}>HP</span>
                <span style={{ color: '#66BB6A' }}>{gs.playerHp}/{gs.playerMaxHp}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(0, (gs.playerHp / gs.playerMaxHp) * 100)}%`,
                  height: '100%',
                  background: (gs.playerHp / gs.playerMaxHp) < 0.3 ? '#EF5350' : '#66BB6A',
                  borderRadius: 3,
                }} />
              </div>
            </div>
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>擊殺</span>
                <span style={{ color: '#4FC3F7' }}>{gs.wave.killCount}/{gs.wave.killTarget}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, (gs.wave.killCount / Math.max(1, gs.wave.killTarget)) * 100)}%`,
                  height: '100%', background: '#4FC3F7', borderRadius: 3,
                }} />
              </div>
            </div>
            <span style={{ color: '#FFD54F', alignSelf: 'center' }}>分數: {gs.score.score.toLocaleString()}</span>
            <span style={{ alignSelf: 'center' }}>Wave {gs.wave.waveNumber}</span>
          </div>
        )}

        {/* 主體：左地圖（撐滿到底）| 右卡槽區（約地圖一半寬） */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
          {/* 左側：地圖區撐滿到底 */}
          <div style={{
            flex: 2, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0d0d1a',
          }}>
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: MAP_ASPECT_RATIO,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '2px solid #333',
              boxSizing: 'border-box',
            }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {phase === 'INITIAL_PICK' && (
                <CardPickOverlay title="選擇起始技能" subtitle="選擇一張銅卡開始冒險" cards={cardOffer} onPick={handlePickCard} slots={gs.slots} layout="row" />
              )}
              {phase === 'CARD_PICK' && (
                <CardPickOverlay title={`Wave ${gs.wave.waveNumber} — 選擇強化`} subtitle={`下一波需要擊殺 ${gs.wave.killTarget} 隻敵人`} cards={cardOffer} onPick={handlePickCard} slots={gs.slots} layout="row" />
              )}
              {paused && (
                <div style={overlayStyle}>
                  <div style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 12 }}>⏸ 暫停</div>
                  <div style={{ fontSize: 14, color: '#aaa', marginBottom: 24 }}>按 ESC 或點擊繼續</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={togglePause} style={{ ...btnStyle, background: '#4CAF50', fontSize: 16, padding: '10px 24px' }}>繼續遊戲</button>
                    <button onClick={onExit} style={{ ...btnStyle, fontSize: 16, padding: '10px 24px' }}>返回選單</button>
                  </div>
                </div>
              )}
              {phase === 'GAME_OVER' && gameOverState && (
                <GameOverOverlay gs={gameOverState.gs} best={gameOverState.best} onRestart={handleRestart} onExit={onExit} />
              )}
            </div>
          </div>

          {/* 右側：卡槽區每槽佔 20% 高（共 60%），疊卡可超出邊界並自動捲到底；搖桿+暫停在下 */}
          <div style={{
            flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
            background: '#0d0d1a', borderLeft: '1px solid #333',
          }}>
            {(phase === 'BATTLE' || phase === 'CARD_PICK') && (
              <>
                <div style={{ flex: '0 0 60%', minHeight: 0, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {gs.slots.map((slot, i) => {
                    const engine = engineRef.current
                    const skill = slot.skillId ? allSkills.find(s => s.id === slot.skillId) : null
                    const remaining = (slot.skillId && engine) ? (engine.state.skillCooldowns.get(slot.skillId) ?? 0) : 0
                    const total = (slot.skillId && skill && engine) ? engine.getCooldownForSkill(slot.skillId, skill) : 1
                    const hasCooldown = slot.skillId === 'electric-ball' ? false : total > 0
                    const isReady = (slot.skillId === 'electric-ball' ? true : remaining <= 0) && !!slot.skillId
                    const pct = hasCooldown ? Math.round((1 - Math.max(0, Math.min(1, remaining / total))) * 360) : 0
                    const borderColor = !slot.skillId ? '#333' : isReady ? '#4CAF50' : '#555'
                    const borderImg = (slot.skillId && !isReady) ? `conic-gradient(#FFB74D ${pct}deg, #333 ${pct}deg)` : undefined
                    return (
                      <div key={i} style={{ flex: '0 0 33.333%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, minHeight: 0, padding: 2, borderRadius: 8, background: borderImg ?? borderColor }}>
                          <div style={{
                            height: '100%', padding: 6, background: '#15152a', borderRadius: 6,
                            display: 'flex', flexDirection: 'row', gap: 8, minHeight: 0,
                          }}>
                            {/* 左：狀態摘要（撐滿左側，讓右側疊卡區寬度穩定、卡片可靠右） */}
                            <div style={{
                              flex: 1, minWidth: 0,
                              fontSize: 10, fontFamily: 'monospace', color: '#aaa', lineHeight: 1.4,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                {slot.skillId && <span style={{ fontSize: 12 }}>{getSkillIcon(slot.skillId)}</span>}
                                <span style={{ fontWeight: 'bold', color: '#ccc' }}>{slot.skillId ? (skill?.name ?? slot.skillId) : `卡槽 ${i + 1}`}</span>
                                {slot.skillId && (
                                  <span style={{ color: isReady ? '#4CAF50' : '#FFB74D', fontWeight: 'bold' }}>
                                    {slot.skillId === 'electric-ball' ? '常駐' : isReady ? 'OK' : remaining.toFixed(1) + 's'}
                                  </span>
                                )}
                              </div>
                              {slot.skillId && getSlotStatusLines(slot.skillId, slot.items).map((line, k) => (
                                <div key={k}>{line}</div>
                              ))}
                            </div>
                            {/* 右：疊卡（參考手機版重疊、可超出邊界，自動捲到最下；最下面那張保留描述） */}
                            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
                              {slot.items.length > 0 ? (
                                <div
                                  ref={(el) => { if (el) slotScrollRefs.current[i] = el }}
                                  style={{
                                    padding: 4, display: 'flex', flexDirection: 'column', gap: 0,
                                    minHeight: 'min-content',
                                  }}
                                >
                                  {slot.items.map((item, j) => {
                                    const isTop = j === slot.items.length - 1
                                    const cardStyle = { width: '100%' }
                                    if (item.kind === 'card') {
                                      const c = item.card
                                      return (
                                        <div
                                          key={'c-' + j}
                                          style={{
                                            ...cardStyle,
                                            marginTop: j === 0 ? 0 : -20,
                                            padding: isTop ? '6px 8px 8px' : '4px 8px 6px',
                                            paddingBottom: isTop ? 8 : 12,
                                            borderRadius: 4,
                                            background: `linear-gradient(to bottom, ${rarityHexColors[c.rarity]}28, ${rarityHexColors[c.rarity]}10)`,
                                            border: `1px solid ${rarityHexColors[c.rarity]}55`,
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                            zIndex: j,
                                            fontSize: 10, fontWeight: 'bold', color: rarityHexColors[c.rarity],
                                          }}
                                        >
                                          {c.name}
                                          {isTop && (
                                            <div style={{ fontSize: 9, color: '#999', lineHeight: 1.3, marginTop: 4 }}>{c.description}</div>
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
                                          ...cardStyle,
                                          marginTop: j === 0 ? 0 : -20,
                                          padding: isTop ? '6px 8px 8px' : '4px 8px 6px',
                                          paddingBottom: isTop ? 8 : 12,
                                          borderRadius: 4,
                                          background: `linear-gradient(to bottom, ${color}28, ${color}10)`,
                                          border: `1px solid ${color}55`,
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                          zIndex: j,
                                          fontSize: 10, fontWeight: 'bold', color,
                                        }}
                                      >
                                        {b.label}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div style={{ padding: 12, fontSize: 10, color: '#555', textAlign: 'center' }}>空</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 }}>
                  <MobileTouchControls
                    onMove={(dx, dy) => engineRef.current?.setMoveInput(dx, dy)}
                    onEnd={() => engineRef.current?.setMoveInput(null, null)}
                    size={90}
                    placement="center"
                  />
                  <button onClick={togglePause} style={{ ...btnStyle, padding: '10px 20px', fontSize: 12 }}>
                    {paused ? '▶ 繼續' : '⏸ 暫停'}
                  </button>
                </div>
              </>
            )}
            {phase === 'INITIAL_PICK' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                <span style={{ fontSize: 12, color: '#666' }}>選擇起始技能後開始</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 子元件 ──

/** 卡片選擇 overlay */
function CardPickOverlay({ title, subtitle, cards, onPick, slots, layout = 'wrap' }: {
  title: string
  subtitle: string
  cards: CardDefinition[]
  onPick: (card: CardDefinition) => void
  slots: InfiniteGameState['slots']
  /** 桌機三選一用 'row' 左右並排不換行 */
  layout?: 'wrap' | 'row'
}) {
  const isRow = layout === 'row'
  return (
    <div style={overlayStyle}>
      <div style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: '#aaa', marginBottom: 16 }}>{subtitle}</div>

      <div style={{
        display: 'flex',
        gap: 'clamp(8px, 2vw, 16px)',
        flexWrap: isRow ? 'nowrap' : 'wrap',
        justifyContent: 'center',
      }}>
        {cards.map((card) => {
          const skill = allSkills.find(s => s.id === card.skillId)
          const existingSlot = slots.find(s => s.skillId === card.skillId)
          const isNewSkill = !existingSlot && slots.some(s => s.skillId === null)

          return (
            <div
              key={card.id}
              onClick={() => onPick(card)}
              style={{
                width: isRow ? 'min(180px, 22vw)' : 'min(200px, 70vw)',
                flexShrink: isRow ? 0 : undefined,
                padding: 'clamp(10px, 2vw, 16px)', borderRadius: 12, cursor: 'pointer',
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
              <div style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 'bold', marginBottom: 6 }}>{card.name}</div>
              <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: '#aaa', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{getSkillIcon(card.skillId)}</span>
                {skill?.name ?? card.skillId}
              </div>
              <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', color: '#ccc', lineHeight: 1.4 }}>{card.description}</div>
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
      <div style={{ fontSize: 'clamp(24px, 6vw, 36px)', fontWeight: 'bold', color: '#EF5350', marginBottom: 12 }}>
        GAME OVER
      </div>

      <div style={{
        background: '#1a1a2e', borderRadius: 12, padding: 20, width: 'min(320px, 90vw)',
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
