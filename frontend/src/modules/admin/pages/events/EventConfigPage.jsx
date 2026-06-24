import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Button, 
    TextField, 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    IconButton,
    Tabs,
    Tab,
    Box,
    Switch,
    FormControlLabel,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    InputAdornment
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { adminEventConfigApi } from '../../services/adminEventConfigApi';
import CircularProgress from '@mui/material/CircularProgress';
import PackageTemplatesTab from './PackageTemplatesTab';
import EventPayoutsTab from './EventPayoutsTab';

function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div hidden={value !== index} {...other} className="py-6">
            {value === index && children}
        </div>
    );
}

const EventConfigPage = () => {
    const [tabValue, setTabValue] = useState(() => {
        const savedTab = localStorage.getItem('adminEventConfigTab');
        return savedTab !== null ? parseInt(savedTab, 10) : 0;
    });

    useEffect(() => {
        localStorage.setItem('adminEventConfigTab', tabValue);
    }, [tabValue]);
    const [loading, setLoading] = useState(false);
    
    // States for Event Types
    const [eventTypes, setEventTypes] = useState([]);
    const [typeModalOpen, setTypeModalOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [typeForm, setTypeForm] = useState({ name: '', value: '', sortOrder: 1, isActive: true });

    // States for Categories
    const [categories, setCategories] = useState([]);
    const [catModalOpen, setCatModalOpen] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
    const [catForm, setCatForm] = useState({ name: '', icon: '', sortOrder: 1, isActive: true, fields: [], activePlugins: [] });
    const [uploadingIcon, setUploadingIcon] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [types, cats] = await Promise.all([
                adminEventConfigApi.getEventTypes(),
                adminEventConfigApi.getEventCategories()
            ]);
            setEventTypes(types);
            setCategories(cats);
        } catch (error) {
            console.error("Failed to fetch event configs", error);
            alert("Error loading data");
        } finally {
            setLoading(false);
        }
    };

    // ---- Event Type Handlers ----

    const handleOpenTypeModal = (type = null) => {
        if (type) {
            setEditingType(type);
            setTypeForm({ name: type.name, value: type.value, sortOrder: type.sortOrder, isActive: type.isActive });
        } else {
            setEditingType(null);
            setTypeForm({ name: '', value: '', sortOrder: 1, isActive: true });
        }
        setTypeModalOpen(true);
    };

    const handleSaveType = async () => {
        try {
            if (editingType) {
                await adminEventConfigApi.updateEventType(editingType._id, typeForm);
            } else {
                await adminEventConfigApi.createEventType(typeForm);
            }
            setTypeModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving event type");
        }
    };

    const handleDeleteType = async (id) => {
        if (window.confirm("Are you sure you want to delete this event type?")) {
            try {
                await adminEventConfigApi.deleteEventType(id);
                fetchData();
            } catch (error) {
                alert(error.response?.data?.message || "Error deleting event type");
            }
        }
    };

    // ---- Category Handlers ----

    const handleOpenCatModal = (cat = null) => {
        if (cat) {
            setEditingCat(cat);
            setCatForm({ 
                name: cat.name, 
                icon: cat.icon, 
                sortOrder: cat.sortOrder, 
                isActive: cat.isActive, 
                fields: cat.fields || [],
                activePlugins: cat.activePlugins || []
            });
        } else {
            setEditingCat(null);
            setCatForm({ name: '', icon: '', sortOrder: 1, isActive: true, fields: [], activePlugins: [] });
        }
        setCatModalOpen(true);
    };

    const handlePluginToggle = (pluginKey) => {
        setCatForm(prev => {
            const current = prev.activePlugins || [];
            if (current.includes(pluginKey)) {
                return { ...prev, activePlugins: current.filter(k => k !== pluginKey) };
            } else {
                return { ...prev, activePlugins: [...current, pluginKey] };
            }
        });
    };

    const handleSaveCategory = async () => {
        try {
            if (editingCat) {
                await adminEventConfigApi.updateEventCategory(editingCat._id, catForm);
            } else {
                await adminEventConfigApi.createEventCategory(catForm);
            }
            setCatModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || "Error saving category");
        }
    };

    const handleIconUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingIcon(true);
        try {
            const url = await adminEventConfigApi.uploadIcon(file);
            if (url) {
                setCatForm(prev => ({ ...prev, icon: url }));
            }
        } catch (error) {
            console.error("Upload error", error);
            alert("Failed to upload image. Please try again.");
        } finally {
            setUploadingIcon(false);
        }
    };

    const handleDeleteCategory = async (id) => {
        if (window.confirm("Are you sure you want to delete this category?")) {
            try {
                await adminEventConfigApi.deleteEventCategory(id);
                fetchData();
            } catch (error) {
                alert(error.response?.data?.message || "Error deleting category");
            }
        }
    };

    const handleAddField = () => {
        setCatForm({
            ...catForm,
            fields: [...catForm.fields, { fieldName: '', fieldType: 'TEXT', isRequired: false, options: [], sortOrder: catForm.fields.length + 1 }]
        });
    };

    const handleRemoveField = (index) => {
        const newFields = [...catForm.fields];
        newFields.splice(index, 1);
        setCatForm({ ...catForm, fields: newFields });
    };

    const handleFieldChange = (index, key, value) => {
        const newFields = [...catForm.fields];
        newFields[index][key] = value;
        setCatForm({ ...catForm, fields: newFields });
    };

    if (loading) return <div className="p-8 flex justify-center"><CircularProgress /></div>;

    return (
        <div className="p-6 max-w-6xl mx-auto font-sans">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Event Configuration</h1>
                    <p className="text-slate-500">Manage event types, services, and dynamic preference forms.</p>
                </div>
            </div>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
                    <Tab label="Event Types" />
                    <Tab label="Service Categories & Forms" />
                    <Tab label="Package Templates" />
                    <Tab label="Event Payouts" />
                </Tabs>
            </Box>

            {/* Event Types Tab */}
            <TabPanel value={tabValue} index={0}>
                <div className="flex justify-end mb-4">
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenTypeModal()} className="!bg-purple-600">
                        Add Event Type
                    </Button>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="p-4">Name</th>
                                <th className="p-4">Value (Key)</th>
                                <th className="p-4">Order</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {eventTypes.map(type => (
                                <tr key={type._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-medium text-slate-800">{type.name}</td>
                                    <td className="p-4 text-slate-500">{type.value}</td>
                                    <td className="p-4">{type.sortOrder}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${type.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {type.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <IconButton size="small" onClick={() => handleOpenTypeModal(type)} className="!text-blue-600">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => handleDeleteType(type._id)} className="!text-red-600">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </td>
                                </tr>
                            ))}
                            {eventTypes.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500">No event types found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </TabPanel>

            {/* Categories Tab */}
            <TabPanel value={tabValue} index={1}>
                <div className="flex justify-end mb-4">
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenCatModal()} className="!bg-purple-600">
                        Add Service Category
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map(cat => (
                        <motion.div key={cat._id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="text-3xl bg-slate-50 w-12 h-12 flex items-center justify-center rounded-xl border border-slate-100 overflow-hidden">
                                        {(cat.icon?.startsWith('http') || cat.icon?.startsWith('/')) ? (
                                            <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                                        ) : (
                                            cat.icon
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{cat.name}</h3>
                                        <span className={`text-xs font-bold ${cat.isActive ? 'text-green-600' : 'text-red-600'}`}>
                                            {cat.isActive ? 'Active' : 'Inactive'} (Order: {cat.sortOrder})
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <IconButton size="small" onClick={() => handleOpenCatModal(cat)} className="!bg-blue-50 !text-blue-600">
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDeleteCategory(cat._id)} className="!bg-red-50 !text-red-600">
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 rounded-lg p-3 flex-1">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Form Fields ({cat.fields?.length || 0})</h4>
                                {cat.fields && cat.fields.length > 0 ? (
                                    <ul className="space-y-2">
                                        {cat.fields.map((f, i) => (
                                            <li key={i} className="flex justify-between items-center text-sm border-b border-slate-200 pb-1 last:border-0">
                                                <span className="font-medium text-slate-700">{f.fieldName}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{f.fieldType}</span>
                                                    {f.isRequired && <span className="text-[10px] text-red-500 font-bold">*</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-slate-400">No preference fields defined.</p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </TabPanel>

            {/* Event Type Modal */}
            <Dialog 
                open={typeModalOpen} 
                onClose={() => setTypeModalOpen(false)} 
                maxWidth="sm" 
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2, padding: { xs: 1, sm: 2 } }
                }}
            >
                <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                    {editingType ? 'Edit Event Type' : 'Add Event Type'}
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
                        <TextField 
                            fullWidth label="Event Name" 
                            variant="outlined"
                            value={typeForm.name} 
                            onChange={e => setTypeForm({...typeForm, name: e.target.value})} 
                        />
                        <TextField 
                            fullWidth label="Value/Key (e.g. wedding)" 
                            variant="outlined"
                            value={typeForm.value} 
                            onChange={e => setTypeForm({...typeForm, value: e.target.value})} 
                        />
                        <TextField 
                            fullWidth type="number" label="Sort Order" 
                            variant="outlined"
                            value={typeForm.sortOrder} 
                            onChange={e => setTypeForm({...typeForm, sortOrder: Number(e.target.value)})} 
                        />
                        <FormControlLabel
                            control={<Switch checked={typeForm.isActive} onChange={e => setTypeForm({...typeForm, isActive: e.target.checked})} color="primary" />}
                            label={<span className="font-medium text-slate-700">Active Status</span>}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button onClick={() => setTypeModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Cancel</Button>
                    <Button onClick={handleSaveType} variant="contained" className="!bg-purple-600" sx={{ borderRadius: 2, px: 3 }}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Category Modal */}
            <Dialog 
                open={catModalOpen} 
                onClose={() => setCatModalOpen(false)} 
                maxWidth="md" 
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2, padding: { xs: 1, sm: 2 } }
                }}
            >
                <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                    {editingCat ? 'Edit Service Category' : 'Add Service Category'}
                </DialogTitle>
                <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 4, pt: 1 }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField 
                                fullWidth label="Category Name" 
                                variant="outlined"
                                value={catForm.name} 
                                onChange={e => setCatForm({...catForm, name: e.target.value})} 
                            />
                            <div className="flex flex-col gap-2">
                                <span className="text-sm text-slate-600 font-medium">Category Image</span>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 shrink-0 rounded-lg border-2 border-dashed border-slate-300 overflow-hidden bg-slate-50 flex items-center justify-center relative group cursor-pointer" onClick={() => document.getElementById('icon-upload-button').click()}>
                                        {catForm.icon ? (
                                            <img src={catForm.icon} alt="Category" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-slate-400">No Image</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {uploadingIcon ? <CircularProgress size={20} color="inherit" /> : <EditIcon className="text-white" fontSize="small" />}
                                        </div>
                                    </div>
                                    <div>
                                        <input
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id="icon-upload-button"
                                            type="file"
                                            onChange={handleIconUpload}
                                        />
                                        <label htmlFor="icon-upload-button" className="m-0 cursor-pointer">
                                            <Button
                                                variant="outlined"
                                                component="span"
                                                disabled={uploadingIcon}
                                                startIcon={uploadingIcon ? <CircularProgress size={16} /> : <UploadFileIcon />}
                                            >
                                                {catForm.icon ? "Change Image" : "Upload Image"}
                                            </Button>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField 
                                fullWidth type="number" label="Sort Order" 
                                variant="outlined"
                                value={catForm.sortOrder} 
                                onChange={e => setCatForm({...catForm, sortOrder: Number(e.target.value)})} 
                            />
                            <div className="flex items-center pl-1">
                                <FormControlLabel
                                    control={<Switch checked={catForm.isActive} onChange={e => setCatForm({...catForm, isActive: e.target.checked})} color="primary" />}
                                    label={<span className="font-medium text-slate-700">Active Status</span>}
                                />
                            </div>
                        </div>
                    </Box>

                    <div className="border-t border-slate-200 pt-6 mt-2 mb-6">
                        <h3 className="font-bold text-lg text-slate-800 mb-4">Platform Features (Plugins)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <FormControlLabel
                                control={<Switch checked={(catForm.activePlugins || []).includes('package_builder')} onChange={() => handlePluginToggle('package_builder')} color="primary" />}
                                label={<span className="text-sm font-medium">Package Builder</span>}
                            />
                            <FormControlLabel
                                control={<Switch checked={(catForm.activePlugins || []).includes('venue_visit')} onChange={() => handlePluginToggle('venue_visit')} color="primary" />}
                                label={<span className="text-sm font-medium">Venue Visit</span>}
                            />
                            <FormControlLabel
                                control={<Switch checked={(catForm.activePlugins || []).includes('ingredient_transparency')} onChange={() => handlePluginToggle('ingredient_transparency')} color="primary" />}
                                label={<span className="text-sm font-medium">Ingredient Transparency</span>}
                            />
                            <FormControlLabel
                                control={<Switch checked={(catForm.activePlugins || []).includes('availability_calendar')} onChange={() => handlePluginToggle('availability_calendar')} color="primary" />}
                                label={<span className="text-sm font-medium">Availability Calendar</span>}
                            />
                            <FormControlLabel
                                control={<Switch checked={(catForm.activePlugins || []).includes('quantity_calculator')} onChange={() => handlePluginToggle('quantity_calculator')} color="primary" />}
                                label={<span className="text-sm font-medium">Quantity Calculator</span>}
                            />
                            <FormControlLabel
                                control={<Switch checked={(catForm.activePlugins || []).includes('subscription')} onChange={() => handlePluginToggle('subscription')} color="primary" />}
                                label={<span className="text-sm font-medium">Subscription Module</span>}
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-800">Dynamic Preference Form Fields</h3>
                            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddField}>
                                Add Field
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {catForm.fields.map((field, index) => (
                                <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
                                    <IconButton 
                                        size="small" 
                                        onClick={() => handleRemoveField(index)} 
                                        className="!absolute -top-2 -right-2 !bg-white !text-red-500 !shadow-md"
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                        <div className="sm:col-span-4">
                                            <TextField 
                                                fullWidth size="small" label="Field Name (e.g. Theme Color)" 
                                                variant="outlined"
                                                value={field.fieldName} 
                                                onChange={e => handleFieldChange(index, 'fieldName', e.target.value)} 
                                            />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <FormControl fullWidth size="small" variant="outlined">
                                                <InputLabel>Type</InputLabel>
                                                <Select
                                                    value={field.fieldType}
                                                    label="Type"
                                                    onChange={e => handleFieldChange(index, 'fieldType', e.target.value)}
                                                >
                                                    <MenuItem value="TEXT">Text</MenuItem>
                                                    <MenuItem value="TEXTAREA">Textarea</MenuItem>
                                                    <MenuItem value="SELECT">Select</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </div>
                                        <div className="sm:col-span-2 flex items-center justify-start sm:justify-center">
                                            <FormControlLabel
                                                control={<Switch size="small" checked={field.isRequired} onChange={e => handleFieldChange(index, 'isRequired', e.target.checked)} />}
                                                label={<span className="text-sm font-medium">Required</span>}
                                            />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <TextField 
                                                fullWidth size="small" type="number" label="Sort Order" 
                                                variant="outlined"
                                                value={field.sortOrder || 1} 
                                                onChange={e => handleFieldChange(index, 'sortOrder', Number(e.target.value))} 
                                            />
                                        </div>
                                    </div>

                                    {field.fieldType === 'SELECT' && (
                                        <div className="mt-3">
                                            <TextField 
                                                fullWidth size="small" 
                                                label="Options (Comma separated)" 
                                                helperText="e.g. Yes,No  or  Veg,Non-Veg"
                                                value={field.options?.join(',') || ''} 
                                                onChange={e => handleFieldChange(index, 'options', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} 
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {catForm.fields.length === 0 && (
                                <p className="text-center text-slate-500 py-4 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                    No fields added yet. Click 'Add Field' to start building the form.
                                </p>
                            )}
                        </div>
                    </div>
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button onClick={() => setCatModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Cancel</Button>
                    <Button onClick={handleSaveCategory} variant="contained" className="!bg-purple-600" sx={{ borderRadius: 2, px: 3 }}>Save Configuration</Button>
                </DialogActions>
            </Dialog>

            {/* Package Templates Tab */}
            <TabPanel value={tabValue} index={2}>
                <PackageTemplatesTab categories={categories} />
            </TabPanel>

            {/* Event Payouts Tab */}
            <TabPanel value={tabValue} index={3}>
                <EventPayoutsTab />
            </TabPanel>

        </div>
    );
};

export default EventConfigPage;
