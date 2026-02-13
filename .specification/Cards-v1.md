# 卡片系統核心機制設計文件 v1.0

> 本文檔定義了 Survivor-X 遊戲的核心卡片堆疊系統，採用「順序依賴堆疊（Sequential Stacking）」機制，將卡片組合從單純的數值遊戲轉變為「技能邏輯編寫」。

---

## 1. 核心設計哲學：順序依賴堆疊（Sequential Stacking）

### 1.1 設計理念

不同於一般遊戲將所有加成「加總」後套用，本遊戲的技能強度取決於**卡片放入的先後順序**。這意味著：

- **先強化後複製**：得到多個強力的子彈/物件（高成本策略）
- **先複製後強化**：得到一個強力的主體 + 多個弱小的副本（適合觸發特效或分散火力）

### 1.2 快照機制（Snapshot Mechanism）

為了達成「後面的卡片不套用前面效果」，我們不能使用傳統的 `Base * (1 + Sum)` 公式。系統採用**快照機制**，將技能視為一個不斷演化的物件：

- **技能實體（Skill Instance）**：每個卡槽維護一個「當前屬性快照（CurrentState）」
- **屬性卡（Stat Modifier）**：直接修改快照中的數值（例如：`current_speed *= 1.2`）
- **衍生卡（Spawn/Split Modifier）**：根據「目前的快照」產生新的子彈或物件

### 1.3 運作邏輯（線性演化模型）

系統在處理卡片序列時，會由左至右逐一讀取：

1. **初始啟動**：玩家放入「主動技能卡」，產生 `Instance[0]`（母體）與其「當前屬性快照」
2. **屬性強化（Buff）**：放入強化卡（如傷害+50%），會直接修改 `CurrentState` 的數值
3. **衍生產生（Spawn）**：放入數量卡（如數量+1），系統會根據**「那一刻」**的 `CurrentState` 複製出一份 `Instance[1]`（子體）
4. **後續隔離**：在此之後放入的強化卡，只會修改 `CurrentState`（母體），**不會回溯修改已經產生的子體**

### 1.4 實例說明：電球技能

**初始狀態**：1 顆電球，速度 100

**卡片 A（速度 +20%）**：將「當前快照」的速度改為 120

**卡片 B（數量 +1）**：根據「當前快照」再產生 1 顆電球
- 電球 1（速度 120）← 母體
- 電球 2（速度 120）← 子體（繼承當時的快照）

**卡片 C（速度 +50%）**：只修改母體的 `CurrentState`
- 電球 1（速度 180）← 母體被強化
- 電球 2（速度 120）← 子體保持不變

---

## 2. 系統基礎架構

### 2.1 槽位限制（Slot System）

- 主角擁有 **3 個固定卡槽**（Slot A, B, C）
- 每個卡槽的第一張卡必須是**「主動技能卡（Base Card）」**
- 後續疊加的為**「強化修正卡（Modifier Card）」**

### 2.2 卡片類型定義

#### 主動技能卡（Base Card）
- 定義攻擊型態（如：冰錐、電球、光束、火焰）
- 包含基礎屬性值（傷害、速度、範圍等）
- 每個卡槽只能有一張，且必須放在第一位

#### 強化修正卡（Modifier Card）
- 不改變技能型態，但改變數值或行為
- 分為兩大類：
  - **屬性修正卡**：修改數值（如：攻擊範圍 +20%、冷卻 -10%）
  - **衍生修正卡**：產生副本（如：數量 +1、分裂 +1）

### 2.3 堆疊計算規則

- **屬性修正卡**：採用 `Multiplicative`（乘法）或 `Additive`（加法）計算
- **衍生修正卡**：根據當前快照複製，產生新的實例
- **冷卻時間**：每疊加一張卡，該技能的冷卻時間會微幅增加，防止單一技能無限膨脹

---

## 3. 技能參數池定義

為了應對多樣化的技能，所有技能共享一套通用的參數池，方便未來透過標籤（Tag）進行全域擴充。

### 3.1 基礎物理參數（Base Physics）

| 參數名稱 | 說明 | 適用技能範例 |
|---------|------|------------|
| `damage` | 基礎傷害值 | 所有攻擊技能 |
| `cooldown` | 兩次攻擊間的間隔時間（秒） | 所有技能 |
| `duration` | 持續時間，子彈/效果消失前的時間（秒） | 電球、火焰、毒霧 |
| `speed` | 移動/旋轉速度（像素/秒 或 度/秒） | 冰錐、電球、風刃 |
| `radius` / `size` | 範圍/半徑（像素）或扇形角度（度） | 電球、火焰、毒霧 |
| `range` | 最大射程/作用距離（像素） | 光束、風刃、崩落 |

### 3.2 特效與行為參數（Behavioral）

| 參數名稱 | 說明 | 適用技能範例 |
|---------|------|------------|
| `count` | 數量（子彈/物件數量） | 所有可複製的技能 |
| `pierceCount` | 穿透力，子彈可以穿過多少怪物 | 冰錐、光束 |
| `bounceCount` | 彈跳次數，碰到牆壁或怪物是否彈跳 | 電球（可選） |
| `splitCount` | 分裂數，擊中後是否產生小碎片 | 冰錐、連鎖閃電 |
| `spreadAngle` | 散射角度（度），多發子彈時的張開角度 | 冰錐、火焰 |
| `knockback` | 擊退距離（像素） | 風刃、衝撞 |
| `chance` | 機率值（0-1），觸發特殊效果的機率 | 詛咒、冰錐貫穿 |
| `slowRate` | 減速比例（0-1），降低敵人移動速度 | 毒霧、冰錐 |
| `captureLimit` | 囚禁數量上限 | 水球 |
| `chainCount` | 連鎖跳躍次數 | 連鎖閃電 |
| `pullForce` | 吸引力強度 | 黑洞 |

### 3.3 元素屬性（Elemental Tags）

| 標籤 | 說明 | 附加效果 |
|-----|------|---------|
| `ICE` | 冰系 | 減速（Slow） |
| `LIGHTNING` | 雷系 | 感電（Shock） |
| `FIRE` | 火系 | 灼燒（Burn） |
| `BEAM` | 光束 | 持續傷害 |
| `POISON` | 毒系 | 持續傷害（DOT） |
| `PHYSICAL` | 物理 | 擊退（Knockback） |

---

## 4. 技能卡片全書

### 4.1 技能列表與核心機制

| 類型 | 技能名稱 | 核心機制 | 主要參數 | 策略玩法（順序影響） |
|------|---------|---------|---------|-------------------|
| **投射** | **冰錐** | 直線發射，有機率貫穿 | `damage`, `speed`, `pierceCount`, `chance`, `spreadAngle` | 先疊穿透再疊數量：每發都能穿透。先疊數量再疊穿透：只有第一發能穿透。 |
| **環繞** | **電球** | 繞身旋轉，持續觸碰傷害 | `damage`, `speed`, `radius`, `duration` | 先疊速度再疊數量：所有球同步高速旋轉。後疊數量：形成內外圈不同速的「防禦網」。 |
| **持續** | **光束** | 鎖定最近敵人持續照射 | `damage`, `range`, `radius`, `duration` | 先疊寬度：產生粗大的主光束。後疊數量：主光束粗，副光束細，適合掃蕩殘血。 |
| **近戰** | **火焰** | 扇形噴射，附帶灼燒 | `damage`, `angle`, `range`, `duration` | 先疊角度：噴射範圍變大。先疊數量：產生多個窄角度火焰，形成離散的「火網」。 |
| **區域** | **毒霧** | 腳下生成持續傷害區域 | `damage`, `radius`, `slowRate`, `duration`, `tickRate` | 先疊範圍再疊數量：雙重超大毒區。先疊數量再疊範圍：一個大毒區配上幾個小傷害區。 |
| **位移** | **衝撞** | 向搖桿方向衝刺 | `damage`, `dashDistance`, `invincibleTime` | 先疊距離：長程衝撞。後疊數量：連段衝撞，但第二次之後的衝撞傷害較低。 |
| **控制** | **風刃** | 擊退敵人，傷害隨距離衰減 | `damage`, `speed`, `angle`, `knockback`, `falloffRatio` | 先疊擊退：保命神技。先疊數量：只有第一發能推開怪，後面是純補傷害。 |
| **束縛** | **水球** | 囚禁複數敵人至死 | `damage`, `captureLimit`, `duration` | 先疊容量：一次關住一群精英怪。後疊數量：主球關大怪，副球關雜魚。 |
| **陷阱** | **崩落** | 定點造成敵方卡死 | `damage`, `castRange`, `radius`, `trapDuration` | 先疊施法距離：遠程控制。後疊數量：能在腳下補放一個保命小陷阱。 |
| **概率** | **詛咒** | 極低機率直接斬殺 | `killChance`, `cooldown`, `targetCount` | 先疊機率：針對 BOSS。先疊數量：多發小機率，拼「抽獎」次數。 |
| **策略** | **魅惑** | 轉換敵方陣營 | `charmDuration`, `atkBuff`, `chance` | 先疊 Buff：魅惑一隻變超強戰友。先疊數量：組建一支弱小的傀儡軍團。 |
| **聚怪** | **黑洞** | 強力吸引中心點 | `damage`, `pullForce`, `radius`, `duration` | 先疊吸力：瞬間聚怪。先疊數量：大黑洞吸怪，小黑洞在旁持續干擾。 |
| **鏈接** | **連鎖閃電** | 敵人跳躍式傷害 | `damage`, `chainCount`, `range`, `falloffRatio` | 先疊跳躍：清理大群怪。先疊數量：第一發跳得遠，後續發射的只會電附近的怪。 |

### 4.2 策略範例：毒霧技能深度解析

**策略 A（廣域擴張）**：毒霧 + 範圍增加 + 產生副本

- **結果**：腳下出現一個超級大的毒雲，並且因為「產生副本」是在範圍增加之後，它會複製目前這個「大毒雲」的狀態，所以會得到兩個大毒雲。

**策略 B（精準打擊）**：毒霧 + 產生副本 + 範圍增加

- **結果**：先產生了一個副本（此時兩者都是小毒雲），然後「範圍增加」只作用於主體。會得到一個大毒雲 + 一個小毒雲。

**設計目的**：逼玩家思考是要一個極限強大的單體，還是要一堆性能平平的群體。對於手機遊玩這種零碎時間的操作來說，思考「怎麼插卡」本身就是一種樂趣。

---

## 5. TypeScript 資料結構設計

### 5.1 核心介面定義

```typescript
// 技能屬性統計
interface SkillStats {
  // 基礎物理參數
  damage: number;
  cooldown: number;
  duration: number;
  speed: number;
  radius: number;
  range: number;
  
  // 行為參數
  count: number;
  pierceCount: number;
  bounceCount: number;
  splitCount: number;
  spreadAngle: number;
  knockback: number;
  chance: number;
  slowRate: number;
  captureLimit: number;
  chainCount: number;
  pullForce: number;
  
  // 特殊參數（依技能而定）
  [key: string]: number;
}

// 卡片效果的操作類型
type ModifierOp = 'MULTIPLY' | 'ADD' | 'SET' | 'SPAWN_COPY';

// 卡片效果定義
interface CardEffect {
  property: keyof SkillStats; // 要修改哪一個參數
  operation: ModifierOp;      // 操作類型
  value: number;              // 操作數值
}

// 元素標籤
type ElementTag = 'ICE' | 'LIGHTNING' | 'FIRE' | 'BEAM' | 'POISON' | 'PHYSICAL';

// 卡片定義
interface Card {
  id: string;
  name: string;
  type: 'BASE' | 'MODIFIER';
  tag?: ElementTag;           // 元素類型（僅主動技能卡需要）
  level: number;              // 卡片等級
  effects: CardEffect[];      // 效果列表
  description: string;        // 卡片描述
}

// 技能實例（卡槽中的技能）
interface SkillInstance {
  id: string;
  slotId: string;             // 所屬卡槽 ID
  baseCard: Card;             // 主動技能卡
  modifierCards: Card[];      // 強化修正卡序列
  currentState: SkillStats;   // 當前屬性快照
  instances: SkillStats[];    // 最終生成的各個子體數據快照
}

// 卡槽定義
interface CardSlot {
  id: string;
  baseCard: Card | null;      // 主動技能卡（第一張）
  modifierCards: Card[];      // 強化修正卡序列
}
```

### 5.2 技能演化邏輯實作範例

```typescript
class ActiveSkill {
  private baseStats: SkillStats;      // 初始數值
  private currentState: SkillStats;   // 當前屬性快照
  private instances: SkillStats[];    // 每一顆子彈/物件的獨立數值快照
  
  constructor(baseCard: Card) {
    this.baseStats = this.initializeStats(baseCard);
    this.currentState = { ...this.baseStats };
    this.instances = [{ ...this.currentState }]; // 初始母體
  }
  
  // 應用卡片效果
  applyCard(card: Card): void {
    if (card.type === 'BASE') {
      // 不應該在已有基礎卡的情況下再添加基礎卡
      throw new Error('Cannot apply base card to existing skill');
    }
    
    // 處理每種效果
    for (const effect of card.effects) {
      this.applyEffect(effect);
    }
  }
  
  // 應用單一效果
  private applyEffect(effect: CardEffect): void {
    const { property, operation, value } = effect;
    
    if (operation === 'SPAWN_COPY') {
      // 衍生修正：根據當前快照複製
      const snapshot = { ...this.currentState };
      this.instances.push(snapshot);
      // 如果 effect.value > 1，可以產生多個副本
      for (let i = 1; i < value; i++) {
        this.instances.push({ ...snapshot });
      }
    } else {
      // 屬性修正：只修改母體（instances[0]）和當前快照
      switch (operation) {
        case 'MULTIPLY':
          this.currentState[property] *= value;
          this.instances[0][property] *= value;
          break;
        case 'ADD':
          this.currentState[property] += value;
          this.instances[0][property] += value;
          break;
        case 'SET':
          this.currentState[property] = value;
          this.instances[0][property] = value;
          break;
      }
    }
  }
  
  // 初始化基礎屬性
  private initializeStats(baseCard: Card): SkillStats {
    // 根據 baseCard 的 effects 初始化
    const stats: SkillStats = {
      damage: 0,
      cooldown: 1,
      duration: 0,
      speed: 0,
      radius: 0,
      range: 0,
      count: 1,
      pierceCount: 0,
      bounceCount: 0,
      splitCount: 0,
      spreadAngle: 0,
      knockback: 0,
      chance: 0,
      slowRate: 0,
      captureLimit: 0,
      chainCount: 0,
      pullForce: 0,
    };
    
    for (const effect of baseCard.effects) {
      if (effect.operation === 'SET') {
        stats[effect.property] = effect.value;
      }
    }
    
    return stats;
  }
  
  // 獲取所有實例的快照
  getInstances(): SkillStats[] {
    return this.instances;
  }
  
  // 獲取當前狀態（用於預覽）
  getCurrentState(): SkillStats {
    return { ...this.currentState };
  }
}
```

### 5.3 三層數據傳遞架構

為了讓開發者能夠理解這套複雜的系統，開發時需區分三種數據流：

1. **藍圖數據（Blueprint）**：卡片的原始定義（JSON 配置檔）
2. **演化數據（Evolution）**：玩家在卡槽中排列的「卡片序列」
3. **運行實例（Runtime Instance）**：戰鬥中根據演化數據生成的 `GameObject`

---

## 6. 平衡性考量

### 6.1 資源消耗限制（Energy Cost）

- 卡片堆疊順序不僅影響效果，還會影響**冷卻時間（CD）**
- **公式建議**：每一張後置卡片都會額外增加該技能的總冷卻時間
- 這會逼玩家思考：是要一個「超強但 10 秒發一次」的技能，還是「三個普通但連發」的技能

### 6.2 邊際效益遞減

- 對於 `Speed` 或 `Radius` 等物理參數，設定**硬上限（Hard Cap）**
- 例如：電球旋轉速度最快不能超過某個值，否則會造成碰撞偵測失效
- 例如：傷害加成可能有軟上限，超過後收益遞減

### 6.3 關卡屬性剋制

- **毒霧** 對建築物或機械怪無效
- **魅惑** 對精英怪機率減半
- **冰錐** 在「極寒關卡」傷害加倍，但在「岩漿關卡」會快速消融（距離縮短）

### 6.4 局內成長平衡

- **等級與臨時卡**：擊殺怪物獲得經驗。升級時，玩家從隨機三張卡中選一
- **位置權重**：玩家必須決定將這張卡「插入」哪一個技能槽位的末端
- **冷卻平衡**：每疊加一張卡，該技能的冷卻時間會微幅增加，防止單一技能無限膨脹

---

## 7. 開發實作指南

### 7.1 卡片序列演化邏輯實作步驟

1. **初始化技能**：讀取主動技能卡，建立初始 `CurrentState`
2. **依序處理修正卡**：由左至右逐一讀取修正卡
3. **判斷效果類型**：
   - 屬性修正 → 修改 `CurrentState` 和 `instances[0]`
   - 衍生修正 → 複製當前 `CurrentState` 到 `instances` 陣列
4. **生成運行實例**：根據 `instances` 陣列中的每個快照，生成對應的遊戲物件

### 7.2 手機端適配（Mobile UX）

- **操作方案**：左手虛擬搖桿（Joystick）負責移動
- **自動鎖定**：技能優先朝最近敵人發射（部分技能如「崩落」可透過長按拖曳指定位置）
- **UI 佈局**：卡片序列採橫向排列，點擊可即時查看該序列產生的「最終預期傷害」

### 7.3 局外成長與提取機制

- **提取機制**：通關後，玩家可以從該局使用的「臨時卡片」中**挑選一張**永久保留
- **戰前配置**：進入關卡前，玩家可從永久倉庫中挑選卡片填滿 3 個初始槽位

---

## 8. 總結

本文件定義了 Survivor-X 遊戲的核心卡片堆疊系統，採用「順序依賴堆疊」機制，透過快照系統實現「後面的卡片不套用前面效果」的設計目標。這套系統將卡片組合從單純的數值遊戲轉變為「技能邏輯編寫」，為玩家提供深度的策略思考空間。

### 核心要點回顧

1. **快照機制**：每個卡槽維護一個當前屬性快照，屬性卡修改快照，衍生卡複製快照
2. **順序依賴**：卡片放入的先後順序決定最終效果，創造策略深度
3. **參數池設計**：所有技能共享通用參數池，便於擴充和平衡
4. **三層架構**：藍圖數據 → 演化數據 → 運行實例，清晰分離關注點

---

**版本**：v1.0  
**最後更新**：2024  
**適用專案**：Survivor-X

