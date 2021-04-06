import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {AccountRepository, OrderHistoryRepository} from '../repositories';
import {Account} from '../models';
import ccxt from 'ccxt';
import {decrypt, telegramNotify, createUniqueId, floorNumberByDecimals} from '../utils/functions';
import axios from 'axios';
import {listToken, triggerTd} from '../utils/constants'
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
        )).then(() =>
          console.log('Execute successes!'),
        ).catch(error =>
          console.error('Cron fail: ' + error.message),
        );
      },
      cronTime: '*/5 * * * * *',
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

        const onlineOrder = await binance.privateGetOrders({origClientOrderId: createUniqueId(order.id)});
        if(onlineOrder.status === 'FILLED') {
          order.close_price = onlineOrder.price;
          order.close_amount = onlineOrder.origQty;
          order.updated_at = new Date(onlineOrder.time).toString();
          order.is_active = false;
          await telegramNotify('Filled order: ', JSON.stringify(order))

        } if(onlineOrder.status === 'CANCELED') {

          order.updated_at = new Date(onlineOrder.time).toString();
          order.is_active = false;
          await telegramNotify('Canceled order: ', JSON.stringify(order))
        }
        await this.orderHistoryRepository.update(order)

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

            const orderAmount = floorNumberByDecimals(account.order_value < freeBalance ? account.order_value / bestStrategy.price : freeBalance/ bestStrategy.price, 8)

            const newOrder = await this.orderHistoryRepository.create({
              account_id: account.id,
              symbol: bestStrategy.symbol,
              open_amount: orderAmount,
              open_price: bestStrategy.price,
            })
            try {
              const entryResult = await binance.privatePostOrder({
                symbol: bestStrategy.symbol,
                quantity: orderAmount,
                type: 'MARKET',
                side: 'BUY'
              });

              await telegramNotify('Entry success: ', JSON.stringify(entryResult))

              const tpOrder = await binance.privatePostOrder({
                symbol: bestStrategy.symbol,
                price: floorNumberByDecimals(bestStrategy.price * (1 + account.order_tp/100), 8),
                quantity: orderAmount,
                type: 'LIMIT',
                side: 'SELL',
                clientOrderId: createUniqueId(newOrder.id)
              });

              await telegramNotify('Create tp: ', JSON.stringify(tpOrder))
            } catch (e) {
              newOrder.is_active = false
              await this.orderHistoryRepository.update(newOrder)
              await telegramNotify('create order fail: ', e.message)
            }


          } else {
            await telegramNotify('Zero USDT: ', freeBalance.toString())
          }
        }
      }
    } catch (e) {
      await telegramNotify('Exchange execute fail! Reason: ', e.message)
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
    } else {
      return buyList[Math.floor(Math.random() * buyList.length)];
    }
    // return {
    //   symbol: 'LTCBUSD',
    //   price: 220,
    //   reason: ''
    // }
  }

  getTDSequential (kLineRes: any) : any[] {
    return TDSequential(kLineRes.data.map((e: object[]) => {
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
        return {
          symbol: symbol,
          data: await this.getKLine(symbol)
        }
      })
    )
  }

  async getKLine(symbol: string) {
    return this.binanceAjax.get(`api/v3/klines?symbol=${symbol}&interval=15m&limit=1000`).then(e => e.data)
  }

  async getCurrentPrice(symbol: string) {
    return this.binanceAjax.get(`api/v3/avgPrice?symbol=${symbol}`)
  }

  async getSymbolInfo(symbol: string) {
    const exchangeInfo = await this.binanceAjax.get(`api/v3/exchangeInfo`)

    return exchangeInfo.data.symbols.find((e: { symbol: string; }) => e.symbol === symbol)
  }
}