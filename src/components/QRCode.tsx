import { useEffect, useRef } from 'react';
import versions from '../versions.json';
import { Button } from './Button';
import { calibrationSize, encode } from '../encoders/rqr/v1.encoder';

interface QrCodeProps {
  data: string;
  version: number;
  width: number | undefined;
  height: number | undefined;
}

const gridSizes: any = {
  1: versions['1'].gridSize,
};

const versionWiseEncoders: any = {
  1: encode,
};

const versionWiseCalibrationSize: any = {
  1: calibrationSize,
};

export function QrCode({
  data,
  version,
  width = 100,
  height = 100,
}: QrCodeProps) {
  if (!data || data === '' || !version || !width || !height) {
    console.error('Invalid props');
    return <></>;
  }

  const gridSizesThatFitDat = gridSizes[version].filter(
    (value: number) => value * value > data.length + versionWiseCalibrationSize[version]
  );

  if (gridSizesThatFitDat.length === 0) {
    console.error('Data size is to large');
    return <></>;
  }

  const grid = gridSizesThatFitDat[0];

  const colorEncodedGrid = versionWiseEncoders[version](grid, data);

  let canvasRef = useRef<HTMLCanvasElement>(null);

  const drawQrCode = (ctx: CanvasRenderingContext2D) => {
    try {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      const cellSize = Math.min(width, height) / grid;

      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          // const colorIndex = r * grid + c;
          // if (colorIndex < data.length) {
          //   ctx.fillStyle = data[colorIndex].toString();
          //   ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          // }
          const color = colorEncodedGrid[r][c];
          if (color) {
            ctx.fillStyle = color.toString();
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        }
      }
    } catch (error) {
      alert(error);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawQrCode(ctx);
  }, [canvasRef]);

  return (
    <div className='flex flex-col items-center justify-center'>
      
      <canvas ref={canvasRef} width={width} height={height} />
      <div className='flex gap-2 justify-center items-center mt-4 text-gray-700'>
        <p className='w-fit'>
          v{version}
        </p>
        <p className='w-fit'>
          {grid}x{grid}
        </p>
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
                      console.log('Shared successfully');
                    } catch (error) {
                      console.error('Error sharing:', error);
                    }
                  } else {
                    alert('Web Share API is not supported in your browser or for these files.');
                  }
                }
              }, 'image/png');
            }
          }} text='Share' />
      </div>
    </div>
  );
}
