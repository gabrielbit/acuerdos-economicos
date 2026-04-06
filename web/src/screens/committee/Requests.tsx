import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { AidRequest } from '../../types';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  borrador: { label: 'Borrador', className: 'bg-gray-100 text-gray-600' },
  enviada: { label: 'Enviada', className: 'bg-blue-50 text-blue-700' },
  en_revision: { label: 'En revisión', className: 'bg-amber-50 text-amber-700' },
  resuelta: { label: 'Resuelta', className: 'bg-green-50 text-green-700' },
};

export default function Requests() {
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRequests().then(setRequests).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Solicitudes</h1>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No hay solicitudes</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Familia</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">% Solicitado</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Enviado por</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const status = STATUS_LABELS[r.status] ?? STATUS_LABELS.borrador;
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.family_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.period_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {r.requested_discount ? `${Number(r.requested_discount).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.submitted_by_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/solicitudes/${r.id}`}
                        className="text-xs text-gray-500 hover:text-gray-700">Ver</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
