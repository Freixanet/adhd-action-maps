/**
 * WebView host for the official Originkit Round Carousel.
 * Raster photos are composited on a canvas — WKWebView will not paint a
 * JPEG nested inside an SVG used as a CSS background.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import RoundCarousel from '@originkit/roundcarousel';

export type NucleoRoundCarouselHostPaint = {
  canvas: string;
  accentSoft: string;
  textPrimary: string;
  coverRatio: number;
  padX: number;
  padBottom: number;
  titleSize: number;
  titleLineHeight: number;
  titleWeight: number | string;
  fontFamily: string;
};

export type NucleoRoundCarouselHostConfig = {
  images: Array<{ id: string; title: string; photo?: string | null; svg: string }>;
  imageWidth: number;
  imageHeight: number;
  cornerRadius: number;
  spacing: number;
  tilt: number;
  perspective: number;
  paint: NucleoRoundCarouselHostPaint;
};

declare global {
  interface Window {
    __NUCLEO_ROUND__?: NucleoRoundCarouselHostConfig;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

const TAP_MOVE_LIMIT = 10;

const DEFAULT_PAINT: NucleoRoundCarouselHostPaint = {
  canvas: '#F7F7FB',
  accentSoft: '#ECECFF',
  textPrimary: '#17171C',
  coverRatio: 0.76,
  padX: 12,
  padBottom: 8,
  titleSize: 17,
  titleLineHeight: 22,
  titleWeight: 700,
  fontFamily: 'system-ui',
};

function readConfig(): NucleoRoundCarouselHostConfig {
  const incoming = window.__NUCLEO_ROUND__;
  return {
    images: Array.isArray(incoming?.images) ? incoming.images : [],
    imageWidth: incoming?.imageWidth ?? 200,
    imageHeight: incoming?.imageHeight ?? 200,
    cornerRadius: incoming?.cornerRadius ?? 16,
    spacing: incoming?.spacing ?? 3,
    tilt: incoming?.tilt ?? -7,
    perspective: incoming?.perspective ?? 3000,
    paint: { ...DEFAULT_PAINT, ...incoming?.paint },
  };
}

function postToNative(payload: { type: string; id?: string }) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
}

function frontIndexFromRing(count: number): number | null {
  if (count < 1) return null;
  const nodes = document.querySelectorAll('div');
  for (const node of nodes) {
    const transform = node.style.transform;
    if (!transform.includes('translateZ(-') || !transform.includes('rotateY')) continue;
    const match = transform.match(/rotateY\((-?[\d.]+)deg\)/);
    if (!match) continue;
    const rotY = Number(match[1]);
    const angle = 360 / count;
    return (((Math.round(-rotY / angle) % count) + count) % count);
  }
  return 0;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('photo_load'));
    image.src = src;
  });
}

async function paintPhotoCard(
  photo: string,
  title: string,
  size: number,
  paint: NucleoRoundCarouselHostPaint
): Promise<string> {
  const photoImage = await loadHtmlImage(photo);
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size * dpr));
  canvas.height = Math.max(1, Math.round(size * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = paint.canvas;
  ctx.fillRect(0, 0, size, size);

  const coverH = Math.round(size * paint.coverRatio);
  const scale = Math.max(size / photoImage.width, coverH / photoImage.height);
  const drawW = photoImage.width * scale;
  const drawH = photoImage.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, coverH);
  ctx.clip();
  ctx.drawImage(photoImage, (size - drawW) / 2, (coverH - drawH) / 2, drawW, drawH);
  ctx.restore();

  const label = (title || '').trim();
  if (label) {
    const textTop = coverH + paint.padBottom;
    ctx.fillStyle = paint.textPrimary;
    ctx.font = `${paint.titleWeight} ${paint.titleSize}px ${paint.fontFamily}, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    const maxWidth = size - paint.padX * 2;
    const words = label.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (lines.length >= 2) break;
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
      if (lines.length >= 2) break;
    }
    if (current && lines.length < 2) lines.push(current);
    if (lines.length === 2 && words.join(' ').length > lines.join(' ').length) {
      let last = lines[1] ?? '';
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[1] = `${last}…`;
    }
    lines.forEach((line, index) => {
      ctx.fillText(line, paint.padX, textTop + index * paint.titleLineHeight, maxWidth);
    });
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (next) resolve(next);
      else reject(new Error('blob'));
    }, 'image/jpeg', 0.86);
  });
  return URL.createObjectURL(blob);
}

function Host() {
  const [config, setConfig] = useState(readConfig);
  const [faces, setFaces] = useState<Array<{ id: string; src: string }>>([]);
  const dragRef = useRef({ x: 0, y: 0, moved: false });

  useEffect(() => {
    const apply = (payload: Partial<NucleoRoundCarouselHostConfig> | null) => {
      if (!payload || !Array.isArray(payload.images)) return;
      setConfig((current) => ({
        images: payload.images ?? current.images,
        imageWidth: payload.imageWidth ?? current.imageWidth,
        imageHeight: payload.imageHeight ?? current.imageHeight,
        cornerRadius: payload.cornerRadius ?? current.cornerRadius,
        spacing: payload.spacing ?? current.spacing,
        tilt: payload.tilt ?? current.tilt,
        perspective: payload.perspective ?? current.perspective,
        paint: { ...current.paint, ...payload.paint },
      }));
    };

    const onRound = (event: Event) => {
      apply((event as CustomEvent<Partial<NucleoRoundCarouselHostConfig>>).detail);
    };
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          apply(JSON.parse(event.data) as Partial<NucleoRoundCarouselHostConfig>);
        } catch {
          return;
        }
        return;
      }
      if (event.data && typeof event.data === 'object') {
        apply(event.data as Partial<NucleoRoundCarouselHostConfig>);
      }
    };

    window.addEventListener('nucleo-round', onRound);
    window.addEventListener('message', onMessage);
    document.addEventListener('message', onMessage as EventListener);
    postToNative({ type: 'ready' });
    return () => {
      window.removeEventListener('nucleo-round', onRound);
      window.removeEventListener('message', onMessage);
      document.removeEventListener('message', onMessage as EventListener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    void (async () => {
      const next: Array<{ id: string; src: string }> = [];
      for (const image of config.images) {
        if (cancelled) return;
        if (image.photo) {
          try {
            const src = await paintPhotoCard(
              image.photo,
              image.title,
              config.imageWidth,
              config.paint
            );
            created.push(src);
            next.push({ id: image.id, src });
            continue;
          } catch {
            // Fall through to the catalog SVG face.
          }
        }
        const src = URL.createObjectURL(
          new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' })
        );
        created.push(src);
        next.push({ id: image.id, src });
      }
      if (cancelled) {
        for (const url of created) URL.revokeObjectURL(url);
        return;
      }
      setFaces(next);
    })();

    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [config.imageWidth, config.images, config.paint]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_LIMIT) dragRef.current.moved = true;
  };
  const onPointerUp = () => {
    if (dragRef.current.moved || faces.length === 0) return;
    const index = frontIndexFromRing(faces.length);
    const id = index == null ? null : faces[index]?.id;
    if (id) postToNative({ type: 'select', id });
  };
  const onPointerCancel = () => {
    dragRef.current.moved = true;
  };

  return (
    <div
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {faces.length > 0 ? (
        <RoundCarousel
          key={faces.map((face) => face.id).join('|')}
          images={faces.map((face) => ({ src: face.src }))}
          imageWidth={config.imageWidth}
          imageHeight={config.imageHeight}
          cornerRadius={config.cornerRadius}
          spacing={config.spacing}
          tilt={config.tilt}
          perspective={config.perspective}
          speed={0}
          snap
          background="transparent"
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<Host />);
}
