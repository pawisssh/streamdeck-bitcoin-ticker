import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, JsonObject } from "@elgato/streamdeck";

interface TickerSettings extends JsonObject {
	symbol?: string;
	currency?: string;
}

interface Binance24hrTickerResponse {
	symbol: string;
	priceChange: string;
	priceChangePercent: string;
	weightedAvgPrice: string;
	prevClosePrice: string;
	lastPrice: string;
	lastQty: string;
	bidPrice: string;
	askPrice: string;
	openPrice: string;
	highPrice: string;
	lowPrice: string;
	volume: string;
	quoteVolume: string;
	openTime: number;
	closeTime: number;
	firstId: number;
	lastId: number;
	count: number;
}

function formatPriceDynamic(price: number): string {
	if (price >= 100000) {
		return Math.round(price).toLocaleString();
	} else if (price >= 100) {
		return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	} else if (price >= 1) {
		const [intPart, decPart = ""] = price.toFixed(8).split(".");
		const availableDecimals = Math.max(0, 8 - intPart.length - 1);
		return parseFloat(`${intPart}.${decPart.slice(0, availableDecimals)}`).toLocaleString(undefined, {
			minimumFractionDigits: availableDecimals,
			maximumFractionDigits: availableDecimals
		});
	} else {
		return price.toFixed(8).replace(/(?:\.(\d*?[1-9]))0+$/g, ".$1").replace(/\.0+$/, "");
	}
}

@action({ UUID: "com.pawish.streamdeck-bitcoin-ticker.increment" })
export class BitcoinTicker extends SingletonAction<TickerSettings> {
	private intervals: Map<string, NodeJS.Timeout> = new Map();
	private action: Map<string, WillAppearEvent<TickerSettings>> = new Map();
	private lastData: Map<string, { symbol: string; currentPrice: string; arrow: string; arrowColor: string; changeStr: string; tickerColor: string }> = new Map();
	private lastKeyPressTime: Map<string, number> = new Map(); // 🆕 เพิ่ม map เก็บเวลาล่าสุดที่กดปุ่ม

	override async onWillAppear(ev: WillAppearEvent<TickerSettings>) {
		const actionId = ev.action.id;
		this.action.set(actionId, ev);
		if (this.intervals.has(actionId)) clearInterval(this.intervals.get(actionId)!);
		await this.updatePrice(ev);
		const intervalId = setInterval(async () => {
			const currentAction = this.action.get(actionId);
			if (currentAction) {
				const currentSettings = await currentAction.action.getSettings() as TickerSettings;
				const updatedEvent = {
					...currentAction,
					payload: {
						...currentAction.payload,
						settings: currentSettings
					}
				};
				await this.updatePrice(updatedEvent);
			}
		}, 60 * 1000);
		this.intervals.set(actionId, intervalId);
	}

	override async onKeyDown(ev: KeyDownEvent<TickerSettings>): Promise<void> {
		const actionId = ev.action.id;
		const now = Date.now();
		const lastPressed = this.lastKeyPressTime.get(actionId) || 0;

		if (now - lastPressed >= 60 * 1000) { // มากกว่า 1 นาที
			this.lastKeyPressTime.set(actionId, now);
			await this.updatePrice(ev);
		} else {
			// กดเร็วเกินไป: do nothing
			console.log(`[SKIPPED] Button pressed within 1 minute interval: ${actionId}`);
		}
	}

	override async onDidReceiveSettings(ev: any) {
		const actionId = ev.action.id;
		this.action.set(actionId, ev);
		await this.updatePrice(ev);
	}

	async updatePrice(ev: WillAppearEvent<TickerSettings> | any) {
		const actionId = ev.action.id;
		try {
			const settings = ev.payload?.settings || {};
			const symbol = (settings.symbol || "BTCUSDT").toUpperCase();
			const currency = symbol.replace("USDT", "").replace("USDC", "");

			const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
			const json = await res.json() as Binance24hrTickerResponse;

			const rawPrice = parseFloat(json.lastPrice);
			const currentPrice = formatPriceDynamic(rawPrice);
			const priceChange = parseFloat(json.priceChange);
			const priceChangePercent = parseFloat(json.priceChangePercent);

			let arrow = "■";
			let arrowColor = "#5c5c5c";
			let tickerColor = "#4b4b4b";
			let changeStr = `${Math.abs(priceChangePercent).toFixed(2)}%`;

			if (priceChange > 0) {
				arrow = "▲";
				arrowColor = "#34C759";
				tickerColor = "#275C35";
			} else if (priceChange < 0) {
				arrow = "▼";
				arrowColor = "#FF3B30";
				tickerColor = "#650212";
			}

			this.lastData.set(actionId, { symbol: currency, currentPrice, arrow, arrowColor, changeStr, tickerColor });

			const svg = this.buildSVG(currency, currentPrice, arrow, arrowColor, changeStr, tickerColor);
			await ev.action.setImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
		} catch (e) {
			const fallback = this.lastData.get(actionId);
			if (fallback) {
				const svg = this.buildSVG(fallback.symbol, fallback.currentPrice, fallback.arrow, fallback.arrowColor, fallback.changeStr, fallback.tickerColor);
				await ev.action.setImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
				await ev.action.setTitle(""); // เคลียร์ "--" หรือ "Error"
			} else {
				await ev.action.setTitle("Error");
  				setTimeout(() => ev.action.setTitle(""), 3000);
			}
			console.error("Ticker Fetch Failed:", e);
		}
	}

	buildSVG(symbol: string, currentPrice: string, arrow: string, arrowColor: string, changeStr: string, tickerColor: string): string {
		return `
		<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#000000"/>
					<stop offset="30%" stop-color="#000000"/>
					<stop offset="100%" stop-color="${tickerColor}"/>
				</linearGradient>
			</defs>
			<rect width="100" height="100" fill="url(#grad)"/>
			<text x="6" y="24" font-size="24" font-weight="900" fill="white" font-family="Arial">${symbol}</text>
			<text x="72" y="88" font-size="17" font-weight="900" fill="${arrowColor}" font-family="Arial">${arrow}</text>
			<text x="6" y="50" font-size="17" font-weight="700" fill="white" font-family="Arial">${currentPrice}</text>
			<text x="6" y="88" font-size="17" font-weight="700" fill="${arrowColor}" font-family="Arial">${changeStr}</text>
		</svg>
		`;
	}

	override onWillDisappear(ev: WillDisappearEvent<TickerSettings>) {
		const actionId = ev.action.id;
		if (this.intervals.has(actionId)) {
			clearInterval(this.intervals.get(actionId)!);
			this.intervals.delete(actionId);
		}
		this.action.delete(actionId);
		this.lastData.delete(actionId);
	}
}
