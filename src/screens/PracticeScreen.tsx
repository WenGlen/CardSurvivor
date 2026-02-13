import { useEffect, useRef, useCallback, useState, useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import { GameEngine } from '../models/GameEngine'
import { allSkills } from '../models/skills'
import {
  iceArrowCards,
  iceSpikeCards,
  fireballCards,
  beamCards,
  computeIceArrowSnapshot,
  computeIceSpikeSnapshot,
  computeFireballSnapshot,
  computeBeamSnapshot,
  rarityColors,
  rarityNames,
} from '../models/cards'
import type { CardDefinition, ArrowInstance, IceSpikeSnapshot, FireballSnapshot, BeamSnapshot } from '../models/cards'
import { drawGame } from '../rendering/drawFunctions'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

/** 練習場畫面 - 不動敵人 + 可操控主角 + 右側卡片堆疊面板 */
export default function PracticeScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [activeSkillId, setActiveSkillId] = useState<string>('ice-arrow')
  const [cardSlots, setCardSlots] = useState<Record<string, CardDefinition[]>>({
    'ice-arrow': [],
    'ice-spike': [],
    'fireball': [],
    'beam': [],
  })
  const [enemyHp, setEnemyHp] = useState(9999)
  const [, forceRender] = useState(0)

  const triggerRender = useCallback(() => {
    forceRender((n) => n + 1)
  }, [])

  const cardSlot = cardSlots[activeSkillId] ?? []

  // 計算快照
  const iceArrowSnap = useMemo(
    () => computeIceArrowSnapshot(cardSlots['ice-arrow'] ?? []),
    [cardSlots],
  )
  const iceSpikeSnap = useMemo(
    () => computeIceSpikeSnapshot(cardSlots['ice-spike'] ?? []),
    [cardSlots],
  )
  const fireballSnap = useMemo(
    () => computeFireballSnapshot(cardSlots['fireball'] ?? []),
    [cardSlots],
  )
  const beamSnap = useMemo(
    () => computeBeamSnapshot(cardSlots['beam'] ?? []),
    [cardSlots],
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
    setCardSlots((prev) => ({
      ...prev,
      [activeSkillId]: [...(prev[activeSkillId] ?? []), card],
    }))
  }

  const handleRemoveCard = (index: number) => {
    setCardSlots((prev) => ({
      ...prev,
      [activeSkillId]: (prev[activeSkillId] ?? []).filter((_, i) => i !== index),
    }))
  }

  const handleMoveCard = (index: number, direction: -1 | 1) => {
    setCardSlots((prev) => {
      const slot = [...(prev[activeSkillId] ?? [])]
      const target = index + direction
      if (target < 0 || target >= slot.length) return prev
      ;[slot[index], slot[target]] = [slot[target], slot[index]]
      return { ...prev, [activeSkillId]: slot }
    })
  }

  const handleClearSlot = () => {
    setCardSlots((prev) => ({ ...prev, [activeSkillId]: [] }))
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

  return (
    <div className="flex h-screen bg-gray-900 text-white select-none">
      {/* 左側：遊戲區域 + 數值面板 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 overflow-y-auto">
        {/* Canvas */}
        <div className="relative shrink-0">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="rounded-lg border border-gray-700"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
          />
          <div className="absolute bottom-2 left-2 text-xs text-gray-500">
            WASD 移動 · 拖曳木樁可移動位置
          </div>
        </div>

        {/* 快照預覽 + 控制列 */}
        <div className="w-full max-w-[800px] shrink-0 flex flex-col gap-2">
          {activeSkillId === 'ice-arrow' ? (
            <SnapshotPreview arrows={iceArrowSnap.arrows} cooldown={iceArrowSnap.cooldown} />
          ) : activeSkillId === 'ice-spike' ? (
            <IceSpikePreview snapshot={iceSpikeSnap} />
          ) : activeSkillId === 'fireball' ? (
            <FireballPreview snapshot={fireballSnap} />
          ) : (
            <BeamPreview snapshot={beamSnap} />
          )}

          {/* 控制列 */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-400 shrink-0">木樁 HP:</span>
            {[50, 200, 9999].map((hp) => (
              <button
                key={hp}
                onClick={() => { setEnemyHp(hp); engineRef.current?.setEnemyMaxHp(hp) }}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  enemyHp === hp ? 'bg-cyan-700 text-white' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {hp}
              </button>
            ))}
            <div className="w-px h-5 bg-gray-700 mx-1" />
            <button
              onClick={handleAddEnemy}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              + 木樁
            </button>
            <button
              onClick={handleAddMovingEnemy}
              className="px-3 py-1 bg-orange-900/50 hover:bg-orange-800/50 rounded text-xs text-orange-300 transition-colors"
            >
              + 移動
            </button>
            <button
              onClick={handleRemoveEnemy}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              - 木樁
            </button>
            <div className="w-px h-5 bg-gray-700 mx-1" />
            <button
              onClick={handleReset}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              重置場景
            </button>
          </div>
        </div>
      </div>

      {/* 右側：卡片專區 */}
      <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
        {/* 技能切換 Tab */}
        <div className="flex border-b border-gray-700">
          {([
            { id: 'ice-arrow', name: '冰箭' },
            { id: 'ice-spike', name: '冰錐' },
            { id: 'fireball', name: '火球' },
            { id: 'beam', name: '光束' },
          ] as const).map((skill) => (
            <button
              key={skill.id}
              onClick={() => handleSwitchSkill(skill.id)}
              className={`flex-1 py-2.5 text-sm font-bold text-center transition-colors ${
                activeSkillId === skill.id
                  ? 'bg-gray-700 text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
              }`}
            >
              {skill.name}
            </button>
          ))}
        </div>

        {/* 副標題 */}
        <div className="px-3 py-2 border-b border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            卡片順序不同 → 效果不同
          </p>
        </div>

        {/* 可滾動區域 */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
          {/* 卡片插槽 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-cyan-300">卡片插槽</h3>
              {cardSlot.length > 0 && (
                <button
                  onClick={handleClearSlot}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  清空
                </button>
              )}
            </div>

            {cardSlot.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4 border border-dashed border-gray-600 rounded-lg">
                從下方選擇卡片加入
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {cardSlot.map((card, i) => (
                  <SlotCardItem
                    key={`${card.id}-${i}`}
                    card={card}
                    index={i}
                    total={cardSlot.length}
                    onRemove={() => handleRemoveCard(i)}
                    onMoveUp={() => handleMoveCard(i, -1)}
                    onMoveDown={() => handleMoveCard(i, 1)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 可用卡片 */}
          <section>
            <h3 className="text-sm font-semibold text-cyan-300 mb-2">可用卡片</h3>
            <div className="flex flex-col gap-2">
              {(activeSkillId === 'ice-arrow' ? iceArrowCards : activeSkillId === 'ice-spike' ? iceSpikeCards : activeSkillId === 'fireball' ? fireballCards : beamCards).map((card) => (
                <AvailableCard
                  key={card.id}
                  card={card}
                  onAdd={() => handleAddCard(card)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── 子元件 ──

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

/** 快照預覽表格 */
function SnapshotPreview({ arrows, cooldown }: { arrows: ArrowInstance[]; cooldown: number }) {
  return (
    <div className="text-xs">
      <div className="text-gray-400 mb-1">
        冷卻 <span className="text-white">{cooldown}s</span>
        {' · '}
        總箭數 <span className="text-white">{arrows.length}</span>
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
              <th className="px-1.5 py-1 text-center">寒氣</th>
              <th className="px-1.5 py-1 text-center">聚合</th>
              <th className="px-1.5 py-1 text-center">連鎖</th>
            </tr>
          </thead>
          <tbody>
            {arrows.map((arrow, i) => (
              <tr key={i} className="border-t border-gray-700/50">
                <td className="px-1.5 py-1 text-gray-500">{i + 1}</td>
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
                  {arrow.hasColdZone ? <span className="text-yellow-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasConvergence ? <span className="text-blue-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-1.5 py-1 text-center">
                  {arrow.hasChainExplosion ? <span className="text-orange-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 冰錐快照預覽 */
function IceSpikePreview({ snapshot }: { snapshot: IceSpikeSnapshot }) {
  const flags: { label: string; active: boolean; color: string }[] = [
    { label: '蔓延', active: snapshot.hasSpread, color: 'text-cyan-300' },
    { label: '牢籠', active: snapshot.isCage, color: 'text-blue-300' },
    { label: '地雷', active: snapshot.isMine, color: 'text-purple-300' },
    { label: '蔓延地雷', active: snapshot.spreadIsMine, color: 'text-purple-200' },
    { label: '永凍', active: snapshot.hasPermafrost, color: 'text-yellow-300' },
    { label: '共振', active: snapshot.hasResonance, color: 'text-orange-300' },
  ]
  const activeFlags = flags.filter((f) => f.active)

  return (
    <div className="text-xs">
      <div className="text-gray-400 mb-1 flex gap-3 flex-wrap">
        <span>冷卻 <span className="text-white">{snapshot.cooldown}s</span></span>
        <span>{snapshot.isCage ? '圓環' : '弧度'} <span className="text-white">{snapshot.isCage ? '360°' : `${snapshot.arcAngle}°`}</span></span>
        <span>距離 <span className="text-white">{snapshot.castRange}px</span></span>
        <span>柱數 <span className="text-white">{snapshot.pillarCount}</span></span>
        <span>傷害 <span className="text-white">{snapshot.isMine ? `${Math.round(snapshot.damage * 1.5)}(x1.5)` : snapshot.damage}</span></span>
      </div>
      {activeFlags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-1">
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
  // 收集全局行為標籤
  const flags: { label: string; active: boolean; color: string }[] = [
    { label: '野火', active: snapshot.fireballs.some((f) => f.hasWildfire), color: 'text-orange-300' },
    { label: '連爆', active: snapshot.fireballs.some((f) => f.hasChainExplosion), color: 'text-red-300' },
  ]
  const activeFlags = flags.filter((f) => f.active)

  return (
    <div className="text-xs">
      <div className="text-gray-400 mb-1 flex gap-3 flex-wrap">
        <span>冷卻 <span className="text-white">{snapshot.cooldown}s</span></span>
        <span>距離 <span className="text-white">{snapshot.throwDistance}px</span></span>
        <span>數量 <span className="text-white">{snapshot.fireballs.length}</span></span>
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

/** 光束快照預覽 */
function BeamPreview({ snapshot }: { snapshot: BeamSnapshot }) {
  // 收集全局行為標籤
  const flags: { label: string; active: boolean; color: string }[] = [
    { label: '殘影', active: snapshot.beams.some((b) => b.hasBurningTrail), color: 'text-orange-300' },
    { label: '過載', active: snapshot.beams.some((b) => b.hasOverload), color: 'text-red-300' },
  ]
  const activeFlags = flags.filter((f) => f.active)

  return (
    <div className="text-xs">
      <div className="text-gray-400 mb-1 flex gap-3 flex-wrap">
        <span>冷卻 <span className="text-white">{snapshot.cooldown}s</span></span>
        <span>射程 <span className="text-white">{snapshot.range}px</span></span>
        <span>持續 <span className="text-white">{snapshot.duration}s</span></span>
        <span>數量 <span className="text-white">{snapshot.beams.length}</span></span>
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
              <th className="px-1.5 py-1 text-right">DPS</th>
              <th className="px-1.5 py-1 text-right">寬度</th>
              <th className="px-1.5 py-1 text-center">折射</th>
              <th className="px-1.5 py-1 text-center">聚焦</th>
              <th className="px-1.5 py-1 text-center">稜鏡</th>
              <th className="px-1.5 py-1 text-center">脈衝</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.beams.map((b, i) => (
              <tr key={i} className="border-t border-gray-700/50">
                <td className="px-1.5 py-1 text-gray-500">{i + 1}</td>
                <td className="px-1.5 py-1 text-right text-white">{b.dps}</td>
                <td className="px-1.5 py-1 text-right text-white">{b.width}px</td>
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
                  {b.isPulseMode ? <span className="text-yellow-300">✓</span> : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 可用卡片（點擊加入插槽） */
function AvailableCard({ card, onAdd }: { card: CardDefinition; onAdd: () => void }) {
  const colors = rarityColors[card.rarity]

  return (
    <button
      onClick={onAdd}
      className={`p-2.5 rounded-lg border ${colors.border} ${colors.bg} text-left transition-all hover:brightness-125 group`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-xs">{card.name}</span>
        <span className={`text-[10px] ${colors.text}`}>{rarityNames[card.rarity]}</span>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed mb-1">{card.description}</p>
      <p className="text-[10px] text-gray-500 leading-relaxed italic">
        ⚡ {card.orderNote}
      </p>
      <div className="text-right mt-1">
        <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
          + 加入插槽
        </span>
      </div>
    </button>
  )
}

// ── Canvas 繪製（已抽取至 src/rendering/drawFunctions.ts） ──
