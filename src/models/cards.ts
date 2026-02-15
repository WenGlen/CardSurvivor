import {
  ICE_ARROW_BASE,
  ICE_SPIKE_BASE,
  FIREBALL_BASE,
  BEAM_BASE,
  ELECTRIC_BALL_BASE,
  ICE_ARROW_CARD,
  ICE_SPIKE_CARD,
  FIREBALL_CARD,
  BEAM_CARD,
  ELECTRIC_BALL_CARD,
} from '../config'

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

/** 單支冰箭的實例快照（CardsDetail-v3） */
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
  /** 銀卡：碎冰彈幕，命中時射出 2 顆微型碎冰（各 15%） */
  hasShardBarrage: boolean
  /** 銅卡：失溫增幅，觸發失溫機率 +30% */
  chillChanceBonus: number
}

/** 冰箭技能的完整快照（經卡片堆疊計算後） */
export interface IceArrowSnapshot {
  cooldown: number
  /** 發射方式：360° 均分（主方向=最近敵人），spreadAngle 保留供未來卡片擴展 */
  spreadAngle: number
  arrows: ArrowInstance[]
}

/** 取得用於強化碎片「數量」的初始箭（深拷貝） */
export function getBaseArrowForExtra(): ArrowInstance {
  return {
    damage: ICE_ARROW_BASE.damage,
    speed: ICE_ARROW_BASE.speed,
    pierceCount: ICE_ARROW_BASE.pierceCount,
    hasSplit: false,
    splitDamageRatio: ICE_ARROW_CARD['ice-arrow-split'].splitDamageRatio,
    splitCount: 2,
    splitAngle: 45,
    isFragment: false,
    hasTracking: false,
    trackingTurnSpeed: 0,
    hasColdZone: false,
    hasConvergence: false,
    hasChainExplosion: false,
    hasShardBarrage: false,
    chillChanceBonus: 0,
  }
}

/** 冰箭初始單支箭實例 */
const BASE_ARROW: ArrowInstance = {
  ...getBaseArrowForExtra(),
}

// ── 冰箭卡片定義（CardsDetail-v3：無純數值卡，銅銀金分層）──

export const iceArrowCards: CardDefinition[] = [
  // 銅卡：玩法改變・總值不變・未來不套用
  {
    id: 'ice-arrow-tracking',
    name: '追蹤冰晶',
    skillId: 'ice-arrow',
    rarity: 'bronze',
    description: `微幅自動追蹤（${ICE_ARROW_CARD['ice-arrow-tracking'].trackingTurnSpeed}°/s），飛行速度降低 ${Math.round((1 - ICE_ARROW_CARD['ice-arrow-tracking'].speedMultiplier) * 100)}%`,
    orderNote: '爆發產生的碎片不追蹤；金卡極寒領域讓碎片擊中也產生寒氣',
  },
  {
    id: 'ice-arrow-chill-boost',
    name: '失溫增幅',
    skillId: 'ice-arrow',
    rarity: 'bronze',
    description: `觸發失溫的機率 +${Math.round(ICE_ARROW_CARD['ice-arrow-chill-boost'].chillChanceBonus * 100)}%`,
    orderNote: '分裂→失溫：母箭與碎片都可高機率失溫；失溫→分裂：只有母箭',
  },
  // 銀卡：總傷害增加・未來不套用
  {
    id: 'ice-arrow-pierce',
    name: '寒冰穿刺',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: '所有現有冰箭穿透 +1，穿透時傷害不衰減（最高可達約兩倍傷害）',
    orderNote: '只影響放入此卡時已存在的冰箭',
  },
  {
    id: 'ice-arrow-split',
    name: '冰晶分裂',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: `穿透敵人後分裂成 2 支小冰箭（各 ${Math.round(ICE_ARROW_CARD['ice-arrow-split'].splitDamageRatio * 100)}% 傷害），主箭命中 + 碎片 = 總傷害增加`,
    orderNote: '穿刺→分裂：碎片不穿透；分裂→穿刺：只有母箭穿透',
  },
  {
    id: 'ice-arrow-burst',
    name: '冰晶爆發',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: `穿透後分裂成 2 支小箭（各 ${Math.round(ICE_ARROW_CARD['ice-arrow-burst'].splitDamageRatio * 100)}% 傷害），總傷害 ${Math.round(ICE_ARROW_CARD['ice-arrow-burst'].splitDamageRatio * 2 * 100)}%`,
    orderNote: '爆發是數量放大器：先拿則彈幕等「每支箭」效果作用於更多箭',
  },
  {
    id: 'ice-arrow-convergence',
    name: '寒霜聚合',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: `${ICE_ARROW_CARD['ice-arrow-convergence'].requiredHitCount} 支以上冰箭 ${ICE_ARROW_CARD['ice-arrow-convergence'].convergeWindowMs / 1000}s 內擊中同一敵人 → 冰封 ${ICE_ARROW_CARD['ice-arrow-convergence'].freezeDurationMs / 1000}s，結束時受累積傷害 ${Math.round(ICE_ARROW_CARD['ice-arrow-convergence'].burstDamageRatio * 100)}% 碎冰爆傷`,
    orderNote: '彈幕→聚合：微型碎冰計入；聚合→彈幕：只有主箭與分裂碎片計入',
  },
  {
    id: 'ice-arrow-shard-barrage',
    name: '碎冰彈幕',
    skillId: 'ice-arrow',
    rarity: 'silver',
    description: `命中時射出 ${ICE_ARROW_CARD['ice-arrow-shard-barrage'].shardCount} 顆微型碎冰（各 ${Math.round(ICE_ARROW_CARD['ice-arrow-shard-barrage'].shardDamageRatio * 100)}% 傷害），總傷害 +${Math.round(ICE_ARROW_CARD['ice-arrow-shard-barrage'].shardDamageRatio * ICE_ARROW_CARD['ice-arrow-shard-barrage'].shardCount * 100)}%`,
    orderNote: '爆發→彈幕：每支 60% 箭都帶碎冰；彈幕→爆發：只有母箭帶碎冰',
  },
  // 金卡：未來效果也套用
  {
    id: 'ice-arrow-cold-zone',
    name: '極寒領域',
    skillId: 'ice-arrow',
    rarity: 'gold',
    description: `所有冰箭（含未來新增）命中時產生寒氣區域（${ICE_ARROW_CARD['ice-arrow-cold-zone'].coldZoneRadius}px，${ICE_ARROW_CARD['ice-arrow-cold-zone'].coldZoneDurationMs / 1000}s），減速 ${Math.round(ICE_ARROW_CARD['ice-arrow-cold-zone'].slowRate * 100)}%、冰傷 +${Math.round(ICE_ARROW_CARD['ice-arrow-cold-zone'].iceDmgBonus * 100)}%`,
    orderNote: '金卡：分裂碎片、彈幕碎冰擊中皆產生寒氣區',
  },
  {
    id: 'ice-arrow-chain',
    name: '冰暴連鎖',
    skillId: 'ice-arrow',
    rarity: 'gold',
    description: `擊殺時爆裂成 ${ICE_ARROW_CARD['ice-arrow-chain'].chainCount} 支碎冰箭（${Math.round(ICE_ARROW_CARD['ice-arrow-chain'].chainDamageRatio * 100)}% 傷害），最多連鎖 ${ICE_ARROW_CARD['ice-arrow-chain'].chainCount} 次`,
    orderNote: '金卡：碎片擊殺也能觸發連鎖',
  },
]

/**
 * 根據卡片序列計算冰箭快照（CardsDetail-v3）
 * 銅/銀卡：順序依賴，只影響「當下已存在」的箭
 * 金卡：全局效果，最後統一套用到所有箭
 */
export function computeIceArrowSnapshot(cardSequence: CardDefinition[]): IceArrowSnapshot {
  const snapshot: IceArrowSnapshot = {
    cooldown: ICE_ARROW_BASE.cooldown,
    spreadAngle: ICE_ARROW_BASE.spreadAngle,
    arrows: [
      { ...BASE_ARROW },
      { ...BASE_ARROW },
      { ...BASE_ARROW },
    ],
  }

  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')

  for (const card of sequentialCards) {
    switch (card.id) {
      case 'ice-arrow-split':
        for (const arrow of snapshot.arrows) {
          arrow.hasSplit = true
          arrow.splitDamageRatio = ICE_ARROW_CARD['ice-arrow-split'].splitDamageRatio
        }
        break

      case 'ice-arrow-pierce':
        for (const arrow of snapshot.arrows) {
          arrow.pierceCount += 1
        }
        break

      case 'ice-arrow-tracking':
        for (const arrow of snapshot.arrows) {
          arrow.hasTracking = true
          arrow.trackingTurnSpeed = ICE_ARROW_CARD['ice-arrow-tracking'].trackingTurnSpeed
          arrow.speed = Math.round(arrow.speed * ICE_ARROW_CARD['ice-arrow-tracking'].speedMultiplier)
        }
        break

      case 'ice-arrow-chill-boost':
        for (const arrow of snapshot.arrows) {
          arrow.chillChanceBonus = ICE_ARROW_CARD['ice-arrow-chill-boost'].chillChanceBonus
        }
        break

      case 'ice-arrow-burst':
        for (const arrow of snapshot.arrows) {
          arrow.hasSplit = true
          arrow.splitDamageRatio = ICE_ARROW_CARD['ice-arrow-burst'].splitDamageRatio
        }
        break

      case 'ice-arrow-convergence':
        for (const arrow of snapshot.arrows) {
          arrow.hasConvergence = true
        }
        break

      case 'ice-arrow-shard-barrage':
        for (const arrow of snapshot.arrows) {
          arrow.hasShardBarrage = true
        }
        break
    }
  }

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

/** 對單一陣列內的箭套用一張銅/銀卡效果（in-place） */
export function applyIceArrowSequentialCardToArrows(card: CardDefinition, arrows: ArrowInstance[]): void {
  for (const arrow of arrows) {
    switch (card.id) {
      case 'ice-arrow-split': arrow.hasSplit = true; arrow.splitDamageRatio = ICE_ARROW_CARD['ice-arrow-split'].splitDamageRatio; break
      case 'ice-arrow-pierce': arrow.pierceCount += 1; break
      case 'ice-arrow-tracking': arrow.hasTracking = true; arrow.trackingTurnSpeed = ICE_ARROW_CARD['ice-arrow-tracking'].trackingTurnSpeed; arrow.speed = Math.round(arrow.speed * ICE_ARROW_CARD['ice-arrow-tracking'].speedMultiplier); break
      case 'ice-arrow-chill-boost': arrow.chillChanceBonus = ICE_ARROW_CARD['ice-arrow-chill-boost'].chillChanceBonus; break
      case 'ice-arrow-burst': arrow.hasSplit = true; arrow.splitDamageRatio = ICE_ARROW_CARD['ice-arrow-burst'].splitDamageRatio; break
      case 'ice-arrow-convergence': arrow.hasConvergence = true; break
      case 'ice-arrow-shard-barrage': arrow.hasShardBarrage = true; break
    }
  }
}

/** 對單一箭套用一張金卡效果（in-place） */
export function applyIceArrowGoldCardToArrow(card: CardDefinition, arrow: ArrowInstance): void {
  switch (card.id) {
    case 'ice-arrow-cold-zone': arrow.hasColdZone = true; break
    case 'ice-arrow-chain': arrow.hasChainExplosion = true; break
  }
}

// ── 凍土卡片定義（CardsDetail-v3）──

/** 凍土技能的完整快照（經卡片堆疊計算後） */
export interface IceSpikeSnapshot {
  cooldown: number
  arcAngle: number
  castRange: number
  duration: number
  dps: number
  slowRate: number
  /** 銅卡：凍土追蹤 */
  hasTracking: boolean
  /** 銅卡：酷寒領域 */
  isCage: boolean
  /** 銀卡：凍土地雷 */
  isMine: boolean
  /** 銀卡：凍土蔓延 */
  hasSpread: boolean
  /** 順序：地雷在蔓延之後 → 蔓延凍土也是地雷 */
  spreadIsMine: boolean
  /** 銀卡：凍土二重擊 */
  hasDoubleHit: boolean
  /** 銀卡：碎冰飛濺 */
  hasShardSplash: boolean
  /** 蔓延區是否套用二重擊（僅當二重擊在蔓延之後取得時為 true） */
  spreadHasDoubleHit: boolean
  /** 蔓延區是否套用碎冰飛濺（僅當飛濺在蔓延之後取得時為 true） */
  spreadHasShardSplash: boolean
  /** 金卡：永凍結晶 */
  hasPermafrost: boolean
  /** 金卡：凍土共振 */
  hasResonance: boolean
}

export const iceSpikeCards: CardDefinition[] = [
  // 銅卡（CardsDetail-v3 2-1, 2-2）
  {
    id: 'ice-spike-tracking',
    name: '凍土追蹤',
    skillId: 'ice-spike',
    rarity: 'bronze',
    description: '凍土改為鎖定最近敵人腳下生成，而非主角前方',
    orderNote: '先拿蔓延再拿追蹤 → 蔓延的凍土不追蹤',
  },
  {
    id: 'ice-spike-cage',
    name: '酷寒領域',
    skillId: 'ice-spike',
    rarity: 'bronze',
    description: `扇形改為以主角為圓心的封閉圓環（半徑 ${ICE_SPIKE_CARD['ice-spike-cage'].cageRadius}px，蔓延時 ${ICE_SPIKE_CARD['ice-spike-cage'].cageRadiusWithSpread}px），持續 ${ICE_SPIKE_BASE.duration}s。代價：冷卻 +${ICE_SPIKE_CARD['ice-spike-cage'].cooldownBonus}s`,
    orderNote: '疊加追蹤時改在最近敵人腳下生成',
  },
  // 銀卡（CardsDetail-v3 2-3 ~ 2-6）
  {
    id: 'ice-spike-mine',
    name: '凍土地雷',
    skillId: 'ice-spike',
    rarity: 'silver',
    description: `潛伏模式：凍土不立即顯現，敵人踏入時觸發。持續 ${ICE_SPIKE_CARD['ice-spike-mine'].mineDuration}s，傷害 x${ICE_SPIKE_CARD['ice-spike-mine'].damageMultiplier}。非酷寒領域時顯示觸發方向`,
    orderNote: '放在蔓延卡之後 → 蔓延凍土也是地雷',
  },
  {
    id: 'ice-spike-spread',
    name: '凍土蔓延',
    skillId: 'ice-spike',
    rarity: 'silver',
    description: `凍土生成後向扇形兩端蔓延（角度 +${ICE_SPIKE_CARD['ice-spike-spread'].spreadAngleBonus}°），蔓延傷害 ${Math.round(ICE_SPIKE_CARD['ice-spike-spread'].spreadDamageRatio * 100)}%`,
    orderNote: '酷寒領域下無效。先拿二重擊/飛濺再拿蔓延 → 蔓延區不套用',
  },
  {
    id: 'ice-spike-double-hit',
    name: '凍土二重擊',
    skillId: 'ice-spike',
    rarity: 'silver',
    description: `凍土首次傷害後 ${ICE_SPIKE_CARD['ice-spike-double-hit'].delayMs / 1000} 秒同一位置再造成 ${Math.round(ICE_SPIKE_CARD['ice-spike-double-hit'].secondHitMultiplier * 100)}% 傷害`,
    orderNote: '與永凍結晶聯動',
  },
  {
    id: 'ice-spike-shard-splash',
    name: '碎冰飛濺',
    skillId: 'ice-spike',
    rarity: 'silver',
    description: `凍土每次造成傷害時射出 ${ICE_SPIKE_CARD['ice-spike-shard-splash'].shardCount} 根小冰刺（各 ${Math.round(ICE_SPIKE_CARD['ice-spike-shard-splash'].shardDamageRatio * 100)}%），飛行 ${ICE_SPIKE_CARD['ice-spike-shard-splash'].shardTravelDistance}px`,
    orderNote: '先拿蔓延再拿飛濺 → 主體+蔓延都會飛濺',
  },
  // 金卡（CardsDetail-v3 2-7, 2-8）
  {
    id: 'ice-spike-permafrost',
    name: '永凍結晶',
    skillId: 'ice-spike',
    rarity: 'gold',
    description: `凍土命中失溫敵人時直接凍結 ${ICE_SPIKE_CARD['ice-spike-permafrost'].freezeDurationMs / 1000}s，凍結中受傷 +${Math.round(ICE_SPIKE_CARD['ice-spike-permafrost'].frozenDmgBonus * 100)}%`,
    orderNote: '蔓延、地雷、飛濺等衍生物都觸發',
  },
  {
    id: 'ice-spike-resonance',
    name: '凍土共振',
    skillId: 'ice-spike',
    rarity: 'gold',
    description: `凍土同時命中 ${ICE_SPIKE_CARD['ice-spike-resonance'].requiredEnemyCount}+ 敵人時觸發寒氣衝擊波（${ICE_SPIKE_CARD['ice-spike-resonance'].waveRadius}px，${Math.round(ICE_SPIKE_CARD['ice-spike-resonance'].waveDamageRatio * 100)}% 傷害）`,
    orderNote: '蔓延區域覆蓋多人也會共振',
  },
]

/**
 * 根據卡片序列計算凍土快照（CardsDetail-v3）
 */
export function computeIceSpikeSnapshot(cardSequence: CardDefinition[]): IceSpikeSnapshot {
  const snapshot: IceSpikeSnapshot = {
    cooldown: ICE_SPIKE_BASE.cooldown,
    arcAngle: ICE_SPIKE_BASE.arcAngle,
    castRange: ICE_SPIKE_BASE.castRange,
    duration: ICE_SPIKE_BASE.duration,
    dps: Math.round(ICE_SPIKE_BASE.baseDps * ICE_SPIKE_BASE.dpsRatio),
    slowRate: ICE_SPIKE_BASE.slowRate,
    hasTracking: false,
    isCage: false,
    isMine: false,
    hasSpread: false,
    spreadIsMine: false,
    hasDoubleHit: false,
    hasShardSplash: false,
    spreadHasDoubleHit: false,
    spreadHasShardSplash: false,
    hasPermafrost: false,
    hasResonance: false,
  }

  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')
  let spreadAdded = false
  let spreadIndex = -1
  let doubleHitIndex = -1
  let shardSplashIndex = -1
  let idx = 0

  for (const card of sequentialCards) {
    switch (card.id) {
      case 'ice-spike-tracking':
        snapshot.hasTracking = true
        break
      case 'ice-spike-cage':
        snapshot.isCage = true
        snapshot.cooldown += ICE_SPIKE_CARD['ice-spike-cage'].cooldownBonus
        break
      case 'ice-spike-mine':
        snapshot.isMine = true
        if (spreadAdded) snapshot.spreadIsMine = true
        break
      case 'ice-spike-spread':
        snapshot.hasSpread = true
        spreadAdded = true
        spreadIndex = idx
        break
      case 'ice-spike-double-hit':
        snapshot.hasDoubleHit = true
        doubleHitIndex = idx
        break
      case 'ice-spike-shard-splash':
        snapshot.hasShardSplash = true
        shardSplashIndex = idx
        break
    }
    idx++
  }

  snapshot.spreadHasDoubleHit = snapshot.hasDoubleHit && spreadIndex >= 0 && doubleHitIndex > spreadIndex
  snapshot.spreadHasShardSplash = snapshot.hasShardSplash && spreadIndex >= 0 && shardSplashIndex > spreadIndex

  for (const card of goldCards) {
    if (card.id === 'ice-spike-permafrost') snapshot.hasPermafrost = true
    if (card.id === 'ice-spike-resonance') snapshot.hasResonance = true
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

/** 取得用於強化碎片「數量」的初始火球 */
export function getBaseFireballForExtra(): FireballInstance {
  return {
    damage: FIREBALL_BASE.damage,
    explosionRadius: FIREBALL_BASE.explosionRadius,
    hasBounce: false,
    hasLava: false,
    hasScatter: false,
    isMeteor: false,
    hasWildfire: false,
    hasChainExplosion: false,
  }
}

/** 火球初始單顆實例 */
const BASE_FIREBALL: FireballInstance = {
  damage: FIREBALL_BASE.damage,
  explosionRadius: FIREBALL_BASE.explosionRadius,
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
    name: `爆炸半徑 +${FIREBALL_CARD['fireball-radius-25'].radiusBonus}px`,
    skillId: 'fireball',
    rarity: 'bronze',
    description: `所有現有火球的爆炸範圍擴大 ${FIREBALL_CARD['fireball-radius-25'].radiusBonus}px`,
    orderNote: '只影響放入此卡時已存在的火球',
  },
  {
    id: 'fireball-cooldown',
    name: `火球冷卻 -${FIREBALL_CARD['fireball-cooldown'].cooldownReduction}s`,
    skillId: 'fireball',
    rarity: 'bronze',
    description: `整體冷卻時間縮短 ${FIREBALL_CARD['fireball-cooldown'].cooldownReduction} 秒（可疊加，最低 ${FIREBALL_CARD['fireball-cooldown'].minCooldown}s）`,
    orderNote: '不受順序影響，疊加多張效果累積',
  },
  // 銀卡
  {
    id: 'fireball-bounce',
    name: '烈焰彈跳',
    skillId: 'fireball',
    rarity: 'silver',
    description: `所有現有火球爆炸後彈跳，向前 ${FIREBALL_CARD['fireball-bounce'].bounceDistance}px 產生第二次爆炸（${Math.round(FIREBALL_CARD['fireball-bounce'].bounceDamageRatio * 100)}% 傷害）`,
    orderNote: '先拿彈跳再拿數量 → 新火球不彈跳',
  },
  {
    id: 'fireball-lava',
    name: '熔岩殘留',
    skillId: 'fireball',
    rarity: 'silver',
    description: `所有現有火球爆炸後留下熔岩地面（半徑=爆炸×${FIREBALL_CARD['fireball-lava'].lavaRadiusRatio}，${FIREBALL_CARD['fireball-lava'].lavaDurationMs / 1000}s，${Math.round(FIREBALL_CARD['fireball-lava'].lavaDpsRatio * 100)}%傷害/秒，-${Math.round(FIREBALL_CARD['fireball-lava'].lavaSlowRate * 100)}%速度）`,
    orderNote: '彈跳火球兩次落點都會留熔岩',
  },
  {
    id: 'fireball-scatter',
    name: '裂焰擴散',
    skillId: 'fireball',
    rarity: 'silver',
    description: `所有現有火球爆炸時從邊緣射出 ${FIREBALL_CARD['fireball-scatter'].sparkCount} 顆火花（飛 ${FIREBALL_CARD['fireball-scatter'].sparkDistance}px，${Math.round(FIREBALL_CARD['fireball-scatter'].sparkDamageRatio * 100)}% 傷害，${FIREBALL_CARD['fireball-scatter'].sparkRadius}px 半徑）`,
    orderNote: '將點狀爆炸轉為擴散覆蓋，先拿再拿數量 → 新火球不擴散',
  },
  {
    id: 'fireball-meteor',
    name: '隕石墜落',
    skillId: 'fireball',
    rarity: 'silver',
    description: `所有現有火球改為從天而降（+${FIREBALL_CARD['fireball-meteor'].delaySeconds}s 延遲，傷害 ×${FIREBALL_CARD['fireball-meteor'].damageMultiplier}，半徑 ×${FIREBALL_CARD['fireball-meteor'].radiusMultiplier}，±${FIREBALL_CARD['fireball-meteor'].offsetRange}px 偏移）`,
    orderNote: '犧牲精準度換取大範圍高傷害，先拿再拿數量 → 新火球非隕石',
  },
  // 金卡
  {
    id: 'fireball-wildfire',
    name: '野火燎原',
    skillId: 'fireball',
    rarity: 'gold',
    description: `所有火球（含未來）擊殺敵人後屍體燃燒 ${FIREBALL_CARD['fireball-wildfire'].corpseBurnDurationMs / 1000}s，接觸傷害；其他火球可引爆（+${Math.round(FIREBALL_CARD['fireball-wildfire'].corpseExplodeDamageRatio * 100)}% 傷害）`,
    orderNote: '金卡：不受順序影響，作用於所有現有及未來的火球',
  },
  {
    id: 'fireball-chain-explosion',
    name: '連環爆破',
    skillId: 'fireball',
    rarity: 'gold',
    description: `所有火球（含未來）爆炸範圍內的灼燒敵人觸發引爆（剩餘灼傷 ×${FIREBALL_CARD['fireball-chain-explosion'].burnExplodeMultiplier} 瞬間傷害）`,
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
    cooldown: FIREBALL_BASE.cooldown,
    throwDistance: FIREBALL_BASE.throwDistance,
    spreadAngle: FIREBALL_BASE.spreadAngle,
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
          fb.explosionRadius += FIREBALL_CARD['fireball-radius-25'].radiusBonus
        }
        break

      case 'fireball-cooldown': {
        const cfg = FIREBALL_CARD['fireball-cooldown']
        snapshot.cooldown = Math.max(cfg.minCooldown, snapshot.cooldown - cfg.cooldownReduction)
        break
      }

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

      case 'fireball-meteor': {
        const cfg = FIREBALL_CARD['fireball-meteor']
        for (const fb of snapshot.fireballs) {
          fb.isMeteor = true
          fb.damage = Math.round(fb.damage * cfg.damageMultiplier)
          fb.explosionRadius = Math.round(fb.explosionRadius * cfg.radiusMultiplier)
        }
        break
      }
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

/** 對單一陣列內的火球套用一張銅/銀卡效果（in-place） */
export function applyFireballSequentialCardToFireballs(card: CardDefinition, fireballs: FireballInstance[]): void {
  switch (card.id) {
    case 'fireball-count-1':
      fireballs.push({ ...BASE_FIREBALL })
      break
    default:
      for (const fb of fireballs) {
        switch (card.id) {
          case 'fireball-radius-25': fb.explosionRadius += FIREBALL_CARD['fireball-radius-25'].radiusBonus; break
          case 'fireball-bounce': fb.hasBounce = true; break
          case 'fireball-lava': fb.hasLava = true; break
          case 'fireball-scatter': fb.hasScatter = true; break
          case 'fireball-meteor': {
            const cfg = FIREBALL_CARD['fireball-meteor']
            fb.isMeteor = true
            fb.damage = Math.round(fb.damage * cfg.damageMultiplier)
            fb.explosionRadius = Math.round(fb.explosionRadius * cfg.radiusMultiplier)
            break
          }
        }
      }
  }
}

/** 對單一火球套用一張金卡效果（in-place） */
export function applyFireballGoldCardToFireball(card: CardDefinition, fb: FireballInstance): void {
  switch (card.id) {
    case 'fireball-wildfire': fb.hasWildfire = true; break
    case 'fireball-chain-explosion': fb.hasChainExplosion = true; break
  }
}

// ── 電球卡片定義（CardsDetail-v3：環繞物，主角身邊旋轉）──

/** 單顆電球的實例快照（環繞物模板） */
export interface ElectricBallInstance {
  touchDamage: number
  radius: number
  hasLightningChain: boolean
  hasAttach: boolean
  hasEmp: boolean
  hasStormCore: boolean
  hasChainBoost: boolean
  hasAttachBurst: boolean
  hasTesla: boolean
  hasSuperconduct: boolean
}

/** 電球技能的完整快照（經卡片堆疊計算後） */
export interface ElectricBallSnapshot {
  orbs: ElectricBallInstance[]
  /** EMP 上次釋放時間（由引擎維護） */
  lastEmpTime?: number
}

/** 取得用於強化碎片「數量」的初始電球 */
export function getBaseElectricBallForExtra(): ElectricBallInstance {
  return {
    touchDamage: ELECTRIC_BALL_BASE.damage,
    radius: ELECTRIC_BALL_BASE.radius,
    hasLightningChain: false,
    hasAttach: false,
    hasEmp: false,
    hasStormCore: false,
    hasChainBoost: false,
    hasAttachBurst: false,
    hasTesla: false,
    hasSuperconduct: false,
  }
}

/** 電球初始單顆實例 */
const BASE_ELECTRIC_BALL: ElectricBallInstance = {
  touchDamage: ELECTRIC_BALL_BASE.damage,
  radius: ELECTRIC_BALL_BASE.radius,
  hasLightningChain: false,
  hasAttach: false,
  hasEmp: false,
  hasStormCore: false,
  hasChainBoost: false,
  hasAttachBurst: false,
  hasTesla: false,
  hasSuperconduct: false,
}

export const electricBallCards: CardDefinition[] = [
  // 銅卡
  {
    id: 'electric-ball-lightning-chain',
    name: '閃電連線',
    skillId: 'electric-ball',
    rarity: 'bronze',
    description: '現有電球之間產生閃電鏈，對穿過的敵人造成傷害（與觸碰分攤，總值持平）',
    orderNote: '需 2 顆以上；後拿的電球不產生新連線',
  },
  {
    id: 'electric-ball-attach',
    name: '電球吸附',
    skillId: 'electric-ball',
    rarity: 'bronze',
    description: `電球碰到敵人後脫離軌道附著在敵人身上 ${ELECTRIC_BALL_CARD['electric-ball-attach'].attachDurationMs / 1000} 秒（每秒 = 傷害 ×${ELECTRIC_BALL_CARD['electric-ball-attach'].attachDamageMultiplier}）`,
    orderNote: '附著期間不參與連線',
  },
  {
    id: 'electric-ball-emp',
    name: '電磁脈衝',
    skillId: 'electric-ball',
    rarity: 'bronze',
    description: `每 ${ELECTRIC_BALL_CARD['electric-ball-emp'].empIntervalMs / 1000} 秒釋放 EMP（半徑 = 旋轉半徑 ×${ELECTRIC_BALL_CARD['electric-ball-emp'].empRadiusMultiplier}），麻痺 ${ELECTRIC_BALL_CARD['electric-ball-emp'].empParalyzeMs / 1000} 秒；釋放時電球暫停 ${ELECTRIC_BALL_CARD['electric-ball-emp'].orbPauseMs / 1000} 秒`,
    orderNote: '後拿的電球不參與 EMP',
  },
  // 銀卡
  {
    id: 'electric-ball-storm-core',
    name: '雷暴核心',
    skillId: 'electric-ball',
    rarity: 'silver',
    description: `電球累計碰觸 ${ELECTRIC_BALL_CARD['electric-ball-storm-core'].touchThreshold} 次後爆炸（範圍 ${ELECTRIC_BALL_CARD['electric-ball-storm-core'].explosionRadius}px，傷害 ×${ELECTRIC_BALL_CARD['electric-ball-storm-core'].explosionDamageMultiplier}），爆炸後消失 ${ELECTRIC_BALL_CARD['electric-ball-storm-core'].respawnDelayMs / 1000} 秒再生成`,
    orderNote: '連線存在時觸碰也算入次數',
  },
  {
    id: 'electric-ball-chain-boost',
    name: '連線增幅',
    skillId: 'electric-ball',
    rarity: 'silver',
    description: `閃電連線傷害提升至 ${ELECTRIC_BALL_CARD['electric-ball-chain-boost'].baseChainDps}/秒，每多一條連線每條 +${ELECTRIC_BALL_CARD['electric-ball-chain-boost'].chainBonusPerLink}`,
    orderNote: '需先有閃電連線',
  },
  {
    id: 'electric-ball-attach-burst',
    name: '附著爆發',
    skillId: 'electric-ball',
    rarity: 'silver',
    description: `吸附結束時在敵人位置產生小型雷暴（半徑 ${ELECTRIC_BALL_CARD['electric-ball-attach-burst'].burstRadius}px，傷害 = 附著總傷 ×${ELECTRIC_BALL_CARD['electric-ball-attach-burst'].burstDamageRatio}）`,
    orderNote: '需先有吸附',
  },
  // 金卡
  {
    id: 'electric-ball-tesla',
    name: '特斯拉線圈',
    skillId: 'electric-ball',
    rarity: 'gold',
    description: `所有電球（含未來）碰觸時 ${Math.round(ELECTRIC_BALL_CARD['electric-ball-tesla'].branchChance * 100)}% 機率向 ${ELECTRIC_BALL_CARD['electric-ball-tesla'].branchRange}px 內另一敵人釋放分支閃電（${Math.round(ELECTRIC_BALL_CARD['electric-ball-tesla'].branchDamageRatio * 100)}% 傷害）`,
    orderNote: '金卡：未來套用',
  },
  {
    id: 'electric-ball-superconduct',
    name: '超導磁場',
    skillId: 'electric-ball',
    rarity: 'gold',
    description: `所有電球（含未來）軌道內形成磁場，進入的敵人移速 -${Math.round(ELECTRIC_BALL_CARD['electric-ball-superconduct'].slowRate * 100)}%、攻速 -${Math.round(ELECTRIC_BALL_CARD['electric-ball-superconduct'].attackSlowRate * 100)}%`,
    orderNote: '金卡：未來套用',
  },
]

/**
 * 根據卡片序列計算電球快照（CardsDetail-v3：環繞物）
 * - 銅/銀卡：順序依賴，只影響「當下已存在」的電球
 * - 金卡：全局效果，不受順序影響，最後統一套用
 */
export function computeElectricBallSnapshot(cardSequence: CardDefinition[]): ElectricBallSnapshot {
  const orbs: ElectricBallInstance[] = []
  for (let i = 0; i < ELECTRIC_BALL_BASE.count; i++) {
    orbs.push({ ...BASE_ELECTRIC_BALL })
  }

  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')

  for (const card of sequentialCards) {
    switch (card.id) {
      case 'electric-ball-lightning-chain':
        for (const eb of orbs) eb.hasLightningChain = true
        break
      case 'electric-ball-attach':
        for (const eb of orbs) eb.hasAttach = true
        break
      case 'electric-ball-emp':
        for (const eb of orbs) eb.hasEmp = true
        break
      case 'electric-ball-storm-core':
        for (const eb of orbs) eb.hasStormCore = true
        break
      case 'electric-ball-chain-boost':
        for (const eb of orbs) eb.hasChainBoost = true
        break
      case 'electric-ball-attach-burst':
        for (const eb of orbs) eb.hasAttachBurst = true
        break
    }
  }

  for (const card of goldCards) {
    switch (card.id) {
      case 'electric-ball-tesla':
        for (const eb of orbs) eb.hasTesla = true
        break
      case 'electric-ball-superconduct':
        for (const eb of orbs) eb.hasSuperconduct = true
        break
    }
  }

  return { orbs }
}

/** 對單一陣列內的電球套用一張銅/銀卡效果（in-place） */
export function applyElectricBallSequentialCardToElectricBalls(card: CardDefinition, orbs: ElectricBallInstance[]): void {
  for (const eb of orbs) {
    switch (card.id) {
      case 'electric-ball-lightning-chain': eb.hasLightningChain = true; break
      case 'electric-ball-attach': eb.hasAttach = true; break
      case 'electric-ball-emp': eb.hasEmp = true; break
      case 'electric-ball-storm-core': eb.hasStormCore = true; break
      case 'electric-ball-chain-boost': eb.hasChainBoost = true; break
      case 'electric-ball-attach-burst': eb.hasAttachBurst = true; break
    }
  }
}

/** 對單一電球套用一張金卡效果（in-place） */
export function applyElectricBallGoldCardToElectricBall(card: CardDefinition, eb: ElectricBallInstance): void {
  switch (card.id) {
    case 'electric-ball-tesla': eb.hasTesla = true; break
    case 'electric-ball-superconduct': eb.hasSuperconduct = true; break
  }
}

// ── 光束卡片定義（CardsDetail-v3：脈衝制、無純數值卡）──

/** 單道光束的實例快照 */
export interface BeamInstance {
  /** 每發傷害（基礎 70，單發模式） */
  pulseDamage: number
  /** 光束寬度 px（基礎 25） */
  width: number
  /** true = 單發（一發即止），false = 連發脈衝 */
  singleShot: boolean
  /** 銅卡：脈衝擊退 50px */
  hasKnockback: boolean
  /** 銅卡：雙線掃射（2 道 ±15°，各 50%，總值不變） */
  hasDualLine: boolean
  /** 銀卡：折射光束 */
  hasRefraction: boolean
  refractionWidth: number
  /** 銀卡：聚焦灼燒 */
  hasFocusBurn: boolean
  /** 銀卡：稜鏡分解 */
  hasPrismSplit: boolean
  /** 銀卡：過載尾段（最後 0.5s 傷害 ×2） */
  hasOverloadTail: boolean
  /** 金卡：灼熱殘影 */
  hasBurningTrail: boolean
  /** 金卡：能量過載 */
  hasOverload: boolean
}

/** 光束技能的完整快照（經卡片堆疊計算後） */
export interface BeamSnapshot {
  cooldown: number
  range: number
  /** 光束顯示持續時間 ms（單發 300，連發 2000） */
  duration: number
  /** 脈衝間隔 ms（連發時 250，單發時不使用） */
  pulseInterval: number
  beams: BeamInstance[]
}

/** 取得用於強化碎片「數量」的初始光束 */
export function getBaseBeamForExtra(): BeamInstance {
  return {
    pulseDamage: BEAM_BASE.pulseDamage,
    width: BEAM_BASE.width,
    singleShot: true,
    hasKnockback: false,
    hasDualLine: false,
    hasRefraction: false,
    refractionWidth: BEAM_BASE.width,
    hasFocusBurn: false,
    hasPrismSplit: false,
    hasOverloadTail: false,
    hasBurningTrail: false,
    hasOverload: false,
  }
}

/** 光束初始單道實例 */
const BASE_BEAM: BeamInstance = {
  pulseDamage: BEAM_BASE.pulseDamage,
  width: BEAM_BASE.width,
  singleShot: true,
  hasKnockback: false,
    hasDualLine: false,
    hasRefraction: false,
    refractionWidth: BEAM_BASE.width,
    hasFocusBurn: false,
  hasPrismSplit: false,
  hasOverloadTail: false,
  hasBurningTrail: false,
  hasOverload: false,
}

export const beamCards: CardDefinition[] = [
  // 銅卡
  {
    id: 'beam-knockback',
    name: '脈衝擊退',
    skillId: 'beam',
    rarity: 'bronze',
    description: `每次脈衝附加擊退 ${BEAM_CARD['beam-knockback'].knockbackDistance}px，總傷害不變`,
    orderNote: '先拿折射再拿擊退 → 折射出的光束也擊退；先拿擊退再拿折射 → 只有首段擊退',
  },
  {
    id: 'beam-dual-line',
    name: '雙線掃射',
    skillId: 'beam',
    rarity: 'bronze',
    description: `光束分裂成 ${BEAM_CARD['beam-dual-line'].splitCount} 道，±${BEAM_CARD['beam-dual-line'].angleOffsetDeg}° 夾角，各 ${Math.round(BEAM_CARD['beam-dual-line'].damageRatioPerBeam * 100)}% 傷害，總傷害不變`,
    orderNote: '雙線→稜鏡 = 6 道光束；稜鏡→雙線 = 只有母體變雙線，分解的 3 道不變',
  },
  // 銀卡
  {
    id: 'beam-refraction',
    name: '折射光束',
    skillId: 'beam',
    rarity: 'silver',
    description: `光束碰到第一個敵人後折射到 ${BEAM_CARD['beam-refraction'].refractionRange}px 內下一個敵人，折射後傷害 ${Math.round(BEAM_CARD['beam-refraction'].refractionDamageRatio * 100)}%`,
    orderNote: '稜鏡→折射 = 折射後再分解 3 道；折射→稜鏡 = 折射出的單道不分解',
  },
  {
    id: 'beam-prism',
    name: '稜鏡分解',
    skillId: 'beam',
    rarity: 'silver',
    description: `光束穿過首個敵人後分成 ${BEAM_CARD['beam-prism'].splitCount} 道窄光束（寬 1/${BEAM_CARD['beam-prism'].splitCount}），${BEAM_CARD['beam-prism'].spreadAngleDeg}° 扇形，各 ${Math.round(BEAM_CARD['beam-prism'].damageRatioPerBeam * 100)}% 傷害`,
    orderNote: '三道同時命中同一目標時合計 ×1.5。聚焦→稜鏡 = 3 道獨立聚焦',
  },
  {
    id: 'beam-focus-burn',
    name: '聚焦灼燒',
    skillId: 'beam',
    rarity: 'silver',
    description: `持續照射同一目標時，每秒傷害遞增 ${Math.round(BEAM_CARD['beam-focus-burn'].incrementPerSecond * 100)}%，最多 ${Math.round(BEAM_CARD['beam-focus-burn'].maxMultiplier * 100)}%`,
    orderNote: '雙線→聚焦 = 2 道光束可各自聚焦不同目標；聚焦→雙線 = 共享聚焦計數器',
  },
  {
    id: 'beam-overload-tail',
    name: '過載尾段',
    skillId: 'beam',
    rarity: 'silver',
    description: `持續時間最後 ${BEAM_CARD['beam-overload-tail'].tailDurationMs / 1000} 秒傷害 ×${BEAM_CARD['beam-overload-tail'].tailDamageMultiplier}`,
    orderNote: '與能量過載（金）疊加：尾段 ×2 再過載 ×3，最後 0.5 秒爆發極高',
  },
  // 金卡（CardsDetail-v3 4-7, 4-8）
  {
    id: 'beam-burning-trail',
    name: '灼熱殘影',
    skillId: 'beam',
    rarity: 'gold',
    description: `所有光束（含未來）照射結束後路徑留下殘影光帶 ${BEAM_CARD['beam-burning-trail'].trailDurationMs / 1000} 秒，${Math.round(BEAM_CARD['beam-burning-trail'].trailDpsRatio * 100)}%/s 灼傷`,
    orderNote: '金卡：折射、稜鏡、雙線的光束都留殘影',
  },
  {
    id: 'beam-overload',
    name: '能量過載',
    skillId: 'beam',
    rarity: 'gold',
    description: `所有光束（含未來）最後 ${BEAM_CARD['beam-overload'].overloadDurationMs / 1000} 秒進入過載：傷害 ×${BEAM_CARD['beam-overload'].overloadDamageMultiplier}、寬度 ×${BEAM_CARD['beam-overload'].overloadWidthMultiplier}`,
    orderNote: '金卡：雙線、稜鏡的光束過載時也 ×3 ×2',
  },
]

/**
 * 根據卡片序列計算光束快照（CardsDetail-v3）
 * 光束預設單發 70 傷、持續 0.3s
 */
export function computeBeamSnapshot(cardSequence: CardDefinition[]): BeamSnapshot {
  const snapshot: BeamSnapshot = {
    cooldown: BEAM_BASE.cooldown,
    range: BEAM_BASE.range,
    duration: BEAM_BASE.duration,
    pulseInterval: BEAM_BASE.pulseInterval,
    beams: [{ ...BASE_BEAM }],
  }

  const sequentialCards = cardSequence.filter((c) => c.rarity !== 'gold')
  const goldCards = cardSequence.filter((c) => c.rarity === 'gold')

  for (const card of sequentialCards) {
    switch (card.id) {
      case 'beam-knockback':
        for (const b of snapshot.beams) b.hasKnockback = true
        break
      case 'beam-refraction':
        for (const b of snapshot.beams) {
          b.hasRefraction = true
          b.refractionWidth = b.width
        }
        break
      case 'beam-prism':
        for (const b of snapshot.beams) b.hasPrismSplit = true
        break
      case 'beam-focus-burn':
        for (const b of snapshot.beams) b.hasFocusBurn = true
        break
      case 'beam-dual-line': {
        const ratio = BEAM_CARD['beam-dual-line'].damageRatioPerBeam
        const newBeams: BeamInstance[] = []
        for (const b of snapshot.beams) {
          const half = Math.round(b.pulseDamage * ratio)
          newBeams.push({ ...b, pulseDamage: half })
          newBeams.push({ ...b, pulseDamage: half })
        }
        snapshot.beams.length = 0
        snapshot.beams.push(...newBeams)
        break
      }
      case 'beam-overload-tail':
        for (const b of snapshot.beams) b.hasOverloadTail = true
        break
    }
  }

  for (const card of goldCards) {
    switch (card.id) {
      case 'beam-burning-trail':
        for (const b of snapshot.beams) b.hasBurningTrail = true
        break
      case 'beam-overload':
        for (const b of snapshot.beams) b.hasOverload = true
        break
    }
  }

  return snapshot
}

/** 對單一陣列內的光束套用一張銅/銀卡效果（in-place） */
export function applyBeamSequentialCardToBeams(card: CardDefinition, beams: BeamInstance[]): void {
  switch (card.id) {
    case 'beam-knockback':
      for (const b of beams) b.hasKnockback = true
      break
    case 'beam-refraction':
      for (const b of beams) {
        b.hasRefraction = true
        b.refractionWidth = b.width
      }
      break
    case 'beam-prism':
      for (const b of beams) b.hasPrismSplit = true
      break
    case 'beam-focus-burn':
      for (const b of beams) b.hasFocusBurn = true
      break
    case 'beam-dual-line': {
      const ratio = BEAM_CARD['beam-dual-line'].damageRatioPerBeam
      const newBeams: BeamInstance[] = []
      for (const b of beams) {
        const half = Math.round(b.pulseDamage * ratio)
        newBeams.push({ ...b, pulseDamage: half })
        newBeams.push({ ...b, pulseDamage: half })
      }
      beams.length = 0
      beams.push(...newBeams)
      break
    }
    case 'beam-overload-tail':
      for (const b of beams) b.hasOverloadTail = true
      break
  }
}

/** 對單道光束套用一張金卡效果（in-place） */
export function applyBeamGoldCardToBeam(card: CardDefinition, b: BeamInstance): void {
  switch (card.id) {
    case 'beam-burning-trail': b.hasBurningTrail = true; break
    case 'beam-overload': b.hasOverload = true; break
  }
}

/** 稀有度顯示配色（Tailwind 類名，用於 className） */
export const rarityColors: Record<CardRarity, { border: string; bg: string; text: string }> = {
  bronze: { border: 'border-amber-600', bg: 'bg-amber-900/30', text: 'text-amber-400' },
  silver: { border: 'border-slate-300', bg: 'bg-slate-700/30', text: 'text-slate-300' },
  gold: { border: 'border-yellow-400', bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
}

/** 稀有度內聯樣式用色（hex，用於 style={{ color }}) */
export const rarityHexColors: Record<CardRarity, string> = {
  bronze: '#d97706',
  silver: '#cbd5e1',
  gold: '#facc15',
}

/** 稀有度中文名 */
export const rarityNames: Record<CardRarity, string> = {
  bronze: '銅卡',
  silver: '銀卡',
  gold: '金卡',
}
