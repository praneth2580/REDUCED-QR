import { useState } from 'react';
import { huffmanWordEncode, huffmanWordDecode } from '../encoders/huffman.word.encoders';
import { ComparisonTable } from '../components/ComparisonTable';
import { CopyButton } from '../components/CopyButton';
import { Modal } from '../components/Modal';

function AllInOneDemoUI() {
  const [input, setInput] = useState<string>('');
  const [encoded, setEncoded] = useState<string>('');
  const [decoded, setDecoded] = useState<string>('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(true);
  const encoders = {
    huffman: huffmanWordEncode,
  }

  const handleEncode = () => {
    if (!input) return;
    const { encoded, codes } = huffmanWordEncode(input);
    setEncoded(encoded);
    setCodes(codes);
    setDecoded(huffmanWordDecode(encoded, codes));
  };

  const handleClear = () => {
    setInput('');
    setEncoded('');
    setDecoded('');
    setCodes({});
  };

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center p-4 text-black'>
      <div className='w-full max-w-4xl bg-white rounded-lg shadow-lg p-6'>
        <h1 className='text-3xl font-bold text-center text-gray-800 mb-6'>
          Huffman Word Compression Demo
        </h1>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Input Section */}
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
                onClick={handleEncode}
                disabled={!input}
                className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
              >
                Compress
              </button>
              <button
                onClick={handleClear}
                className='ml-4 bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors'
              >
                Clear
              </button>
            </div>
          </div>

          {/* Output Section */}
          <div className='flex flex-col space-y-4'>
            {/* Encoded Output */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className='text-xl font-semibold text-gray-700 mb-2'>Encoded (Compressed)</h2>
                {encoded && <CopyButton textToCopy={encoded} />}
              </div>
              <div className='bg-gray-50 p-3 rounded-md border border-gray-200 min-h-[6rem]'>
                <p className='text-gray-800 break-all'>{encoded || '...'}</p>
              </div>
            </div>

            {/* Decoded Output */}
            <div>
              <h2 className='text-xl font-semibold text-gray-700 mb-2'>Decoded (Original)</h2>
              <div className='bg-gray-50 p-3 rounded-md border border-gray-200 min-h-[6rem]'>
                <p className='text-gray-800 break-all'>{decoded || '...'}</p>
              </div>
            </div>
          </div>
        </div>

        {encoded && <ComparisonTable originalText={input} encodedText={encoded} />}

        {/* Huffman Codes Table */}
        {Object.keys(codes).length > 0 && (
          <div className='mt-6'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Huffman Codes</h2>
            <div className='overflow-x-auto'>
              <table className='min-w-full bg-white border border-gray-200'>
                <thead>
                  <tr className='bg-gray-100'>
                    <th className='py-2 px-4 border-b'>Word</th>
                    <th className='py-2 px-4 border-b'>Code</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(codes).map(([word, code]) => (
                    <tr key={word} className='text-center'>
                      <td className='py-2 px-4 border-b'>'{word}'</td>
                      <td className='py-2 px-4 border-b font-mono'>{code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {/* <Modal isOpen={modalOpen} onClose={handleClear}> 

      </Modal> */}
    </div>
  );
}

export default AllInOneDemoUI;
