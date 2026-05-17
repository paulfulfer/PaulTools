import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
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
    if (Platform.OS === 'web') {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } else {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === 'success') {
        const { idToken } = response.data;
        const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
        await auth.signInWithCredential(credential);
      }
    }
  };

  const logout = async () => {
    if (Platform.OS !== 'web') {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    }
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
