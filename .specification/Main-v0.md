這是一份為你量身打造的 **《Survivor-lite 網頁遊戲開發企劃書》**。這份文件專為 AI Agent（如 Claude 或 GPT-4）設計，採用了模組化架構，確保未來在加入更多怪物、卡片或聖物系統時，代碼不會崩潰。

---

# 專案名稱：Project Survivor-X (暫定)

## 1. 技術棧與架構要求 (Tech Stack)

* **前端框架**：React 18+ (Functional Components)
* **語言**：TypeScript (嚴格類型定義，特別是針對 `Entity` 與 `Effect`)
* **樣式**：SCSS (採用 BEM 命名規範，模組化樣式)
* **狀態管理**：Zustand (輕量且適合頻繁更新的遊戲狀態)
* **渲染方案**：React-Canvas 或純 DOM (初期建議使用 Canvas 處理大量怪物，確保手機端效能)
* **碰撞偵測**：簡單的圓形/矩形碰撞算法。

---

## 2. 核心遊戲循環 (Core Loop)

1. **局外整備**：玩家在 3 個卡槽中裝備「永久卡片」。
2. **進入關卡**：根據關卡目標（存活/移動/擊殺）進行戰鬥。
3. **局內成長**：擊殺怪物掉落經驗，升級時獲得「臨時卡片」。
4. **結算與提取**：通關後，從臨時卡片中挑選一張轉為「永久卡片」。

---

## 3. 核心系統設計

### A. 觸控與操控系統 (Input System)

* **虛擬搖桿 (Virtual Joystick)**：左手區域控制移動。
* **自動戰鬥**：主角自動攻擊最近的敵人，玩家專注於位移避險。
* **響應式佈局**：自動偵測螢幕比例，適配手機直屏或橫屏。

### B. 擴充性最強的「卡片與技能系統」

為了實現高度堆疊與擴充，採用 **「裝載器模式 (Loader Pattern)」**：

* **卡槽限制**：主角擁有 3 個核心卡槽（例如：Slot A, B, C）。
* **卡片層次**：
1. **主動技能卡 (Base Card)**：定義攻擊型態（如：冰錐、電球、光束）。
2. **強化修正卡 (Modifier Card)**：不改變型態，但改變數值（如：攻擊範圍 +20%、冷卻 -10%、分裂數量 +1）。


* **堆疊邏輯**：
* 同類型修正卡採用 `Multiplicative` (乘法) 或 `Additive` (加法) 計算。
* **範例**：若卡槽裝備「電球」，後續獲得 3 張「轉速加強」，電球旋轉速度會線性上升。



### C. 任務與關卡系統 (Mission System)

使用配置文件 (JSON) 定義關卡，便於未來擴充：

* **存活模式**：設定 `timeLimit: 300` 秒。
* **導航模式**：定義 `waypoints` 座標，玩家依序到達。
* **殲滅模式**：設定 `killTarget: 500`。

---

## 4. 資料結構預定義 (TypeScript Interfaces)

為了讓 Agent 寫出好擴充的代碼，請要求它遵循以下介面：

```typescript
// 技能定義
interface SkillCard {
  id: string;
  type: 'ACTIVE' | 'MODIFIER';
  tag: 'ICE' | 'LIGHTNING' | 'FIRE' | 'BEAM'; // 元素類型
  level: number;
  stats: {
    damage?: number;
    range?: number;
    cooldown?: number;
    speed?: number;
  };
}

// 關卡定義
interface LevelConfig {
  id: number;
  objective: 'SURVIVE' | 'REACH_DEST' | 'KILL_COUNT';
  targetValue: number;
  enemyPool: string[]; // 該關卡會出現的怪物 ID
  mapSeed: string;
}

```

---

## 5. 局外成長與擴充預留 (Meta-Progression)

* **聖物系統 (Relics)**：不佔用卡槽的被動加成（如：拾取範圍增加、初始生命加成）。
* **怪物組件化**：
* `BaseEnemy`：基礎移動 AI。
* `RangedEnemy`：遠程投射。
* `SwarmEnemy`：群體衝鋒。


* **主題樣式**：透過 SCSS 變數，一鍵更換關卡視覺風格（如：森林、沙漠、地牢）。

---

## 6. 給 Agent 的開發步驟建議 (Prompt Order)

1. **第一步**：建立基本的遊戲引擎環境，包含 React 渲染循環與基礎的主角移動（支援 WASD 與觸控虛擬搖桿）。
2. **第二步**：實作 `Entity` 系統，能讓畫面上出現隨機移動的怪物與碰撞判定。
3. **第三步**：開發「卡片與技能系統」，優先實作你提到的四種攻擊型態：
* **冰錐**：放射狀低傷。
* **電球**：環繞主角。
* **光束**：直線穿透。
* **火焰**：前方扇形。


4. **第四步**：建立「升級與卡片選單」介面，實作卡片堆疊邏輯。
5. **第五步**：實作關卡結算提取卡片的 UI 與本地存檔功能 (LocalStorage)。

---

### 您希望我先為您撰寫哪一部分的具體代碼？例如：

* **A. 虛擬搖桿與移動邏輯 (React + Touch Events)**
* **B. 卡片堆疊與技能發動機機制 (TypeScript Logic)**
* **C. 關卡與任務配置系統 (JSON Architecture)**