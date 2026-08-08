import React, { useState, useEffect } from 'react';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HiOutlineCalendar, 
  HiOutlineUser, 
  HiOutlineClock, 
  HiOutlinePhone, 
  HiOutlineLocationMarker,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineTrash
} from 'react-icons/hi2';

const SellerVisitManagement = () => {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'availability'
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Reschedule Form state
  const [reschedulingVisit, setReschedulingVisit] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('');

  // Availability Settings state
  const [myVenues, setMyVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [availabilityDate, setAvailabilityDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [newSlotInput, setNewSlotInput] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await sellerApi.getVisitRequests();
      setRequests(res.data.result || []);
    } catch (err) {
      toast.error('Failed to load visit requests');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyVenues = async () => {
    try {
      const res = await sellerApi.getProducts({ limit: 100 });
      // Filter products that have capacityMax or venueState (venues)
      const venues = (res.data.result?.items || []).filter(p => p.capacityMax > 0 || p.venueState);
      setMyVenues(venues);
      if (venues.length > 0) setSelectedVenue(venues[0]._id);
    } catch (err) {
      console.error('Failed to load venues', err);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedVenue || !availabilityDate) return;
    setIsAvailabilityLoading(true);
    try {
      const res = await sellerApi.getVenueAvailability({
        venueId: selectedVenue,
        date: availabilityDate
      });
      setTimeSlots(res.data.result?.timeSlots || []);
      setBookedSlots(res.data.result?.bookedSlots || []);
    } catch (err) {
      toast.error('Failed to load slot availability');
    } finally {
      setIsAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchMyVenues();
  }, []);

  useEffect(() => {
    if (activeTab === 'availability') {
      fetchAvailability();
    }
  }, [activeTab, selectedVenue, availabilityDate]);

  const handleUpdateStatus = async (id, status, extra = {}) => {
    try {
      await sellerApi.updateVisitRequestStatus(id, { status, ...extra });
      toast.success(`Visit request updated to ${status}`);
      fetchRequests();
      setReschedulingVisit(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update request');
    }
  };

  const handleSaveAvailability = async () => {
    if (!selectedVenue || !availabilityDate) return;
    try {
      await sellerApi.setVenueAvailability({
        venueId: selectedVenue,
        date: availabilityDate,
        timeSlots
      });
      toast.success('Availability slots saved successfully!');
    } catch (err) {
      toast.error('Failed to save availability');
    }
  };

  const handleAddSlot = () => {
    if (!newSlotInput) return;
    if (timeSlots.includes(newSlotInput)) {
      toast.warning('Slot already exists');
      return;
    }
    setTimeSlots([...timeSlots, newSlotInput]);
    setNewSlotInput('');
  };

  const handleRemoveSlot = (slot) => {
    if (bookedSlots.includes(slot)) {
      toast.error('Cannot delete a slot that already has a confirmed booking.');
      return;
    }
    setTimeSlots(timeSlots.filter(s => s !== slot));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Requested': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Accepted': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Rescheduled': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'Confirmed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Completed': return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'Cancelled': return 'bg-rose-50 text-rose-600 border border-rose-200';
      case 'Rejected': return 'bg-red-50 text-red-600 border border-red-200';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Physical Venue Visits</h1>
          <p className="text-xs font-medium text-slate-500 mt-1">Manage physical visits, availability slots and CRM lead pipeline.</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'requests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Visit Requests
          </button>
          <button 
            onClick={() => setActiveTab('availability')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'availability' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Manage Availability
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-500 mt-4">Loading visit requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <HiOutlineCalendar className="mx-auto text-slate-300 mb-3" size={48} />
              <h3 className="text-base font-black text-slate-800">No Visit Requests</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Incoming visit requests from customers will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {requests.map((req) => (
                <div key={req._id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6 hover:shadow-md transition-shadow">
                  {/* Left Section: Venue & Customer Details */}
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                      <h3 className="text-base font-black text-slate-900">{req.venueId?.name || 'Venue'}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <HiOutlineUser className="text-slate-400" size={16} />
                        <span>Customer: {req.customerId?.name || 'Customer'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <HiOutlinePhone className="text-slate-400" size={16} />
                        <span>Phone: {req.customerId?.phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <HiOutlineCalendar className="text-slate-400" size={16} />
                        <span>Preferred Date: {new Date(req.preferredDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <HiOutlineClock className="text-slate-400" size={16} />
                        <span>Slot: {req.preferredTimeSlot}</span>
                      </div>
                      {req.rescheduledDetails && (
                        <div className="col-span-full bg-purple-50 text-purple-900 border border-purple-100 p-3 rounded-2xl">
                          <p className="font-bold text-[11px]">Reschedule Proposal ({req.rescheduledDetails.proposedBy === 'seller' ? 'Proposed by You' : 'Proposed by Customer'}):</p>
                          <p className="mt-1">Proposed Date: {new Date(req.rescheduledDetails.date).toLocaleDateString()} | Slot: {req.rescheduledDetails.timeSlot}</p>
                        </div>
                      )}
                      {req.notes && (
                        <div className="col-span-full text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="font-bold">Customer Notes:</span> "{req.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Section: Action Buttons */}
                  <div className="flex flex-col justify-center gap-2.5 min-w-[160px]">
                    {req.status === 'Requested' && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(req._id, 'Accepted')}
                          className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <HiOutlineCheckCircle size={16} /> Accept Request
                        </button>
                        <button 
                          onClick={() => {
                            setReschedulingVisit(req);
                            setNewDate(req.preferredDate.split('T')[0]);
                            setNewTimeSlot(req.preferredTimeSlot);
                          }}
                          className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <HiOutlineRefresh size={16} /> Propose Reschedule
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(req._id, 'Rejected')}
                          className="w-full py-2 text-rose-600 hover:bg-rose-50 text-xs font-black rounded-xl"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {(req.status === 'Accepted' || (req.status === 'Rescheduled' && req.rescheduledDetails.proposedBy === 'customer')) && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(req._id, 'Confirmed')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <HiOutlineCheckCircle size={16} /> Confirm Booking
                        </button>
                        <button 
                          onClick={() => {
                            setReschedulingVisit(req);
                            setNewDate((req.rescheduledDetails?.date || req.preferredDate).split('T')[0]);
                            setNewTimeSlot(req.rescheduledDetails?.timeSlot || req.preferredTimeSlot);
                          }}
                          className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <HiOutlineRefresh size={16} /> Propose Reschedule
                        </button>
                      </>
                    )}

                    {req.status === 'Confirmed' && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(req._id, 'Completed')}
                          className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <HiOutlineCheckCircle size={16} /> Mark Visited (Completed)
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(req._id, 'Cancelled')}
                          className="w-full py-2.5 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-black rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <HiOutlineXCircle size={16} /> Cancel Visit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Availability Tab */
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Select Venue</label>
              <select 
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                {myVenues.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Date</label>
              <input 
                type="date"
                value={availabilityDate}
                onChange={(e) => setAvailabilityDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800">Configure Visit Time Slots</h3>
            
            {/* Slot List */}
            {isAvailabilityLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {timeSlots.map((slot, index) => {
                  const isBooked = bookedSlots.includes(slot);
                  return (
                    <span 
                      key={index} 
                      className={`text-xs font-bold px-3.5 py-2 rounded-xl border flex items-center gap-2 ${isBooked ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                    >
                      <HiOutlineClock />
                      {slot} {isBooked && '(Confirmed)'}
                      {!isBooked && (
                        <button 
                          onClick={() => handleRemoveSlot(slot)} 
                          className="hover:text-rose-600 focus:outline-none ml-1 text-slate-400"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Slot Creator Input */}
            <div className="flex gap-3 max-w-md pt-2">
              <select 
                value={newSlotInput}
                onChange={(e) => setNewSlotInput(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="">Choose Slot Preset</option>
                <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM</option>
                <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
              </select>
              <button 
                onClick={handleAddSlot}
                className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl flex items-center gap-1 shadow-sm"
              >
                <HiOutlinePlus /> Add Slot
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={handleSaveAvailability}
                className="px-6 py-3 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-2xl shadow-lg"
              >
                Save Availability Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      <AnimatePresence>
        {reschedulingVisit && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-800">Propose Rescheduling</h3>
                <button onClick={() => setReschedulingVisit(null)} className="text-slate-500 font-bold hover:text-slate-800">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">New Proposed Date</label>
                  <input 
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">New Proposed Slot</label>
                  <select 
                    value={newTimeSlot}
                    onChange={(e) => setNewTimeSlot(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                    <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM</option>
                    <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                    <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button 
                  onClick={() => setReschedulingVisit(null)}
                  className="flex-1 py-3 border border-slate-200 text-slate-700 text-xs font-black rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateStatus(reschedulingVisit._id, 'Rescheduled', {
                    rescheduledDate: newDate,
                    rescheduledTimeSlot: newTimeSlot
                  })}
                  className="flex-1 py-3 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-black"
                >
                  Propose Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SellerVisitManagement;
