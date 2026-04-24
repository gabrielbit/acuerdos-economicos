import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { Student, TuitionRate, AidPeriod } from '../../types';

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

interface StudentPreview {
  student: Student;
  baseTuition: number;
  extras: number;
  discountAmount: number;
  amountToPay: number;
}

export default function AgreementForm() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();

  const [familyName, setFamilyName] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [rates, setRates] = useState<TuitionRate[]>([]);
  const [activePeriod, setActivePeriod] = useState<AidPeriod | null>(null);

  const [discountInput, setDiscountInput] = useState('');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const discount = Number(discountInput || '0');

  useEffect(() => {
    if (!familyId) return;
    Promise.all([
      api.getFamily(Number(familyId)),
      api.getActivePeriod(),
    ])
      .then(async ([family, period]) => {
        setFamilyName(family.name);
        setStudents(family.students);
        setActivePeriod(period);
        const r = await api.getTuitionRates(period.id);
        setRates(r);
      })
      .finally(() => setLoading(false));
  }, [familyId]);

  const ratesByLevel = new Map(rates.map((r) => [r.level, r]));

  const previews: StudentPreview[] = students.map((s) => {
    const rate = ratesByLevel.get(s.level);
    const baseTuition = rate ? Number(rate.tuition_amount) : 0;
    const extras = rate ? Number(rate.extras_amount) : 0;
    const discountAmount = baseTuition * (discount / 100);
    const amountToPay = baseTuition - discountAmount + extras;
    return { student: s, baseTuition, extras, discountAmount, amountToPay };
  });

  const totalBase = previews.reduce((sum, p) => sum + p.baseTuition, 0);
  const totalExtras = previews.reduce((sum, p) => sum + p.extras, 0);
  const totalDiscount = previews.reduce((sum, p) => sum + p.discountAmount, 0);
  const totalToPay = previews.reduce((sum, p) => sum + p.amountToPay, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeriod || !familyId) return;

    setSaving(true);
    setError('');
    try {
      await api.createAgreement({
        family_id: Number(familyId),
        period_id: activePeriod.id,
        discount_percentage: discount,
        observations: observations || undefined,
      });
      navigate(`/familias/${familyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear acuerdo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={`/familias/${familyId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {familyName}
        </Link>
      </div>

      <h1 className="text-xl font-semibold text-gray-900">Nuevo acuerdo — {familyName}</h1>
      {activePeriod && (
        <p className="text-sm text-gray-500">{activePeriod.name}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Descuento */}
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">% Descuento</label>
          <input
            type="text"
            inputMode="numeric"
            value={discountInput}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '');
              if (digitsOnly === '') {
                setDiscountInput('');
                return;
              }
              const withoutLeadingZeros = digitsOnly.replace(/^0+(?=\d)/, '');
              const clamped = Math.min(100, Number(withoutLeadingZeros));
              setDiscountInput(String(clamped));
            }}
            placeholder="Ej: 45"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Preview por hijo */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Preview de montos</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Estudiante</th>
                <th className="px-4 py-3 font-medium">Nivel</th>
                <th className="px-4 py-3 font-medium text-right">Cuota pura</th>
                <th className="px-4 py-3 font-medium text-right">Descuento</th>
                <th className="px-4 py-3 font-medium text-right">Extras</th>
                <th className="px-4 py-3 font-medium text-right">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((p) => (
                <tr key={p.student.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{p.student.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{LEVEL_LABELS[p.student.level]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(p.baseTuition)}</td>
                  <td className="px-4 py-3 text-sm text-red-600 text-right">-{formatMoney(p.discountAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(p.extras)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatMoney(p.amountToPay)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-3 text-sm text-gray-900" colSpan={2}>Total familia</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatMoney(totalBase)}</td>
                <td className="px-4 py-3 text-sm text-red-600 text-right">-{formatMoney(totalDiscount)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(totalExtras)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatMoney(totalToPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <p className="text-gray-600">
            Descuento mensual total: <span className="font-semibold text-gray-900">{formatMoney(totalDiscount)}</span>
            {' '}({discount}% sobre cuotas puras)
          </p>
          <p className="text-gray-600 mt-1">
            La familia pagará: <span className="font-semibold text-gray-900">{formatMoney(totalToPay)}</span> /mes
            {totalExtras > 0 && <span className="text-gray-400"> (incluye {formatMoney(totalExtras)} de extras)</span>}
          </p>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            placeholder="Notas sobre el acuerdo..."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || discount === 0}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Crear acuerdo'}
          </button>
          <Link
            to={`/familias/${familyId}`}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
