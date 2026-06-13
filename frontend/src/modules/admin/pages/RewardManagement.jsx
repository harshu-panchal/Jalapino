import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import {
    Plus,
    Trash2,
    Pencil,
    Sparkles,
    Gift,
    IndianRupee,
    Percent
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';

const RewardManagement = () => {
    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [editingReward, setEditingReward] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [rewards, setRewards] = useState([]);
    const [stats, setStats] = useState({
        totalSpins: 0,
        couponSpins: 0,
        cashbackSpins: 0,
        totalCashbackCredited: 0
    });

    const [formData, setFormData] = useState({
        label: '',
        rewardType: 'coupon',
        value: '',
        probability: '1',
        bgColor: '#E11D48',
        textColor: '#FFFFFF',
        isActive: true,
        couponPrefix: 'SPIN',
        minOrderValue: '200',
        validityDays: '7'
    });

    const fetchRewardsAndStats = async () => {
        try {
            setIsLoading(true);
            const [rewardsRes, statsRes] = await Promise.all([
                adminApi.getWheelRewards(),
                adminApi.getGamificationStats()
            ]);

            if (rewardsRes.data?.success) {
                setRewards(rewardsRes.data.result || rewardsRes.data.results || []);
            }
            if (statsRes.data?.success) {
                setStats(statsRes.data.result || {
                    totalSpins: 0,
                    couponSpins: 0,
                    cashbackSpins: 0,
                    totalCashbackCredited: 0
                });
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to load wheel reward configurations', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRewardsAndStats();
    }, []);

    const handleOpenModal = (reward = null) => {
        if (reward) {
            setEditingReward(reward);
            setFormData({
                label: reward.label || '',
                rewardType: reward.rewardType || 'coupon',
                value: reward.value ?? '',
                probability: String(reward.probability ?? '1'),
                bgColor: reward.bgColor || '#E11D48',
                textColor: reward.textColor || '#FFFFFF',
                isActive: reward.isActive ?? true,
                couponPrefix: reward.couponPrefix || 'SPIN',
                minOrderValue: String(reward.minOrderValue ?? '200'),
                validityDays: String(reward.validityDays ?? '7')
            });
        } else {
            setEditingReward(null);
            setFormData({
                label: '',
                rewardType: 'coupon',
                value: '',
                probability: '1',
                bgColor: '#E11D48',
                textColor: '#FFFFFF',
                isActive: true,
                couponPrefix: 'SPIN',
                minOrderValue: '200',
                validityDays: '7'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                probability: Number(formData.probability) || 1,
                value: formData.rewardType === 'try_again' ? '' : formData.value,
                couponPrefix: formData.rewardType === 'coupon' ? (formData.couponPrefix || 'SPIN') : undefined,
                minOrderValue: formData.rewardType === 'coupon' ? (Number(formData.minOrderValue) || 200) : undefined,
                validityDays: formData.rewardType === 'coupon' ? (Number(formData.validityDays) || 7) : undefined
            };

            if (editingReward?._id) {
                await adminApi.updateWheelReward(editingReward._id, payload);
                showToast('Wheel reward updated successfully', 'success');
            } else {
                await adminApi.createWheelReward(payload);
                showToast('New wheel reward added!', 'success');
            }
            
            setIsModalOpen(false);
            setEditingReward(null);
            fetchRewardsAndStats();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save wheel reward configuration', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            await adminApi.deleteWheelReward(id);
            showToast('Wheel reward configuration deleted', 'warning');
            setDeleteTarget(null);
            fetchRewardsAndStats();
        } catch (error) {
            showToast('Failed to delete wheel reward', 'error');
        }
    };

    const handleToggleActive = async (reward) => {
        try {
            const updated = !reward.isActive;
            await adminApi.updateWheelReward(reward._id, { isActive: updated });
            showToast(`Reward set to ${updated ? 'active' : 'inactive'}`, 'success');
            fetchRewardsAndStats();
        } catch (error) {
            showToast('Failed to toggle status', 'error');
        }
    };

    // Total probability weight sum
    const totalWeights = useMemo(() => {
        return rewards.reduce((acc, r) => acc + (r.probability || 0), 0);
    }, [rewards]);

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Spin & Win Gamification
                        <Badge variant="primary" className="text-[10px] font-black uppercase tracking-widest">WHEEL ADMIN</Badge>
                    </h1>
                    <p className="ds-description mt-1">Configure slices on the customer Spin Wheel, adjust probability weights, and track performance.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <Plus className="h-5 w-5" />
                    ADD WHEEL SLICE
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Spins Logged', value: stats.totalSpins, icon: Sparkles, color: 'indigo' },
                    { label: 'Coupons Won', value: stats.couponSpins, icon: Percent, color: 'rose' },
                    { label: 'Cashbacks Won', value: stats.cashbackSpins, icon: Gift, color: 'amber' },
                    { label: 'Total Cashback Paid', value: `₹${stats.totalCashbackCredited}`, icon: IndianRupee, color: 'emerald' },
                ].map((s, i) => (
                    <Card key={i} className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2.5 rounded-2xl",
                                s.color === 'indigo' && "bg-brand-50 text-brand-600",
                                s.color === 'rose' && "bg-rose-50 text-rose-600",
                                s.color === 'amber' && "bg-amber-50 text-amber-600",
                                s.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                            )}>
                                <s.icon className="h-6 w-6" />
                            </div>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{s.label}</h4>
                        <h3 className="text-2xl font-black text-slate-900">{s.value}</h3>
                    </Card>
                ))}
            </div>

            {/* Slices List */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                <div className="px-4 py-5 border-b border-slate-50">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Wheel Slices Map</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Slice / Label</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reward Type</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Color Styles</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Odds Weight</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Probability (%)</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading && (
                                <tr>
                                    <td colSpan="7" className="text-center py-8 text-slate-400 text-sm">
                                        Loading rewards configuration...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && rewards.map((r) => {
                                const probabilityPercent = totalWeights > 0 
                                    ? ((r.probability / totalWeights) * 100).toFixed(1)
                                    : '0.0';

                                return (
                                    <tr key={r._id} className="group hover:bg-slate-50/30 transition-colors">
                                        <td className="px-4 py-6">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-xs"
                                                    style={{ backgroundColor: r.bgColor, color: r.textColor }}
                                                >
                                                    {r.rewardType === 'coupon' ? '%' : r.rewardType === 'cashback' ? '₹' : 'Ø'}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-black text-slate-900 tracking-tight">{r.label}</span>
                                                    {r.rewardType === 'coupon' ? (
                                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                                            {r.value}% OFF | Prefix: {r.couponPrefix || 'SPIN'} | Min: ₹{r.minOrderValue || 200} | Valid: {r.validityDays || 7}d
                                                        </p>
                                                    ) : r.rewardType !== 'try_again' ? (
                                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Value: {r.value}</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-6">
                                            <Badge 
                                                variant={
                                                    r.rewardType === 'coupon' ? 'primary' :
                                                    r.rewardType === 'cashback' ? 'success' : 'secondary'
                                                }
                                                className="text-[9px] font-black uppercase tracking-wider"
                                            >
                                                {r.rewardType.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span 
                                                    className="inline-block w-4 h-4 rounded-full border border-slate-300" 
                                                    style={{ backgroundColor: r.bgColor }} 
                                                    title={`BG: ${r.bgColor}`}
                                                />
                                                <span className="text-[10px] font-mono text-slate-500 uppercase">{r.bgColor}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-6 text-center">
                                            <span className="text-xs font-black text-slate-800">{r.probability}</span>
                                        </td>
                                        <td className="px-4 py-6 text-center">
                                            <span className="text-xs font-black text-brand-600">{probabilityPercent}%</span>
                                        </td>
                                        <td className="px-4 py-6 text-center">
                                            <button
                                                onClick={() => handleToggleActive(r)}
                                                className="focus:outline-none"
                                            >
                                                <Badge 
                                                    variant={r.isActive ? 'success' : 'secondary'} 
                                                    className="text-[9px] font-black uppercase cursor-pointer hover:opacity-80 transition-opacity"
                                                >
                                                    {r.isActive ? 'active' : 'inactive'}
                                                </Badge>
                                            </button>
                                        </td>
                                        <td className="px-4 py-6">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(r)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                >
                                                    <Pencil className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(r)}
                                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {rewards.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-6">
                            <Sparkles className="h-10 w-10 text-slate-200" />
                        </div>
                        <h3 className="text-lg font-black text-slate-900">No slices configured</h3>
                        <p className="text-sm font-bold text-slate-400 mt-2">Create a few wheel slice rewards to let users spin.</p>
                    </div>
                )}
            </Card>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Delete Wheel Reward Option?"
            >
                <div className="text-center p-2">
                    <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm mb-6">
                        Are you sure you want to delete <span className="font-semibold text-slate-900">"{deleteTarget?.label}"</span>? 
                        This slice configuration will be permanently removed from the lucky wheel.
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setDeleteTarget(null)}
                            className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-[10px] uppercase tracking-wider transition-colors"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={() => handleDelete(deleteTarget._id)}
                            className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider hover:bg-rose-700 transition-colors"
                        >
                            DELETE
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal for Create/Edit Slice */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingReward ? "Modify Wheel Slice" : "Create Lucky Wheel Slice"}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Slice Display Label</label>
                        <input
                            required
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            placeholder="E.G. 10% OFF or ₹50 Cashback"
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-1 focus:ring-primary/20"
                        />
                        <p className="text-[10px] text-slate-400">This label is shown directly inside the wheel slice.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reward Strategy</label>
                            <select
                                value={formData.rewardType}
                                onChange={(e) => setFormData({ ...formData, rewardType: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            >
                                <option value="coupon">Discount Coupon</option>
                                <option value="cashback">Wallet Cashback</option>
                                <option value="try_again">Try Again / Better Luck</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reward Value</label>
                            <input
                                required={formData.rewardType !== 'try_again'}
                                disabled={formData.rewardType === 'try_again'}
                                type="number"
                                min={1}
                                value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                placeholder={formData.rewardType === 'coupon' ? 'Discount % (e.g. 10)' : formData.rewardType === 'cashback' ? 'Rupees (e.g. 25)' : 'N/A'}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {formData.rewardType === 'coupon' && (
                        <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coupon Prefix</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.couponPrefix}
                                    onChange={(e) => setFormData({ ...formData, couponPrefix: e.target.value.toUpperCase() })}
                                    placeholder="SPIN"
                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-1 focus:ring-primary/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Min Order (₹)</label>
                                <input
                                    required
                                    type="number"
                                    min={0}
                                    value={formData.minOrderValue}
                                    onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                                    placeholder="200"
                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-1 focus:ring-primary/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validity (Days)</label>
                                <input
                                    required
                                    type="number"
                                    min={1}
                                    value={formData.validityDays}
                                    onChange={(e) => setFormData({ ...formData, validityDays: e.target.value })}
                                    placeholder="7"
                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-1 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2 col-span-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Odds Weight</label>
                            <input
                                required
                                type="number"
                                min={0}
                                value={formData.probability}
                                onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            />
                        </div>
                        <div className="space-y-2 col-span-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Slice Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={formData.bgColor}
                                    onChange={(e) => setFormData({ ...formData, bgColor: e.target.value })}
                                    className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-transparent p-0"
                                />
                                <span className="text-[10px] font-mono font-bold uppercase">{formData.bgColor}</span>
                            </div>
                        </div>
                        <div className="space-y-2 col-span-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Text Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={formData.textColor}
                                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                                    className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-transparent p-0"
                                />
                                <span className="text-[10px] font-mono font-bold uppercase">{formData.textColor}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10"
                        >
                            {editingReward ? 'SAVE CHANGES' : 'CREATE SLICE'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default RewardManagement;
