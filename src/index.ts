import { Bot, webhookCallback } from 'grammy';
import express from 'express';
import { config } from './config.js';
import { runAgentLoop } from './agent/loop.js';
import { clearHistory } from './memory/db.js';
import { transcribeAudio } from './agent/speech.js';

// ─── IDENTIDAD HARDCODED ──────────────────────────────────────────────────────
// Evita que el bot llame a api.telegram.org al iniciar (causa DNS Error en HF).
const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
// Eliminamos el botInfo detallado que disparaba las alertas de seguridad

// ─── FILTRO DE SEGURIDAD ──────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || userId.toString() !== '485870972') {
    console.log(`[BLOQUEADO] ID no autorizado: ${userId}`);
    return;
  }
  await next();
});

// ─── COMANDOS ─────────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  await ctx.reply('¡Hola! Soy MiguelAI. ¿En qué puedo ayudarte? 🤖');
});

bot.command('clear', async (ctx) => {
  if (ctx.from) {
    await clearHistory(ctx.from.id);
    await ctx.reply('Memoria borrada. ¡Empezamos de cero! 🧹');
  }
});

// ─── MANEJO DE MENSAJES ───────────────────────────────────────────────────────
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const userText = ctx.message.text;
  console.log(`[MSG] De ${userId}: "${userText.substring(0, 50)}"`);
  try {
    const finalResponse = await runAgentLoop(userId, userText);
    console.log(`[OK] Respuesta generada.`);
    await ctx.reply(finalResponse);
  } catch (error: any) {
    console.error('[ERROR]', error?.message || error);
    await ctx.reply('Ocurrió un error interno. Por favor intenta de nuevo.');
  }
});

// ─── MANEJO DE AUDIO/VOZ ──────────────────────────────────────────────────────
bot.on(['message:voice', 'message:audio'], async (ctx) => {
  const userId = ctx.from.id;
  const voice = ctx.message.voice || ctx.message.audio;

  if (!voice) return;

  console.log(`[AUDIO] De ${userId}: audio de ${voice.duration}s`);

  try {
    // 1. Obtener info del archivo
    const fileInfo = await ctx.api.getFile(voice.file_id);

    if (!fileInfo.file_path) {
      await ctx.reply('No pude obtener el archivo de audio.');
      return;
    }

    // 2. Descargar el archivo
    const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
    const fileResponse = await fetch(fileUrl);

    if (!fileResponse.ok) {
      await ctx.reply('Error al descargar el audio.');
      return;
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    // 3. Transcribir
    await ctx.reply('🎧 Transcribiendo audio...');
    const transcription = await transcribeAudio(fileBuffer, voice.mime_type);

    console.log(`[AUDIO] Transcripción: "${transcription.substring(0, 100)}..."`);

    // 4. Procesar con el agente
    const finalResponse = await runAgentLoop(userId, transcription);
    await ctx.reply(finalResponse);

  } catch (error: any) {
    console.error('[ERROR]', error?.message || error);
    await ctx.reply('Ocurrió un error al procesar el audio. Por favor intenta de nuevo.');
  }
});

bot.catch((err) => console.error('[BOT ERROR]', err.error));

// ─── MODO: NUBE vs LOCAL ──────────────────────────────────────────────────────
// Si existe la variable PORT (Hugging Face la setea), usamos Webhook.
// Si no existe (tu PC local), usamos Long Polling normal.
const IS_CLOUD = !!process.env.PORT;

if (IS_CLOUD) {
  // ── MODO NUBE (Hugging Face) ──────────────────────────────────────────────
  // useWebhookReply: true --> La respuesta viaja de vuelta en la misma
  // conexión que abre Telegram. Nunca hacemos llamadas salientes a Telegram.
  // Esto soluciona el error: ENOTFOUND api.telegram.org
  const app = express();
  app.use(express.json());

bot.api.config.useWebhookReply = true;

const handleUpdate = webhookCallback(bot, 'express');

app.post('/', handleUpdate);
app.get('/', (_req, res) => res.send('✅ MiguelAI Operativo en la Nube'));

const PORT = parseInt(process.env.PORT || '10000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[LOG] MiguelAI en puerto ${PORT}`);
});

} else {
  // ── MODO LOCAL (Tu PC) ────────────────────────────────────────────────────
  // Long Polling: el bot pregunta a Telegram por nuevos mensajes constantemente.
  // No necesita un servidor web ni un webhook.
  console.log('[LOCAL] Iniciando MiguelAI en modo Long Polling...');
  bot.start({
    onStart: (info) => console.log(`[LOCAL] Bot @${info.username} activo ✅`),
  });
}
