# Handoff: FlowLedger Mobile App UI

## Overview
Bold, neomorphic visual design and interaction flow for the FlowLedger mobile client (Expo / React Native). Covers Login, Dashboard, Transactions ("Журнал"), and the Add Transaction flow. The current `mobile/` app in the repo is functional but unstyled — this design gives it a real visual language.

## About the Design Files
The bundled file (`FlowLedger Mobile.dc.html`) is an **HTML/React design reference** — a clickable prototype showing intended look, layout, and behavior. It is NOT production code to copy in. The task is to **recreate this design inside the existing `mobile/` Expo/React Native app**, using React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`/`FlatList`), `@react-navigation` (already in use — see `RootNavigator.tsx`), and the real data hooks from `@flowledger/shared` (`useAuth`, `useDashboard`, `useWallets`, `useTransactions`, `useCategories`, `useCreateWallet`, etc.) in place of the mock data used in the prototype.

Box-shadow-based neomorphism needs adaptation for RN: use two stacked `View`s with `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` (iOS) and `elevation` (Android), or a small helper component (e.g. `NeoCard`) that renders a light-shadow layer and dark-shadow layer, since RN has no dual box-shadow.

## Fidelity
**High-fidelity.** Colors, typography sizes/weights, spacing, and component layout below are final — implement pixel-for-pixel where RN allows equivalent shadow/typography APIs.

## Screens / Views

### 1. Login
- Full-height centered column, 32px horizontal padding, 16px gap.
- Logo badge: 88×88, radius 26, raised neomorphic surface, centered "FL" mark, 30px/800 weight, color `#7B61FF`.
- Title "FlowLedger" 26px/800 `#F5F6FA`; subtitle "Учёт доходов и расходов" 14px `rgba(245,246,250,0.5)`, 6px margin-top.
- "Войти через Google" button: full width, 56px tall, radius 18, raised neomorphic surface, row layout (10px gap): 26px circular white badge with black "G" letter + 15px/700 white label.
- Footnote 12px `rgba(245,246,250,0.35)`: "Один аккаунт Firebase — веб и мобильное приложение".
- Tap button → navigate to Dashboard (replaces stack; on device this should trigger the real `expo-auth-session` Google sign-in already wired in `LoginScreen.tsx`).

### 2. Dashboard ("Дашборд")
- Header row: "Дашборд" 22px/800 white, right-aligned month label 13px muted.
- Balance card: raised surface, radius 22, 22px padding. Label "Общий баланс" 13px muted; big number 38px/800 white + " ₽"; green delta pill below (12px/700, bg `rgba(47,230,184,0.15)`, text `#2FE6B8`).
- Wallets row: horizontal scroll, 12px gap, cards 132px wide, radius 18, raised surface, 14px padding — colored 22×4 bar (wallet color) → wallet name 12px muted → balance 15px/700 white.
- "Расходы по категориям" / "Доходы по категориям": each row = name/amount line (13px) + 6px track (bg `#12141C`, inset shadow) with a colored fill bar sized by % of category total vs. section total.
- "Тренд по месяцам": raised card, 6 months, twin bars per month (green = income, coral = expense, 6px wide, height scaled to max value, max 64px) + month label 10px muted.
- "Последние операции": last 4 transactions — 36×36 radius-12 colored circle with category initial, name+wallet (14px/600 + 12px muted), amount right-aligned colored by type. "Все →" link (12px/600 `#7B61FF`) jumps to Journal tab.

### 3. Journal ("Журнал")
- Header "Журнал" 22px/800.
- Segmented filter (Все / Доходы / Расходы): raised pill container, each segment toggles to an inset/pressed state + white text when active, muted text when inactive.
- Transaction list grouped by date: 12px/700 uppercase muted date header when the date changes, then rows identical to Dashboard's recent-transactions row (38×38 icon variant).
- Floating "+" action button: 58×58 circle, `#7B61FF`, bottom-right, raised shadow + colored glow, opens the Add Transaction sheet (defaults to Расход).

### 4. Add Transaction (bottom sheet, slides up over full screen)
- Header: 36×36 rounded "✕" close button (raised) — title "Новая операция" centered — 36px spacer for symmetry.
- Type segmented control (Расход / Доход) — same toggle treatment as Journal filter, track background `#12141C` with inset shadow.
- Big amount readout: 44px/800, colored coral for expense / green for income, thin " ₽" suffix in muted 22px/700.
- "Кошелёк" section: horizontal scroll of wallet chips — raised when unselected, inset + 2px colored border when selected.
- "Категория" section: 4-column grid, each cell = 32×32 colored-initial circle + 11px label; same selected/unselected raised↔inset+border treatment.
- Numeric keypad: 3-column grid, 12 keys (1–9, ., 0, ⌫), each a 52px raised square, 19px/700 white.
- "Сохранить" button: 56px, radius 18, `#7B61FF` fill, 16px/800 white, colored glow shadow. Saves the transaction and returns to Journal with the new entry at top.

## Interactions & Behavior
- Login → Dashboard is a one-way transition (stack replace), matching `RootNavigator`'s auth-gated stack.
- Bottom tab bar switches Dashboard ⇄ Journal without unmounting the Add sheet state.
- Add sheet is a slide-up overlay (`transform: translateY(0|100%)`, 320ms ease) rather than a new screen — implement with RN `Animated`/`Reanimated` or a modal.
- Keypad taps append to a string amount (max 9 chars, one decimal point, max 2 decimal digits); ⌫ removes last char.
- Selecting a wallet/category updates local state immediately (no confirmation).
- Save: builds a transaction object `{walletId, categoryId, type, amount}`, prepends to the list, closes the sheet, switches to Journal tab. In production this should call the real `useCreateTransaction`-style mutation from `@flowledger/shared` (mirror the pattern of `useCreateWallet` in `Wallets.tsx`).
- Amount is invalid (≤0) → tapping Save just closes the sheet without adding anything (should surface a validation message in production).

## State Management
Prototype uses local component state (mirror types from `@flowledger/interfaces`):
- `screen`: `'login' | 'app'`
- `tab`: `'dashboard' | 'transactions'`
- `txFilter`: `'all' | 'income' | 'expense'`
- `showAdd`: boolean, `addType`: `'expense' | 'income'`, `addAmount`: string, `addWalletId`, `addCategoryId`
- `transactions`: array (in production, sourced from `useTransactions(user.uid)`; wallets/categories from `useWallets`/`useCategories`; dashboard aggregates from `useDashboard`)

## Design Tokens
- Background base: `#1B2136`; shadow-dark: `#12141C`; shadow-light: `#242C49`
- Text: primary `#F5F6FA`, secondary `rgba(245,246,250,0.5)`, tertiary `rgba(245,246,250,0.35)`
- Accent/brand: `#7B61FF` (violet); Income/positive: `#2FE6B8` (mint); Expense/negative: `#FF5C7A` (coral); Warn/secondary accent: `#FFB454`; Gold (savings): `#FFC857`; Pink (fun category): `#FF7BD1`; Neutral (misc category): `#8891B0`
- Neomorphic raised shadow: `5px 5px 10px #12141C, -5px -5px 10px #242C49` (small); `8px 8px 16px #12141C, -8px -8px 16px #242C49` (large cards)
- Neomorphic pressed/inset shadow: `inset 5px 5px 10px #12141C, inset -5px -5px 10px #242C49`
- Radii: 12–14px (chips/icons), 16–18px (buttons/segments), 22–26px (cards/badges)
- Type: system font stack (`-apple-system, system-ui`); sizes 10/11/12/13/14/15/16/19/22/26/38/44px; weights 600/700/800
- Currency: ₽ (ruble), Russian number formatting (space thousands separator, comma decimal)

## Assets
No image/icon assets — category and wallet "icons" are colored circles with a single Cyrillic letter (no SVGs to source). Use the same approach in RN (a `View` circle + `Text` letter) unless the team wants to commission real icon assets.

## Files
- `FlowLedger Mobile.dc.html` — the interactive design prototype (open in a browser; React-based, self-contained).
- `github.md` — records the source repo (`FlagmanAlex/FlowLedger`) this design is grounded in, and which repo files map to which screens.
