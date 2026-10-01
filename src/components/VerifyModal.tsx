import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Sparkles, 
  CheckCircle2, 
  FileText,
  Truck,
  Boxes,
  Receipt,
  Scale,
  Layers,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  Info,
  Link2,
  PenTool,
  MessageSquare
} from 'lucide-react';
import { OrderRecord, StoreMerchant, DocumentType, PurchaseOrder } from '../types';
import { ImageDocViewer } from './ImageDocViewer';

interface VerifyModalProps {
  isOpen: boolean;
  orderData: Partial<OrderRecord> | null;
  billImage: string | null;
  storeSuggestion?: Partial<StoreMerchant>;
  stores: StoreMerchant[];
  pos?: PurchaseOrder[];
  existingOrders?: OrderRecord[];
  onClose: () => void;
  onSaveOrder: (order: OrderRecord, storeToSave?: StoreMerchant) => void;
  onSwitchToPO?: (draftPO: Partial<PurchaseOrder>) => void;
}

export const VerifyModal: React.FC<VerifyModalProps> = ({
  isOpen,
  orderData,
  billImage,
  storeSuggestion,
  stores,
  pos = [],
  existingOrders = [],
  onClose,
  onSaveOrder,
  onSwitchToPO
}) => {
  const [currentImage, setCurrentImage] = useState<string | null>(billImage || null);
  const [form, setForm] = useState<Partial<OrderRecord>>({});
  const [saveToStoreDirectory, setSaveToStoreDirectory] = useState(true);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('delivery_order');
  const [showAllCols, setShowAllCols] = useState(false);
  const [enableDestScale, setEnableDestScale] = useState(false);

  useEffect(() => {
    if (orderData) {
      setForm({ ...orderData });
      setCurrentImage(billImage || orderData.image || null);

      // Intelligent detection of document type if not specified
      let detectedType: DocumentType = orderData.docType || 'delivery_order';
      if (!orderData.docType) {
        const netO = Number(orderData.col13) || Number(orderData.col15) || 0;
        const cat = (orderData.col3 || '').toLowerCase();
        const item = (orderData.col11 || '').toLowerCase();
        const unit = (orderData.col23 || '').toLowerCase();
        const doNum = (orderData.col6 || '').toLowerCase();

        if (cat.includes('คอนกรีต') || item.includes('คอนกรีต') || unit.includes('คิว') || unit.includes('m3')) {
          detectedType = 'concrete';
        } else if (netO > 0 || cat.includes('หิน') || cat.includes('ดิน') || cat.includes('ทราย') || item.includes('หิน')) {
          detectedType = 'weighbridge';
        } else if (doNum.includes('inv') || doNum.includes('tax') || item.includes('ภาษี')) {
          detectedType = 'tax_invoice';
        } else {
          detectedType = 'delivery_order';
        }
      }

      setSelectedDocType(detectedType);

      // Only enable destination scale if col18 or col20 has a genuine non-zero value different from origin
      const hasDistinctDestWeight = (Number(orderData.col18) > 0 || Number(orderData.col20) > 0) &&
        Number(orderData.col18) !== Number(orderData.col13);
      setEnableDestScale(Boolean(hasDistinctDestWeight));
    }
    setShowAllCols(false);
  }, [orderData, isOpen]);

  if (!isOpen || !orderData) return null;

  // Document type flags
  const isWeighbridge = selectedDocType === 'weighbridge';
  const isDeliveryOrder = selectedDocType === 'delivery_order' || selectedDocType === 'concrete';
  const isTaxInvoice = selectedDocType === 'tax_invoice';
  const isPO = selectedDocType === 'purchase_order';
  const isFullLogistics = selectedDocType === 'full_logistics';

  // Determine which zones are relevant for the current document type
  const showWeightsOrigin = showAllCols || isWeighbridge || isFullLogistics;
  const showWeightsDest = showAllCols || isFullLogistics || (isWeighbridge && enableDestScale);

  // Auto-calculation functions
  const handleWeightChange = (field: 'col13' | 'col14' | 'col18' | 'col19', value: number) => {
    const nextForm = { ...form, [field]: value };

    // Zone 3: Net Origin = Gross - Tare
    const grossO = Number(field === 'col13' ? value : nextForm.col13) || 0;
    const tareO = Number(field === 'col14' ? value : nextForm.col14) || 0;
    const netO = Math.max(0, grossO - tareO);
    nextForm.col15 = netO;

    // Zone 4: Net Dest = Dest Gross - Dest Tare
    const grossD = Number(field === 'col18' ? value : nextForm.col18) || 0;
    const tareD = Number(field === 'col19' ? value : nextForm.col19) || 0;
    const netD = Math.max(0, grossD - tareD);
    nextForm.col20 = netD;

    // Weight Diff
    if (netO > 0 && netD > 0) {
      nextForm.col21 = netO - netD;
    }

    // Auto-update quantity if unit is tons
    const unit = nextForm.col23 || 'ตัน';
    if (unit.includes('ตัน') && netO > 0 && (!nextForm.col22 || nextForm.col22 === 0)) {
      nextForm.col22 = Number((netO / 1000).toFixed(2));
    }

    setForm(nextForm);
    recalculateFinancials(nextForm);
  };

  const handleFinancialChange = (field: 'col22' | 'col24' | 'col27' | 'col31' | 'col33' | 'col35', value: number) => {
    const nextForm = { ...form, [field]: value };
    recalculateFinancials(nextForm);
  };

  const recalculateFinancials = (currentForm: Partial<OrderRecord>) => {
    const qty = Number(currentForm.col22) || 0;
    const price = Number(currentForm.col24) || 0;
    const goodsTotal = qty * price;
    currentForm.col25 = Number(goodsTotal.toFixed(2));

    const freightRate = Number(currentForm.col27) || 0;
    const freightTotal = qty * freightRate;
    currentForm.col28 = Number(freightTotal.toFixed(2));

    const grandTotal = goodsTotal + freightTotal;
    currentForm.col29 = Number(grandTotal.toFixed(2));

    const paidSeller = Number(currentForm.col31) || 0;
    const paidFreight = Number(currentForm.col33) || 0;
    currentForm.col32 = Number(Math.max(0, goodsTotal - paidSeller).toFixed(2));
    currentForm.col34 = Number(Math.max(0, freightTotal - paidFreight).toFixed(2));

    const totalPaid = Number(currentForm.col35) !== undefined && Number(currentForm.col35) > 0 
      ? Number(currentForm.col35) 
      : paidSeller + paidFreight;
    currentForm.col35 = Number(totalPaid.toFixed(2));
    currentForm.col36 = Number(Math.max(0, grandTotal - totalPaid).toFixed(2));

    setForm({ ...currentForm });
  };

  const handleTextChange = (field: keyof OrderRecord, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleDocTypeSelect = (docType: DocumentType) => {
    setSelectedDocType(docType);
    const updated = { ...form, docType };

    // Auto-adjust default unit or vehicle based on doc type
    if (docType === 'concrete') {
      if (!updated.col23 || updated.col23 === 'ตัน') updated.col23 = 'คิว';
      if (!updated.col26) updated.col26 = 'รถโม่คอนกรีต';
      if (!updated.col3) updated.col3 = 'งานคอนกรีตผสมเสร็จ';
    } else if (docType === 'delivery_order') {
      if (!updated.col23 || updated.col23 === 'ตัน') updated.col23 = 'รายการ';
      if (!updated.col26) updated.col26 = 'สิบล้อ/หกล้อ';
    } else if (docType === 'weighbridge') {
      if (!updated.col23) updated.col23 = 'ตัน';
      if (!updated.col26) updated.col26 = 'พ่วง 18 ล้อ';
      if (!updated.col3) updated.col3 = 'งานหิน/ดิน/ทราย';
    }

    setForm(updated);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalizedOrder: OrderRecord = {
      id: form.id || 'ord-' + Date.now(),
      docType: selectedDocType,
      col1: form.col1 || 'TR-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      col2: form.col2 || 'โครงการทั่วไป',
      col3: form.col3 || (selectedDocType === 'concrete' ? 'คอนกรีต' : 'ทั่วไป'),
      col4: form.col4 || '',
      col5: form.col5 || '',
      col6: form.col6 || '',
      col7: form.col7 || new Date().toISOString().split('T')[0],
      col8: form.col8 || 'ผู้จำหน่ายไม่ระบุชื่อ',
      col9: form.col9 || '',
      col10: form.col10 || '',
      col11: form.col11 || 'วัสดุก่อสร้าง',
      col12: form.col12 || '',
      col13: showWeightsOrigin ? (Number(form.col13) || 0) : 0,
      col14: showWeightsOrigin ? (Number(form.col14) || 0) : 0,
      col15: showWeightsOrigin ? (Number(form.col15) || 0) : 0,
      col16: showWeightsDest ? (form.col16 || '') : '',
      col17: showWeightsDest ? (form.col17 || '') : '',
      col18: showWeightsDest ? (Number(form.col18) || 0) : 0,
      col19: showWeightsDest ? (Number(form.col19) || 0) : 0,
      col20: showWeightsDest ? (Number(form.col20) || 0) : 0,
      col21: showWeightsDest ? (Number(form.col21) || 0) : 0,
      col22: Number(form.col22) || 1,
      col23: form.col23 || (selectedDocType === 'concrete' ? 'คิว' : 'ตัน'),
      col24: Number(form.col24) || 0,
      col25: Number(form.col25) || 0,
      col26: form.col26 || '',
      col27: Number(form.col27) || 0,
      col28: Number(form.col28) || 0,
      col29: Number(form.col29) || 0,
      col30: form.col30 || 'โอนเงิน',
      col31: Number(form.col31) || 0,
      col32: Number(form.col32) || 0,
      col33: Number(form.col33) || 0,
      col34: Number(form.col34) || 0,
      col35: Number(form.col35) || 0,
      col36: Number(form.col36) || 0,
      col37: form.col37 || '',
      col38: form.col38 || '',
      referenceDocNo: form.referenceDocNo || '',
      referenceSource: form.referenceSource || 'form_field',
      linkedViaDocNo: form.linkedViaDocNo || '',
      lineItems: form.lineItems,
      image: currentImage || billImage || form.image || null,
      aiExtracted: true,
      status: 'verified',
      createdAt: form.createdAt || new Date().toISOString()
    };

    // Prepare Store/Merchant object if requested
    let storeToSave: StoreMerchant | undefined;
    if (saveToStoreDirectory && finalizedOrder.col8) {
      const existingStore = stores.find(
        s => s.name.trim().toLowerCase() === finalizedOrder.col8.trim().toLowerCase()
      );

      if (!existingStore) {
        storeToSave = {
          id: 'store-' + Date.now(),
          name: finalizedOrder.col8,
          category: finalizedOrder.col3 || storeSuggestion?.category || 'ทั่วไป',
          taxId: storeSuggestion?.taxId || '',
          phone: storeSuggestion?.phone || '',
          contactPerson: storeSuggestion?.contactPerson || '',
          address: storeSuggestion?.address || '',
          creditTerms: finalizedOrder.col30 || 'เครดิต 30 วัน',
          totalOrders: 1,
          totalPurchases: finalizedOrder.col29,
          totalPaid: finalizedOrder.col35,
          totalDebt: finalizedOrder.col36,
          lastOrderDate: finalizedOrder.col7,
          primaryGoods: [finalizedOrder.col11],
          notes: 'บันทึกอัตโนมัติจากการสแกนบิล'
        };
        finalizedOrder.storeId = storeToSave.id;
      } else {
        finalizedOrder.storeId = existingStore.id;
      }
    }

    onSaveOrder(finalizedOrder, storeToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 md:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl max-w-[1750px] w-full h-[95vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>ตรวจสอบข้อมูลและจัดเก็บ (Split-Screen Verification)</span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  เลือกประเภทบิลเพื่อกรองฟิลด์ที่จำเป็น
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                ระบบปรับการแสดงฟิลด์ตามประเภทบิลอัตโนมัติ เพื่อให้ตรวจทานได้รวดเร็ว ไม่แสดงช่องที่ไม่เกี่ยวข้อง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Split Screen Container */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
          
          {/* Left Column: Image Viewer with Rotate & Crop (5 Cols) */}
          <div className="md:col-span-5 bg-slate-950 p-3 flex flex-col h-full overflow-hidden">
            <ImageDocViewer
              image={currentImage}
              title="ภาพเอกสารต้นฉบับ"
              onImageChange={(newImg) => setCurrentImage(newImg)}
            />
          </div>

          {/* Right Column: Dynamic Form tailored by Bill Type (7 Cols) */}
          <div className="md:col-span-7 bg-white p-4 overflow-y-auto space-y-3.5 flex flex-col h-full text-xs">
            
            {/* Top Toolbar: Document Type Selector Buttons */}
            <div className="bg-slate-100 p-2 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>ประเภทเอกสาร / บิล:</span>
                </span>
                
                {/* Toggle Show All 39 Cols button */}
                <button
                  type="button"
                  onClick={() => setShowAllCols(!showAllCols)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                    showAllCols 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {showAllCols ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showAllCols ? 'ซ่อนฟิลด์ที่ไม่จำเป็น' : 'แสดงทุกฟิลด์ (ครบ 39 ช่อง)'}</span>
                </button>
              </div>

              {/* Document Type Selector Segmented Options */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                
                {/* 1. Purchase Order */}
                <button
                  type="button"
                  onClick={() => handleDocTypeSelect('purchase_order')}
                  className={`p-2 rounded-lg text-left border transition cursor-pointer ${
                    selectedDocType === 'purchase_order'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ใบสั่งซื้อ (PO)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">เอกสารสั่งซื้อ / เงื่อนไขจัดซื้อ</div>
                </button>

                {/* 2. Delivery Order (Includes Concrete & General Goods) */}
                <button
                  type="button"
                  onClick={() => handleDocTypeSelect('delivery_order')}
                  className={`p-2 rounded-lg text-left border transition cursor-pointer ${
                    selectedDocType === 'delivery_order'
                      ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-xs ring-1 ring-sky-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Boxes className="w-3.5 h-3.5 text-sky-600" />
                    <span>ใบส่งของ (DO)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">สินค้าทั่วไป & คอนกรีตผสมเสร็จ</div>
                </button>

                {/* 3. Weighbridge */}
                <button
                  type="button"
                  onClick={() => handleDocTypeSelect('weighbridge')}
                  className={`p-2 rounded-lg text-left border transition cursor-pointer ${
                    selectedDocType === 'weighbridge'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs ring-1 ring-emerald-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Scale className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ตั๋วชั่งน้ำหนัก</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">หิน/ดิน/ทราย (ชั่ง Gross/Tare)</div>
                </button>

                {/* 4. Tax Invoice */}
                <button
                  type="button"
                  onClick={() => handleDocTypeSelect('tax_invoice')}
                  className={`p-2 rounded-lg text-left border transition cursor-pointer ${
                    selectedDocType === 'tax_invoice'
                      ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs ring-1 ring-amber-400'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Receipt className="w-3.5 h-3.5 text-amber-600" />
                    <span>ใบเสร็จ/กำกับภาษี</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">ซื้อสินค้าทั่วไป / ยอดชำระเงิน</div>
                </button>

              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3">
              
              {/* Auto Store Directory Option */}
              <div className="flex items-center justify-between text-xs px-1">
                <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={saveToStoreDirectory}
                    onChange={(e) => setSaveToStoreDirectory(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>บันทึกชื่อผู้จำหน่ายลงในทะเบียนร้านค้าอัตโนมัติ</span>
                </label>
              </div>

              {/* Active Document Type Banner */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                selectedDocType === 'delivery_order' ? 'bg-sky-50 border-sky-200 text-sky-900' :
                selectedDocType === 'weighbridge' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                selectedDocType === 'tax_invoice' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                selectedDocType === 'purchase_order' ? 'bg-indigo-50 border-indigo-200 text-indigo-900' :
                'bg-slate-100 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center gap-2">
                  {selectedDocType === 'delivery_order' && <Boxes className="w-4 h-4 text-sky-600 shrink-0" />}
                  {selectedDocType === 'weighbridge' && <Scale className="w-4 h-4 text-emerald-600 shrink-0" />}
                  {selectedDocType === 'tax_invoice' && <Receipt className="w-4 h-4 text-amber-600 shrink-0" />}
                  {selectedDocType === 'purchase_order' && <FileText className="w-4 h-4 text-indigo-600 shrink-0" />}
                  <div>
                    <span className="font-bold block">
                      {selectedDocType === 'delivery_order' ? 'ฟอร์มใบส่งของ (DO) / สินค้าทั่วไป & คอนกรีต' :
                       selectedDocType === 'weighbridge' ? 'ฟอร์มตั๋วชั่งน้ำหนักรถบรรทุก (หิน, ดิน, ทราย)' :
                       selectedDocType === 'tax_invoice' ? 'ฟอร์มใบเสร็จรับเงิน / ใบกำกับภาษี (Tax Invoice)' :
                       selectedDocType === 'purchase_order' ? 'ฟอร์มใบสั่งซื้อสินค้า (PO)' : 'ฟอร์มโลจิสติกส์เต็มรูปแบบ'}
                    </span>
                    <span className="text-[11px] block opacity-80">
                      {showAllCols ? 'แสดงทุกฟิลด์ (ครบ 39 คอลัมน์)' :
                       selectedDocType === 'delivery_order' ? 'แสดงเฉพาะฟิลด์ส่งของและรายการสินค้า (ซ่อนช่องตราชั่งรถบรรทุกที่ไม่เกี่ยวข้อง)' :
                       selectedDocType === 'weighbridge' ? 'แสดงน้ำหนักชั่งเข้า/ออก และแปลงเป็นปริมาณตัน (ซ่อนชั่งปลายทางเพื่อไม่ให้ตัวเลขซ้ำซ้อน)' :
                       selectedDocType === 'tax_invoice' ? 'แสดงเฉพาะเลขผู้เสียภาษี 13 หลัก รายการสินค้า และยอดเงิน (ซ่อนน้ำหนักตราชั่ง)' :
                       'ระบบปรับฟิลด์ตามบริบทเอกสาร'}
                    </span>
                  </div>
                </div>
                {!showAllCols && (
                  <span className="text-[10px] bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded-md font-semibold shrink-0 shadow-2xs">
                    ฟอร์มเฉพาะบิล
                  </span>
                )}
              </div>

              {/* Purchase Order Warning / Switch Banner if user selected PO in this modal */}
              {isPO && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 text-xs animate-fadeIn">
                  <div className="font-bold text-indigo-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>เอกสารนี้เป็น "ใบสั่งซื้อสินค้า (PO)"</span>
                  </div>
                  <p className="text-indigo-800 text-[11px]">
                    ระบบมีโมดูลบริหารจัดการใบสั่งซื้อ (PO Management) โดยเฉพาะที่มีตารางคุมสเปกสินค้า เงื่อนไขตัดส่งมอบ และระบบชนบิลอัตโนมัติ
                  </p>
                  {onSwitchToPO && (
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchToPO({
                          poNumber: form.col4 || form.col6 || 'PO-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
                          orderDate: form.col7 || new Date().toISOString().split('T')[0],
                          storeName: form.col8 || 'ไม่ระบุผู้ขาย',
                          projectId: form.col2 || '',
                          category: form.col3 || '',
                          items: form.lineItems && form.lineItems.length > 0
                            ? form.lineItems.map((i, idx) => ({
                                id: `item-${Date.now()}-${idx}`,
                                itemDescription: i.itemDescription,
                                specCode: i.specCode || '',
                                orderedQty: i.qty || 1,
                                unit: i.unit || 'ชิ้น',
                                unitPrice: i.unitPrice || 0,
                                totalAmount: i.totalAmount || 0
                              }))
                            : [{
                                id: `item-${Date.now()}-0`,
                                itemDescription: form.col11 || 'สินค้าทั่วไป',
                                specCode: form.col12 || '',
                                orderedQty: Number(form.col22) || 1,
                                unit: form.col23 || 'ชิ้น',
                                unitPrice: Number(form.col24) || 0,
                                totalAmount: Number(form.col25) || Number(form.col29) || 0
                              }],
                          totalQty: Number(form.col22) || 1,
                          totalAmount: Number(form.col29) || Number(form.col25) || 0,
                          status: 'pending',
                          creditTerms: form.col30 || 'เครดิต 30 วัน',
                          deliveryLocation: form.col37 || '',
                          orderedBy: form.col9 || '',
                          notes: form.col38 || '',
                          image: currentImage || form.image || null,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        });
                        onClose();
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>สลับไปเปิดหน้าต่างจัดการใบสั่งซื้อ (PO Edit View) ทันที</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  )}
                </div>
              )}

              {/* ==================== 1. TAILORED FORM FOR DELIVERY ORDER (DO / CONCRETE) ==================== */}
              {!showAllCols && isDeliveryOrder && (
                <div className="space-y-3">
                  {/* Card 1: Document Reference & Site */}
                  <div className="border border-sky-200 rounded-xl p-3 bg-sky-50/20 space-y-2">
                    <div className="font-bold text-sky-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                        <span>[ใบส่งของ] ข้อมูลเอกสาร & โครงการ</span>
                      </span>
                      <span className="text-[11px] text-sky-700 font-mono">DO & Site Details</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] font-bold text-sky-950 mb-0.5">
                          6. เลขที่ DO / ใบส่งของ <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col6 || ''}
                          onChange={(e) => handleTextChange('col6', e.target.value)}
                          className="w-full p-2 border border-sky-300 rounded-lg bg-white font-mono font-bold text-sky-900"
                          placeholder="DO-xxxxx หรือ เลขที่บิลส่งของ"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[11px] font-semibold text-slate-700">4. เลขที่ PO อ้างอิง</label>
                          {/* Reference Source Selector */}
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleTextChange('referenceSource', 'form_field')}
                              className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                (form.referenceSource || 'form_field') === 'form_field'
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="พบในช่องฟอร์มเอกสาร"
                            >
                              📋 ฟอร์ม
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTextChange('referenceSource', 'notes')}
                              className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                form.referenceSource === 'notes'
                                  ? 'bg-sky-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="พบในช่องหมายเหตุ"
                            >
                              💬 หมายเหตุ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTextChange('referenceSource', 'handwritten')}
                              className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                form.referenceSource === 'handwritten'
                                  ? 'bg-amber-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="เขียนด้วยลายมือบนบิล"
                            >
                              ✍️ ลายมือ
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={form.col4 || ''}
                          onChange={(e) => {
                            handleTextChange('col4', e.target.value);
                            handleTextChange('referenceDocNo', e.target.value);
                          }}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800"
                          placeholder="PO-xxxxx (ถ้ามี)"
                        />
                        {pos && pos.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                            <span>หรือเลือก PO:</span>
                            <select
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 max-w-[130px] truncate"
                              value={form.col4 || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleTextChange('col4', e.target.value);
                                  handleTextChange('referenceDocNo', e.target.value);
                                }
                              }}
                            >
                              <option value="">-- เลือก PO ในระบบ --</option>
                              {pos.map(p => (
                                <option key={p.id} value={p.poNumber}>
                                  {p.poNumber} ({p.storeName})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">7. วันที่ส่งมอบ</label>
                        <input
                          type="date"
                          value={form.col7 || ''}
                          onChange={(e) => handleTextChange('col7', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">2. โครงการ / หน้างาน</label>
                        <input
                          type="text"
                          value={form.col2 || ''}
                          onChange={(e) => handleTextChange('col2', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="เช่น อาคาร A, โครงการถนน"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">10. ทะเบียนรถขนส่ง</label>
                        <input
                          type="text"
                          value={form.col10 || ''}
                          onChange={(e) => handleTextChange('col10', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                          placeholder="เช่น 70-1234 กทม."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Merchant & Goods */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2 shadow-2xs">
                    <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <span>คู่ค้าผู้จำหน่าย & รายการสินค้าส่งมอบ</span>
                      </span>
                      <span className="text-[11px] text-slate-500">Supplier & Items</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">
                          8. ผู้จำหน่าย / ร้านค้า <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col8 || ''}
                          onChange={(e) => handleTextChange('col8', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-900"
                          placeholder="เช่น บจก. สหพาณิชย์ หรือ แพลนท์ CPAC"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">9. ผู้รับสินค้า / ผู้ซื้อ</label>
                        <input
                          type="text"
                          value={form.col9 || ''}
                          onChange={(e) => handleTextChange('col9', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="ชื่อบริษัทหรือวิศวกรผู้รับของ"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-blue-950 mb-0.5">
                          11. รายการสินค้าหลัก <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col11 || ''}
                          onChange={(e) => handleTextChange('col11', e.target.value)}
                          className="w-full p-2 border border-blue-300 rounded-lg bg-white font-bold text-blue-900"
                          placeholder="เช่น เหล็กเส้นกลม RB9, ท่อ PVC 2 นิ้ว, 280 KSC Cube"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">12. สเปก / Code / Slump</label>
                        <input
                          type="text"
                          value={form.col12 || ''}
                          onChange={(e) => handleTextChange('col12', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                          placeholder="เช่น SD40, Slump 10±2.5 cm, มอก."
                        />
                      </div>
                    </div>

                    {/* Multi-item Breakdown Table (If present) */}
                    {form.lineItems && form.lineItems.length > 0 && (
                      <div className="mt-2.5 p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                          <span className="flex items-center gap-1.5 text-sky-900">
                            <Boxes className="w-3.5 h-3.5 text-sky-600" />
                            <span>รายการสินค้าย่อยในใบส่งของ ({form.lineItems.length} รายการ)</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal">สกัดรายการสินค้าทั่วไป</span>
                        </div>
                        <div className="overflow-x-auto max-h-48 border border-slate-200 rounded bg-white">
                          <table className="w-full min-w-[640px] text-[11px] text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0">
                              <tr>
                                <th className="p-1.5 w-8 text-center">#</th>
                                <th className="p-1.5 min-w-[220px]">รายการสินค้า (Description)</th>
                                <th className="p-1.5 w-24">สเปก</th>
                                <th className="p-1.5 text-right w-16">จำนวน</th>
                                <th className="p-1.5 text-center w-16">หน่วย</th>
                                <th className="p-1.5 text-right w-20">ราคา/หน่วย</th>
                                <th className="p-1.5 text-right w-24">รวมเงิน</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {form.lineItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-1.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="p-1.5 font-medium text-slate-900 min-w-[220px]">{item.itemDescription}</td>
                                  <td className="p-1.5 text-slate-500 font-mono">{item.specCode || '-'}</td>
                                  <td className="p-1.5 text-right font-mono font-bold text-slate-800">{item.qty}</td>
                                  <td className="p-1.5 text-center text-slate-600">{item.unit}</td>
                                  <td className="p-1.5 text-right font-mono text-slate-700">
                                    {item.unitPrice ? `฿${item.unitPrice.toLocaleString()}` : '-'}
                                  </td>
                                  <td className="p-1.5 text-right font-mono font-bold text-slate-900">
                                    {item.totalAmount ? `฿${item.totalAmount.toLocaleString()}` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Quantity & Billing */}
                  <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/20 space-y-2">
                    <div className="font-bold text-purple-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span>ปริมาณ & จำนวนเงินสินค้า</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-purple-800">
                        รวมทั้งสิ้น: ฿{(form.col29 || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">
                          22. ปริมาณ / จำนวน <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={form.col22 !== undefined ? form.col22 : ''}
                          onChange={(e) => handleFinancialChange('col22', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono font-bold text-slate-900"
                          placeholder="เช่น 10, 50, 7.5"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">23. หน่วยนับ</label>
                        <input
                          type="text"
                          value={form.col23 || ''}
                          onChange={(e) => handleTextChange('col23', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-center font-medium"
                          placeholder="เช่น เส้น, ถุง, คิว, แผ่น, กล่อง"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">24. ราคาต่อหน่วย (บาท)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col24 !== undefined ? form.col24 : ''}
                          onChange={(e) => handleFinancialChange('col24', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-purple-900 mb-0.5">25. รวมค่าสินค้า (บาท)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col25 || 0}
                          className="w-full p-2 border border-purple-300 rounded-lg bg-purple-50 text-right font-mono font-bold text-purple-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-900 mb-0.5">29. รวมทั้งสิ้น (บาท)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col29 || 0}
                          className="w-full p-2 border border-blue-400 rounded-lg bg-blue-100 text-right font-mono font-bold text-blue-950"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Payment & Location */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                        <span>เงื่อนไขการชำระเงิน & สถานที่ส่งมอบ</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-rose-700">
                        ค้างชำระ: ฿{(form.col36 || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">30. รูปแบบการชำระ</label>
                        <select
                          value={form.col30 || 'โอนเงิน'}
                          onChange={(e) => handleTextChange('col30', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs"
                        >
                          <option value="โอนเงิน">โอนเงินธนาคาร</option>
                          <option value="เครดิต 30 วัน">เครดิต 30 วัน</option>
                          <option value="เครดิต 15 วัน">เครดิต 15 วัน</option>
                          <option value="เครดิต 60 วัน">เครดิต 60 วัน</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="เช็ค">เช็คสั่งจ่าย</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">35. ยอดชำระแล้ว (บาท)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col35 !== undefined ? form.col35 : ''}
                          onChange={(e) => handleFinancialChange('col35', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">37. สถานที่ส่งมอบ / จุดเท</label>
                        <input
                          type="text"
                          value={form.col37 || ''}
                          onChange={(e) => handleTextChange('col37', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="เช่น อาคาร 2 หรือ จุดเทฐานราก"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">38. หมายเหตุ</label>
                        <input
                          type="text"
                          value={form.col38 || ''}
                          onChange={(e) => handleTextChange('col38', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="บันทึกเพิ่มเติม"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== 2. TAILORED FORM FOR WEIGHBRIDGE TICKET (ตั๋วชั่งน้ำหนัก) ==================== */}
              {!showAllCols && isWeighbridge && (
                <div className="space-y-3">
                  {/* Card 1: Ticket & Truck */}
                  <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/20 space-y-2">
                    <div className="font-bold text-emerald-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>[ตั๋วชั่ง] ข้อมูลตั๋ว & รถบรรทุก</span>
                      </span>
                      <span className="text-[11px] text-emerald-700 font-mono">Weighbridge Ticket</span>
                    </div>

                    {/* 3-Way Supply Chain Matching Helper Banner */}
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                      <Link2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-emerald-950">การชนบิล 3 ฝ่าย (PO ↔ DO ↔ ตั๋วชั่ง):</span>
                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                          ตั๋วชั่งน้ำหนักส่วนใหญ่จะอ้างอิงไปหา <strong>เลขที่ใบส่งของ (DO)</strong> หรือมีลายมือเขียนเลข PO กำกับไว้ในบิล — กรุณาตรวจทานเลขอ้างอิงด้านล่างเพื่อเชื่อมโยงตัดยอดส่งมอบอัตโนมัติ
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-950 mb-0.5">
                          6. เลขที่ตั๋วชั่ง <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col6 || ''}
                          onChange={(e) => handleTextChange('col6', e.target.value)}
                          className="w-full p-2 border border-emerald-300 rounded-lg bg-white font-mono font-bold text-emerald-900"
                          placeholder="WB-xxxxx หรือ เลขที่ตั๋ว"
                        />
                      </div>

                      {/* Reference to Delivery Order (DO) */}
                      <div className="border border-sky-200 p-2 rounded-lg bg-sky-50/40">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[11px] font-bold text-sky-950">
                            🔗 เลขที่ใบส่งของ (DO) อ้างอิง
                          </label>
                          {/* Reference Source Selector */}
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleTextChange('referenceSource', 'form_field')}
                              className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                (form.referenceSource || 'form_field') === 'form_field'
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="พบในช่องฟอร์มเอกสาร"
                            >
                              📋 ฟอร์ม
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTextChange('referenceSource', 'notes')}
                              className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                form.referenceSource === 'notes'
                                  ? 'bg-sky-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="พบในช่องหมายเหตุ"
                            >
                              💬 หมายเหตุ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTextChange('referenceSource', 'handwritten')}
                              className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                form.referenceSource === 'handwritten'
                                  ? 'bg-amber-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="เขียนด้วยลายมือบนตั๋วชั่ง"
                            >
                              ✍️ ลายมือ
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={form.referenceDocNo || ''}
                          onChange={(e) => handleTextChange('referenceDocNo', e.target.value)}
                          className="w-full p-2 border border-sky-300 rounded-lg bg-white font-mono font-semibold text-sky-900"
                          placeholder="DO-xxxxx หรือ เลขที่บิลส่งของ"
                        />
                        {existingOrders && existingOrders.filter(o => o.docType === 'delivery_order' || o.col6).length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                            <span>หรือเลือก DO:</span>
                            <select
                              className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 max-w-[130px] truncate"
                              value={form.referenceDocNo || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleTextChange('referenceDocNo', e.target.value);
                                }
                              }}
                            >
                              <option value="">-- เลือก DO ในระบบ --</option>
                              {existingOrders.filter(o => o.col6).map(o => (
                                <option key={o.id} value={o.col6}>
                                  {o.col6} ({o.col8 || o.col11})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">4. เลขที่ PO อ้างอิง (ถ้ามี)</label>
                        <input
                          type="text"
                          value={form.col4 || ''}
                          onChange={(e) => handleTextChange('col4', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800"
                          placeholder="PO-xxxxx (ถ้ามีเขียนไว้)"
                        />
                        {pos && pos.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                            <span>เลือก PO:</span>
                            <select
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1 py-0.5 max-w-[120px] truncate"
                              value={form.col4 || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleTextChange('col4', e.target.value);
                                }
                              }}
                            >
                              <option value="">-- PO ในระบบ --</option>
                              {pos.map(p => (
                                <option key={p.id} value={p.poNumber}>
                                  {p.poNumber}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">7. วันที่ชั่ง</label>
                        <input
                          type="date"
                          value={form.col7 || ''}
                          onChange={(e) => handleTextChange('col7', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">
                          10. ทะเบียนรถบรรทุก <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col10 || ''}
                          onChange={(e) => handleTextChange('col10', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-slate-900"
                          placeholder="เช่น 70-1234 กทม."
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">
                          8. โรงโม่ / ลานทราย / ผู้จำหน่าย <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col8 || ''}
                          onChange={(e) => handleTextChange('col8', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-900"
                          placeholder="ชื่อโรงโม่หิน หรือ ท่าทราย"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-950 mb-0.5">
                          11. ชนิดสินค้า <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col11 || ''}
                          onChange={(e) => handleTextChange('col11', e.target.value)}
                          className="w-full p-2 border border-emerald-300 rounded-lg bg-white font-bold text-emerald-900"
                          placeholder="เช่น หินคลุก, หิน 1, ทรายหยาบ, ดินถม"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">2. โครงการ / หน้างาน</label>
                        <input
                          type="text"
                          value={form.col2 || ''}
                          onChange={(e) => handleTextChange('col2', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="โครงการทางหลวง, อาคาร"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Zone 3 Origin Scale Weights */}
                  <div className="border border-emerald-300 rounded-xl p-3 bg-emerald-50/40 space-y-2 shadow-2xs">
                    <div className="font-bold text-emerald-950 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-4 h-4 text-emerald-600" />
                        <span>[โซน 3] น้ำหนักตราชั่งรถบรรทุก (ต้นทาง)</span>
                      </span>
                      <span className="text-[11px] text-emerald-800 font-mono font-semibold">
                        หนักเข้า - เบาออก = น้ำหนักสุทธิ (กก.)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          13. หนักเข้า (Gross กก.)
                        </label>
                        <input
                          type="number"
                          value={form.col13 !== undefined ? form.col13 : ''}
                          onChange={(e) => handleWeightChange('col13', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono font-bold text-slate-900 text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          14. เบาออก (Tare กก.)
                        </label>
                        <input
                          type="number"
                          value={form.col14 !== undefined ? form.col14 : ''}
                          onChange={(e) => handleWeightChange('col14', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono font-bold text-slate-900 text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">
                          15. น้ำหนักสุทธิ (Net กก.)
                        </label>
                        <input
                          type="number"
                          readOnly
                          value={form.col15 || 0}
                          className="w-full p-2 border border-emerald-400 rounded-lg bg-emerald-100 text-right font-mono font-bold text-emerald-950 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-emerald-200 text-emerald-900">
                      <span className="flex items-center gap-1 font-medium">
                        <Info className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ระบบคำนวณปริมาณเป็นตันให้อัตโนมัติ:</span>
                      </span>
                      <span className="font-mono font-bold">
                        {((Number(form.col15) || 0) / 1000).toFixed(2)} ตัน (นำเข้าช่องที่ 22)
                      </span>
                    </div>

                    {/* Zone 4 Optional Control: Prevents duplication of Zone 3 */}
                    <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between">
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-slate-500" />
                        <span>หน้างานมีตราชั่งปลายทางหรือไม่?</span>
                        <span className="text-[10px] text-slate-500 hidden sm:inline">(ปกติชั่งเฉพาะต้นทาง ปิดไว้เพื่อไม่ให้ข้อมูลซ้ำซ้อน)</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs hover:bg-emerald-50 transition">
                        <input
                          type="checkbox"
                          checked={enableDestScale}
                          onChange={(e) => setEnableDestScale(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>เปิดบันทึกชั่งปลายทาง & ผลต่าง</span>
                      </label>
                    </div>

                    {/* Zone 4: Shown ONLY IF explicitly enabled by user */}
                    {enableDestScale && (
                      <div className="mt-2 p-2.5 bg-teal-50 rounded-lg border border-teal-300 space-y-2 animate-fadeIn">
                        <div className="font-bold text-teal-900 text-xs flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                            <span>[โซน 4] น้ำหนักชั่งตรวจรับปลายทาง ณ ไซต์งาน</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold text-rose-600">
                            ผลต่างตกหล่น (ต้นทาง - ปลายทาง): {form.col21 || 0} กก.
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">18. หนักปลายทาง (กก.)</label>
                            <input
                              type="number"
                              value={form.col18 !== undefined ? form.col18 : ''}
                              onChange={(e) => handleWeightChange('col18', parseFloat(e.target.value) || 0)}
                              className="w-full p-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">19. เบาปลายทาง (กก.)</label>
                            <input
                              type="number"
                              value={form.col19 !== undefined ? form.col19 : ''}
                              onChange={(e) => handleWeightChange('col19', parseFloat(e.target.value) || 0)}
                              className="w-full p-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-teal-900 mb-0.5">20. สุทธิปลายทาง (กก.)</label>
                            <input
                              type="number"
                              readOnly
                              value={form.col20 || 0}
                              className="w-full p-1.5 border border-teal-300 rounded-lg bg-teal-100 text-right font-mono font-bold text-teal-950"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Tons, Freight & Totals */}
                  <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/20 space-y-2">
                    <div className="font-bold text-purple-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span>ปริมาณคิดเงิน (ตัน), ค่าสินค้า & ค่าบรรทุก</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-blue-700">
                        รวมทั้งสิ้น: ฿{(form.col29 || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">
                          22. ปริมาณ (ตัน) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={form.col22 !== undefined ? form.col22 : ''}
                          onChange={(e) => handleFinancialChange('col22', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">24. ราคาหิน/ทรายต่อตัน (บาท)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col24 !== undefined ? form.col24 : ''}
                          onChange={(e) => handleFinancialChange('col24', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">27. ค่าขนส่ง/ตัน (บาท)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col27 !== undefined ? form.col27 : ''}
                          onChange={(e) => handleFinancialChange('col27', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-900 mb-0.5">29. รวมทั้งสิ้น (บาท)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col29 || 0}
                          className="w-full p-2 border border-blue-400 rounded-lg bg-blue-100 text-right font-mono font-bold text-blue-950"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">26. ประเภทรถ</label>
                        <input
                          type="text"
                          value={form.col26 || ''}
                          onChange={(e) => handleTextChange('col26', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="พ่วง 18 ล้อ, สิบล้อ"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">25. รวมค่าสินค้า</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col25 || 0}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-right font-mono text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">28. รวมค่าขนส่ง</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col28 || 0}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-right font-mono text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">36. ยอดค้างชำระ</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col36 || 0}
                          className="w-full p-2 border border-rose-300 rounded-lg bg-rose-50 text-right font-mono font-bold text-rose-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Location & Notes */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                        <span>สถานที่ส่งมอบ & บันทึกตั๋วชั่ง</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">37. จุดลงหิน/ทราย / กม.</label>
                        <input
                          type="text"
                          value={form.col37 || ''}
                          onChange={(e) => handleTextChange('col37', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="เช่น กองหิน กม. 12+400 หรือ แพลนท์ผสม"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">38. หมายเหตุ</label>
                        <input
                          type="text"
                          value={form.col38 || ''}
                          onChange={(e) => handleTextChange('col38', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="บันทึกหน้างาน"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== 3. TAILORED FORM FOR TAX INVOICE (ใบเสร็จ/ใบกำกับภาษี) ==================== */}
              {!showAllCols && isTaxInvoice && (
                <div className="space-y-3">
                  {/* Card 1: Tax Invoice Info & Merchant */}
                  <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/20 space-y-2">
                    <div className="font-bold text-amber-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span>[ใบเสร็จ/กำกับภาษี] ข้อมูลเอกสาร & คู่ค้า</span>
                      </span>
                      <span className="text-[11px] text-amber-700 font-mono">Tax Invoice & VAT</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-amber-950 mb-0.5">
                          6. เลขที่ใบกำกับภาษี / ใบเสร็จ <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col6 || ''}
                          onChange={(e) => handleTextChange('col6', e.target.value)}
                          className="w-full p-2 border border-amber-300 rounded-lg bg-white font-mono font-bold text-amber-900"
                          placeholder="INV-xxxxx หรือ TAX-xxxxx"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">4. เลขที่ PO อ้างอิง</label>
                        <input
                          type="text"
                          value={form.col4 || ''}
                          onChange={(e) => handleTextChange('col4', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono text-slate-800"
                          placeholder="PO-xxxxx (ถ้ามี)"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">7. วันที่ออกเอกสาร</label>
                        <input
                          type="date"
                          value={form.col7 || ''}
                          onChange={(e) => handleTextChange('col7', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">เลขประจำตัวผู้เสียภาษี 13 หลัก</label>
                        <input
                          type="text"
                          value={storeSuggestion?.taxId || ''}
                          readOnly
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-800"
                          placeholder="เลขผู้เสียภาษี 13 หลัก"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">
                          8. ชื่อบริษัทผู้ขาย / ร้านค้า <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col8 || ''}
                          onChange={(e) => handleTextChange('col8', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-900"
                          placeholder="ชื่อบริษัทผู้ออกใบกำกับภาษี"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">9. ชื่อผู้ซื้อ / โครงการ</label>
                        <input
                          type="text"
                          value={form.col9 || form.col2 || ''}
                          onChange={(e) => handleTextChange('col9', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="ชื่อบริษัทผู้ซื้อ หรือ โครงการก่อสร้าง"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Items & Financials */}
                  <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/20 space-y-2">
                    <div className="font-bold text-purple-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span>รายการสินค้า & ยอดเงินภาษี</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-blue-800">
                        ยอดรวมสุทธิ: ฿{(form.col29 || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-blue-950 mb-0.5">
                          11. รายการสินค้า / บริการ <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col11 || ''}
                          onChange={(e) => handleTextChange('col11', e.target.value)}
                          className="w-full p-2 border border-blue-300 rounded-lg bg-white font-bold text-blue-900"
                          placeholder="รายละเอียดสินค้าหรือบริการตามใบเสร็จ"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">22. จำนวน</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col22 !== undefined ? form.col22 : ''}
                          onChange={(e) => handleFinancialChange('col22', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">23. หน่วย</label>
                        <input
                          type="text"
                          value={form.col23 || ''}
                          onChange={(e) => handleTextChange('col23', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-center font-medium"
                          placeholder="รายการ, ชิ้น, งาน"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-purple-900 mb-0.5">25. มูลค่าก่อนภาษี (บาท)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col25 !== undefined ? form.col25 : ''}
                          onChange={(e) => setForm(prev => ({ ...prev, col25: parseFloat(e.target.value) || 0 }))}
                          className="w-full p-2 border border-purple-300 rounded-lg bg-purple-50 text-right font-mono font-bold text-purple-900"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[11px] font-bold text-blue-900 mb-0.5">
                          29. ยอดรวมสุทธิทั้งสิ้น (รวมภาษีมูลค่าเพิ่ม) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={form.col29 !== undefined ? form.col29 : ''}
                          onChange={(e) => setForm(prev => ({ ...prev, col29: parseFloat(e.target.value) || 0 }))}
                          className="w-full p-2 border border-blue-400 rounded-lg bg-blue-100 text-right font-mono font-bold text-blue-950 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Payment Status */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                        <span>เงื่อนไขและการชำระเงิน</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-rose-700">
                        คงค้างชำระ: ฿{(form.col36 || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">30. รูปแบบการชำระ</label>
                        <select
                          value={form.col30 || 'โอนเงิน'}
                          onChange={(e) => handleTextChange('col30', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs"
                        >
                          <option value="โอนเงิน">โอนเงินธนาคาร</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="เช็ค">เช็คสั่งจ่าย</option>
                          <option value="เครดิต 30 วัน">เครดิต 30 วัน</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">31. ชำระให้ผู้จำหน่ายแล้ว</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col31 !== undefined ? form.col31 : ''}
                          onChange={(e) => handleFinancialChange('col31', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">35. ยอดชำระแล้วรวม</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col35 !== undefined ? form.col35 : ''}
                          onChange={(e) => handleFinancialChange('col35', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-emerald-300 rounded-lg bg-emerald-50 text-right font-mono font-bold text-emerald-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-rose-800 mb-0.5">36. ยอดคงค้างชำระ</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col36 || 0}
                          className="w-full p-2 border border-rose-300 rounded-lg bg-rose-50 text-right font-mono font-bold text-rose-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== 4. COMPLETE 39-COLUMN FULL FORM (WHEN showAllCols IS TOGGLED) ==================== */}
              {(showAllCols || isFullLogistics) && (
                <div className="space-y-3">
                  {/* Zone 1: Reference & Project */}
                  <div className="border border-orange-200 rounded-xl p-3 bg-orange-50/20 space-y-2">
                    <div className="font-bold text-orange-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                        <span>[โซน 1] เอกสารอ้างอิงหลัก & โครงการ (คอลัมน์ 1 - 6)</span>
                      </span>
                      <span className="text-[11px] text-orange-700 font-mono">Reference & Logistics</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">1. เลข TR</label>
                        <input
                          type="text"
                          value={form.col1 || ''}
                          onChange={(e) => handleTextChange('col1', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">2. โครงการ / หน้างาน</label>
                        <input
                          type="text"
                          value={form.col2 || ''}
                          onChange={(e) => handleTextChange('col2', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                          placeholder="เช่น อาคาร A, โครงการทางหลวง"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">3. หมวดหมู่</label>
                        <input
                          type="text"
                          value={form.col3 || ''}
                          onChange={(e) => handleTextChange('col3', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="เช่น งานเหล็ก, คอนกรีต, หิน/ทราย"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">4. เลขที่ PO</label>
                        <input
                          type="text"
                          value={form.col4 || ''}
                          onChange={(e) => handleTextChange('col4', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                          placeholder="PO-xxxxx"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">5. เลขที่ RR (ใบรับของ)</label>
                        <input
                          type="text"
                          value={form.col5 || ''}
                          onChange={(e) => handleTextChange('col5', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                          placeholder="RR-xxxxx"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-orange-950 mb-0.5">
                          6. DO / เลขที่ตั๋ว / ใบส่งของ <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.col6 || ''}
                          onChange={(e) => handleTextChange('col6', e.target.value)}
                          className="w-full p-2 border border-orange-300 rounded-lg bg-white font-mono font-bold text-orange-900"
                          placeholder="DO-xxxxx หรือ เลขที่บิล"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Zone 2: Date, Merchant & Goods */}
                  <div className="border border-sky-200 rounded-xl p-3 bg-sky-50/20 space-y-2">
                    <div className="font-bold text-sky-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                        <span>[โซน 2] วันที่ ร้านค้าผู้จำหน่าย & รายการสินค้า (คอลัมน์ 7 - 12)</span>
                      </span>
                      <span className="text-[11px] text-sky-700">Merchant & Products</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">7. วันที่ (YYYY-MM-DD)</label>
                        <input
                          type="date"
                          value={form.col7 || ''}
                          onChange={(e) => handleTextChange('col7', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-0.5">
                          8. ผู้จำหน่าย / ร้านค้า <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col8 || ''}
                          onChange={(e) => handleTextChange('col8', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">9. ผู้รับเหมา / ผู้ซื้อ</label>
                        <input
                          type="text"
                          value={form.col9 || ''}
                          onChange={(e) => handleTextChange('col9', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">10. ทะเบียนรถขนส่ง</label>
                        <input
                          type="text"
                          value={form.col10 || ''}
                          onChange={(e) => handleTextChange('col10', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-950 mb-0.5">
                          11. รายการสินค้า <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.col11 || ''}
                          onChange={(e) => handleTextChange('col11', e.target.value)}
                          className="w-full p-2 border border-blue-300 rounded-lg bg-white font-bold text-blue-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">12. สเปก / Code / Slump</label>
                        <input
                          type="text"
                          value={form.col12 || ''}
                          onChange={(e) => handleTextChange('col12', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Zone 3: Origin Weights */}
                  <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/20 space-y-2">
                    <div className="font-bold text-emerald-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>[โซน 3] น้ำหนักต้นทางจากตราชั่งรถบรรทุก (คอลัมน์ 13 - 15)</span>
                      </span>
                      <span className="text-[11px] text-emerald-700 font-mono">Gross - Tare = Net Weight</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">13. หนักเข้า (Gross กก.)</label>
                        <input
                          type="number"
                          value={form.col13 !== undefined ? form.col13 : ''}
                          onChange={(e) => handleWeightChange('col13', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">14. เบาออก (Tare กก.)</label>
                        <input
                          type="number"
                          value={form.col14 !== undefined ? form.col14 : ''}
                          onChange={(e) => handleWeightChange('col14', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">15. สุทธิ (Net กก.)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col15 || 0}
                          className="w-full p-1.5 border border-emerald-300 rounded-lg bg-emerald-50 text-right font-mono font-bold text-emerald-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Zone 4: Destination Weights */}
                  <div className="border border-teal-200 rounded-xl p-3 bg-teal-50/20 space-y-2">
                    <div className="font-bold text-teal-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                        <span>[โซน 4] น้ำหนักปลายทางหน้างาน & ผลต่างน้ำหนัก (คอลัมน์ 16 - 21)</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-rose-600">
                        ผลต่าง: {form.col21 || 0} กก.
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">16. วันที่ปลายทาง</label>
                        <input
                          type="date"
                          value={form.col16 || ''}
                          onChange={(e) => handleTextChange('col16', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">17. ตั๋วปลายทาง</label>
                        <input
                          type="text"
                          value={form.col17 || ''}
                          onChange={(e) => handleTextChange('col17', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">18. หนักปลายทาง (กก.)</label>
                        <input
                          type="number"
                          value={form.col18 !== undefined ? form.col18 : ''}
                          onChange={(e) => handleWeightChange('col18', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">19. เบาปลายทาง (กก.)</label>
                        <input
                          type="number"
                          value={form.col19 !== undefined ? form.col19 : ''}
                          onChange={(e) => handleWeightChange('col19', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-teal-800 mb-0.5">20. สุทธิปลายทาง (กก.)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col20 || 0}
                          className="w-full p-1.5 border border-teal-300 rounded-lg bg-teal-50 text-right font-mono font-bold text-teal-800"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-rose-800 mb-0.5">21. ผลต่างน้ำหนักตกหล่น (กก.)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col21 || 0}
                          className="w-full p-1.5 border border-rose-300 rounded-lg bg-rose-50 text-right font-mono font-bold text-rose-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Zone 5: Billing & Freight */}
                  <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/20 space-y-2">
                    <div className="font-bold text-purple-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span>[โซน 5] จำนวน ปริมาณ ราคา & ค่าสินค้า (คอลัมน์ 22 - 29)</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-blue-700">
                        ยอดรวมสุทธิ: ฿{(form.col29 || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                          22. ปริมาณ / จำนวน <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={form.col22 !== undefined ? form.col22 : ''}
                          onChange={(e) => handleFinancialChange('col22', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">23. หน่วยนับ</label>
                        <input
                          type="text"
                          value={form.col23 || ''}
                          onChange={(e) => handleTextChange('col23', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-center font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">24. ราคาต่อหน่วย (บาท)</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col24 !== undefined ? form.col24 : ''}
                          onChange={(e) => handleFinancialChange('col24', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-purple-900 mb-0.5">25. รวมค่าสินค้า (บาท)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col25 || 0}
                          className="w-full p-2 border border-purple-300 rounded-lg bg-purple-50 text-right font-mono font-bold text-purple-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">26. ประเภทรถ</label>
                        <input
                          type="text"
                          value={form.col26 || ''}
                          onChange={(e) => handleTextChange('col26', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">27. ค่าขนส่ง/หน่วย</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col27 !== undefined ? form.col27 : ''}
                          onChange={(e) => handleFinancialChange('col27', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-purple-900 mb-0.5">28. รวมค่าขนส่ง (บาท)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col28 || 0}
                          className="w-full p-2 border border-purple-300 rounded-lg bg-purple-50 text-right font-mono font-bold text-purple-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-900 mb-0.5">29. รวมทั้งสิ้น (บาท)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col29 || 0}
                          className="w-full p-2 border border-blue-400 rounded-lg bg-blue-100 text-right font-mono font-bold text-blue-950"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Zone 6: Payment Tracking */}
                  <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/20 space-y-2">
                    <div className="font-bold text-rose-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span>[โซน 6] เงื่อนไขการชำระเงิน & ยอดคงค้าง (คอลัมน์ 30 - 36)</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-rose-700">
                        หนี้ค้างชำระ: ฿{(form.col36 || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">30. รูปแบบการชำระ</label>
                        <select
                          value={form.col30 || 'โอนเงิน'}
                          onChange={(e) => handleTextChange('col30', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="โอนเงิน">โอนเงินธนาคาร</option>
                          <option value="เครดิต 30 วัน">เครดิต 30 วัน</option>
                          <option value="เครดิต 15 วัน">เครดิต 15 วัน</option>
                          <option value="เครดิต 60 วัน">เครดิต 60 วัน</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="เช็ค">เช็คสั่งจ่าย</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">31. ชำระให้ผู้จำหน่ายแล้ว</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col31 !== undefined ? form.col31 : ''}
                          onChange={(e) => handleFinancialChange('col31', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-right font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">35. ยอดชำระแล้วรวม</label>
                        <input
                          type="number"
                          step="any"
                          value={form.col35 !== undefined ? form.col35 : ''}
                          onChange={(e) => handleFinancialChange('col35', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-emerald-300 rounded-lg bg-emerald-50 text-right font-mono font-bold text-emerald-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-rose-800 mb-0.5">36. ยอดคงค้างชำระ (บาท)</label>
                        <input
                          type="number"
                          readOnly
                          value={form.col36 || 0}
                          className="w-full p-2 border border-rose-300 rounded-lg bg-rose-50 text-right font-mono font-bold text-rose-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Zone 7: Location & Remarks */}
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                      <span>[โซน 7] สถานที่ส่งมอบ & หมายเหตุ (คอลัมน์ 37 - 38)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          37. สถานที่ส่งมอบ / จุดเท / กม.
                        </label>
                        <input
                          type="text"
                          value={form.col37 || ''}
                          onChange={(e) => handleTextChange('col37', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="เช่น หน้างาน กม. 42+500 หรือ คลังสินค้า C"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">38. หมายเหตุ</label>
                        <input
                          type="text"
                          value={form.col38 || ''}
                          onChange={(e) => handleTextChange('col38', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                          placeholder="ระบุข้อความเพิ่มเติมหรือบันทึกหน้างาน"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Submit Action */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition cursor-pointer text-xs"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-md shadow-emerald-200 cursor-pointer active:scale-95 text-xs md:text-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกข้อมูลเอกสาร</span>
                </button>
              </div>

            </form>

          </div>

        </div>

      </div>
    </div>
  );
};
