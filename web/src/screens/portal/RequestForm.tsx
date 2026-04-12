import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { AidRequest } from '../../types';

interface FamilyMember {
  name: string;
  relationship: string;
  occupation: string;
  age: string;
}

interface Child {
  name: string;
  school: string;
  grade: string;
  has_current_aid: boolean;
  requests_aid: boolean;
  observations: string;
}

export default function RequestForm() {
  const navigate = useNavigate();
  const [_existing, setExisting] = useState<AidRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Datos del formulario
  const [requestedDiscount, setRequestedDiscount] = useState('');
  const [isRenewal, setIsRenewal] = useState(false);
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');

  // Grupo familiar adultos
  const [members, setMembers] = useState<FamilyMember[]>([
    { name: '', relationship: '', occupation: '', age: '' },
  ]);

  // Hijos
  const [children, setChildren] = useState<Child[]>([
    { name: '', school: 'Rudolf Steiner', grade: '', has_current_aid: false, requests_aid: true, observations: '' },
  ]);

  // Vivienda
  const [housingType, setHousingType] = useState('');
  const [housingSurface, setHousingSurface] = useState('');
  const [housingRooms, setHousingRooms] = useState('');
  const [housingBedrooms, setHousingBedrooms] = useState('');

  // Situación
  const [reason, setReason] = useState('');

  useEffect(() => {
    api.getPortalRequest()
      .then((r) => {
        if (r && r.status === 'enviada') {
          navigate('/portal');
          return;
        }
        if (r && r.status === 'borrador') {
          setExisting(r);
          // Cargar datos del borrador
          setRequestedDiscount(r.requested_discount?.toString() ?? '');
          setIsRenewal(r.is_renewal);
          setReason(r.reason ?? '');
          setHousingType(r.housing_type ?? '');
          setHousingSurface(r.housing_surface ?? '');
          setHousingRooms(r.housing_rooms?.toString() ?? '');
          setHousingBedrooms(r.housing_bedrooms?.toString() ?? '');
          const info = r.additional_info as Record<string, unknown> | null;
          if (info?.family_members) setMembers(info.family_members as FamilyMember[]);
          if (info?.children) setChildren(info.children as Child[]);
        }
        // Cargar datos de contacto de la familia
        return api.getPortalFamily();
      })
      .then((f) => {
        if (f) {
          if (!address && f.address) setAddress(f.address);
          if (!locality && f.locality) setLocality(f.locality);
          if (!postalCode && f.postal_code) setPostalCode(f.postal_code);
          if (!phone && f.phone) setPhone(f.phone);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateMember = (i: number, field: keyof FamilyMember, value: string) => {
    setMembers((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const updateChild = (i: number, field: keyof Child, value: string | boolean) => {
    setChildren((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const handleSubmit = async (status: 'borrador' | 'enviada') => {
    setSaving(true);
    setError('');
    try {
      await api.submitPortalRequest({
        requested_discount: requestedDiscount ? Number(requestedDiscount) : undefined,
        is_renewal: isRenewal,
        reason,
        address, locality, postal_code: postalCode, phone,
        family_members: members.filter((m) => m.name.trim()),
        children: children.filter((c) => c.name.trim()),
        housing_type: housingType || undefined,
        housing_surface: housingSurface || undefined,
        housing_rooms: housingRooms ? Number(housingRooms) : undefined,
        housing_bedrooms: housingBedrooms ? Number(housingBedrooms) : undefined,
        status,
      });
      navigate('/portal');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      if (msg.includes('Ya se envió')) {
        navigate('/portal');
        return;
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Solicitud de ayuda económica</h1>

      {/* Tipo de beca y % */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Datos de la solicitud</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">% de reducción solicitado</label>
            <input type="number" min={0} max={100} value={requestedDiscount}
              onChange={(e) => setRequestedDiscount(e.target.value)}
              placeholder="Ej: 30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input type="checkbox" checked={isRenewal} onChange={(e) => setIsRenewal(e.target.checked)}
                className="rounded border-gray-300" />
              Renovación (ya tuvo beca anteriormente)
            </label>
          </div>
        </div>
      </div>

      {/* Datos de contacto */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Datos de contacto</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Domicilio</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle y número"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Localidad</label>
            <input value={locality} onChange={(e) => setLocality(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Código postal</label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </div>
      </div>

      {/* Grupo familiar adultos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Grupo familiar — Adultos</h2>
          <button type="button" onClick={() => setMembers([...members, { name: '', relationship: '', occupation: '', age: '' }])}
            className="text-xs text-gray-500 hover:text-gray-700">+ Agregar</button>
        </div>
        {members.map((m, i) => (
          <div key={i} className="grid grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Parentesco</label>
              <input value={m.relationship} onChange={(e) => updateMember(i, 'relationship', e.target.value)}
                placeholder="Ej: Papá, Mamá"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Profesión/Ocupación</label>
              <input value={m.occupation} onChange={(e) => updateMember(i, 'occupation', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Edad</label>
              <input type="number" value={m.age} onChange={(e) => updateMember(i, 'age', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            {members.length > 1 && (
              <button type="button" onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                className="text-xs text-red-400 hover:text-red-600 pb-2">Quitar</button>
            )}
          </div>
        ))}
      </div>

      {/* Hijos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Hijos</h2>
          <button type="button" onClick={() => setChildren([...children, { name: '', school: '', grade: '', has_current_aid: false, requests_aid: false, observations: '' }])}
            className="text-xs text-gray-500 hover:text-gray-700">+ Agregar hijo</button>
        </div>
        {children.map((c, i) => (
          <div key={i} className="space-y-2 pb-3 border-b border-gray-100 last:border-0">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input value={c.name} onChange={(e) => updateChild(i, 'name', e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Escuela</label>
                <input value={c.school} onChange={(e) => updateChild(i, 'school', e.target.value)}
                  placeholder="Rudolf Steiner"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Grado/Año que cursará</label>
                <input value={c.grade} onChange={(e) => updateChild(i, 'grade', e.target.value)}
                  placeholder="Ej: 1ro, EP3, 8vo"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={c.has_current_aid}
                  onChange={(e) => updateChild(i, 'has_current_aid', e.target.checked)}
                  className="rounded border-gray-300" />
                Posee beca actualmente
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={c.requests_aid}
                  onChange={(e) => updateChild(i, 'requests_aid', e.target.checked)}
                  className="rounded border-gray-300" />
                Solicita beca
              </label>
              <input value={c.observations} onChange={(e) => updateChild(i, 'observations', e.target.value)}
                placeholder="Observaciones" className="flex-1 px-3 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
              {children.length > 1 && (
                <button type="button" onClick={() => setChildren(children.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-400 hover:text-red-600">Quitar</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Vivienda */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Datos de la vivienda</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select value={housingType} onChange={(e) => setHousingType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="">Seleccionar</option>
              <option value="casa">Casa</option>
              <option value="departamento">Departamento</option>
              <option value="ph">PH</option>
              <option value="duplex">Dúplex</option>
              <option value="chalet">Chalet</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Superficie</label>
            <input value={housingSurface} onChange={(e) => setHousingSurface(e.target.value)}
              placeholder="Ej: 70m²"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dormitorios</label>
            <input type="number" value={housingBedrooms} onChange={(e) => setHousingBedrooms(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ambientes totales</label>
            <input type="number" value={housingRooms} onChange={(e) => setHousingRooms(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </div>
      </div>

      {/* Situación económica */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Situación económica / Motivo de la solicitud</h2>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          rows={4} placeholder="Describí brevemente la situación familiar y el motivo por el cual solicitan ayuda económica..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Botones */}
      <div className="flex gap-3">
        <button onClick={() => handleSubmit('enviada')} disabled={saving}
          className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
          {saving ? 'Enviando...' : 'Enviar solicitud'}
        </button>
        <button onClick={() => handleSubmit('borrador')} disabled={saving}
          className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          Guardar borrador
        </button>
      </div>
    </div>
  );
}
