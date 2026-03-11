import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, PieChart, Search, PlusSquare, BarChart3, LogOut, LogIn, LineChart, ChevronDown, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import "./Navbar.css";

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const routeKey = `${location.pathname}${location.search || ""}`;

  const isActive = (path) => location.pathname === path;

  useEffect(() => { setMobileOpen(false); setOpen(false); }, [routeKey]);

  return (
    <nav className="nav">
      <div className="nav-container container">
        <Link to="/" className="nav-brand">
          <div className="brand-icon"><LineChart className="icon" /></div>
          <div className="brand-text">
            <div className="brand-title">AutoVest</div>
            <div className="brand-subtitle">Smart portfolio analytics</div>
          </div>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="nav-burger" aria-label="Menu"><Menu className="icon" /></button>
        <div className={`nav-menu ${mobileOpen ? "open" : ""}`}>
          {isAuthenticated ? (
            <>
              <div className="dropdown">
                <button onClick={() => setOpen(!open)} className={`nav-link ${isActive("/portfolio") ? "active" : ""}`}>
                  <PieChart className="icon" /><span>Sectors</span><ChevronDown className="icon" />
                </button>
                {open && (
                  <div className="dropdown-menu">
                    <DropdownItem to="/portfolio" label="All Sectors" />
                    <DropdownItem to="/portfolio?sector=IT" label="IT" />
                    <DropdownItem to="/portfolio?sector=FINANCE" label="Finance" />
                    <DropdownItem to="/portfolio?sector=BANK" label="Banking" />
                    <DropdownItem to="/portfolio?sector=HEALTHCARE" label="Healthcare" />
                    <DropdownItem to="/portfolio?sector=AUTOMOBILE" label="Automobile" />
                  </div>
                )}
              </div>
              <NavLink to="/analysis" icon={<LayoutDashboard className="icon" />} label="My Portfolio" active={isActive("/analysis")} />
              <NavLink to="/entry" icon={<PlusSquare className="icon" />} label="Manual Entry" active={isActive("/entry")} />
              <NavLink to="/stocks" icon={<Search className="icon" />} label="Search Stock" active={isActive("/stocks")} />
              <NavLink to="/prediction" icon={<BarChart3 className="icon" />} label="BTC Prediction" active={isActive("/prediction")} />
              <NavLink to="/gold-silver" icon={<BarChart3 className="icon" />} label="Gold/Silver" active={isActive("/gold-silver")} />
              <button onClick={logout} className="nav-cta"><LogOut className="icon" /><span>Sign Out</span></button>
            </>
          ) : (
            <Link to="/login" className="btn-primary nav-cta"><LogIn className="icon" /><span>Sign In</span></Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, icon, label, active }) {
  return (
    <Link to={to} className={`nav-link ${active ? "active" : ""}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function DropdownItem({ to, label }) {
  return (
    <Link to={to} className="dropdown-item"><span>{label}</span></Link>
  );
}