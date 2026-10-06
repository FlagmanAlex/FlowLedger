import { useQuery } from '@tanstack/react-query';
import type { Transaction, Wallet } from '@flowledger/interfaces';
import { listTransactions } from '../repositories/transactions.repo.js';

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
  return rates?.[code] ?? rates?.[CURRENCY_ALIASES[code] ?? code];
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

/** Сколько последних переводов смотреть при поиске курсов. */
const TRANSFERS_FOR_RATES_LIMIT = 500;

/** Курсы к рублю по последним реальным переводам между кошельками.
 *  Для каждой пары валют берётся самый свежий перевод (exchangeRate — курс,
 *  введённый пользователем, без учёта комиссии), затем от RUB обходом в
 *  ширину по парам считаются курсы остальных валют — так валюта без прямого
 *  перевода в рубли (WMT → USD → RUB) тоже получает курс через цепочку. */
export function rubRatesFromTransfers(transfers: Transaction[], wallets: Wallet[]): RubRates {
  const currencyById = new Map(wallets.map((w) => [w.id, w.currency.toUpperCase()]));
  /** pairs[A][B] = сколько B за 1 A по самому свежему переводу между A и B. */
  const pairs = new Map<string, Map<string, number>>();
  const seenPairs = new Set<string>();
  const sorted = [...transfers].sort((a, b) =>
    a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1,
  );
  for (const t of sorted) {
    if (t.type !== 'transfer' || !t.transferToWalletId || !t.exchangeRate || t.exchangeRate <= 0) continue;
    const from = currencyById.get(t.walletId);
    const to = currencyById.get(t.transferToWalletId);
    if (!from || !to || from === to) continue;
    const key = [from, to].sort().join('/');
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    if (!pairs.has(from)) pairs.set(from, new Map());
    if (!pairs.has(to)) pairs.set(to, new Map());
    pairs.get(from)!.set(to, t.exchangeRate);
    pairs.get(to)!.set(from, 1 / t.exchangeRate);
  }

  const rates: RubRates = { RUB: 1 };
  const queue = ['RUB'];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [other, otherPerCurrent] of pairs.get(current) ?? []) {
      if (rates[other] !== undefined) continue;
      // 1 other = (1 / otherPerCurrent) current = rates[current] / otherPerCurrent RUB
      rates[other] = rates[current] / otherPerCurrent;
      queue.push(other);
    }
  }
  return rates;
}

export function useTransferRubRates(userId: string | undefined, wallets: Wallet[] | undefined) {
  const transfers = useQuery({
    queryKey: ['transactions', userId, { type: 'transfer', limit: TRANSFERS_FOR_RATES_LIMIT }],
    queryFn: () => listTransactions(userId!, { type: 'transfer', limit: TRANSFERS_FOR_RATES_LIMIT }),
    enabled: Boolean(userId),
  });
  const data = transfers.data && wallets ? rubRatesFromTransfers(transfers.data, wallets) : undefined;
  return { data, isLoading: transfers.isLoading, error: transfers.error };
}

/** Итоговые курсы к рублю: по последним переводам (useTransferRubRates), а
 *  для валют без переводов — запасной курс ЦБ (useRubRates). byCbr говорит,
 *  посчитана ли валюта по ЦБ — чтобы UI мог это подписать. */
export function useCombinedRubRates(userId: string | undefined, wallets: Wallet[] | undefined) {
  const transfer = useTransferRubRates(userId, wallets);
  const cbr = useRubRates();
  const rates: RubRates = { ...cbr.data, ...transfer.data };
  return {
    rates,
    /** Курсы по переводам ещё грузятся — без них итог был бы по ЦБ и «прыгал». */
    isLoading: transfer.isLoading,
    /** ЦБ ещё грузится — валюты без переводов пока без курса. */
    isCbrLoading: cbr.isLoading,
    byCbr: (currency: string) =>
      rubRate(transfer.data, currency) === undefined && rubRate(cbr.data, currency) !== undefined,
  };
}
