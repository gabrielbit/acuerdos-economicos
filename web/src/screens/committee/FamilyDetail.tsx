import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import type { Family, Student, Agreement, AgreementStudent, Comment } from '../../types';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR');
}

const LEVEL_LABELS: Record<string, string> = {
  jardin: 'Jardín',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  '12vo': '12vo',
};

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

export default function FamilyDetail() {
  const { can } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [family, setFamily] = useState<(Family & { students: Student[] }) | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [familyComments, setFamilyComments] = useState<Comment[]>([]);
  const [agreementComments, setAgreementComments] = useState<Comment[]>([]);
  const [newFamilyComment, setNewFamilyComment] = useState('');
  const [newAgreementComment, setNewAgreementComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edición de acuerdo
  const [editing, setEditing] = useState(false);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editObs, setEditObs] = useState('');
  const [saving, setSaving] = useState(false);

  // Invitación
  const [invitationLink, setInvitationLink] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // Edición de familia
  const [editingFamily, setEditingFamily] = useState(false);
  const [editName, setEditName] = useState('');
  const [editParents, setEditParents] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingFamily, setSavingFamily] = useState(false);

  // Nuevo estudiante
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentLevel, setNewStudentLevel] = useState<string>('primaria');
  const [newStudentGrade, setNewStudentGrade] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);

  const loadData = async () => {
    if (!id) return;
    const familyId = Number(id);
    const [f, agreements, fc] = await Promise.all([
      api.getFamily(familyId),
      api.getAgreements(),
      api.getComments('family', familyId),
    ]);
    const a = agreements.find((a) => a.family_id === familyId) ?? null;
    setFamily(f);
    setAgreement(a);
    setFamilyComments(fc);
    if (a) {
      const ac = await api.getComments('agreement', a.id);
      setAgreementComments(ac);
    } else {
      setAgreementComments([]);
    }
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [id]);

  const generateInvitation = async () => {
    if (!family) return;
    setGeneratingInvite(true);
    try {
      const inv = await api.createInvitation(family.id) as { token: string };
      const baseUrl = window.location.origin;
      setInvitationLink(`${baseUrl}/invitacion/${inv.token}`);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInvitationLink = () => {
    navigator.clipboard.writeText(invitationLink);
  };

  const startEditing = () => {
    if (!agreement) return;
    setEditDiscount(Number(agreement.discount_percentage));
    setEditObs(agreement.observations ?? '');
    setEditing(true);
  };

  const saveAgreement = async () => {
    if (!agreement) return;
    setSaving(true);
    try {
      await api.updateAgreement(agreement.id, {
        discount_percentage: editDiscount,
        observations: editObs || undefined,
      });
      setEditing(false);
      setLoading(true);
      await loadData();
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  const startEditingFamily = () => {
    if (!family) return;
    setEditName(family.name);
    setEditParents(family.parent_names ?? '');
    setEditEmail(family.email ?? '');
    setEditPhone(family.phone ?? '');
    setEditingFamily(true);
  };

  const saveFamily = async () => {
    if (!family) return;
    setSavingFamily(true);
    try {
      await api.updateFamily(family.id, {
        name: editName,
        parent_names: editParents || undefined,
        email: editEmail || undefined,
        phone: editPhone || undefined,
      });
      setEditingFamily(false);
      setLoading(true);
      await loadData();
    } finally {
      setSavingFamily(false);
      setLoading(false);
    }
  };

  const addStudent = async () => {
    if (!family || !newStudentName.trim() || !newStudentGrade.trim()) return;
    setSavingStudent(true);
    try {
      await api.createStudent(family.id, {
        name: newStudentName.trim(),
        level: newStudentLevel,
        grade: newStudentGrade.trim(),
      });
      setNewStudentName('');
      setNewStudentGrade('');
      setShowAddStudent(false);
      setLoading(true);
      await loadData();
    } finally {
      setSavingStudent(false);
      setLoading(false);
    }
  };

  const handleAddFamilyComment = async () => {
    if (!newFamilyComment.trim() || !family) return;
    setSendingComment(true);
    try {
      const comment = await api.addComment('family', family.id, newFamilyComment.trim());
      setFamilyComments((prev) => [comment, ...prev]);
      setNewFamilyComment('');
    } finally {
      setSendingComment(false);
    }
  };

  const handleAddAgreementComment = async () => {
    if (!newAgreementComment.trim() || !agreement) return;
    setSendingComment(true);
    try {
      const comment = await api.addComment('agreement', agreement.id, newAgreementComment.trim());
      setAgreementComments((prev) => [comment, ...prev]);
      setNewAgreementComment('');
    } finally {
      setSendingComment(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;
  if (!family) return <p className="text-sm text-gray-500 py-8 text-center">Familia no encontrada.</p>;

  const status = STATUS_LABELS[family.status] ?? STATUS_LABELS.solicitud;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
      </div>

      {/* Info familia */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {editingFamily ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre familia</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Padres</label>
                <input value={editParents} onChange={(e) => setEditParents(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveFamily} disabled={savingFamily}
                className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {savingFamily ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditingFamily(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{family.name}</h1>
                {family.parent_names && (
                  <p className="text-sm text-gray-500 mt-1">{family.parent_names}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {can('canChangeStatus') ? (
                  <select
                    value={family.status}
                    onChange={async (e) => {
                      await api.updateFamilyStatus(family.id, e.target.value);
                      setLoading(true);
                      await loadData();
                      setLoading(false);
                    }}
                    className={`px-3 py-1 text-sm font-medium rounded-full border-0 cursor-pointer appearance-none pr-6 ${status.className}`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                  >
                    <option value="solicitud">Solicitud</option>
                    <option value="formulario_enviado">Form. enviado</option>
                    <option value="formulario_completado">Form. completado</option>
                    <option value="agendado">Agendado</option>
                    <option value="en_definicion">En definición</option>
                    <option value="otorgado">Otorgado</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="suspendido">Vencido</option>
                  </select>
                ) : (
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${status.className}`}>
                    {status.label}
                  </span>
                )}
                {!agreement && can('canManageAgreements') && (
                  <Link to={`/familias/${family.id}/nuevo-acuerdo`}
                    className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                    Crear acuerdo
                  </Link>
                )}
                {can('canManageFamilies') && (
                  <button onClick={startEditingFamily}
                    className="text-xs text-gray-400 hover:text-gray-600">Editar</button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <span className="text-gray-500">Email</span>
                <p className="text-gray-900">{family.email ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Teléfono</span>
                <p className="text-gray-900">{family.phone ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Hijos</span>
                <p className="text-gray-900">{family.students.length}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invitación */}
      {can('canManageFamilies') && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-900">Link de invitación</span>
            {invitationLink ? (
              <>
                <input readOnly value={invitationLink}
                  className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600" />
                <button onClick={copyInvitationLink}
                  className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">
                  Copiar
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-400">Generá un link para que la familia se registre</span>
                <button onClick={generateInvitation} disabled={generatingInvite}
                  className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {generatingInvite ? 'Generando...' : 'Generar link'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabla de hijos */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Estudiantes</h2>
          {can('canManageFamilies') && (
            <button onClick={() => setShowAddStudent(!showAddStudent)}
              className="text-xs text-gray-500 hover:text-gray-700">
              {showAddStudent ? 'Cancelar' : '+ Agregar'}
            </button>
          )}
        </div>
        {showAddStudent && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nivel</label>
                <select value={newStudentLevel} onChange={(e) => setNewStudentLevel(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="jardin">Jardín</option>
                  <option value="primaria">Primaria</option>
                  <option value="secundaria">Secundaria</option>
                  <option value="12vo">12vo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Grado</label>
                <input value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)}
                  placeholder="Ej: EP3, 8vo"
                  className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <button onClick={addStudent} disabled={savingStudent || !newStudentName.trim() || !newStudentGrade.trim()}
                className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {savingStudent ? '...' : 'Agregar'}
              </button>
            </div>
          </div>
        )}
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Nivel</th>
              <th className="px-4 py-3 font-medium">Grado</th>
              <th className="px-4 py-3 font-medium">Legajo</th>
            </tr>
          </thead>
          <tbody>
            {family.students.map((s) => (
              <tr key={s.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{LEVEL_LABELS[s.level] ?? s.level}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.grade}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.file_number ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Acuerdo actual */}
      {agreement && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Acuerdo actual</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{agreement.discount_percentage}% de descuento</span>
              {!editing && can('canManageAgreements') && (
                <>
                  <button onClick={startEditing}
                    className="text-xs text-gray-400 hover:text-gray-600">Editar</button>
                  <button onClick={async () => {
                    if (!confirm('¿Eliminar este acuerdo? Esta acción no se puede deshacer.')) return;
                    await api.deleteAgreement(agreement.id);
                    setAgreement(null);
                    setAgreementComments([]);
                  }}
                    className="text-xs text-red-400 hover:text-red-600">Borrar</button>
                </>
              )}
            </div>
          </div>

          {editing && (
            <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">% Descuento</label>
                  <input type="number" min={0} max={100} value={editDiscount}
                    onChange={(e) => setEditDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div className="flex items-end">
                  <div className="flex gap-2">
                    <button onClick={saveAgreement} disabled={saving}
                      className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
                      {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditing(false)}
                      className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Observaciones</label>
                <textarea value={editObs} onChange={(e) => setEditObs(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
              </div>
            </div>
          )}

          {agreement.students && agreement.students.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 font-medium">Estudiante</th>
                  <th className="px-4 py-3 font-medium text-right">Cuota pura</th>
                  <th className="px-4 py-3 font-medium text-right">Descuento</th>
                  <th className="px-4 py-3 font-medium text-right">Extras</th>
                  <th className="px-4 py-3 font-medium text-right">A pagar</th>
                </tr>
              </thead>
              <tbody>
                {agreement.students.map((as: AgreementStudent) => (
                  <tr key={as.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{as.student_name ?? LEVEL_LABELS[as.level]}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(as.base_tuition)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 text-right">-{formatMoney(as.discount_amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatMoney(as.extras)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatMoney(as.amount_to_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin detalle por estudiante</p>
          )}
          {!editing && (agreement.observations || agreement.granted_at) && (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2">
              {agreement.granted_at && (
                <div className="flex gap-6 text-xs text-gray-400">
                  <span>Otorgado el {new Date(agreement.granted_at).toLocaleDateString('es-AR')}</span>
                </div>
              )}
              {agreement.observations && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Observaciones</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{agreement.observations}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notas de la familia */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-900">
            Notas {familyComments.length > 0 && <span className="text-gray-400 font-normal">({familyComments.length})</span>}
          </h2>
        </div>

        {can('canComment') && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex gap-3">
              <textarea
                value={newFamilyComment}
                onChange={(e) => setNewFamilyComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddFamilyComment(); } }}
                placeholder="Agregar una nota sobre la familia..."
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              />
              <button
                onClick={handleAddFamilyComment}
                disabled={!newFamilyComment.trim() || sendingComment}
                className="self-end px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {sendingComment ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        {familyComments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin notas aún</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {familyComments.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">{c.user_name}</span>
                  <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comentarios del acuerdo */}
      {agreement && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">
              Comentarios del acuerdo {agreementComments.length > 0 && <span className="text-gray-400 font-normal">({agreementComments.length})</span>}
            </h2>
          </div>

          {can('canComment') && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex gap-3">
                <textarea
                  value={newAgreementComment}
                  onChange={(e) => setNewAgreementComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddAgreementComment(); } }}
                  placeholder="Comentario sobre el acuerdo..."
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleAddAgreementComment}
                  disabled={!newAgreementComment.trim() || sendingComment}
                  className="self-end px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {sendingComment ? '...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}

          {agreementComments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin comentarios aún</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {agreementComments.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{c.user_name}</span>
                    <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
