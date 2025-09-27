interface ComparisonTableProps {
  originalText: string;
  encodedText: string;
}

export function ComparisonTable({ originalText, encodedText }: ComparisonTableProps) {
  const originalSize = new Blob([originalText]).size;
  // const encodedSize = new Blob([encodedText]).size;
  const encodedSize = (new Blob([encodedText]).size) /2;
  const improvement = originalSize > 0 ? ((originalSize - encodedSize) / originalSize) * 100 : 0;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Comparison</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border-b">Metric</th>
              <th className="py-2 px-4 border-b">Original</th>
              <th className="py-2 px-4 border-b">Encoded</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center">
              <td className="py-2 px-4 border-b">Size (bytes)</td>
              <td className="py-2 px-4 border-b">{originalSize}</td>
              <td className="py-2 px-4 border-b">{encodedSize}</td>
            </tr>
            <tr className="text-center">
              <td className="py-2 px-4 border-b">Improvement</td>
              <td colSpan={2} className="py-2 px-4 border-b font-bold text-green-600">
                {improvement.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
