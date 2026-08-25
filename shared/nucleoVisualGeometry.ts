import type { NucleoVisualKind } from './contracts';

export type VisualNodeFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualGeometry = {
  width: number;
  height: number;
  frames: VisualNodeFrame[];
  vertical: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function estimateVisualLabelLines(label: string, width: number): number {
  const charactersPerLine = Math.max(8, Math.floor(width / 7.2));
  return clamp(Math.ceil(label.trim().length / charactersPerLine), 1, 3);
}

function labelHeight(labels: string[], width: number): number {
  const lines = Math.max(1, ...labels.map((label) => estimateVisualLabelLines(label, width)));
  return 46 + (lines - 1) * 17;
}

function horizontalFlow(width: number, labels: string[]): VisualGeometry {
  const count = labels.length;
  const gap = 18;
  const nodeWidth = clamp((width - gap * Math.max(0, count - 1)) / count, 68, 132);
  const nodeHeight = labelHeight(labels, nodeWidth - 12);
  const contentWidth = nodeWidth * count + gap * Math.max(0, count - 1);
  const startX = (width - contentWidth) / 2;
  return {
    width,
    height: nodeHeight + 42,
    vertical: false,
    frames: labels.map((_, index) => ({
      x: startX + index * (nodeWidth + gap),
      y: 18,
      width: nodeWidth,
      height: nodeHeight,
    })),
  };
}

function verticalFlow(width: number, labels: string[]): VisualGeometry {
  const nodeWidth = clamp(width - 88, 190, 340);
  const nodeHeight = labelHeight(labels, nodeWidth - 20);
  const gap = 18;
  return {
    width,
    height: labels.length * nodeHeight + (labels.length - 1) * gap + 28,
    vertical: true,
    frames: labels.map((_, index) => ({
      x: (width - nodeWidth) / 2,
      y: 14 + index * (nodeHeight + gap),
      width: nodeWidth,
      height: nodeHeight,
    })),
  };
}

function radial(width: number, labels: string[], central: boolean): VisualGeometry {
  const count = labels.length;
  const height = clamp(width * 0.82, 260, 430);
  const nodeWidth = clamp(width * (width < 350 ? 0.3 : 0.25), 82, 126);
  const nodeHeight = labelHeight(labels, nodeWidth - 12);
  const frames: VisualNodeFrame[] = [];
  const branchStart = central ? 1 : 0;
  if (central) {
    frames.push({
      x: (width - nodeWidth * 1.18) / 2,
      y: (height - nodeHeight) / 2,
      width: nodeWidth * 1.18,
      height: nodeHeight,
    });
  }
  const branches = Math.max(1, count - branchStart);
  const radiusX = Math.max(64, width / 2 - nodeWidth / 2 - 8);
  const radiusY = Math.max(68, height / 2 - nodeHeight / 2 - 14);
  for (let index = 0; index < branches; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / branches;
    frames.push({
      x: width / 2 + Math.cos(angle) * radiusX - nodeWidth / 2,
      y: height / 2 + Math.sin(angle) * radiusY - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
    });
  }
  return { width, height, frames: frames.slice(0, count), vertical: false };
}

function hierarchy(width: number, labels: string[]): VisualGeometry {
  if (labels.length <= 1) return horizontalFlow(width, labels);
  const nodeWidth = clamp((width - 24) / Math.min(3, labels.length - 1), 82, 132);
  const nodeHeight = labelHeight(labels, nodeWidth - 12);
  const children = labels.length - 1;
  const rows = children > 3 ? 2 : 1;
  const height = 38 + nodeHeight * (rows + 1) + 64 * rows;
  const frames: VisualNodeFrame[] = [
    { x: (width - Math.min(nodeWidth * 1.28, 154)) / 2, y: 14, width: Math.min(nodeWidth * 1.28, 154), height: nodeHeight },
  ];
  for (let index = 0; index < children; index += 1) {
    const row = children > 3 && index >= 3 ? 1 : 0;
    const rowStart = row === 0 ? 0 : 3;
    const inRow = Math.min(3, children - rowStart);
    const gap = 12;
    const rowWidth = inRow * nodeWidth + (inRow - 1) * gap;
    frames.push({
      x: (width - rowWidth) / 2 + (index - rowStart) * (nodeWidth + gap),
      y: 14 + nodeHeight + 54 + row * (nodeHeight + 50),
      width: nodeWidth,
      height: nodeHeight,
    });
  }
  return { width, height, frames, vertical: false };
}

export function getVisualGeometry(
  kind: NucleoVisualKind,
  width: number,
  labels: string[]
): VisualGeometry {
  const safeWidth = clamp(width, 280, 736);
  const safeLabels = labels.slice(0, 6);
  if (kind === 'concept') return radial(safeWidth, safeLabels, true);
  if (kind === 'cycle') return radial(safeWidth, safeLabels, false);
  if (kind === 'hierarchy') return hierarchy(safeWidth, safeLabels);
  if (kind === 'flow') {
    return safeWidth < 350 || safeLabels.length > 4
      ? verticalFlow(safeWidth, safeLabels)
      : horizontalFlow(safeWidth, safeLabels);
  }
  return {
    width: safeWidth,
    height: clamp(92 + safeLabels.length * 48, 210, 390),
    frames: [],
    vertical: true,
  };
}
