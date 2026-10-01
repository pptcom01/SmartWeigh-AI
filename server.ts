import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable reverse proxy trust behind Cloud Run / AI Studio load balancers
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory rate limiting to prevent Denial-of-Service and Gemini API quota exhaustion
const scanRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const SCAN_WINDOW_MS = 60 * 1000; // 1-minute sliding window
const MAX_SCANS_PER_WINDOW = 20; // 20 requests per minute per IP

// Periodically purge expired rate-limit records every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of scanRateLimitMap.entries()) {
    if (now > record.resetTime) {
      scanRateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const rateLimitScan = (req: Request, res: Response, next: () => void) => {
  const clientIp = req.ip || (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
  const now = Date.now();
  const record = scanRateLimitMap.get(clientIp);

  if (!record || now > record.resetTime) {
    scanRateLimitMap.set(clientIp, { count: 1, resetTime: now + SCAN_WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_SCANS_PER_WINDOW) {
    const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return res.status(429).json({
      success: false,
      isTransient: true,
      error: `ระบบจำกัดการสแกนเอกสารไม่เกิน ${MAX_SCANS_PER_WINDOW} ครั้งต่อนาทีต่อผู้ใช้งาน กรุณารอ ${retryAfterSec} วินาทีแล้วลองใหม่อีกครั้ง`
    });
  }

  record.count++;
  next();
};

// Shared Gemini client instance
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

/**
 * Executes a Gemini request with automatic retry, timeout protection, and model fallback cascade
 * to gracefully handle transient 503 (high demand / unavailable), 429 (rate limit), and socket stalls.
 */
async function callGeminiWithResilience(ai: GoogleGenAI, requestPayload: any, overallTimeoutMs = 28000) {
  // Candidate fallback list: Primary 'gemini-3.8-flash', Fallback 1 'gemini-flash-latest', Fallback 2 'gemini-3.1-flash-lite'
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;
  const overallStartTime = Date.now();

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() - overallStartTime > overallTimeoutMs) {
        throw new Error('การประมวลผล Gemini Vision หมดเวลา (Request Timeout) เนื่องจากระบบต้นทางตอบสนองช้ากว่ากำหนด');
      }

      try {
        console.log(`[Gemini] Calling model ${model} (attempt ${attempt + 1})...`);

        // Enforce 16s per-attempt timeout using Promise.race
        const attemptCall = ai.models.generateContent({
          ...requestPayload,
          model: model
        });

        const attemptTimeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout: โมเดล ${model} ใช้เวลาเกิน 16 วินาที`)), 16000);
        });

        const response = await Promise.race([attemptCall, attemptTimeout]);
        return { response, usedModel: model };
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || JSON.stringify(err);
        const isTransient = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429') || errMsg.includes('Timeout');
        console.warn(`[Gemini Warning] Model ${model} attempt ${attempt + 1} failed: ${errMsg}`);
        
        if (isTransient && (Date.now() - overallStartTime + 1500 < overallTimeoutMs)) {
          // Wait briefly before retrying (1s, 2s)
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          break;
        }
      }
    }
  }

  throw lastError;
}

// Health & Status endpoint
app.get('/api/status', (req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  res.json({
    status: 'ok',
    hasKey,
    model: 'gemini-3.8-flash',
    timestamp: new Date().toISOString()
  });
});

// Bill & Order Scan Endpoint using Gemini 3.8 Flash Vision
app.post('/api/scan-bill', rateLimitScan, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/png', targetDocType = 'auto' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาส่งข้อมูลรูปภาพเอกสาร (imageBase64)'
      });
    }

    const ai = getGeminiClient();

    if (!ai) {
      return res.status(500).json({
        success: false,
        error: 'ระบบไม่พบ GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตรวจสอบการตั้งค่า'
      });
    }

    // Clean base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    let specificTargetInstructions = '';
    if (targetDocType && targetDocType !== 'auto') {
      if (targetDocType === 'purchase_order') {
        specificTargetInstructions = `
[คำสั่งพิเศษจากผู้ใช้งาน]: ผู้ใช้ระบุอย่างชัดเจนว่านี่คือ "ใบสั่งซื้อสินค้า (purchase_order / PO)":
- บังคับเด็ดขาดให้ตั้งค่า docType = 'purchase_order'
- โฟกัสสูงสุดที่:
  * col4: เลขที่ใบสั่งซื้อ (PO No.)
  * col7: วันที่ออก PO (YYYY-MM-DD)
  * col8: ชื่อร้านค้า / ผู้จำหน่าย (Vendor)
  * col9: ผู้สั่งซื้อ / โครงการ (Buyer)
  * col11: รายการสินค้าหลัก
  * col12: สเปก / Code
  * col22: จำนวนสั่งซื้อ
  * col23: หน่วยนับ (ชิ้น, เส้น, ถุง, ถัง, แผ่น, กล่อง, ม้วน, ชุด)
  * col24: ราคาต่อหน่วย
  * col25: รวมค่าสินค้า
  * col29: ยอดรวมทั้งสิ้น
  * col30: เครดิตเทอม / เงื่อนไขชำระเงิน
  * lineItems: รายการสินค้าสั่งซื้อทั้งหมดใน PO
  * โซน 3 และ 4 (น้ำหนักชั่งรถ): ใส่ 0`;
      } else if (targetDocType === 'weighbridge') {
        specificTargetInstructions = `
[คำสั่งพิเศษจากผู้ใช้งาน]: ผู้ใช้ระบุว่านี่คือ "ตั๋วชั่งน้ำหนักรถบรรทุก (weighbridge)":
- บังคับให้ตั้งค่า docType = 'weighbridge'
- โฟกัสสูงสุดที่:
  * col13: น้ำหนักชั่งเข้า/หนักต้นทาง (Gross) กก.
  * col14: น้ำหนักชั่งออก/เบาต้นทาง (Tare) กก.
  * col15: น้ำหนักสุทธิ (Net = หนัก - เบา) กก.
  * col10: ทะเบียนรถบรรทุก (เช่น 70-1234, 82-5678)
  * col8: โรงโม่หิน / ลานทราย / ผู้จำหน่าย
  * col11: รายการสินค้า (เช่น หินคลุก, หิน 1, หิน 2, ทรายหยาบ, ดินถม)
  * col22: ปริมาณเป็นตัน (แปลงจาก col15 กก. / 1000)
  * col23: หน่วย 'ตัน'
  * col6: เลขที่ตั๋วชั่ง
  * referenceDocNo: เลขที่ใบส่งของ (DO) ที่ตั๋วชั่งนี้อ้างอิงถึง (ตรวจหาอย่างละเอียด ไม่ว่าจะเป็นตัวพิมพ์ในช่องฟอร์ม เช่น เลขที่ DO/บิลส่งของ, บันทึกไว้ในช่องหมายเหตุ, หรือเขียนด้วยลายมือปากกาตรงไหนสักที่บนตั๋วชั่ง)
  * col4: เลขที่ใบสั่งซื้อ (PO หากมีระบุหรือเขียนลายมือไว้บนตั๋วชั่ง)
  * referenceSource: ระบุแหล่งที่พบเลขอ้างอิง ('form_field', 'notes', หรือ 'handwritten')
  * col38: หมายเหตุ (บันทึกข้อความอ้างอิงหรือลายมือที่พบบนตั๋วชั่ง)
  * col24, col25, col27, col28, col29: ราคา/ค่าบรรทุก (เฉพาะกรณีมีพิมพ์หรือเขียนระบุจริงบนตั๋วชั่ง หากไม่ระบุให้ใส่ 0 เพราะการคิดราคาจะคำนวณในระบบ RR)
  * โซน 6 (การชำระเงิน col30 - col36): ตั๋วชั่งเป็นเอกสารหน้างานไม่มีข้อมูลการเงิน ให้ใส่ 0 ทั้งหมด และ col30 ให้ใส่ '-'
  * โซน 4 (น้ำหนักปลายทาง col16, col17, col18, col19, col20, col21): ให้ใส่ 0 ทั้งหมด ห้ามคัดลอกตัวเลขจากโซน 3 มาใส่เด็ดขาด`;
      } else if (targetDocType === 'dest_weighbridge') {
        specificTargetInstructions = `
[คำสั่งพิเศษจากผู้ใช้งาน]: ผู้ใช้ระบุว่านี่คือ "ตั๋วชั่งน้ำหนักรถบรรทุกปลายทาง (dest_weighbridge)":
- บังคับให้ตั้งค่า docType = 'dest_weighbridge'
- เอกสารนี้คือตั๋วชั่งน้ำหนักหน้างานปลายทาง เพื่อนำไปจับคู่ลง [โซน 4]
- โฟกัสสูงสุดที่:
  * col17: เลขที่ตั๋วชั่งปลายทาง
  * col16: วันที่ชั่งปลายทาง (YYYY-MM-DD)
  * col18: น้ำหนักชั่งเข้าปลายทาง (Gross ปลายทาง) กก.
  * col19: น้ำหนักชั่งออกปลายทาง (Tare ปลายทาง) กก.
  * col20: น้ำหนักสุทธิปลายทาง (Net ปลายทาง = col18 - col19) กก.
  * col10: ทะเบียนรถบรรทุก (สำคัญมาก ใช้สำหรับจับคู่กับเที่ยวรถต้นทาง)
  * referenceDocNo: เลขที่ใบส่งของ หรือ เลขที่ตั๋วชั่งต้นทางที่อ้างอิงถึง
  * col6: เลขที่ตั๋วปลายทางนี้ (ใส่เลขเดียวกันกับ col17)
  * col7: วันที่ชั่ง (ใส่วันที่เดียวกันกับ col16)
  * col8: ผู้จำหน่าย / แหล่งสินค้าต้นทาง
  * col11: รายการสินค้า
  * col37: สถานที่ชั่งปลายทาง / ไซต์งาน
  * col38: หมายเหตุบนตั๋วชั่งปลายทาง
  * โซน 3 (col13, col14, col15): ใส่ 0 (เพราะเป็นตั๋วปลายทาง ไม่ใช่ต้นทาง)
  * โซน 5 และ 6: ใส่ 0`;
      } else if (targetDocType === 'delivery_order') {
        specificTargetInstructions = `
[คำสั่งพิเศษจากผู้ใช้งาน]: ผู้ใช้ระบุว่านี่คือ "ใบส่งสินค้า / ใบส่งของทั่วไป หรือ ใบส่งคอนกรีตผสมเสร็จ (delivery_order)":
- บังคับให้ตั้งค่า docType = 'delivery_order'
- โฟกัสสูงสุดที่:
  * col6: เลขที่ใบส่งของ / เลขที่ DO / ตั๋วส่งของ
  * col4: เลขที่ใบสั่งซื้อ (PO ที่อ้างถึง - ตรวจหาอย่างละเอียด: ไม่ว่าจะเป็นตัวพิมพ์ในช่องฟอร์ม PO, บันทึกไว้ในช่องหมายเหตุ, หรือเขียนด้วยลายมือปากกาตรงไหนสักที่บนใบส่งของ)
  * referenceDocNo: บันทึกเลขที่ PO ที่อ้างถึงนี้ด้วย
  * referenceSource: ระบุแหล่งที่พบเลขอ้างอิง ('form_field', 'notes', หรือ 'handwritten')
  * col7: วันที่ส่งมอบ (YYYY-MM-DD)
  * col8: ผู้จำหน่าย / ร้านค้า / แพลนท์คอนกรีต
  * col9: ผู้รับสินค้า / ผู้ซื้อ / โครงการ
  * col10: ทะเบียนรถ / เบอร์รถโม่ (หากมี)
  * col11: รายการสินค้าหลัก (เช่น เหล็ก, ปูน, คอนกรีตผสมเสร็จ, ท่อ, สี)
  * col12: สเปก / ขนาด / KSC / Slump
  * col22: ปริมาณสินค้า (เช่น จำนวนเส้น, ถุง, หรือคิว m3)
  * col23: หน่วยนับจริง (เส้น, ถุง, ถัง, แผ่น, กล่อง, ม้วน, ชุด, คิว)
  * col24: ราคาต่อหน่วย (หากมีพิมพ์ในบิลส่งของ)
  * col25: รวมค่าสินค้า (หากมี)
  * col29: รวมทั้งสิ้น (หากมี)
  * col38: หมายเหตุ (บันทึกข้อความอ้างอิงหรือลายมือที่พบ)
  * lineItems: รายการสินค้าทั้งหมดในใบส่งของ
  * โซน 6 (การชำระเงิน col30 - col36): ให้ใส่ 0 ทั้งหมด (เว้นแต่เป็นใบเสร็จรับเงิน/บิลเงินสดที่มีการชำระเงินแล้วจริง)
  * โซน 3 (น้ำหนักต้นทาง col13, col14, col15): สำหรับสินค้าทั่วไปที่ไม่ชั่งน้ำหนักให้ใส่ 0 แต่หากในเอกสารนี้มีตัวเลขตารางชั่งน้ำหนักรถบรรทุก เช่น Gross (หนักเข้า), Tare (เบาออก), Net (สุทธิ กก.) พิมพ์อยู่ด้วย ให้สกัดตัวเลขน้ำหนักจริงเข้า col13, col14, col15 ด้วยเสมอ
  * โซน 4 (น้ำหนักปลายทาง): ใส่ 0`;
      } else if (targetDocType === 'concrete') {
        specificTargetInstructions = `
[คำสั่งพิเศษจากผู้ใช้งาน]: ผู้ใช้ระบุว่านี่คือ "ใบส่งคอนกรีตผสมเสร็จ (delivery_order)":
- บังคับให้ตั้งค่า docType = 'delivery_order'
- โฟกัสสูงสุดที่:
  * col8: แพลนท์คอนกรีต / ผู้ผลิต (เช่น ซีแพค CPAC, นครหลวง, ทีพีไอ TPI)
  * col6: เลขที่ตั๋วคอนกรีต / DO
  * col10: ทะเบียนรถโม่ปูน / เบอร์รถ
  * col11: รายการคอนกรีตผสมเสร็จ
  * col12: กำลังอัด KSC (Cube/Cylinder) และค่ายุบตัว (Slump เช่น 10±2.5 ซม.)
  * col22: ปริมาณคอนกรีตเที่ยวนี้ (ตัวเลขเป็นคิว / m3)
  * col23: หน่วย ให้ใส่ 'คิว'
  * col24, col25, col29: ราคาต่อคิวและยอดเงินรวม (หากมี)
  * col37: ไซต์งาน / จุดเทคอนกรีต
  * โซน 3 และ 4: ใส่ 0`;
      } else if (targetDocType === 'tax_invoice') {
        specificTargetInstructions = `
[คำสั่งพิเศษจากผู้ใช้งาน]: ผู้ใช้ระบุว่านี่คือ "ใบเสร็จรับเงิน / ใบกำกับภาษี (tax_invoice)":
- บังคับให้ตั้งค่า docType = 'tax_invoice'
- โฟกัสสูงสุดที่:
  * col6: เลขที่ใบเสร็จ / เลขที่ใบกำกับภาษี
  * col7: วันที่ออกเอกสาร
  * col8: ชื่อบริษัทผู้ขาย / ร้านค้า
  * storeSuggestion.taxId: เลขประจำตัวผู้เสียภาษี 13 หลักของผู้ขาย
  * col11: รายการสินค้า/บริการ
  * col25: มูลค่าสินค้าก่อนภาษี (Subtotal)
  * col28: ค่าขนส่ง (หากมี)
  * col29: ยอดเงินรวมทั้งสิ้น (Grand Total รวม VAT)
  * col30: วิธีชำระเงิน (เงินสด/โอนเงิน/เช็ค)
  * col31: ยอดเงินที่ชำระแล้ว
  * col36: ยอดค้าง (หากยังไม่ชำระ)`;
      } else if (targetDocType === 'full_logistics') {
        specificTargetInstructions = `
[คำสั่งพิเศษจากผู้ใช้งาน]: ผู้ใช้ระบุว่านี่คือ "เอกสารโลจิสติกส์ 39 คอลัมน์เต็ม":
- บังคับให้ตั้งค่า docType = 'full_logistics'
- กรุณาสกัดข้อมูลครบถ้วนทั้ง 7 โซน (1 - 38)`;
      }
    }

    const promptText = `คุณคือผู้เชี่ยวชาญระดับสูงในการอ่านและสกัดข้อมูลเอกสารงานจัดซื้อและก่อสร้างของไทยทุกประเภท ทั้งสินค้าทั่วไปและสินค้าชั่งน้ำหนัก
${specificTargetInstructions}

${!specificTargetInstructions ? `กรุณาตรวจสอบรูปภาพเอกสารนี้อย่างละเอียด และระบุประเภทเอกสาร (docType) ให้ถูกต้อง:
- 'delivery_order': ใบส่งสินค้า / ใบส่งของทั่วไป (สินค้าจัดซื้อทั่วไปที่ไม่ชั่งน้ำหนัก เช่น เหล็ก, ท่อ, ปูนถุง, สี, ไม้, อุปกรณ์ช่าง, สายไฟ, กระเบื้อง, สุขภัณฑ์, อะไหล่ มีหน่วยนับเป็น เส้น/ท่อน/ถุง/ถัง/แผ่น/กล่อง/ม้วน/ชิ้น/ชุด)
- 'weighbridge': ตั๋วชั่งน้ำหนักรถบรรทุก (สินค้าเทกอง เช่น หิน, ดิน, ทราย, ยางมะตอย ที่มีตัวเลขน้ำหนัก Gross หนัก / Tare เบา / Net สุทธิ กก.)
- 'concrete': ใบส่งคอนกรีตผสมเสร็จ (ระบุเกรดคอนกรีต KSC, Slump, ปริมาณเป็นคิว/m3)
- 'tax_invoice': ใบเสร็จรับเงิน / ใบกำกับภาษีซื้อ (มีเลขผู้เสียภาษี 13 หลัก, ตาราง VAT 7%)
- 'purchase_order': ใบสั่งซื้อสินค้า (PO / Purchase Order ออกโดยฝ่ายจัดซื้อ มีตารางรายการสั่งซื้อ เงื่อนไขชำระ และช่องอนุมัติ)
- 'full_logistics': ตั๋วขนส่ง 39 คอลัมน์ชั่งต้นทาง-ปลายทาง` : ''}

จากนั้นสกัดข้อมูลตามคอลัมน์ที่เกี่ยวข้อง:
โซน 1: เอกสารอ้างอิงหลัก (col1: เลข TR, col2: โครงการ, col3: หมวดหมู่งาน, col4: เลขที่ PO ที่อ้างถึง, col5: เลขที่ RR, col6: เลขที่ DO / เลขที่ใบส่งของ)
โซน 2: วันที่ คู่ค้า & สินค้า (col7: วันที่ส่งของ YYYY-MM-DD, col8: ผู้จำหน่าย/ร้านค้า, col9: ผู้รับสินค้า/โครงการ, col10: ทะเบียนรถ (หากมี), col11: รายการสินค้าหลัก (หรือสรุปรายการทั้งหมด), col12: สเปก/Code)
โซน 3: น้ำหนักต้นทาง (col13: หนักต้นทาง กก., col14: เบาต้นทาง กก., col15: สุทธิต้นทาง กก. = หนัก - เบา) **หากไม่ใช่สินค้าชั่งน้ำหนักให้ใส่ 0**
โซน 4: ปลายทาง & ผลต่าง (col16: วันที่ปลายทาง, col17: ตั๋วปลายทาง, col18: หนักปลายทาง กก., col19: เบาปลายทาง กก., col20: สุทธิปลายทาง กก., col21: ผลต่าง กก.) **หากไม่ใช่สินค้าชั่งน้ำหนักให้ใส่ 0**
โซน 5: คิดเงิน & ปริมาณ (col22: ปริมาณสินค้าที่ส่งมอบ, col23: หน่วยนับจริง เช่น เส้น, ท่อน, ถุง, ถัง, แผ่น, กล่อง, ม้วน, ชุด, คิว, ตัน, col24: ราคาต่อหน่วย, col25: รวมค่าสินค้า = ปริมาณ * ราคา, col26: ประเภทรถ, col27: ค่าบรรทุก/หน่วย, col28: รวมค่าขนส่ง, col29: รวมทั้งสิ้น = ค่าสินค้า + ค่าขนส่ง)
โซน 6: การชำระเงิน (col30: รูปแบบจ่าย เช่น โอนเงิน/เงินสด/เครดิต 30 วัน, col31: จ่ายแล้ว, col32: ค้างผู้ขาย, col33: จ่ายขนส่งแล้ว, col34: ค้างขนส่ง, col35: ชำระแล้วรวม, col36: ยอดค้างรวม)
โซน 7: สถานที่ & หมายเหตุ (col37: สถานที่ส่ง/หน้างาน, col38: หมายเหตุ)

หากใบส่งของมีหลายรายการสินค้า ให้สกัดลงใน lineItems: [{ itemDescription, specCode, qty, unit, unitPrice, totalAmount }]
พร้อมสรุป storeSuggestion (ข้อมูลร้านค้า/คู่ค้า): name, category, taxId, phone, address, creditTerms

หมายเหตุสำคัญ:
- สินค้าทั่วไปที่ไม่มีการชั่งน้ำหนัก (เช่น ปูนถุง, เหล็ก, ท่อ, สี, สายไฟ) ให้ใส่หน่วยนับจริงใน col23 และใส่ค่าน้ำหนักในโซน 3 และ 4 เป็น 0 เสมอ
- ตรวจสอบความถูกต้องของการคำนวณราคาและยอดรวม`;

    const { response, usedModel } = await callGeminiWithResilience(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          },
          {
            text: promptText
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            docType: { 
              type: Type.STRING, 
              description: "ประเภทเอกสาร: 'delivery_order' (ใบส่งของสินค้าทั่วไปไม่ชั่งน้ำหนัก), 'weighbridge' (ตั๋วชั่งน้ำหนักหินดินทราย), 'concrete' (คอนกรีตผสมเสร็จ), 'tax_invoice' (ใบกำกับภาษี), 'purchase_order' (ใบสั่งซื้อ), หรือ 'full_logistics'" 
            },
            referenceDocNo: {
              type: Type.STRING,
              description: "เลขที่เอกสารอ้างอิง เช่น ตั๋วชั่งอ้างถึง DO เลขอะไร หรือ DO อ้างถึง PO เลขอะไร (ตรวจหาจากฟอร์มพิมพ์, ช่องหมายเหตุ หรือที่เขียนด้วยลายมือ)"
            },
            referenceSource: {
              type: Type.STRING,
              description: "แหล่งที่พบเลขอ้างอิง: 'form_field', 'notes', หรือ 'handwritten'"
            },
            col1: { type: Type.STRING, description: "1. เลข TR" },
            col2: { type: Type.STRING, description: "2. โครงการ" },
            col3: { type: Type.STRING, description: "3. หมวดหมู่" },
            col4: { type: Type.STRING, description: "4. PO" },
            col5: { type: Type.STRING, description: "5. RR" },
            col6: { type: Type.STRING, description: "6. DO / ตั๋ว" },
            col7: { type: Type.STRING, description: "7. วันที่ YYYY-MM-DD" },
            col8: { type: Type.STRING, description: "8. ผู้จำหน่าย / ร้านค้า" },
            col9: { type: Type.STRING, description: "9. ผู้รับเหมา / ผู้ซื้อ" },
            col10: { type: Type.STRING, description: "10. ทะเบียนรถ" },
            col11: { type: Type.STRING, description: "11. รายการสินค้า" },
            col12: { type: Type.STRING, description: "12. สเปก / Code" },
            col13: { type: Type.NUMBER, description: "13. หนักต้นทาง" },
            col14: { type: Type.NUMBER, description: "14. เบาต้นทาง" },
            col15: { type: Type.NUMBER, description: "15. สุทธิต้นทาง" },
            col16: { type: Type.STRING, description: "16. วันที่ปลายทาง" },
            col17: { type: Type.STRING, description: "17. ตั๋วปลายทาง" },
            col18: { type: Type.NUMBER, description: "18. หนักปลายทาง" },
            col19: { type: Type.NUMBER, description: "19. เบาปลายทาง" },
            col20: { type: Type.NUMBER, description: "20. สุทธิปลายทาง" },
            col21: { type: Type.NUMBER, description: "21. ผลต่าง กก." },
            col22: { type: Type.NUMBER, description: "22. ปริมาณ" },
            col23: { type: Type.STRING, description: "23. หน่วยนับจริง เช่น เส้น, ท่อน, ถุง, ถัง, แผ่น, กล่อง, ม้วน, ชุด, คิว, ตัน" },
            col24: { type: Type.NUMBER, description: "24. ราคา/หน่วย" },
            col25: { type: Type.NUMBER, description: "25. รวมค่าสินค้า" },
            col26: { type: Type.STRING, description: "26. ประเภทรถ" },
            col27: { type: Type.NUMBER, description: "27. ค่าบรรทุก/หน่วย" },
            col28: { type: Type.NUMBER, description: "28. รวมค่าขนส่ง" },
            col29: { type: Type.NUMBER, description: "29. รวมทั้งสิ้น" },
            col30: { type: Type.STRING, description: "30. รูปแบบจ่าย" },
            col31: { type: Type.NUMBER, description: "31. จ่ายผู้ขายแล้ว" },
            col32: { type: Type.NUMBER, description: "32. ค้างผู้ขาย" },
            col33: { type: Type.NUMBER, description: "33. จ่ายขนส่งแล้ว" },
            col34: { type: Type.NUMBER, description: "34. ค้างขนส่ง" },
            col35: { type: Type.NUMBER, description: "35. ชำระแล้วรวม" },
            col36: { type: Type.NUMBER, description: "36. ยอดค้างรวม" },
            col37: { type: Type.STRING, description: "37. สถานที่ส่ง/กม." },
            col38: { type: Type.STRING, description: "38. หมายเหตุ" },
            lineItems: {
              type: Type.ARRAY,
              description: "รายการสินค้าแต่ละรายการในใบส่งสินค้าหรือใบสั่งซื้อ",
              items: {
                type: Type.OBJECT,
                properties: {
                  itemDescription: { type: Type.STRING, description: "ชื่อสินค้า" },
                  specCode: { type: Type.STRING, description: "สเปก / ขนาด" },
                  qty: { type: Type.NUMBER, description: "จำนวน" },
                  unit: { type: Type.STRING, description: "หน่วยนับ" },
                  unitPrice: { type: Type.NUMBER, description: "ราคาต่อหน่วย" },
                  totalAmount: { type: Type.NUMBER, description: "จำนวนเงิน" }
                }
              }
            },
            storeSuggestion: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                taxId: { type: Type.STRING },
                phone: { type: Type.STRING },
                address: { type: Type.STRING },
                creditTerms: { type: Type.STRING }
              }
            }
          },
          required: ["col8", "col11"]
        }
      }
    });

    const textOutput = response.text || "{}";
    const parsedData = JSON.parse(textOutput);

    // Auto-calculate any un-calculated values
    const col13 = Number(parsedData.col13) || 0;
    const col14 = Number(parsedData.col14) || 0;
    if (!parsedData.col15 && col13 && col14) {
      parsedData.col15 = Math.max(0, col13 - col14);
    }
    const col18 = Number(parsedData.col18) || 0;
    const col19 = Number(parsedData.col19) || 0;
    if (!parsedData.col20 && col18 && col19) {
      parsedData.col20 = Math.max(0, col18 - col19);
    }
    if (parsedData.col15 && parsedData.col20) {
      parsedData.col21 = Number(parsedData.col15) - Number(parsedData.col20);
    }

    const qty = Number(parsedData.col22) || 0;
    const price = Number(parsedData.col24) || 0;
    if (!parsedData.col25 && qty && price) {
      parsedData.col25 = qty * price;
    }
    const freightRate = Number(parsedData.col27) || 0;
    if (!parsedData.col28 && qty && freightRate) {
      parsedData.col28 = qty * freightRate;
    }
    if (!parsedData.col29) {
      parsedData.col29 = (Number(parsedData.col25) || 0) + (Number(parsedData.col28) || 0);
    }

    // Strictly enforce user's selected document type over any AI hallucination/guessing
    if (targetDocType && targetDocType !== 'auto') {
      parsedData.docType = targetDocType === 'concrete' ? 'delivery_order' : targetDocType;
    }

    // Prevent Zone 4 (destination scale) from duplicating Zone 3 origin weights
    if (parsedData.docType !== 'full_logistics') {
      parsedData.col16 = '';
      parsedData.col17 = '';
      parsedData.col18 = 0;
      parsedData.col19 = 0;
      parsedData.col20 = 0;
      parsedData.col21 = 0;
    }

    // Ensure reference consistency for DO and Weighbridge
    if (parsedData.docType === 'delivery_order') {
      if (!parsedData.col4 && parsedData.referenceDocNo) {
        parsedData.col4 = parsedData.referenceDocNo;
      }
      if (!parsedData.col4 && parsedData.col38) {
        const poMatch = /(?:PO|ใบสั่งซื้อ|สั่งซื้อ|P[/.]?O[.]?|Ref(?:\s*PO)?|อ้างอิง(?:\s*PO)?|ตาม(?:\s*PO)?|สัญญา)\s*[:#№.\s-]*([A-Za-z0-9\-_/]+)/i.exec(parsedData.col38);
        if (poMatch && poMatch[1]) {
          parsedData.col4 = poMatch[1].trim();
          parsedData.referenceDocNo = poMatch[1].trim();
          if (!parsedData.referenceSource) parsedData.referenceSource = 'notes';
        }
      }
    } else if (parsedData.docType === 'weighbridge') {
      if (!parsedData.referenceDocNo && parsedData.col38) {
        const doMatch = /(?:DO|ใบส่งของ|บิลส่งของ|D[/.]?O[.]?|บิลเลขที่|บิล|Ref(?:\s*DO)?|อ้างอิง(?:\s*DO)?|ส่งตาม(?:\s*DO)?)\s*[:#№.\s-]*([A-Za-z0-9\-_/]+)/i.exec(parsedData.col38);
        if (doMatch && doMatch[1]) {
          parsedData.referenceDocNo = doMatch[1].trim();
          if (!parsedData.referenceSource) parsedData.referenceSource = 'notes';
        }
        const poMatch = /(?:PO|ใบสั่งซื้อ|สั่งซื้อ|P[/.]?O[.]?|Ref(?:\s*PO)?|อ้างอิง(?:\s*PO)?|ตาม(?:\s*PO)?|สัญญา)\s*[:#№.\s-]*([A-Za-z0-9\-_/]+)/i.exec(parsedData.col38);
        if (poMatch && poMatch[1]) {
          if (!parsedData.col4) parsedData.col4 = poMatch[1].trim();
          if (!parsedData.referenceSource) parsedData.referenceSource = 'notes';
        }
      }
      // If referenceDocNo starts with PO, also set col4
      if (parsedData.referenceDocNo && /^PO[\s\-_/]/i.test(parsedData.referenceDocNo) && !parsedData.col4) {
        parsedData.col4 = parsedData.referenceDocNo;
      }
    }

    return res.json({
      success: true,
      data: parsedData,
      storeSuggestion: parsedData.storeSuggestion,
      modelUsed: usedModel,
      notes: `สกัดข้อมูลสำเร็จผ่าน ${usedModel}`,
      confidence: 0.98
    });

  } catch (error: any) {
    console.error('Gemini Scan Error:', error);
    const errText = error?.message || JSON.stringify(error);
    const isOverloaded = errText.includes('503') || errText.includes('high demand') || errText.includes('UNAVAILABLE') || errText.includes('429');

    return res.status(isOverloaded ? 503 : 500).json({
      success: false,
      isTransient: isOverloaded,
      error: isOverloaded
        ? 'ขณะนี้เซิร์ฟเวอร์ AI ของ Google มีผู้ใช้งานหนาแน่นชั่วคราว (503 High Demand) กรุณากดปุ่ม "ลองใหม่อีกครั้ง"'
        : `การประมวลผล Gemini ผิดพลาด: ${error.message || 'ไม่สามารถวิเคราะห์ภาพได้'}`
    });
  }
});

// Purchase Order (ใบสั่งซื้อ / PO) Scan Endpoint
app.post('/api/scan-po', rateLimitScan, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/png' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาส่งข้อมูลรูปภาพเอกสารใบสั่งซื้อ (imageBase64)'
      });
    }

    const ai = getGeminiClient();

    if (!ai) {
      return res.status(500).json({
        success: false,
        error: 'ระบบไม่พบ GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตรวจสอบการตั้งค่า'
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const poPromptText = `คุณคือผู้เชี่ยวชาญการอ่านเอกสารใบสั่งซื้อ (Purchase Order / PO) ของไทย
กรุณาตรวจสอบเอกสารใบสั่งซื้อนี้ และสกัดข้อมูลออกมาเป็น JSON อย่างละเอียด:
1. poNumber: เลขที่ใบสั่งซื้อ (เช่น PO-2026-..., สั่งซื้อเลขที่ ...)
2. orderDate: วันที่สั่งซื้อ (รูปแบบ YYYY-MM-DD)
3. deliveryDueDate: กำหนดส่งมอบของ (รูปแบบ YYYY-MM-DD หากมี)
4. projectId: ชื่อโครงการ หรือหน่วยงานที่สั่งซื้อ
5. storeName: ชื่อผู้จำหน่าย / ผู้ขาย / ร้านค้า
6. category: หมวดหมู่วัสดุ (เช่น งานหิน/ทราย, งานเหล็ก, งานคอนกรีต, วัสดุก่อสร้างทั่วไป)
7. items: รายการสินค้าในตารางสั่งซื้อ ประกอบด้วย:
   - itemDescription: ชื่อรายการสินค้า
   - specCode: สเปก หรือรหัสสินค้า
   - orderedQty: ปริมาณที่สั่งซื้อ (ตัวเลข)
   - unit: หน่วยนับ (เช่น ตัน, คิว, เส้น, แผ่น, ชุด)
   - unitPrice: ราคาต่อหน่วย (บาท)
   - totalAmount: รวมเงินรายการนี้ (orderedQty * unitPrice)
8. totalAmount: ยอดเงินรวมทั้งสิ้นตามใบสั่งซื้อ
9. creditTerms: เงื่อนไขการชำระเงิน (เช่น เครดิต 30 วัน, เงินสด, โอนเงิน)
10. deliveryLocation: สถานที่จัดส่งสินค้า / ไซต์งาน
11. orderedBy: ผู้เปิดใบสั่งซื้อ / ผู้สั่ง
12. approvedBy: ผู้อนุมัติใบสั่งซื้อ
13. notes: เงื่อนไขหรือหมายเหตุเพิ่มเติม`;

    const { response, usedModel } = await callGeminiWithResilience(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          },
          {
            text: poPromptText
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            poNumber: { type: Type.STRING, description: "เลขที่ PO" },
            orderDate: { type: Type.STRING, description: "วันที่สั่งซื้อ YYYY-MM-DD" },
            deliveryDueDate: { type: Type.STRING, description: "กำหนดส่งมอบ" },
            projectId: { type: Type.STRING, description: "โครงการ" },
            storeName: { type: Type.STRING, description: "ชื่อผู้จำหน่าย / ร้านค้า" },
            category: { type: Type.STRING, description: "หมวดหมู่วัสดุ" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemDescription: { type: Type.STRING },
                  specCode: { type: Type.STRING },
                  orderedQty: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  totalAmount: { type: Type.NUMBER }
                },
                required: ["itemDescription", "orderedQty"]
              }
            },
            totalAmount: { type: Type.NUMBER, description: "ยอดเงินรวมทั้งสิ้น" },
            creditTerms: { type: Type.STRING, description: "เงื่อนไขชำระเงิน" },
            deliveryLocation: { type: Type.STRING, description: "สถานที่จัดส่ง" },
            orderedBy: { type: Type.STRING, description: "ผู้สั่งซื้อ" },
            approvedBy: { type: Type.STRING, description: "ผู้อนุมัติ" },
            notes: { type: Type.STRING, description: "หมายเหตุ" }
          },
          required: ["poNumber", "storeName"]
        }
      }
    });

    const parsedPO = JSON.parse(response.text || "{}");

    // Calculate total quantity and generate item IDs
    let totalQty = 0;
    let sumAmount = 0;
    const items = (parsedPO.items || []).map((it: any, index: number) => {
      const q = Number(it.orderedQty) || 0;
      const p = Number(it.unitPrice) || 0;
      const tot = it.totalAmount ? Number(it.totalAmount) : (q * p);
      totalQty += q;
      sumAmount += tot;
      return {
        id: `poi-${Date.now()}-${index}`,
        itemDescription: it.itemDescription || 'รายการสินค้า',
        specCode: it.specCode || '',
        orderedQty: q,
        unit: it.unit || 'หน่วย',
        unitPrice: p,
        totalAmount: tot
      };
    });

    parsedPO.items = items;
    parsedPO.totalQty = totalQty;
    if (!parsedPO.totalAmount || parsedPO.totalAmount === 0) {
      parsedPO.totalAmount = sumAmount;
    }

    return res.json({
      success: true,
      data: parsedPO,
      modelUsed: usedModel,
      notes: `สกัดข้อมูลใบสั่งซื้อสำเร็จผ่าน ${usedModel}`
    });

  } catch (error: any) {
    console.error('Gemini PO Scan Error:', error);
    const errText = error?.message || JSON.stringify(error);
    const isOverloaded = errText.includes('503') || errText.includes('high demand') || errText.includes('UNAVAILABLE') || errText.includes('429');

    return res.status(isOverloaded ? 503 : 500).json({
      success: false,
      isTransient: isOverloaded,
      error: isOverloaded
        ? 'ขณะนี้เซิร์ฟเวอร์ Gemini มีผู้ใช้งานหนาแน่นชั่วคราว (503 High Demand) กรุณากดปุ่ม "ลองใหม่อีกครั้ง"'
        : `การอ่านใบสั่งซื้อล้มเหลว: ${error.message || 'ไม่สามารถวิเคราะห์ข้อมูลเอกสารได้'}`
    });
  }
});

// Vite mounting & static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
