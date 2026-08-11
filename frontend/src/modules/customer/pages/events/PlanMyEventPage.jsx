import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { eventConfigApi } from '../../services/eventConfigApi';
import MainLocationHeader from '../../components/shared/MainLocationHeader';
import { resolveImageUrl } from '@/core/utils/imageUtils';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [banners, setBanners] = useState([]);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const [typesRes, citiesRes, bannersRes] = await Promise.all([
                    eventConfigApi.getEventTypes(),
                    eventConfigApi.getCities(),
                    eventConfigApi.getEventBanners('plan_my_event')
                ]);
                // Sort event types alphabetically A-Z
                const sortedTypes = (typesRes || []).sort((a, b) => a.name.localeCompare(b.name));
                setEventTypes(sortedTypes);
                setCities(citiesRes || []);
                setBanners(bannersRes || []);
            } catch (error) {
                console.error("Failed to fetch event configs:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []);

    // Auto rotate banners
    useEffect(() => {
        if (banners.length > 1) {
            const timer = setInterval(() => {
                setCurrentBannerIndex(prev => (prev + 1) % banners.length);
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [banners]);

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

    const filteredEventTypes = eventTypes.filter(type =>
        (type.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <MainLocationHeader hideSearchBar={false} isAbsolute={false} />

            <div className="flex-1 w-full overflow-y-auto" style={{ paddingTop: 'var(--header-height, 180px)' }}>
                {/* Banners Slider */}
                {banners.length > 0 && (
                    <div className="w-[92vw] max-w-[1400px] mx-auto px-2 md:px-4 pt-4 mb-4">
                        <div className="w-full aspect-[1448/450] rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.03)] bg-white relative overflow-hidden">
                            <div 
                                className="w-full h-full flex transition-transform duration-500 ease-out" 
                                style={{ transform: `translateX(-${currentBannerIndex * 100}%)` }}
                            >
                                {banners.map((banner, idx) => (
                                    <div key={banner._id || idx} className="w-full h-full flex-shrink-0 relative">
                                        <img
                                            src={resolveImageUrl(banner.imageUrl)}
                                            alt={banner.title || "Plan My Event Banner"}
                                            className="w-full h-full object-cover object-top rounded-3xl"
                                        />
                                    </div>
                                ))}
                            </div>
                            {banners.length > 1 && (
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                                    {banners.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentBannerIndex(idx)}
                                            className={`w-2 h-2 rounded-full transition-all ${currentBannerIndex === idx ? 'bg-purple-600 w-4' : 'bg-slate-350'}`}
                                        />
                                    ))}
                                </div>
                            )}
                            {/* Subtle burgundy border overlay */}
                            <div className="absolute inset-0 border border-[var(--customer-header-base-color)]/15 rounded-3xl pointer-events-none" />
                        </div>
                    </div>
                )}

                <div className="max-w-5xl mx-auto px-4 pt-2 pb-24">
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

                        <div className="p-6 md:p-8">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                {/* Left Side: Event Type (Categories) */}
                                <div className="md:col-span-5 md:border-r border-slate-100 md:pr-8">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/30 shrink-0">
                                            <EventIcon sx={{ color: 'white', fontSize: 20 }} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">Event Type</h2>
                                            <p className="text-xs text-slate-500">Select your category</p>
                                        </div>
                                    </div>

                                    {/* Search Bar for Event Type Category */}
                                    <div className="relative mb-4">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </span>
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Search category..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {isLoading ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1">
                                            {filteredEventTypes.map((type, idx) => {
                                                const isSelected = eventData.eventType === type.value;
                                                return (
                                                    <button
                                                        key={type.value}
                                                        type="button"
                                                        onClick={() => setEventData({ ...eventData, eventType: type.value })}
                                                        className={`relative flex items-center gap-4 p-3.5 rounded-xl border-2 cursor-pointer transition-all text-left w-full active:scale-[0.98]
                                                            ${isSelected
                                                                ? 'border-purple-500 bg-purple-50/70 shadow-sm font-bold'
                                                                : 'border-slate-150 bg-white hover:border-purple-200 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {/* Selected checkmark */}
                                                        {isSelected && (
                                                            <div className="absolute right-3 text-purple-500">
                                                                <CheckCircleIcon sx={{ fontSize: 18 }} />
                                                            </div>
                                                        )}

                                                        {/* Icon */}
                                                        <div className="text-2xl leading-none w-10 h-10 flex items-center justify-center bg-slate-50 rounded-lg">
                                                            {(type.icon?.startsWith('http') || type.icon?.startsWith('/')) ? (
                                                                <img
                                                                    src={type.icon}
                                                                    alt={type.name}
                                                                    className="w-8 h-8 object-cover rounded"
                                                                 />
                                                            ) : (
                                                                getIcon(type)
                                                            )}
                                                        </div>

                                                        {/* Name */}
                                                        <span className={`text-sm font-bold ${isSelected ? 'text-purple-700' : 'text-slate-600'}`}>
                                                            {type.name}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Event Details */}
                                <div className="md:col-span-7 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-800">Event Details</h2>
                                                <p className="text-xs text-slate-500">Provide details to customize your plan</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Date & Time */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                                                    <input
                                                        type="date"
                                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm font-semibold"
                                                        value={eventData.date}
                                                        onChange={(e) => setEventData(d => ({ ...d, date: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Time</label>
                                                    <input
                                                        type="time"
                                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm font-semibold"
                                                        value={eventData.time}
                                                        onChange={(e) => setEventData(d => ({ ...d, time: e.target.value }))}
                                                    />
                                                </div>
                                            </div>

                                            {/* Guest Count & Budget */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Guest Count</label>
                                                    <input
                                                        type="number"
                                                        placeholder="e.g. 50"
                                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm font-semibold"
                                                        value={eventData.guestCount}
                                                        onChange={(e) => setEventData(d => ({ ...d, guestCount: e.target.value }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Budget (₹)</label>
                                                    <input
                                                        type="number"
                                                        placeholder="e.g. 50000"
                                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800 text-sm font-semibold"
                                                        value={eventData.budget}
                                                        onChange={(e) => setEventData(d => ({ ...d, budget: e.target.value }))}
                                                    />
                                                </div>
                                            </div>

                                            {/* Location */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
                                                <div className="relative">
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); if (!isLoading) setIsLocationOpen(v => !v); }}
                                                        className="w-full border border-slate-200 rounded-xl p-3 bg-white cursor-pointer flex justify-between items-center text-sm font-semibold select-none"
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
                                                            style={{ maxHeight: '180px', zIndex: 999 }}
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
                                        </div>
                                    </div>

                                    {/* CTA Buttons */}
                                    <div className="mt-8 space-y-3">
                                        <button
                                            onClick={handleStartPlanning}
                                            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded-xl py-4 shadow-lg shadow-purple-500/30 hover:scale-[1.01] transition-transform active:scale-95 text-sm uppercase tracking-wider"
                                        >
                                            Start Planning
                                        </button>

                                        <button
                                            onClick={() => navigate('/plan-my-event/venues')}
                                            className="w-full bg-white border-2 border-purple-500 text-purple-600 font-bold rounded-xl py-4 hover:bg-purple-50 transition-colors active:scale-95 text-sm uppercase tracking-wider"
                                        >
                                            Explore &amp; Visit Venues
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default PlanMyEventPage;
