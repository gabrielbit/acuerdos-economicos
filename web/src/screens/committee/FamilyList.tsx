import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
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
  asignado: { label: 'Otorgado', className: 'bg-green-50 text-green-700' },
  en_definicion: { label: 'En definición', className: 'bg-amber-50 text-amber-700' },
  pendiente: { label: 'Pendiente', className: 'bg-purple-50 text-purple-700' },
  rechazado: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
  suspendido: { label: 'Vencido', className: 'bg-gray-100 text-gray-500' },
};

const STATUS_ORDER: Record<string, number> = {
  asignado: 0,
  en_definicion: 1,
  pendiente: 2,
  suspendido: 3,
  rechazado: 4,
};

type SortKey = 'name' | 'student_count' | 'status' | 'discount' | 'total_discount';
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
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
      const matchesStatus = !statusFilter || f.agreement_status === statusFilter;
      return matchesName && matchesStatus;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'student_count':
          return ((a.student_count ?? 0) - (b.student_count ?? 0)) * dir;
        case 'status': {
          const sa = STATUS_ORDER[a.agreement_status ?? 'pendiente'] ?? 9;
          const sb = STATUS_ORDER[b.agreement_status ?? 'pendiente'] ?? 9;
          if (sa !== sb) return (sa - sb) * dir;
          return a.name.localeCompare(b.name);
        }
        case 'discount':
          return (Number(a.discount_percentage ?? 0) - Number(b.discount_percentage ?? 0)) * dir;
        case 'total_discount':
          return (Number(a.total_discount ?? 0) - Number(b.total_discount ?? 0)) * dir;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Familias</h1>
        <Link to="/familias/nueva"
          className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
          + Nueva familia
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <input
            type="text"
            placeholder="Buscar familia..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Todos los estados</option>
            <option value="asignado">Otorgado</option>
            <option value="en_definicion">En definición</option>
            <option value="pendiente">Pendiente</option>
            <option value="suspendido">Vencido</option>
          </select>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} familias</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <SortHeader label="Familia" sortKey="name" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Hijos" sortKey="student_count" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="Estado" sortKey="status" current={sortKey} direction={sortDir} onSort={handleSort} />
              <SortHeader label="% Descuento" sortKey="discount" current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
              <SortHeader label="Descuento mensual" sortKey="total_discount" current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  No se encontraron familias
                </td>
              </tr>
            ) : (
              filtered.map((family) => {
                const status = STATUS_LABELS[family.agreement_status ?? ''] ?? STATUS_LABELS.pendiente;
                return (
                  <tr key={family.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/familias/${family.id}`} className="text-sm font-medium text-gray-900 hover:underline">
                        {family.name}
                      </Link>
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
