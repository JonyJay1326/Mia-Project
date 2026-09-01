"""探测毯子视频基本信息与背景色。"""

from pathlib import Path

import cv2

VIDEO = Path(
    r"c:\Users\yingm\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent"
    r"\work-mode-projects\6a9506ac0152a678370c8450\blanket_loop_12s_v3.mp4"
)
OUT = Path(r"D:\Code\ccode\Mia-Project\mia-web\src\assets\sprite\_probe0.png")


def main() -> None:
    """打印视频参数并导出首帧。"""
    cap = cv2.VideoCapture(str(VIDEO))
    print("opened", cap.isOpened())
    fps = cap.get(cv2.CAP_PROP_FPS)
    n = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print("fps", fps, "frames", n, "size", w, h, "dur", (n / fps) if fps else None)
    ok, frame = cap.read()
    print("read0", ok)
    if ok:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(OUT), frame)
        corners = [
            frame[5, 5],
            frame[5, w - 6],
            frame[h - 6, 5],
            frame[h - 6, w - 6],
            frame[h // 2, 5],
            frame[5, w // 2],
        ]
        for i, c in enumerate(corners):
            print("corner", i, c.tolist())
    cap.release()


if __name__ == "__main__":
    main()
