import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Chatbot from "./components/Chatbot";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Portfolio from "./pages/Porfolio";
import Stocks from "./pages/Stocks";
import StockDetail from "./pages/StockDetail";
import ManualEntry from "./pages/ManualEntry";
import Analysis from "./pages/Analysis";
import AnalysisGraph from "./pages/AnalysisGraph";
import GoldSilver from "./pages/GoldSilver";
import PortfolioPrediction from "./pages/PortfolioPrediction.jsx";
import BTCGraph from "./pages/BTCGraph";
export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/stocks" element={
          <ProtectedRoute>
            <Stocks />
          </ProtectedRoute>
        } />
        <Route path="/stocks/:id" element={
          <ProtectedRoute>
            <StockDetail />
          </ProtectedRoute>
        } />
        <Route path="/portfolio" element={
          <ProtectedRoute>
            <Portfolio />
          </ProtectedRoute>
        } />
        <Route path="/entry" element={
          <ProtectedRoute>
            <ManualEntry />
          </ProtectedRoute>
        } />
        <Route path="/analysis" element={
          <ProtectedRoute>
            <Analysis />
          </ProtectedRoute>
        } />
        <Route path="/analysis/graph" element={
          <ProtectedRoute>
            <AnalysisGraph />
          </ProtectedRoute>
        } />
        <Route path="/gold-silver" element={
          <ProtectedRoute>
            <GoldSilver />
          </ProtectedRoute>
        } />
        <Route path="/prediction" element={
          <ProtectedRoute>
            <PortfolioPrediction />
          </ProtectedRoute>
        } />
        <Route path="/btc" element={
          <ProtectedRoute>
            <BTCGraph />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Chatbot />
    </div>
  );
}
