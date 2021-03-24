import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MysqlDataSource} from '../datasources';
import {OrderHistory, OrderHistoryRelations} from '../models';

export class OrderHistoryRepository extends DefaultCrudRepository<
  OrderHistory,
  typeof OrderHistory.prototype.id,
  OrderHistoryRelations
> {
  constructor(
    @inject('datasources.mysql') dataSource: MysqlDataSource,
  ) {
    super(OrderHistory, dataSource);
  }
}
