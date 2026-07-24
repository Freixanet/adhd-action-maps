import { createRoot } from 'react-dom/client'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'

const STATES: Array<{ state: OrbState; label: string; blurb: string }> = [
  { state: 'working', label: 'working', blurb: 'Partículas en órbitas' },
  { state: 'searching', label: 'searching', blurb: 'Meridiano de escaneo' },
  { state: 'solving', label: 'solving', blurb: 'Bandas que encajan' },
  { state: 'listening', label: 'listening', blurb: 'Onda en anillos' },
  { state: 'composing', label: 'composing', blurb: 'Cinta ondulante' },
  { state: 'shaping', label: 'shaping', blurb: 'Círculo → triángulo → cuadrado' },
]

function Gallery() {
  return (
    <div
      style={{
        padding: '8px 12px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {STATES.map((item) => (
        <div
          key={item.state}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minHeight: 72,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ThinkingOrb state={item.state} size={64} theme="dark" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  color: '#fafafa',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {item.label}
              </span>
              <ThinkingOrb state={item.state} size={20} theme="dark" />
            </div>
            <div style={{ color: '#9ca0ab', fontSize: 12, lineHeight: '16px' }}>
              {item.blurb} · 64 + 20
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<Gallery />)
}
