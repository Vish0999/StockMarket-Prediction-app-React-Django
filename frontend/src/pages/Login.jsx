import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const getErrorMessage = (error) => {
    if (!error?.response) {
      return "Cannot reach server at http://127.0.0.1:8000. Start backend and try again.";
    }
    const status = error.response.status;
    const data = error.response.data;
    const prefix = `[${status}] `;
    if (!data) return prefix + "Request failed";
    if (typeof data === "string") return prefix + data;
    if (data.detail) return prefix + data.detail;
    if (Array.isArray(data.password) && data.password.length) return prefix + data.password[0];
    if (Array.isArray(data.username) && data.username.length) return prefix + data.username[0];
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val) && val.length) return prefix + val[0];
      if (typeof val === "string") return prefix + val;
    }
    return prefix + "Request failed";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSuccess("");
    setSubmitting(true);

    try {
      if (isSignup) {
        let createdNewUser = true;
        try {
          await signup(username, password);
        } catch (signupError) {
          const usernameErrors = signupError?.response?.data?.username;
          const firstUsernameError = Array.isArray(usernameErrors) ? usernameErrors[0] : "";
          const isExistingUserError =
            signupError?.response?.status === 400 &&
            typeof firstUsernameError === "string" &&
            firstUsernameError.toLowerCase().includes("already exists");

          if (!isExistingUserError) throw signupError;
          createdNewUser = false;
        }
        await login(username, password);
        setSuccess(
          createdNewUser
            ? "Successfully signed up and logged in."
            : "Account already exists. Logged in successfully."
        );
        setTimeout(() => navigate("/portfolio", { replace: true }), 700);
        return;
      }

      await login(username, password);
      setSuccess("Successfully logged in.");
      setTimeout(() => navigate("/portfolio", { replace: true }), 700);
    } catch (error) {
      setErr(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      {/* Background Decorations */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>

      <div className="login-container">
        {/* Left Visual Branding */}
        <div className="login-visual">
          <div className="visual-grid"></div>
          <div className="visual-content">
            <div className="brand-logo">
              <div className="logo-icon">
                <div className="logo-inner"></div>
              </div>
              <span className="brand-name">AutoVest</span>
            </div>
            <h2 className="visual-title">
              Master Your <br />
              Financial Future
            </h2>
            <p className="visual-subtitle">
              Join thousands of investors using AutoVest to track, analyze, and optimize their portfolios with AI-driven insights.
            </p>
          </div>

          <div className="visual-stats">
            <div className="stat-item">
              <div className="stat-value">99.9%</div>
              <div className="stat-label">Uptime</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Analysis</div>
            </div>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="login-form-section">
          <div className="form-header">
            <h1 className="form-title">{isSignup ? "Sign Up" : "Sign In"}</h1>
            <p className="form-subtitle">
              {isSignup ? "Create your account to start investing" : "Welcome back! Please enter your details"}
            </p>
          </div>

          {success && (
            <div className="success-toast" style={{
              background: '#10b981', color: 'white', padding: '12px 20px', 
              borderRadius: '12px', marginBottom: '20px', fontWeight: '600', fontSize: '14px'
            }}>
              {success}
            </div>
          )}

          <form onSubmit={onSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isSignup && (
              <div className="forgot-password">
                <button type="button" className="forgot-btn">Forgot Password?</button>
              </div>
            )}

            {err && (
              <div className="error-box">
                <span style={{ width: '8px', height: '8px', background: '#dc2626', borderRadius: '50%' }}></span>
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="submit-btn"
            >
              {submitting ? (
                <div className="spinner"></div>
              ) : (
                <>
                  {isSignup ? "CREATE ACCOUNT" : "SIGN IN TO DASHBOARD"}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="toggle-section">
            <p>
              {isSignup ? "Already have an account?" : "New to AutoVest?"}
              <button
                type="button"
                onClick={() => {
                  setErr("");
                  setIsSignup((v) => !v);
                }}
                className="toggle-btn"
              >
                {isSignup ? "Sign In" : "Create Account"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}