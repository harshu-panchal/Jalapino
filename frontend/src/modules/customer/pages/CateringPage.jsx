import React, { useState, useEffect } from "react";
import { ChevronLeft, Coffee, Users, CheckCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { customerCateringApi } from "../services/cateringApi";

export default function CateringPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("services"); // "services" or "packages"
  const [services, setServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // { type, data }
  const [formData, setFormData] = useState({
    customerName: "",
    mobileNumber: "",
    eventDate: "",
    eventTime: "",
    eventAddress: "",
    numberOfGuests: "",
    specialInstructions: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resServices, resPackages] = await Promise.all([
        customerCateringApi.getServices(),
        customerCateringApi.getPackages()
      ]);
      setServices(resServices.data?.results || resServices.data?.result || resServices.data || []);
      setPackages(resPackages.data?.results || resPackages.data?.result || resPackages.data || []);
    } catch (error) {
      console.error("Error fetching catering info", error);
      toast.error("Failed to load catering information");
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = (type, item) => {
    setSelectedItem({ type, data: item });
    setFormData({ ...formData, numberOfGuests: type === "package" ? item.guestCount : "" });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerName || !formData.mobileNumber || !formData.eventDate || !formData.eventAddress) {
      return toast.error("Please fill all required fields");
    }
    
    try {
      setSubmitting(true);
      const payload = { ...formData };
      if (selectedItem.type === "service") {
        payload.serviceId = selectedItem.data._id;
      } else {
        payload.packageId = selectedItem.data._id;
      }
      
      const res = await customerCateringApi.submitBooking(payload);
      if (res.data?.success) {
        toast.success("Booking request sent successfully! We will contact you soon.");
        setIsModalOpen(false);
        setFormData({ customerName: "", mobileNumber: "", eventDate: "", eventTime: "", eventAddress: "", numberOfGuests: "", specialInstructions: "" });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-[80px] pb-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="h-16 flex items-center px-4 max-w-2xl mx-auto w-full">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-slate-800" />
          </button>
          <div className="flex-1 text-center font-bold text-lg text-slate-800 pr-10">Catering Services</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg mb-8">
          <Coffee className="w-10 h-10 mb-4 opacity-90" />
          <h1 className="text-2xl font-black mb-2">Make Your Event Special</h1>
          <p className="text-amber-50 text-sm opacity-90">Book professional catering for weddings, parties, and corporate events directly from us.</p>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-200/60 rounded-xl mb-6">
          <button 
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === "services" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500"}`}
            onClick={() => setActiveTab("services")}
          >
            Custom Services
          </button>
          <button 
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === "packages" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500"}`}
            onClick={() => setActiveTab("packages")}
          >
            Fixed Packages
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-2xl"></div>)}
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "services" && services.length === 0 && <p className="text-center text-slate-500 py-10">No active services available.</p>}
            {activeTab === "packages" && packages.length === 0 && <p className="text-center text-slate-500 py-10">No fixed packages available.</p>}

            {activeTab === "services" && services.map(service => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={service._id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">{service.name}</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">{service.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <p className="text-xs text-slate-400">Starting from</p>
                    <p className="font-black text-amber-600">₹{service.basePrice}</p>
                  </div>
                  <button onClick={() => handleBookClick("service", service)} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-full active:scale-95 transition-transform">Book Now</button>
                </div>
              </motion.div>
            ))}

            {activeTab === "packages" && packages.map(pkg => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={pkg._id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-slate-800">{pkg.name}</h3>
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-xs font-bold">
                    <Users className="w-3 h-3" /> {pkg.guestCount} Guests
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-4">{pkg.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Fixed Price</p>
                    <p className="font-black text-amber-600">₹{pkg.price}</p>
                  </div>
                  <button onClick={() => handleBookClick("package", pkg)} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-full active:scale-95 transition-transform">Book Package</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: "100%" }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl max-h-[90vh] flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg text-slate-800">Booking Request</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 font-bold">✕</button>
              </div>
              
              <div className="p-5 overflow-y-auto flex-1">
                <div className="bg-amber-50 rounded-xl p-4 mb-6 flex gap-3 items-start border border-amber-100">
                  <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Requesting: {selectedItem?.data?.name}</p>
                    <p className="text-xs text-amber-700 mt-1">Submit your details and our team will call you to confirm.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Full Name *</label>
                    <input required type="text" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-amber-500 focus:bg-white transition-colors" placeholder="e.g. Rahul Sharma" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Mobile Number *</label>
                    <input 
                      required 
                      type="tel" 
                      value={formData.mobileNumber} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({...formData, mobileNumber: val});
                      }} 
                      maxLength={10}
                      pattern="[0-9]{10}"
                      className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-amber-500 focus:bg-white transition-colors" 
                      placeholder="10-digit mobile number" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Event Date *</label>
                      <input required type="date" value={formData.eventDate} onChange={e => setFormData({...formData, eventDate: e.target.value})} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-amber-500 focus:bg-white transition-colors text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Event Time</label>
                      <input type="time" value={formData.eventTime} onChange={e => setFormData({...formData, eventTime: e.target.value})} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-amber-500 focus:bg-white transition-colors text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Number of Guests *</label>
                    <input required type="number" value={formData.numberOfGuests} onChange={e => setFormData({...formData, numberOfGuests: e.target.value})} readOnly={selectedItem?.type === "package"} className={`w-full h-12 border border-slate-200 rounded-xl px-4 outline-none focus:border-amber-500 focus:bg-white transition-colors ${selectedItem?.type === "package" ? "bg-slate-100 text-slate-500" : "bg-slate-50"}`} placeholder="e.g. 100" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Event Address *</label>
                    <textarea required value={formData.eventAddress} onChange={e => setFormData({...formData, eventAddress: e.target.value})} className="w-full h-24 py-3 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-amber-500 focus:bg-white transition-colors resize-none" placeholder="Complete address of the venue"></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Any Special Instructions?</label>
                    <input type="text" value={formData.specialInstructions} onChange={e => setFormData({...formData, specialInstructions: e.target.value})} className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 outline-none focus:border-amber-500 focus:bg-white transition-colors" placeholder="Optional" />
                  </div>
                  
                  <div className="pt-4 pb-4">
                    <button disabled={submitting} type="submit" className="w-full h-14 bg-amber-500 text-white font-black text-lg rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-70">
                      {submitting ? "Submitting..." : "Send Request"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
