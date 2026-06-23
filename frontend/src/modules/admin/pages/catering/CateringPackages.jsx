import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import Button from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminCateringApi } from "../../services/api/cateringApi";

export default function CateringPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    guestCount: "",
    status: "active"
  });

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await adminCateringApi.getCateringPackages();
      setPackages(res.data.results || res.data.result || res.data || []);
    } catch (err) {
      console.error("Failed to fetch Packages", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleOpenModal = (pkg = null) => {
    setEditingPackage(pkg);
    if (pkg) {
      setFormData({
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        guestCount: pkg.guestCount,
        status: pkg.status,
      });
    } else {
      setFormData({ name: "", description: "", price: "", guestCount: "", status: "active" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPackage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPackage) {
        await adminCateringApi.updateCateringPackage(editingPackage._id, formData);
      } else {
        await adminCateringApi.createCateringPackage(formData);
      }
      handleCloseModal();
      fetchPackages();
    } catch (err) {
      console.error("Failed to save Package", err);
      alert(err.response?.data?.message || "Failed to save Package");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Package?")) return;
    try {
      await adminCateringApi.deleteCateringPackage(id);
      fetchPackages();
    } catch (err) {
      console.error("Failed to delete", err);
      alert(err.response?.data?.message || "Failed to delete Package");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catering Packages</h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Add Package
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">Name</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Price</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Guests</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-slate-500">No Packages found</td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{pkg.name}</td>
                    <td className="px-6 py-4">₹{pkg.price}</td>
                    <td className="px-6 py-4">{pkg.guestCount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {pkg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(pkg)}>
                        <Edit2 className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(pkg._id)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle>{editingPackage ? "Edit Package" : "Add Package"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Package Name</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Guest Count</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.guestCount}
                    onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
