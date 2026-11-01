const { formatDate, formatPrice, formatPriceDiff } = require('../utils/formatters');

class ChartService {
  /**
   * Generates a QuickChart URL for price history visualization
   * @param {Object} product
   * @param {Array<Object>} historyItems (ordered from newest to oldest or vice versa)
   * @returns {string} QuickChart URL
   */
  generateChartUrl(product, historyItems = []) {
    // Clone and sort chronologically (oldest first)
    const sorted = [...historyItems].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    // If empty or only 1 item, pad with current price to draw a line
    if (sorted.length === 0) {
      const now = new Date();
      sorted.push({
        price: product.currentPrice,
        cardPrice: product.cardPrice,
        recordedAt: new Date(now.getTime() - 3600000),
      });
      sorted.push({
        price: product.currentPrice,
        cardPrice: product.cardPrice,
        recordedAt: now,
      });
    } else if (sorted.length === 1) {
      const single = sorted[0];
      const prevDate = new Date(new Date(single.recordedAt).getTime() - 3600000);
      sorted.unshift({
        price: single.price,
        cardPrice: single.cardPrice,
        recordedAt: prevDate,
      });
    }

    const labels = sorted.map((h) => {
      const d = new Date(h.recordedAt);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month} ${hours}:${mins}`;
    });

    const prices = sorted.map((h) => Number(h.price));
    const hasCardPrices = sorted.some((h) => h.cardPrice !== null && h.cardPrice !== undefined);

    const datasets = [
      {
        label: 'Цена',
        data: prices,
        borderColor: '#005BFF',
        backgroundColor: 'rgba(0, 91, 255, 0.12)',
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: '#005BFF',
        fill: true,
        tension: 0.2,
      },
    ];

    if (hasCardPrices) {
      const cardPrices = sorted.map((h) => (h.cardPrice ? Number(h.cardPrice) : null));
      datasets.push({
        label: 'С Ozon Картой',
        data: cardPrices,
        borderColor: '#00A86B',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 3,
        pointBackgroundColor: '#00A86B',
        fill: false,
        tension: 0.2,
      });
    }

    const shortTitle = (product.title || 'Товар').substring(0, 45);

    const chartConfig = {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: `Динамика цены: ${shortTitle}`,
          fontSize: 14,
          fontColor: '#1A1A1A',
        },
        legend: {
          display: true,
          position: 'top',
        },
        scales: {
          xAxes: [
            {
              gridLines: { color: 'rgba(0,0,0,0.06)' },
              ticks: { maxTicksLimit: 7, fontSize: 10 },
            },
          ],
          yAxes: [
            {
              gridLines: { color: 'rgba(0,0,0,0.08)' },
              ticks: {
                fontSize: 11,
              },
            },
          ],
        },
      },
    };

    const encoded = encodeURIComponent(JSON.stringify(chartConfig));
    return `https://quickchart.io/chart?w=700&h=400&devicePixelRatio=2&bkg=white&c=${encoded}`;
  }

  /**
   * Calculates statistics from price history
   * @param {Object} product
   * @param {Array<Object>} historyItems
   * @returns {{ minPrice: number, maxPrice: number, firstPrice: number, currentPrice: number, diffText: string, pointsCount: number }}
   */
  getHistoryStats(product, historyItems = []) {
    const currentPrice = Number(product.currentPrice);
    if (!historyItems || historyItems.length === 0) {
      return {
        minPrice: currentPrice,
        maxPrice: currentPrice,
        firstPrice: currentPrice,
        currentPrice,
        diffText: 'без изменений',
        pointsCount: 1,
      };
    }

    const sorted = [...historyItems].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const prices = sorted.map((h) => Number(h.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const firstPrice = prices[0];
    const diff = formatPriceDiff(firstPrice, currentPrice);

    return {
      minPrice,
      maxPrice,
      firstPrice,
      currentPrice,
      diffText: diff.text,
      pointsCount: prices.length,
    };
  }
}

module.exports = new ChartService();
