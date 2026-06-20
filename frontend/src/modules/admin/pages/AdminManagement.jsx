import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { useAuth } from '@core/context/AuthContext';
import { Shield, Plus, Trash2, Edit2, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { ROLES } from '@core/auth/activeRoleStore';

const AdminManagement = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    subRole: 'sub_admin'
  });
  const [editingId, setEditingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/admin/admins');
      setAdmins(res.data.results || res.data.result || []);
    } catch (err) {
      toast.error('Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.subRole === 'super_admin') {
      fetchAdmins();
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axiosInstance.put(`/admin/admins/${editingId}`, { subRole: formData.subRole });
        toast.success('Admin role updated successfully');
      } else {
        await axiosInstance.post('/admin/admins', formData);
        toast.success('Admin created successfully');
      }
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', subRole: 'sub_admin' });
      setEditingId(null);
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save admin');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this admin account?')) return;
    try {
      await axiosInstance.delete(`/admin/admins/${id}`);
      toast.success('Admin deleted successfully');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete admin');
    }
  };

  const openEditModal = (admin) => {
    setEditingId(admin._id);
    setFormData({
      name: admin.name,
      email: admin.email,
      password: '', // Leave blank, password update not supported in this endpoint directly
      subRole: admin.subRole || 'super_admin'
    });
    setIsModalOpen(true);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin': return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200 uppercase">Super Admin</span>;
      case 'finance': return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 uppercase">Finance</span>;
      case 'marketing': return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full border border-purple-200 uppercase">Marketing</span>;
      case 'sub_admin': return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full border border-blue-200 uppercase">Sub Admin</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full uppercase">{role || 'Unknown'}</span>;
    }
  };

  if (user?.subRole !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <ShieldAlert size={64} className="mb-4 text-red-400" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-indigo-600" /> Team & Role Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage admin access and sub-roles</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', email: '', password: '', subRole: 'sub_admin' });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
        >
          <Plus size={18} /> Add New Admin
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((admin) => (
                <tr key={admin._id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-medium text-slate-900">{admin.name}</td>
                  <td className="px-6 py-4">{admin.email}</td>
                  <td className="px-6 py-4">{getRoleBadge(admin.subRole)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(admin)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit Role"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(admin._id)}
                      disabled={user._id === admin._id}
                      className={`p-2 ml-2 rounded-lg transition ${
                        user._id === admin._id
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      title={user._id === admin._id ? 'Cannot delete yourself' : 'Delete'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    No admins found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl relative">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Admin Role' : 'Create New Admin'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required={!editingId}
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full border p-2 pr-10 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Role</label>
                <select
                  name="subRole"
                  value={formData.subRole}
                  onChange={handleChange}
                  className="w-full border p-2 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="super_admin">Super Admin (Full Access)</option>
                  <option value="sub_admin">Sub Admin (Products, Sellers, Orders)</option>
                  <option value="finance">Finance Team (Orders, Payouts, Wallet)</option>
                  <option value="marketing">Marketing Team (Coupons, Banners, Offers)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingId ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
