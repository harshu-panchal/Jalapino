import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import Button from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminCateringApi } from "../../services/api/cateringApi";

export default function CateringServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    basePrice: "",
    maxCapacity: "",
    status: "active"
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await adminCateringApi.getCateringServices();
      setServices(res.data.results || res.data.result || res.data || []);
    } catch (err) {
      console.error("Failed to fetch Services", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenModal = (service = null) => {
    setEditingService(service);
    if (service) {
      setFormData({
        name: service.name,
        description: service.description,
        basePrice: service.basePrice,
        maxCapacity: service.maxCapacity,
        status: service.status,
      });
    } else {
      setFormData({ name: "", description: "", basePrice: "", maxCapacity: "", status: "active" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await adminCateringApi.updateCateringService(editingService._id, formData);
      } else {
        await adminCateringApi.createCateringService(formData);
      }
      handleCloseModal();
      fetchServices();
    } catch (err) {
      console.error("Failed to save Service", err);
      alert(err.response?.data?.message || "Failed to save Service");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Catering Service?")) return;
    try {
      await adminCateringApi.deleteCateringService(id);
      fetchServices();
    } catch (err) {
      console.error("Failed to delete", err);
      alert(err.response?.data?.message || "Failed to delete Service");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catering Services</h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Add Service
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">Name</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Base Price</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Max Capacity</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-slate-500">No Services found</td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{service.name}</td>
                    <td className="px-6 py-4">₹{service.basePrice}</td>
                    <td className="px-6 py-4">{service.maxCapacity}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${service.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {service.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(service)}>
                        <Edit2 className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(service._id)}>
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
              <CardTitle>{editingService ? "Edit Service" : "Add Service"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Service Name</label>
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
                  <label className="block text-sm font-medium mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Capacity (Guests)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.maxCapacity}
                    onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })}
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
