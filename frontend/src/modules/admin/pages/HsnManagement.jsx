import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import Button from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axiosInstance from "@core/api/axios";

export default function HsnManagement() {
  const [hsns, setHsns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHsn, setEditingHsn] = useState(null);
  const [formData, setFormData] = useState({
    hsnCode: "",
    description: "",
    gstPercentage: "",
    status: "active"
  });

  const fetchHsns = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/hsn/admin");
      setHsns(res.data.results || []);
    } catch (err) {
      console.error("Failed to fetch HSNs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHsns();
  }, []);

  const handleOpenModal = (hsn = null) => {
    setEditingHsn(hsn);
    if (hsn) {
      setFormData({
        hsnCode: hsn.hsnCode,
        description: hsn.description,
        gstPercentage: hsn.gstPercentage,
        status: hsn.status,
      });
    } else {
      setFormData({ hsnCode: "", description: "", gstPercentage: "", status: "active" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingHsn(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHsn) {
        await axiosInstance.put(`/hsn/${editingHsn._id}`, formData);
      } else {
        await axiosInstance.post("/hsn", formData);
      }
      handleCloseModal();
      fetchHsns();
    } catch (err) {
      console.error("Failed to save HSN", err);
      alert(err.response?.data?.message || "Failed to save HSN");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this HSN?")) return;
    try {
      await axiosInstance.delete(`/hsn/${id}`);
      fetchHsns();
    } catch (err) {
      console.error("Failed to delete", err);
      alert(err.response?.data?.message || "Failed to delete HSN");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">HSN Management</h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Add HSN
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600">HSN Code</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Description</th>
                <th className="px-6 py-3 font-semibold text-slate-600">GST %</th>
                <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center">Loading...</td>
                </tr>
              ) : hsns.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-slate-500">No HSN codes found</td>
                </tr>
              ) : (
                hsns.map((hsn) => (
                  <tr key={hsn._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{hsn.hsnCode}</td>
                    <td className="px-6 py-4 text-slate-600">{hsn.description}</td>
                    <td className="px-6 py-4 font-medium">{hsn.gstPercentage}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${hsn.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {hsn.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(hsn)}>
                        <Edit2 className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(hsn._id)}>
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
              <CardTitle>{editingHsn ? "Edit HSN Code" : "Add HSN Code"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">HSN Code</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">GST Percentage (%)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    className="w-full border rounded-md px-3 py-2"
                    value={formData.gstPercentage}
                    onChange={(e) => setFormData({ ...formData, gstPercentage: e.target.value })}
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
