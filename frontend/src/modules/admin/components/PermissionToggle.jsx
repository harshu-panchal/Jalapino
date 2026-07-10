import React from 'react';
import { cn } from '@/lib/utils';

export const PermissionToggle = ({ label, description, checked, onChange, disabled, activeColor = "bg-emerald-500", hoverColor = "group-hover:text-emerald-600" }) => (
    <label className={cn("flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer group transition-colors shadow-sm", disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-300")}>
        <div className="flex flex-col">
            <span className={cn("text-xs font-bold text-slate-700 transition-colors uppercase tracking-wide", !disabled && hoverColor)}>{label}</span>
            <span className="text-[9px] text-slate-400">{description}</span>
        </div>
        <div className="flex items-center gap-3 ml-4">
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", checked ? "text-emerald-600" : "text-slate-400")}>
                {checked ? 'ON' : 'OFF'}
            </span>
            <div className="relative">
                <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={checked} 
                    onChange={onChange}
                    disabled={disabled}
                />
                <div className={cn("block w-10 h-6 rounded-full transition-colors", checked ? activeColor : "bg-slate-200")}></div>
                <div className={cn("absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm", checked ? "translate-x-4" : "")}></div>
            </div>
        </div>
    </label>
);
