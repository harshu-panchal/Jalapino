import React, { createContext, useContext, useState, useMemo } from 'react';

const SearchContext = createContext();

export const useSearch = () => {
    const context = useContext(SearchContext);
    if (!context) {
        return { isOpen: false, openSearch: () => { }, closeSearch: () => { } };
    }
    return context;
};

export const SearchProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);

    const openSearch = () => {
        setIsOpen(true);
    };

    const closeSearch = () => {
        setIsOpen(false);
    };

    const value = useMemo(
        () => ({ isOpen, openSearch, closeSearch }),
        [isOpen]
    );

    return (
        <SearchContext.Provider value={value}>
            {children}
        </SearchContext.Provider>
    );
};
