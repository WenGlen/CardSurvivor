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
      width: '100%', height: '100%', minHeight: '100dvh', gap: 'clamp(12px, 3vh, 24px)',
      fontFamily: 'monospace', color: '#e0e0e0', background: '#0d0d1a',
      padding: 'clamp(8px, 2vw, 24px)', overflow: 'hidden',
    }}>
      <img
        src={`${import.meta.env.BASE_URL}CardSurvivor-mark.png`}
        alt="Card Survivor"
        style={{
          maxWidth: 'min(280px, 85vw)',
          height: 'auto',
          objectFit: 'contain',
          marginBottom: 'clamp(4px, 1vh, 12px)',
        }}
      />
      <div style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', color: '#888', marginBottom: 'clamp(8px, 2vh, 24px)' }}>
        選擇遊戲模式
      </div>

      <button
        onClick={() => onSelect('infinite')}
        style={{
          width: 'min(280px, 90vw)', padding: 'clamp(12px, 2.5vw, 16px) clamp(20px, 4vw, 24px)',
          borderRadius: 12, cursor: 'pointer',
          background: '#2a2a3e', border: '2px solid #4CAF50', color: '#fff',
          fontSize: 'clamp(14px, 3vw, 18px)', fontWeight: 'bold', fontFamily: 'monospace',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      >
        <div>無限模式</div>
        <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', color: '#aaa', marginTop: 4, fontWeight: 'normal' }}>
          波次挑戰 · 抽卡強化 · 挑戰最高分
        </div>
      </button>

      <button
        onClick={() => onSelect('practice')}
        style={{
          width: 'min(280px, 90vw)', padding: 'clamp(12px, 2.5vw, 16px) clamp(20px, 4vw, 24px)',
          borderRadius: 12, cursor: 'pointer',
          background: '#2a2a3e', border: '2px solid #555', color: '#fff',
          fontSize: 'clamp(14px, 3vw, 18px)', fontWeight: 'bold', fontFamily: 'monospace',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      >
        <div>練習場</div>
        <div style={{ fontSize: 'clamp(10px, 2vw, 12px)', color: '#aaa', marginTop: 4, fontWeight: 'normal' }}>
          自由配卡 · 測試技能組合
        </div>
      </button>
    </div>
  )
}
