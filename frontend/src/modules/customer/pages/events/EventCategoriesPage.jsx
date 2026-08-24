import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';
import CircularProgress from '@mui/material/CircularProgress';
import { eventConfigApi } from '../../services/eventConfigApi';
import MainLocationHeader from '../../components/shared/MainLocationHeader';
import { resolveImageUrl } from '@/core/utils/imageUtils';

// Custom colors mapping based on category names for premium sidebar aesthetics
const getCategoryStyle = (name = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('decor')) return { bg: '#EF4444', text: '#FFFFFF', border: 'border-red-500' }; // Red
    if (lower.includes('dj')) return { bg: '#FACC15', text: '#0F172A', border: 'border-yellow-450' }; // Yellow
    if (lower.includes('photograph')) return { bg: '#22C55E', text: '#FFFFFF', border: 'border-green-500' }; // Green
    if (lower.includes('banquet')) return { bg: '#2563EB', text: '#FFFFFF', border: 'border-blue-600' }; // Blue
    if (lower.includes('cater')) return { bg: '#8B5CF6', text: '#FFFFFF', border: 'border-purple-600' }; // Purple
    if (lower.includes('water park')) return { bg: '#38BDF8', text: '#FFFFFF', border: 'border-sky-400' }; // Light Blue
    if (lower.includes('game')) return { bg: '#84CC16', text: '#FFFFFF', border: 'border-lime-500' }; // Light Green
    if (lower.includes('restaur')) return { bg: '#F97316', text: '#FFFFFF', border: 'border-orange-500' }; // Orange
    if (lower.includes('marriage')) return { bg: '#06B6D4', text: '#FFFFFF', border: 'border-cyan-500' }; // Sky Blue
    if (lower.includes('makeup') || lower.includes('bridal')) return { bg: '#D97706', text: '#FFFFFF', border: 'border-amber-600' }; // Gold
    
    // Default fallback
    return { bg: '#64748B', text: '#FFFFFF', border: 'border-slate-500' };
};

const EventCategoriesPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState(null);
    
    const [sellers, setSellers] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);
    const [isLoadingSellers, setIsLoadingSellers] = useState(false);
    const [banners, setBanners] = useState([]);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    
    const [eventTypes, setEventTypes] = useState([]);
    const [eventParams, setEventParams] = useState(state?.eventData || {
        eventType: '',
        guestCount: '',
        budget: '',
        date: '',
        time: '',
        location: ''
    });

    useEffect(() => {
        // Single-page design: categories are now on the main plan-my-event page
        navigate('/plan-my-event', { replace: true });
    }, [navigate]);

    // Auto rotate banners
    useEffect(() => {
        if (banners.length > 1) {
            const timer = setInterval(() => {
                setCurrentBannerIndex(prev => (prev + 1) % banners.length);
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [banners]);

    // Fetch sellers dynamically when active category or eventParams changes
    useEffect(() => {
        if (activeCategory && eventParams) {
            const fetchSellers = async () => {
                setIsLoadingSellers(true);
                try {
                    const params = {
                        date: eventParams.date,
                        time: eventParams.time,
                        guestCount: eventParams.guestCount,
                        location: eventParams.location,
                        categories: [activeCategory._id]
                    };
                    const result = await eventConfigApi.searchSellers(params);
                    setSellers(result || []);
                } catch (error) {
                    console.error("Failed to fetch sellers:", error);
                } finally {
                    setIsLoadingSellers(false);
                }
            };
            fetchSellers();
        }
    }, [activeCategory, eventParams]);

    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSellerClick = (seller) => {
        // Direct flow to detailed seller customization/product list page
        navigate('/plan-my-event/seller-detail', { 
            state: { 
                eventData: eventParams, 
                preferences: { [activeCategory._id]: {} }, 
                selectedCategories: [activeCategory._id], 
                selectedSeller: seller 
            } 
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Main Application Header */}
            <MainLocationHeader hideSearchBar={false} isAbsolute={false} />

            {/* Main Layout Workspace with header padding */}
            <div className="flex-1 flex overflow-hidden w-full" style={{ paddingTop: 'var(--header-height, 180px)' }}>
                {/* Left Sidebar: Categories */}
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
                    {/* Search Engine Category */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                                <SearchIcon sx={{ fontSize: 18 }} />
                            </span>
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white outline-none transition-all placeholder:text-slate-400"
                                placeholder="Category (Search Engine)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Scrollable Categories List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {isLoadingCategories ? (
                            <div className="flex justify-center py-10">
                                <CircularProgress size={24} sx={{ color: '#8b5cf6' }} />
                            </div>
                        ) : filteredCategories.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                No categories found
                            </div>
                        ) : (
                            filteredCategories.map(cat => {
                                const isActive = activeCategory?._id === cat._id;
                                const style = getCategoryStyle(cat.name);
                                return (
                                    <button
                                        key={cat._id}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border-2 text-left font-bold ${
                                            isActive
                                                ? 'border-slate-800 shadow-md scale-[1.01] ring-2 ring-purple-400/50'
                                                : 'border-transparent opacity-90 hover:opacity-100'
                                        }`}
                                        style={{
                                            backgroundColor: style.bg,
                                            color: style.text
                                        }}
                                    >
                                        <div className="text-2xl w-10 h-10 flex items-center justify-center overflow-hidden rounded-lg bg-white/20">
                                            {(cat.icon?.startsWith('http') || cat.icon?.startsWith('/')) ? (
                                                <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                                            ) : (
                                                cat.icon || '🎉'
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm tracking-wide">{cat.name}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Area: Banner & Sellers list */}
                <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
                    {/* Top Banner */}
                    {banners.length > 0 ? (
                        <div className="p-6 pb-2 shrink-0">
                            <div className="w-full aspect-[1448/450] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.03)] bg-white relative overflow-hidden">
                                <div 
                                    className="w-full h-full flex transition-transform duration-500 ease-out" 
                                    style={{ transform: `translateX(-${currentBannerIndex * 100}%)` }}
                                >
                                    {banners.map((banner, idx) => (
                                        <div key={banner._id || idx} className="w-full h-full flex-shrink-0 relative">
                                            <img
                                                src={resolveImageUrl(banner.imageUrl)}
                                                alt={banner.title || "Event Banner"}
                                                className="w-full h-full object-cover object-top rounded-2xl"
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
                                <div className="absolute inset-0 border border-[var(--customer-header-base-color)]/15 rounded-2xl pointer-events-none" />
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 pb-2 shrink-0">
                            <div className="relative h-44 rounded-2xl overflow-hidden shadow-sm bg-gradient-to-r from-purple-600 to-indigo-700 text-white flex items-center p-8">
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                                <div className="relative z-10 max-w-lg">
                                    <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm">
                                        {activeCategory ? activeCategory.name : 'Event Planner'}
                                    </span>
                                    <h2 className="text-2xl font-black mt-3 leading-tight">
                                        Book Top Rated {activeCategory ? activeCategory.name : 'Services'}
                                    </h2>
                                    <p className="text-purple-100 text-xs mt-1 font-medium">
                                        Verified vendors offering instant availability and custom quotes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Event Type & Date & Time Slot Filters */}
                    <div className="mx-6 mt-2 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Event Type</label>
                                <select
                                    value={eventParams.eventType}
                                    onChange={(e) => setEventParams(prev => ({ ...prev, eventType: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-sm font-semibold bg-slate-50 text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
                                >
                                    {eventTypes.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="md:col-span-2 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                                    <input
                                        type="date"
                                        value={eventParams.date}
                                        onChange={(e) => setEventParams(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-sm font-semibold bg-slate-50 text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Time</label>
                                    <input
                                        type="time"
                                        value={eventParams.time}
                                        onChange={(e) => setEventParams(prev => ({ ...prev, time: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl p-2.5 outline-none text-sm font-semibold bg-slate-50 text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sellers Area */}
                    <div className="p-6 flex-1">
                        {isLoadingSellers ? (
                            <div className="flex flex-col items-center justify-center py-24">
                                <CircularProgress sx={{ color: '#8b5cf6' }} />
                                <p className="text-slate-500 font-medium mt-4">Searching available providers...</p>
                            </div>
                        ) : sellers.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <StorefrontIcon sx={{ color: '#94a3b8', fontSize: 32 }} />
                                </div>
                                <h3 className="text-base font-bold text-slate-800 mb-1">No Providers Available</h3>
                                <p className="text-slate-500 text-xs max-w-xs mx-auto">
                                    We couldn't find any active providers for "{activeCategory?.name}" in this area.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                        {sellers.length} verified providers for {activeCategory?.name}
                                    </h3>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sellers.map(seller => (
                                        <motion.div
                                            whileHover={{ y: -2 }}
                                            key={seller._id}
                                            onClick={() => handleSellerClick(seller)}
                                            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-base text-slate-800 leading-tight">
                                                            {seller.shopName || seller.name}
                                                        </h4>
                                                        <p className="text-xs text-slate-400 mt-0.5">{seller.address?.city || eventData?.location}</p>
                                                    </div>
                                                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                                        Active
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-3 mt-4 text-xs font-semibold text-slate-600">
                                                    {seller.reliabilityScore !== undefined && (
                                                        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-100">
                                                            ⭐ {seller.reliabilityScore}% Match
                                                        </span>
                                                    )}
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                                                        Cap: {seller.minGuestCapacity || 1} - {seller.maxGuestCapacity || 'Any'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                                                    View Packages & Rates →
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventCategoriesPage;
