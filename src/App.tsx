/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StatSummaryCards } from './components/StatSummaryCards';
import { TableView39Cols } from './components/TableView39Cols';
import { POManagementView } from './components/POManagementView';
import { PODetailModal } from './components/PODetailModal';
import { POEditModal } from './components/POEditModal';
import { POScanModal } from './components/POScanModal';
import { StoresManagementView } from './components/StoresManagementView';
import { AnalyticsView } from './components/AnalyticsView';
import { ScanModal } from './components/ScanModal';
import { VerifyModal } from './components/VerifyModal';
import { StoreDetailModal } from './components/StoreDetailModal';
import { StoreEditModal } from './components/StoreEditModal';
import { OrderRecord, StoreMerchant, PurchaseOrder } from './types';
import { exportAllDataToExcel } from './utils/excelExport';
import { CheckCircle2 } from 'lucide-react';

const STORAGE_ORDERS_KEY = 'autostore_real_orders_v2';
const STORAGE_STORES_KEY = 'autostore_real_stores_v2';
const STORAGE_POS_KEY = 'autostore_real_pos_v2';

export default function App() {
  // Main Data States with clean persistence
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      localStorage.removeItem('autostore_orders_v1');
      localStorage.removeItem('logistics_table_39cols_data');
      const saved = localStorage.getItem(STORAGE_ORDERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stores, setStores] = useState<StoreMerchant[]>(() => {
    try {
      localStorage.removeItem('autostore_merchants_v1');
      const saved = localStorage.getItem(STORAGE_STORES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pos, setPos] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_POS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Navigation tab: 'orders' (ตั๋วชั่ง&บิล) | 'pos' (ใบสั่งซื้อ) | 'stores' (ร้านค้า) | 'analytics' (วิเคราะห์)
  const [activeTab, setActiveTab] = useState<'orders' | 'pos' | 'stores' | 'analytics'>('orders');
  const [tableExternalFilter, setTableExternalFilter] = useState<string | null>(null);

  // Bill Scan & Verify Modals
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyOrderData, setVerifyOrderData] = useState<Partial<OrderRecord> | null>(null);
  const [verifyImage, setVerifyImage] = useState<string | null>(null);
  const [verifyStoreSuggestion, setVerifyStoreSuggestion] = useState<Partial<StoreMerchant> | undefined>(undefined);

  // PO Modals
  const [selectedPOForDetail, setSelectedPOForDetail] = useState<PurchaseOrder | null>(null);
  const [isPOEditOpen, setIsPOEditOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [initialStoreNameForPO, setInitialStoreNameForPO] = useState<string | undefined>(undefined);
  const [isPOScanOpen, setIsPOScanOpen] = useState(false);

  // Store Detail & Edit Modals
  const [selectedStoreForDetail, setSelectedStoreForDetail] = useState<StoreMerchant | null>(null);
  const [isStoreEditOpen, setIsStoreEditOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreMerchant | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'info' } | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(orders));
    } catch (e) {
      console.warn('Failed to save orders to localStorage', e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_STORES_KEY, JSON.stringify(stores));
    } catch (e) {
      console.warn('Failed to save stores to localStorage', e);
    }
  }, [stores]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
    } catch (e) {
      console.warn('Failed to save POs to localStorage', e);
    }
  }, [pos]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // AI Scan completion handler
  const handleScanComplete = (
    data: Partial<OrderRecord>,
    imageBase64: string,
    storeSuggestion?: Partial<StoreMerchant>
  ) => {
    // If Gemini identified this as a Purchase Order (PO):
    if (data.docType === 'purchase_order') {
      const today = new Date().toISOString().split('T')[0];
      const newPO: PurchaseOrder = {
        id: `po-${Date.now()}`,
        poNumber: data.col4 || data.col6 || `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        orderDate: data.col7 || today,
        deliveryDueDate: '',
        projectId: data.col2 || '',
        storeName: data.col8 || '',
        category: data.col3 || 'งานจัดซื้อทั่วไป',
        items: data.lineItems && data.lineItems.length > 0 
          ? data.lineItems.map((item, idx) => ({
              id: `item-${Date.now()}-${idx}`,
              itemDescription: item.itemDescription,
              specCode: item.specCode || '',
              orderedQty: item.qty || 1,
              unit: item.unit || 'ชิ้น',
              unitPrice: item.unitPrice || 0,
              totalAmount: item.totalAmount || ((item.qty || 1) * (item.unitPrice || 0))
            }))
          : [{
              id: `item-${Date.now()}-0`,
              itemDescription: data.col11 || 'สินค้าจัดซื้อ',
              specCode: data.col12 || '',
              orderedQty: Number(data.col22) || 1,
              unit: data.col23 || 'ชิ้น',
              unitPrice: Number(data.col24) || 0,
              totalAmount: Number(data.col25) || Number(data.col29) || 0
            }],
        totalQty: Number(data.col22) || (data.lineItems?.reduce((s, i) => s + (i.qty || 0), 0) || 1),
        totalAmount: Number(data.col29) || Number(data.col25) || (data.lineItems?.reduce((s, i) => s + (i.totalAmount || 0), 0) || 0),
        status: 'pending',
        creditTerms: data.col30 || 'เครดิต 30 วัน',
        deliveryLocation: data.col37 || '',
        orderedBy: data.col9 || '',
        notes: data.col38 || '',
        image: imageBase64,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setEditingPO(newPO);
      setIsPOEditOpen(true);
      showToast('AI ตรวจพบว่าเป็น "ใบสั่งซื้อสินค้า (PO)" นำเข้าสู่ระบบ PO ให้ตรวจสอบแล้ว!');
      return;
    }

    setVerifyOrderData(data);
    setVerifyImage(imageBase64);
    setVerifyStoreSuggestion(storeSuggestion);
    setIsVerifyOpen(true);
    showToast('Gemini AI สแกนใบส่งของสำเร็จ! กรุณาตรวจสอบข้อมูล');
  };

  // Switch from VerifyModal to POEditModal when user selects or detects PO
  const handleSwitchVerifyToPO = (draftPO: Partial<PurchaseOrder>) => {
    setIsVerifyOpen(false);
    setVerifyOrderData(null);
    setVerifyImage(null);
    setEditingPO(draftPO as PurchaseOrder);
    setIsPOEditOpen(true);
    showToast('สลับเข้าสู่หน้าต่างบันทึกใบสั่งซื้อ (PO) เรียบร้อยแล้ว');
  };

  // Save verified order (either new or updated)
  const handleSaveOrder = (order: OrderRecord, storeToSave?: StoreMerchant) => {
    setOrders(prev => {
      const idx = prev.findIndex(o => o.id === order.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = order;
        return copy;
      }
      return [order, ...prev];
    });

    // If store should be saved or updated in directory
    if (storeToSave) {
      setStores(prev => {
        const existingIdx = prev.findIndex(s => s.name.trim().toLowerCase() === storeToSave.name.trim().toLowerCase());
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            totalOrders: updated[existingIdx].totalOrders + 1,
            totalPurchases: updated[existingIdx].totalPurchases + order.col29,
            totalDebt: updated[existingIdx].totalDebt + order.col36,
            lastOrderDate: order.col7
          };
          return updated;
        }
        return [storeToSave, ...prev];
      });
    }

    showToast('บันทึกข้อมูลตั๋วชั่ง/คำสั่งซื้อเรียบร้อยแล้ว!');
  };

  // Add new blank order
  const handleAddNewOrder = () => {
    const today = new Date().toISOString().split('T')[0];
    const newDraft: Partial<OrderRecord> = {
      col1: 'TR-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      col2: '',
      col3: '',
      col4: '',
      col5: '',
      col6: '',
      col7: today,
      col8: '',
      col9: '',
      col10: '',
      col11: '',
      col12: '',
      col13: 0,
      col14: 0,
      col15: 0,
      col16: '',
      col17: '',
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 'ตัน',
      col24: 0,
      col25: 0,
      col26: '',
      col27: 0,
      col28: 0,
      col29: 0,
      col30: 'โอนเงิน',
      col31: 0,
      col32: 0,
      col33: 0,
      col34: 0,
      col35: 0,
      col36: 0,
      col37: '',
      col38: '',
      image: null
    };

    setVerifyOrderData(newDraft);
    setVerifyImage(null);
    setVerifyStoreSuggestion(undefined);
    setIsVerifyOpen(true);
  };

  // Add new order specifically for an existing store
  const handleAddNewOrderForStore = (store: StoreMerchant) => {
    const today = new Date().toISOString().split('T')[0];
    const newDraft: Partial<OrderRecord> = {
      col1: 'TR-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      col2: '',
      col3: store.category || '',
      col4: '',
      col5: '',
      col6: '',
      col7: today,
      col8: store.name,
      col9: '',
      col10: '',
      col11: store.primaryGoods?.[0] || '',
      col12: '',
      col13: 0,
      col14: 0,
      col15: 0,
      col16: '',
      col17: '',
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: 0,
      col23: 'ตัน',
      col24: 0,
      col25: 0,
      col26: '',
      col27: 0,
      col28: 0,
      col29: 0,
      col30: store.creditTerms || 'โอนเงิน',
      col31: 0,
      col32: 0,
      col33: 0,
      col34: 0,
      col35: 0,
      col36: 0,
      col37: '',
      col38: '',
      storeId: store.id,
      image: null
    };

    setVerifyOrderData(newDraft);
    setVerifyImage(null);
    setVerifyStoreSuggestion(store);
    setIsVerifyOpen(true);
  };

  // Duplicate an existing order
  const handleDuplicateOrder = (order: OrderRecord) => {
    const duplicated: OrderRecord = {
      ...order,
      id: 'ord-' + Date.now(),
      col1: order.col1 + '-COPY',
      createdAt: new Date().toISOString()
    };
    setOrders(prev => [duplicated, ...prev]);
    showToast(`คัดลอกรายการ ${order.col1} สำเร็จ!`);
  };

  // Delete order
  const handleDeleteOrder = (id: string) => {
    if (confirm('คุณต้องการลบรายการเอกสารนี้หรือไม่?')) {
      setOrders(prev => prev.filter(o => o.id !== id));
      showToast('ลบรายการเรียบร้อยแล้ว');
    }
  };

  // Update order inline
  const handleUpdateOrder = (updatedOrder: OrderRecord) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    showToast('อัปเดตรายการเรียบร้อยแล้ว');
  };

  // Inspect order in verification modal
  const handleInspectOrder = (order: OrderRecord) => {
    setVerifyOrderData(order);
    setVerifyImage(order.image || null);
    const matchingStore = stores.find(s => s.name === order.col8 || s.id === order.storeId);
    setVerifyStoreSuggestion(matchingStore);
    setIsVerifyOpen(true);
  };

  // ================= PO MANAGEMENT HANDLERS =================
  const handleSavePO = (savedPO: PurchaseOrder) => {
    setPos(prev => {
      const idx = prev.findIndex(p => p.id === savedPO.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedPO;
        return copy;
      }
      return [savedPO, ...prev];
    });

    // Check if store should also be added to directory
    if (savedPO.storeName) {
      setStores(prev => {
        const found = prev.find(s => s.name.trim().toLowerCase() === savedPO.storeName.trim().toLowerCase());
        if (!found) {
          const newStore: StoreMerchant = {
            id: `store-${Date.now()}`,
            name: savedPO.storeName,
            category: savedPO.category || 'ทั่วไป',
            creditTerms: savedPO.creditTerms || 'เครดิต 30 วัน',
            totalOrders: 0,
            totalPurchases: savedPO.totalAmount || 0,
            totalPaid: 0,
            totalDebt: savedPO.totalAmount || 0,
            primaryGoods: savedPO.items?.map(i => i.itemDescription) || []
          };
          return [newStore, ...prev];
        }
        return prev;
      });
    }

    // If detail modal was open for this PO, update it
    if (selectedPOForDetail && selectedPOForDetail.id === savedPO.id) {
      setSelectedPOForDetail(savedPO);
    }

    showToast(`บันทึกใบสั่งซื้อ ${savedPO.poNumber} เรียบร้อยแล้ว!`);
  };

  const handleDeletePO = (id: string) => {
    setPos(prev => prev.filter(p => p.id !== id));
    if (selectedPOForDetail?.id === id) {
      setSelectedPOForDetail(null);
    }
    showToast('ลบใบสั่งซื้อเรียบร้อยแล้ว');
  };

  const handleOpenCreatePO = (initialStoreName?: string) => {
    setEditingPO(null);
    setInitialStoreNameForPO(initialStoreName);
    setIsPOEditOpen(true);
  };

  const handlePOScanComplete = (poData: Partial<PurchaseOrder>, imageBase64: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: poData.poNumber || `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      orderDate: poData.orderDate || today,
      deliveryDueDate: poData.deliveryDueDate || '',
      projectId: poData.projectId || '',
      storeName: poData.storeName || '',
      category: poData.category || 'งานวัสดุก่อสร้าง',
      items: poData.items || [],
      totalQty: poData.totalQty || 0,
      totalAmount: poData.totalAmount || 0,
      status: 'pending',
      creditTerms: poData.creditTerms || 'เครดิต 30 วัน',
      deliveryLocation: poData.deliveryLocation || '',
      orderedBy: poData.orderedBy || '',
      approvedBy: poData.approvedBy || '',
      notes: poData.notes || '',
      image: imageBase64,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingPO(newPO);
    setIsPOEditOpen(true);
    showToast('Gemini AI สแกนใบสั่งซื้อสำเร็จ! กรุณาตรวจสอบข้อมูลก่อนบันทึก');
  };

  // Quick action: Create an inbound ticket/bill linked directly to this PO
  const handleAddTicketForPO = (po: PurchaseOrder) => {
    const today = new Date().toISOString().split('T')[0];
    const firstItem = po.items?.[0];
    const newDraft: Partial<OrderRecord> = {
      col1: 'TR-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      col2: po.projectId || '',
      col3: po.category || '',
      col4: po.poNumber, // Link to this PO
      col5: '',
      col6: '',
      col7: today,
      col8: po.storeName,
      col9: '',
      col10: '',
      col11: firstItem?.itemDescription || '',
      col12: firstItem?.specCode || '',
      col13: 0,
      col14: 0,
      col15: 0,
      col16: '',
      col17: '',
      col18: 0,
      col19: 0,
      col20: 0,
      col21: 0,
      col22: firstItem?.orderedQty || 0,
      col23: firstItem?.unit || 'ตัน',
      col24: firstItem?.unitPrice || 0,
      col25: (firstItem?.orderedQty || 0) * (firstItem?.unitPrice || 0),
      col26: '',
      col27: 0,
      col28: 0,
      col29: (firstItem?.orderedQty || 0) * (firstItem?.unitPrice || 0),
      col30: po.creditTerms || 'โอนเงิน',
      col31: 0,
      col32: 0,
      col33: 0,
      col34: 0,
      col35: 0,
      col36: (firstItem?.orderedQty || 0) * (firstItem?.unitPrice || 0),
      col37: po.deliveryLocation || '',
      col38: `ตัดยอดส่งมอบตาม PO: ${po.poNumber}`,
      storeId: po.storeId || '',
      image: null
    };

    setVerifyOrderData(newDraft);
    setVerifyImage(null);
    const matchingStore = stores.find(s => s.name === po.storeName || s.id === po.storeId);
    setVerifyStoreSuggestion(matchingStore);
    setIsVerifyOpen(true);
  };

  // User Manual Match: Link an unlinked order to this PO strictly by user decision
  const handleLinkOrderToPO = (orderId: string, poNumber: string) => {
    setOrders(prev => prev.map(ord => {
      if (ord.id === orderId) {
        return {
          ...ord,
          col4: poNumber,
          col38: ord.col38 ? `${ord.col38} (ชนบิลเข้า PO: ${poNumber})` : `ชนบิลเข้า PO: ${poNumber}`
        };
      }
      return ord;
    }));
    showToast(`ชนบิลตั๋วเข้า PO ${poNumber} เรียบร้อยแล้ว!`);
  };

  // Unlink an order from a PO
  const handleUnlinkOrderFromPO = (orderId: string) => {
    setOrders(prev => prev.map(ord => {
      if (ord.id === orderId) {
        return {
          ...ord,
          col4: ''
        };
      }
      return ord;
    }));
    showToast('ยกเลิกการชนบิลของตั๋วใบนี้แล้ว');
  };

  // Store management handlers
  const handleSaveStore = (savedStore: StoreMerchant) => {
    setStores(prev => {
      const idx = prev.findIndex(s => s.id === savedStore.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedStore;
        return copy;
      }
      return [savedStore, ...prev];
    });
    showToast(`บันทึกข้อมูลร้านค้า ${savedStore.name} เรียบร้อยแล้ว!`);
  };

  const handleOpenStoreByName = (storeName: string) => {
    let found = stores.find(s => s.name.trim().toLowerCase() === storeName.trim().toLowerCase());
    if (!found) {
      found = {
        id: 'store-' + Date.now(),
        name: storeName,
        category: 'ทั่วไป',
        totalOrders: 0,
        totalPurchases: 0,
        totalPaid: 0,
        totalDebt: 0,
        primaryGoods: [],
        creditTerms: 'เครดิต 30 วัน'
      };
      setStores(prev => [found!, ...prev]);
    }
    setSelectedStoreForDetail(found);
  };

  // Export full excel (Orders + POs + Stores)
  const handleExportExcel = () => {
    if (orders.length === 0 && stores.length === 0 && pos.length === 0) {
      alert('ยังไม่มีข้อมูลในระบบสำหรับส่งออก กรุณาสแกนบิลหรือเพิ่มรายการก่อน');
      return;
    }
    exportAllDataToExcel(orders, stores, pos);
    showToast('ส่งออกไฟล์ Excel เรียบร้อยแล้ว!');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScan={() => setIsScanOpen(true)}
        onAddNewOrder={handleAddNewOrder}
        onAddNewStore={() => {
          setEditingStore(null);
          setIsStoreEditOpen(true);
        }}
        onAddNewPO={() => handleOpenCreatePO()}
        onExportExcel={handleExportExcel}
        totalOrders={orders.length}
        totalPOs={pos.length}
        totalStores={stores.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 md:p-4 space-y-4">
        
        {/* KPI Statistics Bar with Quick Filter Interaction */}
        <StatSummaryCards 
          orders={orders} 
          onFilterClick={(type) => {
            setActiveTab('orders');
            setTableExternalFilter(type === 'all' ? '' : type);
          }}
        />

        {/* Tab 1: ตั๋วชั่ง & บิลส่งของ (39 Columns Logistics Table) */}
        {activeTab === 'orders' && (
          <TableView39Cols
            orders={orders}
            stores={stores}
            onInspectOrder={handleInspectOrder}
            onDuplicateOrder={handleDuplicateOrder}
            onDeleteOrder={handleDeleteOrder}
            onUpdateOrder={handleUpdateOrder}
            onOpenStoreModal={handleOpenStoreByName}
            onOpenScan={() => setIsScanOpen(true)}
            externalFilter={tableExternalFilter}
          />
        )}

        {/* Tab 2: ใบสั่งซื้อ (Purchase Orders / POs) */}
        {activeTab === 'pos' && (
          <POManagementView
            pos={pos}
            orders={orders}
            stores={stores}
            onOpenCreatePO={() => handleOpenCreatePO()}
            onOpenScanPO={() => setIsPOScanOpen(true)}
            onSelectPO={(po) => setSelectedPOForDetail(po)}
            onEditPO={(po) => {
              setEditingPO(po);
              setIsPOEditOpen(true);
            }}
            onDeletePO={handleDeletePO}
            onAddTicketForPO={handleAddTicketForPO}
          />
        )}

        {/* Tab 3: Stores & Vendors Directory */}
        {activeTab === 'stores' && (
          <StoresManagementView
            stores={stores}
            orders={orders}
            onSelectStore={(st) => setSelectedStoreForDetail(st)}
            onAddNewStore={() => {
              setEditingStore(null);
              setIsStoreEditOpen(true);
            }}
            onAddNewOrderForStore={handleAddNewOrderForStore}
          />
        )}

        {/* Tab 4: Analytics & Financial Insights */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            orders={orders}
            stores={stores}
          />
        )}

      </main>

      {/* AI Scan Modal for Bills & Tickets */}
      <ScanModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onScanComplete={handleScanComplete}
      />

      {/* AI Scan Modal for Purchase Orders (POs) */}
      <POScanModal
        isOpen={isPOScanOpen}
        onClose={() => setIsPOScanOpen(false)}
        onScanComplete={handlePOScanComplete}
      />

      {/* Split Screen Verification Modal for Bills */}
      <VerifyModal
        isOpen={isVerifyOpen}
        orderData={verifyOrderData}
        billImage={verifyImage}
        storeSuggestion={verifyStoreSuggestion}
        stores={stores}
        pos={pos}
        existingOrders={orders}
        onClose={() => setIsVerifyOpen(false)}
        onSaveOrder={handleSaveOrder}
        onSwitchToPO={handleSwitchVerifyToPO}
      />

      {/* Purchase Order Detail & Print Modal */}
      <PODetailModal
        isOpen={Boolean(selectedPOForDetail)}
        po={selectedPOForDetail}
        orders={orders}
        onClose={() => setSelectedPOForDetail(null)}
        onEditPO={(po) => {
          setSelectedPOForDetail(null);
          setEditingPO(po);
          setIsPOEditOpen(true);
        }}
        onInspectOrder={handleInspectOrder}
        onAddTicketForPO={handleAddTicketForPO}
        onLinkOrderToPO={handleLinkOrderToPO}
        onUnlinkOrderFromPO={handleUnlinkOrderFromPO}
      />

      {/* Purchase Order Create / Edit Modal */}
      <POEditModal
        isOpen={isPOEditOpen}
        po={editingPO}
        stores={stores}
        initialStoreName={initialStoreNameForPO}
        onClose={() => {
          setIsPOEditOpen(false);
          setEditingPO(null);
          setInitialStoreNameForPO(undefined);
        }}
        onSave={handleSavePO}
      />

      {/* Store Detail & Order History Modal */}
      <StoreDetailModal
        store={selectedStoreForDetail}
        orders={orders}
        onClose={() => setSelectedStoreForDetail(null)}
        onInspectOrder={handleInspectOrder}
        onAddNewOrderForStore={handleAddNewOrderForStore}
        onOpenCreatePOForStore={(st) => handleOpenCreatePO(st.name)}
        onEditStore={(st) => {
          setSelectedStoreForDetail(null);
          setEditingStore(st);
          setIsStoreEditOpen(true);
        }}
      />

      {/* Store Add / Edit Modal */}
      <StoreEditModal
        store={editingStore}
        isOpen={isStoreEditOpen}
        onClose={() => {
          setIsStoreEditOpen(false);
          setEditingStore(null);
        }}
        onSave={handleSaveStore}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-xs font-semibold animate-bounce border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
