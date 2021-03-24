import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {MysqlDataSource} from '../datasources';
import {Account, AccountRelations, OrderHistory} from '../models';
import {OrderHistoryRepository} from './order-history.repository';

export class AccountRepository extends DefaultCrudRepository<
  Account,
  typeof Account.prototype.id,
  AccountRelations
> {

  public readonly orderHistories: HasManyRepositoryFactory<OrderHistory, typeof Account.prototype.id>;

  constructor(
    @inject('datasources.mysql') dataSource: MysqlDataSource, @repository.getter('OrderHistoryRepository') protected orderHistoryRepositoryGetter: Getter<OrderHistoryRepository>,
  ) {
    super(Account, dataSource);
    this.orderHistories = this.createHasManyRepositoryFactoryFor('orderHistories', orderHistoryRepositoryGetter,);
    this.registerInclusionResolver('orderHistories', this.orderHistories.inclusionResolver);
  }
}
