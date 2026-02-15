import { useEffect, useRef, useCallback, useState, useMemo, type MouseEvent as ReactMouseEvent, type CSSProperties } from 'react'
import MobileTouchControls from '../components/MobileTouchControls'
import { useIsMobile } from '../hooks/useIsMobile'
import { GameEngine } from '../models/GameEngine'
import { allSkills } from '../models/skills'
import {
  iceArrowCards,
  iceSpikeCards,
  fireballCards,
  electricBallCards,
  beamCards,
  rarityColors,
  rarityNames,
} from '../models/cards'
import type { CardDefinition, IceArrowSnapshot, IceSpikeSnapshot, FireballSnapshot, ElectricBallSnapshot, ElectricBallInstance, BeamSnapshot } from '../models/cards'
import {
  computeIceArrowSnapshotFromSequence,
  computeIceSpikeSnapshotFromSequence,
  computeFireballSnapshotFromSequence,
  computeElectricBallSnapshotFromSequence,
  computeBeamSnapshotFromSequence,
} from '../models/infiniteSnapshot'
import type { SlotItem, BuffCard } from '../models/InfiniteGameLogic'
import { canAddCardToItems } from '../models/InfiniteGameLogic'
import { getBuffLabels } from '../config'
import { formatIceArrowStatus, getIceArrowGroups, formatIceSpikeStatus, formatFireballStatus, formatElectricBallStatus, formatBeamStatus } from '../models/skillStatus'
import { drawGame } from '../rendering/drawFunctions'

/** 練習場地圖：直式 4:3（與無限模式一致），主角可移動範圍限制在此 */
const PRACTICE_MAP_WIDTH = 600
const PRACTICE_MAP_HEIGHT = 800 // 直式 4:3 = 寬:高 = 3:4
const CANVAS_WIDTH = PRACTICE_MAP_WIDTH
const CANVAS_HEIGHT = PRACTICE_MAP_HEIGHT
const MAP_ASPECT_RATIO = '3 / 4'

/** 練習場畫面 - 不動敵人 + 可操控主角 + 右側卡片堆疊面板 */
export default function PracticeScreen({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [activeSkillId, setActiveSkillId] = useState<string>('ice-arrow')
  const [slotItems, setSlotItems] = useState<Record<string, SlotItem[]>>({
    'ice-arrow': [],
    'ice-spike': [],
    'fireball': [],
    'electric-ball': [],
    'beam': [],
  })
  const [enemyHp, setEnemyHp] = useState(9999)
  const [paused, setPaused] = useState(false)
  const [, forceRender] = useState(0)
  const isMobile = useIsMobile()

  const triggerRender = useCallback(() => {
    forceRender((n) => n + 1)
  }, [])

  const slot = slotItems[activeSkillId] ?? []

  // 計算快照（含強化碎片順序）
  const iceArrowSnap = useMemo(
    () => computeIceArrowSnapshotFromSequence(slotItems['ice-arrow'] ?? []),
    [slotItems],
  )
  const iceSpikeSnap = useMemo(
    () => computeIceSpikeSnapshotFromSequence(slotItems['ice-spike'] ?? []),
    [slotItems],
  )
  const fireballSnap = useMemo(
    () => computeFireballSnapshotFromSequence(slotItems['fireball'] ?? []),
    [slotItems],
  )
  const electricBallSnap = useMemo(
    () => computeElectricBallSnapshotFromSequence(slotItems['electric-ball'] ?? []),
    [slotItems],
  )
  const beamSnap = useMemo(
    () => computeBeamSnapshotFromSequence(slotItems['beam'] ?? []),
    [slotItems],
  )

  // 初始化引擎
  useEffect(() => {
    const engine = new GameEngine(CANVAS_WIDTH, CANVAS_HEIGHT, triggerRender)
    allSkills.forEach((s) => engine.registerSkill(s))
    engine.setActiveSkill('ice-arrow')
    engineRef.current = engine
    engine.start()

    return () => engine.stop()
  }, [triggerRender])

  // 卡片變動時同步快照到引擎
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setIceArrowSnapshot(iceArrowSnap)
  }, [iceArrowSnap])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setIceSpikeSnapshot(iceSpikeSnap)
  }, [iceSpikeSnap])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setFireballSnapshot(fireballSnap)
  }, [fireballSnap])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const hasElectricBallCards = (slotItems['electric-ball'] ?? []).some((i) => i.kind === 'card')
    engine.setElectricBallSnapshot(activeSkillId === 'electric-ball' && hasElectricBallCards ? electricBallSnap : null)
  }, [electricBallSnap, activeSkillId, slotItems])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setBeamSnapshot(beamSnap)
  }, [beamSnap])

  // 鍵盤事件（lazy 存取 ref，確保 listener 一定掛上）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
  }, [])

  // 繪製 Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawGame(ctx, engine.state)
  })

  const handleAddCard = (card: CardDefinition) => {
    const current = slotItems[activeSkillId] ?? []
    if (!canAddCardToItems(current, card)) return
    setSlotItems((prev) => ({
      ...prev,
      [activeSkillId]: [...(prev[activeSkillId] ?? []), { kind: 'card', card }],
    }))
  }

  const handleAddBuff = (type: BuffCard['type']) => {
    const labels = getBuffLabels()
    setSlotItems((prev) => ({
      ...prev,
      [activeSkillId]: [...(prev[activeSkillId] ?? []), { kind: 'buff', buff: { type, label: labels[type], skillId: activeSkillId } }],
    }))
  }

  const handleRemoveItem = (index: number) => {
    setSlotItems((prev) => ({
      ...prev,
      [activeSkillId]: (prev[activeSkillId] ?? []).filter((_, i) => i !== index),
    }))
  }

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    setSlotItems((prev) => {
      const list = [...(prev[activeSkillId] ?? [])]
      const target = index + direction
      if (target < 0 || target >= list.length) return prev
      ;[list[index], list[target]] = [list[target], list[index]]
      return { ...prev, [activeSkillId]: list }
    })
  }

  const handleClearSlot = () => {
    setSlotItems((prev) => ({ ...prev, [activeSkillId]: [] }))
  }

  const handleSwitchSkill = (skillId: string) => {
    setActiveSkillId(skillId)
    engineRef.current?.setActiveSkill(skillId)
  }

  const handleReset = () => engineRef.current?.resetEnemies()
  const handleAddEnemy = () => engineRef.current?.addEnemy()
  const handleAddMovingEnemy = () => engineRef.current?.addMovingEnemy()
  const handleRemoveEnemy = () => engineRef.current?.removeEnemy()

  // ── 木樁拖曳 ──
  const draggingRef = useRef<{ enemyId: string; offsetX: number; offsetY: number } | null>(null)

  const getCanvasPos = (e: ReactMouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height),
    }
  }

  const handleCanvasMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current
    if (!engine) return
    const pos = getCanvasPos(e)
    const enemy = engine.getEnemyAtPosition(pos)
    if (enemy) {
      draggingRef.current = {
        enemyId: enemy.id,
        offsetX: pos.x - enemy.position.x,
        offsetY: pos.y - enemy.position.y,
      }
      canvasRef.current!.style.cursor = 'grabbing'
    }
  }

  const handleCanvasMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current
    if (!engine) return

    const pos = getCanvasPos(e)

    if (draggingRef.current) {
      engine.moveEnemy(draggingRef.current.enemyId, {
        x: pos.x - draggingRef.current.offsetX,
        y: pos.y - draggingRef.current.offsetY,
      })
    } else {
      const hover = engine.getEnemyAtPosition(pos)
      canvasRef.current!.style.cursor = hover ? 'grab' : 'default'
    }
  }

  const handleCanvasMouseUp = () => {
    if (draggingRef.current) {
      draggingRef.current = null
      canvasRef.current!.style.cursor = 'default'
    }
  }

  const handleCanvasMouseLeave = () => {
    if (draggingRef.current) {
      draggingRef.current = null
      canvasRef.current!.style.cursor = 'default'
    }
  }

  const btnStyle: CSSProperties = {
    background: '#333', color: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 16px', cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
  }

  // 手機版：比照無限模式 — 上選單、地圖全寬、下為技能區(左2/3) + 搖桿與暫停(右1/3)
  if (isMobile) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '100dvh',
        overflow: 'hidden', fontFamily: 'monospace', color: '#e0e0e0', background: '#0d0d1a',
      }}>
        {/* 頂部：返回 | Card Survivor 置中 | 模式靠右 */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: '1px solid #333', background: '#0d0d1a',
        }}>
          <div style={{ flexShrink: 0 }}>
            {onExit && (
              <button onClick={() => { engineRef.current?.stop(); onExit() }} style={{ ...btnStyle, padding: '6px 12px', fontSize: 12 }}>
                ← 返回
              </button>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, color: '#aaa' }}>Card Survivor</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>練習場</span>
        </div>

        {/* 地圖區：全寬、1:1 正方形（padding-bottom  hack 確保高度 = 寬度） */}
        <div style={{
          flexShrink: 0, width: '100%', background: '#0d0d1a',
          border: '2px solid #333', boxSizing: 'border-box',
        }}>
          <div style={{ width: '100%', paddingBottom: '100%', position: 'relative', height: 0, boxSizing: 'border-box' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
              />
              <div style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 9, color: '#555' }}>
                虛擬搖桿移動 · 拖曳木樁可移動
              </div>
            </div>
          </div>
        </div>

        {/* 地圖下方：敵人設置（緊湊一排） */}
        <div style={{
          flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
          padding: '6px 10px', fontSize: 10, background: '#15152a', borderBottom: '1px solid #2a2a3e',
        }}>
          <span style={{ color: '#aaa' }}>木樁 HP:</span>
          {[50, 200, 9999].map((hp) => (
            <button
              key={hp}
              onClick={() => { setEnemyHp(hp); engineRef.current?.setEnemyMaxHp(hp) }}
              style={{ ...btnStyle, padding: '3px 8px', fontSize: 10, ...(enemyHp === hp ? { background: '#0d7377' } : {}) }}
            >
              {hp}
            </button>
          ))}
          <span style={{ width: 1, height: 12, background: '#333' }} />
          <button onClick={handleAddEnemy} style={{ ...btnStyle, padding: '3px 8px', fontSize: 10 }}>+ 木樁</button>
          <button onClick={handleAddMovingEnemy} style={{ ...btnStyle, padding: '3px 8px', fontSize: 10, background: '#b45309' }}>+ 移動</button>
          <button onClick={handleRemoveEnemy} style={{ ...btnStyle, padding: '3px 8px', fontSize: 10 }}>- 木樁</button>
          <button onClick={handleReset} style={{ ...btnStyle, padding: '3px 8px', fontSize: 10 }}>重置</button>
        </div>

        {/* 技能切換 + 數值區：左右撐滿，不與卡槽放一起 */}
        <div style={{ flexShrink: 0, width: '100%', borderBottom: '1px solid #333', background: '#0d0d1a' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
            {[
              { id: 'ice-arrow', name: '冰箭' },
              { id: 'ice-spike', name: '凍土' },
              { id: 'fireball', name: '火球' },
              { id: 'electric-ball', name: '電球' },
              { id: 'beam', name: '光束' },
            ].map((skill) => (
              <button
                key={skill.id}
                onClick={() => handleSwitchSkill(skill.id)}
                style={{
                  flex: 1, padding: '10px 6px', fontSize: 12, fontWeight: 'bold', border: 'none', cursor: 'pointer', fontFamily: 'monospace',
                  background: activeSkillId === skill.id ? '#1a1a2e' : 'transparent',
                  color: activeSkillId === skill.id ? '#4FC3F7' : '#888',
                  borderBottom: activeSkillId === skill.id ? '2px solid #4FC3F7' : '2px solid transparent',
                }}
              >
                {skill.name}
              </button>
            ))}
          </div>
          <div style={{ padding: '8px 12px', background: '#15152a', maxHeight: 140, overflow: 'auto' }}>
            <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 6 }}>卡片順序不同 → 效果不同</div>
            {activeSkillId === 'ice-arrow' ? (
              <SnapshotPreview snapshot={iceArrowSnap} />
            ) : activeSkillId === 'ice-spike' ? (
              <IceSpikePreview snapshot={iceSpikeSnap} />
            ) : activeSkillId === 'fireball' ? (
              <FireballPreview snapshot={fireballSnap} />
            ) : activeSkillId === 'electric-ball' ? (
              <ElectricBallPreview snapshot={electricBallSnap} />
            ) : (
              <BeamPreview snapshot={beamSnap} />
            )}
          </div>
        </div>

        {/* 底部：左 2/3 卡槽＋可用卡片 | 右 1/3 搖桿 + 暫停 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', padding: 6, gap: 8, background: '#0d0d1a' }}>
          {/* 左 2/3：僅卡片插槽 + 可用卡片（可捲動） */}
          <div style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '6px 0' }}>
              <section style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 'bold', color: '#4FC3F7' }}>卡片插槽</span>
                  {slot.length > 0 && (
                    <button onClick={handleClearSlot} style={{ ...btnStyle, padding: '2px 6px', fontSize: 9, background: 'transparent', color: '#888' }}>清空</button>
                  )}
                </div>
                {slot.length === 0 ? (
                  <div style={{ fontSize: 9, color: '#555', textAlign: 'center', padding: 8, border: '1px dashed #333', borderRadius: 4 }}>從下方選擇卡片或強化加入</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {slot.map((item, i) =>
                      item.kind === 'card' ? (
                        <SlotCardItem
                          key={`card-${i}-${item.card.id}`}
                          card={item.card}
                          index={i}
                          total={slot.length}
                          onRemove={() => handleRemoveItem(i)}
                          onMoveUp={() => handleMoveItem(i, -1)}
                          onMoveDown={() => handleMoveItem(i, 1)}
                        />
                      ) : (
                        <SlotBuffItem
                          key={`buff-${i}-${item.buff.type}`}
                          buff={item.buff}
                          index={i}
                          total={slot.length}
                          onRemove={() => handleRemoveItem(i)}
                          onMoveUp={() => handleMoveItem(i, -1)}
                          onMoveDown={() => handleMoveItem(i, 1)}
                        />
                      ),
                    )}
                  </div>
                )}
              </section>
              <section>
                <span style={{ fontSize: 10, fontWeight: 'bold', color: '#4FC3F7' }}>可用卡片</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <PracticeBuffSection skillId={activeSkillId} onAddBuff={handleAddBuff} />
                  {(activeSkillId === 'ice-arrow' ? iceArrowCards : activeSkillId === 'ice-spike' ? iceSpikeCards : activeSkillId === 'fireball' ? fireballCards : activeSkillId === 'electric-ball' ? electricBallCards : beamCards).map((card) => (
                    <AvailableCard
                      key={card.id}
                      card={card}
                      onAdd={() => handleAddCard(card)}
                      disabled={!canAddCardToItems(slot, card)}
                    />
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* 右 1/3：搖桿 + 暫停 */}
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
              onClick={() => {
                setPaused((p) => {
                  if (p) engineRef.current?.resume()
                  else engineRef.current?.pause()
                  return !p
                })
              }}
              style={{ ...btnStyle, padding: '10px 20px', fontSize: 12, flexShrink: 0 }}
            >
              {paused ? '▶ 繼續' : '⏸ 暫停'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 桌機版
  return (
    <div style={{
      width: '100%', minHeight: '100dvh', fontFamily: 'monospace', color: '#e0e0e0',
      background: '#2a2a3a', display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
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
          <div style={{ flexShrink: 0 }}>
            {onExit && (
              <button onClick={() => { engineRef.current?.stop(); onExit() }} style={btnStyle}>
                ← 返回
              </button>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, color: '#aaa' }}>Card Survivor</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 'bold', flexShrink: 0 }}>練習場</span>
        </div>

        {/* 主體：左地圖＋敵人控制 | 右技能測試＋控制鈕 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
          {/* 左側：地圖區 + 地圖下方敵人設置 */}
          <div style={{
            flex: 2, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
            background: '#0d0d1a',
          }}>
            {/* 地圖區：直式 4:3 */}
            <div style={{
              flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 8,
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
                borderRadius: 8,
              }}>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                />
                <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10, color: '#666' }}>
                  {isMobile ? '虛擬搖桿移動 · ' : 'WASD 移動 · '}拖曳木樁可移動位置
                </div>
              </div>
            </div>

            {/* 地圖下方：敵人設置 */}
            <div style={{
              flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderTop: '1px solid #333', background: '#15152a', fontSize: 12,
            }}>
              <span style={{ color: '#aaa' }}>木樁 HP:</span>
              {[50, 200, 9999].map((hp) => (
                <button
                  key={hp}
                  onClick={() => { setEnemyHp(hp); engineRef.current?.setEnemyMaxHp(hp) }}
                  style={{
                    ...btnStyle,
                    padding: '4px 10px',
                    fontSize: 11,
                    ...(enemyHp === hp ? { background: '#0d7377', color: '#fff' } : {}),
                  }}
                >
                  {hp}
                </button>
              ))}
              <span style={{ width: 1, height: 16, background: '#333', margin: '0 4px' }} />
              <button onClick={handleAddEnemy} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}>+ 木樁</button>
              <button
                onClick={handleAddMovingEnemy}
                style={{ ...btnStyle, padding: '4px 10px', fontSize: 11, background: '#b45309', color: '#fff' }}
              >
                + 移動
              </button>
              <button onClick={handleRemoveEnemy} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}>- 木樁</button>
              <span style={{ width: 1, height: 16, background: '#333', margin: '0 4px' }} />
              <button onClick={handleReset} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}>重置場景</button>
            </div>
          </div>

          {/* 右側：技能測試區（Tab、快照、插槽、可用卡片）+ 右下控制鈕 */}
          <div style={{
            flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
            background: '#0d0d1a', borderLeft: '1px solid #333',
          }}>
            {/* 技能切換 Tab */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid #333' }}>
              {([
                { id: 'ice-arrow', name: '冰箭' },
                { id: 'ice-spike', name: '凍土' },
                { id: 'fireball', name: '火球' },
                { id: 'electric-ball', name: '電球' },
                { id: 'beam', name: '光束' },
              ] as const).map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleSwitchSkill(skill.id)}
                  style={{
                    flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 'bold',
                    border: 'none', cursor: 'pointer', fontFamily: 'monospace',
                    background: activeSkillId === skill.id ? '#1a1a2e' : 'transparent',
                    color: activeSkillId === skill.id ? '#4FC3F7' : '#888',
                    borderBottom: activeSkillId === skill.id ? '2px solid #4FC3F7' : '2px solid transparent',
                  }}
                >
                  {skill.name}
                </button>
              ))}
            </div>

            <div style={{ padding: '8px 10px', borderBottom: '1px solid #333' }}>
              <p style={{ fontSize: 10, color: '#666', textAlign: 'center', margin: 0 }}>卡片順序不同 → 效果不同</p>
            </div>

            {/* 快照預覽 + 卡片插槽 + 可用卡片（可捲動） */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeSkillId === 'ice-arrow' ? (
                <SnapshotPreview snapshot={iceArrowSnap} />
              ) : activeSkillId === 'ice-spike' ? (
                <IceSpikePreview snapshot={iceSpikeSnap} />
              ) : activeSkillId === 'fireball' ? (
                <FireballPreview snapshot={fireballSnap} />
              ) : activeSkillId === 'electric-ball' ? (
                <ElectricBallPreview snapshot={electricBallSnap} />
              ) : (
                <BeamPreview snapshot={beamSnap} />
              )}

              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 'bold', color: '#4FC3F7', margin: 0 }}>卡片插槽</h3>
                  {slot.length > 0 && (
                    <button onClick={handleClearSlot} style={{ ...btnStyle, padding: '2px 8px', fontSize: 10, background: 'transparent', color: '#888' }}>
                      清空
                    </button>
                  )}
                </div>
                {slot.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#555', textAlign: 'center', padding: 12, border: '1px dashed #333', borderRadius: 6 }}>
                    從下方選擇卡片或強化加入
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {slot.map((item, i) =>
                      item.kind === 'card' ? (
                        <SlotCardItem
                          key={`card-${i}-${item.card.id}`}
                          card={item.card}
                          index={i}
                          total={slot.length}
                          onRemove={() => handleRemoveItem(i)}
                          onMoveUp={() => handleMoveItem(i, -1)}
                          onMoveDown={() => handleMoveItem(i, 1)}
                        />
                      ) : (
                        <SlotBuffItem
                          key={`buff-${i}-${item.buff.type}`}
                          buff={item.buff}
                          index={i}
                          total={slot.length}
                          onRemove={() => handleRemoveItem(i)}
                          onMoveUp={() => handleMoveItem(i, -1)}
                          onMoveDown={() => handleMoveItem(i, 1)}
                        />
                      ),
                    )}
                  </div>
                )}
              </section>

              <section>
                <h3 style={{ fontSize: 12, fontWeight: 'bold', color: '#4FC3F7', marginBottom: 6 }}>可用卡片</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <PracticeBuffSection skillId={activeSkillId} onAddBuff={handleAddBuff} />
                  {(activeSkillId === 'ice-arrow' ? iceArrowCards : activeSkillId === 'ice-spike' ? iceSpikeCards : activeSkillId === 'fireball' ? fireballCards : activeSkillId === 'electric-ball' ? electricBallCards : beamCards).map((card) => (
                    <AvailableCard
                      key={card.id}
                      card={card}
                      onAdd={() => handleAddCard(card)}
                      disabled={!canAddCardToItems(slot, card)}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* 右下：控制鈕（搖桿 + 暫停） */}
            <div style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: 10, borderTop: '1px solid #333',
            }}>
              <MobileTouchControls
                onMove={(dx, dy) => engineRef.current?.setMoveInput(dx, dy)}
                onEnd={() => engineRef.current?.setMoveInput(null, null)}
                size={90}
                placement="center"
              />
              <button
                onClick={() => {
                  setPaused((p) => {
                    if (p) engineRef.current?.resume()
                    else engineRef.current?.pause()
                    return !p
                  })
                }}
                style={{
                  ...btnStyle,
                  padding: '10px 20px',
                  fontSize: 12,
                  ...(paused ? { background: '#4CAF50', color: '#fff' } : {}),
                }}
              >
                {paused ? '▶ 繼續' : '⏸ 暫停'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 子元件 ──

const BUFF_COLORS: Record<BuffCard['type'], string> = {
  cooldown: '#4FC3F7',
  range: '#81C784',
  count: '#FFB74D',
  damage: '#E57373',
}

/** 該技能可用的強化類型 */
function getBuffTypesForSkill(skillId: string): BuffCard['type'][] {
  switch (skillId) {
    case 'ice-arrow':
      return ['cooldown', 'count', 'damage']
    case 'ice-spike':
      return ['cooldown', 'range']
    default:
      return ['cooldown', 'range', 'count']
  }
}

/** 插槽中的強化項目（含上下移動 & 移除） */
function SlotBuffItem({
  buff,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  buff: BuffCard
  index: number
  total: number
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const color = BUFF_COLORS[buff.type]
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 rounded border"
      style={{ borderColor: color + '99', background: color + '18' }}
    >
      <span className="text-xs text-gray-500 w-4 shrink-0">{index + 1}.</span>
      <span className="text-xs font-medium flex-1 truncate" style={{ color }}>{buff.label}</span>
      <div className="flex gap-0.5 shrink-0 ml-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-default"
          title="上移"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-default"
          title="下移"
        >
          ▼
        </button>
        <button
          onClick={onRemove}
          className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-gray-700 hover:bg-red-900 text-red-400"
          title="移除"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/** 可用卡片最上方：強化按鈕區 */
function PracticeBuffSection({ skillId, onAddBuff }: { skillId: string; onAddBuff: (type: BuffCard['type']) => void }) {
  const types = getBuffTypesForSkill(skillId)
  const labels = getBuffLabels()
  if (types.length === 0) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>強化</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {types.map((type) => (
          <button
            key={type}
            onClick={() => onAddBuff(type)}
            style={{
              padding: '6px 10px',
              fontSize: 11,
              borderRadius: 6,
              border: `1px solid ${BUFF_COLORS[type]}88`,
              background: BUFF_COLORS[type] + '22',
              color: BUFF_COLORS[type],
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            + {labels[type]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 插槽中的卡片項目（含上下移動 & 移除） */
function SlotCardItem({
  card,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  card: CardDefinition
  index: number
  total: number
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const colors = rarityColors[card.rarity]

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded border ${colors.border} ${colors.bg}`}>
      <span className="text-xs text-gray-500 w-4 shrink-0">{index + 1}.</span>
      <span className="text-xs font-medium flex-1 truncate">{card.name}</span>
      <span className={`text-[10px] ${colors.text} shrink-0`}>
        {rarityNames[card.rarity]}
      </span>
      <div className="flex gap-0.5 shrink-0 ml-1">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-default"
          title="上移"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-default"
          title="下移"
        >
          ▼
        </button>
        <button
          onClick={onRemove}
          className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-gray-700 hover:bg-red-900 text-red-400"
          title="移除"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/** 冰箭快照：摘要（❄️xn 🎯…）＋合併同數值的表格 */
function SnapshotPreview({ snapshot }: { snapshot: IceArrowSnapshot }) {
  const summaryLines = formatIceArrowStatus(snapshot)
  const groups = getIceArrowGroups(snapshot)
  return (
    <div className="text-xs">
      <div className="mb-2 px-1.5 py-1 rounded bg-gray-800/60 border border-gray-700/50">
        <div className="text-gray-400 font-medium mb-1">摘要</div>
        {summaryLines.map((line, i) => (
          <div key={i} className="text-gray-200">{line}</div>
        ))}
      </div>
      <div className="border border-gray-700 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 text-gray-400">
              <th className="px-1.5 py-1 text-left">#</th>
              <th className="px-1.5 py-1 text-right">傷害</th>
              <th className="px-1.5 py-1 text-right">速度</th>
              <th className="px-1.5 py-1 text-right">穿透</th>
              <th className="px-1.5 py-1 text-center">分裂</th>
              <th className="px-1.5 py-1 text-center">追蹤</th>
              <th className="px-1.5 py-1 text-center">小碎冰</th>
              <th className="px-1.5 py-1 text-center">失溫</th>
              <th className="px-1.5 py-1 text-center">寒氣</th>
              <th className="px-1.5 py-1 text-center">凍結</th>
              <th className="px-1.5 py-1 text-center">噴冰</th>
              <th className="px-1.5 py-1 text-center">反彈</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ arrow, count, startIndex }, i) => (
              <tr key={i} className="border-t border-gray-700/50">
                <td className="px-1.5 py-1 text-gray-500">
                  {count > 1 ? `${startIndex}-${startIndex + count - 1}` : String(startIndex)}
                </td>
                <td className="px-1.5 py-1 text-right text-white">{arrow.damage}</td>
                <td className={`px-1.5 py-1 text-right ${arrow.speed < 220 ? 'text-orange-300' : 'text-white'}`}>
                  {arrow.speed}
                </td>
                <td className="px-1.5 py-1 text-right text-white">{arrow.pierceCount}</td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasSplit ? <span className="text-cyan-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasTracking ? <span className="text-purple-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasCascade ? <span className="text-cyan-200">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.chillChanceBonus > 0 ? <span className="text-green-300">+{arrow.chillChanceBonus * 100}%</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasColdZone ? <span className="text-yellow-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasFreeze ? <span className="text-blue-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasDetonate ? <span className="text-orange-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasRicochet ? <span className="text-amber-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 凍土快照預覽 */
function IceSpikePreview({ snapshot }: { snapshot: IceSpikeSnapshot }) {
  const summaryLines = formatIceSpikeStatus(snapshot)
  const flags: { label: string; active: boolean; color: string }[] = [
    { label: '追蹤', active: snapshot.hasTracking, color: 'text-cyan-300' },
    { label: '領域', active: snapshot.isCage, color: 'text-blue-300' },
    { label: '地雷', active: snapshot.isMine, color: 'text-purple-300' },
    { label: '蔓延', active: snapshot.hasSpread, color: 'text-cyan-200' },
    { label: '蔓延地雷', active: snapshot.spreadIsMine, color: 'text-purple-200' },
    { label: '二重擊', active: snapshot.hasDoubleHit, color: 'text-blue-200' },
    { label: '飛濺', active: snapshot.hasShardSplash, color: 'text-cyan-100' },
    { label: '永凍', active: snapshot.hasPermafrost, color: 'text-yellow-300' },
    { label: '共振', active: snapshot.hasResonance, color: 'text-orange-300' },
  ]
  const activeFlags = flags.filter((f) => f.active)

  return (
    <div className="text-xs">
      <div className="mb-2 px-1.5 py-1 rounded bg-gray-800/60 border border-gray-700/50">
        <div className="text-gray-400 font-medium mb-1">摘要</div>
        {summaryLines.map((line, i) => (
          <div key={i} className="text-gray-200">{line}</div>
        ))}
      </div>
      {activeFlags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {activeFlags.map((f) => (
            <span key={f.label} className={`px-1.5 py-0.5 rounded bg-gray-700/50 ${f.color}`}>
              {f.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** 火球快照預覽 */
function FireballPreview({ snapshot }: { snapshot: FireballSnapshot }) {
  const summaryLines = formatFireballStatus(snapshot)
  const flags: { label: string; active: boolean; color: string }[] = [
    { label: '野火', active: snapshot.fireballs.some((f) => f.hasWildfire), color: 'text-orange-300' },
    { label: '連爆', active: snapshot.fireballs.some((f) => f.hasChainExplosion), color: 'text-red-300' },
  ]
  const activeFlags = flags.filter((f) => f.active)

  return (
    <div className="text-xs">
      <div className="mb-2 px-1.5 py-1 rounded bg-gray-800/60 border border-gray-700/50">
        <div className="text-gray-400 font-medium mb-1">摘要</div>
        {summaryLines.map((line, i) => (
          <div key={i} className="text-gray-200">{line}</div>
        ))}
      </div>
      {activeFlags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {activeFlags.map((f) => (
            <span key={f.label} className={`px-1.5 py-0.5 rounded bg-gray-700/50 ${f.color}`}>
              {f.label}
            </span>
          ))}
        </div>
      )}
      <div className="border border-gray-700 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 text-gray-400">
              <th className="px-1.5 py-1 text-left">#</th>
              <th className="px-1.5 py-1 text-right">傷害</th>
              <th className="px-1.5 py-1 text-right">半徑</th>
              <th className="px-1.5 py-1 text-center">彈跳</th>
              <th className="px-1.5 py-1 text-center">熔岩</th>
              <th className="px-1.5 py-1 text-center">擴散</th>
              <th className="px-1.5 py-1 text-center">隕石</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.fireballs.map((fb, i) => (
              <tr key={i} className="border-t border-gray-700/50">
                <td className="px-1.5 py-1 text-gray-500">{i + 1}</td>
                <td className="px-1.5 py-1 text-right text-white">{fb.damage}</td>
                <td className="px-1.5 py-1 text-right text-white">{fb.explosionRadius}px</td>
                <td className="px-1.5 py-1 text-center">
                  {fb.hasBounce ? <span className="text-orange-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {fb.hasLava ? <span className="text-red-400">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {fb.hasScatter ? <span className="text-yellow-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {fb.isMeteor ? <span className="text-purple-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 電球快照預覽 */
function ElectricBallPreview({ snapshot }: { snapshot: ElectricBallSnapshot }) {
  const summaryLines = formatElectricBallStatus(snapshot)
  const flags: { label: string; active: boolean; color: string }[] = [
    { label: '特斯拉', active: snapshot.orbs.some((e: ElectricBallInstance) => e.hasTesla), color: 'text-purple-300' },
    { label: '磁場', active: snapshot.orbs.some((e: ElectricBallInstance) => e.hasSuperconduct), color: 'text-amber-300' },
  ]
  const activeFlags = flags.filter((f) => f.active)

  return (
    <div className="text-xs">
      <div className="mb-2 px-1.5 py-1 rounded bg-gray-800/60 border border-gray-700/50">
        <div className="text-gray-400 font-medium mb-1">摘要</div>
        {summaryLines.map((line, i) => (
          <div key={i} className="text-gray-200">{line}</div>
        ))}
      </div>
      {activeFlags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-1">
          {activeFlags.map((f) => (
            <span key={f.label} className={`px-1.5 py-0.5 rounded bg-gray-700/50 ${f.color}`}>
              {f.label}
            </span>
          ))}
        </div>
      )}
      <div className="border border-gray-700 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 text-gray-400">
              <th className="px-1.5 py-1 text-left">#</th>
              <th className="px-1.5 py-1 text-right">傷害</th>
              <th className="px-1.5 py-1 text-right">半徑</th>
              <th className="px-1.5 py-1 text-center">連線</th>
              <th className="px-1.5 py-1 text-center">吸附</th>
              <th className="px-1.5 py-1 text-center">EMP</th>
              <th className="px-1.5 py-1 text-center">雷暴</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.orbs.map((eb: ElectricBallInstance, i: number) => (
              <tr key={i} className="border-t border-gray-700/50">
                <td className="px-1.5 py-1 text-gray-500">{i + 1}</td>
                <td className="px-1.5 py-1 text-right text-white">{eb.touchDamage}</td>
                <td className="px-1.5 py-1 text-right text-white">{eb.radius}px</td>
                <td className="px-1.5 py-1 text-center">
                  {eb.hasLightningChain ? <span className="text-amber-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {eb.hasAttach ? <span className="text-purple-400">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {eb.hasEmp ? <span className="text-yellow-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {eb.hasStormCore ? <span className="text-blue-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 光束快照預覽 */
function BeamPreview({ snapshot }: { snapshot: BeamSnapshot }) {
  const summaryLines = formatBeamStatus(snapshot)
  const flags: { label: string; active: boolean; color: string }[] = [
    { label: '殘影', active: snapshot.beams.some((b) => b.hasBurningTrail), color: 'text-orange-300' },
    { label: '過載', active: snapshot.beams.some((b) => b.hasOverload), color: 'text-red-300' },
  ]
  const activeFlags = flags.filter((f) => f.active)

  return (
    <div className="text-xs">
      <div className="mb-2 px-1.5 py-1 rounded bg-gray-800/60 border border-gray-700/50">
        <div className="text-gray-400 font-medium mb-1">摘要</div>
        {summaryLines.map((line, i) => (
          <div key={i} className="text-gray-200">{line}</div>
        ))}
      </div>
      {activeFlags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-1">
          {activeFlags.map((f) => (
            <span key={f.label} className={`px-1.5 py-0.5 rounded bg-gray-700/50 ${f.color}`}>
              {f.label}
            </span>
          ))}
        </div>
      )}
      <div className="border border-gray-700 rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 text-gray-400">
              <th className="px-1.5 py-1 text-left">#</th>
              <th className="px-1.5 py-1 text-right">傷/脈</th>
              <th className="px-1.5 py-1 text-right">寬</th>
              <th className="px-1.5 py-1 text-center">擊退</th>
              <th className="px-1.5 py-1 text-center">折射</th>
              <th className="px-1.5 py-1 text-center">聚焦</th>
              <th className="px-1.5 py-1 text-center">稜鏡</th>
              <th className="px-1.5 py-1 text-center">尾段</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.beams.map((b, i) => (
              <tr key={i} className="border-t border-gray-700/50">
                <td className="px-1.5 py-1 text-gray-500">{i + 1}</td>
                <td className="px-1.5 py-1 text-right text-white">{b.pulseDamage}</td>
                <td className="px-1.5 py-1 text-right text-white">{b.width}px</td>
                <td className="px-1.5 py-1 text-center">
                  {b.hasKnockback ? <span className="text-amber-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {b.hasRefraction ? <span className="text-cyan-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {b.hasFocusBurn ? <span className="text-orange-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {b.hasPrismSplit ? <span className="text-purple-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {b.hasOverloadTail ? <span className="text-red-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 可用卡片（點擊加入插槽）；已達數量上限時 disabled 並顯示「已達上限」 */
function AvailableCard({ card, onAdd, disabled = false }: { card: CardDefinition; onAdd: () => void; disabled?: boolean }) {
  const colors = rarityColors[card.rarity]

  return (
    <button
      onClick={disabled ? undefined : onAdd}
      disabled={disabled}
      className={`p-2.5 rounded-lg border text-left transition-all group ${disabled ? 'opacity-60 cursor-not-allowed border-gray-600 bg-gray-800/50' : `${colors.border} ${colors.bg} hover:brightness-125`}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-xs">{card.name}</span>
        <span className={`text-[10px] ${disabled ? 'text-gray-500' : colors.text}`}>{rarityNames[card.rarity]}</span>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed mb-1">{card.description}</p>
      <p className="text-[10px] text-gray-500 leading-relaxed italic">
        ⚡ {card.orderNote}
      </p>
      <div className="text-right mt-1">
        {disabled ? (
          <span className="text-[10px] text-amber-400">已達上限</span>
        ) : (
          <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
            + 加入插槽
          </span>
        )}
      </div>
    </button>
  )
}

// ── Canvas 繪製（已抽取至 src/rendering/drawFunctions.ts） ──
