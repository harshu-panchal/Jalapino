import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import StatCard from '@shared/components/ui/StatCard';
import { useToast } from '@shared/components/ui/Toast';
import {
    Gift,
    Users,
    CheckCircle,
    Clock,
    IndianRupee,
    Loader2,
    Save,
    Percent
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';

const ReferralSettings = () => {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Configuration state matching model setting.js referralProgram schema
    const [config, setConfig] = useState({
        isEnabled: false,
        rewardType: 'cashback',
        referrerReward: 50,
        refereeReward: 20,
        eligibilityCondition: 'first_order_delivered',
        minOrderValue: 100,
    });

    // Statistics state from getAdminReferralStats
    const [stats, setStats] = useState({
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalPayoutPaid: 0,
    });

    // Fetch config and stats on mount
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [configRes, statsRes] = await Promise.all([
                adminApi.getReferralConfig(),
                adminApi.getReferralStats()
            ]);

            if (configRes.data?.success) {
                setConfig({
                    isEnabled: configRes.data.result?.isEnabled ?? false,
                    rewardType: configRes.data.result?.rewardType ?? 'cashback',
                    referrerReward: configRes.data.result?.referrerReward ?? 50,
                    refereeReward: configRes.data.result?.refereeReward ?? 20,
                    eligibilityCondition: configRes.data.result?.eligibilityCondition ?? 'first_order_delivered',
                    minOrderValue: configRes.data.result?.minOrderValue ?? 100,
                });
            }
            if (statsRes.data?.success) {
                setStats({
                    totalReferrals: statsRes.data.result?.totalReferrals ?? 0,
                    completedReferrals: statsRes.data.result?.completedReferrals ?? 0,
                    pendingReferrals: statsRes.data.result?.pendingReferrals ?? 0,
                    totalPayoutPaid: statsRes.data.result?.totalPayoutPaid ?? 0,
                });
            }
        } catch (error) {
            console.error('Failed to load referral campaign data:', error);
            showToast('Failed to load referral details', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleInputChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const payload = {
                ...config,
                referrerReward: Number(config.referrerReward) || 0,
                refereeReward: Number(config.refereeReward) || 0,
                minOrderValue: Number(config.minOrderValue) || 0,
            };

            const res = await adminApi.updateReferralConfig(payload);
            if (res.data?.success) {
                showToast('Referral program settings updated successfully!', 'success');
                // Refresh data
                fetchData();
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            showToast(error.response?.data?.message || 'Failed to save referral settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Refer & Earn Program
                        <div className="p-2 bg-slate-100 rounded-xl">
                            <Gift className="h-5 w-5 text-slate-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">
                        Configure customer invite rules, toggle reward payouts, and view analytical stats.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className={cn(
                            "flex items-center gap-2 px-8 py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-200 hover:shadow-brand-300 active:scale-95 active:shadow-inner",
                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-brand-700"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
                <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                    <div className="p-8 flex items-center justify-center">
                        <div className="h-8 w-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                    </div>
                </Card>
            )}

            {!isLoading && (
                <>
                    {/* Analytics Dashboard Grid */}
                    <div className="ds-grid-stats">
                        <StatCard
                            label="Total Invites"
                            value={stats.totalReferrals}
                            icon={Users}
                            color="text-indigo-600"
                            bg="bg-indigo-50"
                        />
                        <StatCard
                            label="Completed Referrals"
                            value={stats.completedReferrals}
                            icon={CheckCircle}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                        />
                        <StatCard
                            label="Pending Actions"
                            value={stats.pendingReferrals}
                            icon={Clock}
                            color="text-amber-600"
                            bg="bg-amber-50"
                        />
                        <StatCard
                            label="Total Paid Out"
                            value={`₹${stats.totalPayoutPaid}`}
                            icon={IndianRupee}
                            color="text-rose-600"
                            bg="bg-rose-50"
                        />
                    </div>

                    {/* Campaign Settings Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
                        <div className="lg:col-span-8 space-y-6">
                            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                                <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                        Campaign Settings
                                    </h3>
                                </div>
                                <div className="p-8 space-y-6">
                                    {/* Enable Program Status */}
                                    <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">Activate Referral Program</p>
                                            <p className="text-xs font-bold text-slate-500 mt-1">
                                                Turn on/off Refer & Earn rewards distribution across the store app.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={config.isEnabled}
                                            onClick={() => handleInputChange('isEnabled', !config.isEnabled)}
                                            className={cn(
                                                "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200",
                                                config.isEnabled ? "bg-emerald-500" : "bg-slate-300"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                                    config.isEnabled ? "translate-x-7" : "translate-x-1"
                                                )}
                                            />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Reward Type Selection */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Reward Dispense Type
                                            </label>
                                            <select
                                                value={config.rewardType}
                                                onChange={(e) => handleInputChange('rewardType', e.target.value)}
                                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            >
                                                <option value="cashback">Direct Wallet Cashback</option>
                                                <option value="coupon">Discount Promo Coupon</option>
                                            </select>
                                        </div>

                                        {/* Eligibility Constraint */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Eligibility Milestone Requirement
                                            </label>
                                            <select
                                                value={config.eligibilityCondition}
                                                onChange={(e) => handleInputChange('eligibilityCondition', e.target.value)}
                                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            >
                                                <option value="signup">Immediate on Registration Verification</option>
                                                <option value="first_order_delivered">First Delivered Order Completion</option>
                                            </select>
                                        </div>

                                        {/* Referrer Reward value */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Referrer Bonus Amount ({config.rewardType === 'cashback' ? '₹' : '%'})
                                            </label>
                                            <div className="relative group">
                                                {config.rewardType === 'cashback' ? (
                                                    <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                ) : (
                                                    <Percent className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                )}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={config.referrerReward}
                                                    onChange={(e) => handleInputChange('referrerReward', e.target.value)}
                                                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Referee Reward value */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Referee Bonus Amount ({config.rewardType === 'cashback' ? '₹' : '%'})
                                            </label>
                                            <div className="relative group">
                                                {config.rewardType === 'cashback' ? (
                                                    <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                ) : (
                                                    <Percent className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                )}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={config.refereeReward}
                                                    onChange={(e) => handleInputChange('refereeReward', e.target.value)}
                                                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* Min Order Value for Order Milestone */}
                                        {config.eligibilityCondition === 'first_order_delivered' && (
                                            <div className="space-y-3 md:col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Minimum Order Value Required for Payout
                                                </label>
                                                <div className="relative group">
                                                    <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={config.minOrderValue}
                                                        onChange={(e) => handleInputChange('minOrderValue', e.target.value)}
                                                        className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                                    />
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400">
                                                    Invitees must place a purchase equal to or exceeding this price threshold to qualify referrer and referee for rewards.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Rules Summary Helper Panel */}
                        <div className="lg:col-span-4 space-y-6">
                            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                                <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                        Campaign Summary
                                    </h3>
                                </div>
                                <div className="p-6 space-y-4 text-xs font-medium text-slate-600">
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                                        <p className="font-bold text-slate-800">Operational Flow:</p>
                                        <p>
                                            1. Existing users fetch their personal referral code/link from their profile.
                                        </p>
                                        <p>
                                            2. A new customer enters the referral code during user signup.
                                        </p>
                                        <p>
                                            3. {config.eligibilityCondition === 'signup' 
                                                ? 'Upon successfully validating OTP, the system instantly processes the reward.' 
                                                : `Payout occurs when the invitee places a qualifying order of at least ₹${config.minOrderValue} and it shifts to "delivered" status.`
                                            }
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                                        <p className="font-bold text-slate-800">Bonus Distribution:</p>
                                        <div className="flex justify-between border-b border-slate-200 pb-2">
                                            <span>Referrer (Inviter) Reward:</span>
                                            <span className="font-bold text-slate-900">
                                                {config.rewardType === 'cashback' ? '₹' : ''}{config.referrerReward}{config.rewardType === 'coupon' ? '%' : ''}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Referee (Invitee) Reward:</span>
                                            <span className="font-bold text-slate-900">
                                                {config.rewardType === 'cashback' ? '₹' : ''}{config.refereeReward}{config.rewardType === 'coupon' ? '%' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ReferralSettings;
