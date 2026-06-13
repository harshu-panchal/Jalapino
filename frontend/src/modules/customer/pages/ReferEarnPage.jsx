import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    Gift,
    Copy,
    Check,
    Share2,
    Users,
    Wallet,
    Info,
    CheckCircle2,
    Clock,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { customerApi } from "../services/customerApi";

const ReferEarnPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    const [referralData, setReferralData] = useState({
        referralCode: "",
        referralLink: "",
        referralCount: 0,
        completedCount: 0,
        totalEarnedCashback: 0,
        referralsList: [],
        campaignRules: {
            isEnabled: false,
            rewardType: "cashback",
            referrerReward: 50,
            refereeReward: 20,
            eligibilityCondition: "first_order_delivered",
            minOrderValue: 100
        }
    });

    const fetchReferralDetails = async () => {
        try {
            setLoading(true);
            const res = await customerApi.getReferralDetails();
            if (res.data?.success) {
                setReferralData(res.data.result || res.data.results);
            }
        } catch (error) {
            console.error("Error fetching referral details:", error);
            toast.error("Failed to load Refer & Earn details.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReferralDetails();
    }, []);

    const handleCopy = (text, type) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        if (type === "link") {
            setCopiedLink(true);
            toast.success("Referral link copied!");
            setTimeout(() => setCopiedLink(false), 2000);
        } else {
            setCopiedCode(true);
            toast.success("Referral code copied!");
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: "Join Jalpaino!",
            text: `Hey! Sign up on Jalapino E-Commerce using my referral code ${referralData.referralCode} to get a special discount/cashback!`,
            url: referralData.referralLink
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                toast.success("Invite shared successfully!");
            } catch (err) {
                console.log("Error sharing:", err);
            }
        } else {
            // Fallback to copying link
            handleCopy(referralData.referralLink, "link");
        }
    };

    const shareOnWhatsApp = () => {
        const text = encodeURIComponent(
            `Hey! Sign up on Jalapino E-Commerce using my referral code *${referralData.referralCode}* to get special sign-up rewards!\nRegister here: ${referralData.referralLink}`
        );
        window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    };

    const rules = referralData.campaignRules;

    return (
        <div className="min-h-screen bg-[#FAF8F6] pb-24 md:pb-8 font-['Inter'] text-slate-800 flex flex-col items-center">
            {/* Premium Sticky Header matching App layout */}
            <div
                style={{
                    background: "var(--customer-header-gradient)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    borderBottomLeftRadius: "20px",
                    borderBottomRightRadius: "20px",
                }}
                className="w-full sticky top-0 z-30 px-4 py-3 flex items-center gap-2 mb-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
            >
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors -ml-1 text-white"
                >
                    <ChevronLeft size={22} />
                </button>
                <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <Gift className="text-amber-300 animate-pulse" size={20} />
                    Refer & earn
                </h1>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 text-sm font-medium">Loading invite program details...</p>
                </div>
            ) : (
                <div className="w-full max-w-lg px-4 py-4 flex flex-col items-center space-y-6">
                    {/* Top banner / graphic */}
                    <div className="w-full bg-gradient-to-br from-[#F43F5E] via-[#F97316] to-[#F59E0B] rounded-3xl p-8 text-white text-center space-y-5 shadow-2xl relative overflow-hidden transition-all duration-300 hover:shadow-rose-500/10">
                        {/* Background glass shapes */}
                        <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/15 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

                        {/* Animated Gift Icon Bubble */}
                        <div className="w-16 h-16 bg-white/15 rounded-full flex items-center justify-center mx-auto border border-white/25 shadow-lg backdrop-blur-md transition-transform duration-500 hover:rotate-12 hover:scale-110 cursor-pointer">
                            <Gift className="text-white h-7 w-7" />
                        </div>
                        
                        <div className="space-y-3 relative z-10">
                            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight text-white drop-shadow-sm">
                                Invite friends, earn rewards
                            </h2>
                            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md rounded-full px-4 py-1.5 text-xs font-semibold text-white/95 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                <span>
                                    {rules.isEnabled
                                        ? `Earn ₹${rules.referrerReward} when they order. Friend gets ₹${rules.refereeReward}!`
                                        : "Referral campaign temporarily paused by admin."}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats summary grid */}
                    <div className="grid grid-cols-3 gap-4 w-full">
                        {[
                            { label: "Total invites", value: referralData.referralCount, icon: Users, color: "indigo" },
                            { label: "Success referrals", value: referralData.completedCount, icon: CheckCircle2, color: "emerald" },
                            { label: "Wallet bonuses", value: `₹${referralData.totalEarnedCashback}`, icon: Wallet, color: "amber" },
                        ].map((stat, i) => (
                            <div
                                key={i}
                                className="bg-white border border-slate-100/80 rounded-2xl p-4 flex flex-col items-center shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5"
                            >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-2.5 ${stat.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                                        stat.color === 'amber' ? 'bg-amber-50 text-amber-600' : ''
                                    }`}>
                                    <stat.icon size={18} strokeWidth={2.5} />
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 tracking-wide text-center leading-none mb-1">
                                    {stat.label}
                                </span>
                                <span className="text-base font-extrabold text-slate-800 tracking-tight leading-none">
                                    {stat.value}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Referral sharing panel */}
                    <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-6">
                        <div className="space-y-2.5">
                            <span className="text-xs font-semibold text-slate-400 tracking-wide block">Your shareable code</span>
                            <div className="bg-slate-50/50 border border-dashed border-slate-350 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors hover:bg-slate-50">
                                <code className="text-slate-800 font-mono font-extrabold text-sm tracking-widest select-all">
                                    {referralData.referralCode}
                                </code>
                                <button
                                    onClick={() => handleCopy(referralData.referralCode, "code")}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold tracking-wider transition-all duration-200 active:scale-95 flex items-center gap-1.5 shadow-[0_4px_12px_rgba(15,23,42,0.12)]"
                                >
                                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedCode ? "Copied" : "Copy"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <span className="text-xs font-semibold text-slate-400 tracking-wide block">Invite via links</span>
                            <div className="flex gap-3">
                                <button
                                    onClick={shareOnWhatsApp}
                                    className="flex-1 py-3.5 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-2xl text-xs font-semibold tracking-wide shadow-[0_6px_20px_rgba(37,211,102,0.15)] transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 hover:shadow-[0_8px_24px_rgba(37,211,102,0.25)] hover:-translate-y-0.5"
                                >
                                    <Share2 size={14} />
                                    WhatsApp invite
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="flex-1 py-3.5 px-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-2xl text-xs font-semibold tracking-wide transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] hover:-translate-y-0.5"
                                >
                                    <Share2 size={14} />
                                    Other options
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Invited Friends Tracker List */}
                    <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                        <span className="text-xs font-semibold text-slate-400 tracking-wide block">Referrals tracker</span>

                        {referralData.referralsList.length === 0 ? (
                            <div className="py-10 text-center flex flex-col items-center justify-center">
                                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                                    <Users className="h-6 w-6 text-slate-300" strokeWidth={1.8} />
                                </div>
                                <p className="text-sm font-bold text-slate-700 mb-1">No referrals logged yet</p>
                                <p className="text-[11px] text-slate-400 max-w-[280px] leading-normal">
                                    Share your invite link above with friends to get started!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {referralData.referralsList.map((ref) => (
                                    <div
                                        key={ref.id}
                                        className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between transition-colors hover:bg-slate-50"
                                    >
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-bold text-slate-800">{ref.refereeName}</h4>
                                            <p className="text-[10px] text-slate-400">
                                                Joined {new Date(ref.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div>
                                            {ref.status === "completed" ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-semibold tracking-wide">
                                                    <CheckCircle2 size={12} strokeWidth={2.5} />
                                                    Success
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-semibold tracking-wide">
                                                    <Clock size={12} strokeWidth={2.5} />
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* How it works details */}
                    <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide">
                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                                <Info size={13} className="text-slate-500" />
                            </div>
                            <span>How it works</span>
                        </div>
                        
                        <div className="space-y-3 pt-1">
                            {[
                                "Share your unique code or link with friends who aren't yet registered on Jalpaino.",
                                rules.eligibilityCondition === "signup"
                                    ? "Bonus is paid out instantly as soon as your friend registers and verifies their OTP."
                                    : `Bonus is paid out after your friend completes their first order of at least ₹${rules.minOrderValue || 100}.`,
                                "Wallet bonus is credited directly to your Jalpaino wallet balance and can be used on checkout.",
                                "If the admin configures coupon rewards, check your profile or notifications to find the coupon codes."
                            ].map((step, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                                        {idx + 1}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                        {step}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReferEarnPage;
