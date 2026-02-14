import type { GameState } from '../models/GameEngine'

/** HUD 設定（無限模式用） */
export interface HudConfig {
  playerHp: number
  playerMaxHp: number
  waveNumber: number
  score: number
  killCount: number
  waveTarget: number
  killStreak: number
  survivalTime: number
  invincibleUntil: number
}

/** 繪製遊戲畫面 */
export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, hud?: HudConfig) {
  const { canvasWidth, canvasHeight, player, enemies, projectiles, damageNumbers, coldZones, iceSpikeEffects, iceSpikeMines, frozenGroundShards, resonanceWaves, fireballProjectiles, fireExplosions, lavaZones, burningCorpses, beamEffects, beamTrails, mapPickups } = state

  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  drawGrid(ctx, canvasWidth, canvasHeight)

  const now = performance.now()

  // 熔岩區域（最底層）
  for (const lava of lavaZones) drawLavaZone(ctx, lava, now)

  // 寒氣區域（在敵人/投射物之下）
  for (const cz of coldZones) drawColdZone(ctx, cz, now)

  // 凍土地雷（在敵人之下）
  for (const mine of iceSpikeMines) drawFrozenGroundMine(ctx, mine, now)

  // 凍土扇形區域（在敵人之下）
  for (const zone of iceSpikeEffects) drawFrozenGroundZone(ctx, zone, now)

  // 碎冰飛濺小冰刺
  for (const shard of frozenGroundShards) drawFrozenGroundShard(ctx, shard)

  // 共振波（在敵人之下）
  for (const wave of resonanceWaves) drawResonanceWave(ctx, wave, now)

  // 火焰爆炸（在敵人之下）
  for (const exp of fireExplosions) drawFireExplosion(ctx, exp, now)

  // 燃燒屍體
  for (const corpse of burningCorpses) drawBurningCorpse(ctx, corpse, now)

  // 光束殘影（在光束之下）
  for (const trail of beamTrails) drawBeamTrail(ctx, trail, now)

  // 光束效果（在敵人之下）
  for (const beam of beamEffects) drawBeamEffect(ctx, beam, now)

  for (const enemy of enemies) drawEnemy(ctx, enemy)

  // 地圖掉落物（強化碎片）
  for (const p of mapPickups ?? []) drawMapPickup(ctx, p, now)

  drawPlayerFacingIndicator(ctx, player, state.playerFacingAngle)
  for (const proj of projectiles) drawProjectile(ctx, proj)
  for (const fb of fireballProjectiles) drawFireballProjectile(ctx, fb)

  // 主角（含受傷震動 + 紅色疊層）
  drawPlayer(ctx, player, hud?.invincibleUntil)

  for (const dn of damageNumbers) drawDamageNumber(ctx, dn, now)

  if (hud) {
    drawHud(ctx, canvasWidth, hud)
  }
}

/** 繪製地圖掉落物（強化碎片）：外框時鐘倒數，轉完消失 */
function drawMapPickup(
  ctx: CanvasRenderingContext2D,
  pickup: GameState['mapPickups'][0],
  now: number,
) {
  const { x, y } = pickup.position
  const elapsed = now - pickup.createdAt
  const duration = pickup.duration ?? 12000
  const remaining = Math.max(0, 1 - elapsed / duration)
  const pulse = 0.7 + 0.3 * Math.sin(elapsed / 400)
  const colors = {
    cooldown: '#4FC3F7',
    range: '#81C784',
    count: '#FFB74D',
  }
  const color = colors[pickup.type]
  const labels = { cooldown: '冷卻', range: '範圍', count: '數量' }
  const r = 16
  const strokeW = 4

  ctx.save()
  ctx.globalAlpha = pulse

  // 底色圓
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color + '33'
  ctx.fill()

  // 外框倒數（12 點方向順時針，剩餘時間 = 弧長）
  ctx.beginPath()
  ctx.arc(x, y, r + strokeW / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, false)
  ctx.strokeStyle = color + '55'
  ctx.lineWidth = strokeW
  ctx.lineCap = 'round'
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, r + strokeW / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining, false)
  ctx.strokeStyle = color
  ctx.lineWidth = strokeW
  ctx.lineCap = 'round'
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(labels[pickup.type], x, y)
  ctx.restore()
}

/** 繪製 HUD（無限模式用） */
function drawHud(ctx: CanvasRenderingContext2D, canvasWidth: number, hud: HudConfig) {
  ctx.save()

  // ── HP 條（左上） ──
  const hpBarX = 12
  const hpBarY = 12
  const hpBarW = 160
  const hpBarH = 14
  const hpRatio = Math.max(0, hud.playerHp / hud.playerMaxHp)
  const isLowHp = hpRatio < 0.3

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH)
  ctx.fillStyle = isLowHp ? '#EF5350' : '#66BB6A'
  ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.ceil(hud.playerHp)} / ${hud.playerMaxHp}`, hpBarX + hpBarW / 2, hpBarY + 11)

  // ── 分數（左上，HP 下方） ──
  ctx.textAlign = 'left'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillStyle = '#FFD54F'
  ctx.fillText(`Score: ${hud.score.toLocaleString()}`, hpBarX, hpBarY + hpBarH + 18)

  // ── 波次 + 擊殺進度（右上） ──
  ctx.textAlign = 'right'
  const rightX = canvasWidth - 12

  ctx.font = 'bold 14px sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText(`Wave ${hud.waveNumber}`, rightX, 24)

  // 擊殺進度條
  const progBarW = 120
  const progBarH = 8
  const progBarX = rightX - progBarW
  const progBarY = 30
  const killRatio = Math.min(1, hud.killCount / Math.max(1, hud.waveTarget))

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(progBarX, progBarY, progBarW, progBarH)
  ctx.fillStyle = '#4FC3F7'
  ctx.fillRect(progBarX, progBarY, progBarW * killRatio, progBarH)

  ctx.font = '10px sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillText(`${hud.killCount} / ${hud.waveTarget}`, rightX, progBarY + progBarH + 14)

  // ── 存活時間（右上，進度條下方） ──
  const totalSec = Math.floor(hud.survivalTime)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  ctx.font = '11px sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillText(`${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`, rightX, progBarY + progBarH + 28)

  // ── 連殺（中上，>= 3 時顯示） ──
  if (hud.killStreak >= 3) {
    ctx.textAlign = 'center'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = '#FF8A65'
    ctx.fillText(`×${hud.killStreak} Streak!`, canvasWidth / 2, 24)
  }

  ctx.restore()
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
  ctx.lineWidth = 1
  const step = 40
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
}

/** 繪製主角前方指示（尖角形：三圓角＋一尖端） */
function drawPlayerFacingIndicator(ctx: CanvasRenderingContext2D, player: GameState['player'], facingAngle: number) {
  const len = 50
  const halfAngle = (32 * Math.PI) / 180
  const cornerRad = 14
  const x = player.position.x
  const y = player.position.y

  const tipX = x + Math.cos(facingAngle) * len
  const tipY = y + Math.sin(facingAngle) * len
  const leftAngle = facingAngle - halfAngle
  const rightAngle = facingAngle + halfAngle
  const baseLen = len * 0.4
  const baseLeft = { x: x + Math.cos(leftAngle) * baseLen, y: y + Math.sin(leftAngle) * baseLen }
  const baseRight = { x: x + Math.cos(rightAngle) * baseLen, y: y + Math.sin(rightAngle) * baseLen }
  const backCenter = { x: x - Math.cos(facingAngle) * len * 0.2, y: y - Math.sin(facingAngle) * len * 0.2 }

  ctx.save()
  ctx.globalAlpha = 0.4

  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(baseLeft.x, baseLeft.y)
  ctx.quadraticCurveTo(backCenter.x - Math.cos(leftAngle) * cornerRad, backCenter.y - Math.sin(leftAngle) * cornerRad, backCenter.x, backCenter.y)
  ctx.quadraticCurveTo(backCenter.x - Math.cos(rightAngle) * cornerRad, backCenter.y - Math.sin(rightAngle) * cornerRad, baseRight.x, baseRight.y)
  ctx.lineTo(tipX, tipY)
  ctx.closePath()
  ctx.fillStyle = 'rgba(100, 200, 255, 0.35)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(150, 220, 255, 0.55)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: GameState['player'], invincibleUntil?: number) {
  const { x, y } = player.position
  const r = player.size
  const now = performance.now()
  const isInvincible = invincibleUntil != null && now < invincibleUntil
  const hitTimeLeft = invincibleUntil != null ? invincibleUntil - now : 0
  /** 剛受傷的前 300ms 震動+紅色 */
  const justHit = hitTimeLeft > 200

  // 主角位置加震動偏移（半徑減半）
  let dx = x, dy = y
  if (justHit) {
    const intensity = Math.min(2.5, hitTimeLeft / 120)
    dx += (Math.random() - 0.5) * intensity * 2
    dy += (Math.random() - 0.5) * intensity * 2
  }

  if (isInvincible) {
    // 半透明紅色圓形覆蓋（縮小範圍）
    const redAlpha = Math.min(0.35, hitTimeLeft / 500 * 0.35)
    ctx.beginPath()
    ctx.arc(dx, dy, r + 7, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 40, 40, ${redAlpha})`
    ctx.fill()

    // 閃爍
    ctx.globalAlpha = Math.sin(now / 50) > 0 ? 0.35 : 0.95
  }

  // 外圈光暈
  ctx.beginPath()
  ctx.arc(dx, dy, r + 6, 0, Math.PI * 2)
  ctx.fillStyle = isInvincible ? 'rgba(255, 80, 80, 0.25)' : 'rgba(79, 195, 247, 0.15)'
  ctx.fill()

  // 主體
  ctx.beginPath()
  ctx.arc(dx, dy, r, 0, Math.PI * 2)
  ctx.fillStyle = isInvincible ? '#E57373' : player.color
  ctx.fill()
  ctx.strokeStyle = isInvincible ? 'rgba(255,100,100,0.9)' : 'rgba(255,255,255,0.4)'
  ctx.lineWidth = isInvincible ? 3 : 2
  ctx.stroke()

  if (isInvincible) {
    ctx.globalAlpha = 1.0
  }
}

export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: GameState['enemies'][0]) {
  const { x, y } = enemy.position
  const r = enemy.size
  const now = performance.now()
  const isFrozen = enemy.frozenUntil > 0 && now < enemy.frozenUntil
  const isSlow = !isFrozen && enemy.slowUntil > 0 && now < enemy.slowUntil
  const isBurning = enemy.burnUntil > 0 && now < enemy.burnUntil

  // 灼燒光暈
  if (isBurning && !isFrozen) {
    ctx.beginPath()
    ctx.arc(x, y, r + 6, 0, Math.PI * 2)
    const pulse = 0.5 + 0.3 * Math.sin(now / 150)
    ctx.fillStyle = `rgba(255, 100, 0, ${pulse * 0.2})`
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 120, 0, ${pulse * 0.5})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // 冰封光暈
  if (isFrozen) {
    ctx.beginPath()
    ctx.arc(x, y, r + 8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(100, 200, 255, 0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // 失溫（減速）光暈
  if (isSlow) {
    ctx.beginPath()
    ctx.arc(x, y, r + 5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(150, 220, 255, 0.35)'
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = isFrozen ? '#4FC3F7' : isBurning ? '#FF7043' : isSlow ? '#90CAF9' : enemy.color
  ctx.fill()
  ctx.strokeStyle = isFrozen ? 'rgba(100, 200, 255, 0.8)' : isBurning ? 'rgba(255, 120, 0, 0.6)' : isSlow ? 'rgba(150, 220, 255, 0.6)' : 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  ctx.stroke()

  const barWidth = r * 2
  const barHeight = 4
  const barX = x - r
  const barY = y - r - 10
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(barX, barY, barWidth, barHeight)
  ctx.fillStyle = isFrozen ? '#64B5F6' : isBurning ? '#FF7043' : isSlow ? '#90CAF9' : '#4CAF50'
  ctx.fillRect(barX, barY, barWidth * Math.max(0, enemy.hp / enemy.maxHp), barHeight)

  // 巡邏範圍指示
  if (enemy.patrol && !isFrozen) {
    const p = enemy.patrol
    ctx.beginPath()
    ctx.moveTo(p.centerX - p.range, y)
    ctx.lineTo(p.centerX + p.range, y)
    ctx.strokeStyle = 'rgba(255, 167, 38, 0.2)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

}

export function drawProjectile(ctx: CanvasRenderingContext2D, proj: GameState['projectiles'][0]) {
  const { x, y } = proj.position
  const angle = Math.atan2(proj.velocity.y, proj.velocity.x)

  if (proj.skillId === 'ice-arrow') {
    // 碎片用較小、較暗的視覺
    const scale = proj.isFragment ? 0.65 : 1
    const alpha = proj.isFragment ? 0.6 : 1

    ctx.save()
    ctx.globalAlpha = alpha

    // 拖尾
    const tailLen = 12 * scale
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - Math.cos(angle) * tailLen, y - Math.sin(angle) * tailLen)
    ctx.strokeStyle = proj.isFragment ? 'rgba(79, 195, 247, 0.25)' : 'rgba(79, 195, 247, 0.4)'
    ctx.lineWidth = 3 * scale
    ctx.stroke()

    // 箭頭
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(8 * scale, 0)
    ctx.lineTo(-4 * scale, -4 * scale)
    ctx.lineTo(-2 * scale, 0)
    ctx.lineTo(-4 * scale, 4 * scale)
    ctx.closePath()
    ctx.fillStyle = proj.isFragment ? '#B3E5FC' : '#81D4FA'
    ctx.fill()

    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }
}

export function drawColdZone(
  ctx: CanvasRenderingContext2D,
  cz: GameState['coldZones'][0],
  now: number,
) {
  const elapsed = now - cz.createdAt
  const progress = elapsed / cz.duration
  const alpha = (1 - progress) * 0.35

  ctx.save()
  ctx.globalAlpha = Math.max(0, alpha)

  // 外圈光暈
  const gradient = ctx.createRadialGradient(
    cz.position.x, cz.position.y, 0,
    cz.position.x, cz.position.y, cz.radius,
  )
  gradient.addColorStop(0, 'rgba(100, 200, 255, 0.4)')
  gradient.addColorStop(0.6, 'rgba(100, 200, 255, 0.15)')
  gradient.addColorStop(1, 'rgba(100, 200, 255, 0)')

  ctx.beginPath()
  ctx.arc(cz.position.x, cz.position.y, cz.radius, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()

  // 邊緣圓環
  ctx.beginPath()
  ctx.arc(cz.position.x, cz.position.y, cz.radius * 0.8, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

/** 繪製凍土扇形區域 */
export function drawFrozenGroundZone(
  ctx: CanvasRenderingContext2D,
  zone: GameState['iceSpikeEffects'][0],
  now: number,
) {
  const elapsed = now - zone.createdAt
  const progress = elapsed / zone.duration
  const alpha = Math.max(0, 1 - progress * 0.3) * 0.6 * (zone.isSpreadZone ? 0.7 : 1)

  ctx.save()
  ctx.globalAlpha = alpha

  const { origin, direction, arcAngle, radius, isCage, doubleHitFlashUntil } = zone
  const showDoubleHitFlash = doubleHitFlashUntil != null && now < doubleHitFlashUntil

  if (isCage) {
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, radius)
    grad.addColorStop(0, 'rgba(100, 200, 255, 0.12)')
    grad.addColorStop(1, 'rgba(60, 160, 220, 0.04)')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
  } else {
    const halfArc = (arcAngle * Math.PI) / 180 / 2
    const a1 = direction - halfArc
    const a2 = direction + halfArc
    ctx.beginPath()
    ctx.moveTo(origin.x, origin.y)
    ctx.arc(origin.x, origin.y, radius, a1, a2)
    ctx.closePath()
    const grad = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, radius)
    grad.addColorStop(0, 'rgba(100, 200, 255, 0.15)')
    grad.addColorStop(0.6, 'rgba(80, 180, 240, 0.08)')
    grad.addColorStop(1, 'rgba(60, 160, 220, 0.03)')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  if (showDoubleHitFlash) {
    ctx.save()
    const flashAlpha = (doubleHitFlashUntil! - now) / 200 * 0.5
    ctx.globalAlpha = flashAlpha
    if (isCage) {
      ctx.beginPath()
      ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(200, 255, 255, 0.6)'
      ctx.fill()
    } else {
      const halfArc = (arcAngle * Math.PI) / 180 / 2
      ctx.beginPath()
      ctx.moveTo(origin.x, origin.y)
      ctx.arc(origin.x, origin.y, radius, direction - halfArc, direction + halfArc)
      ctx.closePath()
      ctx.fillStyle = 'rgba(200, 255, 255, 0.5)'
      ctx.fill()
    }
    ctx.restore()
  }

  ctx.restore()
}

/** 繪製碎冰飛濺小冰刺 */
export function drawFrozenGroundShard(
  ctx: CanvasRenderingContext2D,
  shard: GameState['frozenGroundShards'][0],
) {
  const alpha = Math.max(0, 1 - shard.traveled / shard.maxDistance)
  ctx.save()
  ctx.globalAlpha = alpha * 0.8
  ctx.beginPath()
  ctx.arc(shard.position.x, shard.position.y, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(150, 220, 255, 0.9)'
  ctx.fill()

  ctx.restore()
}

/** 繪製凍土地雷（潛伏時脈衝圓環；非牢籠時顯示觸發方向） */
export function drawFrozenGroundMine(
  ctx: CanvasRenderingContext2D,
  mine: GameState['iceSpikeMines'][0],
  now: number,
) {
  if (mine.triggered) return

  const elapsed = now - mine.createdAt
  const pulse = 0.5 + 0.5 * Math.sin(elapsed / 300)
  const { x, y } = mine.position
  const r = mine.detectRadius

  ctx.save()
  ctx.globalAlpha = 0.3 + pulse * 0.2

  ctx.beginPath()
  ctx.arc(x, y, r + 4, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)'
  ctx.lineWidth = 1
  ctx.setLineDash([2, 3])
  ctx.stroke()
  ctx.setLineDash([])

  // 中心標記
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(150, 220, 255, 0.6)'
  ctx.fill()

  // 非牢籠：繪製觸發方向（扇形示意）
  if (!mine.isCage) {
    const dir = mine.direction
    const halfArc = (mine.arcAngle * Math.PI) / 180 / 2
    const startAngle = dir - halfArc
    const endAngle = dir + halfArc
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, r * 0.7, startAngle, endAngle)
    ctx.closePath()
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(100, 200, 255, 0.08)'
    ctx.fill()
  }

  // 微弱光暈
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
  glow.addColorStop(0, 'rgba(100, 200, 255, 0.15)')
  glow.addColorStop(1, 'rgba(100, 200, 255, 0)')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()

  ctx.restore()
}

/** 繪製共振波（擴散圓環） */
export function drawResonanceWave(
  ctx: CanvasRenderingContext2D,
  wave: GameState['resonanceWaves'][0],
  now: number,
) {
  const elapsed = now - wave.createdAt
  const progress = Math.min(1, elapsed / wave.duration)
  const currentRadius = wave.maxRadius * progress
  const alpha = (1 - progress) * 0.6

  ctx.save()
  ctx.globalAlpha = Math.max(0, alpha)

  // 擴散圓環
  ctx.beginPath()
  ctx.arc(wave.position.x, wave.position.y, currentRadius, 0, Math.PI * 2)
  ctx.strokeStyle = '#80DEEA'
  ctx.lineWidth = 3
  ctx.stroke()

  // 內部填充
  ctx.beginPath()
  ctx.arc(wave.position.x, wave.position.y, currentRadius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(128, 222, 234, 0.08)'
  ctx.fill()

  ctx.restore()
}

/** 繪製火球投射物（飛行中） */
export function drawFireballProjectile(
  ctx: CanvasRenderingContext2D,
  fb: GameState['fireballProjectiles'][0],
) {
  const { x, y } = fb.position

  // ── 隕石模式：延遲中顯示落點指示 ──
  if (fb.isMeteor && fb.delay > 0) {
    const progress = 1 - fb.delay / 0.8
    const shadowR = 8 + progress * 14

    ctx.save()
    // 落點指示圈（逐漸變大）
    ctx.beginPath()
    ctx.arc(x, y, shadowR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 80, 0, ${0.1 + progress * 0.15})`
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 120, 0, ${0.3 + progress * 0.4})`
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // 高空火球（從小到大）
    const meteorR = 3 + progress * 5
    ctx.beginPath()
    ctx.arc(x, y - 30 + progress * 20, meteorR, 0, Math.PI * 2)
    const g = ctx.createRadialGradient(x, y - 30 + progress * 20, 0, x, y - 30 + progress * 20, meteorR)
    g.addColorStop(0, '#FFEB3B')
    g.addColorStop(0.5, '#FF9800')
    g.addColorStop(1, '#F44336')
    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()
    return
  }

  // ── 裂焰擴散碎片：較小的火花 ──
  if (fb.isScatter) {
    const angle = Math.atan2(fb.velocity.y, fb.velocity.x)
    ctx.save()
    // 拖尾
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - Math.cos(angle) * 8, y - Math.sin(angle) * 8)
    ctx.strokeStyle = 'rgba(255, 180, 0, 0.4)'
    ctx.lineWidth = 2
    ctx.stroke()
    // 火花本體
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    const sg = ctx.createRadialGradient(x, y, 0, x, y, 4)
    sg.addColorStop(0, '#FFEB3B')
    sg.addColorStop(1, '#FF9800')
    ctx.fillStyle = sg
    ctx.fill()
    ctx.restore()
    return
  }

  // ── 一般火球 ──
  const angle = Math.atan2(fb.velocity.y, fb.velocity.x)
  const progress = fb.maxDistance > 0 ? fb.distanceTraveled / fb.maxDistance : 0
  const arcHeight = Math.sin(progress * Math.PI) * 20

  ctx.save()

  // 地面影子
  ctx.beginPath()
  ctx.ellipse(x, y + 4, 6, 3, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.fill()

  // 尾焰
  const tailLen = 14
  ctx.beginPath()
  ctx.moveTo(x, y - arcHeight)
  ctx.lineTo(
    x - Math.cos(angle) * tailLen,
    y - arcHeight - Math.sin(angle) * tailLen,
  )
  ctx.strokeStyle = 'rgba(255, 152, 0, 0.4)'
  ctx.lineWidth = 4
  ctx.stroke()

  // 火球本體（略高於地面）
  const gradient = ctx.createRadialGradient(x, y - arcHeight, 0, x, y - arcHeight, 8)
  gradient.addColorStop(0, '#FFEB3B')
  gradient.addColorStop(0.4, '#FF9800')
  gradient.addColorStop(1, '#F44336')

  ctx.beginPath()
  ctx.arc(x, y - arcHeight, 7, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()

  // 外光暈
  ctx.beginPath()
  ctx.arc(x, y - arcHeight, 10, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 152, 0, 0.15)'
  ctx.fill()

  ctx.restore()
}

/** 繪製火焰爆炸效果 */
export function drawFireExplosion(
  ctx: CanvasRenderingContext2D,
  exp: GameState['fireExplosions'][0],
  now: number,
) {
  const elapsed = now - exp.createdAt
  const progress = elapsed / exp.duration
  const alpha = Math.max(0, 1 - progress)
  const expandProgress = Math.min(1, progress * 2) // 前半段快速擴展
  const currentRadius = exp.radius * (0.3 + expandProgress * 0.7)

  ctx.save()
  ctx.globalAlpha = alpha

  // 爆炸填充
  const gradient = ctx.createRadialGradient(
    exp.position.x, exp.position.y, 0,
    exp.position.x, exp.position.y, currentRadius,
  )
  gradient.addColorStop(0, 'rgba(255, 235, 59, 0.6)')
  gradient.addColorStop(0.3, 'rgba(255, 152, 0, 0.4)')
  gradient.addColorStop(0.7, 'rgba(244, 67, 54, 0.2)')
  gradient.addColorStop(1, 'rgba(244, 67, 54, 0)')

  ctx.beginPath()
  ctx.arc(exp.position.x, exp.position.y, currentRadius, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()

  // 爆炸邊緣環
  ctx.beginPath()
  ctx.arc(exp.position.x, exp.position.y, currentRadius * 0.85, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255, 152, 0, ${alpha * 0.5})`
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.restore()
}

/** 繪製熔岩區域 */
export function drawLavaZone(
  ctx: CanvasRenderingContext2D,
  lava: GameState['lavaZones'][0],
  now: number,
) {
  const elapsed = now - lava.createdAt
  const progress = elapsed / lava.duration
  const alpha = Math.max(0, 1 - progress * 0.6) // 緩慢淡出

  ctx.save()
  ctx.globalAlpha = alpha

  const gradient = ctx.createRadialGradient(
    lava.position.x, lava.position.y, 0,
    lava.position.x, lava.position.y, lava.radius,
  )
  gradient.addColorStop(0, 'rgba(255, 87, 34, 0.35)')
  gradient.addColorStop(0.5, 'rgba(255, 152, 0, 0.2)')
  gradient.addColorStop(0.8, 'rgba(255, 87, 34, 0.1)')
  gradient.addColorStop(1, 'rgba(255, 87, 34, 0)')

  ctx.beginPath()
  ctx.arc(lava.position.x, lava.position.y, lava.radius, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()

  // 邊緣脈衝
  const pulse = 0.5 + 0.3 * Math.sin(now / 200)
  ctx.beginPath()
  ctx.arc(lava.position.x, lava.position.y, lava.radius * 0.85, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255, 120, 0, ${pulse * 0.3})`
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

/** 繪製燃燒屍體 */
export function drawBurningCorpse(
  ctx: CanvasRenderingContext2D,
  corpse: GameState['burningCorpses'][0],
  now: number,
) {
  const elapsed = now - corpse.createdAt
  const progress = elapsed / corpse.duration
  const alpha = Math.max(0, 1 - progress)
  const flicker = 0.6 + 0.4 * Math.sin(now / 100)

  ctx.save()
  ctx.globalAlpha = alpha

  // 屍體底部
  ctx.beginPath()
  ctx.arc(corpse.position.x, corpse.position.y, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#5D4037'
  ctx.fill()

  // 火焰效果
  ctx.beginPath()
  ctx.arc(corpse.position.x, corpse.position.y - 4, 6 * flicker, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 152, 0, ${flicker * 0.6})`
  ctx.fill()

  ctx.beginPath()
  ctx.arc(corpse.position.x, corpse.position.y - 6, 4 * flicker, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 235, 59, ${flicker * 0.5})`
  ctx.fill()

  ctx.restore()
}

/** 繪製單段光束矩形（共用邏輯） */
export function drawBeamRect(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  angle: number,
  range: number,
  width: number,
  alpha: number,
  isOverloaded: boolean,
) {
  const halfWidth = width / 2

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(originX, originY)
  ctx.rotate(angle)

  // 光束主體
  const gradient = ctx.createLinearGradient(0, 0, range, 0)
  if (isOverloaded) {
    gradient.addColorStop(0, 'rgba(255, 255, 150, 0.7)')
    gradient.addColorStop(0.3, 'rgba(255, 200, 50, 0.55)')
    gradient.addColorStop(0.7, 'rgba(255, 150, 0, 0.35)')
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)')
  } else {
    gradient.addColorStop(0, 'rgba(255, 200, 50, 0.5)')
    gradient.addColorStop(0.3, 'rgba(255, 150, 0, 0.35)')
    gradient.addColorStop(0.7, 'rgba(255, 100, 0, 0.2)')
    gradient.addColorStop(1, 'rgba(255, 80, 0, 0)')
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, -halfWidth, range, width)

  // 核心線
  const coreWidth = Math.max(2, halfWidth * 0.4)
  const coreGradient = ctx.createLinearGradient(0, 0, range, 0)
  coreGradient.addColorStop(0, isOverloaded ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 200, 0.7)')
  coreGradient.addColorStop(0.4, isOverloaded ? 'rgba(255, 255, 150, 0.6)' : 'rgba(255, 230, 100, 0.4)')
  coreGradient.addColorStop(1, 'rgba(255, 200, 50, 0)')
  ctx.fillStyle = coreGradient
  ctx.fillRect(0, -coreWidth, range, coreWidth * 2)

  // 邊緣線
  ctx.strokeStyle = `rgba(255, 180, 50, ${alpha * 0.3})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -halfWidth)
  ctx.lineTo(range, -halfWidth)
  ctx.moveTo(0, halfWidth)
  ctx.lineTo(range, halfWidth)
  ctx.stroke()

  ctx.restore()
}

/** 繪製光束效果（v3：脈衝制，含子光束、過載） */
export function drawBeamEffect(
  ctx: CanvasRenderingContext2D,
  beam: GameState['beamEffects'][0],
  now: number,
) {
  const elapsed = now - beam.createdAt

  const timeRemaining = beam.duration - elapsed
  const isOverloaded = beam.hasOverload && timeRemaining <= 500
  const widthMul = isOverloaded ? 2 : 1

  const progress = elapsed / beam.duration
  const alpha = beam.singleShot
    ? Math.max(0.4, 1 - progress * 0.8)
    : (() => {
        const sincePulse = now - beam.lastPulseTime
        return sincePulse < 80 ? 1 : Math.max(0.1, 0.3 - (sincePulse - 80) / beam.pulseInterval)
      })()

  const { origin, angle, range, width } = beam
  const effectiveWidth = width * widthMul

  // 主光束
  drawBeamRect(ctx, origin.x, origin.y, angle, range, effectiveWidth, alpha, isOverloaded)

  // 起點光暈
  const halfWidth = effectiveWidth / 2
  ctx.save()
  ctx.globalAlpha = alpha
  const glow = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, halfWidth + 8)
  glow.addColorStop(0, isOverloaded ? 'rgba(255, 255, 200, 0.6)' : 'rgba(255, 220, 100, 0.4)')
  glow.addColorStop(0.5, 'rgba(255, 180, 50, 0.15)')
  glow.addColorStop(1, 'rgba(255, 150, 0, 0)')
  ctx.beginPath()
  ctx.arc(origin.x, origin.y, halfWidth + 8, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()
  ctx.restore()

  // 子光束段（折射/稜鏡）
  for (const seg of beam.childSegments) {
    const childAlpha = alpha * 0.7
    drawBeamRect(ctx, seg.origin.x, seg.origin.y, seg.angle, seg.range, seg.width * widthMul, childAlpha, isOverloaded)
  }

  // 過載閃光指示
  if (isOverloaded) {
    const flashPhase = Math.sin(now / 60) * 0.5 + 0.5
    ctx.save()
    ctx.globalAlpha = flashPhase * 0.3
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, halfWidth + 16, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFDE7'
    ctx.fill()
    ctx.restore()
  }
}

/** 繪製光束殘影（灼熱殘影金卡） */
export function drawBeamTrail(
  ctx: CanvasRenderingContext2D,
  trail: GameState['beamTrails'][0],
  now: number,
) {
  const elapsed = now - trail.createdAt
  const progress = elapsed / trail.duration
  const alpha = Math.max(0, (1 - progress) * 0.35)

  const { origin, angle, range, width } = trail
  const halfWidth = width / 2

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(origin.x, origin.y)
  ctx.rotate(angle)

  // 殘影主體（偏紅橘色、透明度較低）
  const gradient = ctx.createLinearGradient(0, 0, range, 0)
  gradient.addColorStop(0, 'rgba(255, 120, 50, 0.4)')
  gradient.addColorStop(0.5, 'rgba(255, 80, 30, 0.25)')
  gradient.addColorStop(1, 'rgba(255, 60, 20, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, -halfWidth, range, width)

  // 邊緣虛線
  ctx.strokeStyle = 'rgba(255, 100, 30, 0.2)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(0, -halfWidth)
  ctx.lineTo(range, -halfWidth)
  ctx.moveTo(0, halfWidth)
  ctx.lineTo(range, halfWidth)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.restore()
}

export function drawDamageNumber(
  ctx: CanvasRenderingContext2D,
  dn: GameState['damageNumbers'][0],
  now: number,
) {
  const elapsed = now - dn.createdAt
  const progress = elapsed / dn.duration
  const alpha = 1 - progress
  const offsetY = -progress * 30

  const size = dn.fontSize ?? 14

  ctx.save()
  ctx.globalAlpha = Math.max(0, alpha)
  ctx.fillStyle = dn.color ?? '#FFD54F'
  ctx.font = `bold ${size}px sans-serif`
  ctx.textAlign = 'center'
  if (size > 14) {
    // 大字加描邊更醒目
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 3
    ctx.strokeText(`-${dn.damage}`, dn.position.x, dn.position.y + offsetY)
  }
  ctx.fillText(`-${dn.damage}`, dn.position.x, dn.position.y + offsetY)
  ctx.restore()
}
