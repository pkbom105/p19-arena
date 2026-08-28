import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

// ตัวอย่างฟังก์ชันสร้าง Data URL รูปภาพ QR Code
export async function generatePromptPayQR(amount: number) {
  const mobileNumber = "0896993979"; // เบอร์พร้อมเพย์ หรือ เลขประจำตัวผู้เสียภาษี/บัตรประชาชน ของสนาม

  // 1. แปลงข้อมูลเป็น PromptPay EMV Standard Payload
  const payload = generatePayload(mobileNumber, { amount });

  // 2. แปลง Payload เป็น Data URL (นำไปแสดงในแท็ก <img src="..." /> ได้ทันที)
  const qrDataUrl = await QRCode.toDataURL(payload, {
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return qrDataUrl;
}
/**
 * สร้าง QR Code สำหรับอ้างอิงการจอง
 * รับข้อความ (เช่น รหัส/ข้อมูลการจอง) แล้วคืน Data URL สำหรับแสดงใน <img>
 */
export async function generateBookingQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    width: 280,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
