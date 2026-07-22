import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Store,
  Shield,
  Edit2,
  Save,
  X,
  Rocket,
  Globe,
  MapPin,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import MapPicker from "../../../shared/components/MapPicker";

const SellerProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    shopName: "",
    phone: "",
    email: "",
    lat: null,
    lng: null,
    radius: 5,
    address: "",
    serviceCoverage: ["hyperlocal"],
    customZones: [],
  });

  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCity, setNewZoneCity] = useState("");
  const [newAreaInput, setNewAreaInput] = useState("");
  const [editingZoneIndex, setEditingZoneIndex] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await sellerApi.getProfile();
      const data = response.data.result;
      setProfile(data);
      setFormData({
        name: data.name,
        shopName: data.shopName,
        phone: data.phone,
        email: data.email,
        lat: data.location?.coordinates[1] || null,
        lng: data.location?.coordinates[0] || null,
        radius: data.serviceRadius || 5,
        address: data.address || "",
        serviceCoverage: data.serviceCoverage || ["hyperlocal"],
        customZones: data.customZones || [],
      });
    } catch (error) {
      toast.error("Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      // Disallow numbers in seller name
      const cleaned = value.replace(/[0-9]/g, "");
      setFormData({ ...formData, [name]: cleaned });
    } else if (name === "phone") {
      // Allow only digits, max 10 characters
      const digitsOnly = value.replace(/[^0-9]/g, "").slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
    } else if (name === "email") {
      // Trim spaces, keep as-is otherwise; HTML5 type=email will help validate shape
      setFormData({ ...formData, [name]: value.trimStart() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const getCleanCoverage = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'string') return [parsed];
      } catch (e) {
        if (val.includes(",")) return val.split(",").map(s => s.trim().replace(/['"\[\]]/g, ''));
        if (val) return [val.replace(/['"\[\]]/g, '')];
      }
    }
    return [];
  };

  const handleCoverageToggle = (coverageType) => {
    setFormData((prev) => {
      let updatedCoverage = getCleanCoverage(prev.serviceCoverage);
      
      if (coverageType === "all") {
        if (updatedCoverage.includes("all")) {
          updatedCoverage = [];
        } else {
          updatedCoverage = ["hyperlocal", "pan_india", "zone_wise", "all"];
        }
      } else {
        if (updatedCoverage.includes(coverageType)) {
          updatedCoverage = updatedCoverage.filter((t) => t !== coverageType && t !== "all");
        } else {
          updatedCoverage = [...updatedCoverage.filter(t => t !== "all"), coverageType];
        }
      }
      
      return {
        ...prev,
        serviceCoverage: updatedCoverage,
      };
    });
  };

  const handleAddZone = () => {
    if (!newZoneName.trim() || !newZoneCity.trim()) {
      toast.error("Zone Name and City are required.");
      return;
    }
    setFormData((prev) => {
      const updatedZones = [...(prev.customZones || [])];
      updatedZones.push({
        name: newZoneName.trim(),
        city: newZoneCity.trim(),
        areas: [],
      });
      return { ...prev, customZones: updatedZones };
    });
    setNewZoneName("");
    setNewZoneCity("");
  };

  const handleRemoveZone = (index) => {
    setFormData((prev) => {
      const updatedZones = (prev.customZones || []).filter((_, i) => i !== index);
      return { ...prev, customZones: updatedZones };
    });
    if (editingZoneIndex === index) {
      setEditingZoneIndex(null);
    }
  };

  const handleAddAreaToZone = (zoneIndex) => {
    if (!newAreaInput.trim()) return;
    setFormData((prev) => {
      const updatedZones = [...(prev.customZones || [])];
      if (updatedZones[zoneIndex]) {
        const areaList = [...(updatedZones[zoneIndex].areas || [])];
        if (!areaList.includes(newAreaInput.trim())) {
          areaList.push(newAreaInput.trim());
        }
        updatedZones[zoneIndex] = { ...updatedZones[zoneIndex], areas: areaList };
      }
      return { ...prev, customZones: updatedZones };
    });
    setNewAreaInput("");
  };

  const handleRemoveAreaFromZone = (zoneIndex, areaIndex) => {
    setFormData((prev) => {
      const updatedZones = [...(prev.customZones || [])];
      if (updatedZones[zoneIndex]) {
        const areaList = (updatedZones[zoneIndex].areas || []).filter((_, i) => i !== areaIndex);
        updatedZones[zoneIndex] = { ...updatedZones[zoneIndex], areas: areaList };
      }
      return { ...prev, customZones: updatedZones };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic phone validation: must be exactly 10 digits
    if (!/^[0-9]{10}$/.test(formData.phone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }
    // Basic email validation
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        lat: formData.lat,
        lng: formData.lng,
        radius: formData.radius,
        serviceCoverage: formData.serviceCoverage?.filter(c => c !== "all"),
      };
      await sellerApi.updateProfile(payload);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async () => {
    try {
      const newStatus = !profile.isActive;
      await sellerApi.updateProfile({ isActive: newStatus });
      setProfile((prev) => ({ ...prev, isActive: newStatus }));
      toast.success(`Shop is now ${newStatus ? "Active" : "Inactive"}`);
    } catch (error) {
      toast.error("Failed to update shop status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 font-sans">
      {/* Header Section */}
      <div className="relative mb-24 px-4">
        {/* Banner Background */}
        <div className="bg-linear-to-r from-slate-900 via-slate-950 to-black h-64 rounded-lg shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="absolute bottom-8 left-4 right-4 md:left-8 md:right-8 lg:left-12 lg:right-12 grid grid-cols-1 md:grid-cols-[176px_minmax(0,1fr)_auto] items-center md:items-end gap-6 md:gap-8">
          {/* Avatar Container */}
          <div className="h-44 w-44 rounded-full bg-white p-2 shadow-[0_30px_70px_rgba(0,0,0,0.15)] flex-shrink-0 mx-auto md:mx-0">
            <div className="h-full w-full rounded-full bg-slate-50 flex items-center justify-center border-4 border-slate-50">
              <span className="text-7xl font-black text-slate-900">
                {profile?.name?.charAt(0)}
              </span>
            </div>
          </div>

          {/* Info Block */}
          <div className="min-w-0 pb-2 md:pb-4 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-3">
              <span className="px-4 py-1.5 bg-white/10 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-[2px] rounded-full border border-white/20">
                {profile?.role}
              </span>
              <button
                onClick={toggleStatus}
                className={`group flex items-center gap-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-[2px] rounded-full border transition-all hover:scale-105 active:scale-95 ${profile?.isActive
                  ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  : "bg-rose-500 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                  }`}>
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${profile?.isActive ? "bg-emerald-200" : "bg-rose-200"
                    }`}
                />
                {profile?.isActive ? "Active" : "Inactive"}
              </button>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter drop-shadow-sm mb-1 break-words">
              {profile?.name}
            </h1>
            <p className="text-white/60 font-black tracking-[1px] text-lg">
              {profile?.shopName}
            </p>
          </div>

          {/* Action Button */}
          <div className="pb-2 md:pb-4 w-full md:w-auto">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="w-full md:w-auto bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white hover:text-slate-950 transition-all rounded-lg px-6 lg:px-12 py-4 md:py-5 flex items-center justify-center gap-3 md:gap-4 font-black tracking-[2px] md:tracking-[3px] text-xs shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-[1.03] active:scale-[0.95] whitespace-nowrap">
                <Edit2 size={18} /> EDIT PROFILE
              </Button>
            ) : (
              <div className="w-full md:w-auto flex gap-3 md:gap-4 justify-center md:justify-end">
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="h-[64px] w-[64px] flex items-center justify-center bg-white/5 text-white border border-white/20 hover:bg-white hover:text-slate-900 rounded-lg shadow-lg transition-all backdrop-blur-md">
                  <X size={24} className="stroke-[2.5]" />
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="min-w-0 max-w-full bg-white text-slate-950 hover:bg-slate-100 rounded-lg px-5 md:px-8 lg:px-12 py-4 md:py-5 font-black tracking-[2px] md:tracking-[3px] text-xs flex items-center gap-3 md:gap-4 shadow-[0_25px_50px_rgba(0,0,0,0.15)] h-[64px] whitespace-nowrap">
                  {isSaving ? (
                    "UPDATING..."
                  ) : (
                    <>
                      <Save size={20} /> SAVE CHANGES
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="md:col-span-2 space-y-8">
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
            <h3 className="text-xl font-black text-slate-900 mb-8 border-b border-slate-50 pb-4">
              Business Profile
            </h3>

            <form className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Seller Identity
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Store Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Store size={18} />
                    </div>
                    <input
                      type="text"
                      name="shopName"
                      value={formData.shopName}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Contact Number
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-lg text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-100 transition-all disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>
            </form>
          </Card>

          {/* Location & Radius Settings Card */}
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-lg">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
              <h3 className="text-xl font-black text-slate-900">
                Location & Service Settings
              </h3>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-slate-900 text-white hover:bg-black rounded-lg px-6 py-2 text-[10px] font-black tracking-[2px]">
                  MANAGE
                </Button>
              )}
            </div>

            <div className="space-y-6">
              {/* Service Coverage & Zones Settings */}
              <div className="space-y-4 pt-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-600 ml-1">
                  Service Coverage Type
                </label>
                
                {isEditing ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { id: "hyperlocal", label: "Hyperlocal (Near Shop)" },
                        { id: "pan_india", label: "Pan India" },
                        { id: "zone_wise", label: "Zone-wise" },
                        { id: "all", label: "All Coverage Options" },
                      ].map((option) => {
                          const isSelected = getCleanCoverage(formData.serviceCoverage).includes(option.id);

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleCoverageToggle(option.id)}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? "border-brand-500 bg-brand-50/50 text-brand-900 shadow-sm"
                                : "border-slate-100 bg-slate-50 hover:border-slate-200 text-slate-600"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-brand-600 border-brand-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && (
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs font-bold leading-tight">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Zones Builder Section */}
                    {formData.serviceCoverage?.includes("zone_wise") && (
                      <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 mb-4 shadow-sm animate-in fade-in duration-200">
                        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                          Manage Dynamic Zones
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Zone Name (e.g. East Delhi)"
                            value={newZoneName}
                            onChange={(e) => setNewZoneName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all"
                          />
                          <input
                            type="text"
                            placeholder="City"
                            value={newZoneCity}
                            onChange={(e) => setNewZoneCity(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddZone}
                          className="w-full py-2 bg-slate-900 text-white hover:bg-black rounded-lg text-xs font-black uppercase tracking-wider transition-colors"
                        >
                          Add New Zone
                        </button>

                        {/* Render Added Zones */}
                        {formData.customZones?.length > 0 ? (
                          <div className="space-y-3 pt-2">
                            {formData.customZones.map((zone, zIdx) => (
                              <div key={zIdx} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50 space-y-2 relative">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveZone(zIdx)}
                                  className="absolute right-2 top-2 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{zone.name}</p>
                                  <p className="text-[10px] font-medium text-slate-500">{zone.city}</p>
                                </div>

                                {/* Areas tag list */}
                                <div className="flex flex-wrap gap-1">
                                  {(zone.areas || []).map((area, aIdx) => (
                                    <span key={aIdx} className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                      {area}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAreaFromZone(zIdx, aIdx)}
                                        className="text-slate-400 hover:text-red-500"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  ))}
                                </div>

                                {/* Add Area/Pincode to Zone */}
                                <div className="flex gap-1.5 mt-2">
                                  <input
                                    type="text"
                                    placeholder="Add area or pincode..."
                                    value={editingZoneIndex === zIdx ? newAreaInput : ""}
                                    onChange={(e) => {
                                      setEditingZoneIndex(zIdx);
                                      setNewAreaInput(e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddAreaToZone(zIdx);
                                      }
                                    }}
                                    className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-700 outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddAreaToZone(zIdx)}
                                    className="px-3 py-1 bg-slate-800 text-white rounded-md text-[10px] font-bold hover:bg-black transition-colors"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 text-center py-2 font-medium">
                            No custom zones added yet. Add one above.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex flex-wrap gap-2">
                      {(formData.serviceCoverage || []).length > 0 ? (
                        (formData.serviceCoverage || []).map((cov) => (
                          <span key={cov} className="bg-slate-200/60 text-slate-800 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-slate-300/40">
                            {cov === "hyperlocal" ? "Hyperlocal" : cov === "pan_india" ? "Pan India" : "Zone-wise"}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 font-bold">No coverage selected</span>
                      )}
                    </div>

                    {formData.serviceCoverage?.includes("zone_wise") && (
                      <div className="pt-2 border-t border-slate-200/40 space-y-2">
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Active Zones</p>
                        {formData.customZones?.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {formData.customZones.map((zone, zIdx) => (
                              <div key={zIdx} className="bg-white border border-slate-200/60 rounded-lg p-2.5 text-xs">
                                <p className="font-bold text-slate-800">{zone.name} ({zone.city})</p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                                  Areas: {(zone.areas || []).join(", ") || "None"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-medium">No zones configured.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100/50 space-y-6">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${formData.lat
                        ? "bg-brand-100 text-brand-600 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.3)]"
                        : "bg-white text-slate-400 shadow-sm"
                        }`}>
                      <MapPin size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">
                        {formData.lat
                          ? "Store Location Pin"
                          : "Location Not Defined"}
                      </p>
                      <p className="text-xs text-slate-500 font-medium max-w-[400px] leading-relaxed">
                        {formData.address ||
                          "Click change to precisely mark your shop location on the map for delivery accuracy."}
                      </p>
                    </div>
                  </div>
                  {isEditing && (
                    <Button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-900 rounded-lg px-8 py-3 text-[10px] font-black tracking-[2px] shadow-sm hover:shadow-md transition-all whitespace-nowrap">
                      CHANGE PIN
                    </Button>
                  )}
                </div>

                {formData.lat && (
                  <div className="pt-6 border-t border-slate-200/60 flex flex-wrap gap-8">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Service Radius
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900">
                          {formData.radius}
                        </span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md">
                          KM
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Latitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lat.toFixed(6)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Longitude
                      </span>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                        {formData.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <Shield size={16} className="text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  Your shop location and service radius determine which
                  customers can view your products. Ensure the marker is placed
                  exactly at your physical storefront for accurate delivery
                  assignments.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Card */}
        <div className="space-y-8">
          <Card className="p-8 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[40px] bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[4px] text-white/40 mb-6">
              Security & Trust
            </h4>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Verification
                  </p>
                  <p className="text-sm font-bold">
                    {profile?.isVerified
                      ? "Verified Merchant"
                      : "Verification Pending"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Rocket size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Partner Tier
                  </p>
                  <p className="text-sm font-bold">Standard Growth</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Globe size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/60">
                    Region
                  </p>
                  <p className="text-sm font-bold">Pan India Reach</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Admin Note Card - only if remark exists */}
          {profile?.adminRemark && (
            <Card className="p-6 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[28px] bg-amber-50 border border-amber-100 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 text-base">
                  📋
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[3px] text-amber-700">Platform Note</p>
                  <p className="text-[10px] text-amber-600 font-medium">From Admin Team</p>
                </div>
              </div>
              <p className="text-xs font-medium text-amber-900 leading-relaxed whitespace-pre-wrap">
                {profile.adminRemark}
              </p>
            </Card>
          )}

          {/* Admin Terms Card - only if terms exist */}
          {profile?.adminTerms && (
            <Card className="p-6 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[28px] bg-indigo-50 border border-indigo-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 text-base">
                  📝
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[3px] text-indigo-700">Terms & Conditions</p>
                  <p className="text-[10px] text-indigo-600 font-medium">Platform Requirements</p>
                </div>
              </div>
              <p className="text-xs font-medium text-indigo-900 leading-relaxed whitespace-pre-wrap">
                {profile.adminTerms}
              </p>
            </Card>
          )}

          {/* Privacy Policy Link Card */}
          <Card 
            onClick={() => navigate('/seller/privacy-policy')}
            className="p-6 border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[28px] bg-white border border-gray-100 hover:border-brand-300 hover:shadow-lg transition-all cursor-pointer group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gray-50 group-hover:bg-brand-50 flex items-center justify-center text-gray-400 group-hover:text-brand-500 transition-colors">
                <Shield size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 group-hover:text-brand-600 transition-colors">Privacy Policy</h4>
                <p className="text-xs text-slate-500 font-medium">Read our terms and data policy</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-brand-50 flex items-center justify-center text-gray-400 group-hover:text-brand-500 transition-colors">
              <ChevronRight size={18} />
            </div>
          </Card>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={
            formData.lat ? { lat: formData.lat, lng: formData.lng } : null
          }
          initialRadius={formData.radius}
        />
      )}
    </div>
  );
};

export default SellerProfile;
