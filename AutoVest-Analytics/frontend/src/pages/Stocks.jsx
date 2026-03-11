import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, TrendingUp, BarChart3, ArrowRight } from "lucide-react";
import api from "../services/api";

const SECTOR_IMAGES = {
  IT: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=100",
  FINANCE: "https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&q=80&w=100",
  HEALTHCARE: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=100",
  BANK: "https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&q=80&w=100",
};

export default function Stocks() {
  const [searchParams] = useSearchParams();
  const selectedPortfolio = searchParams.get("portfolio");

  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");

  const addToPortfolio = (s, e) => {
    e.preventDefault();
    e.stopPropagation();
    const qty = Number(prompt(`Quantity for ${s.symbol}`, "10"));
    const buy = Number(prompt("Buy price", "100"));
    if (!Number.isFinite(qty) || !Number.isFinite(buy) || qty <= 0 || buy <= 0) return;
    const data = JSON.parse(localStorage.getItem("portfolioHoldings") || "[]");
    const item = {
      name: s.company_name || s.symbol,
      symbol: s.symbol,
      quantity: qty,
      buyPrice: buy,
      currentPrice: Number(s.price || s.current_price || 0),
      peRatio: s.pe_ratio ?? null,
      sector: s.portfolio_sector || "UNSPECIFIED",
    };
    data.push(item);
    localStorage.setItem("portfolioHoldings", JSON.stringify(data));
    alert("Added to portfolio");
  };

  useEffect(() => {
    setLoading(true);
    setErr("");
    const params = { refresh: 1 };
    if (selectedPortfolio) {
      params.portfolio = selectedPortfolio;
    }

    api.get("/stocks/", { params })
      .then((res) => setStocks(res.data))
      .catch(() => setErr("Failed to load stocks"))
      .finally(() => setLoading(false));
  }, [selectedPortfolio]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter((s) =>
      `${s.symbol} ${s.company_name}`.toLowerCase().includes(q)
    );
  }, [stocks, query]);

  const addToPortfolioManual = (symbol) => {
    const qty = Number(prompt(`Quantity for ${symbol}`, "10"));
    const buy = Number(prompt("Buy price", "100"));
    if (!Number.isFinite(qty) || !Number.isFinite(buy) || qty <= 0 || buy <= 0) return;
    
    const data = JSON.parse(localStorage.getItem("portfolioHoldings") || "[]");
    const item = {
      name: symbol,
      symbol: symbol,
      quantity: qty,
      buyPrice: buy,
      currentPrice: 0,
      peRatio: null,
      sector: "UNSPECIFIED",
    };
    data.push(item);
    localStorage.setItem("portfolioHoldings", JSON.stringify(data));
    alert(`Successfully added ${symbol} to your portfolio!`);
    setQuery("");
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 font-['Poppins',sans-serif]">
      <style>{`
        .stock-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .stock-card:hover {
          transform: translateY(-4px);
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
        }
        .search-container {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .search-input:focus {
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }
        .animate-slideUp {
          animation: slideUp 0.5s ease-out forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="mb-12 animate-slideUp">
        <h1 className="text-4xl font-bold text-white mb-3">Market Explorer</h1>
        <p className="text-slate-400 text-lg">
          Discover and analyze stocks with real-time insights from yfinance.
        </p>
        {selectedPortfolio && stocks.length > 0 && (
          <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium">
            <BarChart3 size={16} />
            Portfolio: {stocks[0].portfolio_name} ({stocks[0].portfolio_sector})
          </div>
        )}
      </div>

      <div className="mb-10 animate-slideUp" style={{ animationDelay: '0.1s' }}>
        <div className="search-container flex items-center gap-3 p-2 rounded-2xl max-w-3xl">
          <div className="pl-4 text-slate-400">
            <Search size={20} />
          </div>
          <input
            className="flex-1 bg-transparent border-none outline-none text-white py-3 px-1 text-lg placeholder:text-slate-500 search-input"
            placeholder="Search stock by name or ticker (e.g., AAPL, TCS)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20">
            Search
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium animate-slideUp">
          {err}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slideUp" style={{ animationDelay: '0.2s' }}>
          {filtered.map((s) => (
            <Link 
              to={`/stocks/${s.id}`} 
              key={s.id} 
              className="stock-card group relative p-6 rounded-3xl bg-white/5 flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <img
                    src={SECTOR_IMAGES[s.portfolio_sector] || SECTOR_IMAGES.IT}
                    alt={s.portfolio_sector}
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (s.discount_percent ?? 0) > 15 ? 'bg-emerald-500/10 text-emerald-400' : 
                  (s.discount_percent ?? 0) > 5 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'
                }`}>
                  {s.discount_percent ?? 0}% OPPORTUNITY
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors mb-1 flex items-center gap-2">
                  {s.symbol}
                  <ArrowRight size={16} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h3>
                <p className="text-slate-400 text-sm font-medium truncate mb-4">{s.company_name}</p>
                
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><TrendingUp size={12} /> {s.portfolio_sector}</span>
                  <span>{s.portfolio_name}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button 
                  onClick={(e) => addToPortfolio(s, e)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-bold transition-all border border-white/5"
                >
                  <Plus size={16} /> Add to Portfolio
                </button>
              </div>
            </Link>
          ))}
          
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center animate-slideUp">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-indigo-500/10 mb-8 text-indigo-400">
                <Search size={48} />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">Stock not found</h3>
              <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
                We couldn't find "{query}" in our database. You can add it manually to your portfolio to track it.
              </p>
              <button 
                onClick={() => addToPortfolioManual(query.toUpperCase())}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/30 flex items-center gap-2 mx-auto"
              >
                <Plus size={20} /> Add "{query.toUpperCase()}" to Portfolio
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
