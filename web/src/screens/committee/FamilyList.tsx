import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import type { Family } from '../../types';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

type SortKey = 'name' | 'student_count' | 'status' | 'discount' | 'total_discount' | 'interview';
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

export default function FamilyList() {
  const { can } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'familia' | 'docente'>('todos');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(['solicitud', 'formulario_enviado', 'formulario_completado', 'agendado', 'en_definicion'])
  );
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    api.getFamilies().then(setFamilies).finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'discount' || key === 'total_discount' ? 'desc' : 'asc');
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  const filtered = families
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
        case 'student_count':
          return ((a.student_count ?? 0) - (b.student_count ?? 0)) * dir;
        case 'status': {
          const sa = STATUS_ORDER[a.status] ?? 9;
          const sb = STATUS_ORDER[b.status] ?? 9;
          if (sa !== sb) return (sa - sb) * dir;
          return a.name.localeCompare(b.name);
        }
        case 'discount':
          return (Number(a.discount_percentage ?? 0) - Number(b.discount_percentage ?? 0)) * dir;
        case 'total_discount':
          return (Number(a.total_discount ?? 0) - Number(b.total_discount ?? 0)) * dir;
        case 'interview': {
          const da = a.interview_date ? new Date(a.interview_date).getTime() : 0;
          const db = b.interview_date ? new Date(b.interview_date).getTime() : 0;
          return (da - db) * dir;
        }
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Familias</h1>
        {can('canManageFamilies') && (
          <Link to="/familias/nueva"
            className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            + Nueva familia
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <div className="flex gap-1">
              {(['todos', 'familia', 'docente'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
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
            <span className="ml-auto text-xs text-gray-400">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => {
                const allKeys = Object.keys(STATUS_LABELS);
                setStatusFilter((prev) => prev.size === allKeys.length ? new Set() : new Set(allKeys));
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                statusFilter.size === Object.keys(STATUS_LABELS).length
                  ? 'bg-gray-900 text-white border-gray-900'
                  : statusFilter.size === 0
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
                      if (next.has(key)) {
                        next.delete(key);
                      } else {
                        next.add(key);
                      }
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
              <SortHeader label="Familia" sortKey="name" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Hijos" sortKey="student_count" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Estado" sortKey="status" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Entrevista" sortKey="interview" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="% Descuento" sortKey="discount" current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
              <SortHeader label="Descuento mensual" sortKey="total_discount" current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No se encontraron familias
                </td>
              </tr>
            ) : (
              filtered.map((family) => {
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
                      {family.parent_names && (
                        <p className="text-xs text-gray-400">{family.parent_names}</p>
                      )}
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
                      {family.discount_percentage ? `${Number(family.discount_percentage).toFixed(0)}%` : '—'}
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
