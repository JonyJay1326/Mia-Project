"""从 _source.png 切出四态透明图并统一画布底部对齐。"""

from pathlib import Path

from PIL import Image

SRC = Path('_source.png')
OUT = Path('mia-web/src/assets/sprite')
BG = (219, 219, 219)


def distance_to_bg(color: tuple[int, int, int]) -> int:
    """计算像素与灰底的曼哈顿距离。"""
    return abs(color[0] - BG[0]) + abs(color[1] - BG[1]) + abs(color[2] - BG[2])


def cut_state(
    image: Image.Image,
    x0: int,
    x1: int,
    y_max: int = 640,
) -> Image.Image:
    """按参考左右边界裁切并抠透明。"""
    pixels = image.load()
    width = image.size[0]
    x1 = min(x1, width - 1)

    ys: list[int] = []
    xs: list[int] = []
    for y in range(200, y_max):
        for x in range(x0, x1 + 1, 2):
            if distance_to_bg(pixels[x, y]) > 20:
                ys.append(y)
                xs.append(x)

    if not ys or not xs:
        raise RuntimeError(f'未检测到内容: {x0}-{x1}')

    y0 = max(min(ys) - 2, 0)
    y1 = min(max(ys) + 2, y_max)
    xx0 = max(min(xs) - 2, x0)
    xx1 = min(max(xs) + 2, x1)

    crop = image.crop((xx0, y0, xx1 + 1, y1 + 1)).convert('RGBA')
    cp = crop.load()
    w, h = crop.size

    for yy in range(h):
        for xx in range(w):
            r, g, b, _a = cp[xx, yy]
            d = distance_to_bg((r, g, b))
            if d <= 18:
                na = 0
            elif d >= 60:
                na = 255
            else:
                na = int((d - 18) / 42 * 255)
            cp[xx, yy] = (r, g, b, na)

    # 半透明边缘反色补偿（去掉混入的灰底）
    for yy in range(h):
        for xx in range(w):
            r, g, b, a = cp[xx, yy]
            if 0 < a < 255:
                alpha = a / 255.0
                nr = int((r - (1 - alpha) * BG[0]) / alpha)
                ng = int((g - (1 - alpha) * BG[1]) / alpha)
                nb = int((b - (1 - alpha) * BG[2]) / alpha)
                cp[xx, yy] = (
                    max(0, min(255, nr)),
                    max(0, min(255, ng)),
                    max(0, min(255, nb)),
                    a,
                )

    return crop


def unify_bottom(crops: dict[str, Image.Image]) -> dict[str, Image.Image]:
    """统一画布尺寸并底部对齐，避免切换时跳动。"""
    canvas_w = max(img.size[0] for img in crops.values())
    canvas_h = max(img.size[1] for img in crops.values())
    result: dict[str, Image.Image] = {}
    for name, img in crops.items():
        canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
        x = (canvas_w - img.size[0]) // 2
        y = canvas_h - img.size[1]
        canvas.paste(img, (x, y), img)
        result[name] = canvas
    return result


def main() -> None:
    """执行切图并写出 png/webp。"""
    OUT.mkdir(parents=True, exist_ok=True)
    image = Image.open(SRC).convert('RGB')

    # 目视校准后的左右边界（避开底部 IDLE/WAVE/... 文字）
    states = {
        'idle': (20, 445),
        'wave': (450, 925),
        'sleep': (930, 1245),
        'fold': (1260, 1510),
    }

    crops = {name: cut_state(image, x0, x1) for name, (x0, x1) in states.items()}
    unified = unify_bottom(crops)

    for name, img in unified.items():
        img.save(OUT / f'{name}.png', optimize=True)
        img.save(OUT / f'{name}.webp', 'WEBP', quality=92, method=6)
        print(f'{name}: {img.size}')


if __name__ == '__main__':
    main()
