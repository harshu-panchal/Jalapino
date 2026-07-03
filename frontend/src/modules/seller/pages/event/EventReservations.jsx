import React, { useState, useEffect } from 'react';
import { sellerEventApi } from '../../services/sellerEventApi';
import CircularProgress from '@mui/material/CircularProgress';
import { motion, AnimatePresence } from 'framer-motion';
import Dialog from '@mui/material/Dialog';
import { HiOutlineCheck, HiOutlineXMark, HiOutlineCalendarDays, HiOutlineUserGroup, HiOutlineMapPin, HiOutlineClock, HiOutlineCamera, HiOutlineVideoCamera } from 'react-icons/hi2';
import axiosInstance from '@core/api/axios';

const EventReservations = () => {
    const [reservations, setReservations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRes, setSelectedRes] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingResId, setLoadingResId] = useState(null);
    const [filter, setFilter] = useState('all');

    // Restore modal state from session storage on initial load
    useEffect(() => {
        if (reservations.length > 0) {
            const savedResId = sessionStorage.getItem('openReservationId');
            if (savedResId) {
                const res = reservations.find(r => r._id === savedResId);
                if (res && !modalOpen) {
                    setSelectedRes(res);
                    setModalOpen(true);
                }
            }
        }
    }, [reservations]);

    // Live Kitchen State
    const [liveStreamUrl, setLiveStreamUrl] = useState('');
    const [livePhotoDescription, setLivePhotoDescription] = useState('');
    const [livePhoto, setLivePhoto] = useState(null);
    const [isLiveKitchenLoading, setIsLiveKitchenLoading] = useState(false);

    // Helper to fix localhost port mismatches for uploaded images
    const getResolvedImageUrl = (url) => {
        if (!url) return '';
        if (typeof url === 'string') {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const origin = baseUrl.replace(/\/api\/?$/, '');
            
            if (url.includes('localhost:7000')) {
                return url.replace('http://localhost:7000', origin);
            }
            if (url.startsWith('/images/')) {
                return `${origin}${url}`;
            }
        }
        return url;
    };

    useEffect(() => {
        fetchReservations();
    }, []);

    const fetchReservations = async () => {
        try {
            const data = await sellerEventApi.getReservations();
            setReservations(data);
        } catch (error) {
            console.error("Failed to fetch reservations", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        setActionLoading(true);
        try {
            await sellerEventApi.updateReservationStatus(id, status);
            // Update local state
            setReservations(prev => prev.map(r => r._id === id ? { ...r, status } : r));
            if (selectedRes?._id === id) {
                setSelectedRes({ ...selectedRes, status });
            }
        } catch (error) {
            alert('Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStreamSubmit = async () => {
        if (!liveStreamUrl) return;
        setIsLiveKitchenLoading(true);
        try {
            await axiosInstance.post('/kitchen/stream', { orderId: selectedRes._id, streamUrl: liveStreamUrl });
            alert('Live stream URL updated successfully!');
            setLiveStreamUrl('');
        } catch (error) {
            alert('Failed to update stream URL');
        } finally {
            setIsLiveKitchenLoading(false);
        }
    };

    const handlePhotoSubmit = async () => {
        if (!livePhoto) return;
        setIsLiveKitchenLoading(true);
        try {
            // First, upload the image to the generic media endpoint
            const formData = new FormData();
            formData.append('file', livePhoto);
            
            const uploadRes = await axiosInstance.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            const imageUrl = uploadRes.data?.url || uploadRes.data?.data?.url || uploadRes.data?.result?.url || uploadRes.data;

            if (typeof imageUrl !== 'string') {
                throw new Error("Invalid image URL received from upload endpoint");
            }

            // Save to Live Kitchen
            await axiosInstance.post('/kitchen/photo', { 
                orderId: selectedRes._id, 
                imageUrl: imageUrl, 
                description: livePhotoDescription 
            });

            alert('Photo uploaded successfully to Live Kitchen!');
            setLivePhoto(null);
            setLivePhotoDescription('');
        } catch (error) {
            console.error("Live Kitchen Upload Error:", error);
            alert('Failed to upload photo update. Please ensure the media endpoint is running.');
        } finally {
            setIsLiveKitchenLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <CircularProgress sx={{ color: '#ef4444' }} />
            </div>
        );
    }

    const filteredReservations = filter === 'all' ? reservations : reservations.filter(r => r.status === filter);

    const getStatusColor = (status) => {
        switch(status) {
            case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'confirmed': case 'active': return 'bg-green-100 text-green-700 border-green-200';
            case 'rejected': case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Event Reservations</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your event bookings and requests.</p>
                </div>
                
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    {['all', 'pending', 'confirmed', 'rejected', 'completed'].map(f => (
                        <button 
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                    {filteredReservations.map((res, i) => (
                        <motion.div 
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            key={res._id}
                            onClick={() => { setSelectedRes(res); setModalOpen(true); sessionStorage.setItem('openReservationId', res._id); }}
                            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow hover:border-red-200 group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border ${getStatusColor(res.status)}`}>
                                    {res.status}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">
                                    {new Date(res.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-1 group-hover:text-red-600 transition-colors">
                                {res.customerInfo?.name || "Customer Name"}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 mb-4">{res.customerInfo?.phone || "No Phone"} • {res.customerInfo?.email || "No Email"}</p>

                            <div className="space-y-2 mb-6">
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <HiOutlineCalendarDays className="w-5 h-5 text-slate-400" />
                                    <span className="font-medium">{new Date(res.eventDate).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <HiOutlineClock className="w-5 h-5 text-slate-400" />
                                    <span className="font-medium">{res.eventTime || "Time not specified"}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <HiOutlineUserGroup className="w-5 h-5 text-slate-400" />
                                    <span className="font-medium">{res.guestCount} Guests</span>
                                </div>
                            </div>

                            {res.status === 'pending' && (
                                <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(res._id, 'confirmed'); }}
                                        disabled={actionLoading}
                                        className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        <HiOutlineCheck className="w-5 h-5" /> Accept
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(res._id, 'rejected'); }}
                                        disabled={actionLoading}
                                        className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        <HiOutlineXMark className="w-5 h-5" /> Reject
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
                
                {filteredReservations.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <p className="text-slate-500 font-medium text-lg">No {filter !== 'all' ? filter : ''} reservations found.</p>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Dialog
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    sessionStorage.removeItem('openReservationId');
                }}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 4, padding: 1 } }}
            >
                {selectedRes && (
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">{selectedRes.customerInfo?.name}</h2>
                                <p className="text-slate-500 font-medium">{selectedRes.customerInfo?.phone} • {selectedRes.customerInfo?.email}</p>
                            </div>
                            <span className={`text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider border ${getStatusColor(selectedRes.status)}`}>
                                {selectedRes.status}
                            </span>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-5 space-y-4 mb-6 border border-slate-100">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                                    <p className="font-bold text-slate-700 flex items-center gap-2">
                                        <HiOutlineCalendarDays className="w-4 h-4 text-red-500" />
                                        {new Date(selectedRes.eventDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Time</p>
                                    <p className="font-bold text-slate-700 flex items-center gap-2">
                                        <HiOutlineClock className="w-4 h-4 text-red-500" />
                                        {selectedRes.eventTime}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Guests</p>
                                    <p className="font-bold text-slate-700 flex items-center gap-2">
                                        <HiOutlineUserGroup className="w-4 h-4 text-red-500" />
                                        {selectedRes.guestCount}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                                    <p className="font-bold text-slate-700 flex items-center gap-2">
                                        <HiOutlineMapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        <span className="truncate">{selectedRes.location?.address || "Not specified"}</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                                    <p className="font-bold text-slate-700 flex items-center gap-2">
                                        <span className="text-red-500 font-bold">₹</span>
                                        {selectedRes.amount || "N/A"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {selectedRes.customerPreferences && Object.keys(selectedRes.customerPreferences).length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">Customer Preferences</h3>
                                <div className="space-y-3">
                                    {Object.entries(selectedRes.customerPreferences).map(([key, value]) => (
                                        <div key={key} className="flex flex-col bg-white p-3 rounded-xl border border-slate-200">
                                            <span className="text-xs font-bold text-slate-400 capitalize mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            {typeof value === 'string' && (value.startsWith('http') || value.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                                                <a href={getResolvedImageUrl(value)} target="_blank" rel="noreferrer" className="block max-w-xs overflow-hidden rounded-lg border border-slate-100 shadow-sm mt-1 hover:opacity-90 transition-opacity">
                                                    <img src={getResolvedImageUrl(value)} alt={key} className="w-full h-auto object-cover max-h-48" onError={(e) => { e.target.style.display = 'none'; e.target.insertAdjacentHTML('afterend', `<span class="text-xs text-red-500">Image failed to load: ${value}</span>`); }} />
                                                </a>
                                            ) : key === "Theme Color" || (typeof value === 'string' && value.startsWith('#') && value.length === 7) ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-md shadow-sm border border-slate-200" style={{ backgroundColor: value }}></div>
                                                    <span className="text-sm font-bold text-slate-800 uppercase">{value}</span>
                                                </div>
                                            ) : typeof value === 'object' ? (
                                                // Handle corrupted old data fallback
                                                <div className="space-y-2 mt-1">
                                                    {Object.entries(value).map(([subKey, subVal]) => (
                                                        <div key={subKey}>
                                                            <span className="text-xs font-bold text-slate-500 capitalize">{subKey}: </span>
                                                            {typeof subVal === 'string' && subVal.startsWith('http') ? (
                                                                <a href={getResolvedImageUrl(subVal)} target="_blank" rel="noreferrer" className="inline-block mt-1">
                                                                    <img src={getResolvedImageUrl(subVal)} alt={subKey} className="w-32 h-auto object-cover rounded-lg border border-slate-200 shadow-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                                                                </a>
                                                            ) : subKey === "Theme Color" ? (
                                                                <div className="inline-flex items-center gap-2 align-middle">
                                                                    <div className="w-4 h-4 rounded shadow-sm border border-slate-200" style={{ backgroundColor: subVal }}></div>
                                                                    <span className="text-sm font-bold text-slate-800 uppercase">{subVal}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm font-medium text-slate-800">{String(subVal)}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-sm font-medium text-slate-800">
                                                    {String(value)}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* LIVE KITCHEN SECTION */}
                        {['confirmed', 'active'].includes(selectedRes.status) && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                    Live Kitchen Updates
                                </h3>
                                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    
                                    {/* Stream Update */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            <HiOutlineVideoCamera className="w-4 h-4" /> Live Stream URL
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                                            <input 
                                                type="text" 
                                                value={liveStreamUrl}
                                                onChange={(e) => setLiveStreamUrl(e.target.value)}
                                                placeholder="e.g., YouTube Live Link" 
                                                className="w-full flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                                            />
                                            <button 
                                                onClick={handleStreamSubmit}
                                                disabled={isLiveKitchenLoading || !liveStreamUrl}
                                                className="w-full sm:w-auto px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 shadow-sm"
                                            >
                                                Update
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-slate-200"></div>

                                    {/* Photo Update */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            <HiOutlineCamera className="w-4 h-4" /> Photo Update
                                        </label>
                                        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center w-full">
                                            <div className="flex items-center gap-2 w-full md:w-auto flex-1 overflow-hidden">
                                                <input 
                                                    type="file" 
                                                    accept="image/*"
                                                    onChange={(e) => setLivePhoto(e.target.files[0])}
                                                    className="w-full text-sm text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
                                                />
                                                {livePhoto && (
                                                    <img 
                                                        src={URL.createObjectURL(livePhoto)} 
                                                        alt="Preview" 
                                                        className="w-10 h-10 object-cover rounded-md border border-slate-200 shrink-0 shadow-sm"
                                                    />
                                                )}
                                            </div>
                                            <input 
                                                type="text" 
                                                value={livePhotoDescription}
                                                onChange={(e) => setLivePhotoDescription(e.target.value)}
                                                placeholder="Status (e.g. Preparing...)" 
                                                className="w-full md:flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                                            />
                                            <button 
                                                onClick={handlePhotoSubmit}
                                                disabled={isLiveKitchenLoading || !livePhoto}
                                                className="w-full md:w-auto px-5 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
                                            >
                                                {isLiveKitchenLoading ? "Uploading..." : "Upload"}
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}


                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => {
                                    setModalOpen(false);
                                    sessionStorage.removeItem('openReservationId');
                                }}
                                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors w-full"
                            >
                                Close
                            </button>
                            {selectedRes.status === 'pending' && (
                                <>
                                    <button 
                                        onClick={() => { 
                                            handleStatusUpdate(selectedRes._id, 'rejected'); 
                                            setModalOpen(false); 
                                            sessionStorage.removeItem('openReservationId');
                                        }}
                                        disabled={actionLoading}
                                        className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors w-full disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                    <button 
                                        onClick={() => { 
                                            handleStatusUpdate(selectedRes._id, 'confirmed'); 
                                            setModalOpen(false); 
                                            sessionStorage.removeItem('openReservationId');
                                        }}
                                        disabled={actionLoading}
                                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors w-full disabled:opacity-50"
                                    >
                                        Accept Booking
                                    </button>
                                </>
                            )}
                            {selectedRes.status === 'confirmed' && (
                                <button 
                                    onClick={() => { handleStatusUpdate(selectedRes._id, 'completed'); setModalOpen(false); }}
                                    disabled={actionLoading}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors w-full disabled:opacity-50"
                                >
                                    Mark as Completed
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default EventReservations;
