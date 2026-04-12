import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { AidPeriod, FeeSchedule } from '../../types';

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

const MONTH_OPTIONS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Config() {
  const [periods, setPeriods] = useState<AidPeriod[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Nuevo período
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newStartMonth, setNewStartMonth] = useState(3);
  const [newEndMonth, setNewEndMonth] = useState(8);
  const [newYear, setNewYear] = useState(2026);
  const [newBudget, setNewBudget] = useState('');
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Nuevo tarifario
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [scheduleBudget, setScheduleBudget] = useState('');
  const [scheduleRates, setScheduleRates] = useState<Record<string, { tuition: string; extras: string }>>({
    jardin: { tuition: '', extras: '0' },
    primaria: { tuition: '', extras: '' },
    secundaria: { tuition: '', extras: '' },
    '12vo': { tuition: '', extras: '' },
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const loadData = async () => {
    const [p, fs] = await Promise.all([
      api.getPeriods(),
      api.getFeeSchedules(),
    ]);
    setPeriods(p);
    setFeeSchedules(fs);
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

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

  const prefillFromLatest = () => {
    if (feeSchedules.length === 0) return;
    const latest = feeSchedules[0];
    setScheduleBudget(String(latest.total_budget));
    const rateMap: Record<string, { tuition: string; extras: string }> = {};
    for (const level of LEVELS) {
      const r = latest.rates?.find((rate) => rate.level === level);
      rateMap[level] = {
        tuition: r ? String(r.tuition_amount) : '',
        extras: r ? String(r.extras_amount) : '0',
      };
    }
    setScheduleRates(rateMap);
  };

  const createSchedule = async () => {
    setSavingSchedule(true);
    try {
      const [year, month] = scheduleMonth.split('-');
      const monthName = MONTH_OPTIONS[Number(month) - 1];
      await api.createFeeSchedule({
        name: `Tarifario ${monthName} ${year}`,
        effective_from: `${scheduleMonth}-01`,
        total_budget: Number(scheduleBudget),
        rates: LEVELS.map((level) => ({
          level,
          tuition_amount: Number(scheduleRates[level].tuition),
          extras_amount: Number(scheduleRates[level].extras) || 0,
        })),
      });
      setShowNewSchedule(false);
      setScheduleRates({
        jardin: { tuition: '', extras: '0' },
        primaria: { tuition: '', extras: '' },
        secundaria: { tuition: '', extras: '' },
        '12vo': { tuition: '', extras: '' },
      });
      setScheduleBudget('');
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear tarifario');
    } finally {
      setSavingSchedule(false);
    }
  };

  const isScheduleValid = scheduleBudget && scheduleMonth &&
    LEVELS.every((l) => scheduleRates[l].tuition);

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>

      {/* Tarifarios */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Tarifarios</h2>
            <p className="text-xs text-gray-400 mt-0.5">Cuotas por nivel con fecha de vigencia</p>
          </div>
          {!showNewSchedule && (
            <button onClick={() => { setShowNewSchedule(true); prefillFromLatest(); }}
              className="text-xs text-gray-500 hover:text-gray-700">
              + Nuevo tarifario
            </button>
          )}
        </div>

        {showNewSchedule && (
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vigente desde (mes)</label>
                <input type="month" value={scheduleMonth}
                  onChange={(e) => setScheduleMonth(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Presupuesto mensual</label>
                <input type="number" value={scheduleBudget}
                  onChange={(e) => setScheduleBudget(e.target.value)}
                  placeholder="18358030.80"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Cuotas por nivel</p>
              <div className="space-y-2">
                {LEVELS.map((level) => (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-24">{LEVEL_LABELS[level]}</span>
                    <input type="number" value={scheduleRates[level].tuition}
                      onChange={(e) => setScheduleRates((prev) => ({
                        ...prev, [level]: { ...prev[level], tuition: e.target.value },
                      }))}
                      placeholder="Cuota"
                      className="w-36 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    <input type="number" value={scheduleRates[level].extras}
                      onChange={(e) => setScheduleRates((prev) => ({
                        ...prev, [level]: { ...prev[level], extras: e.target.value },
                      }))}
                      placeholder="Extras"
                      className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    <span className="text-xs text-gray-400">
                      = {formatMoney(Number(scheduleRates[level].tuition || 0) + Number(scheduleRates[level].extras || 0))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={createSchedule} disabled={!isScheduleValid || savingSchedule}
                className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {savingSchedule ? 'Guardando...' : 'Crear tarifario'}
              </button>
              <button onClick={() => setShowNewSchedule(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Al crear un nuevo tarifario, los montos de todos los acuerdos vigentes se recalculan automáticamente.
            </p>
          </div>
        )}

        {feeSchedules.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No hay tarifarios registrados</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {feeSchedules.map((fs, idx) => (
              <div key={fs.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{fs.name}</span>
                    {idx === 0 && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Vigente</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    Presupuesto: {formatMoney(Number(fs.total_budget))}
                  </span>
                </div>
                <div className="flex gap-4">
                  {fs.rates && [...fs.rates]
                    .sort((a, b) => LEVELS.indexOf(a.level as typeof LEVELS[number]) - LEVELS.indexOf(b.level as typeof LEVELS[number]))
                    .map((r) => (
                      <div key={r.level} className="text-xs text-gray-500">
                        <span className="text-gray-700">{LEVEL_LABELS[r.level]}</span>{' '}
                        {formatMoney(r.tuition_amount)}
                        {r.extras_amount > 0 && <span className="text-gray-400"> +{formatMoney(r.extras_amount)}</span>}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  {MONTH_OPTIONS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mes fin</label>
                <select value={newEndMonth} onChange={(e) => setNewEndMonth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  {MONTH_OPTIONS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
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
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.start_month} → {p.end_month}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.year}</td>
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
    </div>
  );
}
