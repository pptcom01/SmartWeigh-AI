import React, { useState, useEffect } from 'react';
import { X, Building2, Save } from 'lucide-react';
import { StoreMerchant } from '../types';

interface StoreEditModalProps {
  store: StoreMerchant | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (store: StoreMerchant) => void;
}

export const StoreEditModal: React.FC<StoreEditModalProps> = ({
  store,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<StoreMerchant>>({
    name: '',
    category: 'งานหิน/ดิน/ทราย',
    taxId: '',
    phone: '',
    contactPerson: '',
    address: '',
    bankAccount: '',
    creditTerms: 'เครดิต 30 วัน',
    primaryGoods: [],
    notes: ''
  });

  const [goodsInput, setGoodsInput] = useState('');

  useEffect(() => {
    if (store) {
      setFormData(store);
      setGoodsInput((store.primaryGoods || []).join(', '));
    } else {
      setFormData({
        id: 'store-' + Date.now(),
        name: '',
        category: 'งานหิน/ดิน/ทราย',
        taxId: '',
        phone: '',
        contactPerson: '',
        address: '',
        bankAccount: '',
        creditTerms: 'เครดิต 30 วัน',
        totalOrders: 0,
        totalPurchases: 0,
        totalPaid: 0,
        totalDebt: 0,
        primaryGoods: [],
        notes: ''
      });
      setGoodsInput('');
    }
  }, [store, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('กรุณาระบุชื่อร้านค้า / ผู้จำหน่าย');
      return;
    }

    const goodsArray = goodsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const updatedStore: StoreMerchant = {
      id: formData.id || 'store-' + Date.now(),
      name: formData.name.trim(),
      category: formData.category || 'ทั่วไป',
      taxId: formData.taxId?.trim() || '',
      phone: formData.phone?.trim() || '',
      contactPerson: formData.contactPerson?.trim() || '',
      address: formData.address?.trim() || '',
      bankAccount: formData.bankAccount?.trim() || '',
      creditTerms: formData.creditTerms || 'เครดิต 30 วัน',
      totalOrders: formData.totalOrders || 0,
      totalPurchases: formData.totalPurchases || 0,
      totalPaid: formData.totalPaid || 0,
      totalDebt: formData.totalDebt || 0,
      lastOrderDate: formData.lastOrderDate || new Date().toISOString().split('T')[0],
      primaryGoods: goodsArray,
      notes: formData.notes?.trim() || ''
    };

    onSave(updatedStore);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {store ? 'แก้ไขข้อมูลร้านค้า / คู่ค้า' : 'เพิ่มร้านค้า / คู่ค้าใหม่'}
              </h3>
              <p className="text-xs text-slate-500">บันทึกข้อมูลและประวัติผู้จำหน่ายลงในระบบอัตโนมัติ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              ชื่อร้านค้า / บริษัทผู้จำหน่าย <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="เช่น บจก. โรงโม่หิน รุ่งเรืองนคร"
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">หมวดหมู่หลัก</label>
              <select
                value={formData.category || 'งานหิน/ดิน/ทราย'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="งานหิน/ดิน/ทราย">งานหิน/ดิน/ทราย</option>
                <option value="งานเหล็กโครงสร้าง">งานเหล็กโครงสร้าง</option>
                <option value="งานคอนกรีตผสมเสร็จ">งานคอนกรีตผสมเสร็จ</option>
                <option value="วัสดุก่อสร้างทั่วไป">วัสดุก่อสร้างทั่วไป</option>
                <option value="ท่อและระบบประปา">ท่อและระบบประปา</option>
                <option value="งานขนส่ง/โลจิสติกส์">งานขนส่ง/โลจิสติกส์</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">เงื่อนไขการชำระเงิน</label>
              <select
                value={formData.creditTerms || 'เครดิต 30 วัน'}
                onChange={(e) => setFormData({ ...formData, creditTerms: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="เครดิต 30 วัน">เครดิต 30 วัน</option>
                <option value="เครดิต 15 วัน">เครดิต 15 วัน</option>
                <option value="เครดิต 60 วัน">เครดิต 60 วัน</option>
                <option value="โอนเงิน">โอนเงินก่อนส่ง</option>
                <option value="เงินสด">เงินสดหน้างาน</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">เลขประจำตัวผู้เสียภาษี (13 หลัก)</label>
              <input
                type="text"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="0315558001243"
                className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อ</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="044-612-889 หรือ 081-xxx-xxxx"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ติดต่อ / เซลล์</label>
              <input
                type="text"
                value={formData.contactPerson || ''}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="คุณสมศักดิ์"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">บัญชีธนาคารรับเงิน</label>
              <input
                type="text"
                value={formData.bankAccount || ''}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                placeholder="กสิกรไทย 045-2-99881-3"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">ที่อยู่สถานประกอบการ / โรงงาน / แพลนท์</label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="ที่อยู่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">รายการสินค้าหลัก (คั่นด้วยจุลภาค ,)</label>
            <input
              type="text"
              value={goodsInput}
              onChange={(e) => setGoodsInput(e.target.value)}
              placeholder="หินฝุ่น, หินคลุก, ลูกรัง, ดินถม"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">หมายเหตุ / ข้อมูลเพิ่มเติม</label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="เช่น มีส่วนลดพิเศษ, มีรถพ่วงส่งถึงหน้างาน..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกข้อมูลร้านค้า</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
