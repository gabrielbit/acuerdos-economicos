import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface UserRow {
  id: number;
  name: string;
  email: string;
  can_manage_families: boolean;
  can_manage_agreements: boolean;
  can_change_status: boolean;
  can_manage_users: boolean;
  can_comment: boolean;
}

const PERMISSION_LABELS: { key: keyof Omit<UserRow, 'id' | 'name' | 'email'>; label: string }[] = [
  { key: 'can_manage_families', label: 'Familias' },
  { key: 'can_manage_agreements', label: 'Acuerdos' },
  { key: 'can_change_status', label: 'Estado' },
  { key: 'can_comment', label: 'Comentar' },
  { key: 'can_manage_users', label: 'Usuarios' },
];

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    const data = await api.getUsers();
    setUsers(data as unknown as UserRow[]);
  };

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, []);

  const togglePermission = async (userId: number, key: string, currentValue: boolean) => {
    if (userId === currentUser?.id && key === 'can_manage_users') return;
    try {
      await api.updateUser(userId, { [key]: !currentValue });
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createUser({ email: newEmail, name: newName, password: newPassword });
      setShowNew(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-8 text-center">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
        <button onClick={() => setShowNew(!showNew)}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
          {showNew ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={createUser} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              {PERMISSION_LABELS.map((p) => (
                <th key={p.key} className="px-3 py-3 font-medium text-center">{p.label}</th>
              ))}
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {u.name}
                    {isSelf && <span className="text-xs text-gray-400 ml-1">(vos)</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  {PERMISSION_LABELS.map((p) => {
                    const value = u[p.key] as boolean;
                    const disabled = isSelf && p.key === 'can_manage_users';
                    return (
                      <td key={p.key} className="px-3 py-3 text-center">
                        <button
                          onClick={() => togglePermission(u.id, p.key, value)}
                          disabled={disabled}
                          className={`w-8 h-5 rounded-full transition-colors relative ${
                            value ? 'bg-green-500' : 'bg-gray-200'
                          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            value ? 'left-3.5' : 'left-0.5'
                          }`} />
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <button onClick={() => deleteUser(u.id, u.name)}
                        className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
