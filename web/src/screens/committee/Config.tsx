import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { AidPeriod, TuitionRate } from '../../types';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const LEVEL_LABELS: Record<string, string> = {
  jardin: 'Jardín',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  '12vo': '12vo',
};

const LEVELS = ['jardin', 'primaria', 'secundaria', '12vo'] as const;

export default function Config() {
  const [periods, setPeriods] = useState<AidPeriod[]>([]);
  const [rates, setRates] = useState<TuitionRate[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Edición de cuotas
  const [editingRates, setEditingRates] = useState(false);
  const [editRates, setEditRates] = useState<Record<string, { tuition: string; extras: string }>>({});
  const [savingRates, setSavingRates] = useState(false);

  // Nuevo período
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newStartMonth, setNewStartMonth] = useState(3);
  const [newEndMonth, setNewEndMonth] = useState(8);
  const [newYear, setNewYear] = useState(2026);
  const [newBudget, setNewBudget] = useState('');
  const [savingPeriod, setSavingPeriod] = useState(false);

  const loadData = async () => {
    const p = await api.getPeriods();
    setPeriods(p);
    const active = p.find((period) => period.is_active);
    if (active) {
      setActivePeriodId(active.id);
      const r = await api.getTuitionRates(active.id);
      setRates(r);
    }
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const startEditingRates = () => {
    const rateMap: Record<string, { tuition: string; extras: string }> = {};
    for (const level of LEVELS) {
      const existing = rates.find((r) => r.level === level);
      rateMap[level] = {
        tuition: existing ? String(existing.tuition_amount) : '0',
        extras: existing ? String(existing.extras_amount) : '0',
      };
    }
    setEditRates(rateMap);
    setEditingRates(true);
  };

  const saveRates = async () => {
    if (!activePeriodId) return;
    setSavingRates(true);
    try {
      for (const [level, values] of Object.entries(editRates)) {
        await api.createTuitionRate({
          period_id: activePeriodId,
          level,
          tuition_amount: Number(values.tuition),
          extras_amount: Number(values.extras),
        });
      }
      setEditingRates(false);
      const r = await api.getTuitionRates(activePeriodId);
      setRates(r);
    } finally {
      setSavingRates(false);
    }
  };

  const createPeriod = async () => {
    if (!newPeriodName.trim() || !newBudget) return;
    setSavingPeriod(true);
    try {
      await api.createPeriod({
        name: newPeriodName.trim(),
        start_month: newStartMonth,
        end_month: newEndMonth,
        year: newYear,
        total_budget: Number(newBudget),
      });
      setShowNewPeriod(false);
      setNewPeriodName('');
      setNewBudget('');
      await loadData();
    } finally {
      setSavingPeriod(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>

      {/* Períodos */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Períodos de ayuda</h2>
          <button onClick={() => setShowNewPeriod(!showNewPeriod)}
            className="text-xs text-gray-500 hover:text-gray-700">
            {showNewPeriod ? 'Cancelar' : '+ Nuevo período'}
          </button>
        </div>

        {showNewPeriod && (
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input value={newPeriodName} onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder="Ej: Septiembre-Febrero 2026"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mes inicio</label>
                <select value={newStartMonth} onChange={(e) => setNewStartMonth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mes fin</label>
                <select value={newEndMonth} onChange={(e) => setNewEndMonth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Año</label>
                <input type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Presupuesto total</label>
                <input type="number" value={newBudget} onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="14426670"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="col-span-2 flex items-end">
                <button onClick={createPeriod} disabled={savingPeriod || !newPeriodName.trim() || !newBudget}
                  className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {savingPeriod ? 'Creando...' : 'Crear período'}
                </button>
              </div>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Meses</th>
              <th className="px-4 py-3 font-medium">Año</th>
              <th className="px-4 py-3 font-medium text-right">Presupuesto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.start_month} → {p.end_month}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.year}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatMoney(p.total_budget)}</td>
                <td className="px-4 py-3">
                  {p.is_active ? (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">Activo</span>
                  ) : (
                    <span className="text-xs text-gray-400">Inactivo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cuotas por nivel */}
      {activePeriodId && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Cuotas por nivel — Período activo</h2>
            {!editingRates && (
              <button onClick={startEditingRates}
                className="text-xs text-gray-500 hover:text-gray-700">Editar</button>
            )}
          </div>

          {editingRates ? (
            <div className="p-4 space-y-3">
              {LEVELS.map((level) => (
                <div key={level} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 w-24">{LEVEL_LABELS[level]}</span>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cuota pura</label>
                    <input type="number" value={editRates[level]?.tuition ?? ''}
                      onChange={(e) => setEditRates((prev) => ({ ...prev, [level]: { ...prev[level], tuition: e.target.value } }))}
                      className="w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Extras</label>
                    <input type="number" value={editRates[level]?.extras ?? ''}
                      onChange={(e) => setEditRates((prev) => ({ ...prev, [level]: { ...prev[level], extras: e.target.value } }))}
                      className="w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <span className="text-sm text-gray-500 mt-4">
                    = {formatMoney(Number(editRates[level]?.tuition ?? 0) + Number(editRates[level]?.extras ?? 0))}
                  </span>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={saveRates} disabled={savingRates}
                  className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {savingRates ? 'Guardando...' : 'Guardar cuotas'}
                </button>
                <button onClick={() => setEditingRates(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Nivel</th>
                  <th className="px-4 py-3 font-medium text-right">Cuota pura</th>
                  <th className="px-4 py-3 font-medium text-right">Extras</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{LEVEL_LABELS[r.level] ?? r.level}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatMoney(r.tuition_amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(r.extras_amount)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      {formatMoney(r.tuition_amount + r.extras_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
