import axios from 'axios';
import crypto from 'crypto';
require('dotenv').config();

const telegramAjax = axios.create({
  baseURL: 'https://api.telegram.org/',
  responseType: 'json',
  withCredentials: false,
})

export async function telegramNotify(text: string, channelId = '576920941') {
  const telegramToken = process.env.TELEGRAM_TOKEN ?? '1367437609:AAFLfuZZ-DZxlqLPgTzSfP8Mby5ntXh3EYQ';
  return telegramAjax.get('bot' + telegramToken + '/sendMessage?chat_id=' + channelId + '&text=' + encodeURIComponent(text));
}


const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'ylgr_broken_whale@encryt_key@238'; // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

export function encrypt(text:string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text:string) {
  const textParts = text.split(':');
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

export function createUniqueId(id: number | undefined) {
  return 'broken_whale_test_' + id
}

export function floorNumberByDecimals(number: number, decimal: number) {
  const roundScale = Math.pow(10, decimal)
  return Math.floor(number * roundScale) / roundScale
}

export function roundNumberByDecimals(number: number, decimal: number) {
  const roundScale = Math.pow(10, decimal)
  return Math.round(number * roundScale) / roundScale
}