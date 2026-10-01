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
 * Strips common prefixes (DO, PO, TR, RR) for robust prefix-tolerant matching
 * (e.g. DO-8891 and 8891 represent the same real-world delivery document)
 */
export function stripDocPrefix(docNo?: string | null): string {
  if (!docNo) return '';
  return normalizeDocNumber(docNo).replace(/^(?:DO|PO|TR|RR)/i, '');
}

/**
 * Checks if two document numbers match, supporting exact and prefix-tolerant equality
 */
export function isDocNumberMatch(docA?: string | null, docB?: string | null): boolean {
  const normA = normalizeDocNumber(docA);
  const normB = normalizeDocNumber(docB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const strippedA = stripDocPrefix(normA);
  const strippedB = stripDocPrefix(normB);
  if (strippedA.length >= 2 && strippedB.length >= 2 && strippedA === strippedB) {
    return true;
  }
  return false;
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
 * Recognizes prefixes such as: PO, DO, P.O., D/O, ใบสั่งซื้อ, ใบส่งของ, บิลส่งของ, บิลเลขที่, อ้างอิง, Ref, ตาม PO, ตาม DO
 */
export function extractDocReferences(text?: string | null): { poNumbers: string[]; doNumbers: string[] } {
  if (!text) return { poNumbers: [], doNumbers: [] };

  const poNumbers: string[] = [];
  const doNumbers: string[] = [];

  // Match PO patterns: PO-2024-001, PO: 24-001, ใบสั่งซื้อ 2024/05, P.O. 9981, Ref PO: 123, อ้างอิง PO: 456, สัญญา 789
  const poRegex = /(?:PO|ใบสั่งซื้อ|สั่งซื้อ|P[/.]?O[.]?|Ref(?:\s*PO)?|อ้างอิง(?:\s*PO)?|ตาม(?:\s*PO)?|สัญญา)\s*[:#№.\s-]*([A-Za-z0-9\-_/]+)/gi;
  let poMatch: RegExpExecArray | null;
  while ((poMatch = poRegex.exec(text)) !== null) {
    if (poMatch[1] && poMatch[1].length >= 2) {
      poNumbers.push(normalizeDocNumber(poMatch[1]));
    }
  }

  // Match DO patterns: DO-8891, DO: 8891, ใบส่งของ 4401, บิลส่งของ 9021, D/O 551, Ref DO: 889, อ้างอิง DO: 77, บิลเลขที่ 402, ส่งตาม DO 12, อ้างอิงบิล
  const doRegex = /(?:DO|ใบส่งของ|บิลส่งของ|D[/.]?O[.]?|บิลเลขที่|บิล|Ref(?:\s*DO)?|อ้างอิง(?:\s*DO)?|ส่งตาม(?:\s*DO)?)\s*[:#№.\s-]*([A-Za-z0-9\-_/]+)/gi;
  let doMatch: RegExpExecArray | null;
  while ((doMatch = doRegex.exec(text)) !== null) {
    if (doMatch[1] && doMatch[1].length >= 2) {
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
    const col4Val = ord.col4;
    const refVal = ord.referenceDocNo;
    const textRefs = extractDocReferences(ord.col38);

    const matchesDirectPO = 
      isDocNumberMatch(col4Val, normalizedPoNum) ||
      isDocNumberMatch(refVal, normalizedPoNum) ||
      textRefs.poNumbers.some(p => isDocNumberMatch(p, normalizedPoNum));

    if (matchesDirectPO) {
      directLinkedOrders.push(ord);

      let source = ord.referenceSource || 'form_field';
      if (!isDocNumberMatch(col4Val, normalizedPoNum) && isDocNumberMatch(refVal, normalizedPoNum)) {
        source = ord.referenceSource || 'handwritten';
      } else if (!isDocNumberMatch(col4Val, normalizedPoNum) && !isDocNumberMatch(refVal, normalizedPoNum) && textRefs.poNumbers.some(p => isDocNumberMatch(p, normalizedPoNum))) {
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

      const refVal = ord.referenceDocNo;
      const col6Val = ord.col6;
      const linkedViaVal = ord.linkedViaDocNo;
      const textRefs = extractDocReferences(ord.col38);

      let matchedDOOrder: OrderRecord | undefined;
      let matchedDONum = '';

      for (const [doNum, doOrd] of knownDONumbers.entries()) {
        const directDONum = doOrd.col6 || doOrd.col1;
        if (
          isDocNumberMatch(refVal, doNum) || 
          isDocNumberMatch(col6Val, doNum) || 
          isDocNumberMatch(linkedViaVal, doNum) ||
          isDocNumberMatch(refVal, directDONum) ||
          textRefs.doNumbers.some(d => isDocNumberMatch(d, doNum) || isDocNumberMatch(d, directDONum))
        ) {
          matchedDOOrder = doOrd;
          matchedDONum = directDONum;
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
    const directDONum = ord.col6 || ord.col1;

    if (isDO && doNum) {
      // Look for ALL weighbridge tickets referencing this DO (1-to-N Split Shipments)
      const matchingWBs = allLinkedOrders.filter(o => 
        !processedOrderIds.has(o.id) &&
        o.id !== ord.id &&
        (o.docType === 'weighbridge' || Number(o.col13) > 0 || Number(o.col15) > 0) &&
        (
          isDocNumberMatch(o.referenceDocNo, doNum) ||
          isDocNumberMatch(o.referenceDocNo, directDONum) ||
          isDocNumberMatch(o.linkedViaDocNo, doNum) ||
          isDocNumberMatch(o.linkedViaDocNo, directDONum) ||
          isDocNumberMatch(o.col6, doNum) ||
          extractDocReferences(o.col38).doNumbers.some(d => isDocNumberMatch(d, doNum) || isDocNumberMatch(d, directDONum))
        )
      );

      if (matchingWBs.length > 0) {
        // PAIRED SHIPMENT: DO paired with 1 or multiple Weighbridge tickets
        processedOrderIds.add(ord.id);
        matchingWBs.forEach(wb => processedOrderIds.add(wb.id));

        const totalWbNetKg = matchingWBs.reduce((sum, wb) => sum + (Number(wb.col15) || 0), 0);
        const doQty = Number(ord.col22) || 0;
        const effectiveUnit = primaryPOUnit || ord.col23 || 'ตัน';
        
        // Effective quantity: prefer certified weighbridge net weight if ton/kg, otherwise DO qty
        let effectiveQty = doQty;
        if (effectiveUnit === 'ตัน' && totalWbNetKg > 0) {
          effectiveQty = Number((totalWbNetKg / 1000).toFixed(3));
        } else if (effectiveUnit === 'กก.' && totalWbNetKg > 0) {
          effectiveQty = totalWbNetKg;
        } else if (effectiveQty === 0 && totalWbNetKg > 0) {
          effectiveQty = Number((totalWbNetKg / 1000).toFixed(3));
        }

        const wbSumAmount = matchingWBs.reduce((sum, wb) => sum + (Number(wb.col29) || Number(wb.col25) || 0), 0);
        let effectiveAmount = Number(ord.col29) || Number(ord.col25) || wbSumAmount || 0;
        
        // If neither DO nor WB has price on physical slip, derive from PO unit price (Bridge to RR)
        if (effectiveAmount === 0 && effectiveQty > 0 && po.items && po.items.length > 0) {
          const matchedItem = po.items.find(i => 
            (ord.col11 && i.itemDescription.toLowerCase().includes(ord.col11.toLowerCase())) ||
            (ord.col12 && i.specCode && i.specCode.toLowerCase().includes(ord.col12.toLowerCase()))
          ) || po.items[0];
          if (matchedItem && matchedItem.unitPrice > 0) {
            effectiveAmount = Number((effectiveQty * matchedItem.unitPrice).toFixed(2));
          }
        }

        const wbLabels = matchingWBs.map(wb => wb.col6 || wb.col1 || 'ตั๋วชั่ง').join(', ');

        pairedShipments.push({
          id: `shipment-${ord.id}-${matchingWBs[0].id}`,
          doOrder: ord,
          weighbridgeOrder: matchingWBs[0],
          weighbridgeOrders: matchingWBs,
          effectiveQty,
          effectiveUnit,
          effectiveAmount,
          matchType: 'paired_do_wb',
          referenceDocNo: ord.col6,
          linkedViaDocNo: wbLabels,
          referenceSource: matchingWBs[0].referenceSource || ord.referenceSource || 'form_field'
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

    let effectiveAmount = Number(ord.col29) || Number(ord.col25) || 0;
    
    // If ticket has no price on physical slip, derive from PO unit price (Bridge to RR)
    if (effectiveAmount === 0 && effectiveQty > 0 && po.items && po.items.length > 0) {
      const matchedItem = po.items.find(i => 
        (ord.col11 && i.itemDescription.toLowerCase().includes(ord.col11.toLowerCase())) ||
        (ord.col12 && i.specCode && i.specCode.toLowerCase().includes(ord.col12.toLowerCase()))
      ) || po.items[0];
      if (matchedItem && matchedItem.unitPrice > 0) {
        effectiveAmount = Number((effectiveQty * matchedItem.unitPrice).toFixed(2));
      }
    }

    pairedShipments.push({
      id: `shipment-${ord.id}`,
      doOrder: !isWB ? ord : undefined,
      weighbridgeOrder: isWB ? ord : undefined,
      weighbridgeOrders: isWB ? [ord] : undefined,
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
      const pairNote = ship.matchType === 'paired_do_wb' 
        ? (ship.weighbridgeOrders && ship.weighbridgeOrders.length > 1
            ? `จับคู่ DO [${ship.doOrder?.col6 || '-'}] ↔ ตั๋วชั่ง ${ship.weighbridgeOrders.length} เที่ยว [${ship.weighbridgeOrders.map(w => w.col6 || w.col1).join(', ')}]`
            : `จับคู่ DO [${ship.doOrder?.col6 || '-'}] ↔ ตั๋วชั่ง [${ship.weighbridgeOrder?.col6 || '-'}]`)
        : `ส่งมอบเดี่ยว (${ship.effectiveQty} ${ship.effectiveUnit})`;

      unitConversions[activeOrder.id] = {
        originalQty: Number(activeOrder.col22) || Number(activeOrder.col15) || 0,
        originalUnit: activeOrder.col23 || (activeOrder.col15 ? 'กก.' : rawPrimaryPOUnit),
        convertedQty: ship.effectiveQty,
        targetUnit: ship.effectiveUnit,
        note: pairNote
      };
    }
  });

  // Item-level reconciliation for multi-item POs
  const isMultiItem = Boolean(po.items && po.items.length > 1);
  const itemReconciliations = (po.items || []).map(poItem => {
    const normItemName = (poItem.itemDescription || '').trim().toLowerCase();
    const normItemCode = (poItem.specCode || '').trim().toLowerCase();
    const itemTargetUnit = normalizeUnit(poItem.unit);

    let itemDeliveredQty = 0;
    let itemDeliveredAmt = 0;
    let matchCount = 0;

    if (!isMultiItem) {
      // Single-item PO: all delivered shipments belong to this item
      itemDeliveredQty = deliveredQty;
      itemDeliveredAmt = deliveredAmount;
      matchCount = pairedShipments.length;
    } else {
      // Multi-item PO: match shipments/orders specifically to this item
      pairedShipments.forEach(ship => {
        const orderToCheck = ship.doOrder || ship.weighbridgeOrder;
        if (!orderToCheck) return;

        let isMatch = false;
        let matchedQty = 0;
        let matchedAmt = 0;

        // Check if order has breakdown lineItems
        if (orderToCheck.lineItems && orderToCheck.lineItems.length > 0) {
          const matchingLines = orderToCheck.lineItems.filter(line => {
            const desc = (line.itemDescription || '').trim().toLowerCase();
            const spec = (line.specCode || '').trim().toLowerCase();
            return (normItemName && (desc.includes(normItemName) || normItemName.includes(desc))) ||
                   (normItemCode && spec && normItemCode === spec);
          });

          if (matchingLines.length > 0) {
            isMatch = true;
            matchingLines.forEach(l => {
              matchedQty += Number(l.qty) || 0;
              matchedAmt += Number(l.totalAmount) || ((Number(l.qty) || 0) * (Number(l.unitPrice) || poItem.unitPrice || 0));
            });
          }
        }

        // If no line items matched, check header-level col11 and col12
        if (!isMatch) {
          const col11Desc = (orderToCheck.col11 || '').trim().toLowerCase();
          const col12Spec = (orderToCheck.col12 || '').trim().toLowerCase();
          if (
            (normItemName && (col11Desc.includes(normItemName) || normItemName.includes(col11Desc))) ||
            (normItemCode && col12Spec && normItemCode === col12Spec)
          ) {
            isMatch = true;
            matchedQty = ship.effectiveQty;
            matchedAmt = ship.effectiveAmount || (ship.effectiveQty * poItem.unitPrice);
          }
        }

        if (isMatch) {
          matchCount++;
          // Convert unit if necessary (e.g. kg to ton)
          if (itemTargetUnit === 'ตัน' && ship.effectiveUnit === 'กก.') {
            itemDeliveredQty += Number((matchedQty / 1000).toFixed(3));
          } else {
            itemDeliveredQty += matchedQty;
          }
          itemDeliveredAmt += matchedAmt;
        }
      });
    }

    const itemOrderedQty = Number(poItem.orderedQty) || 1;
    const itemPercentage = Math.min(100, Math.round((itemDeliveredQty / itemOrderedQty) * 100));
    const itemRemainingQty = Math.max(0, Number((poItem.orderedQty - itemDeliveredQty).toFixed(2)));
    const itemRemainingAmt = Math.max(0, (poItem.totalAmount || (poItem.orderedQty * poItem.unitPrice)) - itemDeliveredAmt);

    let itemStatus: POStatus = 'pending';
    if (itemDeliveredQty >= itemOrderedQty) {
      itemStatus = 'completed';
    } else if (itemDeliveredQty > 0) {
      itemStatus = 'partially_delivered';
    }

    return {
      item: poItem,
      deliveredQty: Number(itemDeliveredQty.toFixed(2)),
      deliveredAmount: itemDeliveredAmt,
      remainingQty: itemRemainingQty,
      remainingAmount: itemRemainingAmt,
      percentageDelivered: itemPercentage,
      status: itemStatus,
      matchedOrdersCount: matchCount
    };
  });

  const totalOrderedQty = po.totalQty || 1;
  const quantityPercentageDelivered = Math.min(100, Math.round((deliveredQty / totalOrderedQty) * 100));
  const financialPercentageDelivered = po.totalAmount > 0 
    ? Math.min(100, Math.round((deliveredAmount / po.totalAmount) * 100))
    : quantityPercentageDelivered;

  // For multi-item POs, financial percentage is the true aggregate progress
  const percentageDelivered = isMultiItem ? financialPercentageDelivered : quantityPercentageDelivered;

  const remainingQty = Math.max(0, po.totalQty - deliveredQty);
  const remainingAmount = Math.max(0, po.totalAmount - deliveredAmount);
  const isOverDelivered = deliveredAmount > po.totalAmount || (!isMultiItem && deliveredQty > po.totalQty);

  // Derive status
  let status: POStatus = po.status;
  if (po.status !== 'cancelled') {
    if (isMultiItem) {
      const allCompleted = itemReconciliations.every(ir => ir.status === 'completed');
      const anyDelivered = itemReconciliations.some(ir => ir.deliveredQty > 0) || deliveredAmount > 0;
      if (allCompleted || deliveredAmount >= po.totalAmount) {
        status = 'completed';
      } else if (anyDelivered) {
        status = 'partially_delivered';
      } else {
        status = 'pending';
      }
    } else {
      if (deliveredQty <= 0) {
        status = 'pending';
      } else if (deliveredQty >= po.totalQty) {
        status = 'completed';
      } else {
        status = 'partially_delivered';
      }
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
    financialPercentageDelivered,
    quantityPercentageDelivered,
    isMultiItem,
    itemReconciliations,
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

