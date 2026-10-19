import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import adminUsersApi from '../services/api/usersApi';
import { adminEventConfigApi } from '../services/adminEventConfigApi';
import { PermissionToggle } from '../components/PermissionToggle';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    ChevronLeft,
    Building2,
    User,
    Mail,
    Phone,
    MapPin,
    Star,
    Calendar,
    Wallet,
    TrendingUp,
    ShoppingBag,
    History,
    Banknote,
    Clock,
    ArrowUpRight,
    Edit3,
    MoreVertical,
    CheckCircle2,
    XCircle,
    RotateCw,
    Search,
    Download,
    Trash2,
    Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import Modal from '@shared/components/ui/Modal';
import { motion } from 'framer-motion';

const SellerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'orders';

    const isEditMode = searchParams.get('edit') === 'true';

    const setActiveTab = (tab) => {
        setSearchParams((prev) => {
            prev.set('tab', tab);
            return prev;
        });
    };
    const [isRefreshing, setIsRefreshing] = useState(false);


    // Mock Data for Seller
    const [seller, setSeller] = useState({
        id: id || 'SEL-001',
        shopName: 'Loading...',
        ownerName: 'Loading...',
        email: 'Loading...',
        phone: 'Loading...',
        category: 'Loading...',
        rating: 4.8,
        status: 'active',
        joinedDate: '12 Jan 2024',
        location: 'Loading...',
        image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=200',
        walletBalance: 24500,
        totalOrders: 1450,
        totalRevenue: 540000,
        commissionRate: '10%',
        coords: { lat: 19.0760, lng: 72.8777 },
        serviceRadius: 5,
        bankInfo: {
            bankName: 'HDFC Bank',
            accountNo: 'XXXX XXXX 1234',
            ifsc: 'HDFC0001234'
        },
        isEventSeller: false,
        eventCategory: '',
        maxCapacity: 500,
        allowCustomProductEntry: false,
        liveKitchenEnabled: false,
        liveAddToCartEnabled: false,
        liveServicesEnabled: false,
        customizationEngineEnabled: false,
        quoteReferencePhotoUpload: false,
        quoteThemeSelection: false,
        quoteColorCombination: false,
        quoteBudgetSelection: false,
        quoteCustomerNotes: false,
        quoteSellerQuotation: false,
        quoteQuoteRevision: false,
        quoteCustomerApproval: false,
        quoteFinalPayment: false,
    });

    const [eventCategories, setEventCategories] = useState([]);
    const [bookings, setBookings] = useState([]);

    const fetchSellerData = async () => {
        try {
            const res = await adminUsersApi.getSellerById(id);
            const data = res.data.result;
            setSeller(prev => ({
                ...prev,
                shopName: data.shopName,
                ownerName: data.name || data.ownerName,
                email: data.email,
                phone: data.phone,
                location: data.address || data.location,
                description: data.description || '',
                availableColors: data.availableColors || [],
                category: data.category || '',
                isEventSeller: data.isEventSeller || false,
                hasProductAccess: data.hasProductAccess !== false,
                retailEnabled: data.retailEnabled ?? true,
                planMyEventEnabled: data.planMyEventEnabled ?? false,
                eventDetailsEnabled: data.eventDetailsEnabled ?? false,
                primaryContactEnabled: data.primaryContactEnabled ?? true,
                coupleContactEnabled: data.coupleContactEnabled ?? true,
                eventCategory: (data.serviceCategories && data.serviceCategories.length > 0) ? data.serviceCategories[0] : '',
                minCapacity: data.minGuestCapacity || 1,
                maxCapacity: data.maxGuestCapacity || 500,
                capacityEnabled: data.capacityEnabled ?? false,
                totalCapacity: data.totalCapacity || 100,
                bookingType: data.bookingType || 'multiple_time',
                commissionRate: data.commissionRate ? `${data.commissionRate}%` : '10%',
                joinedDate: new Date(data.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                bankInfo: {
                    bankName: data.bankDetails?.bankName || 'Not Set',
                    accountNo: data.bankDetails?.accountNo ? `XXXX XXXX ${data.bankDetails.accountNo.slice(-4)}` : 'XXXX XXXX 0000',
                    ifsc: data.bankDetails?.ifscCode || 'Not Set'
                },
                walletBalance: data.stats?.walletBalance || 0,
                totalOrders: data.stats?.totalOrders || 0,
                totalRevenue: data.stats?.totalRevenue || 0,
                rating: data.stats?.rating || 0,
                status: data.applicationStatus === 'bounced_back' ? 'bounced_back'
                    : data.applicationStatus === 'rejected' ? 'rejected'
                    : data.applicationStatus === 'pending' ? 'pending'
                    : (data.isVerified && data.isActive && data.sellerVerificationStatus === 'verified') ? 'active'
                    : data.sellerVerificationStatus === 'pending' ? 'pending_verification'
                    : (data.applicationStatus || 'inactive'),
                documents: data.documents || {},
                documentStatuses: data.documentStatuses || {},
                documentFiles: Object.entries(data.documents || {})
                    .filter(([, value]) => Boolean(value))
                    .map(([key, value]) => {
                        const normalizedValue = String(value).trim();
                        const isUrl = /^https?:\/\//i.test(normalizedValue);
                        return {
                            key,
                            label: key.replace(/([A-Z])/g, " $1").trim(),
                            url: isUrl ? normalizedValue : "",
                            isViewable: isUrl,
                            fileType: normalizedValue.toLowerCase().includes(".pdf") ? "pdf" : "image",
                            status: (data.documentStatuses && data.documentStatuses[key]) || "pending"
                        };
                    }),
                productsEnabled: data.productsEnabled ?? true,
                stockEnabled: data.stockEnabled ?? true,
                ordersEnabled: data.ordersEnabled ?? true,
                walletEnabled: data.walletEnabled ?? true,
                analyticsEnabled: data.analyticsEnabled ?? true,
                allowCustomProductEntry: data.allowCustomProductEntry ?? false,
                liveKitchenEnabled: data.liveKitchenEnabled ?? false,
                liveAddToCartEnabled: data.liveAddToCartEnabled ?? false,
                liveServicesEnabled: data.liveServicesEnabled ?? false,
                customizationEngineEnabled: data.customizationEngineEnabled ?? false,
                quoteReferencePhotoUpload: data.quoteReferencePhotoUpload ?? false,
                quoteThemeSelection: data.quoteThemeSelection ?? false,
                quoteColorCombination: data.quoteColorCombination ?? false,
                quoteBudgetSelection: data.quoteBudgetSelection ?? false,
                quoteCustomerNotes: data.quoteCustomerNotes ?? false,
                quoteSellerQuotation: data.quoteSellerQuotation ?? false,
                quoteQuoteRevision: data.quoteQuoteRevision ?? false,
                quoteCustomerApproval: data.quoteCustomerApproval ?? false,
                quoteFinalPayment: data.quoteFinalPayment ?? false,
                acceptsCOD: data.acceptsCOD ?? true,
                acceptsRazorpay: data.acceptsRazorpay ?? true,
                ticketSystemEnabled: data.ticketSystemEnabled ?? true,
                showStandardDateTime: data.showStandardDateTime ?? false,
                showStandardDateTimeSlot: data.showStandardDateTimeSlot ?? false,
                showAdvancedDateTime: data.showAdvancedDateTime ?? false,
                showAdvancedDateTimeSlot: data.showAdvancedDateTimeSlot ?? false,
                showMultipleDateTime: data.showMultipleDateTime ?? false,
                addonDecorationEnabled: data.addonDecorationEnabled ?? false,
                addonDecorationPrice: data.addonDecorationPrice ?? 0,
                addonBridalEnabled: data.addonBridalEnabled ?? false,
                addonBridalPrice: data.addonBridalPrice ?? 0,
                addonCateringEnabled: data.addonCateringEnabled ?? false,
                addonCateringPrice: data.addonCateringPrice ?? 0,
                physicalPaymentEnabled: data.physicalPaymentEnabled ?? false,
                paymentQrCode: data.paymentQrCode ?? "",
                venueVisitsEnabled: data.venueVisitsEnabled ?? true,
                isShopActive: data.isShopActive ?? true,
                shopTimingsEnabled: data.shopTimingsEnabled ?? false,
                shopHolidaysEnabled: data.shopHolidaysEnabled ?? false,
                ticketCancellationBufferEnabled: data.ticketCancellationBufferEnabled ?? false,
                advanceBookingBuffer: data.advanceBookingBuffer ?? 0,
                advanceBookingBufferUnit: data.advanceBookingBufferUnit || 'days',
                advanceBookingBufferTime: data.advanceBookingBufferTime || "12",
                shopClosedDates: data.shopClosedDates || [],
                demoTrialEnabled: data.demoTrialEnabled ?? false,
                demoTrialDays: data.demoTrialDays || 15,
                corporateContactEnabled: data.corporateContactEnabled ?? false,
                noOfGuestsEnabled: data.noOfGuestsEnabled ?? false,
                functionLocationEnabled: data.functionLocationEnabled ?? false,
                sellerLocationEnabled: data.sellerLocationEnabled ?? false,
                numberOfShops: data.numberOfShops || 1,
                shopsAtLocation: Array.isArray(data.shopsAtLocation) ? data.shopsAtLocation : [],
                videoUploadEnabled: data.videoUploadEnabled ?? false,
                customerImageReviewEnabled: data.customerImageReviewEnabled ?? false,
                advanceBookingEnabled: data.advanceBookingEnabled ?? false,
                advancePaymentPercentage: data.advancePaymentPercentage ?? 0,
                quoteAdvancePayment: data.quoteAdvancePayment ?? false,
            }));
        } catch (error) {
            console.error(error);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await adminEventConfigApi.getEventCategories();
            setEventCategories(res.result || res || []);
        } catch (error) {
            console.error("Failed to load categories", error);
        }
    };

    const fetchBookings = async () => {
        try {
            const res = await adminUsersApi.getSellerBookings(id);
            setBookings(res.data.result || []);
        } catch (error) {
            console.error("Failed to load seller bookings", error);
        }
    };

    useEffect(() => {
        fetchSellerData();
        fetchCategories();
        fetchBookings();
    }, [id, activeTab]);

    const handleUpdateEventSettings = async () => {
        try {
            await adminUsersApi.updateSellerType(id, {
                isEventSeller: seller.isEventSeller,
                serviceCategories: seller.eventCategory ? [seller.eventCategory] : [],
                minGuestCapacity: seller.minCapacity,
                maxGuestCapacity: seller.maxCapacity
            });
            showToast('Event settings updated!', 'success');
        } catch (error) {
            showToast('Failed to update event settings', 'error');
        }
    };

    const handleToggleRetail = async (sellerId, currentAccess) => {
        try {
            await adminUsersApi.updateSeller(sellerId, { retailEnabled: !currentAccess });
            showToast('Permissions updated successfully', 'success');
            setSeller(prev => ({ ...prev, retailEnabled: !currentAccess }));
        } catch (error) {
            showToast('Failed to update permissions', 'error');
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchCategories();
        fetchSellerData().finally(() => setIsRefreshing(false));
    };

    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handlePermissionChange = (field) => (e) => {
        if (!isEditMode) return;
        const checked = e.target.checked;
        setSeller(prev => ({ ...prev, [field]: checked }));
    };

    const handleUpdateStoreInfo = async () => {
        setIsUpdating(true);
        try {
            const payload = {
                retailEnabled: seller.retailEnabled,
                productsEnabled: seller.productsEnabled,
                stockEnabled: seller.stockEnabled,
                ordersEnabled: seller.ordersEnabled,
                walletEnabled: seller.walletEnabled,
                analyticsEnabled: seller.analyticsEnabled,
                planMyEventEnabled: seller.planMyEventEnabled,
                isShopActive: seller.isShopActive,
                shopTimingsEnabled: seller.shopTimingsEnabled,
                shopHolidaysEnabled: seller.shopHolidaysEnabled,
                ticketCancellationBufferEnabled: seller.ticketCancellationBufferEnabled,
                advanceBookingBuffer: seller.advanceBookingBuffer,
                advanceBookingBufferUnit: seller.advanceBookingBufferUnit,
                advanceBookingBufferTime: seller.advanceBookingBufferTime,
                shopClosedDates: seller.shopClosedDates,
                demoTrialEnabled: seller.demoTrialEnabled,
                demoTrialDays: seller.demoTrialDays,
                eventDetailsEnabled: seller.eventDetailsEnabled,
                primaryContactEnabled: seller.primaryContactEnabled,
                coupleContactEnabled: seller.coupleContactEnabled,
                corporateContactEnabled: seller.corporateContactEnabled,
                noOfGuestsEnabled: seller.noOfGuestsEnabled,
                showStandardDateTime: seller.showStandardDateTime,
                showStandardDateTimeSlot: seller.showStandardDateTimeSlot,
                showAdvancedDateTime: seller.showAdvancedDateTime,
                showAdvancedDateTimeSlot: seller.showAdvancedDateTimeSlot,
                showMultipleDateTime: seller.showMultipleDateTime,
                functionLocationEnabled: seller.functionLocationEnabled,
                sellerLocationEnabled: seller.sellerLocationEnabled,
                capacityEnabled: seller.capacityEnabled,
                totalCapacity: seller.totalCapacity,
                bookingType: seller.bookingType,
                numberOfShops: seller.numberOfShops,
                shopsAtLocation: seller.shopsAtLocation || [],
                minCapacity: seller.minCapacity,
                maxCapacity: seller.maxCapacity,
                allowCustomProductEntry: seller.allowCustomProductEntry,
                liveKitchenEnabled: seller.liveKitchenEnabled,
                liveAddToCartEnabled: seller.liveAddToCartEnabled,
                liveServicesEnabled: seller.liveServicesEnabled,
                videoUploadEnabled: seller.videoUploadEnabled,
                customizationEngineEnabled: seller.customizationEngineEnabled,
                quoteReferencePhotoUpload: seller.quoteReferencePhotoUpload,
                quoteColorCombination: seller.quoteColorCombination,
                quoteThemeSelection: seller.quoteThemeSelection,
                quoteBudgetSelection: seller.quoteBudgetSelection,
                quoteCustomerNotes: seller.quoteCustomerNotes,
                quoteSellerQuotation: seller.quoteSellerQuotation,
                quoteQuoteRevision: seller.quoteQuoteRevision,
                quoteCustomerApproval: seller.quoteCustomerApproval,
                quoteAdvancePayment: seller.quoteAdvancePayment,
                quoteFinalPayment: seller.quoteFinalPayment,
                customerImageReviewEnabled: seller.customerImageReviewEnabled,
                advanceBookingEnabled: seller.advanceBookingEnabled,
                advancePaymentPercentage: Number(seller.advancePaymentPercentage || 0),
                addonDecorationEnabled: seller.addonDecorationEnabled,
                addonDecorationPrice: Number(seller.addonDecorationPrice || 0),
                addonBridalEnabled: seller.addonBridalEnabled,
                addonBridalPrice: Number(seller.addonBridalPrice || 0),
                addonCateringEnabled: seller.addonCateringEnabled,
                addonCateringPrice: Number(seller.addonCateringPrice || 0),
                physicalPaymentEnabled: seller.physicalPaymentEnabled,
                paymentQrCode: seller.paymentQrCode,
                acceptsCOD: seller.acceptsCOD,
                acceptsRazorpay: seller.acceptsRazorpay,
                ticketSystemEnabled: seller.ticketSystemEnabled,
                venueVisitsEnabled: seller.venueVisitsEnabled
            };
            await adminUsersApi.updateSeller(seller.id, payload);
            if (seller.minCapacity !== undefined || seller.maxCapacity !== undefined) {
                try {
                    await adminUsersApi.updateSellerType(seller.id, {
                        minGuestCapacity: seller.minCapacity,
                        maxGuestCapacity: seller.maxCapacity
                    });
                } catch (typeErr) {
                    console.warn('Could not update guest capacities via seller type API:', typeErr);
                }
            }
            showToast('Store permissions & settings updated successfully in database', 'success');
        } catch (err) {
            console.error('Update error:', err);
            showToast(err.response?.data?.message || 'Failed to update store settings', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteSeller = async () => {
        setIsDeleting(true);
        try {
            await adminUsersApi.deleteSeller(seller.id);
            showToast('Seller soft-deleted successfully', 'success');
            setShowDeleteConfirm(false);
            navigate('/admin/sellers/active');
        } catch (err) {
            console.error('Delete seller error:', err);
            showToast(err.response?.data?.message || 'Failed to delete seller', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    if (!seller) return <div className="p-8 text-center text-slate-500 font-bold">Loading...</div>;

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header / Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/sellers/active')}
                        className="p-2.5 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <ChevronLeft className="h-5 w-5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="ds-h1">{seller.shopName}</h1>
                            <Badge
                                variant={
                                    seller.status === 'active' ? 'success'
                                    : seller.status === 'bounced_back' ? 'warning'
                                    : seller.status === 'rejected' ? 'destructive'
                                    : seller.status === 'pending_verification' ? 'warning'
                                    : 'secondary'
                                }
                                className="text-[10px] font-black uppercase tracking-widest"
                            >
                                {seller.status === 'pending_verification' ? 'PENDING VERIFICATION'
                                    : seller.status === 'bounced_back' ? 'BOUNCED BACK'
                                    : seller.status?.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="ds-description mt-1 text-slate-500 font-medium">Owned by {seller.ownerName} • {seller.isEventSeller ? (seller.eventCategory?.name || 'Event Seller') : (seller.category || '')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all"
                    >
                        <RotateCw className={cn("h-4 w-4 text-primary", isRefreshing && "animate-spin")} />
                        SYNC DATA
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Wallet Balance', value: `₹${seller.walletBalance.toLocaleString()}`, icon: Wallet, color: 'emerald', sub: 'Available for Payout' },
                    { label: 'Total Revenue', value: `₹${(seller.totalRevenue / 1000).toFixed(1)}k`, icon: TrendingUp, color: 'blue', sub: 'Gross Sales' },
                    { label: 'Orders Handled', value: seller.totalOrders, icon: ShoppingBag, color: 'indigo', sub: 'Lifetime Orders' },
                    { label: 'Store Rating', value: `${seller.rating} / 5.0`, icon: Star, color: 'amber', sub: 'Based on 450+ reviews' },
                ].map((stat, i) => (
                    <Card key={i} className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2.5 rounded-2xl",
                                stat.color === 'emerald' && "bg-brand-50 text-brand-600",
                                stat.color === 'blue' && "bg-brand-50 text-brand-600",
                                stat.color === 'indigo' && "bg-brand-50 text-brand-600",
                                stat.color === 'amber' && "bg-amber-50 text-amber-600",
                            )}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.sub}</span>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</h4>
                        <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Tabs Navigation */}
                    <div className="flex items-center gap-2 p-1 bg-slate-100/50 backdrop-blur-sm rounded-2xl w-full overflow-x-auto whitespace-nowrap scrollbar-none">
                        {[
                            { id: 'orders', label: 'Order History', icon: History },
                            { id: 'bookings', label: 'Bookings', icon: Calendar },
                            { id: 'transactions', label: 'Transactions', icon: Banknote },
                            { id: 'delivery', label: 'Delivery', icon: MapPin },
                            { id: 'payouts', label: 'Withdrawals', icon: Wallet },
                            { id: 'info', label: 'Store Info', icon: Building2 },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                    activeTab === tab.id
                                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-200"
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden min-h-[500px]">
                        {activeTab === 'bookings' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="p-4 pb-4 flex items-center justify-between border-b border-slate-50">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Bookings Tracking</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Slot</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {bookings.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-8 text-center text-slate-400 text-xs font-semibold">No bookings found for this seller.</td>
                                                </tr>
                                            ) : bookings.map((b, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-5">
                                                        <span className="text-xs font-black text-slate-900">{b.customerName}</span>
                                                        <p className="text-[10px] font-bold text-slate-400">{b.mobileNumber}</p>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <span className="text-xs font-bold text-slate-700">{new Date(b.bookingDate).toLocaleDateString('en-GB')}</span>
                                                        <p className="text-[10px] font-bold text-slate-400">{b.timeSlot}</p>
                                                    </td>
                                                    <td className="px-4 py-5 text-center">
                                                        <Badge
                                                            variant={b.bookingStatus === 'Booked' ? 'success' : b.bookingStatus === 'Marked' ? 'warning' : 'secondary'}
                                                            className="text-[9px] font-black"
                                                        >
                                                            {b.bookingStatus.toUpperCase()}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-5 font-bold text-xs text-slate-700">
                                                        <div>Paid: ₹{b.totalPaidAmount}</div>
                                                        <div className="text-rose-600">Due: ₹{b.paymentDueAmount}</div>
                                                    </td>
                                                    <td className="px-4 py-5 text-right text-xs font-black text-slate-500 uppercase">
                                                        {b.type}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="p-4 pb-4 flex items-center justify-between border-b border-slate-50">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Recent Orders</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Order ID..."
                                                className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold w-40 outline-none ring-1 ring-transparent focus:ring-primary/20"
                                            />
                                        </div>
                                        <button className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-primary transition-colors">
                                            <Download className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {[
                                                { id: '#ORD-9912', customer: 'Aarav Patel', status: 'delivered', amount: 850, date: 'Today, 11:30 AM' },
                                                { id: '#ORD-9884', customer: 'Ishani Roy', status: 'processing', amount: 1240, date: 'Today, 09:15 AM' },
                                                { id: '#ORD-9821', customer: 'Kabir Singh', status: 'delivered', amount: 450, date: 'Yesterday' },
                                                { id: '#ORD-9750', customer: 'Priya Verma', status: 'cancelled', amount: 2100, date: 'Yesterday' },
                                                { id: '#ORD-9690', customer: 'Rohan Mehra', status: 'delivered', amount: 150, date: '14 Feb' },
                                            ].map((order, i) => (
                                                <tr key={i} className="group hover:bg-slate-50/50 transition-colors cursor-pointer">
                                                    <td className="px-4 py-5">
                                                        <span className="text-xs font-black text-slate-900">{order.id}</span>
                                                        <p className="text-[10px] font-bold text-slate-400">{order.date}</p>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <span className="text-xs font-bold text-slate-700">{order.customer}</span>
                                                    </td>
                                                    <td className="px-4 py-5 text-center">
                                                        <Badge
                                                            variant={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : 'warning'}
                                                            className="text-[9px] font-black"
                                                        >
                                                            {order.status.toUpperCase()}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-5 text-right font-black text-slate-900">
                                                        ₹{order.amount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'transactions' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300 p-4">
                                <div className="flex items-center justify-between mb-8">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Financial ledger</h4>
                                    <Badge variant="blue" className="text-[9px] font-black">LAST 30 DAYS</Badge>
                                </div>
                                <div className="space-y-4">
                                    {[
                                        { id: 'TXN-8821', type: 'credit', desc: 'Order #ORD-9912 Settlement', amount: 765, date: 'Today, 14:20' },
                                        { id: 'TXN-8810', type: 'debit', desc: 'Withdrawal to Bank', amount: 15000, date: 'Yesterday' },
                                        { id: 'TXN-8792', type: 'credit', desc: 'Order #ORD-9821 Settlement', amount: 405, date: 'Yesterday' },
                                        { id: 'TXN-8750', type: 'credit', desc: 'Order #ORD-9690 Settlement', amount: 135, date: '14 Feb' },
                                    ].map((txn, i) => (
                                        <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("p-2 rounded-xl flex items-center justify-center",
                                                    txn.type === 'credit' ? "bg-brand-100 text-brand-600" : "bg-rose-100 text-rose-600"
                                                )}>
                                                    {txn.type === 'credit' ? <TrendingUp className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-900">{txn.desc}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{txn.id} • {txn.date}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn("text-sm font-black", txn.type === 'credit' ? "text-brand-600" : "text-rose-600")}>
                                                    {txn.type === 'credit' ? '+' : '-'} ₹{txn.amount.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'delivery' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300 h-[500px] relative overflow-hidden group">
                                {/* Map Background Overlay */}
                                <div className="absolute inset-0 grayscale-[0.3] contrast-[1.1] opacity-40 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=2000')]" />
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/50 via-transparent to-primary/5" />

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="relative">
                                        {/* Service Area Radar */}
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className="rounded-full bg-primary/20 border-2 border-primary/40 shadow-[0_0_50px_rgba(var(--primary),0.3)] animate-pulse"
                                            style={{
                                                width: `${seller.serviceRadius * 40}px`,
                                                height: `${seller.serviceRadius * 40}px`
                                            }}
                                        />
                                        {/* Store Marker */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <div className="h-10 w-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-white z-10 relative">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div className="absolute inset-0 bg-primary rounded-2xl animate-ping opacity-20" />
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Legend */}
                                <div className="absolute top-6 left-6 flex flex-col gap-2">
                                    <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-white/50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coverage View</p>
                                        <h5 className="text-sm font-black text-slate-900">{seller.serviceRadius}km Delivery Area</h5>
                                    </div>
                                </div>
                                <div className="absolute bottom-6 right-6 p-4 max-w-[200px] bg-slate-900/90 backdrop-blur rounded-2xl text-white shadow-2xl border border-white/10">
                                    <p className="text-[9px] font-black opacity-60 uppercase mb-1">Live Telemetry</p>
                                    <p className="text-[10px] font-bold leading-relaxed">System monitoring active traffic within the {seller.serviceRadius}km designated boundary.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'payouts' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300 p-4 text-center py-20">
                                <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Clock className="h-10 w-10 text-slate-200" />
                                </div>
                                <h4 className="text-lg font-black text-slate-900 uppercase">Withdrawal tracking</h4>
                                <p className="text-sm font-bold text-slate-400 mt-2 max-w-xs mx-auto">View withdrawal history and pending requests here.</p>
                                <button className="mt-8 px-4 py-3 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 shadow-xl shadow-slate-200 transition-all">
                                    START MANUAL PAYOUT
                                </button>
                            </div>
                        )}

                        {activeTab === 'info' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                                    <div className="ds-section-spacing">
                                        <div>
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Store Identity</h5>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                                                        <Building2 className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900">{seller.shopName}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{seller.id}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                                                        <p className="text-xs font-black text-slate-900 capitalize truncate" title={(() => {
                                                            const cats = [];
                                                            if (seller.category && String(seller.category).toLowerCase() !== 'n/a') cats.push(seller.category);
                                                            if (seller.serviceCategories?.length) cats.push(...seller.serviceCategories.map(c => c.name || 'Unknown'));
                                                            return cats.join(', ') || (seller.isEventSeller ? 'Event Seller' : 'N/A');
                                                        })()}>
                                                            {(() => {
                                                                const cats = [];
                                                                if (seller.category && String(seller.category).toLowerCase() !== 'n/a') cats.push(seller.category);
                                                                if (seller.serviceCategories?.length) cats.push(...seller.serviceCategories.map(c => c.name || 'Unknown'));
                                                                return cats.join(', ') || (seller.isEventSeller ? 'Event Seller' : 'N/A');
                                                            })()}
                                                        </p>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Commission</p>
                                                        <p className="text-xs font-black text-slate-900">{seller.commissionRate}</p>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Joined</p>
                                                        <p className="text-xs font-black text-slate-900">{seller.joinedDate}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Bank Verification</h5>
                                            <div className="p-6 bg-brand-50/50 rounded-xl border border-brand-100 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-slate-600">Account Verified</p>
                                                    <CheckCircle2 className="h-4 w-4 text-brand-500" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-brand-700/50 uppercase tracking-widest mb-1">Settlement Account</p>
                                                    <p className="text-sm font-black text-slate-900">{seller.bankInfo.bankName}</p>
                                                    <p className="text-xs font-bold text-slate-500 font-mono mt-0.5">{seller.bankInfo.accountNo}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ds-section-spacing">
                                        {/* VIEW MODE / EDIT MODE STATUS BANNER */}
                                        <div className={cn(
                                            "mb-6 p-4 rounded-xl border flex items-center justify-between gap-4 transition-all",
                                            isEditMode 
                                                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                                                : "bg-slate-50 border-slate-200 text-slate-700"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-9 w-9 rounded-xl flex items-center justify-center font-black text-white shrink-0",
                                                    isEditMode ? "bg-emerald-600" : "bg-slate-500"
                                                )}>
                                                    {isEditMode ? <Edit3 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black uppercase tracking-wider">
                                                        {isEditMode ? "Edit Mode Active (Verified)" : "View Profile (Read Only Mode)"}
                                                    </h5>
                                                    <p className="text-[11px] font-medium opacity-80">
                                                        {isEditMode 
                                                            ? "You can modify toggles and settings below. Click 'UPDATE STORE' at the bottom to save your changes."
                                                            : "Toggles and inputs are view-only here. To edit and update, click 'EDIT' from Active Sellers list and verify OTP/email."}
                                                    </p>
                                                </div>
                                            </div>
                                            {!isEditMode && (
                                                <span className="text-[10px] font-black uppercase tracking-widest bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg shrink-0">
                                                    Read Only
                                                </span>
                                            )}
                                        </div>

                                        {/* MODULE SETTINGS */}
                                        <div className="mb-8">
                                            <h5 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Module Access Permissions</h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-xl border border-slate-200">

                                                <PermissionToggle
                                                    label="Retail Store (Master)"
                                                    description="Main toggle for retail store access"
                                                    checked={seller.retailEnabled}
                                                    disabled={!isEditMode}
                                                    onChange={handlePermissionChange('retailEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Products & Catalog"
                                                    description="Allow adding and managing products"
                                                    checked={seller.productsEnabled}
                                                    disabled={!isEditMode}
                                                    onChange={handlePermissionChange('productsEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Stock & Inventory"
                                                    description="Allow managing product inventory"
                                                    checked={seller.stockEnabled}
                                                    disabled={!isEditMode}
                                                    onChange={handlePermissionChange('stockEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Orders & Returns"
                                                    description="Allow viewing and managing orders"
                                                    checked={seller.ordersEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-blue-500" hoverColor="group-hover:text-blue-600"
                                                    onChange={handlePermissionChange('ordersEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Wallet & Earnings"
                                                    description="Allow access to payouts and earnings"
                                                    checked={seller.walletEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-amber-500" hoverColor="group-hover:text-amber-600"
                                                    onChange={handlePermissionChange('walletEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Analytics & Reports"
                                                    description="Allow viewing sales analytics"
                                                    checked={seller.analyticsEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                    onChange={handlePermissionChange('analyticsEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Plan My Event"
                                                    description="Allow event service bookings"
                                                    checked={seller.planMyEventEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-violet-500" hoverColor="group-hover:text-violet-600"
                                                    onChange={handlePermissionChange('planMyEventEnabled')}
                                                />

                                                {/* Shop Operation Settings */}
                                                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mb-4 col-span-1 md:col-span-2">
                                                    <div className="flex flex-col gap-1 mb-4 border-b border-slate-200 pb-3">
                                                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Shop Operation Settings</h5>
                                                        <p className="text-[10px] text-slate-500 font-medium">Control shop visibility, timings, and advance booking rules.</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        <PermissionToggle
                                                            label="Master Shop Visibility"
                                                            description="If OFF, shop will not be visible on Customer App"
                                                            checked={seller.isShopActive ?? true}
                                                            disabled={!isEditMode}
                                                            activeColor="bg-fuchsia-600" hoverColor="group-hover:text-fuchsia-700"
                                                            onChange={handlePermissionChange('isShopActive')}
                                                        />

                                                        <PermissionToggle
                                                            label="Strict Operating Hours"
                                                            description="Enable to enforce strict shop opening/closing hours"
                                                            checked={seller.shopTimingsEnabled ?? false}
                                                            disabled={!isEditMode}
                                                            activeColor="bg-fuchsia-600" hoverColor="group-hover:text-fuchsia-700"
                                                            onChange={handlePermissionChange('shopTimingsEnabled')}
                                                        />

                                                        <div className="flex flex-col gap-2 mt-2">
                                                            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                                                Advance Booking Buffer
                                                                <span className="text-[10px] font-normal text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full">Minimum time before booking</span>
                                                            </label>
                                                            <div className="flex flex-wrap gap-2 w-full">
                                                                <input type="number" min="0"
                                                                    value={seller.advanceBookingBuffer ?? 0}
                                                                    disabled={!isEditMode}
                                                                    onChange={(e) => {
                                                                        const val = Number(e.target.value);
                                                                        setSeller(prev => ({ ...prev, advanceBookingBuffer: val }));
                                                                    }}
                                                                    className="flex-1 min-w-[60px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-fuchsia-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                                <select
                                                                    value={seller.advanceBookingBufferUnit || 'days'}
                                                                    disabled={!isEditMode}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setSeller(prev => ({ ...prev, advanceBookingBufferUnit: val }));
                                                                    }}
                                                                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-fuchsia-500 outline-none bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                >
                                                                    <option value="days">Days</option>
                                                                    <option value="hours">Hours</option>
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="23"
                                                                    placeholder="Hrs"
                                                                    value={seller.advanceBookingBufferTime || "12"}
                                                                    disabled={!isEditMode}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setSeller(prev => ({ ...prev, advanceBookingBufferTime: val }));
                                                                    }}
                                                                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:ring-1 focus:ring-fuchsia-500 outline-none bg-white w-16 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            </div>
                                                        </div>

                                                        <PermissionToggle
                                                            label="Shop Closed Dates / Holidays Management"
                                                            description="Allow seller to define and manage shop closed dates / holidays in their profile"
                                                            checked={seller.shopHolidaysEnabled ?? false}
                                                            disabled={!isEditMode}
                                                            activeColor="bg-fuchsia-600" hoverColor="group-hover:text-fuchsia-700"
                                                            onChange={handlePermissionChange('shopHolidaysEnabled')}
                                                        />

                                                        <PermissionToggle
                                                            label="Ticket Cancellation Buffer Settings"
                                                            description="Allow seller to define how many days/hours before event customer can cancel ticket"
                                                            checked={seller.ticketCancellationBufferEnabled ?? false}
                                                            disabled={!isEditMode}
                                                            activeColor="bg-fuchsia-600" hoverColor="group-hover:text-fuchsia-700"
                                                            onChange={handlePermissionChange('ticketCancellationBufferEnabled')}
                                                        />

                                                        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-3">
                                                            <PermissionToggle
                                                                label="Enable Demo Trial"
                                                                description="Automatically turn off shop when demo period ends"
                                                                checked={seller.demoTrialEnabled ?? false}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-orange-500" hoverColor="group-hover:text-orange-600"
                                                                onChange={handlePermissionChange('demoTrialEnabled')}
                                                            />

                                                            {seller.demoTrialEnabled && (
                                                                <div className="flex flex-col gap-2 mt-3 pl-4 border-l-2 border-orange-200 ml-2">
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Demo Free Days</label>
                                                                    <div className="flex gap-2 items-center">
                                                                        <input type="number" min="1"
                                                                            value={seller.demoTrialDays || 15}
                                                                            disabled={!isEditMode}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                setSeller(prev => ({ ...prev, demoTrialDays: val }));
                                                                            }}
                                                                            className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-orange-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                        />
                                                                        <span className="text-xs text-slate-500 font-medium">Days</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <PermissionToggle
                                                    label="Event Details"
                                                    description="Grant seller access to view customer event details"
                                                    checked={seller.eventDetailsEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-fuchsia-500" hoverColor="group-hover:text-fuchsia-600"
                                                    onChange={handlePermissionChange('eventDetailsEnabled')}
                                                />

                                                {/* Event & Ticketing Options (Inside Event Details) */}
                                                {seller.eventDetailsEnabled && (
                                                    <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50/50 p-4 rounded-xl border border-slate-100 col-span-1 md:col-span-2">
                                                        <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact & Ticketing Options</h6>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <PermissionToggle
                                                                label="Primary Contact"
                                                                description="Allow primary contact details collection"
                                                                checked={seller.primaryContactEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-blue-500" hoverColor="group-hover:text-blue-600"
                                                                onChange={handlePermissionChange('primaryContactEnabled')}
                                                            />
                                                            <PermissionToggle
                                                                label="Couple Contact"
                                                                description="Allow couple details collection"
                                                                checked={seller.coupleContactEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-pink-500" hoverColor="group-hover:text-pink-600"
                                                                onChange={handlePermissionChange('coupleContactEnabled')}
                                                            />
                                                            <PermissionToggle
                                                                label="Corporate Contact"
                                                                description="Allow corporate details collection"
                                                                checked={seller.corporateContactEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-purple-500" hoverColor="group-hover:text-purple-600"
                                                                onChange={handlePermissionChange('corporateContactEnabled')}
                                                            />
                                                            <PermissionToggle
                                                                label="No of Guests"
                                                                description="Allow collection of number of guests"
                                                                checked={seller.noOfGuestsEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-orange-500" hoverColor="group-hover:text-orange-600"
                                                                onChange={handlePermissionChange('noOfGuestsEnabled')}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Date & Time Slot Settings */}
                                                {seller.eventDetailsEnabled && (
                                                    <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50/50 p-4 rounded-xl border border-slate-100 col-span-1 md:col-span-2">
                                                        <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DATE & TIME SLOT Setting</h6>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <PermissionToggle
                                                                label="Standard Date & Time"
                                                                description="Standard Date and Time selection"
                                                                checked={!!seller.showStandardDateTime}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-fuchsia-500" hoverColor="group-hover:text-fuchsia-600"
                                                                onChange={handlePermissionChange('showStandardDateTime')}
                                                            />
                                                            <PermissionToggle
                                                                label="Standard Date & Time Slot"
                                                                description="Standard Date and Time Slot selection"
                                                                checked={!!seller.showStandardDateTimeSlot}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-fuchsia-500" hoverColor="group-hover:text-fuchsia-600"
                                                                onChange={handlePermissionChange('showStandardDateTimeSlot')}
                                                            />
                                                            <PermissionToggle
                                                                label="Advanced Date Range & Time"
                                                                description="Advanced date range and time"
                                                                checked={!!seller.showAdvancedDateTime}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-fuchsia-500" hoverColor="group-hover:text-fuchsia-600"
                                                                onChange={handlePermissionChange('showAdvancedDateTime')}
                                                            />
                                                            <PermissionToggle
                                                                label="Advanced Date Range & Time Slot"
                                                                description="Advanced date range and multiple time slots"
                                                                checked={!!seller.showAdvancedDateTimeSlot}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-fuchsia-500" hoverColor="group-hover:text-fuchsia-600"
                                                                onChange={handlePermissionChange('showAdvancedDateTimeSlot')}
                                                            />
                                                            <PermissionToggle
                                                                label="Multiple Date & Time & Remarks"
                                                                description="Multiple date & time selection with remarks"
                                                                checked={!!seller.showMultipleDateTime}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-fuchsia-500" hoverColor="group-hover:text-fuchsia-600"
                                                                onChange={handlePermissionChange('showMultipleDateTime')}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {seller.eventDetailsEnabled && (
                                                    <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                        <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">LOCATION OPTIONS</h6>
                                                        <div className="grid grid-cols-1 gap-4">
                                                            <PermissionToggle
                                                                label="Function Location"
                                                                description="Allow function location collection"
                                                                checked={!!seller.functionLocationEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-blue-500" hoverColor="group-hover:text-blue-600"
                                                                onChange={handlePermissionChange('functionLocationEnabled')}
                                                            />
                                                            <PermissionToggle
                                                                label="Seller Location"
                                                                description="Show seller location option"
                                                                checked={!!seller.sellerLocationEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-blue-500" hoverColor="group-hover:text-blue-600"
                                                                onChange={handlePermissionChange('sellerLocationEnabled')}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Capacity Settings Permission Toggle */}
                                                <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50/50 p-4 rounded-xl border border-slate-100 col-span-1 md:col-span-2">
                                                    <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CAPACITY TYPE</h6>
                                                    
                                                    <PermissionToggle
                                                        label="AT Same Location Seller Capacity"
                                                        description="Allow seller to define and manage shops/capacity at same location in their profile"
                                                        checked={seller.capacityEnabled}
                                                        disabled={!isEditMode}
                                                        activeColor="bg-amber-500" hoverColor="group-hover:text-amber-600"
                                                        onChange={handlePermissionChange('capacityEnabled')}
                                                    />
                                                </div>

                                                <PermissionToggle
                                                    label="Custom Product Entry"
                                                    description="Allow manual entry of product name, brand, and ingredients"
                                                    checked={seller.allowCustomProductEntry}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-emerald-500" hoverColor="group-hover:text-emerald-600"
                                                    onChange={handlePermissionChange('allowCustomProductEntry')}
                                                />

                                                <PermissionToggle
                                                    label="Live Kitchen"
                                                    description="Allow live streaming/camera updates from seller kitchen"
                                                    checked={seller.liveKitchenEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-rose-500" hoverColor="group-hover:text-rose-600"
                                                    onChange={handlePermissionChange('liveKitchenEnabled')}
                                                />

                                                {/* Live Kitchen Sub-Permissions Inline */}
                                                {seller.liveKitchenEnabled && (
                                                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex flex-col gap-4 mb-2 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                        <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Kitchen Settings</h6>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                            <PermissionToggle
                                                                label="Add to Cart"
                                                                description="Allow customers to add items to cart directly from live"
                                                                checked={seller.liveAddToCartEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-rose-500" hoverColor="group-hover:text-rose-600"
                                                                onChange={handlePermissionChange('liveAddToCartEnabled')}
                                                            />
                                                            <PermissionToggle
                                                                label="Services"
                                                                description="Allow booking services from live"
                                                                checked={seller.liveServicesEnabled}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-rose-500" hoverColor="group-hover:text-rose-600"
                                                                onChange={handlePermissionChange('liveServicesEnabled')}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <PermissionToggle
                                                    label="Video Subscriptions & Uploads"
                                                    description="Allow seller to upload product videos and buy video plans"
                                                    checked={seller.videoUploadEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-blue-600" hoverColor="group-hover:text-blue-700"
                                                    onChange={handlePermissionChange('videoUploadEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Customization & Quotation Engine"
                                                    description="Master toggle to allow customizations and direct quotations"
                                                    checked={seller.customizationEngineEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-indigo-600" hoverColor="group-hover:text-indigo-700"
                                                    onChange={handlePermissionChange('customizationEngineEnabled')}
                                                />

                                                {/* Customization & Quotation Engine Sub-Permissions Inline */}
                                                {seller.customizationEngineEnabled && (
                                                    <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex flex-col gap-4 mb-2 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                        <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Customization & Quotation Settings</h6>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <PermissionToggle
                                                                label="Reference Photo Upload"
                                                                description="Allow upload of reference photos"
                                                                checked={seller.quoteReferencePhotoUpload}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteReferencePhotoUpload')}
                                                            />
                                                            <PermissionToggle
                                                                label="Color Combination"
                                                                description="Allow selecting color combinations"
                                                                checked={seller.quoteColorCombination}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteColorCombination')}
                                                            />
                                                            <PermissionToggle
                                                                label="Customer & Seller Chat"
                                                                description="Allow chat for plan my event"
                                                                checked={seller.quoteCustomerNotes}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteCustomerNotes')}
                                                            />
                                                            <PermissionToggle
                                                                label="Seller Quotation"
                                                                description="Allow seller to send quotations"
                                                                checked={seller.quoteSellerQuotation}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteSellerQuotation')}
                                                            />
                                                            <PermissionToggle
                                                                label="Quote Revision"
                                                                description="Allow revisions to quotation"
                                                                checked={seller.quoteQuoteRevision}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteQuoteRevision')}
                                                            />
                                                            <PermissionToggle
                                                                label="Customer Approval"
                                                                description="Allow customer approval step"
                                                                checked={seller.quoteCustomerApproval}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteCustomerApproval')}
                                                            />
                                                            <PermissionToggle
                                                                label="Advance Payment"
                                                                description="Allow advance payment step"
                                                                checked={seller.quoteAdvancePayment}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteAdvancePayment')}
                                                            />
                                                            <PermissionToggle
                                                                label="Final Payment"
                                                                description="Allow final payment step"
                                                                checked={seller.quoteFinalPayment}
                                                                disabled={!isEditMode}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={handlePermissionChange('quoteFinalPayment')}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <PermissionToggle
                                                    label="Customer Image Review"
                                                    description="Allow seller to review categorized customer uploads"
                                                    checked={seller.customerImageReviewEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-fuchsia-600" hoverColor="group-hover:text-fuchsia-700"
                                                    onChange={handlePermissionChange('customerImageReviewEnabled')}
                                                />

                                                <PermissionToggle
                                                    label="Advance Payment System"
                                                    description="Allow seller to manage advance bookings and status"
                                                    checked={seller.advanceBookingEnabled}
                                                    disabled={!isEditMode}
                                                    activeColor="bg-teal-600" hoverColor="group-hover:text-teal-700"
                                                    onChange={handlePermissionChange('advanceBookingEnabled')}
                                                />
                                                {seller.advanceBookingEnabled && (
                                                    <div className="flex items-center gap-3 pl-12 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Advance Payment (%):</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            placeholder="0"
                                                            value={seller.advancePaymentPercentage ?? 0}
                                                            disabled={!isEditMode}
                                                            onChange={(e) => setSeller(prev => ({ ...prev, advancePaymentPercentage: e.target.value }))}
                                                            className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                        />
                                                        <span className="text-xs text-slate-500 font-semibold">%</span>
                                                    </div>
                                                )}

                                            </div>

                                            {/* Optional Add-on Services */}
                                            <div className="mb-8 mt-8 border-t border-slate-100 pt-6">
                                                <h5 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Optional Add-on Services</h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                                                    {/* Decoration Add-on */}
                                                    <div className="space-y-2">
                                                        <PermissionToggle
                                                            label="Decoration Add-on"
                                                            description="Enable decoration service options for booking"
                                                            checked={seller.addonDecorationEnabled}
                                                            disabled={!isEditMode}
                                                            onChange={handlePermissionChange('addonDecorationEnabled')}
                                                        />
                                                        {seller.addonDecorationEnabled && (
                                                            <div className="flex items-center gap-2 pl-12">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Enter price"
                                                                    value={seller.addonDecorationPrice ?? 0}
                                                                    disabled={!isEditMode}
                                                                    onChange={(e) => setSeller(prev => ({ ...prev, addonDecorationPrice: e.target.value }))}
                                                                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bridal Add-on */}
                                                    <div className="space-y-2">
                                                        <PermissionToggle
                                                            label="Bridal Add-on"
                                                            description="Enable bridal package options for booking"
                                                            checked={seller.addonBridalEnabled}
                                                            disabled={!isEditMode}
                                                            activeColor="bg-pink-500" hoverColor="group-hover:text-pink-600"
                                                            onChange={handlePermissionChange('addonBridalEnabled')}
                                                        />
                                                        {seller.addonBridalEnabled && (
                                                            <div className="flex items-center gap-2 pl-12">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Enter price"
                                                                    value={seller.addonBridalPrice ?? 0}
                                                                    disabled={!isEditMode}
                                                                    onChange={(e) => setSeller(prev => ({ ...prev, addonBridalPrice: e.target.value }))}
                                                                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Catering Add-on */}
                                                    <div className="space-y-2">
                                                        <PermissionToggle
                                                            label="Catering Add-on"
                                                            description="Enable catering services for booking"
                                                            checked={seller.addonCateringEnabled}
                                                            disabled={!isEditMode}
                                                            activeColor="bg-amber-500" hoverColor="group-hover:text-amber-600"
                                                            onChange={handlePermissionChange('addonCateringEnabled')}
                                                        />
                                                        {seller.addonCateringEnabled && (
                                                            <div className="flex items-center gap-2 pl-12">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Enter price"
                                                                    value={seller.addonCateringPrice ?? 0}
                                                                    disabled={!isEditMode}
                                                                    onChange={(e) => setSeller(prev => ({ ...prev, addonCateringPrice: e.target.value }))}
                                                                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Physical Payment Settings */}
                                            <div className="mb-8 border-t border-slate-100 pt-6">
                                                <h5 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-4">Physical Payment Options</h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                                                    <PermissionToggle
                                                        label="Physical Payment Enabled"
                                                        description="Allow customers to pay physically or via QR code"
                                                        checked={seller.physicalPaymentEnabled}
                                                        disabled={!isEditMode}
                                                        activeColor="bg-emerald-600" hoverColor="group-hover:text-emerald-700"
                                                        onChange={handlePermissionChange('physicalPaymentEnabled')}
                                                    />

                                                    {seller.physicalPaymentEnabled && (
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Payment QR Code / Barcode Link:</label>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Enter QR Code image URL"
                                                                    value={seller.paymentQrCode || ''}
                                                                    disabled={!isEditMode}
                                                                    onChange={(e) => setSeller(prev => ({ ...prev, paymentQrCode: e.target.value }))}
                                                                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            </div>
                                                            {seller.paymentQrCode && (
                                                                <div className="mt-2 border border-slate-200 rounded-xl p-2 bg-white inline-block">
                                                                    <img src={seller.paymentQrCode} alt="QR Preview" className="h-24 w-24 object-contain" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mt-4">
                                            <div className="flex flex-col gap-1 mb-4 border-b border-slate-200 pb-3">
                                                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Payment Options</h5>
                                                <p className="text-[10px] text-slate-500 font-medium">Configure supported payment methods for this seller.</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <PermissionToggle
                                                    label="Cash on Delivery (COD)"
                                                    description="Allow COD for this seller"
                                                    checked={seller.acceptsCOD ?? true}
                                                    disabled={!isEditMode}
                                                    onChange={handlePermissionChange('acceptsCOD')}
                                                />
                                                <PermissionToggle
                                                    label="Razorpay (Online)"
                                                    description="Allow Razorpay for this seller"
                                                    checked={seller.acceptsRazorpay ?? true}
                                                    disabled={!isEditMode}
                                                    onChange={handlePermissionChange('acceptsRazorpay')}
                                                />
                                            </div>
                                        </div>

                                        {/* Event & Ticketing Options */}
                                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mt-4">
                                            <div className="flex flex-col gap-1 mb-4 border-b border-slate-200 pb-3">
                                                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Event & Ticketing Options</h5>
                                                <p className="text-[10px] text-slate-500 font-medium">Configure event ticketing visibility for this seller.</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <PermissionToggle
                                                    label="Ticket System"
                                                    description="Show ticketing options for Plan My Event"
                                                    checked={seller.ticketSystemEnabled ?? true}
                                                    disabled={!isEditMode}
                                                    onChange={handlePermissionChange('ticketSystemEnabled')}
                                                />
                                                <PermissionToggle
                                                    label="Venue Visits"
                                                    description="Allow physical visit requests for venues"
                                                    checked={seller.venueVisitsEnabled ?? true}
                                                    disabled={!isEditMode}
                                                    onChange={handlePermissionChange('venueVisitsEnabled')}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 mt-8">Operational Status</h5>
                                            <div className="p-6 bg-slate-900 rounded-xl text-white">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-brand-500 animate-pulse"></div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest">LIVE NOW</span>
                                                    </div>
                                                    <button className="text-[10px] font-black text-rose-400 uppercase hover:underline">Force Close</button>
                                                </div>
                                                <div className="space-y-4 opacity-70">
                                                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                                                        <span className="text-xs font-bold">Visibility</span>
                                                        <span className="text-xs font-black uppercase tracking-widest">Global</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2">
                                                        <span className="text-xs font-bold">Delivery Partner</span>
                                                        <span className="text-xs font-black uppercase tracking-widest text-brand-400">Integrated</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-rose-50 rounded-xl border border-rose-100">
                                            <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <XCircle className="h-4 w-4" />
                                                Safety Controls
                                            </h5>
                                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">Suspend this store immediately from the consumer app in case of policy violations.</p>
                                            <button 
                                                disabled={!isEditMode}
                                                onClick={async () => {
                                                    if (!isEditMode) return;
                                                    try {
                                                        const newStatus = !seller.isShopActive;
                                                        await adminUsersApi.updateSeller(seller.id, { isShopActive: newStatus });
                                                        setSeller(prev => ({ ...prev, isShopActive: newStatus }));
                                                        showToast(newStatus ? 'Store unsuspended successfully' : 'Store suspended successfully', 'success');
                                                    } catch (err) {
                                                        showToast('Failed to update suspension status', 'error');
                                                    }
                                                }}
                                                className="w-full mt-4 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {seller.isShopActive ? "SUSPEND STORE" : "UNSUSPEND STORE"}
                                            </button>
                                        </div>

                                        {/* Action Controls: Update & Soft Delete (Only visible in edit mode after verification) */}
                                        {isEditMode && (
                                            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                                <h5 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1 flex items-center gap-2">
                                                    <Edit3 className="h-4 w-4 text-primary" />
                                                    Store Actions
                                                </h5>
                                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed">Save any modified toggle settings directly to the database or soft-delete this seller.</p>
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={handleUpdateStoreInfo}
                                                        className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Save className={cn("h-4 w-4", isUpdating && "animate-spin")} />
                                                        {isUpdating ? "SAVING..." : "UPDATE STORE"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={isDeleting}
                                                        onClick={() => setShowDeleteConfirm(true)}
                                                        className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        DELETE SELLER
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
                </div>

                {/* Sidebar Context */}
                <div className="space-y-6">
                    {/* Owner Card */}
                    <Card className="p-4 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl text-left">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                                <User className="h-8 w-8 text-slate-300" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-900">{seller.ownerName}</h4>
                                <Badge variant="primary" className="text-[8px] font-black tracking-[0.2em] px-2">PARTNER</Badge>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-500 hover:text-primary transition-colors cursor-pointer">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold">{seller.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-500 hover:text-primary transition-colors cursor-pointer">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <Phone className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold">{seller.phone}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-500">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold leading-relaxed">{seller.location}</span>
                            </div>
                        </div>

                        <button className="w-full mt-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                            MESSAGE OWNER
                        </button>
                    </Card>

                    {/* Quick Notifications */}
                    <Card className="p-4 border-none shadow-xl ring-1 ring-slate-900 bg-slate-900 rounded-xl text-white">
                        <h4 className="text-[10px] font-bold opacity-40 uppercase tracking-[0.2em] mb-6">Strategic Comms</h4>
                        <div className="space-y-4">
                            <p className="text-xs font-medium text-slate-400 italic leading-relaxed">Send a high-priority push to the shop manager app.</p>
                            <textarea
                                placeholder="Message to store..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px]"
                            />
                            <button className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                                SEND ALERT
                            </button>
                        </div>
                    </Card>

                    {/* Documents */}
                    {(seller?.documentFiles?.length > 0 || Object.values(seller?.documents || {}).some(url => url && typeof url === 'string' && url.trim() !== '')) && (
                        <Card className="p-4 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl text-left mt-6">
                            <h4 className="text-[10px] font-bold opacity-40 uppercase tracking-[0.2em] mb-6 text-slate-900">Store Documents</h4>
                            <div className="space-y-4">
                                {(seller.documentFiles || []).map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 capitalize">{doc.label || doc.key || 'Document'}</span>
                                            {doc.status && doc.status !== 'pending' && (
                                                <span className={`text-[9px] mt-0.5 font-bold uppercase ${doc.status === 'verified' || doc.status === 'approved' ? 'text-emerald-600' : doc.status === 'reuploaded' ? 'text-blue-600' : 'text-amber-600'}`}>
                                                    {doc.status.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>
                                        <a href={doc.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline bg-primary/10 px-3 py-1.5 rounded-lg">View</a>
                                    </div>
                                ))}
                                {(!seller.documentFiles || seller.documentFiles.length === 0) && Object.entries(seller?.documents || {}).map(([key, url]) => {
                                    if (!url || typeof url !== 'string' || url.trim() === '') return null;
                                    return (
                                        <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <span className="text-xs font-bold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            <a href={url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline bg-primary/10 px-3 py-1.5 rounded-lg">View</a>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Soft Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="Confirm Seller Deletion"
                size="md"
            >
                <div className="space-y-4 py-2">
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs leading-relaxed">
                        Are you sure you want to delete seller <strong className="text-rose-950">{seller.shopName}</strong>?
                        <br />
                        This will remove the seller from active listings immediately.
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                        <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isDeleting}
                            onClick={handleDeleteSeller}
                            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SellerDetail;
