import React, { useState, useEffect } from 'react';
import { sellerApi } from '../services/sellerApi';
import { Check, Info, Film, HardDrive, AlertCircle, X, CreditCard, Truck } from 'lucide-react';
import { toast } from 'sonner';

const CYCLES = [
    { key: 'monthly', label: 'Monthly', days: 30, priceKey: 'monthlyPrice' },
    { key: 'quarterly', label: 'Quarterly', days: 90, priceKey: 'quarterlyPrice', badge: 'Save 10%' },
    { key: 'yearly', label: 'Yearly', days: 365, priceKey: 'yearlyPrice', badge: 'Best Value' },
];

const VideoSubscriptions = () => {
    const [plans, setPlans] = useState([]);
    const [sellerSubscription, setSellerSubscription] = useState(null);
    const [usedStorageMB, setUsedStorageMB] = useState(0);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [billingCycle, setBillingCycle] = useState('monthly');

    // Payment modal state
    const [payModal, setPayModal] = useState(null); // { plan, cycle, amount }
    const [codSuccess, setCodSuccess] = useState(false);

    useEffect(() => { fetchPlans(); }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const response = await sellerApi.getVideoPlans();
            if (response.data.success) {
                setPlans(response.data.plans);
                setSellerSubscription(response.data.sellerSubscription);
                setUsedStorageMB(response.data.usedVideoStorageMB || 0);
            }
        } catch (error) {
            toast.error('Failed to load subscription plans');
        } finally {
            setLoading(false);
        }
    };

    const openPayModal = (plan) => {
        const priceKey = CYCLES.find(c => c.key === billingCycle)?.priceKey;
        const amount = plan[priceKey] || 0;
        setPayModal({ plan, cycle: billingCycle, amount });
    };

    const handleCOD = async () => {
        if (!payModal) return;
        setProcessing(true);
        try {
            const res = await sellerApi.subscribeVideoPlan({
                planId: payModal.plan._id,
                billingCycle: payModal.cycle,
                paymentMethod: 'COD',
            });
            if (res.data.success) {
                setCodSuccess(true);
                fetchPlans();
                setTimeout(() => {
                    setCodSuccess(false);
                    setPayModal(null);
                }, 3000);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit COD request');
        } finally {
            setProcessing(false);
        }
    };

    const handleRazorpay = async () => {
        if (!payModal) return;
        setProcessing(true);
        try {
            // Step 1: Create Razorpay order
            const orderRes = await sellerApi.createSubscriptionOrder({
                planId: payModal.plan._id,
                billingCycle: payModal.cycle,
            });

            if (orderRes.data.isFree) {
                // Free plan - subscribe directly
                await sellerApi.subscribeVideoPlan({
                    planId: payModal.plan._id,
                    billingCycle: payModal.cycle,
                    paymentMethod: 'Razorpay',
                });
                toast.success('Plan activated!');
                setPayModal(null);
                fetchPlans();
                setProcessing(false);
                return;
            }

            const order = orderRes.data.order;

            // Step 2: Open Razorpay checkout
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: 'Jalapino',
                description: `${payModal.plan.name} - ${payModal.cycle}`,
                order_id: order.id,
                handler: async (response) => {
                    try {
                        // Step 3: Verify and activate subscription
                        const verifyRes = await sellerApi.subscribeVideoPlan({
                            planId: payModal.plan._id,
                            billingCycle: payModal.cycle,
                            paymentMethod: 'Razorpay',
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        if (verifyRes.data.success) {
                            toast.success('Payment successful! Plan activated.');
                            setPayModal(null);
                            fetchPlans();
                        }
                    } catch {
                        toast.error('Payment verification failed. Contact support.');
                    }
                },
                prefill: {},
                theme: { color: '#E11D48' },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Payment initiation failed');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="p-8 text-slate-500">Loading subscription plans...</div>;

    const currentPlanLimit = sellerSubscription?.planId?.includedStorageMB || 0;
    const storagePercentage = currentPlanLimit > 0 ? Math.min((usedStorageMB / currentPlanLimit) * 100, 100) : 0;
    const isOverLimit = usedStorageMB > currentPlanLimit;
    const activeCycle = CYCLES.find(c => c.key === billingCycle);

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Film className="text-brand-600" /> Video Subscription Plans
                </h1>
                <p className="text-slate-500 mt-1 text-sm">Upload product videos by subscribing to a plan. All plans are DB-configured by admin.</p>
            </div>

            {/* Storage Usage */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <HardDrive size={18} className="text-slate-500" /> Storage Usage
                </h2>
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="flex-1 w-full">
                        <div className="flex justify-between text-sm font-medium mb-2">
                            <span className="text-slate-600">Used Storage</span>
                            <span className={isOverLimit ? 'text-red-500 font-bold' : 'text-slate-800'}>
                                {usedStorageMB.toFixed(2)} MB / {currentPlanLimit} MB
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div
                                className={`h-3 rounded-full transition-all duration-500 ${isOverLimit ? 'bg-red-500' : 'bg-brand-500'}`}
                                style={{ width: `${storagePercentage}%` }}
                            />
                        </div>
                        {isOverLimit && (
                            <p className="text-xs text-red-500 flex items-center gap-1 mt-2">
                                <AlertCircle size={12} /> Storage exceeded. Extra uploads will be charged per MB.
                            </p>
                        )}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 min-w-[220px]">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Plan</h3>
                        {sellerSubscription ? (
                            <div>
                                <div className="font-bold text-lg text-brand-700">{sellerSubscription.planId?.name}</div>
                                <div className="text-xs text-slate-500 mt-1 capitalize">{sellerSubscription.billingCycle} billing</div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                    Valid until: {new Date(sellerSubscription.expiryDate).toLocaleDateString('en-IN')}
                                </div>
                                <div className={`text-xs font-bold mt-1 ${sellerSubscription.paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-500'}`}>
                                    {sellerSubscription.paymentStatus === 'paid' ? '✓ Active' : '⏳ Pending Admin Confirmation (COD)'}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-500 font-medium">No active plan</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Billing Cycle Selector */}
            <div className="flex items-center justify-center gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit mx-auto">
                {CYCLES.map(cycle => (
                    <button
                        key={cycle.key}
                        onClick={() => setBillingCycle(cycle.key)}
                        className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${billingCycle === cycle.key ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {cycle.label}
                        {cycle.badge && billingCycle === cycle.key && (
                            <span className="absolute -top-2 -right-2 bg-brand-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                {cycle.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                    const isCurrentPlan = sellerSubscription?.planId?._id === plan._id;
                    const price = plan[activeCycle?.priceKey] || 0;

                    return (
                        <div
                            key={plan._id}
                            className={`relative bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-lg ${isCurrentPlan ? 'border-brand-500 ring-4 ring-brand-50' : 'border-slate-200 hover:border-brand-300'}`}
                        >
                            {isCurrentPlan && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-500 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-widest">
                                    CURRENT PLAN
                                </div>
                            )}
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                                <p className="text-sm text-slate-400 mt-1 min-h-[36px]">{plan.description}</p>
                                <div className="mt-5 flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900">₹{price}</span>
                                    <span className="text-slate-400 text-sm">/ {activeCycle?.days} days</span>
                                </div>
                            </div>
                            <div className="p-6">
                                <ul className="space-y-3 mb-6">
                                    <li className="flex items-center gap-2 text-sm text-slate-600">
                                        <Check size={16} className="text-green-500 shrink-0" />
                                        <span><strong className="text-slate-800">{plan.includedStorageMB} MB</strong> Included Storage</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-slate-600">
                                        <Check size={16} className="text-green-500 shrink-0" />
                                        <span><strong className="text-slate-800">₹{plan.extraMBPrice}</strong> per Extra MB</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-slate-600">
                                        <Check size={16} className="text-green-500 shrink-0" />
                                        <span>Product Video Upload Access</span>
                                    </li>
                                </ul>
                                <button
                                    onClick={() => openPayModal(plan)}
                                    disabled={isCurrentPlan && sellerSubscription?.paymentStatus === 'paid'}
                                    className={`w-full py-3 rounded-xl font-bold transition-all text-sm ${
                                        isCurrentPlan && sellerSubscription?.paymentStatus === 'paid'
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                    }`}
                                >
                                    {isCurrentPlan && sellerSubscription?.paymentStatus === 'paid' ? 'Active Plan' : price === 0 ? 'Activate Free' : 'Subscribe Now'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {plans.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <Film size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No subscription plans available. Contact admin.</p>
                </div>
            )}

            <div className="mt-8 bg-blue-50 text-blue-800 p-4 rounded-xl flex items-start gap-3 border border-blue-100">
                <Info className="shrink-0 mt-0.5" size={18} />
                <div className="text-sm">
                    <strong>How it works:</strong> Free storage is included in your plan. If you exceed it, extra MBs are charged at your plan's "Extra MB Price".
                    Pay via <strong>Razorpay</strong> (instant activation) or <strong>COD</strong> (admin activates after collection).
                </div>
            </div>

            {/* Payment Modal */}
            {payModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        {codSuccess ? (
                            <div className="p-10 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-5">
                                    <Check size={40} strokeWidth={3} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Request Received!</h3>
                                <p className="text-slate-500 text-sm">
                                    Your COD request has been submitted successfully. Admin will collect the payment and activate your plan shortly.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                    <h3 className="text-lg font-bold text-slate-800">Complete Payment</h3>
                                    <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
                                </div>
                                <div className="p-6">
                                    <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-slate-800">{payModal.plan.name}</div>
                                                <div className="text-sm text-slate-500 capitalize">{payModal.cycle} billing · {payModal.plan.includedStorageMB} MB included</div>
                                            </div>
                                            <div className="text-2xl font-black text-slate-900">₹{payModal.amount}</div>
                                        </div>
                                    </div>

                                    <p className="text-sm font-semibold text-slate-700 mb-3">Choose Payment Method</p>
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleRazorpay}
                                            disabled={processing}
                                            className="w-full flex items-center justify-between px-5 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold disabled:opacity-60"
                                        >
                                            <div className="flex items-center gap-3">
                                                <CreditCard size={20} />
                                                <span>Pay Online (Razorpay)</span>
                                            </div>
                                            <span className="text-sm bg-white/20 px-2 py-0.5 rounded-lg">Instant Activation</span>
                                        </button>

                                        <button
                                            onClick={handleCOD}
                                            disabled={processing}
                                            className="w-full flex items-center justify-between px-5 py-4 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all font-bold disabled:opacity-60"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Truck size={20} />
                                                <span>Pay Cash (COD)</span>
                                            </div>
                                            <span className="text-sm bg-white/20 px-2 py-0.5 rounded-lg">Admin Activates</span>
                                        </button>
                                    </div>

                                    {processing && <p className="text-center text-sm text-slate-500 mt-4">Processing...</p>}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoSubscriptions;

