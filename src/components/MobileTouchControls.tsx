/**
 * 手機版虛擬搖桿（方向控制器）
 *
 * 左下角固定區域，觸碰拖曳決定移動方向。
 * 中心灰色圓圈會隨觸控方向偏移，提供操作回饋。
 * 使用 pointer 事件以支援觸控與滑鼠。
 */
import { useRef, useCallback, useEffect, useState } from 'react'

interface MobileTouchControlsProps {
  onMove: (dx: number, dy: number) => void
  onEnd: () => void
  size?: number
  deadZone?: number
  /** 'bottom-left' 左下角固定 | 'center' 置中（用於右側搖桿區） */
  placement?: 'bottom-left' | 'center'
}

export default function MobileTouchControls({
  onMove,
  onEnd,
  size = 120,
  deadZone = 0.15,
  placement = 'bottom-left',
}: MobileTouchControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isActiveRef = useRef(false)
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 })

  /** 取得觸控點相對於中心的 -1~1 方向（用於移動輸出，含 dead zone） */
  const getNormalized = useCallback(
    (clientX: number, clientY: number): { dx: number; dy: number } | null => {
      const el = containerRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = (clientX - cx) / (rect.width / 2)
      let dy = (clientY - cy) / (rect.height / 2)
      dx = Math.max(-1, Math.min(1, dx))
      dy = Math.max(-1, Math.min(1, dy))
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < deadZone) return { dx: 0, dy: 0 }
      return { dx, dy }
    },
    [deadZone],
  )

  /** 取得觸控點相對於中心的 -1~1 方向（用於視覺，單位圓內，不含 dead zone） */
  const getStickPosition = useCallback(
    (clientX: number, clientY: number): { dx: number; dy: number } | null => {
      const el = containerRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = (clientX - cx) / (rect.width / 2)
      let dy = (clientY - cy) / (rect.height / 2)
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 1) {
        dx /= len
        dy /= len
      }
      return { dx, dy }
    },
    [],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      isActiveRef.current = true
      const pos = getStickPosition(e.clientX, e.clientY)
      if (pos) setStickOffset({ x: pos.dx, y: pos.dy })
      const n = getNormalized(e.clientX, e.clientY)
      if (n) onMove(n.dx, n.dy)
    },
    [getNormalized, getStickPosition, onMove],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isActiveRef.current) return
      e.preventDefault()
      const pos = getStickPosition(e.clientX, e.clientY)
      if (pos) setStickOffset({ x: pos.dx, y: pos.dy })
      const n = getNormalized(e.clientX, e.clientY)
      if (n) onMove(n.dx, n.dy)
    },
    [getNormalized, getStickPosition, onMove],
  )

  const handlePointerUp = useCallback(() => {
    isActiveRef.current = false
    setStickOffset({ x: 0, y: 0 })
    onEnd()
  }, [onEnd])

  const handlePointerCancel = useCallback(() => {
    isActiveRef.current = false
    setStickOffset({ x: 0, y: 0 })
    onEnd()
  }, [onEnd])

  useEffect(() => {
    const handleGlobalUp = () => {
      if (isActiveRef.current) {
        isActiveRef.current = false
        setStickOffset({ x: 0, y: 0 })
        onEnd()
      }
    }
    window.addEventListener('pointerup', handleGlobalUp)
    window.addEventListener('pointercancel', handleGlobalUp)
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp)
      window.removeEventListener('pointercancel', handleGlobalUp)
    }
  }, [onEnd])

  const isCenter = placement === 'center'
  const thumbRadius = size * 0.125
  const maxTravel = size * 0.5 - thumbRadius
  const offsetPxX = stickOffset.x * maxTravel
  const offsetPxY = stickOffset.y * maxTravel

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: isCenter ? 'relative' : 'absolute',
        ...(isCenter ? {} : { left: 12, bottom: 12 }),
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.4)',
        border: '2px solid rgba(255,255,255,0.3)',
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'default',
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: size * 0.25,
          height: size * 0.25,
          marginTop: -(size * 0.125) + offsetPxY,
          marginLeft: -(size * 0.125) + offsetPxX,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
          transition: isActiveRef.current ? 'none' : 'margin 0.1s ease-out',
        }}
      />
    </div>
  )
}
