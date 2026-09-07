import { useState } from 'react';
import { decodeFromImageSource, type RqrDecodeResult } from '../encoders/rqr/v1.decoder';

function QrDecoder() {
  const [preview, setPreview] = useState<string>('');
  const [result, setResult] = useState<RqrDecodeResult | null>(null);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    if (preview) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const decoded = await decodeFromImageSource(file);
      setResult(decoded);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Failed to decode RQR image.');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setResult(null);
    setError('');
  };

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center p-4 text-black'>
      <div className='w-full bg-white rounded-lg shadow-lg p-6'>
        <h1 className='text-3xl font-bold text-center text-gray-800 mb-6'>
          Decode Reduced-QR Code
        </h1>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='flex flex-col'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Image</h2>
            <label className='border border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:border-blue-400 transition-colors'>
              <input
                type='file'
                accept='image/*'
                className='hidden'
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {preview ? (
                <img src={preview} alt='RQR to decode' className='mx-auto max-h-64 object-contain' />
              ) : (
                <span className='text-gray-500'>Choose a generated RQR PNG</span>
              )}
            </label>
            <div className='flex mt-4'>
              <button
                onClick={handleClear}
                className='bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors'
              >
                Clear
              </button>
              {busy && <p className='ml-4 self-center text-gray-500'>Decoding…</p>}
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
              <div className='flex items-center justify-center min-h-[200px] text-gray-400 text-center'>
                Upload a downloaded RQR image
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
      </div>
    </div>
  );
}

export default QrDecoder;
