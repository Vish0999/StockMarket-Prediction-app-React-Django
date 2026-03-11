import { useEffect, useMemo, useState, useRef } from "react";
import api from "../services/api";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceDot
} from "recharts";
import "./PortfolioPrediction.css";

const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const linReg = (xs, ys) => {
  const n = xs.length || 1;
  let sx=0, sy=0, sxy=0, sxx=0;
  for (let i=0;i<n;i++){ const x=xs[i], y=ys[i]; sx+=x; sy+=y; sxy+=x*y; sxx+=x*x; }
  const denom = n*sxx - sx*sx || 1;
  const b = (n*sxy - sx*sy)/denom;
  const a = (sy - b*sx)/n;
  return { a, b };
};

const clamp01 = (v) => Math.min(0.999, Math.max(0.001, v));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const logit = (p) => Math.log(p / (1 - p));
const logisticFit = (xs, ys) => {
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const ysNorm = ys.map(y => clamp01((y - minY) / range));
  const zs = ysNorm.map(p => logit(p));
  const { a, b } = linReg(xs, zs);
  return { a, b, minY, maxY };
};

const sesSeries = (arr, alpha = 0.3) => {
  if (!arr.length) return [];
  let s = arr[0];
  const out = [s];
  for (let i = 1; i < arr.length; i++) {
    s = alpha * arr[i] + (1 - alpha) * s;
    out.push(s);
  }
  return out;
};

const rnnLikeSeries = (arr, alpha = 0.5) => {
  if (arr.length < 3) return sesSeries(arr, 0.3);
  const ema = sesSeries(arr, 0.3);
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const last = arr[i];
    const prev = i > 0 ? arr[i-1] : last;
    const mom = last + (last - prev);
    out.push(alpha * ema[i] + (1 - alpha) * mom);
  }
  return out;
};

const arimaLikeSeries = (arr) => {
  if (arr.length < 5) return sesSeries(arr, 0.4);
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < 5) {
      out.push(arr[i]);
      continue;
    }
    const ma = (arr[i] + arr[i-1] + arr[i-2] + arr[i-3] + arr[i-4]) / 5;
    const trend = (arr[i] - arr[i-4]) / 4;
    out.push(ma + trend);
  }
  return out;
};

const FRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = "btc_cache_v1";
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)||"{}"); } catch { return {}; } };
const writeCache = (series) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), series })); } catch {} };
const fmt2 = (v) => (v ?? 0).toFixed(2);

export default function PortfolioPrediction() {
  const [mode, setMode] = useState("linear"); // linear | timeseries | rnn | arima
  const [series, setSeries] = useState([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const ctrl = useRef(null);

  const fetchBTC = async () => {
    setLoading(true); setErr("");
    const cached = readCache();
    if (cached.series?.length && (Date.now() - cached.ts) < FRESH_MS) {
      setSeries(cached.series); setNote("Using cached 1Y BTC"); setLoading(false); return;
    }
    if (ctrl.current) ctrl.current.abort();
    const c = new AbortController(); ctrl.current = c;
    try {
      const res = await api.get("/crypto/btc/", { params: { range: "1y", interval: "1d" }, timeout: 7000, signal: c.signal });
      const s = (res?.data?.series || [])
        .map((p, idx) => ({ idx, date: p.date || p.timestamp || idx, price: toNum(p.close ?? p.price) }))
        .filter(p => p.price !== null)
        .sort((a,b) => (a.date > b.date ? 1 : -1));
      setSeries(s);
      writeCache(s);
      setNote("Loaded 1Y BTC");
    } catch {
      setErr("BTC endpoint not reachable. Implement /api/crypto/btc/ (yfinance) or try later.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchBTC(); return () => { if (ctrl.current) ctrl.current.abort(); }; }, []);

  const current = series.length ? series[series.length - 1] : null;
  const nextX = current ? current.idx + 1 : 0;

  const activeData = useMemo(() => {
    if (!series.length) return { chart: [], pred: 0, label: "", color: "#fff" };
    const last90 = series.slice(-90).map(p => ({ ...p }));
    const prices = last90.map(p => p.price);
    let fit = [];
    let pred = 0;
    let label = "";
    let color = "#fff";

    if (mode === "linear") {
      const xs = Array.from({ length: 7 }, (_, i) => i);
      const ys = series.slice(-7).map(p => p.price);
      if (ys.length >= 2) {
        const { a, b } = linReg(xs, ys);
        const line7 = ys.map((_, i) => a + b * i);
        last90.slice(-7).forEach((p, i) => { p.fit = line7[i]; });
        pred = a + b * 7;
      }
      label = "Linear Fit (7D)";
      color = "#60a5fa";
    } else if (mode === "timeseries") {
      fit = sesSeries(prices, 0.3);
      pred = fit.length ? fit[fit.length - 1] : 0;
      last90.forEach((p, i) => { p.fit = fit[i]; });
      label = "Time Series (SES)";
      color = "#34d399";
    } else if (mode === "rnn") {
      fit = rnnLikeSeries(prices, 0.5);
      pred = fit.length ? fit[fit.length - 1] : 0;
      last90.forEach((p, i) => { p.fit = fit[i]; });
      label = "RNN-like Model";
      color = "#f97316";
    } else if (mode === "arima") {
      fit = arimaLikeSeries(prices);
      pred = fit.length ? fit[fit.length - 1] : 0;
      last90.forEach((p, i) => { p.fit = fit[i]; });
      label = "ARIMA-like Model";
      color = "#a855f7";
    }

    last90.push({ idx: nextX, date: "Next", price: null, fit: pred });
    return { chart: last90, pred, label, color };
  }, [series, mode, nextX]);

  return (
    <main className="pp container">
      <header className="pp-header">
        <h1>BTC Prediction</h1>
        <div className="pp-controls">
          <select 
            className="pp-select" 
            value={mode} 
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="linear">Linear Regression</option>
            <option value="timeseries">Time Series</option>
            <option value="rnn">RNN Model</option>
            <option value="arima">ARIMA Model</option>
          </select>
          <button className="pp-btn" onClick={fetchBTC} disabled={loading}>Refresh</button>
        </div>
      </header>

      {note && <div className="pp-note">{note}</div>}
      {err && <div className="pp-error">{err}</div>}

      <section className="pp-card">
        <div className="pp-card-title">BTC Price with {activeData.label}</div>
        <div style={{ height: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activeData.chart} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip formatter={(v, k) => [typeof v === "number" ? v.toFixed(2) : v, k]} />
              <Line type="monotone" dataKey="price" name="Price" stroke="#e2e8f0" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="fit" name={activeData.label} stroke={activeData.color} strokeWidth={2} dot={false} />
              {current && (
                <ReferenceDot x={nextX} y={activeData.pred} r={5} fill={activeData.color} stroke="none" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="pp-stats">
          <div className="pp-chip">Current: {current ? fmt2(current.price) : "—"}</div>
          <div className="pp-chip" style={{ borderColor: activeData.color, color: activeData.color }}>
            {mode.toUpperCase()} +1D: {fmt2(activeData.pred)}
          </div>
        </div>
      </section>
    </main>
  );
}