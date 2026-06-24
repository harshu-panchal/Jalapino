import React, { useState, useEffect } from 'react';
import { 
    Button, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    TextField,
    Box,
    Chip,
    CircularProgress
} from '@mui/material';
import { adminEventPayoutApi } from '../../services/adminEventPayoutApi';

const EventPayoutsTab = () => {
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [selectedPayout, setSelectedPayout] = useState(null);
    const [settleForm, setSettleForm] = useState({
        transactionId: '',
        method: 'Bank Transfer',
        notes: ''
    });
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchPayouts();
    }, []);

    const fetchPayouts = async () => {
        setLoading(true);
        try {
            const data = await adminEventPayoutApi.getPayouts();
            setPayouts(data);
        } catch (error) {
            console.error("Error fetching payouts:", error);
            alert("Failed to load payouts");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSettle = (payout) => {
        setSelectedPayout(payout);
        setSettleForm({ transactionReference: '', method: 'Bank Transfer', notes: '' });
        setSettleModalOpen(true);
    };

    const handleSettle = async () => {
        if (!settleForm.transactionReference) {
            alert("Please enter a transaction ID / Reference");
            return;
        }

        setProcessing(true);
        try {
            await adminEventPayoutApi.settlePayout(selectedPayout._id, settleForm);
            alert("Payout settled successfully!");
            setSettleModalOpen(false);
            fetchPayouts();
        } catch (error) {
            alert(error.response?.data?.message || "Failed to settle payout");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><CircularProgress /></div>;

    return (
        <div className="font-sans">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-sm uppercase tracking-wider">
                            <th className="p-4">Seller</th>
                            <th className="p-4">Event Date</th>
                            <th className="p-4">Total Amount</th>
                            <th className="p-4">Platform Fee</th>
                            <th className="p-4">Seller Payout</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payouts.map(payout => (
                            <tr key={payout._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <p className="font-bold text-slate-800">{payout.sellerId?.name || payout.sellerId?.shopName || 'Unknown'}</p>
                                    <p className="text-xs text-slate-500">{payout.sellerId?.phone || ''}</p>
                                </td>
                                <td className="p-4 text-slate-600 text-sm">
                                    {payout.bookingId?.eventDate ? new Date(payout.bookingId.eventDate).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="p-4 text-slate-800 font-medium">₹{payout.totalAmount}</td>
                                <td className="p-4 text-red-600 font-medium">-₹{payout.commissionDeducted}</td>
                                <td className="p-4 text-green-600 font-bold text-lg">₹{payout.netPayoutAmount}</td>
                                <td className="p-4">
                                    <Chip 
                                        label={payout.status} 
                                        size="small"
                                        color={payout.status === 'PAID' ? 'success' : payout.status === 'PENDING' ? 'warning' : 'default'}
                                        sx={{ fontWeight: 'bold' }}
                                    />
                                </td>
                                <td className="p-4 text-right">
                                    {payout.status === 'PENDING' && (
                                        <Button 
                                            variant="contained" 
                                            size="small" 
                                            color="primary"
                                            onClick={() => handleOpenSettle(payout)}
                                            className="!bg-purple-600 !font-bold"
                                        >
                                            Settle Now
                                        </Button>
                                    )}
                                    {payout.status === 'PAID' && (
                                        <p className="text-xs text-slate-500 font-medium">
                                            Settled on<br/>{new Date(payout.settledAt).toLocaleDateString()}
                                        </p>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {payouts.length === 0 && (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-slate-500">No event payouts found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Settle Modal */}
            <Dialog 
                open={settleModalOpen} 
                onClose={() => setSettleModalOpen(false)} 
                maxWidth="sm" 
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    Process Payout to Seller
                </DialogTitle>
                <DialogContent dividers>
                    {selectedPayout && (
                        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-sm text-slate-500 font-medium mb-1">Paying to:</p>
                            <p className="text-lg font-bold text-slate-800">{selectedPayout.sellerId?.name || selectedPayout.sellerId?.shopName}</p>
                            <p className="text-3xl font-black text-green-600 mt-2">₹{selectedPayout.netPayoutAmount}</p>
                        </div>
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                        <TextField 
                            fullWidth label="Payment Method (e.g., Bank Transfer, UPI)" 
                            variant="outlined"
                            value={settleForm.method} 
                            onChange={e => setSettleForm({...settleForm, method: e.target.value})} 
                        />
                        <TextField 
                            fullWidth label="Transaction ID / UTR Number" 
                            variant="outlined"
                            required
                            value={settleForm.transactionReference} 
                            onChange={e => setSettleForm({...settleForm, transactionReference: e.target.value})} 
                        />
                        <TextField 
                            fullWidth label="Admin Notes (Optional)" 
                            variant="outlined"
                            multiline
                            rows={2}
                            value={settleForm.notes} 
                            onChange={e => setSettleForm({...settleForm, notes: e.target.value})} 
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button onClick={() => setSettleModalOpen(false)} color="inherit" disabled={processing}>Cancel</Button>
                    <Button onClick={handleSettle} variant="contained" color="success" disabled={processing} sx={{ fontWeight: 'bold' }}>
                        {processing ? 'Processing...' : 'Confirm Settlement'}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default EventPayoutsTab;
