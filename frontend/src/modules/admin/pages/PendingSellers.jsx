import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    HiOutlineBuildingOffice2,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineEye,
    HiOutlineEnvelope,
    HiOutlinePhone,
    HiOutlineDocumentText,
    HiOutlineMapPin,
    HiOutlineCalendarDays,
    HiOutlineClock,
    HiOutlineXMark,
    HiOutlineArrowPath,
    HiOutlineArrowTopRightOnSquare
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import { adminEventConfigApi } from '../services/adminEventConfigApi';
import { PermissionToggle } from '../components/PermissionToggle';
import { resolveSocketBaseUrl } from '@core/api/resolveApiBaseUrl';

const getNormalizedDocUrl = (url) => {
    if (!url) return '';
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        const baseServerUrl = resolveSocketBaseUrl();
        try {
            const parsedUrl = new URL(url);
            return `${baseServerUrl}${parsedUrl.pathname}${parsedUrl.search}`;
        } catch (e) {
            return url.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, baseServerUrl);
        }
    }
    return url;
};

const PendingSellers = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [pendingSellers, setPendingSellers] = useState([]);
    const [summaryStats, setSummaryStats] = useState({
        totalApplications: 0,
        receivedToday: 0,
        missingInfo: 0,
        avgReviewTimeHours: 24
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [viewingSeller, setViewingSeller] = useState(null);
    const [permissions, setPermissions] = useState({
        retailEnabled: true,
        planMyEventEnabled: false,
        categoriesEnabled: true,
        bookingSlotsEnabled: false,
        productsEnabled: true,
        stockEnabled: true,
        ordersEnabled: true,
        walletEnabled: true,
        analyticsEnabled: true,
        wholesaleEnabled: false,
        allowedRetailCategories: [],
        allowedWholesaleCategories: [],
        allowedEventCategories: [],
        serviceCategories: [],
        allowCustomProductEntry: false,
        liveKitchenEnabled: false,
        customizationEngineEnabled: false,
        quoteReferencePhotoUpload: false,
        quoteThemeSelection: false,
        quoteColorCombination: false,
        quoteBudgetSelection: false,
        quoteCustomerNotes: false,
        quoteSellerQuotation: false,
        quoteQuoteRevision: false,
        quoteCustomerApproval: false,
        quoteAdvancePayment: false,
        quoteFinalPayment: false,
        customerImageReviewEnabled: false,
        advanceBookingEnabled: false,
        addonDecorationEnabled: false,
        addonDecorationPrice: 0,
        addonBridalEnabled: false,
        addonBridalPrice: 0,
        addonCateringEnabled: false,
        addonCateringPrice: 0,
        reviewCategoriesEnabled: [],
    });
    const [allCategories, setAllCategories] = useState([]);
    const [eventCategories, setEventCategories] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [adminRemark, setAdminRemark] = useState('');
    const [adminTerms, setAdminTerms] = useState('');
    const [advancePaymentPercentage, setAdvancePaymentPercentage] = useState(0);
    const [isSavingRemark, setIsSavingRemark] = useState(false);

    const fetchPendingSellers = async () => {
        setIsLoading(true);
        try {
            const response = await adminApi.getPendingSellers({ q: searchTerm || undefined });
            const payload = response.data.result || {};
            const items = Array.isArray(payload.items) ? payload.items : [];
            setPendingSellers(items);
            setSummaryStats({
                totalApplications: payload.stats?.totalApplications ?? items.length,
                receivedToday: payload.stats?.receivedToday ?? 0,
                missingInfo: payload.stats?.missingInfo ?? items.filter((s) => (s.documents || []).length < 3).length,
                avgReviewTimeHours: payload.stats?.avgReviewTimeHours ?? 24
            });

            // Check if we need to open a specific review modal from URL
            const reviewId = searchParams.get('review');
            if (reviewId) {
                const s = items.find(s => s.id === reviewId);
                if (s) {
                    setViewingSeller(s);
                    setPermissions({
                        retailEnabled: s.retailEnabled ?? true,
                        planMyEventEnabled: s.planMyEventEnabled ?? false,
                        categoriesEnabled: s.categoriesEnabled ?? true,
                        bookingSlotsEnabled: s.bookingSlotsEnabled ?? false,
                        productsEnabled: s.productsEnabled ?? true,
                        stockEnabled: s.stockEnabled ?? true,
                        ordersEnabled: s.ordersEnabled ?? true,
                        walletEnabled: s.walletEnabled ?? true,
                        analyticsEnabled: s.analyticsEnabled ?? true,
                        wholesaleEnabled: s.wholesaleEnabled ?? false,
                        allowedRetailCategories: s.allowedRetailCategories || [],
                        allowedWholesaleCategories: s.allowedWholesaleCategories || [],
                        allowedEventCategories: s.allowedEventCategories || [],
                        serviceCategories: s.serviceCategories || [],
                        allowCustomProductEntry: s.allowCustomProductEntry ?? false,
                        liveKitchenEnabled: s.liveKitchenEnabled ?? false,
                        customizationEngineEnabled: s.customizationEngineEnabled ?? false,
                        quoteReferencePhotoUpload: s.quoteReferencePhotoUpload ?? false,
                        quoteThemeSelection: s.quoteThemeSelection ?? false,
                        quoteColorCombination: s.quoteColorCombination ?? false,
                        quoteBudgetSelection: s.quoteBudgetSelection ?? false,
                        quoteCustomerNotes: s.quoteCustomerNotes ?? false,
                        quoteSellerQuotation: s.quoteSellerQuotation ?? false,
                        quoteQuoteRevision: s.quoteQuoteRevision ?? false,
                        quoteCustomerApproval: s.quoteCustomerApproval ?? false,
                        quoteAdvancePayment: s.quoteAdvancePayment ?? false,
                        quoteFinalPayment: s.quoteFinalPayment ?? false,
                        customerImageReviewEnabled: s.customerImageReviewEnabled ?? false,
                        advanceBookingEnabled: s.advanceBookingEnabled ?? false,
                        addonDecorationEnabled: s.addonDecorationEnabled ?? false,
                        addonDecorationPrice: s.addonDecorationPrice ?? 0,
                        addonBridalEnabled: s.addonBridalEnabled ?? false,
                        addonBridalPrice: s.addonBridalPrice ?? 0,
                        addonCateringEnabled: s.addonCateringEnabled ?? false,
                        addonCateringPrice: s.addonCateringPrice ?? 0,
                        physicalPaymentEnabled: s.physicalPaymentEnabled ?? false,
                        paymentQrCode: s.paymentQrCode ?? "",
                        reviewCategoriesEnabled: s.reviewCategoriesEnabled || [],
                    });
                    setAdminRemark(s.adminRemark || '');
                    setAdminTerms(s.adminTerms || '');
                    setAdvancePaymentPercentage(s.advancePaymentPercentage || 0);
                    setIsReviewModalOpen(true);
                } else {
                    setSearchParams({});
                }
            }
        } catch (error) {
            console.error('Failed to fetch pending sellers', error);
            toast.error(error.response?.data?.message || 'Failed to load seller applications');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingSellers();
        const loadCategories = async () => {
            try {
                const res = await adminApi.getCategories();
                if (res.data?.success || res.data) {
                    const payload = res.data?.result;
                    const results = res.data?.results;
                    const allCats = Array.isArray(results)
                        ? results
                        : Array.isArray(payload)
                            ? payload
                            : Array.isArray(payload?.items)
                                ? payload.items
                                : [];
                    setAllCategories(allCats);
                }
                const evCats = await adminEventConfigApi.getEventCategories();
                if (Array.isArray(evCats)) {
                    setEventCategories(evCats);
                }
            } catch (err) {
                console.error("Failed to load categories:", err);
            }
        };
        loadCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stats = useMemo(() => ({
        total: summaryStats.totalApplications,
        today: summaryStats.receivedToday,
        urgent: summaryStats.missingInfo
    }), [summaryStats]);

    const filteredSellers = useMemo(() => {
        return pendingSellers.filter(s =>
            String(s.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(s.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [pendingSellers, searchTerm]);

    const reviewDocuments = useMemo(() => {
        if (!viewingSeller) {
            return [];
        }

        if (Array.isArray(viewingSeller.documentFiles) && viewingSeller.documentFiles.length) {
            return viewingSeller.documentFiles;
        }

        return (viewingSeller.documents || []).map((label, index) => ({
            key: `legacy-${index}`,
            label,
            url: '',
            fileName: label,
            isViewable: false,
            fileType: 'unknown'
        }));
    }, [viewingSeller]);

    const handleApprove = async (id) => {
        setIsProcessing(true);
        try {
            await adminApi.approveSeller(id, { permissions });
            setIsReviewModalOpen(false);
            setSearchParams({});
            setViewingSeller(null);
            toast.success('Seller approved successfully');
            await fetchPendingSellers();
        } catch (error) {
            console.error('Failed to approve seller', error);
            toast.error(error.response?.data?.message || 'Failed to approve seller');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (id) => {
        if (window.confirm('Are you sure you want to reject this application?')) {
            setIsProcessing(true);
            try {
                const reason = window.prompt('Optional rejection reason (leave blank if not needed):') || '';
                await adminApi.rejectSeller(id, { reason });
                setIsReviewModalOpen(false);
                setSearchParams({});
                setViewingSeller(null);
                toast.success('Seller application rejected');
                await fetchPendingSellers();
            } catch (error) {
                console.error('Failed to reject seller', error);
                toast.error(error.response?.data?.message || 'Failed to reject seller');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleBounceBack = async (id) => {
        if (window.confirm('Are you sure you want to bounce back this application for revision?')) {
            setIsProcessing(true);
            try {
                await adminApi.bounceBackSeller(id, {});
                setIsReviewModalOpen(false);
                setSearchParams({});
                setViewingSeller(null);
                toast.success('Seller application bounced back for revision');
                await fetchPendingSellers();
            } catch (error) {
                console.error('Failed to bounce back seller', error);
                toast.error(error.response?.data?.message || 'Failed to bounce back seller');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Pending Approvals
                        <Badge variant="warning" className="admin-tiny px-1.5 py-0 font-bold animate-pulse">Action Required</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">Check new seller applications before they can start selling.</p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl ring-1 ring-amber-100">
                    <HiOutlineClock className="h-4 w-4 text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Avg Review Time: {summaryStats.avgReviewTimeHours}h</span>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Applications', val: stats.total, icon: HiOutlineDocumentText, color: 'text-brand-600', bg: 'bg-brand-50' },
                    { label: 'Received Today', val: stats.today, icon: HiOutlineCalendarDays, color: 'text-brand-600', bg: 'bg-brand-50' },
                    { label: 'Missing Info', val: stats.urgent, icon: HiOutlineXCircle, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="ds-label">{stat.label}</p>
                                <h4 className="ds-stat-medium mt-1">{stat.val}</h4>
                            </div>
                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner", stat.bg, stat.color)}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Content Area */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
                    <div className="relative flex-1 w-full max-w-md">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by shop name or owner..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                        <HiOutlineFunnel className="h-4 w-4" />
                        <span>Filter by Date</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="ds-table-header-cell px-6">Applicant Store</th>
                                <th className="ds-table-header-cell px-6">Documentation</th>
                                <th className="ds-table-header-cell px-6">Applied On</th>
                                <th className="ds-table-header-cell px-6 !text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <HiOutlineArrowPath className="h-8 w-8 text-slate-300 animate-spin" />
                                            <p className="text-slate-500 font-bold text-sm">Loading seller applications...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSellers.length > 0 ? filteredSellers.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-6 py-5 align-middle">
                                        <div
                                            className="flex items-center gap-4 cursor-pointer group/name"
                                            onClick={() => {
                                                setViewingSeller(s);
                                                setPermissions({
                                                    retailEnabled: s.retailEnabled ?? true,
                                                    planMyEventEnabled: s.planMyEventEnabled ?? false,
                                                    productsEnabled: s.productsEnabled ?? true,
                                                    stockEnabled: s.stockEnabled ?? true,
                                                    ordersEnabled: s.ordersEnabled ?? true,
                                                    walletEnabled: s.walletEnabled ?? true,
                                                    analyticsEnabled: s.analyticsEnabled ?? true,
                                                    wholesaleEnabled: s.wholesaleEnabled ?? false,
                                                    allowedRetailCategories: s.allowedRetailCategories || [],
                                                    allowedWholesaleCategories: s.allowedWholesaleCategories || [],
                                                    allowedEventCategories: s.allowedEventCategories || [],
                                                    serviceCategories: s.serviceCategories || [],
                                                    allowCustomProductEntry: s.allowCustomProductEntry ?? false,
                                                    liveKitchenEnabled: s.liveKitchenEnabled ?? false,
                                                    customizationEngineEnabled: s.customizationEngineEnabled ?? false,
                                                    quoteReferencePhotoUpload: s.quoteReferencePhotoUpload ?? false,
                                                    quoteThemeSelection: s.quoteThemeSelection ?? false,
                                                    quoteColorCombination: s.quoteColorCombination ?? false,
                                                    quoteBudgetSelection: s.quoteBudgetSelection ?? false,
                                                    quoteCustomerNotes: s.quoteCustomerNotes ?? false,
                                                    quoteSellerQuotation: s.quoteSellerQuotation ?? false,
                                                    quoteQuoteRevision: s.quoteQuoteRevision ?? false,
                                                    quoteCustomerApproval: s.quoteCustomerApproval ?? false,
                                                    quoteAdvancePayment: s.quoteAdvancePayment ?? false,
                                                    quoteFinalPayment: s.quoteFinalPayment ?? false,
                                                    customerImageReviewEnabled: s.customerImageReviewEnabled ?? false,
                                                    advanceBookingEnabled: s.advanceBookingEnabled ?? false,
                                                    reviewCategoriesEnabled: s.reviewCategoriesEnabled || [],
                                                });
                                                setSearchParams({ review: s.id });
                                                setIsReviewModalOpen(true);
                                            }}
                                        >
                                            <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-100 group-hover:ring-primary/20 transition-all">
                                                <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400">
                                                    <HiOutlineBuildingOffice2 className="h-5 w-5" />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 group-hover/name:text-primary transition-colors">{s.shopName}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{s.ownerName}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {(s.documents || []).map((doc, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[8px] font-bold rounded-full ring-1 ring-brand-100 uppercase">{doc}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex flex-col justify-center">
                                            <span className="text-xs font-bold text-slate-700">{s.applicationDate}</span>
                                            <span className="text-[9px] font-medium text-slate-400">Received {s.receivedAt || 'Recently'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right align-middle">
                                        <div className="flex items-center justify-end gap-3 h-full">
                                            <button
                                                onClick={() => {
                                                    setViewingSeller(s);
                                                    setPermissions({
                                                        retailEnabled: s.retailEnabled ?? true,
                                                        planMyEventEnabled: s.planMyEventEnabled ?? false,
                                                        productsEnabled: s.productsEnabled ?? true,
                                                        stockEnabled: s.stockEnabled ?? true,
                                                        ordersEnabled: s.ordersEnabled ?? true,
                                                        walletEnabled: s.walletEnabled ?? true,
                                                        analyticsEnabled: s.analyticsEnabled ?? true,
                                                        wholesaleEnabled: s.wholesaleEnabled ?? false,
                                                        allowedRetailCategories: s.allowedRetailCategories || [],
                                                        allowedWholesaleCategories: s.allowedWholesaleCategories || [],
                                                        allowedEventCategories: s.allowedEventCategories || [],
                                                        serviceCategories: s.serviceCategories || [],
                                                        allowCustomProductEntry: s.allowCustomProductEntry ?? false,
                                                        liveKitchenEnabled: s.liveKitchenEnabled ?? false,
                                                        customizationEngineEnabled: s.customizationEngineEnabled ?? false,
                                                        quoteReferencePhotoUpload: s.quoteReferencePhotoUpload ?? false,
                                                        quoteThemeSelection: s.quoteThemeSelection ?? false,
                                                        quoteColorCombination: s.quoteColorCombination ?? false,
                                                        quoteBudgetSelection: s.quoteBudgetSelection ?? false,
                                                        quoteCustomerNotes: s.quoteCustomerNotes ?? false,
                                                        quoteSellerQuotation: s.quoteSellerQuotation ?? false,
                                                        quoteQuoteRevision: s.quoteQuoteRevision ?? false,
                                                        quoteCustomerApproval: s.quoteCustomerApproval ?? false,
                                                        quoteAdvancePayment: s.quoteAdvancePayment ?? false,
                                                        quoteFinalPayment: s.quoteFinalPayment ?? false,
                                                        customerImageReviewEnabled: s.customerImageReviewEnabled ?? false,
                                                        advanceBookingEnabled: s.advanceBookingEnabled ?? false,
                                                        addonDecorationEnabled: s.addonDecorationEnabled ?? false,
                                                        addonDecorationPrice: s.addonDecorationPrice ?? 0,
                                                        addonBridalEnabled: s.addonBridalEnabled ?? false,
                                                        addonBridalPrice: s.addonBridalPrice ?? 0,
                                                        addonCateringEnabled: s.addonCateringEnabled ?? false,
                                                        addonCateringPrice: s.addonCateringPrice ?? 0,
                                                        physicalPaymentEnabled: s.physicalPaymentEnabled ?? false,
                                                        paymentQrCode: s.paymentQrCode ?? "",
                                                        reviewCategoriesEnabled: s.reviewCategoriesEnabled || [],
                                                    });
                                                    setAdminRemark(s.adminRemark || '');
                                                    setAdminTerms(s.adminTerms || '');
                                                    setAdvancePaymentPercentage(s.advancePaymentPercentage || 0);
                                                    setSearchParams({ review: s.id });
                                                    setIsReviewModalOpen(true);
                                                }}
                                                className="h-9 px-4 bg-black  text-primary-foreground rounded-xl text-[10px] font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-100 hover:-translate-y-0.5 flex items-center gap-2"
                                            >
                                                <HiOutlineEye className="h-4 w-4" />
                                                REVIEW
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                <HiOutlineCheckCircle className="h-8 w-8 text-slate-200" />
                                            </div>
                                            <p className="text-slate-500 font-bold text-sm">All caught up! No pending applications.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Review Modal */}
            <AnimatePresence>
                {isReviewModalOpen && viewingSeller && (
                    <div className="fixed inset-0 z-[999] overflow-y-auto">
                        <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
                            <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="fixed inset-0 bg-slate-900/80 backdrop-blur-md"
                                  onClick={() => {
                                      setIsReviewModalOpen(false);
                                      setSearchParams({});
                                  }}
                            />
  
                            <motion.div
                                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                  className="w-full max-w-4xl relative z-10 bg-white rounded-none sm:rounded-2xl shadow-2xl overflow-y-auto h-screen sm:h-auto sm:max-h-[95vh]"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-12">
                                    {/* Sidebar Info */}
                                    <div className="lg:col-span-4 bg-slate-50 p-4 border-r border-slate-100">
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="h-20 w-20 rounded-xl bg-white shadow-xl flex items-center justify-center ds-stat-large font-bold text-primary border-4 border-white">
                                                {(viewingSeller.shopName || 'S').charAt(0)}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setIsReviewModalOpen(false);
                                                    setSearchParams({});
                                                }}
                                                className="lg:hidden p-2 hover:bg-slate-200 rounded-full"
                                            >
                                                <HiOutlineXMark className="h-5 w-5" />
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="ds-h2 leading-tight">{viewingSeller.shopName}</h3>
                                                <p className="text-xs font-bold text-primary mt-1 uppercase tracking-widest">{viewingSeller.category || 'General'} PARTNER</p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineBuildingOffice2 className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-700">{viewingSeller.ownerName}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500">{viewingSeller.email}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-700">{viewingSeller.phone}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <HiOutlineMapPin className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-500">{viewingSeller.location}</span>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-slate-200 space-y-3">
                                                <div>
                                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Shop Category & Products</h4>
                                                    <p className="text-xs font-semibold text-slate-700">Category: <span className="font-normal text-slate-600">{viewingSeller.category || 'Not specified'}</span></p>
                                                    <p className="text-xs font-semibold text-slate-700 mt-1">Main Products: <span className="font-normal text-slate-600">{viewingSeller.mainProducts || 'Not specified'}</span></p>
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Application Memo</h4>
                                                    <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
                                                        "{viewingSeller.description}"
                                                    </p>
                                                </div>
                                            </div>



                                        </div>
                                    </div>

                                    {/* Main Review Section */}
                                    <div className="lg:col-span-8 p-4 lg:p-5 bg-white relative">
                                        <button
                                            onClick={() => {
                                                setIsReviewModalOpen(false);
                                                setSearchParams({});
                                            }}
                                            className="hidden lg:block absolute right-8 top-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                                        >
                                            <HiOutlineXMark className="h-6 w-6 text-slate-300" />
                                        </button>

                                        <div className="ds-section-spacing">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <HiOutlineDocumentText className="h-5 w-5 text-brand-500" />
                                                    <h4 className="text-sm font-bold text-slate-900">Submitted Verification Documents</h4>
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium">Check each document before final approval.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {reviewDocuments.length > 0 ? reviewDocuments.map((doc) => (
                                                    <div
                                                        key={doc.key}
                                                        className={`p-4 rounded-2xl border-2 transition-all group ${doc.isViewable
                                                            ? 'border-slate-50 bg-slate-50/50 hover:bg-white hover:border-brand-100'
                                                            : 'border-slate-100 bg-slate-50/70'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-110 transition-transform">
                                                                    <HiOutlineDocumentText className="h-5 w-5 text-brand-400" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-slate-700">{doc.label}</p>
                                                                    <p className={`text-[9px] font-bold uppercase tracking-tighter truncate ${doc.isViewable ? 'text-brand-500' : 'text-amber-500'
                                                                        }`}>
                                                                        {doc.isViewable
                                                                            ? doc.fileType === 'pdf'
                                                                                ? 'SECURE PDF'
                                                                                : 'SECURE IMAGE'
                                                                            : 'FILE LINK NOT AVAILABLE'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {doc.isViewable ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => window.open(getNormalizedDocUrl(doc.url), '_blank', 'noopener,noreferrer')}
                                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors shrink-0"
                                                                >
                                                                    <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5" />
                                                                    <span>View</span>
                                                                </button>
                                                            ) : (
                                                                <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                                                    <HiOutlineXMark className="h-3.5 w-3.5" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                                                        <p className="text-sm font-bold text-slate-500">No documents were submitted with this application.</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-amber-50 rounded-xl p-6 border border-amber-100/50">
                                                <div className="flex gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                                                        <HiOutlineCheckCircle className="h-6 w-6 text-amber-700" />
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-bold text-amber-900">Initial Review Passed</h5>
                                                        <p className="text-[10px] text-amber-700/80 font-medium mt-1 leading-relaxed">
                                                            Our system automatically checked all basic identity and shop locations. You need to check documents manually now.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Permissions Toggles */}
                                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mt-4">
                                                <div className="flex flex-col gap-1 mb-4 border-b border-slate-200 pb-3">
                                                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Module Access Permissions</h5>
                                                    <p className="text-[10px] text-slate-500 font-medium">Enable or disable specific features for this seller before approval.</p>
                                                </div>
                                                {/* Row 1: 2-column Layout (Retail Store, Plan My Event, Wholesale) */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pb-4 border-b border-dashed border-slate-200/80">
                                                    <PermissionToggle
                                                        label="Retail Store (Master)"
                                                        description="Main toggle for retail store access"
                                                        checked={permissions.retailEnabled}
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, retailEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { retailEnabled: checked });
                                                                toast.success('Retail master permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, retailEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update retail master permission');
                                                                setPermissions(prev => ({ ...prev, retailEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Wholesale Marketplace"
                                                        description="Allow selling in wholesale marketplace"
                                                        checked={permissions.wholesaleEnabled}
                                                        activeColor="bg-amber-600" hoverColor="group-hover:text-amber-700"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, wholesaleEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { wholesaleEnabled: checked });
                                                                toast.success('Wholesale marketplace permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, wholesaleEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update wholesale permission');
                                                                setPermissions(prev => ({ ...prev, wholesaleEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Plan My Event"
                                                        description="Allow event service bookings"
                                                        checked={permissions.planMyEventEnabled}
                                                        activeColor="bg-violet-500" hoverColor="group-hover:text-violet-600"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, planMyEventEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { planMyEventEnabled: checked });
                                                                toast.success('Plan my event permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, planMyEventEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update plan my event permission');
                                                                setPermissions(prev => ({ ...prev, planMyEventEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Brands & Ingredients"
                                                        description="Allow manual entry of product name, brand, and ingredients"
                                                        checked={permissions.allowCustomProductEntry}
                                                        activeColor="bg-emerald-500" hoverColor="group-hover:text-emerald-600"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, allowCustomProductEntry: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { allowCustomProductEntry: checked });
                                                                toast.success('Custom product entry permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, allowCustomProductEntry: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update custom product entry permission');
                                                                setPermissions(prev => ({ ...prev, allowCustomProductEntry: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Live"
                                                        description="Allow live streaming/camera updates from seller kitchen"
                                                        checked={permissions.liveKitchenEnabled}
                                                        activeColor="bg-rose-500" hoverColor="group-hover:text-rose-600"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, liveKitchenEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { liveKitchenEnabled: checked });
                                                                toast.success('Live kitchen permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, liveKitchenEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update live kitchen permission');
                                                                setPermissions(prev => ({ ...prev, liveKitchenEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Customization & Quotation Engine"
                                                        description="Master toggle to allow customizations and direct quotations"
                                                        checked={permissions.customizationEngineEnabled}
                                                        activeColor="bg-indigo-600" hoverColor="group-hover:text-indigo-700"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, customizationEngineEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { customizationEngineEnabled: checked });
                                                                toast.success('Customization engine permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, customizationEngineEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update customization engine permission');
                                                                setPermissions(prev => ({ ...prev, customizationEngineEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Customer Image Review"
                                                        description="Allow seller to review categorized customer uploads"
                                                        checked={permissions.customerImageReviewEnabled}
                                                        activeColor="bg-fuchsia-600" hoverColor="group-hover:text-fuchsia-700"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, customerImageReviewEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { customerImageReviewEnabled: checked });
                                                                toast.success('Customer image review permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, customerImageReviewEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update customer image review permission');
                                                                setPermissions(prev => ({ ...prev, customerImageReviewEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Advance Booking System"
                                                        description="Allow seller to manage advance bookings and status"
                                                        checked={permissions.advanceBookingEnabled}
                                                        activeColor="bg-teal-600" hoverColor="group-hover:text-teal-700"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, advanceBookingEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { advanceBookingEnabled: checked });
                                                                toast.success('Advance booking permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, advanceBookingEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update advance booking permission');
                                                                setPermissions(prev => ({ ...prev, advanceBookingEnabled: !checked }));
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                {/* Customization & Quotation Engine Sub-Permissions */}
                                                {permissions.customizationEngineEnabled && (
                                                    <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                        <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Customization & Quotation Engine Settings</h6>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                            <PermissionToggle
                                                                label="Reference Photo Upload"
                                                                description="Allow upload of reference photos"
                                                                checked={permissions.quoteReferencePhotoUpload}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteReferencePhotoUpload: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteReferencePhotoUpload: checked });
                                                                        toast.success('Reference photo upload permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteReferencePhotoUpload: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteReferencePhotoUpload: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                label="Theme Selection"
                                                                description="Allow selecting themes"
                                                                checked={permissions.quoteThemeSelection}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteThemeSelection: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteThemeSelection: checked });
                                                                        toast.success('Theme selection permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteThemeSelection: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteThemeSelection: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                label="Color Combination"
                                                                description="Allow selecting color combinations"
                                                                checked={permissions.quoteColorCombination}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteColorCombination: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteColorCombination: checked });
                                                                        toast.success('Color combination permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteColorCombination: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteColorCombination: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                label="Budget Selection"
                                                                description="Allow selecting budget options"
                                                                checked={permissions.quoteBudgetSelection}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteBudgetSelection: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteBudgetSelection: checked });
                                                                        toast.success('Budget selection permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteBudgetSelection: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteBudgetSelection: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                label="Customer Notes"
                                                                description="Allow customer notes/instructions"
                                                                checked={permissions.quoteCustomerNotes}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"

                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteCustomerNotes: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteCustomerNotes: checked });
                                                                        toast.success('Customer notes permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteCustomerNotes: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteCustomerNotes: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                label="Seller Quotation"
                                                                description="Allow seller to send quotations"
                                                                checked={permissions.quoteSellerQuotation}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteSellerQuotation: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteSellerQuotation: checked });
                                                                        toast.success('Seller quotation permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteSellerQuotation: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteSellerQuotation: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                label="Quote Revision"
                                                                description="Allow revisions to quotation"
                                                                checked={permissions.quoteQuoteRevision}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteQuoteRevision: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteQuoteRevision: checked });
                                                                        toast.success('Quote revision permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteQuoteRevision: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteQuoteRevision: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                label="Customer Approval"
                                                                description="Allow customer approval step"
                                                                checked={permissions.quoteCustomerApproval}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteCustomerApproval: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteCustomerApproval: checked });
                                                                        toast.success('Customer approval permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteCustomerApproval: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteCustomerApproval: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                            <PermissionToggle
                                                                 label="Advance Payment"
                                                                 description="Allow advance payment step"
                                                                 checked={permissions.quoteAdvancePayment}
                                                                 activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                 onChange={async (e) => {
                                                                     const checked = e.target.checked;
                                                                     setPermissions(prev => ({ ...prev, quoteAdvancePayment: checked }));
                                                                     try {
                                                                         await adminApi.updateSeller(viewingSeller.id, { quoteAdvancePayment: checked });
                                                                         toast.success('Advance payment permission updated');
                                                                         setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteAdvancePayment: checked } : seller));
                                                                     } catch (err) {
                                                                         setPermissions(prev => ({ ...prev, quoteAdvancePayment: !checked }));
                                                                     }
                                                                 }}
                                                             />
                                                            <PermissionToggle
                                                                label="Final Payment"
                                                                description="Allow final payment step"
                                                                checked={permissions.quoteFinalPayment}
                                                                activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                                onChange={async (e) => {
                                                                    const checked = e.target.checked;
                                                                    setPermissions(prev => ({ ...prev, quoteFinalPayment: checked }));
                                                                    try {
                                                                        await adminApi.updateSeller(viewingSeller.id, { quoteFinalPayment: checked });
                                                                        toast.success('Final payment permission updated');
                                                                        setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, quoteFinalPayment: checked } : seller));
                                                                    } catch (err) {
                                                                        setPermissions(prev => ({ ...prev, quoteFinalPayment: !checked }));
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Optional Add-on Services Section */}
                                                <div className="flex flex-col gap-1 mt-6 mb-4 border-t border-slate-200 pt-4 pb-1">
                                                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Optional Add-on Services</h5>
                                                    <p className="text-[10px] text-slate-500 font-medium">Enable add-ons for event booking and configure their prices.</p>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4 pb-4 border-b border-dashed border-slate-200/80 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    {/* Decoration Add-on */}
                                                    <div className="space-y-2">
                                                        <PermissionToggle
                                                            label="Decoration Add-on"
                                                            description="Enable decoration service options for booking"
                                                            checked={permissions.addonDecorationEnabled}
                                                            activeColor="bg-fuchsia-500" hoverColor="group-hover:text-fuchsia-600"
                                                            onChange={async (e) => {
                                                                const checked = e.target.checked;
                                                                setPermissions(prev => ({ ...prev, addonDecorationEnabled: checked }));
                                                                try {
                                                                    await adminApi.updateSeller(viewingSeller.id, { addonDecorationEnabled: checked });
                                                                    toast.success('Decoration add-on status updated');
                                                                    setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, addonDecorationEnabled: checked } : seller));
                                                                } catch (err) {
                                                                    toast.error('Failed to update decoration add-on');
                                                                    setPermissions(prev => ({ ...prev, addonDecorationEnabled: !checked }));
                                                                }
                                                            }}
                                                        />
                                                        {permissions.addonDecorationEnabled && (
                                                            <div className="flex items-center gap-2 pl-12">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Enter price"
                                                                    value={permissions.addonDecorationPrice}
                                                                    onChange={(e) => setPermissions(prev => ({ ...prev, addonDecorationPrice: e.target.value }))}
                                                                    onBlur={async () => {
                                                                        try {
                                                                            await adminApi.updateSeller(viewingSeller.id, { addonDecorationPrice: Number(permissions.addonDecorationPrice) });
                                                                            toast.success('Decoration price updated');
                                                                        } catch (err) {
                                                                            toast.error('Failed to update decoration price');
                                                                        }
                                                                    }}
                                                                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-fuchsia-500"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bridal Add-on */}
                                                    <div className="space-y-2">
                                                        <PermissionToggle
                                                            label="Bridal Add-on"
                                                            description="Enable bridal package options for booking"
                                                            checked={permissions.addonBridalEnabled}
                                                            activeColor="bg-pink-500" hoverColor="group-hover:text-pink-600"
                                                            onChange={async (e) => {
                                                                const checked = e.target.checked;
                                                                setPermissions(prev => ({ ...prev, addonBridalEnabled: checked }));
                                                                try {
                                                                    await adminApi.updateSeller(viewingSeller.id, { addonBridalEnabled: checked });
                                                                    toast.success('Bridal add-on status updated');
                                                                    setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, addonBridalEnabled: checked } : seller));
                                                                } catch (err) {
                                                                    toast.error('Failed to update bridal add-on');
                                                                    setPermissions(prev => ({ ...prev, addonBridalEnabled: !checked }));
                                                                }
                                                            }}
                                                        />
                                                        {permissions.addonBridalEnabled && (
                                                            <div className="flex items-center gap-2 pl-12">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Enter price"
                                                                    value={permissions.addonBridalPrice}
                                                                    onChange={(e) => setPermissions(prev => ({ ...prev, addonBridalPrice: e.target.value }))}
                                                                    onBlur={async () => {
                                                                        try {
                                                                            await adminApi.updateSeller(viewingSeller.id, { addonBridalPrice: Number(permissions.addonBridalPrice) });
                                                                            toast.success('Bridal price updated');
                                                                        } catch (err) {
                                                                            toast.error('Failed to update bridal price');
                                                                        }
                                                                    }}
                                                                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Catering Add-on */}
                                                    <div className="space-y-2">
                                                        <PermissionToggle
                                                            label="Catering Add-on"
                                                            description="Enable catering services for booking"
                                                            checked={permissions.addonCateringEnabled}
                                                            activeColor="bg-amber-500" hoverColor="group-hover:text-amber-600"
                                                            onChange={async (e) => {
                                                                const checked = e.target.checked;
                                                                setPermissions(prev => ({ ...prev, addonCateringEnabled: checked }));
                                                                try {
                                                                    await adminApi.updateSeller(viewingSeller.id, { addonCateringEnabled: checked });
                                                                    toast.success('Catering add-on status updated');
                                                                    setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, addonCateringEnabled: checked } : seller));
                                                                } catch (err) {
                                                                    toast.error('Failed to update catering add-on');
                                                                    setPermissions(prev => ({ ...prev, addonCateringEnabled: !checked }));
                                                                }
                                                            }}
                                                        />
                                                        {permissions.addonCateringEnabled && (
                                                            <div className="flex items-center gap-2 pl-12">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Price:</span>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Enter price"
                                                                    value={permissions.addonCateringPrice}
                                                                    onChange={(e) => setPermissions(prev => ({ ...prev, addonCateringPrice: e.target.value }))}
                                                                    onBlur={async () => {
                                                                        try {
                                                                            await adminApi.updateSeller(viewingSeller.id, { addonCateringPrice: Number(permissions.addonCateringPrice) });
                                                                            toast.success('Catering price updated');
                                                                        } catch (err) {
                                                                            toast.error('Failed to update catering price');
                                                                        }
                                                                    }}
                                                                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Physical Payment Settings */}
                                                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mt-4">
                                                    <div className="flex flex-col gap-1 mb-4 border-b border-slate-200 pb-3">
                                                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Physical Payment Options</h5>
                                                        <p className="text-[10px] text-slate-500 font-medium">Configure if this seller supports physical/QR code payments.</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <PermissionToggle
                                                            label="Physical Payment Enabled"
                                                            description="Allow customers to pay physically or via QR code"
                                                            checked={permissions.physicalPaymentEnabled}
                                                            activeColor="bg-emerald-600" hoverColor="group-hover:text-emerald-700"
                                                            onChange={async (e) => {
                                                                const checked = e.target.checked;
                                                                setPermissions(prev => ({ ...prev, physicalPaymentEnabled: checked }));
                                                                try {
                                                                    await adminApi.updateSeller(viewingSeller.id, { physicalPaymentEnabled: checked });
                                                                    toast.success('Physical payment status updated');
                                                                    setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, physicalPaymentEnabled: checked } : seller));
                                                                } catch (err) {
                                                                    toast.error('Failed to update physical payment status');
                                                                    setPermissions(prev => ({ ...prev, physicalPaymentEnabled: !checked }));
                                                                }
                                                            }}
                                                        />

                                                        {permissions.physicalPaymentEnabled && (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase block">Payment QR Code / Barcode Link:</label>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Enter QR Code image URL"
                                                                        value={permissions.paymentQrCode}
                                                                        onChange={(e) => setPermissions(prev => ({ ...prev, paymentQrCode: e.target.value }))}
                                                                        onBlur={async () => {
                                                                            try {
                                                                                await adminApi.updateSeller(viewingSeller.id, { paymentQrCode: permissions.paymentQrCode });
                                                                                toast.success('QR Code link updated');
                                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, paymentQrCode: permissions.paymentQrCode } : seller));
                                                                            } catch (err) {
                                                                                toast.error('Failed to update QR Code link');
                                                                            }
                                                                        }}
                                                                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                                                                    />
                                                                </div>
                                                                {permissions.paymentQrCode && (
                                                                    <div className="mt-2 border border-slate-200 rounded-xl p-2 bg-white inline-block">
                                                                        <img src={permissions.paymentQrCode} alt="QR Preview" className="h-24 w-24 object-contain" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>


                                                {/* Row 1.5: Dynamic Categories selection when Retail/Wholesale/Events are enabled */}
                                                {(permissions.retailEnabled || permissions.wholesaleEnabled || permissions.planMyEventEnabled) && (
                                                    <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-dashed border-slate-200/80">
                                                        {permissions.retailEnabled && (
                                                            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                                                                <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Allowed Retail Categories</h6>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                                                                    {allCategories.filter(cat => cat.type === 'category' || cat.type === 'header').map(cat => {
                                                                        const isChecked = (permissions.allowedRetailCategories || []).includes(cat._id);
                                                                        return (
                                                                            <label key={cat._id} className={cn(
                                                                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                                                isChecked
                                                                                    ? "border-primary/20 bg-brand-50/30 text-slate-900"
                                                                                    : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                                                                            )}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={async (e) => {
                                                                                        const checked = e.target.checked;
                                                                                        const current = permissions.allowedRetailCategories || [];
                                                                                        const next = checked ? [...current, cat._id] : current.filter(id => id !== cat._id);
                                                                                        setPermissions(prev => ({ ...prev, allowedRetailCategories: next }));
                                                                                        try {
                                                                                            await adminApi.updateSeller(viewingSeller.id, { allowedRetailCategories: next });
                                                                                            toast.success(`${cat.name} updated in Retail Categories`);
                                                                                        } catch (err) {
                                                                                            toast.error('Failed to update categories');
                                                                                        }
                                                                                    }}
                                                                                    className="rounded text-primary focus:ring-primary/20 h-4.5 w-4.5"
                                                                                />
                                                                                <span>{cat.name}</span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {permissions.wholesaleEnabled && (
                                                            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                                                                <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Allowed Wholesale Categories</h6>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                                                                    {allCategories.filter(cat => cat.type === 'category' || cat.type === 'header').map(cat => {
                                                                        const isChecked = (permissions.allowedWholesaleCategories || []).includes(cat._id);
                                                                        return (
                                                                            <label key={cat._id} className={cn(
                                                                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                                                isChecked
                                                                                    ? "border-amber-600/20 bg-amber-50/30 text-slate-900"
                                                                                    : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                                                                            )}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={async (e) => {
                                                                                        const checked = e.target.checked;
                                                                                        const current = permissions.allowedWholesaleCategories || [];
                                                                                        const next = checked ? [...current, cat._id] : current.filter(id => id !== cat._id);
                                                                                        setPermissions(prev => ({ ...prev, allowedWholesaleCategories: next }));
                                                                                        try {
                                                                                            await adminApi.updateSeller(viewingSeller.id, { allowedWholesaleCategories: next });
                                                                                            toast.success(`${cat.name} updated in Wholesale Categories`);
                                                                                        } catch (err) {
                                                                                            toast.error('Failed to update categories');
                                                                                        }
                                                                                    }}
                                                                                    className="rounded text-amber-600 focus:ring-amber-600/20 h-4.5 w-4.5"
                                                                                />
                                                                                <span>{cat.name}</span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {permissions.planMyEventEnabled && (
                                                            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col gap-4">
                                                                <div>
                                                                    <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Allowed Plan My Event Categories (Standard)</h6>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                                                                        {allCategories.filter(cat => (cat.type === 'category' || cat.type === 'header') && (cat.applicableModules || []).includes('plan_my_event')).map(cat => {
                                                                            const isChecked = (permissions.allowedEventCategories || []).includes(cat._id);
                                                                            return (
                                                                                <label key={cat._id} className={cn(
                                                                                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                                                    isChecked
                                                                                        ? "border-purple-600/20 bg-purple-50/30 text-slate-900"
                                                                                        : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                                                                                )}>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={async (e) => {
                                                                                            const checked = e.target.checked;
                                                                                            const current = permissions.allowedEventCategories || [];
                                                                                            const next = checked ? [...current, cat._id] : current.filter(id => id !== cat._id);
                                                                                            setPermissions(prev => ({ ...prev, allowedEventCategories: next }));
                                                                                            try {
                                                                                                await adminApi.updateSeller(viewingSeller.id, { allowedEventCategories: next });
                                                                                                toast.success(`${cat.name} updated in Event Categories`);
                                                                                            } catch (err) {
                                                                                                toast.error('Failed to update categories');
                                                                                            }
                                                                                        }}
                                                                                        className="rounded text-purple-600 focus:ring-purple-600/20 h-4.5 w-4.5"
                                                                                    />
                                                                                    <span>{cat.name}</span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Allowed Event Service Categories (Event Commerce)</h6>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                                                                        {eventCategories.map(cat => {
                                                                            const isChecked = (permissions.serviceCategories || []).includes(cat._id);
                                                                            return (
                                                                                <label key={cat._id} className={cn(
                                                                                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                                                    isChecked
                                                                                        ? "border-purple-600/20 bg-purple-50/30 text-slate-900"
                                                                                        : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                                                                                )}>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={async (e) => {
                                                                                            const checked = e.target.checked;
                                                                                            const current = permissions.serviceCategories || [];
                                                                                            const next = checked ? [...current, cat._id] : current.filter(id => id !== cat._id);
                                                                                            setPermissions(prev => ({ ...prev, serviceCategories: next }));
                                                                                            try {
                                                                                                await adminApi.updateSeller(viewingSeller.id, { serviceCategories: next });
                                                                                                toast.success(`${cat.name} updated in Event Service Categories`);
                                                                                            } catch (err) {
                                                                                                toast.error('Failed to update service categories');
                                                                                            }
                                                                                        }}
                                                                                        className="rounded text-purple-600 focus:ring-purple-600/20 h-4.5 w-4.5"
                                                                                    />
                                                                                    <span>{cat.name}</span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">




                                                    <PermissionToggle
                                                        label="Booking & Slots Management"
                                                        description="Allow managing booking slots for products/services"
                                                        checked={permissions.bookingSlotsEnabled}
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, bookingSlotsEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { bookingSlotsEnabled: checked });
                                                                toast.success('Booking Slots permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, bookingSlotsEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update booking slots permission');
                                                                setPermissions(prev => ({ ...prev, bookingSlotsEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Products & Catalog"
                                                        description="Allow adding and managing products"
                                                        checked={permissions.productsEnabled}
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, productsEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { productsEnabled: checked });
                                                                toast.success('Products permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, productsEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update products permission');
                                                                setPermissions(prev => ({ ...prev, productsEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Stock & Inventory"
                                                        description="Allow managing product inventory"
                                                        checked={permissions.stockEnabled}
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, stockEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { stockEnabled: checked });
                                                                toast.success('Stock permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, stockEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update stock permission');
                                                                setPermissions(prev => ({ ...prev, stockEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Orders & Returns"
                                                        description="Allow viewing and managing orders"
                                                        checked={permissions.ordersEnabled}
                                                        activeColor="bg-blue-500" hoverColor="group-hover:text-blue-600"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, ordersEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { ordersEnabled: checked });
                                                                toast.success('Orders permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, ordersEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update orders permission');
                                                                setPermissions(prev => ({ ...prev, ordersEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Wallet & Earnings"
                                                        description="Allow access to payouts and earnings"
                                                        checked={permissions.walletEnabled}
                                                        activeColor="bg-amber-500" hoverColor="group-hover:text-amber-600"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, walletEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { walletEnabled: checked });
                                                                toast.success('Wallet permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, walletEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update wallet permission');
                                                                setPermissions(prev => ({ ...prev, walletEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                    <PermissionToggle
                                                        label="Analytics & Reports"
                                                        description="Allow viewing sales analytics"
                                                        checked={permissions.analyticsEnabled}
                                                        activeColor="bg-indigo-500" hoverColor="group-hover:text-indigo-600"
                                                        onChange={async (e) => {
                                                            const checked = e.target.checked;
                                                            setPermissions(prev => ({ ...prev, analyticsEnabled: checked }));
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { analyticsEnabled: checked });
                                                                toast.success('Analytics permission updated');
                                                                setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, analyticsEnabled: checked } : seller));
                                                            } catch (err) {
                                                                toast.error('Failed to update analytics permission');
                                                                setPermissions(prev => ({ ...prev, analyticsEnabled: !checked }));
                                                            }
                                                        }}
                                                    />

                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mt-4">
                                                <div className="flex flex-col gap-1 mb-4 border-b border-slate-200 pb-3">
                                                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Seller Review Settings (Category-wise ON/OFF)</h5>
                                                    <p className="text-[10px] text-slate-500 font-medium">Select categories for which customer reviews are enabled for this seller.</p>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                                                    {allCategories.map(cat => {
                                                        const isChecked = (permissions.reviewCategoriesEnabled || []).includes(cat._id);
                                                        return (
                                                            <label key={cat._id} className={cn(
                                                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs font-bold transition-all",
                                                                isChecked
                                                                    ? "border-emerald-600/20 bg-emerald-50/30 text-slate-900"
                                                                    : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                                                            )}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={async (e) => {
                                                                        const checked = e.target.checked;
                                                                        const current = permissions.reviewCategoriesEnabled || [];
                                                                        const next = checked ? [...current, cat._id] : current.filter(id => id !== cat._id);
                                                                        setPermissions(prev => ({ ...prev, reviewCategoriesEnabled: next }));
                                                                        try {
                                                                            await adminApi.updateSeller(viewingSeller.id, { reviewCategoriesEnabled: next });
                                                                            toast.success(`Reviews for ${cat.name} updated successfully`);
                                                                            setPendingSellers(prev => prev.map(seller => seller.id === viewingSeller.id ? { ...seller, reviewCategoriesEnabled: next } : seller));
                                                                        } catch (err) {
                                                                            toast.error('Failed to update review categories');
                                                                            setPermissions(prev => ({ ...prev, reviewCategoriesEnabled: current }));
                                                                        }
                                                                    }}
                                                                    className="rounded text-emerald-600 focus:ring-emerald-600/20 h-4.5 w-4.5"
                                                                />
                                                                <span>{cat.name}</span>
                                                                {isChecked && <span className="ml-auto text-[9px] font-bold text-emerald-600 uppercase bg-emerald-100 px-1.5 py-0.5 rounded">ON</span>}
                                                                {!isChecked && <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">OFF</span>}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Admin Remarks Section */}
                                            <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 mt-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider">📋 Admin Remarks & Terms</h5>
                                                        <p className="text-[10px] text-amber-700/80 font-medium mt-0.5">This note will be visible to the seller in their profile &amp; application page.</p>
                                                    </div>
                                                    <button
                                                        disabled={isSavingRemark}
                                                        onClick={async () => {
                                                            setIsSavingRemark(true);
                                                            try {
                                                                await adminApi.updateSeller(viewingSeller.id, { adminRemark, adminTerms });
                                                                toast.success('Remarks & Terms saved successfully');
                                                                setPendingSellers(prev => prev.map(seller =>
                                                                    seller.id === viewingSeller.id ? { ...seller, adminRemark, adminTerms } : seller
                                                                ));
                                                            } catch (err) {
                                                                toast.error('Failed to save remarks & terms');
                                                            } finally {
                                                                setIsSavingRemark(false);
                                                            }
                                                        }}
                                                        className="ml-3 shrink-0 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                                                    >
                                                        {isSavingRemark ? 'Saving...' : 'Save Notes'}
                                                    </button>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-[11px] font-bold text-amber-900 mb-1 block uppercase">Admin Remarks (Internal/Seller Notes)</label>
                                                        <textarea
                                                            value={adminRemark}
                                                            onChange={e => setAdminRemark(e.target.value)}
                                                            placeholder="Write any instructions or notes for this seller..."
                                                            rows={3}
                                                            className="w-full text-xs font-medium text-amber-900 bg-white/80 border border-amber-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-amber-300 resize-none placeholder:text-amber-400/70 leading-relaxed"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-bold text-amber-900 mb-1 block uppercase">Terms & Conditions</label>
                                                        <textarea
                                                            value={adminTerms}
                                                            onChange={e => setAdminTerms(e.target.value)}
                                                            placeholder="Write any terms and conditions (e.g. 'Please ensure GST documents are updated within 7 days of approval.')..."
                                                            rows={3}
                                                            className="w-full text-xs font-medium text-amber-900 bg-white/80 border border-amber-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-amber-300 resize-none placeholder:text-amber-400/70 leading-relaxed"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Bar */}
                                            <div className="flex items-center gap-4 pt-6">
                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() => handleReject(viewingSeller.id)}
                                                    className="flex-1 py-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-2xl text-[10px] font-bold tracking-widest transition-all uppercase"
                                                >
                                                    REJECT
                                                </button>
                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() => handleBounceBack(viewingSeller.id)}
                                                    className="flex-1 py-4 bg-slate-100 hover:bg-amber-50 hover:text-amber-600 text-slate-600 rounded-2xl text-[10px] font-bold tracking-widest transition-all uppercase"
                                                >
                                                    BOUNCE BACK
                                                </button>
                                                <button
                                                    disabled={isProcessing}
                                                    onClick={() => handleApprove(viewingSeller.id)}
                                                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-bold tracking-widest shadow-2xl hover:bg-slate-800 transition-all transform active:scale-[0.98] uppercase flex items-center justify-center gap-2"
                                                >
                                                    {isProcessing ? (
                                                        <>
                                                            <HiOutlineArrowPath className="h-4 w-4 animate-spin" />
                                                            <span>FINALIZING...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <HiOutlineCheckCircle className="h-4 w-4" />
                                                            <span>APPROVE SELLER</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PendingSellers;
