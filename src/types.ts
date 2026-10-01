/**
 * Type definitions for the 39-Column Logistics, Store & Order Management System
 */

export type DocumentType = 
  | 'delivery_order'    // ใบส่งสินค้า / ใบส่งของทั่วไป (เหล็ก/ท่อ/ปูน/สี/อุปกรณ์/สินค้าไม่ชั่งน้ำหนัก)
  | 'weighbridge'       // ตั๋วชั่งน้ำหนัก (หิน/ดิน/ทราย/สินค้าชั่งน้ำหนัก)
  | 'concrete'          // ใบส่งคอนกรีตผสมเสร็จ
  | 'tax_invoice'       // ใบเสร็จรับเงิน / ใบกำกับภาษี
  | 'purchase_order'    // ใบสั่งซื้อสินค้า (PO)
  | 'full_logistics';   // โลจิสติกส์ 39 คอลัมน์เต็มรูปแบบ

export interface OrderItemDetail {
  id?: string;
  itemDescription: string;
  specCode?: string;
  qty: number;
  unit: string;
  unitPrice?: number;
  totalAmount?: number;
}

export interface OrderRecord {
  id: string;
  docType?: DocumentType;
  lineItems?: OrderItemDetail[];
  referenceDocNo?: string;     // เลขที่เอกสารอ้างอิง เช่น เลข DO ที่ตั๋วชั่งอ้างถึง หรือ เลข PO
  referenceSource?: 'form_field' | 'notes' | 'handwritten'; // แหล่งที่พบ: ในช่องฟอร์ม, ในช่องหมายเหตุ, หรือลายมือเขียน
  linkedViaDocNo?: string;     // ชนบิลผ่านเอกสารใด เช่น ชนเข้า PO ผ่านใบส่งของ DO-xxxxx
  // Zone 1: Document Reference & Project (1 - 6)
  col1: string;  // 1. เลข TR
  col2: string;  // 2. โครงการ
  col3: string;  // 3. หมวดหมู่
  col4: string;  // 4. PO
  col5: string;  // 5. RR
  col6: string;  // 6. DO / ตั๋ว

  // Zone 2: Date, Merchant & Goods (7 - 12)
  col7: string;  // 7. วันที่ (YYYY-MM-DD)
  col8: string;  // 8. ผู้จำหน่าย / ร้านค้า
  col9: string;  // 9. ผู้รับเหมา / ผู้ซื้อ
  col10: string; // 10. ทะเบียนรถ
  col11: string; // 11. รายการสินค้า
  col12: string; // 12. สเปก / Code

  // Zone 3: Origin Weights (13 - 15)
  col13: number; // 13. หนักต้นทาง (กก.)
  col14: number; // 14. เบาต้นทาง (กก.)
  col15: number; // 15. สุทธิต้นทาง (กก.)

  // Zone 4: Destination & Diff (16 - 21)
  col16: string; // 16. วันที่ปลายทาง
  col17: string; // 17. ตั๋วปลายทาง
  col18: number; // 18. หนักปลายทาง (กก.)
  col19: number; // 19. เบาปลายทาง (กก.)
  col20: number; // 20. สุทธิปลายทาง (กก.)
  col21: number; // 21. ผลต่าง (กก.)

  // Zone 5: Billing & Freight (22 - 29)
  col22: number; // 22. ปริมาณ
  col23: string; // 23. หน่วย
  col24: number; // 24. ราคา/หน่วย
  col25: number; // 25. รวมค่าสินค้า
  col26: string; // 26. ประเภทรถ
  col27: number; // 27. ค่าบรรทุก/หน่วย
  col28: number; // 28. รวมค่าขนส่ง
  col29: number; // 29. รวมทั้งสิ้น

  // Zone 6: Payment Tracking (30 - 36)
  col30: string; // 30. รูปแบบจ่าย
  col31: number; // 31. จ่ายผู้ขายแล้ว
  col32: number; // 32. ค้างผู้ขาย
  col33: number; // 33. จ่ายขนส่งแล้ว
  col34: number; // 34. ค้างขนส่ง
  col35: number; // 35. ชำระแล้วรวม
  col36: number; // 36. ยอดค้างรวม

  // Zone 7: Logistics Station & System (37 - 38)
  col37: string; // 37. สถานที่ส่ง / กม.
  col38: string; // 38. หมายเหตุ

  // Metadata
  image?: string | null;
  aiExtracted?: boolean;
  storeId?: string;
  createdAt?: string;
  status?: 'verified' | 'pending' | 'flagged';
}

export interface StoreMerchant {
  id: string;
  name: string;
  category: string;
  taxId?: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  bankAccount?: string;
  creditTerms?: string;
  rating?: number;
  totalOrders: number;
  totalPurchases: number;
  totalPaid: number;
  totalDebt: number;
  lastOrderDate?: string;
  primaryGoods: string[];
  notes?: string;
}

export type POStatus = 'pending' | 'partially_delivered' | 'completed' | 'cancelled';

export interface POItem {
  id: string;
  itemDescription: string;
  specCode?: string;
  orderedQty: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;               // เลขที่ PO เช่น PO-2026-001
  orderDate: string;              // วันที่สั่งซื้อ (YYYY-MM-DD)
  deliveryDueDate?: string;       // กำหนดส่งมอบ
  projectId: string;              // โครงการ
  storeId?: string;               // รหัสร้านค้า
  storeName: string;              // ชื่อผู้จำหน่าย / ร้านค้า
  category: string;               // หมวดหมู่วัสดุ
  items: POItem[];                // รายการสินค้าที่สั่ง
  totalQty: number;               // ปริมาณรวมที่สั่ง
  totalAmount: number;            // ยอดเงินรวมตาม PO
  status: POStatus;               // สถานะการส่งมอบ
  creditTerms?: string;           // เงื่อนไขชำระเงิน
  deliveryLocation?: string;      // สถานที่จัดส่ง
  orderedBy?: string;             // ผู้สั่งซื้อ
  approvedBy?: string;            // ผู้อนุมัติ
  notes?: string;                 // หมายเหตุ
  image?: string | null;          // ภาพเอกสารใบสั่งซื้อต้นฉบับ
  createdAt: string;
  updatedAt: string;
}

export interface ConvertedOrderUnitDetail {
  originalQty: number;
  originalUnit: string;
  convertedQty: number;
  targetUnit: string;
  note: string;
}

export interface MatchedDeliveryShipment {
  id: string;
  doOrder?: OrderRecord;
  weighbridgeOrder?: OrderRecord;
  effectiveQty: number;
  effectiveUnit: string;
  effectiveAmount: number;
  matchType: 'paired_do_wb' | 'do_only' | 'weighbridge_only';
  referenceSource?: 'form_field' | 'notes' | 'handwritten';
  referenceDocNo?: string;
  linkedViaDocNo?: string;
}

export interface POReconciliation {
  po: PurchaseOrder;
  linkedOrders: OrderRecord[];
  pairedShipments?: MatchedDeliveryShipment[];
  deliveredQty: number;
  deliveredAmount: number;
  remainingQty: number;
  remainingAmount: number;
  percentageDelivered: number;
  isOverDelivered: boolean;
  status: POStatus;
  primaryUnit?: string;
  hasUnitMismatch?: boolean;
  unitMismatchWarnings?: string[];
  unitConversions?: Record<string, ConvertedOrderUnitDetail>;
  linkedMatchTypes?: Record<string, { type: 'direct_po' | 'via_do' | 'manual'; refDoc?: string; source?: string }>;
}

export interface ScanApiResponse {
  success: boolean;
  data: Partial<OrderRecord>;
  storeSuggestion?: Partial<StoreMerchant>;
  notes?: string;
  confidence?: number;
  error?: string;
}
