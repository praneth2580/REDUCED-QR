import { useEffect, useRef, useState } from 'react';
import { tryDecodeFromImageData, type RqrDecodeResult } from '../encoders/rqr/v1.decoder';
import { cropViewfinder } from '../encoders/rqr/viewfinder';

const SCAN_INTERVAL_MS = 120;
const MATCHES_TO_LOCK = 2;
const CROP_SIZE = 512;

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

export default function QrLiveScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const lastTextRef = useRef<string>('');
  const matchCountRef = useRef(0);
  const mountedRef = useRef(true);

  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState('Start the camera to scan');
  const [error, setError] = useState('');
  const [result, setResult] = useState<RqrDecodeResult | null>(null);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopCamera = () => {
    stopTimer();
    lockedRef.current = false;
    lastTextRef.current = '';
    matchCountRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setRunning(false);
  };

  const scanTick = () => {
    if (!mountedRef.current || lockedRef.current) return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (video && overlay && canvas && video.readyState >= 2) {
      try {
        const crop = cropViewfinder(video, overlay, canvas, CROP_SIZE);
        const decoded = tryDecodeFromImageData(crop);
        if (decoded?.text) {
          if (decoded.text === lastTextRef.current) {
            matchCountRef.current += 1;
          } else {
            lastTextRef.current = decoded.text;
            matchCountRef.current = 1;
          }
          if (matchCountRef.current >= MATCHES_TO_LOCK) {
            lockedRef.current = true;
            setLocked(true);
            setResult(decoded);
            setStatus('Locked');
            video.pause();
            stopTimer();
            return;
          }
        } else {
          lastTextRef.current = '';
          matchCountRef.current = 0;
        }
      } catch {
        lastTextRef.current = '';
        matchCountRef.current = 0;
      }
    }
    if (!mountedRef.current || lockedRef.current) return;
    timerRef.current = window.setTimeout(scanTick, SCAN_INTERVAL_MS);
  };

  const startCamera = async () => {
    setError('');
    setResult(null);
    setLocked(false);
    lockedRef.current = false;
    lastTextRef.current = '';
    matchCountRef.current = 0;
    stopTimer();

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
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      setRunning(true);
      setStatus('Align the RQR inside the square');
      timerRef.current = window.setTimeout(scanTick, SCAN_INTERVAL_MS);
    } catch (err) {
      stopCamera();
      setError(cameraErrorMessage(err));
      setStatus('Camera unavailable');
    }
  };

  const handleScanAgain = async () => {
    setResult(null);
    setLocked(false);
    lockedRef.current = false;
    lastTextRef.current = '';
    matchCountRef.current = 0;
    const video = videoRef.current;
    if (running && video?.srcObject) {
      await video.play();
      setStatus('Align the RQR inside the square');
      stopTimer();
      timerRef.current = window.setTimeout(scanTick, SCAN_INTERVAL_MS);
      return;
    }
    await startCamera();
  };

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center p-4 text-black'>
      <div className='w-full bg-white rounded-lg shadow-lg p-6'>
        <h1 className='text-3xl font-bold text-center text-gray-800 mb-6'>Live RQR Scan</h1>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='flex flex-col'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Viewfinder</h2>
            <div className='relative bg-black rounded-md overflow-hidden aspect-square w-full'>
              <video
                ref={videoRef}
                className='absolute inset-0 h-full w-full object-cover'
                playsInline
                muted
                autoPlay
              />
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
                <button
                  onClick={stopCamera}
                  className='bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors'
                >
                  Stop
                </button>
              )}
              {locked && (
                <button
                  onClick={() => void handleScanAgain()}
                  className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors'
                >
                  Scan again
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
                Point the viewfinder at a Reduced-QR code
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
        <canvas ref={canvasRef} className='hidden' />
      </div>
    </div>
  );
}
