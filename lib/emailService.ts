import emailjs from "@emailjs/browser";

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

// 2 templates: unified (alert + offline) and daily report
const TEMPLATE_UNIFIED = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ALERT || "";
const TEMPLATE_DAILY = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_DAILY || "";

function isConfigured() {
  return Boolean(SERVICE_ID && PUBLIC_KEY);
}

export type SensorAlertData = {
  sensorName: string;
  value: string;
  threshold: string;
  unit: string;
  timestamp: string;
  type: "high" | "low";
};

export type DailyReportData = {
  date: string;
  sensors: Array<{
    name: string;
    min: string;
    max: string;
    avg: string;
    alertCount: number;
  }>;
  totalAlerts: number;
  uptimePercent: number;
};

export type OfflineAlertData = {
  timestamp: string;
  lastValues: Record<string, string>;
  rssi: string;
};

export async function sendSensorAlert(data: SensorAlertData, toEmail: string) {
  if (!isConfigured() || !TEMPLATE_UNIFIED) return false;

  const alertType = data.type === "high" ? "HIGH (exceeded max)" : "LOW (below min)";
  const messageBody = `Sensor: ${data.sensorName}\nCurrent Value: ${data.value} ${data.unit}\nThreshold: ${data.threshold}\nType: ${alertType}`;

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_UNIFIED, {
      to_email: toEmail,
      subject_line: `Sensor Alert - ${data.sensorName}`,
      alert_type: "Sensor Alert",
      message_body: messageBody,
      timestamp: data.timestamp
    }, PUBLIC_KEY);
    return true;
  } catch (error) {
    console.error("[EmailService] sendSensorAlert failed:", error);
    return false;
  }
}

export async function sendDailyReport(data: DailyReportData, toEmail: string) {
  if (!isConfigured() || !TEMPLATE_DAILY) return false;

  const sensorRows = data.sensors
    .map((s) => `${s.name}: Min=${s.min}, Max=${s.max}, Avg=${s.avg}, Alerts=${s.alertCount}`)
    .join("\n");

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_DAILY, {
      to_email: toEmail,
      report_date: data.date,
      sensor_data: sensorRows,
      total_alerts: String(data.totalAlerts),
      uptime: `${data.uptimePercent}%`
    }, PUBLIC_KEY);
    return true;
  } catch (error) {
    console.error("[EmailService] sendDailyReport failed:", error);
    return false;
  }
}

export type ContactInquiryData = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

export async function sendContactInquiry(data: ContactInquiryData) {
  if (!isConfigured() || !TEMPLATE_UNIFIED) return false;

  const messageBody = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    ``,
    `Message:`,
    data.message
  ].join("\n");

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_UNIFIED, {
      to_email: "jamalousidi2007@gmail.com",
      subject_line: `New Inquiry from ${data.name}`,
      alert_type: "Contact Inquiry",
      message_body: messageBody,
      timestamp: new Date().toLocaleString()
    }, PUBLIC_KEY);
    return true;
  } catch (error) {
    console.error("[EmailService] sendContactInquiry failed:", error);
    return false;
  }
}

export async function sendDeviceOfflineAlert(data: OfflineAlertData, toEmail: string) {
  if (!isConfigured() || !TEMPLATE_UNIFIED) return false;

  const lastValuesText = Object.entries(data.lastValues)
    .map(([key, val]) => `${key}: ${val}`)
    .join("\n");

  const messageBody = `Disconnect Time: ${data.timestamp}\nLast RSSI: ${data.rssi}\nLast Values:\n${lastValuesText}`;

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_UNIFIED, {
      to_email: toEmail,
      subject_line: "Device Offline!",
      alert_type: "Device Disconnected",
      message_body: messageBody,
      timestamp: data.timestamp
    }, PUBLIC_KEY);
    return true;
  } catch (error) {
    console.error("[EmailService] sendDeviceOfflineAlert failed:", error);
    return false;
  }
}
