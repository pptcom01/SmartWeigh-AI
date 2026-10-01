import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Building2, 
  Calendar, 
  CreditCard, 
  MapPin, 
  UserCheck 
} from 'lucide-react';
import { PurchaseOrder, POItem, StoreMerchant } from '../types';
import { ImageDocViewer } from './ImageDocViewer';

interface POEditModalProps {
  isOpen: boolean;
  po: PurchaseOrder | null;
  stores: StoreMerchant[];
  initialStoreName?: string;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => void;
}

export const POEditModal: React.FC<POEditModalProps> = ({
  isOpen,
  po,
  stores,
  initialStoreName,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    poNumber: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDueDate: '',
    projectId: '',
    storeId: '',
    storeName: initialStoreName || '',
    category: 'งานหิน/ทราย',
    creditTerms: 'เครดิต 30 วัน',
    deliveryLocation: '',
    orderedBy: 'ฝ่ายจัดซื้อ',
    approvedBy: '',
    notes: '',
    status: 'pending',
    items: []
  });

  const [items, setItems] = useState<POItem[]>([
    {
      id: `item-${Date.now()}-1`,
      itemDescription: 'หินคลุก 3/4',
      specCode: 'STD-34',
      orderedQty: 100,
      unit: 'ตัน',
      unitPrice: 280,
      totalAmount: 28000
    }
  ]);

  useEffect(() => {
    if (po) {
      setFormData({ ...po });
      setItems(po.items && po.items.length > 0 ? [...po.items] : []);
    } else {
      const today = new Date().toISOString().split('T')[0];
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      setFormData({
        poNumber: `PO-${new Date().getFullYear()}-${randomSeq}`,
        orderDate: today,
        deliveryDueDate: '',
        projectId: '',
        storeId: '',
        storeName: initialStoreName || (stores[0]?.name || ''),
        category: 'งานหิน/ทราย',
        creditTerms: 'เครดิต 30 วัน',
        deliveryLocation: '',
        orderedBy: 'ฝ่ายจัดซื้อ',
        approvedBy: '',
        notes: '',
        status: 'pending',
        items: []
      });
      setItems([
        {
          id: `item-${Date.now()}-1`,
          itemDescription: 'หินคลุก 3/4',
          specCode: 'STD-34',
          orderedQty: 100,
          unit: 'ตัน',
          unitPrice: 280,
          totalAmount: 28000
        }
      ]);
    }
  }, [po, isOpen, initialStoreName, stores]);

  if (!isOpen) return null;

  const handleItemChange = (index: number, field: keyof POItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    
    if (field === 'orderedQty' || field === 'unitPrice') {
      const qty = field === 'orderedQty' ? Number(value) : Number(item.orderedQty);
      const price = field === 'unitPrice' ? Number(value) : Number(item.unitPrice);
      item.totalAmount = (qty || 0) * (price || 0);
    }
    
    updated[index] = item;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        itemDescription: '',
        specCode: '',
        orderedQty: 1,
        unit: 'ตัน',
        unitPrice: 0,
        totalAmount: 0
      }
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalQty = items.reduce((sum, it) => sum + (Number(it.orderedQty) || 0), 0);
  const totalAmount = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.poNumber?.trim()) {
      alert('กรุณาระบุเลขที่ใบสั่งซื้อ (PO Number)');
      return;
    }
    if (!formData.storeName?.trim()) {
      alert('กรุณาระบุหรือเลือกร้านค้า/ผู้จำหน่าย');
      return;
    }

    const matchedStore = stores.find(s => s.name.trim().toLowerCase() === formData.storeName?.trim().toLowerCase());

    const finalPO: PurchaseOrder = {
      id: po?.id || `po-${Date.now()}`,
      poNumber: formData.poNumber.trim(),
      orderDate: formData.orderDate || new Date().toISOString().split('T')[0],
      deliveryDueDate: formData.deliveryDueDate || '',
      projectId: formData.projectId || 'โครงการทั่วไป',
      storeId: matchedStore ? matchedStore.id : (formData.storeId || ''),
      storeName: formData.storeName.trim(),
      category: formData.category || 'งานวัสดุก่อสร้าง',
      items,
      totalQty,
      totalAmount,
      status: po ? po.status : 'pending',
      creditTerms: formData.creditTerms || 'ตามเงื่อนไขวางบิล',
      deliveryLocation: formData.deliveryLocation || '',
      orderedBy: formData.orderedBy || '',
      approvedBy: formData.approvedBy || '',
      notes: formData.notes || '',
      image: po?.image || null,
      createdAt: po?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(finalPO);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 md:p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl w-full my-4 md:my-8 overflow-hidden flex flex-col max-h-[94vh] animate-fadeIn ${
        formData.image ? 'max-w-[97vw] xl:max-w-[1650px]' : 'max-w-4xl'
      }`}>
        
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{po ? `แก้ไขใบสั่งซื้อ: ${po.poNumber}` : 'เปิดใบสั่งซื้อใหม่ (Create Purchase Order)'}</span>
                {formData.image && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-normal">
                    เปรียบเทียบกับภาพจริง (Split Screen)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300">
                เอกสารบันทึกคำสั่งซื้อสินค้าล่วงหน้า เพื่อใช้ตรวจสอบและตัดยอดส่งมอบอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container: Split layout if image is present */}
        <div className={`flex-1 overflow-hidden flex flex-col ${
          formData.image ? 'md:grid md:grid-cols-12 md:divide-x md:divide-slate-200' : ''
        }`}>
          
          {/* Left Column: PO Image Viewer (Only when image is attached) */}
          {formData.image && (
            <div className="md:col-span-5 lg:col-span-4 bg-slate-950 p-3 flex flex-col h-full overflow-hidden">
              <ImageDocViewer
                image={formData.image}
                title="ภาพใบสั่งซื้อ (PO) ต้นฉบับ"
                onImageChange={(newImg) => setFormData(prev => ({ ...prev, image: newImg }))}
              />
            </div>
          )}

          {/* Right Column: Form Body */}
          <form 
            onSubmit={handleSubmit} 
            className={`flex flex-col h-full overflow-hidden ${formData.image ? 'md:col-span-7 lg:col-span-8' : 'w-full'}`}
          >
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          
          {/* Main Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* PO Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เลขที่ใบสั่งซื้อ (PO Number) *
              </label>
              <input
                type="text"
                required
                value={formData.poNumber || ''}
                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                placeholder="เช่น PO-2026-001"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-900"
              />
            </div>

            {/* Order Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่ออกเอกสาร (Order Date) *
              </label>
              <input
                type="date"
                required
                value={formData.orderDate || ''}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Delivery Due Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                กำหนดส่งมอบสินค้า (Due Date)
              </label>
              <input
                type="date"
                value={formData.deliveryDueDate || ''}
                onChange={(e) => setFormData({ ...formData, deliveryDueDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Store / Vendor Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ผู้จำหน่าย / ร้านค้า (Vendor) *
              </label>
              <input
                type="text"
                required
                list="store-list"
                value={formData.storeName || ''}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                placeholder="พิมพ์หรือเลือกร้านค้า"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <datalist id="store-list">
                {stores.map(s => (
                  <option key={s.id} value={s.name}>{s.category}</option>
                ))}
              </datalist>
            </div>

            {/* Project */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                โครงการ / ไซต์งาน (Project)
              </label>
              <input
                type="text"
                value={formData.projectId || ''}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                placeholder="เช่น โครงการทางหลวงสาย 9"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมวดหมู่งาน (Category)
              </label>
              <select
                value={formData.category || 'งานหิน/ทราย'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="งานหิน/ทราย">งานหิน/ทราย/ดินลูกรัง</option>
                <option value="งานคอนกรีต">งานคอนกรีตผสมเสร็จ</option>
                <option value="งานเหล็ก">งานเหล็กเส้นและโครงสร้าง</option>
                <option value="งานท่อและระบบระบายน้ำ">งานท่อและระบบระบายน้ำ</option>
                <option value="วัสดุก่อสร้างทั่วไป">วัสดุก่อสร้างทั่วไป</option>
                <option value="น้ำมันและเชื้อเพลิง">น้ำมันและเชื้อเพลิง</option>
              </select>
            </div>

            {/* Credit Terms */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เงื่อนไขการชำระเงิน (Credit Terms)
              </label>
              <input
                type="text"
                value={formData.creditTerms || ''}
                onChange={(e) => setFormData({ ...formData, creditTerms: e.target.value })}
                placeholder="เช่น เครดิต 30 วัน, เงินสด"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Delivery Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                สถานที่จัดส่ง / กม.
              </label>
              <input
                type="text"
                value={formData.deliveryLocation || ''}
                onChange={(e) => setFormData({ ...formData, deliveryLocation: e.target.value })}
                placeholder="เช่น แคมป์ กม.14 หรือ หน้างานหลัก"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Ordered By & Approved By */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ผู้เปิดใบสั่งซื้อ / ผู้อนุมัติ
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={formData.orderedBy || ''}
                  onChange={(e) => setFormData({ ...formData, orderedBy: e.target.value })}
                  placeholder="ผู้สั่งซื้อ"
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={formData.approvedBy || ''}
                  onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                  placeholder="ผู้อนุมัติ"
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  รายการสินค้าที่สั่งซื้อ (Ordered Line Items)
                </h3>
                <p className="text-[11px] text-slate-500">
                  ระบุสินค้า ปริมาณ หน่วย และราคาต่อหน่วย (คำนวณยอดเงินอัตโนมัติ)
                </p>
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรายการ</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs bg-white">
              <table className="w-full min-w-[860px] text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5 min-w-[280px]">ชื่อรายการสินค้า * (Description)</th>
                    <th className="p-2.5 w-28 min-w-[110px]">สเปก / Code</th>
                    <th className="p-2.5 w-24 min-w-[85px] text-right">ปริมาณ *</th>
                    <th className="p-2.5 w-20 min-w-[75px] text-center">หน่วย *</th>
                    <th className="p-2.5 w-24 min-w-[90px] text-right">ราคา/หน่วย (฿)</th>
                    <th className="p-2.5 w-28 min-w-[100px] text-right">รวมเงิน (฿)</th>
                    <th className="p-2.5 w-10 text-center">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50/70">
                      <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2 min-w-[280px]">
                        <input
                          type="text"
                          required
                          value={it.itemDescription}
                          onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                          placeholder="เช่น หินคลุก 3/4, ปูนซีเมนต์, เหล็กข้ออ้อย 16 มม."
                          className="w-full min-w-[260px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-500 font-medium text-slate-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={it.specCode || ''}
                          onChange={(e) => handleItemChange(idx, 'specCode', e.target.value)}
                          placeholder="เช่น STD, KSC-280"
                          className="w-full min-w-[95px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          required
                          value={it.orderedQty || ''}
                          onChange={(e) => handleItemChange(idx, 'orderedQty', e.target.value)}
                          placeholder="0"
                          className="w-full min-w-[75px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-right font-mono font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={it.unit || ''}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          placeholder="ตัน/คิว"
                          className="w-full min-w-[65px] px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={it.unitPrice || ''}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full min-w-[80px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-right font-mono"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-800 tabular-nums">
                        ฿{(Number(it.totalAmount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => removeItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-300 font-bold text-slate-900">
                  <tr>
                    <td colSpan={3} className="p-3 text-right">รวมปริมาณและยอดเงินทั้งสิ้น:</td>
                    <td className="p-3 text-right font-mono text-blue-900 tabular-nums">
                      {totalQty.toLocaleString('th-TH')}
                    </td>
                    <td></td>
                    <td></td>
                    <td className="p-3 text-right font-mono text-emerald-800 text-sm tabular-nums">
                      ฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หมายเหตุ / เงื่อนไขเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="ระบุข้อกำหนดในการรับของ การชั่งน้ำหนัก หรือข้อมูลเฉพาะกิจ"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          </div>

          {/* Footer Submit */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              * ข้อมูลใบสั่งซื้อจะถูกนำไปเชื่อมโยงกับตั๋วชั่งและใบส่งของอัตโนมัติตามเลขที่ PO
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{po ? 'บันทึกการแก้ไข PO' : 'ยืนยันเปิดใบสั่งซื้อ'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>

    </div>
  </div>
  );
};
