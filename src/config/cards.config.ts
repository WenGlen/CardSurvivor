/**
 * 卡片效果數值配置
 *
 * 所有卡片相關的百分比、倍率、持續時間等數值集中在此。
 * 未來可擴充：疊加卡片的數值遞減/遞增、 per-stack 參數等。
 *
 * 使用方式：import { getCardValue } from './cards.config'
 * 或直接 import CARD_VALUES from './cards.config'
 */

/** 冰箭卡片數值 */
export const ICE_ARROW_CARD = {
  'ice-arrow-tracking': {
    trackingTurnSpeed: 30,
    speedMultiplier: 0.85,
  },
  'ice-arrow-chill-boost': {
    chillChanceBonus: 0.3,
  },
  'ice-arrow-split': { splitDamageRatio: 0.5 },
  'ice-arrow-burst': { splitDamageRatio: 0.6 },
  'ice-arrow-shard-barrage': {
    shardDamageRatio: 0.15,
    shardCount: 2,
  },
  'ice-arrow-convergence': {
    convergeWindowMs: 500,
    freezeDurationMs: 2000,
    burstDamageRatio: 0.5,
    requiredHitCount: 3,
  },
  'ice-arrow-cold-zone': {
    coldZoneRadius: 40,
    coldZoneDurationMs: 1500,
    slowRate: 0.3,
    iceDmgBonus: 0.2,
  },
  'ice-arrow-chain': {
    chainDamageRatio: 0.4,
    chainCount: 3,
    chainDecay: 0.4,
  },
} as const

/** 凍土卡片數值 */
export const ICE_SPIKE_CARD = {
  'ice-spike-cage': {
    cageRadius: 100,
    cageRadiusWithSpread: 130,
    cooldownBonus: 1,
  },
  'ice-spike-mine': {
    damageMultiplier: 1.5,
    mineDuration: 8,
  },
  'ice-spike-spread': {
    spreadAngleBonus: 50,
    spreadDamageRatio: 0.5,
  },
  'ice-spike-double-hit': {
    delayMs: 500,
    secondHitMultiplier: 2,
  },
  'ice-spike-shard-splash': {
    shardDamageRatio: 0.2,
    shardCount: 2,
    shardTravelDistance: 60,
  },
  'ice-spike-permafrost': {
    freezeDurationMs: 1500,
    frozenDmgBonus: 0.25,
  },
  'ice-spike-resonance': {
    waveRadius: 120,
    waveDamageRatio: 0.8,
    requiredEnemyCount: 3,
  },
} as const

/** 火球卡片數值 */
export const FIREBALL_CARD = {
  'fireball-count-1': {},
  'fireball-radius-25': { radiusBonus: 25 },
  'fireball-cooldown': { cooldownReduction: 0.5, minCooldown: 0.5 },
  'fireball-bounce': {
    bounceDistance: 100,
    bounceDamageRatio: 0.6,
  },
  'fireball-lava': {
    lavaRadiusRatio: 0.6,
    lavaDurationMs: 4000,
    lavaDpsRatio: 0.2,
    lavaSlowRate: 0.25,
  },
  'fireball-scatter': {
    sparkCount: 4,
    sparkDistance: 120,
    sparkDamageRatio: 0.3,
    sparkRadius: 40,
  },
  'fireball-meteor': {
    delaySeconds: 0.8,
    damageMultiplier: 1.8,
    radiusMultiplier: 1.3,
    offsetRange: 30,
  },
  'fireball-wildfire': {
    corpseBurnDurationMs: 3000,
    corpseExplodeDamageRatio: 0.5,
  },
  'fireball-chain-explosion': {
    burnExplodeMultiplier: 2,
  },
} as const

/** 光束卡片數值 */
export const BEAM_CARD = {
  'beam-knockback': {
    knockbackDistance: 50,
  },
  'beam-dual-line': {
    splitCount: 2,
    angleOffsetDeg: 15,
    damageRatioPerBeam: 0.5,
  },
  'beam-refraction': {
    refractionRange: 200,
    refractionDamageRatio: 0.7,
    maxRefractions: 2,
  },
  'beam-prism': {
    splitCount: 3,
    spreadAngleDeg: 30,
    damageRatioPerBeam: 0.4,
    tripleHitMultiplier: 1.5,
  },
  'beam-focus-burn': {
    incrementPerSecond: 0.15,
    maxMultiplier: 2.5,
  },
  'beam-overload-tail': {
    tailDurationMs: 500,
    tailDamageMultiplier: 2,
  },
  'beam-burning-trail': {
    trailDurationMs: 2000,
    trailDpsRatio: 0.3,
  },
  'beam-overload': {
    overloadDurationMs: 500,
    overloadDamageMultiplier: 3,
    overloadWidthMultiplier: 2,
  },
} as const

