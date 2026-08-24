import { createRoot } from 'react-dom/client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'

const STATES: OrbState[] = [
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping',
]

type OrbConfig = {
  state: OrbState
  size: 20 | 64
  speed: number
  paused: boolean
  theme: 'dark' | 'light' | 'auto'
  showLabel: boolean
  /** Caption uses this state's package aria-label; animation still uses `state`. */
  labelState: OrbState | null
}

function readConfig(): OrbConfig {
  const raw = (window as unknown as { __THINKING_ORB__?: Partial<OrbConfig> }).__THINKING_ORB__
  const state = STATES.includes(raw?.state as OrbState) ? (raw!.state as OrbState) : 'working'
  const size = raw?.size === 20 ? 20 : 64
  const speed = typeof raw?.speed === 'number' && Number.isFinite(raw.speed) ? raw.speed : 1
  const labelState = STATES.includes(raw?.labelState as OrbState)
    ? (raw!.labelState as OrbState)
    : null
  return {
    state,
    size,
    speed,
    paused: Boolean(raw?.paused),
    theme: raw?.theme === 'light' || raw?.theme === 'auto' ? raw.theme : 'dark',
    showLabel: Boolean(raw?.showLabel),
    labelState,
  }
}

function LiveOrb() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [config, setConfig] = useState<OrbConfig>(() => readConfig())
  const [label, setLabel] = useState('')

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

  useEffect(() => {
    const theme = config.theme === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  }, [config.theme])

  useLayoutEffect(() => {
    if (!config.showLabel) {
      setLabel('')
      return
    }
    const sourceState = config.labelState ?? config.state
    const probe = wrapRef.current?.querySelector('[data-orb-label-probe] canvas')
    const live = wrapRef.current?.querySelector('[data-orb-canvas] canvas')
    const fromProbe = sourceState !== config.state ? probe : null
    setLabel((fromProbe ?? live)?.getAttribute('aria-label') ?? '')
  }, [config])

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: config.showLabel ? 'flex-start' : 'center',
        gap: config.showLabel ? 8 : 0,
        background: 'transparent',
        position: 'relative',
      }}
    >
      {config.showLabel && config.labelState && config.labelState !== config.state ? (
        <div
          data-orb-label-probe=""
          aria-hidden
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
        >
          <ThinkingOrb state={config.labelState} size={20} theme={config.theme} paused />
        </div>
      ) : null}
      <div data-orb-canvas="">
        <ThinkingOrb
          state={config.state}
          size={config.size}
          theme={config.theme}
          speed={config.speed}
          paused={config.paused}
          aria-hidden={config.showLabel || undefined}
        />
      </div>
      {config.showLabel && label ? (
        <span
          className={config.paused ? 't-shimmer is-paused' : 't-shimmer'}
          data-text={label}
        >
          {label}
        </span>
      ) : null}
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<LiveOrb />)
}
