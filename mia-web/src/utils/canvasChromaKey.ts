/**
 * Canvas 图像边缘 flood-fill 抠浅灰背景（不伤毯子内部白兔花纹）
 */

/** 背景色欧氏距离阈值 */
const BG_DIST = 42
/** 轮廓旁再清近背景 */
const FRINGE_DIST = 38
/** 外圈浅色剥除亮度门槛 */
const PEEL_LUMA = 150

/**
 * 从四角采样背景色均值（RGBA）
 */
function sampleBg(data: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const pts = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [Math.floor(w / 2), 2],
    [2, Math.floor(h / 2)],
  ]
  let r = 0
  let g = 0
  let b = 0
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  const n = pts.length
  return [r / n, g / n, b / n]
}

/**
 * 颜色与背景的距离
 */
function colorDist(
  data: Uint8ClampedArray,
  i: number,
  bg: [number, number, number],
): number {
  const dr = data[i] - bg[0]
  const dg = data[i + 1] - bg[1]
  const db = data[i + 2] - bg[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * 对 ImageData 做边缘连通抠透明 + 浅边清理（原地修改）
 */
export function keyOutStudioBg(imageData: ImageData): void {
  const { data, width: w, height: h } = imageData
  const bg = sampleBg(data, w, h)
  const total = w * h
  const near = new Uint8Array(total)
  for (let p = 0; p < total; p++) {
    near[p] = colorDist(data, p * 4, bg) <= BG_DIST ? 1 : 0
  }

  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let qh = 0
  let qt = 0

  /** 入队边缘近背景像素 */
  const tryEnqueue = (x: number, y: number) => {
    const p = y * w + x
    if (visited[p] || !near[p]) {
      return
    }
    visited[p] = 1
    queue[qt++] = p
  }

  for (let x = 0; x < w; x++) {
    tryEnqueue(x, 0)
    tryEnqueue(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    tryEnqueue(0, y)
    tryEnqueue(w - 1, y)
  }

  while (qh < qt) {
    const p = queue[qh++]
    const x = p % w
    const y = (p / w) | 0
    if (x > 0) {
      tryEnqueue(x - 1, y)
    }
    if (x + 1 < w) {
      tryEnqueue(x + 1, y)
    }
    if (y > 0) {
      tryEnqueue(x, y - 1)
    }
    if (y + 1 < h) {
      tryEnqueue(x, y + 1)
    }
  }

  // 膨胀背景 mask 2px，吃灰晕
  let mask = visited
  for (let iter = 0; iter < 2; iter++) {
    const next = new Uint8Array(mask)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x
        if (mask[p]) {
          continue
        }
        if (
          mask[p - 1] ||
          mask[p + 1] ||
          mask[p - w] ||
          mask[p + w]
        ) {
          if (colorDist(data, p * 4, bg) <= FRINGE_DIST) {
            next[p] = 1
          }
        }
      }
    }
    mask = next
  }

  for (let p = 0; p < total; p++) {
    if (mask[p]) {
      data[p * 4 + 3] = 0
    }
  }

  // 剥最外圈浅色/近背景（上沿白边）
  for (let round = 0; round < 3; round++) {
    const peel: number[] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        const i = p * 4
        if (data[i + 3] < 16) {
          continue
        }
        let touch = false
        if (x === 0 || data[((y * w + x - 1) * 4) + 3] < 16) {
          touch = true
        } else if (x === w - 1 || data[((y * w + x + 1) * 4) + 3] < 16) {
          touch = true
        } else if (y === 0 || data[(((y - 1) * w + x) * 4) + 3] < 16) {
          touch = true
        } else if (y === h - 1 || data[(((y + 1) * w + x) * 4) + 3] < 16) {
          touch = true
        }
        if (!touch) {
          continue
        }
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const luma = 0.299 * r + 0.587 * g + 0.114 * b
        const bluish = b > r + 5 && b > g + 1
        const dist = colorDist(data, i, bg)
        if ((luma >= PEEL_LUMA && !bluish) || dist <= FRINGE_DIST || (r > b + 8 && luma >= 135)) {
          peel.push(i)
        }
      }
    }
    if (!peel.length) {
      break
    }
    for (const i of peel) {
      data[i + 3] = 0
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }
  }

  // 透明像素 RGB 清零，避免缩放冒边
  for (let p = 0; p < total; p++) {
    const i = p * 4
    if (data[i + 3] < 12) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
}

/** 不透明内容包围盒 */
export type OpaqueBounds = {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 计算 alpha 足够高的像素包围盒；无内容时返回 null
 */
export function opaqueBounds(
  imageData: ImageData,
  alphaMin = 24,
): OpaqueBounds | null {
  const { data, width: w, height: h } = imageData
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < alphaMin) {
        continue
      }
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX || maxY < minY) {
    return null
  }
  // 略留边，避免裁切阴影
  const pad = 2
  const x = Math.max(0, minX - pad)
  const y = Math.max(0, minY - pad)
  const right = Math.min(w - 1, maxX + pad)
  const bottom = Math.min(h - 1, maxY + pad)
  return { x, y, w: right - x + 1, h: bottom - y + 1 }
}
