import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSettings } from '@core/context/SettingsContext';

const CustomerModeContext = createContext();

export const CustomerModeProvider = ({ children }) => {
    const { settings } = useSettings();
    const isWholesaleEnabled = settings?.platformControl?.wholesaleEnabled !== false;

    const [mode, setMode] = useState(() => {
        return localStorage.getItem('customer-shopping-mode') || 'retail';
    });

    // Effect to enforce wholesale enabled setting globally
    useEffect(() => {
        if (!isWholesaleEnabled && mode === 'whole') {
            setMode('retail');
            localStorage.setItem('customer-shopping-mode', 'retail');
        }
    }, [isWholesaleEnabled, mode]);

    const toggleMode = (newMode) => {
        if (newMode !== 'retail' && newMode !== 'whole') return;
        if (newMode === 'whole' && !isWholesaleEnabled) return;

        setMode(newMode);
        localStorage.setItem('customer-shopping-mode', newMode);
        
        // Show a premium toast to feedback mode change
        if (newMode === 'whole') {
            toast.success('Switched to Wholesale Mode: Bulk Pricing Applied!', {
                description: 'Wholesale prices are active across all products.',
                duration: 3000,
            });
        } else {
            toast.info('Switched to Retail Mode', {
                description: 'Standard single-unit pricing applied.',
                duration: 2500,
            });
        }
    };

    const isWholesale = mode === 'whole';

    return (
        <CustomerModeContext.Provider value={{ mode, toggleMode, isWholesale }}>
            {children}
        </CustomerModeContext.Provider>
    );
};

export const useCustomerMode = () => {
    const context = useContext(CustomerModeContext);
    if (!context) {
        throw new Error('useCustomerMode must be used within a CustomerModeProvider');
    }
    return context;
};
