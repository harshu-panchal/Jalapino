import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventIcon from '@mui/icons-material/Event';
import CircularProgress from '@mui/material/CircularProgress';
import { eventConfigApi } from '../../services/eventConfigApi';

const PlanMyEventPage = () => {
    const navigate = useNavigate();
    const [eventData, setEventData] = useState({
        eventType: '',
        guestCount: '',
        budget: '',
        date: '',
        time: '',
        location: ''
    });
    const [eventTypes, setEventTypes] = useState([]);
    const [cities, setCities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const [typesRes, citiesRes] = await Promise.all([
                    eventConfigApi.getEventTypes(),
                    eventConfigApi.getCities()
                ]);
                setEventTypes(typesRes || []);
                setCities(citiesRes || []);
            } catch (error) {
                console.error("Failed to fetch event configs:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleStartPlanning = () => {
        if (!eventData.eventType || !eventData.date || !eventData.guestCount) {
            alert("Please fill in event type, date, and guest count.");
            return;
        }
        navigate('/plan-my-event/categories', { state: { eventData } });
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Header */}
            <div className="sticky top-0 left-0 right-0 h-16 bg-white z-50 flex items-center px-4 shadow-sm shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowBackIcon />
                </button>
                <h1 className="ml-2 text-lg font-bold text-slate-800">Plan My Event</h1>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/30">
                                <EventIcon sx={{ color: 'white' }} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Event Details</h2>
                                <p className="text-sm text-slate-500">Tell us about your event to get started</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Event Type</label>
                                <select 
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    value={eventData.eventType}
                                    onChange={(e) => setEventData({...eventData, eventType: e.target.value})}
                                    disabled={isLoading}
                                >
                                    <option value="">{isLoading ? "Loading..." : "Select event type"}</option>
                                    {eventTypes.map(type => (
                                        <option key={type.value} value={type.value}>{type.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                                    <input 
                                        type="date"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800"
                                        value={eventData.date}
                                        onChange={(e) => setEventData({...eventData, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Time</label>
                                    <input 
                                        type="time"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800"
                                        value={eventData.time}
                                        onChange={(e) => setEventData({...eventData, time: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Guest Count</label>
                                    <input 
                                        type="number"
                                        placeholder="e.g. 50"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800"
                                        value={eventData.guestCount}
                                        onChange={(e) => setEventData({...eventData, guestCount: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Budget (₹)</label>
                                    <input 
                                        type="number"
                                        placeholder="e.g. 50000"
                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800"
                                        value={eventData.budget}
                                        onChange={(e) => setEventData({...eventData, budget: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Location</label>
                                <select 
                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-slate-800"
                                    value={eventData.location}
                                    onChange={(e) => setEventData({...eventData, location: e.target.value})}
                                    disabled={isLoading}
                                >
                                    <option value="">{isLoading ? "Loading..." : "Select City"}</option>
                                    {cities.filter(city => city.planMyEventEnabled !== false).map(city => (
                                        <option key={city._id} value={city.cityName}>{city.cityName}, {city.state}</option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                onClick={handleStartPlanning}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold rounded-xl py-4 mt-6 shadow-lg shadow-purple-500/30 hover:scale-[1.02] transition-transform active:scale-95"
                            >
                                Start Planning
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default PlanMyEventPage;
