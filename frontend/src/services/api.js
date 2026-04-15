import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * Shared axios client for authenticated backend calls.
 * Why:
 * A single instance centralizes auth header injection and unauthorized handling,
 * preventing subtle differences across service modules.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 for authenticated routes (not login/register)
    // This prevents the interceptor from redirecting when login fails
    const isAuthEndpoint = error.config?.url?.includes('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      sessionStorage.removeItem('token');
      window.location.href = '/login';
    }
    // # TODO: add refresh-token flow before forced logout for short-lived access tokens.
    // # FIXME: avoid hard redirect when an in-flight form submission should preserve draft state.
    return Promise.reject(error);
  }
);

export default api;