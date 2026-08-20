export function Table({
  headers,
  rows,
  empty = 'No records',
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-neutral-400">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-neutral-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}