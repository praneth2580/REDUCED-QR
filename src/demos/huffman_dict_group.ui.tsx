import { useState } from 'react';
import { huffmanEncode } from '../encoders/huffman.encoders';
import { ComparisonTable } from '../components/ComparisonTable';
import { CopyButton } from '../components/CopyButton';
import { dictionaryGroupEncode } from '../encoders/dictionary.group.encoders';

function HuffmanDictionaryDemoUI() {
  const [input, setInput] = useState<string>('');
  const [encoded, setEncoded] = useState<string>('');
  const [decoded, setDecoded] = useState<string>('');
  const [codes, setCodes] = useState<Record<string, string> | undefined>({});
  const [dictionary, setDictionary] = useState<string[] | undefined>([]);
  const [groupSize, setGroupSize] = useState<number>(3);

  const handleEncode = () => {
    if (!input) return;
    const { encoded: huffman_encoded, codes } = huffmanEncode(input);
    // setEncoded(huffman_encoded);
    setCodes(codes);
    // setDecoded(huffmanDecode(huffman_encoded, codes));
    let { encoded, dictionary } = dictionaryGroupEncode(huffman_encoded, groupSize);
    encoded = encoded.replaceAll(" ", "");
    setEncoded(encoded);
    setDictionary(dictionary);
    // setDecoded(dictionaryGroupDecode(encoded, dictionary));
  };

  const handleClear = () => {
    setInput('');
    setEncoded('');
    setDecoded('');
    setCodes({});
    setDictionary([]);
  };

  return (
    <div className='min-h-screen bg-gray-100 flex items-center justify-center p-4 text-black'>
      <div className='w-full max-w-4xl bg-white rounded-lg shadow-lg p-6'>
        <h1 className='text-3xl font-bold text-center text-gray-800 mb-6'>
          Huffman {"->"} Dictionary (GROUP) Compression Demo
        </h1>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Input Section */}
          <div className='flex flex-col'>
            <div className="flex items-center mb-4">
              <label htmlFor="groupSize" className="mr-2 font-semibold text-gray-700">Group Size:</label>
              <input 
                type="number" 
                id="groupSize" 
                value={groupSize} 
                onChange={(e) => setGroupSize(parseInt(e.target.value, 10))} 
                className="border border-gray-300 p-2 rounded-md w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
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
        {codes ?Object.keys(codes).length > 0 && (
          <div className='mt-6'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Huffman Codes</h2>
            <div className='overflow-x-auto'>
              <table className='min-w-full bg-white border border-gray-200'>
                <thead>
                  <tr className='bg-gray-100'>
                    <th className='py-2 px-4 border-b'>Character</th>
                    <th className='py-2 px-4 border-b'>Code</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(codes).map(([char, code]) => (
                    <tr key={char} className='text-center'>
                      <td className='py-2 px-4 border-b'>'{char}'</td>
                      <td className='py-2 px-4 border-b font-mono'>{code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <></>}
        {dictionary && dictionary.length > 0 && (
          <div className='mt-6'>
            <h2 className='text-xl font-semibold text-gray-700 mb-2'>Dictionary</h2>
            <div className='overflow-x-auto'>
              <table className='min-w-full bg-white border border-gray-200'>
                <thead>
                  <tr className='bg-gray-100'>
                    <th className='py-2 px-4 border-b'>Index</th>
                    <th className='py-2 px-4 border-b'>Group</th>
                  </tr>
                </thead>
                <tbody>
                  {dictionary && dictionary.map((group, index) => (
                    <tr key={index} className='text-center'>
                      <td className='py-2 px-4 border-b'>{index}</td>
                      <td className='py-2 px-4 border-b'>'{group}'</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HuffmanDictionaryDemoUI;
