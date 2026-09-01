"""
【展示已改用视频 + Canvas 实时抠像，见 SpriteImage.vue】

本脚本仅作可选离线预览：从 12s 视频导出四态静帧 / 调试 sheet。
线上展示请使用 mia-web 内 blanket_loop_12s_v3.mp4，勿再依赖 blanket-sheet.webp。
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

VIDEO = Path(
    r"c:\Users\yingm\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent"
    r"\work-mode-projects\6a9506ac0152a678370c8450\blanket_loop_12s_v3.mp4"
)
OUT_DIR = Path(r"D:\Code\ccode\Mia-Project\mia-web\src\assets\sprite")
META_PATH = OUT_DIR / "sprite-sheet-meta.json"

UNIQUE_FRAMES = 79
KEY_SECONDS = {
    "idle": 0.0,
    "wave": 4.0,
    "sleep": 8.0,
}
# 背景色距离阈值（略放宽，多吞灰底）
BG_DIST = 42
# 硬抠后向外多吃灰边
EAT_BG_ITERS = 4
# 轮廓附近再清「像背景」的像素
FRINGE_DIST = 40
# 前景再内收，专吃上沿灰白 AA 晕
ERODE_FG_ITERS = 3
# alpha 羽化宽度（像素）
FEATHER_PX = 1.2
# 包围盒忽略过淡像素
BBOX_ALPHA_MIN = 32
# 高清单格：两行×40 列，40×320=12800 < WebP 16383
MAX_CELL_SIDE = 320
SHEET_COLS = 40
CELL_PAD = 4
WEBP_QUALITY = 88
# 页面显示宽（≥240）；素材 320 略大于显示，Retina 更清晰
DISPLAY_WIDTH = 256
# 轮廓壳上「浅灰白晕」判定（更敏感）
HALO_LUMA_MIN = 155
HALO_CHROMA_MAX = 36
# 最外圈浅色剥几层
PEEL_LIGHT_ITERS = 3
PEEL_LUMA_MIN = 150

OLD_MULTI_SHEETS = (
    "idle-sheet",
    "wave-sheet",
    "sleep-sheet",
    "fold-sheet",
)


def sample_bg_bgr(frame: np.ndarray) -> np.ndarray:
    """从四角/边采样背景色均值。"""
    h, w = frame.shape[:2]
    pts = [
        frame[4, 4],
        frame[4, w - 5],
        frame[h - 5, 4],
        frame[h - 5, w - 5],
        frame[8, w // 2],
        frame[h // 2, 8],
    ]
    return np.mean(pts, axis=0)


def flood_bg_mask(frame_bgr: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """从边缘 flood-fill：与背景色接近且连通的像素为 True。"""
    h, w = frame_bgr.shape[:2]
    diff = np.linalg.norm(frame_bgr.astype(np.float32) - bg, axis=2)
    near_bg = diff <= BG_DIST

    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if near_bg[y, x]:
                queue.append((y, x))
                visited[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if near_bg[y, x] and not visited[y, x]:
                queue.append((y, x))
                visited[y, x] = True

    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and near_bg[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))
    return visited


def remove_background(frame_bgr: np.ndarray) -> Image.Image:
    """
    抠透明背景并修边（重点清上沿灰白晕）：
    1) 边缘 flood-fill 清灰底
    2) 膨胀多吃灰晕 + 轮廓旁近背景色
    3) 前景内收，去掉 AA 浅边
    4) 轮廓壳上高亮低饱和像素（灰白晕）直接透明
    5) 羽化 + 强去 spill；壳层 RGB 用内侧模糊色覆盖
    """
    bg = sample_bg_bgr(frame_bgr)
    diff = np.linalg.norm(frame_bgr.astype(np.float32) - bg, axis=2)
    bg_mask = flood_bg_mask(frame_bgr, bg)

    mask_u8 = bg_mask.astype(np.uint8) * 255
    kernel = np.ones((3, 3), np.uint8)
    if EAT_BG_ITERS > 0:
        mask_u8 = cv2.dilate(mask_u8, kernel, iterations=EAT_BG_ITERS)

    ring = cv2.dilate(mask_u8, kernel, iterations=3)
    fringe = (ring > 0) & (mask_u8 == 0) & (diff <= FRINGE_DIST)
    mask_u8[fringe] = 255
    bg_mask = mask_u8 > 0

    fg = (~bg_mask).astype(np.uint8) * 255
    if ERODE_FG_ITERS > 0:
        fg = cv2.erode(fg, kernel, iterations=ERODE_FG_ITERS)

    dist = cv2.distanceTransform(fg, cv2.DIST_L2, 5)
    alpha = np.clip(dist / FEATHER_PX, 0.0, 1.0)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.5)
    alpha[fg == 0] = 0.0

    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    bg_rgb = bg[::-1].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    color_diff = np.linalg.norm(rgb - bg_rgb, axis=2)

    # 轮廓壳：浅灰/白晕、暖灰、不够蓝的浅边清掉
    shell = (dist > 0) & (dist <= 4.0) & (alpha > 0)
    light_halo = shell & (luma >= HALO_LUMA_MIN) & (chroma <= HALO_CHROMA_MAX)
    near_bg_shell = shell & (color_diff <= FRINGE_DIST + 8)
    not_bluish = shell & (luma >= 140) & ~((b > r + 5) & (b > g + 1))
    # 上沿常见暖灰/米色晕（R 明显高于 B）
    warm_halo = shell & (r > b + 8) & (luma >= 135)
    alpha[light_halo | near_bg_shell | not_bluish | warm_halo] = 0.0
    alpha[(alpha < 0.92) & (color_diff < FRINGE_DIST)] = 0.0

    # 反复剥最外圈「非毯子蓝」浅色，直到外轮廓干净
    for _ in range(PEEL_LIGHT_ITERS + 2):
        opaque = alpha > 0.05
        transparent = ~opaque
        outer = (cv2.dilate(transparent.astype(np.uint8) * 255, kernel, iterations=1) > 0) & opaque
        bluish = (b > r + 5) & (b > g + 1)
        bad = outer & (
            ((luma >= PEEL_LUMA_MIN) & ~bluish)
            | (color_diff <= FRINGE_DIST + 12)
            | ((r > b + 8) & (luma >= 130))
        )
        if not np.any(bad):
            break
        alpha[bad] = 0.0

    alpha = np.clip(alpha * 1.3 - 0.02, 0.0, 1.0)

    # 内侧颜色：只对实心前景做均值，再铺到壳层，去掉发白
    solid = (alpha > 0.92).astype(np.float32)
    solid3 = solid[:, :, None]
    blur_rgb = cv2.GaussianBlur(rgb * solid3, (9, 9), 0)
    blur_w = cv2.GaussianBlur(solid, (9, 9), 0)
    blur_w = np.maximum(blur_w, 1e-3)
    interior = blur_rgb / blur_w[:, :, None]

    a = alpha
    a_safe = np.maximum(a, 0.15)
    rgba = np.empty((*rgb.shape[:2], 4), dtype=np.float32)
    for c in range(3):
        ch = rgb[:, :, c]
        fg_est = (ch - (1.0 - a) * bg_rgb[c]) / a_safe
        fg_est = np.clip(fg_est, 0, 255)
        edge = (a > 0.08) & (a < 0.995)
        mixed = np.where(edge, fg_est, ch)
        rgba[:, :, c] = mixed

    # 最外轮廓：一律贴内侧毯子色，并压掉过亮像素（上沿假白边）
    opaque = a > 0.05
    transparent = ~opaque
    border = (cv2.dilate(transparent.astype(np.uint8) * 255, kernel, iterations=2) > 0) & opaque
    for c in range(3):
        rgba[:, :, c] = np.where(border, interior[:, :, c], rgba[:, :, c])
    # 仍过亮的描边再压暗一点
    border_luma = (
        0.299 * rgba[:, :, 0] + 0.587 * rgba[:, :, 1] + 0.114 * rgba[:, :, 2]
    )
    too_bright = border & (border_luma > 155)
    for c in range(3):
        rgba[:, :, c] = np.where(
            too_bright,
            rgba[:, :, c] * 0.72 + interior[:, :, c] * 0.28,
            rgba[:, :, c],
        )

    rgba[:, :, 3] = a * 255.0
    # 透明像素 RGB 清零，避免缩放时浅色半透明冒白边
    clear = alpha <= 0.05
    rgba[clear, :3] = 0
    rgba[clear, 3] = 0
    # 半透明描边抬不透明：奶油底上少冒雾白
    mid = (alpha > 0.05) & (alpha < 0.88)
    rgba[mid, 3] = np.maximum(rgba[mid, 3], 230)
    return Image.fromarray(np.round(np.clip(rgba, 0, 255)).astype(np.uint8))


def content_bbox(im: Image.Image, alpha_min: int = BBOX_ALPHA_MIN) -> tuple[int, int, int, int]:
    """按 alpha 阈值取内容包围盒，忽略过淡虚边。"""
    alpha = np.array(im.split()[-1])
    ys, xs = np.where(alpha >= alpha_min)
    if len(xs) == 0:
        return (0, 0, im.width, im.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def pad_bottom_center(im: Image.Image, canvas_w: int, canvas_h: int) -> Image.Image:
    """统一画布：水平居中、底部对齐。"""
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - im.width) // 2
    y = canvas_h - im.height
    canvas.paste(im, (x, y), im)
    return canvas


def read_frame(cap: cv2.VideoCapture, index: int) -> np.ndarray:
    """按帧号读取一帧。"""
    cap.set(cv2.CAP_PROP_POS_FRAMES, index)
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f"无法读取帧 {index}")
    return frame


def shrink_frame(im: Image.Image, max_side: int = MAX_CELL_SIDE) -> Image.Image:
    """等比缩小；LANCZOS 后略锐一点边缘观感。"""
    w, h = im.size
    side = max(w, h)
    if side <= max_side:
        return im
    scale = max_side / side
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def sample_video_indices(total: int, unique: int) -> list[int]:
    """在 [0, total-1] 上均匀取 unique 个视频帧下标。"""
    if unique <= 1:
        return [0]
    last = max(0, total - 1)
    return [int(round(i * last / (unique - 1))) for i in range(unique)]


def build_sheet(frames: list[Image.Image]) -> tuple[Image.Image, int, int, int, int]:
    """
    拼 sheet：多行网格（默认 2 行 × 40 列），提高单格分辨率。
    返回 sheet, cell_w, cell_h, cols, rows
    """
    max_w = max(f.width for f in frames)
    max_h = max(f.height for f in frames)
    cell_w = max_w + CELL_PAD
    cell_h = max_h + CELL_PAD
    cols = min(SHEET_COLS, len(frames))
    rows = int(np.ceil(len(frames) / cols))
    padded = [pad_bottom_center(f, cell_w, cell_h) for f in frames]
    sheet = Image.new("RGBA", (cell_w * cols, cell_h * rows), (0, 0, 0, 0))
    for i, f in enumerate(padded):
        col = i % cols
        row = i // cols
        sheet.paste(f, (col * cell_w, row * cell_h), f)
    return sheet, cell_w, cell_h, cols, rows


def frame_origin(index: int, cols: int, cell_w: int, cell_h: int) -> tuple[int, int]:
    """帧下标 → sheet 左上角像素。"""
    col = index % cols
    row = index // cols
    return col * cell_w, row * cell_h


def cleanup_old_multi_sheets() -> None:
    """删除旧的分态 sheet 文件名。"""
    for stem in OLD_MULTI_SHEETS:
        for ext in (".png", ".webp"):
            path = OUT_DIR / f"{stem}{ext}"
            if path.exists():
                path.unlink()
                print("removed", path.name)


def main() -> None:
    """主流程：80 帧连续 sheet + 四态关键帧元数据。"""
    if not VIDEO.exists():
        raise FileNotFoundError(VIDEO)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest_video = OUT_DIR / "blanket_loop_12s_v3.mp4"
    if not dest_video.exists():
        dest_video.write_bytes(VIDEO.read_bytes())
        print("copied source video")

    cap = cv2.VideoCapture(str(VIDEO))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 24.0)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total / fps if fps else 12.0
    print(f"video fps={fps} frames={total} duration≈{duration:.2f}s")

    video_indices = sample_video_indices(total, UNIQUE_FRAMES)
    print("sample", len(video_indices), "unique video frames")

    cells: list[Image.Image] = []
    for idx in video_indices:
        bgr = read_frame(cap, idx)
        rgba = remove_background(bgr)
        cropped = rgba.crop(content_bbox(rgba))
        cells.append(shrink_frame(cropped))

    cells.append(cells[0].copy())
    frame_count = len(cells)
    assert frame_count == UNIQUE_FRAMES + 1

    sheet, cell_w, cell_h, cols, rows = build_sheet(cells)
    assert sheet.width <= 16383 and sheet.height <= 16383, (
        f"WebP 尺寸超限: {sheet.size}"
    )

    cleanup_old_multi_sheets()

    # 主资源 WebP；关键帧小图便于预览
    sheet.save(
        OUT_DIR / "blanket-sheet.webp",
        "WEBP",
        quality=WEBP_QUALITY,
        method=6,
    )
    png_path = OUT_DIR / "blanket-sheet.png"
    if png_path.exists():
        png_path.unlink()
        print("removed bulky blanket-sheet.png")
    print(
        f"wrote blanket-sheet.webp {sheet.size} "
        f"cell={cell_w}x{cell_h} grid={cols}x{rows} frames={frame_count}"
    )

    def time_to_sheet(sec: float) -> int:
        """秒 → sheet 内容帧下标。"""
        t = max(0.0, min(sec, duration))
        return int(round(t / duration * (UNIQUE_FRAMES - 1)))

    keys = {
        "idle": time_to_sheet(KEY_SECONDS["idle"]),
        "wave": time_to_sheet(KEY_SECONDS["wave"]),
        "sleep": time_to_sheet(KEY_SECONDS["sleep"]),
        "fold": UNIQUE_FRAMES - 1,
    }
    loop_close = frame_count - 1

    for name, fi in keys.items():
        ox, oy = frame_origin(fi, cols, cell_w, cell_h)
        still = sheet.crop((ox, oy, ox + cell_w, oy + cell_h))
        still.save(OUT_DIR / f"{name}.png", optimize=True, compress_level=9)
        still.save(OUT_DIR / f"{name}.webp", "WEBP", quality=WEBP_QUALITY, method=6)

    print("keys", keys, "loopClose", loop_close)

    meta = {
        "fps": fps,
        "videoFrames": total,
        "durationSec": duration,
        "frameCount": frame_count,
        "uniqueFrames": UNIQUE_FRAMES,
        "loopClose": loop_close,
        "cols": cols,
        "rows": rows,
        "keys": keys,
        "keySeconds": {**KEY_SECONDS, "fold": "end"},
        "videoIndices": video_indices,
        "cell": {"w": cell_w, "h": cell_h},
        "displayWidth": DISPLAY_WIDTH,
        "note": "高清两行 sheet；显示≥240；点击 idle→wave→sleep→fold→idle",
    }
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("meta", META_PATH)
    cap.release()


if __name__ == "__main__":
    main()
