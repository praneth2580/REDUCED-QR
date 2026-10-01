import { useCallback, useEffect, useRef, useState } from 'react';
import { DevConsole, type DevLogEntry, type DevLogLevel } from '../components/DevConsole';
import { decodeFromImageData, inspectRqrFrame, type RqrDecodeResult } from '../encoders/rqr/v1.decoder';
import { cropViewfinder } from '../encoders/rqr/viewfinder';

const SCAN_INTERVAL_MS = 120;
const MATCHES_TO_LOCK = 2;
const CROP_SIZE = 640;
const SCAN_INSETS = [0, 0.05, 0.1, 0.16, 0.22, 0.28];
const MAX_LOGS = 150;
const MISS_LOG_EVERY = 8;

function cameraErrorMessage(error: unknown): string {
  if (!window.isSecureContext) {
    return 'Camera needs HTTPS (or localhost).';
  }
  if (!(error instanceof DOMException) && !(error instanceof Error)) {
    return 'Could not open the camera.';
  }
  const name = 'name' in error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission denied. Allow camera access and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is already in use by another app.';
  }
  return error instanceof Error ? error.message : 'Could not open the camera.';
}

function formatNow(): string {
  return new Date().toLocaleTimeString();
}

function rgbLog(color: { r: number; g: number; b: number }): string {
  return `${Math.round(color.r)}/${Math.round(color.g)}/${Math.round(color.b)}`;
}

async function fileToImageData(file: File, maxSide = 1024): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load still image.'));
      img.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(21, Math.round(image.width * scale));
    const height = Math.max(21, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not supported');
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function QrLiveScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const lastTextRef = useRef<string>('');
  const matchCountRef = useRef(0);
  const mountedRef = useRef(true);
  const logIdRef = useRef(0);
  const logsRef = useRef<DevLogEntry[]>([]);
  const lastMissRef = useRef('');
  const missCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState('Start the camera to scan');
  const [error, setError] = useState('');
  const [result, setResult] = useState<RqrDecodeResult | null>(null);
  const [logs, setLogs] = useState<DevLogEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [stillPreview, setStillPreview] = useState<string>('');

  const pushLog = useCallback((level: DevLogLevel, message: string) => {
    logIdRef.current += 1;
    const entry: DevLogEntry = {
      id: logIdRef.current,
      time: formatNow(),
      level,
      message,
    };
    const next = [...logsRef.current, entry].slice(-MAX_LOGS);
    logsRef.current = next;
    setLogs(next);
  }, []);

  const logMiss = useCallback(
    (reason: string) => {
      if (reason === lastMissRef.current) {
        missCountRef.current += 1;
        if (missCountRef.current % MISS_LOG_EVERY === 0) {
          pushLog('warn', `${reason} (×${missCountRef.current})`);
        }
        return;
      }
      lastMissRef.current = reason;
      missCountRef.current = 1;
      pushLog('warn', reason);
    },
    [pushLog]
  );

  const resetMissStreak = () => {
    lastMissRef.current = '';
    missCountRef.current = 0;
  };

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopCamera = useCallback(() => {
    stopTimer();
    lockedRef.current = false;
    lastTextRef.current = '';
    matchCountRef.current = 0;
    resetMissStreak();
    const hadStream = Boolean(streamRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setRunning(false);
    if (hadStream) pushLog('info', 'Camera stopped');
  }, [pushLog]);

  const scanTick = useCallback(() => {
    if (!mountedRef.current || lockedRef.current) return;
    const video = videoRef.current;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (video && frame && canvas && video.readyState >= 2) {
      try {
        const { image, source } = cropViewfinder(video, frame, canvas, CROP_SIZE);
        try {
          const decoded = decodeFromImageData(image, { insets: SCAN_INSETS });
          resetMissStreak();
          if (decoded.text === lastTextRef.current) {
            matchCountRef.current += 1;
          } else {
            lastTextRef.current = decoded.text;
            matchCountRef.current = 1;
          }
          const preview = decoded.text.length > 48 ? `${decoded.text.slice(0, 48)}…` : decoded.text;
          const agree = decoded.agreement != null ? ` agree ${Math.round(decoded.agreement * 100)}%` : '';
          const score = decoded.detectScore != null ? ` score ${decoded.detectScore.toFixed(0)}` : '';
          const needed = (decoded.agreement ?? 0) >= 0.93 ? 1 : MATCHES_TO_LOCK;
          pushLog(
            'info',
            `Candidate ${decoded.gridSize}×${decoded.gridSize}${score}${agree} match ${matchCountRef.current}/${needed}: ${preview}`
          );
          if (matchCountRef.current >= needed) {
            lockedRef.current = true;
            setLocked(true);
            setResult(decoded);
            setStatus('Locked');
            video.pause();
            stopTimer();
            pushLog(
              'ok',
              `Locked v${decoded.version} ${decoded.gridSize}×${decoded.gridSize} backup ${decoded.backupLevel.toFixed(2)}×`
            );
            return;
          }
          setStatus(`Confirming ${matchCountRef.current}/${needed}`);
        } catch (decodeError) {
          const reason = decodeError instanceof Error ? decodeError.message : 'Decode failed';
          logMiss(
            `${reason} · crop ${Math.round(source.sw)}×${Math.round(source.sh)} → ${CROP_SIZE}px`
          );
          lastTextRef.current = '';
          matchCountRef.current = 0;
        }
      } catch (cropError) {
        const reason = cropError instanceof Error ? cropError.message : 'Crop failed';
        logMiss(reason);
        lastTextRef.current = '';
        matchCountRef.current = 0;
      }
    } else {
      logMiss('Waiting for camera frames');
    }
    if (!mountedRef.current || lockedRef.current) return;
    timerRef.current = window.setTimeout(() => scanTick(), SCAN_INTERVAL_MS);
  }, [logMiss, pushLog]);

  const startCamera = useCallback(async () => {
    setError('');
    setResult(null);
    setLocked(false);
    setStillPreview('');
    lockedRef.current = false;
    lastTextRef.current = '';
    matchCountRef.current = 0;
    resetMissStreak();
    stopTimer();
    pushLog('info', 'Requesting camera…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!mountedRef.current || !video) {
        stream.getTracks().forEach((track) => track.stop());
        pushLog('warn', 'Camera opened after unmount; tracks stopped');
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      pushLog(
        'ok',
        `Camera started ${settings?.width ?? video.videoWidth}×${settings?.height ?? video.videoHeight} (${track?.label || 'default'})`
      );
      setRunning(true);
      setStatus('Point the camera at the RQR');
      timerRef.current = window.setTimeout(() => scanTick(), SCAN_INTERVAL_MS);
    } catch (err) {
      const message = cameraErrorMessage(err);
      stopTimer();
      lockedRef.current = false;
      lastTextRef.current = '';
      matchCountRef.current = 0;
      resetMissStreak();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      setRunning(false);
      setError(message);
      setStatus('Camera unavailable');
      pushLog('error', message);
    }
  }, [pushLog, scanTick]);

  const handleScanAgain = async () => {
    setResult(null);
    setLocked(false);
    setStillPreview('');
    lockedRef.current = false;
    lastTextRef.current = '';
    matchCountRef.current = 0;
    resetMissStreak();
    pushLog('info', 'Scan again');
    const video = videoRef.current;
    if (running && video?.srcObject) {
      await video.play();
      setStatus('Point the camera at the RQR');
      stopTimer();
      timerRef.current = window.setTimeout(() => scanTick(), SCAN_INTERVAL_MS);
      return;
    }
    await startCamera();
  };

  const handleStop = () => {
    stopCamera();
    setStillPreview('');
    setStatus('Start the camera to scan');
  };

  const processStill = useCallback(
    (image: ImageData, label: string, previewUrl?: string) => {
      stopTimer();
      lockedRef.current = false;
      lastTextRef.current = '';
      matchCountRef.current = 0;
      resetMissStreak();
      if (previewUrl) setStillPreview(previewUrl);
      setConsoleOpen(true);
      pushLog('info', `${label} ${image.width}×${image.height}`);
      const inspect = inspectRqrFrame(image);
      if (inspect.content) {
        pushLog(
          'info',
          `Content square ${inspect.content.size}×${inspect.content.size} at ${inspect.content.x},${inspect.content.y}`
        );
      }
      const { tl, tr, bl, br } = inspect.imageCorners;
      pushLog(
        'info',
        `Image corners TL ${rgbLog(tl)} TR ${rgbLog(tr)} BL ${rgbLog(bl)} BR ${rgbLog(br)}`
      );
      for (const size of inspect.sizes) {
        pushLog(
          size.signature ? 'ok' : 'warn',
          `${size.gridSize}×${size.gridSize} score ${size.score.toFixed(0)} signature ${size.signature}`
        );
      }
      try {
        const decoded = decodeFromImageData(image, { insets: SCAN_INSETS });
        setResult(decoded);
        setError('');
        setLocked(true);
        lockedRef.current = true;
        setStatus('Locked from still');
        pushLog(
          'ok',
          `Decoded still v${decoded.version} ${decoded.gridSize}×${decoded.gridSize} agree ${Math.round((decoded.agreement ?? 0) * 100)}%: ${decoded.text}`
        );
      } catch (decodeError) {
        setResult(null);
        const message = decodeError instanceof Error ? decodeError.message : 'Still decode failed';
        setError(message);
        setStatus('Still not decoded — check Dev console');
        pushLog('error', message);
      }
    },
    [pushLog]
  );

  const handleLoadStill = async (file: File | undefined) => {
    if (!file) return;
    stopCamera();
    try {
      const image = await fileToImageData(file);
      const previewUrl = URL.createObjectURL(file);
      processStill(image, `Still photo ${file.name}`, previewUrl);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load still';
      setError(message);
      pushLog('error', message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCaptureStill = () => {
    const video = videoRef.current;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!video || !frame || !canvas || video.readyState < 2) {
      pushLog('warn', 'No camera frame to capture');
      return;
    }
    try {
      const { image } = cropViewfinder(video, frame, canvas, CROP_SIZE);
      const previewUrl = canvas.toDataURL('image/png');
      stopCamera();
      processStill(image, 'Captured viewfinder still', previewUrl);
    } catch (captureError) {
      const message = captureError instanceof Error ? captureError.message : 'Capture failed';
      pushLog('error', message);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center p-4 text-black'>
      <div className='w-full bg-white rounded-lg shadow-lg p-6'>
        <h1 className='text-3xl font-bold text-center text-gray-800 mb-6'>Live RQR Scan</h1>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='flex flex-col'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Viewfinder</h2>
            <div ref={frameRef} className='relative bg-black rounded-md overflow-hidden aspect-square w-full'>
              <video
                ref={videoRef}
                className='absolute inset-0 h-full w-full object-cover'
                playsInline
                muted
                autoPlay
              />
              {stillPreview && (
                <img
                  src={stillPreview}
                  alt='Loaded still'
                  className='absolute inset-0 h-full w-full object-contain bg-black'
                />
              )}
              {!stillPreview && (
                <div className='absolute inset-0 pointer-events-none'>
                  <div
                    ref={overlayRef}
                    className='absolute left-1/2 top-1/2 w-[72%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-sm'
                    style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)' }}
                  >
                    <span className='absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-white' />
                    <span className='absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-white' />
                    <span className='absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-white' />
                    <span className='absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-white' />
                  </div>
                </div>
              )}
            </div>
            <p className='mt-3 text-center text-gray-600'>{status}</p>
            <div className='flex mt-4 flex-wrap gap-2'>
              {!running && (
                <button
                  onClick={() => void startCamera()}
                  className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors'
                >
                  Start camera
                </button>
              )}
              {running && !locked && (
                <>
                  <button
                    onClick={handleCaptureStill}
                    className='bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700 transition-colors'
                  >
                    Capture still
                  </button>
                  <button
                    onClick={handleStop}
                    className='bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors'
                  >
                    Stop
                  </button>
                </>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className='bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors'
              >
                Load still
              </button>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={(event) => void handleLoadStill(event.target.files?.[0])}
              />
              {locked && (
                <button
                  onClick={() => void handleScanAgain()}
                  className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors'
                >
                  Scan again
                </button>
              )}
              {consoleOpen ? null : (
                <button
                  onClick={() => setConsoleOpen(true)}
                  className='bg-gray-800 text-white px-6 py-2 rounded-md hover:bg-gray-900 transition-colors'
                >
                  Dev console
                </button>
              )}
            </div>
          </div>

          <div className='flex flex-col'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Output</h2>
            {error && (
              <div className='flex items-center justify-center min-h-[200px] text-red-600 text-center px-4'>
                {error}
              </div>
            )}
            {!error && !result && (
              <div className='flex items-center justify-center min-h-[200px] text-gray-400 text-center px-4'>
                Point the camera at a Reduced-QR code. It does not need to fill the square.
              </div>
            )}
            {result && (
              <div className='flex flex-col space-y-4'>
                <div className='bg-gray-50 p-3 rounded-md border border-gray-200 min-h-[8rem]'>
                  <p className='text-gray-800 break-all whitespace-pre-wrap'>{result.text}</p>
                </div>
                <div className='flex gap-2 justify-center items-center text-gray-700'>
                  <p className='w-fit'>v{result.version}</p>
                  <p className='w-fit'>
                    {result.gridSize}x{result.gridSize}
                  </p>
                  <p className='w-fit'>
                    {result.cellsUsed}/{result.cellsAvailable} cells
                  </p>
                  <p className='w-fit'>backup {result.backupLevel.toFixed(2)}×</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DevConsole
          open={consoleOpen}
          logs={logs}
          onClose={() => setConsoleOpen(false)}
          onClear={() => {
            logsRef.current = [];
            setLogs([]);
          }}
        />
        <canvas ref={canvasRef} className='hidden' />
      </div>
    </div>
  );
}
