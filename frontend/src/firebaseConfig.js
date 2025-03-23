import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCIAcT0iFGVlfTGyrnOUII90dI-dxkU51s",
    authDomain: "smart-parking-system-9e754.firebaseapp.com",
    projectId: "smart-parking-system-9e754",
    storageBucket: "smart-parking-system-9e754.firebasestorage.app",
    messagingSenderId: "182070500222",
    appId: "1:182070500222:web:9bf012cd149bac5449312f"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { db, auth, provider };
