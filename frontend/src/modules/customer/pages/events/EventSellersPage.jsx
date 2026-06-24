import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CircularProgress from '@mui/material/CircularProgress';
import { eventConfigApi } from '../../services/eventConfigApi';

const EventSellersPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { eventData, preferences, selectedCategories } = location.state || {};

    const [sellers, setSellers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!eventData || !selectedCategories) {
            navigate('/plan-my-event');
            return;
        }
        fetchSellers();
    }, []);

    const fetchSellers = async () => {
        setIsLoading(true);
        try {
            const params = {
                date: eventData.date,
                time: eventData.time,
                guestCount: eventData.guestCount,
                location: eventData.location,
                categories: selectedCategories
            };
            const result = await eventConfigApi.searchSellers(params);
            setSellers(result || []);
        } catch (error) {
            console.error("Failed to fetch sellers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="sticky top-0 left-0 right-0 h-16 bg-white z-50 flex items-center px-4 shadow-sm shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <div className="ml-2">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Available Providers</h1>
                    <p className="text-[10px] text-slate-500 font-medium">{eventData?.date} • {eventData?.guestCount} Guests</p>
                </div>
            </div>

            <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <CircularProgress sx={{ color: '#8b5cf6' }} />
                        <p className="text-slate-500 font-medium mt-4">Finding available providers...</p>
                    </div>
                ) : sellers.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100 mt-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <StorefrontIcon sx={{ color: '#94a3b8', fontSize: 32 }} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">No Providers Available</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">We couldn't find any providers matching your specific requirements and availability.</p>
                        <button
                            onClick={() => navigate(-1)}
                            className="mt-6 px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Change Preferences
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2 pb-24">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 ml-1">
                            {sellers.length} Providers Found
                        </h2>
                        {sellers.map(seller => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={seller._id}
                                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800 leading-tight">{seller.shopName || seller.name}</h3>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Verified</span>
                                            {seller.reliabilityScore !== undefined && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                                    ⭐ {seller.reliabilityScore}% Reliable
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500 font-medium">Cap: {seller.maxGuestCapacity} Guests</span>
                                        </div>
                                    </div>
                                    <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
                                        <StorefrontIcon />
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                                    {seller.description || "Premium event service provider."}
                                </p>

                                <div className="flex gap-2 flex-wrap mb-5">
                                    {seller.serviceCategories?.map(cat => (
                                        <span key={cat._id} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold uppercase tracking-wider">
                                            {cat.name}
                                        </span>
                                    ))}
                                </div>

                                <button
                                    onClick={() => {
                                        // Check if any of the seller's categories have package_builder plugin
                                        const needsPackageSelection = seller.serviceCategories?.some(cat =>
                                            cat.activePlugins && cat.activePlugins.includes('package_builder')
                                        );

                                        if (needsPackageSelection) {
                                            navigate('/plan-my-event/packages', { state: { eventData, preferences, selectedCategories, selectedSeller: seller } });
                                        } else {
                                            navigate('/plan-my-event/checkout', { state: { eventData, preferences, selectedCategories, selectedSeller: seller } });
                                        }
                                    }}
                                    className="w-full bg-slate-900 text-white font-bold rounded-xl py-3 hover:bg-slate-800 transition-colors active:scale-[0.98]"
                                >
                                    {seller.serviceCategories?.some(c => c.activePlugins?.includes('package_builder')) ? 'View Packages & Book' : 'Select Provider'}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventSellersPage;
