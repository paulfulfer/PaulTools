import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = loading, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    return auth.onAuthStateChanged(setUser);
  }, []);

  const signInWithGoogle = async () => {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type === 'success') {
      const { idToken } = response.data;
      const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
      await auth.signInWithCredential(credential);
    }
  };

  const logout = async () => {
    await GoogleSignin.signOut();
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
