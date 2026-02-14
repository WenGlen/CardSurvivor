# 遊戲參數配置

機制與數值分離，便於平衡調整。修改此目錄下的 config 檔即可微調數值，無需改動邏輯程式碼。

## 檔案結構

| 檔案 | 用途 | 主要內容 |
|------|------|----------|
| `skills.config.ts` | 技能基礎參數 | 冰箭、凍土、火球、光束的初始數值 |
| `cards.config.ts` | 卡片效果數值 | 各卡片 ID 對應的百分比、倍率、持續時間 |
| `fragments.config.ts` | 強化碎片（地圖掉落物） | 類型權重、存在時間、拾取倍率 |
| `infinite.config.ts` | 無限模式 | 波次、敵人成長、生成、抽卡權重、計分 |
| `combat.config.ts` | 戰鬥通用 | 無敵時間、減速係數、倍率邊界 |
| `index.ts` | 統一匯出 | 方便 `import { X } from '../config'` |

## 使用方式

```ts
import { ICE_ARROW_BASE, FIREBALL_CARD } from '../config'

// 技能基礎
const damage = ICE_ARROW_BASE.damage

// 卡片效果（依 card id 取得）
const splitRatio = FIREBALL_CARD['fireball-bounce'].bounceDamageRatio
```

## 未來擴充

- **疊加卡片數值**：可在 `cards.config.ts` 為每張卡新增 `perStack` 參數，例如 `perStack: { damageRatio: -0.05 }` 表示每疊一張傷害 -5%
- **關卡難度**：可新增 `difficulty.config.ts`，依難度覆寫無限模式參數
- **A/B 測試**：可建立 `config.override.ts` 覆蓋特定值，方便實驗不同平衡
