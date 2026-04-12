import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { BudgetSummary, Family } from '../../types';

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
  agendado: { label: 'Agendado', className: 'bg-blue-50 text-blue-700' },
  en_definicion: { label: 'En definición', className: 'bg-amber-50 text-amber-700' },
  otorgado: { label: 'Otorgado', className: 'bg-green-50 text-green-700' },
  rechazado: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
  suspendido: { label: 'Vencido', className: 'bg-gray-100 text-gray-500' },
};

export default function Dashboard() {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    Promise.all([api.getBudgetSummary(), api.getFamilies()])
      .then(([b, f]) => {
        setBudget(b);
        setFamilies(f);
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

  const filteredFamilies = families
    .filter((f) => {
      const matchesName = !filter || f.name.toLowerCase().includes(filter.toLowerCase());
      const matchesStatus = !statusFilter || f.status === statusFilter;
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Presupuesto total</p>
          <p className="text-2xl font-semibold text-gray-900">{formatMoney(budget.total_budget)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-green-600 mb-1">Otorgado</p>
          <p className="text-2xl font-semibold text-green-700">{formatMoney(budget.granted_assigned)}</p>
          <p className="text-sm text-gray-500 mt-1">{budget.assigned_percentage.toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-amber-600 mb-1">En definición</p>
          <p className="text-2xl font-semibold text-amber-600">{formatMoney(budget.granted_in_definition)}</p>
          <p className="text-sm text-gray-500 mt-1">{budget.in_definition_percentage.toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Disponible</p>
          <p className="text-2xl font-semibold text-gray-900">{formatMoney(budget.available)}</p>
          <p className="text-sm text-gray-500 mt-1">{budget.available_percentage.toFixed(0)}%</p>
        </div>
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

      {/* Filtros y tabla de familias */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-900 mr-auto">Familias</h2>
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
            <option value="asignado">Asignado</option>
            <option value="en_definicion">En definición</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Familia</th>
              <th className="px-4 py-3 font-medium">Hijos</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">% Descuento</th>
              <th className="px-4 py-3 font-medium text-right">Cuota total</th>
              <th className="px-4 py-3 font-medium text-right">Descuento mensual</th>
            </tr>
          </thead>
          <tbody>
            {filteredFamilies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
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
