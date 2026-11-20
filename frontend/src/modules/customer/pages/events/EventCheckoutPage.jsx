import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { customerApi } from '../../services/customerApi';
import { useSettings } from '@core/context/SettingsContext';
import { useAuth } from '@core/context/AuthContext';

const CHECKOUT_STATE_KEY = 'jalapino_plan_event_checkout';

const getProductPricing = (product) => {
    let basePrice = product?.selectedVariant?.price ?? product?.price;
    let baseSalePrice = product?.selectedVariant?.salePrice ?? product?.salePrice;
    let originalPrice = Number(basePrice) || 0;
    let salePrice = Number(baseSalePrice) || 0;

    const activeVariant = product?.selectedVariant || product?.variants?.[0];
    const hasAddOn = Boolean(activeVariant?.hasAddOn || product?.hasAddOn);
    const addOnType = activeVariant?.addOnType || product?.addOnType || 'fixed';

    // 1. Fixed add-ons (TOGAL 1: Price fixed - automatically included if hasAddOn is true)
    let fixedList = [];
    if (activeVariant?.fixedAddOns && activeVariant.fixedAddOns.length > 0) {
        fixedList = activeVariant.fixedAddOns;
    } else if (product?.fixedAddOns && product.fixedAddOns.length > 0) {
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

const readSavedCheckoutState = () => {
    try {
        return JSON.parse(sessionStorage.getItem(CHECKOUT_STATE_KEY) || 'null');
    } catch {
        return null;
    }
};

// "Your Event Details" as [label, value] rows, ONLY for fields the customer filled
// (same rows as the Plan Summary on the seller page).
const getEventDetailRows = (info = {}) => {
    const type = String(info?.bookingType || '').toLowerCase();
    const fmtDate = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || ''))
        ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN')
        : (v || ''));
    const cap = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
    const isSellerLocation = info?.serviceLocationType === 'seller';
    const rows = [
        ['Booking Type', cap(type)],
        ...(type === 'corporate' ? [
            ['Company Name', info?.corporateCompanyName],
            ['Contact Person', info?.corporateContactPerson],
            ['Mobile', info?.corporateMobile],
            ['GST Number', info?.corporateGstNumber],
        ] : type === 'couple' ? [
            ['Couple Names', info?.coupleNames || info?.primaryContactName],
            ['Marriage Anniversary Date', fmtDate(info?.anniversaryDate)],
        ] : [
            ['Primary Contact', info?.primaryContactName || info?.name],
            ['Gender', cap(info?.gender)],
            ['Date of Birth', fmtDate(info?.dateOfBirth)],
        ]),
        ['Phone', type !== 'corporate' ? info?.primaryPhone : ''],
        ['No. of Guests', info?.noOfGuests],
        [isSellerLocation ? 'Seller Location' : 'Function Location', isSellerLocation ? (info?.sellerLocation || info?.functionLocation) : info?.functionLocation],
    ];
    return rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '0');
};

const EventCheckoutPage = () => {
    const { state: routeState } = useLocation();
    const state = routeState || readSavedCheckoutState();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const { user, isAuthenticated } = useAuth();
    const eventData = state?.eventData;
    const preferences = state?.preferences;
    const selectedCategories = state?.selectedCategories;
    const selectedSeller = state?.selectedSeller;
    const selectedPackage = state?.selectedPackage;
    const selectedShop = state?.selectedShop;
    const selectedProducts = Array.isArray(state?.selectedProducts) ? state.selectedProducts : [];

    useEffect(() => {
        if (!eventData || !selectedCategories || !selectedSeller) {
            navigate('/plan-my-event');
        }
    }, [eventData, selectedCategories, selectedSeller, navigate]);

    const [isSending, setIsSending] = useState(false);
    const [, setCustomerProfile] = useState(null);

    useEffect(() => {
        customerApi.getProfile()
            .then(res => setCustomerProfile(res?.data?.result || {}))
            .catch(console.error);
    }, []);

    // Calculate existing package/budget amount plus the selected catalog items.
    const baseAmount = selectedPackage
        ? selectedPackage.pricing * (parseInt(eventData?.guestCount, 10) || 1)
        : parseInt(eventData?.budget, 10) || 0;
    const selectedProductsSubtotal = selectedProducts.reduce((sum, product) => {
        const pr = getProductPricing(product);
        const quantity = Number(product.quantity || 1);
        return sum + (pr.baseUnitPrice * quantity) + pr.totalAddOnExtra;
    }, 0);
    const totalAmount = baseAmount + selectedProductsSubtotal;

    const handleSendRequest = async () => {
        if (!isAuthenticated && !user) {
            toast.error("Please login or signup first to send request.");
            navigate('/login', { state: { from: '/plan-my-event/checkout' } });
            return;
        }

        setIsSending(true);
        toast.loading("Sending Request to Providers...", { id: 'booking' });
        try {
            await customerApi.createEventBooking({
                eventData,
                preferences,
                selectedCategories,
                sellerId: selectedSeller._id,
                selectedShop: selectedShop ? {
                    uniqueCode: selectedShop.uniqueCode || '',
                    shopNo: selectedShop.shopNo || '',
                    bookingType: selectedShop.bookingType || 'MULTIPLE',
                    capacityType: selectedShop.capacityType || '',
                    minimum: Number(selectedShop.minimum || 0),
                    maximum: Number(selectedShop.maximum || selectedShop.totalCapacity || 0),
                    totalCapacity: Number(selectedShop.totalCapacity || 0)
                } : null,
                packageId: selectedPackage?._id,
                paymentMethod: 'ONLINE', // Will be finalized at payment time
                amount: baseAmount,
                selectedProducts: selectedProducts.map(product => {
                    const pricing = getProductPricing(product);
                    return {
                        productId: product._id,
                        quantity: Number(product.quantity || 1),
                        price: pricing.baseUnitPrice,
                        selectedColors: product.selectedColors || [],
                        selectedVariant: product.selectedVariant || product.variants?.[0] || null,
                        uniqueCode: (product.selectedVariant || product.variants?.[0])?.uniqueCode || product.uniqueCode || '',
                        shopNo: (product.selectedVariant || product.variants?.[0])?.shopNo || product.shopNo || '',
                        selectedAddOns: product.selectedAddOns || []
                    };
                })
            });
            sessionStorage.removeItem(CHECKOUT_STATE_KEY);
            sessionStorage.removeItem(`jalapino_plan_event_products_${selectedSeller._id}`);
            toast.success("Request Sent! Awaiting Seller Approval.", { id: 'booking' });
            navigate('/orders?tab=events', { state: { tab: 'events' } }); // Go to orders page with Events tab active
        } catch (error) {
            const status = error?.response?.status;
            let apiMessage = error?.response?.data?.message || "Failed to send request.";
            if (status === 401 || apiMessage.toLowerCase().includes('unauthorized') || apiMessage.toLowerCase().includes('token')) {
                apiMessage = "Please login or signup first.";
                navigate('/login', { state: { from: '/plan-my-event/checkout' } });
            }
            toast.error(apiMessage, { id: 'booking' });
            setIsSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="sticky top-0 left-0 right-0 h-16 bg-white z-50 flex items-center px-4 shadow-sm shrink-0">
                    <button onClick={() => navigate('/plan-my-event')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <div className="ml-2">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Event Checkout</h1>
                    <p className="text-[10px] text-slate-500 font-medium">Secure your booking</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-32">
                <div className="max-w-xl mx-auto p-4 space-y-6">

                    {/* Customer Event Details Card */}
                    {(() => {
                        // Exactly what the customer filled for this booking (same rows as Plan Summary).
                        const rows = getEventDetailRows(eventData?.eventInfo || {});
                        if (rows.length === 0) return null;

                        return (
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <CelebrationIcon sx={{ fontSize: 100 }} />
                                </div>
                                <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                                    <span>🎉</span> Your Event Details
                                </h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {rows.map(([label, value]) => (
                                        <div key={label} className="min-w-0">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
                                            <span className="font-semibold text-slate-800 break-words">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Summary Card */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Booking Summary</h2>
                        <div className="space-y-3">
                            {/* Only filled values are shown (no empty rows). */}
                            {eventData?.eventType && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Event Type</span>
                                    <span className="font-semibold text-slate-800 capitalize">{eventData.eventType}</span>
                                </div>
                            )}
                            {Array.isArray(eventData?.multipleEvents) && eventData.multipleEvents.length > 0 ? (
                                <div>
                                    <span className="text-slate-500">Dates & Remarks</span>
                                    <div className="mt-1 space-y-1">
                                        {eventData.multipleEvents.map((item, idx) => (
                                            <div key={item.id || idx} className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-2 py-1 sm:flex-row sm:justify-between sm:gap-3">
                                                <span className="font-semibold text-slate-700">{item.typeName || ''}</span>
                                                <span className="min-w-0 break-words font-semibold text-slate-800 sm:text-right">
                                                    {`${item.date ? new Date(`${String(item.date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN') : ''}${item.time ? ` at ${item.time}` : ""}`}
                                                    {String(item.remarks || '').trim() && <span className="block text-xs font-medium italic text-slate-500">📝 {item.remarks}</span>}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : eventData?.date && (
                                <>
                                    <div className="flex justify-between gap-4">
                                        <span className="shrink-0 text-slate-500">Booking Date</span>
                                        <span className="font-semibold text-slate-800 text-right">
                                            {/^d{4}-d{2}-d{2}/.test(String(eventData.date))
                                                ? new Date(`${String(eventData.date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                : eventData.date}
                                        </span>
                                    </div>
                                    {eventData.time && (
                                        <div className="flex justify-between gap-4">
                                            <span className="shrink-0 text-slate-500">Booking Time Slot</span>
                                            <span className="font-semibold text-slate-800 text-right">{eventData.time}</span>
                                        </div>
                                    )}
                                    {String(eventData.remarks || '').trim() && (
                                        <div className="flex justify-between gap-4">
                                            <span className="shrink-0 text-slate-500">Remarks / Occasion</span>
                                            <span className="min-w-0 break-words font-semibold text-slate-800 text-right">{eventData.remarks}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {eventData?.eventInfo?.noOfGuests && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Guests</span>
                                    <span className="font-semibold text-slate-800">
                                        {`${eventData.eventInfo.noOfGuests} People${selectedShop && (selectedShop.minimum || selectedShop.maximum || selectedShop.totalCapacity) ? ` (Limit: ${selectedShop.minimum || 1}-${selectedShop.maximum || selectedShop.totalCapacity || 'Max'})` : ''}`}
                                    </span>
                                </div>
                            )}
                            {selectedShop && (
                                <div className="flex justify-between items-center bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                                    <span className="text-purple-900 font-bold text-xs">📍 Selected Shop/Area</span>
                                    <span className="font-extrabold text-purple-700 text-xs">
                                        {selectedShop.uniqueCode || `Shop ${selectedShop.shopNo}`}
                                    </span>
                                </div>
                            )}
                            {selectedPackage ? (
                                <div className="flex justify-between border-t pt-3 mt-3">
                                    <span className="text-slate-500">Selected Package</span>
                                    <div className="text-right">
                                        <span className="font-bold text-slate-800 block">{selectedPackage.template?.packageName}</span>
                                        <span className="text-xs text-slate-500">₹{selectedPackage.pricing}/guest</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Selected Services</span>
                                    <span className="font-semibold text-slate-800">{selectedCategories?.length} Services</span>
                                </div>
                            )}
                            {selectedProducts.map((product, idx) => {
                                const quantity = Number(product.quantity || 1);
                                const pricing = getProductPricing(product);
                                const lineTotal = (pricing.baseUnitPrice * quantity) + pricing.totalAddOnExtra;
                                const lineOriginalTotal = (pricing.originalPrice * quantity) + pricing.totalAddOnExtra;
                                const variantKey = product.selectedVariant?.sku || product.selectedVariant?.name || idx;
                                return (
                                    <div key={`${product._id}-${variantKey}`} className="flex flex-col text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">
                                                {product.name}
                                                {product.selectedVariant?.name ? ` (${product.selectedVariant.name})` : ''} × {quantity}
                                            </span>
                                            <span className="flex items-center gap-2 font-semibold text-slate-800">
                                                {pricing.hasSalePrice && lineOriginalTotal > lineTotal && (
                                                    <span className="text-xs text-slate-400 line-through">₹{lineOriginalTotal.toLocaleString()}</span>
                                                )}
                                                <span>₹{lineTotal.toLocaleString()}</span>
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-500 pl-2">
                                            ({quantity} × ₹{pricing.baseUnitPrice.toLocaleString('en-IN')})
                                        </span>
                                        {(product.selectedVariant?.minimum || product.selectedVariant?.maximum || product.selectedVariant?.totalCapacity) && (
                                            <span className="text-[10px] font-bold text-purple-700 pl-2">
                                                👥 Cap: Min = {product.selectedVariant.minimum || 1}, Max = {product.selectedVariant.maximum || product.selectedVariant.totalCapacity || 'No limit'}
                                            </span>
                                        )}
                                        {product.selectedAddOns?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 text-[11px] text-purple-700 pl-2 mt-0.5">
                                                {product.selectedAddOns.map((ad, aIndex) => (
                                                    <span key={aIndex} className="bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                                                        + {ad.name} (₹{ad.price})
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {(String(product.cancellationPolicy || '').trim() !== '' || (product.cancellationRules || []).length > 0) && (
                                            <div className="mt-1 ml-2 rounded-md border border-rose-100 bg-rose-50/70 px-2 py-1 text-[10px] text-rose-800 whitespace-pre-line">
                                                <span className="font-bold uppercase tracking-wider">Cancellation & Refund: </span>
                                                {(product.cancellationRules || []).length > 0 && (() => {
                                                    const rules = [...product.cancellationRules].sort((a, b) => b.hoursBefore - a.hoursBefore);
                                                    const parts = rules.map((r, i) => `${i === 0 ? `${r.hoursBefore}+ hrs` : `${r.hoursBefore}–${rules[i - 1].hoursBefore} hrs`}: ${Number(r.refundPercent) > 0 ? `${r.refundPercent}%` : 'No'} refund`);
                                                    const last = rules[rules.length - 1];
                                                    if (Number(last.hoursBefore) > 0) parts.push(`Less than ${last.hoursBefore} hrs: No refund`);
                                                    return <div className="font-semibold">{parts.join(' · ')}</div>;
                                                })()}
                                                {String(product.cancellationPolicy || '').trim() !== '' && <div>{product.cancellationPolicy}</div>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {selectedProducts.length > 0 && (
                                <div className="flex justify-between text-xs border-t pt-2">
                                    <span className="text-slate-500">Product subtotal</span>
                                    <span className="font-semibold text-slate-800">₹{selectedProductsSubtotal.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800">Total Amount</span>
                                <span className="font-bold text-lg text-slate-500">₹{totalAmount.toLocaleString()}</span>
                            </div>
                            <p className="text-right text-[10px] font-medium text-slate-400 -mt-1">Inclusive of all taxes</p>
                            {(() => {
                                const isAdvanceEnabled = Boolean(selectedSeller?.advanceBookingEnabled);
                                const sellerPercent = Number(selectedSeller?.advancePaymentPercentage);

                                if (!isAdvanceEnabled || isNaN(sellerPercent) || sellerPercent <= 0) return null;

                                const advancePercent = sellerPercent;

                                return (
                                    <div className="flex justify-between items-center bg-purple-50 p-3 rounded-xl border border-purple-100">
                                        <div className="flex flex-col">
                                            <span className="font-black text-purple-900">Advance Token to Pay Later</span>
                                            <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                                                ({advancePercent}% required to confirm)
                                            </span>
                                        </div>
                                        <span className="font-black text-xl text-purple-700">
                                            ₹{Math.round((totalAmount * advancePercent) / 100).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Reservation Status Removed for Request Flow */}

                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={handleSendRequest}
                        disabled={isSending}
                        className={`w-full font-bold rounded-xl py-4 transition-all shadow-lg ${isSending ? 'bg-slate-300 text-slate-500' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/30 hover:scale-[1.02] active:scale-95'}`}
                    >
                        {isSending ? 'Sending Request...' : 'Send Request to Seller'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EventCheckoutPage;
