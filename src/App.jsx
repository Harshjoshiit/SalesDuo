// client/src/App.jsx
import { useState, useEffect } from 'react';
import { Search, RefreshCw, History, ArrowRight, ShoppingBag, Save } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

/* ================= HEADER ================= */
const Header = () => (
  <header className="bg-slate-900 text-white p-4 shadow-md">
    <div className="max-w-6xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ShoppingBag className="text-orange-400" />
        <h1 className="text-xl font-bold tracking-tight">
          SalesDuo <span className="text-orange-400">Optimizer</span>
        </h1>
      </div>
      <div className="text-xs text-slate-400">Local Production Mode</div>
    </div>
  </header>
);

/* ================= COMPARISON CARD ================= */
const ComparisonCard = ({ title, original, optimized, type }) => (
  <div className="mb-6 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-semibold text-slate-700 uppercase text-xs tracking-wider">
      {title}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
      <div className="p-4 bg-slate-50/50">
        <div className="text-xs text-slate-400 font-bold mb-2 uppercase">Original</div>
        {type === 'list' ? (
          <ul className="list-disc pl-4 text-sm text-slate-600 space-y-1">
            {original?.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-slate-600 leading-relaxed">{original}</p>
        )}
      </div>

      <div className="p-4 bg-green-50/30">
        <div className="text-xs text-green-600 font-bold mb-2 uppercase flex items-center gap-1">
          <RefreshCw size={12} /> AI Optimized
        </div>

        {!optimized || (Array.isArray(optimized) && optimized.length === 0) ? (
          <div className="text-xs italic text-slate-400">
            Click “Optimize” to generate content
          </div>
        ) : type === 'list' ? (
          <ul className="list-disc pl-4 text-sm text-slate-800 space-y-1 font-medium">
            {optimized.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-slate-800 leading-relaxed font-medium">
            {optimized}
          </p>
        )}
      </div>
    </div>
  </div>
);

/* ================= HISTORY CARD ================= */
const HistoryCard = ({ record, onRevert }) => {
  const formattedDate = new Date(record.createdAt).toLocaleString();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-start mb-2 border-b pb-2">
        <h3 className="text-lg font-bold text-slate-800">
          ASIN: <span className="text-orange-600">{record.asin}</span>
        </h3>
        <div className="text-right">
          <p className="text-xs text-slate-500">{formattedDate}</p>
          <p className="text-xs text-slate-400">Model: {record.ai_model}</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Title */}
        <p className="text-sm">
          <span className="font-semibold text-slate-600">Optimized Title:</span> {record.optimized_title}
        </p>

        {/* Keywords */}
        <div className="flex flex-wrap gap-2 pt-1 border-t">
          <span className="text-xs font-semibold text-slate-600">Keywords:</span>
          {(record.optimized_keywords || []).map((k, i) => (
            <span
              key={i}
              className="bg-orange-100 text-orange-800 px-2 py-0.5 text-xs rounded"
            >
              {k}
            </span>
          ))}
        </div>
        <button 
          onClick={() => onRevert(record)}
          className="w-full text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 py-1 rounded mt-2"
        >
          View Full Record
        </button>
      </div>
    </div>
  );
};

/* ================= MAIN APP ================= */
export default function App() {
  const [asin, setAsin] = useState('');
  const [activeTab, setActiveTab] = useState('optimize');

  const [fetchedData, setFetchedData] = useState(null);
  const [optimizedData, setOptimizedData] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  /* ================= HISTORY ================= */
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/history`);
      setHistory(res.data);
    } catch {
      console.log("History unavailable");
    }
  };
  
  const handleRevert = (record) => {
    setAsin(record.asin);
    setFetchedData({
      title: record.original_title,
      bullets: record.original_bullets,
      description: record.original_description,
    });
    setOptimizedData({
      title: record.optimized_title,
      bullets: record.optimized_bullets,
      description: record.optimized_description,
      keywords: record.optimized_keywords,
    });
    setStatus(`Loaded history record ID ${record.id}`);
    setActiveTab('optimize');
  };


  /* ================= FETCH ================= */
  const handleFetch = async () => {
    if (!asin) return;

    setLoading(true);
    setError('');
    setStatus('Scraping Amazon...');
    
    setFetchedData(null);
    setOptimizedData(null);

    try {
      const res = await axios.get(`${API_URL}/fetch/${asin}`);
      setFetchedData(res.data.data);
      setStatus('Product fetched successfully');
    } catch {
      setError('Failed to fetch product data');
    } finally {
      setLoading(false);
    }
  };

  /* ================= OPTIMIZE ================= */
  const handleOptimize = async () => {
    if (!fetchedData) return;

    setLoading(true);
    setError('');
    setStatus('Optimizing with AI...');

    try {
      const res = await axios.post(`${API_URL}/optimize`, {
        asin,
        data: fetchedData
      });

      setOptimizedData(res.data.optimized);
      setStatus('Optimization Complete! Click "Save" to record.');
    } catch {
      setError('AI optimization failed');
    } finally {
      setLoading(false);
    }
  };

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (!fetchedData || !optimizedData) return;

    setLoading(true);
    setError('');
    setStatus('Saving optimization to history...');

    try {
      const res = await axios.post(`${API_URL}/optimize`, {
        asin,
        data: fetchedData
      });
      
      await axios.post(`${API_URL}/save`, {
        asin,
        original: fetchedData,
        optimized: optimizedData,
        // Get the model name from the optimize response for accuracy
        ai_used: res.data.ai_used || 'gemini-2.5-pro',
      });
      
      setStatus('Optimization saved successfully!');
      fetchHistory();
    } catch {
      setError('Failed to save history');
    } finally {
      setLoading(false);
    }
  };


  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      <Header />

      <main className="flex-grow p-4 md:p-6 max-w-6xl mx-auto w-full">
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('optimize')}
            className={`pb-2 px-4 font-medium text-sm ${
              activeTab === 'optimize'
                ? 'border-b-2 border-orange-500 text-orange-600'
                : 'text-slate-500'
            }`}
          >
            Optimizer
          </button>

          <button
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
            className={`pb-2 px-4 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-b-2 border-orange-500 text-orange-600'
                : 'text-slate-500'
            }`}
          >
            History ({history.length})
          </button>
        </div>

        {activeTab === 'optimize' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <label className="text-xs font-medium">ASIN</label>

                <div className="flex gap-2 mt-1">
                  <input
                    value={asin}
                    onChange={(e) => setAsin(e.target.value)}
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    placeholder="e.g., B07H65KP63"
                  />
                  <button
                    onClick={handleFetch}
                    className="bg-slate-800 text-white px-4 rounded font-semibold flex items-center gap-1 hover:bg-slate-700"
                    disabled={loading}
                  >
                    {loading ? '...' : <><Search size={16} /> Fetch</>}
                  </button>
                </div>

                {fetchedData && (
                  <button
                    onClick={handleOptimize}
                    className="w-full bg-orange-400 hover:bg-orange-500 text-white mt-4 py-2 rounded font-semibold"
                    disabled={loading}
                  >
                    <RefreshCw size={16} className="inline mr-2" /> Optimize with AI
                  </button>
                )}
                
                {optimizedData && (
                  <button
                    onClick={handleSave}
                    className="w-full bg-green-500 hover:bg-green-600 text-white mt-2 py-2 rounded font-semibold"
                    disabled={loading}
                  >
                    <Save size={16} className="inline mr-2" /> Save Optimization
                  </button>
                )}

                {status && <p className="text-xs text-blue-500 mt-2">{status}</p>}
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              </div>
            </div>

            <div className="lg:col-span-8">
              {fetchedData ? (
                <>
                  <ComparisonCard
                    title="Title"
                    original={fetchedData.title}
                    optimized={optimizedData?.title}
                  />
                  <ComparisonCard
                    title="Bullets"
                    original={fetchedData.bullets}
                    optimized={optimizedData?.bullets}
                    type="list"
                  />
                  <ComparisonCard
                    title="Description"
                    original={fetchedData.description}
                    optimized={optimizedData?.description}
                  />

                  {optimizedData?.keywords && (
                    <div className="bg-white border rounded p-4 mt-6">
                      <div className="text-xs font-semibold mb-2">
                        AI Suggested Keywords
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {optimizedData.keywords.map((k, i) => (
                          <span
                            key={i}
                            className="bg-orange-100 text-orange-800 px-2 py-0.5 text-xs rounded"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center border-2 border-dashed p-10 rounded text-slate-500">
                  <Search size={24} className="mx-auto mb-2"/>
                  Fetch a product by ASIN (e.g., B07H65KP63) to begin optimization.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Optimization History</h2>
              <button 
                onClick={fetchHistory} 
                className="text-sm text-slate-500 hover:text-orange-500 flex items-center gap-1"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {history.length === 0 ? (
              <div className="text-center border-2 border-dashed p-10 rounded text-slate-500">
                <History size={24} className="mx-auto mb-2"/>
                No optimization history found. Save an optimization to see it here.
              </div>
            ) : (
              <div className="space-y-6">
                {history.map((record) => (
                  <HistoryCard key={record.id} record={record} onRevert={handleRevert}/>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}