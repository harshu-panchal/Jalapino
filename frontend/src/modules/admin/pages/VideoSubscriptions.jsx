import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, CreditCard, Clock, Users } from 'lucide-react';
import { videoSubscriptionApi } from '../services/api/videoSubscriptionApi';

const BILLING_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

const VideoSubscriptions = () => {
    const [plans, setPlans] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('plans');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);

    const defaultForm = {
        name: '',
        description: '',
        monthlyPrice: 0,
        quarterlyPrice: 0,
        yearlyPrice: 0,
        includedStorageMB: 500,
        extraMBPrice: 2,
        isActive: true,
    };
    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [plansRes, subsRes] = await Promise.all([
                videoSubscriptionApi.getPlans(),
                videoSubscriptionApi.getSubscriptions().catch(() => ({ subscriptions: [] })),
            ]);
            if (plansRes.success) setPlans(plansRes.plans);
            if (subsRes.subscriptions) setSubscriptions(subsRes.subscriptions);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (plan = null) => {
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                name: plan.name,
                description: plan.description || '',
                monthlyPrice: plan.monthlyPrice || 0,
                quarterlyPrice: plan.quarterlyPrice || 0,
                yearlyPrice: plan.yearlyPrice || 0,
                includedStorageMB: plan.includedStorageMB,
                extraMBPrice: plan.extraMBPrice,
                isActive: plan.isActive,
            });
        } else {
            setEditingPlan(null);
            setFormData(defaultForm);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPlan) {
                await videoSubscriptionApi.updatePlan(editingPlan._id, formData);
                toast.success('Plan updated successfully');
            } else {
                await videoSubscriptionApi.createPlan(formData);
                toast.success('Plan created successfully');
            }
            setIsModalOpen(false);
            fetchAll();
        } catch (err) {
            toast.error('Failed to save plan');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this plan?')) return;
        try {
            await videoSubscriptionApi.deletePlan(id);
            toast.success('Plan deleted');
            fetchAll();
        } catch {
            toast.error('Failed to delete plan');
        }
    };

    const toggleStatus = async (id, current) => {
        try {
            await videoSubscriptionApi.updatePlan(id, { isActive: !current });
            toast.success(`Plan ${!current ? 'activated' : 'deactivated'}`);
            fetchAll();
        } catch {
            toast.error('Failed to update status');
        }
    };

    const confirmCOD = async (subId) => {
        try {
            await videoSubscriptionApi.confirmCODSubscription(subId);
            toast.success('Subscription activated!');
            fetchAll();
        } catch {
            toast.error('Failed to confirm payment');
        }
    };

    if (loading) return <div className="p-8 text-slate-500">Loading...</div>;

    const pendingCOD = subscriptions.filter(s => s.paymentStatus === 'pending_cod');
    const paidSubs = subscriptions.filter(s => s.paymentStatus === 'paid');

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Video Subscription Plans</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Manage seller video plans & payments</p>
                </div>
                {activeTab === 'plans' && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Plus size={18} /> Create New Plan
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
                {[
                    { id: 'plans', label: 'Plans', icon: CreditCard },
                    { id: 'pending', label: `Pending COD (${pendingCOD.length})`, icon: Clock },
                    { id: 'paid', label: `Paid (${paidSubs.length})`, icon: Users },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <tab.icon size={15} />{tab.label}
                    </button>
                ))}
            </div>

            {/* Plans Table */}
            {activeTab === 'plans' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-widest">
                                <th className="py-4 px-6">Plan</th>
                                <th className="py-4 px-4 text-center">Monthly</th>
                                <th className="py-4 px-4 text-center">Quarterly</th>
                                <th className="py-4 px-4 text-center">Yearly</th>
                                <th className="py-4 px-4 text-center">Storage</th>
                                <th className="py-4 px-4 text-center">Extra/MB</th>
                                <th className="py-4 px-4 text-center">Status</th>
                                <th className="py-4 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.length === 0 ? (
                                <tr><td colSpan="8" className="py-12 text-center text-slate-400">No plans yet. Create one!</td></tr>
                            ) : plans.map(plan => (
                                <tr key={plan._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="font-semibold text-slate-800">{plan.name}</div>
                                        <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">{plan.description}</div>
                                    </td>
                                    <td className="py-4 px-4 text-center font-medium text-slate-700">₹{plan.monthlyPrice}</td>
                                    <td className="py-4 px-4 text-center font-medium text-slate-700">₹{plan.quarterlyPrice}</td>
                                    <td className="py-4 px-4 text-center font-medium text-slate-700">₹{plan.yearlyPrice}</td>
                                    <td className="py-4 px-4 text-center">{plan.includedStorageMB} MB</td>
                                    <td className="py-4 px-4 text-center">₹{plan.extraMBPrice}/MB</td>
                                    <td className="py-4 px-4 text-center">
                                        <button
                                            onClick={() => toggleStatus(plan._id, plan.isActive)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${plan.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            {plan.isActive ? <CheckCircle size={13} /> : <XCircle size={13} />}
                                            {plan.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => handleOpenModal(plan)} className="text-slate-400 hover:text-brand-600 transition-colors"><Edit2 size={17} /></button>
                                            <button onClick={() => handleDelete(plan._id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={17} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pending COD Subscriptions */}
            {activeTab === 'pending' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-amber-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-widest">
                                <th className="py-4 px-6">Seller</th>
                                <th className="py-4 px-4">Plan</th>
                                <th className="py-4 px-4">Cycle</th>
                                <th className="py-4 px-4 text-center">Amount</th>
                                <th className="py-4 px-4">Date</th>
                                <th className="py-4 px-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingCOD.length === 0 ? (
                                <tr><td colSpan="6" className="py-12 text-center text-slate-400">No pending COD requests</td></tr>
                            ) : pendingCOD.map(sub => (
                                <tr key={sub._id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-4 px-6">
                                        <div className="font-semibold text-slate-800">{sub.sellerId?.shopName || sub.sellerId?.name || 'Seller'}</div>
                                        <div className="text-xs text-slate-400">{sub.sellerId?.email}</div>
                                    </td>
                                    <td className="py-4 px-4 font-medium text-slate-700">{sub.planId?.name}</td>
                                    <td className="py-4 px-4">
                                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{BILLING_LABELS[sub.billingCycle]}</span>
                                    </td>
                                    <td className="py-4 px-4 text-center font-bold text-slate-900">₹{sub.amountPaid}</td>
                                    <td className="py-4 px-4 text-sm text-slate-500">{new Date(sub.createdAt).toLocaleDateString('en-IN')}</td>
                                    <td className="py-4 px-4 text-center">
                                        <button
                                            onClick={() => confirmCOD(sub._id)}
                                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                                        >
                                            Confirm COD
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Paid Subscriptions */}
            {activeTab === 'paid' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-green-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-widest">
                                <th className="py-4 px-6">Seller</th>
                                <th className="py-4 px-4">Plan</th>
                                <th className="py-4 px-4">Cycle</th>
                                <th className="py-4 px-4">Method</th>
                                <th className="py-4 px-4 text-center">Amount</th>
                                <th className="py-4 px-4">Valid Until</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paidSubs.length === 0 ? (
                                <tr><td colSpan="6" className="py-12 text-center text-slate-400">No paid subscriptions yet</td></tr>
                            ) : paidSubs.map(sub => (
                                <tr key={sub._id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-4 px-6">
                                        <div className="font-semibold text-slate-800">{sub.sellerId?.shopName || sub.sellerId?.name || 'Seller'}</div>
                                        <div className="text-xs text-slate-400">{sub.sellerId?.email}</div>
                                    </td>
                                    <td className="py-4 px-4 font-medium">{sub.planId?.name}</td>
                                    <td className="py-4 px-4">
                                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{BILLING_LABELS[sub.billingCycle]}</span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${sub.paymentMethod === 'Razorpay' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {sub.paymentMethod}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-center font-bold text-green-700">₹{sub.amountPaid}</td>
                                    <td className="py-4 px-4 text-sm text-slate-500">{new Date(sub.expiryDate).toLocaleDateString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Plan Name</label>
                                <input type="text" name="name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. Pro Video Pack" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea name="description" value={formData.description} rows={2} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Plan benefits..." />
                            </div>

                            {/* Pricing */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Pricing (INR)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { key: 'monthlyPrice', label: 'Monthly', sub: '30 days' },
                                        { key: 'quarterlyPrice', label: 'Quarterly', sub: '90 days' },
                                        { key: 'yearlyPrice', label: 'Yearly', sub: '365 days' },
                                    ].map(({ key, label, sub }) => (
                                        <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div className="text-xs font-bold text-slate-600 mb-1">{label}</div>
                                            <div className="text-[10px] text-slate-400 mb-2">{sub}</div>
                                            <input type="number" value={formData[key]} min="0" required onChange={e => setFormData(p => ({ ...p, [key]: Number(e.target.value) }))}
                                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Included Storage (MB)</label>
                                    <input type="number" value={formData.includedStorageMB} min="0" required onChange={e => setFormData(p => ({ ...p, includedStorageMB: Number(e.target.value) }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Extra MB Price (₹)</label>
                                    <input type="number" value={formData.extraMBPrice} min="0" step="0.5" required onChange={e => setFormData(p => ({ ...p, extraMBPrice: Number(e.target.value) }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                                    className="w-4 h-4 text-brand-600 rounded" />
                                <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">Plan is Active (visible to sellers)</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                                <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">
                                    {editingPlan ? 'Update Plan' : 'Create Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoSubscriptions;
