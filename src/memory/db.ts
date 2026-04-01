import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { existsSync } from 'fs';
import { resolve } from 'path';

// ─── INICIALIZACIÓN DUAL ──────────────────────────────────────────────────────
// Modo Nube (Hugging Face): Lee el JSON desde la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON.
// Modo Local (Tu PC):        Lee el archivo desde GOOGLE_APPLICATION_CREDENTIALS en .env.
if (getApps().length === 0) {
  try {
    const cloudJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (cloudJson) {
      // NUBE: Credenciales como JSON en variable de entorno
      const serviceAccount = JSON.parse(cloudJson);
      initializeApp({ credential: cert(serviceAccount) });
      console.log('[DB] Firestore conectado via Secret de entorno ✅');

    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // LOCAL: Credenciales como archivo en disco
      const credPath = resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (existsSync(credPath)) {
        const { default: serviceAccount } = await import(credPath, { assert: { type: 'json' } });
        initializeApp({ credential: cert(serviceAccount) });
        console.log('[DB] Firestore conectado via archivo local ✅');
      } else {
        console.error(`[DB ERROR] Archivo de credenciales no encontrado en: ${credPath}`);
      }
    } else {
      console.error('[DB ERROR] No se encontró ninguna credencial de Google. Configura GOOGLE_SERVICE_ACCOUNT_JSON (nube) o GOOGLE_APPLICATION_CREDENTIALS (local).');
    }
  } catch (e) {
    console.error('[DB ERROR] Fallo al inicializar Firebase:', e);
  }
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// ─── TIPOS ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  user_id: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: string;
  tool_call_id?: string;
}

// ─── FUNCIONES ────────────────────────────────────────────────────────────────
export async function addMessage(msg: ChatMessage): Promise<void> {
  try {
    await db
      .collection('conversations')
      .doc(msg.user_id.toString())
      .collection('messages')
      .add({
        role: msg.role || 'user',
        content: msg.content || '',
        tool_calls: msg.tool_calls || null,
        tool_call_id: msg.tool_call_id || null,
        timestamp: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error('[DB SAVE ERROR]', err);
  }
}

export async function getChatHistory(userId: number, limit = 50): Promise<any[]> {
  try {
    const snapshot = await db
      .collection('conversations')
      .doc(userId.toString())
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => {
      const row = doc.data();
      const msg: any = { role: row.role };
      if (row.content != null) msg.content = row.content;
      if (row.tool_calls) msg.tool_calls = JSON.parse(row.tool_calls);
      if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
      return msg;
    });
  } catch (err) {
    console.error('[DB READ ERROR]', err);
    return [];
  }
}

export async function clearHistory(userId: number): Promise<void> {
  try {
    const snap = await db
      .collection('conversations')
      .doc(userId.toString())
      .collection('messages')
      .get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.error('[DB CLEAR ERROR]', err);
  }
}
