import type { Entity, Projectile, Position, DamageNumber, ColdZone, IceSpikeEffect, IceSpikeMine, ResonanceWave, FireballProjectile, FireExplosion, LavaZone, BurningCorpse, BeamEffect, BeamSegment, BeamTrail, SkillDefinition } from './types'
import type { IceArrowSnapshot, IceSpikeSnapshot, FireballSnapshot, BeamSnapshot } from './cards'

/** 遊戲模式設定（預設為練習場行為） */
export interface GameModeConfig {
  /** 敵人死亡時回呼 */
  onEnemyKilled?: (enemy: Entity) => void
  /** true = 移除死亡敵人, false = 重置 HP（練習場） */
  removeDeadEnemies?: boolean
  /** 敵人追擊玩家 */
  enableEnemyAI?: boolean
  /** 敵人接觸傷害 */
  enablePlayerDamage?: boolean
  /** 接觸傷害值（每次） */
  contactDamage?: number
  /** 同時發動所有有快照的技能 */
  fireAllEquippedSkills?: boolean
  /** 不生成初始敵人 */
  noInitialEnemies?: boolean
}

/** 遊戲引擎狀態 */
export interface GameState {
  player: Entity
  enemies: Entity[]
  projectiles: Projectile[]
  damageNumbers: DamageNumber[]
  coldZones: ColdZone[]
  iceSpikeEffects: IceSpikeEffect[]
  iceSpikeMines: IceSpikeMine[]
  resonanceWaves: ResonanceWave[]
  fireballProjectiles: FireballProjectile[]
  fireExplosions: FireExplosion[]
  lavaZones: LavaZone[]
  burningCorpses: BurningCorpse[]
  beamEffects: BeamEffect[]
  beamTrails: BeamTrail[]
  activeSkillId: string | null
  skillCooldowns: Map<string, number>
  keysPressed: Set<string>
  canvasWidth: number
  canvasHeight: number
  /** 玩家無敵結束時間戳（ms） */
  invincibleUntil: number
}

/** 遊戲引擎 - 管理遊戲循環（練習場 / 無限模式） */
export class GameEngine {
  state: GameState
  private skills: Map<string, SkillDefinition> = new Map()
  private iceArrowSnapshot: IceArrowSnapshot | null = null
  private iceSpikeSnapshot: IceSpikeSnapshot | null = null
  private fireballSnapshot: FireballSnapshot | null = null
  private beamSnapshot: BeamSnapshot | null = null
  private convergenceTracker: Map<string, { time: number; damage: number }[]> = new Map()
  private enemyMaxHp = 9999
  private nextId = 0
  private lastTime = 0
  private animFrameId = 0
  private onStateChange: () => void
  private modeConfig: GameModeConfig
  /** 本幀中死亡的敵人 id（批次移除用） */
  private deadEnemyIds: Set<string> = new Set()

  constructor(canvasWidth: number, canvasHeight: number, onStateChange: () => void, modeConfig?: GameModeConfig) {
    this.onStateChange = onStateChange
    this.modeConfig = modeConfig ?? {}

    const initialEnemies: Entity[] = this.modeConfig.noInitialEnemies ? [] : [
      {
        id: 'enemy-0',
        position: { x: (canvasWidth / 3) * 2, y: canvasHeight / 2 },
        size: 14,
        hp: 9999,
        maxHp: 9999,
        speed: 0,
        color: '#EF5350',
        frozenUntil: 0,
        frozenDamage: 0,
        slowUntil: 0,
        burnDps: 0,
        burnUntil: 0,
      },
    ]

    this.state = {
      player: {
        id: 'player',
        position: { x: canvasWidth / 3, y: canvasHeight / 2 },
        size: 18,
        hp: 100,
        maxHp: 100,
        speed: 160,
        color: '#4FC3F7',
        frozenUntil: 0,
        frozenDamage: 0,
        slowUntil: 0,
        burnDps: 0,
        burnUntil: 0,
      },
      enemies: initialEnemies,
      projectiles: [],
      damageNumbers: [],
      coldZones: [],
      iceSpikeEffects: [],
      iceSpikeMines: [],
      resonanceWaves: [],
      fireballProjectiles: [],
      fireExplosions: [],
      lavaZones: [],
      burningCorpses: [],
      beamEffects: [],
      beamTrails: [],
      activeSkillId: null,
      skillCooldowns: new Map(),
      keysPressed: new Set(),
      canvasWidth,
      canvasHeight,
      invincibleUntil: 0,
    }
  }

  registerSkill(skill: SkillDefinition) {
    this.skills.set(skill.id, skill)
  }

  setIceArrowSnapshot(snapshot: IceArrowSnapshot) {
    this.iceArrowSnapshot = snapshot
  }

  setIceSpikeSnapshot(snapshot: IceSpikeSnapshot) {
    this.iceSpikeSnapshot = snapshot
  }

  setFireballSnapshot(snapshot: FireballSnapshot) {
    this.fireballSnapshot = snapshot
  }

  setBeamSnapshot(snapshot: BeamSnapshot) {
    this.beamSnapshot = snapshot
  }

  setActiveSkill(skillId: string | null) {
    this.state.activeSkillId = skillId
    this.onStateChange()
  }

  private genId(): string {
    return `${++this.nextId}`
  }

  /**
   * 統一處理敵人死亡。
   * 練習場模式：重置 HP（原有行為）。
   * 無限模式：標記移除 + 呼叫回呼。
   */
  private handleEnemyDeath(enemy: Entity) {
    if (this.modeConfig.removeDeadEnemies) {
      this.modeConfig.onEnemyKilled?.(enemy)
      this.deadEnemyIds.add(enemy.id)
    } else {
      enemy.hp = enemy.maxHp
      enemy.frozenUntil = 0
      enemy.frozenDamage = 0
      enemy.slowUntil = 0
      enemy.burnDps = 0
      enemy.burnUntil = 0
    }
  }

  /** 敵人追擊玩家 AI */
  private updateEnemyAI(dt: number) {
    const { player, enemies } = this.state
    const now = performance.now()
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue
      // 凍結中不移動
      if (enemy.frozenUntil > 0 && now < enemy.frozenUntil) continue
      const slowMul = (enemy.slowUntil > 0 && now < enemy.slowUntil) ? 0.7 : 1
      const dx = player.position.x - enemy.position.x
      const dy = player.position.y - enemy.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 1) {
        enemy.position.x += (dx / dist) * enemy.speed * slowMul * dt
        enemy.position.y += (dy / dist) * enemy.speed * slowMul * dt
      }
    }
  }

  /** 玩家碰撞傷害（敵人接觸扣血） */
  private updatePlayerCollision() {
    const { player, enemies, invincibleUntil } = this.state
    const now = performance.now()
    if (now < invincibleUntil) return

    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue
      const dx = player.position.x - enemy.position.x
      const dy = player.position.y - enemy.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < player.size + enemy.size) {
        const dmg = this.modeConfig.contactDamage ?? 5
        player.hp -= dmg
        this.state.invincibleUntil = now + 500 // 0.5 秒無敵
        this.spawnDamageNumber(player.position, dmg, '#FF5252', 22)
        break // 一次只受一擊
      }
    }
  }

  /** 多技能同時冷卻與發動 */
  private updateAllSkillCooldowns(dt: number) {
    const { skillCooldowns } = this.state
    for (const [skillId, skill] of this.skills) {
      // 只發動有快照的技能
      if (!this.getSnapshotForSkill(skillId)) continue
      const cooldown = this.getCooldownForSkill(skillId, skill)
      const remaining = (skillCooldowns.get(skillId) ?? 0) - dt
      if (remaining <= 0) {
        this.fireSkill(skill)
        skillCooldowns.set(skillId, cooldown + remaining)
      } else {
        skillCooldowns.set(skillId, remaining)
      }
    }
  }

  /** 取得技能快照 */
  private getSnapshotForSkill(skillId: string): unknown {
    switch (skillId) {
      case 'ice-arrow': return this.iceArrowSnapshot
      case 'ice-spike': return this.iceSpikeSnapshot
      case 'fireball': return this.fireballSnapshot
      case 'beam': return this.beamSnapshot
      default: return null
    }
  }

  /** 取得技能總冷卻時間 */
  getCooldownForSkill(skillId: string, skill: SkillDefinition): number {
    switch (skillId) {
      case 'ice-arrow': return this.iceArrowSnapshot?.cooldown ?? (skill.initialStats.cooldown ?? 1)
      case 'ice-spike': return this.iceSpikeSnapshot?.cooldown ?? (skill.initialStats.cooldown ?? 1)
      case 'fireball': return this.fireballSnapshot?.cooldown ?? (skill.initialStats.cooldown ?? 1)
      case 'beam': return this.beamSnapshot?.cooldown ?? (skill.initialStats.cooldown ?? 1)
      default: return skill.initialStats.cooldown ?? 1
    }
  }

  /** 從畫面邊緣生成敵人（無限模式） */
  spawnEnemyAtEdge(config: { hp: number; speed: number; size: number; color: string }) {
    const { canvasWidth, canvasHeight, player } = this.state
    const buffer = 30

    // 決定生成邊（偏好離玩家較遠的邊）
    const px = player.position.x / canvasWidth
    const py = player.position.y / canvasHeight
    const edges = [
      { edge: 0, weight: py },           // top: 玩家越靠下，越可能生在上方
      { edge: 1, weight: 1 - px },       // right
      { edge: 2, weight: 1 - py },       // bottom
      { edge: 3, weight: px },           // left
    ]
    const totalWeight = edges.reduce((s, e) => s + e.weight, 0)
    let r = Math.random() * totalWeight
    let edge = 0
    for (const e of edges) {
      r -= e.weight
      if (r <= 0) { edge = e.edge; break }
    }

    let x: number, y: number
    switch (edge) {
      case 0: x = Math.random() * canvasWidth; y = -buffer; break
      case 1: x = canvasWidth + buffer; y = Math.random() * canvasHeight; break
      case 2: x = Math.random() * canvasWidth; y = canvasHeight + buffer; break
      default: x = -buffer; y = Math.random() * canvasHeight; break
    }

    const enemy: Entity = {
      id: `enemy-${this.genId()}`,
      position: { x, y },
      size: config.size,
      hp: config.hp,
      maxHp: config.hp,
      speed: config.speed,
      color: config.color,
      frozenUntil: 0,
      frozenDamage: 0,
      slowUntil: 0,
      burnDps: 0,
      burnUntil: 0,
    }
    this.state.enemies.push(enemy)
  }

  /** 清除所有敵人與效果（波次切換用） */
  clearAllEnemiesAndEffects() {
    this.state.enemies = []
    this.state.projectiles = []
    this.state.fireballProjectiles = []
    this.state.beamEffects = []
    this.state.beamTrails = []
    this.state.iceSpikeEffects = []
    this.state.iceSpikeMines = []
    this.state.resonanceWaves = []
    this.state.fireExplosions = []
    this.state.lavaZones = []
    this.state.burningCorpses = []
    this.state.coldZones = []
    this.state.damageNumbers = []
    this.convergenceTracker.clear()
  }

  /** 重置玩家位置到畫面中央 */
  resetPlayerPosition() {
    this.state.player.position = {
      x: this.state.canvasWidth / 2,
      y: this.state.canvasHeight / 2,
    }
  }

  private paused = false

  start() {
    this.lastTime = performance.now()
    const loop = (now: number) => {
      if (!this.paused) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.05)
        this.lastTime = now
        this.update(dt)
        this.onStateChange()
      } else {
        this.lastTime = now
      }
      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.animFrameId)
  }

  pause() { this.paused = true }
  resume() { this.paused = false; this.lastTime = performance.now() }
  get isPaused() { return this.paused }

  keyDown(key: string) {
    this.state.keysPressed.add(key.toLowerCase())
  }

  keyUp(key: string) {
    this.state.keysPressed.delete(key.toLowerCase())
  }

  private update(dt: number) {
    this.deadEnemyIds.clear()
    this.updatePlayerMovement(dt)

    // 敵人移動：AI 追擊或巡邏
    if (this.modeConfig.enableEnemyAI) {
      this.updateEnemyAI(dt)
    } else {
      this.updateEnemyPatrol(dt)
    }

    // 技能冷卻：多技能同時或單技能
    if (this.modeConfig.fireAllEquippedSkills) {
      this.updateAllSkillCooldowns(dt)
    } else {
      this.updateSkillCooldowns(dt)
    }

    this.updateProjectiles(dt)
    this.updateFireballs(dt)
    this.updateFireExplosions()
    this.updateLavaZones(dt)
    this.updateBurningCorpses(dt)
    this.updateBeamEffects(dt)
    this.updateBeamTrails(dt)
    this.updateIceSpikeEffects()
    this.updateIceSpikeMines()
    this.updateResonanceWaves()
    this.updateDamageNumbers()
    this.updateColdZones()
    this.updateFrozenEnemies()

    // 玩家碰撞傷害
    if (this.modeConfig.enablePlayerDamage) {
      this.updatePlayerCollision()
    }

    // 批次移除死亡敵人
    if (this.deadEnemyIds.size > 0) {
      this.state.enemies = this.state.enemies.filter(e => !this.deadEnemyIds.has(e.id))
    }
  }

  private updatePlayerMovement(dt: number) {
    const { player, keysPressed, canvasWidth, canvasHeight } = this.state
    let dx = 0
    let dy = 0

    if (keysPressed.has('w') || keysPressed.has('arrowup')) dy -= 1
    if (keysPressed.has('s') || keysPressed.has('arrowdown')) dy += 1
    if (keysPressed.has('a') || keysPressed.has('arrowleft')) dx -= 1
    if (keysPressed.has('d') || keysPressed.has('arrowright')) dx += 1

    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy)
      dx /= len
      dy /= len
    }

    player.position.x += dx * player.speed * dt
    player.position.y += dy * player.speed * dt

    const margin = player.size
    player.position.x = Math.max(margin, Math.min(canvasWidth - margin, player.position.x))
    player.position.y = Math.max(margin, Math.min(canvasHeight - margin, player.position.y))
  }

  /** 更新巡邏木樁的左右移動（冰封時暫停） */
  private updateEnemyPatrol(dt: number) {
    const now = performance.now()
    for (const enemy of this.state.enemies) {
      if (!enemy.patrol) continue
      if (enemy.frozenUntil > 0 && now < enemy.frozenUntil) continue

      const p = enemy.patrol
      const slowMul = (enemy.slowUntil > 0 && now < enemy.slowUntil) ? 0.7 : 1
      enemy.position.x += p.speed * p.direction * dt * slowMul

      if (enemy.position.x >= p.centerX + p.range) {
        enemy.position.x = p.centerX + p.range
        p.direction = -1
      } else if (enemy.position.x <= p.centerX - p.range) {
        enemy.position.x = p.centerX - p.range
        p.direction = 1
      }
    }
  }

  private updateSkillCooldowns(dt: number) {
    const { activeSkillId, skillCooldowns } = this.state
    if (!activeSkillId) return

    const skill = this.skills.get(activeSkillId)
    if (!skill) return

    const cooldown =
      activeSkillId === 'ice-arrow' && this.iceArrowSnapshot
        ? this.iceArrowSnapshot.cooldown
        : activeSkillId === 'ice-spike' && this.iceSpikeSnapshot
          ? this.iceSpikeSnapshot.cooldown
          : activeSkillId === 'fireball' && this.fireballSnapshot
            ? this.fireballSnapshot.cooldown
            : activeSkillId === 'beam' && this.beamSnapshot
              ? this.beamSnapshot.cooldown
              : (skill.initialStats.cooldown ?? 1)

    const remaining = (skillCooldowns.get(activeSkillId) ?? 0) - dt

    if (remaining <= 0) {
      this.fireSkill(skill)
      skillCooldowns.set(activeSkillId, cooldown + remaining)
    } else {
      skillCooldowns.set(activeSkillId, remaining)
    }
  }

  private fireSkill(skill: SkillDefinition) {
    if (skill.id === 'ice-arrow' && this.iceArrowSnapshot) {
      this.fireIceArrowFromSnapshot()
    } else if (skill.id === 'ice-spike') {
      this.fireIceSpike()
    } else if (skill.id === 'fireball') {
      this.fireFireball()
    } else if (skill.id === 'beam') {
      this.fireBeam()
    } else if (skill.damageType === 'PROJECTILE') {
      this.fireProjectileSkill(skill)
    }
  }

  /** 根據快照發射冰箭（每支箭有獨立屬性） */
  private fireIceArrowFromSnapshot() {
    const snapshot = this.iceArrowSnapshot!
    const { player } = this.state
    const arrows = snapshot.arrows
    const count = arrows.length

    const target = this.findNearestEnemy(player.position)
    let baseAngle = 0
    if (target) {
      baseAngle = Math.atan2(
        target.position.y - player.position.y,
        target.position.x - player.position.x,
      )
    }

    const spreadRad = (snapshot.spreadAngle * Math.PI) / 180
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : -spreadRad / 2 + (spreadRad / (count - 1)) * i
      const angle = baseAngle + offset
      const arrow = arrows[i]

      this.state.projectiles.push({
        id: this.genId(),
        skillId: 'ice-arrow',
        position: { x: player.position.x, y: player.position.y },
        velocity: {
          x: Math.cos(angle) * arrow.speed,
          y: Math.sin(angle) * arrow.speed,
        },
        damage: arrow.damage,
        speed: arrow.speed,
        pierceCount: arrow.pierceCount,
        hasSplit: arrow.hasSplit,
        splitDamageRatio: arrow.splitDamageRatio,
        splitCount: arrow.splitCount,
        splitAngle: arrow.splitAngle,
        isFragment: arrow.isFragment,
        hasTracking: arrow.hasTracking,
        trackingTurnSpeed: arrow.trackingTurnSpeed,
        hasColdZone: arrow.hasColdZone,
        hasConvergence: arrow.hasConvergence,
        hasChainExplosion: arrow.hasChainExplosion,
        chainDepth: 0,
        hitEnemies: new Set(),
        alive: true,
      })
    }
  }

  private fireProjectileSkill(skill: SkillDefinition) {
    const { player } = this.state
    const stats = skill.initialStats
    const count = stats.count ?? 1
    const spreadAngle = stats.spreadAngle ?? 0
    const speed = stats.speed ?? 200
    const damage = stats.damage ?? 10

    const target = this.findNearestEnemy(player.position)
    let baseAngle = 0
    if (target) {
      baseAngle = Math.atan2(
        target.position.y - player.position.y,
        target.position.x - player.position.x,
      )
    }

    const spreadRad = (spreadAngle * Math.PI) / 180
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : -spreadRad / 2 + (spreadRad / (count - 1)) * i
      const angle = baseAngle + offset

      this.state.projectiles.push({
        id: this.genId(),
        skillId: skill.id,
        position: { x: player.position.x, y: player.position.y },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        damage,
        speed,
        pierceCount: stats.pierceCount ?? 0,
        hasSplit: false,
        splitDamageRatio: 0,
        splitCount: 0,
        splitAngle: 0,
        isFragment: false,
        hasTracking: false,
        trackingTurnSpeed: 0,
        hasColdZone: false,
        hasConvergence: false,
        hasChainExplosion: false,
        chainDepth: 0,
        hitEnemies: new Set(),
        alive: true,
      })
    }
  }

  /** 發射冰錐：根據快照處理弧形/牢籠/地雷/蔓延/共振等模式 */
  private fireIceSpike() {
    const snapshot = this.iceSpikeSnapshot
    if (!snapshot) return

    const { player } = this.state
    const { arcAngle, castRange, pillarCount, damage, hasSpread, isCage, isMine, spreadIsMine, hasResonance } = snapshot

    const target = this.findNearestEnemy(player.position)
    let baseAngle = 0
    if (target) {
      baseAngle = Math.atan2(
        target.position.y - player.position.y,
        target.position.x - player.position.x,
      )
    }

    // ── 1. 計算主冰錐柱位置 ──
    const pillarPositions: Position[] = []

    if (isCage) {
      // 牢籠模式：封閉圓環，以目標方向 castRange 處為圓心，半徑 60px
      const cageCenter: Position = {
        x: player.position.x + Math.cos(baseAngle) * castRange,
        y: player.position.y + Math.sin(baseAngle) * castRange,
      }
      const cageRadius = 60
      for (let i = 0; i < pillarCount; i++) {
        const angle = (2 * Math.PI / pillarCount) * i
        pillarPositions.push({
          x: cageCenter.x + Math.cos(angle) * cageRadius,
          y: cageCenter.y + Math.sin(angle) * cageRadius,
        })
      }
    } else {
      // 弧形模式
      const arcRad = (arcAngle * Math.PI) / 180
      for (let i = 0; i < pillarCount; i++) {
        const offset = pillarCount === 1 ? 0 : -arcRad / 2 + (arcRad / (pillarCount - 1)) * i
        const angle = baseAngle + offset
        pillarPositions.push({
          x: player.position.x + Math.cos(angle) * castRange,
          y: player.position.y + Math.sin(angle) * castRange,
        })
      }
    }

    // ── 2. 計算蔓延冰錐位置（牢籠模式下無效） ──
    const spreadPositions: Position[] = []
    if (hasSpread && !isCage) {
      const arcRad = (arcAngle * Math.PI) / 180
      const spreadAngle = 80 / castRange // 80px 轉弧度
      const spreadPerSide = 2
      for (let side = -1; side <= 1; side += 2) {
        const edgeAngle = baseAngle + side * arcRad / 2
        for (let j = 1; j <= spreadPerSide; j++) {
          const angle = edgeAngle + side * (spreadAngle / spreadPerSide) * j
          spreadPositions.push({
            x: player.position.x + Math.cos(angle) * castRange,
            y: player.position.y + Math.sin(angle) * castRange,
          })
        }
      }
    }

    const now = performance.now()
    const hitRadius = 20

    // ── 3. 地雷模式：佈置地雷而非立即傷害 ──
    if (isMine) {
      // 主冰錐 → 地雷
      for (const pos of pillarPositions) {
        this.state.iceSpikeMines.push({
          id: this.genId(),
          position: { ...pos },
          damage: Math.round(damage * 1.5),
          detectRadius: hitRadius,
          createdAt: now,
          duration: 8000,
          triggered: false,
          triggerTime: 0,
        })
      }

      // 蔓延冰錐：如果 spreadIsMine 則也是地雷，否則立即觸發
      if (hasSpread && !isCage) {
        if (spreadIsMine) {
          for (const pos of spreadPositions) {
            this.state.iceSpikeMines.push({
              id: this.genId(),
              position: { ...pos },
              damage: Math.round(damage * 0.5 * 1.5),
              detectRadius: hitRadius,
              createdAt: now,
              duration: 8000,
              triggered: false,
              triggerTime: 0,
            })
          }
        } else {
          // 蔓延冰錐正常觸發
          const spreadDamage = Math.round(damage * 0.5)
          const spreadHit = new Set<string>()
          this.applyIceSpikeDamage(spreadPositions, spreadDamage, spreadHit, hitRadius, snapshot)
          this.state.iceSpikeEffects.push({
            id: this.genId(),
            pillarPositions: [],
            spreadPillarPositions: spreadPositions,
            damage: 0,
            spreadDamage,
            isCage: false,
            createdAt: now,
            duration: 500,
            hitEnemies: spreadHit,
          })
        }
      }
      return
    }

    // ── 4. 正常模式：立即傷害 ──
    const hitEnemies = new Set<string>()
    this.applyIceSpikeDamage(pillarPositions, damage, hitEnemies, hitRadius, snapshot)

    // 蔓延傷害
    const spreadDamage = Math.round(damage * 0.5)
    const spreadHit = new Set<string>()
    if (spreadPositions.length > 0) {
      this.applyIceSpikeDamage(spreadPositions, spreadDamage, spreadHit, hitRadius, snapshot)
    }

    // ── 5. 共振波：同時命中 3+ 敵人時觸發 ──
    if (hasResonance) {
      // 合併主冰錐和蔓延的命中
      const allHit = new Set([...hitEnemies, ...spreadHit])
      if (allHit.size >= 3) {
        this.spawnResonanceWave(pillarPositions, spreadPositions, damage)
      }
    }

    // ── 6. 建立視覺效果 ──
    const duration = isCage ? 3000 : 500
    this.state.iceSpikeEffects.push({
      id: this.genId(),
      pillarPositions,
      spreadPillarPositions: spreadPositions,
      damage,
      spreadDamage: spreadPositions.length > 0 ? spreadDamage : 0,
      isCage,
      createdAt: now,
      duration,
      hitEnemies,
    })
  }

  /** 冰錐傷害應用 + 失溫 + 永凍結晶判定 */
  private applyIceSpikeDamage(
    positions: Position[],
    damage: number,
    hitSet: Set<string>,
    hitRadius: number,
    snapshot: IceSpikeSnapshot,
  ) {
    const now = performance.now()
    for (const pos of positions) {
      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0) continue
        if (hitSet.has(enemy.id)) continue
        const dist = this.distance(pos, enemy.position)
        if (dist < hitRadius + enemy.size) {
          // 永凍結晶：命中失溫敵人 → 凍結 1.5s
          const isSlow = enemy.slowUntil > 0 && now < enemy.slowUntil
          let actualDmg = damage

          if (snapshot.hasPermafrost && isSlow) {
            enemy.frozenUntil = now + 1500
            enemy.frozenDamage = 0
            this.spawnDamageNumber(enemy.position, 0, '#80DEEA')
          }

          // 凍結中受傷 +25%
          if (enemy.frozenUntil > 0 && now < enemy.frozenUntil) {
            actualDmg = Math.round(damage * 1.25)
          }

          enemy.hp -= actualDmg
          hitSet.add(enemy.id)
          this.spawnDamageNumber(enemy.position, actualDmg)

          // 施加失溫（2 秒減速）
          enemy.slowUntil = now + 2000

          if (enemy.hp <= 0) {
            this.handleEnemyDeath(enemy)
          }
        }
      }
    }
  }

  /** 產生共振波：以命中區域中心為圓心 */
  private spawnResonanceWave(mainPositions: Position[], spreadPositions: Position[], baseDamage: number) {
    const all = [...mainPositions, ...spreadPositions]
    if (all.length === 0) return
    const cx = all.reduce((s, p) => s + p.x, 0) / all.length
    const cy = all.reduce((s, p) => s + p.y, 0) / all.length

    this.state.resonanceWaves.push({
      id: this.genId(),
      position: { x: cx, y: cy },
      maxRadius: 120,
      damage: Math.round(baseDamage * 0.8),
      createdAt: performance.now(),
      duration: 300,
      hitEnemies: new Set(),
    })
  }

  /** 發射火球：根據快照產生火球投射物群 */
  private fireFireball() {
    const snapshot = this.fireballSnapshot
    if (!snapshot) return

    const { player } = this.state
    const fbs = snapshot.fireballs
    const count = fbs.length

    const target = this.findNearestEnemy(player.position)
    let baseAngle = 0
    if (target) {
      baseAngle = Math.atan2(
        target.position.y - player.position.y,
        target.position.x - player.position.x,
      )
    }

    const spreadRad = (snapshot.spreadAngle * Math.PI) / 180
    const speed = 300

    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : -spreadRad / 2 + (spreadRad / (count - 1)) * i
      const angle = baseAngle + offset
      const fb = fbs[i]

      if (fb.isMeteor) {
        // 隕石模式：延遲落地，目標位置 ±30px 隨機偏移
        const dist = snapshot.throwDistance
        const tx = player.position.x + Math.cos(angle) * dist + (Math.random() - 0.5) * 60
        const ty = player.position.y + Math.sin(angle) * dist + (Math.random() - 0.5) * 60
        this.state.fireballProjectiles.push({
          id: this.genId(),
          position: { x: tx, y: ty },
          velocity: { x: 0, y: 0 },
          damage: fb.damage,
          explosionRadius: fb.explosionRadius,
          distanceTraveled: 0,
          maxDistance: 0,
          hasBounce: fb.hasBounce,
          hasLava: fb.hasLava,
          hasScatter: fb.hasScatter,
          isMeteor: true,
          hasWildfire: fb.hasWildfire,
          hasChainExplosion: fb.hasChainExplosion,
          delay: 0.8,
          targetPosition: { x: tx, y: ty },
          isScatter: false,
          alive: true,
        })
      } else {
        this.state.fireballProjectiles.push({
          id: this.genId(),
          position: { x: player.position.x, y: player.position.y },
          velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          damage: fb.damage,
          explosionRadius: fb.explosionRadius,
          distanceTraveled: 0,
          maxDistance: snapshot.throwDistance,
          hasBounce: fb.hasBounce,
          hasLava: fb.hasLava,
          hasScatter: fb.hasScatter,
          isMeteor: false,
          hasWildfire: fb.hasWildfire,
          hasChainExplosion: fb.hasChainExplosion,
          delay: 0,
          targetPosition: null,
          isScatter: false,
          alive: true,
        })
      }
    }
  }

  /** 更新火球飛行 → 到達目標距離後引爆 */
  private updateFireballs(dt: number) {
    const { fireballProjectiles, canvasWidth, canvasHeight } = this.state
    const margin = 50

    for (const fb of fireballProjectiles) {
      if (!fb.alive) continue

      // 隕石延遲倒數
      if (fb.delay > 0) {
        fb.delay -= dt
        if (fb.delay <= 0) {
          this.detonateFireball(fb)
          fb.alive = false
        }
        continue
      }

      const dx = fb.velocity.x * dt
      const dy = fb.velocity.y * dt
      fb.position.x += dx
      fb.position.y += dy
      fb.distanceTraveled += Math.sqrt(dx * dx + dy * dy)

      // 超出畫面
      if (
        fb.position.x < -margin ||
        fb.position.x > canvasWidth + margin ||
        fb.position.y < -margin ||
        fb.position.y > canvasHeight + margin
      ) {
        fb.alive = false
        continue
      }

      // 到達拋射距離 → 引爆
      if (fb.distanceTraveled >= fb.maxDistance) {
        this.detonateFireball(fb)
        fb.alive = false
      }
    }

    this.state.fireballProjectiles = fireballProjectiles.filter((f) => f.alive)
  }

  /** 火球引爆：範圍傷害 + 彈跳/熔岩/擴散/野火/連環爆破 */
  private detonateFireball(fb: FireballProjectile) {
    const now = performance.now()
    const { enemies } = this.state

    // ── 1. 連環爆破：先引爆灼燒敵人（在主傷害之前結算） ──
    if (fb.hasChainExplosion && !fb.isScatter) {
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue
        if (enemy.burnUntil <= 0 || now >= enemy.burnUntil) continue
        const dist = this.distance(fb.position, enemy.position)
        if (dist < fb.explosionRadius + enemy.size) {
          const remainSec = (enemy.burnUntil - now) / 1000
          const chainDmg = Math.round(enemy.burnDps * remainSec * 2)
          if (chainDmg > 0) {
            enemy.hp -= chainDmg
            this.spawnDamageNumber(enemy.position, chainDmg, '#FF6E40')
            enemy.burnDps = 0
            enemy.burnUntil = 0
          }
        }
      }
    }

    // ── 2. 主範圍傷害 ──
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue
      const dist = this.distance(fb.position, enemy.position)
      if (dist < fb.explosionRadius + enemy.size) {
        enemy.hp -= fb.damage
        this.spawnDamageNumber(enemy.position, fb.damage, '#FF8A65')

        if (enemy.hp <= 0) {
          // 野火燎原：擊殺敵人產生燃燒屍體
          if (fb.hasWildfire) {
            this.state.burningCorpses.push({
              id: this.genId(),
              position: { x: enemy.position.x, y: enemy.position.y },
              damage: Math.round(fb.damage * 0.2),
              createdAt: now,
              duration: 3000,
            })
          }
          this.handleEnemyDeath(enemy)
        }
      }
    }

    // ── 3. 引爆附近燃燒屍體（野火燎原互動） ──
    if (!fb.isScatter) {
      for (const corpse of this.state.burningCorpses) {
        const dist = this.distance(fb.position, corpse.position)
        if (dist < fb.explosionRadius + 14) {
          // 屍體爆炸：50% 傷害小範圍
          const corpseDmg = Math.round(fb.damage * 0.5)
          for (const enemy of enemies) {
            if (enemy.hp <= 0) continue
            const eDist = this.distance(corpse.position, enemy.position)
            if (eDist < 50 + enemy.size) {
              enemy.hp -= corpseDmg
              this.spawnDamageNumber(enemy.position, corpseDmg, '#FFAB40')
              if (enemy.hp <= 0) {
                this.handleEnemyDeath(enemy)
              }
            }
          }
          // 屍體爆炸視覺
          this.state.fireExplosions.push({
            id: this.genId(),
            position: { x: corpse.position.x, y: corpse.position.y },
            radius: 50,
            createdAt: now,
            duration: 300,
          })
          corpse.duration = 0 // 標記移除
        }
      }
    }

    // ── 4. 爆炸視覺效果 ──
    this.state.fireExplosions.push({
      id: this.genId(),
      position: { x: fb.position.x, y: fb.position.y },
      radius: fb.explosionRadius,
      createdAt: now,
      duration: 400,
    })

    // ── 5. 熔岩殘留 ──
    if (fb.hasLava && !fb.isScatter) {
      this.state.lavaZones.push({
        id: this.genId(),
        position: { x: fb.position.x, y: fb.position.y },
        radius: Math.round(fb.explosionRadius * 0.6),
        dps: Math.round(fb.damage * 0.2),
        createdAt: now,
        duration: 4000,
      })
    }

    // ── 6. 裂焰擴散：從爆炸邊緣射出 4 顆火花 ──
    if (fb.hasScatter && !fb.isScatter) {
      const sparkCount = 4
      const sparkSpeed = 250
      for (let i = 0; i < sparkCount; i++) {
        const angle = (2 * Math.PI / sparkCount) * i + Math.random() * 0.3
        const edgeX = fb.position.x + Math.cos(angle) * fb.explosionRadius * 0.5
        const edgeY = fb.position.y + Math.sin(angle) * fb.explosionRadius * 0.5
        this.state.fireballProjectiles.push({
          id: this.genId(),
          position: { x: edgeX, y: edgeY },
          velocity: { x: Math.cos(angle) * sparkSpeed, y: Math.sin(angle) * sparkSpeed },
          damage: Math.round(fb.damage * 0.3),
          explosionRadius: 40,
          distanceTraveled: 0,
          maxDistance: 120,
          hasBounce: false,
          hasLava: false,
          hasScatter: false,
          isMeteor: false,
          hasWildfire: fb.hasWildfire,
          hasChainExplosion: fb.hasChainExplosion,
          delay: 0,
          targetPosition: null,
          isScatter: true,
          alive: true,
        })
      }
    }

    // ── 7. 烈焰彈跳：向前 100px 產生彈跳火球 ──
    if (fb.hasBounce && !fb.isScatter) {
      const bounceAngle = Math.atan2(fb.velocity.y, fb.velocity.x)
      // 隕石沒有飛行方向，用隨機方向
      const angle = (fb.velocity.x === 0 && fb.velocity.y === 0)
        ? Math.random() * Math.PI * 2
        : bounceAngle
      const bounceSpeed = 300
      this.state.fireballProjectiles.push({
        id: this.genId(),
        position: { x: fb.position.x, y: fb.position.y },
        velocity: { x: Math.cos(angle) * bounceSpeed, y: Math.sin(angle) * bounceSpeed },
        damage: Math.round(fb.damage * 0.6),
        explosionRadius: fb.explosionRadius,
        distanceTraveled: 0,
        maxDistance: 100,
        hasBounce: false, // 不再二次彈跳
        hasLava: fb.hasLava, // 繼承熔岩
        hasScatter: fb.hasScatter, // 繼承擴散
        isMeteor: false,
        hasWildfire: fb.hasWildfire,
        hasChainExplosion: fb.hasChainExplosion,
        delay: 0,
        targetPosition: null,
        isScatter: false,
        alive: true,
      })
    }
  }

  /** 清理過期火焰爆炸效果 */
  private updateFireExplosions() {
    const now = performance.now()
    this.state.fireExplosions = this.state.fireExplosions.filter(
      (e) => now - e.createdAt < e.duration,
    )
  }

  /** 熔岩區域：每幀對範圍內敵人施加灼傷 DOT + 減速 */
  private updateLavaZones(dt: number) {
    const now = performance.now()
    for (const lava of this.state.lavaZones) {
      const elapsed = now - lava.createdAt
      if (elapsed >= lava.duration) continue

      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0) continue
        const dist = this.distance(lava.position, enemy.position)
        if (dist < lava.radius + enemy.size) {
          // DOT 傷害
          const dmg = lava.dps * dt
          enemy.hp -= dmg
          // 設定灼燒狀態（給連環爆破偵測用）
          enemy.burnDps = lava.dps
          enemy.burnUntil = now + 1000
          // 減速 25%
          enemy.slowUntil = Math.max(enemy.slowUntil, now + 500)

          if (enemy.hp <= 0) {
            this.spawnDamageNumber(enemy.position, Math.round(dmg), '#FF8A65')
            this.handleEnemyDeath(enemy)
          }
        }
      }
    }

    this.state.lavaZones = this.state.lavaZones.filter(
      (l) => now - l.createdAt < l.duration,
    )
  }

  /** 燃燒屍體：接觸傷害 */
  private updateBurningCorpses(dt: number) {
    const now = performance.now()
    const contactRadius = 18

    for (const corpse of this.state.burningCorpses) {
      const elapsed = now - corpse.createdAt
      if (elapsed >= corpse.duration) continue

      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0) continue
        const dist = this.distance(corpse.position, enemy.position)
        if (dist < contactRadius + enemy.size) {
          const dmg = corpse.damage * dt
          enemy.hp -= dmg
          // 灼燒狀態
          enemy.burnDps = corpse.damage
          enemy.burnUntil = now + 1000

          if (enemy.hp <= 0) {
            this.spawnDamageNumber(enemy.position, Math.round(dmg), '#FFAB40')
            this.handleEnemyDeath(enemy)
          }
        }
      }
    }

    this.state.burningCorpses = this.state.burningCorpses.filter(
      (c) => now - c.createdAt < c.duration,
    )
  }

  /** 發射光束：根據快照產生光束效果 */
  private fireBeam() {
    const snapshot = this.beamSnapshot
    if (!snapshot) return

    const { player, enemies } = this.state
    const beams = snapshot.beams
    const count = beams.length
    const now = performance.now()

    // 收集可用目標，每道光束朝不同敵人
    const usedEnemies = new Set<string>()

    for (let i = 0; i < count; i++) {
      const b = beams[i]

      // 找尚未被其他光束鎖定的最近敵人
      let target: Entity | null = null
      let minDist = Infinity
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue
        if (usedEnemies.has(enemy.id)) continue
        const dist = this.distance(player.position, enemy.position)
        if (dist < minDist) {
          minDist = dist
          target = enemy
        }
      }

      let angle = i * (Math.PI * 2 / count) // 預設均分方向
      if (target) {
        angle = Math.atan2(
          target.position.y - player.position.y,
          target.position.x - player.position.x,
        )
        usedEnemies.add(target.id)
      }

      this.state.beamEffects.push({
        id: this.genId(),
        origin: { x: player.position.x, y: player.position.y },
        angle,
        range: snapshot.range,
        width: b.width,
        dps: b.dps,
        createdAt: now,
        duration: snapshot.duration * 1000,
        hasRefraction: b.hasRefraction,
        refractionWidth: b.refractionWidth,
        hasFocusBurn: b.hasFocusBurn,
        hasPrismSplit: b.hasPrismSplit,
        isPulseMode: b.isPulseMode,
        hasBurningTrail: b.hasBurningTrail,
        hasOverload: b.hasOverload,
        focusAccum: new Map(),
        lastPulseTime: now,
        childSegments: [],
      })
    }
  }

  /** 更新光束效果：每幀對矩形範圍內敵人施加 DPS（含折射/聚焦/稜鏡/脈衝/過載/殘影） */
  private updateBeamEffects(dt: number) {
    const now = performance.now()

    for (const beam of this.state.beamEffects) {
      const elapsed = now - beam.createdAt

      // ── 光束到期 → 產生殘影 ──
      if (elapsed >= beam.duration) {
        if (beam.hasBurningTrail) {
          this.spawnBeamTrail(beam)
        }
        continue
      }

      // ── 能量過載：最後 0.5s 傷害 ×3、寬度 ×2 ──
      const timeRemaining = beam.duration - elapsed
      const isOverloaded = beam.hasOverload && timeRemaining <= 500
      const dpsMul = isOverloaded ? 3 : 1
      const widthMul = isOverloaded ? 2 : 1
      const effectiveDps = beam.dps * dpsMul
      const effectiveWidth = beam.width * widthMul

      // 清除上一幀的子光束段
      beam.childSegments = []

      if (beam.isPulseMode) {
        // ── 脈衝模式 ──
        if (now - beam.lastPulseTime >= 300) {
          beam.lastPulseTime = now

          // 每次脈衝重新瞄準最近敵人
          const target = this.findNearestEnemy(beam.origin)
          if (target) {
            beam.angle = Math.atan2(
              target.position.y - beam.origin.y,
              target.position.x - beam.origin.x,
            )
          }

          const pulseDmg = effectiveDps * 0.5

          // 主光束脈衝命中
          const mainHits = this.getEnemiesInBeam(beam.origin, beam.angle, beam.range, effectiveWidth)
          for (const enemy of mainHits) {
            this.applyBeamPulseDamage(enemy, pulseDmg, beam.origin, now)
          }

          // 折射子光束脈衝
          if (beam.hasRefraction && mainHits.length > 0) {
            const firstHit = this.findFirstEnemyInBeam(beam.origin, beam.angle, beam.range, effectiveWidth)
            if (firstHit) {
              const refWidth = beam.refractionWidth * widthMul
              const segs = this.computeRefractionSegments(firstHit, beam.range, refWidth, effectiveDps * 0.7)
              beam.childSegments.push(...segs)
              for (const seg of segs) {
                const segHits = this.getEnemiesInBeam(seg.origin, seg.angle, seg.range, seg.width)
                for (const enemy of segHits) {
                  this.applyBeamPulseDamage(enemy, seg.dps * 0.5, seg.origin, now)
                }
              }
            }
          }

          // 稜鏡分解子光束脈衝
          if (beam.hasPrismSplit) {
            const firstHit = this.findFirstEnemyInBeam(beam.origin, beam.angle, beam.range, effectiveWidth)
            if (firstHit) {
              const segs = this.computePrismSegments(firstHit, beam.angle, beam.range, effectiveWidth, effectiveDps)
              beam.childSegments.push(...segs)
              this.applyPrismDamage(segs, true, now)
            }
          }
        }
      } else {
        // ── 持續照射模式 ──
        const currentlyHit = new Set<string>()
        let firstHitEnemy: Entity | null = null
        let firstHitAlong = Infinity

        for (const enemy of this.state.enemies) {
          if (enemy.hp <= 0) continue
          const { hit, along } = this.beamHitTest(beam.origin, beam.angle, beam.range, effectiveWidth, enemy)
          if (!hit) continue

          currentlyHit.add(enemy.id)
          if (along < firstHitAlong) {
            firstHitAlong = along
            firstHitEnemy = enemy
          }

          // 聚焦灼燒倍率
          let focusMul = 1
          if (beam.hasFocusBurn) {
            const accum = beam.focusAccum.get(enemy.id) ?? 0
            focusMul = Math.min(2.5, 1 + 0.15 * (accum / 1000))
            beam.focusAccum.set(enemy.id, accum + dt * 1000)
          }

          const dmg = effectiveDps * focusMul * dt
          enemy.hp -= dmg
          enemy.burnDps = effectiveDps * focusMul
          enemy.burnUntil = now + 500

          if (enemy.hp <= 0) {
            this.spawnDamageNumber(enemy.position, Math.round(dmg), '#FFAB40')
            this.handleEnemyDeath(enemy)
          }
        }

        // 重置未被照射敵人的聚焦累計
        if (beam.hasFocusBurn) {
          for (const [id] of beam.focusAccum) {
            if (!currentlyHit.has(id)) beam.focusAccum.delete(id)
          }
        }

        // 折射光束
        if (beam.hasRefraction && firstHitEnemy) {
          const refWidth = beam.refractionWidth * widthMul
          const segs = this.computeRefractionSegments(firstHitEnemy, beam.range, refWidth, effectiveDps * 0.7)
          beam.childSegments.push(...segs)
          for (const seg of segs) {
            this.applyBeamSegmentDamage(seg, dt, now)
          }
        }

        // 稜鏡分解
        if (beam.hasPrismSplit && firstHitEnemy) {
          const segs = this.computePrismSegments(firstHitEnemy, beam.angle, beam.range, effectiveWidth, effectiveDps)
          beam.childSegments.push(...segs)
          this.applyPrismDamage(segs, false, now, dt)
        }
      }
    }

    this.state.beamEffects = this.state.beamEffects.filter(
      (b) => now - b.createdAt < b.duration,
    )
  }

  /** 光束矩形命中測試 */
  private beamHitTest(
    origin: Position, angle: number, range: number, width: number, enemy: Entity,
  ): { hit: boolean; along: number } {
    const halfWidth = width / 2
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)
    const normX = -dirY
    const normY = dirX
    const relX = enemy.position.x - origin.x
    const relY = enemy.position.y - origin.y
    const along = relX * dirX + relY * dirY
    const perp = Math.abs(relX * normX + relY * normY)
    return {
      hit: along >= -enemy.size && along <= range + enemy.size && perp <= halfWidth + enemy.size,
      along,
    }
  }

  /** 取得光束矩形內所有存活敵人 */
  private getEnemiesInBeam(origin: Position, angle: number, range: number, width: number): Entity[] {
    const result: Entity[] = []
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue
      if (this.beamHitTest(origin, angle, range, width, enemy).hit) {
        result.push(enemy)
      }
    }
    return result
  }

  /** 找光束中沿方向最近的敵人（用於折射/稜鏡起點） */
  private findFirstEnemyInBeam(origin: Position, angle: number, range: number, width: number): Entity | null {
    let first: Entity | null = null
    let minAlong = Infinity
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue
      const { hit, along } = this.beamHitTest(origin, angle, range, width, enemy)
      if (hit && along < minAlong) {
        minAlong = along
        first = enemy
      }
    }
    return first
  }

  /** 計算折射子光束段（從 startEnemy 向 200px 內最近敵人折射，最多 2 次） */
  private computeRefractionSegments(
    startEnemy: Entity, _range: number, width: number, refrDps: number,
  ): BeamSegment[] {
    const segments: BeamSegment[] = []
    let currentPos = startEnemy.position
    const usedEnemies = new Set<string>([startEnemy.id])

    for (let i = 0; i < 2; i++) {
      let nearest: Entity | null = null
      let minDist = 200
      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0 || usedEnemies.has(enemy.id)) continue
        const dist = this.distance(currentPos, enemy.position)
        if (dist < minDist) {
          minDist = dist
          nearest = enemy
        }
      }
      if (!nearest) break

      const angle = Math.atan2(
        nearest.position.y - currentPos.y,
        nearest.position.x - currentPos.x,
      )
      segments.push({
        origin: { x: currentPos.x, y: currentPos.y },
        angle,
        range: minDist + nearest.size + 20,
        width,
        dps: refrDps,
      })

      usedEnemies.add(nearest.id)
      currentPos = nearest.position
    }
    return segments
  }

  /** 計算稜鏡分解子光束段（從首個敵人分 3 道，30° 扇形，各 40% 傷害） */
  private computePrismSegments(
    hitEnemy: Entity, mainAngle: number, range: number, mainWidth: number, baseDps: number,
  ): BeamSegment[] {
    const childWidth = mainWidth / 3
    const childDps = baseDps * 0.4
    const spreadRad = (30 * Math.PI) / 180
    const segments: BeamSegment[] = []

    for (let i = 0; i < 3; i++) {
      const offset = -spreadRad / 2 + (spreadRad / 2) * i
      segments.push({
        origin: { x: hitEnemy.position.x, y: hitEnemy.position.y },
        angle: mainAngle + offset,
        range,
        width: childWidth,
        dps: childDps,
      })
    }
    return segments
  }

  /** 套用稜鏡子光束傷害（含三道同時命中 ×1.5 加成） */
  private applyPrismDamage(segs: BeamSegment[], isPulse: boolean, now: number, dt = 0) {
    const hitPerEnemy = new Map<string, { count: number; totalDps: number }>()

    for (const seg of segs) {
      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0) continue
        if (!this.beamHitTest(seg.origin, seg.angle, seg.range, seg.width, enemy).hit) continue
        const entry = hitPerEnemy.get(enemy.id) ?? { count: 0, totalDps: 0 }
        entry.count++
        entry.totalDps += seg.dps
        hitPerEnemy.set(enemy.id, entry)
      }
    }

    for (const [enemyId, { count, totalDps }] of hitPerEnemy) {
      const enemy = this.state.enemies.find((e) => e.id === enemyId)
      if (!enemy || enemy.hp <= 0) continue
      const mul = count >= 3 ? 1.5 : 1
      const dmg = isPulse ? totalDps * 0.5 * mul : totalDps * dt * mul
      enemy.hp -= dmg
      enemy.burnDps = totalDps * mul
      enemy.burnUntil = now + 500

      if (enemy.hp <= 0) {
        this.spawnDamageNumber(enemy.position, Math.round(dmg), '#FFAB40')
        this.handleEnemyDeath(enemy)
      }
    }
  }

  /** 套用光束子段持續傷害（折射用） */
  private applyBeamSegmentDamage(seg: BeamSegment, dt: number, now: number) {
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue
      if (!this.beamHitTest(seg.origin, seg.angle, seg.range, seg.width, enemy).hit) continue
      const dmg = seg.dps * dt
      enemy.hp -= dmg
      enemy.burnDps = seg.dps
      enemy.burnUntil = now + 500

      if (enemy.hp <= 0) {
        this.spawnDamageNumber(enemy.position, Math.round(dmg), '#FFAB40')
        this.handleEnemyDeath(enemy)
      }
    }
  }

  /** 脈衝模式：對敵人施加瞬間傷害 + 50px 擊退 */
  private applyBeamPulseDamage(enemy: Entity, damage: number, beamOrigin: Position, now: number) {
    enemy.hp -= damage
    this.spawnDamageNumber(enemy.position, Math.round(damage), '#FFAB40')

    // 50px 擊退
    const knockAngle = Math.atan2(
      enemy.position.y - beamOrigin.y,
      enemy.position.x - beamOrigin.x,
    )
    enemy.position.x += Math.cos(knockAngle) * 50
    enemy.position.y += Math.sin(knockAngle) * 50
    enemy.position.x = Math.max(enemy.size, Math.min(this.state.canvasWidth - enemy.size, enemy.position.x))
    enemy.position.y = Math.max(enemy.size, Math.min(this.state.canvasHeight - enemy.size, enemy.position.y))

    enemy.burnDps = damage * 2
    enemy.burnUntil = now + 500

    if (enemy.hp <= 0) {
      this.handleEnemyDeath(enemy)
    }
  }

  /** 產生光束殘影（灼熱殘影金卡） */
  private spawnBeamTrail(beam: BeamEffect) {
    const now = performance.now()
    // 主光束殘影
    this.state.beamTrails.push({
      id: this.genId(),
      origin: { x: beam.origin.x, y: beam.origin.y },
      angle: beam.angle,
      range: beam.range,
      width: beam.width,
      dps: beam.dps * 0.3,
      createdAt: now,
      duration: 2000,
    })
    // 子光束殘影
    for (const seg of beam.childSegments) {
      this.state.beamTrails.push({
        id: this.genId(),
        origin: { x: seg.origin.x, y: seg.origin.y },
        angle: seg.angle,
        range: seg.range,
        width: seg.width,
        dps: seg.dps * 0.3,
        createdAt: now,
        duration: 2000,
      })
    }
  }

  /** 更新光束殘影：每幀對殘影矩形範圍內敵人施加灼傷 DPS */
  private updateBeamTrails(dt: number) {
    const now = performance.now()
    for (const trail of this.state.beamTrails) {
      const elapsed = now - trail.createdAt
      if (elapsed >= trail.duration) continue

      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0) continue
        if (!this.beamHitTest(trail.origin, trail.angle, trail.range, trail.width, enemy).hit) continue

        const dmg = trail.dps * dt
        enemy.hp -= dmg
        enemy.burnDps = trail.dps
        enemy.burnUntil = now + 500

        if (enemy.hp <= 0) {
          this.spawnDamageNumber(enemy.position, Math.round(dmg), '#FF8A65')
          this.handleEnemyDeath(enemy)
        }
      }
    }

    this.state.beamTrails = this.state.beamTrails.filter(
      (t) => now - t.createdAt < t.duration,
    )
  }

  /** 清理過期冰錐效果 */
  private updateIceSpikeEffects() {
    const now = performance.now()
    this.state.iceSpikeEffects = this.state.iceSpikeEffects.filter(
      (e) => now - e.createdAt < e.duration,
    )
  }

  /** 地雷近距離偵測 → 觸發 */
  private updateIceSpikeMines() {
    const now = performance.now()
    const snapshot = this.iceSpikeSnapshot

    for (const mine of this.state.iceSpikeMines) {
      // 過期移除
      if (now - mine.createdAt > mine.duration) {
        mine.triggered = true
        mine.triggerTime = now - 500 // 讓它被清掉
        continue
      }

      if (mine.triggered) continue

      // 偵測敵人踏入
      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0) continue
        const dist = this.distance(mine.position, enemy.position)
        if (dist < mine.detectRadius + enemy.size) {
          mine.triggered = true
          mine.triggerTime = now

          // 施加失溫
          enemy.slowUntil = now + 2000

          // 永凍結晶檢查
          const isSlow = enemy.slowUntil > 0 && now < enemy.slowUntil
          let actualDmg = mine.damage
          if (snapshot?.hasPermafrost && isSlow) {
            enemy.frozenUntil = now + 1500
            enemy.frozenDamage = 0
          }
          if (enemy.frozenUntil > 0 && now < enemy.frozenUntil) {
            actualDmg = Math.round(mine.damage * 1.25)
          }

          enemy.hp -= actualDmg
          this.spawnDamageNumber(enemy.position, actualDmg)

          if (enemy.hp <= 0) {
            this.handleEnemyDeath(enemy)
          }

          // 觸發視覺
          this.state.iceSpikeEffects.push({
            id: this.genId(),
            pillarPositions: [{ ...mine.position }],
            spreadPillarPositions: [],
            damage: actualDmg,
            spreadDamage: 0,
            isCage: false,
            createdAt: now,
            duration: 400,
            hitEnemies: new Set([enemy.id]),
          })
          break
        }
      }
    }

    // 清理已觸發超過動畫時間 或 過期的地雷
    this.state.iceSpikeMines = this.state.iceSpikeMines.filter(
      (m) => !m.triggered || (now - m.triggerTime < 400),
    )
  }

  /** 共振波擴散 → 命中敵人 */
  private updateResonanceWaves() {
    const now = performance.now()
    for (const wave of this.state.resonanceWaves) {
      const elapsed = now - wave.createdAt
      const progress = elapsed / wave.duration
      const currentRadius = wave.maxRadius * Math.min(1, progress)

      for (const enemy of this.state.enemies) {
        if (enemy.hp <= 0) continue
        if (wave.hitEnemies.has(enemy.id)) continue
        const dist = this.distance(wave.position, enemy.position)
        if (dist < currentRadius + enemy.size) {
          enemy.hp -= wave.damage
          wave.hitEnemies.add(enemy.id)
          this.spawnDamageNumber(enemy.position, wave.damage, '#80DEEA')

          if (enemy.hp <= 0) {
            this.handleEnemyDeath(enemy)
          }
        }
      }
    }

    this.state.resonanceWaves = this.state.resonanceWaves.filter(
      (w) => now - w.createdAt < w.duration + 200,
    )
  }

  private findNearestEnemy(from: Position): Entity | null {
    let nearest: Entity | null = null
    let minDist = Infinity

    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) continue
      const dist = this.distance(from, enemy.position)
      if (dist < minDist) {
        minDist = dist
        nearest = enemy
      }
    }

    return nearest
  }

  /** 更新投射物：移動 → 追蹤轉向 → 碰撞檢測 → 分裂 → 寒氣區域 */
  private updateProjectiles(dt: number) {
    const { projectiles, enemies, canvasWidth, canvasHeight } = this.state
    const margin = 50
    const newProjectiles: Projectile[] = []

    for (const proj of projectiles) {
      if (!proj.alive) continue

      // 追蹤轉向
      if (proj.hasTracking) {
        this.applyTracking(proj, dt)
      }

      // 移動
      proj.position.x += proj.velocity.x * dt
      proj.position.y += proj.velocity.y * dt

      // 超出畫面
      if (
        proj.position.x < -margin ||
        proj.position.x > canvasWidth + margin ||
        proj.position.y < -margin ||
        proj.position.y > canvasHeight + margin
      ) {
        proj.alive = false
        continue
      }

      // 碰撞檢測
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue
        if (proj.hitEnemies.has(enemy.id)) continue

        const dist = this.distance(proj.position, enemy.position)
        if (dist < enemy.size + 6) {
          enemy.hp -= proj.damage
          proj.hitEnemies.add(enemy.id)
          this.spawnDamageNumber(enemy.position, proj.damage)

          // 寒霜聚合追蹤
          if (proj.hasConvergence) {
            this.trackConvergence(enemy, proj.damage)
          }

          // 擊殺判定
          if (enemy.hp <= 0) {
            // 冰暴連鎖（需在移除前執行）
            if (proj.hasChainExplosion && proj.chainDepth < 3) {
              const chains = this.spawnChainFragments(proj, enemy.position, enemy.id)
              newProjectiles.push(...chains)
            }
            this.convergenceTracker.delete(enemy.id)
            this.handleEnemyDeath(enemy)
          }

          // 寒氣區域
          if (proj.hasColdZone) {
            this.spawnColdZone(proj.position)
          }

          // 分裂
          if (proj.hasSplit && !proj.isFragment) {
            const fragments = this.spawnSplitFragments(proj, enemy.id)
            newProjectiles.push(...fragments)
          }

          if (proj.pierceCount > 0) {
            proj.pierceCount--
          } else {
            proj.alive = false
          }
          break
        }
      }
    }

    if (newProjectiles.length > 0) {
      projectiles.push(...newProjectiles)
    }

    this.state.projectiles = projectiles.filter((p) => p.alive)
  }

  /** 追蹤轉向：平滑轉向最近敵人 */
  private applyTracking(proj: Projectile, dt: number) {
    const target = this.findNearestEnemy(proj.position)
    if (!target) return

    const targetAngle = Math.atan2(
      target.position.y - proj.position.y,
      target.position.x - proj.position.x,
    )
    const currentAngle = Math.atan2(proj.velocity.y, proj.velocity.x)
    const maxTurn = (proj.trackingTurnSpeed * Math.PI / 180) * dt

    let diff = targetAngle - currentAngle
    // 正規化到 [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI

    const turn = Math.sign(diff) * Math.min(Math.abs(diff), maxTurn)
    const newAngle = currentAngle + turn

    proj.velocity.x = Math.cos(newAngle) * proj.speed
    proj.velocity.y = Math.sin(newAngle) * proj.speed
  }

  /** 產生寒氣區域 */
  private spawnColdZone(pos: Position) {
    this.state.coldZones.push({
      id: this.genId(),
      position: { x: pos.x, y: pos.y },
      radius: 40,
      createdAt: performance.now(),
      duration: 1500,
    })
  }

  /** 清理過期寒氣區域 */
  private updateColdZones() {
    const now = performance.now()
    this.state.coldZones = this.state.coldZones.filter(
      (cz) => now - cz.createdAt < cz.duration,
    )
  }

  /** 產生分裂碎冰箭 */
  private spawnSplitFragments(parent: Projectile, hitEnemyId: string): Projectile[] {
    const fragments: Projectile[] = []
    const baseAngle = Math.atan2(parent.velocity.y, parent.velocity.x)
    const splitRad = (parent.splitAngle * Math.PI) / 180
    const fragmentDamage = Math.round(parent.damage * parent.splitDamageRatio)

    for (let i = 0; i < parent.splitCount; i++) {
      const offset = parent.splitCount === 1 ? 0 : -splitRad + (2 * splitRad / (parent.splitCount - 1)) * i
      const angle = baseAngle + offset

      fragments.push({
        id: this.genId(),
        skillId: parent.skillId,
        position: { x: parent.position.x, y: parent.position.y },
        velocity: {
          x: Math.cos(angle) * parent.speed * 0.8,
          y: Math.sin(angle) * parent.speed * 0.8,
        },
        damage: fragmentDamage,
        speed: parent.speed * 0.8,
        pierceCount: 0,
        hasSplit: false,
        splitDamageRatio: 0,
        splitCount: 0,
        splitAngle: 0,
        isFragment: true,
        hasTracking: false,
        trackingTurnSpeed: 0,
        hasColdZone: parent.hasColdZone,
        hasConvergence: false,
        hasChainExplosion: parent.hasChainExplosion,
        chainDepth: parent.chainDepth,
        hitEnemies: new Set([hitEnemyId]),
        alive: true,
      })
    }

    return fragments
  }

  private spawnDamageNumber(pos: Position, damage: number, color?: string, fontSize?: number) {
    this.state.damageNumbers.push({
      id: this.genId(),
      position: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y - 20 },
      damage,
      createdAt: performance.now(),
      duration: 800,
      color,
      fontSize,
    })
  }

  /** 寒霜聚合：追蹤命中紀錄，3+ 次在 0.5s 內觸發冰封 */
  private trackConvergence(enemy: Entity, damage: number) {
    if (enemy.frozenUntil > 0 && performance.now() < enemy.frozenUntil) return

    const now = performance.now()
    const record = this.convergenceTracker.get(enemy.id) ?? []
    record.push({ time: now, damage })

    const recent = record.filter((r) => now - r.time < 500)
    this.convergenceTracker.set(enemy.id, recent)

    if (recent.length >= 3) {
      const accDamage = recent.reduce((sum, r) => sum + r.damage, 0)
      enemy.frozenUntil = now + 2000
      enemy.frozenDamage = Math.round(accDamage * 0.5)
      this.convergenceTracker.set(enemy.id, [])
    }
  }

  /** 處理冰封到期 → 碎冰爆傷 */
  private updateFrozenEnemies() {
    const now = performance.now()
    for (const enemy of this.state.enemies) {
      if (enemy.frozenUntil > 0 && now >= enemy.frozenUntil) {
        if (enemy.frozenDamage > 0) {
          enemy.hp -= enemy.frozenDamage
          this.spawnDamageNumber(enemy.position, enemy.frozenDamage, '#90CAF9')
          if (enemy.hp <= 0) {
            this.handleEnemyDeath(enemy)
          }
        }
        enemy.frozenUntil = 0
        enemy.frozenDamage = 0
      }
    }
  }

  /** 冰暴連鎖：擊殺爆裂成 3 支隨機方向碎冰箭 */
  private spawnChainFragments(proj: Projectile, enemyPos: Position, hitEnemyId: string): Projectile[] {
    const fragments: Projectile[] = []
    const chainDamage = Math.round(proj.damage * 0.4)
    const speed = proj.speed * 0.8

    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2
      fragments.push({
        id: this.genId(),
        skillId: proj.skillId,
        position: { x: enemyPos.x, y: enemyPos.y },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        damage: chainDamage,
        speed,
        pierceCount: 0,
        hasSplit: false,
        splitDamageRatio: 0,
        splitCount: 0,
        splitAngle: 0,
        isFragment: true,
        hasTracking: false,
        trackingTurnSpeed: 0,
        hasColdZone: proj.hasColdZone,
        hasConvergence: false,
        hasChainExplosion: true,
        chainDepth: proj.chainDepth + 1,
        hitEnemies: new Set([hitEnemyId]),
        alive: true,
      })
    }
    return fragments
  }

  private updateDamageNumbers() {
    const now = performance.now()
    this.state.damageNumbers = this.state.damageNumbers.filter(
      (dn) => now - dn.createdAt < dn.duration,
    )
  }

  private distance(a: Position, b: Position): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /** 新增木樁 */
  addEnemy(position?: Position) {
    const { canvasWidth, canvasHeight, enemies } = this.state
    const pos = position ?? {
      x: 100 + Math.random() * (canvasWidth - 200),
      y: 100 + Math.random() * (canvasHeight - 200),
    }
    enemies.push({
      id: `enemy-${this.genId()}`,
      position: pos,
      size: 14,
      hp: this.enemyMaxHp,
      maxHp: this.enemyMaxHp,
      speed: 0,
      color: '#EF5350',
      frozenUntil: 0,
      frozenDamage: 0,
      slowUntil: 0,
      burnDps: 0,
      burnUntil: 0,
    })
    this.onStateChange()
  }

  /** 新增左右來回移動的木樁 */
  addMovingEnemy() {
    const { canvasWidth, canvasHeight, enemies } = this.state
    const centerX = 100 + Math.random() * (canvasWidth - 200)
    const y = 100 + Math.random() * (canvasHeight - 200)
    const range = 80 + Math.random() * 80
    enemies.push({
      id: `enemy-${this.genId()}`,
      position: { x: centerX, y },
      size: 14,
      hp: this.enemyMaxHp,
      maxHp: this.enemyMaxHp,
      speed: 0,
      color: '#FFA726',
      frozenUntil: 0,
      frozenDamage: 0,
      slowUntil: 0,
      burnDps: 0,
      burnUntil: 0,
      patrol: { centerX, range, speed: 80 + Math.random() * 40, direction: 1 },
    })
    this.onStateChange()
  }

  /** 移除最後一個木樁（至少保留 1 個） */
  removeEnemy() {
    if (this.state.enemies.length <= 1) return
    this.state.enemies.pop()
    this.onStateChange()
  }

  /** 取得指定位置的敵人（用於拖曳 hit test） */
  getEnemyAtPosition(pos: Position): Entity | null {
    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      const enemy = this.state.enemies[i]
      if (this.distance(pos, enemy.position) < enemy.size + 8) {
        return enemy
      }
    }
    return null
  }

  /** 移動敵人到指定位置（巡邏木樁同步更新中心點） */
  moveEnemy(id: string, pos: Position) {
    const enemy = this.state.enemies.find((e) => e.id === id)
    if (!enemy) return
    enemy.position.x = Math.max(enemy.size, Math.min(this.state.canvasWidth - enemy.size, pos.x))
    enemy.position.y = Math.max(enemy.size, Math.min(this.state.canvasHeight - enemy.size, pos.y))
    if (enemy.patrol) {
      enemy.patrol.centerX = enemy.position.x
    }
  }

  resetEnemies() {
    for (const enemy of this.state.enemies) {
      enemy.hp = enemy.maxHp
      enemy.frozenUntil = 0
      enemy.frozenDamage = 0
      enemy.slowUntil = 0
      enemy.burnDps = 0
      enemy.burnUntil = 0
    }
    this.convergenceTracker.clear()
    this.state.projectiles = []
    this.state.damageNumbers = []
    this.state.coldZones = []
    this.state.iceSpikeEffects = []
    this.state.iceSpikeMines = []
    this.state.resonanceWaves = []
    this.state.fireballProjectiles = []
    this.state.fireExplosions = []
    this.state.lavaZones = []
    this.state.burningCorpses = []
    this.state.beamEffects = []
    this.state.beamTrails = []
    this.onStateChange()
  }

  /** 設定木樁血量上限 */
  setEnemyMaxHp(hp: number) {
    this.enemyMaxHp = hp
    for (const enemy of this.state.enemies) {
      enemy.maxHp = hp
      enemy.hp = hp
      enemy.frozenUntil = 0
      enemy.frozenDamage = 0
      enemy.slowUntil = 0
      enemy.burnDps = 0
      enemy.burnUntil = 0
    }
    this.convergenceTracker.clear()
    this.state.iceSpikeMines = []
    this.state.resonanceWaves = []
    this.state.fireballProjectiles = []
    this.state.fireExplosions = []
    this.state.lavaZones = []
    this.state.burningCorpses = []
    this.state.beamEffects = []
    this.state.beamTrails = []
    this.onStateChange()
  }
}
