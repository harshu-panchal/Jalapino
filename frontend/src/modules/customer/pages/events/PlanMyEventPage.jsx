import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { eventConfigApi } from '../../services/eventConfigApi';
import MainLocationHeader from '../../components/shared/MainLocationHeader';

const PlanMyEventPage = () => {
    const navigate = useNavigate();
    const [eventData, setEventData] = useState({
        eventType: '',
        guestCount: '',
        budget: '',
        date: '',
        time: '',
        location: ''
    });
    const [eventTypes, setEventTypes] = useState([]);
    const [cities, setCities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLocationOpen, setIsLocationOpen] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const [typesRes, citiesRes] = await Promise.all([
                    eventConfigApi.getEventTypes(),
                    eventConfigApi.getCities()
                ]);
                // Sort event types alphabetically A-Z
                const sortedTypes = (typesRes || []).sort((a, b) => a.name.localeCompare(b.name));
                setEventTypes(sortedTypes);
                setCities(citiesRes || []);
            } catch (error) {
                console.error("Failed to fetch event configs:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []);

    // Close location dropdown when clicking outside
    useEffect(() => {
        const handleClick = () => setIsLocationOpen(false);
        if (isLocationOpen) {
            document.addEventListener('click', handleClick);
        }
        return () => document.removeEventListener('click', handleClick);
    }, [isLocationOpen]);

    const handleStartPlanning = () => {
        if (!eventData.eventType || !eventData.date || !eventData.guestCount) {
            alert("Please fill in event type, date, and guest count.");
            return;
        }
        navigate('/plan-my-event/categories', { state: { eventData } });
    };

    const sortedCities = [...cities]
        .filter(city => city.planMyEventEnabled !== false)
        .sort((a, b) => a.cityName.localeCompare(b.cityName));

    const selectedCity = cities.find(c => c.cityName === eventData.location);

    // Map event type values to emoji icons
    const typeIconMap = {
        wedding: '💒',
        birthday: '🎂',
        corporate: '🏢',
        house_party: '🏠',
        religious: '🛕',
    };

    const getIcon = (type) => {
        return typeIconMap[type.value] || type.icon || '🎉';
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <MainLocationHeader hideSearchBar={false} isAbsolute={false} />

            <div className="flex-1 w-full overflow-y-auto" style={{ paddingTop: 'var(--header-height, 180px)' }}>
                <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                    >
                        {/* Back to Home — top strip inside card */}
                        <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-purple-600 active:scale-95 transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Home
                            </button>
                            <span className="text-slate-300 text-xs">›</span>
                            <span className="text-sm font-bold text-slate-700">Plan My Event</span>
                        </div>

                        <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/30 shrink-0">
                                <EventIcon sx={{ color: 'white' }} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Event Details</h2>
                                <p className="text-sm text-slate-500">Tell us about your event to get started</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {/* ── Event Type Card Grid ── */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Event Type
                                </label>

                                {isLoading ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {[1, 2, 3, 4].map(i => (
                                            <div
                                                key={i}
                                                className="h-24 rounded-2xl bg-slate-100 animate-pulse"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {eventTypes.map((type, idx) => {
                                            const isSelected = eventData.eventType === type.value;
                                            return (
                                                <motion.button
                                                    key={type.value}
                                                    type="button"
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    whileTap={{ scale: 0.93 }}
                                                    onClick={() => setEventData(d => ({ ...d, eventType: type.value }))}
                                                    className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 cursor-pointer transition-all text-center
                                                        ${isSelected
                                                            ? 'border-purple-500 bg-purple-50 shadow-md shadow-purple-100'
                                                            : 'border-slate-200 bg-white hover:border-purple-200 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {/* Selected checkmark */}
                                                    {isSelected && (
                                                        <div className="absolute top-2 right-2 text-purple-500">
                                                            <CheckCircleIcon sx={{ fontSize: 18 }} />
                                                        </div>
                                                    )}

                                                    {/* Icon */}
                                                    <div className="text-3xl leading-none">
                                                        {(type.icon?.startsWith('http') || type.icon?.startsWith('/')) ? (
                                                            <img
                                                                src={type.icon}
                                                                alt={type.name}
                                                                className="w-10 h-10 object-cover rounded-lg"
                                                            />
                                                        ) : (
                                                            getIcon(type)
                                                        )}
                                                    </div>

                                                    {/* Name */}
                                                    <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-purple-700' : 'text-slate-600'}`}>
                                                        {type.name}
                                                    </span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* ── Date & Time ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm"
                                        value={eventData.date}
                                        onChange={(e) => setEventData(d => ({ ...d, date: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Time</label>
                                    <input
                                        type="time"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm"
                                        value={eventData.time}
                                        onChange={(e) => setEventData(d => ({ ...d, time: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* ── Guest Count & Budget ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Guest Count</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 50"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm"
                                        value={eventData.guestCount}
                                        onChange={(e) => setEventData(d => ({ ...d, guestCount: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Budget (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 50000"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm"
                                        value={eventData.budget}
                                        onChange={(e) => setEventData(d => ({ ...d, budget: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* ── Location Dropdown ── */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Location</label>
                                <div className="relative">
                                    <div
                                        onClick={(e) => { e.stopPropagation(); if (!isLoading) setIsLocationOpen(v => !v); }}
                                        className="w-full border border-slate-200 rounded-xl p-3 bg-white cursor-pointer flex justify-between items-center text-sm font-medium select-none"
                                    >
                                        <span className={selectedCity ? 'text-slate-800' : 'text-slate-400'}>
                                            {isLoading ? 'Loading...' : (selectedCity ? `${selectedCity.cityName}, ${selectedCity.state}` : 'Select City')}
                                        </span>
                                        <svg className={`w-4 h-4 text-slate-500 transition-transform duration-200 flex-shrink-0 ${isLocationOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                    {isLocationOpen && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto divide-y divide-slate-50"
                                            style={{ maxHeight: '210px', zIndex: 999 }}
                                        >
                                            {sortedCities.map(city => (
                                                <div
                                                    key={city._id}
                                                    onClick={() => { setEventData(d => ({ ...d, location: city.cityName })); setIsLocationOpen(false); }}
                                                    className={`px-4 py-3 text-sm cursor-pointer transition-colors ${eventData.location === city.cityName ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                                >
                                                    {city.cityName}, {city.state}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── CTA Buttons ── */}
                            <button
                                onClick={handleStartPlanning}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded-xl py-4 mt-2 shadow-lg shadow-purple-500/30 hover:scale-[1.02] transition-transform active:scale-95"
                            >
                                Start Planning
                            </button>

                            <button
                                onClick={() => navigate('/plan-my-event/venues')}
                                className="w-full bg-white border-2 border-purple-500 text-purple-600 font-bold rounded-xl py-4 hover:bg-purple-50 transition-colors active:scale-95"
                            >
                                Explore &amp; Visit Venues
                            </button>
                        </div>{/* end space-y-5 */}
                        </div>{/* end p-6 */}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default PlanMyEventPage;
