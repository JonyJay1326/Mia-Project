/**
 * 从视频文件截取接近第一帧的画面，生成缩略图 Blob（webp 优先）
 */
export function captureVideoPoster(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', 'true')
    video.src = url

    let settled = false

    /** 清理并结束 */
    function finish(err?: Error, blob?: Blob) {
      if (settled) {
        return
      }
      settled = true
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      if (err) {
        reject(err)
      } else if (blob) {
        resolve(blob)
      } else {
        reject(new Error('无法生成视频封面'))
      }
    }

    /** 画到 canvas 并导出 */
    function drawFrame() {
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) {
        finish(new Error('视频尺寸无效'))
        return
      }
      const maxSide = 480
      const scale = Math.min(1, maxSide / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        finish(new Error('无法创建画布'))
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const tryWebp = () =>
        new Promise<Blob | null>((res) => {
          canvas.toBlob((b) => res(b), 'image/webp', 0.82)
        })
      const tryJpeg = () =>
        new Promise<Blob | null>((res) => {
          canvas.toBlob((b) => res(b), 'image/jpeg', 0.85)
        })

      void (async () => {
        const webp = await tryWebp()
        if (webp && webp.size > 0) {
          finish(undefined, webp)
          return
        }
        const jpeg = await tryJpeg()
        if (jpeg && jpeg.size > 0) {
          finish(undefined, jpeg)
          return
        }
        finish(new Error('导出封面失败'))
      })()
    }

    video.addEventListener('error', () => {
      finish(new Error('浏览器无法解码该视频'))
    })

    video.addEventListener('loadeddata', () => {
      // 略过 0 时刻黑帧，取极早一帧
      const t = Math.min(0.12, Math.max(0.01, (video.duration || 1) * 0.01))
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        drawFrame()
      }
      video.addEventListener('seeked', onSeeked)
      try {
        video.currentTime = t
      } catch {
        drawFrame()
      }
    })

    // 部分机型需要先 play 才能 seek
    void video.play().then(
      () => {
        video.pause()
      },
      () => {
        // autoplay 被拒时仍等 loadeddata
      },
    )

    window.setTimeout(() => {
      if (!settled) {
        finish(new Error('截取封面超时'))
      }
    }, 12000)
  })
}
