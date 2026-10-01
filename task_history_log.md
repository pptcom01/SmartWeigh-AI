# Task History Log — AutoStore & Order Management System

> บันทึกประวัติการแก้ไขโค้ดทุกครั้ง ก่อนส่งมอบงาน (ตามกฎข้อ 4)

---

## [2026-10-01] ระบบชนบิลอัจฉริยะ 3 ฝ่าย (3-Way Supply Chain Matching: PO ↔ DO ↔ ตั๋วชั่ง) และตรวจจับเลขอ้างอิงจากฟอร์ม/หมายเหตุ/ลายมือเขียน

- **วัตถุประสงค์งาน:**
  - **ปัญหาที่ 1 (Flat Single-Field Matching Limitation):** ฟังก์ชันชนบิลเดิมใน `poReconciliation.ts` ค้นหาเพียง `ord.col4 === po.poNumber` หากเป็นเอกสารตั๋วชั่งน้ำหนักที่ไม่ได้ลงเลข PO โดยตรง หรือเป็นใบส่งของที่เขียนเลข PO ไว้ในช่องหมายเหตุ (`col38`) หรือเขียนด้วยลายมือ ระบบจะไม่ชนบิลให้ ทำให้ตั๋วหลุดการตัดยอด
  - **ปัญหาที่ 2 (Supply Chain Hierarchy & Transitive Reference):** ในชีวิตจริง งานจัดซื้อวัสดุก่อสร้าง/สินค้าเทกองมีลำดับเอกสาร 3 ฝ่าย:
    1. **ใบสั่งซื้อ (PO):** ออกโดยผู้ซื้อ/ฝ่ายจัดซื้อ
    2. **ใบส่งของ (DO):** ออกโดยผู้ขาย ระบุเลขอ้างอิงไปยัง PO (พิมพ์ในฟอร์ม, ในหมายเหตุ หรือเขียนลายมือ)
    3. **ตั๋วชั่งน้ำหนัก (Weighbridge):** ออกโดยโรงโม่/ลานทราย/แท่นชั่ง **ซึ่งระบุเลขอ้างอิงไปยังใบส่งของ (DO)** เป็นหลัก
    เดิมระบบไม่มีการเชื่อมโยงข้ามขั้น (Transitive Matching: ตั๋วชั่ง ➔ DO ➔ PO) ทำให้ไม่สามารถตัดยอด PO จากตั๋วชั่งที่อ้างถึง DO ได้
  - **ปัญหาที่ 3 (Double Counting Risk):** หากใน PO เดียวกันมีทั้งใบส่งของ DO (เช่น 30 ตัน) และตั๋วชั่งน้ำหนัก (30.20 ตัน) หากนำปริมาณมาบวกกันทื่อๆ จะได้ 60.20 ตัน ทำให้ยอดส่งมอบเบิ้ล 2 เท่า
- **ส่วนช่วยคิด (Challenge & Critique):**
  - *ข้อแย้งที่ 1 (Strict Determinism vs Fuzzy Guessing):* การสกัดเลขอ้างอิงจากข้อความในช่องหมายเหตุหรือลายมือเขียน จะต้องใช้ Pattern Recognition ที่แม่นยำ (Deterministic Regex เช่น `PO-xxxx`, `DO-xxxx`, `ใบสั่งซื้อ...`, `บิลส่งของ...`) ห้ามใช้การสุ่มเดา (No Random Guessing) เพื่อไม่ให้ชนบิลผิดคู่
  - *ข้อแย้งที่ 2 (Quantity Deduplication via Paired Shipments):* ในหน้างานก่อสร้าง ตั๋วชั่งน้ำหนักคือเอกสารชั่งจริงที่ออกควบคู่กับใบส่งของ DO ดังนั้นเมื่อระบบตรวจพบ DO และ ตั๋วชั่งที่อ้างอิงถึงกัน ระบบต้องจัดกลุ่มเป็น **"ชุดส่งมอบที่จับคู่สมบูรณ์ (Matched Delivery Pair)"** โดยใช้น้ำหนักชั่งสุทธิที่แท้จริงจากตั๋วชั่งมาเป็นปริมาณตัดยอดจริง ไม่นำยอดมารวมซ้ำซ้อน
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `src/types.ts`:
     - เพิ่ม Interface `MatchedDeliveryShipment` สำหรับเก็บข้อมูลชุดส่งมอบ (DO + ตั๋วชั่ง) พร้อมระบุ `effectiveQty`, `effectiveAmount`, `matchType ('paired_do_wb' | 'do_only' | 'weighbridge_only')`, `referenceSource ('form_field' | 'notes' | 'handwritten')`, และ `linkedViaDocNo`
     - เพิ่ม `pairedShipments` ใน `POReconciliation`
  2. `src/utils/poReconciliation.ts`:
     - พัฒนาฟังก์ชัน `extractDocReferences` สกัดเลข PO และ DO จากข้อความหมายเหตุและลายมือเขียนด้วย Regular Expressions ที่รัดกุม
     - ยกระดับ `reconcilePO` รองรับ 3-Way Matching:
       - **Step 1 (Direct PO Match):** ชนบิลโดยตรงจาก `col4`, `referenceDocNo`, หรือหมายเหตุ/ลายมือใน `col38`
       - **Step 2 (Transitive DO Match):** ชนบิลตั๋วชั่งที่อ้างถึง DO เข้าสู่ PO ที่ DO นั้นสังกัดอยู่โดยอัตโนมัติ พร้อมบันทึก `linkedViaDocNo`
       - **Step 3 (Paired Shipment Deduplication):** รวม DO และตั๋วชั่งที่คู่กันเป็น Pair เดียว ป้องกันการนับยอดเบิ้ล 100%
  3. `server.ts` (Gemini AI Vision Extraction):
     - ปรับปรุงการสกัดและ Post-Processing ของ Gemini:
       - สำหรับ `delivery_order`: สกัดหาเลข PO ทั้งจากฟอร์ม, ช่องหมายเหตุ, และลายมือเขียน
       - สำหรับ `weighbridge`: สกัดหาเลข DO อ้างอิง และ/หรือเลข PO ทั้งจากฟอร์ม, หมายเหตุ, และลายมือ
  4. `src/components/VerifyModal.tsx`:
     - ในฟอร์มตั๋วชั่ง (`isWeighbridge`): เพิ่มช่อง **"🔗 เลขที่ใบส่งของ (DO) อ้างอิง"** อย่างเด่นชัด พร้อมตัวเลือกระบุแหล่งที่มา (📋 ฟอร์ม / 💬 หมายเหตุ / ✍️ ลายมือ) และ Dropdown เลือก DO ที่มีในระบบ
     - ในฟอร์มใบส่งของ (`isDeliveryOrder`): เพิ่มตัวเลือกระบุแหล่งที่มาของเลข PO (📋 ฟอร์ม / 💬 หมายเหตุ / ✍️ ลายมือ) และ Dropdown เลือก PO
     - บันทึก `referenceDocNo`, `referenceSource`, `linkedViaDocNo` ลงใน `OrderRecord`
  5. `src/components/PODetailModal.tsx`:
     - แสดงแถบกำกับสถานะการชนบิล 3 ฝ่าย พร้อม Badge บอกแหล่งที่มา (✍️ ลายมือเขียน, 💬 ในหมายเหตุ, 📋 ฟอร์มเอกสาร, 🔗 ผ่าน DO: xxxxx)
     - แสดงแถบสรุปชุดส่งมอบที่จับคู่ DO ↔ ตั๋วชั่ง
     - ในตาราง Candidate: แสดง Hint เลขอ้างอิงที่ตรวจพบในตั๋วที่ยังไม่ได้ชนบิล
  6. `src/components/TableView39Cols.tsx`:
     - แสดง Badge กำกับที่มาของเลข PO ในคอลัมน์ 4 (✍️ ลายมือ / 💬 หมายเหตุ / 🔗 ผ่าน DO)
     - แสดงเลขอ้างอิง DO ในคอลัมน์ 6 สำหรับตั๋วชั่ง
  7. `src/App.tsx`:
     - ส่ง `pos={pos}` และ `existingOrders={orders}` ให้กับ `VerifyModal`
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จ 100%
  - ผ่าน `lint_applet` (TypeScript strict noEmit) ปราศจาก Error 100%

---

## [2026-10-01] แยกฟอร์มกรอกข้อมูลตามประเภทเอกสาร/บิลจริง และแก้ไขปัญหาข้อมูลโซน 3 ซ้ำกับโซน 4 (Tailored Dynamic Forms & Elimination of Scale Weights Duplication)

- **วัตถุประสงค์งาน:**
  - **ปัญหาที่ 1 (Form Clutter & Lack of Categorization):** ฟอร์มตรวจทานและแก้ไขข้อมูลจริง (ฝั่งขวาของ Split-Screen ใน `VerifyModal.tsx`) เดิมยังแสดงข้อมูลทั้ง 39 คอลัมน์เต็มในทุกประเภทเอกสาร ทำให้เอกสารที่ไม่เกี่ยวข้องกับตราชั่ง (เช่น ใบส่งของ DO, คอนกรีต, ใบเสร็จ/ใบกำกับภาษี) ต้องเห็นช่องชั่งน้ำหนักรถบรรทุก ช่องค่าบรรทุกแยก และรหัสคลังสินค้าที่รกตา
  - **ปัญหาที่ 2 (Zone 3 vs Zone 4 Duplication):** ในเอกสารตั๋วชั่งน้ำหนัก (Weighbridge) ผู้ใช้พบว่าข้อมูลโซน 3 (น้ำหนักต้นทาง: หนักเข้า, เบาออก, สุทธิ) แสดงซ้ำกับโซน 4 (น้ำหนักปลายทาง: หนักปลายทาง, เบาปลายทาง, สุทธิปลายทาง) ทั้งที่ตั๋วชั่งน้ำหนัก 95% ในชีวิตจริงมีตราชั่งเพียงจุดเดียวจากโรงโม่ต้นทาง
  - **ปัญหาที่ 3 (PO Selection Workflow in VerifyModal):** เมื่อผู้ใช้สลับประเภทเอกสารเป็นใบสั่งซื้อ (PO) ในหน้าตรวจทาน ยังคงเห็นเป็นฟอร์มตั๋ว OrderRecord ทำให้สับสนกับระบบ PO ที่แท้จริง
- **ส่วนช่วยคิด (Challenge & Critique):**
  - *ข้อแย้งที่ 1 (Data Integrity vs UI Masking):* หาก "ตัดฟิลด์ทิ้งถาวร" แยกเป็น 4 หน้าฟอร์มที่แยกฐานข้อมูลกัน จะทำให้เกิดปัญหา Data Truncation ข้อมูลหล่นหายเวลาส่งออก Excel หรือเมื่อผู้ใช้ต้องการเปลี่ยนประเภทเอกสารในภายหลัง ทางออกที่ดีกว่าคือใช้ **"Dynamic Smart Contextual Masking"** คือในโหมดปกติ แสดงเฉพาะฟิลด์ที่สอดคล้องกับประเภทบิลนั้นจริง ๆ 100% แต่ยังคงเก็บลง `OrderRecord` และมีปุ่มเปิด "แสดงทุกฟิลด์ (ครบ 39 ช่อง)" สำหรับกรณีที่ผู้ใช้ต้องการดูครบทุกโซน
  - *ข้อแย้งที่ 2 (Origin Scale vs Destination Scale Conflict):* ในโครงการก่อสร้าง โซน 4 (น้ำหนักปลายทาง คอลัมน์ 16-21) มีไว้เฉพาะสำหรับหน้างานที่มีตราชั่งตรวจรับปลายทางเพื่อเทียบกับต้นทาง (หาผลต่างน้ำหนักตกหล่น col21) แต่การเปิดโซน 4 ค้างไว้ในตั๋วชั่งทั่วไป ทำให้ดูเหมือนมีน้ำหนักซ้ำซ้อน 2 ชุด ทางออกคือ **ซ่อนโซน 4 ออกจากมุมมองตั๋วชั่งปกติ 100%** และเพิ่มสวิตช์ทางเลือก *"หน้างานมีตราชั่งปลายทาง (เปิดบันทึกชั่งตรวจรับปลายทาง & ผลต่าง)"* หากไม่เปิด ระบบจะบังคับให้ค่าโซน 4 เป็น 0 ทั้งหมดเพื่อไม่ให้ข้อมูลซ้ำซ้อน
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `src/components/VerifyModal.tsx`:
     - เพิ่ม State `enableDestScale` (เริ่มต้นเป็น false สำหรับตั๋วชั่งทั่วไป)
     - สร้างการแสดงผลฟอร์มเฉพาะบิล (Tailored Dynamic Forms) เมื่อ `!showAllCols`:
       - **กรณีใบส่งของ (DO) / คอนกรีต:** แสดงเฉพาะเลขที่ DO, เลขที่ PO อ้างอิง, วันที่ส่งมอบ, โครงการ, ทะเบียนรถ, ผู้จำหน่าย, ผู้ซื้อ, รายการสินค้าหลัก, สเปก/Slump, ตารางรายการสินค้าย่อย (`lineItems`), ปริมาณ, หน่วยนับ, ราคา, ยอดรวมเงิน, เงื่อนไขชำระเงิน, สถานที่ส่งมอบ — **ซ่อนโซน 3 และโซน 4 (ตราชั่งรถบรรทุก) 100%**
       - **กรณีตั๋วชั่งน้ำหนัก (Weighbridge):** แสดงเลขที่ตั๋วชั่ง, PO, ทะเบียนรถบรรทุก, โรงโม่/ท่าทราย, ชนิดหิน/ทราย, **[โซน 3] น้ำหนักชั่งเข้า/ออก กก. พร้อมระบบคำนวณสุทธิและแปลงเป็นตันเข้าช่องที่ 22 อัตโนมัติ** — **ซ่อนโซน 4 เป็นค่าเริ่มต้น** พร้อมตัวเลือกเปิดเฉพาะเมื่อหน้างานมีตราชั่งปลายทางจริง
       - **กรณีใบเสร็จ/ใบกำกับภาษี (Tax Invoice):** แสดงเลขที่ใบกำกับภาษี, วันที่, เลขผู้เสียภาษี 13 หลัก, ผู้ขาย, ผู้ซื้อ, รายการสินค้า/บริการ, มูลค่าก่อนภาษี, ยอดรวมทั้งสิ้นรวม VAT, รูปแบบการชำระเงิน — **ซ่อนโซน 3, โซน 4, ข้อมูลรถบรรทุก และค่าขนส่ง 100%**
       - **กรณีใบสั่งซื้อ (PO):** แสดงแถบแจ้งเตือนพร้อมปุ่ม Action พิเศษ **"สลับไปเปิดหน้าต่างจัดการใบสั่งซื้อ (PO Edit View) ทันที"**
       - **โหมดครบ 39 ช่อง (`showAllCols`):** ยังคงรองรับการเปิดดูครบทั้ง 7 โซน (1 ถึง 38)
     - ใน `handleFormSubmit`: เมื่อ `!showWeightsDest` ให้ล้างค่า `col16, col17, col18, col19, col20, col21` เป็นค่าว่าง/0 อย่างเด็ดขาด ป้องกันข้อมูลตกค้างซ้ำซ้อน
  2. `src/App.tsx`:
     - เพิ่มฟังก์ชัน `handleSwitchVerifyToPO` เพื่อรองรับการสลับจาก VerifyModal ไปยัง POEditModal อย่างไร้รอยต่อ
     - ส่ง `onSwitchToPO={handleSwitchVerifyToPO}` ให้กับ `VerifyModal`
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จ 100%
  - ผ่าน `lint_applet` (TypeScript strict noEmit) ปราศจาก Error 100%

---

## [2026-10-01] ขยายคอลัมน์รายการสินค้าที่สั่งซื้อ และจัดลำดับความสำคัญปุ่มสแกน PO (Line Item Column Expansion & PO Scan Workflow Prioritization)

- **วัตถุประสงค์งาน:**
  - **ปัญหาที่ 1 (UI/UX - Line Item Column Too Narrow):** คอลัมน์ "ชื่อรายการสินค้า" ในฟอร์มตรวจทานและแก้ไขข้อมูล (Split Screen ฝั่งขวา) ใน `POEditModal.tsx` และ `VerifyModal.tsx` ถูกบีบจนเล็กมาก ทำให้ผู้ใช้มองไม่เห็นข้อความชื่อสินค้าที่ AI สแกนมา
  - **ปัญหาที่ 2 (Workflow Intent & Button Hierarchy):** ผู้ใช้สังเกตเห็นปุ่ม "เปิด PO ใหม่ทันที / เปิดใบสั่งซื้อใหม่" เด่นเกินไปในระบบ ซึ่งขัดแย้งกับโฟลว์ที่ต้องการเน้นการสแกนใบสั่งซื้อจากเอกสารจริงด้วย AI (PO Vision)
- **ส่วนช่วยคิด (Challenge & Critique):**
  - *ข้อแย้ง:* หากลบฟังก์ชันและปุ่มคีย์ PO มือออกไป 100% จะเกิดความเสี่ยงระดับวิกฤต (System Deadlock) หากเกิดกรณีเอกสาร PO ของฝ่ายจัดซื้อชำรุด มัว ขาด หรือเป็นการสั่งซื้อทางวาจา/ไลน์ที่ยังไม่มีใบจริง AI จะสแกนไม่ติด และผู้ใช้จะไม่สามารถนำเลข PO เข้าสู่ระบบเพื่อมารองรับการชนบิลกับตั๋วชั่งได้เลย
  - *ทางออกที่ดีกว่า:* ปรับ "สแกนใบสั่งซื้อด้วย AI" ให้เป็นปุ่มหลัก (Primary CTA - สีน้ำเงินเด่น) ทั้งใน Toolbar และ Empty State และลดระดับปุ่มคีย์ข้อมูลด้วยตนเองให้กลายเป็นปุ่มรอง (Secondary Fallback - สีเทาเรียบ) เพื่อเป็นทางเลือกฉุกเฉินเมื่อไม่มีรูปภาพ
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `src/components/POEditModal.tsx`:
     - ขยายขนาดหน้าต่าง Split Screen เป็น `max-w-[97vw] xl:max-w-[1650px]`
     - ปรับสัดส่วน Grid เป็นรูปภาพ 4 คอลัมน์ (`lg:col-span-4`) และฟอร์ม 8 คอลัมน์ (`lg:col-span-8`) เพิ่มพื้นที่ฝั่งขวาถึง 66%
     - ห่อตารางรายการสินค้าด้วย `overflow-x-auto` และกำหนด `min-w-[860px]`
     - ขยายคอลัมน์ "ชื่อรายการสินค้า *" ให้กว้าง `min-w-[280px]` พร้อมกำหนด Input `min-w-[260px]` ทำให้มองเห็นชื่อสินค้า สเปก และปริมาณได้ครบถ้วน ชัดเจน 100%
  2. `src/components/VerifyModal.tsx`:
     - เพิ่ม `overflow-x-auto`, `min-w-[640px]` และขยายคอลัมน์รายการสินค้าย่อยให้กว้าง `min-w-[220px]`
  3. `src/components/POManagementView.tsx`:
     - ปรับปุ่ม **"สแกนใบสั่งซื้อด้วย AI"** ขึ้นเป็นปุ่มหลักสีน้ำเงิน (`bg-blue-600`) ทั้งในแถบเครื่องมือและใน Empty State
     - ปรับปุ่ม **"คีย์ PO ด้วยตนเอง"** ลงมาเป็นปุ่มรองสีเทา พร้อม Tooltip กำกับว่า *"ใช้กรณีไม่มีภาพถ่ายเอกสารใบสั่งซื้อ หรือต้องการคีย์ข้อมูลด้วยตนเอง"*
  4. `src/components/StoreDetailModal.tsx`:
     - ปรับปุ่มจาก "เปิด PO ใหม่กับร้านนี้" เป็น **"บันทึก PO ร้านนี้"** พร้อมลดระดับเป็นปุ่มรอง
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%

---

## [2026-10-01] แก้ไขจุดอ่อนที่ 2, 3 และ 4 (Security Rate Limiting, Timeout Resilience, and Unit Mismatch/Conversion)

- **วัตถุประสงค์งาน:**
  - **จุดอ่อนที่ 2 (Security / API Protection):** ติดตั้ง Rate Limiting ควบคุมการเรียกใช้งาน API ป้องกันการยิงสคริปต์สแปมหรือ DoS ที่ทำให้เปลืองโควตา Gemini API พร้อมทั้งลด Payload Limit ให้เหมาะสม (15MB)
  - **จุดอ่อนที่ 3 (Latency / Timeout Resilience):** เพิ่ม Overall Timeout และ Per-attempt Timeout ให้ `callGeminiWithResilience` ใน `server.ts` พร้อมติดตั้ง `AbortController` และ Timeout Handling ฝั่ง Client (`ScanModal.tsx`, `POScanModal.tsx`) เพื่อหยุดการรอค้างและแจ้งเตือนผู้ใช้อย่างชัดเจน
  - **จุดอ่อนที่ 4 (Unit Mismatch & Unit Conversion):** แก้ปัญหาระบบจับคู่ส่งมอบสินค้า (Reconciliation) เมื่อหน่วยในตั๋วไม่ตรงกับ PO เช่น PO สั่งเป็น "ตัน" แต่ตั๋วชั่งเป็น "กก." ให้ระบบแปลงหน่วยอัตโนมัติ (1,000 กก. = 1 ตัน) และหากเป็นหน่วยที่ไม่สามารถแปลงได้ (เช่น กล่อง vs ชิ้น) ให้ระบบแจ้งเตือน Warning สีส้มใน UI อย่างชัดเจน
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `server.ts`:
     - ปรับ Body Parser limit จาก 30MB ลงเหลือ 15MB ป้องกัน Memory Spike
     - เพิ่ม Middleware `rateLimitScan` จำกัดการสแกนไม่เกิน 20 ครั้ง/นาที ต่อ Client IP
     - ใน `callGeminiWithResilience`: เพิ่ม `overallTimeoutMs = 28000` และ Per-attempt Timeout 16 วินาที ด้วย `Promise.race` ป้องกัน Express Connection ค้าง
     - ผูก `rateLimitScan` เข้ากับ Route `/api/scan-bill` และ `/api/scan-po`
  2. `src/components/ScanModal.tsx` & `src/components/POScanModal.tsx`:
     - เพิ่ม `AbortController` กำหนด Timeout 32 วินาทีในฝั่ง Client
     - ดักจับ `err.name === 'AbortError'` และแสดงข้อความภาษาไทยที่สุภาพและเข้าใจง่าย
  3. `src/types.ts`:
     - เพิ่มโครงสร้าง `ConvertedOrderUnitDetail`
     - เพิ่มฟิลด์ `primaryUnit?`, `hasUnitMismatch?`, `unitMismatchWarnings?`, `unitConversions?` ใน `POReconciliation`
  4. `src/utils/poReconciliation.ts`:
     - เพิ่มฟังก์ชัน `normalizeUnit` รวบรวมคำพ้องความหมายของหน่วยนับทั้งไทยและอังกฤษ
     - ปรับฟังก์ชัน `reconcilePO` ให้ทำการตรวจเช็คหน่วยนับ หาก PO เป็น "ตัน" และตั๋วเป็น "กก." ให้หาร 1,000 อัตโนมัติ พร้อมบันทึก Note
     - หากพบกรณีหน่วยสินค้าไม่ตรงกันและไม่สามารถแปลงได้ ให้เปิดแฟล็ก `hasUnitMismatch = true` พร้อมเก็บข้อความเตือน
  5. `src/components/PODetailModal.tsx`:
     - เพิ่มกล่องแจ้งเตือนสีส้ม `Unit Mismatch Alert` ด้านบนของแท็บตัดยอดส่งมอบ เมื่อตรวจพบตั๋วที่หน่วยไม่ตรงกับ PO
     - ในตารางตั๋วที่ผูกไว้: แสดงหน่วยที่แปลงแล้วพร้อมหมายเหตุการแปลง (หรือป้ายเตือนกรณีหน่วยไม่ตรง)
     - ระบุชื่อหน่วยใน 4 การ์ดสรุปตัวเลข (สั่งซื้อ ... ตัน, ส่งแล้ว ... ตัน, ค้าง ... ตัน)
  6. `src/components/POManagementView.tsx`:
     - แสดงป้าย `⚠️ หน่วยตั๋วไม่ตรง PO` ใต้แท่ง Progress Bar ของแถว PO ที่มีปัญหา
  7. `src/utils/excelExport.ts`:
     - อัปเดตการส่งออกชีต `ใบสั่งซื้อ_PO` ให้คำนวณยอดตัดส่งมอบสดจาก `reconcilePO` พร้อมระบุหน่วยนับและข้อความเตือนเมื่อมี Unit Mismatch
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%

---

## [2026-10-01] ทวนโค้ดทั้งระบบ วิเคราะห์สถาปัตยกรรม และ Challenge & Critique (Code Review & Architectural Audit)

- **สถานะ:** ทบทวนโครงสร้างทั้งระบบ (Code Review & Challenge & Critique) — ตรวจสอบครบทุก 20+ ไฟล์
- **ขอบเขตการทวน:** 
  1. Backend: `server.ts` (Express, Google GenAI SDK `@google/genai`, Fallback Cascade, Endpoints)
  2. Core Frontend: `src/App.tsx`, `src/types.ts`
  3. Utilities: `src/utils/excelExport.ts`, `src/utils/poReconciliation.ts`
  4. Components: `TableView39Cols.tsx`, `POManagementView.tsx`, `StoresManagementView.tsx`, `ScanModal.tsx`, `POScanModal.tsx`, `VerifyModal.tsx`, `PODetailModal.tsx`, `POEditModal.tsx`, `StoreDetailModal.tsx`, `StoreEditModal.tsx`, `StatSummaryCards.tsx`, `AnalyticsView.tsx`, `Header.tsx`
  5. Configs & Envs: `package.json`, `vite.config.ts`, `tsconfig.json`, `.env.example`, `metadata.json`

- **ผลการวิเคราะห์สถาปัตยกรรม (System Context):**
  - สถาปัตยกรรมปัจจุบันเป็น Single-Process Fullstack: Express รันบนพอร์ต 3000 ทำหน้าที่เป็น Reverse Proxy / API Gateway เรียก Gemini 3.8 Flash Vision และ Mount Vite Middlewares ในโหมด Dev พร้อม Static Serving ในโหมด Production
  - การจัดการข้อมูล (State Management): ใช้ Local State ใน `App.tsx` ผูกกับ Browser `localStorage` 3 ชุดข้อมูล (`autostore_real_orders_v2`, `autostore_real_stores_v2`, `autostore_real_pos_v2`)
  - การจับคู่เอกสาร (PO Reconciliation): ทำงานแบบ In-Memory Reconcile เชื่อมระหว่าง `OrderRecord.col4` และ `PurchaseOrder.poNumber`

- **ข้อบกพร่อง & จุดเสี่ยงเชิงโครงสร้าง (Challenge & Critique - 7 จุดสำคัญ):**
  1. **LocalStorage Quota Crash (Critical Bottleneck):** มีการเก็บ Image Base64 (ภาพเอกสารจริง) ลงใน `OrderRecord.image` และ `PurchaseOrder.image` ซึ่งเมื่อเซฟลง `localStorage` ขนาดเกิน 5MB จะเกิด `QuotaExceededError` ส่งผลให้ข้อมูลใหม่ไม่ถูกบันทึกและระบบหยุดทำงานเงียบๆ
  2. **Unauthenticated & Unbounded API Gateway (Security / Cost Vulnerability):** `/api/scan-bill` และ `/api/scan-po` รับ Payload ขนาด 30MB โดยไม่มีการตรวจสอบสิทธิ์ (Auth), Rate Limiting หรือ Captcha ทำให้ระบบเสี่ยงต่อการถูกยิงโจมตี (DoS) หรือสูญเสียค่าใช้จ่ายโควตา Gemini API อย่างรวดเร็ว
  3. **Data Sync Inconsistency (Dual Source of Truth):** ยอดสรุปการเงินของร้านค้า (`totalPurchases`, `totalDebt`) มี 2 แหล่ง — ใน UI มีการคำนวณสดจาก `OrderRecord` แต่ใน `excelExport.ts` กลับดึงจากฟิลด์ `s.totalPurchases` ในออบเจกต์ `StoreMerchant` โดยตรง ทำให้เมื่อมีการแก้ไขหรือลบรายการตั๋ว ยอดในไฟล์ Excel จะไม่ตรงกับยอดที่แสดงบนหน้าจอ
  4. **Stale Filter State in TableView39Cols:** การรับค่า `externalFilter` จากการคลิกการ์ด KPI ใน `App.tsx` ส่งให้ `TableView39Cols` ใช้ `useState(externalFilter || '')` เพียงครั้งเดียวตอน Mount ทำให้เมื่อผู้ใช้อยู่ในแท็บคำสั่งซื้อแล้วคลิกการ์ด KPI อื่น ฟิลเตอร์จะไม่เปลี่ยน
  5. **UI Semantic Mismatch ในหน้าร้านค้า:** ปุ่มบนการ์ดร้านค้าใน `StoresManagementView.tsx` มีป้ายข้อความว่า "เปิด PO" แต่ฟังก์ชันที่ผูกไว้คือ `onAddNewOrderForStore` ซึ่งเป็นการเปิดตั๋วชั่ง/ใบส่งของ (`OrderRecord`) ไม่ใช่การเปิดใบสั่งซื้อ (`PurchaseOrder`)
  6. **Hardcoded Mocked Value:** ใน `server.ts` มีการส่งค่า `confidence: 0.98` แบบคงที่ ไม่ได้สะท้อนความเชื่อมั่นจริงของโมเดล AI
  7. **Financial Rounding & Overwrite Edge Cases:** ใน `VerifyModal.tsx` การคำนวณภาษีและค่าชำระเงินยังไม่มีการล็อกกรณีผู้ใช้ป้อนยอดชำระแบบหัก ณ ที่จ่าย หรือกรณีตัวเลขทศนิยมปัดเศษไม่ตรงกับใบกำกับภาษีจริง

- **ไฟล์ที่เกี่ยวข้อง:** `task_history_log.md`

---

## [2026-10-01] พัฒนาระบบชนบิลตามเลขที่เอกสารอ้างอิง และระบบชนบิลด้วยตนเอง (Deterministic Document Matching & Manual Reconciliation)

- **วัตถุประสงค์งาน:**
  - ปรับระบบชนบิลของฝ่ายจัดซื้อให้ตรวจสอบความถูกต้องจาก "เลขที่เอกสารอ้างอิง (Document Reference Number)" เท่านั้น ไม่ใช้การเดาข้อมูล
  - เพิ่มฟังก์ชันและส่วนติดต่อผู้ใช้ (UI) สำหรับให้ผู้ใช้สามารถชนบิลด้วยตนเอง (Manual Matching) เมื่อตั๋วชั่งไม่มีการระบุเลข PO
  - แสดงภาพเอกสารใบสั่งซื้อต้นฉบับ (Scanned PO Image) และเพิ่มฟังก์ชันยกเลิกการชนบิล (Unlink)
  - แก้ไข Cascading Consistency: ซิงค์ฟิลเตอร์ KPI และคำนวณยอดร้านค้าแบบสดใน Excel Export
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `src/utils/poReconciliation.ts`:
     - เพิ่มฟังก์ชัน `normalizeDocNumber(docNo)` เพื่อตัด Whitespace, ขีด, สแลช และแปลงเป็นตัวพิมพ์ใหญ่ ช่วยแก้ปัญหา OCR Noise โดยยังคงเป็นการเช็คเลขเอกสารอ้างอิง 100%
     - ปรับ `reconcilePO` ให้ใช้ `normalizeDocNumber` ในการจับคู่ `OrderRecord.col4` กับ `PurchaseOrder.poNumber`
     - เพิ่มฟังก์ชัน `findCandidateUnlinkedOrders(po, orders)` เพื่อดึงตั๋วชั่งที่ยังไม่มีการผูก PO หรือตั๋วของคู่ค้ารายนั้น มาให้ผู้ใช้เลือกชนบิล
  2. `src/components/PODetailModal.tsx`:
     - เพิ่มตัวแสดงภาพเอกสารใบสั่งซื้อต้นฉบับ (`po.image`) ในแท็บเอกสาร
     - เพิ่มตาราง **"ตั๋วชั่งและบิลส่งของที่ยังไม่ได้ผูก PO (ผู้ใช้เลือกชนบิลด้วยตนเอง)"** พร้อมปุ่ม `+ ชนบิลเข้า PO นี้`
     - เพิ่มปุ่ม `ยกเลิกการชนบิล (Unlink)` ในตารางตั๋วที่ผูกไว้ เพื่อให้ผู้ใช้สามารถถอดการผูกได้หากผูกผิด
  3. `src/App.tsx`:
     - เพิ่มฟังก์ชัน `handleLinkOrderToPO(orderId, poNumber)` และ `handleUnlinkOrderFromPO(orderId)`
     - ส่งฟังก์ชันไปยัง `PODetailModal` เพื่ออัปเดต `col4` ของตั๋วและบันทึกผล
  4. `src/components/TableView39Cols.tsx`:
     - เพิ่ม `React.useEffect` ซิงค์ `externalFilter` เข้า `selectedStatus` แก้ปัญหากดการ์ด KPI แล้วฟิลเตอร์ไม่อัปเดต
  5. `src/components/StoresManagementView.tsx`:
     - แก้ไขป้ายปุ่มบนการ์ดร้านค้าจาก "เปิด PO" เป็น "ลงตั๋ว/บิล" ให้ตรงกับพฤติกรรมจริง
  6. `src/utils/excelExport.ts`:
     - ปรับให้คำนวณยอดร้านค้า (`totalPurchases`, `totalPaid`, `totalDebt`) สดจาก `orders` ก่อนเขียนลงไฟล์ Excel เพื่อไม่ให้ข้อมูลขัดแย้งกับหน้าจอ
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%

---

## [2026-10-01] ยกระดับระบบจัดซื้อให้ครอบคลุมสินค้าทั่วไปทุกชนิด (General Goods Recognition & Multi-item Line Items)

- **วัตถุประสงค์งาน:**
  - ปรับปรุงให้ระบบครอบคลุมสินค้าทุกชนิดในงานจัดซื้อ (เหล็ก, ท่อ, ปูนถุง, สี, ไม้, อุปกรณ์ช่าง, สายไฟ, กระเบื้อง, สุขภัณฑ์) ไม่จำกัดแค่สินค้าชั่งน้ำหนัก
  - ปรับ `server.ts` ให้ Gemini AI แยกแยะ `delivery_order (ใบส่งของสินค้าทั่วไป)`, `purchase_order (ใบสั่งซื้อ)`, `weighbridge (ตั๋วชั่ง)`, `concrete (คอนกรีต)`, `tax_invoice (ใบกำกับภาษี)` ได้อย่างเด็ดขาด
  - รองรับใบส่งสินค้าที่มีรายการย่อยหลายรายการ (Multi-line Items: `lineItems`)
  - รองรับการสแกนใบสั่งซื้อ (PO) จากหน้าแรก โดย AI จะตรวจจับว่าเป็น PO และนำเข้าสู่ระบบ PO อัตโนมัติ (Auto-Routing)
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `src/types.ts`:
     - เพิ่ม `purchase_order` เข้าใน `DocumentType`
     - เพิ่มอินเทอร์เฟซ `OrderItemDetail` และฟิลด์ `lineItems?: OrderItemDetail[]` ใน `OrderRecord`
  2. `server.ts`:
     - ปรับ `promptText` ให้เน้นการสกัดหน่วยนับจริงของสินค้าทั่วไป (เส้น, ท่อน, ถุง, ถัง, แผ่น, กล่อง, ม้วน, ชุด, คิว, ตัน)
     - เพิ่ม `purchase_order` และ `lineItems` ใน `responseSchema` ของ endpoint `/api/scan-bill`
  3. `src/components/ScanModal.tsx`:
     - ปรับข้อความของตัวเลือก `delivery_order` ให้อธิบายชัดเจนว่าเป็นสินค้าทั่วไปไม่ชั่งน้ำหนัก
     - เพิ่มตัวเลือก `purchase_order (ใบสั่งซื้อสินค้า PO)` ในรายการสแกน
  4. `src/components/VerifyModal.tsx`:
     - เพิ่มตารางแสดง `lineItems` (รายการสินค้าย่อยในใบส่งของ) เมื่อใบส่งของมีหลายรายการสินค้า
  5. `src/App.tsx`:
     - ใน `handleScanComplete`: เพิ่ม Logic ตรวจสอบว่าถ้า AI อ่านได้ว่าเป็น `purchase_order` ให้อัปเดตและเปิดหน้าบันทึก PO (`POEditModal`) ทันทีโดยไม่ต้องสับสนกับตั๋วชั่ง
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%

---

## [2026-10-01] ปรับปรุงโฟลว์เลือกประเภทเอกสาร 4 เสาหลัก และลำดับขั้นตอนสแกน (Document Selection & Sequential Workflow)

- **วัตถุประสงค์งาน:**
  - ยุบรวมและจัดระเบียบประเภทเอกสารให้เหลือ 4 กลุ่มหลักตามโครงสร้างจัดซื้อจริง: 1. PO, 2. DO (รวมคอนกรีตผสมเสร็จและสินค้าทั่วไป), 3. ตั๋วชั่งน้ำหนัก, 4. ใบเสร็จ/กำกับภาษี
  - จัดลำดับขั้นตอน (Sequential Flow): ให้ผู้ใช้ **เลือกประเภทเอกสารในขั้นตอนที่ 1 ก่อน** แล้วจึง **ถ่ายภาพหรืออัปโหลดเอกสารในขั้นตอนที่ 2**
  - เพิ่มปุ่มถ่ายภาพด้วยกล้องจริง (`📷 ถ่ายภาพด้วยกล้อง`) พร้อมแท็กระบุโหมดเอกสารที่กำลังสแกน
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `src/components/ScanModal.tsx`:
     - ปรับโครงสร้าง `DOC_TYPE_OPTIONS` ให้เหลือ 4 กลุ่มหลัก + ตัวเลือกตรวจจับอัตโนมัติ (Auto-Detect)
     - รวมคอนกรีตผสมเสร็จ (คิว/KSC/Slump) เข้าไว้ในกลุ่ม `delivery_order (ใบส่งของ DO)`
     - จัดสเต็ปชัดเจน: ขั้นตอนที่ 1 (เลือกประเภทเอกสาร) ➔ ขั้นตอนที่ 2 (ถ่ายภาพ/อัปโหลดไฟล์)
     - เพิ่มปุ่มเรียกกล้องมือถือ (`capture="environment"`)
  2. `src/components/VerifyModal.tsx`:
     - ปรับปุ่มเลือกประเภทเอกสารด้านบนของหน้าต่างตรวจสอบให้สอดคล้องกับ 4 กลุ่มหลัก (PO, DO, ตั๋วชั่ง, ใบเสร็จ/กำกับภาษี)
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%

---

## [2026-10-01] แก้ไขข้อผิดพลาด AI ทายประเภทเอกสารทับการเลือกของผู้ใช้ (User Intent Overrides AI Guessing)

- **สาเหตุของปัญหาที่พบ:**
  - เมื่อผู้ใช้เลือกประเภทเอกสารล่วงหน้า (เช่น ใบสั่งซื้อ หรือ ใบส่งของ) แต่ใน `server.ts` หลัง Gemini วิเคราะห์ภาพเสร็จ ไม่ได้บังคับกำหนด `parsedData.docType = targetDocType` ทำให้ผลลัพธ์การคาดเดาของ AI (ซึ่งอาจวิเคราะห์ผิด) ไปเขียนทับเจตนาที่ผู้ใช้เลือกไว้
  - ใน `server.ts` ยังขาดเงื่อนไขคำสั่งพิเศษสำหรับ `targetDocType === 'purchase_order'` ทำให้ AI ไม่ได้รับคำสั่งเจาะจงเมื่อผู้ใช้เลือกใบสั่งซื้อ
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `server.ts`:
     - เพิ่มเงื่อนไข `targetDocType === 'purchase_order'` ใน `specificTargetInstructions` เพื่อให้ AI มุ่งสกัดฟิลด์ PO โดยเฉพาะ
     - ใส่คำสั่งเด็ดขาด: เมื่อผู้ใช้ระบุ `targetDocType && targetDocType !== 'auto'` ระบบจะบังคับ `parsedData.docType = targetDocType` เสมอ ห้าม AI คาดเดาเปลี่ยนเป็นประเภทอื่น
  2. `src/components/ScanModal.tsx`:
     - ใน Callback `onScanComplete`: ทำการบังคับ `docType: enforcedDocType` โดยยึดตามที่ผู้ใช้เลือกไว้เสมอ ป้องกันการหลุดของ State
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%

---

## [2026-10-01] ยกระดับหน้าจอตรวจสอบแบบแบ่ง 2 ฝั่ง (Split-Screen: ภาพซ้าย - ฟอร์มขวา) ทั้งระบบ

- **วัตถุประสงค์งาน:**
  - ให้ระบบแสดงผลแบบแบ่งครึ่งหน้าจอ (Split-Screen) อย่างสมบูรณ์: **ภาพเอกสารต้นฉบับอยู่ฝั่งซ้าย (พร้อมปุ่มย่อ/ขยาย)** และ **ฟอร์มกรอกข้อมูลอยู่ฝั่งขวา** เพื่อให้ผู้ใช้สามารถตรวจสอบความถูกต้องของข้อมูลเทียบกับภาพจริงตาต่อตาได้ก่อนกดบันทึก
  - รองรับทั้งเอกสาร **ใบส่งของ (DO), ตั๋วชั่งรถบรรทุก, ใบเสร็จรับเงิน/ใบกำกับภาษี** ใน `VerifyModal.tsx`
  - ขยายการรองรับ Split-Screen ไปยัง **ใบสั่งซื้อสินค้า (PO)** ใน `POEditModal.tsx` เมื่อมีการสแกนหรือแนบภาพต้นฉบับ
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. `src/components/VerifyModal.tsx`:
     - คงโครงสร้าง Split-Screen ฝั่งซ้าย (5 คอลัมน์) สำหรับดูภาพเอกสาร พร้อมระบบ Zoom In, Zoom Out, Reset และฝั่งขวา (7 คอลัมน์) สำหรับฟอร์มตรวจทานแบบจัดโซน
  2. `src/components/POEditModal.tsx`:
     - เพิ่มตัวควบคุม Zoom และกล่องแสดงภาพใบสั่งซื้อต้นฉบับทางฝั่งซ้าย (`md:col-span-5`)
     - จัดฟอร์มกรอกข้อมูล PO ทางฝั่งขวา (`md:col-span-7`) เมื่อมีภาพแนบ
     - ขยายขนาดหน้าต่างเป็น `max-w-7xl` เพื่อให้ผู้ใช้ตรวจทานข้อมูลในตารางสั่งซื้อเทียบกับบิลจริงได้อย่างสบายตา
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%

---

## [2026-10-01] เพิ่มเครื่องมือหมุนภาพ 90° และครอปภาพ (Rotate & Crop Tool with Canvas Processing)

- **วัตถุประสงค์งาน:**
  - เพิ่มเครื่องมือจัดการภาพถ่ายทางฝั่งซ้ายของหน้าจอ Split-Screen ให้ผู้ใช้สามารถ:
    1. **หมุนภาพ 90° ตามเข็มนาฬิกา (Rotate 90°):** ปรับทิศทางภาพที่ถ่ายมาตะแคงหรือกลับหัวให้ตั้งตรง
    2. **ครอปภาพ (Crop Tool):** ลากกรอบสี่เหลี่ยมเพื่อตัดขอบโต๊ะ พื้นกระเบื้อง หรือส่วนเกินที่ไม่เกี่ยวข้องออก
    3. **บันทึกภาพจริง (Baked Canvas Processing):** เมื่อกดบันทึก ภาพที่จัดเก็บลงระบบจะเป็นไฟล์ภาพที่ผ่านการหมุนและตัดขอบจริง ไม่ใช่แค่การหมุน CSS
    4. **ปุ่มคืนค่าเดิม (Undo/Reset Original):** สามารถกดคืนค่ากลับสู่ภาพต้นฉบับเดิมได้ทุกเมื่อหากตัดผิดพลาด
- **การเปลี่ยนแปลงที่ทำแบบเจาะจง (Targeted Changes):**
  1. สร้าง `src/components/ImageDocViewer.tsx`:
     - คอมโพเนนต์จัดการภาพเอกสารระดับมืออาชีพ พร้อม Canvas rendering สำหรับตัดและหมุนภาพจริง
     - แถบเครื่องมือควบคุม: หมุน 90°, เครื่องมือครอปพร้อมกรอบ 9 จุดและมุมปรับขนาด, ซูมเข้า/ออก, รีเซ็ต
  2. `src/components/VerifyModal.tsx`:
     - เปลี่ยนมาใช้ `ImageDocViewer` ในฝั่งซ้าย พร้อมส่งต่อ Base64 ที่ผ่านการครอป/หมุนไปจัดเก็บบน `finalizedOrder.image`
  3. `src/components/POEditModal.tsx`:
     - นำ `ImageDocViewer` ไปใช้กับหน้าต่างตรวจสอบใบสั่งซื้อ (PO) ด้วยเช่นกัน
- **การตรวจสอบผล:**
  - ผ่าน `compile_applet` สำเร็จสมบูรณ์
  - ผ่าน `lint_applet` (TypeScript strict noEmit) 100%





