/** 2D 座標 */
export interface Position {
  x: number
  y: number
}

/** 2D 向量 */
export interface Vector2D {
  x: number
  y: number
}

/** 元素屬性標籤 */
export type ElementType = 'ICE' | 'FIRE' | 'LIGHTNING' | 'WIND' | 'POISON' | 'DASH' | 'BUFF' | 'SPECIAL'

/** 傷害類型標籤 */
export type DamageType = 'PROJECTILE' | 'ORBIT' | 'AREA' | 'COLLISION' | 'CONTROL'

/** 技能基礎參數 */
export interface SkillStats {
  damage: number
  cooldown: number
  duration: number
  speed: number
  radius: number
  range: number
  angle: number
  count: number
  pierceCount: number
  bounceCount: number
  splitCount: number
  spreadAngle: number
  knockback: number
  chance: number
  slowRate: number
  captureLimit: number
  chainCount: number
  pullForce: number
  tickRate: number
  falloffRatio: number
  invincibleTime: number
  castRange: number
}

/** 技能定義 */
export interface SkillDefinition {
  id: string
  name: string
  element: ElementType
  damageType: DamageType
  description: string
  initialStats: Partial<SkillStats>
}

/** 遊戲中的實體 */
export interface Entity {
  id: string
  position: Position
  size: number
  hp: number
  maxHp: number
  speed: number
  color: string
  frozenUntil: number
  frozenDamage: number
  slowUntil: number
  burnDps: number
  burnUntil: number
  patrol?: {
    centerX: number
    range: number
    speed: number
    direction: 1 | -1
  }
}

/** 投射物 */
export interface Projectile {
  id: string
  skillId: string
  position: Position
  velocity: Vector2D
  damage: number
  speed: number
  pierceCount: number
  hasSplit: boolean
  splitDamageRatio: number
  splitCount: number
  splitAngle: number
  isFragment: boolean
  hasTracking: boolean
  trackingTurnSpeed: number
  hasColdZone: boolean
  hasConvergence: boolean
  hasChainExplosion: boolean
  chainDepth: number
  hitEnemies: Set<string>
  alive: boolean
}

/** 寒氣區域（極寒領域金卡效果） */
export interface ColdZone {
  id: string
  position: Position
  radius: number
  createdAt: number
  duration: number
}

/** 冰錐區域效果（範圍攻擊） */
export interface IceSpikeEffect {
  id: string
  pillarPositions: Position[]
  spreadPillarPositions: Position[]
  damage: number
  spreadDamage: number
  isCage: boolean
  createdAt: number
  duration: number
  hitEnemies: Set<string>
}

/** 冰錐地雷（潛伏模式） */
export interface IceSpikeMine {
  id: string
  position: Position
  damage: number
  detectRadius: number
  createdAt: number
  duration: number
  triggered: boolean
  triggerTime: number
}

/** 共振波（冰錐共振金卡效果） */
export interface ResonanceWave {
  id: string
  position: Position
  maxRadius: number
  damage: number
  createdAt: number
  duration: number
  hitEnemies: Set<string>
}

/** 火球投射物（飛行中，尚未落地） */
export interface FireballProjectile {
  id: string
  position: Position
  velocity: Vector2D
  damage: number
  explosionRadius: number
  distanceTraveled: number
  maxDistance: number
  /** 銀/金卡行為欄位 */
  hasBounce: boolean
  hasLava: boolean
  hasScatter: boolean
  isMeteor: boolean
  hasWildfire: boolean
  hasChainExplosion: boolean
  /** 隕石延遲（秒），> 0 時火球尚未落地 */
  delay: number
  /** 隕石目標落點 */
  targetPosition: Position | null
  /** 裂焰擴散碎片標記 */
  isScatter: boolean
  alive: boolean
}

/** 火焰爆炸視覺效果 */
export interface FireExplosion {
  id: string
  position: Position
  radius: number
  createdAt: number
  duration: number
}

/** 熔岩區域（火球爆炸殘留） */
export interface LavaZone {
  id: string
  position: Position
  radius: number
  dps: number
  createdAt: number
  duration: number
}

/** 燃燒屍體（野火燎原效果） */
export interface BurningCorpse {
  id: string
  position: Position
  damage: number
  createdAt: number
  duration: number
}

/** 光束效果（持續直線範圍傷害） */
export interface BeamEffect {
  id: string
  origin: Position
  angle: number
  range: number
  width: number
  dps: number
  createdAt: number
  duration: number
  /** 銀卡：折射光束 */
  hasRefraction: boolean
  /** 折射光束捕捉的寬度（放入折射卡時的寬度） */
  refractionWidth: number
  /** 銀卡：聚焦灼燒 */
  hasFocusBurn: boolean
  /** 銀卡：稜鏡分解 */
  hasPrismSplit: boolean
  /** 銀卡：脈衝模式 */
  isPulseMode: boolean
  /** 金卡：灼熱殘影 */
  hasBurningTrail: boolean
  /** 金卡：能量過載 */
  hasOverload: boolean
  /** 聚焦灼燒：每個敵人的連續照射累計時間(ms) */
  focusAccum: Map<string, number>
  /** 脈衝模式：上次脈衝時間 */
  lastPulseTime: number
  /** 折射/稜鏡：動態計算的子光束段（每幀更新） */
  childSegments: BeamSegment[]
}

/** 光束子段（折射/稜鏡分裂產生的子光束） */
export interface BeamSegment {
  origin: Position
  angle: number
  range: number
  width: number
  dps: number
}

/** 光束殘影（灼熱殘影金卡效果） */
export interface BeamTrail {
  id: string
  origin: Position
  angle: number
  range: number
  width: number
  dps: number
  createdAt: number
  duration: number
}

/** 傷害數字浮動顯示 */
export interface DamageNumber {
  id: string
  position: Position
  damage: number
  createdAt: number
  duration: number
  color?: string
  fontSize?: number
}
