import { useState, useEffect } from 'react';

export const useIsAppLayout = () => {
    const [isAppLayout, setIsAppLayout] = useState(true);

    useEffect(() => {
        const checkIsApp = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isIOSStandalone = window.navigator.standalone === true;
            const isMobileScreen = window.innerWidth <= 768; // Tailwind md breakpoint

            return isStandalone || isIOSStandalone || isMobileScreen;
        };

        // Initialize state on client side
        setIsAppLayout(checkIsApp());

        const handleResize = () => {
            setIsAppLayout(checkIsApp());
        };

        window.addEventListener('resize', handleResize);
        
        const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
        if (displayModeMediaQuery.addEventListener) {
            displayModeMediaQuery.addEventListener('change', handleResize);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            if (displayModeMediaQuery.removeEventListener) {
                displayModeMediaQuery.removeEventListener('change', handleResize);
            }
        };
    }, []);

    return isAppLayout;
};
