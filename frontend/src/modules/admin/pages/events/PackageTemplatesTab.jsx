import React, { useState, useEffect } from 'react';
import {
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Switch,
    FormControlLabel,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    CircularProgress
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { adminEventConfigApi } from '../../services/adminEventConfigApi';

const PackageTemplatesTab = ({ categories }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Form state
    const [form, setForm] = useState({
        category: '',
        packageName: '',
        description: '',
        includedFeatures: '',
        optionalFeatures: '',
        isActive: true
    });

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const data = await adminEventConfigApi.getPackageTemplates();
            setTemplates(data);
        } catch (error) {
            console.error("Failed to fetch templates", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (template = null) => {
        if (template) {
            setEditingTemplate(template);
            setForm({
                category: template.category._id || template.category,
                packageName: template.packageName,
                description: template.description || '',
                includedFeatures: template.includedFeatures ? template.includedFeatures.join('\n') : '',
                optionalFeatures: template.optionalFeatures ? template.optionalFeatures.join('\n') : '',
                isActive: template.isActive
            });
        } else {
            setEditingTemplate(null);
            setForm({
                category: '',
                packageName: '',
                description: '',
                includedFeatures: '',
                optionalFeatures: '',
                isActive: true
            });
        }
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.category || !form.packageName) {
            alert("Category and Package Name are required");
            return;
        }

        const payload = {
            ...form,
            includedFeatures: form.includedFeatures.split('\n').filter(f => f.trim() !== ''),
            optionalFeatures: form.optionalFeatures.split('\n').filter(f => f.trim() !== '')
        };

        try {
            if (editingTemplate) {
                await adminEventConfigApi.updatePackageTemplate(editingTemplate._id, payload);
            } else {
                await adminEventConfigApi.createPackageTemplate(payload);
            }
            setModalOpen(false);
            fetchTemplates();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving template");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this template?")) {
            try {
                await adminEventConfigApi.deletePackageTemplate(id);
                fetchTemplates();
            } catch (error) {
                alert(error.response?.data?.message || "Error deleting template");
            }
        }
    };

    // Filter categories to only those with 'package_builder' active
    const packageCategories = categories.filter(c => c.activePlugins && c.activePlugins.includes('package_builder'));

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-slate-500">Master templates that sellers will use to create their own packages.</p>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal()} className="!bg-purple-600">
                    Add Package Template
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><CircularProgress /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="p-4">Package Name</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {templates.map(tpl => (
                                <tr key={tpl._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800">{tpl.packageName}</td>
                                    <td className="p-4 text-slate-500">{tpl.category?.name || 'Unknown'}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {tpl.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <IconButton size="small" onClick={() => handleOpenModal(tpl)} className="!text-blue-600">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleDelete(tpl._id)} className="!text-red-600">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </td>
                                </tr>
                            ))}
                            {templates.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500">No package templates found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, padding: 2 } }}>
                <DialogTitle sx={{ fontWeight: 'bold' }}>{editingTemplate ? 'Edit Package Template' : 'Add Package Template'}</DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>

                    {packageCategories.length === 0 && (
                        <div className="bg-orange-50 text-orange-700 p-3 rounded-lg text-sm mb-2 border border-orange-200 font-medium">
                            Warning: No categories have "Package Builder" plugin enabled yet. Please enable it in Service Categories first.
                        </div>
                    )}

                    <FormControl fullWidth variant="outlined">
                        <InputLabel>Category</InputLabel>
                        <Select
                            value={form.category}
                            label="Category"
                            onChange={e => setForm({ ...form, category: e.target.value })}
                        >
                            {packageCategories.map(cat => (
                                <MenuItem key={cat._id} value={cat._id}>{cat.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        fullWidth label="Package Name (e.g. Premium Decoration)"
                        variant="outlined"
                        value={form.packageName}
                        onChange={e => setForm({ ...form, packageName: e.target.value })}
                    />

                    <TextField
                        fullWidth label="Description"
                        variant="outlined" multiline rows={2}
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                    />

                    <TextField
                        fullWidth label="Included Features (One per line)"
                        variant="outlined" multiline rows={3}
                        placeholder={"Setup labor\nBalloons\nRibbons"}
                        value={form.includedFeatures}
                        onChange={e => setForm({ ...form, includedFeatures: e.target.value })}
                    />

                    <FormControlLabel
                        control={<Switch checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} color="primary" />}
                        label={<span className="font-medium">Active Status</span>}
                    />

                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 3 }}>
                    <Button onClick={() => setModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" className="!bg-purple-600" sx={{ fontWeight: 'bold' }}>Save Template</Button>
                </DialogActions>
            </Dialog>

        </div>
    );
};

export default PackageTemplatesTab;
