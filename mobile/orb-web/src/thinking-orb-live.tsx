import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'

const STATES: OrbState[] = [
  'working',
  'searching',
  'solving',
  'listening',
  'composing',
  'shaping',
]

type OrbConfig = {
  state: OrbState
  size: 20 | 64
  speed: number
  paused: boolean
  theme: 'dark' | 'light' | 'auto'
}

function readConfig(): OrbConfig {
  const raw = (window as unknown as { __THINKING_ORB__?: Partial<OrbConfig> }).__THINKING_ORB__
  const state = STATES.includes(raw?.state as OrbState) ? (raw!.state as OrbState) : 'working'
  const size = raw?.size === 20 ? 20 : 64
  const speed = typeof raw?.speed === 'number' && Number.isFinite(raw.speed) ? raw.speed : 1
  return {
    state,
    size,
    speed,
    paused: Boolean(raw?.paused),
    theme: raw?.theme === 'light' || raw?.theme === 'auto' ? raw.theme : 'dark',
  }
}

function LiveOrb() {
  const [config, setConfig] = useState<OrbConfig>(() => readConfig())

  useEffect(() => {
    const sync = () => setConfig(readConfig())
    window.addEventListener('nucleo-thinking-orb', sync)
    window.addEventListener('message', (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'thinking-orb' && data.config) {
          ;(window as unknown as { __THINKING_ORB__: OrbConfig }).__THINKING_ORB__ = {
            ...readConfig(),
            ...data.config,
          }
          sync()
        }
      } catch {
        /* ignore */
      }
    })
    sync()
    return () => window.removeEventListener('nucleo-thinking-orb', sync)
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    >
      <ThinkingOrb
        state={config.state}
        size={config.size}
        theme={config.theme}
        speed={config.speed}
        paused={config.paused}
        aria-label={`Generando · ${config.state}`}
      />
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<LiveOrb />)
}
