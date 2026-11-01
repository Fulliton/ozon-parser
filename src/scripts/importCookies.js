const fs = require('fs');
const path = require('path');

const COOKIES_PATH = path.resolve(__dirname, '../../data/ozon-cookies.json');

const rawInput = process.argv[2];

if (!rawInput) {
  console.log(`
Использование:
  npm run import-cookies "cookie_string_here"

Пример:
  npm run import-cookies "__Secure-access-token=...; abt_data=..."
  `);
  process.exit(1);
}

try {
  let cookies = [];
  if (rawInput.trim().startsWith('[') || rawInput.trim().startsWith('{')) {
    // JSON format
    const parsed = JSON.parse(rawInput);
    cookies = Array.isArray(parsed) ? parsed : [parsed];
  } else {
    // Header string format: "key1=val1; key2=val2"
    cookies = rawInput
      .split(';')
      .map((part) => {
        const [name, ...val] = part.trim().split('=');
        if (!name || val.length === 0) return null;
        const cookieName = name.trim();
        return {
          name: cookieName,
          value: val.join('=').trim(),
          domain: '.ozon.ru',
          path: '/',
          secure: true,
          httpOnly: cookieName.startsWith('__Secure-') || cookieName === 'abt_data',
        };
      })
      .filter(Boolean);
  }

  if (cookies.length === 0) {
    throw new Error('Не найдено валидных кук во входной строке.');
  }

  const dir = path.dirname(COOKIES_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf8');
  console.log(`✅ Успешно импортировано ${cookies.length} кук в ${COOKIES_PATH}`);
} catch (err) {
  console.error('❌ Ошибка при импорте кук:', err.message);
  process.exit(1);
}
