import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  Account,
  OrderHistory,
} from '../models';
import {AccountRepository} from '../repositories';

export class AccountOrderHistoryController {
  constructor(
    @repository(AccountRepository) protected accountRepository: AccountRepository,
  ) { }

  @get('/accounts/{id}/order-histories', {
    responses: {
      '200': {
        description: 'Array of Account has many OrderHistory',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(OrderHistory)},
          },
        },
      },
    },
  })
  async find(
    @param.path.number('id') id: number,
    @param.query.object('filter') filter?: Filter<OrderHistory>,
  ): Promise<OrderHistory[]> {
    return this.accountRepository.orderHistories(id).find(filter);
  }

  @post('/accounts/{id}/order-histories', {
    responses: {
      '200': {
        description: 'Account model instance',
        content: {'application/json': {schema: getModelSchemaRef(OrderHistory)}},
      },
    },
  })
  async create(
    @param.path.number('id') id: typeof Account.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(OrderHistory, {
            title: 'NewOrderHistoryInAccount',
            exclude: ['id'],
            optional: ['account_id']
          }),
        },
      },
    }) orderHistory: Omit<OrderHistory, 'id'>,
  ): Promise<OrderHistory> {
    return this.accountRepository.orderHistories(id).create(orderHistory);
  }

  @patch('/accounts/{id}/order-histories', {
    responses: {
      '200': {
        description: 'Account.OrderHistory PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(OrderHistory, {partial: true}),
        },
      },
    })
    orderHistory: Partial<OrderHistory>,
    @param.query.object('where', getWhereSchemaFor(OrderHistory)) where?: Where<OrderHistory>,
  ): Promise<Count> {
    return this.accountRepository.orderHistories(id).patch(orderHistory, where);
  }

  @del('/accounts/{id}/order-histories', {
    responses: {
      '200': {
        description: 'Account.OrderHistory DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.number('id') id: number,
    @param.query.object('where', getWhereSchemaFor(OrderHistory)) where?: Where<OrderHistory>,
  ): Promise<Count> {
    return this.accountRepository.orderHistories(id).delete(where);
  }
}
