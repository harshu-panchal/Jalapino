import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sellerPackageApi } from '../../services/sellerPackageApi';
import {
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    IconButton,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Switch,
    FormControlLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const EventPackages = () => {
    const [templates, setTemplates] = useState([]);
    const [myPackages, setMyPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    
    const [form, setForm] = useState({
        templateId: '',
        categoryId: '',
        pricing: '',
        customDescription: '',
        availability: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [templatesRes, packagesRes] = await Promise.all([
                sellerPackageApi.getTemplates(),
                sellerPackageApi.getMyPackages()
            ]);
            setTemplates(templatesRes || []);
            setMyPackages(packagesRes || []);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (pkg = null) => {
        if (pkg) {
            setForm({
                id: pkg._id,
                templateId: pkg.template?._id || pkg.template,
                categoryId: pkg.category?._id || pkg.category,
                pricing: pkg.pricing,
                customDescription: pkg.customDescription || '',
                availability: pkg.availability
            });
        } else {
            setForm({
                templateId: '',
                categoryId: '',
                pricing: '',
                customDescription: '',
                availability: true
            });
        }
        setModalOpen(true);
    };

    const handleTemplateChange = (templateId) => {
        const selectedTpl = templates.find(t => t._id === templateId);
        if (selectedTpl) {
            setForm({ ...form, templateId, categoryId: selectedTpl.category?._id || selectedTpl.category });
        }
    };

    const handleSave = async () => {
        if (!form.templateId || !form.pricing) {
            alert("Template and Price are required.");
            return;
        }
        try {
            await sellerPackageApi.savePackage(form);
            setModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving package");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this package?")) {
            try {
                await sellerPackageApi.deletePackage(id);
                fetchData();
            } catch (error) {
                alert(error.response?.data?.message || "Error deleting package");
            }
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto font-sans">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Event Packages</h1>
                    <p className="text-sm text-slate-500">Configure the pricing for the packages you offer.</p>
                </div>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()} className="!bg-brand-600">
                    Add My Package
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><CircularProgress /></div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {myPackages.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">
                            No packages configured yet. Click "Add My Package" to start.
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 font-semibold text-slate-600">Package Name</th>
                                    <th className="p-4 font-semibold text-slate-600">Category</th>
                                    <th className="p-4 font-semibold text-slate-600">My Price</th>
                                    <th className="p-4 font-semibold text-slate-600">Status</th>
                                    <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myPackages.map(pkg => (
                                    <tr key={pkg._id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-4 font-medium text-slate-800">{pkg.template?.packageName || 'Unknown'}</td>
                                        <td className="p-4 text-slate-600">{pkg.category?.name || 'Unknown'}</td>
                                        <td className="p-4 font-bold text-brand-600">₹{pkg.pricing}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${pkg.availability ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {pkg.availability ? 'Available' : 'Hidden'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <IconButton size="small" onClick={() => handleOpenModal(pkg)} className="!text-blue-600">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleDelete(pkg._id)} className="!text-red-600">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>{form.id ? 'Edit Package Details' : 'Configure New Package'}</DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
                    {templates.length === 0 ? (
                        <div className="bg-orange-50 text-orange-700 p-3 rounded-lg text-sm border border-orange-200">
                            No templates are available for your business categories yet. Please wait for Admin to add them.
                        </div>
                    ) : (
                        <>
                            <FormControl fullWidth variant="outlined">
                                <InputLabel>Select Admin Template</InputLabel>
                                <Select
                                    value={form.templateId}
                                    label="Select Admin Template"
                                    onChange={e => handleTemplateChange(e.target.value)}
                                    disabled={!!form.id} // Cannot change template while editing
                                >
                                    {templates
                                        .filter(tpl => !!form.id || !myPackages.find(p => (p.template?._id || p.template) === tpl._id))
                                        .map(tpl => (
                                        <MenuItem key={tpl._id} value={tpl._id}>{tpl.packageName} ({tpl.category?.name})</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <TextField
                                fullWidth label="Your Price (₹)"
                                type="number"
                                variant="outlined"
                                value={form.pricing}
                                onChange={e => setForm({ ...form, pricing: e.target.value })}
                            />

                            <TextField
                                fullWidth label="Custom Description (Optional)"
                                variant="outlined" multiline rows={3}
                                placeholder="Add anything special about your version of this package..."
                                value={form.customDescription}
                                onChange={e => setForm({ ...form, customDescription: e.target.value })}
                            />

                            <FormControlLabel
                                control={<Switch checked={form.availability} onChange={e => setForm({ ...form, availability: e.target.checked })} color="primary" />}
                                label={<span className="font-medium">Available for Booking</span>}
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setModalOpen(false)} color="inherit">Cancel</Button>
                    <Button onClick={handleSave} variant="contained" disabled={templates.length === 0} className="!bg-brand-600">Save Package</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default EventPackages;

