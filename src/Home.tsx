import { useState } from 'react';
import { QrCode } from './components/QRCode';

function Home() {
  const [input, setInput] = useState<string>('');
  const [generated, setGenerated] = useState<string>('');

  const handleGenerate = () => {
    setGenerated(input);
  };

  const handleClear = () => {
    setInput('');
    setGenerated('');
  };

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center p-4 text-black'>
      <div className='w-full bg-white rounded-lg shadow-lg p-6'>
        <h1 className='text-3xl font-bold text-center text-gray-800 mb-6'>
          Generate Reduced-QR Code
        </h1>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div className='flex flex-col'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Input</h2>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Enter text to compress...'
              className='border border-gray-300 p-3 rounded-md w-full h-48 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
            />
            <div className='flex mt-4'>
              <button
                onClick={handleGenerate}
                disabled={!input}
                className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
              >
                Generate
              </button>
              <button
                onClick={handleClear}
                className='ml-4 bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors'
              >
                Clear
              </button>
            </div>
          </div>

          <QrCode data={generated} version={1} width={500} height={500} />
        </div>
      </div>
    </div>
  );
}

export default Home;
