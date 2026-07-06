'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import {
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
} from '@react-three/drei'
import {
  Suspense,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import * as THREE from 'three'

export type NucleoOrbState = 'idle' | 'thinking' | 'complete'

export type NucleoOrbProps = {
  state?: NucleoOrbState
  className?: string
  style?: CSSProperties
  glow?: boolean
  /** Permite arrastrar/tocar el orbe. Activado por defecto. */
  interactive?: boolean
  /** Respeta prefers-reduced-motion / accesibilidad RN. */
  reduceMotion?: boolean
}

const ACCENT = '#8B8FF5'
const ACCENT_WARM = '#A8ABF7'
const ACCENT_DEEP = '#7A7EE0'
// bg-base de la app: se usa SOLO como fondo interior del vidrio (lo que la
// refraccion "ve" detras de la esfera), no como fondo del canvas, que es
// transparente para que el orbe flote sobre cualquier contenido.
const GLASS_INTERIOR_BG = '#181A1F'

// La esfera de vidrio tiene radio 1.55: el eje mayor de las orbitas llega
// casi hasta el borde interior para que crucen el orbe de extremo a extremo.
const ORBIT_RX = 1.42
const ORBIT_RY = 0.58
// Inclinacion de cada plano orbital alrededor de su propio eje mayor.
const ORBIT_TILT = Math.PI / 3.4
const RING_THICKNESS = 0.014

// Distancia de la camara y rango de profundidad que ocupa el atomo.
// Se usan para calcular la "cercania" (0 = lejos, 1 = cerca) en los shaders
// y en el escalado de los electrones, que es lo que crea el efecto 3D real.
// z=5.2 deja la esfera en ~67% del viewport: margen amplio para que el
// WebView nativo nunca recorte los extremos del orbe.
const CAMERA_Z = 5.2
const DEPTH_RANGE = 3.2

/**
 * Estado compartido de la interaccion tactil/raton. Es un objeto mutable
 * (via ref) que los pointer handlers del contenedor escriben y los
 * useFrame de la escena leen, sin re-renders de React por frame.
 */
type OrbInteraction = {
  /** El usuario esta arrastrando ahora mismo */
  dragging: boolean
  /** Delta angular pendiente de aplicar (radianes), acumulado por el drag */
  dragDelta: number
  /** Velocidad angular de inercia tras soltar (rad/s) */
  spinVel: number
  /** Multiplicador de velocidad de los electrones (0 = normal) */
  boost: number
  /** Pulso 1 -> 0 disparado por un tap (onda expansiva + destello) */
  pulse: number
  /** Dedo/boton presionado (aprieta ligeramente el orbe) */
  pressed: boolean
}

function createOrbInteraction(): OrbInteraction {
  return {
    dragging: false,
    dragDelta: 0,
    spinVel: 0,
    boost: 0,
    pulse: 0,
    pressed: false,
  }
}

/**
 * Material del anillo orbital con profundidad real:
 * - El VERTEX shader desplaza cada vertice a lo largo de su normal segun la
 *   profundidad en espacio de vista, de modo que el tubo es visiblemente MAS
 *   GRUESO en la parte cercana a la camara y mas fino en la lejana.
 * - El FRAGMENT shader aumenta brillo y opacidad en la parte cercana y los
 *   atenua en la lejana (atmospheric depth cue).
 * Como todo se calcula con la modelViewMatrix, sigue funcionando mientras
 * el atomo entero rota.
 */
function createOrbitRingMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCameraZ: { value: CAMERA_Z },
      uDepthRange: { value: DEPTH_RANGE },
      uThickness: { value: RING_THICKNESS },
    },
    vertexShader: /* glsl */ `
      uniform float uCameraZ;
      uniform float uDepthRange;
      uniform float uThickness;
      varying float vNearness;

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // mv.z esta cerca de -uCameraZ; normalizamos a 0..1 (lejos..cerca)
        float nearness = clamp((mv.z + uCameraZ) / uDepthRange + 0.5, 0.0, 1.0);
        vNearness = nearness;

        // Grosor variable: la parte cercana del anillo es ~2.4x mas gruesa
        // que la lejana. Se desplaza a lo largo de la normal del tubo.
        float thicknessScale = mix(0.55, 1.9, nearness);
        vec3 displaced = position + normal * uThickness * (thicknessScale - 1.0);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vNearness;

      void main() {
        float alpha = mix(0.16, 0.95, vNearness);
        vec3 col = uColor * mix(0.55, 2.1, vNearness);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  } as THREE.ShaderMaterialParameters)
}

/**
 * Geometria del anillo orbital: un tubo que sigue una elipse real en 3D
 * con grosor base uniforme (el shader lo modula despues segun profundidad).
 */
function useEllipseRingGeometry(rx: number, ry: number, thickness: number) {
  return useMemo(() => {
    const ellipse = new THREE.EllipseCurve(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
    const points2d = ellipse.getPoints(200)
    const points3d = points2d.map((p) => new THREE.Vector3(p.x, p.y, 0))
    const curve = new THREE.CatmullRomCurve3(points3d, true, 'catmullrom', 0.5)
    return new THREE.TubeGeometry(curve, 256, thickness, 12, true)
  }, [rx, ry, thickness])
}

const _worldPos = new THREE.Vector3()

/**
 * Un electron que recorre la elipse orbital. Su fase (`phase`) permite
 * colocar dos electrones diametralmente opuestos en la misma orbita.
 * - Acumula su propio tiempo de fase, de modo que el `boost` de la
 *   interaccion acelera y frena la orbita SUAVEMENTE, sin saltos.
 * - Su ESCALA varia con la distancia real a la camara (mas grande cerca,
 *   mas pequeño lejos), reforzando la perspectiva.
 * - Su brillo/halo tambien se atenua al alejarse.
 */
function Electron({
  speed,
  phase,
  direction,
  interaction,
}: {
  speed: number
  phase: number
  direction: 1 | -1
  interaction: OrbInteraction
}) {
  const electronRef = useRef<THREE.Group>(null)
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null)
  // Fase acumulada: todos los electrones acumulan con los MISMOS deltas y
  // el MISMO speed, asi que permanecen perfectamente sincronizados.
  const phaseAcc = useRef(0)

  useFrame((_, delta) => {
    phaseAcc.current += delta * speed * direction * (1 + interaction.boost)
    const t = phaseAcc.current + phase

    const electron = electronRef.current
    if (!electron) return

    electron.position.set(Math.cos(t) * ORBIT_RX, Math.sin(t) * ORBIT_RY, 0)

    // Cercania real a la camara en coordenadas de mundo (0 lejos, 1 cerca)
    electron.getWorldPosition(_worldPos)
    const nearness = THREE.MathUtils.clamp(
      _worldPos.z / DEPTH_RANGE + 0.5,
      0,
      1,
    )

    // Tamaño: el electron cercano se ve ~2x mas grande que el lejano
    electron.scale.setScalar(THREE.MathUtils.lerp(0.62, 1.35, nearness))

    // Brillo: mas intenso cerca, atenuado lejos, con extra durante el boost
    const boostGlow = 1 + Math.min(interaction.boost, 2) * 0.35
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity =
        THREE.MathUtils.lerp(1.4, 4.2, nearness) * boostGlow
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity =
        THREE.MathUtils.lerp(0.1, 0.38, nearness) * boostGlow
    }
  })

  return (
    <group ref={electronRef}>
      <mesh>
        <sphereGeometry args={[0.06, 32, 32]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color={ACCENT_WARM}
          emissive={ACCENT_WARM}
          emissiveIntensity={3.2}
          toneMapped={false}
        />
      </mesh>

      {/* Halo aditivo alrededor del electron */}
      <mesh scale={2.4}>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color={ACCENT}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/**
 * Una orbita del atomo clasico con DOS electrones diametralmente opuestos
 * (fase 0 y fase PI). Con las tres orbitas sincronizadas, los seis
 * electrones quedan equiespaciados en fase y al pasar cerca del centro
 * crean la ilusion optica de un circulo de puntos rotando (spinner).
 */
function Orbit({
  spin,
  tilt,
  speed,
  direction = 1,
  interaction,
}: {
  spin: number
  tilt: number
  speed: number
  direction?: 1 | -1
  interaction: OrbInteraction
}) {
  const ringGeometry = useEllipseRingGeometry(ORBIT_RX, ORBIT_RY, RING_THICKNESS)
  const ringMaterial = useMemo(() => createOrbitRingMaterial(ACCENT), [])

  return (
    <group rotation={[0, 0, spin]}>
      <group rotation={[tilt, 0, 0]}>
        <mesh geometry={ringGeometry} material={ringMaterial} />

        <Electron
          speed={speed}
          phase={0}
          direction={direction}
          interaction={interaction}
        />
        <Electron
          speed={speed}
          phase={Math.PI}
          direction={direction}
          interaction={interaction}
        />
      </group>
    </group>
  )
}

/**
 * Nucleo: UNA sola esfera suave de alta resolucion en la misma paleta
 * que las orbitas, con pulso sincronizado con la luz interior.
 * Al tocar el orbe (tap) emite un destello y una onda expansiva.
 */
function Nucleus({ interaction }: { interaction: OrbInteraction }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const waveRef = useRef<THREE.Mesh>(null)
  const waveMatRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state, delta) => {
    // El pulso del tap decae de 1 a 0
    interaction.pulse = Math.max(0, interaction.pulse - delta * 1.5)
    const pulse = interaction.pulse

    const breathe = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.05
    // Destello del nucleo al tocar: crece brevemente
    const flash = 1 + pulse * pulse * 0.3

    if (coreRef.current) {
      coreRef.current.scale.setScalar(breathe * flash)
    }
    if (coreMatRef.current) {
      // Mas brillante mientras esta presionado y durante el destello
      const target = 0.6 + (interaction.pressed ? 0.5 : 0) + pulse * 1.4
      coreMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
        coreMatRef.current.emissiveIntensity,
        target,
        8,
        delta,
      )
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(breathe * 1.5 * flash)
    }
    if (lightRef.current) {
      lightRef.current.intensity =
        5 + Math.sin(state.clock.elapsedTime * 2.2) * 1.5 + pulse * 6
    }

    // Onda expansiva: un anillo que crece desde el nucleo y se desvanece
    if (waveRef.current && waveMatRef.current) {
      if (pulse > 0) {
        const progress = 1 - pulse // 0 -> 1
        const eased = 1 - (1 - progress) * (1 - progress) // easeOutQuad
        waveRef.current.visible = true
        waveRef.current.scale.setScalar(0.4 + eased * 2.6)
        waveMatRef.current.opacity = 0.45 * (1 - eased)
      } else {
        waveRef.current.visible = false
      }
    }
  })

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.3, 64, 64]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color={ACCENT}
          emissive={ACCENT_DEEP}
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.05}
          toneMapped={false}
        />
      </mesh>

      {/* Halo suave del nucleo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Onda expansiva del tap (anillo plano frente a la camara) */}
      <mesh ref={waveRef} visible={false}>
        <ringGeometry args={[0.46, 0.5, 64]} />
        <meshBasicMaterial
          ref={waveMatRef}
          color={ACCENT_WARM}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <pointLight ref={lightRef} color={ACCENT} intensity={5} distance={4} />
    </group>
  )
}

function Atom({
  speed,
  interaction,
}: {
  speed: number
  interaction: OrbInteraction
}) {
  const atomRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const atom = atomRef.current
    if (!atom) return

    // Velocidad angular efectiva de este frame (para calcular el boost)
    let angularSpeed = 0

    if (interaction.dragging) {
      // El atomo sigue directamente al dedo/cursor (rotacion 1:1)
      angularSpeed = Math.abs(interaction.dragDelta) / Math.max(delta, 1e-4)
      atom.rotation.z += interaction.dragDelta
      interaction.dragDelta = 0
    } else {
      // Inercia tras soltar: decae exponencialmente hacia el giro base
      interaction.spinVel *= Math.exp(-delta * 1.3)
      if (Math.abs(interaction.spinVel) < 0.01) interaction.spinVel = 0
      angularSpeed = Math.abs(interaction.spinVel)
      atom.rotation.z += delta * (0.12 + interaction.spinVel)
    }

    // Los electrones se aceleran con el giro y con el pulso del tap,
    // con suavizado para que el cambio nunca sea brusco.
    const targetBoost =
      Math.min(angularSpeed * 0.3, 2.2) + interaction.pulse * 1.1
    interaction.boost = THREE.MathUtils.damp(
      interaction.boost,
      targetBoost,
      6,
      delta,
    )
  })

  return (
    <group ref={atomRef}>
      <Nucleus interaction={interaction} />

      {/* Tres orbitas elipticas con ejes mayores a 0/60/120 grados en el
          plano de pantalla; cada plano se inclina en profundidad sobre su
          propio eje mayor (tilts alternados).
          Las tres comparten la MISMA velocidad, direccion y FASE:
          en cada instante, cada electron pasa por el punto equivalente de su
          propia orbita. Como las orbitas estan rotadas 60 grados entre si,
          los 6 electrones (2 opuestos por orbita) dibujan un hexagono
          perfecto que gira: la ilusion de circulo de puntos rotando,
          ideal como spinner de carga. */}
      <Orbit spin={0} tilt={ORBIT_TILT} speed={speed * 1.5} interaction={interaction} />
      <Orbit
        spin={Math.PI / 3}
        tilt={-ORBIT_TILT}
        speed={speed * 1.5}
        interaction={interaction}
      />
      <Orbit
        spin={(2 * Math.PI) / 3}
        tilt={ORBIT_TILT}
        speed={speed * 1.5}
        interaction={interaction}
      />
    </group>
  )
}

function GlassShell({ spin }: { spin: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spin
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.55, 96, 96]} />
      <MeshTransmissionMaterial
        anisotropy={0.1}
        attenuationColor={ACCENT}
        attenuationDistance={4}
        background={new THREE.Color(GLASS_INTERIOR_BG)}
        chromaticAberration={0.06}
        color={ACCENT_WARM}
        distortion={0.05}
        distortionScale={0.2}
        ior={1.12}
        resolution={768}
        roughness={0.02}
        samples={10}
        temporalDistortion={0.03}
        thickness={0.4}
        transmission={1}
      />
    </mesh>
  )
}

/**
 * Aprieta ligeramente el orbe mientras el dedo esta presionado y lo
 * devuelve con un muelle suave al soltar. Feedback tactil sutil.
 */
function PressSquish({
  interaction,
  children,
}: {
  interaction: OrbInteraction
  children: React.ReactNode
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    const target = interaction.pressed ? 0.955 : 1
    const next = THREE.MathUtils.damp(ref.current.scale.x, target, 10, delta)
    ref.current.scale.setScalar(next)
  })

  return <group ref={ref}>{children}</group>
}

function OrbScene({
  state,
  interaction,
  reduceMotion = false,
}: {
  state: NucleoOrbState
  interaction: OrbInteraction
  reduceMotion?: boolean
}) {
  const speed = reduceMotion
    ? state === 'thinking'
      ? 1.4
      : 0.7
    : state === 'thinking'
      ? 2.6
      : state === 'complete'
        ? 1.4
        : 0.9
  const spin = reduceMotion ? 0.08 : state === 'thinking' ? 0.6 : 0.18
  const floatSpeed = reduceMotion ? 0 : state === 'thinking' ? 3 : 1.4
  const floatIntensity = reduceMotion ? 0 : 0.6

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      {/* rotationIntensity=0: el Float solo desplaza (bobbing), nunca rota,
          para que las orbitas no dejen de llegar a los extremos del orbe. */}
      <Float
        speed={floatSpeed}
        rotationIntensity={0}
        floatIntensity={floatIntensity}
      >
        <PressSquish interaction={interaction}>
          <Atom speed={speed} interaction={interaction} />
          <GlassShell spin={spin} />
        </PressSquish>
      </Float>
      {/* Entorno sintetico: solo luces abstractas, sin ninguna imagen HDRI,
          para que el vidrio no refleje paisajes ni objetos reconocibles. */}
      <Environment resolution={64}>
        <Lightformer
          form="rect"
          intensity={2}
          position={[3, 3, 4]}
          scale={[3, 3, 1]}
          color="#e8e9fc"
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[-4, -1, 3]}
          scale={[2.5, 4, 1]}
          color="#c7c9f7"
        />
        <Lightformer
          form="ring"
          intensity={1.5}
          position={[0, 4, -4]}
          scale={4}
          color={ACCENT}
        />
      </Environment>
    </>
  )
}

export function NucleoOrb({
  state = 'idle',
  className,
  style,
  glow = false,
  interactive = true,
  reduceMotion = false,
}: NucleoOrbProps) {
  // DPR minimo de 1.5 para que el nucleo y los anillos se vean nitidos
  // incluso en pantallas de densidad 1.
  const dpr = useMemo<[number, number]>(() => [1.5, 2], [])
  const needsDefaultSize =
    !className && style?.width == null && style?.height == null

  // Estado mutable compartido con la escena 3D (sin re-renders por frame)
  const interactionRef = useRef<OrbInteraction | null>(null)
  if (interactionRef.current === null) {
    interactionRef.current = createOrbInteraction()
  }
  const interaction = interactionRef.current

  // Datos internos del gesto de arrastre
  const gestureRef = useRef({
    pointerId: -1,
    lastAngle: 0,
    lastTime: 0,
    velocity: 0,
    totalMove: 0,
  })

  const getPointerAngle = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    // Angulo en pantalla; la Y de pantalla crece hacia abajo, por eso el
    // delta se invierte al aplicarlo a rotation.z (antihorario positivo).
    return Math.atan2(e.clientY - cy, e.clientX - cx)
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || reduceMotion) return
    const gesture = gestureRef.current
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.pointerId = e.pointerId
    gesture.lastAngle = getPointerAngle(e)
    gesture.lastTime = performance.now()
    gesture.velocity = 0
    gesture.totalMove = 0
    interaction.dragging = true
    interaction.pressed = true
    interaction.spinVel = 0
    e.currentTarget.style.cursor = 'grabbing'
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!interaction.dragging || e.pointerId !== gesture.pointerId) return

    const angle = getPointerAngle(e)
    let deltaAngle = angle - gesture.lastAngle
    // Envolver a [-PI, PI] para evitar saltos al cruzar el eje
    if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2
    if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
    gesture.lastAngle = angle

    // Y de pantalla invertida respecto a rotation.z
    const rotationDelta = -deltaAngle
    interaction.dragDelta += rotationDelta

    const now = performance.now()
    const dt = Math.max((now - gesture.lastTime) / 1000, 1e-4)
    gesture.lastTime = now
    // Velocidad angular suavizada (para la inercia al soltar)
    gesture.velocity = gesture.velocity * 0.75 + (rotationDelta / dt) * 0.25

    gesture.totalMove += Math.abs(e.movementX) + Math.abs(e.movementY)
  }

  const endGesture = (e: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (e.pointerId !== gesture.pointerId) return
    gesture.pointerId = -1
    interaction.dragging = false
    interaction.pressed = false
    e.currentTarget.style.cursor = 'grab'

    if (gesture.totalMove < 8) {
      // Fue un TAP: destello del nucleo + onda expansiva + chispazo de giro
      interaction.pulse = 1
      interaction.dragDelta = 0
    } else {
      // Fue un ARRASTRE: soltar con inercia (limitada para que no maree)
      interaction.spinVel = THREE.MathUtils.clamp(gesture.velocity, -10, 10)
    }
  }

  return (
    <div
      className={className}
      role={interactive ? 'button' : undefined}
      aria-label={
        interactive ? 'Orbe interactivo: arrastra para girar, toca para pulsar' : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      style={{
        position: 'relative',
        zIndex: 0,
        overflow: 'visible',
        ...(interactive
          ? { cursor: 'grab', touchAction: 'none', userSelect: 'none' }
          : {}),
        ...(needsDefaultSize ? { width: 240, height: 240 } : {}),
        ...style,
      }}
    >
      {glow ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '160%',
            height: '160%',
            transform: 'translate(-50%, -50%)',
            zIndex: -1,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgb(139 143 245 / 0.35), transparent 68%)',
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* Camara mas cerca y con mas FOV: la perspectiva es mas pronunciada,
          asi que la diferencia de tamaño entre cerca y lejos se nota mas. */}
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: 50 }}
        dpr={dpr}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0)
          scene.background = null
        }}
        style={{
          background: 'transparent',
          pointerEvents: 'none',
          display: 'block',
          overflow: 'visible',
        }}
      >
        <Suspense fallback={null}>
          <OrbScene state={state} interaction={interaction} reduceMotion={reduceMotion} />
        </Suspense>
      </Canvas>
    </div>
  )
}
