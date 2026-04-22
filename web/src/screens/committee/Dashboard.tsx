import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { BudgetHistoryEntry, BudgetSummary, Family } from '../../types';

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

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

export default function Dashboard() {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [recentNotes, setRecentNotes] = useState<Array<{
    id: number; content: string; user_name: string; created_at: string;
    entity_type: string; family_name: string | null; family_id: number | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filter, setFilter] = useState('');
  const [historyMonths, setHistoryMonths] = useState(12);
  const [history, setHistory] = useState<BudgetHistoryEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(['solicitud', 'formulario_enviado', 'formulario_completado', 'agendado', 'en_definicion'])
  );

  useEffect(() => {
    Promise.all([
      api.getBudgetSummary().catch(() => null),
      api.getFamilies().catch(() => []),
      api.getUpcomingInterviews().catch(() => []),
      api.getRecentComments().catch(() => []),
      api.getBudgetHistory(12).catch(() => []),
    ]).then(([b, f, i, notes, historyData]) => {
      setBudget(b);
      setFamilies(f);
      setInterviews(i);
      setRecentNotes(notes);
      setHistory(historyData);
    })
      .finally(() => setLoading(false));
  }, []);

  const changeHistoryRange = async (months: number) => {
    if (months === historyMonths) return;
    setHistoryMonths(months);
    setLoadingHistory(true);
    try {
      const rows = await api.getBudgetHistory(months);
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

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

  const filteredFamilies = families
    .filter((f) => {
      const matchesName = !filter || f.name.toLowerCase().includes(filter.toLowerCase());
      const matchesStatus = statusFilter.size === 0 || statusFilter.has(f.status);
      return matchesName && matchesStatus;
    })
    .sort((a, b) => {
      const statusA = STATUS_ORDER[a.status] ?? 9;
      const statusB = STATUS_ORDER[b.status] ?? 9;
      if (statusA !== statusB) return statusA - statusB;
      const discA = Number(a.discount_percentage ?? 0);
      const discB = Number(b.discount_percentage ?? 0);
      if (discA !== discB) return discB - discA;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      {/* Métricas de presupuesto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Presupuesto total</p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">{formatMoney(budget.total_budget)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-green-600 mb-1">Otorgado</p>
          <p className="text-2xl font-semibold text-green-700 tabular-nums">{formatMoney(budget.granted_assigned)}</p>
          <p className="text-sm text-gray-500 mt-1 tabular-nums">{budget.assigned_percentage.toFixed(0)}%</p>
          <p className="text-xs text-gray-400 mt-1 tabular-nums">{budget.families_assigned} familias</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-amber-600 mb-1">En definición</p>
          <p className="text-2xl font-semibold text-amber-600 tabular-nums">{formatMoney(budget.granted_in_definition)}</p>
          <p className="text-sm text-gray-500 mt-1 tabular-nums">{budget.in_definition_percentage.toFixed(0)}%</p>
          <p className="text-xs text-gray-400 mt-1 tabular-nums">{budget.families_in_definition} familias</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Disponible</p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">{formatMoney(budget.available)}</p>
          <p className="text-sm text-gray-500 mt-1 tabular-nums">{budget.available_percentage.toFixed(0)}%</p>
          <p className="text-xs text-gray-400 mt-1 tabular-nums">{budget.families_pending} familias</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-5 space-y-4">
          <div>
            <p className="text-sm text-green-700">Familias con acuerdo otorgado</p>
            <p className="text-2xl font-semibold text-green-800 tabular-nums">{budget.families_assigned}</p>
          </div>
          <div className="pt-3 border-t border-green-200">
            <p className="text-sm text-green-700">Alumnos impactados</p>
            <p className="text-2xl font-semibold text-green-800 tabular-nums">{budget.students_assigned}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-900">Evolución de altas y bajas</h2>
          <div className="ml-auto flex gap-1.5">
            {[12, 24, 36, 60].map((months) => (
              <button
                key={months}
                onClick={() => { void changeHistoryRange(months); }}
                className={`px-2.5 py-1 text-xs rounded-full border ${
                  historyMonths === months
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {months}m
              </button>
            ))}
          </div>
        </div>
        {loadingHistory ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Cargando evolución...</p>
        ) : history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin datos históricos.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Mes</th>
                <th className="px-4 py-3 font-medium text-right">Altas</th>
                <th className="px-4 py-3 font-medium text-right">Bajas</th>
                <th className="px-4 py-3 font-medium text-right">% presupuesto (altas)</th>
                <th className="px-4 py-3 font-medium text-right">% presupuesto (bajas)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.month} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(`${row.month}-01`).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-700">
                    {row.families_joined} fam. - {formatMoney(row.amount_joined)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-red-600">
                    {row.families_dropped} fam. - {formatMoney(row.amount_dropped)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {row.joined_percentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {row.dropped_percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Barra de progreso por estado */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            {budget.families_assigned} otorgados ({budget.assigned_percentage.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            {budget.families_in_definition} en definición ({budget.in_definition_percentage.toFixed(0)}%)
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
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-gray-900">Familias</h2>
            <input
              type="text"
              placeholder="Buscar familia..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <span className="ml-auto text-xs text-gray-400">{filteredFamilies.length} familias</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                const allKeys = Object.keys(STATUS_LABELS);
                setStatusFilter((prev) => prev.size === allKeys.length ? new Set() : new Set(allKeys));
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                statusFilter.size === Object.keys(STATUS_LABELS).length || statusFilter.size === 0
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              Todos
            </button>
            {Object.entries(STATUS_LABELS).map(([key, { label, className }]) => {
              const active = statusFilter.has(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    setStatusFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    });
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
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Familia</th>
              <th className="px-4 py-3 font-medium">Hijos</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Entrevista</th>
              <th className="px-4 py-3 font-medium text-right">% Descuento</th>
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
                      <Link to={`/familias/${family.id}`} className="text-sm font-medium text-gray-900 hover:underline">
                        {family.name}
                      </Link>
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
