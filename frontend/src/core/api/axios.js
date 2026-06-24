import axios from 'axios';
import { resolveApiBaseUrl } from './resolveApiBaseUrl';
import { getStoredAuthToken } from '@core/utils/authStorage';
import { getActiveRole, ROLES } from '@core/auth/activeRoleStore';
import { rawGet, STORAGE_KEYS } from '@core/utils/storage';

const ROLE_STORAGE_KEYS = [
    STORAGE_KEYS.AUTH_SELLER,
    STORAGE_KEYS.AUTH_ADMIN,
    STORAGE_KEYS.AUTH_DELIVERY,
    STORAGE_KEYS.AUTH_CUSTOMER,
];

const ROLE_TO_STORAGE_KEY = {
    [ROLES.SELLER]: STORAGE_KEYS.AUTH_SELLER,
    [ROLES.ADMIN]: STORAGE_KEYS.AUTH_ADMIN,
    [ROLES.DELIVERY]: STORAGE_KEYS.AUTH_DELIVERY,
    [ROLES.CUSTOMER]: STORAGE_KEYS.AUTH_CUSTOMER,
};

// URL-prefix → storage-key map used as a *fallback* for the few call sites
// (e.g. an admin page that calls a /products endpoint) where the request URL
// itself encodes the intended role. The primary source is the activeRoleStore.
function tokenForRequestUrl(url) {
    if (!url) return null;
    if (url.startsWith('/seller')) return getStoredAuthToken(STORAGE_KEYS.AUTH_SELLER);
    if (url.startsWith('/admin')) return getStoredAuthToken(STORAGE_KEYS.AUTH_ADMIN);
    if (url.startsWith('/delivery')) return getStoredAuthToken(STORAGE_KEYS.AUTH_DELIVERY);
    if (
        url.startsWith('/customer') ||
        url.startsWith('/cart') ||
        url.startsWith('/wishlist') ||
        url.startsWith('/categories') ||
        url.startsWith('/products') ||
        url.startsWith('/payments')
    ) {
        return getStoredAuthToken(STORAGE_KEYS.AUTH_CUSTOMER);
    }
    return null;
}

const axiosInstance = axios.create({
    baseURL: resolveApiBaseUrl(),
});

axiosInstance.interceptors.request.use(
    (config) => {
        const url = config.url || '';
        const isMultipartRequest =
            typeof FormData !== 'undefined' && config.data instanceof FormData;

        if (isMultipartRequest) {
            if (typeof config.headers?.delete === 'function') {
                config.headers.delete('Content-Type');
            } else if (config.headers) {
                delete config.headers['Content-Type'];
            }
        }

        // Primary: pick token from the active role (set by the router on mount).
        const activeRole = getActiveRole();
        const primaryStorageKey = ROLE_TO_STORAGE_KEY[activeRole];
        let token = primaryStorageKey ? getStoredAuthToken(primaryStorageKey) : null;

        // Fallback 1: URL-derived token (cross-portal calls, e.g. admin → /products).
        if (!token) {
            token = tokenForRequestUrl(url);
        }

        // Fallback 2: customer token for un-prefixed/public-ish endpoints while
        // the user is not currently inside a privileged portal.
        if (
            !token &&
            activeRole !== ROLES.ADMIN &&
            activeRole !== ROLES.SELLER &&
            activeRole !== ROLES.DELIVERY
        ) {
            token = getStoredAuthToken(STORAGE_KEYS.AUTH_CUSTOMER);
        }

        // Fallback 3: legacy shared 'token' key.
        if (!token) {
            token = getStoredAuthToken(STORAGE_KEYS.AUTH_LEGACY);
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for API calls
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // Handle 503 Maintenance Mode
        if (error.response?.status === 503 && error.response?.data?.maintenance) {
            if (!window.location.pathname.startsWith('/admin')) {
                // If the overlay doesn't exist, create it
                if (!document.getElementById('maintenance-overlay')) {
                    const overlay = document.createElement('div');
                    overlay.id = 'maintenance-overlay';
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.width = '100vw';
                    overlay.style.height = '100vh';
                    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
                    overlay.style.backdropFilter = 'blur(8px)';
                    overlay.style.zIndex = '999999';
                    overlay.style.display = 'flex';
                    overlay.style.flexDirection = 'column';
                    overlay.style.alignItems = 'center';
                    overlay.style.justifyContent = 'center';
                    
                    overlay.innerHTML = `
                        <div style="background: white; padding: 40px; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center; max-width: 400px; width: 90%; border: 1px solid #f1f5f9; position: relative; z-index: 10;">
                            <div style="width: 80px; height: 80px; background: #fff1f2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; color: #f43f5e;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin-bottom: 8px; font-family: sans-serif;">Under Maintenance</h1>
                            <p style="color: #64748b; margin-bottom: 24px; font-family: sans-serif; line-height: 1.5;">The platform is currently offline for scheduled maintenance. Please check back later.</p>
                            <button id="maintenance-refresh-btn" style="width: 100%; background: #0f172a; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer; transition: all 0.2s;">Check Status</button>
                        </div>
                    `;
                    document.body.appendChild(overlay);

                    const btn = document.getElementById('maintenance-refresh-btn');
                    btn.addEventListener('click', async () => {
                        btn.innerText = 'Checking...';
                        btn.style.opacity = '0.7';
                        try {
                            const res = await fetch(resolveApiBaseUrl() + '/categories');
                            if (res.status === 200) {
                                window.location.reload();
                            }
                        } catch (e) {}
                        setTimeout(() => {
                            btn.innerText = 'Check Status';
                            btn.style.opacity = '1';
                        }, 1000);
                    });
                }
                return new Promise(() => {}); // Pause the promise chain forever
            }
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const hasStoredRoleToken = ROLE_STORAGE_KEYS.some((key) => Boolean(rawGet(key)));
            if (hasStoredRoleToken) {
                console.warn(
                    '[axios] Received 401 response. Preserving stored auth tokens; session data is only cleared by explicit logout.',
                    {
                        url: originalRequest?.url,
                        method: originalRequest?.method,
                    }
                );
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
