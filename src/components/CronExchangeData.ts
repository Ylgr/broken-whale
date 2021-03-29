import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {AccountRepository, OrderHistoryRepository} from '../repositories'
import {Account} from '../models'
import ccxt from 'ccxt';
import {decrypt} from '../utils/functions';

@cronJob()
export class CronKeepAliveUserDataStreamComponent extends CronJob {
  constructor(
    @repository(AccountRepository)
    public accountRepository: AccountRepository,
    @repository(OrderHistoryRepository)
    public orderHistoryRepository: OrderHistoryRepository
    ) {
    super({
      name: 'sync exchange data',
      onTick: async () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const accounts = await accountRepository.find({where: {is_active: true}})

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
    const openOrder = await binance.getOpenOrders()
    if (openOrder.length) {
      // checking indicator


      // create new order with balance free

    } else {
      // check db if have a opening order then notify
      const order = await this.orderHistoryRepository.find({where: {is_active: true}})
      if(order.length) {

      }
    }

  }


}