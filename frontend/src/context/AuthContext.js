import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { parseErrorMessage } from '../utils/errorMessages';

const AuthContext = createContext();

/**
 * Hook contract for auth consumers.
 * Returns the active auth context value (user/token/actions/loading).
 */
export const useAuth = () => {
  return useContext(AuthContext);
};

/**
 * Decodes JWT payload for optimistic client-side identity restoration.
 * Why: keeps route guards and role-based UI responsive after refresh without
 * requiring a blocking profile call.
 *
 * Note: this is not security validation; the backend remains the source of truth.
 */
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to decode JWT token - token may be malformed');
    }
    return null;
  }
};

/**
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 *
 * State rationale:
 * - user: denormalized auth profile used across navigation/guards.
 * - token: persisted in sessionStorage to scope login lifetime to browser session.
 * - loading: prevents early route redirects before token hydration completes.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(sessionStorage.getItem('token') || null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Why dependency includes only token:
    // user is derived state from token payload; recalculating on token transitions
    // avoids stale role/email data after login/logout.
    if (token) {
      // Decode token to restore user info
      const decoded = decodeToken(token);
      if (decoded && decoded.sub) {
        // JWT 'sub' field contains the email, role is in 'role' field
        setUser({
          email: decoded.sub,
          role: decoded.role,
          id: decoded.userId,
        });
      }
    }
    setLoading(false);
    // # FIXME: proactively clear expired token instead of waiting for a 401 from API.
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, id, email: userEmail, role } = response.data;
      setToken(newToken);
      setUser({ id, email: userEmail, role });
      sessionStorage.setItem('token', newToken);
      return { success: true };
    } catch (error) {
      const errorMessage = parseErrorMessage(error);
      // # TODO: add telemetry for repeated login failures to detect credential stuffing.
      return { success: false, message: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      await api.post('/auth/register', userData);
      return { success: true };
    } catch (error) {
      const errorMessage = parseErrorMessage(error);
      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('token');
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};