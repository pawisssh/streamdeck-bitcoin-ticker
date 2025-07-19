import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, JsonObject } from "@elgato/streamdeck";

interface TickerSettings extends JsonObject {
	symbol?: string;    // e.g., BTCUSDT
	currency?: string;  // e.g., BTC (derived from symbol)
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

@action({ UUID: "com.pawish.streamdeck-bitcoin-ticker.increment" })
export class BitcoinTicker extends SingletonAction<TickerSettings> {
	private intervals: Map<string, NodeJS.Timeout> = new Map();
	private action: Map<string, WillAppearEvent<TickerSettings>> = new Map();
	// ลบ previousPrices และ priceHistory เพราะไม่ต้องใช้แล้ว
	private canvas: any;
	private ctx: any;
  
	override async onWillAppear(ev: WillAppearEvent<TickerSettings>) {
	  const actionId = ev.action.id;
	  
	  // เก็บ action reference
	  this.action.set(actionId, ev);
	  
	  // ล้าง interval เก่าถ้ามี
	  if (this.intervals.has(actionId)) {
		clearInterval(this.intervals.get(actionId)!);
	  }
	  
	  await this.updatePrice(ev);
	  
	  // สร้าง interval ใหม่สำหรับ action นี้
	  const intervalId = setInterval(async () => {
		const currentAction = this.action.get(actionId);
		if (currentAction) {
		  // อ่านค่า settings ใหม่ทุกครั้งจาก action
		  const currentSettings = await currentAction.action.getSettings() as TickerSettings;
		  
		  console.log(`Interval - Raw settings:`, currentSettings); // Debug log
		  console.log(`Interval - Symbol from settings:`, currentSettings.symbol); // Debug log
		  
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

	// เพิ่ม method สำหรับ handle การเปลี่ยนแปลง settings
	override async onDidReceiveSettings(ev: any) {
	  console.log(`onDidReceiveSettings called with:`, ev.payload?.settings); // Debug log
	  const actionId = ev.action.id;
	  this.action.set(actionId, ev);
	  await this.updatePrice(ev);
	}
  
	async updatePrice(ev: WillAppearEvent<TickerSettings> | any) {
	  try {
		const actionId = ev.action.id;
		
		// ดึงค่า symbol จาก settings ปัจจุบัน
		const settings = ev.payload?.settings || {};
		const symbol = (settings.symbol || "BTCUSDT").toUpperCase();
		
		console.log(`UpdatePrice - Full settings:`, settings); // Debug log
		console.log(`UpdatePrice - Symbol used: ${symbol}`); // Debug log
		
		// สร้าง currency label จาก symbol (เอา USDT ออก)
		const currency = symbol.replace("USDT", "").replace("USDC", "");
		
		// ใช้ Binance 24hr ticker statistics API แทน price API
		const res = await fetch(
		  `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
		);
		const json = await res.json() as Binance24hrTickerResponse;
		
		// ดึงข้อมูลจาก API response
		const currentPrice = parseFloat(json.lastPrice);
		const priceChange = parseFloat(json.priceChange);
		const priceChangePercent = parseFloat(json.priceChangePercent);
		
		console.log(`Price: ${currentPrice}, Change: ${priceChange}, Change%: ${priceChangePercent}`); // Debug log
		
		// คำนวณ arrow และสีจากข้อมูล API
		let arrow = "■"; // Default arrow
		let arrowColor = "#5c5c5c"; // Default color
		let tickerColor = "#4b4b4b";
		let changeStr = `${Math.abs(priceChangePercent).toFixed(2)}%`;

		if (priceChange > 0) {
			arrow = "▲";
			arrowColor = "#34C759"; // Green
			tickerColor = "#275C35";
		} else if (priceChange < 0) {
			arrow = "▼";
			arrowColor = "#FF3B30"; // Red
			tickerColor = "#650212";
		} else {
			arrow = "■";
			arrowColor = "#c5c5c5"; // Gray for no change
			tickerColor = "#4b4b4b";
		}
		
		const svg = `
		<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#000000"/>
					<stop offset="30%" stop-color="#000000"/>
					<stop offset="100%" stop-color="${tickerColor}"/>
				</linearGradient>
			</defs>
			<rect width="100" height="100" fill="url(#grad)"/>
			<text x="6" y="24" font-size="24" font-weight="900" fill="white" font-family="Arial">${currency}</text>
			<text x="72" y="88" font-size="17" font-weight="900" fill="${arrowColor}" font-family="Arial">${arrow}</text>
  			<text x="6" y="50" font-size="17" font-weight="700" fill="white" font-family="Arial">${currentPrice}</text>
			<text x="6" y="88" font-size="17" font-weight="700" fill="${arrowColor}" font-family="Arial">${changeStr}</text>
		</svg>
		`;

		await ev.action.setImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);	
		  
    } 	catch (e) {
      	console.error("Ticker Fetch Failed:", e);
    }
	}
  
	override onWillDisappear(ev: WillDisappearEvent<TickerSettings>) {
	  const actionId = ev.action.id;
	  
	  if (this.intervals.has(actionId)) {
		clearInterval(this.intervals.get(actionId)!);
		this.intervals.delete(actionId);
	  }
	  
	  // ล้าง action reference เท่านั้น (ไม่ต้องล้าง previousPrices และ priceHistory แล้ว)
	  this.action.delete(actionId);
	}
}