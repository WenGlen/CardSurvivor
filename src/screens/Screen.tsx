import { useState } from 'react'
import LoginScreen from './LoginScreen'
import PracticeScreen from './PracticeScreen'
import InfiniteScreen from './InfiniteScreen'

type ScreenName = 'login' | 'mode-select' | 'practice' | 'infinite'

/** 簡易畫面路由 */
export default function Screen() {
  const [screen, setScreen] = useState<ScreenName>('mode-select')

  switch (screen) {
    case 'login':
      return <LoginScreen />
    case 'mode-select':
      return <ModeSelectScreen onSelect={setScreen} />
    case 'practice':
      return <PracticeScreen onExit={() => setScreen('mode-select')} />
    case 'infinite':
      return <InfiniteScreen onExit={() => setScreen('mode-select')} />
    default:
      return <ModeSelectScreen onSelect={setScreen} />
  }
}

/** 模式選擇畫面 */
function ModeSelectScreen({ onSelect }: { onSelect: (screen: ScreenName) => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: 24, fontFamily: 'monospace', color: '#e0e0e0',
      background: '#0d0d1a',
    }}>
      <div style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 8 }}>Card Survivor</div>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>選擇遊戲模式</div>

      <button
        onClick={() => onSelect('infinite')}
        style={{
          width: 280, padding: '16px 24px', borderRadius: 12, cursor: 'pointer',
          background: '#2a2a3e', border: '2px solid #4CAF50', color: '#fff',
          fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      >
        <div>無限模式</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, fontWeight: 'normal' }}>
          波次挑戰 · 抽卡強化 · 挑戰最高分
        </div>
      </button>

      <button
        onClick={() => onSelect('practice')}
        style={{
          width: 280, padding: '16px 24px', borderRadius: 12, cursor: 'pointer',
          background: '#2a2a3e', border: '2px solid #555', color: '#fff',
          fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      >
        <div>練習場</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, fontWeight: 'normal' }}>
          自由配卡 · 測試技能組合
        </div>
      </button>
    </div>
  )
}
