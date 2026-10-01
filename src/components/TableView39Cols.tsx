import React, { useState, useMemo } from 'react';
import { 
  Search, 
  RotateCcw, 
  FileImage, 
  Copy, 
  Trash2, 
  CheckCircle, 
  Layers, 
  Eye, 
  CheckSquare, 
  Upload, 
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { OrderRecord, StoreMerchant } from '../types';

interface TableView39ColsProps {
  orders: OrderRecord[];
  stores: StoreMerchant[];
  onInspectOrder: (order: OrderRecord) => void;
  onDuplicateOrder: (order: OrderRecord) => void;
  onDeleteOrder: (id: string) => void;
  onUpdateOrder: (order: OrderRecord) => void;
  onOpenStoreModal?: (storeName: string) => void;
  onOpenScan?: () => void;
  externalFilter?: string | null;
}

type ViewPreset = 'all' | 'weighbridge' | 'delivery_order' | 'concrete' | 'tax_invoice' | 'custom';

export const TableView39Cols: React.FC<TableView39ColsProps> = ({
  orders,
  stores,
  onInspectOrder,
  onDuplicateOrder,
  onDeleteOrder,
  onUpdateOrder,
  onOpenStoreModal,
  onOpenScan,
  externalFilter
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(externalFilter || '');
  const [selectedDocTypeFilter, setSelectedDocTypeFilter] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<ViewPreset>('all');
  
  // Sync external filter when prop changes (e.g. from KPI stat card clicks)
  React.useEffect(() => {
    if (externalFilter !== undefined && externalFilter !== null) {
      setSelectedStatus(externalFilter);
    }
  }, [externalFilter]);
  
  // Zone visibility toggles
  const [visibleZones, setVisibleZones] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true
  });

  // Selected row IDs for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Distinct dropdown options
  const projects = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.col2).filter(Boolean)));
  }, [orders]);

  const categories = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.col3).filter(Boolean)));
  }, [orders]);

  const storeNames = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.col8).filter(Boolean)));
  }, [orders]);

  // Filtering logic
  const filteredOrders = useMemo(() => {
    return orders.filter(row => {
      if (selectedDocTypeFilter && row.docType !== selectedDocTypeFilter) return false;
      if (selectedProject && row.col2 !== selectedProject) return false;
      if (selectedStore && row.col8 !== selectedStore) return false;
      if (selectedCategory && row.col3 !== selectedCategory) return false;
      if (selectedStatus === 'paid' && Number(row.col36) > 0) return false;
      if (selectedStatus === 'unpaid' && Number(row.col36) <= 0) return false;
      if (selectedStatus === 'diff_alert' && Number(row.col21) === 0) return false;
      if (selectedStatus === 'weighbridge' && (!row.docType || row.docType !== 'weighbridge')) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const searchStr = `${row.col1} ${row.col2} ${row.col4} ${row.col6} ${row.col8} ${row.col9} ${row.col10} ${row.col11} ${row.col37} ${row.col38}`.toLowerCase();
        if (!searchStr.includes(term)) return false;
      }

      return true;
    });
  }, [orders, selectedDocTypeFilter, selectedProject, selectedStore, selectedCategory, selectedStatus, searchTerm]);

  // Handle Preset Switching
  const applyPreset = (preset: ViewPreset) => {
    setCurrentPreset(preset);
    if (preset === 'all') {
      setVisibleZones({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true });
    } else if (preset === 'weighbridge') {
      // Weighbridge: Zones 1, 2, 3, 4, 5
      setVisibleZones({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 7: false });
    } else if (preset === 'delivery_order') {
      // Delivery Order: Zones 1, 2, 5, 6
      setVisibleZones({ 1: true, 2: true, 3: false, 4: false, 5: true, 6: true, 7: false });
    } else if (preset === 'concrete') {
      // Concrete: Zones 1, 2, 5, 7
      setVisibleZones({ 1: true, 2: true, 3: false, 4: false, 5: true, 6: false, 7: true });
    } else if (preset === 'tax_invoice') {
      // Tax Invoice / Receipt: Zones 1, 2, 5, 6
      setVisibleZones({ 1: true, 2: true, 3: false, 4: false, 5: true, 6: true, 7: false });
    }
  };

  const toggleZone = (zoneNum: number) => {
    setCurrentPreset('custom');
    setVisibleZones(prev => ({ ...prev, [zoneNum]: !prev[zoneNum] }));
  };

  const handleDocTypeFilterChange = (docType: string) => {
    setSelectedDocTypeFilter(docType);
    if (docType === 'weighbridge') {
      applyPreset('weighbridge');
    } else if (docType === 'delivery_order') {
      applyPreset('delivery_order');
    } else if (docType === 'concrete') {
      applyPreset('concrete');
    } else if (docType === 'tax_invoice') {
      applyPreset('tax_invoice');
    } else if (docType === 'full_logistics' || docType === '') {
      applyPreset('all');
    }
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedDocTypeFilter('');
    setSelectedProject('');
    setSelectedStore('');
    setSelectedCategory('');
    setSelectedStatus('');
    applyPreset('all');
    setSelectedIds([]);
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.id));
    }
  };

  const handleBatchMarkAsPaid = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`ต้องการทำเครื่องหมายว่าชำระครบแล้วสำหรับ ${selectedIds.length} รายการที่เลือกหรือไม่?`)) {
      selectedIds.forEach(id => {
        const row = orders.find(o => o.id === id);
        if (row) {
          const grand = Number(row.col29) || 0;
          const goods = Number(row.col25) || 0;
          const freight = Number(row.col28) || 0;
          onUpdateOrder({
            ...row,
            col31: goods,
            col32: 0,
            col33: freight,
            col34: 0,
            col35: grand,
            col36: 0
          });
        }
      });
      setSelectedIds([]);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${selectedIds.length} รายการที่เลือก?`)) {
      selectedIds.forEach(id => onDeleteOrder(id));
      setSelectedIds([]);
    }
  };

  const fmtNum = (val: any) => {
    if (val === undefined || val === null || val === '') return '-';
    const n = Number(val);
    return isNaN(n) ? '-' : n.toLocaleString('th-TH');
  };

  const fmtCurrency = (val: any) => {
    if (val === undefined || val === null || val === '') return '฿0.00';
    const n = Number(val);
    return isNaN(n) ? '฿0.00' : '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const cellPadding = isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3';

  return (
    <div className="space-y-3">
      {/* Control Bar: View Presets, Zone Toggles, Filters & Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        
        {/* Preset Selector Row */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mr-1">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>มุมมองตามประเภทบิล:</span>
            </span>

            <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-lg text-xs gap-0.5">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentPreset === 'all' 
                    ? 'bg-white text-blue-700 shadow-2xs font-semibold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📋 ครบ 39 ช่อง
              </button>
              <button
                type="button"
                onClick={() => applyPreset('weighbridge')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentPreset === 'weighbridge' 
                    ? 'bg-white text-emerald-700 shadow-2xs font-semibold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚖️ ตั๋วชั่งน้ำหนัก
              </button>
              <button
                type="button"
                onClick={() => applyPreset('delivery_order')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentPreset === 'delivery_order' 
                    ? 'bg-white text-sky-700 shadow-2xs font-semibold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📦 ใบส่งสินค้า/ของ
              </button>
              <button
                type="button"
                onClick={() => applyPreset('concrete')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentPreset === 'concrete' 
                    ? 'bg-white text-purple-700 shadow-2xs font-semibold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏗️ คอนกรีตผสมเสร็จ
              </button>
              <button
                type="button"
                onClick={() => applyPreset('tax_invoice')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  currentPreset === 'tax_invoice' 
                    ? 'bg-white text-amber-700 shadow-2xs font-semibold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🧾 ใบเสร็จ/การเงิน
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Density switcher */}
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="text-slate-600 hover:text-slate-900 text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer"
              title="สลับความกะทัดรัดของตาราง"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              <span>{isCompact ? 'มุมมองสบายตา' : 'มุมมองกะทัดรัด'}</span>
            </button>

            {/* Quick reset */}
            <button
              onClick={resetAllFilters}
              className="text-slate-500 hover:text-slate-800 text-xs px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ต</span>
            </button>
          </div>
        </div>

        {/* Individual Zone Visibility Badges */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-500 font-medium mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>ปรับเปิด-ปิดโซน:</span>
          </span>

          <button
            type="button"
            onClick={() => toggleZone(1)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
              visibleZones[1] 
                ? 'bg-orange-50 text-orange-800 border border-orange-200' 
                : 'bg-slate-100 text-slate-400 opacity-60'
            }`}
          >
            1. โครงการ & อ้างอิง (2-6)
          </button>

          <button
            type="button"
            onClick={() => toggleZone(2)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
              visibleZones[2] 
                ? 'bg-sky-50 text-sky-800 border border-sky-200' 
                : 'bg-slate-100 text-slate-400 opacity-60'
            }`}
          >
            2. วันที่ คู่ค้า สินค้า (7-12)
          </button>

          <button
            type="button"
            onClick={() => toggleZone(3)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
              visibleZones[3] 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-slate-100 text-slate-400 opacity-60'
            }`}
          >
            3. หนักต้นทาง (13-15)
          </button>

          <button
            type="button"
            onClick={() => toggleZone(4)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
              visibleZones[4] 
                ? 'bg-teal-50 text-teal-800 border border-teal-200' 
                : 'bg-slate-100 text-slate-400 opacity-60'
            }`}
          >
            4. ปลายทาง & ผลต่าง (16-21)
          </button>

          <button
            type="button"
            onClick={() => toggleZone(5)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
              visibleZones[5] 
                ? 'bg-purple-50 text-purple-800 border border-purple-200' 
                : 'bg-slate-100 text-slate-400 opacity-60'
            }`}
          >
            5. คิดเงิน & บรรทุก (22-29)
          </button>

          <button
            type="button"
            onClick={() => toggleZone(6)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
              visibleZones[6] 
                ? 'bg-rose-50 text-rose-800 border border-rose-200' 
                : 'bg-slate-100 text-slate-400 opacity-60'
            }`}
          >
            6. การชำระเงิน (30-36)
          </button>

          <button
            type="button"
            onClick={() => toggleZone(7)}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
              visibleZones[7] 
                ? 'bg-slate-100 text-slate-800 border border-slate-300' 
                : 'bg-slate-100 text-slate-400 opacity-60'
            }`}
          >
            7. เพิ่มเติม (37-38)
          </button>
        </div>

        {/* Filter Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
          {/* Search box */}
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลข TR, โครงการ, ร้านค้า, ทะเบียน, สินค้า, DO..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
          </div>

          {/* Filter by Document Type */}
          <select
            value={selectedDocTypeFilter}
            onChange={(e) => handleDocTypeFilterChange(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-medium cursor-pointer"
          >
            <option value="">ทุกประเภทเอกสาร</option>
            <option value="delivery_order">📦 ใบส่งของ/ใบส่งสินค้า</option>
            <option value="weighbridge">⚖️ ตั๋วชั่งน้ำหนักรถบรรทุก</option>
            <option value="concrete">🏗️ คอนกรีตผสมเสร็จ</option>
            <option value="tax_invoice">🧾 ใบเสร็จ/ใบกำกับภาษี</option>
            <option value="full_logistics">📋 39 คอลัมน์เต็ม</option>
          </select>

          {/* Filter by Project */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer"
          >
            <option value="">ทุกโครงการ ({projects.length})</option>
            {projects.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Filter by Merchant / Store */}
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer"
          >
            <option value="">ทุกร้านค้า ({storeNames.length})</option>
            {storeNames.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Filter by Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer"
          >
            <option value="">ทุกสถานะชำระ</option>
            <option value="unpaid">⚠️ มียอดค้างชำระ</option>
            <option value="paid">✅ ชำระครบถ้วนแล้ว</option>
            <option value="diff_alert">⚖️ มีผลต่างน้ำหนัก</option>
          </select>
        </div>

        {/* Batch Actions Toolbar if selected */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs animate-fadeIn">
            <div className="flex items-center gap-2 text-blue-900 font-semibold">
              <CheckSquare className="w-4 h-4 text-blue-600" />
              <span>เลือก {selectedIds.length} รายการ</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchMarkAsPaid}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>ปรับเป็นชำระครบ</span>
              </button>
              <button
                onClick={handleBatchDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรายการที่เลือก</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Main Table Container: Flawless geometry & Pinned Columns */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto table-scroll max-h-[calc(100vh-320px)] relative">
          <table className="w-max min-w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 z-30 font-medium select-none bg-slate-100 shadow-2xs">
              
              {/* Zone Top Spans Header Row: Row 1 */}
              <tr className="text-center text-[11px] font-bold tracking-wider uppercase border-b border-slate-300">
                {/* Checkbox Pinned Header: spans 2 rows */}
                <th 
                  rowSpan={2} 
                  className="sticky-col-checkbox sticky left-0 z-40 bg-slate-200 text-slate-800 p-2 border-r border-slate-300 text-center select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5 align-middle"
                  />
                </th>

                {/* Col 1 (TR Number & Doc Type) Pinned Header: spans 2 rows */}
                <th 
                  rowSpan={2} 
                  className="sticky-col-tr sticky left-[44px] z-40 bg-slate-200 text-slate-900 py-2 px-2.5 border-r border-slate-300 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.08)] text-left"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-xs">1. เลข TR</span>
                    <span className="text-[10px] text-slate-500 font-normal">ประเภทเอกสาร</span>
                  </div>
                </th>

                {/* Zone 1 Span: Columns 2 - 6 (5 columns) */}
                {visibleZones[1] && (
                  <th colSpan={5} className="bg-orange-600 text-white py-1 px-3 border-r border-orange-700 text-xs font-semibold">
                    [โซน 1] โครงการ & เอกสารอ้างอิง (คอลัมน์ 2 - 6)
                  </th>
                )}

                {/* Zone 2 Span: Columns 7 - 12 (6 columns) */}
                {visibleZones[2] && (
                  <th colSpan={6} className="bg-sky-600 text-white py-1 px-3 border-r border-sky-700 text-xs font-semibold">
                    [โซน 2] วันที่ คู่ค้า & สินค้า (คอลัมน์ 7 - 12)
                  </th>
                )}

                {/* Zone 3 Span: Columns 13 - 15 (3 columns) */}
                {visibleZones[3] && (
                  <th colSpan={3} className="bg-emerald-600 text-white py-1 px-3 border-r border-emerald-700 text-xs font-semibold">
                    [โซน 3] น้ำหนักต้นทาง (คอลัมน์ 13 - 15)
                  </th>
                )}

                {/* Zone 4 Span: Columns 16 - 21 (6 columns) */}
                {visibleZones[4] && (
                  <th colSpan={6} className="bg-teal-600 text-white py-1 px-3 border-r border-teal-700 text-xs font-semibold">
                    [โซน 4] ปลายทาง & ผลต่าง (คอลัมน์ 16 - 21)
                  </th>
                )}

                {/* Zone 5 Span: Columns 22 - 29 (8 columns) */}
                {visibleZones[5] && (
                  <th colSpan={8} className="bg-purple-600 text-white py-1 px-3 border-r border-purple-700 text-xs font-semibold">
                    [โซน 5] คิดเงิน & ค่าบรรทุก (คอลัมน์ 22 - 29)
                  </th>
                )}

                {/* Zone 6 Span: Columns 30 - 36 (7 columns) */}
                {visibleZones[6] && (
                  <th colSpan={7} className="bg-rose-600 text-white py-1 px-3 border-r border-rose-700 text-xs font-semibold">
                    [โซน 6] การชำระเงิน (คอลัมน์ 30 - 36)
                  </th>
                )}

                {/* Zone 7 Span: Columns 37 - 38 (2 columns) */}
                {visibleZones[7] && (
                  <th colSpan={2} className="bg-slate-700 text-white py-1 px-3 border-r border-slate-800 text-xs font-semibold">
                    [โซน 7] เพิ่มเติม (คอลัมน์ 37 - 38)
                  </th>
                )}

                {/* Action Pinned Header: spans 2 rows */}
                <th 
                  rowSpan={2} 
                  className="sticky-col-actions sticky right-0 z-40 bg-slate-800 text-white p-2 border-l border-slate-900 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.08)] text-center text-xs font-semibold"
                >
                  39. จัดการ
                </th>
              </tr>

              {/* Individual Column Sub-headers: Row 2 */}
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300 divide-x divide-slate-200 text-[11px]">
                {/* Zone 1 Columns (2 - 6) */}
                {visibleZones[1] && (
                  <>
                    <th className={`min-w-[160px] max-w-[200px] bg-slate-100 text-slate-800 ${cellPadding}`}>2. โครงการ</th>
                    <th className={`min-w-[120px] bg-slate-100 text-slate-700 ${cellPadding}`}>3. หมวดหมู่</th>
                    <th className={`min-w-[110px] bg-slate-100 font-mono text-slate-700 ${cellPadding}`}>4. PO</th>
                    <th className={`min-w-[110px] bg-slate-100 font-mono text-slate-700 ${cellPadding}`}>5. RR</th>
                    <th className={`min-w-[120px] bg-slate-100 font-mono text-slate-700 ${cellPadding}`}>6. DO / ตั๋ว</th>
                  </>
                )}

                {/* Zone 2 Columns (7 - 12) */}
                {visibleZones[2] && (
                  <>
                    <th className={`min-w-[105px] font-mono text-slate-700 ${cellPadding}`}>7. วันที่</th>
                    <th className={`min-w-[180px] max-w-[240px] text-sky-950 font-bold ${cellPadding}`}>8. ผู้จำหน่าย / ร้านค้า</th>
                    <th className={`min-w-[140px] max-w-[190px] text-slate-700 ${cellPadding}`}>9. ผู้รับเหมา / ผู้ซื้อ</th>
                    <th className={`min-w-[115px] font-mono text-slate-700 ${cellPadding}`}>10. ทะเบียนรถ</th>
                    <th className={`min-w-[160px] max-w-[220px] text-slate-900 font-bold ${cellPadding}`}>11. รายการสินค้า</th>
                    <th className={`min-w-[120px] font-mono text-slate-600 ${cellPadding}`}>12. สเปก / Code</th>
                  </>
                )}

                {/* Zone 3 Columns (13 - 15) */}
                {visibleZones[3] && (
                  <>
                    <th className={`min-w-[105px] text-right font-mono ${cellPadding}`}>13. หนักต้น</th>
                    <th className={`min-w-[105px] text-right font-mono ${cellPadding}`}>14. เบาต้น</th>
                    <th className={`min-w-[115px] text-right text-emerald-800 bg-emerald-50/80 font-bold font-mono ${cellPadding}`}>15. สุทธิต้นทาง</th>
                  </>
                )}

                {/* Zone 4 Columns (16 - 21) */}
                {visibleZones[4] && (
                  <>
                    <th className={`min-w-[100px] font-mono ${cellPadding}`}>16. วันที่ปลาย</th>
                    <th className={`min-w-[110px] font-mono ${cellPadding}`}>17. ตั๋วปลายทาง</th>
                    <th className={`min-w-[105px] text-right font-mono ${cellPadding}`}>18. หนักปลาย</th>
                    <th className={`min-w-[105px] text-right font-mono ${cellPadding}`}>19. เบาปลาย</th>
                    <th className={`min-w-[115px] text-right text-teal-800 bg-teal-50/80 font-bold font-mono ${cellPadding}`}>20. สุทธิปลาย</th>
                    <th className={`min-w-[110px] text-right text-rose-700 bg-rose-50/80 font-bold font-mono ${cellPadding}`}>21. ผลต่าง(กก.)</th>
                  </>
                )}

                {/* Zone 5 Columns (22 - 29) */}
                {visibleZones[5] && (
                  <>
                    <th className={`min-w-[95px] text-right font-mono ${cellPadding}`}>22. ปริมาณ</th>
                    <th className={`min-w-[75px] text-center ${cellPadding}`}>23. หน่วย</th>
                    <th className={`min-w-[105px] text-right font-mono ${cellPadding}`}>24. ราคา/หน่วย</th>
                    <th className={`min-w-[125px] text-right text-purple-900 bg-purple-50/60 font-semibold font-mono ${cellPadding}`}>25. รวมค่าสินค้า</th>
                    <th className={`min-w-[105px] ${cellPadding}`}>26. ประเภทรถ</th>
                    <th className={`min-w-[105px] text-right font-mono ${cellPadding}`}>27. บรรทุก/หน่วย</th>
                    <th className={`min-w-[125px] text-right text-purple-900 bg-purple-50/60 font-semibold font-mono ${cellPadding}`}>28. รวมค่าขนส่ง</th>
                    <th className={`min-w-[135px] text-right text-blue-900 bg-blue-100/80 font-bold font-mono ${cellPadding}`}>29. รวมทั้งสิ้น</th>
                  </>
                )}

                {/* Zone 6 Columns (30 - 36) */}
                {visibleZones[6] && (
                  <>
                    <th className={`min-w-[105px] ${cellPadding}`}>30. รูปแบบจ่าย</th>
                    <th className={`min-w-[115px] text-right font-mono ${cellPadding}`}>31. จ่ายผู้ขาย</th>
                    <th className={`min-w-[115px] text-right font-mono text-amber-700 ${cellPadding}`}>32. ค้างผู้ขาย</th>
                    <th className={`min-w-[115px] text-right font-mono ${cellPadding}`}>33. จ่ายขนส่ง</th>
                    <th className={`min-w-[115px] text-right font-mono text-amber-700 ${cellPadding}`}>34. ค้างขนส่ง</th>
                    <th className={`min-w-[125px] text-right font-mono text-emerald-800 font-semibold ${cellPadding}`}>35. ชำระแล้วรวม</th>
                    <th className={`min-w-[130px] text-right font-mono text-rose-800 bg-rose-100/80 font-bold ${cellPadding}`}>36. ยอดค้างรวม</th>
                  </>
                )}

                {/* Zone 7 Columns (37 - 38) */}
                {visibleZones[7] && (
                  <>
                    <th className={`min-w-[150px] max-w-[200px] ${cellPadding}`}>37. สถานที่ส่ง/กม.</th>
                    <th className={`min-w-[180px] max-w-[240px] ${cellPadding}`}>38. หมายเหตุ</th>
                  </>
                )}
              </tr>
            </thead>

            {/* Table Rows Body */}
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={40} className="p-16 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-bold text-slate-800">ยังไม่มีข้อมูลคำสั่งซื้อในระบบ</p>
                        <p className="text-xs text-slate-500">
                          เริ่มต้นด้วยการสแกนบิล ตั๋วชั่ง หรือใบส่งของจริงผ่านระบบ Gemini AI Vision
                        </p>
                      </div>
                      {onOpenScan && (
                        <button
                          onClick={onOpenScan}
                          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-blue-200" />
                          <span>สแกนบิลด้วย AI ทันที</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  const weightDiff = Number(row.col21) || 0;
                  const isUnpaid = Number(row.col36) > 0;

                  return (
                    <tr 
                      key={row.id} 
                      className={`group transition-colors divide-x divide-slate-200 ${
                        isSelected ? 'bg-blue-50/70 font-medium' : 'hover:bg-slate-50/90'
                      }`}
                    >
                      {/* Col 0: Checkbox (Pinned Left 0) */}
                      <td className={`sticky-col-checkbox sticky left-0 z-20 text-center border-r border-slate-300 transition-colors ${
                        isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-slate-50'
                      } ${cellPadding}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5 align-middle"
                        />
                      </td>

                      {/* Col 1: TR Number & Doc Type (Pinned Left 44px) */}
                      <td className={`sticky-col-tr sticky left-[44px] z-20 border-r border-slate-300 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.08)] transition-colors ${
                        isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-slate-50'
                      } ${cellPadding}`}>
                        <button
                          onClick={() => onInspectOrder(row)}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 cursor-pointer text-left w-full text-xs"
                          title="คลิกเพื่อตรวจสอบข้อมูลบิล"
                        >
                          <span className="truncate">{row.col1 || '-'}</span>
                          {row.image && <FileImage className="w-3.5 h-3.5 text-blue-500 shrink-0 inline" />}
                        </button>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
                            row.docType === 'weighbridge' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            row.docType === 'concrete' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                            row.docType === 'tax_invoice' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            row.docType === 'full_logistics' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}>
                            {row.docType === 'weighbridge' ? '⚖️ ตั๋วชั่ง' :
                             row.docType === 'concrete' ? '🏗️ คอนกรีต' :
                             row.docType === 'tax_invoice' ? '🧾 ใบเสร็จ' :
                             row.docType === 'full_logistics' ? '📋 39 ช่อง' : '📦 ใบส่งของ'}
                          </span>
                        </div>
                      </td>

                      {/* Zone 1: Columns 2 - 6 */}
                      {visibleZones[1] && (
                        <>
                          <td className={`font-medium text-slate-900 truncate max-w-[200px] ${cellPadding}`} title={row.col2}>
                            {row.col2 || '-'}
                          </td>
                          <td className={`text-slate-600 truncate max-w-[120px] ${cellPadding}`} title={row.col3}>
                            {row.col3 || '-'}
                          </td>
                          <td className={`font-mono text-xs ${cellPadding}`}>
                            {row.col4 ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                                  {row.col4}
                                </span>
                                {row.referenceSource === 'handwritten' && (
                                  <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 rounded">✍️ ลายมือ</span>
                                )}
                                {row.referenceSource === 'notes' && (
                                  <span className="text-[9px] bg-sky-50 text-sky-800 border border-sky-200 px-1 rounded">💬 หมายเหตุ</span>
                                )}
                              </div>
                            ) : row.linkedViaDocNo ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                                  🔗 ผ่าน {row.linkedViaDocNo}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                                รอชน PO
                              </span>
                            )}
                          </td>
                          <td className={`font-mono text-xs ${cellPadding}`}>
                            {row.col5 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                {row.col5}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">
                                รอ RR
                              </span>
                            )}
                          </td>
                          <td className={`font-mono font-bold text-slate-800 ${cellPadding}`}>
                            <div>{row.col6 || '-'}</div>
                            {row.referenceDocNo && row.referenceDocNo !== row.col6 && row.referenceDocNo !== row.col4 && (
                              <div className="text-[10px] font-normal text-sky-700 font-sans">
                                อ้างถึง DO: <span className="font-mono font-semibold">{row.referenceDocNo}</span>
                              </div>
                            )}
                          </td>
                        </>
                      )}

                      {/* Zone 2: Columns 7 - 12 */}
                      {visibleZones[2] && (
                        <>
                          <td className={`text-slate-600 font-mono whitespace-nowrap ${cellPadding}`}>{row.col7 || '-'}</td>
                          <td className={`font-semibold text-slate-900 truncate max-w-[240px] ${cellPadding}`}>
                            {onOpenStoreModal ? (
                              <button
                                onClick={() => onOpenStoreModal(row.col8)}
                                className="text-left hover:text-blue-600 hover:underline cursor-pointer truncate block w-full"
                                title="คลิกดูประวัติร้านค้านี้"
                              >
                                {row.col8 || '-'}
                              </button>
                            ) : (
                              <span>{row.col8 || '-'}</span>
                            )}
                          </td>
                          <td className={`text-slate-600 truncate max-w-[190px] ${cellPadding}`} title={row.col9}>{row.col9 || '-'}</td>
                          <td className={`font-mono font-medium text-slate-800 bg-slate-50/50 whitespace-nowrap ${cellPadding}`}>{row.col10 || '-'}</td>
                          <td className={`font-bold text-slate-900 truncate max-w-[220px] ${cellPadding}`} title={row.col11}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate">{row.col11 || '-'}</span>
                              {row.lineItems && row.lineItems.length > 1 && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200" title={`มีสินค้า ${row.lineItems.length} รายการในบิลนี้`}>
                                  +{row.lineItems.length}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`text-slate-500 font-mono truncate max-w-[120px] ${cellPadding}`}>{row.col12 || '-'}</td>
                        </>
                      )}

                      {/* Zone 3: Columns 13 - 15 */}
                      {visibleZones[3] && (
                        <>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>
                            {Number(row.col13) > 0 ? fmtNum(row.col13) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>
                            {Number(row.col14) > 0 ? fmtNum(row.col14) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className={`text-right font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50/40 ${cellPadding}`}>
                            {Number(row.col15) > 0 ? fmtNum(row.col15) : <span className="text-slate-300">-</span>}
                          </td>
                        </>
                      )}

                      {/* Zone 4: Columns 16 - 21 */}
                      {visibleZones[4] && (
                        <>
                          <td className={`text-slate-600 font-mono whitespace-nowrap ${cellPadding}`}>{row.col16 || '-'}</td>
                          <td className={`font-mono text-slate-600 whitespace-nowrap ${cellPadding}`}>{row.col17 || '-'}</td>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>
                            {Number(row.col18) > 0 ? fmtNum(row.col18) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>
                            {Number(row.col19) > 0 ? fmtNum(row.col19) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className={`text-right font-mono tabular-nums font-bold text-teal-700 bg-teal-50/40 ${cellPadding}`}>
                            {Number(row.col20) > 0 ? fmtNum(row.col20) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className={`text-right font-mono tabular-nums font-bold ${cellPadding} ${
                            weightDiff > 0 ? 'text-rose-600 bg-rose-50/60' : 'text-slate-300'
                          }`}>
                            {weightDiff > 0 ? `+${fmtNum(weightDiff)}` : '-'}
                          </td>
                        </>
                      )}

                      {/* Zone 5: Columns 22 - 29 */}
                      {visibleZones[5] && (
                        <>
                          <td className={`text-right font-mono tabular-nums font-bold text-slate-900 ${cellPadding}`}>{fmtNum(row.col22)}</td>
                          <td className={`text-center text-slate-600 ${cellPadding}`}>{row.col23 || '-'}</td>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>{fmtNum(row.col24)}</td>
                          <td className={`text-right font-mono tabular-nums font-semibold text-purple-700 bg-purple-50/20 ${cellPadding}`}>{fmtCurrency(row.col25)}</td>
                          <td className={`text-slate-600 text-[11px] truncate max-w-[105px] ${cellPadding}`}>{row.col26 || '-'}</td>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>{fmtNum(row.col27)}</td>
                          <td className={`text-right font-mono tabular-nums font-semibold text-purple-700 bg-purple-50/20 ${cellPadding}`}>{fmtCurrency(row.col28)}</td>
                          <td className={`text-right font-mono tabular-nums font-bold text-blue-700 bg-blue-50/50 ${cellPadding}`}>{fmtCurrency(row.col29)}</td>
                        </>
                      )}

                      {/* Zone 6: Columns 30 - 36 */}
                      {visibleZones[6] && (
                        <>
                          <td className={`text-slate-700 text-[11px] ${cellPadding}`}>
                            <span className="text-slate-700 font-medium">
                              {row.col30 || 'โอนเงิน'}
                            </span>
                          </td>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>{fmtCurrency(row.col31)}</td>
                          <td className={`text-right font-mono tabular-nums text-amber-700 ${cellPadding}`}>{fmtCurrency(row.col32)}</td>
                          <td className={`text-right font-mono tabular-nums text-slate-700 ${cellPadding}`}>{fmtCurrency(row.col33)}</td>
                          <td className={`text-right font-mono tabular-nums text-amber-700 ${cellPadding}`}>{fmtCurrency(row.col34)}</td>
                          <td className={`text-right font-mono tabular-nums font-semibold text-emerald-700 ${cellPadding}`}>{fmtCurrency(row.col35)}</td>
                          <td className={`text-right font-mono tabular-nums font-bold ${cellPadding} ${
                            isUnpaid ? 'text-rose-700 bg-rose-50/60' : 'text-slate-400'
                          }`}>
                            {fmtCurrency(row.col36)}
                          </td>
                        </>
                      )}

                      {/* Zone 7: Columns 37 - 38 */}
                      {visibleZones[7] && (
                        <>
                          <td className={`text-slate-600 truncate max-w-[200px] ${cellPadding}`} title={row.col37}>{row.col37 || '-'}</td>
                          <td className={`text-slate-500 truncate max-w-[240px] ${cellPadding}`} title={row.col38}>{row.col38 || '-'}</td>
                        </>
                      )}

                      {/* Col 39: Actions Column (Pinned Right 0) */}
                      <td className={`sticky-col-actions sticky right-0 z-20 text-center border-l border-slate-300 shadow-[-4px_0_10px_-2px_rgba(0,0,0,0.08)] transition-colors ${
                        isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-slate-50'
                      } ${cellPadding}`}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onInspectOrder(row)}
                            title="ดูตั๋วบิล / ตรวจสอบฟิลด์"
                            className="p-1 text-blue-600 hover:bg-blue-100/70 rounded-md transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDuplicateOrder(row)}
                            title="คัดลอกแถว"
                            className="p-1 text-slate-600 hover:bg-slate-200/70 rounded-md transition cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteOrder(row.id)}
                            title="ลบรายการ"
                            className="p-1 text-rose-600 hover:bg-rose-100/70 rounded-md transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary / Count Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            แสดง <span className="font-semibold text-slate-800 tabular-nums">{filteredOrders.length}</span> จากทั้งหมด <span className="font-semibold text-slate-800 tabular-nums">{orders.length}</span> รายการ
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>ตรึงคอลัมน์สำคัญ (เลข TR / จัดการ) พร้อมระบบปรับตามประเภทบิล</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
