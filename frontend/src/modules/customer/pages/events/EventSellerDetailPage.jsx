import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';
import { eventConfigApi } from '../../services/eventConfigApi';
import MainLocationHeader from '../../components/shared/MainLocationHeader';
import { resolveImageUrl } from '@/core/utils/imageUtils';
import axiosInstance from '@core/api/axios';
import { getOrderSocket } from '@/core/services/orderSocket';
import { getStoredAuthToken } from '@core/utils/authStorage';
import { useAuth } from '@/core/context/AuthContext';
import AssignmentIcon from '@mui/icons-material/Assignment';

const EventSellerDetailPage = ({ embeddedState, onBack }) => {
    const navigate = useNavigate();
    const { state: routerState } = useLocation();
    const currentState = embeddedState || routerState || {};
    const { eventData, preferences, selectedCategories, selectedSeller } = currentState;
    const { user } = useAuth();

    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [selectedProducts, setSelectedProducts] = useState([]);

    // Customization States
    const [themePreference, setThemePreference] = useState('');
    const [colorPreferences, setColorPreferences] = useState([]);
    const [colorInput, setColorInput] = useState('');
    const [materialPreference, setMaterialPreference] = useState('');
    const [referencePhoto, setReferencePhoto] = useState(null);
    const [formDate, setFormDate] = useState(eventData?.date || '');
    const [formTime, setFormTime] = useState(eventData?.time || '');
    const [isDateBooked, setIsDateBooked] = useState(false);
    const [isCheckingDate, setIsCheckingDate] = useState(false);

    const [customNotes, setCustomNotes] = useState('');
    const [customBudget, setCustomBudget] = useState('');

    // Chat States
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatContainerRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!eventData || !selectedSeller) {
            if (!embeddedState) navigate('/plan-my-event');
            return;
        }

        // Fetch products
        const fetchSellerProducts = async () => {
            setIsLoadingProducts(true);
            try {
                // Fetch catalog products filtered by this seller
                const response = await axiosInstance.get(`/products?sellerId=${selectedSeller._id}`);
                setProducts(response.data?.result || response.data?.results || response.data?.data || []);
            } catch (error) {
                console.error("Failed to fetch seller products:", error);
            } finally {
                setIsLoadingProducts(false);
            }
        };

        fetchSellerProducts();

        // Connect Socket Chat
        const token = getStoredAuthToken('auth_customer');
        let currentSocket = null;
        let currentRoom = null;

        if (token && user?._id) {
            currentRoom = `seller_chat_${selectedSeller._id}_${user._id}`;
            const socket = getOrderSocket(token);
            if (socket) {
                socketRef.current = socket;
                currentSocket = socket;
                socket.emit('join_room', currentRoom);

                socket.on('chat_message', (msg) => {
                    // Make sure it doesn't duplicate our own message immediately (backend handles id, but we can just append)
                    setMessages(prev => [...prev, {
                        ...msg,
                        time: msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                });
            }
        }

        // Fetch chat history
        const fetchChatHistory = async () => {
            try {
                const res = await axiosInstance.get(`/chats/session?sellerId=${selectedSeller._id}`);
                if (res.data?.status && res.data.result) {
                    setMessages(res.data.result.messages || []);
                } else {
                    // Default welcome message if no history
                    setMessages([{ id: 1, sender: 'seller', text: `Hello! Thanks for choosing ${selectedSeller?.shopName || selectedSeller?.name}. Let us know if you have any custom requests for your ${eventData?.eventType || 'event'}!`, time: 'Just now' }]);
                }
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            }
        };

        if (user?._id) {
            fetchChatHistory();
        }

        return () => {
            if (currentSocket && currentRoom) {
                currentSocket.emit('leave_room', currentRoom);
                currentSocket.off('chat_message');
            }
        };
    }, [eventData, selectedSeller, navigate, user]);

    // Check date availability
    useEffect(() => {
        const checkAvailability = async () => {
            if (!formDate || !selectedCategories || selectedCategories.length === 0) {
                setIsDateBooked(false);
                return;
            }

            setIsCheckingDate(true);
            try {
                // If the backend has a specific endpoint we'd use it, 
                // for now we can check the search API if this seller shows up for this date
                const catId = selectedCategories[0]._id;
                const res = await axiosInstance.get(`/events/sellers/search?categoryId=${catId}&date=${formDate}`);
                const availableSellers = res.data?.result || [];

                // If seller is not in available sellers list, they are booked
                const isAvailable = availableSellers.some(s => s._id === selectedSeller._id);
                setIsDateBooked(!isAvailable);
            } catch (err) {
                console.error("Failed to check date availability", err);
                setIsDateBooked(false); // Default to false on error so we don't block
            } finally {
                setIsCheckingDate(false);
            }
        };

        const timeoutId = setTimeout(() => {
            checkAvailability();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formDate, selectedCategories, selectedSeller._id]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;

        const newMsg = {
            id: Date.now(),
            sender: 'customer',
            text: chatInput,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMsg]);

        // Emit through socket
        if (socketRef.current && user?._id) {
            socketRef.current.emit('send_chat_message', {
                room: `seller_chat_${selectedSeller._id}_${user._id}`,
                text: chatInput,
                senderId: 'customer',
                customerId: user._id,
                sellerId: selectedSeller._id
            });
        }

        setChatInput('');
    };

    const handleProductSelect = (product) => {
        setSelectedProducts(prev => {
            if (prev.find(p => p._id === product._id)) {
                return prev.filter(p => p._id !== product._id);
            } else {
                return [...prev, product];
            }
        });
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setReferencePhoto(file);
        }
    };

    const handleProceed = () => {
        // Collect preferences
        const collectedPreferences = {
            ...preferences,
            [selectedCategories[0]]: {
                themePreference,
                colorPreferences,
                materialPreference,
                referencePhoto,
                customNotes,
                customBudget,
                selectedProducts: selectedProducts.map(p => p._id)
            }
        };

        // Go to Event Checkout/Summary Page
        navigate('/plan-my-event/checkout', {
            state: {
                eventData,
                preferences: collectedPreferences,
                selectedCategories,
                selectedSeller,
                selectedProducts
            }
        });
    };

    const handleBackClick = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    const content = (
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-24">
            {/* Header Strip with Back Action */}
            <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <button onClick={handleBackClick} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Customize Request</h1>
                    <p className="text-[10px] text-slate-500 font-medium">Select items & options offered by {selectedSeller?.shopName || selectedSeller?.name}</p>
                </div>
            </div>

            {/* Colorful Poster Description Banner */}
            <div className="relative overflow-hidden rounded-3xl p-8 mb-6 text-white shadow-lg bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-700">
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
                <div className="relative z-10">
                    <span className="text-[10px] bg-white/20 text-white font-black uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/20">
                        {selectedSeller?.category || 'Provider'}
                    </span>
                    <h2 className="text-3xl font-black mt-3 leading-tight drop-shadow-md">
                        {selectedSeller?.shopName || selectedSeller?.name}
                    </h2>
                    <p className="text-xs text-white/90 mt-1 font-semibold flex items-center gap-1.5">
                        📍 {selectedSeller?.address || 'Indore, Madhya Pradesh'}
                    </p>
                    <p className="text-xs text-white/90 mt-1 font-semibold flex items-center gap-1.5">
                        👥 Capacity: {selectedSeller?.minGuestCapacity || 1} - {selectedSeller?.maxGuestCapacity || 'Max'} Guests
                    </p>

                    <div className="mt-5 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 max-w-2xl">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-300">About Us / Description</h3>
                        <p className="text-sm mt-1 leading-relaxed text-white/95 font-medium">
                            {selectedSeller?.description || 'Welcome to our shop! We offer customized catering, premium decorations, DJ, and total venue solutions. Contact us for custom package adjustments.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left/Main Column: Products and Customization */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Products Grid */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
                            Select Products & Services
                        </h3>

                        {isLoadingProducts ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <CircularProgress sx={{ color: '#8b5cf6' }} />
                                <p className="text-slate-500 text-xs mt-3">Loading catalog...</p>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-2xl">
                                <StorefrontIcon sx={{ color: '#cbd5e1', fontSize: 36 }} />
                                <p className="text-slate-500 text-xs mt-2">No individual catalog items found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {products.map(product => {
                                    const isSelected = selectedProducts.find(p => p._id === product._id);
                                    return (
                                        <div
                                            key={product._id}
                                            onClick={() => handleProductSelect(product)}
                                            className={`border-2 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between
                                                        ${isSelected
                                                    ? 'border-purple-500 bg-purple-50/40 shadow-sm'
                                                    : 'border-slate-100 hover:border-purple-200'
                                                }`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60">
                                                    <img
                                                        src={resolveImageUrl(product.mainImage || product.image)}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png' }}
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-sm text-slate-800 truncate">{product.name}</h4>
                                                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{product.description}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                                                <span className="font-extrabold text-sm text-purple-600">₹{product.price}</span>
                                                <button
                                                    type="button"
                                                    className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 transition-all
                                                                ${isSelected
                                                            ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                            : 'bg-white border-slate-200 text-slate-600 hover:border-purple-500 hover:text-purple-600'
                                                        }`}
                                                >
                                                    {isSelected ? 'Selected' : 'Add Item'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Customization Options form depending on Seller config */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
                            Customization Details
                        </h3>

                        <div className="space-y-4">
                            {/* Material Preference (Flower/Balloon) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Decoration Type</label>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="material"
                                            value="Flower"
                                            checked={materialPreference === 'Flower'}
                                            onChange={(e) => setMaterialPreference(e.target.value)}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-300"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Flower</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="material"
                                            value="Balloon"
                                            checked={materialPreference === 'Balloon'}
                                            onChange={(e) => setMaterialPreference(e.target.value)}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-300"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Balloon</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="material"
                                            value="Both"
                                            checked={materialPreference === 'Both'}
                                            onChange={(e) => setMaterialPreference(e.target.value)}
                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-300"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Both</span>
                                    </label>
                                </div>
                            </div>

                            {/* Color Combination Option (Multiple Colors) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Color Theme Preference (Select Multiple)</label>

                                {/* Predefined Colors from Admin */}
                                {selectedSeller?.availableColors && selectedSeller.availableColors.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {selectedSeller.availableColors.map((color, idx) => {
                                            const isSelected = colorPreferences.includes(color);
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setColorPreferences(prev => prev.filter(c => c !== color));
                                                        } else {
                                                            setColorPreferences(prev => [...prev, color]);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${isSelected
                                                        ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200"
                                                        : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:bg-purple-50"
                                                        }`}
                                                >
                                                    <div
                                                        className={`w-3.5 h-3.5 rounded-full border ${isSelected ? 'border-white/50' : 'border-slate-200'}`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    {color}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-wrap gap-2 items-center focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all">
                                    {colorPreferences.map((color, idx) => (
                                        <span key={idx} className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-sm">
                                            {color}
                                            <button
                                                onClick={() => setColorPreferences(prev => prev.filter((_, i) => i !== idx))}
                                                className="ml-1 text-slate-400 hover:text-red-500 font-bold"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        type="color"
                                        value={colorInput.startsWith('#') ? colorInput : '#8b5cf6'}
                                        onChange={(e) => setColorInput(e.target.value)}
                                        className="w-8 h-8 rounded-md border-0 p-0 shrink-0 cursor-pointer bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        placeholder={colorPreferences.length === 0 ? "Type custom color (Press Enter)" : "Add another color..."}
                                        value={colorInput}
                                        onChange={(e) => setColorInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && colorInput.trim()) {
                                                e.preventDefault();
                                                if (!colorPreferences.includes(colorInput.trim())) {
                                                    setColorPreferences(prev => [...prev, colorInput.trim()]);
                                                }
                                                setColorInput('');
                                            }
                                        }}
                                        className="flex-1 min-w-[150px] outline-none text-sm font-semibold bg-transparent px-1 py-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (colorInput.trim() && !colorPreferences.includes(colorInput.trim())) {
                                                setColorPreferences(prev => [...prev, colorInput.trim()]);
                                                setColorInput('');
                                            }
                                        }}
                                        className="bg-purple-600 text-white px-3 py-1 rounded-md text-xs font-bold shrink-0 hover:bg-purple-700 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Theme Selection Option */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Specific Theme Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Fairy Tale Theme, Retro Bollywood Night"
                                    value={themePreference}
                                    onChange={(e) => setThemePreference(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 outline-none text-sm font-semibold bg-slate-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                />
                            </div>

                            {/* Budget Selection Option */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Your Custom Budget Limit (₹)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 50000"
                                    value={customBudget}
                                    onChange={(e) => setCustomBudget(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 outline-none text-sm font-semibold bg-slate-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                />
                            </div>

                            {/* Reference Photo Upload Option */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Upload Reference Image / Layout Sketch</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                        id="ref-photo-file"
                                    />
                                    <label htmlFor="ref-photo-file" className="cursor-pointer text-center">
                                        <span className="text-xs font-black text-purple-600 uppercase tracking-wider block">Browse File</span>
                                        <span className="text-[10px] text-slate-400 block mt-0.5">
                                            {referencePhoto ? referencePhoto.name : 'Upload layout PNG, JPG (Max 5MB)'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Customer Notes Option */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Specific Guidelines / Notes</label>
                                <textarea
                                    rows={3}
                                    placeholder="Write specific guidelines, food allergy notices, or schedule requests for the seller..."
                                    value={customNotes}
                                    onChange={(e) => setCustomNotes(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl p-3 outline-none text-sm font-semibold bg-slate-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                    {/* Live Chat with Seller (Socket.io) */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[380px] overflow-hidden">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-150 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Seller & Customer Chat Option</h4>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Realtime</span>
                        </div>

                        {/* Messages Board */}
                        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
                            {messages.map(msg => {
                                const isCustomer = msg.sender === 'customer';
                                return (
                                    <div key={msg.id} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs font-medium shadow-sm leading-relaxed
                                                        ${isCustomer
                                                    ? 'bg-purple-600 text-white rounded-tr-none'
                                                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                        <span className="text-[9px] text-slate-400 mt-1 px-1 font-semibold">{msg.time}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Input bar */}
                        <div className="p-3 bg-white border-t border-slate-150 flex gap-2">
                            <input
                                type="text"
                                placeholder="Type your message..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                className="flex-1 border border-slate-200 rounded-xl px-3 outline-none text-xs bg-slate-50 focus:border-purple-500 transition-all"
                            />
                            <button
                                onClick={handleSendMessage}
                                className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
                            >
                                <SendIcon sx={{ fontSize: 14 }} />
                            </button>
                        </div>
                    </div>

                    {/* --- New Event Details Form Below Chat --- */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mt-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                                <AssignmentIcon sx={{ color: 'white' }} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Event Details</h3>
                                <p className="text-sm text-slate-500">Provide details to customize your plan</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleProceed}
                                className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-extrabold rounded-xl hover:opacity-90 transition-all text-[13px] tracking-wide shadow-md">
                                START PLANNING
                            </button>
                            <button
                                onClick={() => navigate('/plan-my-event/venues')}
                                className="w-full py-3.5 bg-white border-2 border-purple-500 text-purple-600 font-extrabold rounded-xl hover:bg-purple-50 transition-all text-[13px] tracking-wide">
                                EXPLORE & VISIT VENUES
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Action Sticky Summary */}
                <div className="lg:col-span-4 space-y-6 relative">

                    {/* Sticky Summary Card */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Plan Summary</h4>
                        <div className="space-y-2 border-b border-slate-100 pb-3">
                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                                <span>Event Type:</span>
                                <span className="capitalize">{eventData?.eventType}</span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                                <span>Date:</span>
                                <span>{eventData?.date}</span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                                <span>Time Slot:</span>
                                <span>{eventData?.time || 'Not selected'}</span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-slate-600">
                                <span>Selected Products:</span>
                                <span>{selectedProducts.length} items</span>
                            </div>
                        </div>

                        <button
                            onClick={handleProceed}
                            className="w-full py-3 bg-purple-600 text-white font-extrabold rounded-2xl hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-200 text-center"
                        >
                            Proceed to Checkout
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );

    if (embeddedState) {
        return content;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <MainLocationHeader hideSearchBar={false} isAbsolute={false} />
            <div className="flex-1 w-full overflow-y-auto" style={{ paddingTop: 'var(--header-height, 180px)' }}>
                {content}
            </div>
        </div>
    );
};

export default EventSellerDetailPage;
