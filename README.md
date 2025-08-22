# Crypto Ticker for Stream Deck

Real-time cryptocurrency tracker plugin for Elgato Stream Deck — powered by the Binance API. Track multiple coins at once with clean, color-coded UI on each Stream Deck key.

---

## Features

- **Live price updates** every 60 seconds
- **Custom symbol input** (e.g. `BTCUSDT`, `ETHUSDT`, `SOLUSDT`)
- **Color-coded indicators**:
  - Green = price up ▲  
  - Red = price down ▼  
- **Multi-instance support** — track different assets in different keys
- **Minimal, high-contrast UI** (perfect for dark mode setups)
- Built with TypeScript and [@elgato/streamdeck SDK](https://github.com/elgato/streamdeck)

---

## Example

| Symbol | Output Example     |
|--------|--------------------|
| BTCUSDT | `BTC\n117874.06\n0.24% ▲` |
| ETHUSDT | `ETH\n3556.24\n0.94% ▼`   |
| DOGEUSDT | `DOGE\n0.2414\n2.09% ▲`  |

---
