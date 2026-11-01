/**
 * Formats a number as a Russian Ruble currency string
 * e.g., 1990 -> "1 990 ₽"
 * @param {number|string} amount
 * @returns {string}
 */
function formatPrice(amount) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'цена не указана';
  }
  const num = Math.round(Number(amount));
  const formatted = num.toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
  return `${formatted} ₽`;
}

/**
 * Calculates and formats price difference between old and new price
 * @param {number} oldPrice
 * @param {number} newPrice
 * @returns {{ diff: number, percent: number, text: string, direction: 'down' | 'up' | 'same' }}
 */
function formatPriceDiff(oldPrice, newPrice) {
  const diff = Math.round(newPrice - oldPrice);
  const percent = oldPrice > 0 ? ((diff / oldPrice) * 100).toFixed(1) : 0;

  if (diff < 0) {
    const absDiff = Math.abs(diff);
    return {
      diff,
      percent: Math.abs(Number(percent)),
      text: `📉 Снизилась на ${formatPrice(absDiff)} (-${Math.abs(Number(percent))}%)`,
      direction: 'down',
    };
  } else if (diff > 0) {
    return {
      diff,
      percent: Number(percent),
      text: `📈 Выросла на ${formatPrice(diff)} (+${percent}%)`,
      direction: 'up',
    };
  }

  return {
    diff: 0,
    percent: 0,
    text: 'Цена не изменилась',
    direction: 'same',
  };
}

/**
 * Escapes characters for Telegram HTML mode
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formats a timestamp into readable Russian date and time
 * @param {Date|string|number} date
 * @returns {string}
 */
function formatDate(date) {
  if (!date) return 'не парсился';
  const d = new Date(date);
  return d.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a timestamp into human-readable relative time
 * e.g., "только что", "5 мин назад", "2 ч назад"
 * @param {Date|string|number} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  if (!date) return 'не парсился';
  const now = Date.now();
  const past = new Date(date).getTime();
  const diffMs = now - past;

  if (isNaN(diffMs) || diffMs < 0) {
    return 'только что';
  }

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'только что';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 7) return `${diffDays} дн. назад`;

  return formatDate(date);
}

/**
 * Calculates target price progress and formats a readable status
 * @param {number} currentPrice
 * @param {number|null} targetPrice
 * @returns {{ reached: boolean, diff: number, text: string }}
 */
function formatTargetProgress(currentPrice, targetPrice) {
  if (!targetPrice) {
    return { reached: false, diff: 0, text: '' };
  }

  const diff = currentPrice - targetPrice;
  if (diff <= 0) {
    return {
      reached: true,
      diff: 0,
      text: `🎯 Желаемая цена: <b>${formatPrice(targetPrice)}</b> — <b>Цель достигнута! 🎉</b>`,
    };
  }

  return {
    reached: false,
    diff,
    text: `🎯 Желаемая цена: <b>${formatPrice(targetPrice)}</b> <i>(до цели: ${formatPrice(diff)})</i>`,
  };
}

module.exports = {
  formatPrice,
  formatPriceDiff,
  escapeHtml,
  formatDate,
  formatRelativeTime,
  formatTargetProgress,
};
