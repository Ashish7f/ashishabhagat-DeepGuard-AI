import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDocs,
  writeBatch
} from "firebase/firestore";

const STORAGE_KEY = "deepguard_firebase_config";

// Default Production Google Cloud Firestore configuration (Public Cloud Instance)
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBg0-L_NbgKS5FFy5YQyS4AJBFkHIRamEw",
  authDomain: "deepguard-ai-202b6.firebaseapp.com",
  projectId: "deepguard-ai-202b6",
  storageBucket: "deepguard-ai-202b6.firebasestorage.app",
  messagingSenderId: "491467801870",
  appId: "1:491467801870:web:d77b7c4676abd50896835f",
  measurementId: "G-NPBPJRCPYQ"
};

// Read initial config from localStorage, Vite environment variables, or public cloud fallback
export function getFirebaseConfig() {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.projectId && parsed.apiKey) {
          return parsed;
        }
      }
    } catch {
      // ignore parse error
    }
  }

  // Fallback to Vite environment variables
  if (import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
    };
  }

  // Default universal public cloud database
  return DEFAULT_FIREBASE_CONFIG;
}

let firebaseApp = null;
let firestoreDb = null;

export function initFirebase(customConfig = null) {
  const config = customConfig || getFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    firebaseApp = null;
    firestoreDb = null;
    return null;
  }

  try {
    if (getApps().length > 0) {
      if (customConfig) {
        try {
          deleteApp(getApp());
          firebaseApp = initializeApp(config);
        } catch {
          firebaseApp = getApp();
        }
      } else {
        firebaseApp = getApp();
      }
    } else {
      firebaseApp = initializeApp(config);
    }
    firestoreDb = getFirestore(firebaseApp);
    return firestoreDb;
  } catch (err) {
    console.warn("Firebase initialization warning:", err);
    return null;
  }
}

// Check if Firebase is currently active
export function isFirebaseActive() {
  if (!firestoreDb) {
    initFirebase();
  }
  return firestoreDb !== null;
}

export function saveFirebaseConfig(config) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return initFirebase(config);
  }
  return null;
}

export function clearFirebaseConfig() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    if (getApps().length > 0) {
      try {
        deleteApp(getApp());
      } catch (err) {
        console.warn("Error deleting Firebase app:", err);
      }
    }
    firebaseApp = null;
    firestoreDb = null;
  }
}

// Write forensic scan record to Firestore
export async function logScanToFirestore(scanRecord) {
  if (!firestoreDb) initFirebase();
  if (!firestoreDb) return null;

  try {
    const scansCol = collection(firestoreDb, "forensic_scans");
    const docData = {
      filename: scanRecord.filename || "subject.jpg",
      prediction: scanRecord.prediction || "UNKNOWN",
      confidence: Number(scanRecord.confidence) || 0,
      fake_probability: Number(scanRecord.fake_probability) || 0,
      real_probability: Number(scanRecord.real_probability) || 0,
      frequency_coherence: scanRecord.forensics?.frequency_coherence ?? scanRecord.frequency_coherence ?? null,
      texture_uniformity: scanRecord.forensics?.texture_uniformity ?? scanRecord.texture_uniformity ?? null,
      bilateral_symmetry: scanRecord.forensics?.bilateral_symmetry ?? scanRecord.bilateral_symmetry ?? null,
      latency_ms: scanRecord.latency_ms || 30,
      model_version: scanRecord.model || "ConvNeXt-Tiny V10.0 OmniShield",
      device: scanRecord.device || "cpu",
      created_at: new Date().toISOString(),
      timestamp: serverTimestamp()
    };

    const docRef = await addDoc(scansCol, docData);
    return { id: docRef.id, ...docData };
  } catch (err) {
    console.warn("Error logging scan to Firestore:", err);
    return null;
  }
}

// Subscribe to real-time updates from Firestore collection
export function subscribeToFirestoreScans(callback, limitCount = 50) {
  if (!firestoreDb) initFirebase();
  if (!firestoreDb) return () => {};

  try {
    const scansCol = collection(firestoreDb, "forensic_scans");
    const q = query(scansCol, orderBy("created_at", "desc"), limit(limitCount));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = [];
        snapshot.forEach((docSnap) => {
          records.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        callback(records);
      },
      (error) => {
        console.warn("Firestore onSnapshot error:", error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("Error subscribing to Firestore scans:", err);
    return () => {};
  }
}

// Delete single scan document from Firestore
export async function deleteScanFromFirestore(scanId) {
  if (!firestoreDb) initFirebase();
  if (!firestoreDb) return false;

  try {
    const docRef = doc(firestoreDb, "forensic_scans", String(scanId));
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn("Error deleting scan from Firestore:", err);
    return false;
  }
}

// Clear all scan documents from Firestore
export async function clearAllFirestoreScans() {
  if (!firestoreDb) initFirebase();
  if (!firestoreDb) return false;

  try {
    const scansCol = collection(firestoreDb, "forensic_scans");
    const snapshot = await getDocs(scansCol);
    const batch = writeBatch(firestoreDb);

    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    return true;
  } catch (err) {
    console.warn("Error clearing Firestore scans:", err);
    return false;
  }
}
