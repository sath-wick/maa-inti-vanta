// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  set
} from "firebase/database";
import { getAuth } from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyCbosze5GFJ5pP-z8wLLF3kZHv2hhGUrwM",
  authDomain: "maa-test-vanta.firebaseapp.com",
  projectId: "maa-test-vanta",
  databaseURL: "https://maa-test-vanta-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "maa-test-vanta.firebasestorage.app",
  messagingSenderId: "594416921915",
  appId: "1:594416921915:web:fb77c8dce0faa8b65a5b1e",
  measurementId: "G-12JBTTQ5CW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { database, ref, get, set, auth };