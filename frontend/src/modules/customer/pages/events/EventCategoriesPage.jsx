import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';
import CircularProgress from '@mui/material/CircularProgress';
import { eventConfigApi } from '../../services/eventConfigApi';

const EventCategoriesPage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [preferences, setPreferences] = useState({});
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // state.eventData contains { eventType, guestCount, budget, date, time, location }
    const eventData = state?.eventData;

    useEffect(() => {
        if (!eventData) {
            navigate('/plan-my-event');
            return;
        }

        const fetchCategories = async () => {
            try {
                const response = await eventConfigApi.getEventCategories();
                setCategories(response || []);
            } catch (error) {
                console.error("Failed to fetch event categories:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCategories();
    }, [eventData, navigate]);

    const toggleCategory = (catId) => {
        if (selectedCategories.includes(catId)) {
            setSelectedCategories(selectedCategories.filter(id => id !== catId));
            const newPrefs = { ...preferences };
            delete newPrefs[catId];
            setPreferences(newPrefs);
        } else {
            setSelectedCategories([...selectedCategories, catId]);
            setPreferences({ ...preferences, [catId]: {} });
        }
    };

    const handlePreferenceChange = (catId, fieldName, value) => {
        setPreferences({
            ...preferences,
            [catId]: {
                ...preferences[catId],
                [fieldName]: value
            }
        });
    };

    const handleImageUpload = async (catId, fieldName, file) => {
        if (!file) return;
        try {
            // Optimistic loading state could be added here
            const url = await eventConfigApi.uploadMedia(file);
            if (url) {
                handlePreferenceChange(catId, fieldName, url);
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("Image upload failed. Please try again.");
        }
    };

    const handleContinueToCheckout = () => {
        // Validate
        if (selectedCategories.length === 0) {
            alert('Please select at least one service');
            return;
        }

        // Validate required preference fields
        let hasErrors = false;
        let errorMessage = "Please fill in all required fields:\n";

        for (const catId of selectedCategories) {
            const category = categories.find(c => c._id === catId);
            if (!category || !category.fields) continue;

            for (const field of category.fields) {
                if (field.isRequired) {
                    const val = preferences[catId]?.[field.fieldName];
                    if (!val || String(val).trim() === '') {
                        hasErrors = true;
                        errorMessage += `- ${field.fieldName} under ${category.name}\n`;
                    }
                }
            }
        }

        if (hasErrors) {
            alert(errorMessage);
            return;
        }
        
        // Now proceed to Seller Discovery
        console.log("Proceeding with event data:", eventData);
        console.log("Selected services & preferences:", preferences);
        navigate('/plan-my-event/sellers', { state: { eventData, preferences, selectedCategories } });
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="sticky top-0 left-0 right-0 h-16 bg-white z-50 flex items-center px-4 shadow-sm shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <div className="ml-2">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Select Services</h1>
                    <p className="text-[10px] text-slate-500 font-medium">Build your {eventData?.eventType} package</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-32">
                <div className="max-w-3xl mx-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                        {isLoading ? (
                            <div className="col-span-full flex justify-center py-10">
                                <CircularProgress />
                            </div>
                        ) : (
                            categories.map(cat => {
                                const isSelected = selectedCategories.includes(cat._id);
                                return (
                                    <motion.div 
                                        key={cat._id}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleCategory(cat._id)}
                                    className={`relative p-4 rounded-2xl cursor-pointer border-2 transition-all ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white'}`}
                                >
                                    <div className="text-3xl mb-2 w-12 h-12 flex items-center justify-center overflow-hidden rounded-xl bg-transparent">
                                        {(cat.icon?.startsWith('http') || cat.icon?.startsWith('/')) ? (
                                            <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                                        ) : (
                                            cat.icon
                                        )}
                                    </div>
                                    <h3 className={`font-bold ${isSelected ? 'text-purple-700' : 'text-slate-700'}`}>{cat.name}</h3>
                                    {isSelected && (
                                        <div className="absolute top-3 right-3 text-purple-500">
                                            <CheckCircleIcon sx={{ fontSize: 20 }} />
                                        </div>
                                    )}
                                </motion.div>
                                );
                            })
                        )}
                    </div>

                    {/* Dynamic Preference Forms */}
                    {selectedCategories.length > 0 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-black text-slate-800 mb-4">Service Preferences</h2>
                            {selectedCategories.map(catId => {
                                const category = categories.find(c => c._id === catId);
                                if (!category) return null;
                                return (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        key={catId} 
                                        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100"
                                    >
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-xl w-8 h-8 flex items-center justify-center overflow-hidden rounded-md bg-transparent">
                                                {(category.icon?.startsWith('http') || category.icon?.startsWith('/')) ? (
                                                    <img src={category.icon} alt={category.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    category.icon
                                                )}
                                            </span>
                                            <h3 className="font-bold text-lg text-slate-800">{category.name} Details</h3>
                                        </div>

                                        {/* Dynamic Plugin Indicators */}
                                        {category.activePlugins && category.activePlugins.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {category.activePlugins.includes('package_builder') && (
                                                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100 uppercase tracking-wider">Packages Available in next step</span>
                                                )}
                                                {category.activePlugins.includes('ingredient_transparency') && (
                                                    <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-1 rounded-md border border-green-100 uppercase tracking-wider">Ingredient Transparency enabled</span>
                                                )}
                                                {category.activePlugins.includes('venue_visit') && (
                                                    <span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded-md border border-orange-100 uppercase tracking-wider">Venue Visit available</span>
                                                )}
                                            </div>
                                        )}
                                        
                                        <div className="space-y-4">
                                            {category.fields.map(field => (
                                                <div key={field.fieldName}>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                        {field.fieldName} {field.isRequired && <span className="text-red-500">*</span>}
                                                    </label>
                                                    
                                                    {field.fieldType === 'SELECT' ? (
                                                        <select 
                                                            className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 bg-slate-50 outline-none"
                                                            value={preferences[catId]?.[field.fieldName] || ''}
                                                            onChange={(e) => handlePreferenceChange(catId, field.fieldName, e.target.value)}
                                                        >
                                                            <option value="">Select option...</option>
                                                            {field.options.map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : field.fieldType === 'TEXTAREA' ? (
                                                        <textarea 
                                                            className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 bg-slate-50 outline-none"
                                                            rows={3}
                                                            placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                                                            value={preferences[catId]?.[field.fieldName] || ''}
                                                            onChange={(e) => handlePreferenceChange(catId, field.fieldName, e.target.value)}
                                                        />
                                                    ) : (field.fieldType === 'IMAGE' || field.fieldName.toLowerCase().includes('image')) ? (
                                                        <div className="space-y-3">
                                                            {preferences[catId]?.[field.fieldName] ? (
                                                                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 group">
                                                                    <img src={preferences[catId][field.fieldName]} alt="Uploaded reference" className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                        <label className="cursor-pointer bg-white text-slate-800 font-bold px-4 py-2 rounded-lg text-sm hover:bg-slate-100">
                                                                            Change Image
                                                                            <input 
                                                                                type="file" 
                                                                                accept="image/*" 
                                                                                className="hidden"
                                                                                onChange={(e) => handleImageUpload(catId, field.fieldName, e.target.files[0])}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <label className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors group">
                                                                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                                    </div>
                                                                    <span className="text-sm font-semibold text-slate-600">Click to upload an image</span>
                                                                    <span className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP (Max 5MB)</span>
                                                                    <input 
                                                                        type="file" 
                                                                        accept="image/*" 
                                                                        className="hidden"
                                                                        onChange={(e) => handleImageUpload(catId, field.fieldName, e.target.files[0])}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    ) : (field.fieldType === 'COLOR' || field.fieldName.toLowerCase().includes('color')) ? (
                                                        <div className="flex items-center gap-3">
                                                            <div 
                                                                className="relative w-12 h-12 rounded-xl shadow-sm border-2 border-slate-200 shrink-0 cursor-pointer overflow-hidden"
                                                                style={{ backgroundColor: preferences[catId]?.[field.fieldName] || '#ffffff' }}
                                                            >
                                                                <input 
                                                                    type="color"
                                                                    className="absolute inset-[-50px] w-[200%] h-[200%] opacity-0 cursor-pointer"
                                                                    value={preferences[catId]?.[field.fieldName] || '#ffffff'}
                                                                    onChange={(e) => handlePreferenceChange(catId, field.fieldName, e.target.value)}
                                                                />
                                                            </div>
                                                            <input 
                                                                type="text"
                                                                className="flex-1 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 bg-slate-50 outline-none uppercase font-mono text-sm"
                                                                placeholder="#FFFFFF"
                                                                value={preferences[catId]?.[field.fieldName] || ''}
                                                                onChange={(e) => handlePreferenceChange(catId, field.fieldName, e.target.value)}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type="text"
                                                            className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 bg-slate-50 outline-none"
                                                            placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                                                            value={preferences[catId]?.[field.fieldName] || ''}
                                                            onChange={(e) => handlePreferenceChange(catId, field.fieldName, e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Action Bar */}
            {selectedCategories.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Selected Services</p>
                            <p className="font-black text-lg text-slate-800">{selectedCategories.length}</p>
                        </div>
                        <button 
                            onClick={handleContinueToCheckout}
                            className="bg-slate-900 text-white font-bold rounded-xl px-8 py-3.5 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 active:scale-95"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventCategoriesPage;
