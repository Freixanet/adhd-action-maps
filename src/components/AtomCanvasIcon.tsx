import React from 'react';
import { ATOM_SHADING, buildAtomRibbons } from '../atomGeometry';

type AtomCanvasIconProps = {
  className?: string;
  size?: number;
};

function useIsDark() {
  const [isDark, setIsDark] = React.useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  React.useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export default function AtomCanvasIcon({ className = '', size = 112 }: AtomCanvasIconProps) {
  const isDark = useIsDark();
  const geometry = React.useMemo(() => buildAtomRibbons(size), [size]);
  const { cx, cy, coreR, haloR, sphereR, ribbons, rim, sphereLight } = geometry;

  const base = isDark ? '129, 140, 248' : '79, 70, 229';
  const coreLight = isDark ? '#C7D2FE' : '#EEF0FF';
  const coreMid = isDark ? '#6366f1' : '#4f46e5';
  const coreDeep = isDark ? '#312e81' : '#3730a3';
  const orbitNear = isDark ? `rgba(${base}, 0.92)` : `rgba(${base}, 0.88)`;
  const orbitFar = isDark ? `rgba(${base}, 0.18)` : `rgba(${base}, 0.16)`;

  const shadowDx = size * ATOM_SHADING.projectedShadowDx;
  const shadowDy = size * ATOM_SHADING.projectedShadowDy;
  const projectedOpacity = isDark
    ? ATOM_SHADING.projectedShadowOpacity.dark
    : ATOM_SHADING.projectedShadowOpacity.light;
  const exteriorDropOpacity = isDark
    ? ATOM_SHADING.exteriorDropOpacity.dark
    : ATOM_SHADING.exteriorDropOpacity.light;
  const sphereBodyOpacity = isDark
    ? ATOM_SHADING.sphereBodyShadowOpacity.dark
    : ATOM_SHADING.sphereBodyShadowOpacity.light;
  const sphereDiffuseOpacity = isDark
    ? ATOM_SHADING.sphereDiffuseOpacity.dark
    : ATOM_SHADING.sphereDiffuseOpacity.light;
  const sphereHighlightOpacity = isDark
    ? ATOM_SHADING.sphereHighlightOpacity.dark
    : ATOM_SHADING.sphereHighlightOpacity.light;
  const sphereRimOpacity = isDark ? ATOM_SHADING.sphereRimOpacity.dark : ATOM_SHADING.sphereRimOpacity.light;
  const rimFill = isDark ? `rgba(255, 255, 255, ${sphereRimOpacity})` : `rgba(255, 255, 255, ${sphereRimOpacity})`;

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <defs>
          <filter id="atomExteriorShadow" x="-40%" y="-20%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.022} />
          </filter>

          <filter id="atomProjectedShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.014} />
          </filter>

          <filter id="atomContactShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.014} />
          </filter>

          <radialGradient id="atomHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgba(${base}, ${isDark ? 0.22 : 0.16})`} />
            <stop offset="65%" stopColor={`rgba(${base}, 0.04)`} />
            <stop offset="100%" stopColor={`rgba(${base}, 0)`} />
          </radialGradient>

          {/* Spherical body: lit from top-left, shaded toward bottom-right */}
          <linearGradient id="atomSphereBody" x1="25%" y1="22%" x2="78%" y2="82%">
            <stop offset="0%" stopColor={`rgba(255, 255, 255, ${sphereBodyOpacity * 0.9})`} />
            <stop offset="55%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="100%" stopColor={`rgba(0, 0, 0, ${sphereBodyOpacity * 0.5})`} />
          </linearGradient>

          {/* Broad diffuse lit face top-left */}
          <radialGradient
            id="atomSphereDiffuse"
            gradientUnits="userSpaceOnUse"
            cx={sphereLight.diffuseCx}
            cy={sphereLight.diffuseCy}
            r={sphereLight.diffuseR}
            fx={sphereLight.diffuseCx}
            fy={sphereLight.diffuseCy}
          >
            <stop offset="0%" stopColor={`rgba(255, 255, 255, ${sphereDiffuseOpacity})`} />
            <stop offset="50%" stopColor={`rgba(255, 255, 255, ${sphereDiffuseOpacity * 0.35})`} />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>

          {/* Specular hotspot top-left */}
          <radialGradient
            id="atomSphereHighlight"
            gradientUnits="userSpaceOnUse"
            cx={sphereLight.specCx}
            cy={sphereLight.specCy}
            r={sphereLight.specR}
            fx={sphereLight.specCx}
            fy={sphereLight.specCy}
          >
            <stop offset="0%" stopColor={`rgba(255, 255, 255, ${sphereHighlightOpacity})`} />
            <stop offset="45%" stopColor={`rgba(255, 255, 255, ${sphereHighlightOpacity * 0.2})`} />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>

          <radialGradient id="atomCore" cx="36%" cy="30%" r="72%">
            <stop offset="0%" stopColor={coreLight} />
            <stop offset="45%" stopColor={coreMid} />
            <stop offset="100%" stopColor={coreDeep} />
          </radialGradient>

          <radialGradient id="atomCoreOcclusion" cx="68%" cy="72%" r="55%">
            <stop offset="0%" stopColor={isDark ? 'rgba(15, 15, 35, 0.55)' : 'rgba(30, 27, 75, 0.45)'} />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>

          {ribbons.map((ribbon, i) => (
            <linearGradient
              key={`orbitGrad-${i}`}
              id={`orbitGrad-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={ribbon.grad.x1}
              y1={ribbon.grad.y1}
              x2={ribbon.grad.x2}
              y2={ribbon.grad.y2}
            >
              <stop offset="0%" stopColor={orbitFar} />
              <stop offset="100%" stopColor={orbitNear} />
            </linearGradient>
          ))}
        </defs>

        {ATOM_SHADING.enableSphereVolume && (
          <ellipse
            cx={cx + sphereR * 0.12}
            cy={cy + sphereR * 0.62}
            rx={sphereR * 0.7}
            ry={sphereR * 0.2}
            fill={isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(30, 27, 75, 0.4)'}
            opacity={exteriorDropOpacity}
            filter="url(#atomExteriorShadow)"
          />
        )}

        <circle cx={cx} cy={cy} r={haloR} fill="url(#atomHalo)" />

        {ATOM_SHADING.enableSphereVolume && (
          <>
            <circle cx={cx} cy={cy} r={sphereR} fill="url(#atomSphereBody)" />
            <circle cx={cx} cy={cy} r={sphereR} fill="url(#atomSphereDiffuse)" />
            {rim.strokes.map((stroke, i) => (
              <path
                key={`rim-${i}`}
                d={stroke.d}
                stroke={rimFill}
                strokeWidth={stroke.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </>
        )}

        {ribbons.map((ribbon, i) => (
          <path key={`back-${i}`} d={ribbon.backPath} fill={`url(#orbitGrad-${i})`} />
        ))}

        {ATOM_SHADING.enableProjectedShadows &&
          ribbons.map((ribbon, i) => (
            <g key={`proj-${i}`} transform={`translate(${shadowDx}, ${shadowDy})`} filter="url(#atomProjectedShadow)">
              <path d={ribbon.frontPath} fill={`rgba(0, 0, 0, ${projectedOpacity})`} />
            </g>
          ))}

        <ellipse
          cx={cx}
          cy={cy + coreR * 0.4}
          rx={coreR * 1.2}
          ry={coreR * 0.38}
          fill={isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(30, 27, 75, 0.22)'}
          filter="url(#atomContactShadow)"
        />

        <circle cx={cx} cy={cy} r={coreR} fill="url(#atomCore)" />
        <circle cx={cx} cy={cy} r={coreR} fill="url(#atomCoreOcclusion)" />
        <circle
          cx={cx - coreR * 0.3}
          cy={cy - coreR * 0.34}
          r={coreR * 0.36}
          fill={isDark ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.68)'}
        />

        {ribbons.map((ribbon, i) => (
          <path key={`front-${i}`} d={ribbon.frontPath} fill={`url(#orbitGrad-${i})`} />
        ))}

        {ATOM_SHADING.enableSphereVolume && (
          <circle cx={cx} cy={cy} r={sphereR} fill="url(#atomSphereHighlight)" />
        )}
      </svg>
    </div>
  );
}
