import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../../services/customerApi';

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
    const [currentBanner, setCurrentBanner] = useState(0);

    useEffect(() => {
        if (!seller.banners || seller.banners.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentBanner(prev => (prev + 1) % seller.banners.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [seller.banners]);

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
            {seller.banners && seller.banners.length > 0 && (
                <div className="w-full h-32 relative overflow-hidden bg-slate-900 shrink-0">
                    <AnimatePresence mode="wait">
                        <motion.img
                            key={currentBanner}
                            src={resolveImageUrl(seller.banners[currentBanner])}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 w-full h-full object-cover"
                            alt="Seller Banner"
                        />
                    </AnimatePresence>
                    {seller.banners.length > 1 && (
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                            {seller.banners.map((_, idx) => (
                                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentBanner ? 'bg-white scale-125' : 'bg-white/50'}`} />
                            ))}
                        </div>
                    )}
                </div>
            )}
            
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
                    Cap: {seller.minGuestCapacity || 1} - {seller.maxGuestCapacity || '—'} guests
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
    const { user: authUser, isAuthenticated } = useAuth();
    const saveTimerRef = useRef(null);

    /* — event info form (name / gender / dob / functionLocation) — */
    const [eventInfo, setEventInfo] = useState({
        bookingType: 'individual',
        name: '',
        gender: '',
        dateOfBirth: '',
        anniversaryDate: '',
        functionLocation: '',
    });
    const [savingInfo, setSavingInfo] = useState(false);
    const [savedInfo,  setSavedInfo]  = useState(false);

    /* — left sidebar — */
    const [categories,     setCategories]     = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [catSearch,      setCatSearch]      = useState('');
    const [loadingCats,    setLoadingCats]    = useState(true);

    /* — top filters — */
    const [eventTypes,    setEventTypes]    = useState([]);
    const [selectedType,  setSelectedType]  = useState('');
    const [filterDate,    setFilterDate]    = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterTime,    setFilterTime]    = useState('');

    /* — right panel sellers — */
    const [sellers,       setSellers]       = useState([]);
    const [loadingSellers, setLoadingSellers] = useState(false);

    /* — unified search (seller / product) — */
    const [globalSearch, setGlobalSearch] = useState('');

    /* — inline detail view — */
    const [selectedSellerDetail, setSelectedSellerDetail] = useState(null);

    /* — dynamic cards state — */
    const [liveStreams, setLiveStreams] = useState([]);
    const [areaSellers, setAreaSellers] = useState([]);

    const embeddedState = React.useMemo(() => ({
        selectedSeller: selectedSellerDetail,
        selectedCategories: [activeCategory?.name || ''],
        eventData: {
            eventType: selectedType,
            date: filterDate,
            time: filterTime,
        },
        preferences: {}
    }), [selectedSellerDetail, activeCategory?.name, selectedType, filterDate, filterTime]);

    /* — banners — */
    const [banners,           setBanners]           = useState([]);
    const [currentBannerIdx,  setCurrentBannerIdx]  = useState(0);

    /* ── load event info from customer profile ── */
    useEffect(() => {
        const defaultMocks = [
            { _id: 'm1', shopName: 'The Grand Venue', city: 'Local Area', profileImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200' },
            { _id: 'm2', shopName: 'Luxury Decorators', city: 'Local Area', profileImage: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=200' },
            { _id: 'm3', shopName: 'DJ Night Rockers', city: 'Local Area', profileImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200' }
        ];

        const fetchArea = (city) => {
            const url = city ? `/events/sellers/area?city=${encodeURIComponent(city)}` : `/events/sellers/area`;
            axiosInstance.get(url)
                .then(r => {
                    let sellers = r.data?.result || [];
                    if (sellers.length === 0) sellers = defaultMocks;
                    setAreaSellers(sellers);
                })
                .catch(() => setAreaSellers(defaultMocks));
        };

        if (!isAuthenticated) {
            fetchArea();
            return;
        }

        customerApi.getProfile().then(res => {
            const p = res?.data?.result || {};
            setEventInfo({
                bookingType:      p.bookingType      || 'individual',
                name:             p.name             || '',
                gender:           p.gender           || '',
                dateOfBirth:      p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
                anniversaryDate:  p.anniversaryDate ? p.anniversaryDate.split('T')[0] : '',
                functionLocation: p.functionLocation || '',
            });
            fetchArea(p.functionLocation || p.city);
        }).catch(() => fetchArea());
    }, [isAuthenticated]);

    /* ── fetch live streams ── */
    useEffect(() => {
        const fetchLiveStreams = async () => {
            try {
                const res = await axiosInstance.get('/kitchen/public/streams');
                let streams = res.data?.result || [];
                if (streams.length === 0) {
                    streams = [
                        { _id: 'mock1', sellerId: { shopName: 'Haldiram Live Kitchen' }, cookingStatus: 'Preparing Ingredients', photoUpdates: [{ imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=300' }] },
                        { _id: 'mock2', sellerId: { shopName: 'Ramu Kaka Caterers' }, cookingStatus: 'Cooking Now', photoUpdates: [{ imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=300' }] }
                    ];
                }
                setLiveStreams(streams);
            } catch (err) {
                console.error("Failed to fetch live streams", err);
            }
        };
        fetchLiveStreams();
    }, []);

    /* ── debounced save to DB whenever eventInfo changes ── */
    const handleEventInfoChange = (field, value) => {
        setEventInfo(prev => ({ ...prev, [field]: value }));
        setSavedInfo(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                setSavingInfo(true);
                await customerApi.updateProfile({ [field]: value || null });
                setSavedInfo(true);
                setTimeout(() => setSavedInfo(false), 2000);
            } catch {}
            finally { setSavingInfo(false); }
        }, 800);
    };

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
                // if (sorted.length > 0) setActiveCategory(sorted[0]); // Removed default selection

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

    /* ── fetch sellers when category / date / time / location changes ── */
    const fetchSellers = useCallback(async (cat, date, time, loc) => {
        if (!cat) return;
        setLoadingSellers(true);
        try {
            const params = new URLSearchParams({ categories: cat._id });
            if (date) params.append('date', date);
            if (time) params.append('time', time);
            if (loc) params.append('location', loc);
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
        fetchSellers(activeCategory, filterDate, filterTime, eventInfo.functionLocation);
        // Reset detail view if category/filters change
        setSelectedSellerDetail(null);
    }, [activeCategory, filterDate, filterTime, eventInfo.functionLocation, fetchSellers]);

    /* ── filtered sellers (by global search & smart filtering) ── */
    let smartFilteredSellers = sellers.filter(s => {
        if (s.isShopActive === false) return false;

        // Check Demo Trial Expiry
        if (s.demoTrialEnabled && s.demoStartDate) {
            const startDate = new Date(s.demoStartDate).getTime();
            const now = new Date().getTime();
            const daysPassed = (now - startDate) / (1000 * 60 * 60 * 24);
            const trialDays = s.demoTrialDays || 15;
            
            if (daysPassed > trialDays) {
                return false; // Demo expired, hide seller
            }
        }
        return true;
    }); // Hide inactive shops or expired demos

    // Filter by Advance Booking Buffer if a date is selected
    if (filterDate) {
        const selectedTime = new Date(filterDate).getTime();
        const currentTime = new Date().getTime();
        const hoursDiff = (selectedTime - currentTime) / (1000 * 60 * 60);
        
        smartFilteredSellers = smartFilteredSellers.filter(s => {
            if (!s.advanceBookingBuffer || s.advanceBookingBuffer <= 0) return true;
            
            const requiredHours = s.advanceBookingBufferUnit === 'hours' 
                ? s.advanceBookingBuffer 
                : s.advanceBookingBuffer * 24;
                
            return hoursDiff >= requiredHours;
        });
    }

    if (eventInfo.bookingType === 'couple') {
        smartFilteredSellers = smartFilteredSellers.filter(s => s.coupleContactEnabled !== false);
    } else {
        smartFilteredSellers = smartFilteredSellers.filter(s => s.primaryContactEnabled !== false);
    }

    const filteredSellers = globalSearch.trim()
        ? smartFilteredSellers.filter(s =>
            (s.shopName || s.name || '').toLowerCase().includes(globalSearch.toLowerCase()) ||
            (s.description || '').toLowerCase().includes(globalSearch.toLowerCase())
        )
        : smartFilteredSellers;

    const filteredCats = categories.filter(c =>
        c.name.toLowerCase().includes(catSearch.toLowerCase())
    );
    const displayedCats = activeCategory ? [activeCategory] : filteredCats;

    const handleSellerSelect = (seller) => {
        setSelectedSellerDetail(seller);
    };

    /* ════════════════════ RENDER ════════════════════ */
    return (
        <div className="h-[100dvh] bg-slate-50 flex flex-col font-sans overflow-hidden">
            <MainLocationHeader 
                hideSearchBar={false} 
                isAbsolute={false} 
                onLogoClick={() => {
                    setActiveCategory(null);
                    setSelectedSellerDetail(null);
                }}
            />
            <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden transition-all duration-300" style={{ paddingTop: 'calc(var(--header-height, 140px) + 16px - var(--header-shrink-offset, 0px))' }}>
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden w-full">
                {/* ══════════════ LEFT SIDEBAR ══════════════ */}
                <div className="w-full lg:w-72 xl:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10 lg:max-h-full">

                    {/* Category Search */}
                    {!activeCategory && (
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
                    )}

                    {/* Categories List */}
                    <div className="flex-1 overflow-x-auto lg:overflow-x-hidden overflow-y-hidden lg:overflow-y-auto overscroll-contain p-3 flex flex-row lg:flex-col gap-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {loadingCats ? (
                            <div className="flex justify-center pt-10 w-full">
                                <CircularProgress size={24} sx={{ color: '#8b5cf6' }} />
                            </div>
                        ) : displayedCats.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8 w-full">No categories found</p>
                        ) : (
                            <>
                                {activeCategory && (
                                    <button
                                        onClick={() => {
                                            setActiveCategory(null);
                                            // Reset other selections when going back to all categories if needed, 
                                            // but setActiveCategory(null) is enough for the sidebar.
                                        }}
                                        className="shrink-0 lg:w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150 text-left font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200"
                                    >
                                        <span className="text-lg leading-none">←</span>
                                        <span className="text-sm">Home</span>
                                    </button>
                                )}
                                {displayedCats.map(cat => {
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
                                })}
                            </>
                        )}
                    </div>
                </div>

                {/* ══════════════ RIGHT PANEL ══════════════ */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                    <div id="main-scroll-container" className="flex-1 overflow-y-auto overscroll-contain bg-slate-50" style={{ WebkitOverflowScrolling: 'touch' }}>
                        
                        {/* ─── BANNER (optional) ─── */}
                        {banners.length > 0 && !selectedSellerDetail && !activeCategory && (
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

                        {/* ─── FEATURE CARDS: Subscribe & Live ─── */}
                        {!activeCategory && (
                            <div className="px-5 pt-2 pb-4 shrink-0 bg-slate-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Blue Card: Live */}
                                <div className="relative overflow-hidden w-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-4 shadow-md border-b-4 border-blue-800 flex flex-col min-h-[140px]">
                                    <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    <div className="flex items-center gap-2 mb-3 z-10 shrink-0">
                                        <div className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                                            <span className="text-white text-[9px] font-black">LIVE</span>
                                        </div>
                                        <h4 className="text-white font-black text-xs uppercase tracking-wider">LIVE</h4>
                                    </div>
                                    <div className="z-10 flex-1 flex flex-col justify-center">
                                        {liveStreams.length > 0 ? (
                                            <div className="flex gap-3 overflow-x-auto pb-1 snap-x no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                                                {liveStreams.map(stream => (
                                                    <div 
                                                        key={stream._id} 
                                                        className="snap-start shrink-0 w-36 bg-black/20 rounded-xl overflow-hidden cursor-pointer hover:bg-black/30 transition-colors relative border border-white/10 shadow-sm"
                                                        onClick={() => setSelectedSellerDetail(stream.sellerId || stream)}
                                                    >
                                                        <div className="w-full h-16 bg-black/40 flex items-center justify-center relative">
                                                            <span className="text-2xl text-white/50 z-10 drop-shadow-md">▶</span>
                                                            {stream.photoUpdates?.length > 0 && (
                                                                <img src={resolveImageUrl(stream.photoUpdates[stream.photoUpdates.length - 1].imageUrl)} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                                            )}
                                                        </div>
                                                        <div className="p-2 bg-black/10">
                                                            <p className="text-white font-bold text-[11px] truncate leading-tight">{stream.sellerId?.shopName || 'Live Event'}</p>
                                                            <p className="text-blue-100 text-[9px] truncate">{stream.cookingStatus || 'Streaming Now'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <span className="text-white font-black text-xl md:text-2xl drop-shadow-md uppercase tracking-wider">LIVE</span>
                                                <span className="text-blue-200 text-[10px] mt-1 max-w-[80%]">No active streams right now</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Yellow Card: Reels */}
                                <div className="relative overflow-hidden w-full bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 shadow-md border-b-4 border-amber-600 flex flex-col min-h-[140px]">
                                    <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    <div className="flex items-center gap-2 mb-3 z-10 shrink-0">
                                        <div className="w-7 h-7 bg-white/30 rounded-full flex items-center justify-center shadow-sm">
                                            <span className="text-white text-xs">🎬</span>
                                        </div>
                                        <h4 className="text-white font-black text-xs uppercase tracking-wider">REELS</h4>
                                    </div>
                                    <div className="z-10 flex-1 flex flex-col justify-center">
                                        {areaSellers.length > 0 ? (
                                            <div className="flex gap-3 overflow-x-auto pb-1 snap-x no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                                                {areaSellers.map(s => (
                                                    <div key={s._id} className="snap-start shrink-0 w-32 bg-white/10 rounded-xl p-2 cursor-pointer hover:bg-white/20 transition-all border border-white/5 shadow-sm" onClick={() => navigate(`/reels?type=retail&sellerId=${s._id}`)}>
                                                        <div className="w-full h-16 bg-black/30 rounded-lg mb-2 overflow-hidden flex items-center justify-center relative shadow-inner group">
                                                            <span className="text-2xl text-white/70 z-10 drop-shadow-md group-hover:scale-110 transition-transform">▶</span>
                                                            {s.profileImage ? <img src={resolveImageUrl(s.profileImage)} alt={s.shopName} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-50 transition-opacity" /> : <span className="text-white/50 text-[10px] font-medium absolute z-0">No image</span>}
                                                        </div>
                                                        <p className="text-white font-bold text-[11px] truncate leading-tight">{s.shopName || s.name}</p>
                                                        <p className="text-amber-100 text-[9px] truncate">{s.city || 'Local Area'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <span className="text-white font-black text-lg md:text-xl drop-shadow-md leading-snug">REELS</span>
                                                <span className="text-amber-100 text-[10px] mt-1 max-w-[80%]">Sellers selecting this area will appear here</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* ─── FILTERS: Event Type + Date + Time ─── */}
                        {(!activeCategory || activeCategory.showDateFilters !== false) && (
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

                                {/* Date Section */}
                                {(!activeCategory || activeCategory.dateSelectionType !== 'range') ? (
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
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-1 min-w-[160px]">
                                            <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                                📅 Start Date
                                            </label>
                                            <input
                                                type="date"
                                                value={filterDate}
                                                onChange={e => setFilterDate(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-[160px]">
                                            <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                                📅 End Date
                                            </label>
                                            <input
                                                type="date"
                                                value={filterEndDate}
                                                onChange={e => setFilterEndDate(e.target.value)}
                                                min={filterDate || new Date().toISOString().split('T')[0]}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Time Section */}
                                {(!activeCategory || activeCategory.timeSelectionType !== 'single') ? (
                                    <div className="flex flex-col gap-1 min-w-[180px]">
                                        <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                            🕐 Time Slot
                                        </label>
                                        <select
                                            value={filterTime}
                                            onChange={e => setFilterTime(e.target.value)}
                                            className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                                        >
                                            <option value="">-- Select Slot --</option>
                                            {["07:00 AM - 08:00 AM", "08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM", "12:00 PM - 01:00 PM", "01:00 PM - 02:00 PM", "02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM"].map(slot => (
                                                <option key={slot} value={slot}>{slot}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 min-w-[160px]">
                                        <label className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                                            🕐 Time
                                        </label>
                                        <input
                                            type="time"
                                            value={filterTime}
                                            onChange={e => setFilterTime(e.target.value)}
                                            className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                        />
                                    </div>
                                )}

                                {/* Clear filters */}
                                {(filterDate || filterEndDate || filterTime) && (
                                    <button
                                        onClick={() => { setFilterDate(''); setFilterEndDate(''); setFilterTime(''); }}
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
                        )}
                        {/* ─── EVENT INFO CARD ─── */}
                        {(!activeCategory || activeCategory.showEventDetailsForm !== false) && (
                        <div className="px-5 pt-4 pb-2">
                                <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <span>🎉</span> Your Event Details
                                            </h3>
                                            <div className="flex bg-purple-50 rounded-lg p-0.5 ml-2">
                                                <button
                                                    onClick={() => handleEventInfoChange('bookingType', 'individual')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${eventInfo.bookingType === 'individual' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-600 hover:bg-purple-100'}`}
                                                >
                                                    Individual
                                                </button>
                                                <button
                                                    onClick={() => handleEventInfoChange('bookingType', 'couple')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${eventInfo.bookingType === 'couple' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-600 hover:bg-purple-100'}`}
                                                >
                                                    Couple
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {savingInfo && <span className="text-[10px] text-slate-400 font-medium">Saving...</span>}
                                            {savedInfo  && <span className="text-[10px] text-green-500 font-bold">✓ Saved</span>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {/* Name */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                {eventInfo.bookingType === 'couple' ? '💑 Couple Names' : '👤 Primary Contact'}
                                            </label>
                                            <input
                                                type="text"
                                                value={eventInfo.name}
                                                onChange={e => handleEventInfoChange('name', e.target.value)}
                                                placeholder={eventInfo.bookingType === 'couple' ? "e.g. Rahul & Priya" : "Your full name"}
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                            />
                                        </div>

                                        {/* Gender (Only for Individual) */}
                                        {eventInfo.bookingType === 'individual' && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">⚧ Gender</label>
                                                <div className="flex gap-3 items-center h-[38px]">
                                                    {['male', 'female', 'other'].map(g => (
                                                        <label key={g} className="flex items-center gap-1.5 cursor-pointer select-none">
                                                            <input
                                                                type="radio"
                                                                name="gender"
                                                                value={g}
                                                                checked={eventInfo.gender === g}
                                                                onChange={() => handleEventInfoChange('gender', g)}
                                                                className="accent-purple-600 w-3.5 h-3.5"
                                                            />
                                                            <span className="text-sm font-semibold text-slate-700 capitalize">
                                                                {g === 'male' ? '♂ Male' : g === 'female' ? '♀ Female' : '⚧ Other'}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Date of Birth or Anniversary Date */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                {eventInfo.bookingType === 'couple' ? '💍 Anniversary / Marriage Date' : '🎂 Date of Birth'}
                                            </label>
                                            <input
                                                type="date"
                                                value={eventInfo.bookingType === 'couple' ? eventInfo.anniversaryDate : eventInfo.dateOfBirth}
                                                max={new Date().toISOString().split('T')[0]}
                                                onChange={e => handleEventInfoChange(eventInfo.bookingType === 'couple' ? 'anniversaryDate' : 'dateOfBirth', e.target.value)}
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400"
                                            />
                                        </div>

                                        {/* Function Location */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📍 Function Location</label>
                                            <input
                                                type="text"
                                                value={eventInfo.functionLocation}
                                                onChange={e => handleEventInfoChange('functionLocation', e.target.value)}
                                                placeholder="City / Venue area"
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {selectedSellerDetail ? (
                            <div className="w-full bg-slate-50">
                                <EventSellerDetailPage 
                                    embeddedState={embeddedState}
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
