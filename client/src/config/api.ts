import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
});

// inject JWT token from local storage into the every request if it exists
api.interceptors.request.use(
    (config) => {   
        const token = localStorage.getItem("auth_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    }
);

// Handle response errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            // only redirect if not already on auth page
            if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/register")) {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default api;