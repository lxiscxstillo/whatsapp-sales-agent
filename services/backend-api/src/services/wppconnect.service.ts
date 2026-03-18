import axios, { AxiosError } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

const wppClient = axios.create({
  baseURL: config.WPPCONNECT_URL,
  timeout: 8000,
});

export async function generateToken(): Promise<string> {
  const { data } = await wppClient.post(
    `/api/${config.WPPCONNECT_SESSION}/${config.WPPCONNECT_SECRET_KEY}/generate-token`
  );
  return data.token as string;
}

export async function sendMessage(phone: string, text: string): Promise<void> {
  const token = await generateToken();

  // Normalize phone: ensure it ends with @c.us if not already
  const chatId = phone.includes('@') ? phone : `${phone}@c.us`;

  try {
    await wppClient.post(
      `/api/${config.WPPCONNECT_SESSION}/send-message`,
      { phone: chatId, message: text, isGroup: false },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    // Single retry
    const axiosErr = err as AxiosError;
    logger.warn('WPPConnect send failed, retrying once', { error: axiosErr.message, phone });
    const retryToken = await generateToken();
    await wppClient.post(
      `/api/${config.WPPCONNECT_SESSION}/send-message`,
      { phone: chatId, message: text, isGroup: false },
      { headers: { Authorization: `Bearer ${retryToken}` } }
    );
  }
}
