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
import { STAR } from '../config/mastery.config'
import { MAX_ENEMIES } from '../config/infinite.config'
import {
  createMasteryState,
  startMasteryGame,
  getMasterySpawnInterval,
  getMasteryEnemyStats,
  generateMasteryOffer,
  applyMasteryOfferItem,
  updateMasterySurvivalScore,
  handleMasteryKill,
  saveMasteryBestRecord,
  loadMasteryBestRecord,
} from '../models/MasteryGameLogic'
import type { MasteryGameState, MasteryPhase, MasteryOfferItem, MasteryBestRecord } from '../models/MasteryGameLogic'

/** 與無限模式一致：直式 4:3 地圖 */
const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 800
const MAP_ASPECT_RATIO = '3 / 4'

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.8)',
  borderRadius: 8,
}

const btnStyle: React.CSSProperties = {
  background: '#333',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 16px',
  cursor: 'pointer',
  fontSize: 14,
  fontFamily: 'monospace',
}

const allCards: CardDefinition[] = [
  ...iceArrowCards,
  ...iceSpikeCards,
  ...fireballCards,
  ...electricBallCards,
  ...beamCards,
]

/** 套用專精大師單一卡槽快照到引擎 */
function applyMasterySnapshot(engine: GameEngine, gs: MasteryGameState) {
  const slot = gs.slot
  if (!slot.skillId) return
  const hasCards = slot.items.some(i => i.kind === 'card')
  if (!hasCards && slot.items.length === 0) {
    // 空槽：仍設定基礎快照（無卡片效果）
    switch (slot.skillId) {
      case 'ice-arrow':
        engine.setIceArrowSnapshot(computeIceArrowSnapshotFromSequence([]))
        break
      case 'ice-spike':
        engine.setIceSpikeSnapshot(computeIceSpikeSnapshotFromSequence([]))
        break
      case 'fireball':
        engine.setFireballSnapshot(computeFireballSnapshotFromSequence([]))
        break
      case 'electric-ball':
        engine.setElectricBallSnapshot(computeElectricBallSnapshotFromSequence([]))
        break
      case 'beam':
        engine.setBeamSnapshot(computeBeamSnapshotFromSequence([]))
        break
    }
    return
  }
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

export default function MasteryScreen({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const gsRef = useRef<MasteryGameState>(createMasteryState())
  const spawnTimerRef = useRef(0)
  const lastStarSpawnTimeRef = useRef(0)
  const slotScrollRef = useRef<HTMLDivElement | null>(null)
  const prevSlotLength = useRef(0)

  const [phase, setPhase] = useState<MasteryPhase>('MASTERY_SKILL_PICK')
  const [offer, setOffer] = useState<MasteryOfferItem[]>([])
  const [, forceRender] = useState(0)
  const [gameOverState, setGameOverState] = useState<{ gs: MasteryGameState; best: MasteryBestRecord | null } | null>(null)
  const [paused, setPaused] = useState(false)
  const isMobile = useIsMobile()

  const triggerRender = useCallback(() => forceRender(n => n + 1), [])

  const onStarCollected = useCallback(() => {
    const gs = gsRef.current
    const engine = engineRef.current
    if (!engine || gs.phase !== 'BATTLE') return
    gs.starsCollected++
    // 拾取星星回血（可配置）
    const heal = STAR.hpRecoverOnCollect ?? 0
    if (heal > 0) {
      gs.playerHp = Math.min(gs.playerMaxHp, gs.playerHp + heal)
      engine.state.player.hp = gs.playerHp
    }
    engine.pause()
    gs.phase = 'STAR_PICK'
    setPhase('STAR_PICK')
    const skillName = allSkills.find(s => s.id === gs.masterySkillId)?.name ?? gs.masterySkillId
    const nextOffer = generateMasteryOffer(gs, allCards, skillName)
    setOffer(nextOffer)
  }, [])

  const onEnemyKilled = useCallback(() => {
    const gs = gsRef.current
    if (gs.phase !== 'BATTLE') return
    handleMasteryKill(gs)
  }, [])

  useEffect(() => {
    const modeConfig: GameModeConfig = {
      removeDeadEnemies: true,
      enableEnemyAI: true,
      enablePlayerDamage: true,
      contactDamage: 5,
      fireAllEquippedSkills: true,
      noInitialEnemies: true,
      onEnemyKilled,
      enableMapStars: true,
      onStarCollected,
      starCollectRadius: STAR.collectRadius,
      starDurationMs: STAR.durationMs,
      ...(isMobile && { enemySpeedMultiplier: 0.7 }),
    }
    const engine = new GameEngine(CANVAS_WIDTH, CANVAS_HEIGHT, triggerRender, modeConfig)
    allSkills.forEach(s => engine.registerSkill(s))
    engineRef.current = engine
    engine.start()
    return () => engine.stop()
  }, [triggerRender, onEnemyKilled, onStarCollected])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.updateModeConfig({ enemySpeedMultiplier: isMobile ? 0.7 : 1 })
  }, [isMobile])

  /** 新卡加入時卡槽自動捲到底部（與無限模式一致） */
  useLayoutEffect(() => {
    const gs = gsRef.current
    const len = gs.slot.items.length
    if (len > prevSlotLength.current) {
      prevSlotLength.current = len
      slotScrollRef.current && (slotScrollRef.current.scrollTop = slotScrollRef.current.scrollHeight)
    } else {
      prevSlotLength.current = len
    }
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'BATTLE') {
        setPaused(p => {
          if (p) engineRef.current?.resume()
          else engineRef.current?.pause()
          return !p
        })
        return
      }
      engineRef.current?.keyDown(e.key)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => engineRef.current?.keyUp(e.key)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [phase])

  // 遊戲迴圈：生成敵人、星星、存活時間、Game Over
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
        updateMasterySurvivalScore(gs, dt)

        const elapsed = gs.score.survivalTime
        spawnTimerRef.current += dt
        const interval = getMasterySpawnInterval(elapsed)
        if (spawnTimerRef.current >= interval && engine.state.enemies.length < MAX_ENEMIES) {
          spawnTimerRef.current = 0
          const stats = getMasteryEnemyStats(elapsed)
          engine.spawnEnemyAtEdge(stats)
        }

        // 星星：同時僅一顆，拾取後間隔再生成（避開牆邊，避免吃不到）
        if (engine.state.mapStars.length === 0) {
          const sinceLastStar = (now / 1000) - (lastStarSpawnTimeRef.current / 1000)
          if (lastStarSpawnTimeRef.current === 0 || sinceLastStar >= STAR.spawnIntervalSec) {
            lastStarSpawnTimeRef.current = now
            const margin = STAR.spawnMarginFromEdge
            let x = margin + Math.random() * (CANVAS_WIDTH - margin * 2)
            let y = margin + Math.random() * (CANVAS_HEIGHT - margin * 2)
            const dx = x - engine.state.player.position.x
            const dy = y - engine.state.player.position.y
            if (dx * dx + dy * dy < 80 * 80) {
              const angle = Math.atan2(dy, dx) + Math.PI
              x = engine.state.player.position.x + Math.cos(angle) * 100
              y = engine.state.player.position.y + Math.sin(angle) * 100
            }
            x = Math.max(margin, Math.min(CANVAS_WIDTH - margin, x))
            y = Math.max(margin, Math.min(CANVAS_HEIGHT - margin, y))
            engine.addStar({ x, y })
          }
        }

        gs.playerHp = engine.state.player.hp

        if (gs.playerHp <= 0) {
          gs.phase = 'GAME_OVER'
          setPhase('GAME_OVER')
          engine.stop()
          saveMasteryBestRecord(gs)
          setGameOverState({ gs: { ...gs, score: { ...gs.score } }, best: loadMasteryBestRecord() })
          return
        }
      }

      raf = requestAnimationFrame(gameLoop)
    }
    raf = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gs = gsRef.current
    const hud: HudConfig | undefined =
      gs.phase === 'BATTLE' || gs.phase === 'STAR_PICK'
        ? {
            playerHp: gs.playerHp,
            playerMaxHp: gs.playerMaxHp,
            waveNumber: 0,
            score: gs.score.score,
            killCount: gs.score.totalKills,
            waveTarget: 0,
            killStreak: gs.score.killStreak,
            survivalTime: gs.score.survivalTime,
            invincibleUntil: engine.state.invincibleUntil,
            hideHudOverlay: true,
          }
        : undefined
    drawGame(ctx, engine.state, hud)
  })

  const handlePickSkill = (skillId: string) => {
    const gs = gsRef.current
    startMasteryGame(gs, skillId)
    setPhase('BATTLE')
    applyMasterySnapshot(engineRef.current!, gs)
    engineRef.current!.state.player.hp = gs.playerMaxHp
    lastStarSpawnTimeRef.current = 0
    spawnTimerRef.current = 0
  }

  const handlePickOfferItem = (item: MasteryOfferItem) => {
    const gs = gsRef.current
    const engine = engineRef.current
    if (!engine) return
    applyMasteryOfferItem(gs, item)
    applyMasterySnapshot(engine, gs)
    gs.phase = 'BATTLE'
    setPhase('BATTLE')
    setOffer([])
    engine.state.player.hp = gs.playerHp
    engine.resume()
  }

  const handleRestart = () => {
    gsRef.current = createMasteryState()
    setPhase('MASTERY_SKILL_PICK')
    setOffer([])
    setGameOverState(null)
    const engine = engineRef.current
    if (engine) {
      engine.state.enemies.length = 0
      engine.state.mapStars.length = 0
      engine.state.player.hp = engine.state.player.maxHp
      engine.state.player.position.x = CANVAS_WIDTH / 2
      engine.state.player.position.y = CANVAS_HEIGHT / 2
      engine.resume()
    }
    lastStarSpawnTimeRef.current = 0
    spawnTimerRef.current = 0
  }

  const togglePause = useCallback(() => {
    const engine = engineRef.current
    if (!engine || gsRef.current.phase !== 'BATTLE') return
    if (engine.isPaused) {
      engine.resume()
      setPaused(false)
    } else {
      engine.pause()
      setPaused(true)
    }
  }, [])

  const gs = gsRef.current
  const skill = allSkills.find(s => s.id === gs.masterySkillId)
  const slot = gs.slot

  // ── 選技能畫面（頂部列與無限模式一致） ──
  if (phase === 'MASTERY_SKILL_PICK') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '100dvh',
        overflow: 'hidden', fontFamily: 'monospace', color: '#e0e0e0', background: '#0d0d1a',
      }}>
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: '1px solid #333', background: '#0d0d1a',
        }}>
          <button onClick={onExit} style={btnStyle}>← 返回</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, color: '#aaa' }}>Card Survivor</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>專精大師</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <h2 style={{ marginBottom: 8 }}>選擇專精技能</h2>
          <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>本局僅使用該技能的一個卡槽</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {allSkills.map(s => (
              <button
                key={s.id}
                onClick={() => handlePickSkill(s.id)}
                style={{ ...btnStyle, padding: '16px 24px', border: '2px solid #9C27B0', background: '#2a2a3e', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ fontSize: 20 }}>{getSkillIcon(s.id)}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── 單一卡槽渲染（與無限模式同款：冷卻圈、摘要、疊卡 marginTop -20） ──
  const renderMasterySlot = (isMobileLayout: boolean) => {
    const engine = engineRef.current
    const remaining = (slot.skillId && engine) ? (engine.state.skillCooldowns.get(slot.skillId) ?? 0) : 0
    const total = (slot.skillId && skill && engine) ? engine.getCooldownForSkill(slot.skillId, skill) : 1
    const hasCooldown = slot.skillId === 'electric-ball' ? false : total > 0
    const ratio = hasCooldown ? Math.max(0, Math.min(1, remaining / total)) : 0
    const isReady = (slot.skillId === 'electric-ball' ? true : remaining <= 0) && !!slot.skillId
    const pct = Math.round((1 - ratio) * 360)
    const buffColors: Record<'cooldown' | 'range' | 'count' | 'damage', string> = { cooldown: '#4FC3F7', range: '#81C784', count: '#FFB74D', damage: '#E57373' }
    if (isMobileLayout) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
          <div style={{
            flexShrink: 0, padding: 2, borderRadius: 6,
            background: (slot.skillId && !isReady) ? `conic-gradient(#FFB74D ${pct}deg, #333 ${pct}deg)` : (isReady && slot.skillId ? '#4CAF50' : '#333'),
          }}>
            <div style={{ padding: 4, background: '#15152a', borderRadius: 4, fontSize: 8, fontFamily: 'monospace', color: '#aaa', lineHeight: 1.3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                {slot.skillId && <span style={{ fontSize: 12 }}>{getSkillIcon(slot.skillId)}</span>}
                <span style={{ fontWeight: 'bold', color: '#ccc' }}>{slot.skillId ? (skill?.name ?? slot.skillId) : '專精'}</span>
                {slot.skillId && (
                  <span style={{ marginLeft: 'auto', color: isReady ? '#4CAF50' : '#FFB74D', fontWeight: 'bold' }}>
                    {slot.skillId === 'electric-ball' ? '常駐' : isReady ? 'OK' : remaining.toFixed(1) + 's'}
                  </span>
                )}
              </div>
              {slot.skillId && getSlotStatusLines(slot.skillId, slot.items).map((line, k) => <div key={k}>{line}</div>)}
            </div>
          </div>
          <div ref={slotScrollRef} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {slot.items.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {slot.items.map((item, j) => {
                  if (item.kind === 'card') {
                    const c = item.card
                    return (
                      <div key={'c-' + j} style={{
                        width: '100%', padding: 4, borderRadius: 4,
                        background: `linear-gradient(to bottom, ${rarityHexColors[c.rarity]}28, ${rarityHexColors[c.rarity]}10)`,
                        border: `1px solid ${rarityHexColors[c.rarity]}55`,
                        fontSize: 9, fontWeight: 'bold', color: rarityHexColors[c.rarity],
                      }}>{c.name}</div>
                    )
                  }
                  const b = item.buff
                  return (
                    <div key={'b-' + j} style={{
                      width: '100%', padding: 4, borderRadius: 4,
                      background: `linear-gradient(to bottom, ${buffColors[b.type]}28, ${buffColors[b.type]}10)`,
                      border: `1px solid ${buffColors[b.type]}55`,
                      fontSize: 9, fontWeight: 'bold', color: buffColors[b.type],
                    }}>{b.label}</div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: 6, fontSize: 9, color: '#555', textAlign: 'center' }}>空</div>
            )}
          </div>
        </div>
      )
    }
    // 桌機：與無限模式右側單槽同款（疊卡 marginTop -20、最上一張有 description）
    return (
      <div style={{ flex: '0 0 60%', minHeight: 0, padding: 2, borderRadius: 8, background: (slot.skillId && !isReady) ? `conic-gradient(#FFB74D ${pct}deg, #333 ${pct}deg)` : (isReady && slot.skillId ? '#4CAF50' : '#333') }}>
        <div style={{ height: '100%', padding: 6, background: '#15152a', borderRadius: 6, display: 'flex', flexDirection: 'row', gap: 8, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 10, fontFamily: 'monospace', color: '#aaa', lineHeight: 1.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              {slot.skillId && <span style={{ fontSize: 12 }}>{getSkillIcon(slot.skillId)}</span>}
              <span style={{ fontWeight: 'bold', color: '#ccc' }}>{slot.skillId ? (skill?.name ?? slot.skillId) : '專精'}</span>
              {slot.skillId && <span style={{ color: isReady ? '#4CAF50' : '#FFB74D', fontWeight: 'bold' }}>{slot.skillId === 'electric-ball' ? '常駐' : isReady ? 'OK' : remaining.toFixed(1) + 's'}</span>}
            </div>
            {slot.skillId && getSlotStatusLines(slot.skillId, slot.items).map((line, k) => <div key={k}>{line}</div>)}
          </div>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
            {slot.items.length > 0 ? (
              <div ref={slotScrollRef} style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 0, minHeight: 'min-content' }}>
                {slot.items.map((item, j) => {
                  const isTop = j === slot.items.length - 1
                  if (item.kind === 'card') {
                    const c = item.card
                    return (
                      <div key={'c-' + j} style={{
                        width: '100%', marginTop: j === 0 ? 0 : -20, padding: isTop ? '6px 8px 8px' : '4px 8px 6px', paddingBottom: isTop ? 8 : 12,
                        borderRadius: 4,
                        background: `linear-gradient(to bottom, ${rarityHexColors[c.rarity]}28, ${rarityHexColors[c.rarity]}10)`,
                        border: `1px solid ${rarityHexColors[c.rarity]}55`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.3)', zIndex: j,
                        fontSize: 10, fontWeight: 'bold', color: rarityHexColors[c.rarity],
                      }}>
                        {c.name}
                        {isTop && <div style={{ fontSize: 9, color: '#999', lineHeight: 1.3, marginTop: 4 }}>{c.description}</div>}
                      </div>
                    )
                  }
                  const b = item.buff
                  const color = buffColors[b.type]
                  return (
                    <div key={'b-' + j} style={{
                      width: '100%', marginTop: j === 0 ? 0 : -20, padding: isTop ? '6px 8px 8px' : '4px 8px 6px', paddingBottom: isTop ? 8 : 12,
                      borderRadius: 4, background: `linear-gradient(to bottom, ${color}28, ${color}10)`,
                      border: `1px solid ${color}55`, boxShadow: '0 1px 2px rgba(0,0,0,0.3)', zIndex: j,
                      fontSize: 10, fontWeight: 'bold', color,
                    }}>{b.label}</div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: 12, fontSize: 10, color: '#555', textAlign: 'center' }}>空</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── 手機版（與無限模式相同結構：上頂欄 / HUD / 地圖 4:3 / 下卡槽+搖桿） ──
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '100dvh', overflow: 'hidden', fontFamily: 'monospace', color: '#e0e0e0', background: '#0d0d1a' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #333', background: '#0d0d1a' }}>
          <button onClick={onExit} style={{ ...btnStyle, padding: '6px 12px', fontSize: 12 }}>← 返回</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><span style={{ fontSize: 14, color: '#aaa' }}>Card Survivor</span></div>
          <span style={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>專精大師</span>
        </div>
        {(phase === 'BATTLE' || phase === 'STAR_PICK') && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', fontSize: 10, background: '#15152a', borderBottom: '1px solid #2a2a3e', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#66BB6A' }}>HP</span>
                <span style={{ color: '#66BB6A' }}>{gs.playerHp}/{gs.playerMaxHp}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, (gs.playerHp / gs.playerMaxHp) * 100)}%`, height: '100%', background: (gs.playerHp / gs.playerMaxHp) < 0.3 ? '#EF5350' : '#66BB6A', borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>擊殺</span>
                <span style={{ color: '#4FC3F7' }}>{gs.score.totalKills}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: '#4FC3F7', borderRadius: 3 }} />
              </div>
            </div>
            <span style={{ color: '#FFD54F', alignSelf: 'center' }}>分數: {gs.score.score.toLocaleString()}</span>
            <span style={{ alignSelf: 'center' }}>★ {gs.starsCollected}</span>
            <span style={{ alignSelf: 'center' }}>{Math.floor(gs.score.survivalTime / 60)}:{(Math.floor(gs.score.survivalTime % 60)).toString().padStart(2, '0')}</span>
          </div>
        )}
        <div style={{ flexShrink: 0, width: '100%', aspectRatio: MAP_ASPECT_RATIO, background: '#0d0d1a', border: '2px solid #333', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            {phase === 'STAR_PICK' && (
              <MasteryPickOverlay offer={offer} onPick={handlePickOfferItem} />
            )}
            {paused && phase === 'BATTLE' && (
              <div style={overlayStyle}>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 12 }}>⏸ 暫停</div>
                <button onClick={togglePause} style={{ ...btnStyle, background: '#4CAF50', padding: '10px 20px' }}>繼續</button>
              </div>
            )}
            {phase === 'GAME_OVER' && gameOverState && (
              <MasteryGameOverOverlay gs={gameOverState.gs} best={gameOverState.best} onRestart={handleRestart} onExit={onExit} />
            )}
          </div>
        </div>
        {(phase === 'BATTLE' || phase === 'STAR_PICK') && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', padding: 6, gap: 8, background: '#0d0d1a' }}>
            <div style={{ flex: 2, minWidth: 0, overflow: 'hidden' }}>{renderMasterySlot(true)}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MobileTouchControls onMove={(dx, dy) => engineRef.current?.setMoveInput(dx, dy)} onEnd={() => engineRef.current?.setMoveInput(null, null)} size={90} placement="center" />
              </div>
              <button onClick={togglePause} style={{ ...btnStyle, padding: '10px 20px', fontSize: 12, flexShrink: 0 }}>{paused ? '▶ 繼續' : '⏸ 暫停'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 桌機版（與無限模式相同：外層置中、maxWidth 1200、左地圖右卡槽） ──
  return (
    <div style={{ width: '100%', minHeight: '100dvh', fontFamily: 'monospace', color: '#e0e0e0', background: '#2a2a3a', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 1200, height: '100dvh', overflow: 'hidden', background: '#0d0d1a' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #333', background: '#0d0d1a' }}>
          <button onClick={onExit} style={btnStyle}>← 返回</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><span style={{ fontSize: 14, color: '#aaa' }}>Card Survivor</span></div>
          <span style={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>專精大師</span>
        </div>
        {(phase === 'BATTLE' || phase === 'STAR_PICK') && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', fontSize: 10, background: '#15152a', borderBottom: '1px solid #2a2a3e', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#66BB6A' }}>HP</span>
                <span style={{ color: '#66BB6A' }}>{gs.playerHp}/{gs.playerMaxHp}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, (gs.playerHp / gs.playerMaxHp) * 100)}%`, height: '100%', background: (gs.playerHp / gs.playerMaxHp) < 0.3 ? '#EF5350' : '#66BB6A', borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ flex: '1 1 100px', minWidth: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>擊殺</span>
                <span style={{ color: '#4FC3F7' }}>{gs.score.totalKills}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: '#4FC3F7', borderRadius: 3 }} />
              </div>
            </div>
            <span style={{ color: '#FFD54F', alignSelf: 'center' }}>分數: {gs.score.score.toLocaleString()}</span>
            <span style={{ alignSelf: 'center' }}>★ {gs.starsCollected}</span>
            <span style={{ alignSelf: 'center' }}>{Math.floor(gs.score.survivalTime / 60)}:{(Math.floor(gs.score.survivalTime % 60)).toString().padStart(2, '0')}</span>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
          <div style={{ flex: 2, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d1a' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', aspectRatio: MAP_ASPECT_RATIO, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #333', boxSizing: 'border-box' }}>
              <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              {phase === 'STAR_PICK' && <MasteryPickOverlay offer={offer} onPick={handlePickOfferItem} layout="row" />}
              {paused && phase === 'BATTLE' && (
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
                <MasteryGameOverOverlay gs={gameOverState.gs} best={gameOverState.best} onRestart={handleRestart} onExit={onExit} />
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0d0d1a', borderLeft: '1px solid #333' }}>
            {(phase === 'BATTLE' || phase === 'STAR_PICK') && (
              <>
                <div style={{ flex: '0 0 60%', minHeight: 0, padding: 8, display: 'flex', flexDirection: 'column' }}>{renderMasterySlot(false)}</div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 }}>
                  <MobileTouchControls onMove={(dx, dy) => engineRef.current?.setMoveInput(dx, dy)} onEnd={() => engineRef.current?.setMoveInput(null, null)} size={90} placement="center" />
                  <button onClick={togglePause} style={{ ...btnStyle, padding: '10px 20px', fontSize: 12 }}>{paused ? '▶ 繼續' : '⏸ 暫停'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 專精大師三選一 overlay（技能卡 / 強化碎片，樣式對齊無限模式 CardPickOverlay） */
function MasteryPickOverlay({ offer, onPick, layout = 'wrap' }: { offer: MasteryOfferItem[]; onPick: (item: MasteryOfferItem) => void; layout?: 'wrap' | 'row' }) {
  const isRow = layout === 'row'
  const buffColors: Record<string, string> = { cooldown: '#4FC3F7', range: '#81C784', count: '#FFB74D', damage: '#E57373' }
  return (
    <div style={overlayStyle}>
      <div style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 'bold', marginBottom: 4 }}>拾取星星 — 選擇強化</div>
      <div style={{ fontSize: 'clamp(11px, 2.5vw, 13px)', color: '#aaa', marginBottom: 16 }}>選一張疊入專精卡槽</div>
      <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 16px)', flexWrap: isRow ? 'nowrap' : 'wrap', justifyContent: 'center' }}>
        {offer.map((item, i) => {
          if (item.kind === 'card') {
            const c = item.card
            const sk = allSkills.find(s => s.id === c.skillId)
            return (
              <div
                key={i}
                onClick={() => onPick(item)}
                style={{
                  width: isRow ? 'min(180px, 22vw)' : 'min(200px, 70vw)', flexShrink: isRow ? 0 : undefined,
                  padding: 'clamp(10px, 2vw, 16px)', borderRadius: 12, cursor: 'pointer',
                  background: '#2a2a3e', border: `2px solid ${rarityHexColors[c.rarity]}`,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${rarityHexColors[c.rarity]}44` }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: rarityHexColors[c.rarity], fontWeight: 'bold' }}>{rarityNames[c.rarity]} · 技能卡</span>
                </div>
                <div style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 'bold', marginBottom: 6 }}>{c.name}</div>
                <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: '#aaa', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{getSkillIcon(c.skillId)}</span>
                  <span>{sk?.name ?? c.skillId}</span>
                </div>
                <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', color: '#ccc', lineHeight: 1.4 }}>{c.description}</div>
              </div>
            )
          }
          const b = item.buff
          const color = buffColors[b.type] ?? '#888'
          return (
            <div
              key={i}
              onClick={() => onPick(item)}
              style={{
                width: isRow ? 'min(180px, 22vw)' : 'min(200px, 70vw)', flexShrink: isRow ? 0 : undefined,
                padding: 'clamp(10px, 2vw, 16px)', borderRadius: 12, cursor: 'pointer',
                background: '#2a2a3e', border: `2px solid ${color}`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${color}44` }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{ fontSize: 11, color, fontWeight: 'bold', marginBottom: 8 }}>強化碎片</div>
              <div style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 'bold', color }}>{b.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Game Over overlay（與無限模式結構一致） */
function MasteryGameOverOverlay({ gs, best, onRestart, onExit }: { gs: MasteryGameState; best: MasteryBestRecord | null; onRestart: () => void; onExit: () => void }) {
  const minutes = Math.floor(gs.score.survivalTime / 60)
  const seconds = Math.floor(gs.score.survivalTime % 60)
  return (
    <div style={overlayStyle}>
      <div style={{ fontSize: 'clamp(24px, 6vw, 36px)', fontWeight: 'bold', color: '#EF5350', marginBottom: 12 }}>GAME OVER</div>
      <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, width: 'min(320px, 90vw)', border: '1px solid #444' }}>
        <div style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>分數：{gs.score.score}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
          <span style={{ color: '#aaa' }}>拾取星星</span>
          <span style={{ textAlign: 'right' }}>★ {gs.starsCollected}</span>
          <span style={{ color: '#aaa' }}>總擊殺</span>
          <span style={{ textAlign: 'right' }}>{gs.score.totalKills}</span>
          <span style={{ color: '#aaa' }}>存活時間</span>
          <span style={{ textAlign: 'right' }}>{minutes}:{seconds.toString().padStart(2, '0')}</span>
          <span style={{ color: '#aaa' }}>擊殺分</span>
          <span style={{ textAlign: 'right' }}>{gs.score.killScore}</span>
        </div>
        {best && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #333' }}>
            <div style={{ fontSize: 12, color: '#FFD700', fontWeight: 'bold', marginBottom: 6 }}>最佳紀錄</div>
            <div style={{ fontSize: 13, color: '#aaa' }}>分數 {best.score} · ★ {best.starsCollected} · {best.kills} 殺</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={onRestart} style={{ ...btnStyle, background: '#4CAF50', fontSize: 16, padding: '10px 24px' }}>再來一局</button>
        <button onClick={onExit} style={{ ...btnStyle, fontSize: 16, padding: '10px 24px' }}>返回</button>
      </div>
    </div>
  )
}
