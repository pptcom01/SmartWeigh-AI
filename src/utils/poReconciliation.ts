import { OrderRecord, PurchaseOrder, POReconciliation, POStatus, ConvertedOrderUnitDetail, MatchedDeliveryShipment } from '../types';

/**
 * Normalizes document reference numbers by stripping whitespace, dashes, slashes,
 * and converting to uppercase for deterministic matching without guessing.
 */
export function normalizeDocNumber(docNo?: string | null): string {
  if (!docNo) return '';
  return docNo.toString().replace(/[\s\-_/]/g, '').toUpperCase();
}

/**
 * Normalizes unit strings to canonical forms for accurate reconciliation
 */
export function normalizeUnit(unit?: string | null): string {
  if (!unit) return '';
  const u = unit.toString().trim().toLowerCase();
  if (['ตัน', 'ton', 'tons', 't'].includes(u)) return 'ตัน';
  if (['กก.', 'กก', 'กิโลกรัม', 'kg', 'kgs', 'kilogram'].includes(u)) return 'กก.';
  if (['คิว', 'ลบ.ม.', 'm3', 'cu.m.', 'คิวบิกเมตร'].includes(u)) return 'คิว';
  if (['เส้น', 'bar', 'bars'].includes(u)) return 'เส้น';
  if (['ถุง', 'bag', 'bags'].includes(u)) return 'ถุง';
  if (['แผ่น', 'sheet', 'sheets'].includes(u)) return 'แผ่น';
  if (['กล่อง', 'box', 'boxes'].includes(u)) return 'กล่อง';
  if (['ชิ้น', 'piece', 'pcs', 'ea'].includes(u)) return 'ชิ้น';
  if (['ม้วน', 'roll', 'rolls'].includes(u)) return 'ม้วน';
  if (['ถัง', 'drum', 'bucket'].includes(u)) return 'ถัง';
  if (['ชุด', 'set', 'sets'].includes(u)) return 'ชุด';
  if (['ท่อน'].includes(u)) return 'ท่อน';
  if (['เที่ยว', 'trip'].includes(u)) return 'เที่ยว';
  return unit.trim();
}

/**
 * Extracts potential PO and DO numbers from unstructured text (e.g. remarks, notes, handwritten text)
 */
export function extractDocReferences(text?: string | null): { poNumbers: string[]; doNumbers: string[] } {
  if (!text) return { poNumbers: [], doNumbers: [] };

  const poNumbers: string[] = [];
  const doNumbers: string[] = [];

  // Match patterns like: "PO-2024-001", "PO: 24-001", "ใบสั่งซื้อ 2024/05", "P.O. 9981"
  const poRegex = /(?:PO|ใบสั่งซื้อ|P[/.]?O[.]?)\s*[:#№.\s-]*([A-Za-z0-9\-_/]+)/gi;
  let poMatch: RegExpExecArray | null;
  while ((poMatch = poRegex.exec(text)) !== null) {
    if (poMatch[1] && poMatch[1].length >= 3) {
      poNumbers.push(normalizeDocNumber(poMatch[1]));
    }
  }

  // Match patterns like: "DO-8891", "DO: 8891", "ใบส่งของ 4401", "บิลส่งของ 9021", "D/O 551"
  const doRegex = /(?:DO|ใบส่งของ|บิลส่งของ|D[/.]?O[.]?|บิล)\s*[:#№.\s-]*([A-Za-z0-9\-_/]+)/gi;
  let doMatch: RegExpExecArray | null;
  while ((doMatch = doRegex.exec(text)) !== null) {
    if (doMatch[1] && doMatch[1].length >= 3) {
      doNumbers.push(normalizeDocNumber(doMatch[1]));
    }
  }

  return { poNumbers, doNumbers };
}

/**
 * Reconciles a Purchase Order against inbound tickets/bills (OrderRecord)
 * 3-Way Matching Logic:
 * 1. Direct PO Matching (DO or Weighbridge has col4, referenceDocNo, or remarks pointing to PO)
 * 2. Transitive DO Matching (Weighbridge ticket references DO, and that DO references this PO)
 * 3. Paired Shipment Grouping (Pairs DO + Weighbridge to eliminate double counting of delivered quantities)
 * 4. Automatic unit conversion (kg <-> ton)
 */
export function reconcilePO(po: PurchaseOrder, orders: OrderRecord[]): POReconciliation {
  const normalizedPoNum = normalizeDocNumber(po.poNumber);
  const rawPrimaryPOUnit = po.items?.[0]?.unit || 'ชิ้น';
  const primaryPOUnit = normalizeUnit(rawPrimaryPOUnit);
  
  if (!normalizedPoNum) {
    return {
      po,
      linkedOrders: [],
      pairedShipments: [],
      deliveredQty: 0,
      deliveredAmount: 0,
      remainingQty: po.totalQty,
      remainingAmount: po.totalAmount,
      percentageDelivered: 0,
      isOverDelivered: false,
      status: po.status || 'pending',
      primaryUnit: rawPrimaryPOUnit,
      hasUnitMismatch: false,
      unitMismatchWarnings: [],
      unitConversions: {},
      linkedMatchTypes: {}
    };
  }

  const linkedMatchTypes: Record<string, { type: 'direct_po' | 'via_do' | 'manual'; refDoc?: string; source?: string }> = {};

  // Step 1: Find all orders that directly reference this PO
  // (via col4 form field, referenceDocNo, or handwritten/notes in col38)
  const directLinkedOrders: OrderRecord[] = [];
  const knownDONumbers = new Map<string, OrderRecord>(); // normalized DO number -> DO order

  orders.forEach(ord => {
    const col4Norm = normalizeDocNumber(ord.col4);
    const refNorm = normalizeDocNumber(ord.referenceDocNo);
    const textRefs = extractDocReferences(ord.col38);

    const matchesDirectPO = 
      (col4Norm.length > 0 && col4Norm === normalizedPoNum) ||
      (refNorm.length > 0 && refNorm === normalizedPoNum) ||
      textRefs.poNumbers.includes(normalizedPoNum);

    if (matchesDirectPO) {
      directLinkedOrders.push(ord);

      let source = ord.referenceSource || 'form_field';
      if (!col4Norm && refNorm === normalizedPoNum) {
        source = ord.referenceSource || 'handwritten';
      } else if (!col4Norm && !refNorm && textRefs.poNumbers.includes(normalizedPoNum)) {
        source = 'notes';
      }

      linkedMatchTypes[ord.id] = {
        type: 'direct_po',
        refDoc: po.poNumber,
        source
      };

      // If this direct order is a Delivery Order (DO), record its DO number
      const doNum = normalizeDocNumber(ord.col6 || ord.col1);
      if (doNum) {
        knownDONumbers.set(doNum, ord);
      }
    }
  });

  // Step 2: Find orders (especially Weighbridge tickets) that reference any of the DOs linked to this PO
  // (Transitive: Weighbridge Ticket -> DO -> PO)
  const transitiveOrders: OrderRecord[] = [];

  if (knownDONumbers.size > 0) {
    orders.forEach(ord => {
      // Skip if already directly linked
      if (directLinkedOrders.some(d => d.id === ord.id)) return;

      const refNorm = normalizeDocNumber(ord.referenceDocNo);
      const col6Norm = normalizeDocNumber(ord.col6);
      const linkedViaNorm = normalizeDocNumber(ord.linkedViaDocNo);
      const textRefs = extractDocReferences(ord.col38);

      let matchedDOOrder: OrderRecord | undefined;
      let matchedDONum = '';

      for (const [doNum, doOrd] of knownDONumbers.entries()) {
        if (
          refNorm === doNum || 
          col6Norm === doNum || 
          linkedViaNorm === doNum ||
          textRefs.doNumbers.includes(doNum)
        ) {
          matchedDOOrder = doOrd;
          matchedDONum = doOrd.col6 || doOrd.col1;
          break;
        }
      }

      if (matchedDOOrder) {
        // Tag with transitive reference
        ord.linkedViaDocNo = matchedDONum;
        transitiveOrders.push(ord);

        linkedMatchTypes[ord.id] = {
          type: 'via_do',
          refDoc: matchedDONum,
          source: ord.referenceSource || 'form_field'
        };
      }
    });
  }

  // Combined linked orders (distinct)
  const allLinkedOrders = [...directLinkedOrders, ...transitiveOrders];

  // Step 3: Build Paired Shipments to prevent double counting
  // Pairs DO with its matching Weighbridge ticket(s)
  const pairedShipments: MatchedDeliveryShipment[] = [];
  const processedOrderIds = new Set<string>();

  // Process DO orders and find their matching weighbridge tickets
  allLinkedOrders.forEach(ord => {
    if (processedOrderIds.has(ord.id)) return;

    const isDO = ord.docType === 'delivery_order' || ord.docType === 'concrete' || (!ord.docType && Number(ord.col13) === 0);
    const doNum = normalizeDocNumber(ord.col6 || ord.col1);

    if (isDO && doNum) {
      // Look for a weighbridge ticket referencing this DO
      const matchingWB = allLinkedOrders.find(o => 
        !processedOrderIds.has(o.id) &&
        o.id !== ord.id &&
        (o.docType === 'weighbridge' || Number(o.col13) > 0 || Number(o.col15) > 0) &&
        (
          normalizeDocNumber(o.referenceDocNo) === doNum ||
          normalizeDocNumber(o.linkedViaDocNo) === doNum ||
          normalizeDocNumber(o.col6) === doNum ||
          extractDocReferences(o.col38).doNumbers.includes(doNum)
        )
      );

      if (matchingWB) {
        // PAIRED SHIPMENT: Both DO and Weighbridge ticket exist
        processedOrderIds.add(ord.id);
        processedOrderIds.add(matchingWB.id);

        const wbNetKg = Number(matchingWB.col15) || 0;
        const doQty = Number(ord.col22) || 0;
        const effectiveUnit = primaryPOUnit || ord.col23 || 'ตัน';
        
        // Effective quantity: prefer certified weighbridge net weight if ton/kg, otherwise DO qty
        let effectiveQty = doQty;
        if (effectiveUnit === 'ตัน' && wbNetKg > 0) {
          effectiveQty = Number((wbNetKg / 1000).toFixed(3));
        } else if (effectiveUnit === 'กก.' && wbNetKg > 0) {
          effectiveQty = wbNetKg;
        } else if (effectiveQty === 0 && wbNetKg > 0) {
          effectiveQty = Number((wbNetKg / 1000).toFixed(3));
        }

        const effectiveAmount = Number(ord.col29) || Number(ord.col25) || Number(matchingWB.col29) || 0;

        pairedShipments.push({
          id: `shipment-${ord.id}-${matchingWB.id}`,
          doOrder: ord,
          weighbridgeOrder: matchingWB,
          effectiveQty,
          effectiveUnit,
          effectiveAmount,
          matchType: 'paired_do_wb',
          referenceDocNo: ord.col6,
          linkedViaDocNo: matchingWB.col6,
          referenceSource: matchingWB.referenceSource || ord.referenceSource || 'form_field'
        });
        return;
      }
    }
  });

  // Process remaining unpaired orders
  allLinkedOrders.forEach(ord => {
    if (processedOrderIds.has(ord.id)) return;
    processedOrderIds.add(ord.id);

    const isWB = ord.docType === 'weighbridge' || Number(ord.col13) > 0 || Number(ord.col15) > 0;
    const netWeightKg = Number(ord.col15) || 0;
    const rawQty = Number(ord.col22) || 0;
    const effectiveUnit = primaryPOUnit || ord.col23 || (isWB ? 'ตัน' : 'ชิ้น');

    let effectiveQty = rawQty;
    if (effectiveUnit === 'ตัน') {
      if (rawQty === 0 && netWeightKg > 0) {
        effectiveQty = Number((netWeightKg / 1000).toFixed(3));
      } else if (ord.col23 === 'กก.' || (!ord.col23 && rawQty > 1000)) {
        effectiveQty = Number((rawQty / 1000).toFixed(3));
      }
    } else if (effectiveUnit === 'กก.') {
      if (rawQty === 0 && netWeightKg > 0) {
        effectiveQty = netWeightKg;
      }
    } else if (effectiveQty === 0 && netWeightKg > 0) {
      effectiveQty = Number((netWeightKg / 1000).toFixed(3));
    }

    const effectiveAmount = Number(ord.col29) || Number(ord.col25) || 0;

    pairedShipments.push({
      id: `shipment-${ord.id}`,
      doOrder: !isWB ? ord : undefined,
      weighbridgeOrder: isWB ? ord : undefined,
      effectiveQty,
      effectiveUnit,
      effectiveAmount,
      matchType: isWB ? 'weighbridge_only' : 'do_only',
      referenceDocNo: ord.referenceDocNo || ord.col6,
      linkedViaDocNo: ord.linkedViaDocNo,
      referenceSource: ord.referenceSource || (ord.col4 ? 'form_field' : 'notes')
    });
  });

  // Calculate total delivered quantity and delivered amount
  let deliveredQty = 0;
  let deliveredAmount = 0;
  let hasUnitMismatch = false;
  const unitMismatchWarnings: string[] = [];
  const unitConversions: Record<string, ConvertedOrderUnitDetail> = {};

  pairedShipments.forEach(ship => {
    deliveredQty += ship.effectiveQty;
    deliveredAmount += ship.effectiveAmount;

    // Track conversion & mismatch for auditing
    const activeOrder = ship.doOrder || ship.weighbridgeOrder;
    if (activeOrder) {
      const orderUnit = normalizeUnit(ship.effectiveUnit);
      if (orderUnit && primaryPOUnit && orderUnit !== primaryPOUnit) {
        hasUnitMismatch = true;
        unitMismatchWarnings.push(
          `ตั๋ว ${activeOrder.col1 || activeOrder.col6}: ระบุหน่วย '${ship.effectiveUnit}' ไม่ตรงกับ PO ที่สั่งเป็น '${rawPrimaryPOUnit}'`
        );
      }
      unitConversions[activeOrder.id] = {
        originalQty: Number(activeOrder.col22) || Number(activeOrder.col15) || 0,
        originalUnit: activeOrder.col23 || (activeOrder.col15 ? 'กก.' : rawPrimaryPOUnit),
        convertedQty: ship.effectiveQty,
        targetUnit: ship.effectiveUnit,
        note: ship.matchType === 'paired_do_wb' 
          ? `จับคู่ DO [${ship.doOrder?.col6 || '-'}] ↔ ตั๋วชั่ง [${ship.weighbridgeOrder?.col6 || '-'}]` 
          : `ส่งมอบเดี่ยว (${ship.effectiveQty} ${ship.effectiveUnit})`
      };
    }
  });

  const totalOrderedQty = po.totalQty || 1;
  const percentageDelivered = Math.min(100, Math.round((deliveredQty / totalOrderedQty) * 100));
  const remainingQty = Math.max(0, po.totalQty - deliveredQty);
  const remainingAmount = Math.max(0, po.totalAmount - deliveredAmount);
  const isOverDelivered = deliveredQty > po.totalQty;

  // Derive status
  let status: POStatus = po.status;
  if (po.status !== 'cancelled') {
    if (deliveredQty <= 0) {
      status = 'pending';
    } else if (deliveredQty >= po.totalQty) {
      status = 'completed';
    } else {
      status = 'partially_delivered';
    }
  }

  return {
    po,
    linkedOrders: allLinkedOrders,
    pairedShipments,
    deliveredQty: Number(deliveredQty.toFixed(2)),
    deliveredAmount,
    remainingQty: Number(remainingQty.toFixed(2)),
    remainingAmount,
    percentageDelivered,
    isOverDelivered,
    status,
    primaryUnit: rawPrimaryPOUnit,
    hasUnitMismatch,
    unitMismatchWarnings,
    unitConversions,
    linkedMatchTypes
  };
}

/**
 * Finds candidate orders that could be manually linked to this PO by the user:
 * 1. Orders with NO PO assigned at all (col4 is blank)
 * 2. Orders belonging to the same store/vendor that are not yet linked to this PO
 * 3. Highlights orders where reference numbers match existing DOs or notes contain potential references
 */
export function findCandidateUnlinkedOrders(po: PurchaseOrder, orders: OrderRecord[]): OrderRecord[] {
  const normalizedPoNum = normalizeDocNumber(po.poNumber);
  const targetStore = (po.storeName || '').trim().toLowerCase();

  return orders.filter(ord => {
    const ordPo = normalizeDocNumber(ord.col4);
    // Already linked to this PO
    if (ordPo.length > 0 && ordPo === normalizedPoNum) return false;

    // Condition A: Order has no PO assigned
    const hasNoPO = !ordPo;
    // Condition B: Order belongs to the same vendor
    const orderStore = (ord.col8 || '').trim().toLowerCase();
    const isSameStore = Boolean(targetStore && orderStore && (orderStore.includes(targetStore) || targetStore.includes(orderStore)));
    // Condition C: Order has remarks/notes or references matching this PO or DOs
    const textRefs = extractDocReferences(ord.col38);
    const mentionsPO = textRefs.poNumbers.includes(normalizedPoNum);

    return hasNoPO || isSameStore || mentionsPO;
  });
}

/**
 * Reconciles a list of Purchase Orders against orders
 */
export function reconcileAllPOs(pos: PurchaseOrder[], orders: OrderRecord[]): POReconciliation[] {
  return pos.map(po => reconcilePO(po, orders));
}

