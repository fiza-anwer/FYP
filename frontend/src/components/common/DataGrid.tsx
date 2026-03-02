import React from "react";

export type DataGridColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Custom cell renderer. Receives cell value and full row. */
  render?: (value: unknown, row: T) => React.ReactNode;
};

type DataGridProps<T> = {
  columns: DataGridColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  /** When set, adds a checkbox column and calls onSelectionChange when selection changes */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
};

const thClass =
  "px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-600 uppercase dark:text-gray-300";
const tdClass = "px-4 py-3 text-sm text-gray-800 dark:text-gray-200";
const trBorder = "border-b border-gray-200 last:border-b-0 dark:border-gray-700";

function DataGrid<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data.",
  loading = false,
  className = "",
  selectable = false,
  selectedIds = [],
  onSelectionChange,
}: DataGridProps<T>) {
  const set = new Set(selectedIds);
  const allSelected = data.length > 0 && data.every((row) => set.has(keyExtractor(row)));
  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) onSelectionChange([]);
    else onSelectionChange(data.map((row) => keyExtractor(row)));
  };
  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    if (set.has(id)) onSelectionChange(selectedIds.filter((x) => x !== id));
    else onSelectionChange([...selectedIds, id]);
  };

  return (
    <div
      className={
        "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/50 " +
        className
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {selectable && (
                <th className={thClass + " w-10"}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={
                    thClass +
                    (col.align === "right" ? " text-right" : col.align === "center" ? " text-center" : "")
                  }
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const id = keyExtractor(row);
                return (
                <tr
                  key={id}
                  className={"bg-white dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/50 " + trBorder}
                >
                  {selectable && (
                    <td className={tdClass}>
                      <input
                        type="checkbox"
                        checked={set.has(id)}
                        onChange={() => toggleOne(id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const value = (row as Record<string, unknown>)[col.key];
                    const content = col.render ? col.render(value, row) : (value as React.ReactNode);
                    return (
                      <td
                        key={col.key}
                        className={
                          tdClass +
                          (col.align === "right" ? " text-right" : col.align === "center" ? " text-center" : "")
                        }
                      >
                        {content ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataGrid;
