import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { Agreement, AgreementStudent, AidRequest } from '../../types';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

const LEVEL_LABELS: Record<string, string> = {
  jardin: 'Jardín', primaria: 'Primaria', secundaria: 'Secundaria', '12vo': '12vo',
};

export default function PortalHome() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [request, setRequest] = useState<AidRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getPortalAgreements(), api.getPortalRequest()])
      .then(([a, r]) => { setAgreements(a); setRequest(r); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  const activeAgreement = agreements.length > 0 ? agreements[0] : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Mi acuerdo económico</h1>

      {/* Acuerdo activo */}
      {activeAgreement ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Acuerdo actual</h2>
            <span className="text-sm text-gray-500">{activeAgreement.discount_percentage}% de descuento</span>
          </div>
          {activeAgreement.students && activeAgreement.students.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Estudiante</th>
                  <th className="px-4 py-3 font-medium text-right">Cuota</th>
                  <th className="px-4 py-3 font-medium text-right">Descuento</th>
                  <th className="px-4 py-3 font-medium text-right">Extras</th>
                  <th className="px-4 py-3 font-medium text-right">A pagar</th>
                </tr>
              </thead>
              <tbody>
                {activeAgreement.students.map((s: AgreementStudent) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{s.student_name ?? LEVEL_LABELS[s.level]}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(s.base_tuition)}</td>
                    <td className="px-4 py-3 text-sm text-green-600 text-right">-{formatMoney(s.discount_amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(s.extras)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatMoney(s.amount_to_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">El detalle del acuerdo está siendo procesado</p>
          )}
          {activeAgreement.granted_at && (
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Otorgado el {new Date(activeAgreement.granted_at).toLocaleDateString('es-AR')}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          {request && request.status === 'enviada' ? (
            <>
              <p className="text-sm text-gray-600 mb-2">Tu solicitud fue enviada y está siendo evaluada.</p>
              <p className="text-xs text-gray-400">
                Enviada el {request.submitted_at ? new Date(request.submitted_at).toLocaleDateString('es-AR') : '—'}
                {request.submitted_by_name && ` por ${request.submitted_by_name}`}
              </p>
            </>
          ) : request && request.status === 'borrador' ? (
            <>
              <p className="text-sm text-gray-600 mb-4">Tenés un borrador de solicitud sin enviar.</p>
              <Link to="/portal/solicitud"
                className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                Completar solicitud
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">No tenés un acuerdo económico activo. Podés enviar una solicitud de ayuda.</p>
              <Link to="/portal/solicitud"
                className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                Solicitar ayuda económica
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
