import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const firebaseConfig = {
  apiKey: 'AIzaSyDAWxRGQoHZDmL2EeukPCfLKPO22pWuVbc',
  authDomain: 'personal-website-b1c9a.firebaseapp.com',
  projectId: 'personal-website-b1c9a',
  storageBucket: 'personal-website-b1c9a.firebasestorage.app',
  messagingSenderId: '287433829882',
  appId: '1:287433829882:web:6ec2050399838bb90a4843',
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

GoogleSignin.configure({
  webClientId: '287433829882-at0bb6kqq7b67o4vfq42hee48r5ff943.apps.googleusercontent.com',
});

export const auth = firebase.auth();
export const db = firebase.firestore();
