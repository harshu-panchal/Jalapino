import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilterListIcon from '@mui/icons-material/FilterList';
import PeopleIcon from '@mui/icons-material/People';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import BusinessIcon from '@mui/icons-material/Business';
import { venueApi } from '../../services/venueApi';
import { eventConfigApi } from '../../services/eventConfigApi';
import { toast } from 'sonner';

const VenueDiscovery = () => {
    const navigate = useNavigate();
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedState, setSelectedState] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [guestCountFilter, setGuestCountFilter] = useState('');
    const [venues, setVenues] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedVenues, setSelectedVenues] = useState([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const isRequestModalOpen = searchParams.get('requestVisit') === 'true';
    const setIsRequestModalOpen = (isOpen) => {
        const params = {};
        for (const [key, val] of searchParams.entries()) {
            params[key] = val;
        }
        if (isOpen) {
            params.requestVisit = 'true';
        } else {
            delete params.requestVisit;
        }
        setSearchParams(params);
    };

    useEffect(() => {
        const ids = selectedVenues.map(v => v._id).join(',');
        const params = {};
        for (const [key, val] of searchParams.entries()) {
            params[key] = val;
        }
        if (ids) {
            params.selectedVenues = ids;
        } else {
            delete params.selectedVenues;
        }
        setSearchParams(params);
    }, [selectedVenues]);

    useEffect(() => {
        const idsString = searchParams.get('selectedVenues');
        if (idsString && venues.length > 0 && selectedVenues.length === 0) {
            const ids = idsString.split(',').filter(Boolean);
            const matched = venues.filter(v => ids.includes(v._id));
            if (matched.length > 0) {
                setSelectedVenues(matched);
            }
        }
    }, [venues]);

    // Request Form State
    const [visitDate, setVisitDate] = useState('');
    const [visitTimeSlot, setVisitTimeSlot] = useState('');
    const [guestCount, setGuestCount] = useState('');
    const [eventType, setEventType] = useState('');
    const [notes, setNotes] = useState('');
    const [eventTypes, setEventTypes] = useState([]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [citiesRes, typesRes] = await Promise.all([
                    eventConfigApi.getCities(),
                    eventConfigApi.getEventTypes()
                ]);
                setCities(citiesRes || []);
                setEventTypes(typesRes || []);
                
                // Extract unique states
                const uniqueStates = [...new Set((citiesRes || []).map(c => c.state))];
                setStates(uniqueStates);
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadInitialData();
    }, []);

    const fetchVenues = async () => {
        setIsLoading(true);
        try {
            const res = await venueApi.searchVenues({
                state: selectedState,
                city: selectedCity,
                guestCount: guestCountFilter
            });
            setVenues(res.data.results || res.data.result || []);
        } catch (err) {
            toast.error("Failed to load venues");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVenues();
    }, [selectedState, selectedCity, guestCountFilter]);

    const handleSelectVenue = (venue) => {
        const isSelected = selectedVenues.some(v => v._id === venue._id);
        if (isSelected) {
            setSelectedVenues(selectedVenues.filter(v => v._id !== venue._id));
        } else {
            if (selectedVenues.length >= 3) {
                toast.warning("You can select a maximum of 3 venues for a physical visit request.");
                return;
            }
            setSelectedVenues([...selectedVenues, venue]);
        }
    };

    const handleSubmitRequests = async (e) => {
        e.preventDefault();
        if (!visitDate || !visitTimeSlot || !guestCount || !eventType) {
            toast.error("Please fill all required fields.");
            return;
        }

        try {
            const payload = {
                venueIds: selectedVenues.map(v => v._id),
                preferredDate: visitDate,
                preferredTimeSlot: visitTimeSlot,
                guestCount: Number(guestCount),
                eventType,
                notes
            };

            await venueApi.createVisitRequests(payload);
            toast.success("Physical visit requests submitted successfully!");
            setIsRequestModalOpen(false);
            setSelectedVenues([]);
            navigate('/profile/visit-requests');
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to submit requests");
        }
    };

    const [showHeader, setShowHeader] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY < 10) {
                setShowHeader(true);
            } else if (currentScrollY > lastScrollY) {
                setShowHeader(false);
            } else {
                setShowHeader(true);
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Sticky Header */}
            <div className={`sticky top-0 bg-white z-40 border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/plan-my-event')} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowBackIcon />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-800">Banquet & Venue Discovery</h1>
                        <p className="text-xs text-slate-500 font-medium">Select 2-3 venues to request physical visits</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)} 
                    className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${isFilterOpen ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                >
                    <FilterListIcon fontSize="small" />
                    <span className="text-xs font-bold">Filters</span>
                </button>
            </div>

            {/* Filters Section */}
            {isFilterOpen && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-white border-b border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">State</label>
                        <select 
                            value={selectedState} 
                            onChange={(e) => { setSelectedState(e.target.value); setSelectedCity(''); }}
                            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                        >
                            <option value="">All States</option>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">City</label>
                        <select 
                            value={selectedCity} 
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                        >
                            <option value="">All Cities</option>
                            {cities.filter(c => !selectedState || c.state === selectedState).map(c => (
                                <option key={c._id} value={c.cityName}>{c.cityName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Guest Count</label>
                        <input 
                            type="number" 
                            placeholder="e.g. 150"
                            value={guestCountFilter}
                            onChange={(e) => setGuestCountFilter(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                        />
                    </div>
                </motion.div>
            )}

            {/* Venues Grid */}
            <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-28">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-semibold text-slate-500 mt-4">Searching premium venues...</p>
                    </div>
                ) : venues.length === 0 ? (
                    <div className="text-center py-20">
                        <BusinessIcon className="text-slate-300 mb-4" sx={{ fontSize: 60 }} />
                        <h3 className="text-lg font-black text-slate-800">No Venues Found</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Try resetting the filters or choosing another city.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {venues.map((venue) => {
                            const isSelected = selectedVenues.some(v => v._id === venue._id);
                            return (
                                <motion.div 
                                    key={venue._id} 
                                    layout
                                    className={`bg-white rounded-3xl overflow-hidden border-2 transition-all cursor-pointer shadow-sm hover:shadow-md relative flex flex-col ${isSelected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-100'}`}
                                    onClick={() => handleSelectVenue(venue)}
                                >
                                    {/* Selection Badge */}
                                    {isSelected && (
                                        <div className="absolute top-4 right-4 bg-slate-900 text-white p-1 rounded-full z-10 shadow-lg">
                                            <CheckCircleIcon fontSize="small" />
                                        </div>
                                    )}

                                    {/* Venue Image */}
                                    <div className="h-48 w-full bg-slate-100 relative">
                                        <img 
                                            src={venue.mainImage || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80'} 
                                            alt={venue.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-slate-800 flex items-center gap-1.5 shadow-sm">
                                            <PeopleIcon sx={{ fontSize: 14 }} />
                                            <span>Cap: {venue.capacityMin} - {venue.capacityMax} Pax</span>
                                        </div>
                                    </div>

                                    {/* Content Info */}
                                    <div className="p-5 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-black text-slate-900 text-base line-clamp-1">{venue.name}</h3>
                                            </div>
                                            <p className="text-xs text-slate-500 font-bold mb-3 flex items-center gap-1">
                                                <LocationOnIcon sx={{ fontSize: 13 }} />
                                                <span className="line-clamp-1">{venue.venueAddress || venue.sellerId?.address || 'Address not listed'}, {venue.venueCity || 'City'}</span>
                                            </p>

                                            <p className="text-xs text-slate-600 font-medium line-clamp-2 mb-4">
                                                {venue.description || 'Stunning venue space perfect for events, weddings, and premium gatherings.'}
                                            </p>
                                        </div>

                                        {/* Facilities/Tags */}
                                        <div>
                                            {venue.facilities && venue.facilities.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-4">
                                                    {venue.facilities.slice(0, 3).map((f, i) => (
                                                        <span key={i} className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-slate-400">Seller</p>
                                                    <p className="text-xs font-bold text-slate-700 line-clamp-1">{venue.sellerId?.shopName || 'Premium Seller'}</p>
                                                </div>
                                                <button 
                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${isSelected ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'}`}
                                                >
                                                    {isSelected ? 'Selected' : 'Select Venue'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Bar Selection drawer */}
            {selectedVenues.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] p-4 z-40 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-black">
                            {selectedVenues.length}
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-800">Venues Selected</p>
                            <p className="text-xs text-slate-500 font-bold">You can select up to 3 venues for separate visit requests.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button 
                            onClick={() => setSelectedVenues([])}
                            className="flex-1 sm:flex-none px-6 py-3 border border-slate-200 text-slate-700 text-xs font-black rounded-2xl hover:bg-slate-50"
                        >
                            Clear
                        </button>
                        {selectedVenues.length === 1 && selectedVenues[0]?.sellerId?.ticketSystemEnabled !== false && (
                            <button 
                                onClick={() => {
                                    const venueObj = selectedVenues[0];
                                    navigate('/plan-my-event/booking', { state: { venue: venueObj } });
                                }}
                                className="flex-1 sm:flex-none px-8 py-3 bg-purple-600 text-white text-xs font-black rounded-2xl shadow-lg shadow-purple-600/20 hover:bg-purple-700"
                            >
                                Book Tickets
                            </button>
                        )}
                        {selectedVenues.every(v => v.sellerId?.bookingSlotsEnabled === true) && (
                            <button 
                                onClick={() => setIsRequestModalOpen(true)}
                                className="flex-1 sm:flex-none px-8 py-3 bg-slate-900 text-white text-xs font-black rounded-2xl shadow-lg shadow-slate-900/10 hover:bg-black"
                            >
                                Request Visits
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Request Booking Modal */}
            <AnimatePresence>
                {isRequestModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-slate-800">Request Physical Visits</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Separate visit requests will be created for the {selectedVenues.length} selected venues.</p>
                                </div>
                                <button 
                                    onClick={() => setIsRequestModalOpen(false)}
                                    className="p-1 rounded-full hover:bg-slate-100 text-slate-500 font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Modal Body Form */}
                            <form onSubmit={handleSubmitRequests} className="p-6 space-y-4 overflow-y-auto flex-1">
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Preferred Date *</label>
                                    <div className="relative">
                                        <CalendarMonthIcon className="absolute left-3 top-3 text-slate-400" fontSize="small" />
                                        <input 
                                            type="date"
                                            required
                                            value={visitDate}
                                            onChange={(e) => setVisitDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 text-slate-700 bg-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Preferred Time Slot *</label>
                                    <div className="relative">
                                        <AccessTimeIcon className="absolute left-3 top-3 text-slate-400" fontSize="small" />
                                        <select 
                                            required
                                            value={visitTimeSlot}
                                            onChange={(e) => setVisitTimeSlot(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 text-slate-700 bg-white"
                                        >
                                            <option value="">Select Time Slot</option>
                                            <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                                            <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM</option>
                                            <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM</option>
                                            <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Guest Count *</label>
                                        <input 
                                            type="number"
                                            required
                                            min="1"
                                            placeholder="e.g. 150"
                                            value={guestCount}
                                            onChange={(e) => setGuestCount(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Event Type *</label>
                                        <select 
                                            required
                                            value={eventType}
                                            onChange={(e) => setEventType(e.target.value)}
                                            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900 text-slate-700 bg-white"
                                        >
                                            <option value="">Select Event</option>
                                            {eventTypes.map(t => <option key={t.value} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">Optional Notes</label>
                                    <textarea 
                                        placeholder="Add any specific instructions, requirements or queries for the venue owners..."
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                                    />
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-4 flex gap-3">
                                    <InfoIcon className="text-slate-400 mt-0.5" fontSize="small" />
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                        Once submitted, requests are sent to each seller separately. Sellers can approve the visit date directly or suggest a reschedule if they are unavailable.
                                    </p>
                                </div>

                                {/* Modal Footer */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsRequestModalOpen(false)}
                                        className="flex-1 py-3 border border-slate-200 text-slate-700 text-xs font-black rounded-2xl hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 py-3 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-black"
                                    >
                                        Submit Visit Request
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VenueDiscovery;
