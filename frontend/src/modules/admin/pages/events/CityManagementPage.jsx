import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '@core/api/axios';

const CityManagementPage = () => {
    const navigate = useNavigate();
    const [cities, setCities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [newCity, setNewCity] = useState({
        state: '',
        cityName: '',
        readinessStatus: 'Ready',
        isActive: true,
        retailEnabled: true,
        planMyEventEnabled: false,
        wholesaleEnabled: false
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchCities();
    }, []);

    const fetchCities = async () => {
        try {
            const res = await axiosInstance.get('/admin/event-config/cities');
            setCities(res.data?.result || res.data?.results || res.data?.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCity = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axiosInstance.put(`/admin/event-config/cities/${editingId}`, newCity);
                alert('City updated successfully');
                fetchCities();
                // We keep the form in edit mode so the user sees their updated toggles
            } else {
                await axiosInstance.post('/admin/event-config/cities', newCity);
                alert('City added successfully');
                fetchCities();
                setEditingId(null);
                setNewCity({ state: '', cityName: '', readinessStatus: 'Ready', isActive: true, retailEnabled: true, planMyEventEnabled: false, wholesaleEnabled: false });
            }
        } catch (error) {
            alert('Failed to save city');
        }
    };

    const handleEditClick = (city) => {
        setEditingId(city._id);
        setNewCity({
            state: city.state,
            cityName: city.cityName,
            readinessStatus: city.readinessStatus,
            isActive: city.isActive,
            retailEnabled: city.retailEnabled ?? true,
            planMyEventEnabled: city.planMyEventEnabled ?? false,
            wholesaleEnabled: city.wholesaleEnabled ?? false
        });
    };

    const handleDeleteCity = async (id) => {
        if (!window.confirm("Are you sure you want to delete this city?")) return;
        try {
            await axiosInstance.delete(`/admin/event-config/cities/${id}`);
            alert('City deleted');
            fetchCities();
        } catch (error) {
            alert('Failed to delete city');
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100">
                    <ArrowBackIcon />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">City Management</h1>
                    <p className="text-slate-500">Configure City Readiness Engine for Plan My Event</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Edit City' : 'Add New City'}</h2>
                        {editingId && (
                            <button 
                                onClick={() => { setEditingId(null); setNewCity({ state: '', cityName: '', readinessStatus: 'Ready', isActive: true, retailEnabled: true, planMyEventEnabled: false, wholesaleEnabled: false }); }}
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleCreateCity} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">State</label>
                            <input 
                                required
                                type="text"
                                className="w-full border rounded-xl p-2"
                                value={newCity.state}
                                onChange={(e) => setNewCity({...newCity, state: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">City Name</label>
                            <input 
                                required
                                type="text"
                                className="w-full border rounded-xl p-2"
                                value={newCity.cityName}
                                onChange={(e) => setNewCity({...newCity, cityName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Readiness Status</label>
                            <select 
                                className="w-full border rounded-xl p-2"
                                value={newCity.readinessStatus}
                                onChange={(e) => setNewCity({...newCity, readinessStatus: e.target.value})}
                            >
                                <option value="Ready">Ready</option>
                                <option value="Partially Ready">Partially Ready</option>
                                <option value="Not Ready">Not Ready</option>
                            </select>
                        </div>
                        
                        <div className="pt-2 pb-2 border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Module Permissions</p>
                            
                            <label className="flex items-center justify-between mb-3 cursor-pointer">
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">Retail Module</span>
                                    <p className="text-[10px] text-slate-500">Enable Quick Commerce Retail</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={newCity.retailEnabled} onChange={(e) => setNewCity({...newCity, retailEnabled: e.target.checked})} />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">Plan My Event</span>
                                    <p className="text-[10px] text-slate-500">Enable Event Commerce</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={newCity.planMyEventEnabled} onChange={(e) => setNewCity({...newCity, planMyEventEnabled: e.target.checked})} />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between cursor-pointer mt-3">
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">Wholesale Module</span>
                                    <p className="text-[10px] text-slate-500">Enable Wholesale Marketplace</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={newCity.wholesaleEnabled} onChange={(e) => setNewCity({...newCity, wholesaleEnabled: e.target.checked})} />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                </div>
                            </label>
                        </div>

                        <button type="submit" className="w-full bg-purple-600 text-white rounded-xl p-3 font-bold hover:bg-purple-700">
                            {editingId ? 'Update City' : 'Add City'}
                        </button>
                    </form>
                </div>

                {/* List */}
                <div className="md:col-span-2 space-y-4">
                    {cities.map(city => (
                        <div key={city._id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{city.cityName}</h3>
                                <p className="text-sm text-slate-500">{city.state}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${city.retailEnabled ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                                        RETAIL {city.retailEnabled ? 'ON' : 'OFF'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${city.wholesaleEnabled ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                                        WHOLESALE {city.wholesaleEnabled ? 'ON' : 'OFF'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${city.planMyEventEnabled ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>
                                        EVENT {city.planMyEventEnabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="flex gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${city.readinessStatus === 'Ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {city.readinessStatus}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${city.isActive ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                        {city.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center ml-2 border-l pl-2">
                                    <button onClick={() => handleEditClick(city)} className="p-1 text-slate-400 hover:text-blue-600">
                                        <EditIcon fontSize="small" />
                                    </button>
                                    <button onClick={() => handleDeleteCity(city._id)} className="p-1 text-slate-400 hover:text-red-600">
                                        <DeleteIcon fontSize="small" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {cities.length === 0 && !isLoading && (
                        <div className="p-10 text-center text-slate-500">No cities added yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CityManagementPage;
