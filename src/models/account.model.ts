import {Entity, model, property, hasMany} from '@loopback/repository';
import {OrderHistory} from './order-history.model';

@model({settings: {strict: true}})
export class Account extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  id?: number;

  @property({
    type: 'string',
  })
  name?: string;

  @property({
    type: 'string',
    required: true,
  })
  api_key: string;

  @property({
    type: 'string',
    required: true,
  })
  secret_key: string;

  @property({
    type: 'number',
    required: true,
  })
  order_value: number;

  @property({
    type: 'number',
    required: true,
  })
  order_tp: number;

  @property({
    type: 'boolean',
    default: true,
  })
  is_active?: boolean;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  created_at?: Date;

  @property({
    type: 'date',
    default: () => new Date(),
  })
  updated_at?: string;

  @hasMany(() => OrderHistory, {keyTo: 'account_id'})
  orderHistories: OrderHistory[];
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Account>) {
    super(data);
  }
}

export interface AccountRelations {
  // describe navigational properties here
}

export type AccountWithRelations = Account & AccountRelations;
