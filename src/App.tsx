import './styles/index.scss'
import Screen from './screens/Screen'

function App() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '100dvh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Screen />
    </div>
  )
}

export default App
