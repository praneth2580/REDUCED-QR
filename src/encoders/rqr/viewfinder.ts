export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SourceRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export function overlayToVideoSourceRect(
  overlay: Rect,
  videoElement: Rect,
  videoWidth: number,
  videoHeight: number,
  objectFit: 'cover' | 'contain' = 'cover'
): SourceRect {
  if (videoWidth <= 0 || videoHeight <= 0 || videoElement.width <= 0 || videoElement.height <= 0) {
    throw new Error('Video is not ready.');
  }

  const scale =
    objectFit === 'cover'
      ? Math.max(videoElement.width / videoWidth, videoElement.height / videoHeight)
      : Math.min(videoElement.width / videoWidth, videoElement.height / videoHeight);

  const displayedWidth = videoWidth * scale;
  const displayedHeight = videoHeight * scale;
  const offsetX = (videoElement.width - displayedWidth) / 2;
  const offsetY = (videoElement.height - displayedHeight) / 2;

  let sx = (overlay.left - videoElement.left - offsetX) / scale;
  let sy = (overlay.top - videoElement.top - offsetY) / scale;
  let sw = overlay.width / scale;
  let sh = overlay.height / scale;

  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  sw = Math.min(sw, videoWidth - sx);
  sh = Math.min(sh, videoHeight - sy);

  if (sw < 21 || sh < 21) {
    throw new Error('Viewfinder is too small.');
  }

  return { sx, sy, sw, sh };
}

export function cropViewfinder(
  video: HTMLVideoElement,
  overlay: HTMLElement,
  canvas: HTMLCanvasElement,
  outSize = 640
): { image: ImageData; source: SourceRect } {
  if (video.readyState < 2 || video.videoWidth === 0) {
    throw new Error('Video is not ready.');
  }

  const { sx, sy, sw, sh } = overlayToVideoSourceRect(
    overlay.getBoundingClientRect(),
    video.getBoundingClientRect(),
    video.videoWidth,
    video.videoHeight
  );

  const side = Math.min(sw, sh);
  const squareSx = sx + (sw - side) / 2;
  const squareSy = sy + (sh - side) / 2;

  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }
  ctx.drawImage(video, squareSx, squareSy, side, side, 0, 0, outSize, outSize);
  return {
    image: ctx.getImageData(0, 0, outSize, outSize),
    source: { sx: squareSx, sy: squareSy, sw: side, sh: side },
  };
}
