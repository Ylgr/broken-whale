import axios from 'axios';
import crypto from 'crypto';
require('dotenv').config();

const telegramAjax = axios.create({
  baseURL: 'https://api.telegram.org/',
  responseType: 'json',
  withCredentials: false,
})

export async function telegramNotify(text: string, channelId = process.env.DEFAULT_TELEGRAM_CHANNEL_ID) {
  const telegramToken = process.env.TELEGRAM_TOKEN;
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
  return 'broken_whale_' + id
}

export function floorNumberByDecimals(number: number, decimal: number) {
  const roundScale = Math.pow(10, decimal)
  return Math.floor(number * roundScale) / roundScale
}

export function roundNumberByDecimals(number: number, decimal: number) {
  const roundScale = Math.pow(10, decimal)
  return Math.round(number * roundScale) / roundScale
}

function decimalPlaces(num: number) {
  const match = (''+num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) { return 0; }
  return Math.max(
    0,
    // Number of digits right of decimal point.
    (match[1] ? match[1].length : 0)
    // Adjust for scientific notation.
    - (match[2] ? +match[2] : 0));
}

export function floorNumberByRef(number: number, refDecimalNumber: string | undefined) {
  if (typeof refDecimalNumber === 'string') {
    const decimal = decimalPlaces(parseFloat(refDecimalNumber));
    const roundScale = Math.pow(10, decimal)
    return Math.floor(number* roundScale)/roundScale
  } else return 0
}
