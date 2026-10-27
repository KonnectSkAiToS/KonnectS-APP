/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function appendUserToGoogleSheets(user: any, accessToken: string) {
  try {
    console.log('[Sheets Service] Commencing sync of user authentication details to Google Sheets...');
    
    // Retrieve or create designated spreadsheet ID from Firestore /admin/sheets_config
    const docRef = doc(db, 'admin', 'sheets_config');
    const docSnap = await getDoc(docRef);
    let spreadsheetId = '';

    if (docSnap.exists()) {
      spreadsheetId = docSnap.data().spreadsheetId;
    }

    if (!spreadsheetId) {
      // Create new Google Sheet using Google Sheets API
      console.log('[Sheets Service] No designated spreadsheet found. Spawning a new spreadsheet via Google Workspace...');
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: 'Konnects User Signups'
          },
          sheets: [
            {
              properties: {
                title: 'UserSignups'
              }
            }
          ]
        })
      });

      if (!createRes.ok) {
        throw new Error(`Failed to dynamically create Google Sheet: ${createRes.statusText}`);
      }

      const createData = await createRes.json();
      spreadsheetId = createData.spreadsheetId;

      // Save it back to Firestore so all admins can access it
      await setDoc(docRef, { spreadsheetId, createdAt: new Date().toISOString() });
      console.log('[Sheets Service] Dynamically created "Konnects User Signups" spreadsheet:', spreadsheetId);

      // Append header row first
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/UserSignups!A1:E1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: 'UserSignups!A1:E1',
          majorDimension: 'ROWS',
          values: [['UID', 'Email', 'Username', 'Timestamp', 'Sign-up Method']]
        })
      });

      // Log action to activity_logs
      await addDoc(collection(db, 'activity_logs'), {
        action: `Dynamically provisioned Google Spreadsheet: ${spreadsheetId}`,
        targetUser: 'System',
        adminEmail: 'admin@konnects.co.uk',
        timestamp: serverTimestamp(),
        status: 'success'
      });
    }

    // Append user row
    const rowValues = [
      user.uid,
      user.email || 'N/A',
      user.displayName || user.email?.split('@')[0] || 'User',
      new Date().toISOString(),
      'Google Auth'
    ];

    console.log('[Sheets Service] Appending row to sheet:', rowValues);

    const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/UserSignups!A:E:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    });

    if (appendRes.ok) {
      console.log('[Sheets Service] Appended details of user successfully to spreadsheet:', user.email);
      // Log action to activity_logs
      await addDoc(collection(db, 'activity_logs'), {
        action: `Synced user sign-up details to Google Sheet`,
        targetUser: user.email || 'User',
        adminEmail: 'admin@konnects.co.uk',
        timestamp: serverTimestamp(),
        status: 'success'
      });
    } else {
      const errText = await appendRes.text();
      console.warn('[Sheets Service] Appending row to Google Sheets failed:', errText);
    }
  } catch (error) {
    console.warn('[Sheets Service] Google Sheets service error:', error);
  }
}
