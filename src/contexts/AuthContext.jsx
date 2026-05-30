import React, { createContext, useState, useCallback, useEffect } from 'react';
import { setIpcStoreCode } from '../api/ipc';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [storeCode, setStoreCode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  const login = useCallback(async (userData, sCode) => {
    setUser(userData);
    setStoreCode(sCode);
    setError(null);
    setIpcStoreCode(sCode);
    try {
      sessionStorage.setItem('tallyfy_user', JSON.stringify(userData));
      if (sCode) sessionStorage.setItem('tallyfy_storeCode', sCode);
    } catch (e) {}
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setStoreCode(null);
    setError(null);
    setIpcStoreCode(null);
    try {
      sessionStorage.removeItem('tallyfy_user');
      sessionStorage.removeItem('tallyfy_storeCode');
    } catch (e) {}
  }, []);

  const restoreUser = useCallback(() => {
    try {
      const storedUser = sessionStorage.getItem('tallyfy_user');
      const storedStoreCode = sessionStorage.getItem('tallyfy_storeCode');
      
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        if (storedStoreCode) {
          setStoreCode(storedStoreCode);
          setIpcStoreCode(storedStoreCode);
        }
      } else {
        setUser(null);
        setStoreCode(null);
        setIpcStoreCode(null);
      }
    } catch (e) {
      setUser(null);
      setStoreCode(null);
      setIpcStoreCode(null);
    }
  }, []);

  useEffect(() => {
    restoreUser();
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        try {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
        } catch (e) {
          console.warn('Auto anonymous login failed:', e);
        }
      }
      setIsFirebaseReady(true);
    });
    return () => unsubscribe();
  }, [restoreUser]);

  return (
    <AuthContext.Provider value={{
      user,
      storeCode,
      isLoading,
      error,
      isFirebaseReady,
      login,
      logout,
      restoreUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}
