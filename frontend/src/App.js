import React, { useState, useEffect } from "react";
import { db, auth, provider } from "./firebaseConfig";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  where,
  getDocs,
} from "firebase/firestore";
import Swal from "sweetalert2";
import "./App.css";
import sendEmail from "./emailService";

function App() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userReservations, setUserReservations] = useState([]);
  const [showLoginForm, setShowLoginForm] = useState(true); // To toggle between login and register forms

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user's reservations when logged in
        fetchUserReservations(currentUser.email);
      } else {
        setUserReservations([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch user's reservations
  const fetchUserReservations = async (userEmail) => {
    try {
      const slotsRef = collection(db, "parking_slots");
      const q = query(slotsRef, where("userEmail", "==", userEmail));
      const querySnapshot = await getDocs(q);
      
      const userSlots = [];
      querySnapshot.forEach((doc) => {
        userSlots.push({
          firestoreId: doc.id,
          ...doc.data()
        });
      });
      
      setUserReservations(userSlots);
    } catch (error) {
      console.error("Error fetching user reservations:", error);
    }
  };

  // Fetch all parking slots
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const slotsRef = collection(db, "parking_slots");
    const q = query(slotsRef, orderBy("slotID"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setSlots([]);
        } else {
          const slotsData = snapshot.docs.map((doc) => ({
            firestoreId: doc.id,
            ...doc.data(),
          }));
          setSlots(slotsData);
          
          // Update user reservations if user is logged in
          if (user) {
            fetchUserReservations(user.email);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Fetch Error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      Swal.fire("Welcome!", `Logged in as ${result.user.displayName}`, "success");
    } catch (error) {
      Swal.fire("Error", "Google Sign-In failed!", "error");
    }
  };

  const loginWithEmail = async () => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      Swal.fire("Logged In!", `Welcome ${result.user.email}`, "success");
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  const register = async () => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      Swal.fire("Registered!", `Account created for ${result.user.email}`, "success");
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  const logout = () => {
    signOut(auth).then(() => {
      setUser(null);
      setUserReservations([]);
      setShowLoginForm(true);
      Swal.fire("Logged Out", "You have been signed out.", "info");
    });
  };

  // Generate QR code using external API
  const generateQRCodeSimple = (data) => {
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodedData}`;
  };

  const reserveSlot = async (firestoreId) => {
    if (!user) {
      Swal.fire("Login Required", "You must be signed in to reserve a slot.", "warning");
      return;
    }

    // Check if user already has a reservation
    if (userReservations.length > 0) {
      Swal.fire("Limit Reached", "You can only have one active reservation at a time.", "warning");
      return;
    }

    try {
      // Show loading state
      Swal.fire({
        title: "Processing",
        text: "Creating your reservation...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Create reservation data
      const reservationDate = new Date().toISOString();
      const slotNumber = firestoreId.split('-')[1] || firestoreId;
      const qrData = `Parking Slot: ${slotNumber}, Reserved by: ${user.email}, Date: ${reservationDate}`;
      
      // Generate QR code URL
      const qrCodeUrl = generateQRCodeSimple(qrData);

      console.log("🎟️ Reservation data:", {
        slot: firestoreId,
        email: user.email,
        qrUrl: qrCodeUrl
      });
      
      // Send email with QR code
      const emailSent = await sendEmail(user.email, qrCodeUrl);
      
      if (!emailSent) {
        Swal.fire("Error", "Failed to send confirmation email. Please check your email address.", "error");
        return;
      }

      // Update Firestore with reservation details
      const slotRef = doc(db, "parking_slots", firestoreId);
      await updateDoc(slotRef, {
        reserved: true,
        occupied: false,
        userEmail: user.email,
        reservationTime: reservationDate,
      });

      await fetchUserReservations(user.email);
      Swal.fire("Success!", "Reservation confirmed. Check your email for QR code!", "success");
    } catch (error) {
      console.error("Reservation Error:", error);
      Swal.fire("Error", "Could not complete reservation: " + error.message, "error");
    }
  };

  const cancelReservation = async (firestoreId) => {
    if (!user) {
      Swal.fire("Login Required", "You must be signed in to cancel a reservation.", "warning");
      return;
    }

    // Check if this is the user's reservation
    const isUserReservation = userReservations.some(
      reservation => reservation.firestoreId === firestoreId
    );

    if (!isUserReservation) {
      Swal.fire("Not Allowed", "You can only cancel your own reservation.", "error");
      return;
    }

    try {
      const slotRef = doc(db, "parking_slots", firestoreId);
      await updateDoc(slotRef, {
        reserved: false,
        userEmail: "",
        reservationTime: null,
      });
      
      // Update local state
      await fetchUserReservations(user.email);
      Swal.fire("Cancelled!", "Your reservation has been cancelled.", "success");
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      Swal.fire("Error", "Something went wrong while cancelling the reservation!", "error");
    }
  };

  // Create dummy slots for UI visualization
  const createDummyParkingLot = () => {
    // Add 5 dummy maintenance slots
    const dummySlots = [
      { id: "m1", status: "maintenance" },
      { id: "m2", status: "maintenance" },
      { id: "m3", status: "maintenance" },
      { id: "m4", status: "maintenance" },
      { id: "m5", status: "maintenance" }
    ];

    return dummySlots;
  };

  const dummySlots = createDummyParkingLot();

  // Render login/register form
  const renderAuthForm = () => {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h2>{showLoginForm ? "Login" : "Register"}</h2>
            <p>Welcome to ParkWise, your smart parking solution</p>
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="input-field"
              placeholder="your@email.com"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="input-field"
              placeholder="Your password"
            />
          </div>
          
          <div className="auth-buttons">
            {showLoginForm ? (
              <button onClick={loginWithEmail} className="primary-btn">Login</button>
            ) : (
              <button onClick={register} className="primary-btn">Create Account</button>
            )}
            
            <button onClick={loginWithGoogle} className="google-btn">
              <svg className="google-icon" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
              </svg>
              Sign in with Google
            </button>
          </div>
          
          <div className="auth-toggle">
            {showLoginForm ? (
              <p>Don't have an account? <button onClick={() => setShowLoginForm(false)} className="text-btn">Register</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => setShowLoginForm(true)} className="text-btn">Login</button></p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <h1 className="logo">ParkWise</h1>
          <span className="tagline">Smart Parking Solution</span>
        </div>
        
        {user && (
          <div className="user-panel">
            <p className="welcome-text">Welcome, {user.email}!</p>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        )}
      </header>

      {!user ? (
        // Display only the login form when not logged in
        renderAuthForm()
      ) : (
        // Display parking lot when logged in
        <div className="dashboard-container">
          {/* User's reservation section */}
          {userReservations.length > 0 && (
            <div className="user-reservations">
              <h2 className="section-title">Your Reservation</h2>
              {userReservations.map(reservation => (
                <div key={reservation.firestoreId} className="reservation-card">
                  <div className="reservation-info">
                    <div className="reservation-header">
                      <span className="reservation-label">Parking Spot</span>
                      <span className="slot-number">{reservation.slotID || reservation.firestoreId}</span>
                    </div>
                    <div className="reservation-details">
                      <p><span className="detail-label">Status:</span> <span className="status reserved">Reserved</span></p>
                      <p><span className="detail-label">Reserved on:</span> {new Date(reservation.reservationTime).toLocaleString()}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => cancelReservation(reservation.firestoreId)} 
                    className="cancel-btn"
                  >
                    Cancel Reservation
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main parking visualization */}
          <div className="parking-lot-container">
            <h2 className="section-title">Parking Lot Map</h2>
            
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading parking lot data...</p>
              </div>
            ) : (
              <div className="parking-lot">
                <div className="lot-entrance">
                  <span>ENTRANCE</span>
                  <div className="entrance-arrow">↓</div>
                </div>
                
                <div className="parking-spaces">
                  <div className="parking-row">
                    {slots.map((slot) => (
                      <div 
                        key={slot.firestoreId} 
                        className={`parking-space ${
                          slot.occupied 
                            ? "occupied" 
                            : slot.reserved 
                              ? "reserved" 
                              : "available"
                        } ${
                          userReservations.some(r => r.firestoreId === slot.firestoreId) 
                            ? "user-reserved" 
                            : ""
                        }`}
                      >
                        <div className="space-number">{slot.slotID || slot.firestoreId}</div>
                        <div className="space-icon">
                          {slot.occupied ? "🚗" : slot.reserved ? "🔒" : ""}
                        </div>
                        <div className="space-status">
                          {slot.occupied 
                            ? "Occupied" 
                            : slot.reserved 
                              ? "Reserved" 
                              : "Available"}
                        </div>
                        <div className="sensor-indicator">
                          <span className="sensor-dot"></span>
                          <span className="sensor-label">SENSOR</span>
                        </div>
                        {!slot.reserved && !slot.occupied && userReservations.length === 0 && (
                          <button 
                            onClick={() => reserveSlot(slot.firestoreId)} 
                            className="reserve-btn"
                          >
                            Reserve
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add dummy maintenance slots */}
                    {dummySlots.map((dummySlot) => (
                      <div 
                        key={dummySlot.id} 
                        className="parking-space maintenance"
                      >
                        <div className="space-number">{dummySlot.id}</div>
                        <div className="space-icon">🚧</div>
                        <div className="space-status">Under Maintenance</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="lot-legend">
                  <div className="legend-item">
                    <span className="legend-color available"></span>
                    <span>Available</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color reserved"></span>
                    <span>Reserved</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color occupied"></span>
                    <span>Occupied</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color maintenance"></span>
                    <span>Maintenance</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color user-reserved"></span>
                    <span>Your Reservation</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <footer className="footer">
        <p>© 2025 ParkWise - Smart Parking Solution</p>
      </footer>
    </div>
  );
}

export default App;