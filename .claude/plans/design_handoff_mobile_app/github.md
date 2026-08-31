repo: FlagmanAlex/FlowLedger
branch: main

## Last sync
date: 2026-08-31T12:05:36Z

### Updated in this project
- Reviewed mobile client (Expo/React Native): Login, Dashboard, Transactions screens + nav — currently unstyled functional scaffolding, no visual design system in place yet.
- Reviewed shared data model: Wallet, Transaction, Category, DashboardSummary, RecurringTemplate (multi-currency, income/expense/transfer, category totals, monthly trend).
- Reviewed web client screens (Dashboard, Wallets, Transactions, Categories, Reports, Settings) — same story, plain unstyled markup, Russian-language copy.
- Conclusion: no existing visual UI to recreate pixel-perfect — this is greenfield UI design grounded in the real data model and screen set.

## Screen map
| Project screen | Repo source |
|---|---|
| Login | mobile/src/screens/LoginScreen.tsx |
| Dashboard | mobile/src/screens/DashboardScreen.tsx, client/src/components/screens/Dashboard.tsx |
| Transactions | mobile/src/screens/TransactionsScreen.tsx, client/src/components/screens/Transactions.tsx |
| Wallets | client/src/components/screens/Wallets.tsx |
| Categories | client/src/components/screens/Categories.tsx |
| Reports | client/src/components/screens/Reports.tsx |
| Data model | interfaces/src/*.interface.ts |
