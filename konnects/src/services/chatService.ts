/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { askAI } from './geminiService';

const PII_REGEX = {
  phone: /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
};

export async function sendMessageSafely(senderId: string, recipientId: string, text: string) {
  try {
    // 1. Quick regex check for standard UK patterns
    let filteredText = text;
    const hasPII = PII_REGEX.phone.test(text) || PII_REGEX.email.test(text);

    if (hasPII) {
       filteredText = "[Communication Policy: Personal contact details are not allowed for safety. Please use the app chat.]";
    } else {
       // 2. AI Check for subtle PII sharing
       const aiCheck = await askAI(`Does this message attempt to share personal contact info, private address, or move the conversation off-app? Answer only 'YES' or 'NO'. Message: "${text}"`);
       if (aiCheck?.toUpperCase().includes('YES')) {
         filteredText = "[Message blocked for safety. Please avoid sharing personal details.]";
       }
    }

    const roomId = [senderId, recipientId].sort().join('_');

    const docData = {
      roomId,
      senderId,
      recipientId,
      participants: [senderId, recipientId],
      text: filteredText,
      timestamp: serverTimestamp()
    };

    await addDoc(collection(db, 'chats'), docData);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'chats');
    return false;
  }
}
