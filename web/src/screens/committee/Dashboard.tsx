import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { BudgetSummary, Family } from '../../types';
import { formatMoney } from '../../utils/format';
import FamilyFilters from '../../components/FamilyFilters';

function formatInterviewShort(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (isToday) return `Hoy ${time}`;
  if (isTomorrow) return `Mañana ${time}`;
  return `${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })} ${time}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR');
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  solicitud: { label: 'Solicitud', className: 'bg-purple-50 text-purple-700' },
  formulario_enviado: { label: 'Form. enviado', className: 'bg-violet-50 text-violet-700' },
  formulario_completado: { label: 'Form. completado', className: 'bg-indigo-50 text-indigo-700' },
  agendado: { label: 'Entrevista', className: 'bg-blue-50 text-blue-700' },
  en_definicion: { label: 'En definición', className: 'bg-amber-50 text-amber-700' },
  otorgado: { label: 'Otorgado', className: 'bg-green-50 text-green-700' },
  rechazado: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
  suspendido: { label: 'Vencido', className: 'bg-gray-100 text-gray-500' },
};

interface Interview {
  id: number;
  name: string;
  parent_names: string | null;
  interview_date: string;
  status: string;
}

type SortKey = 'name' | 'status' | 'discount';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, sortKey, current, direction, onSort, align }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'right';
}) {
  const active = current === sortKey;
  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-900 transition-colors ${align === 'right' ? 'text-right' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && active && (
          <span className="text-gray-400">{direction === 'asc' ? '↑' : '↓'}</span>
        )}
        {label}
        {align !== 'right' && active && (
          <span className="text-gray-400">{direction === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );
}

export default function Dashboard() {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [recentNotes, setRecentNotes] = useState<Array<{
    id: number; content: string; user_name: string; created_at: string;
    entity_type: string; family_name: string | null; family_id: number | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'familia' | 'docente'>('todos');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(['solicitud', 'formulario_enviado', 'formulario_completado', 'agendado', 'en_definicion'])
  );
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    Promise.all([
      api.getBudgetSummary().catch(() => null),
      api.getFamilies().catch(() => []),
      api.getUpcomingInterviews().catch(() => []),
      api.getRecentComments().catch(() => []),
    ]).then(([b, f, i, notes]) => {
      setBudget(b);
      setFamilies(f);
      setInterviews(i);
      setRecentNotes(notes);
    })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;
  }

  if (!budget) {
    return <p className="text-sm text-gray-500 py-8 text-center">No hay período activo configurado.</p>;
  }

  const STATUS_ORDER: Record<string, number> = {
    solicitud: 0,
    formulario_enviado: 1,
    formulario_completado: 2,
    agendado: 3,
    en_definicion: 4,
    otorgado: 5,
    rechazado: 6,
    suspendido: 7,
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'discount' ? 'desc' : 'asc');
  };

  const filteredFamilies = families
    .filter((f) => {
      const matchesName = !filter || f.name.toLowerCase().includes(filter.toLowerCase());
      const matchesType = typeFilter === 'todos' || (f.family_type ?? 'familia') === typeFilter;
      const matchesStatus = statusFilter.size === 0 || statusFilter.has(f.status);
      return matchesName && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'status': {
          const statusA = STATUS_ORDER[a.status] ?? 9;
          const statusB = STATUS_ORDER[b.status] ?? 9;
          if (statusA !== statusB) return (statusA - statusB) * dir;
          return a.name.localeCompare(b.name);
        }
        case 'discount':
          return (Number(a.discount_percentage ?? 0) - Number(b.discount_percentage ?? 0)) * dir;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Barra de presupuesto por estado */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            {budget.families_assigned} otorgados ({budget.assigned_percentage.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            {budget.families_in_definition} en proceso ({budget.in_definition_percentage.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
            {budget.available_percentage.toFixed(0)}% disponible
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${budget.assigned_percentage}%` }}
          />
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${budget.in_definition_percentage}%` }}
          />
          <div
            className="h-full bg-gray-300 flex-1"
          />
        </div>
      </div>

      {/* Próximas entrevistas */}
      {interviews.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Próximas entrevistas</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {interviews.map((interview) => {
              const date = new Date(interview.interview_date);
              const isToday = date.toDateString() === new Date().toDateString();
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const isTomorrow = date.toDateString() === tomorrow.toDateString();
              const isPast = date < new Date();

              const dateLabel = isToday
                ? 'Hoy'
                : isTomorrow
                  ? 'Mañana'
                  : date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });

              const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

              return (
                <Link key={interview.id} to={`/familias/${interview.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <span className={`text-sm font-medium min-w-[56px] ${isPast ? 'text-gray-400' : isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                    {dateLabel} {time}
                  </span>
                  <span className="text-sm text-gray-900">{interview.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimas notas agrupadas por familia */}
      {recentNotes.length > 0 && (() => {
        const grouped: Array<{
          family_id: number; family_name: string;
          notes: typeof recentNotes;
        }> = [];
        const seen = new Set<number>();
        for (const note of recentNotes) {
          if (!note.family_id || !note.family_name) continue;
          if (!seen.has(note.family_id)) {
            seen.add(note.family_id);
            grouped.push({
              family_id: note.family_id,
              family_name: note.family_name,
              notes: recentNotes.filter((n) => n.family_id === note.family_id),
            });
          }
        }
        return grouped.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Actividad reciente</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {grouped.map((group) => (
                <div key={group.family_id} className="px-4 py-3">
                  <Link to={`/familias/${group.family_id}`}
                    className="text-sm font-medium text-gray-900 hover:underline">
                    {group.family_name}
                  </Link>
                  <div className="mt-1.5 space-y-1.5">
                    {group.notes.map((note) => (
                      <div key={note.id} className="flex gap-2 items-baseline">
                        <span className="text-xs text-gray-400 shrink-0 w-16">{timeAgo(note.created_at)}</span>
                        <span className="text-xs text-gray-500 shrink-0">{note.user_name}:</span>
                        <p className="text-sm text-gray-600 line-clamp-1">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Filtros y tabla de familias */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Familias</h2>
          <FamilyFilters
            search={filter}
            onSearchChange={setFilter}
            resultCount={filteredFamilies.length}
            statusLabels={STATUS_LABELS}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            searchPlaceholder="Buscar familia..."
          />
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <SortHeader label="Familia" sortKey="name" current={sortKey} direction={sortDir} onSort={handleSort} />
              <th className="px-4 py-3 font-medium">Hijos</th>
              <SortHeader label="Estado" sortKey="status" current={sortKey} direction={sortDir} onSort={handleSort} />
              <th className="px-4 py-3 font-medium">Entrevista</th>
              <SortHeader label="% Descuento" sortKey="discount" current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
              <th className="px-4 py-3 font-medium text-right">Cuota total</th>
              <th className="px-4 py-3 font-medium text-right">Descuento mensual</th>
            </tr>
          </thead>
          <tbody>
            {filteredFamilies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No se encontraron familias
                </td>
              </tr>
            ) : (
              filteredFamilies.map((family) => {
                const status = STATUS_LABELS[family.status] ?? STATUS_LABELS.solicitud;
                return (
                  <tr key={family.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link to={`/familias/${family.id}`} className="text-sm font-medium text-gray-900 hover:underline">
                          {family.name}
                        </Link>
                        {(family.family_type ?? 'familia') === 'docente' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-sky-50 text-sky-600">
                            Docente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{family.student_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {family.interview_date ? formatInterviewShort(family.interview_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {family.discount_percentage ? `${family.discount_percentage}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {family.total_tuition ? formatMoney(family.total_tuition) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {family.total_discount ? formatMoney(family.total_discount) : '—'}
                    </td>
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
