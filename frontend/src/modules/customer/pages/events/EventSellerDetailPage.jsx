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
import { getCookie } from '@core/utils/authStorage'; // Auth token getter

const EventSellerDetailPage = () => {
    const navigate = useNavigate();
    const { state: routerState } = useLocation();
    const { eventData, preferences, selectedCategories, selectedSeller } = routerState || {};

    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [selectedProducts, setSelectedProducts] = useState([]);
    
    // Customization States
    const [themePreference, setThemePreference] = useState('');
    const [colorPreference, setColorPreference] = useState('');
    const [referencePhoto, setReferencePhoto] = useState(null);
    const [customNotes, setCustomNotes] = useState('');
    const [customBudget, setCustomBudget] = useState('');
    
    // Chat States
    const [messages, setMessages] = useState([
        { id: 1, sender: 'seller', text: `Hello! Thanks for choosing ${selectedSeller?.shopName || selectedSeller?.name}. Let us know if you have any custom requests for your ${eventData?.eventType || 'event'}!`, time: 'Just now' }
    ]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!eventData || !selectedSeller) {
            navigate('/plan-my-event');
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
        const token = getCookie('auth_customer');
        if (token) {
            const socket = getOrderSocket(token);
            if (socket) {
                socketRef.current = socket;
                const roomName = `seller_chat_${selectedSeller._id}`;
                socket.emit('join_room', roomName);

                socket.on('chat_message', (msg) => {
                    if (msg.senderId === selectedSeller._id) {
                        setMessages(prev => [...prev, {
                            id: Date.now(),
                            sender: 'seller',
                            text: msg.text,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }]);
                    }
                });
            }
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.emit('leave_room', `seller_chat_${selectedSeller._id}`);
                socketRef.current.off('chat_message');
            }
        };
    }, [eventData, selectedSeller, navigate]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        if (socketRef.current) {
            socketRef.current.emit('send_chat_message', {
                room: `seller_chat_${selectedSeller._id}`,
                text: chatInput,
                senderId: 'customer'
            });
        } else {
            // Simulated seller response fallback
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    sender: 'seller',
                    text: `Thank you for details! We will review your custom notes and product selections and respond shortly.`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            }, 1500);
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
                colorPreference,
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

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <MainLocationHeader hideSearchBar={false} isAbsolute={false} />

            <div className="flex-1 w-full overflow-y-auto" style={{ paddingTop: 'var(--header-height, 180px)' }}>
                <div className="max-w-5xl mx-auto px-4 pt-4 pb-24">
                    {/* Header Strip with Back Action */}
                    <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
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
                                    {/* Color Combination Option */}
                                    {selectedSeller?.quoteColorCombination !== false && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Color Theme Preference</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g. Pastel Pink and Gold, Classic Red & White"
                                                value={colorPreference}
                                                onChange={(e) => setColorPreference(e.target.value)}
                                                className="w-full border border-slate-200 rounded-xl p-3 outline-none text-sm font-semibold bg-slate-50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            />
                                        </div>
                                    )}

                                    {/* Theme Selection Option */}
                                    {selectedSeller?.quoteThemeSelection !== false && (
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
                                    )}

                                    {/* Budget Selection Option */}
                                    {selectedSeller?.quoteBudgetSelection !== false && (
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
                                    )}

                                    {/* Reference Photo Upload Option */}
                                    {selectedSeller?.quoteReferencePhotoUpload !== false && (
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
                                    )}

                                    {/* Customer Notes Option */}
                                    {selectedSeller?.quoteCustomerNotes !== false && (
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
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Chat and Action Sticky Summary */}
                        <div className="lg:col-span-4 space-y-6">
                            
                            {/* Live Chat with Seller (Socket.io) */}
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[380px] overflow-hidden">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-150 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Chat with Seller</h4>
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Realtime</span>
                                </div>

                                {/* Messages Board */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
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
                                    <div ref={chatEndRef} />
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
            </div>
        </div>
    );
};

export default EventSellerDetailPage;
