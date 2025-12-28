// js/firebase-config.js

const firebaseConfig = {
    apiKey: "AIzaSyAeU2R2HvlJfmTQWJxJAqEPwV2xAeRY2E8",
    authDomain: "forto-store.firebaseapp.com",
    projectId: "forto-store",
    storageBucket: "forto-store.firebasestorage.app",
    messagingSenderId: "689608957508",
    appId: "1:689608957508:web:a2de481a7bf04c33096611",
    measurementId: "G-FPR9RKYL09",
    databaseURL: "https://forto-store-default-rtdb.firebaseio.com" // رابط قاعدة البيانات الصحيح
};

// تهيئة Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const analytics = firebase.analytics();
