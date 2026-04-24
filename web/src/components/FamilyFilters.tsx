type FamilyTypeFilter = 'todos' | 'familia' | 'docente';

interface StatusLabelConfig {
  label: string;
  className: string;
}

interface FamilyFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  statusLabels: Record<string, StatusLabelConfig>;
  statusFilter: Set<string>;
  onStatusFilterChange: (next: Set<string>) => void;
  typeFilter: FamilyTypeFilter;
  onTypeFilterChange: (next: FamilyTypeFilter) => void;
  searchPlaceholder?: string;
}

export default function FamilyFilters({
  search,
  onSearchChange,
  resultCount,
  statusLabels,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  searchPlaceholder = 'Buscar...',
}: FamilyFiltersProps) {
  const allStatusKeys = Object.keys(statusLabels);
  const allSelected = statusFilter.size === allStatusKeys.length;

  const toggleAll = () => {
    if (allSelected) {
      onStatusFilterChange(new Set());
      return;
    }
    onStatusFilterChange(new Set(allStatusKeys));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <div className="flex gap-1">
          {(['todos', 'familia', 'docente'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeFilterChange(t)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                typeFilter === t
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'familia' ? 'Familias' : 'Docentes'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onTypeFilterChange('todos');
            onStatusFilterChange(new Set());
            onSearchChange('');
          }}
          className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 text-gray-500 hover:border-gray-300"
        >
          Limpiar
        </button>
        <span className="ml-auto text-xs text-gray-400">{resultCount}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={toggleAll}
          className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
            allSelected
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          Todos
        </button>
        {Object.entries(statusLabels).map(([key, { label, className }]) => {
          const active = statusFilter.has(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => {
                const next = new Set(statusFilter);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                onStatusFilterChange(next);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                active
                  ? `${className} border-current`
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
