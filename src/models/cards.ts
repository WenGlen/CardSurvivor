/** 卡片稀有度 */
export type CardRarity = 'bronze' | 'silver' | 'gold'

/** 卡片定義 */
export interface CardDefinition {
  id: string
  name: string
  skillId: string
  rarity: CardRarity
  description: string
  orderNote: string
}

/** 單支冰箭的實例快照 */
export interface ArrowInstance {
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
}

/** 冰箭技能的完整快照（經卡片堆疊計算後） */
export interface IceArrowSnapshot {
  cooldown: number
  spreadAngle: number
  arrows: ArrowInstance[]
}

/** 冰箭初始單支箭實例 */
const BASE_ARROW: ArrowInstance = {
  damage: 12,
  speed: 220,
  pierceCount: 0,
  hasSplit: false,
  splitDamageRatio: 0.6,
  splitCount: 2,
  splitAngle: 45,
  isFragment: false,
  hasTracking: false,
  trackingTurnSpeed: 0,
  hasColdZone: false,
  hasConvergence: false,
  hasChainExplosion: false,
}

// ── 冰箭卡片定義 ──

export const iceArrowCards: CardDefinition[] = [
  {
    id: 'ice-arrow-count-2',
    name: '冰箭數量 +2',
    skillId: 'ice-arrow',
    rarity: 'bronze',
    description: '新增 2 支初始數值的冰箭，散射角度自動均分',
    orderNote: '放在行為卡之後，新增的箭不繼承之前的行為效果',
  },
  {
    id: 'ice-arrow-pierce',
    name: '寒冰穿刺',
    skillId: 'ice-arrow',
    rarity: 'bronze',
    description: '所有現有冰箭穿透 +1，穿透時傷害不衰減',
    orderNote: '只影響放入此卡時已存在的冰箭',
  },
  {
    id: 'ice-arrow-cooldown',
    name: '冰箭冷卻 -0.2s',
    skillId: 'ice-arrow',
    rarity: 'bronze',
    description: '整體冷卻時間縮短 0.2 秒（可疊加，最低 0.3s）',
    orderNote: '不受順序影響，疊加多張效果累積',
  },
  {
    id: 'ice-arrow-split',
    name: '冰晶分裂',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: '所有現有冰箭穿透敵人後，分裂成 2 支小冰箭（60% 傷害，±45°）',
    orderNote: '需搭配穿透才能觸發；先穿後分 vs 先分後穿效果不同',
  },
  {
    id: 'ice-arrow-convergence',
    name: '寒霜聚合',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: '3 支以上冰箭在 0.5s 內擊中同一敵人 → 冰封 2s，結束時受累積傷害 50% 碎冰爆傷',
    orderNote: '只作用於當前存在的冰箭；鼓勵收窄散射集火',
  },
  {
    id: 'ice-arrow-tracking',
    name: '追蹤冰晶',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: '所有現有冰箭獲得微幅自動追蹤（轉向 30°/s），飛行速度降低 15%',
    orderNote: '後拿的數量卡不繼承追蹤；速度降低會影響穿透距離',
  },
  {
    id: 'ice-arrow-cold-zone',
    name: '極寒領域',
    skillId: 'ice-arrow',
    rarity: 'gold',
    description: '所有冰箭（含未來新增）命中時產生寒氣區域（半徑 40px，1.5s），區域內敵人減速 30%',
    orderNote: '金卡：不受順序影響，作用於所有現有及未來的冰箭',
  },
  {
    id: 'ice-arrow-chain',
    name: '冰暴連鎖',
    skillId: 'ice-arrow',
    rarity: 'gold',
    description: '所有冰箭擊殺敵人時爆裂成 3 支碎冰箭（40% 傷害），最多連鎖 3 次',
    orderNote: '金卡：不受順序影響，作用於所有現有及未來的冰箭（含碎片）',
  },
]

/**
 * 根據卡片序列計算冰箭快照
 * 核心機制：順序依賴堆疊（Sequential Stacking）
 * - 銅/銀卡：順序依賴，只影響「當下已存在」的箭
 * - 金卡：全局效果，不受順序影響，最後統一套用到所有箭
 */
export function computeIceArrowSnapshot(cardSequence: CardDefinition[]): IceArrowSnapshot {
  const snapshot: IceArrowSnapshot = {
    cooldown: 1.2,
    spreadAngle: 30,
    arrows: [
      { ...BASE_ARROW },
      { ...BASE_ARROW },
      { ...BASE_ARROW },
    ],
  }

  // 分離金卡與順序依賴卡
  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')

  // 1. 依序處理銅/銀卡
  for (const card of sequentialCards) {
    switch (card.id) {
      case 'ice-arrow-count-2':
        snapshot.arrows.push({ ...BASE_ARROW })
        snapshot.arrows.push({ ...BASE_ARROW })
        break

      case 'ice-arrow-pierce':
        for (const arrow of snapshot.arrows) {
          arrow.pierceCount += 1
        }
        break

      case 'ice-arrow-cooldown':
        snapshot.cooldown = Math.max(0.3, snapshot.cooldown - 0.2)
        break

      case 'ice-arrow-split':
        for (const arrow of snapshot.arrows) {
          arrow.hasSplit = true
        }
        break

      case 'ice-arrow-convergence':
        for (const arrow of snapshot.arrows) {
          arrow.hasConvergence = true
        }
        break

      case 'ice-arrow-tracking':
        for (const arrow of snapshot.arrows) {
          arrow.hasTracking = true
          arrow.trackingTurnSpeed = 30
          arrow.speed = Math.round(arrow.speed * 0.85)
        }
        break
    }
  }

  // 2. 統一套用金卡效果到所有箭（含數量卡新增的）
  for (const card of goldCards) {
    switch (card.id) {
      case 'ice-arrow-cold-zone':
        for (const arrow of snapshot.arrows) {
          arrow.hasColdZone = true
        }
        break

      case 'ice-arrow-chain':
        for (const arrow of snapshot.arrows) {
          arrow.hasChainExplosion = true
        }
        break
    }
  }

  return snapshot
}

// ── 冰錐卡片定義 ──

/** 冰錐技能的完整快照（經卡片堆疊計算後） */
export interface IceSpikeSnapshot {
  cooldown: number
  arcAngle: number
  castRange: number
  pillarCount: number
  damage: number
  /** 銀卡：凍土蔓延 */
  hasSpread: boolean
  /** 銀卡：冰柱牢籠 */
  isCage: boolean
  /** 銀卡：冰晶地雷 */
  isMine: boolean
  /** 順序互動：地雷卡在蔓延卡之後 → 蔓延冰錐也是地雷 */
  spreadIsMine: boolean
  /** 金卡：永凍結晶 */
  hasPermafrost: boolean
  /** 金卡：冰錐共振 */
  hasResonance: boolean
}

export const iceSpikeCards: CardDefinition[] = [
  // 銅卡
  {
    id: 'ice-spike-arc-20',
    name: '冰錐範圍 +20°',
    skillId: 'ice-spike',
    rarity: 'bronze',
    description: '弧形範圍擴大 20°，冰錐柱數不變（每根間距變大）',
    orderNote: '純數值修正，不受順序影響',
  },
  {
    id: 'ice-spike-cooldown',
    name: '冰錐冷卻 -0.4s',
    skillId: 'ice-spike',
    rarity: 'bronze',
    description: '冷卻時間減少 0.4 秒（可疊加，最低 0.5s）',
    orderNote: '純數值修正，不受順序影響',
  },
  {
    id: 'ice-spike-pillar-3',
    name: '冰錐柱數 +3',
    skillId: 'ice-spike',
    rarity: 'bronze',
    description: '在現有弧形範圍內增加 3 根冰錐柱，自動均分排列',
    orderNote: '純數值修正，不受順序影響',
  },
  // 銀卡
  {
    id: 'ice-spike-spread',
    name: '凍土蔓延',
    skillId: 'ice-spike',
    rarity: 'silver',
    description: '命中區域後向弧形兩端蔓延新冰錐（延伸 80px），蔓延傷害 50%',
    orderNote: '後拿的柱數卡會影響蔓延範圍；牢籠模式下無效',
  },
  {
    id: 'ice-spike-cage',
    name: '冰柱牢籠',
    skillId: 'ice-spike',
    rarity: 'silver',
    description: '弧形改為封閉圓環（半徑 60px），牢籠持續 3s。代價：冷卻 +1.5s',
    orderNote: '改變形狀為環形，蔓延卡在牢籠模式下無效',
  },
  {
    id: 'ice-spike-mine',
    name: '冰晶地雷',
    skillId: 'ice-spike',
    rarity: 'silver',
    description: '潛伏模式：冰錐不立即射出，敵人踏入時觸發。持續 8s，傷害 x1.5',
    orderNote: '放在蔓延卡之後 → 蔓延冰錐也是地雷',
  },
  // 金卡
  {
    id: 'ice-spike-permafrost',
    name: '永凍結晶',
    skillId: 'ice-spike',
    rarity: 'gold',
    description: '所有冰錐（含未來）命中失溫敵人時直接凍結 1.5s，凍結中受傷 +25%',
    orderNote: '金卡：不受順序影響，作用於所有現有及未來的冰錐',
  },
  {
    id: 'ice-spike-resonance',
    name: '冰錐共振',
    skillId: 'ice-spike',
    rarity: 'gold',
    description: '所有冰錐（含未來）同時命中 3+ 敵人時觸發共振波（120px，80% 傷害）',
    orderNote: '金卡：不受順序影響，需要多木樁才能觸發',
  },
]

/**
 * 根據卡片序列計算冰錐快照
 * 銅卡：純數值修正
 * 銀卡：順序依賴行為修改
 * 金卡：全局效果，最後統一套用
 */
export function computeIceSpikeSnapshot(cardSequence: CardDefinition[]): IceSpikeSnapshot {
  const snapshot: IceSpikeSnapshot = {
    cooldown: 2.5,
    arcAngle: 60,
    castRange: 200,
    pillarCount: 5,
    damage: 25,
    hasSpread: false,
    isCage: false,
    isMine: false,
    spreadIsMine: false,
    hasPermafrost: false,
    hasResonance: false,
  }

  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')

  // 1. 依序處理銅/銀卡（順序依賴）
  let spreadAdded = false

  for (const card of sequentialCards) {
    switch (card.id) {
      // 銅卡
      case 'ice-spike-arc-20':
        snapshot.arcAngle += 20
        break

      case 'ice-spike-cooldown':
        snapshot.cooldown = Math.max(0.5, snapshot.cooldown - 0.4)
        break

      case 'ice-spike-pillar-3':
        snapshot.pillarCount += 3
        break

      // 銀卡
      case 'ice-spike-spread':
        snapshot.hasSpread = true
        spreadAdded = true
        break

      case 'ice-spike-cage':
        snapshot.isCage = true
        snapshot.cooldown += 1.5
        break

      case 'ice-spike-mine':
        snapshot.isMine = true
        if (spreadAdded) {
          snapshot.spreadIsMine = true
        }
        break
    }
  }

  // 2. 統一套用金卡效果
  for (const card of goldCards) {
    switch (card.id) {
      case 'ice-spike-permafrost':
        snapshot.hasPermafrost = true
        break

      case 'ice-spike-resonance':
        snapshot.hasResonance = true
        break
    }
  }

  return snapshot
}

// ── 火球卡片定義 ──

/** 單顆火球的實例快照 */
export interface FireballInstance {
  damage: number
  explosionRadius: number
  hasBounce: boolean
  hasLava: boolean
  hasScatter: boolean
  isMeteor: boolean
  hasWildfire: boolean
  hasChainExplosion: boolean
}

/** 火球技能的完整快照（經卡片堆疊計算後） */
export interface FireballSnapshot {
  cooldown: number
  throwDistance: number
  spreadAngle: number
  fireballs: FireballInstance[]
}

/** 火球初始單顆實例 */
const BASE_FIREBALL: FireballInstance = {
  damage: 45,
  explosionRadius: 80,
  hasBounce: false,
  hasLava: false,
  hasScatter: false,
  isMeteor: false,
  hasWildfire: false,
  hasChainExplosion: false,
}

export const fireballCards: CardDefinition[] = [
  // 銅卡
  {
    id: 'fireball-count-1',
    name: '火球數量 +1',
    skillId: 'fireball',
    rarity: 'bronze',
    description: '新增 1 顆初始數值的火球，多顆火球以散射角均分',
    orderNote: '放在行為卡之後，新增的火球不繼承之前的行為效果',
  },
  {
    id: 'fireball-radius-25',
    name: '爆炸半徑 +25px',
    skillId: 'fireball',
    rarity: 'bronze',
    description: '所有現有火球的爆炸範圍擴大 25px',
    orderNote: '只影響放入此卡時已存在的火球',
  },
  {
    id: 'fireball-cooldown',
    name: '火球冷卻 -0.5s',
    skillId: 'fireball',
    rarity: 'bronze',
    description: '整體冷卻時間縮短 0.5 秒（可疊加，最低 0.5s）',
    orderNote: '不受順序影響，疊加多張效果累積',
  },
  // 銀卡
  {
    id: 'fireball-bounce',
    name: '烈焰彈跳',
    skillId: 'fireball',
    rarity: 'silver',
    description: '所有現有火球爆炸後彈跳，向前 100px 產生第二次爆炸（60% 傷害）',
    orderNote: '先拿彈跳再拿數量 → 新火球不彈跳',
  },
  {
    id: 'fireball-lava',
    name: '熔岩殘留',
    skillId: 'fireball',
    rarity: 'silver',
    description: '所有現有火球爆炸後留下熔岩地面（半徑=爆炸×0.6，4s，20%傷害/秒，-25%速度）',
    orderNote: '彈跳火球兩次落點都會留熔岩',
  },
  {
    id: 'fireball-scatter',
    name: '裂焰擴散',
    skillId: 'fireball',
    rarity: 'silver',
    description: '所有現有火球爆炸時從邊緣射出 4 顆火花（飛 120px，30% 傷害，40px 半徑）',
    orderNote: '將點狀爆炸轉為擴散覆蓋，先拿再拿數量 → 新火球不擴散',
  },
  {
    id: 'fireball-meteor',
    name: '隕石墜落',
    skillId: 'fireball',
    rarity: 'silver',
    description: '所有現有火球改為從天而降（+0.8s 延遲，傷害 ×1.8，半徑 ×1.3，±30px 偏移）',
    orderNote: '犧牲精準度換取大範圍高傷害，先拿再拿數量 → 新火球非隕石',
  },
  // 金卡
  {
    id: 'fireball-wildfire',
    name: '野火燎原',
    skillId: 'fireball',
    rarity: 'gold',
    description: '所有火球（含未來）擊殺敵人後屍體燃燒 3s，接觸傷害；其他火球可引爆（+50% 傷害）',
    orderNote: '金卡：不受順序影響，作用於所有現有及未來的火球',
  },
  {
    id: 'fireball-chain-explosion',
    name: '連環爆破',
    skillId: 'fireball',
    rarity: 'gold',
    description: '所有火球（含未來）爆炸範圍內的灼燒敵人觸發引爆（剩餘灼傷 ×2 瞬間傷害）',
    orderNote: '金卡：鼓勵搭配熔岩殘留先灼燒再引爆',
  },
]

/**
 * 根據卡片序列計算火球快照
 * 核心機制：順序依賴堆疊
 * - 銅/銀卡：順序依賴，只影響「當下已存在」的火球
 * - 金卡：全局效果，不受順序影響，最後統一套用
 */
export function computeFireballSnapshot(cardSequence: CardDefinition[]): FireballSnapshot {
  const snapshot: FireballSnapshot = {
    cooldown: 3,
    throwDistance: 250,
    spreadAngle: 30,
    fireballs: [{ ...BASE_FIREBALL }],
  }

  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')

  // 1. 依序處理銅/銀卡
  for (const card of sequentialCards) {
    switch (card.id) {
      // 銅卡
      case 'fireball-count-1':
        snapshot.fireballs.push({ ...BASE_FIREBALL })
        break

      case 'fireball-radius-25':
        for (const fb of snapshot.fireballs) {
          fb.explosionRadius += 25
        }
        break

      case 'fireball-cooldown':
        snapshot.cooldown = Math.max(0.5, snapshot.cooldown - 0.5)
        break

      // 銀卡
      case 'fireball-bounce':
        for (const fb of snapshot.fireballs) {
          fb.hasBounce = true
        }
        break

      case 'fireball-lava':
        for (const fb of snapshot.fireballs) {
          fb.hasLava = true
        }
        break

      case 'fireball-scatter':
        for (const fb of snapshot.fireballs) {
          fb.hasScatter = true
        }
        break

      case 'fireball-meteor':
        for (const fb of snapshot.fireballs) {
          fb.isMeteor = true
          fb.damage = Math.round(fb.damage * 1.8)
          fb.explosionRadius = Math.round(fb.explosionRadius * 1.3)
        }
        break
    }
  }

  // 2. 統一套用金卡效果到所有火球（含數量卡新增的）
  for (const card of goldCards) {
    switch (card.id) {
      case 'fireball-wildfire':
        for (const fb of snapshot.fireballs) {
          fb.hasWildfire = true
        }
        break

      case 'fireball-chain-explosion':
        for (const fb of snapshot.fireballs) {
          fb.hasChainExplosion = true
        }
        break
    }
  }

  return snapshot
}

// ── 光束卡片定義 ──

/** 單道光束的實例快照 */
export interface BeamInstance {
  dps: number
  width: number
  hasRefraction: boolean
  /** 折射光束捕捉的寬度（放入折射卡時的寬度） */
  refractionWidth: number
  hasFocusBurn: boolean
  hasPrismSplit: boolean
  isPulseMode: boolean
  hasBurningTrail: boolean
  hasOverload: boolean
}

/** 光束技能的完整快照（經卡片堆疊計算後） */
export interface BeamSnapshot {
  cooldown: number
  range: number
  duration: number
  beams: BeamInstance[]
}

/** 光束初始單道實例 */
const BASE_BEAM: BeamInstance = {
  dps: 30,
  width: 20,
  hasRefraction: false,
  refractionWidth: 20,
  hasFocusBurn: false,
  hasPrismSplit: false,
  isPulseMode: false,
  hasBurningTrail: false,
  hasOverload: false,
}

export const beamCards: CardDefinition[] = [
  // 銅卡
  {
    id: 'beam-count-1',
    name: '光束數量 +1',
    skillId: 'beam',
    rarity: 'bronze',
    description: '新增一道初始數值的光束（朝不同方向的最近敵人）',
    orderNote: '放在行為卡之後，新增的光束不繼承之前的行為效果',
  },
  {
    id: 'beam-width-15',
    name: '光束寬度 +15px',
    skillId: 'beam',
    rarity: 'bronze',
    description: '所有現有光束的寬度增加 15px',
    orderNote: '只影響放入此卡時已存在的光束',
  },
  {
    id: 'beam-cooldown',
    name: '光束冷卻 -0.5s',
    skillId: 'beam',
    rarity: 'bronze',
    description: '整體冷卻時間縮短 0.5 秒（可疊加，最低 0.5s）',
    orderNote: '不受順序影響，疊加多張效果累積',
  },
  // 銀卡
  {
    id: 'beam-refraction',
    name: '折射光束',
    skillId: 'beam',
    rarity: 'silver',
    description: '所有現有光束碰到第一個敵人後，折射到 200px 內的下一個敵人（70% 傷害），最多折射 2 次',
    orderNote: '後拿的寬度卡不影響折射光束的寬度',
  },
  {
    id: 'beam-focus-burn',
    name: '聚焦灼燒',
    skillId: 'beam',
    rarity: 'silver',
    description: '所有現有光束持續照射同一目標時，每秒傷害遞增 15%（最多 250%），切換目標時重置',
    orderNote: '鼓勵對 Boss 持續集火',
  },
  {
    id: 'beam-prism',
    name: '稜鏡分解',
    skillId: 'beam',
    rarity: 'silver',
    description: '所有現有光束穿過首個敵人後，分成 3 道窄光束（寬度 1/3），30° 扇形擴散，各 40% 傷害',
    orderNote: '三道同時命中同一目標時傷害合計 ×1.5',
  },
  {
    id: 'beam-pulse',
    name: '脈衝模式',
    skillId: 'beam',
    rarity: 'silver',
    description: '所有現有光束改為每 0.3s 發射脈衝，傷害 = DPS×0.5，有 50px 擊退，每次重新瞄準',
    orderNote: '犧牲持續鎖定換取擊退和靈活瞄準',
  },
  // 金卡
  {
    id: 'beam-burning-trail',
    name: '灼熱殘影',
    skillId: 'beam',
    rarity: 'gold',
    description: '所有光束（含未來）照射結束後，路徑留下殘影光帶 2s，造成 30% DPS 灼傷',
    orderNote: '金卡：不受順序影響，作用於所有現有及未來的光束',
  },
  {
    id: 'beam-overload',
    name: '能量過載',
    skillId: 'beam',
    rarity: 'gold',
    description: '所有光束（含未來）最後 0.5s 進入過載：傷害 ×3、寬度 ×2，過載後冷卻 +1s',
    orderNote: '金卡：不受順序影響，作用於所有現有及未來的光束',
  },
]

/**
 * 根據卡片序列計算光束快照
 * 核心機制：順序依賴堆疊
 * - 銅/銀卡：順序依賴，只影響「當下已存在」的光束
 * - 金卡：全局效果，不受順序影響，最後統一套用
 */
export function computeBeamSnapshot(cardSequence: CardDefinition[]): BeamSnapshot {
  const snapshot: BeamSnapshot = {
    cooldown: 3,
    range: 400,
    duration: 2,
    beams: [{ ...BASE_BEAM }],
  }

  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')

  // 1. 依序處理銅/銀卡
  for (const card of sequentialCards) {
    switch (card.id) {
      // 銅卡
      case 'beam-count-1':
        snapshot.beams.push({ ...BASE_BEAM })
        break

      case 'beam-width-15':
        for (const b of snapshot.beams) {
          b.width += 15
        }
        break

      case 'beam-cooldown':
        snapshot.cooldown = Math.max(0.5, snapshot.cooldown - 0.5)
        break

      // 銀卡
      case 'beam-refraction':
        for (const b of snapshot.beams) {
          b.hasRefraction = true
          b.refractionWidth = b.width // 捕捉當前寬度，後拿的寬度卡不影響折射寬度
        }
        break

      case 'beam-focus-burn':
        for (const b of snapshot.beams) {
          b.hasFocusBurn = true
        }
        break

      case 'beam-prism':
        for (const b of snapshot.beams) {
          b.hasPrismSplit = true
        }
        break

      case 'beam-pulse':
        for (const b of snapshot.beams) {
          b.isPulseMode = true
        }
        break
    }
  }

  // 2. 統一套用金卡效果到所有光束（含數量卡新增的）
  for (const card of goldCards) {
    switch (card.id) {
      case 'beam-burning-trail':
        for (const b of snapshot.beams) {
          b.hasBurningTrail = true
        }
        break

      case 'beam-overload':
        for (const b of snapshot.beams) {
          b.hasOverload = true
        }
        // 能量過載：冷卻 +1s（過載每次都觸發，直接加入冷卻）
        snapshot.cooldown += 1
        break
    }
  }

  return snapshot
}

/** 稀有度顯示配色 */
export const rarityColors: Record<CardRarity, { border: string; bg: string; text: string }> = {
  bronze: { border: 'border-amber-600', bg: 'bg-amber-900/30', text: 'text-amber-400' },
  silver: { border: 'border-slate-300', bg: 'bg-slate-700/30', text: 'text-slate-300' },
  gold: { border: 'border-yellow-400', bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
}

/** 稀有度中文名 */
export const rarityNames: Record<CardRarity, string> = {
  bronze: '銅卡',
  silver: '銀卡',
  gold: '金卡',
}
