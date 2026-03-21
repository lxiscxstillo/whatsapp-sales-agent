import axios, { AxiosError } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

const wppClient = axios.create({
  baseURL: config.WPPCONNECT_URL,
  timeout: 8000,
});

export async function generateToken(): Promise<string> {
  // WPPConnect v2.x: POST /api/{session}/{secretKey}/generate-token (secretKey in path, no body)
  const { data } = await wppClient.post(
    `/api/${config.WPPCONNECT_SESSION}/${config.WPPCONNECT_SECRET_KEY}/generate-token`
  );
  return data.token as string;
}

export async function sendMessage(phone: string, text: string): Promise<void> {
  const token = await generateToken();

  // Normalize phone: ensure it ends with @c.us if not already
  const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
  const isLid = chatId.endsWith('@lid');

  try {
    await wppClient.post(
      `/api/${config.WPPCONNECT_SESSION}/send-message`,
      { phone: chatId, message: text, isGroup: false, isLid },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    const axiosErr = err as AxiosError;
    // 404 = WPPConnect cannot resolve @lid (WhatsApp privacy-mode) contacts via REST API.
    // Retrying is pointless — log warning and return gracefully so DB writes still complete.
    if (axiosErr.response?.status === 404) {
      logger.warn('WPPConnect @lid send skipped: 404 (privacy-mode contact not resolvable)', { phone });
      return;
    }
    // Single retry for transient errors (5xx, network timeouts)
    logger.warn('WPPConnect send failed, retrying once', { error: axiosErr.message, phone });
    const retryToken = await generateToken();
    await wppClient.post(
      `/api/${config.WPPCONNECT_SESSION}/send-message`,
      { phone: chatId, message: text, isGroup: false, isLid },
      { headers: { Authorization: `Bearer ${retryToken}` } }
    );
  }
}
