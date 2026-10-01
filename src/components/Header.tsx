import React, { useEffect } from 'react';
import { 
  Sparkles, 
  Plus, 
  FileSpreadsheet, 
  Store, 
  FileText, 
  BarChart3, 
  Building2,
  ScanLine
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'orders' | 'pos' | 'stores' | 'analytics';
  setActiveTab: (tab: 'orders' | 'pos' | 'stores' | 'analytics') => void;
  onOpenScan: () => void;
  onAddNewOrder: () => void;
  onAddNewStore: () => void;
  onAddNewPO?: () => void;
  onExportExcel: () => void;
  totalOrders: number;
  totalPOs: number;
  totalStores: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenScan,
  onAddNewOrder,
  onAddNewStore,
  onAddNewPO,
  onExportExcel,
  totalOrders,
  totalPOs,
  totalStores
}) => {
  // Keyboard shortcut listener: Cmd/Ctrl + S for AI Scan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onOpenScan();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenScan]);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
      <div className="max-w-[1920px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Brand & Editorial Title */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <ScanLine className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                ระบบจัดการร้านค้าและประวัติการสั่งซื้ออัตโนมัติ
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Gemini 3.8 Flash Vision</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden md:block">
              สแกนบิลและตั๋วชั่งอัตโนมัติ จัดการแยกตามประเภทเอกสาร และบันทึกประวัติการสั่งซื้อรายร้านค้า
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Segmented Control) */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>ตั๋วชั่ง & บิลส่งของ</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold tabular-nums">
              {totalOrders}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'pos'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>ใบสั่งซื้อ (PO)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold tabular-nums">
              {totalPOs}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('stores')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'stores'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-indigo-600" />
            <span>ทะเบียนร้านค้า</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold tabular-nums">
              {totalStores}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
            <span>วิเคราะห์ & การเงิน</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary AI Scan Button */}
          <button
            onClick={onOpenScan}
            title="กดเพื่อสแกนบิลด้วย Gemini AI (ทางลัด: Ctrl+S หรือ ⌘S)"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            <span>สแกนบิลด้วย AI</span>
            <kbd className="hidden lg:inline-block px-1.5 py-0.2 text-[10px] bg-blue-700/60 rounded text-blue-100 font-mono">
              ⌘S
            </kbd>
          </button>

          {/* New Order */}
          <button
            onClick={onAddNewOrder}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-medium transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มคำสั่งซื้อ</span>
          </button>

          {/* New Store */}
          <button
            onClick={onAddNewStore}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>เพิ่มร้านค้า</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={onExportExcel}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="ส่งออกรายงาน Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">ส่งออก Excel</span>
          </button>
        </div>

      </div>
    </header>
  );
};
