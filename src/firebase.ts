import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const configModules = import.meta.glob<{ default?: FirebaseOptions }>(
  '../firebase-applet-config.json',
  { eager: true },
);
const fileConfig = Object.values(configModules)[0]?.default ?? {};

const envConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fileConfig.appId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId,
};

const hasFirebaseConfig = Boolean(envConfig.apiKey && envConfig.projectId);

const app = hasFirebaseConfig
  ? getApps().length > 0
    ? getApp()
    : initializeApp(envConfig)
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
