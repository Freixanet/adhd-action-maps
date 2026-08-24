import type { CSSProperties, ReactElement } from 'react';

declare module '@originkit/roundcarousel' {
  export default function RoundCarousel(props: {
    images?: { src: string }[];
    imageWidth?: number;
    imageHeight?: number;
    spacing?: number;
    speed?: number;
    direction?: 'right' | 'left';
    drag?: boolean;
    sensitivity?: number;
    tilt?: number;
    perspective?: number;
    cornerRadius?: number;
    innerDim?: number;
    snap?: boolean;
    background?: string;
    style?: CSSProperties;
  }): ReactElement;
}
