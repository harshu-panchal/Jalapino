import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CircularProgress from '@mui/material/CircularProgress';
import EventIcon from '@mui/icons-material/Event';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { eventConfigApi } from '../../services/eventConfigApi';
import EventSellerDetailPage from './EventSellerDetailPage';
import MainLocationHeader from '../../components/shared/MainLocationHeader';
import { resolveImageUrl } from '@/core/utils/imageUtils';
import axiosInstance from '@core/api/axios';

/* ── category color map (same as EventCategoriesPage) ── */
const getCategoryStyle = (name = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('decor'))      return { bg: '#EF4444', text: '#FFFFFF' };
    if (lower.includes('dj'))         return { bg: '#FACC15', text: '#0F172A' };
    if (lower.includes('photograph')) return { bg: '#22C55E', text: '#FFFFFF' };
    if (lower.includes('banquet'))    return { bg: '#2563EB', text: '#FFFFFF' };
    if (lower.includes('cater'))      return { bg: '#8B5CF6', text: '#FFFFFF' };
    if (lower.includes('water park')) return { bg: '#38BDF8', text: '#FFFFFF' };
    if (lower.includes('game'))       return { bg: '#84CC16', text: '#FFFFFF' };
    if (lower.includes('restaur'))    return { bg: '#F97316', text: '#FFFFFF' };
    if (lower.includes('marriage'))   return { bg: '#06B6D4', text: '#FFFFFF' };
    if (lower.includes('makeup') || lower.includes('bridal')) return { bg: '#D97706', text: '#FFFFFF' };
    return { bg: '#64748B', text: '#FFFFFF' };
};

/* ── SellerCard with products ── */
const SellerCard = ({ seller, activeCategory, eventParams, onSelect }) => {
    const [products, setProducts]       = useState([]);
    const [loadingProd, setLoadingProd] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchProducts = async () => {
            setLoadingProd(true);
            try {
                const res = await axiosInstance.get(`/products?sellerId=${seller._id}&limit=4`);
                const data = res.data?.results || res.data?.result || res.data?.data || [];
                if (!cancelled) setProducts(Array.isArray(data) ? data.slice(0, 4) : []);
            } catch {
                if (!cancelled) setProducts([]);
            } finally {
                if (!cancelled) setLoadingProd(false);
            }
        };
        fetchProducts();
        return () => { cancelled = true; };
    }, [seller._id]);

    const catStyle = getCategoryStyle(activeCategory?.name || '');

    return (
        <motion.div
            whileHover={{ y: -3, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => onSelect(seller)}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm cursor-pointer overflow-hidden flex flex-col"
        >
            {/* Seller Header */}
            <div
                className="px-4 pt-4 pb-3 flex items-center justify-between"
                style={{ borderBottom: `3px solid ${catStyle.bg}` }}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-lg"
                        style={{ background: catStyle.bg, color: catStyle.text }}
                    >
                        {(seller.shopName || seller.name || 'S')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm leading-tight truncate">
                            {seller.shopName || seller.name || 'Unnamed Shop'}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {seller.address?.city || seller.city || ''}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    {seller.isAvailable !== false ? (
                        <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold">
                            Available
                        </span>
                    ) : (
                        <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-bold">
                            Booked
                        </span>
                    )}
                    {seller.reliabilityScore !== undefined && (
                        <span className="text-[10px] text-amber-600 font-bold">
                            ⭐ {seller.reliabilityScore}%
                        </span>
                    )}
                </div>
            </div>

            {/* Products Row */}
            <div className="px-4 py-3 flex-1">
                {loadingProd ? (
                    <div className="flex items-center gap-2 py-2">
                        <CircularProgress size={14} sx={{ color: '#8b5cf6' }} />
                        <span className="text-[11px] text-slate-400">Loading products...</span>
                    </div>
                ) : products.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-1">No products listed yet.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {products.map((product) => (
                            <div
                                key={product._id}
                                className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-100"
                            >
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                                    {product.mainImage ? (
                                        <img
                                            src={resolveImageUrl(product.mainImage)}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">📦</div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold text-slate-700 truncate leading-tight">{product.name}</p>
                                    {product.price !== undefined && (
                                        <p className="text-[10px] text-purple-600 font-bold">₹{product.price}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer CTA */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                    Cap: {seller.maxGuestCapacity || '—'} guests
                </span>
                <span className="text-[11px] font-bold text-purple-600 flex items-center gap-1">
                    View Details <ArrowForwardIosIcon sx={{ fontSize: 10 }} />
                </span>
            </div>
        </motion.div>
    );
};


/* ════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════ */
const PlanMyEventPage = () => {
    const navigate = useNavigate();

    /* — left sidebar — */
    const [categories,     setCategories]     = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [catSearch,      setCatSearch]      = useState('');
    const [loadingCats,    setLoadingCats]    = useState(true);

    /* — top filters — */
    const [eventTypes,    setEventTypes]    = useState([]);
    const [selectedType,  setSelectedType]  = useState('');
    const [filterDate,    setFilterDate]    = useState('');
    const [filterTime,    setFilterTime]    = useState('');

    /* — right panel sellers — */
    const [sellers,       setSellers]       = useState([]);
    const [loadingSellers, setLoadingSellers] = useState(false);

    /* — unified search (seller / product) — */
    const [globalSearch, setGlobalSearch] = useState('');

    /* — inline detail view — */
    const [selectedSellerDetail, setSelectedSellerDetail] = useState(null);

    /* — banners — */
    const [banners,           setBanners]           = useState([]);
    const [currentBannerIdx,  setCurrentBannerIdx]  = useState(0);

    /* ── initial data load ── */
    useEffect(() => {
        const load = async () => {
            try {
                const [catRes, typesRes, bannersRes] = await Promise.all([
                    eventConfigApi.getEventCategories(),
                    eventConfigApi.getEventTypes(),
                    eventConfigApi.getEventBanners('plan_my_event'),
                ]);

                const sorted = (Array.isArray(catRes) ? catRes : [])
                    .sort((a, b) => {
                        const diff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
                        return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
                    });

                setCategories(sorted);
                if (sorted.length > 0) setActiveCategory(sorted[0]);

                setEventTypes(Array.isArray(typesRes) ? typesRes : []);
                if (typesRes?.length > 0) setSelectedType(typesRes[0].value || typesRes[0]._id);

                setBanners(Array.isArray(bannersRes) ? bannersRes : []);
            } catch (err) {
                console.error('Failed to load plan-my-event data:', err);
            } finally {
                setLoadingCats(false);
            }
        };
        load();
    }, []);

    /* ── banner auto-rotate ── */
    useEffect(() => {
        if (banners.length <= 1) return;
        const t = setInterval(() => setCurrentBannerIdx(p => (p + 1) % banners.length), 4000);
        return () => clearInterval(t);
    }, [banners]);

    /* ── fetch sellers when category / date / time changes ── */
    const fetchSellers = useCallback(async (cat, date, time) => {
        if (!cat) return;
        setLoadingSellers(true);
        try {
            const params = new URLSearchParams({ categories: cat._id });
            if (date) params.append('date', date);
            if (time) params.append('time', time);
            const res = await axiosInstance.get(`/events/sellers/search?${params.toString()}`);
            const data = res.data?.result || res.data?.results || [];
            setSellers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch sellers:', err);
            setSellers([]);
        } finally {
            setLoadingSellers(false);
        }
    }, []);

    useEffect(() => {
        fetchSellers(activeCategory, filterDate, filterTime);
        // Reset detail view if category/filters change
        setSelectedSellerDetail(null);
    }, [activeCategory, filterDate, filterTime, fetchSellers]);

    /* ── filtered sellers (by global search) ── */
    const filteredSellers = globalSearch.trim()
        ? sellers.filter(s =>
            (s.shopName || s.name || '').toLowerCase().includes(globalSearch.toLowerCase()) ||
            (s.description || '').toLowerCase().includes(globalSearch.toLowerCase())
        )
        : sellers;

    const filteredCats = categories.filter(c =>
        c.name.toLowerCase().includes(catSearch.toLowerCase())
    );

    const handleSellerSelect = (seller) => {
        setSelectedSellerDetail(seller);
    };

    /* ════════════════════ RENDER ════════════════════ */
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <MainLocationHeader hideSearchBar={false} isAbsolute={false} />

            <div className="flex flex-col flex-1 w-full" style={{ paddingTop: 'var(--header-height, 180px)' }}>
                {/* ─── FULL WIDTH TOP BAR (Breadcrumb + Unified Search) ─── */}
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col md:flex-row items-center gap-4 shadow-sm z-20 shrink-0">
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-48 lg:w-64 xl:w-72">
                        <button onClick={() => navigate('/')} className="text-xs font-semibold text-slate-500 hover:text-purple-600 transition-colors flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                            Home
                        </button>
                        <span className="text-slate-300">›</span>
                        <span className="text-xs font-bold text-slate-700">Plan My Event</span>
                    </div>
                    
                    <div className="flex-1 relative w-full lg:max-w-4xl xl:max-w-5xl">
                        <SearchIcon sx={{ fontSize: 20 }} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={globalSearch}
                            onChange={e => setGlobalSearch(e.target.value)}
                            placeholder="Search by Seller or Product..."
                            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 placeholder:text-slate-400 font-medium"
                        />
                    </div>
                </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full">
                {/* ══════════════ LEFT SIDEBAR ══════════════ */}
                <div className="w-full lg:w-72 xl:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10 lg:max-h-full">

                    {/* Category Search */}
                    <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                            <SearchIcon sx={{ fontSize: 16 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={catSearch}
                                onChange={e => setCatSearch(e.target.value)}
                                placeholder="Search category..."
                                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Categories List */}
                    <div className="flex-1 overflow-x-auto lg:overflow-x-hidden overflow-y-hidden lg:overflow-y-auto p-3 flex flex-row lg:flex-col gap-2">
                        {loadingCats ? (
                            <div className="flex justify-center pt-10 w-full">
                                <CircularProgress size={24} sx={{ color: '#8b5cf6' }} />
                            </div>
                        ) : filteredCats.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8 w-full">No categories found</p>
                        ) : (
                            filteredCats.map(cat => {
                                const isActive = activeCategory?._id === cat._id;
                                const style = getCategoryStyle(cat.name);
                                return (
                                    <button
                                        key={cat._id}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`shrink-0 lg:w-full flex items-center gap-3 px-3 py-2 lg:py-3 rounded-xl transition-all duration-150 text-left font-bold border-2 ${
                                            isActive
                                                ? 'border-slate-800 scale-[1.01] ring-2 ring-purple-400/50 shadow-md'
                                                : 'border-transparent opacity-85 hover:opacity-100 hover:scale-[1.01]'
                                        }`}
                                        style={{ backgroundColor: style.bg, color: style.text }}
                                    >
                                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                                            {(cat.icon?.startsWith('http') || cat.icon?.startsWith('/')) ? (
                                                <img src={resolveImageUrl(cat.icon)} alt={cat.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xl">{cat.icon || '🎉'}</span>
                                            )}
                                        </div>
                                        <span className="text-sm tracking-wide truncate">{cat.name}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ══════════════ RIGHT PANEL ══════════════ */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto bg-slate-50 scroll-smooth">
                        
                        {/* ─── BANNER (optional) ─── */}
                        {banners.length > 0 && (
                            <div className="px-5 pt-4 pb-2 shrink-0 bg-slate-50">
                                <div className="w-full aspect-[1448/350] rounded-2xl overflow-hidden relative shadow-sm">
                                    <div
                                        className="w-full h-full flex transition-transform duration-500"
                                        style={{ transform: `translateX(-${currentBannerIdx * 100}%)` }}
                                    >
                                        {banners.map((b, i) => (
                                            <div key={b._id || i} className="w-full h-full flex-shrink-0">
                                                <img
                                                    src={resolveImageUrl(b.imageUrl)}
                                                    alt={b.title || 'Banner'}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {banners.length > 1 && (
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                            {banners.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setCurrentBannerIdx(i)}
                                                    className={`h-1.5 rounded-full transition-all ${currentBannerIdx === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ─── FILTERS: Event Type + Date + Time ─── */}
                        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 shrink-0">
                            <div className="flex flex-wrap gap-3 items-end max-w-4xl">
                                {/* Event Type */}
                                <div className="flex flex-col gap-1 min-w-[180px]">
                                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                        <EventIcon sx={{ fontSize: 12 }} /> Event Type
                                    </label>
                                    <select
                                        value={selectedType}
                                        onChange={e => setSelectedType(e.target.value)}
                                        className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                                    >
                                        <option value="">-- Select Type --</option>
                                        {eventTypes.map(t => (
                                            <option key={t._id || t.value} value={t.value || t._id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date */}
                                <div className="flex flex-col gap-1 min-w-[160px]">
                                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                        📅 Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={e => setFilterDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>

                                {/* Time */}
                                <div className="flex flex-col gap-1 min-w-[140px]">
                                    <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                        🕐 Time Slot
                                    </label>
                                    <input
                                        type="time"
                                        value={filterTime}
                                        onChange={e => setFilterTime(e.target.value)}
                                        className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>

                                {/* Clear filters */}
                                {(filterDate || filterTime) && (
                                    <button
                                        onClick={() => { setFilterDate(''); setFilterTime(''); }}
                                        className="text-xs text-red-500 font-bold hover:underline self-end pb-2"
                                    >
                                        ✕ Clear Filters
                                    </button>
                                )}

                                {/* Category badge */}
                                {activeCategory && (
                                    <div className="ml-auto self-end pb-1">
                                        <span
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                                            style={{ background: getCategoryStyle(activeCategory.name).bg, color: getCategoryStyle(activeCategory.name).text }}
                                        >
                                            {activeCategory.name} Sellers
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedSellerDetail ? (
                            <div className="w-full bg-slate-50">
                                <EventSellerDetailPage 
                                    embeddedState={{
                                        selectedSeller: selectedSellerDetail,
                                        selectedCategories: [activeCategory?.name || ''],
                                        eventData: {
                                            eventType: selectedType,
                                            date: filterDate,
                                            time: filterTime,
                                        },
                                        preferences: {}
                                    }}
                                    onBack={() => setSelectedSellerDetail(null)}
                                />
                            </div>
                        ) : (
                            <div className="px-5 pt-3 pb-8">
                                {/* ─── SELLERS GRID ─── */}
                            {/* Results Header */}
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                    {loadingSellers ? 'Loading...' : `${filteredSellers.length} Provider${filteredSellers.length !== 1 ? 's' : ''} Found`}
                                    {activeCategory ? ` · ${activeCategory.name}` : ''}
                                    {filterDate ? ` · ${new Date(filterDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                                </h3>
                                {filterDate && (
                                    <span className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full font-bold">
                                        📅 Booked date & time filtered
                                    </span>
                                )}
                            </div>

                            {/* Loading state */}
                            {loadingSellers ? (
                                <div className="flex flex-col items-center justify-center py-24">
                                    <CircularProgress sx={{ color: '#8b5cf6' }} />
                                    <p className="text-slate-500 font-medium mt-4 text-sm">Searching available providers...</p>
                                </div>
                            ) : filteredSellers.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 border-dashed">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <StorefrontIcon sx={{ color: '#94a3b8', fontSize: 32 }} />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-800 mb-1">
                                        {globalSearch ? `No results for "${globalSearch}"` : 'No Providers Available'}
                                    </h3>
                                    <p className="text-slate-400 text-xs max-w-xs mx-auto">
                                        {globalSearch
                                            ? 'Try a different search term'
                                            : `No active ${activeCategory?.name || ''} providers found. Try removing date/time filters.`}
                                    </p>
                                    {(filterDate || filterTime || globalSearch) && (
                                        <button
                                            onClick={() => { setFilterDate(''); setFilterTime(''); setGlobalSearch(''); }}
                                            className="mt-4 text-sm font-bold text-purple-600 hover:underline"
                                        >
                                            Clear all filters
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeCategory?._id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                    >
                                        {filteredSellers.map(seller => (
                                            <SellerCard
                                                key={seller._id}
                                                seller={seller}
                                                activeCategory={activeCategory}
                                                eventParams={{ date: filterDate, time: filterTime, eventType: selectedType }}
                                                onSelect={handleSellerSelect}
                                            />
                                        ))}
                                    </motion.div>
                                </AnimatePresence>
                            )}
                        </div>
                    )}
                </div>
            </div>
            </div>
            </div>
        </div>
    );
};

export default PlanMyEventPage;
