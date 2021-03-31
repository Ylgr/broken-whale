import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {AccountRepository, OrderHistoryRepository} from '../repositories';
import {Account} from '../models';
import ccxt from 'ccxt';
import {decrypt, telegramNotify} from '../utils/functions';
import TDSequential from 'tdsequential';
import axios from 'axios';
import {listToken} from '../utils/constants'
@cronJob()
export class CronKeepAliveUserDataStreamComponent extends CronJob {
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
      cronTime: '0 */5 * * * *',
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
      const openOrder = await binance.getOpenOrders();
      if (openOrder.length) {
        // checking indicator
        const bestStrategy = await this.getBestStrategy();

        // notify strategy
        // create new order with balance free
        const orderAmount = account.order_value / bestStrategy.price;

        const freeBalance = (await binance.getAccount()).balances.find((e: {asset: string;}) => e.asset === 'USDT').free || 0;

        if (freeBalance) {
          const result = await binance.postOrder({
            symbol: bestStrategy.symbol,
            price: bestStrategy.price,
            quantity: orderAmount,
            type: 'LIMIT',
            side: 'BUY',
          });
          await telegramNotify('Order success: ', JSON.stringify(result))

        } else {
          await telegramNotify('Zero USDT: ', freeBalance)
        }

      } else {
        // check db if have a opening order then notify
        const orders = await this.orderHistoryRepository.find({where: {is_active: true}});
        if (orders.length) {
          for (const order of orders) {
            const onlineOrder = await binance.getOrder({origClientOrderId: order.id, symbol: order.symbol});

            order.close_price = onlineOrder.price;
            order.updated_at = new Date(onlineOrder.time).toString();
            order.is_active = false;

            await telegramNotify('Updating order: ', JSON.stringify(order))
          }
          await this.orderHistoryRepository.updateAll(orders);

        }
      }
    } catch (e) {
      await telegramNotify('Exchange execute fail! Reason: ', e.message)
    }

  }

  async getBestStrategy() {
    const kLineData = await this.getKLineData()

    kLineData.forEach(kLineRes =>{
      const tdResult = TDSequential(kLineRes.data.map((e: object[]) => {
        return {
          open: e[1],
          high: e[2],
          low: e[3],
          close: e[4],
        }
      }))
    })

    return {
      symbol: '',
      price: 32,
      reason: '',
    };
  }

  async getKLineData() {
    const binanceAjax = axios.create({
      baseURL: 'https://api.binance.com/',
      responseType: 'json',
      withCredentials: false,
    })

    return Promise.all(
      listToken.map((symbol: string) => {
        return binanceAjax.get(`api/v3/klines?symbol=${symbol}&interval=15m&limit=1000`)
      })
    )

  }
}