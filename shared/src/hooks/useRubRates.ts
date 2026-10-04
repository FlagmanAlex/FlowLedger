import { useQuery } from '@tanstack/react-query';

/** Курсы ЦБ РФ: публичное зеркало daily_json.js (без ключа, с CORS — работает
 *  прямо из браузера и React Native). */
const CBR_DAILY_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

/** Валюты, которых нет у ЦБ, но которые жёстко привязаны к одной из его валют.
 *  WMT (WebMoney) номинирован в USDT, т.е. ≈ 1 USD. */
const CURRENCY_ALIASES: Record<string, string> = {
  WMT: 'USD',
  WMZ: 'USD',
  USDT: 'USD',
  WME: 'EUR',
  WMP: 'RUB',
};

interface CbrDailyResponse {
  Valute: Record<string, { Nominal: number; Value: number }>;
}

/** Курсы «1 единица валюты = N рублей», RUB = 1. */
export type RubRates = Record<string, number>;

async function fetchRubRates(): Promise<RubRates> {
  const response = await fetch(CBR_DAILY_URL);
  if (!response.ok) throw new Error(`Курсы ЦБ недоступны: HTTP ${response.status}`);
  const data = (await response.json()) as CbrDailyResponse;
  const rates: RubRates = { RUB: 1 };
  for (const [code, v] of Object.entries(data.Valute)) {
    if (v.Nominal > 0) rates[code] = v.Value / v.Nominal;
  }
  return rates;
}

/** Курс валюты к рублю с учётом алиасов; undefined — курс неизвестен. */
export function rubRate(rates: RubRates | undefined, currency: string): number | undefined {
  const code = currency.toUpperCase();
  if (code === 'RUB' || code === 'RUR') return 1;
  return rates?.[CURRENCY_ALIASES[code] ?? code];
}

/** Сумма в рублях по набору (сумма, валюта). Валюты без известного курса не
 *  входят в total и возвращаются списком в missing. */
export function sumInRub(
  items: { amount: number; currency: string }[],
  rates: RubRates | undefined,
): { total: number; missing: string[] } {
  let total = 0;
  const missing = new Set<string>();
  for (const { amount, currency } of items) {
    const rate = rubRate(rates, currency);
    if (rate === undefined) missing.add(currency);
    else total += amount * rate;
  }
  return { total, missing: [...missing] };
}

export function useRubRates() {
  return useQuery({
    queryKey: ['rubRates'],
    queryFn: fetchRubRates,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
