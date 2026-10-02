import React, { useState, useRef, useEffect } from 'react';
import {
  SystemSettings,
  SystemBackupPayload,
  OrderRecord,
  PurchaseOrder,
  StoreMerchant,
  ProjectRecord,
  LineBillInboxItem,
  AppUser,
  UserRole,
  RolePermissions
} from '../types';
import {
  DEFAULT_SYSTEM_SETTINGS,
  DEFAULT_COMPANY_LOGO_URL,
  STORAGE_QUICK_SNAPSHOT_KEY,
  createSystemBackupPayload,
  downloadBackupJson
} from '../utils/systemConfig';
import { safeSaveToLocalStorage } from '../utils/storageEngine';
import {
  Settings,
  DatabaseBackup,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Building2,
  BellRing,
  Tags,
  FileSignature,
  Plus,
  X,
  RotateCcw,
  Save,
  History,
  RefreshCw,
  Image as ImageIcon,
  Mail,
  FileText,
  ShieldCheck,
  GitBranch,
  Layers
} from 'lucide-react';

interface SystemSettingsViewProps {
  systemSettings: SystemSettings;
  orders: OrderRecord[];
  pos: PurchaseOrder[];
  stores: StoreMerchant[];
  projects: ProjectRecord[];
  lineInbox: LineBillInboxItem[];
  users: AppUser[];
  currentUser: AppUser;
  rolePermissions: Record<UserRole, RolePermissions>;
  onUpdateSettings: (next: SystemSettings) => void;
  onRestoreBackup: (payload: SystemBackupPayload, mode: 'merge' | 'overwrite') => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  systemSettings,
  orders,
  pos,
  stores,
  projects,
  lineInbox,
  users,
  currentUser,
  rolePermissions,
  onUpdateSettings,
  onRestoreBackup,
  showToast
}) => {
  const [subTab, setSubTab] = useState<'settings' | 'backup' | 'handover'>('settings');
  const [form, setForm] = useState<SystemSettings>(systemSettings);
  const [newCategory, setNewCategory] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(systemSettings);
  }, [systemSettings]);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = String(ev.target?.result || '');
      if (dataUrl) {
        const updated = { ...form, companyLogoUrl: dataUrl };
        setForm(updated);
        onUpdateSettings(updated);
        showToast('อัปโหลดและบันทึกโลโก้บริษัทเรียบร้อยแล้ว');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Backup & Restore state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewPayload, setPreviewPayload] = useState<SystemBackupPayload | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [parseError, setParseError] = useState<string | null>(null);

  // Quick local snapshot state
  const [localSnapshotMeta, setLocalSnapshotMeta] = useState<{
    exportedAt: string;
    exportedBy: string;
    counts: SystemBackupPayload['counts'];
  } | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_QUICK_SNAPSHOT_KEY);
      if (!raw) return null;
      const parsed: SystemBackupPayload = JSON.parse(raw);
      return {
        exportedAt: parsed.exportedAt,
        exportedBy: parsed.exportedBy,
        counts: parsed.counts
      };
    } catch {
      return null;
    }
  });

  const handleSaveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(form);
    showToast('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
  };

  const handleAddCategory = () => {
    const clean = newCategory.trim();
    if (!clean) return;
    if (!form.customCategories.includes(clean)) {
      const updated = { ...form, customCategories: [...form.customCategories, clean] };
      setForm(updated);
      onUpdateSettings(updated);
    }
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    const updated = {
      ...form,
      customCategories: form.customCategories.filter(c => c !== cat)
    };
    setForm(updated);
    onUpdateSettings(updated);
  };

  const handleAddUnit = () => {
    const clean = newUnit.trim();
    if (!clean) return;
    if (!form.customUnits.includes(clean)) {
      const updated = { ...form, customUnits: [...form.customUnits, clean] };
      setForm(updated);
      onUpdateSettings(updated);
    }
    setNewUnit('');
  };

  const handleRemoveUnit = (unit: string) => {
    const updated = {
      ...form,
      customUnits: form.customUnits.filter(u => u !== unit)
    };
    setForm(updated);
    onUpdateSettings(updated);
  };

  const handleResetDefaultSettings = () => {
    const next = {
      ...DEFAULT_SYSTEM_SETTINGS,
      lastBackupAt: systemSettings.lastBackupAt
    };
    setForm(next);
    onUpdateSettings(next);
    showToast('คืนค่าการตั้งค่าระบบเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
  };

  // Export JSON Backup
  const handleDownloadFullBackup = () => {
    const payload = createSystemBackupPayload({
      orders,
      pos,
      stores,
      projects,
      lineInbox,
      users,
      rolePermissions,
      systemSettings: form,
      exportedBy: currentUser.fullName
    });
    downloadBackupJson(payload);
    const updatedSettings = { ...form, lastBackupAt: payload.exportedAt };
    setForm(updatedSettings);
    onUpdateSettings(updatedSettings);
    showToast('ดาวน์โหลดไฟล์สำรองข้อมูล (.json) เรียบร้อยแล้ว');
  };

  // Save Quick Local Snapshot
  const handleCreateQuickSnapshot = () => {
    const payload = createSystemBackupPayload({
      orders,
      pos,
      stores,
      projects,
      lineInbox,
      users,
      rolePermissions,
      systemSettings: form,
      exportedBy: currentUser.fullName
    });
    safeSaveToLocalStorage(STORAGE_QUICK_SNAPSHOT_KEY, payload);
    setLocalSnapshotMeta({
      exportedAt: payload.exportedAt,
      exportedBy: payload.exportedBy,
      counts: payload.counts
    });
    showToast('บันทึกจุดย้อนกลับด่วน (Quick Snapshot) ไว้ในเบราว์เซอร์แล้ว');
  };

  const handleRestoreFromQuickSnapshot = () => {
    try {
      const raw = localStorage.getItem(STORAGE_QUICK_SNAPSHOT_KEY);
      if (!raw) return;
      const parsed: SystemBackupPayload = JSON.parse(raw);
      if (parsed?.data) {
        onRestoreBackup(parsed, 'overwrite');
        setForm(parsed.data.systemSettings || form);
      }
    } catch {
      showToast('ไม่สามารถอ่านข้อมูลจุดย้อนกลับด่วนได้', 'info');
    }
  };

  // Handle File Upload for Restore Preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setPreviewPayload(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = String(event.target?.result || '');
        const parsed = JSON.parse(text) as SystemBackupPayload;
        if (!parsed || !parsed.data || !Array.isArray(parsed.data.orders)) {
          setParseError('รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ .json ที่ส่งออกจากระบบ AutoStore เท่านั้น');
          return;
        }
        setPreviewPayload(parsed);
      } catch {
        setParseError('ไม่สามารถอ่านไฟล์ JSON ได้ กรุณาตรวจสอบไฟล์สำรองข้อมูลอีกครั้ง');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!previewPayload) return;
    onRestoreBackup(previewPayload, restoreMode);
    if (previewPayload.data.systemSettings) {
      setForm(previewPayload.data.systemSettings);
    }
    setPreviewPayload(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Sub-Navigation Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Settings className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              ตั้งค่าระบบ & สำรอง/กู้คืนข้อมูล (System Settings & Backup Recovery)
            </h2>
            <p className="text-xs text-slate-500">
              ปรับแต่งข้อมูลบริษัท เกณฑ์แจ้งเตือน หมวดหมู่วัสดุ/หน่วยนับโดยไม่ต้องแก้โค้ด และสำรอง/กู้คืนฐานข้อมูลครบวงจร
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('settings')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 text-blue-600" />
            <span>1. ตั้งค่าข้อมูลพื้นฐานของระบบ</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('backup')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'backup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DatabaseBackup className="w-4 h-4 text-emerald-600" />
            <span>2. สำรอง & กู้คืนข้อมูล (Backup & Recovery)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('handover')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'handover'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>3. เอกสารส่งต่องาน & สถาปัตยกรรมระบบ</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: SYSTEM SETTINGS */}
      {subTab === 'settings' && (
        <form onSubmit={handleSaveSettingsForm} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Section 1: Company Profile & Report Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    1. ข้อมูลบริษัท & หัวกระดาษรายงาน (Company Profile)
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  แสดงบนรายงาน PDF / PO / Excel
                </span>
              </div>

              {/* Live Letterhead Preview Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-start gap-3.5">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                  {form.companyLogoUrl ? (
                    <img
                      src={form.companyLogoUrl}
                      alt={form.companyName}
                      className="w-full h-full object-contain"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_COMPANY_LOGO_URL;
                      }}
                    />
                  ) : (
                    <Building2 className="w-7 h-7 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    ตัวอย่างหัวกระดาษรายงาน (Live Header Preview)
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate">
                    {form.companyName || 'บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด'}
                  </div>
                  <div className="text-[11px] text-slate-600 leading-snug">
                    ที่อยู่ {form.companyAddress || '-'}
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>เลขประจำตัวผู้เสียภาษี {form.companyTaxId || '-'}</span>
                    <span>• โทร.{form.companyPhone || '-'}</span>
                    {form.companyEmail && <span>• E-Mail.{form.companyEmail}</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อบริษัท / ชื่อกิจการ</label>
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={e => setForm({ ...form, companyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">คำโปรย / สาขา / ชื่อระบบ</label>
                  <input
                    type="text"
                    value={form.companySubtitle}
                    onChange={e => setForm({ ...form, companySubtitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ที่อยู่บริษัท (แสดงบนหัวรายงาน)</label>
                  <input
                    type="text"
                    value={form.companyAddress}
                    onChange={e => setForm({ ...form, companyAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
                    <input
                      type="text"
                      value={form.companyTaxId}
                      onChange={e => setForm({ ...form, companyTaxId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">เบอร์โทรศัพท์สำนักงาน</label>
                    <input
                      type="text"
                      value={form.companyPhone}
                      onChange={e => setForm({ ...form, companyPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-blue-600" /> อีเมล (E-Mail)
                    </label>
                    <input
                      type="email"
                      value={form.companyEmail || ''}
                      onChange={e => setForm({ ...form, companyEmail: e.target.value })}
                      placeholder="brtc2024@gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>

                {/* Company Logo URL & File Upload */}
                <div className="pt-1 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" /> ลิงก์โลโก้บริษัท (Logo URL หรืออัปโหลดไฟล์รูป)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" /> อัปโหลดรูปจากเครื่อง
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...form, companyLogoUrl: DEFAULT_COMPANY_LOGO_URL };
                          setForm(updated);
                          onUpdateSettings(updated);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold cursor-pointer"
                        title="ใช้ลิงก์โลโก้เริ่มต้น"
                      >
                        ค่าเริ่มต้น
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={form.companyLogoUrl || ''}
                    onChange={e => setForm({ ...form, companyLogoUrl: e.target.value })}
                    placeholder="https://img2.pic.in.th/pic/Screenshot-2025-03-03-132721e6cc77cbcea28f01.png"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-[11px] focus:border-blue-600 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Document Prefix, VAT & Alert Thresholds */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    2. รหัสเอกสาร & เกณฑ์การแจ้งเตือนอัตโนมัติ (Alert Thresholds)
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                  เชื่อมกระดิ่งแจ้งเตือน 🔔
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">คำนำหน้าเลข TR (ช่อง 1)</label>
                  <input
                    type="text"
                    value={form.trPrefix}
                    onChange={e => setForm({ ...form, trPrefix: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">คำนำหน้าเลข PO</label>
                  <input
                    type="text"
                    value={form.poPrefix}
                    onChange={e => setForm({ ...form, poPrefix: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ภาษีมูลค่าเพิ่ม VAT (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.defaultVatPercent}
                    onChange={e => setForm({ ...form, defaultVatPercent: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    เกณฑ์เตือนน้ำหนักต่างกันเกิน (กก.)
                  </label>
                  <input
                    type="number"
                    value={form.weightDiffAlertKg}
                    onChange={e => setForm({ ...form, weightDiffAlertKg: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    เกณฑ์เตือนน้ำหนักต่างกันเกิน (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.weightDiffAlertPercent}
                    onChange={e => setForm({ ...form, weightDiffAlertPercent: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    เกณฑ์เตือนโควตา PO ใกล้เต็ม (%)
                  </label>
                  <input
                    type="number"
                    value={form.poQuotaAlertPercent}
                    onChange={e => setForm({ ...form, poQuotaAlertPercent: Number(e.target.value) || 90 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    เตือนสำรองข้อมูลทุกๆ (วัน)
                  </label>
                  <input
                    type="number"
                    value={form.backupReminderDays}
                    onChange={e => setForm({ ...form, backupReminderDays: Number(e.target.value) || 7 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:border-blue-600 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.requireLoginOnStart)}
                    onChange={e => setForm({ ...form, requireLoginOnStart: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>เปิดหน้าต่างเลือกบัญชีเข้าสู่ระบบทุกครั้งที่เปิดหน้าเว็บใหม่</span>
                </label>
              </div>
            </div>

            {/* Section 3: Dynamic Categories & Units (No Code Changes Needed) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Tags className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    3. หมวดหมู่วัสดุ & หน่วยนับมาตรฐาน (ปรับเพิ่ม/ลบได้ไม่ต้องแก้โค้ด)
                  </h3>
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2 text-xs">
                <label className="block font-bold text-slate-700">
                  หมวดหมู่วัสดุมาตรฐาน ({form.customCategories.length} หมวด)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    placeholder="พิมพ์ชื่อหมวดหมู่ใหม่ เช่น เคมีภัณฑ์ก่อสร้าง..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 focus:border-emerald-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มหมวด
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.customCategories.map(cat => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-semibold"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="ลบหมวดหมู่นี้"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Units */}
              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700">
                  หน่วยนับมาตรฐาน ({form.customUnits.length} หน่วย)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUnit();
                      }
                    }}
                    placeholder="พิมพ์หน่วยนับใหม่ เช่น ถัง, แกลลอน, ลิตร..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 focus:border-emerald-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddUnit}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มหน่วย
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.customUnits.map(u => (
                    <span
                      key={u}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                    >
                      <span>{u}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUnit(u)}
                        className="text-emerald-500 hover:text-rose-600 cursor-pointer"
                        title="ลบหน่วยนับนี้"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 4: PDF Report Signatories */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      4. ตำแหน่งช่องลงลายมือชื่อท้ายรายงาน PDF (Report Signatories)
                    </h3>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ช่องลงนามที่ 1 (ผู้จัดทำรายงาน)</label>
                    <input
                      type="text"
                      value={form.reportSignatoryPreparedBy}
                      onChange={e => setForm({ ...form, reportSignatoryPreparedBy: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-purple-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ช่องลงนามที่ 2 (ผู้ตรวจสอบ)</label>
                    <input
                      type="text"
                      value={form.reportSignatoryCheckedBy}
                      onChange={e => setForm({ ...form, reportSignatoryCheckedBy: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-purple-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ช่องลงนามที่ 3 (ผู้อนุมัติ)</label>
                    <input
                      type="text"
                      value={form.reportSignatoryApprovedBy}
                      onChange={e => setForm({ ...form, reportSignatoryApprovedBy: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-purple-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaultSettings}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>คืนค่าเริ่มต้น</span>
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกการตั้งค่าระบบทั้งหมด</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: BACKUP & RECOVERY CENTER */}
      {subTab === 'backup' && (
        <div className="space-y-4">
          {/* Current System Data Status Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">บิลทั้งหมด (DO/ชั่ง/ภาษี)</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-1">{orders.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">ใบสั่งซื้อ (PO)</div>
              <div className="text-xl font-bold text-indigo-700 font-mono mt-1">{pos.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">ทะเบียนร้านค้า</div>
              <div className="text-xl font-bold text-blue-700 font-mono mt-1">{stores.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">ทะเบียนโครงการ</div>
              <div className="text-xl font-bold text-emerald-700 font-mono mt-1">{projects.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">กล่องพักบิล LINE</div>
              <div className="text-xl font-bold text-teal-700 font-mono mt-1">{lineInbox.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">สำรองไฟล์ล่าสุด</div>
              <div className="text-xs font-bold text-slate-800 mt-1.5 truncate">
                {systemSettings.lastBackupAt
                  ? new Date(systemSettings.lastBackupAt).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })
                  : 'ยังไม่เคยสำรองไฟล์'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Card 1: Export Full Backup File (.json) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  1. สำรองข้อมูลทั้งระบบลงไฟล์ (.JSON)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ดาวน์โหลดข้อมูลทั้งหมดในระบบ (บิล 39 คอลัมน์, ใบสั่งซื้อ PO, ร้านค้า, โครงการ, กล่องพัก LINE, ผู้ใช้งาน และการตั้งค่าระบบ) ออกมาเป็นไฟล์เดียวเก็บไว้ในคอมพิวเตอร์หรือ Cloud Drive
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadFullBackup}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.json)</span>
              </button>
            </div>

            {/* Card 2: Quick Browser Snapshot */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  2. จุดย้อนกลับด่วนในเครื่อง (Quick Local Snapshot)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  สร้างจุดพักข้อมูลด่วนในเบราว์เซอร์ก่อนทดสอบลบหรือแก้ไขข้อมูลชุดใหญ่ สามารถกดย้อนกลับ (Undo Restore) ได้ในคลิกเดียว
                </p>
                {localSnapshotMeta ? (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 space-y-0.5">
                    <div className="font-bold">จุดย้อนกลับล่าสุดในเครื่อง:</div>
                    <div>
                      เมื่อ {new Date(localSnapshotMeta.exportedAt).toLocaleString('th-TH')} โดย {localSnapshotMeta.exportedBy}
                    </div>
                    <div>
                      (บิล {localSnapshotMeta.counts.orders} ใบ • PO {localSnapshotMeta.counts.pos} ใบ • ร้านค้า {localSnapshotMeta.counts.stores} แห่ง)
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                    ยังไม่มีจุดย้อนกลับด่วนในเครื่อง
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateQuickSnapshot}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>สร้างจุดย้อนกลับ</span>
                </button>
                {localSnapshotMeta && (
                  <button
                    type="button"
                    onClick={handleRestoreFromQuickSnapshot}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ย้อนกลับทันที</span>
                  </button>
                )}
              </div>
            </div>

            {/* Card 3: Restore from Backup File */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  3. กู้คืนข้อมูลจากไฟล์สำรอง (Restore from .JSON)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  เลือกไฟล์สำรองข้อมูล `.json` เพื่อตรวจสอบพรีวิวจำนวนข้อมูล และเลือกได้ว่าจะ <strong>"ผสานข้อมูล (Merge)"</strong> หรือ <strong>"ทับข้อมูลทั้งหมด (Overwrite)"</strong>
                </p>
                {parseError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                    {parseError}
                  </div>
                )}
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>เลือกไฟล์สำรองข้อมูล (.json) เพื่อพรีวิว</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pre-Restore Verification & Mode Selector Panel */}
          {previewPayload && (
            <div className="bg-amber-50/90 rounded-2xl border-2 border-amber-400 p-5 shadow-md space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      พรีวิวข้อมูลในไฟล์สำรองก่อนยืนยันการกู้คืน (Pre-Restore Verification)
                    </h4>
                    <p className="text-xs text-slate-600">
                      สำรองเมื่อ: <strong>{new Date(previewPayload.exportedAt).toLocaleString('th-TH')}</strong> • โดย: <strong>{previewPayload.exportedBy}</strong> • บริษัท: <strong>{previewPayload.companyName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPayload(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  ✕ ยกเลิก
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <div className="text-slate-500 text-[11px]">บิลในไฟล์สำรอง</div>
                  <div className="text-base font-bold font-mono text-slate-900">{previewPayload.data.orders?.length || 0} ใบ</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <div className="text-slate-500 text-[11px]">ใบสั่งซื้อ (PO)</div>
                  <div className="text-base font-bold font-mono text-indigo-700">{previewPayload.data.pos?.length || 0} ใบ</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <div className="text-slate-500 text-[11px]">ร้านค้า</div>
                  <div className="text-base font-bold font-mono text-blue-700">{previewPayload.data.stores?.length || 0} แห่ง</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <div className="text-slate-500 text-[11px]">โครงการ</div>
                  <div className="text-base font-bold font-mono text-emerald-700">{previewPayload.data.projects?.length || 0} โครงการ</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <div className="text-slate-500 text-[11px]">กล่องพัก LINE</div>
                  <div className="text-base font-bold font-mono text-teal-700">{previewPayload.data.lineInbox?.length || 0} ใบ</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-200">
                  <div className="text-slate-500 text-[11px]">บัญชีผู้ใช้</div>
                  <div className="text-base font-bold font-mono text-slate-900">{previewPayload.data.users?.length || 0} คน</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setRestoreMode('merge')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    restoreMode === 'merge'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-800 border-slate-300'
                  }`}
                >
                  <div className="font-bold">🔄 โหมดที่ 1: ผสานข้อมูล (Merge Mode — แนะนำ)</div>
                  <div className={`text-[11px] mt-0.5 ${restoreMode === 'merge' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    นำเฉพาะบิล, PO, ร้านค้า และโครงการที่ยังไม่มีในเครื่องเข้ามาเติม โดยไม่ลบบิลใหม่ที่เพิ่งคีย์ไว้
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreMode('overwrite')}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                    restoreMode === 'overwrite'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                      : 'bg-white text-slate-800 border-slate-300'
                  }`}
                >
                  <div className="font-bold">⚠️ โหมดที่ 2: ทับข้อมูลทั้งหมด (Overwrite 100%)</div>
                  <div className={`text-[11px] mt-0.5 ${restoreMode === 'overwrite' ? 'text-rose-100' : 'text-slate-500'}`}>
                    ล้างข้อมูลปัจจุบันทั้งหมด แล้วแทนที่ด้วยข้อมูลจากไฟล์สำรองนี้ 100%
                  </div>
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPayload(null)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>ยืนยันการกู้คืนข้อมูล ({restoreMode === 'merge' ? 'ผสานข้อมูล' : 'ทับข้อมูลทั้งหมด'})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: SYSTEM HANDOVER & ARCHITECTURE DOCUMENTATION */}
      {subTab === 'handover' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                  System Handover & Architecture Spec
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                  ไฟล์ในโปรเจกต์: /HANDOVER_DOCUMENTATION.md
                </span>
              </div>
              <h3 className="text-base font-bold text-white">
                เอกสารส่งต่องาน โครงสร้างระบบ 39 คอลัมน์ และแผนพัฒนาต่อยอด
              </h3>
              <p className="text-xs text-slate-300">
                สรุปสถานะโมดูลทั้ง 10 เมนู กฎเหล็กทางสถาปัตยกรรมที่ห้ามแก้ไขให้ผิดเพี้ยน และลำดับงานพัฒนาต่อยอด
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>พิมพ์ / บันทึก PDF เอกสารส่งต่องาน</span>
            </button>
          </div>

          {/* 1. Module Status Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Layers className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">
                1. สถานะระบบปัจจุบันครบทั้ง 10 เมนู (Current Module Status)
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-bold">#</th>
                    <th className="py-2.5 px-3 font-bold">เมนูในระบบ</th>
                    <th className="py-2.5 px-3 font-bold">ไฟล์หลัก</th>
                    <th className="py-2.5 px-3 font-bold">สถานะ</th>
                    <th className="py-2.5 px-3 font-bold">ขอบเขตการทำงานที่สร้างเสร็จแล้ว</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">01</td>
                    <td className="py-2 px-3 font-bold text-slate-900">กล่องพักบิลจาก LINE</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">LineInboxView.tsx / server.ts</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">รับรูปบิลจากกลุ่ม LINE OA ผ่าน Webhook (/api/line/webhook), AI สแกนแยกประเภทอัตโนมัติ, ดักบิลซ้ำ, ตอบกลับด้วย Quote Reply (0 โควตา), แยกชื่อกลุ่ม LINE ออกจากชื่อโครงการ</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">02</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ใบส่งของ / ใบส่งสินค้า (DO)</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">TableView39Cols.tsx / StatSummaryCards.tsx</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">ตารางหลัก 39 คอลัมน์ (7 โซน), แบ่ง 3 มุมมอง (ทั้งหมด, DO สินค้าทั่วไป, DO สินค้าชั่งน้ำหนัก), การ์ดสรุป KPI 6 ใบแบบสมดุล</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">03</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ใบสั่งซื้อ (PO)</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">POManagementView.tsx / PODetailModal.tsx</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">เปิด PO / สแกน PO ด้วย AI, ระบบชนบิล 3-Way Matching (reconcilePO) ตัดโควตาส่งมอบสะสมอัตโนมัติ พร้อมพิมพ์ใบสั่งซื้อหัวกระดาษบริษัท</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">04</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ตั๋วชั่งปลายทาง</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">TableView39Cols.tsx / App.tsx</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">แยกเก็บตั๋วชั่งน้ำหนักหน้างานปลายทาง (ช่อง 16–20) ชนบิลคู่กับ DO ต้นทาง และคำนวณผลต่างน้ำหนัก (ช่อง 21) อัตโนมัติโดยไม่นับยอดเงินซ้ำ</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">05</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ใบเสร็จ/กำกับภาษี</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">TableView39Cols.tsx / App.tsx</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">แยกเก็บบิลการเงิน/ใบกำกับภาษี (โซน 5–6) ชนบิลเข้ากับ DO หรือบันทึกซื้อสดหน้าร้านโดยไม่นับยอดซื้อซ้ำซ้อน</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">06</td>
                    <td className="py-2 px-3 font-bold text-slate-900">วิเคราะห์ & การเงิน</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">AnalyticsView.tsx</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">แดชบอร์ดวิเคราะห์ยอดซื้อ ชำระแล้ว หนี้คงค้าง แยกตามร้านค้า โครงการ หมวดหมู่วัสดุ และตรวจสอบผลต่างน้ำหนัก</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">07</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ออกรายงาน Excel / PDF</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">ReportsExportView.tsx / excelExport.ts</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">ออกรายงาน A4 5 แม่แบบ พร้อมหัวกระดาษและโลโก้ บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด ช่องลงนาม 3 ฝ่าย และส่งออก Excel หลายชีต</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">08</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ทะเบียนร้านค้า</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">StoresManagementView.tsx</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">ฐานข้อมูลร้านค้า/ผู้จำหน่าย คำนวณยอดซื้อสะสม ชำระแล้ว และหนี้คงค้างแบบ Real-time จากตารางบิลจริง (syncStoreFinancials)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">09</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ทะเบียนโครงการ</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">App.tsx (Projects View)</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">บริหารโครงการก่อสร้าง ติดตามงบประมาณ ยอดเปิด PO ยอดรับของจริง และกดกรองดูบิลรายโครงการได้ทันที</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold">10</td>
                    <td className="py-2 px-3 font-bold text-slate-900">ผู้ใช้งาน & สิทธิ์ / ตั้งค่าระบบ</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">UsersRolesView.tsx / SystemSettingsView.tsx</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">พร้อมใช้งาน</span></td>
                    <td className="py-2 px-3">ระบบสิทธิ์ 3 ระดับ (Admin, Manager, User), บัญชีมาสเตอร์ฝังถาวร (Admin / 123456), ตั้งค่าบริษัท และสำรอง/กู้คืนไฟล์ .json</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Strict System Invariants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  2. กฎเหล็กทางสถาปัตยกรรม (ห้ามแก้ไขให้ผิดเพี้ยน)
                </h4>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                <li className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <strong className="text-slate-900">1. โครงสร้างตาราง 39 คอลัมน์ (7 โซน):</strong> ใช้คีย์ <code className="font-mono text-indigo-700">col1</code> ถึง <code className="font-mono text-indigo-700">col38</code> (+ คอลัมน์จัดการเป็น 39) ห้ามเปลี่ยนความหมายประจำคอลัมน์เด็ดขาด
                </li>
                <li className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <strong className="text-slate-900">2. ป้องกันการนับยอดซ้ำ (Anti-Double Counting):</strong> ตั๋วชั่งปลายทาง (<code className="font-mono text-indigo-700">dest_weighbridge</code>) และใบกำกับภาษีที่ผูกกับ DO แล้ว (<code className="font-mono text-indigo-700">linkedViaDocNo</code>) ห้ามนำมานับรวมเป็นจำนวนบิลส่งของหรือบวกยอดเงินซ้ำกับใบ DO
                </li>
                <li className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <strong className="text-slate-900">3. มาตรฐาน AI เดียวกันทั้งระบบ:</strong> ทั้ง <code className="font-mono text-indigo-700">/api/scan-bill</code> และ <code className="font-mono text-indigo-700">/api/line/webhook</code> ใช้โมเดลตระกูล <code className="font-mono text-indigo-700">FLASH_LITE_MODELS</code> พร้อมกฎสกัดเลขที่บิล <code className="font-mono text-indigo-700">เล่มที่/เลขที่</code> และกฎสลับน้ำหนัก <code className="font-mono text-indigo-700">Gross &gt;= Tare</code> ชุดเดียวกัน
                </li>
                <li className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <strong className="text-slate-900">4. แยกชื่อกลุ่ม LINE ออกจากชื่อโครงการ:</strong> ชื่อกลุ่ม LINE เก็บใน <code className="font-mono text-indigo-700">lineGroupName</code> เท่านั้น ห้ามนำไปใส่ใน <code className="font-mono text-indigo-700">col2</code> (ชื่อโครงการ) อัตโนมัติ เพื่อให้ผู้ตรวจรับเลือกโครงการจริงเอง
                </li>
                <li className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <strong className="text-slate-900">5. ระบบล้างลิงก์อัตโนมัติ (Cascade Unlink):</strong> เมื่อลบตั๋วชั่งปลายทาง ลบ DO หรือลบ PO ระบบใน <code className="font-mono text-indigo-700">App.tsx</code> จะล้างค่าการผูกบิลที่เกี่ยวข้องให้อัตโนมัติ
                </li>
              </ul>
            </div>

            {/* 3. Next Steps & Roadmap */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <GitBranch className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  3. แผนงานพัฒนาต่อยอดในระยะถัดไป (Next Steps Roadmap)
                </h4>
              </div>
              <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80">
                  <div className="font-bold text-indigo-950">ระยะที่ 1: เชื่อมต่อ Supabase Cloud (PostgreSQL + Realtime)</div>
                  <p className="text-slate-600 mt-0.5">
                    จัดเก็บข้อมูลธุรกรรมตาราง 39 คอลัมน์, PO, ร้านค้า, โครงการ และกล่องพัก LINE แบบ Realtime พร้อมเก็บรหัสอ้างอิง <code className="font-mono">drive_file_id</code> / <code className="font-mono">drive_folder_id</code>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
                  <div className="font-bold text-blue-950">ระยะที่ 2: เชื่อมต่อ Google Drive (Auto-Folder & Zero-Junk Cleanup)</div>
                  <p className="text-slate-600 mt-0.5">
                    สร้างโฟลเดอร์แยกตามประเภทและเลขที่เอกสารอัตโนมัติ ย้ายไฟล์มารวมชุดเมื่อชนบิลสำเร็จ และลบไฟล์เก่า/ไฟล์ที่ถูกลบออกจาก Google Drive ทันที 100%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                  <div className="font-bold text-emerald-950">ระยะที่ 3: เชื่อมต่อ LINE Official Account จริงใน Production</div>
                  <p className="text-slate-600 mt-0.5">
                    นำ Webhook URL (<code className="font-mono">/api/line/webhook</code>) ไปผูกใน LINE Developers Console ตั้งค่า Channel Access Token / Secret และเชิญบอทเข้ากลุ่มหน้างานจริง
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
                  <div className="font-bold text-amber-950">ระยะที่ 4: ระบบใบสรุปวางบิลและใบสำคัญจ่าย (Payment Voucher)</div>
                  <p className="text-slate-600 mt-0.5">
                    ต่อยอดจากโซน 6 (ช่อง 30–36) ให้ติ๊กเลือกหลายบิลของร้านค้าเดียวกันเพื่อรวบยอดออกใบสำคัญจ่าย แนบสลิปโอนเงิน และตัดยอดหนี้คงค้างทั้งชุดในคลิกเดียว
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Database & Google Drive Zero-Junk Blueprint */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <DatabaseBackup className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  4. แผนงานสถาปัตยกรรมฐานข้อมูล: Supabase Cloud + Google Drive (Auto-Move & Zero-Junk Cleanup)
                </h4>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-bold">
                ไฟล์อ้างอิง SQL & Spec: /DATABASE_STORAGE_BLUEPRINT.md
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: 5-Zone Google Drive Folder Tree */}
              <div className="lg:col-span-5 bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[11px] space-y-1.5 leading-relaxed">
                <div className="text-sky-400 font-bold mb-2 font-sans text-xs">
                  โครงสร้าง 5 โซนโฟลเดอร์อัตโนมัติบน Google Drive (ยึดตามประเภท & เลขเอกสาร ไม่ผูกชื่อโครงการ):
                </div>
                <div className="text-amber-300 font-bold">📁 BRTC_ERP_Storage/</div>
                <div className="pl-3 text-slate-300">├── 📁 <span className="text-teal-300 font-bold">00_กล่องพักบิล_LINE_รอตรวจรับ/</span></div>
                <div className="pl-6 text-slate-400">└── 🖼️ LINE_msgId.jpg (ลบทิ้ง = ลบไฟล์ทันที)</div>
                <div className="pl-3 text-slate-300">├── 📁 <span className="text-indigo-300 font-bold">01_ใบสั่งซื้อ_PO/</span></div>
                <div className="pl-6 text-slate-400">└── 📁 PO-2026-001_หจก.ศิลาบุรีรัมย์/</div>
                <div className="pl-3 text-slate-300">├── 📁 <span className="text-emerald-300 font-bold">02_ใบงานหลัก_DO_ครบชุด/</span></div>
                <div className="pl-6 text-emerald-200 font-bold">└── 📁 TR-2026-0001_DO-02-0045/</div>
                <div className="pl-10 text-slate-300">├── 🖼️ 1_DO_02-0045.jpg (ใบส่งของ)</div>
                <div className="pl-10 text-sky-300">├── 🖼️ 2_WB_W-1024.jpg (ย้ายมารวมเมื่อชนบิล!)</div>
                <div className="pl-10 text-amber-200">└── 🖼️ 3_TAX_IV-889.jpg (ย้ายมารวมเมื่อชนบิล!)</div>
                <div className="pl-3 text-slate-300">├── 📁 <span className="text-sky-300 font-bold">03_ตั๋วชั่งปลายทาง_รอจับคู่DO/</span></div>
                <div className="pl-6 text-slate-400">└── (พักตั๋วชั่งที่ยังไม่มี DO มาชน)</div>
                <div className="pl-3 text-slate-300">└── 📁 <span className="text-amber-300 font-bold">04_ใบเสร็จกำกับภาษี_เอกเทศ/</span></div>
                <div className="pl-6 text-slate-400">└── (บิลซื้อสด / ใบกำกับภาษีที่ยังไม่ผูก DO)</div>
              </div>

              {/* Right: Auto-Move & Zero-Junk Rules */}
              <div className="lg:col-span-7 space-y-2.5 text-xs">
                <div className="font-bold text-slate-900">
                  กฎการทำงานอัตโนมัติ (คนไม่ต้องย้ายหรือลบไฟล์เอง):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">1. รับบิลจาก LINE & ตรวจรับบิล</div>
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      รูปจาก LINE พักในโฟลเดอร์ <code className="font-mono font-bold">00</code> ก่อน เมื่อกดยืนยันตรวจรับเป็น DO ระบบสร้างโฟลเดอร์ <code className="font-mono font-bold">TR-xxxx_DO-xxxx</code> ในโซน <code className="font-mono font-bold">02</code> แล้วย้ายไฟล์เข้าทันที
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">2. ย้ายมารวมชุดเมื่อจับคู่สำเร็จ (Auto-Move)</div>
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      ตั๋วชั่งในโซน <code className="font-mono font-bold">03</code> หรือใบกำกับภาษีในโซน <code className="font-mono font-bold">04</code> ทันทีที่จับคู่ชนกับใบ DO สำเร็จ ระบบย้ายไฟล์เข้ามารวมในโฟลเดอร์ใบงานของ DO นั้นทันที
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="font-bold text-slate-900">3. เปลี่ยนโครงการ / แก้เลขบิลไม่พัง</div>
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      เปลี่ยนโครงการใน Supabase กี่ครั้งก็ได้โดยไม่ต้องย้ายโฟลเดอร์ใน Drive และหากแก้เลขที่บิล ระบบสั่ง <code className="font-mono font-bold">Rename</code> โฟลเดอร์เดิมตาม <code className="font-mono">drive_folder_id</code>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                    <div className="font-bold text-rose-950">4. ล้างไฟล์ขยะอัตโนมัติ (Zero-Junk 100%)</div>
                    <p className="text-rose-900/80 mt-1 leading-relaxed">
                      เมื่ออัปโหลดรูปใหม่ทับรูปเดิม หรือกดลบใบงานออกจากระบบ ระบบสั่งลบไฟล์/โฟลเดอร์นั้นออกจาก Google Drive ทันที ไม่เหลือไฟล์ขยะตกค้าง
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
