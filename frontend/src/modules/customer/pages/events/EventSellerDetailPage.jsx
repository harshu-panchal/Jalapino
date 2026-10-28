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
import EventIcon from '@mui/icons-material/Event';
import { customerApi } from '../../services/customerApi';
import { toast } from 'sonner';
import { ArrowLeft, Heart, ShoppingBag, Clock, Search, Star, MessageSquare } from 'lucide-react';

const resolveProductImageUrl = (path) => (
    typeof path === 'string' && path.startsWith('data:') ? path : resolveImageUrl(path)
);

const getProductPricing = (product) => {
    // If unitPrice or price was directly calculated and stored with add-on
    let basePrice = product?.selectedVariant?.price ?? product?.price;
    let baseSalePrice = product?.selectedVariant?.salePrice ?? product?.salePrice;
    let originalPrice = Number(basePrice) || 0;
    let salePrice = Number(baseSalePrice) || 0;

    // Check add-ons
    const activeVariant = product?.selectedVariant || product?.variants?.[0];
    const hasAddOn = Boolean(activeVariant?.hasAddOn || product?.hasAddOn);
    const addOnType = activeVariant?.addOnType || product?.addOnType || 'fixed';

    // 1. Fixed add-ons (TOGAL 1: Price fixed - automatically included if hasAddOn is true)
    let fixedList = [];
    if (Array.isArray(activeVariant?.fixedAddOns)) {
        fixedList = activeVariant.fixedAddOns;
    } else if (Array.isArray(product?.fixedAddOns)) {
        fixedList = product.fixedAddOns;
    } else if (addOnType === 'fixed' && (activeVariant?.addOns?.length > 0 || product?.addOns?.length > 0)) {
        fixedList = activeVariant?.addOns || product?.addOns || [];
    }
    const validFixedList = fixedList.filter(item => item && (item.name?.trim() || item.price > 0));

    let fixedExtra = 0;
    if (hasAddOn && validFixedList.length > 0) {
        fixedExtra = validFixedList.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    }

    // 2. Click-box add-ons (TOGAL 2: Price click on box - optional, included when selected)
    let selectedClickBoxExtra = 0;
    if (product?.selectedAddOns && Array.isArray(product.selectedAddOns)) {
        // Only sum items from selectedAddOns that are not already counted in fixedExtra
        const fixedNames = new Set(validFixedList.map(f => f.name?.trim().toLowerCase()));
        selectedClickBoxExtra = product.selectedAddOns
            .filter(item => !fixedNames.has(item.name?.trim().toLowerCase()))
            .reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    }

    const totalAddOnExtra = fixedExtra + selectedClickBoxExtra;

    const hasSalePrice = salePrice > 0 && salePrice < originalPrice;
    const baseUnitPrice = hasSalePrice ? salePrice : originalPrice;
    return { originalPrice, unitPrice: baseUnitPrice + totalAddOnExtra, baseUnitPrice, hasSalePrice, fixedExtra, selectedClickBoxExtra, totalAddOnExtra };
};

const EventSellerDetailPage = ({ embeddedState, onBack }) => {
    const navigate = useNavigate();
    const { state: routerState } = useLocation();
    const currentState = embeddedState || routerState || {};
    const { eventData, preferences, selectedCategories, selectedSeller } = currentState;
    const { user } = useAuth();

    // Derived from selected categories (category toggles from admin)
    const relevantCats = selectedCategories && selectedCategories.length > 0 ? selectedCategories : [];

    // Category and Permission Resolution (supports Admin Store Info ON seller AND Service Category in Event Commerce)
    const activeCat = currentState.activeCategory || (
        Array.isArray(selectedSeller?.serviceCategories)
            ? selectedSeller.serviceCategories.find(c => c && (c.name === selectedCategories?.[0] || c._id === selectedCategories?.[0])) || selectedSeller.serviceCategories[0]
            : null
    );

    // When viewing a specific seller, prioritize the seller's specific store permissions configured by Admin.
    // Fall back to category permissions only if seller fields are not defined.
    const isEventDetailsEnabled = Boolean(
        selectedSeller
            ? selectedSeller.eventDetailsEnabled
            : (activeCat?.showEventDetailsForm || activeCat?.eventDetailsEnabled)
    );

    const isPrimaryContactEnabled = Boolean(
        selectedSeller
            ? selectedSeller.primaryContactEnabled
            : activeCat?.primaryContactEnabled
    );

    const isCoupleContactEnabled = Boolean(
        selectedSeller
            ? selectedSeller.coupleContactEnabled
            : activeCat?.coupleContactEnabled
    );

    const isCorporateContactEnabled = Boolean(
        selectedSeller
            ? selectedSeller.corporateContactEnabled
            : activeCat?.corporateContactEnabled
    );

    const isNoOfGuestsEnabled = Boolean(
        selectedSeller
            ? selectedSeller.noOfGuestsEnabled
            : (activeCat?.showNoOfGuestsBox || activeCat?.noOfGuestsEnabled)
    );

    const isFunctionLocationEnabled = Boolean(
        selectedSeller
            ? selectedSeller.functionLocationEnabled
            : activeCat?.functionLocationEnabled
    );

    const isSellerLocationEnabled = Boolean(
        selectedSeller
            ? selectedSeller.sellerLocationEnabled
            : activeCat?.sellerLocationEnabled
    );

    // Determine the default active booking tab based on enabled permissions
    const defaultBookingType = isCorporateContactEnabled && !isPrimaryContactEnabled && !isCoupleContactEnabled
        ? 'corporate'
        : isCoupleContactEnabled && !isPrimaryContactEnabled
            ? 'couple'
            : 'individual';

    // Date & Time Filter toggles
    const showStandardDateFilter = Boolean(selectedSeller ? selectedSeller.showStandardDateTime : activeCat?.showStandardDateTime);
    const showStandardDateSlotFilter = Boolean(selectedSeller ? selectedSeller.showStandardDateTimeSlot : activeCat?.showStandardDateTimeSlot);
    const showAdvancedDateFilter = Boolean(selectedSeller ? selectedSeller.showAdvancedDateTime : activeCat?.showAdvancedDateTime);
    const showAdvancedDateSlotFilter = Boolean(selectedSeller ? selectedSeller.showAdvancedDateTimeSlot : activeCat?.showAdvancedDateTimeSlot);
    const showMultipleDateFilter = Boolean(selectedSeller ? selectedSeller.showMultipleDateTime : activeCat?.showMultipleDateTime);
    const showAnyDateFilter = showStandardDateFilter || showStandardDateSlotFilter || showAdvancedDateFilter || showAdvancedDateSlotFilter || showMultipleDateFilter;

    const dateMode = showMultipleDateFilter ? 'multiple'
        : showAdvancedDateSlotFilter ? 'advancedSlot'
            : showAdvancedDateFilter ? 'advanced'
                : showStandardDateSlotFilter ? 'standardSlot'
                    : showStandardDateFilter ? 'standard'
                        : null;

    // Local / fallback states
    const [localEventTypes, setLocalEventTypes] = useState(currentState.eventTypes || []);
    const [localSelectedType, setLocalSelectedType] = useState(currentState.selectedType || eventData?.eventType || '');
    const [localFilterDate, setLocalFilterDate] = useState(currentState.filterDate || eventData?.date || '');
    const [localFilterEndDate, setLocalFilterEndDate] = useState(currentState.filterEndDate || '');
    const [localFilterTime, setLocalFilterTime] = useState(currentState.filterTime || eventData?.time || '');
    const [localFilterMultipleDates, setLocalFilterMultipleDates] = useState(currentState.filterMultipleDates || eventData?.multipleEvents || []);
    const [localFilterRemarks, setLocalFilterRemarks] = useState(currentState.filterRemarks || '');

    const [multiInputDate, setMultiInputDate] = useState('');
    const [multiInputTime, setMultiInputTime] = useState('');
    const [multiInputRemarks, setMultiInputRemarks] = useState('');

    const [localEventInfo, setLocalEventInfo] = useState({
        bookingType: defaultBookingType,
        primaryContactName: '',
        coupleNames: '',
        corporateCompanyName: '',
        corporateContactPerson: '',
        corporateMobile: '',
        corporateGstNumber: '',
        gender: '',
        dateOfBirth: '',
        anniversaryDate: '',
        primaryPhone: '',
        noOfGuests: eventData?.guestCount || '',
        functionLocation: eventData?.location || '',
        sellerLocation: '',
        ...(currentState.eventInfo || eventData?.eventInfo || {})
    });
    const [localSavingInfo, setLocalSavingInfo] = useState(false);
    const [localSavedInfo, setLocalSavedInfo] = useState(false);
    const saveTimerRef = useRef(null);

    // Active state values: prefer currentState if passed from PlanMyEventPage, else local
    const allEventTypes = (currentState.eventTypes && currentState.eventTypes.length > 0) ? currentState.eventTypes : localEventTypes;
    const activeEventType = currentState.selectedType !== undefined ? currentState.selectedType : localSelectedType;
    const activeDate = currentState.filterDate !== undefined ? currentState.filterDate : localFilterDate;
    const activeEndDate = currentState.filterEndDate !== undefined ? currentState.filterEndDate : localFilterEndDate;
    const activeTime = currentState.filterTime !== undefined ? currentState.filterTime : localFilterTime;
    const activeMultipleDates = currentState.filterMultipleDates !== undefined ? currentState.filterMultipleDates : localFilterMultipleDates;
    const activeRemarks = currentState.filterRemarks !== undefined ? currentState.filterRemarks : localFilterRemarks;
    const activeEventInfo = currentState.eventInfo !== undefined ? currentState.eventInfo : localEventInfo;
    const isSavingInfo = currentState.savingInfo !== undefined ? currentState.savingInfo : localSavingInfo;
    const isSavedInfo = currentState.savedInfo !== undefined ? currentState.savedInfo : localSavedInfo;

    // Calculate minimum allowed booking date based on seller's advanceBookingBuffer
    const minBookingDate = React.useMemo(() => {
        if (!selectedSeller?.advanceBookingBufferEnabled) {
            return new Date().toISOString().split('T')[0];
        }
        const buffer = Number(selectedSeller.advanceBookingBuffer) || 0;
        const unit = selectedSeller.advanceBookingBufferUnit || 'days';
        const extraHours = (unit === 'days' && selectedSeller.advanceBookingBufferTime) ? (Number(selectedSeller.advanceBookingBufferTime) || 0) : 0;
        const totalHours = (unit === 'hours' ? buffer : buffer * 24) + extraHours;

        const minTime = new Date(Date.now() + totalHours * 60 * 60 * 1000);
        return minTime.toISOString().split('T')[0];
    }, [selectedSeller?.advanceBookingBufferEnabled, selectedSeller?.advanceBookingBuffer, selectedSeller?.advanceBookingBufferUnit, selectedSeller?.advanceBookingBufferTime]);

    // Calculate maximum allowed booking date based on seller's advanceBookingBufferAfter (Days)
    const maxBookingDate = React.useMemo(() => {
        if (!selectedSeller?.advanceBookingBufferEnabled || !selectedSeller?.advanceBookingBufferAfter || Number(selectedSeller.advanceBookingBufferAfter) <= 0) {
            return undefined;
        }
        const maxDays = Number(selectedSeller.advanceBookingBufferAfter);
        const maxTime = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000);
        return maxTime.toISOString().split('T')[0];
    }, [selectedSeller?.advanceBookingBufferEnabled, selectedSeller?.advanceBookingBufferAfter]);

    // Check if a date is marked as shop closed / holiday (only if enabled on this seller)
    const isDateClosed = React.useCallback((dateStr) => {
        if (!dateStr || !selectedSeller) return false;
        if (!selectedSeller.shopHolidaysEnabled) return false;
        const closedDates = Array.isArray(selectedSeller.shopClosedDates) ? selectedSeller.shopClosedDates : [];
        return closedDates.includes(dateStr);
    }, [selectedSeller]);

    const isCurrentDateClosed = React.useMemo(() => {
        return Boolean(activeDate && isDateClosed(activeDate));
    }, [activeDate, isDateClosed]);

    // Available time slots based on the specific seller's configured slots or opening & closing hours
    const sellerTimeSlots = React.useMemo(() => {
        if (Array.isArray(selectedSeller?.customTimeSlots) && selectedSeller.customTimeSlots.length > 0) {
            return selectedSeller.customTimeSlots;
        }

        const defaultSlots = [
            "07:00 AM - 08:00 AM", "08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM",
            "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM", "12:00 PM - 01:00 PM",
            "01:00 PM - 02:00 PM", "02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM",
            "04:00 PM - 05:00 PM", "05:00 PM - 06:00 PM", "06:00 PM - 07:00 PM",
            "07:00 PM - 08:00 PM", "08:00 PM - 09:00 PM", "09:00 PM - 10:00 PM",
            "10:00 PM - 11:00 PM"
        ];

        const openTime = selectedSeller?.shopOpeningTime;
        const closeTime = selectedSeller?.shopClosingTime;
        if (!openTime || !closeTime) return defaultSlots;

        const parseTimeToMinutes = (tStr) => {
            if (!tStr) return null;
            const parts = tStr.trim().split(' ');
            if (parts.length < 2) return null;
            const [time, modifier] = parts;
            const [h, m] = time.split(':');
            let hours = parseInt(h, 10);
            const minutes = parseInt(m, 10) || 0;
            if (hours === 12) {
                hours = modifier.toUpperCase() === 'PM' ? 12 : 0;
            } else if (modifier.toUpperCase() === 'PM') {
                hours += 12;
            }
            return hours * 60 + minutes;
        };

        const formatTime12h = (minutes) => {
            let h = Math.floor(minutes / 60);
            const m = minutes % 60;
            const period = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
        };

        const openMin = parseTimeToMinutes(openTime);
        const closeMin = parseTimeToMinutes(closeTime);
        if (openMin === null || closeMin === null || openMin >= closeMin) return defaultSlots;

        return [`${formatTime12h(openMin)} - ${formatTime12h(closeMin)}`];
    }, [selectedSeller?.customTimeSlots, selectedSeller?.shopOpeningTime, selectedSeller?.shopClosingTime]);

    // Ensure the current booking type is valid for active permissions, else fallback to defaultBookingType
    const effectiveBookingType = (
        (activeEventInfo.bookingType === 'corporate' && isCorporateContactEnabled) ||
        (activeEventInfo.bookingType === 'couple' && isCoupleContactEnabled) ||
        (activeEventInfo.bookingType === 'individual' && isPrimaryContactEnabled)
    ) ? activeEventInfo.bookingType : defaultBookingType;

    const handleEventTypeChange = (val) => {
        if (currentState.setSelectedType) currentState.setSelectedType(val);
        setLocalSelectedType(val);
    };

    const handleDateChange = (val) => {
        if (currentState.setFilterDate) currentState.setFilterDate(val);
        setLocalFilterDate(val);
    };

    const handleEndDateChange = (val) => {
        if (currentState.setFilterEndDate) currentState.setFilterEndDate(val);
        setLocalFilterEndDate(val);
    };

    const handleTimeChange = (val) => {
        if (currentState.setFilterTime) currentState.setFilterTime(val);
        setLocalFilterTime(val);
    };

    const handleMultipleDatesChange = (updater) => {
        if (currentState.setFilterMultipleDates) currentState.setFilterMultipleDates(updater);
        setLocalFilterMultipleDates(updater);
    };

    const handleRemarksChange = (val) => {
        if (currentState.setFilterRemarks) currentState.setFilterRemarks(val);
        setLocalFilterRemarks(val);
    };

    const handleEventInfoFieldChange = (field, val) => {
        if (currentState.handleEventInfoChange) {
            currentState.handleEventInfoChange(field, val);
        }
        setLocalEventInfo(prev => ({ ...prev, [field]: val }));
        setLocalSavedInfo(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try {
                setLocalSavingInfo(true);
                await customerApi.updateProfile({ [field]: val || null });
                setLocalSavedInfo(true);
            } catch (err) {
                console.error("Failed to update profile", err);
            } finally {
                setLocalSavingInfo(false);
            }
        }, 800);
    };

    // Load event types if not already provided
    useEffect(() => {
        if (!currentState.eventTypes || currentState.eventTypes.length === 0) {
            eventConfigApi.getEventTypes()
                .then(res => setLocalEventTypes(Array.isArray(res) ? res : []))
                .catch(err => console.error("Error fetching event types", err));
        }
    }, [currentState.eventTypes]);

    // Load customer profile into eventInfo if not already populated
    useEffect(() => {
        if (!currentState.eventInfo) {
            customerApi.getProfile()
                .then(res => {
                    const p = res?.data?.result || {};
                    setLocalEventInfo(prev => ({
                        ...prev,
                        bookingType: p.bookingType || prev.bookingType || 'individual',
                        primaryContactName: p.name || prev.primaryContactName || '',
                        gender: p.gender || prev.gender || '',
                        dateOfBirth: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : prev.dateOfBirth || '',
                        anniversaryDate: p.anniversaryDate ? p.anniversaryDate.split('T')[0] : prev.anniversaryDate || '',
                        functionLocation: p.functionLocation || prev.functionLocation || '',
                    }));
                })
                .catch(err => console.error("Error fetching profile", err));
        }
    }, [currentState.eventInfo]);

    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [imagePreview, setImagePreview] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const selectedProductsStorageKey = `jalapino_plan_event_products_${selectedSeller?._id || 'seller'}`;

    const [failedImages, setFailedImages] = useState(new Set());
    const [isFullScreenImage, setIsFullScreenImage] = useState(false);
    const [modalSelectedVariant, setModalSelectedVariant] = useState(null);
    const [ticketSoldMap, setTicketSoldMap] = useState({});
    const [selectedShop, setSelectedShop] = useState(null);
    const [sellerBookedSlots, setSellerBookedSlots] = useState([]);
    const [selectedAddOns, setSelectedAddOns] = useState({});

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
            const currentlySelected = selectedProducts.find(p => p._id === product._id);
            const initialVariant = currentlySelected?.selectedVariant
                || (product.variants && product.variants.length > 0 ? product.variants[0] : null);

            if (currentlySelected?.selectedAddOns && Array.isArray(currentlySelected.selectedAddOns)) {
                const key = `${product._id}_${initialVariant?.sku || initialVariant?.name || 'default'}`;
                // Only load optional/click-box add-ons that actually still exist on the variant
                const availableClickBoxNames = new Set((initialVariant?.clickBoxAddOns || product.clickBoxAddOns || []).map(a => a.name?.trim().toLowerCase()));
                const optionalAddOns = currentlySelected.selectedAddOns.filter(a => !a.isFixed && availableClickBoxNames.has(a.name?.trim().toLowerCase()));
                setSelectedAddOns(prev => ({
                    ...prev,
                    [key]: optionalAddOns
                }));
            } else {
                const key = `${product._id}_${initialVariant?.sku || initialVariant?.name || 'default'}`;
                setSelectedAddOns(prev => ({
                    ...prev,
                    [key]: []
                }));
            }

            setImagePreview({ images, activeIndex: 0, name: product.name, product: product });
            setModalSelectedVariant(initialVariant);
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

                // Fetch dynamic booked ticket capacity for ticket products
                const ticketProducts = sellerProducts.filter(p => p.tickets?.length > 0);
                if (ticketProducts.length > 0) {
                    Promise.all(ticketProducts.map(p =>
                        axiosInstance.get(`/general-booking/capacity/${p._id}${activeDate ? `?date=${activeDate}` : ''}`)
                            .then(res => ({ id: p._id, count: res.data?.result?.bookedCount || 0 }))
                            .catch(() => ({ id: p._id, count: 0 }))
                    )).then(results => {
                        const mapping = {};
                        results.forEach(r => { mapping[r.id] = r.count; });
                        setTicketSoldMap(mapping);
                    }).catch(() => { });
                }
                try {
                    const savedSelection = JSON.parse(sessionStorage.getItem(selectedProductsStorageKey) || '[]');
                    const productsMap = new Map(sellerProducts.map(p => [String(p._id), p]));
                    const restored = [];
                    for (const item of savedSelection) {
                        const baseProduct = productsMap.get(String(item.productId));
                        if (baseProduct) {
                            const activeVariant = item.selectedVariant
                                ? baseProduct.variants?.find(v => (v.sku || v.name) === (item.selectedVariant.sku || item.selectedVariant.name)) || item.selectedVariant
                                : baseProduct.variants?.[0];
                            const availableAddOnNames = new Set([
                                ...(activeVariant?.fixedAddOns || baseProduct.fixedAddOns || []).map(a => a.name?.trim().toLowerCase()),
                                ...(activeVariant?.clickBoxAddOns || baseProduct.clickBoxAddOns || []).map(a => a.name?.trim().toLowerCase())
                            ]);
                            const sanitizedAddOns = Array.isArray(item.selectedAddOns)
                                ? item.selectedAddOns.filter(a => availableAddOnNames.has(a.name?.trim().toLowerCase()))
                                : [];

                            restored.push({
                                ...baseProduct,
                                quantity: Number(item.quantity) || 1,
                                selectedColors: item.selectedColors || [],
                                ...(activeVariant ? { selectedVariant: activeVariant } : {}),
                                ...(item.price !== undefined ? { price: item.price } : {}),
                                ...(item.salePrice !== undefined ? { salePrice: item.salePrice } : {}),
                                selectedAddOns: sanitizedAddOns
                            });
                        }
                    }
                    setSelectedProducts(restored);
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

    // Fetch booked time slots for this seller on activeDate
    useEffect(() => {
        if (!selectedSeller?._id || !activeDate) {
            setSellerBookedSlots([]);
            return;
        }
        axiosInstance.get(`/events/slots/${selectedSeller._id}?date=${activeDate}`)
            .then(res => {
                const slots = res.data?.result?.bookedSlots || [];
                setSellerBookedSlots(Array.isArray(slots) ? slots : []);
            })
            .catch(() => setSellerBookedSlots([]));
    }, [selectedSeller?._id, activeDate]);

    useEffect(() => {
        if (isLoadingProducts) return;
        try {
            sessionStorage.setItem(selectedProductsStorageKey, JSON.stringify(
                selectedProducts.map(({ _id, quantity, selectedColors = [], selectedVariant, price, salePrice, selectedAddOns = [] }) => ({
                    productId: _id,
                    quantity,
                    selectedColors,
                    selectedVariant,
                    price,
                    salePrice,
                    selectedAddOns
                }))
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

    const getProductCapacityConfig = (product, variant) => {
        if (!selectedSeller?.capacityEnabled) return null;
        const shops = Array.isArray(selectedSeller?.shopsAtLocation) ? selectedSeller.shopsAtLocation : [];
        const variantCode = variant?.uniqueCode || product?.uniqueCode;
        const matchedShop = shops.find(s => s.uniqueCode && variantCode && s.uniqueCode === variantCode)
            || shops.find(s => String(s.shopNo) === String(variant?.shopNo || product?.shopNo))
            || shops[0];

        const minimum = Number(variant?.minimum ?? product?.minimum ?? matchedShop?.minimum ?? 0);
        const maximum = Number(variant?.maximum ?? product?.maximum ?? matchedShop?.maximum ?? 0);
        const totalCap = Number(variant?.totalCapacity ?? product?.totalCapacity ?? matchedShop?.totalCapacity ?? 0);
        const maxLimit = maximum > 0 ? maximum : (totalCap > 0 ? totalCap : 0);
        const bookingType = String(variant?.bookingType || product?.bookingType || matchedShop?.bookingType || 'MULTIPLE').toUpperCase();
        const capacityType = String(variant?.capacityType || product?.capacityType || matchedShop?.capacityType || 'SHOP CAPECITY').toUpperCase();

        return {
            enabled: true,
            minimum: minimum > 0 ? minimum : 1,
            maximum: maxLimit,
            bookingType,
            capacityType,
            uniqueCode: variantCode || matchedShop?.uniqueCode || ''
        };
    };

    const getFixedAddOnsForProduct = (product, variant) => {
        const activeVariant = variant || product?.selectedVariant || product?.variants?.[0];
        const hasAddOn = Boolean(activeVariant?.hasAddOn || product?.hasAddOn);
        if (!hasAddOn) return [];

        let fixedList = [];
        if (Array.isArray(activeVariant?.fixedAddOns)) {
            fixedList = activeVariant.fixedAddOns;
        } else if (Array.isArray(product?.fixedAddOns)) {
            fixedList = product.fixedAddOns;
        } else if ((activeVariant?.addOnType || product?.addOnType) === 'fixed') {
            fixedList = activeVariant?.addOns || product?.addOns || [];
        }
        return fixedList
            .filter(item => item && (item.name?.trim() || item.price > 0))
            .map(a => ({ ...a, isFixed: true }));
    };

    const handleProductQuantityChange = (product, change) => {
        const capConfig = getProductCapacityConfig(product, product.selectedVariant);

        setSelectedProducts(prev => {
            const variantKey = product.selectedVariant?.sku || product.selectedVariant?.name || 'default';
            const selectedProduct = prev.find(p => p._id === product._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === variantKey);
            const currentQty = selectedProduct?.quantity || 0;

            if (currentQty === 0 && change > 0) {
                const initialQty = (capConfig && capConfig.minimum > 0) ? capConfig.minimum : 1;
                const autoFixedAddOns = getFixedAddOnsForProduct(product, product.selectedVariant);
                const existingAddOns = Array.isArray(product.selectedAddOns) ? product.selectedAddOns : [];
                // Merge if not already present
                const fixedNames = new Set(existingAddOns.map(a => a.name?.trim().toLowerCase()));
                const mergedAddOns = [
                    ...existingAddOns,
                    ...autoFixedAddOns.filter(f => !fixedNames.has(f.name?.trim().toLowerCase()))
                ];
                return [...prev, { ...product, quantity: initialQty, selectedAddOns: mergedAddOns }];
            }

            if (change > 0) {
                if (capConfig && capConfig.maximum > 0 && (currentQty + change) > capConfig.maximum) {
                    toast.error(`Maximum allowed capacity is ${capConfig.maximum}`);
                    return prev;
                }
                const nextQuantity = currentQty + change;
                return prev.map(p => {
                    const pVariantKey = p.selectedVariant?.sku || p.selectedVariant?.name || 'default';
                    if (p._id === product._id && pVariantKey === variantKey) {
                        return {
                            ...p,
                            quantity: nextQuantity,
                            selectedAddOns: product.selectedAddOns !== undefined ? product.selectedAddOns : p.selectedAddOns,
                            price: product.price !== undefined ? product.price : p.price
                        };
                    }
                    return p;
                });
            } else if (change < 0) {
                if (capConfig && capConfig.minimum > 1 && currentQty <= capConfig.minimum) {
                    // Clicking minus at minimum removes the item
                    return prev.filter(p => !(p._id === product._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === variantKey));
                }
                const nextQuantity = currentQty + change;
                if (nextQuantity <= 0) {
                    return prev.filter(p => !(p._id === product._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === variantKey));
                }
                return prev.map(p => {
                    const pVariantKey = p.selectedVariant?.sku || p.selectedVariant?.name || 'default';
                    if (p._id === product._id && pVariantKey === variantKey) {
                        return { ...p, quantity: nextQuantity };
                    }
                    return p;
                });
            }

            return prev;
        });
    };

    const handleProductSelection = (product) => {
        const activeVariant = product.selectedVariant || product.variants?.[0];
        const capConfig = getProductCapacityConfig(product, activeVariant);
        const initialQty = (capConfig && capConfig.minimum > 0) ? capConfig.minimum : 1;
        const autoFixedAddOns = getFixedAddOnsForProduct(product, activeVariant);
        const existingAddOns = Array.isArray(product.selectedAddOns) ? product.selectedAddOns : [];
        const fixedNames = new Set(existingAddOns.map(a => a.name?.trim().toLowerCase()));
        const mergedAddOns = [
            ...existingAddOns,
            ...autoFixedAddOns.filter(f => !fixedNames.has(f.name?.trim().toLowerCase()))
        ];

        const variantKey = activeVariant?.sku || activeVariant?.name || 'default';
        setSelectedProducts(prev => prev.some(p => p._id === product._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === variantKey)
            ? prev.filter(p => !(p._id === product._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === variantKey))
            : [...prev, { ...product, selectedVariant: activeVariant, quantity: initialQty, selectedColors: [], selectedAddOns: mergedAddOns }]);
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
        if (isCurrentDateClosed) {
            toast.error(`Shop is closed on ${activeDate}. Please select another date.`);
            return;
        }
        if (activeDate && minBookingDate && activeDate < minBookingDate) {
            toast.error(`Event date must be on or after ${minBookingDate} due to seller's advance booking notice.`);
            return;
        }
        if (activeDate && maxBookingDate && activeDate > maxBookingDate) {
            toast.error(`Event date cannot be after ${maxBookingDate} for this seller.`);
            return;
        }

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
                selectedProductQuantities: selectedProducts.map(({ _id, quantity, selectedVariant, selectedAddOns }) => ({ productId: _id, quantity, selectedVariant, selectedAddOns })),
                selectedProductColors: selectedProducts
                    .filter(product => product.selectedColors?.length)
                    .map(({ _id, name, selectedColors }) => ({ productId: _id, productName: name, colors: selectedColors }))
            }
        };

        const resolvedEventType = allEventTypes?.find(t => (t.value || t._id) === activeEventType)?.name || activeEventType || eventData?.eventType || '';
        const resolvedDate = activeDate || eventData?.date || (activeMultipleDates?.[0]?.date) || '';
        const resolvedTime = activeTime || eventData?.time || (activeMultipleDates?.[0]?.time) || '';
        const resolvedRemarks = activeRemarks || eventData?.remarks || (activeMultipleDates?.[0]?.remarks) || '';

        const updatedEventData = {
            ...eventData,
            eventType: resolvedEventType,
            date: resolvedDate,
            time: resolvedTime,
            remarks: resolvedRemarks,
            multipleEvents: activeMultipleDates.length > 0 ? activeMultipleDates : eventData?.multipleEvents || [],
            guestCount: Number(activeEventInfo.noOfGuests || eventData?.guestCount || 1),
            location: activeEventInfo.functionLocation || eventData?.location || '',
            eventInfo: activeEventInfo,
        };

        // Keep the selected products and quantities available after refresh/back navigation.
        const checkoutState = {
            eventData: updatedEventData,
            preferences: collectedPreferences,
            selectedCategories,
            selectedSeller,
            selectedShop,
            selectedProducts: selectedProducts.filter(p => !p.tickets || p.tickets.length === 0),
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

    const selectedProductsSubtotal = selectedProducts
        .filter(product => !product.tickets || product.tickets.length === 0)
        .reduce((total, product) => {
            const pr = getProductPricing(product);
            const qty = Number(product.quantity) || 1;
            return total + (pr.baseUnitPrice * qty) + pr.totalAddOnExtra;
        }, 0);

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

                    {/* ─── DATE & TIME FILTERS (Seller & Service Category Driven) ─── */}
                    {showAnyDateFilter && (
                        <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-5 shadow-sm space-y-3">
                            {selectedSeller?.advanceBookingBufferEnabled && (selectedSeller?.advanceBookingBuffer > 0 || selectedSeller?.advanceBookingBufferAfter > 0) && (
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-100/70 border border-amber-300/80 px-3.5 py-2 rounded-2xl">
                                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                        ⏳ Advance Booking Notice: Requires minimum {selectedSeller.advanceBookingBuffer || 0} {selectedSeller.advanceBookingBufferUnit || 'days'} notice.
                                        {selectedSeller.advanceBookingBufferAfter > 0 ? ` (Max ${selectedSeller.advanceBookingBufferAfter} days in advance)` : ''}
                                    </span>
                                    {isCurrentDateClosed ? (
                                        <span className="text-xs font-black text-red-600 bg-red-100 px-2.5 py-1 rounded-xl">
                                            🚫 Shop Closed / Holiday on {activeDate}
                                        </span>
                                    ) : activeDate && minBookingDate && activeDate < minBookingDate ? (
                                        <span className="text-xs font-black text-red-600 bg-red-100 px-2.5 py-1 rounded-xl">
                                            ⚠️ Not Available for {activeDate} (Earliest: {minBookingDate})
                                        </span>
                                    ) : activeDate && maxBookingDate && activeDate > maxBookingDate ? (
                                        <span className="text-xs font-black text-red-600 bg-red-100 px-2.5 py-1 rounded-xl">
                                            ⚠️ Too far in advance (Latest: {maxBookingDate})
                                        </span>
                                    ) : activeDate ? (
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-xl">
                                            ✅ Available for booking
                                        </span>
                                    ) : null}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-3 items-end">
                                {/* Event Type */}
                                <div className="flex flex-col gap-1 min-w-[170px] flex-1 sm:flex-initial">
                                    <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1">
                                        <EventIcon sx={{ fontSize: 13 }} /> Event Type
                                    </label>
                                    <select
                                        value={activeEventType}
                                        onChange={e => handleEventTypeChange(e.target.value)}
                                        className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                                    >
                                        <option value="">-- Select Type --</option>
                                        {allEventTypes.map(t => (
                                            <option key={t.value || t._id} value={t.value || t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {dateMode === 'multiple' && (
                                    <>
                                        <div className="flex flex-col gap-1 min-w-[150px]">
                                            <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">📅 Event Date</label>
                                            <input
                                                type="date"
                                                value={multiInputDate}
                                                onChange={e => setMultiInputDate(e.target.value)}
                                                min={minBookingDate}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-[130px]">
                                            <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">🕐 Time</label>
                                            <input
                                                type="time"
                                                value={multiInputTime}
                                                onChange={e => setMultiInputTime(e.target.value)}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                                            <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">📝 Remarks / Occasion</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Haldi, Sangeet, Reception"
                                                value={multiInputRemarks}
                                                onChange={e => setMultiInputRemarks(e.target.value)}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!multiInputDate) return;
                                                if (isDateClosed(multiInputDate)) {
                                                    toast.error(`Shop is closed on ${multiInputDate}. Please select another date.`);
                                                    return;
                                                }
                                                const newEntry = {
                                                    id: Date.now(),
                                                    typeId: activeEventType,
                                                    typeName: allEventTypes.find(t => (t.value || t._id) === activeEventType)?.name || activeEventType || 'Event',
                                                    date: multiInputDate,
                                                    time: multiInputTime,
                                                    remarks: multiInputRemarks
                                                };
                                                handleMultipleDatesChange(prev => [...(prev || []), newEntry]);
                                                setMultiInputDate('');
                                                setMultiInputTime('');
                                                setMultiInputRemarks('');
                                            }}
                                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
                                        >
                                            + Add Date
                                        </button>
                                        {activeMultipleDates && activeMultipleDates.length > 0 && (
                                            <div className="w-full mt-2">
                                                <div className="flex flex-col gap-2">
                                                    {activeMultipleDates.map((item, idx) => (
                                                        <div key={item.id || idx} className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-amber-200">
                                                            <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700 items-center">
                                                                <span className="text-purple-700 font-bold bg-purple-50 px-2 py-1 rounded-md">🎉 {item.typeName || item.typeId}</span>
                                                                <span className="flex items-center gap-1">📅 {item.date}</span>
                                                                {item.time && <span className="flex items-center gap-1">🕐 {item.time}</span>}
                                                                {item.remarks && <span className="text-slate-500 font-normal italic flex items-center gap-1">📝 {item.remarks}</span>}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMultipleDatesChange(prev => prev.filter(x => x.id !== item.id))}
                                                                className="text-red-500 hover:bg-red-50 px-2 py-1 rounded font-black text-[10px] uppercase transition-colors"
                                                            >
                                                                ✕ Remove
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {(dateMode === 'advancedSlot' || dateMode === 'advanced') && (
                                    <>
                                        <div className="flex flex-col gap-1 min-w-[150px]">
                                            <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">📅 Start Date</label>
                                            <input
                                                type="date"
                                                value={activeDate}
                                                onChange={e => handleDateChange(e.target.value)}
                                                min={minBookingDate}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-[150px]">
                                            <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">📅 End Date</label>
                                            <input
                                                type="date"
                                                value={activeEndDate}
                                                onChange={e => handleEndDateChange(e.target.value)}
                                                min={activeDate || minBookingDate}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        {dateMode === 'advancedSlot' && (
                                            <div className="flex flex-col gap-1 min-w-[170px]">
                                                <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">🕐 Time Slot</label>
                                                <select
                                                    value={activeTime}
                                                    onChange={e => handleTimeChange(e.target.value)}
                                                    className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                                                >
                                                    <option value="">-- Select Slot --</option>
                                                    {sellerTimeSlots.map(slot => {
                                                        const isBooked = sellerBookedSlots.includes(slot);
                                                        return (
                                                            <option key={slot} value={slot} disabled={isBooked} className={isBooked ? "text-red-500 bg-slate-100 font-semibold" : ""}>
                                                                {slot} {isBooked ? "(Already Booked)" : ""}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        )}
                                        {dateMode === 'advanced' && (
                                            <div className="flex flex-col gap-1 min-w-[140px]">
                                                <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">🕐 Time</label>
                                                <input
                                                    type="time"
                                                    value={activeTime}
                                                    onChange={e => handleTimeChange(e.target.value)}
                                                    className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {(dateMode === 'standardSlot' || dateMode === 'standard') && (
                                    <>
                                        <div className="flex flex-col gap-1 min-w-[150px]">
                                            <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">📅 Date</label>
                                            <input
                                                type="date"
                                                value={activeDate}
                                                onChange={e => handleDateChange(e.target.value)}
                                                min={minBookingDate}
                                                max={maxBookingDate}
                                                className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        {dateMode === 'standardSlot' && (
                                            <div className="flex flex-col gap-1 min-w-[170px]">
                                                <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">🕐 Time Slot</label>
                                                <select
                                                    value={activeTime}
                                                    onChange={e => handleTimeChange(e.target.value)}
                                                    className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                                                >
                                                    <option value="">-- Select Slot --</option>
                                                    {sellerTimeSlots.map(slot => {
                                                        const isBooked = sellerBookedSlots.includes(slot);
                                                        return (
                                                            <option key={slot} value={slot} disabled={isBooked} className={isBooked ? "text-red-500 bg-slate-100 font-semibold" : ""}>
                                                                {slot} {isBooked ? "(Already Booked)" : ""}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        )}
                                        {dateMode === 'standard' && (
                                            <div className="flex flex-col gap-1 min-w-[140px]">
                                                <label className="text-[10px] font-black text-amber-800 uppercase tracking-wider">🕐 Time</label>
                                                <input
                                                    type="time"
                                                    value={activeTime}
                                                    onChange={e => handleTimeChange(e.target.value)}
                                                    className="border border-amber-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {(activeDate || activeEndDate || activeTime || (activeMultipleDates && activeMultipleDates.length > 0)) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleDateChange('');
                                            handleEndDateChange('');
                                            handleTimeChange('');
                                            handleMultipleDatesChange([]);
                                            handleRemarksChange('');
                                            setMultiInputDate('');
                                            setMultiInputTime('');
                                            setMultiInputRemarks('');
                                        }}
                                        className="text-xs text-red-500 font-bold hover:underline self-end pb-2 ml-auto"
                                    >
                                        ✕ Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── EVENT DETAILS FORM (Seller & Service Category Driven) ─── */}
                    {isEventDetailsEnabled && (
                        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-xs font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🎉</span> Your Event Details
                                    </h3>
                                    {/* Booking Type Tabs: only show types enabled in seller / category */}
                                    {(isPrimaryContactEnabled || isCoupleContactEnabled || isCorporateContactEnabled) && (
                                        <div className="flex bg-purple-50 rounded-lg p-0.5">
                                            {isPrimaryContactEnabled && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleEventInfoFieldChange('bookingType', 'individual')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${effectiveBookingType === 'individual' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-600 hover:bg-purple-100'}`}
                                                >
                                                    Individual
                                                </button>
                                            )}
                                            {isCoupleContactEnabled && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleEventInfoFieldChange('bookingType', 'couple')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${effectiveBookingType === 'couple' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-600 hover:bg-purple-100'}`}
                                                >
                                                    Couple
                                                </button>
                                            )}
                                            {isCorporateContactEnabled && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleEventInfoFieldChange('bookingType', 'corporate')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${effectiveBookingType === 'corporate' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-600 hover:bg-purple-100'}`}
                                                >
                                                    Corporate
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {isSavingInfo && <span className="text-[10px] text-slate-400 font-medium">Saving...</span>}
                                    {isSavedInfo && <span className="text-[10px] text-green-500 font-bold">✓ Saved</span>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Contact Name Field */}
                                {(effectiveBookingType === 'corporate' ? isCorporateContactEnabled : effectiveBookingType === 'couple' ? isCoupleContactEnabled : isPrimaryContactEnabled) && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            {effectiveBookingType === 'corporate' ? '🏢 Company Name' : effectiveBookingType === 'couple' ? '💑 Couple Names' : '👤 Primary Contact'}
                                        </label>
                                        <input
                                            type="text"
                                            value={effectiveBookingType === 'corporate' ? (activeEventInfo.corporateCompanyName || '') : effectiveBookingType === 'couple' ? (activeEventInfo.coupleNames || activeEventInfo.primaryContactName || '') : (activeEventInfo.primaryContactName || '')}
                                            onChange={e => handleEventInfoFieldChange(effectiveBookingType === 'corporate' ? 'corporateCompanyName' : effectiveBookingType === 'couple' ? 'coupleNames' : 'primaryContactName', e.target.value)}
                                            placeholder={effectiveBookingType === 'corporate' ? 'e.g. Acme Corp' : effectiveBookingType === 'couple' ? 'e.g. Rahul & Priya' : 'Your full name'}
                                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                        />
                                    </div>
                                )}

                                {/* Corporate Fields */}
                                {effectiveBookingType === 'corporate' && isCorporateContactEnabled && (
                                    <>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">👤 Contact Person</label>
                                            <input
                                                type="text"
                                                value={activeEventInfo.corporateContactPerson || ''}
                                                onChange={e => handleEventInfoFieldChange('corporateContactPerson', e.target.value)}
                                                placeholder="Contact person name"
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📞 Mobile Number</label>
                                            <input
                                                type="tel"
                                                value={activeEventInfo.corporateMobile || ''}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    if (val.length <= 10) handleEventInfoFieldChange('corporateMobile', val);
                                                }}
                                                maxLength="10"
                                                placeholder="10-digit mobile number"
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📄 GST Number (Optional)</label>
                                            <input
                                                type="text"
                                                value={activeEventInfo.corporateGstNumber || ''}
                                                onChange={e => handleEventInfoFieldChange('corporateGstNumber', e.target.value)}
                                                placeholder="GSTIN"
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Individual Gender */}
                                {effectiveBookingType === 'individual' && isPrimaryContactEnabled && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">⚧ Gender</label>
                                        <div className="flex gap-2 h-[38px] items-center">
                                            {['Male', 'Female', 'Other'].map(g => (
                                                <label key={g} className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="sellerDetailGender"
                                                        value={g}
                                                        checked={activeEventInfo.gender === g}
                                                        onChange={e => handleEventInfoFieldChange('gender', e.target.value)}
                                                        className="accent-purple-600 w-4 h-4"
                                                    />
                                                    {g}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Date of Birth / Anniversary Date */}
                                {(effectiveBookingType === 'couple' ? isCoupleContactEnabled : effectiveBookingType === 'individual' ? isPrimaryContactEnabled : false) && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            {effectiveBookingType === 'couple' ? '💍 Anniversary Date' : '🎂 Date of Birth'}
                                        </label>
                                        <input
                                            type="date"
                                            value={effectiveBookingType === 'couple' ? (activeEventInfo.anniversaryDate || '') : (activeEventInfo.dateOfBirth || '')}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={e => handleEventInfoFieldChange(effectiveBookingType === 'couple' ? 'anniversaryDate' : 'dateOfBirth', e.target.value)}
                                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400"
                                        />
                                    </div>
                                )}

                                {/* No of Guests */}
                                {isNoOfGuestsEnabled && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">👥 No of Guests</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={activeEventInfo.noOfGuests || ''}
                                            onChange={e => handleEventInfoFieldChange('noOfGuests', e.target.value)}
                                            placeholder="e.g. 150"
                                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                        />
                                    </div>
                                )}

                                {/* Function Location */}
                                {isFunctionLocationEnabled && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📍 Function Location</label>
                                        <input
                                            type="text"
                                            value={activeEventInfo.functionLocation || ''}
                                            onChange={e => handleEventInfoFieldChange('functionLocation', e.target.value)}
                                            placeholder="City / Venue area"
                                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                        />
                                    </div>
                                )}

                                {/* Seller Location */}
                                {isSellerLocationEnabled && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">📍 Seller Location</label>
                                        <input
                                            type="text"
                                            value={activeEventInfo.sellerLocation || ''}
                                            onChange={e => handleEventInfoFieldChange('sellerLocation', e.target.value)}
                                            placeholder="Seller's city/area"
                                            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-300"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Products Grid */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">


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
                                    const matchingSelected = selectedProducts.filter(p => p._id === product._id);
                                    const isSelected = matchingSelected.length > 0;
                                    const totalQuantity = matchingSelected.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
                                    const totalPrice = matchingSelected.reduce((sum, p) => {
                                        const pr = getProductPricing(p);
                                        const qty = Number(p.quantity) || 1;
                                        return sum + (pr.baseUnitPrice * qty) + pr.totalAddOnExtra;
                                    }, 0);
                                    const totalOriginalPrice = matchingSelected.reduce((sum, p) => {
                                        const pr = getProductPricing(p);
                                        const qty = Number(p.quantity) || 1;
                                        return sum + (pr.originalPrice * qty) + pr.totalAddOnExtra;
                                    }, 0);
                                    const hasAnySalePrice = matchingSelected.some(p => getProductPricing(p).hasSalePrice);
                                    const defaultPricing = getProductPricing(product);
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
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-sm text-slate-800 truncate">
                                                        {product.name}
                                                    </h4>
                                                    {matchingSelected.length > 0 && matchingSelected.some(p => p.selectedVariant?.name) && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {matchingSelected.map((item, idx) => item.selectedVariant?.name ? (
                                                                <span key={item.selectedVariant?.sku || item.selectedVariant?.name || idx} className="text-[10px] font-semibold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded border border-purple-200">
                                                                    {item.selectedVariant.name} × {item.quantity}
                                                                </span>
                                                            ) : null)}
                                                        </div>
                                                    )}
                                                    {matchingSelected.length > 0 && matchingSelected.some(p => p.selectedAddOns?.length > 0) ? (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {matchingSelected.flatMap(p => p.selectedAddOns || []).map((addon, aIdx) => (
                                                                <span key={aIdx} className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                                    + {addon.name} (₹{addon.price})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (() => {
                                                        const autoFixed = getFixedAddOnsForProduct(product);
                                                        if (autoFixed.length > 0) {
                                                            return (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {autoFixed.map((addon, aIdx) => (
                                                                        <span key={aIdx} className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                                                            ✨ Incl: {addon.name} (+₹{addon.price})
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{product.description}</p>
                                                    {(() => {
                                                        const cap = getProductCapacityConfig(product, product.variants?.[0]);
                                                        if (!cap || !selectedSeller?.capacityEnabled) return null;
                                                        return (
                                                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded">
                                                                    Cap: Min = {cap.minimum}, Max = {cap.maximum > 0 ? cap.maximum : 'No limit'} ({cap.bookingType})
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                    {product.tickets?.length > 0 && (
                                                        <div className="mt-2 space-y-1.5">
                                                            {product.tickets.map((ticket, ticketIndex) => {
                                                                const soldCount = ticketSoldMap[product._id] || 0;
                                                                const totalCap = Number(ticket.capacity ?? 0);
                                                                const remainingCap = Math.max(0, totalCap - soldCount);
                                                                const isSoldOut = totalCap > 0 && remainingCap <= 0;

                                                                return (
                                                                    <div key={ticket._id || ticketIndex} className="rounded-lg bg-purple-50/70 border border-purple-100 px-2.5 py-2">
                                                                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                                                                            <span className="font-bold text-slate-800">{ticket.name}</span>
                                                                            {ticket.capacity !== undefined && ticket.capacity !== null && (
                                                                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${isSoldOut
                                                                                    ? 'bg-red-100 text-red-600 border border-red-200'
                                                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                                    }`}>
                                                                                    {isSoldOut ? 'Sold Out' : `Capacity: ${remainingCap} Left`}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {ticket.instructions && (
                                                                            <p className="text-[10px] text-slate-600 mt-1 font-medium bg-white/70 p-1.5 rounded border border-purple-100/60">
                                                                                📋 {ticket.instructions}
                                                                            </p>
                                                                        )}
                                                                        {ticket.timeSlotsEnabled && ticket.timeSlots?.length > 0 && (
                                                                            <p className="text-[10px] text-slate-500 mt-1">
                                                                                {ticket.timeSlots.map((slot) => [slot.date, slot.startTime && slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime || slot.endTime].filter(Boolean).join(' ')).filter(Boolean).join(' · ')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && Array.isArray(product.colors) && product.colors.length > 0 && (
                                                <div className="mt-3 rounded-xl border border-purple-100 bg-white p-3">
                                                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Choose colors for {product.name}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[...new Set([...product.colors, ...(matchingSelected[0]?.selectedColors || [])])].map((color, colorIndex) => {
                                                            const isColorSelected = (matchingSelected[0]?.selectedColors || []).includes(color);
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
                                                                value={[...(matchingSelected[0]?.selectedColors || [])].reverse().find(color => /^#[0-9a-f]{6}$/i.test(color)) || '#8b5cf6'}
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
                                                    {isSelected ? (
                                                        <>
                                                            {hasAnySalePrice && totalOriginalPrice > totalPrice && (
                                                                <span className="text-xs font-semibold text-slate-400 line-through">
                                                                    ₹{totalOriginalPrice.toLocaleString('en-IN')}
                                                                </span>
                                                            )}
                                                            <span>₹{totalPrice.toLocaleString('en-IN')}</span>
                                                            {totalQuantity > 1 && (
                                                                <span className="text-[10px] font-semibold text-slate-400">({totalQuantity} items)</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {defaultPricing.hasSalePrice && (
                                                                <span className="text-xs font-semibold text-slate-400 line-through">
                                                                    ₹{defaultPricing.originalPrice.toLocaleString('en-IN')}
                                                                </span>
                                                            )}
                                                            <span>₹{defaultPricing.baseUnitPrice.toLocaleString('en-IN')}</span>
                                                        </>
                                                    )}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {product.tickets?.length > 0 ? (() => {
                                                        const soldCount = ticketSoldMap[product._id] || 0;
                                                        const totalCap = Number(product.tickets[0]?.capacity ?? 0);
                                                        const remainingCap = Math.max(0, totalCap - soldCount);
                                                        const isSoldOut = totalCap > 0 && remainingCap <= 0;

                                                        return (
                                                            <button
                                                                type="button"
                                                                disabled={isSoldOut}
                                                                onClick={() => {
                                                                    if (isSoldOut) return;
                                                                    const venueObj = {
                                                                        _id: product._id,
                                                                        name: product.name || selectedSeller?.shopName || selectedSeller?.name,
                                                                        price: Number(product.tickets?.[0]?.salePrice || product.tickets?.[0]?.price || product.price || 1000),
                                                                        sellerId: selectedSeller,
                                                                        tickets: product.tickets || [],
                                                                    };
                                                                    navigate('/plan-my-event/booking', {
                                                                        state: {
                                                                            venue: venueObj,
                                                                            selectedShop: selectedShop,
                                                                            prefilledDate: activeDate || '',
                                                                            prefilledTimeSlot: activeTime || ''
                                                                        }
                                                                    });
                                                                }}
                                                                className={`text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${isSoldOut
                                                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:opacity-95 active:scale-95'
                                                                    }`}
                                                            >
                                                                {isSoldOut ? 'Sold Out' : '🎟️ Book Tickets'}
                                                            </button>
                                                        );
                                                    })() : isSelected ? (
                                                        <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-1.5 py-1">
                                                            <button
                                                                type="button"
                                                                aria-label={`Remove one ${product.name}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const targetProduct = matchingSelected[0] || product;
                                                                    handleProductQuantityChange(targetProduct, -1);
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-purple-700 hover:bg-purple-100"
                                                            >
                                                                <RemoveIcon fontSize="small" />
                                                            </button>
                                                            <span className="min-w-5 text-center text-xs font-black text-slate-800">{totalQuantity}</span>
                                                            <button
                                                                type="button"
                                                                aria-label={`Add one ${product.name}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const targetProduct = matchingSelected[0] || product;
                                                                    handleProductQuantityChange(targetProduct, 1);
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-600 text-white hover:bg-purple-700"
                                                            >
                                                                <AddIcon fontSize="small" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (product.variants?.length > 1 || product.hasAddOn || product.variants?.[0]?.hasAddOn) {
                                                                    openProductGallery(product);
                                                                } else {
                                                                    handleProductQuantityChange(product, 1);
                                                                }
                                                            }}
                                                            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 bg-white border-slate-200 text-slate-600 hover:border-purple-500 hover:text-purple-600 transition-all"
                                                        >
                                                            Add Item
                                                        </button>
                                                    )}
                                                </div>
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
                    <div id="plan-summary-section" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mt-6">
                        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-5">
                            <h3 className="text-xl font-bold text-slate-800">Plan Summary</h3>
                            <div className="mt-3 space-y-2 text-sm">
                                <div className="flex justify-between gap-4 text-slate-600">
                                    <span>Event Type</span><span className="font-semibold capitalize">{allEventTypes?.find(t => (t.value || t._id) === activeEventType)?.name || activeEventType || eventData?.eventType || 'Not selected'}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-slate-600">
                                    <span>Date & Time</span><span className="font-semibold">{(() => {
                                        const dateVal = activeDate || eventData?.date || (activeMultipleDates?.[0]?.date) || '';
                                        const timeVal = activeTime || eventData?.time || (activeMultipleDates?.[0]?.time) || '';
                                        const remarksVal = activeRemarks || eventData?.remarks || (activeMultipleDates?.[0]?.remarks) || '';
                                        if (!dateVal && !timeVal) return 'Not selected';
                                        return `${dateVal}${timeVal ? ` · ${timeVal}` : ''}${remarksVal ? ` (${remarksVal})` : ''}`;
                                    })()}</span>
                                </div>
                                {activeEventInfo && (
                                    <>
                                        {(activeEventInfo.primaryContactName || activeEventInfo.name || activeEventInfo.coupleNames || activeEventInfo.corporateCompanyName) && (
                                            <div className="flex justify-between gap-4 text-slate-600">
                                                <span>Contact</span>
                                                <span className="font-semibold">
                                                    {activeEventInfo.bookingType === 'corporate'
                                                        ? (activeEventInfo.corporateCompanyName || activeEventInfo.corporateContactPerson)
                                                        : activeEventInfo.bookingType === 'couple'
                                                            ? activeEventInfo.coupleNames
                                                            : (activeEventInfo.primaryContactName || activeEventInfo.name)}
                                                    {activeEventInfo.primaryPhone ? ` (${activeEventInfo.primaryPhone})` : ''}
                                                </span>
                                            </div>
                                        )}
                                        {activeEventInfo.gender && activeEventInfo.bookingType === 'individual' && (
                                            <div className="flex justify-between gap-4 text-slate-600">
                                                <span>Gender</span><span className="font-semibold capitalize">{activeEventInfo.gender}</span>
                                            </div>
                                        )}
                                        {(activeEventInfo.dateOfBirth || activeEventInfo.anniversaryDate) && (
                                            <div className="flex justify-between gap-4 text-slate-600">
                                                <span>{activeEventInfo.bookingType === 'couple' ? 'Anniversary Date' : 'Date of Birth'}</span>
                                                <span className="font-semibold">{activeEventInfo.bookingType === 'couple' ? activeEventInfo.anniversaryDate : activeEventInfo.dateOfBirth}</span>
                                            </div>
                                        )}
                                        {activeEventInfo.functionLocation && (
                                            <div className="flex justify-between gap-4 text-slate-600">
                                                <span>Function Location</span><span className="font-semibold">{activeEventInfo.functionLocation}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="flex justify-between gap-4 text-slate-600">
                                    <span>Guests</span><span className="font-semibold">{activeEventInfo?.noOfGuests || eventData?.guestCount || 1} (Limit: {selectedSeller?.minGuestCapacity || 1}-{selectedSeller?.maxGuestCapacity || 500})</span>
                                </div>
                                {selectedShop && (
                                    <div className="flex justify-between gap-4 text-purple-700 bg-purple-100/60 p-2 rounded-xl font-bold">
                                        <span>📍 Selected Shop / Area</span>
                                        <span>{selectedShop.uniqueCode || `Shop ${selectedShop.shopNo}`} ({selectedShop.bookingType || 'MULTIPLE'})</span>
                                    </div>
                                )}
                                {selectedProducts.filter(p => !p.tickets || p.tickets.length === 0).map((product, pIdx) => {
                                    const quantity = Number(product.quantity) || 1;
                                    const pricing = getProductPricing(product);
                                    const lineTotal = (pricing.baseUnitPrice * quantity) + pricing.totalAddOnExtra;
                                    const lineOriginalTotal = (pricing.originalPrice * quantity) + pricing.totalAddOnExtra;
                                    const variantKey = product.selectedVariant?.sku || product.selectedVariant?.name || pIdx;
                                    return (
                                        <div key={`${product._id}-${variantKey}`} className="flex flex-col gap-0.5 text-slate-600">
                                            <div className="flex justify-between gap-4">
                                                <span>
                                                    {product.name}{product.selectedVariant?.name ? ` (${product.selectedVariant.name})` : ''} × {quantity}
                                                </span>
                                                <span className="flex items-center gap-2 font-semibold">
                                                    {pricing.hasSalePrice && lineOriginalTotal > lineTotal && (
                                                        <span className="text-xs text-slate-400 line-through">₹{lineOriginalTotal.toLocaleString('en-IN')}</span>
                                                    )}
                                                    <span>₹{lineTotal.toLocaleString('en-IN')}</span>
                                                </span>
                                            </div>
                                            {product.selectedAddOns?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 text-[10px] text-purple-700 pl-2">
                                                    {product.selectedAddOns.map((ad, aIndex) => (
                                                        <span key={aIndex} className="bg-purple-100/70 px-1.5 py-0.2 rounded">
                                                            + {ad.name} (₹{ad.price})
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between border-t border-purple-100 pt-3 font-bold text-slate-800">
                                    <span>Selected Products</span><span>{selectedProducts.filter(p => !p.tickets || p.tickets.length === 0).reduce((total, product) => total + (Number(product.quantity) || 0), 0)} items · ₹{selectedProductsSubtotal.toLocaleString('en-IN')}</span>
                                </div>
                                {selectedSeller?.advanceBookingEnabled && Number(selectedSeller?.advancePaymentPercentage) > 0 && selectedProductsSubtotal > 0 && (
                                    <div className="flex justify-between items-center bg-purple-100/60 p-2.5 rounded-xl border border-purple-200 mt-2">
                                        <div className="flex flex-col">
                                            <span className="font-black text-purple-900 text-xs">Advance Payment</span>
                                            <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                                                ({selectedSeller.advancePaymentPercentage}% Required to Confirm)
                                            </span>
                                        </div>
                                        <span className="font-black text-base text-purple-700">
                                            ₹{Math.round((selectedProductsSubtotal * Number(selectedSeller.advancePaymentPercentage)) / 100).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={handleProceed}
                                className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-extrabold rounded-xl hover:opacity-90 transition-all text-[13px] tracking-wide shadow-md">
                                View Details
                            </button>
                        </div>
                    </div>
                    {imagePreview && (
                        <div
                            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6"
                            onClick={() => { setImagePreview(null); setZoomLevel(1); }}
                            role="presentation"
                        >
                            {/* Modal Card */}
                            <div
                                className="flex flex-col md:flex-row w-full max-w-5xl max-h-[92vh] md:max-h-[88vh] bg-white rounded-2xl sm:rounded-3xl overflow-y-auto md:overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Left: Image Gallery & Carousel */}
                                <div className="relative w-full md:w-[46%] lg:w-[48%] flex-shrink-0 flex flex-col min-h-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 border-b md:border-b-0 md:border-r border-slate-100">
                                    {/* Top action buttons */}
                                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 sm:p-4 z-20">
                                        <button
                                            type="button"
                                            onClick={() => { setImagePreview(null); setZoomLevel(1); }}
                                            className="w-8 h-8 sm:w-9 sm:h-9 bg-white/95 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border border-slate-100 text-slate-700"
                                            aria-label="Close"
                                        >
                                            <ArrowLeft size={18} strokeWidth={2.5} />
                                        </button>

                                        {/* Discount Badge */}
                                        {(() => {
                                            const modalPrice = Number(
                                                (modalSelectedVariant && (modalSelectedVariant.salePrice || modalSelectedVariant.price))
                                                    ? (modalSelectedVariant.salePrice || modalSelectedVariant.price)
                                                    : imagePreview.product?.salePrice || imagePreview.product?.price
                                            );
                                            const modalOriginal = Number(
                                                (modalSelectedVariant && modalSelectedVariant.price && modalSelectedVariant.salePrice)
                                                    ? modalSelectedVariant.price
                                                    : imagePreview.product?.price || modalPrice
                                            );
                                            return (modalOriginal > modalPrice) ? (
                                                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl uppercase tracking-wider shadow-md shadow-purple-200">
                                                    {Math.round(((modalOriginal - modalPrice) / modalOriginal) * 100)}% OFF
                                                </div>
                                            ) : null;
                                        })()}

                                        <div className="w-8 h-8 sm:w-9 sm:h-9" /> {/* Spacer */}
                                    </div>

                                    {/* Main Gallery Area with vertical thumbnail strip on desktop */}
                                    <div className="flex-1 flex mt-12 sm:mt-14 mb-1 sm:mb-2 overflow-hidden px-2 sm:px-3">
                                        {imagePreview.images.length > 1 && (imagePreview.images.length - failedImages.size) > 1 && (
                                            <div className="hidden sm:flex flex-col gap-2 py-2 pr-2 overflow-y-auto no-scrollbar">
                                                {imagePreview.images.map((img, idx) => {
                                                    if (failedImages.has(idx)) return null;
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => { setZoomLevel(1); setImagePreview(c => ({ ...c, activeIndex: idx })) }}
                                                            className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl border-2 shrink-0 overflow-hidden transition-all ${imagePreview.activeIndex === idx ? 'border-purple-600 shadow-md scale-105 bg-white' : 'border-slate-200/70 opacity-60 hover:opacity-100 bg-white/70'}`}
                                                        >
                                                            <img
                                                                src={img}
                                                                alt=""
                                                                className="w-full h-full object-contain p-1"
                                                                onError={() => setFailedImages(prev => new Set(prev).add(idx))}
                                                            />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Main Active Image */}
                                        <div className="flex-1 flex items-center justify-center p-2 sm:p-4 relative min-h-[190px] sm:min-h-[260px] md:min-h-[300px]">
                                            <img
                                                src={imagePreview.images[imagePreview.activeIndex]}
                                                alt={imagePreview.name}
                                                className="max-w-full max-h-[220px] sm:max-h-[300px] md:max-h-[420px] object-contain drop-shadow-md md:drop-shadow-xl hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                                                onClick={() => setIsFullScreenImage(true)}
                                                onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Mobile horizontal thumbnail strip */}
                                    {imagePreview.images.length > 1 && (imagePreview.images.length - failedImages.size) > 1 && (
                                        <div className="flex sm:hidden justify-center gap-1.5 px-3 pb-1 overflow-x-auto no-scrollbar">
                                            {imagePreview.images.map((img, idx) => {
                                                if (failedImages.has(idx)) return null;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => { setZoomLevel(1); setImagePreview(c => ({ ...c, activeIndex: idx })) }}
                                                        className={`w-10 h-10 rounded-lg border-2 shrink-0 overflow-hidden transition-all ${imagePreview.activeIndex === idx ? 'border-purple-600 shadow-sm scale-105 bg-white' : 'border-slate-200/70 opacity-60 bg-white/70'}`}
                                                    >
                                                        <img
                                                            src={img}
                                                            alt=""
                                                            className="w-full h-full object-contain p-0.5"
                                                            onError={() => setFailedImages(prev => new Set(prev).add(idx))}
                                                        />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Carousel dot indicators */}
                                    {imagePreview.images.length > 1 && (
                                        <div className="flex justify-center gap-1.5 pb-3 sm:pb-4">
                                            {imagePreview.images.map((_, i) => {
                                                if (failedImages.has(i)) return null;
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setImagePreview(c => ({ ...c, activeIndex: i }))}
                                                        className={`rounded-full transition-all duration-300 ${i === imagePreview.activeIndex ? 'w-6 h-1.5 bg-purple-600' : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400'}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Product Details & Variant Selection */}
                                <div className="flex-1 flex flex-col bg-white md:overflow-y-auto md:max-h-full">
                                    <div className="p-4 sm:p-6 lg:p-7 space-y-4 flex-1">
                                        {(() => {
                                            const activeVariantKey = modalSelectedVariant?.sku || modalSelectedVariant?.name || 'default';
                                            const rawBasePrice = Number(
                                                (modalSelectedVariant && (modalSelectedVariant.salePrice || modalSelectedVariant.price))
                                                    ? (modalSelectedVariant.salePrice || modalSelectedVariant.price)
                                                    : imagePreview.product?.salePrice || imagePreview.product?.price || 0
                                            );
                                            const rawOriginal = Number(
                                                (modalSelectedVariant && modalSelectedVariant.price && modalSelectedVariant.salePrice)
                                                    ? modalSelectedVariant.price
                                                    : imagePreview.product?.price || rawBasePrice
                                            );

                                            // ADD ON calculation
                                            const hasAddOn = Boolean(modalSelectedVariant?.hasAddOn || imagePreview.product?.hasAddOn);

                                            // 1. Fixed add-ons (TOGAL 1: Price fixed)
                                            let fixedList = [];
                                            if (Array.isArray(modalSelectedVariant?.fixedAddOns)) {
                                                fixedList = modalSelectedVariant.fixedAddOns;
                                            } else if (Array.isArray(imagePreview.product?.fixedAddOns)) {
                                                fixedList = imagePreview.product.fixedAddOns;
                                            } else if ((modalSelectedVariant?.addOnType || imagePreview.product?.addOnType) === 'fixed') {
                                                fixedList = modalSelectedVariant?.addOns || imagePreview.product?.addOns || [];
                                            }
                                            const validFixedList = fixedList.filter(item => item && (item.name?.trim() || item.price > 0));

                                            // 2. Click-box add-ons (TOGAL 2: Price click on box)
                                            let clickBoxList = [];
                                            if (Array.isArray(modalSelectedVariant?.clickBoxAddOns)) {
                                                clickBoxList = modalSelectedVariant.clickBoxAddOns;
                                            } else if (Array.isArray(imagePreview.product?.clickBoxAddOns)) {
                                                clickBoxList = imagePreview.product.clickBoxAddOns;
                                            } else if ((modalSelectedVariant?.addOnType || imagePreview.product?.addOnType) === 'click_box') {
                                                clickBoxList = modalSelectedVariant?.addOns || imagePreview.product?.addOns || [];
                                            }
                                            const validClickBoxList = clickBoxList.filter(item => item && (item.name?.trim() || item.price > 0));

                                            // Chosen click-box add-ons by customer
                                            const currentChosenAddOns = selectedAddOns[`${imagePreview.product?._id}_${activeVariantKey}`] || [];

                                            let fixedExtra = 0;
                                            if (hasAddOn && validFixedList.length > 0) {
                                                fixedExtra = validFixedList.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                                            }

                                            let clickBoxExtra = 0;
                                            if (hasAddOn && currentChosenAddOns.length > 0) {
                                                clickBoxExtra = currentChosenAddOns.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                                            }

                                            const totalAddOnExtra = fixedExtra + clickBoxExtra;
                                            const modalUnitPrice = rawBasePrice + totalAddOnExtra;
                                            const modalOriginalUnitPrice = rawOriginal + totalAddOnExtra;

                                            // Combined add-ons to save with selected product: auto-included fixed + checked click-box
                                            const combinedAppliedAddOns = [
                                                ...(hasAddOn ? validFixedList.map(a => ({ ...a, isFixed: true })) : []),
                                                ...currentChosenAddOns.map(a => ({ ...a, isFixed: false }))
                                            ];

                                            const selectedProductEntry = selectedProducts.find(p => p._id === imagePreview.product?._id && ((p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === activeVariantKey));
                                            const isItemAdded = Boolean(selectedProductEntry);
                                            const itemQuantity = selectedProductEntry?.quantity || 0;
                                            const effectiveQty = itemQuantity || 1;
                                            const modalTotalAmount = (rawBasePrice * effectiveQty) + totalAddOnExtra;
                                            const modalTotalOriginal = (rawOriginal * effectiveQty) + totalAddOnExtra;
                                            return (
                                                <>
                                                    {/* Top badges */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {modalTotalOriginal > modalTotalAmount && (
                                                            <div className="text-[10px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200/60 uppercase tracking-wider">
                                                                💰 Save ₹{modalTotalOriginal - modalTotalAmount}
                                                            </div>
                                                        )}
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                            {imagePreview.product?.category || selectedSeller?.category || 'Service / Item'}
                                                        </span>
                                                        {(() => {
                                                            const cap = getProductCapacityConfig(imagePreview.product, modalSelectedVariant);
                                                            if (!cap || !selectedSeller?.capacityEnabled) return null;
                                                            return (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                                                                    👥 Cap: Min = {cap.minimum}, Max = {cap.maximum > 0 ? cap.maximum : 'No limit'} ({cap.bookingType})
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Product Title & Unit */}
                                                    <div>
                                                        <h2 className="text-xl lg:text-2xl font-black text-slate-900 leading-tight">
                                                            {imagePreview.name}
                                                        </h2>
                                                        {imagePreview.product?.weight && (
                                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5 block">
                                                                {imagePreview.product.weight}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Price & Add Card */}
                                                    <div className="rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50/70 to-indigo-50/40 p-4 flex items-center justify-between shadow-sm">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-2xl lg:text-3xl font-black text-purple-700 tracking-tight leading-none">
                                                                    ₹{modalTotalAmount.toLocaleString('en-IN')}
                                                                </span>
                                                                {modalTotalOriginal > modalTotalAmount && (
                                                                    <span className="text-sm text-slate-400 line-through font-semibold">
                                                                        ₹{modalTotalOriginal.toLocaleString('en-IN')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {modalTotalOriginal > modalTotalAmount && (
                                                                    <span className="inline-flex w-fit items-center text-[10px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                                                        {Math.round(((modalTotalOriginal - modalTotalAmount) / modalTotalOriginal) * 100)}% off
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] font-bold text-slate-500">
                                                                    ({effectiveQty} × ₹{rawBasePrice.toLocaleString('en-IN')}{totalAddOnExtra > 0 ? ` + ₹${totalAddOnExtra.toLocaleString('en-IN')} Add-ons` : ''})
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {imagePreview.product?.tickets?.length > 0 ? (() => {
                                                            const soldCount = ticketSoldMap[imagePreview.product._id] || 0;
                                                            const totalCap = Number(imagePreview.product.tickets[0]?.capacity ?? 0);
                                                            const remainingCap = Math.max(0, totalCap - soldCount);
                                                            const isSoldOut = totalCap > 0 && remainingCap <= 0;

                                                            return (
                                                                <button
                                                                    type="button"
                                                                    disabled={isSoldOut}
                                                                    onClick={() => {
                                                                        if (isSoldOut) return;
                                                                        const venueObj = {
                                                                            _id: imagePreview.product._id,
                                                                            name: imagePreview.product.name || selectedSeller?.shopName || selectedSeller?.name,
                                                                            price: Number(imagePreview.product.tickets?.[0]?.salePrice || imagePreview.product.tickets?.[0]?.price || modalPrice || 1000),
                                                                            sellerId: selectedSeller,
                                                                            tickets: imagePreview.product.tickets || [],
                                                                        };
                                                                        setImagePreview(null);
                                                                        navigate('/plan-my-event/booking', {
                                                                            state: {
                                                                                venue: venueObj,
                                                                                prefilledDate: activeDate || '',
                                                                                prefilledTimeSlot: activeTime || ''
                                                                            }
                                                                        });
                                                                    }}
                                                                    className={`px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 ${isSoldOut
                                                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-purple-200'
                                                                        }`}
                                                                >
                                                                    {isSoldOut ? 'Sold Out' : '🎟️ Book Tickets'}
                                                                </button>
                                                            );
                                                        })() : isItemAdded ? (
                                                            <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 p-1.5 shadow-sm">
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Decrease quantity`}
                                                                    onClick={() => handleProductQuantityChange({
                                                                        ...imagePreview.product,
                                                                        price: modalUnitPrice,
                                                                        selectedVariant: modalSelectedVariant,
                                                                        selectedAddOns: combinedAppliedAddOns
                                                                    }, -1)}
                                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-purple-700 hover:bg-purple-100 transition-colors shadow-sm"
                                                                >
                                                                    <RemoveIcon fontSize="small" />
                                                                </button>
                                                                <span className="min-w-6 text-center text-sm font-black text-slate-800">
                                                                    {itemQuantity}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Increase quantity`}
                                                                    disabled={(() => {
                                                                        const capConfig = getProductCapacityConfig(imagePreview.product, modalSelectedVariant);
                                                                        if (capConfig && capConfig.maximum > 0 && itemQuantity >= capConfig.maximum) return true;
                                                                        return false;
                                                                    })()}
                                                                    onClick={() => handleProductQuantityChange({
                                                                        ...imagePreview.product,
                                                                        price: modalUnitPrice,
                                                                        selectedVariant: modalSelectedVariant,
                                                                        selectedAddOns: combinedAppliedAddOns
                                                                    }, 1)}
                                                                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all shadow-sm ${(() => {
                                                                        const capConfig = getProductCapacityConfig(imagePreview.product, modalSelectedVariant);
                                                                        if (capConfig && capConfig.maximum > 0 && itemQuantity >= capConfig.maximum) {
                                                                            return 'bg-slate-200 text-slate-400 cursor-not-allowed';
                                                                        }
                                                                        return 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700';
                                                                    })()
                                                                        }`}
                                                                >
                                                                    <AddIcon fontSize="small" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const capConfig = getProductCapacityConfig(imagePreview.product, modalSelectedVariant);
                                                                    const initialQty = (capConfig && capConfig.minimum > 0) ? capConfig.minimum : 1;
                                                                    const targetVariantKey = modalSelectedVariant?.sku || modalSelectedVariant?.name || 'default';

                                                                    setSelectedProducts(prev => {
                                                                        const existingIdx = prev.findIndex(p => p._id === imagePreview.product?._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === targetVariantKey);
                                                                        if (existingIdx >= 0) {
                                                                            const updated = [...prev];
                                                                            updated[existingIdx] = {
                                                                                ...updated[existingIdx],
                                                                                selectedVariant: modalSelectedVariant,
                                                                                selectedAddOns: combinedAppliedAddOns,
                                                                                price: modalUnitPrice
                                                                            };
                                                                            return updated;
                                                                        }
                                                                        return [
                                                                            ...prev,
                                                                            {
                                                                                ...imagePreview.product,
                                                                                quantity: initialQty,
                                                                                selectedVariant: modalSelectedVariant,
                                                                                selectedAddOns: combinedAppliedAddOns,
                                                                                price: modalUnitPrice
                                                                            }
                                                                        ];
                                                                    });
                                                                }}
                                                                className="px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-purple-200"
                                                            >
                                                                <ShoppingBag size={14} strokeWidth={2.5} />
                                                                Add to Selection
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Total Add-ons & Product Total Box with View Details button (Placed right above Select Variant) */}
                                                    {hasAddOn && (fixedExtra > 0 || clickBoxExtra > 0) && (
                                                        <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 p-3.5 shadow-sm flex items-center justify-between gap-3">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                                                                    <span>✨</span> Total Price Breakdown
                                                                </span>
                                                                <div className="flex items-center gap-2 text-xs">
                                                                    <span className="text-base font-black text-purple-700">
                                                                        ₹{modalTotalAmount.toLocaleString('en-IN')}
                                                                    </span>
                                                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-semibold">
                                                                        <span className="text-slate-700 font-bold">(Product: ₹{(rawBasePrice * effectiveQty).toLocaleString('en-IN')})</span>
                                                                        {fixedExtra > 0 && <span className="text-emerald-600 font-bold">(Included: ₹{fixedExtra.toLocaleString('en-IN')})</span>}
                                                                        {clickBoxExtra > 0 && <span className="text-purple-600 font-bold">(Optional: ₹{clickBoxExtra.toLocaleString('en-IN')})</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    // Sync current variant and add-ons selection into selectedProducts so Plan Summary shows latest values
                                                                    const targetVariantKey = modalSelectedVariant?.sku || modalSelectedVariant?.name || 'default';
                                                                    setSelectedProducts(prev => {
                                                                        const existingIdx = prev.findIndex(p => p._id === imagePreview.product?._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === targetVariantKey);
                                                                        if (existingIdx >= 0) {
                                                                            const updated = [...prev];
                                                                            updated[existingIdx] = {
                                                                                ...updated[existingIdx],
                                                                                selectedVariant: modalSelectedVariant,
                                                                                selectedAddOns: combinedAppliedAddOns,
                                                                                price: modalUnitPrice
                                                                            };
                                                                            return updated;
                                                                        } else {
                                                                            const capConfig = getProductCapacityConfig(imagePreview.product, modalSelectedVariant);
                                                                            const initialQty = (capConfig && capConfig.minimum > 0) ? capConfig.minimum : 1;
                                                                            return [
                                                                                ...prev,
                                                                                {
                                                                                    ...imagePreview.product,
                                                                                    quantity: initialQty,
                                                                                    selectedVariant: modalSelectedVariant,
                                                                                    selectedAddOns: combinedAppliedAddOns,
                                                                                    price: modalUnitPrice
                                                                                }
                                                                            ];
                                                                        }
                                                                    });
                                                                    setImagePreview(null);
                                                                    setTimeout(() => {
                                                                        const el = document.getElementById('plan-summary-section');
                                                                        if (el) {
                                                                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                        }
                                                                    }, 100);
                                                                }}
                                                                className="px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm hover:opacity-95 active:scale-95 transition-all whitespace-nowrap"
                                                            >
                                                                View Details →
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Variants Selection (if product has variants) */}
                                                    {imagePreview.product?.variants && imagePreview.product.variants.length > 0 && (
                                                        <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80">
                                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                                                                Select Variant
                                                            </h4>
                                                            <div className="flex gap-2.5 flex-wrap">
                                                                {imagePreview.product.variants.map((v, idx) => {
                                                                    const isVariantActive = (modalSelectedVariant?.sku || modalSelectedVariant?.name) === (v.sku || v.name);
                                                                    return (
                                                                        <button
                                                                            key={idx}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setModalSelectedVariant(v);
                                                                                const vKey = `${imagePreview.product?._id}_${v.sku || v.name || 'default'}`;
                                                                                const existingForVariant = selectedProducts.find(
                                                                                    p => p._id === imagePreview.product?._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === (v.sku || v.name || 'default')
                                                                                );
                                                                                if (existingForVariant?.selectedAddOns) {
                                                                                    const availableClickBoxNames = new Set((v.clickBoxAddOns || []).map(a => a.name?.trim().toLowerCase()));
                                                                                    const optionalOnly = existingForVariant.selectedAddOns.filter(a => !a.isFixed && availableClickBoxNames.has(a.name?.trim().toLowerCase()));
                                                                                    setSelectedAddOns(prev => ({
                                                                                        ...prev,
                                                                                        [vKey]: optionalOnly
                                                                                    }));
                                                                                } else {
                                                                                    setSelectedAddOns(prev => ({
                                                                                        ...prev,
                                                                                        [vKey]: []
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            className={`px-4 py-2 font-bold rounded-lg text-xs transition-all border-2 ${isVariantActive
                                                                                ? 'bg-purple-50 border-purple-600 text-purple-700 shadow-sm'
                                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                                                }`}
                                                                        >
                                                                            {v.name}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Dynamic ADD ON for Selected Variant */}
                                                    {hasAddOn && (validFixedList.length > 0 || validClickBoxList.length > 0) && (
                                                        <div className="space-y-3">
                                                            {/* 1. Fixed Add-ons (TOGAL 1: Included automatically) */}
                                                            {validFixedList.length > 0 && (
                                                                <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-200/80 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-[10px] font-black text-purple-900 uppercase tracking-widest flex items-center gap-1.5">
                                                                            <span>✨ Included Add-on (Fixed)</span>
                                                                            <span className="text-[9px] font-bold text-purple-600 lowercase bg-purple-100/70 px-2 py-0.5 rounded-full">
                                                                                auto-included
                                                                            </span>
                                                                        </h4>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        {validFixedList.map((item, idx) => (
                                                                            <div
                                                                                key={idx}
                                                                                className="flex items-center justify-between p-2.5 rounded-lg border bg-white/90 border-purple-200 shadow-xs"
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[11px] text-purple-600">🔘</span>
                                                                                    <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                                                                                        {item.name}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-xs font-black text-purple-700">
                                                                                    +₹{Number(item.price || 0).toLocaleString('en-IN')}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* 2. Optional Click-box Add-ons (TOGAL 2: Click to add) */}
                                                            {validClickBoxList.length > 0 && (
                                                                <div className="bg-purple-50/40 rounded-xl p-3.5 border border-purple-200/80 space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <h4 className="text-[10px] font-black text-purple-900 uppercase tracking-widest flex items-center gap-1.5">
                                                                            <span>✨ Optional Add-on (Click to Add)</span>
                                                                            <span className="text-[9px] font-bold text-purple-600 lowercase bg-purple-100/70 px-2 py-0.5 rounded-full">
                                                                                optional (select to add)
                                                                            </span>
                                                                        </h4>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        {validClickBoxList.map((item, idx) => {
                                                                            const isChecked = currentChosenAddOns.some(a => a.name === item.name);
                                                                            return (
                                                                                <div
                                                                                    key={idx}
                                                                                    onClick={() => {
                                                                                        const key = `${imagePreview.product?._id}_${activeVariantKey}`;
                                                                                        const exists = currentChosenAddOns.some(a => a.name === item.name);
                                                                                        const updatedChosen = exists
                                                                                            ? currentChosenAddOns.filter(a => a.name !== item.name)
                                                                                            : [...currentChosenAddOns, item];

                                                                                        // 1. Update local state
                                                                                        setSelectedAddOns(prev => ({
                                                                                            ...prev,
                                                                                            [key]: updatedChosen
                                                                                        }));

                                                                                        // 2. Calculate updated price & applied add-ons
                                                                                        const nextCombinedAddOns = [
                                                                                            ...(hasAddOn ? validFixedList.map(a => ({ ...a, isFixed: true })) : []),
                                                                                            ...updatedChosen.map(a => ({ ...a, isFixed: false }))
                                                                                        ];
                                                                                        const nextTotalExtra = fixedExtra + updatedChosen.reduce((sum, itm) => sum + (Number(itm.price) || 0), 0);
                                                                                        const nextUnitPrice = rawBasePrice + nextTotalExtra;

                                                                                        // 3. Sync into selectedProducts only if already added
                                                                                        setSelectedProducts(prev => {
                                                                                            const existingIdx = prev.findIndex(p => p._id === imagePreview.product?._id && (p.selectedVariant?.sku || p.selectedVariant?.name || 'default') === activeVariantKey);
                                                                                            if (existingIdx >= 0) {
                                                                                                const updated = [...prev];
                                                                                                updated[existingIdx] = {
                                                                                                    ...updated[existingIdx],
                                                                                                    selectedAddOns: nextCombinedAddOns,
                                                                                                    price: nextUnitPrice
                                                                                                };
                                                                                                return updated;
                                                                                            }
                                                                                            return prev;
                                                                                        });
                                                                                    }}
                                                                                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${isChecked
                                                                                        ? 'bg-purple-100/70 border-purple-400 shadow-sm'
                                                                                        : 'bg-white border-slate-200 hover:border-purple-300'
                                                                                        }`}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isChecked}
                                                                                            onChange={() => { }}
                                                                                            className="h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-400 pointer-events-none"
                                                                                        />
                                                                                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                                                                                            {item.name}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className="text-xs font-black text-purple-700">
                                                                                        +₹{Number(item.price || 0).toLocaleString('en-IN')}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Dynamic Brand Name & Ingredients for Selected Variant */}
                                                    {modalSelectedVariant && (modalSelectedVariant.brand || modalSelectedVariant.ingredients) && (
                                                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                                                            {modalSelectedVariant.brand && (
                                                                <div className="flex items-start gap-2">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[75px]">Brand:</span>
                                                                    <span className="text-xs font-bold text-slate-800">{modalSelectedVariant.brand}</span>
                                                                </div>
                                                            )}
                                                            {modalSelectedVariant.ingredients && (
                                                                <div className="flex items-start gap-2">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[75px]">Ingredients:</span>
                                                                    <span className="text-xs font-medium text-slate-700 leading-relaxed">{modalSelectedVariant.ingredients}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Tickets Details (if product has tickets) */}
                                                    {imagePreview.product?.tickets && imagePreview.product.tickets.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            {imagePreview.product.tickets.map((ticket, ticketIndex) => {
                                                                const soldCount = ticketSoldMap[imagePreview.product._id] || 0;
                                                                const totalCap = Number(ticket.capacity ?? 0);
                                                                const remainingCap = Math.max(0, totalCap - soldCount);
                                                                const isSoldOut = totalCap > 0 && remainingCap <= 0;

                                                                return (
                                                                    <div key={ticket._id || ticketIndex} className="rounded-xl bg-purple-50/70 border border-purple-100 p-3">
                                                                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                                                            <span className="font-bold text-slate-800">{ticket.name}</span>
                                                                            {ticket.capacity !== undefined && ticket.capacity !== null && (
                                                                                <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${isSoldOut
                                                                                    ? 'bg-red-100 text-red-600 border border-red-200'
                                                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                                    }`}>
                                                                                    {isSoldOut ? 'Sold Out' : `Capacity: ${remainingCap} Left`}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {ticket.instructions && (
                                                                            <p className="text-xs text-slate-600 mt-2 font-medium bg-white/80 p-2 rounded-lg border border-purple-100/60">
                                                                                📋 {ticket.instructions}
                                                                            </p>
                                                                        )}
                                                                        {ticket.timeSlotsEnabled && ticket.timeSlots?.length > 0 && (
                                                                            <p className="text-xs text-slate-500 mt-1.5">
                                                                                {ticket.timeSlots.map((slot) => [slot.date, slot.startTime && slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime || slot.endTime].filter(Boolean).join(' ')).filter(Boolean).join(' · ')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Product Description (only if available) */}
                                                    {imagePreview.product?.description && imagePreview.product.description.trim() !== '' && (
                                                        <div className="border-t border-slate-100 pt-3">
                                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                                <Clock size={14} className="text-purple-600" /> Description
                                                            </h4>
                                                            <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">
                                                                {imagePreview.product.description}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Additional details if available */}
                                                    {(imagePreview.product?.shelfLife || imagePreview.product?.countryOfOrigin) && (
                                                        <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2 text-xs">
                                                            {imagePreview.product.shelfLife && (
                                                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Shelf Life</span>
                                                                    <span className="font-black text-slate-800">{imagePreview.product.shelfLife}</span>
                                                                </div>
                                                            )}
                                                            {imagePreview.product.countryOfOrigin && (
                                                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Origin</span>
                                                                    <span className="font-black text-slate-800">{imagePreview.product.countryOfOrigin}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
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
                                while (failedImages.has(nextIndex) && nextIndex !== c.activeIndex) {
                                    nextIndex = (nextIndex - 1 + c.images.length) % c.images.length;
                                }
                                return { ...c, activeIndex: nextIndex };
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
                                while (failedImages.has(nextIndex) && nextIndex !== c.activeIndex) {
                                    nextIndex = (nextIndex + 1) % c.images.length;
                                }
                                return { ...c, activeIndex: nextIndex };
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
