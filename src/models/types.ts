/** 2D 座標 */
export interface Position {
  x: number
  y: number
}

/** 地圖掉落物（無限模式：冷卻/範圍/數量/傷害強化碎片） */
export interface MapPickup {
  id: string
  position: Position
  type: 'cooldown' | 'range' | 'count' | 'damage'
  /** 生成時指定套用的卡槽索引（0/1/2） */
  targetSlotIndex: number
  createdAt: number
  /** 存在時長（ms），倒數完消失 */
  duration: number
}

/** 專精大師：地上星星，拾取後觸發三選一 */
export interface StarPickup {
  id: string
  position: Position
  createdAt: number
  /** 存在時長（ms），未拾取則消失 */
  duration: number
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
  /** 金卡冷到頭痛：0.5s 內 2 次命中同一敵人 → 凍結 */
  hasFreeze: boolean
  /** 銀卡不能只我冷：擊殺後爆裂 4 支碎冰箭 25% */
  hasDetonate: boolean
  /** 銀卡還有小碎冰：擊中或穿透後多分裂 1 支 50% 碎冰箭；可堆疊，cascadeCount 為支數 */
  hasCascade: boolean
  /** 小碎冰支數（多張卡累加），未設則視為 1 */
  cascadeCount?: number
  /** 銀卡誰亂丟冰塊：擊中後改往最近敵人反彈 */
  hasRicochet: boolean
  /** 冰箭專用：每次擊中的行為順序（好冰分享=穿、誰亂丟冰塊=連鎖），反彈後可再命中同一敵人 */
  pierceRicochetSequence?: ('pierce' | 'ricochet')[]
  /** 冰箭專用：已觸發的擊中次數（用於依序取 pierceRicochetSequence） */
  hitCount?: number
  /** 失溫機率加成（0~1），冰箭專用 */
  chillChanceBonus: number
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

/** 凍土扇形區域（範圍型 DoT + 減速） */
export interface FrozenGroundZone {
  id: string
  /** 扇形圓心（玩家方向 castRange 處） */
  origin: Position
  /** 扇形朝向角度（弧度） */
  direction: number
  /** 扇形角度（度） */
  arcAngle: number
  /** 扇形半徑 px */
  radius: number
  /** 每秒傷害 */
  dps: number
  /** 減速比例 0~1 */
  slowRate: number
  createdAt: number
  duration: number
  /** 共振用：本幀內命中過的敵人 */
  hitEnemies: Set<string>
  /** 牢籠模式：圓環取代扇形 */
  isCage: boolean
  /** 地雷觸發後產生的區域（傷害 x1.5） */
  isMineTriggered: boolean
  /** 共振已觸發（避免重複） */
  resonanceTriggered?: boolean
  /** 二重擊：首次造成傷害的時間戳 */
  firstDamageTime?: number
  /** 二重擊：是否已觸發第二次傷害 */
  doubleHitDone?: boolean
  /** 二重擊：閃光效果結束時間戳 */
  doubleHitFlashUntil?: number
  /** 碎冰飛濺：上次觸發時間（throttle） */
  lastShardSplashTime?: number
  /** 本區域是否套用二重擊（蔓延區依牌序可能為 false） */
  hasDoubleHit?: boolean
  /** 本區域是否套用碎冰飛濺（蔓延區依牌序可能為 false） */
  hasShardSplash?: boolean
  /** 是否為蔓延區域（用於繪製區分主體） */
  isSpreadZone?: boolean
}

/** 碎冰飛濺射出的小冰刺 */
export interface FrozenGroundShard {
  id: string
  position: Position
  velocity: { x: number; y: number }
  damage: number
  traveled: number
  maxDistance: number
  createdAt: number
}

/** 凍土地雷（潛伏模式，敵人踏入觸發） */
export interface FrozenGroundMine {
  id: string
  position: Position
  dps: number
  radius: number
  slowRate: number
  detectRadius: number
  createdAt: number
  duration: number
  triggered: boolean
  triggerTime: number
  arcAngle: number
  direction: number
  isCage: boolean
}

/** 共振波（凍土共振金卡效果） */
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

/** 環繞電球（主角身邊旋轉的電球） */
export interface OrbitalOrb {
  id: string
  /** 當前軌道角度（弧度） */
  angle: number
  /** 旋轉半徑 px */
  radius: number
  /** 每觸碰傷害 */
  touchDamage: number
  /** 累計觸碰次數（雷暴核心用） */
  touchCount: number
  /** 是否暫停旋轉（EMP 時） */
  paused: boolean
  /** 暫停結束時間戳 */
  pauseUntil: number
  /** 是否正在附著敵人（電球吸附） */
  attachedTo: string | null
  /** 附著開始時間 */
  attachStartTime: number
  /** 是否已爆炸等待重生（雷暴核心） */
  respawning: boolean
  /** 重生時間戳 */
  respawnAt: number
  /** 銅卡：閃電連線 */
  hasLightningChain: boolean
  /** 銅卡：電球吸附 */
  hasAttach: boolean
  /** 銅卡：電磁脈衝 */
  hasEmp: boolean
  /** 銀卡：雷暴核心 */
  hasStormCore: boolean
  /** 銀卡：連線增幅 */
  hasChainBoost: boolean
  /** 銀卡：附著爆發 */
  hasAttachBurst: boolean
  /** 金卡：特斯拉線圈 */
  hasTesla: boolean
  /** 金卡：超導磁場 */
  hasSuperconduct: boolean
}

/** 電球雷暴/附著爆發視覺效果 */
export interface ElectricExplosion {
  id: string
  position: Position
  radius: number
  createdAt: number
  duration: number
}

/** 光束效果（v3：預設單發 70 傷） */
export interface BeamEffect {
  id: string
  origin: Position
  angle: number
  range: number
  width: number
  pulseDamage: number
  pulseInterval: number
  /** true = 單發一擊即止 */
  singleShot: boolean
  /** 單發時是否已施加過傷害 */
  initialDamageApplied?: boolean
  createdAt: number
  duration: number
  /** 銅卡：脈衝擊退 50px */
  hasKnockback: boolean
  /** 銀卡：折射光束 */
  hasRefraction: boolean
  refractionWidth: number
  /** 銀卡：聚焦灼燒 */
  hasFocusBurn: boolean
  /** 銀卡：稜鏡分解 */
  hasPrismSplit: boolean
  /** 銀卡：過載尾段（最後 0.5s ×2） */
  hasOverloadTail: boolean
  /** 金卡：灼熱殘影 */
  hasBurningTrail: boolean
  /** 金卡：能量過載 */
  hasOverload: boolean
  focusAccum: Map<string, number>
  lastPulseTime: number
  childSegments: BeamSegment[]
}

/** 光束子段（折射/稜鏡分裂產生的子光束） */
export interface BeamSegment {
  origin: Position
  angle: number
  range: number
  width: number
  /** 每脈衝傷害（折射 70%、稜鏡各 40%） */
  pulseDamage: number
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
