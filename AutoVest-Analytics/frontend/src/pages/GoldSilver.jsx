import { useEffect, useMemo, useState, useRef } from "react";
import api from "../services/api";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ScatterChart, Scatter, ZAxis, Legend
} from "recharts";
import "./GoldSilver.css";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const movingAverage = (arr, k = 3) => {
  const res = [];
  for (let i = 0; i < arr.length; i++) {
    const s = Math.max(0, i - k + 1);
    const slice = arr.slice(s, i + 1);
    res.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return res;
};

const linReg = (xs, ys) => {
  const n = xs.length || 1;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { const x = xs[i], y = ys[i]; sx+=x; sy+=y; sxy+=x*y; sxx+=x*x; }
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

const WINDOW = 180;
const GS_CACHE_KEY = "gs_cache_v1";
const cacheKey = (a, r, i) => `${a}|${r}|${i}`;
const readCache = (a, r, i) => {
  try { const all = JSON.parse(localStorage.getItem(GS_CACHE_KEY) || "{}"); return all[cacheKey(a,r,i)] || null; } catch { return null; }
};
const writeCache = (a, r, i, series) => {
  try { const all = JSON.parse(localStorage.getItem(GS_CACHE_KEY) || "{}"); all[cacheKey(a,r,i)] = { ts: Date.now(), series }; localStorage.setItem(GS_CACHE_KEY, JSON.stringify(all)); } catch {}
};
const age = (ts) => { const s = Math.floor((Date.now()-ts)/1000); if (s<60) return `${s}s ago`; const m=Math.floor(s/60); if (m<60) return `${m}m ago`; const h=Math.floor(m/60); return `${h}h ago`; };
const FRESH_MS = 300000; // 5 minutes

// Manual 1W fallback data (deterministic sample around a baseline)
const manualWeekData = (asset) => {
  const base = asset === "silver" ? 28 : 2350;
  const deltas = asset === "silver" ? [0.1, -0.05, 0.2, -0.1, 0.15, -0.08, 0.05] : [5, -8, 12, -6, 9, -4, 7];
  const today = new Date();
  const days = [];
  let d = new Date(today);
  while (days.length < 7) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) { // weekdays only
      days.push(new Date(d));
    }
    d.setDate(d.getDate() - 1);
  }
  days.reverse();
  return days.map((dt, idx) => ({
    date: dt.toISOString().slice(0,10),
    price: Number((base + deltas[idx]).toFixed(2))
  })).map((p, i) => ({ t: i, date: p.date, price: p.price }));
};

export default function GoldSilver() {
  const [asset, setAsset] = useState("gold"); // gold | silver
  const [range, setRange] = useState("6mo");
  const [interval, setInterval] = useState("1d");
  const [series, setSeries] = useState([]);
  const [cleaned, setCleaned] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [goldSer, setGoldSer] = useState([]);
  const [silverSer, setSilverSer] = useState([]);
  const [quick, setQuick] = useState(true);
  const [liveCurrent, setLiveCurrent] = useState(null);
  const reqCtrl = useRef(null);

  useEffect(() => {
    fetchBoth();
    return () => { if (reqCtrl.current) reqCtrl.current.abort(); };
  }, [range, interval, quick]);

  const fetchData = async ({ force } = {}) => {
    setLoading(true); setErr("");
    const cached = !force ? readCache(asset, range, interval) : null;
    if (cached?.series?.length && (Date.now() - cached.ts) < FRESH_MS) {
      setSeries(cached.series);
      setCleaned(cached.series);
      setLiveCurrent(cached.series[cached.series.length - 1]?.price ?? null);
      if (asset === "gold") setGoldSer(cached.series);
      if (asset === "silver") setSilverSer(cached.series);
      setNote(`Using cached data (${age(cached.ts)})`);
      setLoading(false);
      return;
    }
    if (reqCtrl.current) reqCtrl.current.abort();
    const ctrl = new AbortController(); reqCtrl.current = ctrl;
    try {
      const res = await api.get("/commodities/gold-silver/", { params: { asset, range, interval }, timeout: 6000, signal: ctrl.signal });
      let mapped = (res?.data?.series || [])
        .map((p, idx) => ({ t: idx, date: p.date || p.timestamp || idx, price: toNum(p.price) }))
        .filter(p => p.price !== null)
        .sort((a,b) => (a.date > b.date ? 1 : -1));
      const currentFromApi = toNum(res?.data?.current_price);
      const limit = quick ? 120 : 800;
      if (mapped.length > limit) mapped = mapped.slice(-limit);
      setSeries(mapped);
      setCleaned(mapped);
      setLiveCurrent(currentFromApi ?? mapped[mapped.length - 1]?.price ?? null);
      if (asset === "gold") setGoldSer(mapped);
      if (asset === "silver") setSilverSer(mapped);
      writeCache(asset, range, interval, mapped);
      setNote("Live data loaded");
    } catch (e) {
      if (!cached) setErr("Unable to fetch live data. Check backend or try Quick mode/shorter range.");
      else setNote(prev => prev || "Using cached data");
    } finally {
      setLoading(false);
    }
  };

  const fetchBoth = async () => {
    setLoading(true); setErr("");
    if (reqCtrl.current) reqCtrl.current.abort();
    const ctrl = new AbortController(); reqCtrl.current = ctrl;
    try {
      const [g, s] = await Promise.all([
        api.get("/commodities/gold-silver/", { params: { asset: "gold", range, interval }, timeout: 6000, signal: ctrl.signal }),
        api.get("/commodities/gold-silver/", { params: { asset: "silver", range, interval }, timeout: 6000, signal: ctrl.signal }),
      ]);
      const mapSort = (raw) => (raw || [])
        .map((p, idx) => ({ t: idx, date: p.date || p.timestamp || idx, price: toNum(p.price) }))
        .filter(p => p.price !== null)
        .sort((a,b) => (a.date > b.date ? 1 : -1));
      const limit = quick ? 120 : 800;
      const gSer = mapSort(g?.data?.series).slice(-limit);
      const sSer = mapSort(s?.data?.series).slice(-limit);
      setGoldSer(gSer);
      setSilverSer(sSer);
      if (asset === "gold") setLiveCurrent(toNum(g?.data?.current_price) ?? gSer[gSer.length - 1]?.price ?? null);
      if (asset === "silver") setLiveCurrent(toNum(s?.data?.current_price) ?? sSer[sSer.length - 1]?.price ?? null);
      setNote("Loaded both assets");
    } catch (e) {
      setErr("Failed to fetch both assets. Try Quick mode or manual week.");
    } finally {
      setLoading(false);
    }
  };

  const runCleaning = () => {
    if (!series.length) return;
    const dedup = new Map();
    series.forEach(p => { if (!dedup.has(p.date)) dedup.set(p.date, p); });
    const arr = Array.from(dedup.values()).sort((a,b) => (a.date > b.date ? 1 : -1));
    const prices = arr.map(p => p.price);
    const smoothed = movingAverage(prices, 5);
    const cleanedArr = arr.map((p, i) => ({ ...p, price: smoothed[i] ?? p.price }));
    setCleaned(cleanedArr);
  };

  const regressionData = useMemo(() => {
    const src = cleaned.length ? cleaned : series;
    const pts = src.slice(-WINDOW);
    const xs = pts.map((_, i) => i);
    const ys = pts.map(p => p.price);
    if (pts.length < 3) return [];
    const { a, b } = linReg(xs, ys);
    const L = logisticFit(xs, ys);
    return pts.map((p, i) => {
      const lin = a + b * i;
      const z = L.a + L.b * i;
      const sig = sigmoid(z);
      const logi = L.minY + sig * (L.maxY - L.minY);
      return { ...p, idx: i, linear: lin, logistic: logi };
    });
  }, [cleaned, series]);

  const combinedData = useMemo(() => {
    if (!goldSer.length || !silverSer.length) return [];
    const g = new Map(goldSer.map(p => [p.date, p.price]));
    const s = new Map(silverSer.map(p => [p.date, p.price]));
    const allDates = Array.from(new Set([...g.keys(), ...s.keys()])).sort();
    
    return allDates.map(date => ({
      date,
      gold: g.get(date) || null,
      silver: s.get(date) || null
    })).filter(d => d.gold !== null || d.silver !== null);
  }, [goldSer, silverSer]);

  const alignedPairs = useMemo(() => {
    return combinedData.filter(d => d.gold !== null && d.silver !== null).slice(-WINDOW);
  }, [combinedData]);

  const corr = useMemo(() => {
    const n = alignedPairs.length;
    if (!n) return 0;
    let sx=0, sy=0, sxx=0, syy=0, sxy=0;
    for (const p of alignedPairs) { const x=p.gold, y=p.silver; sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y; }
    const num = n*sxy - sx*sy;
    const den = Math.sqrt((n*sxx - sx*sx) * (n*syy - sy*sy)) || 1;
    return num/den;
  }, [alignedPairs]);

  return (
    <main className="gs container">
      <header className="gs-header">
        <h1>Gold / Silver</h1>
        <div className="gs-controls">
          <select value={asset} onChange={(e)=>setAsset(e.target.value)}>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
          </select>
          <select value={range} onChange={(e)=>setRange(e.target.value)}>
            <option value="1mo">1M</option>
            <option value="3mo">3M</option>
            <option value="6mo">6M</option>
            <option value="1y">1Y</option>
            <option value="5y">5Y</option>
          </select>
          <select value={interval} onChange={(e)=>setInterval(e.target.value)}>
            <option value="1d">1D</option>
            <option value="1wk">1W</option>
          </select>
          <label className="gs-inline" title="Trim to fewer points for faster charts"><input type="checkbox" checked={quick} onChange={(e)=>setQuick(e.target.checked)} /> Quick mode</label>
          <button className="btn-primary" onClick={() => fetchData({ force: true })} disabled={loading}>Fetch</button>
          <button className="btn-ghost" onClick={runCleaning} disabled={!series.length}>Clean & Smooth</button>
          <button className="btn-ghost" onClick={fetchBoth} disabled={loading}>Fetch Both</button>
          <button className="btn-ghost" onClick={() => { const m = manualWeekData(asset); setSeries(m); setCleaned(m); setLiveCurrent(m[m.length - 1]?.price ?? null); if (asset === "gold") setGoldSer(m); if (asset === "silver") setSilverSer(m); setErr(""); }} disabled={loading}>Manual 1W</button>
        </div>
      </header>

      {note && <div className="gs-note">{note}</div>}
      {err && <div className="gs-error">{err}</div>}

      <section className="gs-card">
        <div className="gs-card-title">Live Market Comparison: Gold vs Silver</div>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" hide />
              <YAxis yAxisId="left" orientation="left" stroke="#ffd700" domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" stroke="#c0c0c0" domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line yAxisId="left" type="monotone" dataKey="gold" name="Gold Price" stroke="#ffd700" strokeWidth={3} dot={false} animationDuration={1000} />
              <Line yAxisId="right" type="monotone" dataKey="silver" name="Silver Price" stroke="#c0c0c0" strokeWidth={3} dot={false} animationDuration={1000} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="gs-stats mt-4">
          <div className="pp-chip" style={{ borderColor: '#ffd700', color: '#ffd700' }}>
            Gold: {goldSer.length ? goldSer[goldSer.length-1].price.toFixed(2) : '---'}
          </div>
          <div className="pp-chip" style={{ borderColor: '#c0c0c0', color: '#c0c0c0' }}>
            Silver: {silverSer.length ? silverSer[silverSer.length-1].price.toFixed(2) : '---'}
          </div>
        </div>
      </section>

      <section className="gs-card">
        <div className="gs-card-title">Price Correlation Analysis {alignedPairs.length ? `(r = ${corr.toFixed(3)})` : ""}</div>
        <div className="gs-note mb-4">A correlation (r) near 1.0 indicates Gold and Silver are moving closely together.</div>
        <div style={{ height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="gold" name="Gold" unit="$" stroke="#ffd700" />
              <YAxis dataKey="silver" name="Silver" unit="$" stroke="#c0c0c0" />
              <ZAxis range={[60,60]} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
              />
              <Scatter name="Price Pairs" data={alignedPairs} fill="#6366f1" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}