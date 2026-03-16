import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PlusCircle, Database, Globe, AlertCircle, LayoutGrid, ArrowRight } from "lucide-react";
import "./manualEntry.css";

const STORAGE_KEY = "manualStocks";
const PORTFOLIO_STORAGE_KEY = "portfolioHoldings";
const SECTORS = ["IT", "FINANCE", "BANK", "HEALTHCARE"];

export default function ManualEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const incomingSector = searchParams.get("sector");
  const defaultSector = SECTORS.includes(incomingSector) ? incomingSector : "IT";

  const [sector, setSector] = useState(defaultSector);
  const [ticker, setTicker] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    setMsg("");

    const payload = {
      id: Date.now(),
      sector,
      ticker: ticker.trim().toUpperCase(),
    };

    if (!payload.ticker) {
      setMsg("Please enter a valid stock ticker.");
      return;
    }

    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (existing.some((item) => item.ticker === payload.ticker && item.sector === payload.sector)) {
      setMsg("This stock is already added for the selected sector.");
      return;
    }
    existing.push(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    // Keep Portfolio view in sync with manual entries.
    const holdings = JSON.parse(localStorage.getItem(PORTFOLIO_STORAGE_KEY) || "[]");
    const alreadyInPortfolio = holdings.some((item) => {
      const name = (item.name || item.symbol || item.ticker || "").toString().trim().toUpperCase();
      const itemSector = (item.sector || "").toString().trim().toUpperCase();
      return name === payload.ticker && itemSector === payload.sector;
    });
    if (!alreadyInPortfolio) {
      holdings.push({
        name: payload.ticker,
        quantity: 1,
        buyPrice: 0,
        currentPrice: 0,
        peRatio: null,
        sector: payload.sector,
      });
      localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(holdings));
    }

    navigate("/analysis", { replace: true });
  };

  return (
    <main className="me-page">
      <header className="me-header">
        <h1 className="me-title">Asset Integration</h1>
        <p className="me-subtitle">
          Manually add custom tickers to your analysis dashboard and track their real-time performance.
        </p>
      </header>

      <div className="me-container">
        {/* Form Side */}
        <div className="me-form-side">
          <form onSubmit={onSubmit}>
            <div className="me-group">
              <label className="me-label">Market Sector</label>
              <select
                className="me-select"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="me-group">
              <label className="me-label">Stock Ticker Symbol</label>
              <input
                className="me-input"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="e.g. INFY.NS or AAPL"
                required
              />
            </div>

            {msg && (
              <div className="me-error">
                <AlertCircle size={18} />
                {msg}
              </div>
            )}

            <div className="me-actions">
              <button type="submit" className="me-btn-add">
                <PlusCircle size={20} />
                ADD TO SYSTEM
              </button>
              <button
                type="button"
                onClick={() => navigate("/analysis")}
                className="me-btn-show"
              >
                VIEW LIST
              </button>
            </div>
          </form>
        </div>

        {/* Info Side */}
        <div className="me-info-side">
          <h3 className="info-title">Entry Guidelines</h3>
          <ul className="info-list">
            <li className="info-item">
              <div className="info-icon"><Database size={20} /></div>
              <div className="info-text">
                <strong>Ticker Suffixes</strong>
                Use .NS for NSE (India) or .BO for BSE to ensure accurate data retrieval.
              </div>
            </li>
            <li className="info-item">
              <div className="info-icon"><Globe size={20} /></div>
              <div className="info-text">
                <strong>Global Markets</strong>
                Standard tickers (like TSLA, AAPL) work directly for US markets.
              </div>
            </li>
            <li className="info-item">
              <div className="info-icon"><LayoutGrid size={20} /></div>
              <div className="info-text">
                <strong>Smart Categorization</strong>
                Assets are grouped by sector in your analysis dashboard for better comparison.
              </div>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
