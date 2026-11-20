import React from 'react';
import { toast } from 'sonner';
import axiosInstance from '@core/api/axios';
import { resolveImageUrl } from '@/core/utils/imageUtils';
import { getStoredAuthToken } from '@core/utils/authStorage';
import { onNotificationNew } from '@core/services/orderSocket';

// Seller: Customization & Quotation requests (separate from event bookings).
// Send the final quotation -> customer approves -> customer pays like a booking
// (advance / full online, or COD; the seller saves the cash here).
const STATUS = {
    REQUESTED: ['New Request', 'bg-amber-100 text-amber-800 border-amber-200'],
    QUOTED: ['Quotation Sent', 'bg-indigo-100 text-indigo-800 border-indigo-200'],
    REVISION_REQUESTED: ['Revision Requested', 'bg-amber-100 text-amber-800 border-amber-200'],
    APPROVED: ['Approved · Awaiting Payment', 'bg-purple-100 text-purple-800 border-purple-200'],
    CONFIRMED: ['Confirmed', 'bg-emerald-100 text-emerald-800 border-emerald-200'],
    REJECTED: ['Rejected', 'bg-rose-100 text-rose-800 border-rose-200'],
    CANCELLED: ['Cancelled', 'bg-slate-100 text-slate-600 border-slate-200'],
};
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const SellerCustomizations = () => {
    const focusId = new URLSearchParams(window.location.search).get('id');
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [busyId, setBusyId] = React.useState(null);
    const [quoteForm, setQuoteForm] = React.useState({});

    const load = React.useCallback(async () => {
        try {
            const res = await axiosInstance.get('/customizations/seller/list');
            setItems(Array.isArray(res.data?.result) ? res.data.result : []);
        } catch (e) {
            toast.error('Could not load customization requests');
        } finally { setLoading(false); }
    }, []);
    React.useEffect(() => { load(); }, [load]);
    // Live: new request / customer approved / paid -> reload from DB.
    React.useEffect(() => {
        const getToken = () => getStoredAuthToken('auth_seller');
        if (!getToken()) return undefined;
        const off = onNotificationNew(getToken, (payload) => {
            if (String(payload?.eventType || '').startsWith('EVENT_CUSTOMIZATION')) load();
        });
        return () => { if (typeof off === 'function') off(); };
    }, [load]);

    const replace = (updated) => {
        if (!updated?._id) return;
        setItems(prev => prev.map(r => String(r._id) === String(updated._id) ? { ...r, ...updated, customer: r.customer } : r));
    };

    const run = async (r, fn, okMsg) => {
        setBusyId(r._id);
        try {
            const res = await fn();
            replace(res.data?.result);
            toast.success(okMsg);
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Action failed');
        } finally { setBusyId(null); }
    };

    const sendQuote = (r) => {
        const f = quoteForm[r._id] || {};
        if (!(Number(f.amount) > 0)) { toast.error('Enter the quotation amount'); return; }
        run(r, () => axiosInstance.put(`/customizations/seller/${r._id}/quotation`, { amount: Number(f.amount), note: f.note || '' }), 'Quotation sent to the customer');
    };
    const reject = (r) => {
        const note = window.prompt('Reason for rejecting (optional):');
        if (note === null) return;
        run(r, () => axiosInstance.put(`/customizations/seller/${r._id}/reject`, { note }), 'Request rejected');
    };
    const saveCash = (r, part) => run(r, () => axiosInstance.put(`/customizations/seller/${r._id}/cod-paid`, part ? { part } : {}), 'Cash payment saved');

    if (loading) return <div className="p-10 text-center text-slate-500 font-semibold">Loading…</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Customizations</h1>
                <p className="text-sm text-slate-500 mt-1">Customer customization requests and your quotations (separate from bookings).</p>
            </div>

            {items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">No customization requests yet.</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                        const canQuote = ['REQUESTED', 'REVISION_REQUESTED', 'QUOTED'].includes(r.status);
                        const f = quoteForm[r._id] || {};
                        const rows = [
                            online > 0 && ['Paid Online', online, 'text-purple-700'],
                            cod > 0 && ['Paid in Cash (COD)', cod, 'text-emerald-700'],
                            ['Total Paid', paid, 'text-slate-900'],
                            balance > 0 && [isCod ? 'Balance Due (Cash)' : 'Balance Due', balance, 'text-amber-700'],
                        ].filter(Boolean);
                        return (
                            <div key={r._id} className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm space-y-3 ${String(focusId) === String(r._id) ? 'border-purple-400 ring-2 ring-purple-200' : 'border-slate-200'}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-purple-700">#{r.requestId}</p>
                                        <p className="text-base font-black text-slate-900 truncate">{r.customer?.name || 'Customer'}</p>
                                        <p className="text-xs text-slate-500">{r.customer?.phone || ''} · {new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase shrink-0 ${color}`}>{label}</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
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
                                    <a href={resolveImageUrl(d.referencePhotoUrl)} target="_blank" rel="noreferrer" className="inline-block">
                                        <img src={resolveImageUrl(d.referencePhotoUrl)} alt="Reference" className="h-32 rounded-lg border border-slate-200 object-cover" />
                                    </a>
                                )}

                                {total > 0 && (
                                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                                        <p className="text-xs font-black text-indigo-900">Your Quotation: {rs(total)}{pct > 0 ? ` · Advance ${pct}% = ${rs(advance)}` : ''}</p>
                                        {r.quotation?.note && <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{r.quotation.note}</p>}
                                        {r.status === 'REVISION_REQUESTED' && <p className="text-xs text-amber-700 mt-1">Customer revision request: {r.quotation?.revisionNote || 'No note provided'}</p>}
                                    </div>
                                )}

                                {canQuote && (
                                    <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{total > 0 ? 'Update final quotation' : 'Send final quotation'}</p>
                                        <input
                                            type="number" min="1" placeholder="Quotation amount (₹)"
                                            value={f.amount ?? ''}
                                            onChange={(e) => setQuoteForm(p => ({ ...p, [r._id]: { ...f, amount: e.target.value } }))}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                                        />
                                        <textarea
                                            rows={2} placeholder="Note for the customer (what is included)"
                                            value={f.note ?? ''}
                                            onChange={(e) => setQuoteForm(p => ({ ...p, [r._id]: { ...f, note: e.target.value } }))}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                                        />
                                        <div className="flex gap-2">
                                            <button disabled={busy} onClick={() => sendQuote(r)} className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold disabled:opacity-50">Send Quotation</button>
                                            <button disabled={busy} onClick={() => reject(r)} className="px-4 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-50">Reject</button>
                                        </div>
                                    </div>
                                )}

                                {r.status === 'APPROVED' && (
                                    <p className="text-xs font-semibold text-purple-700">Customer approved your quotation. Waiting for the customer to pay (online or COD).</p>
                                )}

                                {r.status === 'CONFIRMED' && (
                                    <div className="space-y-2">
                                        <p className="text-[11px] font-bold text-slate-500">Payment: {isCod ? 'Cash on Delivery' : 'Online'}{isCod && paid <= 0 && pct > 0 && advance < total ? ` · Advance to collect in cash: ${rs(advance)}` : ''}</p>
                                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 space-y-1 text-xs">
                                            {rows.map(([l, v, c]) => (
                                                <div key={l} className="flex items-center justify-between gap-3">
                                                    <span className="font-semibold text-slate-500">{l}</span>
                                                    <span className={`font-extrabold ${c}`}>{rs(v)}/-</span>
                                                </div>
                                            ))}
                                        </div>
                                        {isCod && balance > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {paid <= 0 && pct > 0 && advance < total && (
                                                    <button disabled={busy} onClick={() => saveCash(r, 'advance')} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold disabled:opacity-50">Save Advance Paid ({rs(advance)} Cash)</button>
                                                )}
                                                <button disabled={busy} onClick={() => saveCash(r)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">Save COD Paid ({rs(balance)})</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {r.status === 'REJECTED' && r.sellerNote && <p className="text-xs text-rose-700">Reason: {r.sellerNote}</p>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SellerCustomizations;
