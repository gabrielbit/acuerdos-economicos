import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../services/api';
import type { BudgetHistoryEntry, BudgetSummary } from '../../types';
import { formatMoney } from '../../utils/format';

function monthShortLabel(ym: string): string {
  return new Date(`${ym}-01`).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
}

export default function Metricas() {
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyMonths, setHistoryMonths] = useState(12);
  const [history, setHistory] = useState<BudgetHistoryEntry[]>([]);

  useEffect(() => {
    Promise.all([
      api.getBudgetSummary().catch(() => null),
      api.getBudgetHistory(12).catch(() => []),
    ]).then(([b, historyData]) => {
      setBudget(b);
      setHistory(historyData);
    }).finally(() => setLoading(false));
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

  const chartData = useMemo(() => {
    return [...history]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        mes: monthShortLabel(row.month),
        Altas: row.amount_joined,
        Bajas: row.amount_dropped,
      }));
  }, [history]);

  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;
  }

  if (!budget) {
    return <p className="text-sm text-gray-500 py-8 text-center">No hay período activo configurado.</p>;
  }

  const runwayLabel =
    budget.estimated_months_runway != null
      ? `≈ ${budget.estimated_months_runway.toFixed(1)} meses`
      : '—';
  const extraFamiliesLabel =
    budget.estimated_additional_families != null
      ? `≈ ${budget.estimated_additional_families} familias`
      : '—';

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Métricas</h1>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Velocidad de otorgamiento</p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">
            {budget.grant_velocity_families_per_month.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Familias por mes (promedio de los últimos 6 meses calendarios completos, sin el mes en curso).
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Promedio % de beca (otorgadas)</p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">
            {budget.avg_granted_discount_percentage != null
              ? `${budget.avg_granted_discount_percentage.toFixed(1)}%`
              : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Promedio beca mensual por familia</p>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">
            {budget.avg_granted_monthly_discount_per_family != null
              ? formatMoney(budget.avg_granted_monthly_discount_per_family)
              : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Forecast sobre saldo disponible</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">Runway: {runwayLabel}</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">Cupos estimados: {extraFamiliesLabel}</p>
          <p className="text-xs text-gray-400 mt-2">
            Proyección lineal con velocidad y beca promedio; no considera familias en definición.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="p-2 pb-4 border-b border-gray-100 mb-4">
          <h2 className="text-sm font-medium text-gray-900">Ingresos y egresos de acuerdos (montos mensuales)</h2>
          <p className="text-xs text-gray-400 mt-1">Altas = becas al otorgar; bajas = becas al dar de baja el acuerdo.</p>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos para el gráfico.</p>
        ) : (
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} className="text-gray-500" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-gray-500"
                  tickFormatter={(v) => formatMoney(Number(v))}
                />
                <Tooltip
                  formatter={(value: number) => formatMoney(value)}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Bar dataKey="Altas" fill="#16a34a" name="Altas (ingreso compromiso)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Bajas" fill="#dc2626" name="Bajas (egreso compromiso)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-900">Evolución de altas y bajas</h2>
          <div className="ml-auto flex gap-1.5">
            {[12, 24, 36, 60].map((months) => (
              <button
                key={months}
                type="button"
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
    </div>
  );
}
