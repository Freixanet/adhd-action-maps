import type { SVGProps } from 'react';

type AppIconProps = SVGProps<SVGSVGElement>;

export default function AppIcon({ className, ...props }: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <ellipse
        cx="12"
        cy="12"
        rx="9.2"
        ry="3.7"
        stroke="currentColor"
        strokeWidth="0.95"
        strokeLinecap="round"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9.2"
        ry="3.7"
        stroke="currentColor"
        strokeWidth="0.95"
        strokeLinecap="round"
        transform="rotate(60 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9.2"
        ry="3.7"
        stroke="currentColor"
        strokeWidth="0.95"
        strokeLinecap="round"
        transform="rotate(120 12 12)"
      />
      <circle cx="12" cy="12" r="2.35" fill="currentColor" />
    </svg>
  );
}
