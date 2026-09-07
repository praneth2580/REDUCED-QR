import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from './Button';
import { encode } from '../encoders/rqr/v1.encoder';

interface QrCodeProps {
  data: string;
  version: number;
  width: number | undefined;
  height: number | undefined;
}

const versionWiseEncoders: Record<number, typeof encode> = {
  1: encode,
};

export function QrCode({
  data,
  version,
  width = 100,
  height = 100,
}: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const result = useMemo(() => {
    if (!data || !version || !width || !height) {
      return { kind: 'empty' as const };
    }

    const encoder = versionWiseEncoders[version];
    if (!encoder) {
      return { kind: 'error' as const, message: `Unsupported RQR version ${version}.` };
    }

    try {
      return { kind: 'ok' as const, ...encoder(data) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate RQR code.';
      return { kind: 'error' as const, message };
    }
  }, [data, version, width, height]);

  const drawQrCode = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (result.kind !== 'ok') return;

      const { grid, gridSize } = result;
      const cellSize = Math.min(width, height) / gridSize;

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const color = grid[r][c];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        }
      }
    },
    [result, width, height]
  );

  const setCanvasRef = (canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (canvas) drawQrCode(canvas);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawQrCode(canvas);
  }, [drawQrCode]);

  if (result.kind === 'empty') {
    return (
      <div className='flex items-center justify-center min-h-[200px] text-gray-400 text-center'>
        Enter text and click Generate
      </div>
    );
  }

  if (result.kind === 'error') {
    return (
      <div className='flex items-center justify-center min-h-[200px] text-red-600 text-center px-4'>
        {result.message}
      </div>
    );
  }

  return (
    <div className='flex flex-col items-center justify-center'>
      <canvas ref={setCanvasRef} width={width} height={height} />
      <div className='flex gap-2 justify-center items-center mt-4 text-gray-700'>
        <p className='w-fit'>v{version}</p>
        <p className='w-fit'>
          {result.gridSize}x{result.gridSize}
        </p>
        <p className='w-fit'>
          {result.cellsUsed}/{result.cellsAvailable} cells
        </p>
        <p className='w-fit'>backup {result.backupLevel.toFixed(2)}×</p>
      </div>
      <div className='flex gap-2 justify-center items-center mt-4'>
        <Button
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) {
              const image = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.href = image;
              link.download = 'rqr-code.png';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
          text='Download'
        />
        <Button
          onClick={async () => {
            const canvas = canvasRef.current;
            if (canvas) {
              canvas.toBlob(async (blob) => {
                if (blob) {
                  const file = new File([blob], 'rqr-code.png', { type: 'image/png' });
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                      await navigator.share({
                        files: [file],
                        title: 'RQR Code',
                        text: 'Check out this RQR Code!',
                      });
                    } catch (error) {
                      console.error('Error sharing:', error);
                    }
                  } else {
                    alert('Web Share API is not supported in your browser or for these files.');
                  }
                }
              }, 'image/png');
            }
          }}
          text='Share'
        />
      </div>
    </div>
  );
}
