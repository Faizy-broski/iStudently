import { DataTableColumn } from "@/types/index";

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyField?: keyof T;
  emptyText?: string;
}

export default function DataTable<T>({
  data,
  columns,
  keyField,
  emptyText = "No records found",
}: DataTableProps<T>) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500">No records found.</p>;
  }

  // const columns = Object.keys(data[0]);

  return (
    // <div className="overflow-auto border rounded">
    //   <table className="w-full text-sm">
    //     <thead className="bg-gray-100">
    //       <tr>
    //         {columns.map((c) => (
    //           <th key={c} className="text-left px-3 py-2">
    //             {c}
    //           </th>
    //         ))}
    //       </tr>
    //     </thead>
    //     <tbody>
    //       {data.map((row, i) => (
    //         <tr key={i} className="border-t">
    //           {columns.map((c) => (
    //             <td key={c} className="px-3 py-2">
    //               {String(row[c] ?? "")}
    //             </td>
    //           ))}
    //         </tr>
    //       ))}
    //     </tbody>
    //   </table>
    // </div>
    <div className="overflow-auto border rounded">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left px-3 py-2 font-medium ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={
                keyField
                  ? String(row[keyField])
                  : rowIndex
              }
              className="border-t hover:bg-gray-50"
            >
              {columns.map((col) => {
                const value = col.accessor
                  ? col.accessor(row)
                  : (row as any)[col.key];

                return (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${col.className ?? ''}`}
                  >
                    {col.render
                      ? col.render(value, row)
                      : String(value ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
