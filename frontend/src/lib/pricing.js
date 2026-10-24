// Цены в одном месте: те же числа считает сервер (tutor_assistant/billing.py).
export const PRICE = { teacher: 290, school: 490, firstDiscount: 20, trialDays: 3 };
export const PERIOD_DISCOUNT = { 1: 0, 3: 10, 12: 20 };
export const PERIOD_TITLE = { 1: "Месяц", 3: "3 месяца", 12: "Год" };

export const periodTotal = (plan, months) => Math.round(PRICE[plan] * months * (100 - PERIOD_DISCOUNT[months]) / 100);
export const firstMonth = () => Math.round(PRICE.teacher * (100 - PRICE.firstDiscount) / 100);
export const rub = (n) => `${Number(n).toLocaleString("ru-RU")} ₽`;
export const perDay = (monthly) => (monthly / 30).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
