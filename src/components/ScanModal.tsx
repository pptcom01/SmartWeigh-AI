import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Upload, 
  Camera,
  Loader2, 
  Scale, 
  Package, 
  Truck, 
  Receipt, 
  Layers, 
  Check, 
  AlertCircle,
  FileImage,
  FileText
} from 'lucide-react';
import { OrderRecord, StoreMerchant, DocumentType } from '../types';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (data: Partial<OrderRecord>, imageBase64: string, storeSuggestion?: Partial<StoreMerchant>) => void;
}

type ScanDocType = 'auto' | DocumentType;

interface DocTypeOption {
  id: ScanDocType;
  title: string;
  icon: string;
  description: string;
  badge: string;
  color: string;
}

const DOC_TYPE_OPTIONS: DocTypeOption[] = [
  {
    id: 'purchase_order',
    title: 'ใบสั่งซื้อสินค้า (PO)',
    icon: '📝',
    description: 'เอกสาร PO ฝ่ายจัดซื้อ สกัดเลข PO, คู่ค้า, รายการสินค้าสั่งซื้อ, ปริมาณ, ราคา',
    badge: 'ฝ่ายจัดซื้อ / PO',
    color: 'border-indigo-500 bg-indigo-50/50 text-indigo-900'
  },
  {
    id: 'delivery_order',
    title: 'ใบส่งของ / ใบส่งสินค้า (DO)',
    icon: '📦',
    description: 'สินค้าทั่วไป (เหล็ก, ปูน, ท่อ, สี) คอนกรีตผสมเสร็จ และใบส่งของที่มีการชั่งน้ำหนักรถบรรทุกในตัว',
    badge: 'สินค้าทั่วไป / ชั่งน้ำหนัก / คอนกรีต',
    color: 'border-sky-500 bg-sky-50/50 text-sky-900'
  },
  {
    id: 'weighbridge',
    title: 'ตั๋วชั่งน้ำหนักต้นทาง (Origin Scale)',
    icon: '⚖️',
    description: 'สินค้าเทกองชั่งน้ำหนัก (หิน, ดิน, ทราย) เน้นอ่าน Gross หนัก, Tare เบา, Net สุทธิ (กก.) แปลงเป็นตัน',
    badge: 'หิน / ดิน / ทราย',
    color: 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
  },
  {
    id: 'dest_weighbridge',
    title: 'ตั๋วชั่งปลายทาง (Destination Scale)',
    icon: '🏁',
    description: 'ตั๋วชั่งน้ำหนักรถบรรทุกที่หน้างานปลายทาง สกัดน้ำหนักเข้า-ออก เพื่อนำไปชนบิลลง [โซน 4] ของ DO/ตั๋วต้นทาง',
    badge: 'ชั่งปลายทาง / โซน 4',
    color: 'border-teal-500 bg-teal-50/50 text-teal-900'
  },
  {
    id: 'tax_invoice',
    title: 'ใบเสร็จรับเงิน / ใบกำกับภาษี',
    icon: '🧾',
    description: 'บิลสินค้า/บริการ เน้นเลขใบกำกับ, เลขผู้เสียภาษี 13 หลัก, ยอดรวม VAT',
    badge: 'บิลการเงิน / ภาษี',
    color: 'border-amber-500 bg-amber-50/50 text-amber-900'
  },
  {
    id: 'auto',
    title: 'ตรวจจับอัตโนมัติ (Auto-Detect)',
    icon: '🤖',
    description: 'ให้ Gemini AI ตรวจสอบและระบุประเภทเอกสารให้อัตโนมัติจากภาพ',
    badge: 'ตรวจจับอัตโนมัติ',
    color: 'border-purple-500 bg-purple-50/50 text-purple-900'
  }
];

// Helper to scale down oversized mobile photos to keep payloads light and crisp
const optimizeImageForAI = (file: File, maxDim = 1800, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawData = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(rawData);
        }
      };
      img.onerror = () => resolve(rawData);
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  });
};

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onScanComplete
}) => {
  const [selectedDocType, setSelectedDocType] = useState<ScanDocType>('delivery_order');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('กำลังประมวลผล...');
  const [progressPercent, setProgressPercent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('กรุณาเลือกไฟล์รูปภาพ เช่น JPG, PNG, WEBP');
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    try {
      const optimizedBase64 = await optimizeImageForAI(file);
      setPreviewImage(optimizedBase64);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPreviewImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleTriggerAIScan = async () => {
    if (!previewImage) {
      setErrorMsg('กรุณาเลือกไฟล์ภาพบิลก่อนเริ่มสแกน');
      return;
    }

    setIsScanning(true);
    setErrorMsg(null);
    setProgressPercent(20);

    const currentDoc = DOC_TYPE_OPTIONS.find(d => d.id === selectedDocType);
    const docLabel = currentDoc ? currentDoc.title : 'เอกสาร';
    setScanStatusText(`กำลังเชื่อมต่อ Gemini 3.8 Flash Vision (โหมด: ${docLabel})...`);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 32000);

    try {
      setTimeout(() => {
        setProgressPercent(60);
        setScanStatusText(`Gemini AI กำลังอ่านและสกัดข้อมูลตามรูปแบบ ${docLabel}...`);
      }, 500);

      const resp = await fetch('/api/scan-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          imageBase64: previewImage,
          mimeType: selectedFile?.type || 'image/png',
          targetDocType: selectedDocType
        })
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${resp.status}`);
      }

      const result = await resp.json();

      setProgressPercent(100);
      setScanStatusText('สกัดข้อมูลสำเร็จ! กำลังเปิดหน้าต่างตรวจสอบความถูกต้อง...');

      setTimeout(() => {
        setIsScanning(false);
        setPreviewImage(null);
        setSelectedFile(null);
        onClose();

        // Enforce user's explicit selection over AI guess
        const enforcedDocType = (selectedDocType && selectedDocType !== 'auto')
          ? selectedDocType
          : (result.data?.docType || 'delivery_order');

        const payloadData = {
          ...(result.data || {}),
          docType: enforcedDocType
        };

        onScanComplete(payloadData, previewImage, result.storeSuggestion);
      }, 400);

    } catch (err: any) {
      console.error('Scan error:', err);
      setIsScanning(false);
      if (err.name === 'AbortError') {
        setErrorMsg('การสแกนใช้เวลานานเกินกำหนด (Timeout) เซิร์ฟเวอร์ AI อาจมีการตอบสนองช้าชั่วคราว กรุณากดลองใหม่อีกครั้ง');
      } else {
        setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อสแกนบิล โปรดลองใหม่อีกครั้ง');
      }
    }
  };

  const handleResetFile = () => {
    setSelectedFile(null);
    setPreviewImage(null);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative my-8 animate-fadeIn">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isScanning}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl shadow-md shadow-blue-200">
            <Sparkles className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>สแกนบิลและตั๋วชั่งด้วย Gemini AI Vision</span>
              <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Targeted AI
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              เลือกประเภทเอกสารล่วงหน้าเพื่อเพิ่มความแม่นยำ หรือให้อ่านอัตโนมัติ
            </p>
          </div>
        </div>

        {/* STEP 1: DOCUMENT TYPE SELECTOR */}
        {!isScanning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                <span>เลือกประเภทเอกสาร / บิล (เพื่อความแม่นยำสูงสุด):</span>
              </label>
              <span className="text-[11px] text-slate-400">
                เลือกแบบเฉพาะเจาะจงเพื่อโฟกัสฟิลด์ที่ถูกต้อง
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DOC_TYPE_OPTIONS.map((opt) => {
                const isSelected = selectedDocType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedDocType(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `${opt.color} ring-2 ring-blue-500 shadow-2xs`
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base">{opt.icon}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          isSelected ? 'bg-white/80' : 'bg-slate-200/80 text-slate-600'
                        }`}>
                          {opt.badge}
                        </span>
                      </div>
                      <div className="font-bold text-xs leading-tight">{opt.title}</div>
                      <div className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-snug">
                        {opt.description}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-blue-600">
                        <Check className="w-3 h-3" />
                        <span>เลือกแล้ว</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: UPLOAD DROP ZONE & PREVIEW */}
        {!isScanning ? (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                <span>ถ่ายภาพหรืออัปโหลดเอกสาร:</span>
              </label>
              <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                โหมด: {DOC_TYPE_OPTIONS.find(o => o.id === selectedDocType)?.title || 'ตรวจจับอัตโนมัติ'}
              </span>
            </div>

            {/* Quick Action Buttons: Camera vs File Picker */}
            {!previewImage && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('camera-upload-input')?.click()}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-blue-200" />
                  <span>📷 ถ่ายภาพด้วยกล้อง</span>
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>📁 เลือกไฟล์รูปภาพ</span>
                </button>
              </div>
            )}

            {!previewImage ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload-input')?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-blue-300 bg-blue-50/20 hover:bg-blue-50/50 hover:border-blue-400'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    หรือลากรูปภาพเอกสารมาวางที่นี่
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    รองรับไฟล์ภาพ JPG, PNG, WEBP (ความละเอียดชัดเจน ตัวหนังสือไม่เบลอ)
                  </div>
                </div>
                {/* Standard file picker */}
                <input
                  type="file"
                  id="file-upload-input"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                {/* Mobile camera capture */}
                <input
                  type="file"
                  id="camera-upload-input"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
              </div>
            ) : (
              /* Selected Image Preview Box */
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-xs">
                      {selectedFile?.name || 'ภาพเอกสาร'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    เปลี่ยนรูปภาพ
                  </button>
                </div>

                <div className="max-h-48 rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="max-h-48 object-contain"
                  />
                </div>

                {/* Primary Scan Trigger Button */}
                <button
                  type="button"
                  onClick={handleTriggerAIScan}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    เริ่มสแกนด้วย AI (โหมด: {DOC_TYPE_OPTIONS.find(d => d.id === selectedDocType)?.title})
                  </span>
                </button>
              </div>
            )}

            {/* Error Message with Retry */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
                {previewImage && (
                  <button
                    type="button"
                    onClick={handleTriggerAIScan}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>🔄 ลองใหม่อีกครั้ง</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Scanning In-Progress Visualizer */
          <div className="space-y-3 py-4">
            <div className="relative max-h-60 rounded-xl overflow-hidden border border-slate-300 bg-slate-950 flex items-center justify-center">
              {previewImage && (
                <img
                  src={previewImage}
                  alt="เอกสารกำลังสแกน"
                  className="max-h-60 object-contain opacity-80"
                />
              )}
              {/* Laser Scanning Line Animation */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6] animate-scan-line"></div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-blue-900 font-semibold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>{scanStatusText}</span>
                </span>
                <span className="font-mono text-blue-700">{progressPercent}%</span>
              </div>
              <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
