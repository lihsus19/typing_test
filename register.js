
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyAhotozsSHfGJzFZrbrfNXw10cXGHtHAwo",
    authDomain: "typing-test-6a1dd.firebaseapp.com",
    projectId: "typing-test-6a1dd",
    storageBucket: "typing-test-6a1dd.firebasestorage.app",
    messagingSenderId: "443837947210",
    appId: "1:443837947210:web:8d66ea3f892dd0670635b3",
    measurementId: "G-T87KQMSLHQ"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);