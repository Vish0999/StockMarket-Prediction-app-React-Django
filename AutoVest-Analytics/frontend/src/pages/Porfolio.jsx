import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import "./PortfolioPage.css";

const STORAGE_KEY = "portfolioHoldings";
const MANUAL_STORAGE_KEY = "manualStocks";

const formatCurrency = (value) => `\u20B9${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeSector = (value) => {
  const raw = (value || "").toString().trim().toUpperCase();
  if (!raw) return "UNSPECIFIED";
  if (raw === "BANKING") return "BANK";
  return raw;
};

const normalizeSymbol = (value) => (value || "").toString().trim().toUpperCase();

const candidatesForSymbol = (symbol) => {
  const sym = normalizeSymbol(symbol);
  if (!sym) return [];
  if (sym.includes(".")) return [sym];
  return [sym, `${sym}.NS`, `${sym}.BO`];
};

export default function Portfolio() {
  const [searchParams] = useSearchParams();
  const selectedSector = normalizeSector(searchParams.get("sector"));
  const [priceBySymbol, setPriceBySymbol] = useState({});

  const holdings = useMemo(() => {
    const rawHoldings = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const manualStocks = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || "[]");

    const base = rawHoldings.map((item) => ({
      name: item.name || item.symbol || item.ticker || "Unknown Stock",
      symbol: normalizeSymbol(item.symbol || item.ticker || item.name),
      sector: normalizeSector(item.sector || item.portfolio_sector),
      price: Number(item.currentPrice ?? item.price ?? 0),
    }));

    const seen = new Set(
      base.map((item) => `${normalizeSymbol(item.name)}::${item.sector}`)
    );

    manualStocks.forEach((item) => {
      const name = normalizeSymbol(item.ticker || item.name);
      const sector = normalizeSector(item.sector);
      if (!name) return;
      const key = `${name}::${sector}`;
      if (seen.has(key)) return;
      base.push({ name, symbol: name, sector, price: 0 });
      seen.add(key);
    });

    return base;
  }, []);

  useEffect(() => {
    const fetchMissingPrices = async () => {
      const targets = holdings.filter((h) => (!h.price || h.price <= 0) && h.symbol);
      if (!targets.length) return;

      const nextPrices = {};

      for (const stock of targets) {
        const symbolCandidates = candidatesForSymbol(stock.symbol);
        for (const candidate of symbolCandidates) {
          try {
            const res = await api.get("/analyze/", { params: { symbol: candidate } });
            const livePrice = Number(res?.data?.price ?? 0);
            if (Number.isFinite(livePrice) && livePrice > 0) {
              nextPrices[stock.symbol] = livePrice;
              break;
            }
          } catch (_) {
            continue;
          }
        }
      }

      if (Object.keys(nextPrices).length === 0) return;
      setPriceBySymbol((prev) => ({ ...prev, ...nextPrices }));

      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const updated = raw.map((item) => {
        const itemSymbol = normalizeSymbol(item.symbol || item.ticker || item.name);
        const live = nextPrices[itemSymbol];
        if (!live) return item;
        return { ...item, currentPrice: live };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    fetchMissingPrices();
  }, [holdings]);

  const filteredHoldings = useMemo(() => {
    const visible = holdings.map((stock) => ({
      ...stock,
      price: Number(priceBySymbol[stock.symbol] ?? stock.price ?? 0),
    }));
    
    const sectorQuery = searchParams.get("sector");
    if (!sectorQuery) return visible;
    
    // Normalize query for comparison
    const normalizedQuery = normalizeSector(sectorQuery);
    return visible.filter((stock) => stock.sector === normalizedQuery);
  }, [holdings, priceBySymbol, searchParams]);

  return (
    <main className="portfolio-page">
      <header className="portfolio-header">
        <h1 className="portfolio-title">
          {searchParams.get("sector") ? `${normalizeSector(searchParams.get("sector"))} Portfolio` : "My Assets"}
        </h1>
        <p className="portfolio-subtitle">
          {searchParams.get("sector")
            ? `Exclusive analysis of your holdings in the ${normalizeSector(searchParams.get("sector"))} sector.`
            : "Real-time overview of your complete tracked market holdings."}
        </p>
      </header>

      <section className="portfolio-grid">
        {filteredHoldings.map((stock, index) => (
          <div key={`${stock.name}-${index}`} className="stock-item-card">
            <div className="stock-info">
              <div className="stock-icon-box">
                {stock.name.charAt(0)}
              </div>
              <div className="stock-details">
                <div className="stock-name-row">
                  <span className="stock-symbol">{stock.symbol || stock.name}</span>
                  <span className="stock-sector-tag">{stock.sector}</span>
                </div>
                <span className="stock-full-name">{stock.name}</span>
              </div>
            </div>
            
            <div className="stock-price-box">
              <div className="stock-price-label">Market Value</div>
              <div className="stock-price-value">
                {stock.price > 0 ? formatCurrency(stock.price) : "Live Fetch..."}
              </div>
            </div>
          </div>
        ))}

        {filteredHoldings.length === 0 && (
          <div className="empty-portfolio">
            <span className="empty-icon">📂</span>
            <p className="empty-text">
              {searchParams.get("sector")
                ? `No assets found in the ${selectedSector} sector.`
                : "Your portfolio is currently empty. Start adding assets to track them."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
