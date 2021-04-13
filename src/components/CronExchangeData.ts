import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {AccountRepository, OrderHistoryRepository} from '../repositories';
import {Account} from '../models';
import ccxt from 'ccxt';
import {decrypt, telegramNotify, createUniqueId, floorNumberByDecimals, floorNumberByRef} from '../utils/functions';
import axios from 'axios';
import {listToken, triggerTd} from '../utils/constants'
import SpotMarketData from '../utils/spot-market-data.json'
// @ts-ignore
import TDSequential from 'tdsequential';

@cronJob()
export class CronExchangeData extends CronJob {
  constructor(
    @repository(AccountRepository)
    public accountRepository: AccountRepository,
    @repository(OrderHistoryRepository)
    public orderHistoryRepository: OrderHistoryRepository,
  ) {
    super({
      name: 'sync exchange data',
      onTick: async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const accounts = await accountRepository.find({where: {is_active: true}});
        Promise.all(accounts.map((account: Account) =>
          this.exchangeAccountExec(account),
        )).catch(error =>
          console.error('Cron fail: ' + error.message),
        );
      },
      cronTime: '55 */5 * * * *',
      start: true,
    });
  }

  async exchangeAccountExec(account: Account) {
    const binance = new ccxt.binance({
      apiKey: account.api_key,
      secret: decrypt(account.secret_key),
      enableRateLimit: true,
    });
    try {
      const order = await this.orderHistoryRepository.findOne({where: {is_active: true, account_id: account.id}});


      if (order) {
        const onlineOrder = await binance.privateGetOrder({origClientOrderId: createUniqueId(order.id), symbol: order.symbol});
        if(onlineOrder.status === 'FILLED') {
          order.close_price = onlineOrder.price;
          order.close_amount = onlineOrder.origQty;
          order.updated_at = new Date(Number(onlineOrder.time)).toString();
          order.is_active = false;
          await telegramNotify('Filled order: ' + JSON.stringify(order))
          await this.orderHistoryRepository.update(order)

        } else  if(onlineOrder.status === 'CANCELED') {

          order.updated_at = new Date(Number(onlineOrder.time)).toString();
          order.is_active = false;
          await telegramNotify('Canceled order: ' + JSON.stringify(order))
          await this.orderHistoryRepository.update(order)
        }

        const kline = await this.getKLine(order.symbol)
        const tdResult = this.getTDSequential(kline)
        const currentTd = tdResult[tdResult.length - 1]
        if(currentTd.sellSetupIndex === 9) {
          const currentPrice = await this.getCurrentPrice(order.symbol)
          // @ts-ignore
          await telegramNotify(`9 TD detect: ${order.symbol}: Open - ${order.open_price}, Current - ${currentPrice.data.price}, Change ${(order.open_price * currentPrice.data.price)/order.open_price}`)
        }
      } else {

        const bestStrategy = await this.getBestStrategy();
        if(bestStrategy) {
          // notify strategy
          // create new order with balance free

          const freeBalance = parseFloat((await binance.privateGetAccount()).balances.find((e: {asset: string;}) => e.asset === 'BUSD').free) || 0;

          if (freeBalance && account.order_value) {
            const symbolInfo = SpotMarketData.symbols.find(e => e.symbol === bestStrategy.symbol)

            const priceFilter = symbolInfo?.filters.find(e => e.filterType === 'PRICE_FILTER')
            const lotSize = symbolInfo?.filters.find(e => e.filterType === 'LOT_SIZE')

            const balanceSelected = account.order_value < freeBalance ? account.order_value : freeBalance
            const orderAmount = floorNumberByDecimals( balanceSelected / bestStrategy.price, 8)

            const newOrder = await this.orderHistoryRepository.create({
              account_id: account.id,
              symbol: bestStrategy.symbol,
              open_amount: orderAmount,
              open_price: bestStrategy.price,
            })
            try {
              const entryResult = await binance.privatePostOrder({
                symbol: bestStrategy.symbol,
                quoteOrderQty: floorNumberByDecimals(balanceSelected,8),
                type: 'MARKET',
                side: 'BUY'
              });

              await telegramNotify('Entry success: ' + JSON.stringify(entryResult))

              const tpOrder = await binance.privatePostOrder({
                symbol: bestStrategy.symbol,
                price: floorNumberByRef(bestStrategy.price * (1 + account.order_tp/100), priceFilter?.tickSize),
                quantity: floorNumberByRef(orderAmount, lotSize?.stepSize),
                type: 'LIMIT',
                side: 'SELL',
                timeInForce: 'GTC',
                newClientOrderId: createUniqueId(newOrder.id)
              });

              await telegramNotify('Create tp: ' + JSON.stringify(tpOrder))
            } catch (e) {
              newOrder.is_active = false
              await this.orderHistoryRepository.update(newOrder)
              await telegramNotify('create order fail: ' + e.message)
            }


          } else {
            await telegramNotify('Zero BUSD: ' + freeBalance.toString())
          }
        }
      }
    } catch (e) {
      await telegramNotify('Exchange execute fail! Reason: ' + e.stack)
    }
  }

  async getBestStrategy() {
    const kLineData = await this.getKLineData()
    const buyList = []

    for (const kLineRes of kLineData) {
      // @ts-ignore
      const tdResult = this.getTDSequential(kLineRes)

      const currentTd = tdResult[tdResult.length - 1]
      const beforeCurrentTd = tdResult[tdResult.length - 1 - triggerTd]
      if(currentTd.sellSetupIndex === triggerTd && beforeCurrentTd.buySetupIndex === 9) {
        const currentPrice = await this.getCurrentPrice(kLineRes.symbol)
        buyList.push({
          symbol: kLineRes.symbol,
          price: parseFloat(currentPrice.data.price),
          reason: ''
        })
      }
    }
    if(buyList.length === 0) {
      return null
      // return {
      //   symbol: 'EOSBUSD',
      //   price: 6.52,
      //   reason: ''
      // }
    } else {
      return buyList[Math.floor(Math.random() * buyList.length)];
    }
  }

  getTDSequential (kLineRes: any) : any[] {
    const data = kLineRes.data ? kLineRes.data : kLineRes
    return TDSequential(data.map((e: object[]) => {
      return {
        open: e[1],
        high: e[2],
        low: e[3],
        close: e[4],
      }
    }))
  }

  binanceAjax = axios.create({
    baseURL: 'https://api.binance.com/',
    responseType: 'json',
    withCredentials: false,
  })

  async getKLineData() {
    return Promise.all(
      listToken.map(async (symbol: string) => {
        const klineData = await this.getKLine(symbol)
        return {
          symbol: symbol,
          data: klineData
        }
      })
    )
  }

  async getKLine(symbol: string) {
    try {
      const price = await this.binanceAjax.get(`api/v3/klines?symbol=${symbol}&interval=15m&limit=1000`).then(e => e.data)
      return price
    } catch (e) {
      await telegramNotify(`Get kline fail ${symbol}. Reason: ${e.message}`)
    }

  }

  async getCurrentPrice(symbol: string) {
    return this.binanceAjax.get(`api/v3/avgPrice?symbol=${symbol}`)
  }

  async getSymbolInfo(symbol: string) {
    const exchangeInfo = await this.binanceAjax.get(`api/v3/exchangeInfo`)

    return exchangeInfo.data.symbols.find((e: { symbol: string; }) => e.symbol === symbol)
  }
}