import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import axiosInstance from '@core/api/axios';
import { useToast } from '@shared/components/ui/Toast';
import { Activity, Database, Server, HardDrive, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const OperationsDashboard = () => {
    const { showToast } = useToast();
    const [health, setHealth] = useState(null);
    const [logs, setLogs] = useState([]);
    const [maintenanceSettings, setMaintenanceSettings] = useState({
        maintenanceMode: false,
        maintenanceMessage: ''
    });

    useEffect(() => {
        fetchHealth();
        fetchLogs();
        fetchSettings();
        
        const interval = setInterval(() => {
            fetchHealth();
        }, 30000); // refresh every 30s
        
        return () => clearInterval(interval);
    }, []);

    const fetchHealth = async () => {
        try {
            const res = await axiosInstance.get('/admin/operations/health');
            if (res.data.success) {
                setHealth(res.data.result);
            }
        } catch (error) {
            console.error("Failed to fetch health", error);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await axiosInstance.get('/admin/operations/logs?limit=10');
            if (res.data.success) {
                setLogs(res.data.results || res.data.result || []);
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await adminApi.getSettings();
            if (res.data.success) {
                setMaintenanceSettings({
                    maintenanceMode: res.data.result?.maintenanceMode || false,
                    maintenanceMessage: res.data.result?.maintenanceMessage || ''
                });
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        }
    };

    const handleToggleMaintenance = async () => {
        if (!window.confirm(`Are you sure you want to turn ${maintenanceSettings.maintenanceMode ? 'OFF' : 'ON'} maintenance mode?`)) return;
        
        try {
            const updated = !maintenanceSettings.maintenanceMode;
            const res = await adminApi.updateSettings({ maintenanceMode: updated });
            if (res.data.success) {
                setMaintenanceSettings(prev => ({ ...prev, maintenanceMode: updated }));
                showToast(`Maintenance mode turned ${updated ? 'ON' : 'OFF'}`, 'success');
            }
        } catch (error) {
            showToast('Failed to update maintenance mode', 'error');
        }
    };

    if (!health) return <div className="p-10 text-center font-bold text-slate-500">Loading Operations Center...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Platform Operations Center</h2>
                    <p className="text-sm font-bold text-slate-500 mt-1">Real-time monitoring and DevOps controls</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-bold text-slate-600">Maintenance Mode</span>
                    <button 
                        onClick={handleToggleMaintenance}
                        className={`relative w-12 h-6 rounded-full transition-colors ${maintenanceSettings.maintenanceMode ? 'bg-rose-500' : 'bg-slate-200'}`}
                    >
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${maintenanceSettings.maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className={`bg-white rounded-2xl p-5 border shadow-sm transition-all duration-300 ${maintenanceSettings.maintenanceMode ? 'border-rose-500 shadow-rose-100 bg-rose-50/10' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${maintenanceSettings.maintenanceMode ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {maintenanceSettings.maintenanceMode ? <AlertTriangle className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
                        </div>
                        <Badge variant={maintenanceSettings.maintenanceMode ? 'danger' : (health.status === 'Healthy' ? 'success' : 'danger')}>
                            {maintenanceSettings.maintenanceMode ? 'Offline' : health.status}
                        </Badge>
                    </div>
                    <p className={`text-sm font-bold transition-colors ${maintenanceSettings.maintenanceMode ? 'text-rose-500' : 'text-slate-500'}`}>System Status</p>
                    <h3 className={`text-xl font-black mt-1 transition-colors ${maintenanceSettings.maintenanceMode ? 'text-rose-600' : 'text-slate-900'}`}>
                        {maintenanceSettings.maintenanceMode ? 'Under Maintenance' : 'Operational'}
                    </h3>
                </Card>
                
                <Card className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                            <Database className="h-5 w-5" />
                        </div>
                        <Badge variant={health.database === 'Connected' ? 'success' : 'danger'}>{health.database}</Badge>
                    </div>
                    <p className="text-sm font-bold text-slate-500">Database Engine</p>
                    <h3 className="text-xl font-black text-slate-900 mt-1">MongoDB Atlas</h3>
                </Card>

                <Card className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                            <HardDrive className="h-5 w-5" />
                        </div>
                        <Badge variant="success">Connected</Badge>
                    </div>
                    <p className="text-sm font-bold text-slate-500">Storage Engine</p>
                    <h3 className="text-xl font-black text-slate-900 mt-1">Multer Local</h3>
                </Card>

                <Card className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="h-10 w-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <Badge variant={health.activeIncidents > 0 ? 'danger' : 'success'}>
                            {health.activeIncidents > 0 ? 'Action Required' : 'All Clear'}
                        </Badge>
                    </div>
                    <p className="text-sm font-bold text-slate-500">Active Critical Incidents</p>
                    <h3 className="text-xl font-black text-slate-900 mt-1">{health.activeIncidents}</h3>
                </Card>
            </div>

            <Card className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">System Error Logs</h3>
                        <p className="text-xs font-bold text-slate-500 mt-1">Real-time alerts and exceptions</p>
                    </div>
                    <Badge variant="secondary" className="font-bold">{health.errorCount24h} errors in 24h</Badge>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="py-3 px-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Time</th>
                                <th className="py-3 px-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Level</th>
                                <th className="py-3 px-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Category</th>
                                <th className="py-3 px-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Message</th>
                                <th className="py-3 px-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-sm font-bold text-slate-400">
                                        No recent system logs.
                                    </td>
                                </tr>
                            ) : logs.map(log => (
                                <tr key={log._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 px-5 text-xs font-bold text-slate-500 whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleTimeString()}
                                    </td>
                                    <td className="py-3 px-5">
                                        <Badge variant={log.level === 'critical' || log.level === 'error' ? 'danger' : log.level === 'warning' ? 'warning' : 'secondary'} className="text-[10px] uppercase">
                                            {log.level}
                                        </Badge>
                                    </td>
                                    <td className="py-3 px-5 text-xs font-bold text-slate-700 capitalize">
                                        {log.category}
                                    </td>
                                    <td className="py-3 px-5 text-sm font-medium text-slate-900 max-w-md truncate">
                                        {log.message}
                                    </td>
                                    <td className="py-3 px-5">
                                        {log.resolved ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                                                <CheckCircle size={12} /> Resolved
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                                                <Clock size={12} /> Open
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default OperationsDashboard;
