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
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const resolveProductImageUrl = (path) => (
    typeof path === 'string' && path.startsWith('data:') ? path : resolveImageUrl(path)
);

const getProductPricing = (product) => {
    const originalPrice = Number(product.price) || 0;
    const salePrice = Number(product.salePrice) || 0;
    const hasSalePrice = salePrice > 0 && salePrice < originalPrice;
    return { originalPrice, unitPrice: hasSalePrice ? salePrice : originalPrice, hasSalePrice };
};

const EventSellerDetailPage = ({ embeddedState, onBack }) => {
    const navigate = useNavigate();
    const { state: routerState } = useLocation();
    const currentState = embeddedState || routerState || {};
    const { eventData, preferences, selectedCategories, selectedSeller } = currentState;
    const { user } = useAuth();

    // Derived from selected categories (category toggles from admin)
    const relevantCats = selectedCategories && selectedCategories.length > 0 ? selectedCategories : [];

    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [imagePreview, setImagePreview] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const selectedProductsStorageKey = `jalapino_plan_event_products_${selectedSeller?._id || 'seller'}`;

    const [failedImages, setFailedImages] = useState(new Set());
    const [isFullScreenImage, setIsFullScreenImage] = useState(false);

    const openProductGallery = (product) => {
        const imagesSet = new Set();
        const images = [];

        const addImage = (img) => {
            if (typeof img === 'string') {
                const cleanedImg = img.trim();
                if (cleanedImg && !cleanedImg.includes('undefined') && !cleanedImg.includes('null') && cleanedImg !== '[]') {
                    const resolved = resolveProductImageUrl(cleanedImg);
                    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, "") : "";
                    if (resolved && resolved !== baseUrl && resolved !== `${baseUrl}/`) {
                        if (!imagesSet.has(resolved)) {
                            imagesSet.add(resolved);
                            images.push(resolved);
                        }
                    }
                }
            }
        };

        addImage(product.mainImage);
        if (Array.isArray(product.galleryImages)) {
            product.galleryImages.forEach(addImage);
        }

        if (images.length > 0) {
            setImagePreview({ images, activeIndex: 0, name: product.name, product: product });
            setZoomLevel(1);
            setFailedImages(new Set());
            setIsFullScreenImage(false);
        }
    };






    useEffect(() => {
        if (!imagePreview) return undefined;
        const handleGalleryKeyDown = (event) => {
            if (event.key === 'Escape') setImagePreview(null);
            if (event.key === 'ArrowRight') {
                setImagePreview(current => ({
                    ...current,
                    activeIndex: (current.activeIndex + 1) % current.images.length,
                }));
            }
            if (event.key === 'ArrowLeft') {
                setImagePreview(current => ({
                    ...current,
                    activeIndex: (current.activeIndex - 1 + current.images.length) % current.images.length,
                }));
            }
        };
        window.addEventListener('keydown', handleGalleryKeyDown);
        return () => window.removeEventListener('keydown', handleGalleryKeyDown);
    }, [imagePreview]);

    // Customization States
    const [themePreference, setThemePreference] = useState('');
    const [colorPreferences, setColorPreferences] = useState([]);
    const [colorInput, setColorInput] = useState('');
    const [materialPreference, setMaterialPreference] = useState('');
    const [isCustomizationRequested, setIsCustomizationRequested] = useState(false);
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
                const productParams = new URLSearchParams({ sellerId: selectedSeller._id, module: 'plan_my_event' });
                if (eventData?.lat && eventData?.lng) {
                    productParams.set('lat', eventData.lat);
                    productParams.set('lng', eventData.lng);
                }
                if (eventData?.location) productParams.set('location', eventData.location);
                const response = await axiosInstance.get(`/products?${productParams.toString()}`);
                const responseData = response.data?.result || response.data?.results || response.data?.data || [];
                const sellerProducts = Array.isArray(responseData) ? responseData : (responseData.items || []);
                setProducts(sellerProducts);
                try {
                    const savedSelection = JSON.parse(sessionStorage.getItem(selectedProductsStorageKey) || '[]');
                    const savedSelections = new Map(savedSelection.map(item => [String(item.productId), item]));
                    setSelectedProducts(sellerProducts
                        .filter(product => savedSelections.has(String(product._id)))
                        .map(product => {
                            const saved = savedSelections.get(String(product._id));
                            return { ...product, quantity: Number(saved.quantity) || 1, selectedColors: saved.selectedColors || [] };
                        }));
                } catch {
                    setSelectedProducts([]);
                }
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
    }, [eventData, selectedSeller, navigate, user, selectedProductsStorageKey]);

    useEffect(() => {
        if (isLoadingProducts) return;
        try {
            sessionStorage.setItem(selectedProductsStorageKey, JSON.stringify(
                selectedProducts.map(({ _id, quantity, selectedColors = [] }) => ({ productId: _id, quantity, selectedColors }))
            ));
        } catch (error) {
            console.warn('Could not preserve selected event products:', error);
        }
    }, [selectedProducts, selectedProductsStorageKey, isLoadingProducts]);

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

    const handleProductQuantityChange = (product, change) => {
        setSelectedProducts(prev => {
            const selectedProduct = prev.find(p => p._id === product._id);
            const nextQuantity = (selectedProduct?.quantity || 0) + change;

            if (nextQuantity <= 0) {
                return prev.filter(p => p._id !== product._id);
            }

            if (!selectedProduct) {
                return [...prev, { ...product, quantity: nextQuantity }];
            }

            return prev.map(p => p._id === product._id ? { ...p, quantity: nextQuantity } : p);
        });
    };

    const handleProductSelection = (product) => {
        setSelectedProducts(prev => prev.some(p => p._id === product._id)
            ? prev.filter(p => p._id !== product._id)
            : [...prev, { ...product, quantity: 1, selectedColors: [] }]);
    };

    const handleProductColorToggle = (productId, color) => {
        setSelectedProducts(prev => prev.map(product => {
            if (product._id !== productId) return product;
            const selectedColors = product.selectedColors || [];
            return {
                ...product,
                selectedColors: selectedColors.includes(color)
                    ? selectedColors.filter(selectedColor => selectedColor !== color)
                    : [...selectedColors, color],
            };
        }));
    };

    const handleProductColorAdd = (productId, color) => {
        setSelectedProducts(prev => prev.map(product => {
            if (product._id !== productId) return product;
            const selectedColors = product.selectedColors || [];
            return selectedColors.includes(color)
                ? product
                : { ...product, selectedColors: [...selectedColors, color] };
        }));
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
                selectedProducts: selectedProducts.map(p => p._id),
                selectedProductQuantities: selectedProducts.map(({ _id, quantity }) => ({ productId: _id, quantity })),
                selectedProductColors: selectedProducts
                    .filter(product => product.selectedColors?.length)
                    .map(({ _id, name, selectedColors }) => ({ productId: _id, productName: name, colors: selectedColors }))
            }
        };

        // Keep the selected products and quantities available after refresh/back navigation.
        const checkoutState = {
            eventData,
            preferences: collectedPreferences,
            selectedCategories,
            selectedSeller,
            selectedProducts,
        };
        try {
            sessionStorage.setItem('jalapino_plan_event_checkout', JSON.stringify(checkoutState));
        } catch (error) {
            console.warn('Could not preserve event checkout details:', error);
        }

        // Go to Event Checkout/Summary Page
        navigate('/plan-my-event/checkout', {
            state: checkoutState
        });
    };

    const handleBackClick = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    const selectedProductsSubtotal = selectedProducts.reduce(
        (total, product) => total + getProductPricing(product).unitPrice * (Number(product.quantity) || 1),
        0
    );

    const content = (
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-24">
            {/* Header Strip with Back Action */}
            <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <button onClick={handleBackClick} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Back to Sellers</h1>
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
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSeller?.address || 'Indore, Madhya Pradesh')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white/90 mt-1 font-semibold flex items-center gap-1.5 hover:text-white hover:underline w-fit cursor-pointer"
                    >
                        📍 {selectedSeller?.address || 'Indore, Madhya Pradesh'}
                    </a>
                    {selectedSeller?.capacityEnabled && (
                        <div className="flex flex-col gap-0.5 mt-1">
                            <p className="text-xs text-white/90 font-semibold flex items-center gap-1.5">
                                👥 Total Capacity: {selectedSeller?.totalCapacity || 100}
                            </p>
                            <p className="text-[10px] text-white/70 flex items-center gap-1.5 pl-5">
                                └ Booking Range: {selectedSeller?.minGuestCapacity || 1} - {selectedSeller?.maxGuestCapacity || 'Max'} Guests
                            </p>
                        </div>
                    )}

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
                <div className="lg:col-span-12 space-y-6">

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
                                    const pricing = getProductPricing(product);
                                    const productImage = resolveProductImageUrl(product.mainImage || product.galleryImages?.[0]);
                                    return (
                                        <div
                                            key={product._id}
                                            onClick={(event) => {
                                                if (!event.target.closest('button, input, label, select, textarea, a')) {
                                                    openProductGallery(product);
                                                }
                                            }}
                                            className={`border-2 rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer
                                                        ${isSelected
                                                    ? 'border-purple-500 bg-purple-50/40 shadow-sm'
                                                    : 'border-slate-100 hover:border-purple-200'
                                                }`}
                                        >
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => openProductGallery(product)}
                                                    aria-label={`View product gallery for ${product.name}`}
                                                    className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 cursor-zoom-in"
                                                >
                                                    <img
                                                        src={productImage}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png' }}
                                                    />
                                                </button>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-sm text-slate-800 truncate">{product.name}</h4>
                                                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{product.description}</p>
                                                    {product.tickets?.length > 0 && (
                                                        <div className="mt-2 space-y-1.5">
                                                            {product.tickets.map((ticket, ticketIndex) => (
                                                                <div key={ticket._id || ticketIndex} className="rounded-lg bg-purple-50/70 border border-purple-100 px-2.5 py-2">
                                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                                                                        <span className="font-bold text-slate-700">{ticket.name}</span>
                                                                        <span className="font-extrabold text-purple-700">₹{Number(ticket.price || 0).toLocaleString('en-IN')}</span>
                                                                        {ticket.salePrice !== undefined && ticket.salePrice !== null && ticket.salePrice !== "" && (
                                                                            <span className="text-slate-500">Sale: ₹{Number(ticket.salePrice).toLocaleString('en-IN')}</span>
                                                                        )}
                                                                        {ticket.capacity !== undefined && ticket.capacity !== null && (
                                                                            <span className="text-slate-500">Capacity: {ticket.capacity}</span>
                                                                        )}
                                                                    </div>
                                                                    {ticket.instructions && <p className="text-[10px] text-slate-500 mt-0.5">{ticket.instructions}</p>}
                                                                    {ticket.timeSlotsEnabled && ticket.timeSlots?.length > 0 && (
                                                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                                                            {ticket.timeSlots.map((slot) => [slot.date, slot.startTime && slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime || slot.endTime].filter(Boolean).join(' ')).filter(Boolean).join(' · ')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && Array.isArray(product.colors) && product.colors.length > 0 && (
                                                <div className="mt-3 rounded-xl border border-purple-100 bg-white p-3">
                                                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Choose colors for {product.name}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[...new Set([...product.colors, ...(isSelected.selectedColors || [])])].map((color, colorIndex) => {
                                                            const isColorSelected = (isSelected.selectedColors || []).includes(color);
                                                            return (
                                                                <button
                                                                    key={`${color}-${colorIndex}`}
                                                                    type="button"
                                                                    aria-pressed={isColorSelected}
                                                                    onClick={() => handleProductColorToggle(product._id, color)}
                                                                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${isColorSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300'}`}
                                                                >
                                                                    <span className="h-3.5 w-3.5 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
                                                                    {color}
                                                                </button>
                                                            );
                                                        })}
                                                        <label className="flex items-center gap-2 rounded-lg border border-dashed border-purple-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer hover:border-purple-500">
                                                            <input
                                                                type="color"
                                                                aria-label={`Choose a custom color for ${product.name}`}
                                                                value={[...(isSelected.selectedColors || [])].reverse().find(color => /^#[0-9a-f]{6}$/i.test(color)) || '#8b5cf6'}
                                                                onChange={(e) => handleProductColorAdd(product._id, e.target.value)}
                                                                className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                                            />
                                                            Pick color
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                                                <span className="flex flex-wrap items-center gap-x-2 font-extrabold text-sm text-purple-600">
                                                    {pricing.hasSalePrice && (
                                                        <span className="text-xs font-semibold text-slate-400 line-through">
                                                            ₹{(pricing.originalPrice * (Number(isSelected?.quantity) || 1)).toLocaleString('en-IN')}
                                                        </span>
                                                    )}
                                                    <span>₹{(pricing.unitPrice * (Number(isSelected?.quantity) || 1)).toLocaleString('en-IN')}</span>
                                                    {isSelected?.quantity > 1 && <span className="text-[10px] font-semibold text-slate-400">({isSelected.quantity} × ₹{pricing.unitPrice.toLocaleString('en-IN')})</span>}
                                                </span>
                                                {(product.isDelivery || product.isRental || (product.tickets && product.tickets.length > 0)) ? (isSelected ? (
                                                    <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-1.5 py-1">
                                                        <button
                                                            type="button"
                                                            aria-label={`Remove one ${product.name}`}
                                                            onClick={() => handleProductQuantityChange(product, -1)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-purple-700 hover:bg-purple-100"
                                                        >
                                                            <RemoveIcon fontSize="small" />
                                                        </button>
                                                        <span className="min-w-5 text-center text-xs font-black text-slate-800">{isSelected.quantity}</span>
                                                        <button
                                                            type="button"
                                                            aria-label={`Add one ${product.name}`}
                                                            onClick={() => handleProductQuantityChange(product, 1)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-600 text-white hover:bg-purple-700"
                                                        >
                                                            <AddIcon fontSize="small" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleProductQuantityChange(product, 1)}
                                                        className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 bg-white border-slate-200 text-slate-600 hover:border-purple-500 hover:text-purple-600 transition-all"
                                                    >
                                                        Add Item
                                                    </button>
                                                )) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleProductSelection(product)}
                                                        className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white hover:bg-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:border-purple-500 hover:text-purple-600'}`}
                                                    >
                                                        {isSelected ? 'Remove Item' : 'Add Item'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Customization Options form depending on Seller config */}
                    {selectedSeller?.customizationEngineEnabled && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    Request Customization
                                </h3>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isCustomizationRequested}
                                    aria-label="Request Customization"
                                    onClick={() => setIsCustomizationRequested((isOn) => !isOn)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${isCustomizationRequested ? 'bg-purple-600' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isCustomizationRequested ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {isCustomizationRequested && <div className="space-y-4">
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
                                {selectedSeller?.quoteColorCombination && (
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
                                )}

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
                                {selectedSeller?.quoteReferencePhotoUpload && (
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
                                {selectedSeller?.quoteCustomerNotes && (
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
                            </div>}
                        </div>
                    )}
                    {/* Live Chat with Seller (Socket.io) */}
                    {selectedSeller?.ticketSystemEnabled && (
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
                    )}

                    {/* --- Plan Summary Below Chat --- */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mt-6">
                        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-5">
                            <h3 className="text-xl font-bold text-slate-800">Plan Summary</h3>
                            <div className="mt-3 space-y-2 text-sm">
                                <div className="flex justify-between gap-4 text-slate-600">
                                    <span>Event Type</span><span className="font-semibold">{eventData?.eventType || 'Not selected'}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-slate-600">
                                    <span>Date & Time</span><span className="font-semibold">{eventData?.date || 'Not selected'}{eventData?.time ? ` · ${eventData.time}` : ''}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-slate-600">
                                    <span>Guests</span><span className="font-semibold">{eventData?.guestCount || 1} (Limit: {selectedSeller?.minGuestCapacity || 1}-{selectedSeller?.maxGuestCapacity || 500})</span>
                                </div>
                                {selectedProducts.map(product => {
                                    const quantity = Number(product.quantity) || 1;
                                    const pricing = getProductPricing(product);
                                    return (
                                        <div key={product._id} className="flex justify-between gap-4 text-slate-600">
                                            <span>{product.name} × {quantity}</span>
                                            <span className="flex items-center gap-2 font-semibold">
                                                {pricing.hasSalePrice && <span className="text-xs text-slate-400 line-through">₹{(pricing.originalPrice * quantity).toLocaleString('en-IN')}</span>}
                                                <span>₹{(pricing.unitPrice * quantity).toLocaleString('en-IN')}</span>
                                            </span>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between border-t border-purple-100 pt-3 font-bold text-slate-800">
                                    <span>Selected Products</span><span>{selectedProducts.reduce((total, product) => total + (Number(product.quantity) || 0), 0)} items · ₹{selectedProductsSubtotal.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3">
                            <button
                                onClick={handleProceed}
                                className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-extrabold rounded-xl hover:opacity-90 transition-all text-[13px] tracking-wide shadow-md">
                                Proceed to Checkout
                            </button>
                            <button
                                onClick={() => navigate('/plan-my-event/venues')}
                                className="w-full py-3.5 bg-white border-2 border-purple-500 text-purple-600 font-extrabold rounded-xl hover:bg-purple-50 transition-all text-[13px] tracking-wide">
                                EXPLORE & VISIT VENUES
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {imagePreview && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 md:p-8"
                    onClick={() => { setImagePreview(null); setZoomLevel(1); }}
                    role="presentation"
                >
                    <button
                        type="button"
                        onClick={() => { setImagePreview(null); setZoomLevel(1); }}
                        aria-label="Close product preview"
                        className="absolute right-4 top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition-colors"
                    >
                        <span className="text-2xl font-bold leading-none">&times;</span>
                    </button>

                    <div
                        className="flex flex-col md:flex-row w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Left: Image Viewer with Zoom */}
                        <div className="relative flex-1 bg-slate-100 min-h-[45vh] md:min-h-0 flex items-center justify-center overflow-hidden group">
                            <div className="w-full h-full flex items-center justify-center overflow-auto relative">
                                <img
                                    src={imagePreview.images[imagePreview.activeIndex]}
                                    alt={imagePreview.name}
                                    className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out origin-center"
                                    style={{ transform: `scale(${zoomLevel})`, cursor: zoomLevel > 1 ? 'grab' : 'zoom-in' }}
                                    onClick={() => setIsFullScreenImage(true)}
                                    onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png' }}
                                />
                            </div>
































                            {/* Next/Prev Controls */}
                            {(imagePreview.images.length - failedImages.size) > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZoomLevel(1);
                                            setImagePreview(c => {
                                                let nextIndex = (c.activeIndex - 1 + c.images.length) % c.images.length;
                                                while (failedImages.has(nextIndex) && nextIndex !== c.activeIndex) {
                                                    nextIndex = (nextIndex - 1 + c.images.length) % c.images.length;
                                                }
                                                return { ...c, activeIndex: nextIndex };
                                            });
                                        }}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-800 shadow-lg backdrop-blur-sm hover:bg-white transition-colors border border-white"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setZoomLevel(1);
                                            setImagePreview(c => {
                                                let nextIndex = (c.activeIndex + 1) % c.images.length;
                                                while (failedImages.has(nextIndex) && nextIndex !== c.activeIndex) {
                                                    nextIndex = (nextIndex + 1) % c.images.length;
                                                }
                                                return { ...c, activeIndex: nextIndex };
                                            });
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-slate-800 shadow-lg backdrop-blur-sm hover:bg-white transition-colors border border-white"
                                    >
                                        ›
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Right: Product Details */}
                        <div className="w-full md:w-[420px] lg:w-[480px] p-6 lg:p-8 flex flex-col max-h-[50vh] md:max-h-full overflow-y-auto bg-white border-l border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 mb-2 block bg-purple-50 w-fit px-2.5 py-1 rounded-md">
                                {imagePreview.product?.category || selectedSeller?.category || 'Product'}
                            </span>
                            <h2 className="text-2xl lg:text-3xl font-black text-slate-800 leading-tight mb-3">
                                {imagePreview.name}
                            </h2>

                            {imagePreview.product && (
                                <div className="flex items-end gap-3 mb-6 pb-6 border-b border-slate-100">
                                    <span className="text-3xl font-black text-purple-700 tracking-tight">
                                        ₹{(Number(imagePreview.product.salePrice) > 0 && Number(imagePreview.product.salePrice) < Number(imagePreview.product.price)) ? Number(imagePreview.product.salePrice).toLocaleString('en-IN') : Number(imagePreview.product.price).toLocaleString('en-IN')}
                                    </span>
                                    {(Number(imagePreview.product.salePrice) > 0 && Number(imagePreview.product.salePrice) < Number(imagePreview.product.price)) && (
                                        <span className="text-slate-400 line-through text-base font-semibold mb-1">
                                            ₹{Number(imagePreview.product.price).toLocaleString('en-IN')}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="flex-1">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Description</h4>
                                <p className="text-sm text-slate-600 leading-relaxed mb-8 font-medium whitespace-pre-line">
                                    {imagePreview.product?.description || 'No detailed description available for this product.'}
                                </p>

                                {imagePreview.images.length > 1 && (imagePreview.images.length - failedImages.size) > 1 && (
                                    <div className="mb-8">
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">
                                            Gallery Images ({imagePreview.images.length - failedImages.size})
                                        </h4>
                                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                            {imagePreview.images.map((img, idx) => {
                                                if (failedImages.has(idx)) return null;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => { setZoomLevel(1); setImagePreview(c => ({ ...c, activeIndex: idx })) }}
                                                        className={`w-16 h-16 rounded-xl border-2 shrink-0 overflow-hidden transition-all ${imagePreview.activeIndex === idx ? 'border-purple-600 shadow-md scale-105' : 'border-slate-100 opacity-70 hover:opacity-100'}`}
                                                    >
                                                        <img
                                                            src={img}
                                                            className="w-full h-full object-cover bg-slate-50"
                                                            onError={(e) => {
                                                                setFailedImages(prev => new Set(prev).add(idx));
                                                                e.target.src = 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png';
                                                            }}
                                                        />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Button */}
                            {imagePreview.product && (
                                <div className="pt-4 mt-auto border-t border-slate-100 bg-white">
                                    <button
                                        onClick={() => {
                                            handleProductSelection(imagePreview.product);
                                            setImagePreview(null);
                                        }}
                                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all
                                            ${selectedProducts.find(p => p._id === imagePreview.product?._id)
                                                ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                                                : 'bg-purple-600 text-white shadow-lg shadow-purple-200 hover:bg-purple-700 hover:-translate-y-0.5'
                                            }`}
                                    >
                                        {selectedProducts.find(p => p._id === imagePreview.product?._id) ? 'Remove Item' : 'Add to Selection'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>







































                </div>
            )}
        </div>
    );

    const fullScreenViewer = isFullScreenImage && imagePreview && (
        <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-white animate-in fade-in duration-200"
            role="dialog"
            onClick={(e) => {
                e.stopPropagation();
            }}
        >
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsFullScreenImage(false); setZoomLevel(1); }}
                className="absolute left-4 top-4 md:left-6 md:top-6 z-[99999] flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                aria-label="Close full screen view"
            >
                <ArrowBackIcon />
            </button>

            <div className="w-full h-full p-4 md:p-12 flex items-center justify-center relative bg-white overflow-auto">
                <img
                    src={imagePreview.images[imagePreview.activeIndex]}
                    alt={imagePreview.name}
                    className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out origin-center"
                    style={{ transform: `scale(${zoomLevel})`, cursor: zoomLevel > 1 ? 'grab' : 'zoom-in' }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setZoomLevel(prev => prev === 1 ? 2.5 : 1);
                    }}
                    onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png' }}
                />
            </div>

            {(imagePreview.images.length - failedImages.size) > 1 && (
                <>
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(c => {
                                let nextIndex = (c.activeIndex - 1 + c.images.length) % c.images.length;
                                while(failedImages.has(nextIndex) && nextIndex !== c.activeIndex) {
                                    nextIndex = (nextIndex - 1 + c.images.length) % c.images.length;
                                }
                                return {...c, activeIndex: nextIndex};
                            });
                        }} 
                        className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 flex h-14 w-10 md:h-16 md:w-12 items-center justify-center bg-white shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:bg-slate-50 transition-colors rounded-sm"
                    >
                        <span className="text-3xl text-slate-800 leading-none">‹</span>
                    </button>
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(c => {
                                let nextIndex = (c.activeIndex + 1) % c.images.length;
                                while(failedImages.has(nextIndex) && nextIndex !== c.activeIndex) {
                                    nextIndex = (nextIndex + 1) % c.images.length;
                                }
                                return {...c, activeIndex: nextIndex};
                            });
                        }} 
                        className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 flex h-14 w-10 md:h-16 md:w-12 items-center justify-center bg-white shadow-[0_0_15px_rgba(0,0,0,0.1)] hover:bg-slate-50 transition-colors rounded-sm"
                    >
                        <span className="text-3xl text-slate-800 leading-none">›</span>
                    </button>

                    <div className="absolute bottom-6 md:bottom-8 left-0 right-0 flex justify-center gap-2">
                        {imagePreview.images.map((_, idx) => {
                            if (failedImages.has(idx)) return null;
                            return (
                                <div 
                                    key={idx}
                                    className={`h-2 rounded-full transition-all ${imagePreview.activeIndex === idx ? 'w-6 bg-slate-400' : 'w-2 bg-slate-200'}`}
                                />
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );

    if (embeddedState) {
        return (
            <>
                {content}
                {fullScreenViewer}
            </>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <MainLocationHeader hideSearchBar={false} isAbsolute={false} />
            <div id="main-scroll-container" className="flex-1 w-full overflow-y-auto transition-all duration-300" style={{ paddingTop: 'calc(var(--header-height, 180px) - var(--header-shrink-offset, 0px))' }}>
                {content}
            </div>
            {fullScreenViewer}
        </div>
    );
};

export default EventSellerDetailPage;
