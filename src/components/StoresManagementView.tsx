import React, { useState, useMemo } from 'react';
import { 
  Store, 
  Search, 
  Plus, 
  Phone, 
  MapPin, 
  ChevronRight, 
  FileText, 
  CreditCard, 
  AlertCircle,
  TrendingUp,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { StoreMerchant, OrderRecord } from '../types';

interface StoresManagementViewProps {
  stores: StoreMerchant[];
  orders: OrderRecord[];
  onSelectStore: (store: StoreMerchant) => void;
  onAddNewStore: () => void;
  onAddNewOrderForStore: (store: StoreMerchant) => void;
}

export const StoresManagementView: React.FC<StoresManagementViewProps> = ({
  stores,
  orders,
  onSelectStore,
  onAddNewStore,
  onAddNewOrderForStore
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Dynamically augment store metrics from real-time order records
  const augmentedStores = useMemo(() => {
    return stores.map(store => {
      const storeOrders = orders.filter(
        o => o.storeId === store.id || (o.col8 && o.col8.trim().toLowerCase() === store.name.trim().toLowerCase())
      );

      let totalPurchases = 0;
      let totalPaid = 0;
      let totalDebt = 0;
      let lastDate = store.lastOrderDate || '';

      storeOrders.forEach(o => {
        totalPurchases += Number(o.col29) || 0;
        totalPaid += Number(o.col35) || 0;
        totalDebt += Number(o.col36) || 0;
        if (o.col7 && o.col7 > lastDate) {
          lastDate = o.col7;
        }
      });

      return {
        ...store,
        totalOrders: storeOrders.length > 0 ? storeOrders.length : store.totalOrders,
        totalPurchases: storeOrders.length > 0 ? totalPurchases : store.totalPurchases,
        totalPaid: storeOrders.length > 0 ? totalPaid : store.totalPaid,
        totalDebt: storeOrders.length > 0 ? totalDebt : store.totalDebt,
        lastOrderDate: lastDate
      };
    });
  }, [stores, orders]);

  // Overall metrics across all stores
  const overallMetrics = useMemo(() => {
    let grandPurchases = 0;
    let grandDebt = 0;
    let grandPaid = 0;
    let grandOrders = 0;

    augmentedStores.forEach(s => {
      grandPurchases += s.totalPurchases;
      grandDebt += s.totalDebt;
      grandPaid += s.totalPaid;
      grandOrders += s.totalOrders;
    });

    return {
      storeCount: augmentedStores.length,
      grandPurchases,
      grandDebt,
      grandPaid,
      grandOrders
    };
  }, [augmentedStores]);

  // Filtered store list
  const filteredStores = useMemo(() => {
    return augmentedStores.filter(s => {
      if (selectedCategory && s.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const str = `${s.name} ${s.category} ${s.taxId || ''} ${s.phone || ''} ${s.contactPerson || ''} ${s.address || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [augmentedStores, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    return Array.from(new Set(stores.map(s => s.category).filter(Boolean)));
  }, [stores]);

  const fmtCurrency = (val: number) => {
    return '฿' + val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner KPI for Stores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">ร้านค้า & คู่ค้าทั้งหมด</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{overallMetrics.storeCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">ในทะเบียนระบบ</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">ยอดสั่งซื้อสะสมรวม</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">{fmtCurrency(overallMetrics.grandPurchases)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{overallMetrics.grandOrders} คำสั่งซื้อ</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">ชำระเงินให้ร้านค้าแล้ว</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{fmtCurrency(overallMetrics.grandPaid)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {overallMetrics.grandPurchases > 0 ? `${((overallMetrics.grandPaid / overallMetrics.grandPurchases) * 100).toFixed(0)}% ของยอดรวม` : '-'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-rose-700 font-medium">ยอดหนี้คงค้างร้านค้า</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{fmtCurrency(overallMetrics.grandDebt)}</div>
            <div className="text-[11px] text-rose-500 mt-0.5">รอครบกำหนดชำระ</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Category filter & Add New Store */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อร้านค้า, หมวดหมู่, เลขผู้เสียภาษี, เบอร์โทร..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
          >
            <option value="">ทุกหมวดหมู่ ({categories.length})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onAddNewStore}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มร้านค้า / คู่ค้าใหม่</span>
        </button>
      </div>

      {/* Store Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStores.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
            <Store className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">ไม่พบข้อมูลร้านค้า</p>
            <p className="text-xs text-slate-400 mt-1">กด &quot;เพิ่มร้านค้า / คู่ค้าใหม่&quot; หรือสแกนบิลเพื่อให้ระบบบันทึกร้านค้าอัตโนมัติ</p>
          </div>
        ) : (
          filteredStores.map(store => {
            const hasDebt = store.totalDebt > 0;
            return (
              <div 
                key={store.id} 
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {store.category}
                        </span>
                        {store.creditTerms && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700">
                            {store.creditTerms}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition cursor-pointer"
                          onClick={() => onSelectStore(store)}>
                        {store.name}
                      </h3>
                    </div>

                    <button
                      onClick={() => onSelectStore(store)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="ดูประวัติและรายละเอียด"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Info points */}
                  <div className="space-y-1 text-xs text-slate-500">
                    {store.taxId && (
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-slate-400">Tax ID:</span>
                        <span>{store.taxId}</span>
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{store.phone}</span>
                        {store.contactPerson && <span className="text-slate-400">({store.contactPerson})</span>}
                      </div>
                    )}
                    {store.address && (
                      <div className="flex items-start gap-1.5 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{store.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Stats Bar inside Card */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-lg text-center border border-slate-100 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">คำสั่งซื้อ</div>
                      <div className="font-bold text-slate-800">{store.totalOrders} รายการ</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">ยอดซื้อรวม</div>
                      <div className="font-bold text-indigo-700 truncate" title={fmtCurrency(store.totalPurchases)}>
                        {fmtCurrency(store.totalPurchases)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">หนี้คงค้าง</div>
                      <div className={`font-bold truncate ${hasDebt ? 'text-rose-600' : 'text-emerald-600'}`} title={fmtCurrency(store.totalDebt)}>
                        {fmtCurrency(store.totalDebt)}
                      </div>
                    </div>
                  </div>

                  {/* Primary Goods Tags */}
                  {store.primaryGoods && store.primaryGoods.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {store.primaryGoods.slice(0, 3).map((good, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">
                          {good}
                        </span>
                      ))}
                      {store.primaryGoods.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[10px]">
                          +{store.primaryGoods.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Bottom Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>สั่งล่าสุด: {store.lastOrderDate || '-'}</span>
                  </span>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onAddNewOrderForStore(store)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-medium transition cursor-pointer text-xs flex items-center gap-1"
                      title="เพิ่มตั๋วชั่งหรือใบส่งของสำหรับร้านนี้"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ลงตั๋ว/บิล</span>
                    </button>
                    <button
                      onClick={() => onSelectStore(store)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold transition cursor-pointer text-xs flex items-center gap-1 shadow-xs"
                    >
                      <span>ดูประวัติ</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
