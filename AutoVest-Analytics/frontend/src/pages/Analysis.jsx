import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import api from "../services/api";

const STORAGE_KEY = "manualStocks";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getSeriesPrices = (series = []) =>
  series
    .map((point) => toNumber(point?.price))
    .filter((value) => value !== null);

const formatPrice = (value) => `${(value ?? 0).toFixed(2)}`;
const formatValue = (value) => (value ?? 0).toFixed(2);
const OPPORTUNITY_CHART_HEIGHT = 240;
const REGRESSION_CHART_HEIGHT = 260;

// Regression helpers (windowed to focus around current price)
const WINDOW_POINTS = 60; // use last N points; falls back to all if shorter
const linReg = (xs, ys) => {
  const n = xs.length;
  if (n === 0) return { a: 0, b: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) { const x = xs[i], y = ys[i]; sumX += x; sumY += y; sumXY += x*y; sumXX += x*x; }
  const denom = n * sumXX - sumX * sumX || 1;
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;
  return { a, b };
};
const clamp01 = (v) => Math.min(0.999, Math.max(0.001, v));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const logit = (p) => Math.log(p / (1 - p));
const logisticFit = (xs, ys) => {
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  const ysNorm = ys.map((y) => clamp01((y - minY) / range));
  const zs = ysNorm.map((p) => logit(p));
  const { a, b } = linReg(xs, zs);
  return { a, b, minY, maxY };
};
const buildRegressionSeries = (series) => {
  const all = getSeriesPrices(series);
  const prices = all.slice(-WINDOW_POINTS);
  const xs = Array.from({ length: prices.length }, (_, i) => i);
  const { a, b } = linReg(xs, prices);
  const L = logisticFit(xs, prices);
  return xs.map((x, i) => {
    const lin = a + b * x;
    const sig = sigmoid(L.a + L.b * x);
    const logistic = L.minY + sig * (L.maxY - L.minY);
    return { t: i + 1, price: prices[i], linear: lin, logistic };
  });
};

const predictNext = (series) => {
  const p = getSeriesPrices(series);
  if (p.length === 0) return { lin: 0, log: 0, ts: 0, rnn: 0 };
  if (p.length === 1) { const v = p[0]; return { lin: v, log: v, ts: v, rnn: v }; }
  const xs = Array.from({ length: p.length }, (_, i) => i);
  const { a, b } = linReg(xs, p);
  const lin = a + b * p.length;
  const L = logisticFit(xs, p);
  const sig = sigmoid(L.a + L.b * p.length);
  const log = L.minY + sig * (L.maxY - L.minY);
  const alpha = 0.3;
  let s = p[0];
  for (let i = 1; i < p.length; i++) s = alpha * p[i] + (1 - alpha) * s;
  const ts = s;
  const last = p[p.length - 1];
  const prev = p[p.length - 2];
  const momentum = last + (last - prev);
  const rnn = 0.5 * ts + 0.5 * momentum;
  return { lin, log, ts, rnn };
};

export default function Analysis() {
  const [entries, setEntries] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedStockId, setSelectedStockId] = useState(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    setEntries(saved);
  }, []);

  useEffect(() => {
    if (!entries.length) return;
    setLoading(true);
    setErr("");

    Promise.allSettled(
      entries.map((entry) =>
        api
          .get("/analyze/", { params: { symbol: entry.ticker } })
          .then((res) => ({ id: entry.id, data: res.data }))
      )
    )
      .then((results) => {
        const map = {};
        let failed = 0;
        const failedDetails = [];
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") {
            map[r.value.id] = r.value.data;
          } else {
            failed += 1;
            map[entries[idx].id] = { company_name: entries[idx].ticker, series: [] };
            const symbol = entries[idx].ticker;
            const status = r.reason?.response?.status;
            const detail = r.reason?.response?.data?.detail;
            if (status === 401) {
              failedDetails.push(`${symbol}: session expired`);
            } else if (detail) {
              failedDetails.push(`${symbol}: ${detail}`);
            } else if (status) {
              failedDetails.push(`${symbol}: request failed (${status})`);
            } else {
              failedDetails.push(`${symbol}: network/server error`);
            }
          }
        });
        setMetrics(map);
        if (failed > 0) {
          setErr(`Could not fetch live data for ${failed} stock(s). ${failedDetails.join(" | ")}`);
        }
      })
      .finally(() => setLoading(false));
  }, [entries]);

  const rows = useMemo(() => entries.map((entry) => ({ entry, data: metrics[entry.id] })), [entries, metrics]);
  const summaryRows = useMemo(
    () =>
      rows.map(({ entry, data }) => {
        const prices = getSeriesPrices(data?.series);
        const todayPrice = prices.length ? prices[prices.length - 1] : (toNumber(data?.price) ?? 0);
        const currentPrice = toNumber(data?.price) ?? todayPrice ?? 0;
        const minPrice = prices.length ? Math.min(...prices) : currentPrice ?? 0;
        const maxPrice = prices.length ? Math.max(...prices) : currentPrice ?? 0;

        const preds = predictNext(data?.series || []);
        return {
          id: entry.id,
          stockName: data?.symbol || entry.ticker,
          companyName: data?.company_name || "N/A",
          currentPrice,
          minPrice,
          maxPrice,
          lin1d: preds.lin,
          log1d: preds.log,
          ts1d: preds.ts,
          rnn1d: preds.rnn,
          peRatio: toNumber(data?.pe_ratio) ?? 0,
          discount: toNumber(data?.discount_percent) ?? 0,
        };
      }),
    [rows]
  );
  const opportunityData = useMemo(
    () => summaryRows.map((row) => ({ name: row.stockName, peRatio: row.peRatio })),
    [summaryRows]
  );
  const regressionRows = useMemo(
    () => rows.filter((r) => (r.data?.series?.length || 0) >= 3),
    [rows]
  );

  const selectedRegression = useMemo(() => {
    if (!regressionRows.length) return null;
    const found = regressionRows.find((r) => r.entry.id === selectedStockId);
    return found || regressionRows[0];
  }, [regressionRows, selectedStockId]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 font-['Poppins',sans-serif]">
      <style>{`
        .glass-table-container {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 2rem;
        }
        .stats-grid-mini {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.5rem;
        }
        .data-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.5rem;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }
        .data-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(99, 102, 241, 0.2);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>

      <div className="mb-12">
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">Portfolio Intelligence</h1>
        <p className="text-slate-400 text-lg max-w-2xl">
          Advanced algorithmic analysis and predictive trends for your selected holdings.
        </p>
      </div>

      {err && (
        <div className="mb-8 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold flex items-center gap-3 animate-slideUp">
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
          {err}
        </div>
      )}

      {loading && (
        <div className="mb-8 p-6 glass-table-container flex items-center gap-4 animate-slideUp">
          <div className="w-6 h-6 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-slate-300 font-bold">Synchronizing market data...</span>
        </div>
      )}

      {rows.length === 0 && !loading && (
        <div className="p-12 glass-table-container text-center animate-slideUp">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart3 size={40} className="text-slate-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Portfolio is Empty</h3>
          <p className="text-slate-400">Navigate to Manual Entry to start tracking your first assets.</p>
        </div>
      )}

      {summaryRows.length > 0 && (
        <div className="glass-table-container mb-12 overflow-hidden animate-slideUp">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-left">
                  <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-slate-400">Asset</th>
                  <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-slate-400">Price</th>
                  <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-slate-400">Market Range</th>
                  <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Prediction (Lin/Log)</th>
                  <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Efficiency (PE)</th>
                  <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Opportunity</th>
                  <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {summaryRows.map((row) => (
                  <tr key={row.id} className={`hover:bg-white/5 transition-all group ${selectedStockId === row.id ? 'bg-indigo-500/5' : ''}`}>
                    <td className="px-6 py-6">
                      <div className="font-black text-white text-base group-hover:text-indigo-400 transition-colors">{row.stockName}</div>
                      <div className="text-slate-500 text-xs font-bold uppercase tracking-tighter truncate max-w-[140px]">{row.companyName}</div>
                    </td>
                    <td className="px-6 py-6 font-mono font-bold text-white text-base">{formatPrice(row.currentPrice)}</td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          <span className="text-emerald-400 font-mono text-xs font-bold">{formatPrice(row.maxPrice)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                          <span className="text-rose-400 font-mono text-xs font-bold">{formatPrice(row.minPrice)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="inline-flex flex-col items-center p-2 rounded-xl bg-white/5 min-w-[100px]">
                        <span className="text-indigo-400 font-black text-sm">{formatPrice(row.lin1d)}</span>
                        <span className="text-amber-500/70 font-bold text-[10px]">{formatPrice(row.log1d)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="text-slate-200 font-black text-base">{formatValue(row.peRatio)}</span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className={`inline-block px-3 py-1.5 rounded-full font-black text-xs ${row.discount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {row.discount > 0 ? '▲' : '▼'} {Math.abs(row.discount).toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <button 
                        onClick={() => setSelectedStockId(row.id)}
                        className={`p-3 rounded-2xl transition-all active:scale-90 ${
                          selectedStockId === row.id 
                          ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/40' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                        }`}
                      >
                        <BarChart3 size={22} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedRegression && (
        <div className="animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <div className="glass-table-container p-8 border-indigo-500/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)]">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-600/20">
                    <BarChart3 className="text-white" size={24} />
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    {selectedRegression.data?.symbol || selectedRegression.entry.ticker}
                  </h2>
                </div>
                <p className="text-slate-400 font-bold text-sm ml-14">DETAILED TREND ANALYTICS • LAST 60 DATA POINTS</p>
              </div>
              
              <div className="flex gap-4 w-full lg:w-auto">
                <div className="flex-1 lg:flex-none px-6 py-4 rounded-3xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Live Value</div>
                  <div className="text-2xl font-mono font-black text-white">{formatPrice(selectedRegression.data?.price || 0)}</div>
                </div>
                <div className="flex-1 lg:flex-none px-6 py-4 rounded-3xl bg-indigo-600 text-center shadow-2xl shadow-indigo-600/20">
                  <div className="text-[10px] text-indigo-100 uppercase font-black tracking-widest mb-1">Linear Projection</div>
                  <div className="text-2xl font-mono font-black text-white">
                    {formatPrice(predictNext(selectedRegression.data.series || []).lin)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-10" style={{ height: 450 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={buildRegressionSeries(selectedRegression.data.series || [])} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.2)" fontSize={12} fontStyle="italic" />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                    itemStyle={{ fontWeight: '900', fontSize: '14px', padding: '4px 0' }}
                    cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Line type="monotone" dataKey="price" name="Market Price" stroke="#ffffff" strokeWidth={4} dot={false} animationDuration={1500} />
                  <Line type="monotone" dataKey="linear" name="Linear Fit" stroke="#6366f1" strokeWidth={2} strokeDasharray="8 4" dot={false} />
                  <Line type="monotone" dataKey="logistic" name="Logistic Fit" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="stats-grid-mini">
              <div className="data-card">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Sentiment Outlook</div>
                {predictNext(selectedRegression.data.series || []).lin > (selectedRegression.data?.price || 0) ? (
                  <div className="flex items-center gap-3 text-emerald-400 font-black text-lg">
                    <div className="p-2 rounded-lg bg-emerald-500/10"><TrendingUp size={24} /></div>
                    BULLISH TREND
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-rose-400 font-black text-lg">
                    <div className="p-2 rounded-lg bg-rose-500/10"><TrendingDown size={24} /></div>
                    BEARISH TREND
                  </div>
                )}
              </div>
              
              <div className="data-card">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Model Convergence</div>
                <div className="flex items-center gap-3 text-white font-black text-lg">
                  {Math.abs(predictNext(selectedRegression.data.series || []).lin - predictNext(selectedRegression.data.series || []).log) < 5 ? (
                    <><div className="p-2 rounded-lg bg-indigo-500/10"><Minus size={24} className="text-indigo-400" /></div> STABLE</>
                  ) : (
                    <><div className="p-2 rounded-lg bg-amber-500/10"><BarChart3 size={24} className="text-amber-400" /></div> VOLATILE</>
                  )}
                </div>
              </div>
              
              <div className="data-card">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Sample Density</div>
                <div className="flex items-center gap-3 text-white font-black text-lg">
                  <div className="p-2 rounded-lg bg-white/5"><span className="text-slate-400 font-mono text-xl">#</span></div>
                  {selectedRegression.data.series?.length || 0} POINTS
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {opportunityData.length > 0 && (
        <div className="glass-table-container p-8 mt-12 mb-12 animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="text-emerald-500" size={28} />
            <h3 className="text-2xl font-black text-white tracking-tight">Investment Opportunity Index</h3>
          </div>
          <div style={{ height: OPPORTUNITY_CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={opportunityData} margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={70} stroke="rgba(255,255,255,0.2)" fontSize={10} fontWeight="bold" />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} fontStyle="italic" />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  formatter={(value) => [formatValue(value), "PE Efficiency"]} 
                />
                <Line type="stepAfter" dataKey="peRatio" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#020617' }} activeDot={{ r: 9 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </main>
  );
}
