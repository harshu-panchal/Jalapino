import React from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { resolveImageUrl } from '@/core/utils/imageUtils';
import { getStoredAuthToken } from '@core/utils/authStorage';
import { onNotificationNew } from '@core/services/orderSocket';

// Customer: My Orders > Events -> Customization & Quotation requests.
// Separate from bookings; payment works like bookings (advance / full online, or COD).
const STATUS = {
    REQUESTED: ['Requested', 'bg-amber-50 text-amber-700 border-amber-200'],
    QUOTED: ['Quotation Received', 'bg-indigo-50 text-indigo-700 border-indigo-200'],
    REVISION_REQUESTED: ['Revision Requested', 'bg-amber-50 text-amber-700 border-amber-200'],
    APPROVED: ['Approved · Payment Pending', 'bg-purple-50 text-purple-700 border-purple-200'],
    CONFIRMED: ['Confirmed', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
    REJECTED: ['Declined by Seller', 'bg-rose-50 text-rose-700 border-rose-200'],
    CANCELLED: ['Cancelled', 'bg-slate-100 text-slate-600 border-slate-200'],
};
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const loadRazorpay = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
});

const CustomizationRequestsList = () => {
    const location = useLocation();
    const focusId = new URLSearchParams(location.search).get('customization');
    const [items, setItems] = React.useState([]);
    const [busyId, setBusyId] = React.useState(null);

    const load = React.useCallback(async () => {
        try {
            const res = await axiosInstance.get('/customizations/my');
            setItems(Array.isArray(res.data?.result) ? res.data.result : []);
        } catch (e) { /* not logged in / network */ }
    }, []);
    React.useEffect(() => { load(); }, [load]);
    // Live: seller sent quotation / saved cash -> reload from DB.
    React.useEffect(() => {
        const getToken = () => getStoredAuthToken('auth_customer');
        if (!getToken()) return undefined;
        const off = onNotificationNew(getToken, (payload) => {
            if (String(payload?.eventType || '').startsWith('EVENT_CUSTOMIZATION')) load();
        });
        return () => { if (typeof off === 'function') off(); };
    }, [load]);

    const replace = (updated) => {
        if (!updated?._id) return;
        setItems(prev => prev.map(r => String(r._id) === String(updated._id) ? { ...r, ...updated, seller: r.seller } : r));
    };

    const respond = async (r, action) => {
        let note = '';
        if (action === 'REQUEST_REVISION') {
            note = window.prompt('What should the seller change in the quotation?') || '';
            if (!note.trim()) return;
        }
        setBusyId(r._id);
        try {
            const res = await axiosInstance.post(`/customizations/${r._id}/respond`, { action, note });
            replace(res.data?.result);
            toast.success(action === 'APPROVE' ? 'Quotation approved. Please complete the payment.' : 'Revision request sent to the seller');
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Could not save your response');
        } finally { setBusyId(null); }
    };

    const chooseCod = async (r) => {
        setBusyId(r._id);
        try {
            const res = await axiosInstance.post(`/customizations/${r._id}/cod`);
            replace(res.data?.result);
            toast.success('Confirmed with Cash on Delivery');
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Could not confirm COD');
        } finally { setBusyId(null); }
    };

    const payOnline = async (r) => {
        setBusyId(r._id);
        try {
            toast.loading('Initiating Gateway...', { id: 'cus-pay' });
            const ok = await loadRazorpay();
            if (!ok) throw new Error('Payment gateway could not load');
            const res = await axiosInstance.post(`/customizations/${r._id}/payment/order`);
            const order = res.data?.result;
            if (!order?.id) throw new Error('Failed to create payment order');
            toast.dismiss('cus-pay');
            const rzp = new window.Razorpay({
                key: order.keyId,
                amount: order.amount,
                currency: 'INR',
                name: 'Jalpaino Events',
                description: `Payment for Customization ${r.requestId}`,
                order_id: order.id,
                handler: async (response) => {
                    try {
                        toast.loading('Verifying payment...', { id: 'cus-pay' });
                        const v = await axiosInstance.post(`/customizations/${r._id}/payment/verify`, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        replace(v.data?.result);
                        toast.success('Payment successful!', { id: 'cus-pay' });
                    } catch (err) {
                        toast.error(err?.response?.data?.message || 'Payment verification failed', { id: 'cus-pay' });
                    }
                },
                theme: { color: '#9333ea' },
            });
            rzp.on('payment.failed', (resp) => toast.error(`Payment failed: ${resp?.error?.description || ''}`, { id: 'cus-pay' }));
            rzp.open();
        } catch (e) {
            toast.error(e?.response?.data?.message || e.message || 'Could not start payment', { id: 'cus-pay' });
        } finally { setBusyId(null); }
    };

    if (items.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Customization Requests</h3>
            {items.map((r) => {
                const [label, color] = STATUS[r.status] || [r.status, 'bg-slate-100 text-slate-600 border-slate-200'];
                const d = r.details || {};
                const total = Number(r.quotation?.amount) || 0;
                const pct = Number(r.advancePaymentPercentage) || 0;
                const advance = pct > 0 ? Math.round((total * pct) / 100) : total;
                const cod = Number(r.codAmountCollected) || 0;
                const online = Math.max(0, (Number(r.amountPaid) || 0) - cod);
                const paid = Math.min(total, cod + online);
                const balance = Math.max(0, total - paid);
                const isCod = r.paymentMode === 'COD';
                const busy = busyId === r._id;
                const rows = [
                    isCod && paid <= 0 && pct > 0 && advance < total && [`Advance to pay in Cash (${pct}%)`, advance, 'text-purple-700'],
                    online > 0 && ['Paid Online', online, 'text-purple-700'],
                    cod > 0 && ['Paid in Cash (COD)', cod, 'text-emerald-700'],
                    ['Total Paid', paid, 'text-slate-900'],
                    balance > 0 && [isCod ? 'Balance Due (Cash)' : 'Balance Due', balance, 'text-amber-700'],
                ].filter(Boolean);
                return (
                    <div key={r._id} className={`bg-white rounded-2xl border p-4 shadow-sm ${String(focusId) === String(r._id) ? 'border-purple-400 ring-2 ring-purple-200' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-purple-700">#{r.requestId}</p>
                                <p className="text-sm font-black text-slate-900 truncate">{r.seller?.shopName || r.seller?.name || 'Seller'}</p>
                                <p className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border shrink-0 ${color}`}>{label}</span>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                            {d.decorationType && <p><span className="font-bold text-slate-500">Decoration:</span> {d.decorationType}</p>}
                            {d.theme && <p><span className="font-bold text-slate-500">Theme:</span> {d.theme}</p>}
                            {Number(d.budget) > 0 && <p><span className="font-bold text-slate-500">Budget:</span> {rs(d.budget)}</p>}
                            {d.colors?.length > 0 && (
                                <p className="flex flex-wrap items-center gap-1"><span className="font-bold text-slate-500">Colors:</span>
                                    {d.colors.map((c, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 border border-slate-200 rounded px-1.5 py-0.5">
                                            <span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: c }} />{c}
                                        </span>
                                    ))}
                                </p>
                            )}
                            {d.notes && <p className="sm:col-span-2"><span className="font-bold text-slate-500">Notes:</span> {d.notes}</p>}
                        </div>
                        {d.referencePhotoUrl && (
                            <a href={resolveImageUrl(d.referencePhotoUrl)} target="_blank" rel="noreferrer" className="inline-block mt-2">
                                <img src={resolveImageUrl(d.referencePhotoUrl)} alt="Reference" className="h-24 rounded-lg border border-slate-200 object-cover" />
                            </a>
                        )}

                        {total > 0 && (
                            <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                                <p className="text-xs font-black text-indigo-900">Final Quotation: {rs(total)}</p>
                                {r.quotation?.note && <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{r.quotation.note}</p>}
                                {r.status === 'REVISION_REQUESTED' && r.quotation?.revisionNote && <p className="text-[11px] text-amber-700 mt-1">Your revision request: {r.quotation.revisionNote}</p>}
                            </div>
                        )}
                        {r.status === 'REJECTED' && r.sellerNote && <p className="mt-2 text-xs text-rose-700">Seller note: {r.sellerNote}</p>}

                        {r.status === 'QUOTED' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button disabled={busy} onClick={() => respond(r, 'APPROVE')} className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold disabled:opacity-50">Approve Quotation</button>
                                <button disabled={busy} onClick={() => respond(r, 'REQUEST_REVISION')} className="px-4 py-2 rounded-xl border border-amber-300 bg-white text-amber-800 text-xs font-bold disabled:opacity-50">Request Revision</button>
                            </div>
                        )}

                        {r.status === 'APPROVED' && paid <= 0 && (
                            <div className="mt-3 flex gap-2 flex-col sm:flex-row">
                                <button disabled={busy} onClick={() => chooseCod(r)} className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50">Cash on Delivery</button>
                                <button disabled={busy} onClick={() => payOnline(r)} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold disabled:opacity-50">
                                    <CreditCard className="h-4 w-4" /> Pay {rs(Math.min(advance, total))} Online
                                </button>
                            </div>
                        )}

                        {r.status === 'CONFIRMED' && (
                            <>
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 space-y-1">
                                    {rows.map(([l, v, c]) => (
                                        <div key={l} className="flex justify-between items-center gap-3">
                                            <span className="text-[11px] font-semibold text-slate-500">{l}</span>
                                            <span className={`text-xs font-extrabold ${c}`}>{rs(v)}/-</span>
                                        </div>
                                    ))}
                                </div>
                                {!isCod && balance > 0 && (
                                    <button disabled={busy} onClick={() => payOnline(r)} className="mt-2 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-xs font-bold disabled:opacity-50">
                                        <CreditCard size={14} /> Pay Remaining {rs(balance)} Online
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default CustomizationRequestsList;
