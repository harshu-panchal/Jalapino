import * as jwtDecodeModule from 'jwt-decode';

const safeJwtDecode = (token) => {
    if (typeof jwtDecodeModule.jwtDecode === 'function') {
        return jwtDecodeModule.jwtDecode(token);
    }
    if (typeof jwtDecodeModule.default === 'function') {
        return jwtDecodeModule.default(token);
    }
    if (jwtDecodeModule.default && typeof jwtDecodeModule.default.jwtDecode === 'function') {
        return jwtDecodeModule.default.jwtDecode(token);
    }

    // Fallback: if it's already a function
    if (typeof jwtDecodeModule === 'function') {
        return jwtDecodeModule(token);
    }

    throw new Error('jwtDecode function not found in module');
};

export const decodeToken = (token) => {
    try {
        return safeJwtDecode(token);
    } catch (error) {
        console.error('[token.js] decodeToken error:', error);
        return null;
    }
};

export const isTokenExpired = (token) => {
    try {
        const decoded = safeJwtDecode(token);
        if (!decoded || !decoded.exp) return false;
        const now = Date.now() / 1000;
        return decoded.exp < now;
    } catch (error) {
        console.error('[token.js] isTokenExpired error:', error);
        // Do NOT return true here, because returning true DELETES the token from storage
        // on refresh! If we can't parse it (e.g. Vite build issue with jwt-decode), 
        // we should assume it's valid and let the backend reject it with 401 if it's not.
        return false;
    }
};

export const getRoleFromToken = (token) => {
    const decoded = decodeToken(token);
    return decoded?.role || null;
};
