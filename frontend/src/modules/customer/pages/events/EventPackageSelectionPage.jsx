import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { eventConfigApi } from '../../services/eventConfigApi';

const EventPackageSelectionPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { eventData, preferences, selectedCategories, selectedSeller } = location.state || {};

    const [packages, setPackages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPackage, setSelectedPackage] = useState(null);

    useEffect(() => {
        if (!eventData || !selectedSeller) {
            navigate('/plan-my-event');
            return;
        }
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        setIsLoading(true);
        try {
            const result = await eventConfigApi.getSellerPackages(selectedSeller._id);
            setPackages(result || []);
        } catch (error) {
            console.error("Failed to fetch packages:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = () => {
        if (!selectedPackage) {
            alert('Please select a package to continue.');
            return;
        }

        navigate('/plan-my-event/checkout', { 
            state: { 
                eventData, 
                preferences, 
                selectedCategories, 
                selectedSeller,
                selectedPackage
            } 
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="sticky top-0 left-0 right-0 h-16 bg-white z-50 flex items-center px-4 shadow-sm shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <div className="ml-2">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Select a Package</h1>
                    <p className="text-[10px] text-slate-500 font-medium">from {selectedSeller?.shopName || selectedSeller?.name}</p>
                </div>
            </div>

            <div className="flex-1 p-4 max-w-3xl mx-auto w-full pb-24">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <CircularProgress sx={{ color: '#8b5cf6' }} />
                        <p className="text-slate-500 font-medium mt-4">Loading available packages...</p>
                    </div>
                ) : packages.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100 mt-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <StorefrontIcon sx={{ color: '#94a3b8', fontSize: 32 }} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">No Packages Configured</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">This provider has not configured any specific packages yet. You can still proceed with a custom request.</p>
                        <button 
                            onClick={() => navigate('/plan-my-event/checkout', { state: { eventData, preferences, selectedCategories, selectedSeller } })}
                            className="mt-6 px-6 py-2 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors"
                        >
                            Proceed without Package
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 ml-1">
                            Available Packages
                        </h2>
                        {packages.map(pkg => {
                            const isSelected = selectedPackage?._id === pkg._id;
                            const totalCost = pkg.pricing * (eventData.guestCount || 1);

                            return (
                                <motion.div 
                                    key={pkg._id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedPackage(pkg)}
                                    className={`relative bg-white p-5 rounded-2xl shadow-sm border-2 cursor-pointer transition-all flex flex-col ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    {isSelected && (
                                        <div className="absolute top-4 right-4 text-purple-500">
                                            <CheckCircleIcon sx={{ fontSize: 24 }} />
                                        </div>
                                    )}
                                    <div className="mb-3 pr-8">
                                        <h3 className={`font-bold text-lg leading-tight ${isSelected ? 'text-purple-800' : 'text-slate-800'}`}>
                                            {pkg.template?.packageName}
                                        </h3>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider inline-block mt-1">
                                            {pkg.category?.name}
                                        </span>
                                    </div>
                                    
                                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                                        {pkg.customDescription || pkg.template?.description || "A complete package for your event needs."}
                                    </p>
                                    
                                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Price per guest</p>
                                            <p className="font-bold text-slate-800">₹{pkg.pricing}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500 font-medium">Estimated Total ({eventData.guestCount} guests)</p>
                                            <p className={`text-xl font-black ${isSelected ? 'text-purple-600' : 'text-brand-600'}`}>
                                                ₹{totalCost.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedPackage && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Estimate</p>
                            <p className="font-black text-xl text-slate-800">
                                ₹{(selectedPackage.pricing * (eventData.guestCount || 1)).toLocaleString()}
                            </p>
                        </div>
                        <button 
                            onClick={handleContinue}
                            className="bg-slate-900 text-white font-bold rounded-xl px-8 py-3.5 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 active:scale-95"
                        >
                            Book Package
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventPackageSelectionPage;
