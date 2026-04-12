import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { FeeSchedule } from '../../types';

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

const LEVEL_ORDER = ['jardin', 'primaria', 'secundaria', '12vo'];

export default function FeeSchedules() {
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [rates, setRates] = useState({
    jardin: { tuition: '', extras: '0' },
    primaria: { tuition: '', extras: '' },
    secundaria: { tuition: '', extras: '' },
    '12vo': { tuition: '', extras: '' },
  });

  useEffect(() => {
    api.getFeeSchedules().then(setSchedules).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const newSchedule = await api.createFeeSchedule({
        name,
        effective_from: effectiveFrom,
        total_budget: Number(totalBudget),
        rates: LEVEL_ORDER.map((level) => ({
          level,
          tuition_amount: Number(rates[level as keyof typeof rates].tuition),
          extras_amount: Number(rates[level as keyof typeof rates].extras) || 0,
        })),
      });
      setSchedules([newSchedule, ...schedules]);
      setCreating(false);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear tarifario');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEffectiveFrom('');
    setTotalBudget('');
    setRates({
      jardin: { tuition: '', extras: '0' },
      primaria: { tuition: '', extras: '' },
      secundaria: { tuition: '', extras: '' },
      '12vo': { tuition: '', extras: '' },
    });
  };

  const isFormValid = name && effectiveFrom && totalBudget &&
    LEVEL_ORDER.every((l) => rates[l as keyof typeof rates].tuition);

  if (loading) {
    return <p className="text-sm text-gray-500 py-12 text-center">Cargando tarifarios...</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">&larr; Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900 mt-1">Tarifarios</h1>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
          >
            Nuevo tarifario
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-900">Nuevo tarifario</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Tarifario Mayo 2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vigente desde</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Presupuesto total</label>
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="18358030.80"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Cuotas por nivel</p>
            <div className="grid grid-cols-4 gap-3">
              {LEVEL_ORDER.map((level) => (
                <div key={level} className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">{LEVEL_LABELS[level]}</p>
                  <input
                    type="number"
                    value={rates[level as keyof typeof rates].tuition}
                    onChange={(e) => setRates({ ...rates, [level]: { ...rates[level as keyof typeof rates], tuition: e.target.value } })}
                    placeholder="Cuota"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    type="number"
                    value={rates[level as keyof typeof rates].extras}
                    onChange={(e) => setRates({ ...rates, [level]: { ...rates[level as keyof typeof rates], extras: e.target.value } })}
                    placeholder="Extras"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={!isFormValid || saving}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Crear tarifario'}
            </button>
            <button
              onClick={() => { setCreating(false); resetForm(); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">No hay tarifarios registrados</p>
      ) : (
        <div className="space-y-4">
          {schedules.map((fs, idx) => (
            <div key={fs.id} className={`bg-white rounded-xl border ${idx === 0 ? 'border-green-200' : 'border-gray-200'}`}>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900">{fs.name}</h3>
                    {idx === 0 && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Vigente</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Desde {new Date(fs.effective_from).toLocaleDateString('es-AR')} — Presupuesto: {formatMoney(fs.total_budget)}
                  </p>
                </div>
              </div>
              {fs.rates && (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-t border-b border-gray-100">
                      <th className="px-4 py-2 font-medium">Nivel</th>
                      <th className="px-4 py-2 font-medium text-right">Cuota</th>
                      <th className="px-4 py-2 font-medium text-right">Extras</th>
                      <th className="px-4 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...fs.rates]
                      .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
                      .map((r) => (
                        <tr key={r.level} className="border-b border-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{LEVEL_LABELS[r.level] ?? r.level}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-right">{formatMoney(r.tuition_amount)}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-right">{formatMoney(r.extras_amount)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                            {formatMoney(r.tuition_amount + r.extras_amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
