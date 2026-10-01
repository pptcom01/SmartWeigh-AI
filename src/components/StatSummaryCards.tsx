import React from 'react';
import { 
  FileText, 
  Weight, 
  Boxes, 
  Truck, 
  Calculator, 
  AlertCircle
} from 'lucide-react';
import { OrderRecord } from '../types';

interface StatSummaryCardsProps {
  orders: OrderRecord[];
  onFilterClick?: (filterType: string) => void;
}

export const StatSummaryCards: React.FC<StatSummaryCardsProps> = ({ orders, onFilterClick }) => {
  let totalWeightTons = 0;
  let totalGoodsAmount = 0;
  let totalFreightAmount = 0;
  let grandTotal = 0;
  let totalUnpaid = 0;
  let totalPaid = 0;
  let weighbridgeCount = 0;
  let unpaidCount = 0;

  orders.forEach((row) => {
    const netKg = Number(row.col15) || 0;
    totalWeightTons += netKg / 1000;
    if (netKg > 0) weighbridgeCount++;

    totalGoodsAmount += Number(row.col25) || 0;
    totalFreightAmount += Number(row.col28) || 0;
    grandTotal += Number(row.col29) || 0;
    totalPaid += Number(row.col35) || 0;

    const unpaid = Number(row.col36) || 0;
    totalUnpaid += unpaid;
    if (unpaid > 0) unpaidCount++;
  });

  const formatCurrency = (amount: number) => {
    return '฿' + amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Total Documents */}
      <div 
        onClick={() => onFilterClick && onFilterClick('all')}
        className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition cursor-pointer group"
      >
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">เอกสารทั้งหมด</span>
          <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition" />
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight tabular-nums">
          {orders.length.toLocaleString()}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {orders.length > 0 ? `${weighbridgeCount} ตั๋วชั่ง / ${orders.length - weighbridgeCount} ใบส่งของ` : 'ยังไม่มีเอกสาร'}
        </div>
      </div>

      {/* 2. Total Net Weight */}
      <div 
        onClick={() => onFilterClick && onFilterClick('weighbridge')}
        className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition cursor-pointer group"
      >
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">น้ำหนักสุทธิรวม</span>
          <Weight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
        </div>
        <div className="text-xl font-bold text-emerald-700 tracking-tight tabular-nums">
          {formatNumber(totalWeightTons)} <span className="text-xs font-normal text-slate-500">ตัน</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          เฉพาะตั๋วชั่งน้ำหนัก
        </div>
      </div>

      {/* 3. Total Goods Value */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">มูลค่าสินค้ารวม</span>
          <Boxes className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight tabular-nums">
          {formatCurrency(totalGoodsAmount)}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          ค่าวัสดุและสินค้า
        </div>
      </div>

      {/* 4. Total Freight */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">ค่าขนส่งรวม</span>
          <Truck className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight tabular-nums">
          {formatCurrency(totalFreightAmount)}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          ค่าบรรทุกและขนส่ง
        </div>
      </div>

      {/* 5. Grand Total */}
      <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-medium text-blue-900 mb-1">
          <span>ยอดรวมทั้งสิ้น</span>
          <Calculator className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <div className="text-xl font-bold text-blue-700 tracking-tight tabular-nums">
          {formatCurrency(grandTotal)}
        </div>
        <div className="text-[11px] text-blue-600/70 mt-0.5">
          สินค้า + ขนส่ง
        </div>
      </div>

      {/* 6. Total Unpaid Debt */}
      <div 
        onClick={() => onFilterClick && onFilterClick('unpaid')}
        className={`p-3.5 rounded-xl border shadow-2xs transition cursor-pointer group ${
          totalUnpaid > 0 
            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300' 
            : 'bg-emerald-50/30 border-emerald-200'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-medium mb-1 text-slate-700">
          <span className={totalUnpaid > 0 ? 'text-rose-700 font-semibold' : 'text-slate-600'}>
            ยอดคงค้างชำระ
          </span>
          <AlertCircle className={`w-3.5 h-3.5 ${totalUnpaid > 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
        </div>
        <div className={`text-xl font-bold tracking-tight tabular-nums ${totalUnpaid > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
          {formatCurrency(totalUnpaid)}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {totalUnpaid > 0 ? `${unpaidCount} บิลรอจ่าย` : 'ชำระครบถ้วน'}
        </div>
      </div>
    </div>
  );
};
