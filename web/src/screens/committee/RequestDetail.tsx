import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { AidRequest } from '../../types';

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<AidRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getRequest(Number(id)).then(setRequest).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;
  if (!request) return <p className="text-sm text-gray-500 py-8 text-center">Solicitud no encontrada</p>;

  const snapshot = request.form_snapshot as Record<string, unknown> | null;
  const info = request.additional_info as Record<string, unknown> | null;
  const members = (snapshot?.family_members ?? info?.family_members ?? []) as Array<Record<string, unknown>>;
  const children = (snapshot?.children ?? info?.children ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/solicitudes" className="text-sm text-gray-500 hover:text-gray-700">← Solicitudes</Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Solicitud — {request.family_name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {request.submitted_by_name && `Enviada por ${request.submitted_by_name}`}
            {request.submitted_at && ` el ${new Date(request.submitted_at).toLocaleDateString('es-AR')}`}
          </p>
        </div>
        <Link to={`/familias/${request.family_id}`}
          className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Ver familia
        </Link>
      </div>

      {/* Datos solicitud */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">% Solicitado</span>
            <p className="text-gray-900 font-medium">{request.requested_discount ? `${Number(request.requested_discount).toFixed(0)}%` : '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">Tipo</span>
            <p className="text-gray-900">{request.is_renewal ? 'Renovación' : 'Beca nueva'}</p>
          </div>
          <div>
            <span className="text-gray-500">Período</span>
            <p className="text-gray-900">{request.period_name ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Contacto */}
      {info?.address ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Datos de contacto</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Domicilio</span><p className="text-gray-900">{String(info.address)}</p></div>
            <div><span className="text-gray-500">Localidad</span><p className="text-gray-900">{info.locality ? String(info.locality) : '—'}</p></div>
            <div><span className="text-gray-500">CP</span><p className="text-gray-900">{info.postal_code ? String(info.postal_code) : '—'}</p></div>
            <div><span className="text-gray-500">Teléfono</span><p className="text-gray-900">{info.family_phone ? String(info.family_phone) : '—'}</p></div>
          </div>
        </div>
      ) : null}

      {/* Adultos */}
      {members.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Grupo familiar — Adultos</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Parentesco</th>
                <th className="px-4 py-3 font-medium">Profesión/Ocupación</th>
                <th className="px-4 py-3 font-medium">Edad</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{m.name as string}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.relationship as string}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{(m.occupation as string) || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.age ? String(m.age) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hijos */}
      {children.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Hijos</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Escuela</th>
                <th className="px-4 py-3 font-medium">Grado</th>
                <th className="px-4 py-3 font-medium">Solicita beca</th>
                <th className="px-4 py-3 font-medium">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {children.map((c, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{c.name as string}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{(c.school as string) || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.grade as string}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.requests_aid ? 'Sí' : 'No'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{(c.observations as string) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vivienda */}
      {request.housing_type && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Vivienda</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Tipo</span><p className="text-gray-900 capitalize">{request.housing_type}</p></div>
            <div><span className="text-gray-500">Superficie</span><p className="text-gray-900">{request.housing_surface ?? '—'}</p></div>
            <div><span className="text-gray-500">Dormitorios</span><p className="text-gray-900">{request.housing_bedrooms ?? '—'}</p></div>
            <div><span className="text-gray-500">Ambientes</span><p className="text-gray-900">{request.housing_rooms ?? '—'}</p></div>
          </div>
        </div>
      )}

      {/* Motivo */}
      {request.reason && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-medium text-gray-900 mb-2">Situación económica / Motivo</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.reason}</p>
        </div>
      )}
    </div>
  );
}
