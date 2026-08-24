"use client";

import { useEffect, useRef } from "react";

interface RoundCarouselImage {
  src: string;
}

interface RoundCarouselProps {
  images?: RoundCarouselImage[];
  imageWidth?: number;
  imageHeight?: number;
  spacing?: number;
  speed?: number;
  direction?: "right" | "left";
  drag?: boolean;
  sensitivity?: number;
  tilt?: number;
  perspective?: number;
  cornerRadius?: number;
  innerDim?: number;
  background?: string;
  style?: React.CSSProperties;
  /** Snap to one face per gesture. Default keeps the free spin. */
  snap?: boolean;
  /** Opaque reverse face. When set, the inner side is a blank card — no cover. */
  backFaceColor?: string;
}

const DEFAULT_IMAGES: RoundCarouselImage[] = [
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/e60dd7f7-a44f-40a7-df62-095b19cd8700/w=800" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/eec164e9-23f8-4f87-b48a-a208fa806100/w=800" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/859c75ea-953e-489e-be61-91a03a35d700/w=800" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/933a7615-f4b6-4eae-8ed1-705fa0e24400/w=800" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/7d4d2641-d6a8-4fef-e85c-b12ed100d500/w=800" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/ed7b1c40-3332-43d8-a9eb-4615ef341b00/w=800" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/31afae9c-5ba3-4ec3-2534-ed8198ed1100/w=800" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/bd541261-75be-469c-7dc0-dae0ce81c400/w=800" },
];

export default function RoundCarousel({
  images = DEFAULT_IMAGES,
  imageWidth = 300,
  imageHeight = 300,
  spacing = 3,
  speed = 7,
  direction = "right",
  drag = true,
  sensitivity = 5,
  tilt = -7,
  perspective = 3000,
  cornerRadius = 22,
  innerDim = 3.5,
  background = "#000000",
  style = {},
  snap = false,
  backFaceColor,
}: RoundCarouselProps) {
  const items = images.length > 0 ? images : DEFAULT_IMAGES;
  const count = items.length;

  const ringRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const rotYRef = useRef(0);
  const velRef = useRef(0);
  const lastRef = useRef(0);
  const dragRef = useRef({ active: false, x: 0, startX: 0, lastX: 0, lastT: 0, vx: 0 });
  const snapAnimRef = useRef<{ from: number; to: number; t0: number } | null>(null);
  const gestureStartRotRef = useRef(0);
  const overlaysRef = useRef<(HTMLDivElement | null)[]>([]);

  const angle = 360 / count;
  const factor = 1 + spacing * 0.15;
  const radius = (imageWidth * factor) / (2 * Math.tan(Math.PI / count));
  const radiusPx = cornerRadius;
  const degPerSec = speed * 6 * (direction === "left" ? -1 : 1);
  const snapMs = 400;
  const pageK = imageWidth > 0 ? angle / imageWidth : 0.3 * sensitivity;
  const sideDim = 0.3;

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const shortest = (deg: number) => {
      let t = ((deg % 360) + 360) % 360;
      if (t > 180) t -= 360;
      return t;
    };
    const apply = () => {
      ring.style.transform = `translateZ(${-radius}px) rotateY(${rotYRef.current}deg)`;
      const overlays = overlaysRef.current;
      for (let i = 0; i < count; i++) {
        const el = overlays[i];
        if (!el) continue;
        const theta = Math.abs(shortest(rotYRef.current + i * angle));
        el.style.opacity = String(sideDim * Math.min(1, theta / angle));
      }
    };
    apply();

    const draw = (now: number) => {
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
      lastRef.current = now;
      const f = Math.min(dt, 0.1);
      const d = dragRef.current;
      if (!d.active) {
        if (snap && snapAnimRef.current) {
          const { from, to, t0 } = snapAnimRef.current;
          const t = Math.min(1, (now - t0) / snapMs);
          const eased = 1 - (1 - t) * (1 - t) * (1 - t);
          rotYRef.current = from + (to - from) * eased;
          if (t >= 1) {
            rotYRef.current = to;
            snapAnimRef.current = null;
          }
        } else if (!snap) {
          if (Math.abs(velRef.current) > 0.01) {
            rotYRef.current += velRef.current * f;
            velRef.current *= 0.94;
          } else {
            rotYRef.current += degPerSec * f;
          }
        }
      }
      apply();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [angle, count, degPerSec, radius, sideDim, snap, snapMs]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drag) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      active: true,
      x: e.clientX,
      startX: e.clientX,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
    };
    velRef.current = 0;
    snapAnimRef.current = null;
    gestureStartRotRef.current = rotYRef.current;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    if (snap) {
      const dx = e.clientX - d.startX;
      const unclamped = gestureStartRotRef.current + dx * pageK;
      const min = gestureStartRotRef.current - angle;
      const max = gestureStartRotRef.current + angle;
      if (unclamped < min) rotYRef.current = min + (unclamped - min) * 0.2;
      else if (unclamped > max) rotYRef.current = max + (unclamped - max) * 0.2;
      else rotYRef.current = unclamped;
      velRef.current = 0;
    } else {
      const dx = e.clientX - d.x;
      const k = 0.3 * sensitivity;
      rotYRef.current += dx * k;
      velRef.current = dx * k * 60;
    }
    const frameDt = e.timeStamp - d.lastT;
    if (frameDt > 0 && frameDt < 80) d.vx = (e.clientX - d.lastX) / frameDt;
    else if (frameDt >= 80) d.vx = 0;
    d.x = e.clientX;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current.active = false;
    if (!snap) return;
    const start = gestureStartRotRef.current;
    const delta = rotYRef.current - start;
    const still = e.timeStamp - dragRef.current.lastT > 80;
    const flicked = !still && Math.abs(dragRef.current.vx) > 0.35;
    const threshold = angle * 0.5;
    let target = start;
    if (delta > threshold || (flicked && delta > 0)) target = start + angle;
    else if (delta < -threshold || (flicked && delta < 0)) target = start - angle;
    snapAnimRef.current = {
      from: rotYRef.current,
      to: target,
      t0: performance.now(),
    };
    velRef.current = 0;
  };

  const faceBase: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: radiusPx,
    overflow: "hidden",
    backfaceVisibility: "hidden",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <div
      style={{
        ...style,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background,
        perspective: `${perspective}px`,
        cursor: drag ? "grab" : "default",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt}deg)`,
        }}
      >
        <div
          ref={ringRef}
          style={{
            position: "relative",
            width: imageWidth,
            height: imageHeight,
            transformStyle: "preserve-3d",
          }}
        >
          {items.map((img, i) => {
            const src = img?.src;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `rotateY(${i * angle}deg) translateZ(${radius}px)`,
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  style={{
                    ...faceBase,
                    backgroundColor: src ? "transparent" : "#222",
                    backgroundImage: src ? `url(${src})` : undefined,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  }}
                >
                  <div
                    ref={(el) => {
                      overlaysRef.current[i] = el;
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: "rgba(0,0,0,1)",
                      opacity: 0,
                      pointerEvents: "none",
                    }}
                  />
                </div>
                <div
                  style={{
                    ...faceBase,
                    transform: "rotateY(180deg)",
                    backgroundColor: backFaceColor || (src ? "transparent" : "#181818"),
                    backgroundImage: backFaceColor || !src ? undefined : `url(${src})`,
                    filter: backFaceColor ? undefined : `brightness(${innerDim / 10})`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}