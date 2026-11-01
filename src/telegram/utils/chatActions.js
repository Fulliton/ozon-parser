/**
 * Chat Actions and Message Editing utilities
 */

/**
 * Runs an asynchronous task while keeping the Telegram chat action
 * (e.g., 'typing', 'upload_photo') active by pinging it at regular intervals.
 * 
 * Telegram clears the 'typing' status automatically after ~5 seconds.
 * 
 * @param {import('telegraf').Context} ctx
 * @param {'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note'} action
 * @param {() => Promise<any>} taskFn
 * @param {number} intervalMs Default 4000ms
 * @returns {Promise<any>}
 */
async function withChatAction(ctx, action, taskFn, intervalMs = 4000) {
  let intervalId = null;

  try {
    if (ctx && typeof ctx.sendChatAction === 'function') {
      // Send immediately
      await ctx.sendChatAction(action).catch(() => {});

      // Keep sending at intervals
      intervalId = setInterval(() => {
        ctx.sendChatAction(action).catch(() => {});
      }, intervalMs);
    }

    return await taskFn();
  } finally {
    if (intervalId) {
      clearInterval(intervalId);
    }
  }
}

/**
 * Safely edits a message text in Telegram, suppressing common harmless errors
 * like "message is not modified", and falling back to a reply if needed.
 * 
 * @param {import('telegraf').Context} ctx
 * @param {string} text
 * @param {object} extra
 * @returns {Promise<any>}
 */
async function safeEditMessage(ctx, text, extra = {}) {
  try {
    if (typeof ctx.editMessageText === 'function') {
      return await ctx.editMessageText(text, extra);
    }
    return await ctx.reply(text, extra);
  } catch (err) {
    const errMsg = err?.description || err?.message || '';

    // Ignore when Telegram says nothing changed
    if (errMsg.includes('message is not modified')) {
      return null;
    }

    // Fallback: send as a new message if the original cannot be edited
    try {
      return await ctx.reply(text, extra);
    } catch (fallbackErr) {
      console.warn('[safeEditMessage] Fallback reply error:', fallbackErr.message);
      return null;
    }
  }
}

module.exports = {
  withChatAction,
  safeEditMessage,
};
