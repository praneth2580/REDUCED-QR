import React from "react";
import { useState } from "react";

function BitFileLoader() {
  const [textContent, setTextContent] = useState<string>("");
  const [headerText, setHeaderText] = useState<string>("");

  // Convert a Uint8Array back into "0/1" string
  const unpackBits = (bytes: Uint8Array): string => {
    const bitString = Array.from(bytes)
      .map((byte) => byte.toString(2).padStart(8, "0"))
      .join("");
    return bitString;
  };

  const stringToBitString = (str: string): string => {
    return Array.from(str)
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
      .join("");
  };

  const bitStringToString = (bitString: string): string => {
    let result = "";
    // Ensure the bitString length is a multiple of 8
    const cleanBitString = bitString.slice(0, Math.floor(bitString.length / 8) * 8);
    for (let i = 0; i < cleanBitString.length; i += 8) {
      const byte = cleanBitString.slice(i, i + 8);
      result += String.fromCharCode(parseInt(byte, 2));
    }
    return result;
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      const restoredBitString = unpackBits(bytes);
      
      const SEPARATOR = "---GEMINI-SEPARATOR---";
      const separatorBitString = stringToBitString(SEPARATOR);
      const separatorIndex = restoredBitString.indexOf(separatorBitString);

      if (separatorIndex !== -1) {
        const headerBitString = restoredBitString.substring(0, separatorIndex);
        const contentBitString = restoredBitString.substring(separatorIndex + separatorBitString.length);
        
        setHeaderText(bitStringToString(headerBitString));
        setTextContent(contentBitString);
      } else {
        setHeaderText("");
        setTextContent(restoredBitString);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-black">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Bit File Loader
        </h1>

        <div className="mb-4">
          <label htmlFor="fileInput" className="block text-gray-700 text-sm font-bold mb-2">
            Select a .bin file to load:
          </label>
          <input type="file" id="fileInput" accept=".bin" onChange={handleLoad} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
        </div>

        {headerText && (
            <div className="mt-6">
                <label htmlFor="headerOutput" className="block text-gray-700 text-sm font-bold mb-2">
                    Header Text:
                </label>
                <textarea
                    id="headerOutput"
                    value={headerText}
                    readOnly
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"
                />
            </div>
        )}

        <div className="mt-6">
            <label htmlFor="bitOutput" className="block text-gray-700 text-sm font-bold mb-2">
                Extracted Bit String:
            </label>
            <textarea
                id="bitOutput"
                value={textContent}
                readOnly
                placeholder="Your extracted bit string will appear here..."
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-48"
            />
        </div>
      </div>
    </div>
  );
}

export default BitFileLoader;